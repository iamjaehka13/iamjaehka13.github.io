---
title: "[IsaacLab Part 2] Unitree Go2 환경 구성하기"
date: 2025-12-17 23:36:43 +0900
last_modified_at: 2026-07-27 22:47:54 +0900
categories: [Isaac, Lab]
tags: [unitree-go2, isaac-lab, isaac-sim, interactive-scene, robotics]
description: Isaac Lab의 InteractiveSceneCfg와 SimulationContext로 Unitree Go2 scene을 구성하는 과정을 정리한다.
image: /assets/img/posts/isaac/lab/unitree-go2-part-2-isaaclab-environment/01-go2-twisted-joints.png
math: true
---
## 프로젝트 목표

Go2가 도착한 뒤부터 simulation 설정을 실제 배포까지 이어갈 수 있게 됐다.

프로젝트 목표: simulation 학습에서 real deployment까지 이어지는 두 단계.

1. Isaac Lab에서 Go2 walking policy를 학습한다.
2. Sim-to-real 배포와 ROS2 제어를 연결한다.

## Interactive scene 구성

```python
from isaaclab.scene import InteractiveSceneCfg
from isaaclab.terrains import TerrainImporterCfg
from isaaclab.sensors.ray_caster import RayCasterCfg
from isaaclab.sensors.ray_caster.patterns import GridPatternCfg
from isaaclab.sensors.ray_caster import patterns
from isaaclab.utils import configclass
from isaaclab_assets.robots.unitree import UNITREE_GO2_CFG  # isort:skip
from isaaclab.assets import ArticulationCfg, AssetBaseCfg
import isaaclab.sim as sim_utils

@configclass
class Myscene(InteractiveSceneCfg):
    # 지형 정의
    terrain = TerrainImporterCfg(
        prim_path = "/World/ground",
        terrain_type = "plane",
    )

    # 로봇 정의
    go2: ArticulationCfg = UNITREE_GO2_CFG.replace(prim_path="{ENV_REGEX_NS}/Go2")

    # 센서 정의
    height_scanner = RayCasterCfg(
        prim_path = "{ENV_REGEX_NS}/Go2/base",
        update_period = 0.02,
        offset=RayCasterCfg.OffsetCfg(pos=(0.0, 0.0, 20.0)),
        ray_alignment="yaw",
        pattern_cfg=patterns.GridPatternCfg(resolution=0.1, size=[1.6, 1.0]), # pattern_cfg
        debug_vis=True,
        mesh_prim_paths=["/World/ground"],
    )

    # 조명 정의
    light = AssetBaseCfg(
        prim_path = "/World/light",
        spawn = sim_utils.DistantLightCfg(intensity=1000.0),
    )
```

`InteractiveSceneCfg`에는 terrain, robot, sensor와 light를 함께 정의할 수 있다.

- **Terrain:** `prim_path`와 type을 지정해 plane을 생성했다.
- **Robot:** `UNITREE_GO2_CFG`를 가져와 각 environment namespace에 Go2를 배치했다.
- **Sensor:** `height_scanner`가 robot base 주변에서 ground까지 ray를 쏴 지형 높이를 측정한다. 이 값은 이후 locomotion policy의 terrain observation으로 사용할 수 있다.

## Simulation 설정

```python
import os
import hydra
import rclpy
import torch
import time
import math
import argparse
from isaaclab.app import AppLauncher
# add argparse arguments
parser = argparse.ArgumentParser(description="Unitree go2 ros2 setup")

# append AppLauncher cli args
AppLauncher.add_app_launcher_args(parser)
# parse the arguments
args_cli = parser.parse_args()

# launch omniverse app
app_launcher = AppLauncher(args_cli)
simulation_app = app_launcher.app

"""Rest everything follows."""

import torch
import isaaclab.sim as sim_utils
from isaaclab.scene import InteractiveScene, InteractiveSceneCfg
from isaaclab.sim import SimulationContext

from go2.go2_env import Myscene


FILE_PATH = os.path.join(os.path.dirname(__file__), "config")
@hydra.main(config_path=FILE_PATH, config_name="sim", version_base=None)
def run_simulator(cfg):
    sim_cfg = sim_utils.SimulationCfg(device=args_cli.device)
    sim = SimulationContext(sim_cfg)
    sim.set_camera_view([2.5, 0.0, 4.0], [0.0, 0.0, 2.0])
    scene_cfg = Myscene(num_envs=cfg.num_envs, env_spacing=2.0)
    scene = InteractiveScene(scene_cfg)
    # play the simulator
    sim.reset()
    print("[INFO]: simulation started")
    sim_dt = sim.get_physics_dt()
    count = 0
    robot = scene["go2"]
    while simulation_app.is_running():
        if count % 300 == 0:
            count = 0
            root_state = robot.data.default_root_state.clone()
            root_state[:,:3] += scene.env_origins
            robot.write_root_pose_to_sim(root_state[:,:7])
            robot.write_root_velocity_to_sim(root_state[:,7:])
            joint_pos, joint_vel = robot.data.default_joint_pos.clone(), robot.data.default_joint_vel.clone()
            joint_pos += torch.rand_like(joint_pos) * 0.1
            robot.write_joint_state_to_sim(joint_pos, joint_vel)
            scene.reset()
            print("[INFO]: Resetting robot scene")

        joint_pos_target = torch.randn_like(robot.data.joint_pos) * 0.1
        # apply action to the robot
        robot.set_joint_position_target(joint_pos_target)
        # -- write data to sim
        scene.write_data_to_sim()
        # Perform step
        sim.step()
        # Increment counter
        count += 1
        # Update buffers
        scene.update(sim_dt)
    simulation_app.close()

if __name__ == "__main__":
    run_simulator()
```

Hydra로 config를 읽고 `SimulationContext`를 만든 뒤, 위에서 정의한 scene config로 실제 scene을 생성한다. `scene["go2"]`로 articulation에 접근하고 300 step마다 root와 joint state를 reset했다.

![관절이 기묘하게 뒤틀린 go2..](/assets/img/posts/isaac/lab/unitree-go2-part-2-isaaclab-environment/01-go2-twisted-joints.png){: .d-block .mx-auto }

*Random joint target 때문에 관절이 크게 꺾인 Go2*
{: .text-center}

<video controls playsinline preload="metadata" poster="/assets/img/posts/isaac/lab/unitree-go2-part-2-isaaclab-environment/02-isaaclab-scene-random-joints-preview.jpg" style="width: 100%; border-radius: 6px;">
  <source src="/assets/img/posts/isaac/lab/unitree-go2-part-2-isaaclab-environment/02-isaaclab-scene-random-joints.mp4" type="video/mp4">
</video>

Random joint target을 그대로 넣었기 때문에 동작 자체는 의미가 없지만, terrain·robot·sensor가 config대로 생성되고 reset loop가 동작하는 것까지 확인했다.
