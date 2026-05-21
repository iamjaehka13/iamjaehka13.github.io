---
title: "Isaac Sim Tutorial 3. RTX Lidar Sensors"
date: 2025-11-27 15:57:57 +0900
categories: [Isaac, Sim]
tags: [isaac-sim, ros2, lidar, rtx-lidar, laserscan, pointcloud, rviz2, omnigraph]
description: Isaac Sim에서 TurtleBot에 RTX 2D/3D Lidar를 붙이고 ROS2 LaserScan, PointCloud topic으로 publish하는 흐름을 정리한다.
image: /assets/img/posts/isaac-sim-rtx-lidar/06-rtx-lidar-action-graph.png
---

이 글은 [TurtleBot ROS2 연결](/posts/isaac-sim-turtlebot-ros2/)과 [ROS2 Cameras](/posts/isaac-sim-ros2-cameras/)에 이어서, TurtleBot에 RTX Lidar sensor를 붙이고 ROS2 topic으로 내보내는 과정을 정리합니다.

이번 목표는 2D RTX Lidar는 `LaserScan`, 3D RTX Lidar는 `PointCloud`로 publish하고 RViz2에서 확인하는 것입니다. 카메라 글과 마찬가지로 핵심은 **sensor prim을 render product로 만들고, ROS2 helper가 topic으로 변환하는 흐름**입니다.

참고한 자료는 아래와 같습니다.

- [RTX Lidar Sensors](https://docs.isaacsim.omniverse.nvidia.com/5.0.0/ros2_tutorials/tutorial_ros2_rtx_lidar.html)
- [기존 Tistory 정리글](https://tosemfdk.tistory.com/11)

## **1. RTX 2D Lidar 추가**

먼저 상단 메뉴에서 RTX 2D Lidar sensor를 추가합니다.

```text
Create > Sensors > RTX Lidar > NVIDIA > Example Rotary 2D
```

![RTX 2D Lidar 추가 메뉴](/assets/img/posts/isaac-sim-rtx-lidar/01-rtx-lidar-2d-create.png)

추가한 2D Lidar는 TurtleBot의 lidar 위치에 맞춰 배치합니다. TurtleBot URDF에서 lidar 기준 prim이 `base_scan`이라면, Lidar prim을 `base_scan` 아래에 넣는 방식이 자연스럽습니다.

![base_scan 아래에 RTX 2D Lidar 배치](/assets/img/posts/isaac-sim-rtx-lidar/02-rtx-lidar-2d-base-scan.png)

Lidar prim이 `base_scan` 아래에 들어갔다면 local transform은 모두 0으로 맞춥니다. 이렇게 두면 `base_scan`이 lidar의 기준 frame 역할을 합니다.

![RTX 2D Lidar transform 설정](/assets/img/posts/isaac-sim-rtx-lidar/03-rtx-lidar-2d-transform.png)

## **2. RTX 3D Lidar 추가**

3D Lidar도 같은 방식으로 추가합니다. 2D Lidar가 평면 scan을 다룬다면, 3D Lidar는 point cloud 확인용으로 사용합니다.

![RTX 3D Lidar 추가](/assets/img/posts/isaac-sim-rtx-lidar/04-rtx-lidar-3d-create.png)

3D Lidar도 TurtleBot의 lidar frame 기준으로 배치합니다. frame 이름을 2D Lidar와 맞춰 쓰면 RViz2에서 TF와 data display를 맞추기 쉽습니다.

![RTX 3D Lidar transform 설정](/assets/img/posts/isaac-sim-rtx-lidar/05-rtx-lidar-3d-transform.png)

## **3. RTX Lidar Action Graph 만들기**

이제 Lidar sensor 출력을 ROS2 topic으로 publish하는 Action Graph를 만듭니다.

`Window > Graph Editors > Action Graph`에서 graph를 만들고, graph prim을 lidar의 `namespace_base_scan` 아래에 넣습니다. 이렇게 하면 multi-robot 상황에서 namespace가 자동으로 붙어 topic과 frame 충돌을 줄일 수 있습니다.

![RTX Lidar용 Action Graph](/assets/img/posts/isaac-sim-rtx-lidar/06-rtx-lidar-action-graph.png)

핵심 노드는 다음과 같습니다.

| 노드 | 역할 |
| --- | --- |
| On Playback Tick | simulation play 중 graph를 tick마다 실행합니다. |
| ROS2 Context | ROS2 통신 context를 만듭니다. |
| Isaac Create Render Product | RTX Lidar sensor를 render product로 연결합니다. |
| ROS2 RTX Lidar Helper | Lidar render product를 ROS2 `LaserScan` 또는 `PointCloud` topic으로 publish합니다. |

2D Lidar와 3D Lidar는 각각 별도의 `Isaac Create Render Product`와 `ROS2 RTX Lidar Helper`에 연결합니다. 카메라 때와 거의 같은 구조이지만, helper node가 camera helper가 아니라 RTX Lidar helper로 바뀐다는 점이 다릅니다.

## **4. Topic과 Frame 설정**

`ROS2 RTX Lidar Helper`에서 publish할 message type과 topic name을 정합니다.

- 2D Lidar: `LaserScan`, topic name은 `scans`
- 3D Lidar: `PointCloud`, topic name은 `points`
- frame ID: `base_scan`

둘 다 frame ID를 `base_scan`으로 맞추면 RViz2에서 scan과 point cloud를 로봇 frame 기준으로 보기 편합니다.

![frame ID를 base_scan으로 설정](/assets/img/posts/isaac-sim-rtx-lidar/07-rtx-lidar-frame-id.png)

topic 이름은 프로젝트 convention에 맞게 바꿔도 됩니다. 다만 이후 TF tree와 RViz2 display를 연결할 때 헷갈리지 않도록 sensor별 topic과 frame ID를 명확히 구분해두는 것이 좋습니다.

## **5. RViz2에서 확인**

Isaac Sim stage를 play한 뒤 host 터미널에서 ROS2 topic을 확인합니다.

```bash
ros2 topic list
```

정상적으로 연결되면 `scans`, `points` topic이 보입니다. RViz2에서는 2D Lidar는 `LaserScan`, 3D Lidar는 `PointCloud2` display로 확인합니다.

<video controls preload="metadata" poster="/assets/img/posts/isaac-sim-rtx-lidar/08-rviz-pointcloud-preview.jpg" style="width: 100%; border-radius: 6px;">
  <source src="/assets/img/posts/isaac-sim-rtx-lidar/08-rviz-pointcloud.mp4" type="video/mp4">
</video>

RViz2에서 data가 보이지 않는다면 topic name, message type, fixed frame, frame ID를 순서대로 확인합니다. Lidar data는 publish되고 있는데 frame이 맞지 않아서 화면에 안 보이는 경우도 자주 생깁니다.

## **6. 정리하며**

RTX Lidar graph의 핵심 흐름은 camera graph와 비슷합니다.

```text
RTX Lidar prim
  -> Isaac Create Render Product
  -> ROS2 RTX Lidar Helper
  -> LaserScan / PointCloud topic
```

카메라와 Lidar까지 ROS2 topic으로 연결해두면, 이후 TF tree와 odometry를 붙여 RViz2에서 로봇 전체 센서 구성을 확인할 수 있습니다. 즉, 이제 필요한 것은 sensor data 자체뿐 아니라 그 data가 어느 frame 기준인지 설명해주는 TF입니다.
