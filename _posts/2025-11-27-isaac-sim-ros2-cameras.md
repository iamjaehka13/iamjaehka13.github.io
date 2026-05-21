---
title: "Isaac Sim Tutorial 2. ROS2 Cameras"
date: 2025-11-27 14:52:55 +0900
categories: [Isaac, Sim]
tags: [isaac-sim, ros2, camera, rviz2, omnigraph, sensor]
description: Isaac Sim의 TurtleBot에 카메라를 붙이고 ROS2 image topic으로 publish한 뒤 RViz2에서 확인하는 흐름을 정리한다.
image: /assets/img/posts/isaac-sim-ros2-cameras/05-camera-ros2-omnigraph.png
---

이 글은 [이전 TurtleBot ROS2 연결 글](/posts/isaac-sim-turtlebot-ros2/)에서 만든 TurtleBot stage를 이어서 사용합니다. 이번 목표는 TurtleBot에 카메라를 추가하고, Isaac Sim camera view를 ROS2 image topic으로 publish한 뒤 RViz2에서 확인하는 것입니다.

핵심은 카메라 prim 자체보다도 **camera prim이 render product가 되고, 그 render product가 ROS2 Camera Helper를 통해 image topic으로 나가는 흐름**을 이해하는 것입니다.

참고한 자료는 아래와 같습니다.

- [ROS 2 Cameras](https://docs.isaacsim.omniverse.nvidia.com/5.0.0/ros2_tutorials/tutorial_ros2_camera.html)
- [Add Camera and Sensors to a Robot](https://docs.isaacsim.omniverse.nvidia.com/5.0.0/robot_setup_tutorials/tutorial_gui_camera_sensors.html#isaac-sim-app-tutorial-gui-camera-sensors)
- [Add Noise to Camera](https://docs.isaacsim.omniverse.nvidia.com/5.0.0/ros2_tutorials/tutorial_ros2_camera_noise.html)
- [기존 Tistory 정리글](https://tosemfdk.tistory.com/10)

## **1. TurtleBot에 카메라 추가**

먼저 이전 글에서 import한 TurtleBot의 body 아래에 `camera1`, `camera2` prim을 만듭니다. 중요한 점은 카메라를 로봇의 움직임을 따라가는 prim 아래에 넣어야 한다는 것입니다.

URDF import 후 namespace가 붙은 경우에는 보통 `a__namespace_base_footprint`처럼 이름이 붙은 base prim 아래에 카메라를 추가합니다. 이렇게 해야 로봇이 움직일 때 카메라 frame도 같이 따라갑니다.

<video controls preload="metadata" poster="/assets/img/posts/isaac-sim-ros2-cameras/01-add-camera-under-baselink.jpg" style="width: 100%; border-radius: 6px;">
  <source src="/assets/img/posts/isaac-sim-ros2-cameras/01-add-camera-under-baselink.mp4" type="video/mp4">
</video>

두 카메라의 transform은 로봇 기준 앞뒤를 바라보도록 잡습니다. 한쪽은 전방, 다른 한쪽은 후방을 보게 만들면 ROS2 topic이 정상적으로 분리되는지 확인하기 쉽습니다.

![camera1 transform 설정](/assets/img/posts/isaac-sim-ros2-cameras/02-camera1-transform.png)

![camera2 transform 설정](/assets/img/posts/isaac-sim-ros2-cameras/03-camera2-transform.png)

카메라가 제대로 붙었는지는 viewport를 하나 더 띄워 확인할 수 있습니다. `Window > Viewport`로 보조 viewport를 만들고, 하나는 perspective view, 다른 하나는 camera view로 두면 stage와 camera 시야를 동시에 볼 수 있습니다.

<video controls preload="metadata" poster="/assets/img/posts/isaac-sim-ros2-cameras/04-camera-viewport-preview.jpg" style="width: 100%; border-radius: 6px;">
  <source src="/assets/img/posts/isaac-sim-ros2-cameras/04-camera-viewport.mp4" type="video/mp4">
</video>

또는 `Tools > Sensors > Camera Inspector`를 열면 scene 안에 있는 카메라들을 한 번에 확인할 수 있습니다.

## **2. ROS2 Camera OmniGraph 만들기**

이제 시뮬레이션 카메라 이미지를 ROS2 topic으로 내보냅니다. Isaac Sim에는 camera용 ROS2 OmniGraph shortcut이 있어서, 처음부터 모든 노드를 수동으로 만들지 않아도 됩니다.

메뉴에서 아래 경로를 사용합니다.

```text
Tools > Robotics > ROS 2 OmniGraphs > Camera
```

ROS2 graph가 보이지 않는다면 ROS2 bridge extension이 켜져 있는지 먼저 확인합니다.

![ROS2 camera publish용 OmniGraph](/assets/img/posts/isaac-sim-ros2-cameras/05-camera-ros2-omnigraph.png)

핵심 흐름은 다음과 같습니다.

```text
Camera prim
  -> Isaac Create Render Product
  -> ROS2 Camera Helper
  -> ROS2 image topic
```

`Isaac Create Render Product` 노드의 target은 방금 추가한 camera prim으로 잡습니다. 이후 `ROS2 Camera Helper` 노드에서 topic name과 message type을 설정합니다.

<video controls preload="metadata" poster="/assets/img/posts/isaac-sim-ros2-cameras/06-render-product-topic-target.jpg" style="width: 100%; border-radius: 6px;">
  <source src="/assets/img/posts/isaac-sim-ros2-cameras/06-render-product-topic-target.mp4" type="video/mp4">
</video>

여기서 render product는 Isaac Sim 내부 camera output을 ROS2 helper가 사용할 수 있는 형태로 만들어주는 중간 단계라고 보면 됩니다. 그래서 카메라 topic이 나오지 않을 때는 camera prim target, render product 연결, helper의 topic 설정을 차례대로 확인하는 것이 좋습니다.

## **3. RViz2에서 카메라 Topic 확인**

Isaac Sim stage를 play한 뒤 host 터미널에서 ROS2 환경을 source하고 topic 목록을 확인합니다.

```bash
ros2 topic list
```

카메라 graph가 정상이라면 설정한 image topic이 topic list에 나타납니다. RViz2에서 `Image` display를 추가하고 해당 topic을 선택하면 Isaac Sim camera image를 볼 수 있습니다.

<video controls preload="metadata" poster="/assets/img/posts/isaac-sim-ros2-cameras/07-rviz-camera-preview.jpg" style="width: 100%; border-radius: 6px;">
  <source src="/assets/img/posts/isaac-sim-ros2-cameras/07-rviz-camera.mp4" type="video/mp4">
</video>

카메라가 두 개라면 같은 구조의 graph를 하나 더 만들고 topic name을 분리하면 됩니다. 예를 들어 `camera1`, `camera2`에 대해 각각 render product와 ROS2 Camera Helper를 만들면 앞뒤 카메라를 따로 받을 수 있습니다.

![camera1, camera2 topic을 연결한 모습](/assets/img/posts/isaac-sim-ros2-cameras/08-rviz-two-camera-topics.png)

이 방식은 이후 depth image나 camera info를 추가할 때도 그대로 확장됩니다. sensor prim을 만들고, render product를 만들고, ROS2 helper가 원하는 message type으로 publish하는 패턴입니다.

## **4. Camera Noise 예제**

Isaac Sim에는 카메라 이미지에 noise나 augmentation을 넣어 publish하는 예제도 있습니다. Isaac Sim ROS2 환경이 source되어 있고 `rclpy`를 load할 수 있는 터미널에서 아래 예제를 실행합니다.

```bash
cd ~/isaacsim
./python.sh standalone_examples/api/isaacsim.ros2.bridge/camera_noise.py
```

실행 중 script warning이 뜨면 ROS2 bridge, workspace source, `ROS_DOMAIN_ID`를 먼저 확인합니다.

![Camera noise 예제 실행 후 RViz2 화면](/assets/img/posts/isaac-sim-ros2-cameras/09-camera-noise-rviz.png)

예제가 정상적으로 실행되면 `/rgb_augmented` 같은 topic이 생성됩니다.

![rgb_augmented topic 확인](/assets/img/posts/isaac-sim-ros2-cameras/10-rgb-augmented-topic.png)

host 쪽 ROS2 workspace도 source한 뒤 RViz2에서 augmented image topic을 선택합니다.

![ROS2 workspace source](/assets/img/posts/isaac-sim-ros2-cameras/11-source-ros-workspace.png)

그러면 noise가 들어간 카메라 이미지를 RViz2에서 확인할 수 있습니다.

![Augmented camera image를 RViz2에서 확인](/assets/img/posts/isaac-sim-ros2-cameras/12-augmented-camera-rviz.png)

이 예제는 실제 카메라 연결 과정과는 조금 별개지만, Isaac Sim에서 생성한 image stream을 ROS2로 publish하고 RViz2에서 확인하는 구조를 다시 한 번 확인하기 좋습니다.

## **5. 정리하며**

이번 글의 핵심은 camera prim을 만든 뒤, 그 출력을 ROS2 image topic으로 내보내는 연결 구조입니다.

```text
Camera prim
  -> Render Product
  -> ROS2 Camera Helper
  -> RViz2 Image display
```

이 구조를 잡아두면 이후 depth image, camera info, lidar, TF tree까지 같은 패턴으로 확장할 수 있습니다. 특히 여러 센서를 붙일 때는 prim target과 topic name을 명확히 분리해두는 것이 중요합니다.
