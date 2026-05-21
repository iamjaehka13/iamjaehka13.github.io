---
title: "[Unitree Go2 part 5] Sim2Real 성공"
date: 2026-05-21 21:11:00 +0900
categories: [Unitree, Sim2Real]
tags: [unitree-go2, sim2real, reinforcement-learning, isaac-lab, deployment, domain-randomization]
description: Unitree Go2에 강화학습 policy를 실제 deploy하여 보행에 성공한 과정과, 최종적으로 중요했던 Domain Randomization과 deploy 정합성을 정리한다.
image: /assets/img/posts/unitree/sim2real/unitree-go2-part-5-sim2real-success/success-turn-preview.jpg
math: true
---

## **1. 현재 상황**

이번 글에서는 Unitree Go2에 강화학습 policy를 실제 deploy하여 보행에 성공한 과정을 정리합니다.

이전 글들에서는 simulation에서는 걷는 policy가 실제 로봇에서는 발을 제대로 떼지 못하거나, command 방향으로 base만 기울이는 문제를 다뤘습니다. 중간 과정에서는 reward 수정, stiffness 증가, feed-forward torque 등을 시도했습니다.

최종적으로 성공한 방향은 높은 stiffness나 feed-forward torque에 의존하는 방식이 아니었습니다. 최종 deploy는 낮은 PD gain을 유지하고, training 단계에서 적절한 **Domain Randomization**을 적용하는 방향이었습니다.

```text
Kp = 20
Kd = 0.5
+ Domain Randomization
```

정확한 reward weight와 DR range는 공개하지 않습니다. 이 글에서는 수치 자체보다, 어떤 문제를 보고 어떤 방향으로 수정했는지에 집중합니다.

![실제 Unitree Go2 전진 보행 성공](/assets/img/posts/unitree/sim2real/unitree-go2-part-5-sim2real-success/success-walk.gif)

## **2. 이전까지의 실패 모드**

초기 모델은 simulation에서는 정상적으로 걷는 것처럼 보였지만, 실제 로봇에서는 다음 문제가 반복되었습니다.

- command 입력 시 발을 제대로 들지 못함
- base가 command 방향으로 기울기만 함
- 뒷다리 torque가 부족해 보임
- stiffness를 높이면 움직이지만 gait가 과격해짐
- feed-forward torque를 넣으면 움직이기 시작하지만 동작이 불안정함

초기에는 reward 문제로 접근했습니다. `feet_air_time`, `feet_clearance`, `feet_slide` 등을 조정하며 발을 더 들도록 유도했습니다.

이 방식은 simulation에서는 효과가 있었습니다. 하지만 real robot에서는 여전히 충분하지 않았습니다. 문제는 reward 하나로 설명되지 않았습니다.

결국 핵심은 다음에 가까웠습니다.

> policy가 학습한 MDP와 real robot이 실제로 겪는 MDP가 달랐다.

## **3. Kp를 올리는 방식의 한계**

한때는 real robot에서 torque margin이 부족하다고 보고 stiffness를 높이는 방향을 시도했습니다.

Kp를 높이면 실제로 로봇이 더 강하게 움직입니다. 하지만 이 방식은 문제를 해결한다기보다 일부 실패 모드를 가리는 효과가 컸습니다.

높은 Kp에서는 policy가 부정확한 target을 출력해도 joint가 강제로 끌려갑니다. 이 경우 다음 문제가 생겼습니다.

- calf joint가 과하게 접힘
- base pitch/roll이 커짐
- gait가 과격해짐
- torque saturation 가능성이 커짐
- policy가 실제로 안정적인 target trajectory를 만든 것인지 판단하기 어려움

최종 모델은 낮은 gain에서도 실제 로봇이 걸었습니다.

이 점이 중요합니다. 단순히 제어기를 강하게 만들어 움직인 것이 아니라, policy가 real actuator가 따라갈 수 있는 범위의 action을 출력한 것입니다.

## **4. Feed-forward Torque 실험의 의미**

이전 글에서는 gravity compensation 기반 feed-forward torque를 시도했습니다.

$$
\tau = K_p(q_{\mathrm{des}} - q) + K_d(\dot{q}_{\mathrm{des}} - \dot{q}) + \tau_{\mathrm{ff}}
$$

이 실험은 문제 분석에는 도움이 되었습니다. 특히 real robot에서 필요한 torque margin, actuator response, PD target tracking 문제가 있다는 것을 확인할 수 있었습니다.

하지만 최종 해결책은 feed-forward torque를 크게 넣는 것이 아니었습니다.

Real deploy에서만 추가 torque를 넣으면, policy가 training에서 본 actuator model과 실제 deploy actuator model이 달라집니다. 그러면 policy가 학습한 transition과 real transition이 다시 달라질 수 있습니다.

따라서 feed-forward torque는 최종 해답이라기보다 디버깅 도구에 가까웠습니다.

최종 방향은 deploy controller를 단순하게 유지하고, training 단계에서 real uncertainty를 반영하는 것이었습니다.

## **5. 최종 방향: Domain Randomization**

최종 성공에서 핵심은 Domain Randomization이었습니다.

DR은 특별한 trick이라기보다, simulation에 빠져 있는 real-world variation을 넣는 과정입니다. 실제 로봇에서는 다음 요소들이 고정되어 있지 않습니다.

- contact friction
- motor strength
- actuator delay
- sensor noise
- initial pose
- base mass / center of mass
- joint tracking error

항상 같은 friction, 같은 actuator response, 같은 delay, 같은 initial pose에서만 학습한 policy는 real robot에서 쉽게 깨집니다.

최종 학습에서는 contact, actuator, sensor, initial state 쪽의 variation을 넣었습니다. 정확한 range는 공개하지 않지만, 기준은 단순했습니다.

> real robot에서 실제로 달라질 수 있는 요소를 simulation에 넣는다.

DR을 크게 넣는 것이 항상 좋은 것은 아닙니다.

너무 강하면 학습이 어려워지고, 너무 약하면 real gap을 커버하지 못합니다. 따라서 policy가 학습 가능한 범위 안에서 real variation을 반영하는 것이 중요했습니다.

## **6. MDP 관점에서 본 Sim2Real**

이번 과정에서 MDP 관점이 실제 deploy 문제와 직접 연결된다는 것을 다시 확인했습니다.

강화학습에서는 policy가 현재 state 또는 observation을 보고 action을 선택합니다.

```text
s_t -> a_t -> s_{t+1}
```

로봇 보행에서도 마찬가지입니다. 현재 observation은 단순한 순간값이 아니라, 이전 action과 contact, actuator delay, joint tracking 결과가 반영된 상태입니다.

예를 들어 다음 값들은 모두 과거 동작의 결과를 포함합니다.

- joint position
- joint velocity
- base angular velocity
- projected gravity
- previous action
- gait phase

즉, policy는 전체 history를 직접 보지 않더라도 현재 observation을 통해 필요한 정보를 일부 요약해서 받습니다.

문제는 simulation과 real에서 transition이 다르다는 점입니다.

```text
simulation: s_t + a_t -> s_{t+1}^{sim}
real:       s_t + a_t -> s_{t+1}^{real}
```

같은 state와 action이라도 friction, actuator delay, motor strength, mass distribution이 다르면 다음 state가 달라집니다. 이 차이가 누적되면 simulation에서 안정적인 policy도 real에서는 실패합니다.

Domain Randomization은 이 transition mismatch를 줄이기 위한 방법입니다. 정확히는 하나의 simulation MDP에 overfit하지 않도록, 여러 dynamics variation을 학습 중에 노출시키는 방식입니다.

## **7. Deploy Repository 구조**

실제 deploy에는 별도의 runtime repository를 사용했습니다.

```text
configs/
  go2_deploy_baseline_teleop.yaml
policies/
  go2_deploy_baseline_policy.pt
scripts/
  deploy_mujoco.py
  sim_to_real.py
```

실제 robot deploy는 `scripts/sim_to_real.py`를 사용했습니다.

전체 흐름은 다음과 같습니다.

1. Unitree SDK2로 `/lowstate` 수신
2. SDK joint order를 policy joint order로 변환
3. observation 구성
4. TorchScript policy inference
5. action을 target joint position으로 변환
6. `/lowcmd`로 PD target publish

구조는 최대한 단순하게 유지했습니다.

## **8. Observation 구성**

Deploy observation은 training observation과 의미가 맞도록 구성했습니다.

```text
base angular velocity
projected gravity
velocity command
joint position relative to default pose
joint velocity
last action
sin/cos gait phase
```

여기서 중요한 항목은 `last_action`입니다.

이전에는 deploy 과정에서 `last_action`에 raw policy output이 아니라, scale과 offset이 적용된 target joint position에 가까운 값이 들어가는 문제가 있었습니다. 이 경우 policy가 training 때와 다른 observation을 받게 됩니다.

최종 deploy에서는 다음 구조를 유지했습니다.

```python
obs[33:45] = last_action
```

여기서 `last_action`은 policy가 출력한 raw action입니다. 실제 motor command를 만들 때만 action scale을 적용합니다.

```python
target_pos = default_joint_pos + action_scale * action
```

즉, policy input으로 들어가는 action history와 실제 joint target은 구분해야 합니다.

## **9. Joint Order 정합성**

Policy joint order와 Unitree SDK joint order는 다릅니다. 따라서 deploy 중 index mapping이 필요합니다.

```python
POLICY_TO_SDK_INDEX = [3, 4, 5, 0, 1, 2, 9, 10, 11, 6, 7, 8]
```

이 부분이 틀리면 policy가 의도한 다리와 실제 command가 들어가는 다리가 달라집니다.

Sim2Real 정합성은 물리 파라미터만의 문제가 아닙니다.

- joint order
- action scale
- default pose
- observation normalization
- quaternion convention
- control frequency
- action delay

이런 값들이 모두 transition에 영향을 줍니다.

## **10. Action to Target Position**

최종 deploy에서는 policy action을 target joint position으로 변환합니다.

```python
target_pos_policy = default_joint_pos + applied_action * action_scale
```

이후 각 joint에 대해 PD target을 보냅니다.

```text
q   = target_pos
kp  = Kp
kd  = Kd
tau = 0
```

즉, 최종 deploy는 복잡한 torque controller가 아니라, policy가 출력한 joint target을 PD controller로 추종하는 구조입니다.

중요한 점은 deploy loop를 training 때의 구조와 최대한 맞추는 것입니다. Deploy에서만 추가적인 보정이나 복잡한 controller를 넣으면, 그 자체가 새로운 sim-to-real gap이 될 수 있습니다.

## **11. 결과**

최종 policy는 실제 Unitree Go2에서 전진 command에 대해 안정적으로 보행했습니다.

![실제 Unitree Go2 command 반응 성공](/assets/img/posts/unitree/sim2real/unitree-go2-part-5-sim2real-success/success-turn.gif)

이전 시도와 비교하면 다음과 같습니다.

| 구분 | 이전 시도 | 최종 모델 |
| --- | --- | --- |
| 제어 방향 | stiffness 증가, feed-forward torque 시도 | 낮은 gain + DR |
| 발 들기 | 실패하거나 과격함 | 안정적인 swing motion |
| base 자세 | command 방향으로 기울어짐 | 비교적 안정적 |
| real 반응성 | 특정 조건에서만 움직임 | command에 반응 |
| 핵심 문제 인식 | reward 또는 torque 부족 | transition mismatch |

중요한 것은 단순히 로봇이 움직였다는 점이 아닙니다.

낮은 gain에서도 policy가 실제 로봇이 따라갈 수 있는 target trajectory를 출력했다는 점이 핵심입니다.

## **12. 정리**

이번 Sim2Real 과정에서 확인한 내용은 다음과 같습니다.

1. Reward만 수정해서 해결되는 문제가 아니었습니다.
2. Kp를 높이면 일부 실패 모드는 가려지지만, 안정적인 해결책은 아니었습니다.
3. Feed-forward torque는 원인 분석에는 도움이 되었지만, 최종 해결책은 아니었습니다.
4. 최종적으로는 낮은 gain과 적절한 Domain Randomization이 중요했습니다.
5. Deploy observation, action scale, joint order 같은 정합성이 매우 중요했습니다.
6. Sim2Real 문제는 결국 transition mismatch 문제로 볼 수 있습니다.

결국 핵심은 다음입니다.

> real에서 더 강하게 제어하는 것이 아니라, sim에서 real variation을 견딜 수 있게 학습시키는 것.

이번 성공은 특정 reward weight 하나나 magic number 하나로 만들어진 결과가 아닙니다. Real robot에서 달라질 수 있는 요소들을 simulation에 넣고, deploy에서는 policy가 학습한 구조를 최대한 유지한 것이 핵심이었습니다.

## **13. 다음 목표**

- 더 낮은 command에서의 보행 안정화
- 후진, 좌우, yaw command 테스트
- 장시간 보행 테스트
- 다양한 바닥 조건 테스트
- actuator / thermal 관점에서 장시간 안정성 분석
- terrain 환경에서 Sim2Real 확장
