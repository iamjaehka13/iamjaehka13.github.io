---
title: "Isaac Sim Tutorial 6. ROS2 Joint Control"
date: 2025-12-02 19:50:27 +0900
categories: [Isaac, Sim]
tags: [isaac-sim, ros2, joint-control, joint-state, franka, omnigraph]
description: Isaac Sim에서 Franka Panda의 joint state를 ROS2로 publish하고 joint command를 subscribe해 관절을 제어하는 흐름을 정리한다.
image: /assets/img/posts/isaac-sim-ros2-joint-control/02-joint-state-graph.png
---

이 글은 [ROS2 Publish Rate and QoS](/posts/isaac-sim-publish-rate-qos/)에 이어서, Isaac Sim에서 robot articulation을 ROS2 joint command로 움직이는 과정을 정리한다.

이번 예제의 대상은 Franka Panda robot이다. `/joint_states`로 현재 관절 상태를 publish하고, `/joint_command`를 subscribe해서 들어온 명령을 `Articulation Controller`로 전달한다.

참고한 자료는 아래 문서다.

- [ROS2 Joint Control: Extension Python Scripting](https://docs.isaacsim.omniverse.nvidia.com/5.0.0/ros2_tutorials/tutorial_ros2_manipulation.html)
- [기존 Tistory 정리글](https://tosemfdk.tistory.com/15)

## 1. Franka Panda 추가

Isaac Sim Content Browser에서 Franka Panda USD를 stage에 추가한다.

```text
Isaac Sim > Robots > FrankaRobotics > FrankaPanda > franka.usd
```

![Franka Panda USD asset 추가](/assets/img/posts/isaac-sim-ros2-joint-control/01-franka-usd-asset.png)

stage에 올라온 robot prim 이름은 환경에 따라 `/franka` 또는 `/panda`처럼 다를 수 있다. 이후 node의 target prim을 설정할 때는 실제 stage에 있는 articulation root prim을 선택하면 된다.

## 2. Joint State Action Graph 만들기

`Window > Graph Editors > Action Graph`에서 새 Action Graph를 만든다. graph에는 아래 노드들을 추가한다.

| 노드 | 역할 |
| --- | --- |
| On Playback Tick | simulation frame마다 graph를 실행한다. |
| Isaac Read Simulation Time | ROS2 message timestamp에 넣을 simulation time을 읽는다. |
| ROS2 Publish Joint State | robot의 현재 joint state를 `/joint_states` topic으로 publish한다. |
| ROS2 Subscribe Joint State | `/joint_command` topic에서 joint command를 받는다. |
| Articulation Controller | subscribe한 joint command대로 robot articulation을 움직인다. |

![Joint State publish/subscribe graph](/assets/img/posts/isaac-sim-ros2-joint-control/02-joint-state-graph.png)

연결 흐름은 아래처럼 생각하면 된다.

```text
On Playback Tick
  -> ROS2 Publish Joint State
  -> ROS2 Subscribe Joint State
  -> Articulation Controller

Isaac Read Simulation Time
  -> ROS2 Publish Joint State timestamp
```

## 3. target prim 설정

`ROS2 Publish Joint State` 노드의 target prim에는 articulation root API를 가진 Franka robot prim을 넣는다. Tistory 예제에서는 `/franka`를 사용했고, NVIDIA 문서 예제에서는 `/panda`를 사용한다.

`Articulation Controller` 노드도 같은 robot prim을 target으로 잡는다. target prim을 다르게 잡으면 `/joint_command`를 받아도 실제 robot이 움직이지 않는다.

핵심 topic은 다음과 같다.

- `/joint_states`: Isaac Sim에서 publish하는 현재 joint 상태
- `/joint_command`: 외부 ROS2 node가 publish하는 joint command

## 4. ROS2 tutorial publisher 실행

ROS2 환경이 source된 터미널에서 Isaac Sim tutorial node를 실행한다.

```bash
ros2 run isaac_tutorials ros2_publisher.py
```

이 node는 `/joint_command`로 joint command를 publish한다. Isaac Sim의 `ROS2 Subscribe Joint State` 노드가 이 topic을 구독하고, `Articulation Controller`가 Franka 관절에 명령을 적용한다.

![joint command를 publish하는 ROS2 node](/assets/img/posts/isaac-sim-ros2-joint-control/04-joint-command-publisher.png)

## 5. joint state 확인

robot arm이 움직이는 동안 다른 ROS2 터미널에서 `/joint_states`를 확인한다.

```bash
ros2 topic echo /joint_states
```

정상적으로 연결되면 각 joint의 name, position, velocity, effort가 계속 publish된다.

![Franka robot joint state topic](/assets/img/posts/isaac-sim-ros2-joint-control/03-joint-states-topic.png)

<video controls preload="metadata" poster="/assets/img/posts/isaac-sim-ros2-joint-control/05-franka-motion-preview.jpg" style="width: 100%; border-radius: 6px;">
  <source src="/assets/img/posts/isaac-sim-ros2-joint-control/05-franka-motion.mp4" type="video/mp4">
</video>

## 6. 메뉴 shortcut

공식 문서에는 graph shortcut도 있다. ROS2 bridge extension이 켜져 있다면 아래 메뉴에서 Joint State publisher/subscriber graph를 빠르게 만들 수 있다.

```text
Tools > Robotics > ROS 2 OmniGraphs > JointStates
```

직접 graph를 구성하면 노드의 역할을 이해하기 쉽고, shortcut을 쓰면 반복 설정 시간을 줄일 수 있다.

## 정리

Joint control graph의 핵심은 ROS2 topic과 Isaac Sim articulation을 연결하는 것이다.

```text
Franka articulation
  -> ROS2 Publish Joint State
  -> /joint_states

/joint_command
  -> ROS2 Subscribe Joint State
  -> Articulation Controller
  -> Franka articulation
```

이 구조를 이해해두면 Franka뿐 아니라 다른 manipulator나 robot joint에도 같은 방식으로 ROS2 joint command 제어를 붙일 수 있다.
