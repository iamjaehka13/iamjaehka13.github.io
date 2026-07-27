---
title: "[IsaacLab Part 1] Unitree Go2 URDF import"
date: 2025-12-04 18:49:09 +0900
last_modified_at: 2025-12-04 22:38:25 +0900
categories: [Isaac, Lab]
tags: [unitree-go2, isaac-lab, isaac-sim, urdf, robotics]
description: Isaac Lab을 설치하고 Unitree Go2 URDF를 Isaac Sim scene에 load하는 과정을 정리한다.
image: /assets/img/posts/isaac/lab/unitree-go2-part-1-urdf-import/01-custom-script-folder.png
math: true
---
## Isaac Lab 설치

<https://isaac-sim.github.io/IsaacLab/release/2.2.0/source/setup/installation/binaries_installation.html>

Isaac Lab을 설치한 뒤 `isaaclab_assets`에 포함된 Unitree Go2 configuration을 이용해 로봇을 Isaac Sim에 불러왔습니다.

## Load script 작성

![image](/assets/img/posts/isaac/lab/unitree-go2-part-1-urdf-import/01-custom-script-folder.png){: .d-block .mx-auto }

Isaac Lab의 `scripts` 아래에 custom 폴더를 만들고 Go2를 load하는 Python 파일을 생성했습니다.

`scripts/tutorials/00_sim/create_empty.py`와 `scripts/demos/quadrupeds.py`를 참고해 빈 scene에 Go2 articulation을 배치했습니다.

```python
import argparse

from isaaclab.app import AppLauncher

# create argparser
parser = argparse.ArgumentParser(description="go2 scene")
# append AppLauncher cli args
AppLauncher.add_app_launcher_args(parser)
# parse the arguments
args_cli = parser.parse_args()
# launch omniverse app
app_launcher = AppLauncher(args_cli)
simulation_app = app_launcher.app

"""Rest everything follows."""
import numpy as np
import torch
import isaaclab.sim as sim_utils
from isaaclab.assets import Articulation

from isaaclab.sim import SimulationCfg, SimulationContext
from isaaclab_assets.robots.unitree import UNITREE_GO2_CFG


def main():
    """Main function."""

    # Initialize the simulation context
    sim_cfg = SimulationCfg(dt=0.01)
    sim = SimulationContext(sim_cfg)
    # Set main camera
    sim.set_camera_view([2.5, 2.5, 2.5], [0.0, 0.0, 0.0])
    # Ground-plane 생성
    cfg = sim_utils.GroundPlaneCfg()
    cfg.func("/World/defaultGroundPlane", cfg)
    # Lights
    cfg = sim_utils.DomeLightCfg(intensity=2000.0, color=(0.75, 0.75, 0.75))
    cfg.func("/World/Light", cfg)

    # go2 articulation을 로드합니다.
    go2 = Articulation(UNITREE_GO2_CFG.replace(prim_path="/World/go2"))

    # 로봇 데이터에 접근하기 전에 simulator를 먼저 실행해줍니다.
    #
    '''Articulation 객체가 완전히 유효한 시뮬레이션 데이터를 담기 위해서는
      객체 생성 후 시뮬레이션이 최소 한 번 재설정(Reset)되거나 스텝(Step)이 수행되어야 합니다.'''
    sim.reset()

    root_state = go2.data.default_root_state.clone()
    # 로봇의 초기 pose의 위치와 방향을 입력해줍니다.
    go2.write_root_pose_to_sim(root_state[:, :7])
    # 로봇의 속도, 가속도를 입력해줍니다.
    go2.write_root_velocity_to_sim(root_state[:, 7:])
    joint_pos, joint_vel = go2.data.default_joint_pos.clone(), go2.data.default_joint_vel.clone()
    # 로봇의 초기 joint state를 입력합니다.
    go2.write_joint_state_to_sim(joint_pos, joint_vel)
    # 로봇을 reset하여 로봇의 이전 상태에 대한 정보를 없앱니다. (강화학습을 위해)
    go2.reset()

    # generate random joint positions
    joint_pos_target = go2.data.default_joint_pos
    # apply action to the robot
    go2.set_joint_position_target(joint_pos_target)
    # write data to sim
    go2.write_data_to_sim()


    # Now we are ready!
    print("[INFO]: Setup complete...")

    # Simulate physics
    while simulation_app.is_running():
        # perform step
        sim.step()


if __name__ == "__main__":
    # run the main function
    main()
    # close sim app
    simulation_app.close()
```

<video controls playsinline preload="metadata" poster="/assets/img/posts/isaac/lab/unitree-go2-part-1-urdf-import/02-go2-load-preview.jpg" style="width: 100%; border-radius: 6px;">
  <source src="/assets/img/posts/isaac/lab/unitree-go2-part-1-urdf-import/02-go2-load.mp4" type="video/mp4">
</video>

*Go2를 Isaac Sim에 load한 모습*
{: .text-center}

초기 joint pose는 한 번만 기록했기 때문에 로봇이 땅에 떨어진 뒤 자세를 유지하지 못했습니다. 서 있는 자세를 유지하려면 매 step에 joint target을 적용하거나 balance policy로 폐루프 제어해야 합니다.
