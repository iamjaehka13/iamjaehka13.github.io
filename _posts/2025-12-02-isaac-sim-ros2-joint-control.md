---
title: "Isaac Sim Tutorial 6. ROS2 Joint Control"
date: 2025-12-02 19:50:27 +0900
last_modified_at: 2026-07-27 22:47:54 +0900
categories: [Isaac, Sim]
tags: [isaac-sim, ros2, joint-control, joint-state, franka, omnigraph]
description: Isaac Sim에서 Franka Panda의 joint state를 ROS2로 publish하고 joint command를 subscribe해 관절을 제어하는 흐름을 정리한다.
image: /assets/img/posts/isaac-sim-ros2-joint-control/02-joint-state-graph.png
---

[ROS2 Publish Rate and QoS](/posts/isaac-sim-publish-rate-qos/)까지는 주로 Isaac Sim에서 ROS2로 data를 내보냈다. 이번에는 Franka Panda의 `/joint_states`를 publish하는 경로와, 외부 node의 `/joint_command`를 `Articulation Controller`로 전달하는 반대 방향을 한 graph에 연결했다.

참고한 자료는 아래와 같다.

- [ROS2 Joint Control: Extension Python Scripting](https://docs.isaacsim.omniverse.nvidia.com/5.0.0/ros2_tutorials/tutorial_ros2_manipulation.html)
- [기존 Tistory 정리글](https://tosemfdk.tistory.com/15)

## **1. Franka Panda 추가**

Isaac Sim Content Browser에서 Franka Panda USD를 stage에 추가한다.

```text
Isaac Sim > Robots > FrankaRobotics > FrankaPanda > franka.usd
```

![Franka Panda USD asset 추가](/assets/img/posts/isaac-sim-ros2-joint-control/01-franka-usd-asset.png)

stage에 올라온 robot prim 이름은 환경에 따라 `/franka` 또는 `/panda`처럼 다를 수 있다. 이후 node의 target prim을 설정할 때는 실제 stage에 있는 articulation root prim을 선택하면 된다.

이 글에서는 TurtleBot처럼 mobile base를 움직이는 대신, manipulator의 joint state와 joint command를 ROS2 topic으로 연결하는 흐름을 본다.

## **2. Joint State Action Graph 만들기**

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

여기서 publish 방향과 subscribe 방향을 구분하는 것이 중요하다. `/joint_states`는 Isaac Sim에서 밖으로 나가는 topic이고, `/joint_command`는 외부 ROS2 node에서 Isaac Sim 안으로 들어오는 topic.

## **3. Target Prim 설정**

`ROS2 Publish Joint State` 노드의 target prim에는 articulation root API를 가진 Franka robot prim을 넣는다. Tistory 예제에서는 `/franka`를 사용했고, NVIDIA 문서 예제에서는 `/panda`를 사용한다.

`Articulation Controller` 노드도 같은 robot prim을 target으로 잡는다. target prim을 다르게 잡으면 `/joint_command`를 받아도 실제 robot이 움직이지 않는다.

확인할 topic은 두 개.

- `/joint_states`: Isaac Sim에서 publish하는 현재 joint 상태
- `/joint_command`: 외부 ROS2 node가 publish하는 joint command

target prim은 joint control에서 가장 자주 틀리는 부분이다. graph가 정상이고 topic이 보여도 robot이 움직이지 않는다면, 먼저 articulation target이 실제 robot prim을 가리키는지 확인한다.

## **4. ROS2 Tutorial Publisher 실행**

ROS2 환경이 source된 터미널에서 Isaac Sim tutorial node를 실행한다.

```bash
ros2 run isaac_tutorials ros2_publisher.py
```

이 node는 `/joint_command`로 joint command를 publish한다. Isaac Sim의 `ROS2 Subscribe Joint State` 노드가 이 topic을 구독하고, `Articulation Controller`가 Franka 관절에 명령을 적용한다.

![joint command를 publish하는 ROS2 node](/assets/img/posts/isaac-sim-ros2-joint-control/04-joint-command-publisher.png)

## **5. Joint State 확인**

robot arm이 움직이는 동안 다른 ROS2 터미널에서 `/joint_states`를 확인한다.

```bash
ros2 topic echo /joint_states
```

정상적으로 연결되면 각 joint의 name, position, velocity, effort가 계속 publish된다.

![Franka robot joint state topic](/assets/img/posts/isaac-sim-ros2-joint-control/03-joint-states-topic.png)

<video controls preload="metadata" poster="/assets/img/posts/isaac-sim-ros2-joint-control/05-franka-motion-preview.jpg" style="width: 100%; border-radius: 6px;">
  <source src="/assets/img/posts/isaac-sim-ros2-joint-control/05-franka-motion.mp4" type="video/mp4">
</video>

이때 `/joint_states`가 publish되는데 robot이 움직이지 않는다면 subscribe 쪽, 즉 `/joint_command` topic과 Articulation Controller 연결을 확인한다. 반대로 robot은 움직이는데 state가 보이지 않으면 publish node target이나 timestamp 연결을 확인한다.

## **6. 메뉴 Shortcut**

공식 문서에는 graph shortcut도 있다. ROS2 bridge extension이 켜져 있다면 아래 메뉴에서 Joint State publisher/subscriber graph를 빠르게 만들 수 있다.

```text
Tools > Robotics > ROS 2 OmniGraphs > JointStates
```

직접 graph를 구성하면 노드의 역할을 이해하기 쉽고, shortcut을 쓰면 반복 설정 시간을 줄일 수 있다. 처음에는 직접 구성해보고, 이후 같은 구조를 반복할 때 shortcut을 쓰는 방식이 좋다.

## **7. 양방향 graph에서 확인할 것**

```text
Franka articulation
  -> ROS2 Publish Joint State
  -> /joint_states

/joint_command
  -> ROS2 Subscribe Joint State
  -> Articulation Controller
  -> Franka articulation
```

Franka 대신 다른 manipulator를 사용해도 graph의 방향은 같다. 다만 articulation target, joint name과 command 배열 순서는 실제 robot model과 반드시 일치해야 한다. State가 publish된다는 사실만으로 command 경로까지 정상이라고 판단하지 말고 두 방향을 따로 확인해야 한다.
