---
title: "[Unitree Go2 part 2] 발을 떼지 않는 문제 분석"
date: 2026-01-16 19:40:00 +0900
last_modified_at: 2026-03-23 22:34:27 +0900
categories: [Unitree, Sim2Real]
tags: [unitree-go2, sim2real, reinforcement-learning, isaac-sim, deployment]
description: 첫 deploy에서 Go2가 발을 떼지 못했던 문제를 reward 설정, terrain, feet clearance, MuJoCo sim-to-sim 관점에서 분석한다.
image: /assets/img/posts/unitree/sim2real/unitree-go2-part-1-sim2real-story/322cbb7d-7937-80f8-85bf-d0023259d89d.gif
math: true
---

## **1. 현재 문제**

![](/assets/img/posts/unitree/sim2real/unitree-go2-part-1-sim2real-story/img-1539.gif)

지난 글에서는 policy를 실제 Go2에 deploy했지만, 로봇이 발을 떼지 못하고 command 방향으로 base만 기울이는 문제를 확인했습니다. 이후 며칠 동안 reward와 학습 설정을 바꿔가며 원인을 좁혀보았습니다.

질문은 하나였습니다.

> simulation에서는 걷는 것처럼 보이는데, 왜 real robot에서는 발을 떼지 못할까?

## **2. 가설 1: 발을 드는 Reward가 부족한가**

첫 번째 가설은 발을 드는 동작을 유도하는 reward setting이 충분하지 않다는 것이었습니다. `unitree_rl_lab`에서 기본으로 제공하는 관련 reward는 아래와 같았습니다.

### **2.1 feet_air_time()**

<details markdown="1">
<summary>feet_air_time</summary>

```python
def feet_air_time(
    env: ManagerBasedRLEnv, command_name: str, sensor_cfg: SceneEntityCfg, threshold: float
) -> torch.Tensor:
    """Reward long steps taken by the feet using L2-kernel.

    This function rewards the agent for taking steps that are longer than a threshold. This helps ensure
    that the robot lifts its feet off the ground and takes steps. The reward is computed as the sum of
    the time for which the feet are in the air.

    If the commands are small (i.e. the agent is not supposed to take a step), then the reward is zero.
    """
    # extract the used quantities (to enable type-hinting)
    contact_sensor: ContactSensor = env.scene.sensors[sensor_cfg.name]
    # compute the reward
    first_contact = contact_sensor.compute_first_contact(env.step_dt)[:, sensor_cfg.body_ids]
    last_air_time = contact_sensor.data.last_air_time[:, sensor_cfg.body_ids]
    reward = torch.sum((last_air_time - threshold) * first_contact, dim=1)
    # no reward for zero command
    reward *= torch.norm(env.command_manager.get_command(command_name)[:, :2], dim=1) > 0.1
    return reward
```



</details>

- 변수
  - $t_{air, i}$: $i$번째 발이 공중에 떠 있었던 시간 (`last_air_time`)
  - $C_i$: $i$번째 발이 지면에 닿았는지 여부를 나타내는 이진 플래그 (`first_contact`)
  - $\tau$: 보상을 주기 위한 최소 공중 체류 시간 임계값 (`threshold`)
  - $\mathbf{v}_{cmd}$: 로봇에게 내려진 속도 command
- reward
  - $R_{air} = \sum_{i \in \text{feet}} (t_{air, i} - \tau) \cdot C_i$
  - threshold 시간보다 길게 발을 들고 있던 발이 다시 땅에 닿는 순간 보상을 줍니다.


기존에 `0.1`로 되어 있던 weight를 `5.0`으로 크게 올려, 발을 드는 행동에 대한 보상을 강화했습니다.



### **2.2 feet_slide()**

<details markdown="1">
<summary>feet_slide()</summary>

```python
def feet_slide(env, sensor_cfg: SceneEntityCfg, asset_cfg: SceneEntityCfg = SceneEntityCfg("robot")) -> torch.Tensor:
    """Penalize feet sliding.

    This function penalizes the agent for sliding its feet on the ground. The reward is computed as the
    norm of the linear velocity of the feet multiplied by a binary contact sensor. This ensures that the
    agent is penalized only when the feet are in contact with the ground.
    """
    # Penalize feet sliding
    contact_sensor: ContactSensor = env.scene.sensors[sensor_cfg.name]
    contacts = contact_sensor.data.net_forces_w_history[:, :, sensor_cfg.body_ids, :].norm(dim=-1).max(dim=1)[0] > 1.0
    asset = env.scene[asset_cfg.name]

    body_vel = asset.data.body_lin_vel_w[:, asset_cfg.body_ids, :2]
    reward = torch.sum(body_vel.norm(dim=-1) * contacts, dim=1)
    return reward

```



</details>

- 변수
  - $v_{i, xy}$: $i$번째 발의 월드 좌표계 기준 수평 선속도 (`body_lin_vel_w[:, :, :2]`)
  - $F_{i}$: $i$번째 발에 가해지는 지면 반력(Net force)의 크기
  - $C_i$: 발이 지면에 닿아 있는지를 판단하는 이진 플래그 (Boolean)
  - $I$: 접촉 판단 임계값 (코드에서는 `1.0` Newton)
- reward
  - $R_{slide} = \sum_{i \in \text{feet}} \|v_{i, xy}\| \cdot C_i$
  - 발이 지면에 닿아 있는 상태에서 foot velocity가 발생하면 negative reward를 주는 구조입니다.


기존에 `-0.1`로 되어 있던 weight를 `-1.0`으로 변경해, 발이 미끄러지는 행동에 대한 penalty를 강화했습니다.



### **2.3 결과**

![](/assets/img/posts/unitree/sim2real/unitree-go2-part-1-sim2real-story/322cbb7d-7937-80f8-85bf-d0023259d89d.gif)

해당 세팅으로 학습한 결과, 오히려 simulation에서도 로봇이 제대로 걷지 못했습니다. 발을 들도록 유도하려던 수정이 policy 학습을 더 어렵게 만든 것입니다.



## **3. 가설 2: Terrain과 Clearance가 필요한가**

로그를 확인해보니 `feet_air_time`이 대부분 0에 가까웠습니다. policy 입장에서는 threshold보다 오래 발을 들어 보상을 얻기보다, 발을 계속 붙인 채 0에 가까운 보상을 받는 쪽이 더 쉬운 선택이었을 가능성이 있습니다.

또한 바닥에 발을 붙인 상태로 몸통만 흔들어도 velocity command와 관련된 보상을 일부 받을 수 있었습니다. 실제로 발을 들어 걷는 것보다 몸통을 흔드는 local minimum에 빠질 수 있는 구조였습니다.

관련 issue를 찾아보며 다음 방향으로 설정을 바꿨습니다.

- 단계적으로 어려워지는 terrain을 추가해, 로봇이 발을 들어야 하는 상황을 만듭니다.
  - curriculum에 따라 terrain 난이도를 조절하고, 계단을 제외한 rough terrain을 추가했습니다.
- USD contact 설정 문제를 확인합니다.
  - 확인 결과, 현재 사용한 asset에서는 발이 바닥에서 떨어질 때 contact signal도 정상적으로 끊어졌습니다.
- 발을 특정 높이 이상 들도록 하는 feet clearance 계열 reward를 추가합니다.
  - terrain이 추가되면 foot의 world z만 기준으로 삼기 어렵기 때문에, base와 foot 사이의 상대 높이를 사용하는 `feet_height_body` 함수를 추가했습니다.
  <details markdown="1">
  <summary>feet_height_body</summary>

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






### **3.1 결과**

`feet_slide` weight를 `-1.0`에서 다시 `-0.1`로 되돌리고, `feet_air_time` threshold를 낮춘 뒤 학습했습니다. 그 결과 simulation에서는 Go2가 다시 안정적으로 걷는 모습을 보였습니다.

![](/assets/img/posts/unitree/sim2real/unitree-go2-part-1-sim2real-story/322cbb7d-7937-8028-9067-d926b8217a1d.gif)



## **4. MuJoCo Sim-to-Sim 테스트**

이전에는 학습 결과가 좋아 보여 곧바로 real robot에 deploy했습니다. 하지만 보통은 Isaac Lab에서 학습한 policy를 먼저 CPU 기반 시뮬레이터인 **MuJoCo**에서 sim-to-sim 테스트해보는 것이 좋습니다.

그래서 이번에는 학습된 모델을 MuJoCo에서도 확인했습니다.

![](/assets/img/posts/unitree/sim2real/unitree-go2-part-1-sim2real-story/322cbb7d-7937-802c-ba1b-e6fa12bcea96.gif)



테스트 결과, real robot에서와 마찬가지로 MuJoCo에서도 로봇이 제대로 움직이지 않는 것을 확인했습니다.

이 결과로 문제가 real robot hardware만의 문제가 아니라, policy와 deploy 환경 사이의 정합성 또는 dynamics gap에 있을 가능성이 커졌습니다. 이후부터는 MuJoCo에서 통과한 모델만 실제 로봇에 deploy하는 방식으로 검증 단계를 나누기로 했습니다.
