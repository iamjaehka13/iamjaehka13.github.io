---
title: "[Unitree Go2 part 3] Sim2Real 쉽지 않습니다."
date: 2026-03-20 21:03:00 +0900
last_modified_at: 2026-03-24 00:00:13 +0900
categories: [Unitree, Sim2Real]
tags: [unitree-go2, sim2real, reinforcement-learning, isaac-sim, deployment]
description: 현재상황
image: /assets/img/posts/unitree/sim2real/unitree-go2-part-3-sim2real-is-hard/32acbb7d-7937-80c8-abcc-f2453c1ca817.gif
math: true
---

# 현재상황

발을 들게하는 여러가지 reward를 추가하였더니 이제는 mujoco상에서는 go2가 걸을 수 있게 되었습니다.

![](/assets/img/posts/unitree/sim2real/unitree-go2-part-3-sim2real-is-hard/329cbb7d-7937-805c-8183-fc646408590c.gif)

발을 들도록 하는 reward는 크게 3가지로 볼 수 있습니다.

1. 발을 threshold 보다 긴 시간동안 들면 보상을 주는 feet_air_time 보상
   1. weight를 0.01 → 5.0으로 변경하였습니다.
1. height scanner를 기준으로발을 일정 target height만큼 높게 들때 보상을 주는 feet_clearance 보상
   1. 움직이고 있는 발의 x,y좌표로부터 가장 가까운 height scanner의 높이와 비교하여 target height를 0.08로 하였습니다.
   <details markdown="1">
   <summary>feet_clearance_reward()</summary>

   ```python
   def feet_clearance_reward(
       env: ManagerBasedRLEnv,
       asset_cfg: SceneEntityCfg,
       sensor_cfg: SceneEntityCfg,
       target_height: float,
       std: float,
       tanh_mult: float,
   ) -> torch.Tensor:
       """Signed foot-clearance reward from local terrain height.

       Positive when swing-foot clearance is above target, negative when below.
       """
       asset: RigidObject = env.scene[asset_cfg.name]
       height_scanner = env.scene.sensors[sensor_cfg.name]

       # Foot positions in world frame
       foot_pos = asset.data.body_pos_w[:, asset_cfg.body_ids]
       foot_xy = foot_pos[:, :, :2]
       foot_z = foot_pos[:, :, 2]

       # Height scanner hit points in world frame
       hit_xy = height_scanner.data.ray_hits_w[:, :, :2]
       hit_z = height_scanner.data.ray_hits_w[:, :, 2]

       # For each foot, pick the closest ray-hit point in XY and use its Z value as local ground height.
       hit_dist_sq = torch.sum((foot_xy.unsqueeze(2) - hit_xy.unsqueeze(1)) ** 2, dim=-1)
       invalid_hit = torch.isinf(hit_z) | torch.isinf(hit_xy).any(dim=-1)
       hit_dist_sq = torch.where(invalid_hit.unsqueeze(1), torch.full_like(hit_dist_sq, float("inf")), hit_dist_sq)
       closest_hit_idx = torch.argmin(hit_dist_sq, dim=2)
       ground_z = torch.gather(hit_z, 1, closest_hit_idx)
       ground_z = torch.where(torch.isfinite(ground_z), ground_z, foot_z)

       # Signed clearance around target height:
       # > 0 when above target, < 0 when below target.
       clearance = (foot_z - ground_z) - target_height
       clearance_scaled = torch.tanh(clearance / max(std, 1e-6))
       foot_velocity_tanh = torch.tanh(tanh_mult * torch.norm(asset.data.body_lin_vel_w[:, asset_cfg.body_ids, :2], dim=2))
       reward = torch.mean(clearance_scaled * foot_velocity_tanh, dim=1)
       reward *= torch.linalg.norm(env.command_manager.get_command("base_velocity"), dim=1) > 0.1
       reward *= torch.clamp(-env.scene["robot"].data.projected_gravity_b[:, 2], 0, 0.7) / 0.7
       return reward
   ```



   </details>
1. 몸통을 기준으로 몸통 아래로 특정 높이만큼 들게 하는 feet_body_height 보상
   1. go2의 default pose 몸통 높이가 약 35cm이므로 발높이를 지면으로부터 8cm로 하여 -0.27의 target height를 부여하였습니다.
   <details markdown="1">
   <summary>feet_height_body()</summary>

   ```python
   def feet_height_body(
       env: ManagerBasedRLEnv,
       command_name: str,
       asset_cfg: SceneEntityCfg,
       target_height: float,
       tanh_mult: float,
   ) -> torch.Tensor:
       """Reward the swinging feet for clearing a specified height off the ground"""
       asset: RigidObject = env.scene[asset_cfg.name]
       cur_footpos_translated = asset.data.body_pos_w[:, asset_cfg.body_ids, :] - asset.data.root_pos_w[:, :].unsqueeze(1)
       footpos_in_body_frame = torch.zeros(env.num_envs, len(asset_cfg.body_ids), 3, device=env.device)
       cur_footvel_translated = asset.data.body_lin_vel_w[:, asset_cfg.body_ids, :] - asset.data.root_lin_vel_w[
           :, :
       ].unsqueeze(1)
       footvel_in_body_frame = torch.zeros(env.num_envs, len(asset_cfg.body_ids), 3, device=env.device)
       for i in range(len(asset_cfg.body_ids)):
           footpos_in_body_frame[:, i, :] = quat_apply_inverse(asset.data.root_quat_w, cur_footpos_translated[:, i, :])
           footvel_in_body_frame[:, i, :] = quat_apply_inverse(asset.data.root_quat_w, cur_footvel_translated[:, i, :])
       foot_z_target_error = torch.square(footpos_in_body_frame[:, :, 2] - target_height).view(env.num_envs, -1)
       foot_velocity_tanh = torch.tanh(tanh_mult * torch.norm(footvel_in_body_frame[:, :, :2], dim=2))
       reward = torch.sum(foot_z_target_error * foot_velocity_tanh, dim=1)
       reward *= torch.linalg.norm(env.command_manager.get_command(command_name), dim=1) > 0.1
       reward *= torch.clamp(-env.scene["robot"].data.projected_gravity_b[:, 2], 0, 0.7) / 0.7
       return reward
   ```



   </details>
# What is Problem?

## 진행과정



### in simulation

1. feet slide에 상당히 go2가 민감하게 반응하는 것을 확인하였습니다. 과도하게 높은 weight를 설정하자 아예 발을 떼지 않게 되는 것을 확인할 수 있었습니다.
1. 따라서 발을 드는 보상인 feet body height 보상을 설계하였습니다.
   1. feet height의 target height를 높게 설정하는 순간 robot이 base의 높이를 낮춰버리는 문제가 발생하였습니다…
      ![](/assets/img/posts/unitree/sim2real/unitree-go2-part-3-sim2real-is-hard/32acbb7d-7937-80eb-a498-f16ed8ec48fd.gif)
1. feet_clearance 보상을 사용하여 target height를 0.08m로 하고 학습하였더니 발을 옆으로 들면서 air time보상과 clearance보상을 최대화하려는 local minima에 빠지는 것이 확인되었습니다.
   ![](/assets/img/posts/unitree/sim2real/unitree-go2-part-3-sim2real-is-hard/32acbb7d-7937-8095-8563-fd5600868e80.gif)
→ 최종적으로 feet air time을 빼고 feet clearance만 사용하기로 하였습니다.



### feet clearance reward

![](/assets/img/posts/unitree/sim2real/unitree-go2-part-3-sim2real-is-hard/feet-clearance-1.png)

![](/assets/img/posts/unitree/sim2real/unitree-go2-part-3-sim2real-is-hard/feet-clearance-2.png)





### in real

1. 다양한 모델을 학습하고 real에 배포 하였지만 이전과 마찬가지로 앞뒤좌우로 몸을 기울이기만 할뿐 발을 드는 동작을 보이진 않았습니다.

   [![](/assets/img/posts/unitree/sim2real/unitree-go2-part-3-sim2real-is-hard/img-1541.gif)](/assets/img/posts/unitree/sim2real/unitree-go2-part-3-sim2real-is-hard/img-1541.gif){: .popup .img-link .shimmer .d-block .mx-auto style="max-width: 420px;"}
   {: .text-center}


1. 또한 로봇이 stand 상태일때 발을 많이 접는 현상이 있었습니다…
   1. 이 현상은 observation에 있는 last action에 onnx파일의 출력으로 나오는 raw action을 넣어주었어야 하는데 scale과 offset을 적용한 값을 넣어주어 이전 action이 엄청나게 보수적으로 들어가는 버그가 있었습니다. 이를 해결하니 로봇 다리가 펴지는 것을 확인할 수 있었습니다.
![](/assets/img/posts/unitree/sim2real/unitree-go2-part-3-sim2real-is-hard/32acbb7d-7937-806c-8f0e-cd1ed2ba67cc.gif)



1. go2에 depoly된 모델의 토크값을 확인해보았을때 뒷다리의 토크값이 앞다리에 비해 비정상적으로 낮은 것을 확인하였습니다. 원인으로는 아래 두가지를 생각하고 있습니다.
   ![](/assets/img/posts/unitree/sim2real/unitree-go2-part-3-sim2real-is-hard/32acbb7d-7937-80d3-8e0f-cac3ab04cc22.webp)

   1. terrain을 너무 높게 잡아서 (go2 보다 높은 40cm) 앞발이 go2를 견인하고 있다.
   1. q error만으로 RL model을 학습 시키기에는 go2 자체가 필요한 토크가 너무 크다.




1. depoly할때의 뒷다리의 stiffness를 25 → 40으로 변경하니 앞뒤 좌우로 걷기 시작하였습니다.


![](/assets/img/posts/unitree/sim2real/unitree-go2-part-3-sim2real-is-hard/32acbb7d-7937-80c8-abcc-f2453c1ca817.gif)

![](/assets/img/posts/unitree/sim2real/unitree-go2-part-3-sim2real-is-hard/img-1586.gif)



**문제점**

- 앞뒤로 움직일때 다리를 너무 높게 드는 문제점이 있습니다.
  - 뒷발의 stiffness를 임의로 높게 설정하여 torque값이 강하게 나와 앞발과 비교할때 상대적으로 높게 다리를 드는 것을 확인할 수 있었습니다. → go2의 밸런스 악화 → 제대로된 제어 불가능 으로 이어집니다.


- 또한 제어값을 0.5 m/s이상으로 주어야만 움직이기 시작합니다. 움직이기 위한 최소한의 토크가 높다는 뜻입니다.


**해결책**

1. **이전 상황 (문제점):** 기존에는 로봇이 자기 몸무게를 버티고 일어서려면, 인공지능이 목표 관절 각도(Target)를 비정상적으로 꺾이게 던져서 **억지로 큰 에러(Error)와 텐션**을 만들어내야만 했습니다. 시뮬레이션에선 이 꼼수가 통했지만, 진짜 로봇(Real)에 넣으면 모터가 그 과격한 명령을 버티지 못하고 주저앉아버렸죠.
1. **해결책:** 물리 엔진(PhysX)이 매 순간 **"현재 자세에서 중력을 버티려면 이 관절에 얼만큼의 기본 힘이 필요한지"**를 계산해서 **피드포워드(**$\tau_{ff}$**)**로 먼저 쏴줍니다.
1. **기대 효과:** 로봇 입장에서는 이미 누군가가 밑에서 몸무게를 받쳐주는 느낌이 듭니다. 덕분에 인공지능은 무거운 몸을 띄우기 위해 억지 타겟을 내뱉지 않아도 되고, 오직 **'원하는 방향으로 부드럽게 발을 뻗는 궤적**만 얌전하게 출력하게 됩니다.
