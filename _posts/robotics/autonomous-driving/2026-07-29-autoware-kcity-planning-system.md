---
title: "Autoware 기반 K-City Planning System"
date: 2026-07-29 15:30:00 +0900
last_modified_at: 2026-07-29 18:23:00 +0900
categories: [Robotics, Autonomous Driving]
tags: [autoware-universe, ros2, autonomous-driving, lanelet2, behavior-path-planner, behavior-velocity-planner, cone-planner, freespace-planner, erp42, k-city, carla, lidar, field-test, vehicle-interface]
description: "K-City 지도와 미션 planning, CARLA 통합, 학교 콘 시험, 실제 대회 LiDAR 콘 인식 주행, Autoware–ERP42 인터페이스를 정리한다."
image:
  path: /assets/img/posts/autonomous-driving/autoware-kcity-planning-system/00-preview.png
  alt: K-City Autoware Planning 시스템의 지도, 미션, 경로계획, 제어 계층
---

Autoware Universe 위에 K-City 주행 미션을 구성했다.

일반 도로에서는 Lanelet2 route와 Autoware Behavior Planner를 사용한다. 라바콘 구간에서는 LiDAR PointCloud로 좌·우 경계를 복원하고, 중앙선을 `Trajectory`로 발행하는 custom planner가 주행 경로를 맡는다. 주차·장애물·신호등은 각 planning module로 나누고, 상위 `task_manager`가 route와 operation mode를 전환하는 구조다.

```text
K-City PCD + Lanelet2
→ Route / Mission FSM
→ Behavior Planning 또는 Cone Planning
→ Trajectory Follower
→ Vehicle Command Gate
→ Planning Simulator 또는 ERP42
```

기반 환경은 ROS 2 Humble과 Autoware Universe 2024.01 계열. K-City PCD·Lanelet2·projector 설정을 하나의 map package로 묶었다. Planning Simulator에서 planning을 검증하고 CARLA 0.9.15·RViz 동시 실행 화면을 구성한 뒤 학교와 대회 현장 시험으로 이어갔다.

## **1. 시스템 구성**

![K-City Autoware Planning 시스템 아키텍처](/assets/img/posts/autonomous-driving/autoware-kcity-planning-system/01-system-architecture.svg)
_K-City planning system의 계층 구조._

구성은 다섯 계층으로 나뉜다.

| 계층 | 역할 |
|---|---|
| Map·Localization·Perception | PCD, Lanelet2, pose, obstacle, cone 입력 |
| Route·Mission | 목적지와 waypoint 설정, 미션 순서와 trigger 관리 |
| Planning | 일반 도로의 path·velocity planning, 라바콘 중앙 trajectory 생성 |
| Control | trajectory를 조향·가감속 command로 변환 |
| Vehicle Interface | Autoware command와 ERP42 command/status 변환 |

Autoware의 기존 module은 신호·회피·주차에 사용하고, 라바콘처럼 관측 경계가 곧 도로가 되는 구간만 custom planner로 분리했다. Cone planner의 출력은 downstream control이 바로 받을 수 있는 Autoware `Trajectory` 계약으로 맞췄다.

Source와 message contract는 2024.01 계열 기준이다. 최신 Autoware로 옮길 때는 package, message type, topic remap을 다시 맞춰야 한다.

## **2. 지도와 미션 구성**

Map은 배경 이미지가 아니라 planner의 입력이다.

```text
map/
├── pointcloud_map.pcd
├── lanelet2_map.osm
└── map_projector_info.yaml
```

| 파일 | 쓰임 |
|---|---|
| `pointcloud_map.pcd` | LiDAR localization과 RViz 기하 지도 |
| `lanelet2_map.osm` | 차선 연결, route, traffic rule, parking area |
| `map_projector_info.yaml` | global 좌표와 local map 좌표의 변환 기준 |

K-City Lanelet2 map에서는 다음 항목을 반복 수정했다.

- 교차로 lanelet 분할과 predecessor/successor 연결
- 잘못된 U-turn route와 끊긴 reference 보정
- traffic light–stop line regulatory relation 연결
- parking polygon 추가와 예선·본선 map 분리

Map semantic 오류가 planner crash로 이어졌다. Traffic light relation에 연결된 stop line이 없자 Behavior Planner 내부 조회가 실패하며 `bad_optional_access`가 발생했다.

```text
잘못된 traffic-light relation
→ 규제 요소 조회 실패
→ optional 값 부재
→ planning node 종료
```

Stop line relation을 바로잡은 뒤 같은 오류가 사라졌다. Route 생성만으로 충분하지 않다. Traffic light, stop line, lanelet, parking polygon relation까지 module 입력으로 유효해야 한다.

### Route·Preset·Trigger

미션은 세 종류의 정보로 분리했다.

| 항목 | 책임 |
|---|---|
| Route | 어디로 주행할지 결정하는 waypoint와 goal |
| Preset | 구간별 planning module과 parameter 조합 |
| Trigger | timer, topic 값, route 상태, 외부 goal에 따른 전환 조건 |

`task_manager`는 YAML mission을 읽어 `/api/routing/set_route_points`, `/api/routing/clear_route`, `/api/routing/state`와 operation mode service를 사용한다. Trigger는 immediate, timer, topic value, route state, topic pose를 지원한다. Operation mode는 Stop·Autonomous·Local·Remote와 Autoware control enable/disable을 다룬다. 미션이 끝나면 route를 지우고 다음 route를 설정한다.

```text
route 설정
→ preset 적용
→ 미션 실행
→ trigger 또는 route state 확인
→ route 해제
→ 다음 미션
```

Scenario Selector를 강제로 바꾸지 않았다. Route가 주행 문맥을 만들고, preset과 FSM이 module 설정과 전환 시점을 맡는다.

주차·복구 구간의 보조 node는 `map`–`base_link` TF를 0.2초마다 검사한다. 지정 좌표 반경 1.5 m 안에 들어오면 `/parking/reset_cone_finder`에 `std_msgs/Empty`를 발행한다. 소비 node가 edge trigger라면 latch나 debounce를 둔다.

## **3. 일반 도로 Planning**

일반 도로는 Behavior Path Planner와 Behavior Velocity Planner의 역할을 나눴다.

| Module | 주요 입력 | 출력 |
|---|---|---|
| Behavior Path Planner | route, map, odometry, objects | 회피·lane change path, drivable area |
| Behavior Velocity Planner | lane ID가 있는 path, map, signal | 감속·정지 속도가 반영된 path |
| Freespace Planner | route, OccupancyGrid, odometry, scenario | 주차 전·후진 trajectory |

### 신호등과 dilemma zone

Traffic Light module은 Lanelet2의 traffic light–stop line relation, 현재 신호와 차량 속도로 정지 여부를 정한다. Planning Simulator 시험 결과:

| 조건 | 동작 |
|---|---|
| Stop line 약 15 m 전, yellow | 정지 |
| Stop line 약 3 m 전, yellow | dilemma zone으로 판단해 통과 |
| Stop line relation 누락 | planning node crash |
| Relation 보정 | 같은 조건에서 정상 실행 |

실제 신호 인식기나 C-ITS가 아니라 RViz 입력을 이용한 rule test다.

### 정적 장애물 회피

![K-City pointcloud map 위 obstacle avoidance 경로](/assets/img/posts/autonomous-driving/autoware-kcity-planning-system/03-kcity-map-avoidance.png)
_K-City map에서 생성한 drivable corridor와 avoidance path._

회피 실험에서는 lateral margin, prepare distance, shift length, jerk, 인접·반대 차선 사용 여부를 조정했다. 실험용 설정의 `unknown.safety_buffer_lateral: -0.2`는 좁은 공간에서 동작을 보기 위한 값이며 실차 안전값이 아니다.

Obstacle Stop Planner를 끄면 장애물을 통과하는 경우가 있었다. Behavior Path의 회피 경로만 믿지 않고 motion-level 충돌 검사와 정지 계층을 유지해야 한다.

### 주차와 Freespace Planning

![K-City 주차·회피 구간의 Planning 결과](/assets/img/posts/autonomous-driving/autoware-kcity-planning-system/05-parking-freespace.png)
_Parking area와 OccupancyGrid를 이용한 freespace path._

주차 입력은 Lanelet2 parking area, obstacle OccupancyGrid, goal pose의 조합이다. Reverse 허용, 최소 회전 반경, vehicle footprint, obstacle threshold, goal yaw를 중심으로 조정했다.

주차 후 먼 일반 route goal을 바로 주면 차선 밖까지 계획하거나 node가 종료되는 경우가 있었다. 차선 위 intermediate goal을 먼저 넣어 Freespace Planning을 끝낸 뒤 일반 route로 복귀하도록 구성했다.

```text
parking goal
→ 차선 위 intermediate goal
→ 일반 route goal
```

## **4. LiDAR Cone Trajectory Planner**

라바콘 구간에서는 map 중심선보다 실시간으로 관측한 콘 경계가 직접적인 주행 기준이다. 입력 PointCloud에서 좌·우 경계를 만들고 두 경계의 중앙을 Autoware `Trajectory`로 변환했다.

![PointCloud 기반 cone planner 처리 흐름](/assets/img/posts/autonomous-driving/autoware-kcity-planning-system/02-cone-planner-pipeline.svg)
_PointCloud에서 좌·우 경계와 중앙 trajectory를 만드는 과정._

### 입출력 계약

| 구분 | 값 |
|---|---|
| 기본 입력 | `/perception/cones` (`sensor_msgs/PointCloud2`) |
| 선택 입력 | `/cones_yellow`, `/cones_blue` |
| 기준 frame | `map` |
| 주 출력 | `/planning/scenario_planning/trajectory` |
| Debug | `/debug/cone_planner_markers`, `/debug/trajectory_path` |
| 주기 | 10 Hz |
| 경로 생성 실패 | 현재 pose 근처의 2-point, 0속도 stop trajectory |

핵심 parameter:

| 항목 | 설정 |
|---|---|
| ROI | 전방 12.0 m, 좌우 폭 6.0 m |
| Track 폭 | 1.5–4.0 m |
| 무색상 clustering | `dbscan_eps=1.5 m` |
| Boundary chain | 최대 연결 거리 3.0 m, 방향 변화 80° |
| Trajectory | 재표본화 0.5 m, lookahead 10.0 m |
| 속도 | 0.5–5.0 m/s, 횡가속 기준 0.4 m/s² |

`5.0 m/s`는 source의 설정 상한이다. 보존된 simulator 화면은 1.0 m/s, 별도 시험 기록은 3.0 m/s 조건이며 안전속도로 검증한 값은 아니다.

### 처리 흐름

1. PointCloud timestamp에 맞춰 sensor frame을 `map`으로 변환한다. 해당 시각의 TF가 없으면 latest TF를 fallback으로 사용한다.
2. ROI 밖 point를 제거하고 temporal window, TTL, 공간 중복 제거, EMA로 검출 흔들림을 줄인다.
3. 색상별 topic이 있으면 청·황 경계를 바로 나눈다. 무색상 입력은 DBSCAN과 기하 조건으로 두 경계를 추정한다.
4. 거리와 방향 제약으로 cone chain을 만든 뒤 각 경계에 B-spline을 fitting한다.
5. 같은 arc length에서 두 경계를 재표본화하고 midpoint를 연결해 centerline을 만든다.
6. Ego 앞단에 시작점을 맞추고 yaw·곡률을 평활화한다. 곡률이 커질수록 속도를 낮춰 `Trajectory`를 발행한다.

한쪽 경계만 남으면 최근 track 폭으로 반대편을 추정한다. 두 경계가 모두 불안정하면 이전 path를 계속 사용하지 않고 정지 trajectory로 전환한다.

### Control 연결

```text
/perception/cones
→ cone_planner_node
→ /planning/scenario_planning/trajectory
→ trajectory_follower
→ /control/trajectory_follower/control_cmd
→ vehicle_cmd_gate
→ Planning Simulator
```

위 흐름은 source와 launch에 남은 simulator 연결이다. 별도 통합 시험에서는 steering status를 공급한 뒤 `/control/command/control_cmd`가 생성됐다. 두 topic 사이의 정확한 remap graph는 배포 버전의 launch 기준으로 고정한다.

![Cone planner trajectory의 Autoware Control 추종](/assets/img/posts/autonomous-driving/autoware-kcity-planning-system/04-cone-planner-control.png)
_Cone trajectory를 추종하는 Planning Simulator._

Circle, cone, no-color cone planner package의 이전 colcon 설치 기록도 남아 있다. 최신 loose source의 clean build와 regression 결과는 별도로 남아 있지 않다.

## **5. Control과 ERP42 Interface**

제어에는 localization, perception, vehicle status, system state가 함께 필요하다.

| 계층 | 필요한 입력 |
|---|---|
| Localization | `/localization/kinematic_state`, `/localization/acceleration`, `map`–`base_link` TF |
| Perception | PointCloud, OccupancyGrid, predicted objects |
| Vehicle status | velocity, steering, gear, control mode |
| System | initialization, `/autoware/state`, operation mode, engage/control enable |

Localization만 공급했을 때는 trajectory가 생성되지 않았다. Dummy PointCloud와 OccupancyGrid, odometry, acceleration을 추가하자 planning trajectory가 나왔고, steering status까지 넣은 뒤 control command가 생성됐다.

`launch_system=false`에서는 planning 계산이 돌아가도 operation mode와 command gate의 상태 전이가 막혔다. Localization initialization state를 공급하고 system layer를 유지한 뒤 `/autoware/state`가 `DRIVING`으로 전환됐다.

![Autoware routing·localization·operation mode 상태](/assets/img/posts/autonomous-driving/autoware-kcity-planning-system/07-autoware-state-validation.png)
_Routing, localization, operation mode, control enable을 함께 점검한 화면._

화면에는 `AUTONOMOUS`, AutowareControl `Disable`, Motion `STOPPED`가 함께 보인다. Operation mode, control enable, 실제 motion은 서로 다른 gate다.

ERP42 interface는 command와 feedback의 의미를 양방향으로 맞춘다.

| 방향 | 변환 |
|---|---|
| Autoware → ERP42 | 속도, 조향, brake/control command |
| ERP42 → Autoware | velocity, steering, gear, control mode report |
| Gear | Autoware D/N/R ↔ ERP42 `0/1/2` |
| Unknown gear | Neutral fallback |

Vehicle Command Gate는 mode와 vehicle status에 따라 command를 제한하고, ERP42 feedback은 Autoware의 vehicle status로 돌아간다. Steering 변환에는 기록상 4% 보정이 들어갔다.

Raw bridge 동작 기록은 있으나 ECU feedback을 포함한 synchronized closed-loop log는 없다. ERP42 interface 구현도 완성된 독립 ROS 2 package보다 Markdown에 보존된 구현 초안에 가깝다.

## **6. Simulator에서 실제 대회까지**

시험 단계:

```text
CARLA / Planning Simulator
→ 학교 콘 코스 시험
→ 실제 대회 LiDAR 콘 인식 주행
```

### CARLA–Autoware 통합

![CARLA와 Autoware RViz 동시 실행](/assets/img/posts/autonomous-driving/autoware-kcity-planning-system/06-carla-autoware-integration.png)
_CARLA scene, recognition image, pointcloud map, route와 path._

CARLA와 RViz에는 camera image, ego pose, pointcloud map, route, drivable corridor가 함께 표시됐다. 이 화면은 동시 표시 기록이며 sensor bridge와 timestamp 동기화 결과는 아니다. Planning Simulator에서는 map relation, behavior module, cone trajectory와 control 입력을 개별 시험했다.

### 학교 콘 코스 시험

실제 대회 전 학교에서 진행한 콘 코스 시험이다. 탑재 화면에는 vehicle marker와 경계·path 형태의 시각화가 표시됐다.

<figure>
  <video controls autoplay muted loop playsinline preload="auto"
         poster="/assets/img/posts/autonomous-driving/autoware-kcity-planning-system/11-school-cone-test-poster.jpg"
         aria-describedby="school-cone-test-caption"
         style="width: min(100%, 620px); display: block; margin: 0 auto; border-radius: 6px;">
    <source src="https://media.iamjaehka13.blog/assets/img/posts/autonomous-driving/autoware-kcity-planning-system/11-school-cone-test.mp4" type="video/mp4">
    이 브라우저는 동영상 재생을 지원하지 않는다.
    <a href="https://media.iamjaehka13.blog/assets/img/posts/autonomous-driving/autoware-kcity-planning-system/11-school-cone-test.mp4">학교 콘 시험 영상 직접 열기</a>
  </video>
  <figcaption id="school-cone-test-caption" class="text-center">
    학교 콘 코스 시험.
  </figcaption>
</figure>

영상에는 ROS topic과 timestamp가 함께 기록되지 않았다.

### 실제 대회 LiDAR 콘 인식 주행

학교 시험 다음 단계는 실제 대회였다. 당시 LiDAR로 청·황 콘을 인식하고 그 사이의 경로를 따라 주행했다.

<figure>
  <video controls autoplay muted loop playsinline preload="auto"
         poster="/assets/img/posts/autonomous-driving/autoware-kcity-planning-system/08-closed-course-platform.png"
         aria-describedby="competition-lidar-cone-caption"
         style="width: 100%; border-radius: 6px;">
    <source src="https://media.iamjaehka13.blog/assets/img/posts/autonomous-driving/autoware-kcity-planning-system/10-competition-lidar-cone-drive.mp4" type="video/mp4">
    이 브라우저는 동영상 재생을 지원하지 않는다.
    <a href="https://media.iamjaehka13.blog/assets/img/posts/autonomous-driving/autoware-kcity-planning-system/10-competition-lidar-cone-drive.mp4">대회 주행 영상 직접 열기</a>
  </video>
  <figcaption id="competition-lidar-cone-caption" class="text-center">
    실제 대회 LiDAR 콘 인식 주행.
  </figcaption>
</figure>

설계 기준 데이터 흐름:

```text
LiDAR PointCloud
→ cone detection
→ left / right boundary
→ centerline trajectory
→ trajectory follower
→ vehicle command
```

동기화된 rosbag이 없어 detection 정확도와 lateral tracking error는 산출하지 못했다.

## **7. 통합 과정에서 해결한 문제**

문제의 다수는 algorithm보다 map relation과 interface 상태에서 생겼다.

| 증상 | 원인 | 대응 |
|---|---|---|
| Avoidance node crash | Traffic light–stop line relation 오류 | Lanelet2 regulatory relation 보정 |
| Start Planner 종료 | Empty points 입력 | 준비 상태 검사 후 fail-closed |
| Trajectory 미생성 | Perception·odometry 입력 누락 | PointCloud, OccupancyGrid, odometry, acceleration 공급 |
| Control command 미생성 | Steering status 누락 | Vehicle status contract 보강 |
| Autonomous 전환 실패 | System layer·initialization state 누락 | `launch_system` 유지, initialization 공급 |
| 주차 후 route 복귀 실패 | 먼 goal을 바로 설정 | 차선 위 intermediate goal 추가 |
| Cone path 불안정 | TF, yaw, detection noise | Temporal filter, yaw 제한, stop fallback |

Start Planner patch는 `planner_data`, odometry, route, dynamic object, current lane, path point를 먼저 검사한다. 미준비 입력에는 warning과 함께 `false`를 반환해 maneuver를 승인하지 않는다. 적용 기록은 있으나 현재 checkout에서 다시 build한 regression 결과는 없다.

## **8. 결과와 남은 검증**

| 기능 | 현재 결과 | 남은 검증 |
|---|---|---|
| K-City PCD·Lanelet2 | Map load, route와 path 생성 | 전체 route reachability |
| 신호·회피 | Simulator에서 yellow 판단과 avoidance path | 실제 perception, 안전 margin, 반복 실차 시험 |
| 주차 | Freespace path와 intermediate goal 복귀 | 슬롯 인식부터 자동 출차까지의 연속 시험 |
| Cone planner | Simulator control 연결, 학교 시험, 실제 대회 LiDAR 콘 주행 | 대회 source revision 고정, detection·trajectory·vehicle feedback의 동기화 분석 |
| Mission FSM | `task_manager` package와 route/mode/trigger 구성 | 모든 미션의 자동 연속 완료 |
| CARLA 통합 | Scene, camera, map, route/path 동시 실행 | Sensor timestamp와 tracking error |
| ERP42 interface | Command/status 변환과 raw bridge 기록 | ECU feedback 포함 closed-loop 반복 주행 |
| K-City 전체 시스템 | 개별 subsystem의 구현·시험 기록 | Mission FSM과 ERP42를 포함한 end-to-end 자동 완주 |
