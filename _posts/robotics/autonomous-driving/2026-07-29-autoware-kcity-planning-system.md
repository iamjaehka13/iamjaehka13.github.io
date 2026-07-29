---
title: "Autoware 기반 K-City Planning System"
date: 2026-07-29 15:30:00 +0900
last_modified_at: 2026-07-29 15:30:00 +0900
categories: [Robotics, Autonomous Driving]
tags: [autoware-universe, ros2, autonomous-driving, lanelet2, behavior-path-planner, behavior-velocity-planner, cone-planner, freespace-planner, erp42, k-city]
description: "K-City PCD·Lanelet2 지도, 미션 FSM, 라바콘 trajectory planner, 신호·주차·장애물 회피, Autoware–ERP42 인터페이스를 연결한 Planning 시스템의 사양과 검증 범위를 정리한다."
image:
  path: /assets/img/posts/autonomous-driving/autoware-kcity-planning-system/00-preview.png
  alt: K-City Autoware Planning 시스템의 지도, 미션, 경로계획, 제어 계층
---

목표는 Autoware Universe 위에 K-City 주행 미션을 올리는 것.

일반 도로 구간은 Lanelet2 route와 Autoware Behavior Planner를 사용하고, 라바콘 구간은 PointCloud에서 직접 중앙선을 만드는 custom planner를 사용한다. 주차, 정적 장애물, 신호등은 각 planning module로 분리하고, 상위 `task_manager`가 route와 operation mode를 전환한다.

```text
K-City PCD + Lanelet2
→ Route / Mission FSM
→ Behavior Path · Velocity Planning
→ Autoware Trajectory
→ Trajectory Follower
→ Vehicle Command Gate
→ Planning Simulator / ERP42 Interface
```

![Autoware 기반 K-City Planning 시스템 개요](/assets/img/posts/autonomous-driving/autoware-kcity-planning-system/00-preview.png)
_Lanelet2 지도, mission FSM, behavior planning, custom cone planner, control, vehicle interface를 한 경로로 연결한 구조._

## **1. 시스템 목표와 검증 범위**

대상 미션은 다음과 같다.

- Lanelet2 map 기반 일반 route 주행
- 신호등과 stop line 감속·정지
- 황색 신호 dilemma zone 판단
- 정적 장애물 회피
- 주차 영역 진입과 Freespace Planning
- 라바콘 좌·우 경계 기반 custom trajectory 생성
- route, preset, trigger 기반 미션 전환
- Autoware command와 ERP42 command/status 변환

기록된 개발환경은 아래와 같다.

| 항목 | 구성 |
|---|---|
| Middleware | ROS 2 Humble |
| Planning stack | Autoware Universe 2024.01 계열 |
| Simulator | Autoware Planning Simulator, CARLA 0.9.15 환경 구성 문서 |
| Map | K-City PCD + Lanelet2 OSM + map projector YAML |
| Vehicle target | ERP42 |
| Custom nodes | cone planner, task manager, reset cone finder |

검증 범위에는 선을 그어야 한다.

| 등급 | 의미 |
|---|---|
| 실행 확인 | simulator/RViz 실행 기록, 로그, 이미지 또는 영상이 남아 있음 |
| 산출물 확인 | source, ROS 2 package, map, config가 존재하고 정적 검사를 통과함 |
| 부분 확인 | 핵심 동작은 보였지만 crash, 경계조건, tuning 문제가 남음 |
| 설계 | 요구사항과 구조만 있고 build/runtime 근거가 없음 |

라바콘 trajectory, 신호등, 주차, 회피는 Planning Simulator 또는 RViz 중심으로 확인했다. 모든 미션을 자동 전환하면서 ERP42가 K-City 전체 코스를 완주한 실차 end-to-end 결과는 확인하지 못했다.

## **2. 전체 아키텍처**

![K-City Autoware Planning 시스템 아키텍처](/assets/img/posts/autonomous-driving/autoware-kcity-planning-system/01-system-architecture.svg)
_Map·localization·perception 입력이 route와 behavior planning을 거쳐 control/vehicle interface로 전달된다. 라바콘 구간은 custom planner가 Autoware Trajectory를 직접 만든다._

설계는 `route`, `preset`, `trigger`의 책임을 분리했다.

| 계층 | 책임 |
|---|---|
| Route | 목적지, waypoint, 주행할 Lanelet2 도로 문맥 |
| Preset | 해당 구간에서 활성화할 planning module과 parameter |
| Trigger | 시간, topic 값, route 상태, 외부 goal에 따른 미션 전환 |
| Behavior Path Planner | 회피, lane change, start/goal path, drivable area |
| Behavior Velocity Planner | 신호등, 정지선, 교차로의 감속·정지 |
| Cone Planner | 라바콘 경계에서 Autoware Trajectory 생성 |
| Control | trajectory를 조향·가감속 command로 변환 |
| Vehicle Interface | Autoware command와 ERP42 command/status를 변환 |

Scenario Selector를 임의로 강제 전환하는 구조는 사용하지 않았다. Route와 goal로 주행 문맥을 만들고, module 차이는 preset, 미션 순서는 FSM이 담당한다.

```text
Route     = 어디로 주행할 것인가
Preset    = 어떤 planner 설정으로 주행할 것인가
Trigger   = 언제 다음 미션으로 전환할 것인가
```

## **3. 주요 컴포넌트 계약**

Autoware 통합에서 node 이름보다 중요한 것은 입력과 출력의 의미다.

| 컴포넌트 | 주요 입력 | 주요 출력 | 실패 시 영향 |
|---|---|---|---|
| Map Loader | PCD, Lanelet2 OSM, projector YAML | pointcloud/vector map | localization·route·규제 정보 불일치 |
| Mission Planner | route request, vector map | mission route | route 생성 실패 |
| `task_manager` | YAML, routing state, trigger topic | route/mode service call | 다음 미션으로 전환하지 못함 |
| Behavior Path Planner | route, map, odometry, objects | path, drivable area | 회피·start/goal maneuver 실패 |
| Behavior Velocity Planner | path with lane ID, map, signal | 속도가 반영된 path | 정지선·신호 대응 실패 |
| Freespace Planner | route, OccupancyGrid, odometry, scenario | 주차 trajectory | goal 접근·전후진 path 실패 |
| Cone Planner | PointCloud2, TF | Trajectory, Path, Marker | 0속도 stop trajectory |
| Trajectory Follower | trajectory, vehicle state | control command | 조향·속도 command 미생성 |
| Vehicle Command Gate | control/mode/vehicle status | gated vehicle command | engage·mode 조건 불충족 시 command 제한 |
| ERP42 Interface | Autoware command, ERP42 status | ERP42 command, Autoware status | gear·steering·velocity 의미 불일치 |

프로젝트 source는 2024.01 계열 message를 기준으로 한다. 이후 Autoware에서는 package와 message 이름이 바뀐 부분이 있으므로 현재 배포판에 그대로 옮길 때는 import, `package.xml`, topic type을 다시 맞춰야 한다.

## **4. K-City PCD와 Lanelet2 Map**

Autoware map은 하나의 파일이 아니다.

```text
map/
├── pointcloud_map.pcd
├── lanelet2_map.osm
└── map_projector_info.yaml
```

각 파일의 책임은 다르다.

| 자산 | 역할 |
|---|---|
| `pointcloud_map.pcd` | LiDAR localization과 RViz의 기하 지도 |
| `lanelet2_map.osm` | 차선, 연결관계, route, traffic rule |
| `map_projector_info.yaml` | global 좌표와 local map 좌표의 변환 기준 |

보존된 PCD 규모는 다음과 같다.

| PCD | point 수 |
|---|---:|
| `GlobalMap 1.pcd` | 4,863,527 |
| `GlobalMap.pcd` | 3,075,311 |
| K-City v1 `GlobalMap.pcd` | 1,048,185 |
| `SurfMap.pcd` | 1,171,958 |
| `CornerMap.pcd` | 96,798 |

Map은 `kcity_map_1`, `1_1`, `1_2`, `1_3`, `2`, `2_1`, `2_2` 순으로 수정됐다. 단순히 차선을 더 그린 것이 아니라 planning이 사용하는 semantic relation을 보정했다.

- 교차로의 단일 lanelet 분할
- lanelet predecessor/successor 연결
- 잘못된 즉시 U-turn route 수정
- traffic light와 stop line regulatory element 연결
- orphan/mismatched reference 제거
- parking lot polygon 추가
- 예선·본선 map 분리

[Autoware Map 설계 문서](https://autowarefoundation.github.io/autoware-documentation/main/design/autoware-architecture-v1/components/map/)도 vector map에 차선 연결, traffic light, stop line, parking area, traffic rule이 필요하다고 명시한다. Lanelet2 map은 시각화 배경이 아니라 route와 behavior의 입력이다.

![K-City pointcloud map 위 obstacle avoidance 경로](/assets/img/posts/autonomous-driving/autoware-kcity-planning-system/03-kcity-map-avoidance.png)
_K-City pointcloud map 위에서 생성된 drivable corridor와 obstacle avoidance path. RViz/Planning Simulator 결과이며 실차 완주 결과는 아니다._

### Map 오류가 planner crash로 이어진 경우

Avoidance node의 `bad_optional_access`를 처음 보면 회피 알고리즘을 의심하기 쉽다. 실제 원인은 traffic light regulatory element에 연결될 stop line이 없거나 reference가 맞지 않은 map이었다.

```text
잘못된 traffic-light relation
→ route상의 규제 요소 조회 실패
→ behavior planning 내부 optional 값 부재
→ node crash
```

문제 traffic light를 제거하거나 stop line relation을 바로잡은 뒤 같은 crash가 사라졌다. Map validation은 route 생성 확인만으로 끝내면 안 된다. Traffic light, stop line, lanelet, parking polygon을 실제 planner가 읽는 조건까지 확인해야 한다.

## **5. 라바콘 전용 Trajectory Planner**

라바콘 구간은 도로 중심선보다 관측된 좌·우 콘 경계가 직접적인 주행 기준이다. Costmap에서 충돌 없는 path만 찾는 것보다, 경계를 복원하고 그 중앙선을 따라가는 구조가 더 명확했다.

![PointCloud 기반 cone planner 처리 흐름](/assets/img/posts/autonomous-driving/autoware-kcity-planning-system/02-cone-planner-pipeline.svg)
_PointCloud2를 map frame으로 변환한 뒤 좌·우 경계와 중앙선을 만들고, 곡률 기반 속도를 포함한 Autoware Trajectory를 발행한다._

### I/O 사양

| 구분 | 값 |
|---|---|
| 기본 입력 | `/perception/cones` (`sensor_msgs/PointCloud2`) |
| 선택 입력 | `/cones_yellow`, `/cones_blue` |
| 출력 frame | `map` |
| trajectory 출력 | `/planning/scenario_planning/trajectory` |
| debug 출력 | `/debug/cone_planner_markers`, `/debug/trajectory_path` |
| publish 주기 | source 기본값 10 Hz |
| 실패 동작 | 2개 point의 0속도 stop trajectory |

보존된 최신 loose source의 주요 기본 parameter는 아래와 같다.

| Parameter | 기본값 | 의미 |
|---|---:|---|
| `roi_forward` | 12.0 m | 전방 처리 범위 |
| `roi_width` | 6.0 m | 좌우 처리 폭 |
| `width_min`, `width_max` | 1.5, 4.0 m | 허용 track 폭 |
| `ds` | 0.5 m | trajectory 재표본화 간격 |
| `lookahead_dist` | 10.0 m | 전방 trajectory 길이 |
| `dbscan_eps` | 1.5 m | 무색상 cone 군집 반경 |
| `chain_max_link_dist` | 3.0 m | 경계 chain의 최대 cone 간격 |
| `chain_max_angle_deg` | 80° | 경계 연결 방향 변화 제한 |
| `v_min`, `v_max` | 0.5, 5.0 m/s | source에 선언된 속도 범위 |
| `a_lat_max` | 0.4 m/s² | 곡률 기반 속도 제한의 횡가속 기준 |

`v_max=5.0 m/s`는 source에 선언된 값이지 검증된 안전속도가 아니다. 실행 화면에는 1.0 m/s가 기록돼 있고, 별도 시험 기록에는 3 m/s 주행이 남아 있다. Parameter 선언, 시험 설정, 실제 검증 속도를 구분해야 한다.

### 처리 파이프라인

1. PointCloud2를 수신한다.
2. message timestamp 기준 TF로 sensor frame을 `map`으로 변환한다.
3. timestamp TF가 없으면 latest TF fallback을 시도한다.
4. ROI 밖의 point를 제거한다.
5. 시간 window, TTL, 공간 중복 제거, EMA로 검출 흔들림을 줄인다.
6. 색상 topic이 있으면 좌·우 경계를 직접 나눈다.
7. 무색상 입력이면 DBSCAN과 기하 조건으로 두 경계를 나눈다.
8. 거리·방향·각도 제약으로 cone chain을 만든다.
9. 각 chain에 B-spline을 fitting한다.
10. 같은 arc length 기준으로 두 경계를 재표본화한다.
11. 양쪽 경계의 midpoint로 centerline을 만든다.
12. 한쪽 경계만 있으면 track 폭 추정값을 이용해 fallback centerline을 만든다.
13. ego 앞단에 trajectory 시작점을 정렬한다.
14. yaw와 곡률을 평활화한다.
15. 곡률 기반 속도 profile을 만들고 Autoware Trajectory를 발행한다.

속도 제한은 기본적으로 횡가속 관계를 사용한다.

```text
curvature 증가
→ 허용 속도 감소
→ curve 진입 전 감속
```

Centerline을 만들 수 없을 때 빈 trajectory를 내보내지 않는다. 현재 pose 근처에 0속도 point 두 개를 넣은 stop trajectory를 발행한다. Downstream controller가 stale path를 계속 따라가는 것보다 안전한 fallback이다.

### Autoware Control 연결

```text
/perception/cones
→ cone_planner_node
→ /planning/scenario_planning/trajectory
→ trajectory_follower
→ /control/trajectory_follower/control_cmd
→ vehicle_cmd_gate
→ simple_planning_simulator
```

![Cone planner trajectory의 Autoware Control 추종](/assets/img/posts/autonomous-driving/autoware-kcity-planning-system/04-cone-planner-control.png)
_좌·우 cone 경계와 중앙 trajectory를 따라 3.60 km/h로 움직이는 Planning Simulator 화면. 실제 ERP42 주행 장면은 아니다._

이전 ROS 2 package에는 `circle_planner_node`, `cone_planner_node`, `no_color_cone_planning_node`의 colcon/ament 설치 성공 로그가 있다. 원형·사각형·톱니 코스의 3 m/s 시험 기록도 남아 있다.

남은 문제는 다음과 같다.

- 초기 무색상 DBSCAN 버전의 불안정
- 좁은 곡선에서 cone 쪽으로 붙는 경로
- TF lookup과 yaw 변화의 경계조건
- 10 Hz 반복 실행의 재현성
- 최신 loose source의 clean build와 regression test 부재
- 실제 LiDAR detection과 ERP42를 연결한 코스 완주 근거 부재

최종 상태는 **시뮬레이터에서 trajectory 생성과 control 연결 확인, 실차 검증 미확인**이다.

## **6. Behavior Path와 Velocity Planning**

[Behavior Path Planner](https://autowarefoundation.github.io/autoware_universe/main/planning/behavior_path_planner/autoware_behavior_path_planner/)는 route와 주변 상황을 바탕으로 path, drivable area, turn signal을 만든다. 이 시스템에서 다룬 주요 module은 다음과 같다.

- static obstacle avoidance
- lane change
- start planner
- goal planner
- side shift
- parking 관련 module

Behavior Velocity Planner는 path 형상을 크게 바꾸기보다 신호·정지선·교차로 조건에 맞춰 속도와 stop point를 넣는다.

### 신호등과 dilemma zone

Traffic Light module의 입력에는 route상의 traffic light와 stop line relation, traffic signal, 현재 속도가 필요하다. [공식 Traffic Light module 문서](https://autowarefoundation.github.io/autoware_universe/latest/planning/behavior_velocity_planner/autoware_behavior_velocity_traffic_light_module/)도 황색 신호에서 정지 가능 여부를 계산해 통과 또는 정지를 선택하는 구조를 설명한다.

확인된 시험은 아래와 같다.

| 조건 | 결과 |
|---|---|
| stop line 약 15 m 전에서 yellow | 정지 |
| stop line 약 3 m 전에서 yellow | dilemma zone 판단으로 통과 |
| traffic light/stop line relation 오류 | planning node crash |
| relation 수정 또는 문제 요소 제거 | 같은 crash가 사라짐 |

실제 신호 인식기나 C-ITS 장비를 연결한 검증은 아니다. RViz의 traffic-light 입력과 Planning Simulator 조건에서 확인한 rule-based behavior다.

### 정적 장애물 회피

Avoidance에서 검토한 parameter 범주는 다음과 같다.

- 객체 class별 lateral margin
- 인접 차선·반대 차선 사용
- prepare distance
- shift length
- lateral acceleration와 jerk
- RSS 계열 safety check
- avoidance 대상 class

실험용 `avoidance.param_changed.yaml`에는 인접·반대 차선과 force avoidance를 허용하고 일부 margin을 크게 줄인 값이 있다. 특히 `unknown.safety_buffer_lateral: -0.2`는 실제 차량에 적용할 수 있는 안전값이 아니다.

Obstacle Stop Planner를 끈 시험에서는 차량이 장애물을 그대로 통과했다. Rule-based avoidance가 모든 복잡한 상황에서 충돌 회피를 보장하지 않는다는 [Autoware static obstacle avoidance 문서의 limitation](https://autowarefoundation.github.io/autoware_universe/main/planning/behavior_path_planner/autoware_behavior_path_static_obstacle_avoidance_module/)과도 같은 방향이다.

```text
Behavior Path Avoidance
→ 회피 path 생성

Motion-level obstacle avoidance/stop
→ 최종 충돌 검사와 정지
```

Obstacle Stop Planner는 마지막 안전 계층으로 유지해야 한다.

## **7. 주차와 Freespace Planner**

주차는 Lanelet2 parking area, obstacle costmap, goal pose를 결합했다.

```text
parking area in Lanelet2
+ cone / obstacle OccupancyGrid
+ parking goal pose
→ Freespace Planner
→ forward / reverse trajectory
```

![K-City 주차·회피 구간의 Planning 결과](/assets/img/posts/autonomous-driving/autoware-kcity-planning-system/05-parking-freespace.png)
_K-City pointcloud/Lanelet2 위에서 생성된 parking·freespace 계열 path. Simulator에서 path가 생성됐지만 안정적인 자동 출차까지 확인한 결과는 아니다._

[Autoware Freespace Planner](https://autowarefoundation.github.io/autoware_universe/main/planning/autoware_freespace_planner/)는 route, OccupancyGrid, odometry, scenario를 입력으로 받아 obstacle이 있는 free space에서 trajectory를 만든다. 프로젝트에서는 A*/Hybrid A* 계열 parameter를 중심으로 시험했다.

조정한 범주는 다음과 같다.

- reverse 허용
- minimum turning radius
- reverse weight
- 차량 footprint와 safety margin
- obstacle threshold
- costmap 범위
- goal pose 위치와 yaw

주차 path와 동작은 simulator에서 확인했다. 그러나 goal constraint가 강하고, 최종 yaw가 불안정하며, 주차 후 먼 일반 route goal을 바로 주면 Freespace Planner가 차선 밖까지 계획하거나 crash하는 경우가 있었다.

대응은 차선 위 intermediate goal을 먼저 주는 것.

```text
parking goal
→ 주차 완료
→ 차선 위 intermediate goal
→ 일반 route goal
```

슬롯 인식부터 주차, 출차, 일반 route 복귀까지 이어지는 실차 자동주차는 검증하지 않았다.

## **8. Route·Preset·Mission FSM**

Autoware Routing API의 waypoint는 stop point가 아니라 통과점이다. [공식 Routing 문서](https://autowarefoundation.github.io/autoware-documentation/main/design/autoware-architecture-v1/interfaces/ad-api/features/routing/)도 여러 stop을 하나의 route로 처리하지 않고 application이 route를 나눠 전환해야 한다고 설명한다.

이 역할을 `task_manager`가 담당한다.

| 기능 | 구현 |
|---|---|
| Mission 정의 | YAML waypoint/goal sequence |
| Route 설정 | `/api/routing/set_route_points` |
| Route 해제 | `/api/routing/clear_route` |
| Route 상태 | `/api/routing/state` |
| Trigger | immediate, timer, topic value, route state, topic pose |
| Operation mode | autonomous, stop, local, remote |
| Control 전환 | Autoware control enable/disable |
| 복구 | autonomous mode 재시도, mission loop |

Mission YAML 구조는 다음 형태다.

```yaml
loop: false

missions:
  - name: FIRST_ROUTE
    trigger:
      type: immediate
    route:
      frame_id: map
      goal:
        x: 0.0
        y: 0.0
        yaw_deg: 0.0
    completion:
      wait_sec: 3.0
      clear_route: true

  - name: SENSOR_TRIGGERED_ROUTE
    trigger:
      type: topic_value
      topic: /mission/trigger
      msg_type: std_msgs/msg/UInt32
      field: data
      value: 1
    route:
      frame_id: map
      goal:
        x: 10.0
        y: 5.0
        yaw_deg: 90.0
```

ROS 2 package와 YAML 예제가 존재하고 Python syntax/구조 검사를 통과했다. 다만 K-City의 모든 mission이 이 FSM으로 자동 완료됐다는 runtime 기록은 없다.

### Reset cone finder

주차·복구 구간에는 별도 `reset_cone_finder` package도 있다.

- `map`→`base_link` TF를 0.2초마다 확인
- 지정 좌표 반경 1.5 m 진입 감지
- `/parking/reset_cone_finder`에 `std_msgs/Empty` 발행

현재 구조는 반경 안에서 계속 message를 발행한다. 소비 node가 edge trigger를 기대하면 한 번만 발행하도록 latch/debounce를 넣어야 한다. Package는 존재하지만 mission runtime은 확인하지 못했다.

## **9. Planning에서 Control까지 필요한 입력**

Planning Simulator에서는 dummy node가 localization, perception, vehicle status를 대신 공급한다. 실제 차량으로 바꾸면 이 contract를 모두 채워야 한다.

| 계층 | 확인한 입력 |
|---|---|
| Localization | `/localization/kinematic_state`, `/localization/acceleration`, `map`–`base_link` TF |
| Perception | PointCloud, OccupancyGrid, predicted objects |
| Vehicle status | velocity, steering, gear, control mode |
| System | initialization state, Autoware state, operation mode, engage |

Localization만 넣었을 때는 trajectory가 생성되지 않았다. Dummy PointCloud와 OccupancyGrid를 추가하고 odometry·acceleration을 제공한 뒤 planning trajectory가 나왔다. Steering status까지 공급한 뒤 `/control/command/control_cmd` 생성을 확인했다.

```text
trajectory가 없음
→ map / route / localization / perception 확인

trajectory는 있지만 control command가 없음
→ steering / velocity / gear / control mode 확인

control command는 있지만 차량 command가 제한됨
→ operation mode / engage / command gate 확인
```

[Autoware vehicle integration 문서](https://autowarefoundation.github.io/autoware-documentation/latest/how-to-guides/integrating-autoware/overview/)도 vehicle interface가 `vehicle_cmd_gate`의 command를 차량에 전달하고, 차량 status를 Autoware로 돌려줘야 한다고 정의한다.

### Operation mode와 system layer

`launch_system=false`로 실행하면 planning/control 계산만 남고 operation mode, `/autoware/state`, engage, gear, command gate의 상태 전이가 막혔다.

[Operation Mode API](https://autowarefoundation.github.io/autoware-documentation/main/design/autoware-architecture-v1/interfaces/ad-api/features/operation_mode/)는 다음 mode를 제공한다.

- Stop
- Autonomous
- Local
- Remote
- Autoware control enable/disable

누락된 localization initialization state를 공급한 뒤 `/autoware/state`가 `DRIVING`으로 전환된 기록이 있다. Planner node만 띄우는 것과 차량을 Autonomous 상태로 만드는 것은 다른 문제다.

## **10. Autoware–ERP42 Vehicle Interface**

Vehicle interface는 Autoware와 ERP42 사이에서 command와 status의 의미를 맞춘다.

| 방향 | 변환 |
|---|---|
| Autoware → ERP42 | 속도, 조향, brake/control command |
| ERP42 → Autoware | velocity, steering, gear, control mode report |
| Gear | Autoware D/N/R ↔ ERP42 `0/1/2` |
| Unknown gear | Neutral fallback |
| Steering | 단위 변환과 기록상 4% 보정 |

핵심은 단순 topic rename이 아니다.

```text
Autoware control command
→ ERP42 단위와 범위로 변환
→ drive-by-wire command

ERP42 feedback
→ Autoware vehicle status 의미로 변환
→ planner/controller/operation mode에 feedback
```

ERP42 raw bridge가 작동했다는 기록은 있다. 그러나 interface source는 독립 package보다 Markdown 안의 구현 초안에 가깝고, ECU feedback까지 포함한 full closed-loop 실차 주행은 확인하지 못했다.

## **11. Crash와 통합 오류**

Algorithm tuning보다 interface와 상태 준비 문제가 더 많은 시간을 사용했다.

| 증상 | 원인 | 대응 |
|---|---|---|
| Start Planner 종료 | `validateNonEmpty(): Points is empty` | 입력 객체, path, lane, route 준비 상태를 먼저 검사 |
| Avoidance node crash | traffic light/stop line relation 오류 | Lanelet2 regulatory relation 보정 |
| Trajectory 미생성 | localization 외 perception 입력 누락 | PointCloud, OccupancyGrid, odometry, acceleration 보강 |
| Control command 미생성 | steering status 누락 | vehicle status contract 보강 |
| Autonomous 전환 실패 | system layer/initialization state 누락 | `launch_system` 유지, initialization state 공급 |
| 주차 후 route 복귀 실패 | 먼 goal을 바로 설정 | 차선 위 intermediate goal 사용 |
| Cone path 불안정 | TF, yaw, detection noise | temporal buffer, EMA, yaw limit, stop fallback |

### Start Planner fail-closed patch

Start Planner는 빈 points가 들어오면 process가 종료됐다.

```text
validateNonEmpty(): Points is empty
```

수정본은 다음 상태를 먼저 검사한다.

- `planner_data`
- odometry
- route handler
- dynamic objects
- route ready
- 최소 path point 수
- current lanes

준비되지 않았으면 warning 후 `false`를 반환한다. 잘못된 입력을 억지로 통과시키는 것이 아니라 maneuver를 승인하지 않는 fail-closed 동작이다.

수정 C++ artifact와 적용 후 문제없이 사용했다는 기록은 있다. 현재 Autoware checkout에서 다시 build한 결과는 아니다.

## **12. 구현 산출물**

| 산출물 | 내용 | 상태 |
|---|---|---|
| `cone_planner_node.py` | PointCloud 기반 boundary/centerline/Trajectory | source 및 simulator 기록 |
| `cone_planner*.zip` | 여러 세대의 ROS 2 package | 이전 세대 build/install 로그 |
| `cone_csv_publisher.py` | CSV cone 좌표를 PointCloud2로 재생 | source |
| `circle_planner_node.py` | 원형 trajectory로 control 독립 시험 | source |
| `cone_control_sim.launch.xml` | custom trajectory와 Control/Simulator 연결 | launch artifact |
| `task_manager.zip` | route/mode/trigger FSM | ROS 2 package |
| `reset_cone_finder.zip` | 좌표 반경 기반 reset trigger | ROS 2 package |
| `start_planner_module 1.cpp` | empty-input fail-closed patch | C++ patch |
| `default_preset.yaml` | 필요한 planning module 선택 | config |
| `avoidance.param_changed.yaml` | 좁은 회피 시험용 parameter | 실험용, 실차 사용 금지 |
| `kcity_map_*` | PCD, Lanelet2, projector package | 여러 map version |

정적 검사 결과는 다음과 같다.

- ZIP 17개 무결성 검사 통과
- loose XML/OSM 5개 XML parse 통과
- loose YAML 2개 parse 통과
- loose/압축 내부 cone planner Python 13개 AST 문법 검사 통과
- 이전 cone package의 ament/colcon 설치 로그 확인
- WEBM 23개 decode 가능

이 검사는 파일이 깨지지 않았고 문법이 맞는다는 뜻이다. 현재 Autoware 배포판에서 모든 package가 clean build되고 runtime contract를 만족한다는 뜻은 아니다.

## **13. 미션별 검증 상태**

| 기능 | 상태 | 확인 범위 | 확인하지 못한 것 |
|---|---|---|---|
| K-City PCD·Lanelet2 | 실행 확인 | map load, route/path 생성 | 전체 route reachability, 실차 완주 |
| 라바콘 trajectory | 실행 확인 | simulator, Control 연결, 1/3 m/s 기록 | 실제 LiDAR·ERP42 코스 |
| 신호등·dilemma zone | 실행 확인 | RViz/Simulator yellow 시험 | 실제 신호 인지·C-ITS |
| 정적 장애물 회피 | 부분 확인 | simulator path와 parameter 시험 | 안전 margin과 실차 안정성 |
| 주차 | 부분 확인 | Freespace path와 주차 동작 | 슬롯 인식부터 자동 출차 |
| `task_manager` | 산출물 확인 | package, YAML, syntax | 전체 mission 자동 완료 |
| `reset_cone_finder` | 산출물 확인 | package와 trigger logic | mission runtime |
| Start Planner patch | 산출물·적용 기록 | fail-closed code | 현재 checkout regression |
| ERP42 interface | 부분 확인 | raw bridge 기록과 변환 code | ECU feedback 포함 closed-loop |
| 배달 A/B | 설계 | route/stop 구현안 | 구현과 시험 |
| LiDAR Hybrid A* BPP | 설계 | 요구사항 | source, build, runtime |
| K-City 전체 실차 주행 | 미확인 | 개별 subsystem 근거만 존재 | end-to-end 완주 |

## **14. 실제 차량 검증 전에 필요한 것**

### 1. Build 재현

- Autoware 버전과 message package를 고정한다.
- `autoware_auto_planning_msgs`와 `autoware_planning_msgs` 의존성을 하나로 맞춘다.
- hard-coded CSV path를 ROS parameter로 바꾼다.
- package version, maintainer, license placeholder를 정리한다.
- cone planner, task manager, vehicle interface를 clean workspace에서 build한다.

### 2. Simulator regression

- 동일 cone 입력으로 10회 연속 path 생성
- TF 지연·누락 시 stop fallback 확인
- 좁은 curve에서 cone 침범 여부 측정
- route clear/set과 operation mode 전환 반복
- 주차 진입·중간 goal·일반 route 복귀 반복
- map validator와 traffic-light/stop-line relation 검사

### 3. Safety parameter 복원

- 음수 lateral safety buffer 제거
- 차량 footprint, localization error, LiDAR noise를 포함한 margin 설정
- opposite lane과 force avoidance 기본 비활성화
- Obstacle Stop Planner 유지
- command timeout, emergency stop, process crash 대응 확인

### 4. 저속 실차 단계

```text
vehicle interface 단독
→ straight/steering/gear feedback
→ fixed trajectory 저속 추종
→ cone planner 저속 추종
→ 신호·회피·주차 개별 미션
→ route/preset/FSM 연속 실행
→ 전체 코스
```

Simulator에서 path가 보인다는 이유로 바로 전체 미션을 실행하면 안 된다. 각 단계는 control command, vehicle feedback, stop fallback, operator emergency stop이 모두 확인된 뒤 다음 단계로 넘어가야 한다.

## **15. 정리**

이 시스템의 핵심은 Autoware module을 각각 실행한 것이 아니다.

```text
지도
→ route
→ behavior planning
→ custom trajectory
→ control
→ vehicle status
→ system state
```

이 연결을 K-City 미션 단위로 구성하고, map semantics와 topic contract가 실제 planner 동작에 어떤 영향을 주는지 확인했다.

라바콘, 신호·정지선, 주차, 장애물 회피는 simulator/RViz에서 개별 동작을 확인했다. `task_manager`, reset trigger, Start Planner patch도 source artifact로 남았다. 다음 단계는 실험용 safety margin을 복원하고, 실제 센서 지연과 vehicle feedback을 포함한 조건에서 전체 route/preset/FSM을 반복 검증하는 것.

## **참고 자료**

- [Autoware Planning Components](https://autowarefoundation.github.io/autoware_universe/latest/planning/)
- [Autoware Map Component Design](https://autowarefoundation.github.io/autoware-documentation/main/design/autoware-architecture-v1/components/map/)
- [Autoware Routing API](https://autowarefoundation.github.io/autoware-documentation/main/design/autoware-architecture-v1/interfaces/ad-api/features/routing/)
- [Autoware Behavior Path Planner](https://autowarefoundation.github.io/autoware_universe/main/planning/behavior_path_planner/autoware_behavior_path_planner/)
- [Autoware Traffic Light Module](https://autowarefoundation.github.io/autoware_universe/latest/planning/behavior_velocity_planner/autoware_behavior_velocity_traffic_light_module/)
- [Autoware Freespace Planner](https://autowarefoundation.github.io/autoware_universe/main/planning/autoware_freespace_planner/)
- [Autoware Operation Mode API](https://autowarefoundation.github.io/autoware-documentation/main/design/autoware-architecture-v1/interfaces/ad-api/features/operation_mode/)
- [Integrating Autoware with a Vehicle](https://autowarefoundation.github.io/autoware-documentation/latest/how-to-guides/integrating-autoware/overview/)
