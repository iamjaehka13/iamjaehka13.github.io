---
title: "Isaac Sim Tutorial 3. RTX Lidar Sensors"
date: 2025-11-28 15:57:57 +0900
last_modified_at: 2025-11-28 15:57:57 +0900
categories: [Isaac, Sim]
tags: [isaac-sim, ros2, lidar, rtx-lidar, laserscan, pointcloud, rviz2, omnigraph]
description: Isaac Sim에서 TurtleBot에 RTX 2D/3D Lidar를 붙이고 ROS2 LaserScan, PointCloud topic으로 publish하는 흐름을 정리한다.
image: /assets/img/posts/isaac-sim-rtx-lidar/06-rtx-lidar-action-graph.png
---

[TurtleBot ROS2 연결](/posts/isaac-sim-turtlebot-ros2/)과 [ROS2 Cameras](/posts/isaac-sim-ros2-cameras/)에서 사용한 stage에 RTX Lidar를 붙였다. 2D sensor는 `LaserScan`, 3D sensor는 `PointCloud`로 publish한다. Camera와 마찬가지로 sensor prim에서 render product를 만든 뒤, RTX Lidar Helper가 ROS2 message로 변환한다.

참고한 자료는 아래와 같다.

- [RTX Lidar Sensors](https://docs.isaacsim.omniverse.nvidia.com/5.0.0/ros2_tutorials/tutorial_ros2_rtx_lidar.html)
- [기존 Tistory 정리글](https://tosemfdk.tistory.com/11)

## **1. RTX 2D Lidar 추가**

먼저 상단 메뉴에서 RTX 2D Lidar sensor를 추가한다.

```text
Create > Sensors > RTX Lidar > NVIDIA > Example Rotary 2D
```

![RTX 2D Lidar 추가 메뉴](/assets/img/posts/isaac-sim-rtx-lidar/01-rtx-lidar-2d-create.png)

추가한 2D Lidar는 TurtleBot의 lidar 위치에 맞춰 배치한다. TurtleBot URDF에서 lidar 기준 prim이 `base_scan`이라면, Lidar prim을 `base_scan` 아래에 넣는 방식이 자연스럽다.

![base_scan 아래에 RTX 2D Lidar 배치](/assets/img/posts/isaac-sim-rtx-lidar/02-rtx-lidar-2d-base-scan.png)

Lidar prim이 `base_scan` 아래에 들어갔다면 local transform은 모두 0으로 맞춘다. 이렇게 두면 `base_scan`이 lidar의 기준 frame 역할을 한다.

![RTX 2D Lidar transform 설정](/assets/img/posts/isaac-sim-rtx-lidar/03-rtx-lidar-2d-transform.png)

## **2. RTX 3D Lidar 추가**

3D Lidar도 같은 방식으로 추가한다. 2D Lidar가 평면 scan을 다룬다면, 3D Lidar는 point cloud 확인용으로 사용한다.

![RTX 3D Lidar 추가](/assets/img/posts/isaac-sim-rtx-lidar/04-rtx-lidar-3d-create.png)

3D Lidar도 TurtleBot의 lidar frame 기준으로 배치한다. frame 이름을 2D Lidar와 맞춰 쓰면 RViz2에서 TF와 data display를 맞추기 쉽다.

![RTX 3D Lidar transform 설정](/assets/img/posts/isaac-sim-rtx-lidar/05-rtx-lidar-3d-transform.png)

## **3. RTX Lidar Action Graph 만들기**

이제 Lidar sensor 출력을 ROS2 topic으로 publish하는 Action Graph를 만든다.

`Window > Graph Editors > Action Graph`에서 graph를 만들고, graph prim을 lidar의 `namespace_base_scan` 아래에 넣는다. 이렇게 하면 multi-robot 상황에서 namespace가 자동으로 붙어 topic과 frame 충돌을 줄일 수 있다.

![RTX Lidar용 Action Graph](/assets/img/posts/isaac-sim-rtx-lidar/06-rtx-lidar-action-graph.png)

필요한 노드는 아래 네 종류.

| 노드 | 역할 |
| --- | --- |
| On Playback Tick | simulation play 중 graph를 tick마다 실행한다. |
| ROS2 Context | ROS2 통신 context를 만든다. |
| Isaac Create Render Product | RTX Lidar sensor를 render product로 연결한다. |
| ROS2 RTX Lidar Helper | Lidar render product를 ROS2 `LaserScan` 또는 `PointCloud` topic으로 publish한다. |

2D Lidar와 3D Lidar는 각각 별도의 `Isaac Create Render Product`와 `ROS2 RTX Lidar Helper`에 연결한다. Camera graph와 달라지는 부분은 helper node와 출력 message type.

## **4. Topic과 Frame 설정**

`ROS2 RTX Lidar Helper`에서 publish할 message type과 topic name을 정한다.

- 2D Lidar: `LaserScan`, topic name은 `scans`
- 3D Lidar: `PointCloud`, topic name은 `points`
- frame ID: `base_scan`

둘 다 frame ID를 `base_scan`으로 맞추면 RViz2에서 scan과 point cloud를 로봇 frame 기준으로 보기 편하다.

![frame ID를 base_scan으로 설정](/assets/img/posts/isaac-sim-rtx-lidar/07-rtx-lidar-frame-id.png)

topic 이름은 프로젝트 convention에 맞게 바꿔도 된다. 다만 이후 TF tree와 RViz2 display를 연결할 때 헷갈리지 않도록 sensor별 topic과 frame ID를 명확히 구분해두는 것이 좋다.

## **5. RViz2에서 확인**

Isaac Sim stage를 play한 뒤 host 터미널에서 ROS2 topic을 확인한다.

```bash
ros2 topic list
```

정상적으로 연결되면 `scans`, `points` topic이 보인다. RViz2에서는 2D Lidar는 `LaserScan`, 3D Lidar는 `PointCloud2` display로 확인한다.

<video controls preload="metadata" poster="/assets/img/posts/isaac-sim-rtx-lidar/08-rviz-pointcloud-preview.jpg" style="width: 100%; border-radius: 6px;">
  <source src="/assets/img/posts/isaac-sim-rtx-lidar/08-rviz-pointcloud.mp4" type="video/mp4">
</video>

RViz2에서 data가 보이지 않는다면 topic name, message type, fixed frame, frame ID를 순서대로 확인한다. Lidar data는 publish되고 있는데 frame이 맞지 않아서 화면에 안 보이는 경우도 자주 생긴다.

## **6. RTX Lidar에서 ROS2 scan까지**

```text
RTX Lidar prim
  -> Isaac Create Render Product
  -> ROS2 RTX Lidar Helper
  -> LaserScan / PointCloud topic
```

이 단계에서는 sensor data만 publish했기 때문에, RViz2가 `base_scan`과 robot base의 관계를 알아야 올바른 위치에 표시할 수 있다. 다음 단계에서는 TF tree와 odometry를 붙여 각 topic의 frame을 하나의 로봇 좌표계로 연결한다.
