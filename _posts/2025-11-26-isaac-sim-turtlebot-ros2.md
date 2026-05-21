---
title: "Isaac Sim Tutorial 1. TurtleBot으로 ROS2 연결하기"
date: 2025-11-26 22:08:43 +0900
categories: [Isaac, Sim]
tags: [isaac-sim, ros2, turtlebot, omnigraph, urdf]
description: Isaac Sim에서 TurtleBot3 URDF를 불러오고 ROS2 /cmd_vel 메시지로 주행시키는 흐름을 정리한다.
image: /assets/img/posts/isaac-sim-turtlebot-ros2/09-omnigraph-overview.png
---

Isaac Sim에서 ROS2 연결을 확인할 때 가장 작은 예제로 쓰기 좋은 것이 TurtleBot3이다. 이 글에서는 TurtleBot3 Burger의 URDF를 Isaac Sim으로 import한 뒤, OmniGraph에서 ROS2 `/cmd_vel` 토픽을 받아 Differential Controller와 Articulation Controller로 바퀴 joint에 속도 명령을 보내는 과정을 정리한다.

참고한 자료는 아래 두 문서다.

- [URDF Import: Turtlebot](https://docs.isaacsim.omniverse.nvidia.com/5.0.0/ros2_tutorials/tutorial_ros2_turtlebot.html)
- [Driving TurtleBot via ROS2 messages](https://docs.isaacsim.omniverse.nvidia.com/5.0.0/ros2_tutorials/tutorial_ros2_drive_turtlebot.html)
- [기존 Tistory 정리글](https://tosemfdk.tistory.com/9)

## 1. TurtleBot3 URDF 준비

ROS2가 source된 터미널에서 TurtleBot3 패키지를 받아온다.

```bash
git clone -b $ROS_DISTRO https://github.com/ROBOTIS-GIT/turtlebot3.git turtlebot3
```

![TurtleBot3 패키지 clone 명령](/assets/img/posts/isaac-sim-turtlebot-ros2/01-clone-turtlebot3.png)

이번 글에서 사용할 URDF는 아래 경로에 있다.

```text
turtlebot3/turtlebot3_description/urdf/turtlebot3_burger.urdf
```

![TurtleBot3 Burger URDF 경로](/assets/img/posts/isaac-sim-turtlebot-ros2/02-urdf-path.png)

Isaac Sim에서 이미 움직일 수 있게 세팅된 USD 로봇이 있다면 이 단계는 생략할 수 있다. 여기서는 ROS2 bridge와 OmniGraph 흐름을 확인하는 것이 목적이므로, 공식 튜토리얼처럼 TurtleBot3 Burger를 가져와 사용한다.

## 2. Isaac Sim 환경 만들기

Isaac Sim의 Content Browser에서 `Isaac Sim/Environments/Simple_Room/simple_room.usd`를 stage로 드래그한다. 원점 기준으로 배치하면 이후 로봇 위치를 맞추기 편하다.

![Simple Room USD asset 위치](/assets/img/posts/isaac-sim-turtlebot-ros2/03-simple-room-browser.png)

![Simple Room을 stage에 불러온 모습](/assets/img/posts/isaac-sim-turtlebot-ros2/04-simple-room-stage.png)

시점 조작은 우클릭을 누른 상태에서 `WASD`, `E`, `Q`를 사용하면 편하다. 우클릭 상태에서 마우스 휠을 움직이면 이동 속도도 조절할 수 있다.

## 3. URDF Import 설정

상단 메뉴에서 `File > Import`를 열고 `turtlebot3_burger.urdf`를 선택한다. Import 옵션에서는 아래 항목이 중요하다.

- `Links`는 `Moveable Base`로 설정한다.
- Joint configuration은 자연스럽게 안정화되도록 frequency 기반 설정을 사용한다.
- `wheel_left_joint`, `wheel_right_joint`의 drive target은 `Velocity`로 둔다.

![TurtleBot URDF import 옵션](/assets/img/posts/isaac-sim-turtlebot-ros2/05-urdf-import-options.png)

Import가 끝나면 stage에 `turtlebot3_burger`가 생긴다.

![URDF import 성공 후 stage](/assets/img/posts/isaac-sim-turtlebot-ros2/06-import-success.png)

## 4. 바퀴 joint 물리 설정

Import된 TurtleBot의 왼쪽, 오른쪽 바퀴 joint에서 damping 값을 크게 설정한다. 예를 들면 `10000000.0`처럼 매우 큰 값을 줄 수 있다.

이 값은 wheel joint가 속도 명령을 빠르게 따라가도록 만드는 역할을 한다. 시뮬레이션에서 바퀴가 미끄러지거나 반응이 느리면 이 설정을 먼저 확인하는 것이 좋다.

![왼쪽 바퀴 joint damping 설정](/assets/img/posts/isaac-sim-turtlebot-ros2/07-left-wheel-damping.png)

![오른쪽 바퀴 joint damping 설정](/assets/img/posts/isaac-sim-turtlebot-ros2/08-right-wheel-damping.png)

추가로 `turtlebot3_burger` prim에는 아래 물리 속성을 붙인다.

- `Physics > Rigid Body`
- `Physics > Mass`
- `Physics > Articulation Root`

속성 값 입력창은 `Ctrl`을 누른 채 클릭하면 숫자를 직접 입력하기 쉽다.

## 5. OmniGraph로 ROS2 제어 흐름 만들기

이제 `/cmd_vel`로 들어온 `geometry_msgs/Twist` 메시지를 바퀴 속도로 변환해야 한다. 흐름은 아래처럼 잡는다.

```text
ROS2 Subscribe Twist
  -> Scale To/From Stage Unit
  -> Differential Controller
  -> Articulation Controller
```

![TurtleBot ROS2 제어용 OmniGraph 전체 구조](/assets/img/posts/isaac-sim-turtlebot-ros2/09-omnigraph-overview.png)

`Window > Graph Editors > Action Graph`에서 Action Graph를 만들고 다음 노드들을 추가한다.

| 노드 | 역할 |
| --- | --- |
| On Playback Tick | 시뮬레이션이 재생 중일 때 매 tick 실행 신호를 만든다. |
| ROS2 Context | ROS_DOMAIN_ID를 포함한 ROS2 통신 컨텍스트를 만든다. 기본값은 0이다. |
| ROS2 Subscribe Twist | `/cmd_vel` 토픽에서 `Twist` 메시지를 구독한다. |
| Scale To/From Stage Unit | 입력 속도를 stage 단위에 맞게 변환한다. |
| Differential Controller | 선속도와 각속도를 왼쪽, 오른쪽 바퀴 속도로 변환한다. |
| Articulation Controller | 계산된 joint velocity command를 실제 articulation joint에 전달한다. |

`ROS2 Subscribe Twist` 노드의 topic name은 `/cmd_vel`로 설정한다.

![ROS2 Subscribe Twist의 /cmd_vel topic 설정](/assets/img/posts/isaac-sim-turtlebot-ros2/10-cmd-vel-topic.png)

## 6. Differential Controller 파라미터

Differential Controller는 로봇의 목표 선속도와 각속도를 받아 양쪽 바퀴 속도로 바꾼다. 그래서 최소한 다음 두 값이 필요하다.

- wheel radius
- wheel distance

TurtleBot3 Burger 모델의 실제 값이나 import된 stage의 단위 설정에 맞춰 입력한다. 값이 맞지 않으면 회전 반경이나 속도가 기대와 다르게 나온다.

![Differential Controller 파라미터 설정](/assets/img/posts/isaac-sim-turtlebot-ros2/11-differential-controller-params.png)

![Controller joint token 파라미터 설정](/assets/img/posts/isaac-sim-turtlebot-ros2/12-controller-token-params.png)

## 7. Articulation Controller 연결

Articulation Controller에는 제어 대상 articulation과 움직일 joint 이름을 알려줘야 한다.

- articulation target은 `turtlebot3_burger`로 지정한다.
- joint name 입력에는 `wheel_left_joint`, `wheel_right_joint`를 넣는다.
- Differential Controller의 wheel velocity output을 Articulation Controller의 velocity command 쪽으로 연결한다.

URDF import 과정에서 joint 이름에 namespace가 붙었다면, 실제 stage에 보이는 joint 이름에 맞춰 수정해야 한다. 예를 들어 `a__namespace_wheel_left_joint`처럼 들어온 경우에는 그 이름을 그대로 사용해야 한다.

![Articulation Controller target 설정](/assets/img/posts/isaac-sim-turtlebot-ros2/13-articulation-target.png)

![TurtleBot prim에 Articulation Root 추가](/assets/img/posts/isaac-sim-turtlebot-ros2/14-articulation-root.png)

## 8. ROS2 연결 확인

Isaac Sim에서 graph를 만들고 stage를 play한 뒤, host의 ROS2 터미널에서 topic 목록을 확인한다.

```bash
ros2 topic list
```

OmniGraph가 정상적으로 `/cmd_vel`을 구독하고 있다면 topic list에 `/cmd_vel`이 보여야 한다.

![ROS2 topic list에서 /cmd_vel 확인](/assets/img/posts/isaac-sim-turtlebot-ros2/15-ros2-topic-list.png)

이후 터미널에서 `Twist` 메시지를 publish하면 TurtleBot이 움직인다.

```bash
ros2 topic pub /cmd_vel geometry_msgs/Twist "{'linear': {'x': 0.2, 'y': 0.0, 'z': 0.0}, 'angular': {'x': 0.0, 'y': 0.0, 'z': 1.0}}"
```

앞으로 직진하면서 동시에 회전한다면 ROS2 bridge, `/cmd_vel` subscription, Differential Controller, Articulation Controller까지 연결이 된 것이다.

[![TurtleBot 주행 결과 영상 썸네일](/assets/img/posts/isaac-sim-turtlebot-ros2/16-drive-result-thumbnail.jpg)](https://tv.kakao.com/v/459546248)

## 정리

이번 과정의 핵심은 URDF import 자체보다도 ROS2 메시지가 Isaac Sim 내부 제어 노드로 들어가는 경로를 이해하는 것이다.

```text
/cmd_vel
  -> ROS2 Subscribe Twist
  -> Differential Controller
  -> wheel_left_joint, wheel_right_joint
```

이 구조를 이해해두면 이후 camera, lidar, odometry, TF tree까지 붙일 때도 훨씬 덜 헷갈린다.
