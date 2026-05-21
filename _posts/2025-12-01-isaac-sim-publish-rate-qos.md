---
title: "Isaac Sim Tutorial 5. ROS2 Publish Rate and QoS"
date: 2025-12-01 15:41:00 +0900
categories: [Isaac, Sim]
tags: [isaac-sim, ros2, publish-rate, qos, omnigraph, imu]
description: Isaac Sim ROS2 OmniGraph에서 publish rate를 조정하고 QoS profile과 static publisher를 설정하는 흐름을 정리한다.
image: /assets/img/posts/isaac-sim-publish-rate-qos/02-imu-gate-graph.png
---

이 글은 [TurtleBot ROS2 연결](/posts/isaac-sim-turtlebot-ros2/), [ROS2 Cameras](/posts/isaac-sim-ros2-cameras/), [RTX Lidar Sensors](/posts/isaac-sim-rtx-lidar/), [TF Trees and Odometry](/posts/isaac-sim-tf-odometry/)에 이어서 ROS2 topic의 publish rate와 QoS를 조정하는 과정을 정리한다.

목표는 `On Playback Tick`에 그대로 묶여 있던 publish 주기를 원하는 비율로 낮추고, ROS2 QoS profile을 OmniGraph에서 직접 설정하는 것이다.

참고한 자료는 아래 문서다.

- [ROS2 Setting Publish Rates](https://docs.isaacsim.omniverse.nvidia.com/5.0.0/ros2_tutorials/tutorial_ros2_publish_rate.html)
- [ROS 2 Quality of Service (QoS)](https://docs.isaacsim.omniverse.nvidia.com/5.0.0/ros2_tutorials/tutorial_ros2_qos.html)
- [기존 Tistory 정리글](https://tosemfdk.tistory.com/14)

## 1. Publish rate가 simulation rate에 묶이는 이유

지금까지 만든 ROS2 OmniGraph는 대부분 `On Playback Tick`에서 시작했다. 이 tick은 simulation frame마다 한 번 실행되므로, downstream node의 publish 주기도 기본적으로 simulation rate의 영향을 받는다.

예를 들어 simulation이 60 FPS로 돌고 publisher가 매 tick 실행되면 topic도 대략 60 Hz에 가깝게 publish된다. publish 주기를 낮추려면 graph tick 자체를 줄이거나, sensor helper의 frame skip 값을 조정해야 한다.

## 2. Isaac Simulation Gate로 IMU publish rate 줄이기

먼저 TurtleBot의 IMU link 아래에 IMU sensor를 추가한다.

```text
/World/turtlebot3_burger/base_footprint/base_link/imu_link
```

![imu_link prim 아래에 IMU sensor 추가](/assets/img/posts/isaac-sim-publish-rate-qos/01-imu-sensor-prim.png)

그 다음 같은 prim 아래에 Action Graph를 만들고 `Isaac Simulation Gate` 노드를 추가한다. 이 노드는 입력 tick을 일정 frame 간격으로만 통과시켜준다.

![IMU publish용 Simulation Gate graph](/assets/img/posts/isaac-sim-publish-rate-qos/02-imu-gate-graph.png)

핵심 설정은 다음과 같다.

- `Isaac Simulation Gate`의 `step`을 `2`로 설정한다.
- `Isaac Read IMU` 노드의 target에는 추가한 IMU sensor prim을 넣는다.
- `ROS2 Publish Imu`의 `frameId`는 IMU가 붙어 있는 link 이름으로 맞춘다. 예를 들어 namespace가 붙어 있다면 `a__namespace_imu_link`처럼 맞춰준다.

`step`이 `2`면 downstream node가 두 frame마다 한 번씩 실행된다. simulation이 60 FPS라면 IMU publish rate는 대략 30 Hz가 된다.

## 3. topic hz로 확인

host 터미널에서 topic rate를 확인한다.

```bash
ros2 topic hz /imu
```

`step`을 `4`로 둔 경우와 `2`로 둔 경우의 topic hz가 다르게 나온다.

![step size 4일 때 topic hz](/assets/img/posts/isaac-sim-publish-rate-qos/03-topic-hz-step-4.png)

![step size 2일 때 topic hz](/assets/img/posts/isaac-sim-publish-rate-qos/04-topic-hz-step-2.png)

정리하면 `Isaac Simulation Gate`의 `step`은 simulation frame 기준 divider처럼 생각하면 된다.

```text
publish rate = simulation rate / step
```

## 4. Camera와 Lidar helper의 frame skip

camera와 RTX Lidar처럼 sensor helper를 사용하는 경우에는 helper node의 속성에서 publish rate를 낮출 수 있다. camera helper에서는 `frameSkipCount`를 조정한다.

![camera helper frame skip 속성](/assets/img/posts/isaac-sim-publish-rate-qos/05-camera-frame-skip-property.png)

![frame skip count를 11로 설정](/assets/img/posts/isaac-sim-publish-rate-qos/06-camera-frame-skip-count.png)

`frameSkipCount`를 `11`로 두면 12 frame마다 한 번 publish된다. 즉, 60 FPS 기준으로는 대략 5 Hz가 된다.

![frame skip 적용 전 topic rate](/assets/img/posts/isaac-sim-publish-rate-qos/07-camera-topic-rate-before.png)

![frame skip 적용 후 topic rate](/assets/img/posts/isaac-sim-publish-rate-qos/08-camera-topic-rate-after.png)

sensor data가 너무 자주 publish되어 RViz2나 network가 버거울 때는 이 방식이 가장 간단하다.

## 5. Simulation rate 자체 변경

전체 simulation rate를 변경하고 싶다면 `Window > Script Editor`에서 Python script를 실행한다.

![Script Editor에서 simulation rate 변경](/assets/img/posts/isaac-sim-publish-rate-qos/09-simulation-rate-script-editor.png)

아래 설정은 app run loop의 rate limit과 simulation minimum frame rate를 60 FPS로 맞춘다.

```python
import carb

physics_rate = 60
carb_settings = carb.settings.get_settings()
carb_settings.set_bool("/app/runLoops/main/rateLimitEnabled", True)
carb_settings.set_int("/app/runLoops/main/rateLimitFrequency", int(physics_rate))
carb_settings.set_int("/persistent/simulation/minFrameRate", int(physics_rate))
```

stage timing까지 함께 맞추려면 stage가 load된 뒤 timeline을 멈추고 time code와 target framerate를 설정한다.

```python
import omni

physics_rate = 60
timeline = omni.timeline.get_timeline_interface()
stage = omni.usd.get_context().get_stage()

timeline.stop()
stage.SetTimeCodesPerSecond(physics_rate)
timeline.set_target_framerate(physics_rate)
timeline.play()
```

## 6. ROS2 QoS 기본 개념

QoS는 ROS2 publisher와 subscriber가 message를 주고받는 방식을 정하는 정책 묶음이다. sensor topic처럼 손실을 조금 감수하고 최신 data가 중요한 경우와, 설정값처럼 늦게 붙은 subscriber도 반드시 받아야 하는 경우는 다른 QoS가 필요하다.

자주 보는 정책은 아래와 같다.

| 정책 | 의미 |
| --- | --- |
| History | message를 얼마나 보관할지 정한다. `keepLast`와 `keepAll`이 있다. |
| Depth | `keepLast`일 때 queue에 보관할 최대 message 개수다. |
| Reliability | `bestEffort`는 빠르지만 손실 가능성이 있고, `reliable`은 전달 보장을 우선한다. |
| Durability | `volatile`은 새 subscriber에게 과거 message를 주지 않고, `transientLocal`은 publisher가 보관한 message를 나중에 연결된 subscriber에게도 준다. |

## 7. Generic Publisher에 QoS 연결

QoS를 확인하기 위해 Generic Publisher graph를 만든다.

```text
Tools > Robotics > ROS 2 OmniGraphs > Generic Publisher
```

![Generic Publisher 메뉴](/assets/img/posts/isaac-sim-publish-rate-qos/10-generic-publisher-menu.png)

![Generic Publisher 생성 dialog](/assets/img/posts/isaac-sim-publish-rate-qos/11-generic-publisher-dialog.png)

생성된 graph에서 publisher type을 string publish로 바꾸고, QoS profile을 연결한다.

![생성된 Generic Publisher graph](/assets/img/posts/isaac-sim-publish-rate-qos/12-generic-publisher-graph.png)

![Generic Publisher input 설정](/assets/img/posts/isaac-sim-publish-rate-qos/13-generic-publisher-inputs.png)

ROS2 Publisher는 QoS를 JSON 형태로 받을 수 있다. `depth`는 양수여야 하고, `deadline`, `lifespan`, `leaseDuration`은 float 형태로 넣어야 유효하게 인식된다.

```json
{
  "history": "keepLast",
  "depth": 10,
  "reliability": "reliable",
  "durability": "volatile",
  "deadline": 0.0,
  "lifespan": 0.0,
  "liveliness": "systemDefault",
  "leaseDuration": 0.0
}
```

`ROS2 QoS Profile` 노드를 publisher에 연결하면 node UI에서 profile을 선택할 수 있다. sensor data라면 `createProfile`을 sensor data 계열로 맞춘다.

![ROS2 QoS Profile 노드 연결](/assets/img/posts/isaac-sim-publish-rate-qos/14-qos-profile-node.png)

![QoS Profile 설정](/assets/img/posts/isaac-sim-publish-rate-qos/15-qos-profile-settings.png)

topic의 실제 QoS는 아래 명령으로 확인한다.

```bash
ros2 topic info /topic --verbose
```

![topic info에서 QoS 확인](/assets/img/posts/isaac-sim-publish-rate-qos/16-topic-info-qos.png)

## 8. Static Publisher 만들기

static publisher는 message를 반복해서 publish하기보다 한 번 publish하고, 새 subscriber가 나중에 붙어도 그 값을 받을 수 있게 만드는 패턴이다. 초기 설정값, map metadata, 변하지 않는 상태값처럼 "늦게 들어와도 알아야 하는 값"에 어울린다.

새 graph를 만들고 `On Playback Tick` 대신 `On Stage Event`를 사용한다.

![Static Publisher graph](/assets/img/posts/isaac-sim-publish-rate-qos/17-static-publisher-graph.png)

설정 흐름은 다음과 같다.

1. `On Stage Event`의 event name을 simulation start play로 설정한다.
2. `Countdown` 노드의 input duration을 `3`, period를 `1`로 설정해 simulation 시작 후 3 frame 뒤 publisher에 tick이 들어가게 한다.
3. `ROS2 QoS Profile`은 publisher/subscriber default 계열로 두고, depth를 `1`, durability를 `transientLocal`로 설정한다.

![On Stage Event와 Countdown 설정](/assets/img/posts/isaac-sim-publish-rate-qos/18-static-publisher-stage-event.png)

![transientLocal QoS 설정](/assets/img/posts/isaac-sim-publish-rate-qos/19-static-publisher-transient-local.png)

한 터미널에서 topic을 확인한 뒤, 다른 터미널에서 다시 구독해도 같은 message가 들어오면 `transientLocal` 설정이 제대로 적용된 것이다.

```bash
ros2 topic echo /topic
```

![static publisher topic echo 확인](/assets/img/posts/isaac-sim-publish-rate-qos/20-static-publisher-echo.png)

## 정리

publish rate와 QoS는 topic이 "보이게 만드는 것" 다음 단계의 튜닝이다.

```text
publish rate:
  On Playback Tick
  -> Isaac Simulation Gate or frameSkipCount
  -> desired topic hz

QoS:
  ROS2 QoS Profile
  -> reliability / durability / depth
  -> subscriber behavior
```

센서 topic은 필요 이상으로 높은 rate를 줄이고, 중요한 상태값은 `transientLocal` 같은 durability를 써서 늦게 붙은 subscriber도 받을 수 있게 만드는 것이 핵심이다.
