---
title: "[Unitree Go2 part 4] feed forward 토크 적용해보기"
date: 2026-03-23 19:14:00 +0900
last_modified_at: 2026-03-24 00:00:13 +0900
categories: [Unitree, Sim2Real]
tags: [unitree-go2, sim2real, reinforcement-learning, isaac-sim, deployment]
description: 현재상황
image: /assets/img/posts/unitree/sim2real/unitree-go2-part-4-feed-forward-torque/32ccbb7d-7937-8055-bcb2-d4b130bc0615.gif
math: true
---

## 현재상황



go2에 아무리 커멘드를 주어도 go2가 발을 떼지 못하고 base만 command방향에 따라 기울이고 있는 상황이었습니다.. 하지만 **뒷다리의 힘이 앞다리에 비해 약하다는걸 확인하고 stiffness를 높여주어** 조금 뻣뻣하지만 강한 출력을 낼 수 있게 해주자 드디어 로봇이 움직이기 시작했습니다!



### idea

**상황**

- unitree go2의 /lowstate와 강화학습 명령이 내리는 /lowcmd 값의 q값을 비교해보았을때 0.2 radian정도의 오차가 발생하는 것을 확인하였습니다.
  - 0.2 rad정도의 오차가 내부 제어기 안에서 이동할 만큼의 충분한 토크를 생성하고 있지 못하고 있고 이로인해 커멘드에 따라 로봇의 hip이나 thigh에서는 기울이는 정도의 힘을 내지만 claf에서는 힘을 내지 못하는게 아닐까?
- go2로봇은 대각선의 발을 번갈아 드는데 뒷발의 토크가 약하여 발을 들지 못하는 것을 확인하였습니다.


**해결책**

- 중력의 영향으로 각 관절에 버티기 위한 토크의 양을 계산하였습니다.
  - isaaclab 시뮬레이션에서는 중력 보상 토크를 계산하는 함수가 있습니다. `get_gravity_compensation_forces` → 학습 시에 사용
  <details markdown="1">
  <summary>GravityCompJointPositionAction</summary>

  ```python
  from __future__ import annotations

  import torch

  from isaaclab.envs.mdp.actions import actions_cfg
  from isaaclab.envs.mdp.actions.joint_actions import JointPositionAction
  from isaaclab.utils import configclass


  class GravityCompJointPositionAction(JointPositionAction):
      """Joint position action with model-based gravity compensation."""

      cfg: "GravityCompJointPositionActionCfg"

      def _get_generalized_gravity_forces(self) -> torch.Tensor:
          view = self._asset.root_physx_view
          for method_name in (
              "get_gravity_compensation_forces",
              "get_generalized_gravity_forces",
              "get_gravity_forces",
          ):
              method = getattr(view, method_name, None)
              if callable(method):
                  forces = method()
                  return torch.as_tensor(forces, device=self.device, dtype=self.processed_actions.dtype)
          raise AttributeError("Articulation view does not expose a gravity compensation method.")

      def apply_actions(self):
          super().apply_actions()

          if self.cfg.gravity_comp_scale == 0.0:
              return

          generalized_forces = self._get_generalized_gravity_forces()
          root_dofs = generalized_forces.shape[1] - self._asset.num_joints
          if root_dofs < 0:
              raise RuntimeError(
                  "Gravity compensation vector is smaller than the joint dimension. "
                  f"got={generalized_forces.shape[1]}, num_joints={self._asset.num_joints}"
              )

          joint_forces = generalized_forces[:, root_dofs:]
          feedforward_effort = joint_forces[:, self._joint_ids] * float(self.cfg.gravity_comp_scale)

          if self.cfg.gravity_comp_max_torque is not None:
              limit = abs(float(self.cfg.gravity_comp_max_torque))
              feedforward_effort = torch.clamp(feedforward_effort, min=-limit, max=limit)

          self._asset.set_joint_effort_target(feedforward_effort, joint_ids=self._joint_ids)


  @configclass
  class GravityCompJointPositionActionCfg(actions_cfg.JointPositionActionCfg):
      """Configuration for joint position control with gravity compensation."""

      class_type: type = GravityCompJointPositionAction

      gravity_comp_scale: float = 0.0
      gravity_comp_max_torque: float | None = None

  ```



  </details>

  - depoly 할때에는 go2의 urdf파일로부터 go2 각 파트의 질량 정보를 가져와 joint_pos + base quaternion(IMU) 를 입력으로 각 모터에 필요한 $\tau_{ff}$ 를 계산합니다.
$τ_{computed}​=k_p​∗(q_{des}​−q)+k+d​∗(q'_{des​}−q'​)+τ_{ff​}$

- 이러한 방법을 통해 position error가 없는데도 error를 억지로 늘려서 서있기 위한 토크를 만들어야 했던 영향을 제거하고 순전히 target position과의 오차를 줄이기 위한 토크를 낼 수 있습니다.


## result



![](/assets/img/posts/unitree/sim2real/unitree-go2-part-4-feed-forward-torque/32ccbb7d-7937-8055-bcb2-d4b130bc0615.gif)

![](/assets/img/posts/unitree/sim2real/unitree-go2-part-4-feed-forward-torque/32ccbb7d-7937-806e-b45a-c57277e4fd76.gif)



## Problem..

1. 걷는 와중에 calf joint가 거의 끝까지 올라가는 것을 확인할 수 있었습니다.. 너무 발을 질질 끄는 것에 패널티를 주었더니 이렇게 된 것 같습니다.
   ![](/assets/img/posts/unitree/sim2real/unitree-go2-part-4-feed-forward-torque/32ccbb7d-7937-80f9-b95a-ea56c2f37440.webp)


1. 앞으로 이동시에 base의 몸통이 매우 기울어진채로 이동하게 됩니다. 또한 대각선의 발이 동시에 움직여져야 하는데 같은 쪽의 발이 들리며 불안정한 보행을 보입니다.
   ![](/assets/img/posts/unitree/sim2real/unitree-go2-part-4-feed-forward-torque/32ccbb7d-7937-8004-8255-e26c28432d98.webp)
1. mujoco상에서 go2가 움직일때 발을 통통 거리며 걷는 것을 확인하였습니다. 이러한 현상이 현실의 시뮬레이터로 넘어오며 과격해진 것으로 추정중입니다.
