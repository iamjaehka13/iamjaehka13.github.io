---
title: "Isaac Sim Tutorial 4. TF Trees and Odometry"
date: 2025-11-28 19:07:37 +0900
categories: [Isaac, Sim]
tags: [isaac-sim, ros2, tf, odometry, rviz2, omnigraph]
description: Isaac Sim에서 TurtleBot의 TF tree와 odometry를 ROS2로 publish하고 RViz2에서 확인하는 흐름을 정리한다.
image: /assets/img/posts/isaac-sim-tf-odometry/12-final-tf-tree.png
---

이 글은 [TurtleBot ROS2 연결](/posts/isaac-sim-turtlebot-ros2/), [ROS2 Cameras](/posts/isaac-sim-ros2-cameras/), [RTX Lidar Sensors](/posts/isaac-sim-rtx-lidar/)에 이어서 TurtleBot의 TF tree와 odometry를 ROS2로 publish하는 과정을 정리합니다.

앞선 글에서 camera와 Lidar data를 ROS2 topic으로 내보냈습니다. 이번 글의 목표는 그 sensor data가 로봇의 어느 위치에 붙어 있는지 TF tree로 설명하고, `odom -> base_link` 변환과 `/odom` topic을 RViz2에서 확인하는 것입니다.

참고한 자료는 아래와 같습니다.

- [ROS2 Transform Trees and Odometry](https://docs.isaacsim.omniverse.nvidia.com/5.0.0/ros2_tutorials/tutorial_ros2_tf.html)
- [기존 Tistory 정리글](https://tosemfdk.tistory.com/12)

## **1. Camera TF Publisher 추가**

이전 회차에서 TurtleBot에 카메라 두 대를 붙여두었다고 가정합니다. 이번에는 OmniGraph에서 `ROS2 Publish Transform Tree` 노드를 추가해 camera frame을 ROS2 TF로 내보냅니다.

![TF publish용 OmniGraph](/assets/img/posts/isaac-sim-tf-odometry/01-tf-publisher-graph.png)

`ROS2 Publish Transform Tree`는 `ROS2 Context`와 연결하고, simulation timestamp를 입력해 TF message가 Isaac Sim 시간 기준으로 publish되도록 합니다. target prim에는 이전 글에서 만든 camera prim 두 개를 넣습니다.

![TF publisher target 설정](/assets/img/posts/isaac-sim-tf-odometry/02-tf-publisher-targets.png)

stage를 play하면 외부 ROS2 환경에서 TF를 확인할 수 있습니다. 이때 robot 전체의 articulation root를 함께 넣고 parent prim을 `base_footprint`로 설정하면 camera와 wheel frame이 robot base 아래에 묶입니다.

![camera TF tree graph](/assets/img/posts/isaac-sim-tf-odometry/03-camera-tf-tree-graph.png)

![TF tree node input 설정](/assets/img/posts/isaac-sim-tf-odometry/04-camera-tf-tree-inputs.png)

여기서 핵심은 sensor topic과 sensor frame을 따로 생각하지 않는 것입니다. RViz2에서 image나 lidar data를 robot 위에 올바르게 표시하려면, topic뿐 아니라 그 topic의 frame도 TF tree에 포함되어 있어야 합니다.

## **2. Odometry 세팅**

다음은 `odom -> base_link` 관계를 만드는 graph입니다. odometry는 robot의 이동량을 계산해서 `/odom` topic으로 publish하고, 동시에 TF tree에서 `odom` frame과 robot base frame 사이의 transform을 만들어줍니다.

![odom에서 base_link를 계산하는 graph](/assets/img/posts/isaac-sim-tf-odometry/05-odometry-graph.png)

`Isaac Compute Odometry` 노드의 chassis target에는 TurtleBot root prim을 지정합니다. 이후 `ROS2 Publish Odometry`는 계산된 odometry를 ROS2 message로 publish하고, `ROS2 Publish Raw Transform Tree`는 `odom`과 `base_link` 사이의 TF를 publish합니다.

![odometry target 설정](/assets/img/posts/isaac-sim-tf-odometry/06-odometry-target-settings.png)

![odom과 base_link frame 설정](/assets/img/posts/isaac-sim-tf-odometry/07-odometry-frame-settings.png)

여기서 raw transform tree는 scene 안의 실제 prim만 다루는 것이 아니라, `odom`처럼 의미론적으로 필요한 frame을 만들 때 사용합니다. 즉, Isaac Sim stage 구조와 ROS2 TF 구조가 항상 1:1로만 대응하는 것은 아닙니다.

## **3. Robot Base 아래 TF 묶기**

robot 중심을 `base_link` 또는 `base_footprint`로 보고, 그 아래에 Lidar, camera, IMU, wheel link를 target prim으로 넣습니다. 이렇게 하면 sensor data가 RViz2에서 robot base 기준으로 정렬됩니다.

![robot base link와 하위 link TF 설정](/assets/img/posts/isaac-sim-tf-odometry/08-base-link-child-tf.png)

`ROS2 Publish Transform Tree`를 하나 더 추가하고 parent prim에는 robot base frame에 해당하는 prim을, target prim에는 센서와 wheel link들을 넣습니다.

![robot base link와 child link TF tree](/assets/img/posts/isaac-sim-tf-odometry/09-base-link-child-tf-tree.png)

이 단계는 나중에 sensor가 늘어날수록 중요해집니다. camera, lidar, imu, wheel frame이 모두 robot base 아래에 정리되어 있어야 RViz2에서 하나의 robot으로 보입니다.

## **4. World와 Odom 연결**

마지막으로 `world -> odom` 관계를 만듭니다. `ROS2 Publish Raw Transform Tree`를 추가하고 orientation과 translation을 아래처럼 둡니다.

```text
orientation: (1, 0, 0, 0)
translation: (0, 0, 0)
```

이렇게 두면 robot이 처음 시작하는 위치가 world 원점과 맞춰집니다.

![world와 odom의 TF tree](/assets/img/posts/isaac-sim-tf-odometry/10-world-odom-tf-tree.png)

![world와 odom raw transform 설정](/assets/img/posts/isaac-sim-tf-odometry/11-world-odom-settings.png)

전체 TF 구조를 큰 그림으로 보면 `world`가 가장 바깥 기준이고, 그 아래에 `odom`, robot base, sensor frame들이 차례로 연결됩니다.

## **5. RViz2에서 TF 확인**

전체 graph를 연결한 뒤 Isaac Sim stage를 play하고 RViz2에서 `TF` display를 추가합니다. 정상적으로 publish되면 `world`, `odom`, robot base, sensor frame들이 하나의 tree로 이어져 보입니다.

![최종 TF tree](/assets/img/posts/isaac-sim-tf-odometry/12-final-tf-tree.png)

<video controls preload="metadata" poster="/assets/img/posts/isaac-sim-tf-odometry/13-rviz-tf-preview.jpg" style="width: 100%; border-radius: 6px;">
  <source src="/assets/img/posts/isaac-sim-tf-odometry/13-rviz-tf.mp4" type="video/mp4">
</video>

전체 흐름은 아래처럼 생각하면 됩니다.

```text
world
  -> odom
  -> base_link / base_footprint
  -> sensors and wheel links
```

TF가 끊겨 있으면 RViz2에서 sensor data가 보이지 않거나, 엉뚱한 위치에 나타날 수 있습니다. 이럴 때는 fixed frame, frame ID, parent/target prim 설정을 먼저 확인합니다.

## **6. Isaac Sim tf_viewer 사용**

Isaac Sim 안에서도 TF 구조를 확인할 수 있습니다. `Window > Extensions`에서 `tf_viewer`를 검색한 뒤 enable합니다.

![tf_viewer extension enable](/assets/img/posts/isaac-sim-tf-odometry/14-tf-viewer-extension.png)

RViz2와 Isaac Sim의 TF viewer를 같이 보면, graph 설정이 실제 ROS2 TF tree로 어떻게 나가는지 확인하기 쉽습니다.

## **7. 정리하며**

이번 글의 핵심은 sensor topic을 publish하는 것에서 한 단계 더 나아가, 그 sensor들이 robot 기준으로 어디에 붙어 있는지 TF tree로 설명하는 것입니다.

```text
robot prim / sensor prim
  -> ROS2 Publish Transform Tree
  -> ROS2 Publish Odometry
  -> RViz2 TF and Odometry display
```

TF와 odometry까지 연결해두면 RViz2에서 image, lidar, robot pose를 같은 좌표계로 확인할 수 있고, 이후 navigation이나 control 예제로 확장하기 쉬워집니다. 센서 topic이 “무엇을 본다”를 담당한다면, TF는 그 data가 “어디 기준인지”를 설명합니다.
