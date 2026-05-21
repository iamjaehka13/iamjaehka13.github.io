---
title: "Isaac Sim Tutorial 3. RTX Lidar Sensors"
date: 2025-11-27 15:57:57 +0900
categories: [Isaac, Sim]
tags: [isaac-sim, ros2, lidar, rtx-lidar, laserscan, pointcloud, rviz2, omnigraph]
description: Isaac Sim에서 TurtleBot에 RTX 2D/3D Lidar를 붙이고 ROS2 LaserScan, PointCloud topic으로 publish하는 흐름을 정리한다.
image: /assets/img/posts/isaac-sim-rtx-lidar/06-rtx-lidar-action-graph.png
---

이 글은 [TurtleBot ROS2 연결](/posts/isaac-sim-turtlebot-ros2/)과 [ROS2 Cameras](/posts/isaac-sim-ros2-cameras/)에 이어서, TurtleBot에 RTX Lidar sensor를 붙이고 ROS2 topic으로 내보내는 과정을 정리한다.

목표는 2D RTX Lidar는 `LaserScan`, 3D RTX Lidar는 `PointCloud`로 publish하고 RViz2에서 확인하는 것이다.

참고한 자료는 아래 문서다.

- [RTX Lidar Sensors](https://docs.isaacsim.omniverse.nvidia.com/5.0.0/ros2_tutorials/tutorial_ros2_rtx_lidar.html)
- [기존 Tistory 정리글](https://tosemfdk.tistory.com/11)

## 1. RTX 2D Lidar 추가

상단 메뉴에서 RTX Lidar sensor를 추가한다.

```text
Create > Sensors > RTX Lidar > NVIDIA > Example Rotary 2D
```

![RTX 2D Lidar 추가 메뉴](/assets/img/posts/isaac-sim-rtx-lidar/01-rtx-lidar-2d-create.png)

추가한 2D Lidar는 TurtleBot의 lidar 위치에 맞춰 배치한다. TurtleBot URDF에서 lidar 기준 prim이 `base_scan`이라면, Lidar prim을 `base_scan` 아래에 넣는 방식이 자연스럽다.

![base_scan 아래에 RTX 2D Lidar 배치](/assets/img/posts/isaac-sim-rtx-lidar/02-rtx-lidar-2d-base-scan.png)

Lidar prim이 `base_scan` 아래에 들어갔다면, 로컬 기준 transform은 모두 0으로 맞춘다. 이렇게 두면 `base_scan`이 lidar의 기준 frame 역할을 한다.

![RTX 2D Lidar transform 설정](/assets/img/posts/isaac-sim-rtx-lidar/03-rtx-lidar-2d-transform.png)

## 2. RTX 3D Lidar 추가

3D Lidar도 같은 방식으로 추가한다. 2D Lidar가 평면 scan을 다룬다면, 3D Lidar는 point cloud 확인용으로 사용한다.

![RTX 3D Lidar 추가](/assets/img/posts/isaac-sim-rtx-lidar/04-rtx-lidar-3d-create.png)

3D Lidar도 TurtleBot의 lidar frame 기준으로 배치한다. frame 이름을 2D와 맞춰 쓰면 RViz2에서 TF와 data display를 맞추기 쉽다.

![RTX 3D Lidar transform 설정](/assets/img/posts/isaac-sim-rtx-lidar/05-rtx-lidar-3d-transform.png)

## 3. RTX Lidar Action Graph 만들기

이제 Lidar sensor 출력을 ROS2 topic으로 publish하는 Action Graph를 만든다.

`Window > Graph Editors > Action Graph`에서 graph를 만들고, graph prim을 lidar의 `namespace_base_scan` 아래에 넣는다. 이렇게 하면 multi robot 상황에서 namespace가 자동으로 붙어 topic/frame 충돌을 줄일 수 있다.

![RTX Lidar용 Action Graph](/assets/img/posts/isaac-sim-rtx-lidar/06-rtx-lidar-action-graph.png)

핵심 노드는 다음과 같다.

| 노드 | 역할 |
| --- | --- |
| On Playback Tick | simulation play 중 graph를 tick마다 실행한다. |
| ROS2 Context | ROS2 통신 context를 만든다. |
| Isaac Create Render Product | RTX Lidar sensor를 render product로 연결한다. |
| ROS2 RTX Lidar Helper | Lidar render product를 ROS2 `LaserScan` 또는 `PointCloud` topic으로 publish한다. |

2D Lidar와 3D Lidar는 각각 별도의 `Isaac Create Render Product`와 `ROS2 RTX Lidar Helper`에 연결한다.

## 4. Topic과 frame 설정

`ROS2 RTX Lidar Helper`에서 publish할 message type과 topic name을 정한다.

- 2D Lidar: `LaserScan`, topic name은 `scans`
- 3D Lidar: `PointCloud`, topic name은 `points`
- frame ID: `base_scan`

둘 다 frame ID를 `base_scan`으로 맞추면 RViz2에서 scan/point cloud를 로봇 frame 기준으로 보기 편하다.

![frame ID를 base_scan으로 설정](/assets/img/posts/isaac-sim-rtx-lidar/07-rtx-lidar-frame-id.png)

## 5. RViz2에서 확인

Isaac Sim stage를 play한 뒤 host 터미널에서 ROS2 topic을 확인한다.

```bash
ros2 topic list
```

정상적으로 연결되면 `scans`, `points` topic이 보인다. RViz2에서는 2D Lidar는 `LaserScan`, 3D Lidar는 `PointCloud2` display로 확인한다.

[![RViz2에서 point topic 확인](/assets/img/posts/isaac-sim-rtx-lidar/08-rviz-pointcloud-preview.jpg)](https://tv.kakao.com/v/459561493)

## 정리

RTX Lidar graph의 핵심 흐름은 camera graph와 비슷하다. sensor prim을 render product로 만들고, ROS2 helper가 topic으로 변환한다.

```text
RTX Lidar prim
  -> Isaac Create Render Product
  -> ROS2 RTX Lidar Helper
  -> LaserScan / PointCloud topic
```

카메라와 Lidar까지 ROS2 topic으로 연결해두면, 이후 TF tree와 odometry를 붙여 RViz2에서 로봇 전체 센서 구성을 확인할 수 있다.
