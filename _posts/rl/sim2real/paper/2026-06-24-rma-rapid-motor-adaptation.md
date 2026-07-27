---
title: "[Sim2Real Paper 7] RMA: 0.5초의 이력으로 환경에 적응하는 로봇"
date: 2026-06-24 17:35:00 +0900
last_modified_at: 2026-07-27 21:23:41 +0900
categories: [RL, Sim2Real, Paper]
tags: [sim2real, rapid-motor-adaptation, rma, quadruped-locomotion, online-adaptation, privileged-learning, domain-randomization, ppo, unitree-a1]
description: Kumar et al.의 RMA를 base policy, 17D privileged environment, 8D extrinsics, 50-step adaptation history, PPO와 on-policy supervised learning, 비동기 배포, 시뮬레이션 및 실제 A1 실험까지 원문 기준으로 분석한다.
math: true
image:
  path: /assets/img/posts/rl/sim2real/rma/00-preview.png
  alt: 잔디, 진흙, 모래, 자갈과 계단을 이동하는 Unitree A1
---

## **0. 전체 그림: 강건하게 버티는 것과 지금 환경에 맞춰 바꾸는 것은 다르다**

이전 글: [Challenging Terrain Locomotion: proprioceptive history와 privileged learning](/posts/learning-quadrupedal-locomotion-challenging-terrain/)

앞선 논문들은 dynamics randomization으로 여러 물리 조건을 경험시키고, proprioceptive history에서 보이지 않는 접촉 상태를 추론했습니다. RMA는 여기서 한 단계 더 나아가 현재 환경에 맞춰 policy input 자체를 바꿉니다.

> 마찰, payload, actuator 성능과 지형이 계속 바뀔 때, 하나의 robust policy가 모든 상황을 평균적으로 버티게 하는 것만으로 충분할까?

Kumar et al.의 **RMA: Rapid Motor Adaptation for Legged Robots**는 그렇지 않다고 봅니다.

같은 자세의 robot이라도 현재 조건이 다르면 필요한 action도 달라집니다.

| 같은 관절 자세에서의 환경 | 필요한 control response |
|---|---|
| 마른 바닥 | Nominal torque와 gait |
| 미끄러운 바닥 | Slip을 줄이고 회복하는 torque·contact pattern |
| 무거운 payload | 더 큰 지지력과 달라진 gait |

일반적인 domain-randomized policy가 환경 조건을 입력받지 않으면, 이 조건들을 하나의 policy mapping 안에서 평균내야 합니다. 반면 RMA는 현재 환경을 나타내는 **extrinsics**를 policy input으로 넣습니다.

문제는 실제 robot에서는 정확한 friction이나 payload를 바로 알 수 없다는 점입니다.

RMA는 이를 두 모듈로 나눕니다.

| Module | 질문 |
|---|---|
| Base policy $\pi$ | 현재 state와 environment context가 주어졌을 때 어떤 joint target을 낼 것인가? |
| Adaptation module $\phi$ | 최근 state-action history를 보면 지금 필요한 environment context는 무엇인가? |

Simulation에서는 mass, friction, motor strength와 terrain height를 알고 있으므로 좋은 context-conditioned policy를 먼저 학습합니다. 그다음 최근 50 step, 즉 약 0.5초의 history만 보고 그 context를 추정하는 adaptation module을 따로 학습합니다.

![여러 실제 야외 환경을 통과하는 RMA](/assets/img/posts/rl/sim2real/rma/00-preview.png){: width="1200" .d-block .mx-auto }
_같은 RMA pipeline으로 grass, vegetation, sand, mud, stairs와 construction debris를 이동한 Unitree A1. 환경별 real-world fine-tuning은 수행하지 않았다. 출처: [Kumar et al., Figure 1](https://arxiv.org/pdf/2107.04034)._

Training과 deployment의 data flow를 나누면 아래와 같습니다.

| 단계 | 입력과 학습 | 결과 |
|---|---|---|
| Phase 1 | Privileged $e_t\rightarrow\mu\rightarrow z_t$, $\pi$와 함께 PPO | Environment-conditioned base policy |
| Phase 2 | Recent history $\rightarrow\phi\rightarrow\hat z_t$, on-policy supervised MSE | Deployable adaptation module |
| Deployment | $\phi$ 10 Hz + $\pi$ 100 Hz + fixed-gain PD | Latest $\hat z_t$에 조건화된 joint target |

RMA는 physical parameter를 정확히 복원하는 classical system identification이 아닙니다. “Adaptation sample 0”도 sensor history를 쓰지 않는다는 뜻이 아니라 별도의 test-time optimization rollout이 없다는 의미입니다. 따라서 latent component가 변해도 각 component를 friction이나 mass에 바로 대응시킬 수는 없습니다.

---

## **1. 논문 정보**

| 항목 | 내용 |
|---|---|
| Title | RMA: Rapid Motor Adaptation for Legged Robots |
| Authors | Ashish Kumar, Zipeng Fu, Deepak Pathak, Jitendra Malik |
| Venue | Robotics: Science and Systems, 2021 |
| Robot | Unitree A1, 약 12 kg, 18 DOF 중 12 actuated DOF |
| Simulator | RaiSim |
| Base policy 학습 | PPO |
| Adaptation 학습 | On-policy trajectory를 이용한 supervised MSE |
| Policy output | 12개 desired joint angles |
| Control rate | Base policy 100 Hz, adaptation module 10 Hz |
| Main idea | Privileged environment를 latent로 압축한 뒤 recent history에서 그 latent를 online 추정 |
| Transfer | Simulation에서 모두 학습하고 실제 A1에 fine-tuning 없이 배포 |
| Source | [arXiv](https://arxiv.org/abs/2107.04034), [PDF](https://arxiv.org/pdf/2107.04034), [Official project](https://ashish-kmr.github.io/rma-legged-robots/) |

이 논문의 제목에서 **Rapid**는 단순히 network inference가 빠르다는 뜻이 아닙니다.

기존 adaptation 방법 중에는 새로운 환경에서 여러 rollout을 수집한 뒤 latent나 policy를 다시 최적화하는 방식이 있었습니다. 논문이 비교한 AWR 계열은 5~10초짜리 50 episode, 총 4~8분의 데이터를 사용합니다.

RMA는 현재 한 trajectory의 최근 0.5초를 입력으로 사용하며, 저자들은 1초 미만의 적응을 목표로 합니다.

즉 차이는 다음입니다.

| 방식 | 새 환경에서 필요한 절차 |
|---|---|
| Offline test-time adaptation | 여러 rollout 수집 $\rightarrow$ parameter·latent 최적화 $\rightarrow$ policy 재실행 |
| RMA | 걷는 동안 history 갱신 $\rightarrow$ latent 추정 $\rightarrow$ 다음 action에 반영 |

실제 robot에서 adaptation을 위해 실패 rollout을 반복하지 않아도 된다는 점이 안전과 하드웨어 비용 측면에서 중요합니다.

---

## **2. 왜 Domain Randomization만으로는 부족할 수 있는가**

### **2.1 Robust policy는 현재 environment를 직접 알지 못한다**

환경 parameter를 $e$라고 합시다.

일반적인 domain randomization은 여러 환경에서 평균 return을 높입니다.

$$
\max_{\pi}
\mathbb{E}_{e \sim p_{\text{train}}(e)}
\left[
J(\pi;\mathcal{M}_e)
\right]
$$

Policy가 $e$를 입력받지 않는 경우 action은

$$
a_t = \pi(x_t)
$$

같은 $x_t$에서 friction이 달라도, payload가 달라도 policy input은 같습니다. Policy는 현재 조건을 명시적으로 구분하지 못한 채 여러 조건에서 평균적으로 괜찮은 action을 찾아야 합니다.

이것이 반드시 실패한다는 뜻은 아닙니다. State history 자체에 환경 반응이 드러난다면 recurrent policy가 암묵적으로 적응할 수도 있습니다.

다만 RMA는 빠르게 변하는 robot state와 천천히 변하는 environment context를 구조적으로 분리합니다.

$$
a_t
=
\pi(x_t,a_{t-1},z_t)
$$

$z_t$가 다르면 같은 robot state에서도 다른 action을 낼 수 있습니다.

### **2.2 RMA의 비교 대상은 단순한 nominal policy가 아니다**

논문의 **Robust** baseline도 training range 전체에서 dynamics randomization을 받습니다. 차이는 latent $z_t$를 policy에 제공하지 않는다는 점입니다.

따라서 RMA와 Robust의 비교는 다음 질문에 가깝습니다.

> 같은 randomization을 경험하더라도 현재 environment context를 추정해 조건부로 행동하는 것이 더 유리한가?

Simulation 결과에서 RMA의 success rate는 73.5%, Robust는 62.4%였습니다. 이 차이는 randomization을 없앤 효과가 아니라 **randomization에 online context inference를 추가한 효과**로 읽어야 합니다.

### **2.3 평균적으로 안전한 policy가 항상 나쁜 것은 아니다**

논문은 context가 없는 robust policy가 보수적이 될 수 있다고 설명합니다. 하지만 이것을 모든 domain-randomized policy에 대한 보편적 결론으로 확대하면 안 됩니다.

성능 차이는 다음 설계에 의존합니다.

- Randomization 범위
- Observation history의 유무
- Policy capacity
- Reward가 요구하는 속도와 효율성
- 환경 parameter가 실제 trajectory에서 얼마나 식별 가능한지

RMA가 보여준 것은 해당 A1 locomotion setup에서 explicit adaptation 구조가 robust baseline보다 좋은 결과를 냈다는 것입니다.

---

## **3. RMA는 POMDP를 어떻게 나누는가**

### **3.1 실제 dynamics는 observation에 전부 들어오지 않는다**

Robot이 직접 관측하는 state를 $x_t$, 환경의 숨은 조건을 $e_t$라고 하겠습니다.

전체 dynamics는 대략 다음처럼 생각할 수 있습니다.

$$
x_{t+1}
\sim
p(x_{t+1}\mid x_t,a_t,e_t)
$$

하지만 real deployment에서는 $e_t$를 직접 얻지 못합니다.

- 현재 foot-ground friction
- 추가 payload와 그 위치
- motor strength 변화
- local terrain effect

이 변수들이 action에 대한 다음 state의 반응을 바꿉니다.

따라서 단일 $x_t$만으로는 Markov state가 충분하지 않을 수 있습니다.

### **3.2 History는 environment를 드러내는 probe다**

Environment condition은 action과 response의 차이에서 드러납니다.

Policy가 desired joint position을 보내면 environment에 따라 실제 joint velocity와 contact가 달라집니다. 그 차이가 body roll/pitch와 foot-contact pattern에 남고, adaptation module은 최근 state-action sequence에서 hidden dynamics의 흔적을 추론합니다.

RMA의 adaptation module은 다음을 계산합니다.

$$
\hat z_t
=
\phi
\left(
x_{t-k:t-1},
a_{t-k:t-1}
\right)
$$

논문에서는 $k=50$이며 policy가 100 Hz이므로 약 0.5초 이력입니다.

Adaptation module은 **state history와 action history를 함께** 봅니다.

같은 state 변화라도 어떤 action을 가한 결과인지 알아야 environment response를 해석할 수 있기 때문입니다.

### **3.3 식별 가능성에는 excitation이 필요하다**

History가 있다고 모든 parameter를 알 수 있는 것은 아닙니다.

Robot이 정지해 있으면 low friction과 high friction의 차이가 거의 드러나지 않을 수 있습니다. Payload도 충분한 가속이나 contact 변화가 있어야 response 차이가 나타납니다.

즉 adaptation에는 다음 조건이 필요합니다.

$$
\text{informative action}
\rightarrow
\text{different response under different environments}
\rightarrow
\text{identifiable latent}
$$

RMA는 별도의 active probing action을 설계하지 않습니다. 걷기 동작 자체가 environment를 드러내는 excitation 역할을 합니다.

따라서 “0.5초면 어떤 dynamics든 안다”가 아니라 다음처럼 이해해야 합니다.

> Training에서 본 변화가 최근 locomotion response에 충분히 나타난다면, 0.5초 history로 policy에 필요한 latent를 빠르게 추정할 수 있다.

---

## **4. 전체 Architecture: 17D Environment에서 8D Extrinsics로**

![RMA의 두 단계 학습과 비동기 배포 구조](/assets/img/posts/rl/sim2real/rma/02-method.png){: width="1300" .d-block .mx-auto }
_위쪽은 privileged environment로 base policy를 학습하는 Phase 1과 history로 adaptation module을 학습하는 Phase 2, 아래쪽은 100 Hz base policy와 10 Hz adaptation module의 비동기 배포다. 출처: [Kumar et al., Figure 2](https://arxiv.org/pdf/2107.04034)._

RMA에는 세 개의 함수가 등장합니다.

| Symbol | 입력 | 출력 | 학습 방법 |
|---|---|---|---|
| $\mu$ | privileged environment $e_t \in \mathbb{R}^{17}$ | extrinsics $z_t \in \mathbb{R}^{8}$ | Phase 1에서 PPO와 함께 end-to-end |
| $\pi$ | $x_t \in \mathbb{R}^{30}$, $a_{t-1}\in\mathbb{R}^{12}$, $z_t\in\mathbb{R}^{8}$ | desired joint angles $a_t\in\mathbb{R}^{12}$ | Phase 1 PPO |
| $\phi$ | 최근 50 step의 state-action history | estimated extrinsics $\hat z_t\in\mathbb{R}^{8}$ | Phase 2 supervised MSE |

### **4.1 Privileged environment vector $e_t$: 17 dimensions**

Privileged vector $e_t$는 아래 17개 요소로 구성됩니다.

| 요소 | 차원 | 의미 |
|---|---:|---|
| Payload mass와 위치 | 3 | Robot base에 추가된 질량 조건 |
| Motor strength | 12 | 각 actuated joint의 motor scaling |
| Friction | 1 | Foot-ground friction |
| Local terrain height | 1 | 네 발 아래 높이를 요약한 scalar |
| 합계 | 17 | Simulation에서만 직접 접근 |

Local terrain height는 네 발 아래 높이를 첫째 소수점까지 양자화한 뒤 그중 최대값을 사용합니다.

즉 detailed height map이 아니라 매우 압축된 scalar입니다. 저자들은 controller가 빠르고 정확한 local terrain sensing에 과도하게 의존하지 않도록 이 형태를 사용했다고 설명합니다.

### **4.2 Environment encoder $\mu$: 필요한 정보만 8D로 압축**

$$
z_t = \mu(e_t),
\qquad
e_t\in\mathbb{R}^{17},
\quad
z_t\in\mathbb{R}^{8}
$$

$\mu$는 hidden size 256, 128의 3-layer MLP입니다.

여기서 8D latent는 단순한 차원 축소 결과가 아닙니다. $\mu$와 base policy가 PPO return을 기준으로 함께 학습되므로, $z_t$에는 **locomotion action을 바꾸는 데 유용한 정보**가 남도록 압력이 걸립니다.

예를 들어 두 physical parameter 조합이 거의 같은 control response를 요구한다면, latent에서 서로 멀리 분리될 필요가 없습니다.

### **4.3 Base policy $\pi$: 총 50D 조건에서 12D action 생성**

Base policy의 입력 차원은

$$
30\;\text{state}
+
12\;\text{previous action}
+
8\;\text{extrinsics}
=
50
$$

Policy는 hidden size 128의 3-layer MLP이며 12개 target joint angle을 출력합니다.

$$
a_t
=
\pi(x_t,a_{t-1},z_t)
\in
\mathbb{R}^{12}
$$

이전 action을 넣는 것은 현재 observation만으로는 드러나지 않는 control history를 보완하고 action smoothness를 학습하는 데 도움을 줍니다.

### **4.4 Adaptation module $\phi$: temporal encoder**

Adaptation module은 각 state-action pair를 먼저 2-layer MLP로 32D embedding으로 바꿉니다.

그 후 시간축에 다음 1D CNN을 적용합니다.

| Layer | In channel | Out channel | Kernel | Stride |
|---|---:|---:|---:|---:|
| Conv 1 | 32 | 32 | 8 | 4 |
| Conv 2 | 32 | 32 | 5 | 1 |
| Conv 3 | 32 | 32 | 5 | 1 |

Flattened CNN output은 linear projection을 거쳐 8D $\hat z_t$가 됩니다.

이 구조는 raw history 전체를 base policy가 매 control step 직접 처리하게 하지 않습니다.

| 경로 | 입력 | 주기와 출력 |
|---|---|---|
| Slow temporal inference | 50-step history | $\phi\rightarrow\hat z$, 10 Hz |
| Fast feedback control | Current state + previous action + latest $\hat z$ | $\pi\rightarrow$ action, 100 Hz |

이 분리가 RMA의 계산 효율뿐 아니라 학습 문제의 역할 분리에도 중요합니다.

---

## **5. Robot State와 Action을 정확히 보기**

### **5.1 Deployable state $x_t$: 30 dimensions**

| Observation | 차원 |
|---|---:|
| Joint positions | 12 |
| Joint velocities | 12 |
| Torso roll, pitch | 2 |
| Binary foot contacts | 4 |
| 합계 | 30 |

여기에는 camera나 terrain map이 없습니다.

하지만 **foot contact sensor가 없는 것도 아닙니다**. 논문은 각 발의 contact indicator 4개를 명시적으로 사용합니다.

따라서 RMA를 “joint encoder와 IMU만 쓰는 완전한 contact-blind policy”라고 설명하면 정확하지 않습니다.

또한 base linear velocity, yaw와 full orientation을 policy state에 직접 넣지 않습니다. Reward 계산에는 simulation의 velocity와 force를 사용하지만, deployment observation과 reward-only signal은 구분해야 합니다.

### **5.2 Action은 torque가 아니라 desired joint position이다**

Policy output은 다음입니다.

$$
a_t
\equiv
\hat{\mathbf q}_t
\in
\mathbb{R}^{12}
$$

Fixed-gain PD controller가 target을 torque로 변환합니다.

$$
\boldsymbol{\tau}_t
=
K_p
\left(
\hat{\mathbf q}_t-\mathbf q_t
\right)
+
K_d
\left(
\hat{\dot{\mathbf q}}_t-\dot{\mathbf q}_t
\right)
$$

Fixed-gain PD 설정은

$$
K_p=55,
\qquad
K_d=0.8,
\qquad
\hat{\dot{\mathbf q}}_t=0
$$

즉 policy가 직접 motor torque를 출력하는 end-to-end torque policy는 아닙니다.

이 interface는 Sim2Real 관점에서 다음 역할을 합니다.

- 저수준 joint stabilization을 PD controller에 맡김
- Policy action의 의미를 target posture로 제한
- High-frequency actuator dynamics 일부를 feedback control로 흡수

반대로 고정 gain 자체가 맞지 않는 actuator나 큰 latency에서는 같은 policy 구조가 그대로 작동한다는 보장은 없습니다.

### **5.3 이 논문은 범용 velocity-command controller가 아니다**

Reward는 전방 속도를 최대 0.35 m/s까지 높이도록 설계되어 있습니다.

$$
r_{\text{forward}}
=
\min(v_x,0.35)
$$

Policy input에 $(v_x^{cmd},v_y^{cmd},\omega_z^{cmd})$ 같은 command vector가 명시되어 있지 않습니다.

따라서 이 결과를 “임의의 속도 명령을 추종하는 locomotion controller”로 해석하면 안 됩니다. 논문의 중심은 다양한 environment에서의 **forward locomotion adaptation**입니다.

---

## **6. Phase 1: Privileged Base Policy를 PPO로 학습**

### **6.1 왜 먼저 oracle context로 policy를 학습하는가**

처음부터 history와 action을 한 network에 넣고 PPO로 모두 학습할 수도 있습니다.

하지만 그러면 policy는 동시에 두 문제를 풀어야 합니다.

1. History에서 hidden environment를 추론한다.
2. 그 environment에 맞는 locomotion action을 학습한다.

RMA는 두 문제를 분리합니다.

Phase 1에서는 simulation ground truth $e_t$를 사용할 수 있으므로:

$$
z_t=\mu(e_t)
$$

$$
a_t=\pi(x_t,a_{t-1},z_t)
$$

를 구성하고 $\pi$와 $\mu$를 PPO로 공동 학습합니다.

$$
J(\pi,\mu)
=
\mathbb{E}
\left[
\sum_{t=0}^{T-1}
\gamma^t r_t
\right]
$$

이 단계가 만든 것은 “환경 정보를 알 때의 좋은 controller”입니다.

### **6.2 왜 physical parameter를 그대로 넣지 않고 encoder를 학습하는가**

$e_t$를 policy에 그대로 넣는 대신 8D latent로 압축하는 이유는 단순히 input을 줄이기 위해서만은 아닙니다.

Adaptation module의 target도 $e_t$가 아니라 $z_t$가 됩니다.

| Target | History에서 추정하는 것 |
|---|---|
| Direct SysID | Mass, friction, motor strength와 terrain height |
| RMA | Policy가 행동을 바꾸는 데 필요한 compressed context |

Physical parameter는 짧은 history에서 정확히 식별하기 어려울 수 있습니다. 반면 서로 다른 parameter 조합이 같은 행동 보정을 요구한다면 하나의 latent region으로 묶어도 locomotion에는 문제가 없습니다.

Simulation baseline에서 exact parameter $e_t$를 예측하는 SysID가 RMA보다 낮은 성능을 보인 결과는 이 설계를 지지합니다.

다만 이것이 “물리 parameter 추정은 언제나 불필요하다”는 증명은 아닙니다. 이 task와 architecture에서 behavior-relevant latent가 더 잘 작동했다는 evidence입니다.

### **6.3 PPO 설정**

논문과 supplementary의 Phase 1 설정을 표로 옮기면 아래와 같습니다.

| 항목 | 값 |
|---|---:|
| Iterations | 15,000 |
| Transitions per iteration | 80,000 |
| Mini-batches | 4 |
| Epochs per mini-batch | 4 |
| PPO ratio clip | $[0.8,1.2]$ |
| GAE $\lambda$ | 0.95 |
| Discount $\gamma$ | 0.998 |
| Adam learning rate | $5\times10^{-4}$ |
| Entropy regularization | 사용하지 않음 |
| Gaussian action std | 0.2 이상으로 제한 |
| 총 simulation steps | 약 1.2 billion |
| Training time | 1 GPU에서 약 24시간 |

Policy loss와 $0.5$배 value loss를 합쳐 학습하며, action standard deviation의 하한을 두어 exploration을 유지합니다.

PPO를 사용했다는 사실도 중요합니다.

RMA의 핵심 contribution은 새로운 RL optimizer가 아니라:

- privileged conditional policy
- behavior-relevant latent
- history-to-latent adaptation
- two-stage on-policy training
- asynchronous deployment

의 결합입니다.

---

## **7. Reward: Reference Motion 없이 Gait를 어떻게 만들었나**

RMA는 reference trajectory와 predefined foot trajectory generator를 사용하지 않는다고 강조합니다.

그렇다고 reward가 단순한 forward velocity 하나뿐인 것은 아닙니다.

### **7.1 열 개의 reward term**

Base frame의 linear velocity를 $\mathbf v$, angular velocity를 $\boldsymbol\omega$, roll/pitch를 $\boldsymbol\theta$, joint angle과 velocity를 $\mathbf q,\dot{\mathbf q}$라고 하겠습니다.

| 번호 | 항목 | 원문의 형태 | Scale |
|---:|---|---|---:|
| 1 | Forward | $\min(v_x^t,0.35)$ | 20 |
| 2 | Lateral & yaw | $-\lVert v_y^t\rVert^2-\lVert\omega_{\text{yaw}}^t\rVert^2$ | 21 |
| 3 | Work | $-\lvert\boldsymbol\tau^\top(\mathbf q^t-\mathbf q^{t-1})\rvert$ | 0.002 |
| 4 | Ground impact | $-\lVert\mathbf f^t-\mathbf f^{t-1}\rVert^2$ | 0.02 |
| 5 | Smoothness | $-\lVert\boldsymbol\tau^t-\boldsymbol\tau^{t-1}\rVert^2$ | 0.001 |
| 6 | Action magnitude | $-\lVert\mathbf a^t\rVert^2$ | 0.07 |
| 7 | Joint speed | $-\lVert\dot{\mathbf q}^t\rVert^2$ | 0.002 |
| 8 | Orientation | $-\lVert\boldsymbol\theta_{\text{roll,pitch}}^t\rVert^2$ | 1.5 |
| 9 | Vertical motion | $-\lVert v_z^t\rVert^2$ | 2.0 |
| 10 | Foot slip | $-\lVert\operatorname{diag}(\mathbf g^t)\mathbf v_f^t\rVert^2$ | 0.8 |

원문은 9번을 “Z Acceleration”이라고 부르지만 식은 $v_z$를 사용합니다. 따라서 이 글에서는 식에 맞춰 vertical velocity penalty로 해석합니다.

각 reward 묶음이 맡는 역할은 아래와 같습니다.

| Reward 묶음 | 유도하는 행동 |
|---|---|
| Forward + lateral/yaw | 앞으로 진행하고 옆으로 새지 않기 |
| Work + action + joint speed | 과도한 actuator 사용 억제 |
| Impact + torque smoothness | 충격과 급격한 torque 변화 억제 |
| Orientation + vertical motion | Body 자세와 상하 진동 안정화 |
| Foot slip | Contact 중 발 미끄러짐 억제 |

### **7.2 자연스러운 reward와 자연스러운 gait는 같은 말이 아니다**

저자들은 work와 ground impact를 줄이는 bioenergetics-inspired constraint, uneven terrain training이 realistic gait transfer에 중요했다고 설명합니다.

하지만 “reference motion이 없으므로 사람이 설계한 prior가 없다”는 뜻은 아닙니다.

다음 선택은 모두 강한 inductive bias입니다.

- Forward speed cap 0.35 m/s
- Lateral/yaw 억제
- Work와 impact penalty
- Foot slip penalty
- Action interface를 joint position target으로 제한
- Fixed PD gains
- Uneven fractal terrain

즉 reference trajectory는 없지만, **어떤 motion을 좋은 motion으로 볼지는 reward와 control interface에 들어 있습니다**.

### **7.3 Penalty curriculum이 없으면 움직이지 않는 해가 쉽다**

학습 초기에 penalty 3~10을 모두 강하게 적용하면 action을 거의 내지 않는 것이 안전한 local optimum이 될 수 있습니다.

논문은 penalty multiplier를 다음처럼 증가시킵니다.

$$
k_0=0.03
$$

$$
k_{i+1}=k_i^{0.997}
$$

$0<k_i<1$에서 1보다 작은 지수를 취하면 값이 점차 1에 가까워집니다.

초기에는 움직임을 먼저 발견하게 하고, 이후 work, impact, smoothness와 slip 조건을 점차 강하게 요구하는 것입니다.

![Penalty curriculum 동안의 학습 reward](/assets/img/posts/rl/sim2real/rma/07-training-curriculum.png){: width="1050" .d-block .mx-auto }
_15,000 iteration 동안 전체 reward, forward+lateral reward와 penalty 합의 변화. 초기 penalty를 작게 두지 않으면 positive locomotion experience를 얻기 어렵다는 것이 supplementary의 설명이다. 출처: [RMA supplementary material](https://ashish-kmr.github.io/rma-legged-robots/)._

Mass, friction과 motor strength perturbation의 난이도도 학습 중 선형으로 늘립니다.

반면 terrain 자체에는 curriculum을 적용하지 않고, 처음부터 고정 난이도의 fractal terrain profile을 무작위로 샘플링합니다.

---

## **8. Simulation과 Randomization 범위**

### **8.1 RaiSim environment**

| 항목 | 값 |
|---|---|
| Simulator | RaiSim |
| Robot model | Unitree A1 URDF |
| Terrain | Built-in fractal terrain |
| Fractal octaves | 2 |
| Lacunarity | 2.0 |
| Gain | 0.25 |
| z-scale | 0.27 |
| Maximum episode | 1,000 steps |
| Height termination | Base height $<0.28$ m |
| Roll termination | $\lvert\text{roll}\rvert>0.4$ rad |
| Pitch termination | $\lvert\text{pitch}\rvert>0.2$ rad |
| Policy frequency | 100 Hz |

Main paper는 policy frequency 100 Hz와 simulation time step 0.025 s를 함께 보고합니다. 두 수치가 단순히 같은 step을 뜻하면 일치하지 않지만, substep 또는 decimation 관계는 원문에 자세히 설명되어 있지 않습니다.

따라서 재현할 때는 이를 임의로 40 Hz 또는 100 Hz로 정리하지 말고, 원 구현의 simulator integration과 control decimation을 확인해야 합니다.

### **8.2 Training보다 넓은 testing range**

| Parameter | Training | Testing |
|---|---:|---:|
| Friction | $[0.05,4.5]$ | $[0.04,6.0]$ |
| $K_p$ | $[50,60]$ | $[45,65]$ |
| $K_d$ | $[0.4,0.8]$ | $[0.3,0.9]$ |
| Payload, kg | $[0,6]$ | $[0,7]$ |
| Center of mass, paper 표기 cm | $[-0.15,0.15]$ | $[-0.18,0.18]$ |
| Motor strength | $[0.90,1.10]$ | $[0.88,1.22]$ |
| Parameter re-sample probability per step | 0.004 | 0.01 |

Testing은 training보다 범위가 넓고, episode 내부 parameter가 더 자주 바뀝니다.

이 설계는 단순한 in-distribution test보다 강합니다. RMA가 context를 한 번 추정한 뒤 episode 끝까지 고정하는 것이 아니라, 바뀐 dynamics를 계속 추적해야 하기 때문입니다.

다만 test range가 training range의 연장선이라는 점도 기억해야 합니다.

실제 세계의 모든 failure mode가 이 scalar range 안에 포함되는 것은 아닙니다.

### **8.3 무엇이 randomize되고 무엇이 latent target에 들어가는가**

Randomized parameter와 $e_t$의 component는 완전히 같은 목록이 아닙니다.

- $K_p$, $K_d$는 environment variation에는 포함됩니다.
- 17D $e_t$에는 payload 조건, motor strength, friction, local terrain height가 들어갑니다.
- Adaptation module은 PPO가 만든 8D $z_t$를 추정합니다.

따라서 $z_t$를 “모든 randomization parameter의 정확한 압축본”이라고 부르는 것은 과합니다.

Policy가 직접 받는 latent와 training 중 바뀌는 전체 simulator condition을 구분해야 합니다.

---

## **9. Phase 2: Recent History에서 Extrinsics를 학습**

### **9.1 Phase 1의 network는 고정한다**

Phase 1이 끝나면 base policy $\pi$와 environment encoder $\mu$를 freeze합니다.

Simulation에서는 여전히 다음 oracle target을 계산할 수 있습니다.

$$
z_t=\mu(e_t)
$$

Adaptation module은 history로 이를 맞춥니다.

$$
\hat z_t
=
\phi
\left(
x_{t-50:t-1},
a_{t-50:t-1}
\right)
$$

$$
\mathcal L_\phi
=
\left\|
\hat z_t-z_t
\right\|_2^2
$$

여기서 $\phi$의 목적은 environment parameter 자체가 아니라, **이미 좋은 locomotion을 학습한 base policy가 사용하던 latent interface를 복원하는 것**입니다.

### **9.2 Oracle trajectory만 사용하면 covariate shift가 생긴다**

가장 쉬운 데이터 수집은 true $z_t$를 base policy에 넣어 안정적인 expert trajectory를 만들고, 그 history와 $z_t$로 $\phi$를 학습하는 것입니다.

하지만 deployment 초기의 $\hat z_t$는 틀릴 수 있습니다.

하지만 틀린 $\hat z$는 imperfect action을 만들고, body motion과 contact distribution을 바꿉니다. Expert dataset에 없던 history가 생기면 $\phi$의 오차가 다시 커지는 feedback loop가 발생합니다.

이것이 supervised imitation에서 흔한 covariate shift입니다.

### **9.3 RMA는 predicted latent로 rollout한다**

RMA는 randomly initialized adaptation module의 $\hat z_t$를 실제 base policy에 넣어 trajectory를 수집합니다.

1. Current $\phi$가 history에서 $\hat z_t$를 추정합니다.
2. Frozen $\pi(x_t,a_{t-1},\hat z_t)$가 action을 내고 next state를 만듭니다.
3. Simulation oracle은 frozen $\mu(e_t)$로 target $z_t$를 계산합니다.
4. 현재 $\phi$가 실제로 만든 history에서 $\lVert\hat z_t-z_t\rVert^2$를 최소화합니다.

즉 $\phi$가 만든 오류 때문에 방문하게 된 state에서도 target $z_t$를 제공합니다.

이 방식은 DAgger와 유사한 on-policy data aggregation 효과를 냅니다.

“On-policy”라는 말이 여기서는 PPO policy를 다시 업데이트한다는 뜻이 아닙니다. Phase 2에서는 $\pi$와 $\mu$가 고정되고, 현재 $\phi$가 유도하는 trajectory distribution에서 $\phi$만 supervised learning으로 업데이트됩니다.

### **9.4 Phase 2 학습량**

| 항목 | 값 |
|---|---:|
| Iterations | 1,000 |
| Transitions per iteration | 80,000 |
| Mini-batches | 4 |
| Optimizer | Adam |
| Learning rate | $5\times10^{-4}$ |
| Loss | MSE between $\hat z_t$ and $z_t$ |
| Simulation steps | 약 80 million |
| Training time | 1 GPU에서 약 3시간 |

전체 학습 비용은 대략 다음처럼 분리됩니다.

| 단계 | Simulation steps | 1 GPU 시간 | 학습 결과 |
|---|---:|---:|---|
| Phase 1 | 약 1.2B | 약 24 h | Privileged conditional controller |
| Phase 2 | 약 80M | 약 3 h | Deployable history encoder |

RMA가 real deployment에서 빠르게 적응할 수 있는 이유는 많은 학습 비용을 미리 simulation에 지불했기 때문입니다.

---

## **10. Deployment: 100 Hz Control과 10 Hz Adaptation**

### **10.1 두 process는 비동기로 돈다**

Base policy:

$$
a_t
=
\pi
\left(
x_t,a_{t-1},\hat z_{\text{latest}}
\right)
$$

를 100 Hz로 계산합니다.

Adaptation module:

$$
\hat z_{\text{latest}}
\leftarrow
\phi(H_t)
$$

를 10 Hz로 갱신합니다.

두 process 사이에 매 step barrier나 central synchronization이 필요하지 않습니다. Base policy는 adaptation module이 가장 최근에 계산한 latent를 읽습니다.

### **10.2 왜 속도를 분리했나**

Joint state와 contact는 빠르게 변합니다. 안정적인 locomotion feedback은 100 Hz로 처리해야 합니다.

반면 payload나 평균 friction 같은 context는 joint state보다 느리게 변합니다. 50-step temporal convolution도 매 10 ms마다 계산할 필요가 없습니다.

이 분리는 low-cost onboard compute에서 다음 효과를 줍니다.

- High-rate feedback path를 작은 MLP로 유지
- Temporal model은 낮은 rate로 실행
- Adaptation latency가 control loop 전체를 막지 않음
- 최신 latent가 잠시 유지되어도 control은 계속 수행

### **10.3 History를 policy에 직접 넣는 대안과의 비교**

저자들은 state-action history를 하나의 policy가 직접 처리하는 대안도 실험했다고 설명합니다.

저자들이 이 대안에서 관찰한 문제는 세 가지였습니다.

1. Simulation에서 부자연스러운 gait와 낮은 성능
2. Onboard compute에서 10 Hz로만 실행 가능
3. Fast state feedback과 slow context inference를 비동기로 분리할 수 없음

RMA architecture는 단순한 network modularity가 아니라 서로 다른 time scale을 가진 두 문제를 분리한 설계입니다.

### **10.4 Safety 관점에서 남는 문제**

비동기 구조에도 고려할 점이 있습니다.

- $\hat z$가 stale한 동안 environment가 급변할 수 있음
- 0.1초 adaptation update latency가 고속 motion에서는 길 수 있음
- History buffer의 timestamp와 action-state alignment가 틀리면 잘못된 latent를 추정함
- Inference deadline miss가 반복되면 stale latent가 장시간 유지될 수 있음

논문 setup에서는 문제가 되지 않았다고 보고하지만, 더 빠른 robot이나 다른 onboard stack에서는 timing을 별도로 검증해야 합니다.

---

## **11. Simulation Baseline: 무엇과 비교했나**

### **11.1 여섯 가지 method**

| Method | 핵심 |
|---|---|
| Robust | $z$ 없이 domain randomization 전체를 버티는 policy |
| SysID | History에서 latent가 아니라 physical $e_t$를 직접 예측 |
| AWR | Test environment rollout으로 latent를 offline 최적화 |
| RMA w/o Adapt | Adaptation module을 제거한 ablation |
| RMA | History에서 $\hat z_t$를 online 추정 |
| Expert | Simulation의 true $z_t$를 사용한 upper bound |

Learning baseline은 같은 architecture, reward와 hyperparameter를 사용했다고 논문은 설명합니다.

### **11.2 정량 결과**

| Method | Success % | TTF | Reward | Distance m | Adapt samples | Torque | Smoothness | Ground impact |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Robust | 62.4 | 0.80 | 4.62 | 1.13 | 0 | 527.59 | 122.50 | 4.20 |
| SysID | 56.5 | 0.74 | 4.82 | 1.17 | 0 | 565.85 | 149.75 | 4.03 |
| AWR | 41.7 | 0.65 | 4.17 | 0.95 | 40k | 599.71 | 162.60 | 4.02 |
| RMA w/o Adapt | 52.1 | 0.75 | 4.72 | 1.15 | 0 | 524.18 | 106.25 | 4.55 |
| **RMA** | **73.5** | **0.85** | **5.22** | **1.34** | **0** | **500.00** | **92.85** | **4.27** |
| Expert | 76.2 | 0.86 | 5.23 | 1.35 | 0 | 485.07 | 85.56 | 3.90 |

각 수치는 세 개 random seed의 policy와 seed당 1,000 episode를 평균한 것입니다. Test에서는 environment parameter를 step마다 확률 0.01로 다시 샘플링합니다.

![Simulation에서 RMA와 baseline의 결과](/assets/img/posts/rl/sim2real/rma/08-overview-results.png){: width="1250" .d-block .mx-auto }
_RMA는 Robust, direct SysID, offline AWR와 adaptation 제거 ablation보다 높은 success와 Expert에 가까운 성능을 보였다. 출처: [Kumar et al. 및 supplementary](https://arxiv.org/pdf/2107.04034)._

### **11.3 수치가 말하는 것**

RMA와 Expert의 success 차이는 2.7%p입니다.

$$
76.2-73.5=2.7
$$

즉 이 simulation setting에서는 0.5초 history 기반 $\hat z$가 oracle $z$와 상당히 가까운 control 성능을 냈습니다.

RMA와 Robust의 차이는 11.1%p입니다.

$$
73.5-62.4=11.1
$$

Adaptation을 제거하면 52.1%로 더 크게 떨어집니다.

큰 randomization range만으로는 Robust baseline과의 11.1%p 차이를 설명하기 어렵습니다. **현재 condition을 구분해 action을 바꾸는 mechanism**이 실제 이득을 만들었습니다.

### **11.4 `Adapt samples = 0`을 오해하지 말 것**

표의 RMA adaptation samples가 0인 이유는 test environment에서 별도의 optimization rollout을 수집하지 않기 때문입니다.

그러나 RMA는 매 순간 최근 50 step의 sensor/action history를 사용합니다.

정확한 뜻은 **추가 test-time optimization sample이 0**이라는 것입니다. 관측 data 없이 adaptation한다는 뜻은 아닙니다.

### **11.5 Extreme simulation generalization**

Supplementary는 payload, terrain z-scale과 friction을 크게 변화시켜 추가 실험합니다.

![Payload, terrain height와 friction 변화에 대한 simulation generalization](/assets/img/posts/rl/sim2real/rma/06-simulation-generalization.png){: width="1250" .d-block .mx-auto }
_Payload, fractal terrain z-scale과 friction을 각각 변화시킨 simulation test. RMA는 추가 test rollout 없이 전반적으로 Expert에 가장 가까운 추세를 보인다. 곡선은 3개 seed, 각 조건당 100 test trial의 평균과 분산이다. 출처: [RMA supplementary material](https://ashish-kmr.github.io/rma-legged-robots/)._

이 그림은 training range 밖으로 갈수록 모든 방법이 동일하게 유지된다는 뜻이 아닙니다. 변수별로 성능이 감소하며, RMA가 비교 방법보다 상대적으로 완만하게 저하된다는 결과입니다.

---

## **12. 실제 A1 Indoor Experiment**

![Indoor setup에서 RMA, adaptation 제거, A1 기본 controller 비교](/assets/img/posts/rl/sim2real/rma/03-indoor-experiments.png){: width="1300" .d-block .mx-auto }
_Payload, step, uneven foam, mattress, incline에서 RMA와 두 baseline을 비교했다. 대부분 5회 trial이며, 심각하게 실패하는 경우 하드웨어 보호를 위해 2회 후 중단했다. 출처: [Kumar et al., Figure 3](https://arxiv.org/pdf/2107.04034)._

### **12.1 실험 task**

| Task | 성공 조건 |
|---|---|
| n-kg Payload | Payload를 올리고 300 cm 걷기 |
| StepUp-n | n cm step을 올라가기 |
| Uneven Foam | 중앙이 솟은 foam 위 180 cm 걷기 |
| Mattress | Memory foam mattress 위 60 cm 걷기 |
| StepDown-n | n cm step을 내려가기 |
| Incline | 6 degree 경사 오르기 |
| Oily Surface | Oil을 바른 patch 통과 |

비교 방법은 다음 세 가지입니다.

- RMA
- RMA without adaptation
- Unitree A1 제조사 controller

실기에서 모든 simulation baseline을 돌리지 않은 이유는 실패가 robot damage로 이어질 수 있기 때문입니다.

### **12.2 Deformable surface와 step**

Figure 3에서 RMA는:

- Uneven foam에서 80% success
- 6 degree incline에서 100%
- Mattress에서 100%
- 6 cm step up에서 100%
- 8 cm step up에서 60%

를 보입니다.

특히 uneven foam에서 adaptation 제거 model은 성공하지 못했고, 제조사 controller도 낮은 성공률을 보였습니다.

Rigid fractal terrain에서만 학습한 latent adaptation이 실제 deformable contact에서도 어느 정도 작동했습니다.

다만 deformable foam의 정확한 물리 model을 식별했다는 뜻은 아닙니다. Foam 때문에 나타난 body/contact response를 training 중 학습한 latent space의 유용한 영역으로 mapping했다고 보는 편이 정확합니다.

StepDown 15 cm의 성공률은 논문 Figure 3의 내부 표기와 caption 문구가 서로 일치하지 않습니다. Caption은 80%라고 설명하고 panel은 100%로 읽힙니다.

그래서 **15 cm step-down을 반복적으로 성공했지만 정확한 비율 표기에는 원문 내부 불일치가 있다**고만 기록했습니다.

### **12.3 12 kg payload의 의미**

A1 자체 무게는 약 12 kg입니다.

제조사 controller는 8 kg 부근부터 자세가 처지고 성능이 저하됩니다. Adaptation을 제거한 policy는 8 kg보다 큰 payload에서 잘 넘어지지는 않지만 앞으로 나아가지 못하는 경향을 보였습니다.

RMA는 최대 12 kg, 즉 robot body weight와 같은 payload를 높은 성공률로 운반했다고 논문은 보고합니다.

여기서 성능은 단순한 fall avoidance가 아닙니다.

| Method | Heavy payload에서 관찰된 차이 |
|---|---|
| RMA w/o adaptation | 넘어지지 않고 버틸 수 있어도 전진 task를 완료하지 못함 |
| RMA | Payload response에 따라 latent, torque와 gait를 바꾸며 지정 거리 전진 |

즉 robust하게 웅크리고 버티는 것과 task를 수행하며 적응하는 것을 구분해야 합니다.

---

## **13. Latent가 실제로 변하는 장면**

### **13.1 Oil patch: slip 이후 torque와 gait 회복**

실험에서는 바닥 plastic sheet에 oil을 바르고 robot foot도 plastic으로 감쌌습니다.

![Oil patch에서 나타난 latent와 gait 변화](/assets/img/posts/rl/sim2real/rma/04-friction-adaptation.png){: width="1200" .d-block .mx-auto }
_약 2초에 slip이 시작된 뒤 knee torque, contact gait와 $\hat z$의 1·5번째 component가 변한다. 적응 후 gait period가 대체로 회복되고 torque magnitude는 커지며 latent는 미끄러운 조건을 계속 반영한다. 출처: [Kumar et al., Figure 4](https://arxiv.org/pdf/2107.04034)._

저자들이 보고한 흐름은 normal gait $\rightarrow$ 약 2초에서 slip $\rightarrow$ gait/contact disturbance $\rightarrow$ $\hat z$ component 변화 $\rightarrow$ knee torque 증가 $\rightarrow$ gait period 회복입니다.

RMA는 oily patch trial의 90%에서 성공했습니다.

여기서 중요한 해석은 latent가 slip event에 반응하고, 그 latent를 조건으로 한 policy가 다른 action을 냈다는 것입니다.

하지만 1번째 component가 “friction”, 5번째가 “slip”이라는 뜻은 아닙니다. Latent basis는 end-to-end로 학습되었으며 component 의미에 explicit supervision이 없습니다.

### **13.2 5 kg payload: disturbance 이후 더 큰 torque**

Supplementary는 주행 중 A1 등에 5 kg payload를 던지는 실험을 분석합니다.

![5 kg payload가 추가될 때 latent와 torque 변화](/assets/img/posts/rl/sim2real/rma/05-payload-adaptation.png){: width="1200" .d-block .mx-auto }
_5 kg payload가 올라오면 center of mass가 순간적으로 내려가고, $\hat z$의 2·7번째 component와 knee torque가 변한 뒤 gait period가 대체로 회복된다. 원문 영상 프레임은 좌우를 뒤집어 bag 표기가 2 kg처럼 보이지만 실제 실험 payload는 5 kg이라고 supplementary가 명시한다. 출처: [RMA supplementary material](https://ashish-kmr.github.io/rma-legged-robots/)._

Payload가 올라온 순간:

- Center of mass가 내려감
- Gait가 일시적으로 흐트러짐
- $\hat z$ component가 변함
- Knee torque magnitude가 증가
- Gait period가 이전과 유사하게 회복

합니다.

이것은 adaptation module이 static payload sensor를 읽은 결과가 아닙니다. Payload로 인해 생긴 state-action response를 history에서 읽은 결과입니다.

### **13.3 이 그림이 인과관계 전체를 증명하지는 않는다**

Plot에서 latent 변화와 recovery가 시간적으로 함께 나타났다는 것은 좋은 diagnostic입니다.

그러나 다음을 직접 증명하지는 않습니다.

- 특정 latent component가 특정 물리량과 일대일 대응한다.
- Latent 변화 하나만으로 recovery가 발생했다.
- 동일한 latent 변화가 모든 terrain에서 같은 의미를 가진다.

Adaptation ablation과 simulation baseline을 함께 봐야 구조적 기여를 판단할 수 있습니다.

---

## **14. Outdoor Experiment: Training Terrain과 실제 자연환경 사이**

![자연 지형에서의 RMA 결과](/assets/img/posts/rl/sim2real/rma/08-overview-results.png){: width="1250" .d-block .mx-auto }
_Simulation baseline과 실제 자연환경 결과를 함께 요약한 원문 시각자료. Outdoor result는 동일한 정책의 qualitative·trial-level evidence이며, 모든 환경을 동일 수의 반복으로 비교한 benchmark는 아니다. 출처: [RMA paper and project](https://ashish-kmr.github.io/rma-legged-robots/)._

Outdoor trial에서 보고된 결과는 아래와 같습니다.

| Terrain | 보고된 결과 |
|---|---|
| Sand, mud, dirt | 수행한 trial에서 failure 없음 |
| Tall vegetation / bush | 100% success |
| Hiking-trail stairs down | 70% success |
| Downhill mud pile | 100% success |
| Cement pile / pebbles | 80% success |

이 terrain은 simulation의 fractal height field와 물리적으로 동일하지 않습니다.

- Sand와 mud는 foot sinking과 sticking을 만듦
- Vegetation은 swing leg를 방해함
- Pebbles와 debris는 foothold를 움직이게 함
- Side slope와 stairs는 training geometry와 다름

RMA의 의미는 이 현상을 정확히 simulation한 것이 아니라, 다양한 perturbation에서 학습한 conditional behavior와 online latent inference가 실제 response 변화에도 유효했다는 데 있습니다.

### **14.1 무엇을 강하게 말할 수 있는가**

- Simulation-only training 뒤 A1에 직접 배포되었습니다.
- Reference trajectory와 predefined foot trajectory generator 없이 gait를 학습했습니다.
- 동일한 architecture가 다양한 indoor/outdoor 조건에서 동작했습니다.
- Adaptation 제거 ablation보다 실제 task 성능이 좋았습니다.
- Slip과 payload event 뒤 latent와 torque/gait가 함께 변했습니다.

### **14.2 무엇을 강하게 말하면 안 되는가**

- 모든 unseen dynamics에 보장된 adaptation
- Friction과 mass의 정확한 online identification
- Vision 없이 obstacle을 미리 인지하거나 계획
- 모든 실외 terrain에서 통계적으로 검증된 universal controller
- Latent 각 축의 명확한 물리 의미

Outdoor 결과는 강한 deployment evidence지만, terrain별 trial count와 조건이 완전히 통제된 대규모 benchmark는 아닙니다.

---

## **15. RMA와 Classical System Identification의 차이**

### **15.1 Classical SysID**

Classical system identification은 관측 history $H_t$에서 physical parameter를 추정합니다.

$$
\hat e_t=f_{\text{ID}}(H_t)
$$

예를 들어:

$$
\hat e_t
=
\left[
\hat m,\hat\mu,\hat K_p,\hat K_d,\ldots
\right]
$$

모델 기반 controller가 이 parameter를 사용하려면 물리적 정확성과 단위가 중요합니다.

### **15.2 RMA latent identification**

RMA는 다음을 추정합니다.

$$
\hat z_t=\phi(H_t)
$$

$$
z_t=\mu(e_t)
$$

$z_t$는 PPO return을 높이도록 policy와 함께 형성된 latent입니다.

| 구분 | Classical SysID | RMA |
|---|---|---|
| Target | Physical parameter $e$ | Policy latent $z$ |
| Supervision | Parameter estimation error | Encoder가 만든 latent MSE |
| 의미 | 물리 단위와 해석 가능성 중요 | 행동에 유용하면 됨 |
| 장점 | Model-based reasoning 가능 | 짧은 history에서 필요한 정보만 추정 가능 |
| 위험 | 정확한 parameter 식별이 어려움 | Latent가 해석 불가능하고 distribution에 종속 |

### **15.3 왜 direct SysID baseline이 더 낮았나**

논문의 SysID success rate는 56.5%, RMA는 73.5%입니다.

RMA가 direct SysID보다 높았던 이유는 세 가지로 생각해볼 수 있습니다.

1. 짧은 history로 17D physical factor를 정확히 분리하기 어렵다.
2. Policy가 필요한 정보는 physical parameter 전체가 아니다.
3. Encoder $\mu$가 locomotion return에 맞는 equivalence class를 만든다.

예를 들어 서로 다른 mass-friction 조합이 비슷한 torque와 gait adjustment를 요구한다면, policy latent에서는 비슷하게 표현해도 됩니다.

다만 direct SysID baseline의 특정 network와 학습 setup에서 나온 결과이므로, 더 좋은 system identification 방법 전체가 열등하다고 결론 내리면 안 됩니다.

---

## **16. RMA를 구현할 때의 Data Flow**

### **16.1 Phase 1**

```python
# simulation-only privileged training
state, env_params = env.reset()
prev_action = zeros(12)

for step in rollout:
    z = env_encoder(env_params)              # [B, 17] -> [B, 8]
    action = base_policy(state, prev_action, z)  # [B, 50] -> [B, 12]

    next_state, next_env_params, reward, done = env.step(action)
    ppo_buffer.add(state, env_params, prev_action, action, reward, done)

    state = next_state
    env_params = next_env_params
    prev_action = action

update_ppo(base_policy, env_encoder, ppo_buffer)
```

주의할 점은 environment encoder도 PPO gradient를 받는다는 것입니다.

$\mu$를 미리 만든 arbitrary autoencoder로 보면 안 됩니다. Latent는 reconstruction이 아니라 control return에 맞춰집니다.

### **16.2 Phase 2**

```python
# pi and mu are frozen
history = HistoryBuffer(length=50)

for step in rollout:
    with no_grad():
        z_target = env_encoder(env_params)

    z_hat = adaptation_module(history.states, history.actions)

    with no_grad():
        action = base_policy(state, prev_action, z_hat)
        next_state, next_env_params, _, done = env.step(action)

    adaptation_dataset.add(history, z_target)
    history.append(state, action)

    state = next_state
    env_params = next_env_params
    prev_action = action

loss = mse(adaptation_module(batch.history), batch.z_target)
update(adaptation_module, loss)
```

실제 구현에서는 gradient boundary를 명확히 해야 합니다.

- Phase 2에서 $\pi$와 $\mu$는 freeze
- $\mu(e_t)$는 target이므로 detach
- Environment transition을 통해 gradient를 보내지 않음
- $\phi$만 MSE로 update

### **16.3 Deployment**

```python
# process A: 100 Hz
while robot_is_running:
    state = read_robot_state()
    z_latest = shared_extrinsics.read()
    action = base_policy(state, prev_action, z_latest)
    send_joint_targets(action)
    history.append(state, action, timestamp=now())
    prev_action = action

# process B: 10 Hz
while robot_is_running:
    window = history.latest_aligned(50)
    z_hat = adaptation_module(window.states, window.actions)
    shared_extrinsics.write(z_hat, timestamp=now())
```

여기서 production-grade 구현이라면 다음을 추가해야 합니다.

- History timestamp와 missing sample 검사
- $\hat z$ age 제한
- Inference deadline monitoring
- Joint target, velocity와 torque limit
- Fall/tilt emergency stop
- Contact sensor fault handling
- NaN/Inf 검출
- 초기 50 step이 차기 전 latent initialization

논문 architecture를 복사하는 것과 안전하게 real robot에 배포하는 것은 별개의 작업입니다.

---

## **17. 이 논문의 핵심 Ablation을 어떻게 읽어야 하나**

### **17.1 RMA vs RMA w/o Adaptation**

이 비교는 adaptation module 자체의 기여를 봅니다.

$$
\text{Success: }73.5\%\;\text{vs}\;52.1\%
$$

Base policy와 latent-conditioned training만 있고 runtime latent inference가 없으면 성능이 크게 떨어집니다.

### **17.2 RMA vs Robust**

이 비교는 environment-conditioned control의 가치를 봅니다.

$$
\text{Success: }73.5\%\;\text{vs}\;62.4\%
$$

둘 다 randomization을 보지만 RMA는 현재 context를 추정해 조건부 action을 냅니다.

### **17.3 RMA vs Expert**

이 비교는 adaptation module이 oracle latent에 얼마나 가까운 control 결과를 내는지 봅니다.

$$
\text{Success: }73.5\%\;\text{vs}\;76.2\%
$$

차이가 작다는 것은 좋은 결과지만, $\hat z$ 자체의 MSE가 작거나 physical parameter가 정확하다는 것을 직접 의미하지는 않습니다. 최종 locomotion metric이 가깝다는 뜻입니다.

### **17.4 RMA vs AWR**

AWR은 40k adaptation sample을 사용했지만 success가 41.7%였습니다.

Test dynamics가 episode 중 계속 바뀌는 setting에서는 여러 rollout을 모아 느리게 latent를 최적화하는 방식이 현재 environment를 따라가기 어렵습니다.

여러 rollout을 요구하지 않고 현재 history에서 바로 context를 갱신한다는 점에서 `rapid`의 의미가 가장 직접적으로 드러나는 비교입니다.

---

## **18. 한계와 실패 가능성**

### **18.1 Training distribution 바깥의 failure**

Adaptation module은 simulation에서 생성된 history와 latent mapping을 학습합니다.

실제 failure가 training distribution과 전혀 다른 mechanism이면:

$$
H_t^{real}
\not\sim
p_{\text{train}}(H)
$$

$\hat z_t$는 의미 없는 extrapolation이 될 수 있습니다.

예:

- 부러진 leg linkage
- 큰 sensor bias
- 통신 지연이 갑자기 증가
- Foot contact sensor stuck
- 학습에 없던 compliance와 backlash

### **18.2 History에서 보이지 않는 조건**

짧은 history에서 서로 다른 environment가 같은 response를 만들면 구분할 수 없습니다.

$$
p(H_t\mid e_1)
\approx
p(H_t\mid e_2)
$$

이면 $\phi$가 둘을 식별하기 어렵습니다.

Policy 관점에서 같은 행동이 필요하다면 문제가 없지만, 나중에 다른 action에서 response가 갈라지면 잘못된 latent가 위험할 수 있습니다.

### **18.3 Contact 이후에야 알 수 있다**

RMA는 proprioceptive adaptation입니다.

미끄러운 바닥을 밟은 후 slip response는 감지할 수 있지만, 아직 밟지 않은:

- cliff
- wide gap
- sharp obstacle
- deep hole

을 미리 볼 수는 없습니다.

따라서 exteroceptive perception과 planning을 대체하지 않습니다.

### **18.4 Latent interpretability**

$z$는 control return에 맞춰 학습되므로 각 축의 물리 의미가 보장되지 않습니다.

Plot에서 component 1과 5가 slip 뒤 변했다고 해서 $z_1$을 friction coefficient, $z_5$를 slip probability라고 이름 붙이면 안 됩니다.

Latent intervention, disentanglement test 또는 decoder 검증이 추가로 필요합니다.

### **18.5 실제 실험의 표본 크기**

Indoor experiment는 보통 method당 5 trial이고, 위험한 실패는 2회 후 중단했습니다.

이는 hardware safety를 고려하면 합리적이지만, 작은 차이를 통계적으로 확정하기에는 제한적입니다.

Outdoor result도 매우 인상적인 deployment evidence지만 표준화된 대규모 benchmark는 아닙니다.

### **18.6 Command와 task 범위**

이 논문은 forward locomotion을 중심으로 합니다.

Velocity command tracking, turning, recovery, manipulation과 navigation까지 같은 latent가 일반화된다는 것을 보여주지 않습니다.

RMA architecture는 범용적이지만 이 논문의 evidence 범위는 A1 forward locomotion입니다.

### **18.7 Real-time safety layer가 논문의 중심은 아니다**

Joint target clipping, torque saturation, watchdog와 fallback controller 같은 production safety mechanism은 architecture 설명의 중심이 아닙니다.

실제 robot 적용에서는 adaptation accuracy와 별개로 다음이 필요합니다.

- 안전한 action envelope
- Latent 이상 감지
- Tilt/contact 기반 termination
- Communication watchdog
- Manual emergency stop
- 낮은 속도부터 단계적 검증

---

## **19. 앞선 Sim2Real 논문들과 연결하기**

| 흐름 | 해결하려는 문제 | RMA와의 관계 |
|---|---|---|
| Domain randomization | Simulator parameter 오차에 강건해지기 | RMA의 training distribution을 만듦 |
| Learned actuator model | Motor dynamics mismatch 줄이기 | RMA는 별도 actuator calibration 없이 randomization과 adaptation을 사용 |
| Privileged teacher/student | Simulation-only state를 deployable history로 옮기기 | Privileged latent를 history에서 추정한다는 점이 유사 |
| Recurrent/TCN proprioception | Hidden terrain/contact를 history로 추론 | RMA는 history를 explicit 8D context로 분리 |
| RMA | 현재 dynamics에 따라 online으로 action을 바꾸기 | Robustness를 adaptation으로 확장 |

앞선 Challenging Terrain 논문과 RMA는 history를 쓰지만 목적과 구조가 다릅니다.

| Paper | History supervision | Control 목표 |
|---|---|---|
| Lee et al. | 2초 proprioception으로 teacher latent와 action 모방 | Blind rough-terrain control |
| RMA | 0.5초 state-action history로 environment-conditioned latent 추정 | Changing dynamics에 rapid adaptation |

또한 RMA는 predefined foot trajectory generator를 사용하지 않지만, Lee et al.은 PMTG와 analytic IK를 사용했습니다.

어느 쪽이 절대적으로 우월하다는 의미가 아닙니다. 두 논문은 서로 다른 inductive bias와 deployment 목표를 선택했습니다.

---

## **20. 이 논문에서 가져갈 설계 원칙**

### **원칙 1: Robustness와 adaptation을 구분한다**

여러 환경에서 하나의 평균적인 action을 내는 것과, 현재 환경을 추정해 action을 바꾸는 것은 다른 문제입니다.

### **원칙 2: 정확한 물리 parameter보다 task-relevant latent가 유리할 수 있다**

Controller가 필요로 하는 equivalence class만 표현하면 짧은 history에서도 추정 문제가 쉬워질 수 있습니다.

### **원칙 3: Privileged learning은 deployability를 함께 설계해야 한다**

Simulation에서만 알 수 있는 $e_t$를 넣는 것으로 끝나지 않고, real history로 복원 가능한 $z_t$ interface를 만들어야 합니다.

### **원칙 4: Adaptation model은 자기 오류가 만든 trajectory에서 학습해야 한다**

Oracle trajectory만 학습하면 deployment covariate shift에 약합니다.

### **원칙 5: Fast control과 slow context를 서로 다른 rate로 운영할 수 있다**

모든 network를 최고 주기로 돌리지 않아도 됩니다. 다만 stale estimate와 timestamp alignment를 관리해야 합니다.

### **원칙 6: 그림 속 latent 변화와 physical semantics를 혼동하지 않는다**

Latent는 행동에 유용한 representation이지 자동으로 해석 가능한 system parameter가 아닙니다.

---

## **21. 재현할 때 확인할 Checklist**

### **Environment**

- [ ] A1 joint ordering과 action ordering이 일치하는가?
- [ ] Position target의 unit이 radian인가?
- [ ] $K_p=55$, $K_d=0.8$과 torque limit을 함께 처리했는가?
- [ ] Foot contact indicator가 training과 deployment에서 같은 의미인가?
- [ ] Randomization parameter가 episode 안에서 재샘플링되는가?
- [ ] Terrain generator 설정이 논문과 일치하는가?

### **Phase 1**

- [ ] $e_t$는 policy에 직접 concat하지 않고 $\mu(e_t)$를 거치는가?
- [ ] $\mu$가 PPO gradient로 공동 학습되는가?
- [ ] State 30D, previous action 12D, latent 8D shape가 맞는가?
- [ ] Penalty curriculum이 초기 collapse를 막는가?
- [ ] Reward-only privileged signal이 deploy observation에 섞이지 않는가?

### **Phase 2**

- [ ] $\pi$와 $\mu$를 freeze했는가?
- [ ] History 길이가 정확히 50 control step인가?
- [ ] State와 그때 실행한 action의 timestamp가 맞는가?
- [ ] $\hat z$를 policy에 넣어 on-policy rollout을 수집하는가?
- [ ] Target $z=\mu(e)$가 detach되어 있는가?
- [ ] Reset boundary를 가로질러 history를 이어 붙이지 않는가?

### **Deployment**

- [ ] Base policy 100 Hz deadline을 지키는가?
- [ ] Adaptation module 10 Hz update가 control loop를 block하지 않는가?
- [ ] Latest $\hat z$의 age를 모니터링하는가?
- [ ] History warm-up 동안 사용할 safe latent가 있는가?
- [ ] Joint target, velocity와 torque 제한이 있는가?
- [ ] Fall detector, watchdog와 emergency stop이 있는가?

---

## **22. RMA가 실제로 바꾼 것**

RMA를 “history를 넣은 PPO”라고만 보면 구조가 흐려집니다. 먼저 privileged PPO로 환경을 알 때 잘 걷는 policy를 만들고, policy가 필요로 하는 environment 정보를 8D behavior-relevant latent로 압축합니다. 실제 robot에서는 최근 50-step state-action history로 그 latent를 추정합니다.

세 network의 data flow는 아래와 같습니다.

$$
e_t\in\mathbb{R}^{17}
\xrightarrow{\mu}
z_t\in\mathbb{R}^{8}
$$

$$
(x_t,a_{t-1},z_t)
\xrightarrow{\pi}
a_t\in\mathbb{R}^{12}
$$

$$
(x_{t-50:t-1},a_{t-50:t-1})
\xrightarrow{\phi}
\hat z_t\in\mathbb{R}^{8}
$$

Phase 1은 PPO로 1.2 billion simulation step을 사용하고, Phase 2는 predicted latent가 만든 trajectory에서 supervised MSE로 adaptation module을 학습합니다. Deployment에서는 base policy 100 Hz, adaptation module 10 Hz와 fixed-gain PD controller가 비동기로 동작합니다.

Simulation에서 RMA는 73.5% success로 Robust 62.4%, direct SysID 56.5%, adaptation 제거 52.1%를 앞섰고 oracle latent를 쓰는 Expert 76.2%에 근접했습니다. 실제 A1에서는 payload, foam, mattress, incline, oil, sand, mud, vegetation, stairs와 debris를 평가했습니다.

> RMA는 simulation에서 학습한 environment-conditioned control latent가 실제 interaction history에서 식별 가능할 때, 별도의 real-world optimization 없이 그 latent를 빠르게 갱신해 locomotion action을 바꿀 수 있음을 보여준다.

다음 글: [Learning to Walk in Minutes](/posts/learning-to-walk-in-minutes/)

다음 편의 **Learning to Walk in Minutes Using Massively Parallel Deep Reinforcement Learning**은 이런 locomotion policy 학습의 wall-clock time을 GPU 병렬 simulation으로 줄입니다.

---

## **참고 자료**

- [Kumar et al., RMA: Rapid Motor Adaptation for Legged Robots](https://arxiv.org/abs/2107.04034)
- [RMA paper PDF](https://arxiv.org/pdf/2107.04034)
- [Official RMA project page and videos](https://ashish-kmr.github.io/rma-legged-robots/)
- [RSS 2021 proceedings](https://www.roboticsproceedings.org/rss17/p011.html)
