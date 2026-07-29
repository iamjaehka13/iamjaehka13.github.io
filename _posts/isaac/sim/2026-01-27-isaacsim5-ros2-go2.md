---
title: "Isaac Sim에서 ROS 2로 Unitree Go2 제어하기"
date: 2026-01-27 10:00:00 +0900
last_modified_at: 2026-01-27 10:00:00 +0900
preserve_last_modified_at: true
categories: [Isaac, Sim]
tags: [unitree-go2, isaac-sim, ros2, ros2-humble, rsl-rl, ppo, rviz2, nav2, multi-robot, digital-twin, rtx-lidar]
description: "Isaac Sim에서 Unitree Go2 PPO policy와 ROS 2 명령, RGB·LiDAR·odometry·TF, multi-robot teleoperation, Nav2를 연결한 구현 기록."
image:
  path: /assets/img/posts/isaac/sim/isaacsim5-ros2-go2/00-preview.jpg
  alt: 실내 digital twin 환경에서 움직이는 Unitree Go2
math: true
---

목표는 Isaac Sim 안의 Unitree Go2를 ROS 2 Humble에서 제어하고, robot state와 sensor data를 RViz2와 Nav2까지 연결하는 것.

- ROS 2 `Twist`로 목표 속도 입력
- PPO 보행 policy로 12개 관절 target 생성
- RGB camera·RTX LiDAR·odometry·TF publish
- 여러 Go2의 topic과 command 분리
- RViz2 visualization과 Nav2 interface 연결

[프로젝트 저장소](https://github.com/tosemfdk/isaacsim5.0_ros2_go2)는 command 입력, policy inference, physics step, sensor publish를 하나의 Isaac Sim loop로 묶었다. `num_envs`를 늘리면 robot마다 독립된 topic과 command row를 사용한다.

<figure>
  <video controls autoplay muted loop playsinline preload="metadata"
         poster="/assets/img/posts/isaac/sim/isaacsim5-ros2-go2/04-go2-digital-twin-poster.jpg"
         aria-describedby="digital-twin-caption"
         style="width: 100%; border-radius: 6px;">
    <source src="https://media.iamjaehka13.blog/assets/img/posts/isaac/sim/isaacsim5-ros2-go2/03-go2-digital-twin.mp4" type="video/mp4">
    이 브라우저는 동영상 재생을 지원하지 않는다.
  </video>
  <figcaption id="digital-twin-caption" class="text-center">
    교내 공간을 옮긴 digital twin에 Go2를 배치한 시연.
  </figcaption>
</figure>

영상의 digital twin import는 동작 기록이 남아 있지만 현재 main 실행 경로에는 포함되지 않는다. 기본 재현 경로는 Isaac Sim의 warehouse와 office asset.

## **1. 구현 범위**

| 항목 | 설정 또는 구현 |
|---|---|
| Simulator | Isaac Sim |
| Policy runtime | RSL-RL PPO checkpoint inference |
| Policy | rough-terrain PPO checkpoint inference |
| Physics / policy 주기 | 200 Hz / 40 Hz |
| ROS 2 | Humble, Isaac Sim ROS 2 Bridge |
| 명령 | `Twist.linear.x`, `linear.y`, `angular.z` |
| Policy 출력 | Go2 12개 관절의 position target |
| ROS 출력 | RGB, PointCloud2, Odometry, `/clock`, TF |
| Multi-robot | `env_i`별 command, topic, frame 분리 |
| Scene | warehouse 계열, office, experimental digital twin |

![Isaac Sim ROS 2 Go2 시스템 구성](/assets/img/posts/isaac/sim/isaacsim5-ros2-go2/01-system-architecture.svg)
_ROS 2 command가 PPO policy를 거쳐 관절 명령이 되고, simulation state와 sensor output이 다시 ROS 2로 나오는 구조._

ROS 2가 관절을 직접 움직이는 구조는 아니다.

```text
ROS 2 Twist
→ env별 목표 base velocity
→ PPO policy observation
→ 12개 joint position target
→ Isaac Sim articulation
```

반대 방향은 sensor와 robot state의 publish 경로.

```text
Isaac Sim camera / RTX LiDAR / root state
→ OmniGraph ROS 2 helper
→ Image / PointCloud2 / Odometry / Clock
→ RViz2 또는 Nav2
```

## **2. Isaac Sim과 ROS 2의 Python 환경 분리**

이 프로젝트의 Isaac Sim 실행 환경은 Python 3.11을 사용한다. Ubuntu 22.04의 system ROS 2 Humble은 Python 3.10 기반이라, Isaac Sim을 실행하는 터미널에서 `/opt/ros/humble/setup.bash`를 바로 source하면 `rclpy`와 message package가 충돌할 수 있다.

Isaac Sim terminal:

```bash
conda activate isaaclab
source ~/isaacsim/setup_conda_env.sh
source ~/IsaacSim-ros_workspaces/build_ws/humble/isaac_sim_ros_ws/install/local_setup.bash
source ~/IsaacSim-ros_workspaces/build_ws/humble/humble_ws/install/local_setup.bash
```

이 terminal에는 Python 3.11로 build한 Isaac Sim ROS workspace만 올렸다. RViz2, Nav2, 별도 ROS 2 node는 system Humble을 source한 다른 terminal에서 실행할 수 있다. 두 process 사이의 message 전달은 DDS가 맡는다.

Isaac Sim의 [ROS 2 설치 문서](https://docs.isaacsim.omniverse.nvidia.com/5.0.0/installation/install_ros.html)에도 Isaac Sim process에서는 internal library 또는 Python 3.11로 build한 ROS workspace를 사용하도록 안내되어 있다.

## **3. Main simulation loop**

`run_simul.py`가 application, environment, policy, scene, sensor, ROS 2 bridge를 순서대로 올린다.

```python
go2_env_cfg = Go2RLEnvCfg()
go2_env_cfg.decimation = math.ceil(
    1.0 / go2_env_cfg.sim.dt / cfg.freq
)
go2_env_cfg.scene.num_envs = cfg.num_envs

env, policy = go2_rl_env(go2_env_cfg, cfg)
lidars = sensor_manager(cfg).create_lidar()
cameras = env.unwrapped.scene["front_cam"]
bridge = RobotDataManager(env, lidars, cameras, cfg)

obs, _ = env.reset()

while simulation_app.is_running():
    with torch.inference_mode():
        actions = policy(obs)
        obs, _, _, _ = env.step(actions)

    bridge.update()
```

`sim.dt = 0.005 s`이므로 physics는 200 Hz. `freq = 40 Hz`일 때 `decimation = 5`가 되고, 같은 policy action을 다섯 physics step 동안 유지한다.

```text
physics: 0.005 s × 5
policy period: 0.025 s
policy frequency: 40 Hz
```

이 주기 구분은 camera·LiDAR publish 주기와도 별개다. Physics, policy, sensor update, ROS publish를 모두 같은 “frame rate”로 보면 topic 주기를 바꿀 때 동작이 꼬이기 쉽다.

## **4. 학습이 아니라 PPO inference**

`agent.yaml`에는 PPO training parameter가 남아 있지만 이 저장소의 실행 loop에는 `learn()` 호출이 없다. 실제 동작은 `rough_model_9000.pt`를 load한 뒤 inference policy를 얻는 과정.

코드에 포함된 environment wrapper와 RSL-RL loader는 기존 PPO checkpoint를 실행하기 위한 부분이다. 이 프로젝트의 중심은 학습 환경을 새로 만드는 작업이 아니라 Isaac Sim의 Go2와 ROS 2 입출력을 연결하는 데 있다.

```python
ppo_runner = OnPolicyRunner(
    env,
    agent_cfg.to_dict(),
    log_dir=None,
    device=agent_cfg.device,
)
ppo_runner.load(model_path)
policy = ppo_runner.get_inference_policy(
    device=env.unwrapped.device
)
```

Checkpoint의 actor는 `512 → 256 → 128` hidden layer와 ELU activation을 사용한다. 실행 시 같은 network를 JIT와 ONNX로도 export한다.

Policy observation 순서는 학습 때와 맞아야 한다.

| Observation | 의미 |
|---|---|
| `base_lin_vel` | base 좌표계 선속도 |
| `base_ang_vel` | base 좌표계 각속도 |
| `projected_gravity` | body frame에서 본 중력 방향 |
| `velocity_commands` | ROS 2 또는 keyboard의 $(v_x, v_y, \omega_z)$ |
| `joint_pos` | default pose 기준 상대 관절각 |
| `joint_vel` | 관절속도 |
| `actions` | 직전 policy action |
| `height_scan` | 바닥 높이 grid |

Action은 관절 torque가 아니라 default joint pose 기준의 position offset이다.

$$
q_{\text{target}}
=
q_{\text{default}}
+
0.25a,
\qquad a \in \mathbb{R}^{12}
$$

`use_default_offset=True`, `scale=0.25` 설정의 의미. Isaac Sim의 actuator model이 이 target을 따라가도록 torque를 계산한다.

## **5. Env별 `cmd_vel`과 multi-robot control**

`base_vel_cmd_input`은 shape이 `(num_envs, 3)`인 tensor다.

```python
base_vel_cmd_input = torch.zeros(
    (num_envs, 3),
    dtype=torch.float32,
)
```

ROS callback은 받은 robot index의 행만 바꾼다.

```python
base_vel_cmd_input[idx, 0] = msg.linear.x
base_vel_cmd_input[idx, 1] = msg.linear.y
base_vel_cmd_input[idx, 2] = msg.angular.z
```

`num_envs == 1`이면 코드에 포함된 `Se2Keyboard` 입력을 사용하고, 둘 이상이면 robot별 `cmd_vel` subscriber를 만든다.

```text
/env_0/unitree_go2/cmd_vel → base_vel_cmd_input[0]
/env_1/unitree_go2/cmd_vel → base_vel_cmd_input[1]
...
```

`cmd_vel_gui.py`는 각 robot에 $(v_x, v_y, \omega_z)$ slider와 stop button을 만들고 20 Hz로 `Twist`를 publish한다. GUI thread와 `rclpy.spin()`도 분리.

<figure>
  <video controls autoplay muted loop playsinline preload="metadata"
         poster="/assets/img/posts/isaac/sim/isaacsim5-ros2-go2/02-multi-robot-teleoperation-poster.jpg"
         aria-describedby="multi-robot-caption"
         style="width: 100%; border-radius: 6px;">
    <source src="https://media.iamjaehka13.blog/assets/img/posts/isaac/sim/isaacsim5-ros2-go2/01-multi-robot-teleoperation.mp4" type="video/mp4">
    이 브라우저는 동영상 재생을 지원하지 않는다.
  </video>
  <figcaption id="multi-robot-caption" class="text-center">
    Env별 velocity command를 policy input으로 넣은 teleoperation 시연.
  </figcaption>
</figure>

## **6. Camera, RTX LiDAR, odometry**

Camera는 Go2 base 앞쪽에 붙인 `640 × 480` pinhole camera. 현재 scene configuration의 실제 data type은 RGB 하나다.

RTX LiDAR는 각 environment의 `Go2/base` 아래에 생성한다.

```python
omni.kit.commands.execute(
    "IsaacSensorCreateRtxLidar",
    parent=f"/World/envs/env_{i}/Go2/base",
    path="lidar",
    config="Example_Rotatory",
    **{"omni:sensor:Core:scanRateBaseHz": 20},
)
```

Camera와 LiDAR마다 별도의 OmniGraph를 만들고 `ROS2CameraHelper`, `ROS2RtxLidarHelper`에 render product를 연결했다. Odometry는 sensor integration 결과가 아니라 simulator의 root state를 읽어 만든 simulation-state odometry다.

Quaternion convention도 한 번 변환한다.

```python
# Simulator tensor: WXYZ
quat_wxyz = robot_data.root_state_w[i, 3:7]

# ROS 2: XYZW
quat_xyzw = [
    quat_wxyz[1],
    quat_wxyz[2],
    quat_wxyz[3],
    quat_wxyz[0],
]
```

현재 topic contract:

| Topic | Type | 방향 |
|---|---|---|
| `/env_i/unitree_go2/cmd_vel` | `geometry_msgs/Twist` | ROS 2 → simulation |
| `/env_i/unitree_go2/front_cam/rgb` | `sensor_msgs/Image` | simulation → ROS 2 |
| `/env_i/unitree_go2/lidar/point_cloud` | `sensor_msgs/PointCloud2` | simulation → ROS 2 |
| `/env_i/unitree_go2/odom` | `nav_msgs/Odometry` | simulation → ROS 2 |
| `/clock` | `rosgraph_msgs/Clock` | simulation → ROS 2 |
| `/tf`, `/tf_static` | `tf2_msgs/TFMessage` | TF publisher → ROS 2 |

<figure>
  <video controls autoplay muted loop playsinline preload="metadata"
         poster="/assets/img/posts/isaac/sim/isaacsim5-ros2-go2/03-rviz-sensor-bridge-poster.jpg"
         aria-describedby="rviz-sensor-caption"
         style="width: 100%; border-radius: 6px;">
    <source src="https://media.iamjaehka13.blog/assets/img/posts/isaac/sim/isaacsim5-ros2-go2/02-rviz-sensor-bridge.mp4" type="video/mp4">
    이 브라우저는 동영상 재생을 지원하지 않는다.
  </video>
  <figcaption id="rviz-sensor-caption" class="text-center">
    Isaac Sim의 RTX LiDAR point cloud를 RViz2에서 확인한 화면.
  </figcaption>
</figure>

## **7. Robot별 TF tree**

Sensor topic에 frame ID만 적는 것으로는 부족하다. RViz2와 Nav2가 각 measurement를 어디에 놓을지 알 수 있도록 `tf_publisher.py`를 별도 node로 실행한다.

```text
world
└── odom_i
    └── base_link_i
        ├── front_cam_link_i
        └── go2_lidar{i}
```

- `world → odom_i`: static identity transform
- `odom_i → base_link_i`: `/env_i/unitree_go2/odom` pose 기반 dynamic TF
- `base_link_i → sensor`: `sim.yaml`의 sensor extrinsic 기반 static TF

이전 [RTX LiDAR 글](/posts/isaac-sim-rtx-lidar/)에서 만든 sensor output과 [TF·Odometry 글](/posts/isaac-sim-tf-odometry/)의 frame 구성을 multi-environment 구조로 옮긴 셈이다.

## **8. Scene과 digital twin**

`env_name`으로 Isaac Sim built-in scene을 고른다.

```yaml
env_name: warehouse
```

선택 가능한 값:

```text
warehouse
warehouse-forklifts
warehouse-shelves
full-warehouse
office
```

Warehouse와 office에는 하위 mesh collision을 적용하는 코드가 있다. Forklift·shelf·full warehouse variant는 같은 collision 처리가 빠져 있어, 보이는 geometry와 실제 충돌 geometry가 항상 일치한다고 볼 수 없다.

Digital twin 경로는 더 실험적이다. `envs/usdz_import.py`에 특정 PC의 absolute USDZ path가 남아 있고, `run_simul.py`의 `GS_import()` 호출도 주석 처리된 상태. 위 영상은 import 성공 기록이지, 저장소만 clone하면 바로 재현되는 기능은 아니다.

## **9. Nav2 연결**

Nav2가 요구하는 쪽은 크게 두 갈래다.

```text
Nav2 controller
→ cmd_vel
→ PPO locomotion policy
→ Go2 motion
```

```text
LiDAR + odometry + TF + clock
→ localization / costmap
→ Nav2 planner and controller
```

<figure>
  <video controls autoplay muted loop playsinline preload="metadata"
         poster="/assets/img/posts/isaac/sim/isaacsim5-ros2-go2/05-nav2-integration-poster.jpg"
         aria-describedby="nav2-caption"
         style="width: 100%; border-radius: 6px;">
    <source src="https://media.iamjaehka13.blog/assets/img/posts/isaac/sim/isaacsim5-ros2-go2/04-nav2-integration.mp4" type="video/mp4">
    이 브라우저는 동영상 재생을 지원하지 않는다.
  </video>
  <figcaption id="nav2-caption" class="text-center">
    Warehouse의 Go2와 robot별 Nav2 화면을 함께 실행한 기록.
  </figcaption>
</figure>

영상에서는 두 robot namespace의 map과 navigation feedback을 확인할 수 있다. 다만 Nav2 launch, map, localization, remap 설정은 이 저장소에 들어 있지 않다. 따라서 저장소가 제공하는 범위는 **Nav2가 붙을 command·sensor·odometry·TF interface**까지이며, 영상과 같은 navigation stack을 단독으로 재현하려면 외부 설정이 더 필요하다.

## **10. 실행 순서**

저장소 기본 설정은 `num_envs: 2`, `freq: 40`, `env_name: warehouse`.

Isaac Sim terminal:

```bash
python run_simul.py
```

TF publisher:

```bash
python tf_publisher.py
```

Multi-robot command GUI:

```bash
python cmd_vel_gui.py
```

주요 파일:

```text
run_simul.py                 application과 main loop
config/sim.yaml              env 수, 주기, scene, sensor pose
config/agent.yaml            checkpoint와 PPO network 설정
go2/go2_env.py               observation, action, policy load
go2/go2_ctrl.py              command tensor와 keyboard 입력
go2/go2_sensors.py           RTX LiDAR 생성
ros2/go2_ros2_bridge.py      topic subscriber와 OmniGraph publisher
tf_publisher.py              static/dynamic TF
cmd_vel_gui.py               env별 Twist GUI
envs/sim_env.py              warehouse·office scene import
envs/usdz_import.py          experimental digital twin import
```
