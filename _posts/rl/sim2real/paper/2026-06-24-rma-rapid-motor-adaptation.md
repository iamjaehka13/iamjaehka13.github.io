---
title: "[Sim2Real Paper 7] Rapid Motor Adaptation"
date: 2026-06-24 17:35:00 +0900
categories: [RL, Sim2Real, Paper]
tags: [sim2real, rapid-motor-adaptation, rma, quadruped-locomotion, online-adaptation]
description: Kumar et al.의 RMA 논문을 통해 terrain, payload, actuator 상태 변화에 online으로 적응하는 Sim2Real locomotion 구조를 정리한다.
math: true
---

## **0. 전체 그림: Robust Policy에서 Adaptive Policy로**

6편에서는 Lee et al.의 rough terrain locomotion을 봤습니다.

거기서 핵심은 proprioceptive history였습니다. Robot은 terrain을 직접 보지 않아도, joint와 body의 시간 흐름을 통해 contact, slip, terrain 상태를 어느 정도 추론할 수 있었습니다.

Kumar et al.의 **RMA: Rapid Motor Adaptation for Legged Robots**는 이 흐름을 더 명시적인 구조로 만듭니다.

핵심은 다음입니다.

> Robot이 현재 어떤 environment dynamics 안에 있는지 online으로 추정하고, policy가 그 추정값을 사용해 즉시 행동을 바꾸게 한다.

Domain randomization은 policy를 다양한 환경에 robust하게 만듭니다.

하지만 policy에게 현재 환경이 어떤지 알려주지 않으면, policy는 모든 경우에 평균적으로 안전한 행동을 선택할 수밖에 없습니다. 이러면 gait가 보수적이거나 특정 조건에서 성능이 떨어질 수 있습니다.

RMA는 이 문제를 다음처럼 나눕니다.

| 역할 | 질문 |
|---|---|
| base policy | 현재 state와 extrinsics가 주어졌을 때 어떻게 걸을 것인가? |
| adaptation module | 최근 state-action history를 보면 지금 extrinsics가 무엇인가? |

여기서 extrinsics는 terrain friction, payload, motor strength, terrain height처럼 locomotion dynamics를 바꾸는 hidden factor를 policy가 사용하기 좋은 latent vector로 압축한 것입니다.

## **1. 논문 정보**

| 항목 | 내용 |
|---|---|
| Title | RMA: Rapid Motor Adaptation for Legged Robots |
| Authors | Ashish Kumar, Zipeng Fu, Deepak Pathak, Jitendra Malik |
| Year | 2021 |
| Venue | Robotics: Science and Systems 2021 |
| Robot | Unitree A1 |
| Simulator | RaiSim |
| RL algorithm | PPO |
| Key idea | base policy + environment factor encoder + adaptation module |
| Transfer | simulation training, real A1 deployment without fine-tuning |
| Adaptation target | friction, payload, motor strength, terrain height, changing dynamics |
| Source | [arXiv](https://arxiv.org/abs/2107.04034), [Project](https://ashish-kmr.github.io/rma-legged-robots/), [Supplementary](https://ashish-kmr.github.io/rma-legged-robots/rma-locomotion-supplementary.pdf) |

이 논문은 legged locomotion에서 online adaptation을 이해할 때 대표적으로 보는 논문입니다.

특히 중요한 점은 RMA가 real robot에서 추가 fine-tuning을 하지 않는다는 것입니다.

Base policy와 adaptation module은 모두 simulation에서 학습되고, real Unitree A1에 그대로 deploy됩니다.

## **2. 핵심 아이디어: Extrinsics를 Online으로 추정하기**

RMA는 세 개의 중요한 함수를 둡니다.

| Symbol | 이름 | 역할 |
|---|---|---|
| $\mu$ | environment factor encoder | privileged environment vector $e_t$를 latent extrinsics $z_t$로 변환 |
| $\pi$ | base policy | state, previous action, extrinsics를 보고 action 출력 |
| $\phi$ | adaptation module | recent state-action history로 extrinsics $\hat{z}_t$ 추정 |

Simulation에서는 privileged environment vector $e_t$를 알 수 있습니다.

예를 들어 friction, payload, motor strength, terrain height 같은 값입니다.

Environment factor encoder는 이를 low-dimensional extrinsics vector로 바꿉니다.

$$
z_t
=
\mu(e_t)
$$

Base policy는 현재 state $x_t$, 이전 action $a_{t-1}$, extrinsics $z_t$를 보고 다음 desired joint position을 출력합니다.

$$
a_t
=
\pi(x_t, a_{t-1}, z_t)
$$

하지만 real robot에서는 $e_t$를 직접 알 수 없습니다.

그래서 adaptation module이 최근 state-action history를 보고 $\hat{z}_t$를 추정합니다.

$$
\hat{z}_t
=
\phi(x_{t-k:t-1}, a_{t-k:t-1})
$$

Deployment에서는 $z_t$ 대신 $\hat{z}_t$가 base policy에 들어갑니다.

$$
a_t
=
\pi(x_t, a_{t-1}, \hat{z}_t)
$$

이 구조가 RMA의 핵심입니다.

Policy가 모든 dynamics를 하나로 평균내서 버티는 것이 아니라, 현재 dynamics에 대한 추정값을 받아서 행동을 조절합니다.

## **3. 핵심 아이디어의 이론적 원리**

RMA의 이론적 핵심은 domain randomization과 system identification 사이에 있습니다.

다양한 환경을 simulation에서 randomize하지만, deployment에서는 그 환경이 현재 어떤 것인지 online으로 추정합니다. 다만 exact physical parameter를 복원하려 하지 않고, policy가 필요로 하는 latent extrinsics를 추정합니다.

### **3.1 Domain randomization은 robust하지만 context를 모른다**

기본적인 domain randomization은 다음 objective를 학습합니다.

$$
\max_{\pi}
\mathbb{E}_{e \sim p(e)}
\left[
J(\pi; \mathcal{M}_e)
\right]
$$

여기서 $e$는 friction, mass, motor strength, terrain parameter 같은 environment factor입니다.

이 방식은 여러 환경에서 평균적으로 잘하는 policy를 만들 수 있습니다.

하지만 policy input에 $e$가 없으면, policy는 현재 환경이 slippery surface인지, payload가 올라간 상태인지, motor strength가 약해진 상태인지 알 수 없습니다.

즉 policy는 다음 형태입니다.

$$
a_t
=
\pi(x_t)
$$

이 policy는 모든 $e$에 대해 하나의 행동 mapping을 공유해야 합니다.

RMA는 이를 conditional policy로 바꿉니다.

$$
a_t
=
\pi(x_t, a_{t-1}, z_t)
$$

$z_t$가 현재 environment context를 알려주기 때문에, 같은 state라도 다른 environment에서는 다른 action을 낼 수 있습니다.

### **3.2 Extrinsics는 exact parameter가 아니라 behavior-relevant latent다**

RMA에서 중요한 개념은 extrinsics vector입니다.

Simulation에서 environment vector는 다음처럼 볼 수 있습니다.

$$
e_t
\in
\mathbb{R}^{17}
$$

논문에서는 $e_t$에 payload mass와 위치, motor strength, friction, local terrain height 같은 요소가 들어갑니다.

Environment factor encoder는 이를 더 작은 latent로 압축합니다.

$$
z_t
=
\mu(e_t),
\quad
z_t \in \mathbb{R}^{8}
$$

여기서 중요한 점은 $z_t$가 물리 parameter의 정확한 복사본이 아니라는 것입니다.

서로 다른 physical parameter 조합이 policy 입장에서는 비슷한 행동 변화를 요구할 수 있습니다. 예를 들어 낮은 friction과 약한 motor strength는 둘 다 foot slip이나 추진력 부족으로 나타날 수 있습니다.

따라서 exact system identification은 어려울 뿐 아니라, 꼭 필요하지도 않습니다.

RMA가 필요한 것은 다음입니다.

> 물리적으로 정확한 parameter가 아니라, base policy가 올바른 action을 선택하는 데 필요한 latent context.

이 점이 RMA를 classical system identification과 구분합니다.

### **3.3 Phase 1은 privileged extrinsics를 조건으로 base policy를 학습한다**

첫 번째 training phase에서는 base policy $\pi$와 environment factor encoder $\mu$를 같이 학습합니다.

Simulation에서는 $e_t$를 알 수 있으므로 다음처럼 학습할 수 있습니다.

$$
z_t
=
\mu(e_t)
$$

$$
a_t
=
\pi(x_t, a_{t-1}, z_t)
$$

그리고 PPO로 expected return을 최대화합니다.

$$
J(\pi)
=
\mathbb{E}_{\tau \sim p(\tau|\pi)}
\left[
\sum_{t=0}^{T-1}
\gamma^t r_t
\right]
$$

이 단계의 의미는 다음입니다.

> 환경 정보가 주어진다면 어떻게 걷는 것이 좋은가를 먼저 학습한다.

즉 base policy는 adaptation을 직접 배우는 것이 아니라, extrinsics가 주어졌을 때 다양한 dynamics에서 잘 걷는 conditional controller가 됩니다.

Action은 12개 joint의 desired joint position입니다.

$$
a_t
\equiv
\hat{q}_t
$$

이 target은 fixed-gain PD controller를 통해 torque로 변환됩니다.

$$
\tau
=
K_p(\hat{q} - q)
+
K_d(\hat{\dot{q}} - \dot{q})
$$

논문은 predefined foot trajectory generator나 reference demonstration을 쓰지 않고, bioenergetics-inspired reward와 varied terrain generator로 gait를 학습합니다.

### **3.4 Phase 2는 history에서 extrinsics를 예측하는 adaptation module을 학습한다**

두 번째 phase에서는 $\pi$와 $\mu$를 고정하고 adaptation module $\phi$를 학습합니다.

Real robot에서는 $e_t$를 알 수 없으므로 $\mu(e_t)$를 직접 계산할 수 없습니다.

대신 $\phi$가 최근 state-action history를 보고 $\hat{z}_t$를 예측합니다.

$$
\hat{z}_t
=
\phi(x_{t-k:t}, a_{t-k-1:t-1})
$$

논문에서는 $k=50$을 사용하며, 이는 100Hz control 기준 약 0.5초 history에 해당합니다.

학습 target은 simulation에서 계산한 $z_t = \mu(e_t)$입니다.

Loss는 다음입니다.

$$
\mathcal{L}_{\phi}
=
\left\|
\hat{z}_t - z_t
\right\|^2
$$

이때 중요한 점은 data를 expert trajectory에서만 모으지 않는다는 것입니다.

Adaptation module이 틀린 $\hat{z}_t$를 내면, base policy가 imperfect한 action을 내고, state distribution이 바뀝니다. Deployment에서도 이런 일이 생길 수 있습니다.

그래서 논문은 on-policy data로 $\phi$를 학습합니다.

```text
current adaptation module predicts z_hat
-> base policy acts using z_hat
-> simulation produces next state
-> true z = mu(e) is known in simulation
-> train phi so z_hat matches z
```

이 구조는 DAgger와 비슷한 효과를 냅니다.

Adaptation module이 실제로 만들 수 있는 error가 포함된 state distribution에서 학습하므로, deployment에서 더 안정적입니다.

### **3.5 Adaptation은 latent-space online system identification이다**

RMA의 adaptation module은 system identification과 비슷합니다.

하지만 일반적인 system identification처럼 mass, friction, motor strength를 정확히 출력하는 것이 아닙니다.

비교하면 다음과 같습니다.

| 방법 | 추정 대상 | 목적 |
|---|---|---|
| classical system ID | physical parameter $\hat{e}_t$ | model을 정확히 맞춤 |
| RMA adaptation | latent extrinsics $\hat{z}_t$ | policy가 올바른 action을 내게 함 |

이는 중요한 차이입니다.

실제로 여러 physical parameter가 서로 공변하면, history만 보고 정확히 분리하기 어려울 수 있습니다. 하지만 policy가 필요한 것은 parameter 이름이 아니라 행동 조정 방향입니다.

예를 들어 다음과 같은 history가 있다고 합시다.

```text
commanded forward motion
-> foot slips
-> base velocity does not increase
-> joint torques and contact pattern change
```

이 history에서 adaptation module은 "friction coefficient가 정확히 0.23이다"를 맞출 필요는 없습니다.

Base policy가 미끄러운 지형에 맞는 보수적인 foot placement와 torque pattern을 내도록 만드는 $\hat{z}_t$를 내면 됩니다.

따라서 RMA의 adaptation은 다음처럼 이해할 수 있습니다.

> 최근 trajectory로부터 현재 dynamics가 policy에게 요구하는 행동 변화를 추정하는 것.

### **3.6 Asynchronous deployment는 빠른 control과 느린 context 추정을 분리한다**

Deployment에서는 base policy와 adaptation module이 서로 다른 주기로 동작합니다.

| Module | Frequency | 역할 |
|---|---:|---|
| base policy $\pi$ | 100Hz | current state와 latest extrinsics로 desired joint positions 출력 |
| adaptation module $\phi$ | 10Hz | recent state-action history로 $\hat{z}_t$ 업데이트 |
| low-level PD | robot controller | desired joint positions를 torque로 변환 |

이 구조가 중요한 이유는 extrinsics가 robot state보다 느리게 변한다고 보기 때문입니다.

Joint position과 body attitude는 100Hz로 빠르게 제어해야 합니다. 하지만 payload, friction, terrain condition 같은 context는 매 control step마다 급격히 바뀌지 않습니다.

따라서 base policy는 최신 $\hat{z}_{\mathrm{async}}$를 계속 사용합니다.

$$
a_t
=
\pi(x_t, a_{t-1}, \hat{z}_{\mathrm{async}})
$$

Adaptation module은 더 느리게 다음 값을 갱신합니다.

$$
\hat{z}_{\mathrm{async}}
\leftarrow
\phi(x_{t-k:t}, a_{t-k-1:t-1})
$$

이 asynchronous design은 A1처럼 onboard compute가 제한적인 robot에서 실용적으로 중요합니다.

### **3.7 RMA는 reference motion이나 foot trajectory generator 없이 gait를 학습한다**

앞선 6편의 Lee et al.은 PMTG 같은 motion prior를 사용했습니다.

RMA는 predefined foot trajectory generator나 reference demonstration 없이 학습한다는 점을 강조합니다.

대신 reward가 gait의 자연스러운 성질을 유도합니다.

논문은 bioenergetics-inspired reward를 사용합니다. 주요 항은 다음과 같습니다.

| Reward / penalty | 의미 |
|---|---|
| forward reward | forward progress 유도 |
| lateral / yaw penalty | 옆으로 새거나 불필요하게 회전하는 motion 억제 |
| work penalty | actuator work 감소 |
| ground impact penalty | 발 충격 감소 |
| smoothness / jerk penalty | torque 변화와 거친 motion 억제 |
| foot slip penalty | contact 중 foot sliding 억제 |
| orientation penalty | roll/pitch 안정화 |

또한 처음부터 penalty를 강하게 걸면 robot이 움직이지 않는 해를 배울 수 있습니다.

그래서 논문은 penalty coefficient를 작은 값에서 시작해 점진적으로 키우는 curriculum을 사용합니다.

이 부분은 Sim2Real에서 중요합니다.

Realistic gait는 단순히 reward를 많이 넣는다고 나오는 것이 아니라, 학습 초기에 움직임을 허용하고 이후 효율성과 안정성을 점점 요구하는 방식으로 만들어집니다.

### **3.8 Adaptation은 real terrain에서 extrinsics 변화로 관찰된다**

논문은 slippery surface와 payload 실험에서 adaptation이 실제로 일어나는 것을 분석합니다.

예를 들어 oily patch에서는 robot이 미끄러지기 시작한 뒤, adaptation module이 출력하는 $\hat{z}_t$의 일부 component가 변합니다. 이후 torque와 gait pattern이 조정되고 robot이 slippery patch를 지나갑니다.

Payload 실험에서도 5kg payload가 올라가면 robot motion이 disturbance를 받고, $\hat{z}_t$ component가 변한 뒤 torque magnitude와 gait가 payload에 맞게 회복됩니다.

이 분석의 의미는 다음입니다.

> Adaptation module은 단순한 regularizer가 아니라, real interaction history에 반응해 policy context를 바꾸는 online estimator다.

## **4. Sim2Real 관점에서의 해석**

RMA는 Sim2Real을 다음 단계로 확장합니다.

3편의 dynamics randomization은 다양한 dynamics에서 robust한 policy를 만드는 방법이었습니다.

6편의 proprioceptive locomotion은 history가 hidden terrain/contact state를 담을 수 있다는 것을 보여줬습니다.

RMA는 이 둘을 결합해 explicit adaptation structure로 만듭니다.

```text
randomize environments in simulation
-> learn conditional base policy using privileged extrinsics
-> learn adaptation module from state-action history
-> estimate extrinsics online on real robot
-> adapt actions in fractions of a second
```

Sim2Real 관점에서 중요한 포인트는 네 가지입니다.

첫째, randomization은 여전히 필요합니다.

Adaptation module이 추정할 수 있으려면, simulation에서 다양한 environment factor와 그로 인한 trajectory 변화를 많이 봐야 합니다.

둘째, current environment를 policy input으로 넣는 것이 중요합니다.

Robust policy는 모든 환경에 평균적으로 대응하지만, adaptive policy는 지금 환경에 맞게 행동을 바꿀 수 있습니다.

셋째, exact system ID가 목적이 아닙니다.

RMA는 physical parameter를 정확히 맞추기보다, behavior에 필요한 latent context를 맞춥니다.

넷째, deployment 중 추가 real-world optimization이 필요 없습니다.

RMA는 real robot에서 여러 episode를 굴려 adaptation parameter를 최적화하지 않습니다. 최근 0.5초가량의 history만으로 context를 추정합니다.

이 점이 실전적으로 큽니다.

Robot이 잘 걷지 못하는 상황에서 몇 분 동안 데이터를 모으는 것은 넘어짐과 파손 위험을 만들 수 있습니다. RMA는 이 비용을 simulation training으로 밀어 넣고, real에서는 빠르게 추정합니다.

## **5. 이 논문의 한계**

RMA도 모든 문제를 해결하지는 않습니다.

첫째, adaptation은 simulation에서 본 extrinsics structure에 의존합니다.

Training distribution에 없던 failure mode가 나오면 adaptation module이 적절한 $\hat{z}_t$를 만들지 못할 수 있습니다.

둘째, history로 구분되지 않는 factor는 추정하기 어렵습니다.

서로 다른 physical condition이 짧은 history에서 같은 trajectory response를 만들면, $\phi$가 이를 구분하기 어렵습니다. 다만 RMA는 exact parameter가 아니라 action에 필요한 latent를 추정하므로 이 문제를 일부 완화합니다.

셋째, blind locomotion의 한계가 남습니다.

RMA는 proprioception 기반 adaptation입니다. 큰 obstacle, cliff, gap처럼 미리 보고 계획해야 하는 요소는 해결하지 못합니다.

넷째, $\hat{z}_t$가 틀리면 base policy도 영향을 받습니다.

Base policy는 extrinsics-conditioned policy이기 때문에, adaptation module이 잘못된 context를 주면 부적절한 action을 낼 수 있습니다.

다섯째, reward와 simulation distribution 설계가 여전히 중요합니다.

RMA가 reference trajectory 없이 학습한다고 해도, reward term, penalty curriculum, terrain generator, randomization range를 잘 설계해야 합니다.

그래도 이 논문의 메시지는 강합니다.

> Sim2Real locomotion에서 robust policy 하나보다, 현재 dynamics를 추정해 행동을 바꾸는 adaptive policy가 더 강할 수 있다.

## **6. 정리하며: 현재 Dynamics를 추정해서 걷기**

이번 글에서는 Kumar et al.의 **RMA: Rapid Motor Adaptation for Legged Robots**를 정리했습니다.

- RMA는 base policy, environment factor encoder, adaptation module로 구성됩니다.
- Base policy는 state, previous action, extrinsics를 받아 desired joint positions를 출력합니다.
- Environment factor encoder는 privileged environment vector $e_t$를 latent extrinsics $z_t$로 바꿉니다.
- Adaptation module은 recent state-action history로 $\hat{z}_t$를 online 추정합니다.
- $\hat{z}_t$는 exact physical parameter가 아니라, policy가 행동을 바꾸는 데 필요한 behavior-relevant latent입니다.
- Base policy와 encoder는 PPO로 학습되고, adaptation module은 supervised learning으로 학습됩니다.
- Deployment에서는 base policy가 100Hz, adaptation module이 10Hz로 비동기 실행됩니다.
- Unitree A1에 fine-tuning 없이 deploy되어 slippery terrain, payload, deformable surface, grass, stairs, sand 등에서 adaptive behavior를 보입니다.

7편의 핵심은 이렇게 정리할 수 있습니다.

> Real world가 계속 바뀐다면, policy는 robust할 뿐 아니라 지금 어떤 world인지 빠르게 추정해야 한다.

다음 글에서는 이런 legged locomotion 학습을 Isaac Gym / massively parallel RL로 매우 빠르게 만드는 흐름을 보겠습니다.
