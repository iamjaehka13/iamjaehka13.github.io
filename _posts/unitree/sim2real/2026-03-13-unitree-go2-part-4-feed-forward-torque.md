---
title: "[Unitree Go2 part 4] Feed-forward Torque 실험"
date: 2026-03-13 19:14:00 +0900
last_modified_at: 2026-03-24 00:00:13 +0900
categories: [Unitree, Sim2Real]
tags: [unitree-go2, sim2real, reinforcement-learning, isaac-sim, deployment]
description: 실제 Go2 deploy에서 부족해 보였던 torque margin을 확인하기 위해 gravity compensation 기반 feed-forward torque를 적용한 실험을 정리한다.
image: /assets/img/posts/unitree/sim2real/unitree-go2-part-4-feed-forward-torque/32ccbb7d-7937-8055-bcb2-d4b130bc0615.gif
math: true
---

## **1. 현재 상황**

이전 글에서는 Go2가 command에 따라 base를 기울이기는 하지만, 실제로 발을 충분히 떼지 못하는 문제를 확인했습니다. 뒷다리 stiffness를 높였을 때 로봇이 움직이기 시작한 것을 보면, 단순한 reward 문제뿐 아니라 실제 actuator가 만들어내는 torque margin도 원인 후보로 보였습니다.

이번 글에서는 그 가설을 확인하기 위해 feed-forward torque를 적용해보았습니다.

관찰한 내용은 다음과 같았습니다.

- Go2에 command를 줘도 발을 떼지 못하고 base만 command 방향으로 기울었습니다.
- 뒷다리 torque가 앞다리에 비해 약해 보였습니다.
- 뒷다리 stiffness를 높이자 움직임은 생겼지만, gait가 뻣뻣하고 불안정했습니다.

Policy가 출력하는 target position을 PD controller가 충분히 따라가지 못하고 있을 가능성이 있었습니다.

## **2. 실험 아이디어**

`/lowstate`에서 읽은 현재 joint position과 `/lowcmd`로 넣는 target joint position을 비교했을 때, 약 `0.2 rad` 정도의 error가 발생하는 것을 확인했습니다.

이 error가 충분한 torque로 이어지지 못하면, hip이나 thigh는 base를 기울일 정도로 움직이지만 calf joint가 발을 들어 올릴 만큼 힘을 내지 못할 수 있습니다. 특히 Go2는 대각선 발을 번갈아 드는 gait를 만들어야 하는데, 뒷발 torque가 부족하면 swing motion이 깨집니다.

그래서 중력 보상 torque를 feed-forward로 추가해보기로 했습니다.

## **3. Gravity Compensation 적용**

중력의 영향으로 각 관절이 버텨야 하는 torque를 계산하고, 이를 policy action으로부터 만들어지는 PD torque에 더해주는 방식입니다.

Isaac Lab simulation에서는 gravity compensation force를 계산할 수 있는 API가 있습니다. 학습 단계에서는 `get_gravity_compensation_forces`를 사용했습니다.

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

deploy 단계에서는 Go2 URDF에서 각 link의 mass 정보를 가져오고, `joint_pos`와 base quaternion(IMU)을 입력으로 각 motor에 필요한 $\tau_{ff}$를 계산하는 구조를 사용했습니다.

$$
\tau_{\text{computed}} = k_p(q_{\text{des}} - q) + k_d(\dot{q}_{\text{des}} - \dot{q}) + \tau_{\text{ff}}
$$

이 방식의 목적은 policy가 서 있기 위한 torque를 만들려고 target position을 과하게 틀지 않도록 하는 것입니다. 중력에 저항하는 torque가 먼저 들어가면, policy가 더 자연스러운 발 궤적을 출력할 수 있을 것으로 기대했습니다.


## **4. 결과**



![](/assets/img/posts/unitree/sim2real/unitree-go2-part-4-feed-forward-torque/32ccbb7d-7937-8055-bcb2-d4b130bc0615.gif)

![](/assets/img/posts/unitree/sim2real/unitree-go2-part-4-feed-forward-torque/32ccbb7d-7937-806e-b45a-c57277e4fd76.gif)

feed-forward torque를 적용하자, 이전보다 로봇이 실제로 움직이기 시작했습니다. 이 결과는 torque margin 문제가 존재한다는 가설을 뒷받침했습니다.

하지만 동시에 새로운 문제가 드러났습니다. 움직임이 자연스럽게 안정화되기보다는, 일부 joint가 과하게 접히고 base 자세도 불안정했습니다.

## **5. 남은 문제**

1. 걷는 동안 calf joint가 거의 끝까지 올라가는 것을 확인했습니다. 발을 끄는 동작에 penalty를 강하게 주면서, policy가 발을 과하게 드는 쪽으로 보상을 최적화했을 가능성이 있습니다.
   ![](/assets/img/posts/unitree/sim2real/unitree-go2-part-4-feed-forward-torque/32ccbb7d-7937-80f9-b95a-ea56c2f37440.webp)


1. 앞으로 이동할 때 base가 크게 기울어진 채 움직였습니다. 또한 대각선 발이 번갈아 움직여야 하는데, 같은 쪽 발이 같이 들리는 불안정한 gait가 나타났습니다.
   ![](/assets/img/posts/unitree/sim2real/unitree-go2-part-4-feed-forward-torque/32ccbb7d-7937-8004-8255-e26c28432d98.webp)
1. MuJoCo에서도 Go2가 발을 통통 튀기며 걷는 경향이 있었습니다. 이 현상이 real robot으로 넘어오면서 더 과격하게 드러난 것으로 추정했습니다.

## **6. 정리**

feed-forward torque는 real deploy에서 부족했던 torque margin을 확인하는 데 도움이 되었습니다. 다만 최종 해결책이라고 보기는 어려웠습니다.

deploy에서만 추가 torque를 넣으면, training에서 policy가 본 actuator model과 실제 deploy actuator model이 달라집니다. 문제를 줄이는 동시에 새로운 Sim2Real gap을 만들 수 있습니다.

다음 단계에서는 deploy controller를 복잡하게 만드는 대신, training 단계에서 real-world variation을 반영하는 방향을 더 강하게 고려해야 합니다.
