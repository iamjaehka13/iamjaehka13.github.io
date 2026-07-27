---
title: "[Sim2Real Paper 3] Dynamics Randomization"
date: 2026-06-24 17:31:00 +0900
last_modified_at: 2026-07-27 19:52:00 +0900
categories: [RL, Sim2Real, Paper]
tags: [sim2real, dynamics-randomization, recurrent-policy, implicit-system-identification, fetch-robot, object-pushing, rdpg, her]
description: Peng et al.의 dynamics randomization을 Fetch puck pushing 실험, RDPG와 HER, LSTM 기반 implicit system identification, omniscient critic, 실물 ablation 결과까지 원문 기준으로 정리한다.
math: true
image:
  path: /assets/img/posts/rl/sim2real/dynamics-randomization/00-preview.png
  alt: Fetch 로봇 팔이 puck을 목표 위치로 미는 실물 실험 연속 장면
---

## **0. 전체 그림: Appearance가 아니라 Transition을 흔들기**

이전 글에서는 Tobin et al.의 **visual domain randomization**을 봤습니다.

Texture, lighting, camera pose처럼 image를 만드는 요소를 계속 바꾸면, network가 특정 simulation appearance에 과적합하지 않고 real image에도 남아 있는 feature를 찾게 할 수 있었습니다.

Peng et al.의 **Sim-to-Real Transfer of Robotic Control with Dynamics Randomization**은 이 관점을 control로 옮깁니다.

여기서 바꾸는 것은 pixel이 아니라 **action 이후의 결과**입니다.

$$
s_{t+1}
\sim
P_{\mu}(\cdot \mid s_t, a_t)
$$

질량, 마찰, damping, controller gain, sensor noise, action timing이 바뀌면 같은 state에서 같은 action을 줘도 다음 state가 달라집니다. Simulation에서 하나의 고정된 transition만 경험한 policy는 real robot의 다른 transition을 만났을 때 쉽게 깨질 수 있습니다.

이 논문의 핵심은 다음 한 문장으로 정리할 수 있습니다.

> Real robot을 하나의 정확한 simulation으로 복제하는 대신, 가능한 dynamics들의 distribution에서 policy를 학습시키자.

다만 이 논문은 randomization만 넣고 끝나지 않습니다. **LSTM policy가 state-action history를 이용해 현재 dynamics에 적응하도록 만들었다**는 점이 중요합니다.

![Fetch 로봇의 puck pushing 연속 장면](/assets/img/posts/rl/sim2real/dynamics-randomization/02-real-pushing-sequence.png){: width="1200" .d-block .mx-auto }
_Fetch 로봇 팔이 puck을 빨간 목표점까지 미는 실제 실행 장면. Policy는 real robot data로 추가 학습하지 않고 simulation에서만 학습되었다. 출처: [Peng et al., Figure 1 source](https://arxiv.org/pdf/1710.06537)._

따라서 이 글에서 확인할 질문은 네 가지입니다.

1. 어떤 dynamics를 어느 범위까지 randomize했는가?
2. Policy는 숨겨진 dynamics를 어떻게 history에서 읽어내는가?
3. RDPG, HER, omniscient critic은 왜 함께 사용되었는가?
4. 실제 Fetch robot에서 무엇이 성공했고, 어디까지를 주장할 수 있는가?

---

## **1. 논문 정보**

| 항목 | 내용 |
|---|---|
| Title | Sim-to-Real Transfer of Robotic Control with Dynamics Randomization |
| Authors | Xue Bin Peng, Marcin Andrychowicz, Wojciech Zaremba, Pieter Abbeel |
| Venue | ICRA 2018 |
| Robot | Fetch Robotics 7-DOF arm |
| Task | Puck을 random target position으로 미는 non-prehensile manipulation |
| Simulator | MuJoCo |
| Policy learning | Recurrent Deterministic Policy Gradient, RDPG |
| Sparse reward 학습 | Hindsight Experience Replay, HER |
| Adaptation mechanism | LSTM history를 이용한 implicit system identification |
| Transfer | Simulation-only training 후 real Fetch에 zero-shot deployment |
| Source | [arXiv](https://arxiv.org/abs/1710.06537), [PDF](https://arxiv.org/pdf/1710.06537), [IEEE DOI](https://doi.org/10.1109/ICRA.2018.8460528) |

이 논문은 locomotion 논문이 아니라 **tabletop object pushing** 논문입니다. 하지만 이후 legged robot Sim2Real에서 반복해서 등장하는 구성이 이미 들어 있습니다.

```text
simulation dynamics randomization
        +
history-based adaptation
        +
training 때만 privileged information을 보는 critic
        ↓
real robot zero-shot transfer
```

즉, 이 논문은 단순히 “마찰을 흔들자”는 아이디어보다 더 넓은 구조를 제시합니다.

---

## **2. 정확히 어떤 문제를 풀었는가?**

### **2.1 Fetch robot과 puck pushing**

실험은 7-DOF Fetch Robotics arm으로 수행됩니다. 각 episode에서 puck의 초기 위치와 목표 위치가 table 위에서 random하게 정해지고, robot은 puck을 목표점까지 밀어야 합니다.

![실제 Fetch와 MuJoCo Fetch model](/assets/img/posts/rl/sim2real/dynamics-randomization/01-fetch-real-vs-sim.png){: width="620" .d-block .mx-auto }
_왼쪽은 실제 Fetch robot, 오른쪽은 MuJoCo model이다. 저자들은 두 system을 정밀하게 맞추기보다 큰 calibration mismatch를 남긴 상태에서 transfer를 평가했다. 출처: [Peng et al., Figure 2](https://arxiv.org/pdf/1710.06537)._

이 task가 Sim2Real 실험에 적합한 이유는 pushing dynamics가 작은 오차에도 민감하기 때문입니다.

- Puck과 table 사이의 friction이 다르면 이동 거리가 달라집니다.
- Puck mass가 다르면 같은 push에도 acceleration이 달라집니다.
- End-effector가 닿는 위치와 각도에 따라 puck motion이 크게 달라집니다.
- Controller latency가 있으면 접촉 시점과 force direction이 달라집니다.
- Puck이 목표를 지나치면 다시 반대쪽에서 correction해야 합니다.

정확한 contact model을 만드는 것보다, 여러 contact dynamics를 경험한 feedback policy를 학습시키는 편이 더 현실적인 문제 설정입니다.

### **2.2 State는 52D, action은 7D**

논문에서 policy state는 총 52차원입니다.

| State component | 의미 |
|---|---|
| Arm joint positions | 7개 joint의 현재 각도 |
| Arm joint velocities | 각 joint의 속도 |
| Gripper position | End-effector 위치 |
| Puck pose | Puck 위치와 orientation |
| Puck velocity | Puck의 linear/angular velocity |

Action은 7차원이며, 각 arm joint의 **현재 각도에 더할 relative target-angle offset**입니다.

$$
a_t \in \mathbb{R}^{7}
$$

Policy가 torque를 직접 출력하는 것이 아니라 position controller가 추종할 target angle을 출력합니다. 따라서 policy가 마주하는 실제 transition에는 rigid-body dynamics뿐 아니라 low-level controller gain과 timing도 포함됩니다.

이 구분이 중요합니다.

```text
policy action
    ↓ target joint-angle offset
position controller
    ↓ motor command
robot + contact dynamics
    ↓
next state
```

Dynamics randomization은 이 전체 closed loop의 불확실성을 다루어야 합니다.

### **2.3 Reward는 dense distance가 아니라 sparse binary reward**

Goal $g$는 puck의 목표 위치입니다. Puck 중심이 목표로부터 0.07 m 안에 들어오면 성공으로 봅니다.

$$
r(s_t,g)
=
\begin{cases}
0, & \lVert p_{\text{puck}}-g\rVert < 0.07 \text{ m}\\
-1, & \text{otherwise}
\end{cases}
$$

Real puck은 약 0.2 kg, 반지름은 0.065 m입니다. Puck 위치는 PhaseSpace motion-capture system으로 측정합니다.

매 step에서 goal distance에 비례하는 shaped reward를 준 것이 아닙니다. 성공 여부만 알려주는 sparse reward이므로, 그냥 DDPG를 적용하면 유용한 성공 transition을 얻기 어렵습니다.

그래서 **Hindsight Experience Replay, HER**를 사용합니다.

```text
원래 목표 g에는 실패한 trajectory
        ↓
실제로 도달한 최종 위치 g'를 새 목표로 재해석
        ↓
같은 transition을 성공 example로 replay
```

논문에서는 replay한 episode의 goal을 HER로 바꿀 확률을 $k=0.8$로 둡니다.

HER 때문에 과거 trajectory를 다른 goal로 다시 학습해야 하므로 off-policy algorithm이 필요합니다. 이 연결 때문에 이 논문의 학습 알고리즘은 PPO가 아니라 **DDPG의 recurrent extension인 RDPG**입니다.

---

## **3. Dynamics Randomization: 95개 Parameter를 어떻게 흔들었는가**

### **3.1 Randomization 대상과 범위**

저자들은 총 95개의 dynamics parameter를 randomize합니다. Parameter family와 원문 범위는 다음과 같습니다.

| Parameter family | Training range |
|---|---:|
| 각 link mass | Default의 $[0.25, 4]\times$ |
| 각 joint damping | Default의 $[0.2, 20]\times$ |
| Puck mass | $[0.1, 0.4]$ kg |
| Puck friction | $[0.1, 5]$ |
| Puck damping | $[0.01, 0.2]$ Ns/m |
| Table height | $[0.73, 0.77]$ m |
| Position-controller gains | Default의 $[0.5, 2]\times$ |
| Action-timestep rate $\lambda$ | $[125,1000]$ s$^{-1}$ |
| Observation noise | State feature별 Gaussian noise |

Mass, damping, friction, controller gain처럼 scale 차이가 큰 값은 log-uniform 방식으로 sample하고, 나머지는 uniform 방식으로 sample합니다.

예를 들어 link mass가 $0.25\times$에서 $4\times$, joint damping이 $0.2\times$에서 $20\times$까지 바뀝니다. Nominal model 주변의 작은 perturbation만 준 것이 아니라 상당히 넓은 범위를 사용했습니다.

### **3.2 Episode마다 고정되는 값과 매 step 바뀌는 값**

모든 randomization이 같은 시간 규모로 적용되는 것은 아닙니다.

**Episode 동안 고정되는 값**

- Link mass
- Joint damping
- Puck mass, friction, damping
- Table height
- Controller gain
- Action-timestep distribution의 rate $\lambda$

이 값들은 episode 시작에 sample되어 그 episode 동안 유지됩니다. Policy가 history를 보고 하나의 일관된 hidden dynamics를 추론할 수 있게 하는 구조입니다.

**매 step 바뀌는 값**

- 실제 action timestep
- Observation noise sample

Action timestep은 다음처럼 정의됩니다.

$$
\Delta t_t
=
\Delta t_0 + \operatorname{Exp}(\lambda),
\qquad
\Delta t_0 = 0.04 \text{ s}
$$

$\lambda$는 episode마다 $[125,1000]$ s$^{-1}$에서 sample되지만, exponential delay sample은 매 step 새로 뽑습니다. 즉 25 Hz nominal control period 위에 random delay를 더해 physical controller latency와 timing jitter를 단순하게 모델링합니다.

Observation에는 feature별 running standard deviation의 5%를 표준편차로 갖는 zero-mean Gaussian noise를 매 step 더합니다. Training action에는 표준편차 0.01 rad의 Gaussian exploration noise도 사용합니다.

이 구분을 정리하면 다음과 같습니다.

```text
episode-level latent context
    mass, damping, friction, gain, table height, latency rate

step-level stochasticity
    realized action delay, sensor-noise sample
```

Policy가 추론할 수 있는 것은 첫 번째 종류의 지속적인 context입니다. 두 번째 종류는 매번 달라지므로 정확히 식별하기보다 feedback으로 견뎌야 합니다.

### **3.3 Timing과 sensing도 dynamics다**

Dynamics randomization이라고 하면 보통 mass와 friction부터 떠올립니다. 하지만 이 논문의 real-robot ablation에서는 **action timestep과 observation noise가 오히려 가장 큰 영향**을 보였습니다.

Closed-loop system에서 transition은 물리식만으로 결정되지 않습니다.

$$
o_t
\xrightarrow{\pi}
a_t
\xrightarrow{\text{controller + delay}}
u_t
\xrightarrow{\text{robot/contact}}
s_{t+1}
\xrightarrow{\text{sensor + noise}}
o_{t+1}
$$

따라서 actuator command가 언제 적용되는지, sensor가 무엇을 얼마나 정확히 돌려주는지도 policy가 경험하는 dynamics의 일부입니다.

이 교훈은 legged robot으로 가면 더 중요해집니다. Contact-rich locomotion에서는 수 ms의 latency, motor strength, state-estimation noise가 foot touchdown과 balance correction을 바꿀 수 있기 때문입니다.

### **3.4 Nominal simulation과 real robot은 실제로 달랐다**

저자들은 같은 sinusoidal target trajectory를 simulated arm과 real arm에 입력하고 세 joint의 실제 motion을 비교했습니다.

![Simulation과 real Fetch의 joint trajectory 차이](/assets/img/posts/rl/sim2real/dynamics-randomization/04-sim-real-joint-trajectories.png){: width="880" .d-block .mx-auto }
_같은 target trajectory를 주어도 simulation과 real Fetch의 shoulder, elbow, wrist trajectory가 서로 다르다. Joint마다 phase delay와 amplitude mismatch의 정도도 다르다. 출처: [Peng et al., Figure 5](https://arxiv.org/pdf/1710.06537)._

이 그림은 “simulation이 꽤 정확해서 transfer가 된 것”이라는 해석을 막아 줍니다.

- Real pose는 target을 즉시 따라가지 않습니다.
- Simulation과 real의 phase lag가 다릅니다.
- Joint마다 mismatch가 동일하지도 않습니다.

저자들은 simulation을 실제 robot과 정밀하게 맞추기 위한 calibration을 거의 하지 않았다고 명시합니다. 그 대신 이 mismatch를 포함할 수 있는 distribution에서 policy를 학습했습니다.

---

## **4. Recurrent Policy는 어떻게 Dynamics에 적응하는가**

### **4.1 Robustness와 adaptation은 같은 말이 아니다**

Feedforward policy를 넓은 dynamics에서 학습시키면, 모든 상황에 평균적으로 무난한 action을 출력하는 robust policy를 얻을 수 있습니다.

$$
a_t = \pi(s_t,g)
$$

하지만 현재 puck이 무거운지, friction이 낮은지, controller response가 느린지에 따라 가장 좋은 action은 달라집니다. 현재 state 한 장만으로는 그 차이를 구분하기 어려울 수 있습니다.

예를 들어 같은 puck position에서도,

```text
이전 push에 거의 움직이지 않음
-> mass 또는 friction이 큰 상황일 수 있음

이전 push에 크게 미끄러짐
-> friction이 작거나 puck이 가벼울 수 있음
```

이 차이는 **이전 action과 그 결과**를 함께 봐야 드러납니다.

논문은 history

$$
h_t =
[a_{t-1},s_{t-1},a_{t-2},s_{t-2},\ldots]
$$

를 recurrent memory $z_t=z(h_t)$에 압축하고,

$$
a_t = \pi_{\theta}(s_t,z_t,g)
$$

로 action을 계산합니다.

저자들은 이 구조를 explicit parameter estimator와 구분합니다.

**Explicit online system identification**

$$
h_t
\rightarrow
\hat{\mu}_t
\rightarrow
\pi(a_t\mid s_t,\hat{\mu}_t,g)
$$

**이 논문의 implicit adaptation**

$$
h_t
\rightarrow
z_t
\rightarrow
\pi(a_t\mid s_t,z_t,g)
$$

$z_t$가 실제 mass나 friction 값을 직접 맞히도록 supervision하지 않습니다. Control return을 높이는 데 필요한 history representation을 end-to-end로 학습합니다.

따라서 정확한 표현은 **LSTM memory를 통한 implicit system identification 또는 history-based adaptation**입니다. “Policy가 실제 friction 값을 정확히 추정했다”고 말할 근거는 없습니다.

### **4.2 Policy network의 두 branch**

![LSTM policy architecture](/assets/img/posts/rl/sim2real/dynamics-randomization/03-policy-network.png){: width="1200" .d-block .mx-auto }
_Policy network는 current state와 previous action을 recurrent branch에 넣고, goal과 current state의 복사본은 feedforward branch로 보낸다. 두 feature를 합친 뒤 action을 출력한다. 출처: [Peng et al., Figure 4 top](https://arxiv.org/pdf/1710.06537)._

Policy architecture는 역할을 의도적으로 나눕니다.

**Recurrent branch**

- Input: current state $s_t$, previous action $a_{t-1}$
- 128-unit fully connected embedding
- 128-unit LSTM
- 역할: action에 대한 system response를 history로 누적해 dynamics context 추론

**Feedforward branch**

- Input: goal $g$, current state $s_t$의 복사본
- 역할: 현재 task geometry와 즉각적인 control decision 전달

두 branch의 feature를 concatenate한 뒤 128-unit fully connected layer 두 개를 통과시킵니다. Policy output은 tanh를 거쳐 각 action bound에 맞게 scaling됩니다.

Goal은 dynamics를 알려 주지 않으므로 recurrent branch에 넣지 않습니다. 반대로 current state는 dynamics inference와 현재 action 결정 모두에 중요하므로 양쪽 branch에 들어갑니다.

이 설계는 단순히 LSTM을 네트워크 앞에 붙인 것보다 해석이 분명합니다.

```text
history-dependent information -> recurrent path
instantaneous task information -> direct feedforward path
```

### **4.3 Policy에는 숨기고 critic에는 보여 준 $\mu$**

이 논문에서 가장 놓치기 쉬운 설계가 **omniscient critic**입니다.

Actor는 deployment 때 dynamics parameter를 알 수 없으므로 $\mu$를 입력받지 않습니다.

$$
\pi_{\theta}(a_t\mid s_t,z_t,g)
$$

하지만 critic은 simulation training 중에만 현재 $\mu$를 입력받습니다.

$$
Q_{\phi}(s_t,a_t,y_t,g,\mu)
$$

Simulator는 이번 episode의 mass, friction, damping, gain을 알고 있으므로 critic에 이 privileged information을 줄 수 있습니다. Critic은 “서로 다른 hidden dynamics에서 같은 transition이 왜 다른 return을 만드는지”를 더 쉽게 설명할 수 있고, actor에게 variance가 작은 gradient를 제공할 수 있습니다.

```text
training:
    actor  <- deployable observations only
    critic <- observations + sampled dynamics parameters

deployment:
    actor only
```

이것은 이후 robotics RL에서 자주 보이는 **asymmetric actor-critic**의 초기 형태로 읽을 수 있습니다.

중요한 claim boundary도 있습니다. Critic이 $\mu$를 안다고 해서 actor가 $\mu$를 정확히 복원했다는 뜻은 아닙니다. Actor는 critic이 제공한 learning signal을 통해 useful memory를 학습할 뿐입니다.

### **4.4 왜 RDPG와 HER인가**

학습 구성은 다음 세 요구사항에서 나옵니다.

1. 7D continuous action을 다뤄야 합니다.
2. Sparse goal reward를 HER로 replay해야 합니다.
3. History를 처리하는 recurrent policy가 필요합니다.

그래서 DDPG의 off-policy replay와 recurrent extension인 RDPG를 결합합니다.

간략한 흐름은 다음과 같습니다.

```text
1. goal g와 dynamics mu를 sample
2. recurrent policy로 한 episode rollout
3. episode 전체를 replay buffer에 저장
4. 0.8 확률로 achieved goal을 사용해 HER relabeling
5. sequence를 처음부터 통과시켜 actor/critic memory 계산
6. critic TD target과 deterministic policy gradient 업데이트
```

Episode 전체를 replay하는 이유는 recurrent memory가 과거 state-action sequence에 의존하기 때문입니다. Transition 한 개만 무작위로 꺼내면 그 시점의 LSTM state를 복원할 수 없습니다.

논문의 critic TD target을 개념적으로 쓰면 다음과 같습니다. 여기서 $m^Q_t$는 critic의 recurrent memory입니다.

$$
\hat{q}_t
=
r_t
+
\gamma
Q_{\bar{\phi}}
\left(
s_{t+1},
\pi_{\bar{\theta}}(s_{t+1},z_{t+1},g),
m^Q_{t+1},
g,
\mu
\right)
$$

Target network도 사용하지만 논문의 algorithm 표에서는 간결함을 위해 생략합니다.

여기서 actor, recurrent state, critic, HER, dynamics randomization은 따로 떨어진 장식이 아닙니다. 서로 다른 문제를 해결하는 구성입니다.

| 구성 | 해결하는 문제 |
|---|---|
| Dynamics randomization | 여러 transition model을 training에 노출 |
| LSTM policy | 숨겨진 dynamics를 history에서 암묵적으로 추론 |
| Omniscient critic | Training 중 알려진 $\mu$로 value estimation 안정화 |
| HER | Sparse goal reward에서 성공 example 재활용 |
| RDPG | Continuous action, off-policy replay, recurrent policy 학습 |

---

## **5. Training과 실험 결과**

### **5.1 Training 규모**

논문의 주요 training setting은 다음과 같습니다.

| 항목 | 값 |
|---|---:|
| MuJoCo simulation timestep | 0.002 s |
| Nominal control timestep | 0.04 s |
| Simulation episode | 100 control steps, 약 4 s |
| Real evaluation episode | 200 control steps |
| Batch | 128 episodes $\times$ 100 steps |
| Optimizer | Adam |
| Actor/critic learning rate | $5\times10^{-4}$ |
| HER relabel probability | 0.8 |
| Update iterations | 약 8,000 |
| Training samples | 약 100 million |
| Compute | 100-core cluster에서 약 8 hours |

오늘날 기준으로 architecture는 작지만, 2018년 당시 real robot에서 모으기 어려운 약 1억 개의 sample을 simulation에서 생성했다는 점이 중요합니다.

### **5.2 LSTM이 왜 필요했는가**

저자들은 네 architecture를 비교합니다.

| Model | Memory | Dynamics randomization |
|---|---|---|
| LSTM | Learned recurrent memory | 사용 |
| FF | 없음 | 사용 |
| FF + Hist | 과거 state/action 8개를 input에 직접 연결 | 사용 |
| FF no Rand | 없음 | 사용하지 않음 |

![Architecture별 simulation 학습 곡선](/assets/img/posts/rl/sim2real/dynamics-randomization/05-architecture-learning-curves.png){: width="820" .d-block .mx-auto }
_Randomized simulation에서 LSTM이 더 빠르게 학습하고 가장 높은 success에 수렴했다. Curve는 architecture마다 네 random seed를 사용한 결과다. 출처: [Peng et al., Figure 6](https://arxiv.org/pdf/1710.06537)._

실물 결과는 더 분명합니다.

![Architecture별 simulation과 real success](/assets/img/posts/rl/sim2real/dynamics-randomization/06-sim-real-success.png){: width="760" .d-block .mx-auto }
_Orange는 randomized simulation 100 trials, blue는 real Fetch 결과다. Randomization 없이 학습한 FF policy는 real에서 한 번도 성공하지 못했다. 출처: [Peng et al., Figure 7](https://arxiv.org/pdf/1710.06537)._

원문 Table II의 수치는 다음과 같습니다.

| Model | Success in randomized sim | Success on real robot | Real trials |
|---|---:|---:|---:|
| LSTM | $0.91 \pm 0.03$ | $0.89 \pm 0.06$ | 28 |
| FF no Rand | $0.51 \pm 0.05$ | $0.00 \pm 0.00$ | 10 |
| FF | $0.83 \pm 0.04$ | $0.67 \pm 0.14$ | 12 |
| FF + Hist | $0.87 \pm 0.03$ | $0.70 \pm 0.10$ | 20 |

해석은 세 단계로 나눠야 합니다.

1. **Randomization 없이 학습한 FF는 transfer되지 않았습니다.** Nominal simulation 하나에서 성공하는 전략은 randomized simulation에서도 0.51로 떨어졌고, real에서는 0/10이었습니다.

2. **Memory가 없어도 randomization 자체가 큰 도움을 줬습니다.** FF는 real에서 $0.67$의 성공률을 보였습니다. Dynamics distribution에서 학습하는 것만으로도 robust behavior가 생긴다는 뜻입니다.

3. **LSTM이 가장 높은 real success를 보였습니다.** 고정 길이 history를 그대로 넣는 FF + Hist보다 learned recurrent state가 simulation과 real 모두에서 더 좋았습니다.

다만 real trial 수가 model별 10-28회로 작습니다. 따라서 $0.89$와 $0.70$의 차이를 대규모 benchmark처럼 해석하면 안 됩니다. 이 실험은 recurrent adaptation의 가능성을 보여 주는 evidence이지, 모든 pushing condition에 대한 확정적인 ranking은 아닙니다.

### **5.3 어떤 Randomization이 실제로 중요했는가**

LSTM policy에서 일부 randomization을 제거하고 real robot에 배포한 ablation은 다음과 같습니다.

| Training configuration | Real success | Trials |
|---|---:|---:|
| All randomization | $0.89 \pm 0.06$ | 28 |
| Fixed action timestep | $0.29 \pm 0.11$ | 17 |
| No observation noise | $0.25 \pm 0.12$ | 12 |
| Fixed link mass | $0.64 \pm 0.10$ | 22 |
| Fixed puck friction | $0.48 \pm 0.10$ | 27 |

가장 큰 하락은 fixed action timestep과 no observation noise에서 나타납니다.

이 결과는 중요한 반례를 줍니다.

> Dynamics randomization은 URDF의 mass와 friction만 바꾸는 작업이 아니다.

실제 deployment에서 policy가 만나는 control frequency, latency, sensor uncertainty가 simulation과 다르면, 물리 parameter를 넓게 흔들어도 transfer가 실패할 수 있습니다.

물론 이 ablation도 각 조건의 trial 수가 다르고 seed 수준의 통계가 충분하지 않습니다. “Observation noise가 항상 link mass보다 중요하다”는 일반 법칙으로 확대하기보다, **이 Fetch setup에서는 timing과 sensing mismatch가 핵심 bottleneck이었다**고 읽는 편이 정확합니다.

### **5.4 Training 범위 밖처럼 보이는 Contact 변화에도 버텼다**

저자들은 real puck 바닥에 과자 봉지를 붙여 mass와 table contact texture를 동시에 바꿨습니다.

![Contact dynamics를 바꾼 puck pushing](/assets/img/posts/rl/sim2real/dynamics-randomization/07-changed-contact-dynamics.png){: width="1200" .d-block .mx-auto }
_Puck 아래에 과자 봉지를 붙여 friction과 contact dynamics를 바꾼 실물 robustness test. 출처: [Peng et al., Figure 3 bottom](https://arxiv.org/pdf/1710.06537)._

| Real condition | Success |
|---|---:|
| Original puck | $0.89 \pm 0.06$ |
| Puck with attached packet | $0.91 \pm 0.04$ |

성공률이 유지되었다는 점은 policy가 nominal puck 하나에만 맞춰진 open-loop trajectory가 아니라 feedback과 memory를 사용했음을 뒷받침합니다.

하지만 이 결과를 “임의의 unseen object dynamics에 generalize했다”고 확대하면 안 됩니다. 하나의 hand-crafted physical modification에 대한 small-scale robustness test입니다.

### **5.5 Sparse reward인데도 correction behavior가 나타났다**

저자들은 policy가 단순히 한 방향으로 puck을 세게 치는 데 그치지 않았다고 보고합니다.

- Puck이 목표를 overshoot하면 다시 correction합니다.
- 미세 조정이 필요할 때 puck의 한쪽을 눌러 살짝 세운 뒤 움직입니다.
- 상황에 따라 puck의 위쪽 또는 옆쪽에서 접촉합니다.

이 behavior들은 dense motion template 없이 binary success reward와 HER에서 나타났습니다.

여기서 HER의 역할을 다시 볼 수 있습니다. HER가 “올바른 pushing 전략”을 직접 가르친 것은 아닙니다. 실패 trajectory도 다른 goal에 대한 성공 data로 바꾸어, critic이 state-action과 achievable goal의 관계를 더 많이 학습하게 한 것입니다.

---

## **6. 이론적으로 어떻게 이해할 수 있는가**

### **6.1 하나의 MDP가 아니라 Dynamics-parameterized MDP**

일반적인 MDP는 다음과 같습니다.

$$
\mathcal{M}
=
(\mathcal{S},\mathcal{A},P,R,\gamma)
$$

Dynamics parameter $\mu$를 넣으면 transition이 달라집니다.

$$
\mathcal{M}_{\mu}
=
(\mathcal{S},\mathcal{A},P_{\mu},R,\gamma)
$$

Nominal simulation 하나에서 학습하는 objective는

$$
\max_{\pi} J(\pi;\mu_{\text{nominal}})
$$

이지만, dynamics randomization은

$$
\max_{\pi}
\mathbb{E}_{\mu\sim\rho_{\mu}}
\left[
J(\pi;\mu)
\right]
$$

를 최적화합니다.

즉 policy는 하나의 model에서 최고 점수를 내는 대신, sampled dynamics distribution에서 평균적으로 높은 return을 내야 합니다.

여기서 주의할 점은 이것이 **worst-case robust control** objective는 아니라는 것입니다.

$$
\mathbb{E}_{\mu\sim\rho_\mu}[J]
\neq
\min_{\mu\in\mathcal{U}}J
$$

Training distribution에서 드물게 sample되는 극단적인 dynamics는 평균 objective에서 영향이 작을 수 있습니다. Safety-critical deployment에서 최악 조건을 보장하려면 별도의 risk-sensitive objective나 validation이 필요합니다.

### **6.2 Actor 관점에서는 POMDP다**

Simulator는 $\mu$를 알지만 actor에게는 주지 않습니다. 따라서 actor 관점에서는 hidden context가 있는 partially observable problem입니다.

$$
\tilde{s}_t = (s_t,\mu),
\qquad
o_t=s_t
$$

Current observation만으로 $\mu$를 알 수 없으므로, optimal action은 history에 의존할 수 있습니다.

$$
a_t
\sim
\pi(a_t\mid h_t,g)
$$

LSTM hidden state는 엄밀한 Bayesian belief state는 아니지만, 다음과 같은 belief-like summary로 볼 수 있습니다.

$$
z_t
\approx
f(h_t)
\approx
\text{task-relevant belief about }\mu
$$

중요한 것은 “task-relevant”입니다. Control에 필요 없는 parameter까지 정확히 복원할 이유는 없습니다. 서로 다른 mass와 friction 조합이 같은 optimal action을 요구한다면 LSTM은 둘을 구분하지 않아도 됩니다.

### **6.3 Real dynamics가 distribution 안에 있으면 충분한가**

Dynamics randomization을 설명할 때 흔히 다음 조건을 씁니다.

$$
\mu_{\text{real}}
\in
\operatorname{support}(\rho_{\mu})
$$

하지만 이것은 직관이지 transfer 보장이 아닙니다.

- Real system에는 simulator parameter로 표현하지 못한 unmodeled dynamics가 있을 수 있습니다.
- 각 parameter 범위가 real 값을 포함해도 parameter 간 correlation이 비현실적일 수 있습니다.
- Observation, reset state, contact geometry가 다르면 dynamics support만으로 부족합니다.
- Policy optimization이 distribution 전체에서 좋은 solution을 찾았다는 보장도 없습니다.

따라서 더 정확한 표현은 다음입니다.

> Randomized simulation이 real deployment에서 중요한 closed-loop behavior를 충분히 포함하고, policy가 그 variation을 구분하거나 견디는 전략을 학습해야 transfer 가능성이 높아진다.

### **6.4 Randomization range는 task design의 일부다**

Range가 너무 좁으면 real system이 distribution 밖에 남습니다.

```text
narrow range
-> nominal simulator overfitting
-> real transition is unfamiliar
```

Range가 너무 넓으면 task 자체가 모호하거나 지나치게 어려워질 수 있습니다.

```text
overly broad range
-> incompatible optimal actions mixed together
-> slow or conservative behavior
-> training instability
```

그리고 모든 parameter를 독립적으로 randomize하면 현실에 존재하지 않는 조합이 생길 수 있습니다. 예를 들어 motor strength, battery voltage, latency, damping은 실제 hardware에서 서로 상관될 수 있습니다.

이 논문은 range를 사람이 직접 정합니다. 어떤 distribution이 최적인지 자동으로 찾는 방법은 제시하지 않습니다. 이것은 이후 Automatic Domain Randomization이나 adaptive curriculum 계열이 다루는 문제로 이어집니다.

---

## **7. Legged Robot Sim2Real로 가져가면 무엇이 달라지는가**

이 논문의 핵심 구조는 locomotion에도 그대로 이어집니다.

| Fetch pushing의 요소 | Legged locomotion에서 대응되는 요소 |
|---|---|
| Link mass | Base/leg mass와 payload |
| Joint damping | Motor, gearbox, joint friction |
| Puck friction | Foot-ground friction |
| Controller gain | PD gain, actuator response |
| Action timestep | Policy latency, control jitter |
| Observation noise | IMU, encoder, state-estimator noise |
| LSTM memory | Contact와 actuator dynamics의 online adaptation |
| Omniscient critic $\mu$ | Simulation privileged information |

하지만 locomotion은 더 어렵습니다.

- Floating base라서 balance가 깨지면 episode가 즉시 끝날 수 있습니다.
- Contact가 네 발 사이에서 빠르게 switching됩니다.
- Terrain geometry와 friction이 공간적으로 달라집니다.
- Actuator saturation, thermal limit, battery voltage가 중요합니다.
- IMU bias와 state-estimation error가 feedback loop에 직접 들어갑니다.
- Real hardware exploration의 safety cost가 큽니다.

따라서 “Fetch에서 95개 parameter를 randomize했으니 Go2에서도 같은 목록을 쓰면 된다”는 식으로 가져오면 안 됩니다.

Legged robot에서는 deployment failure mode에서 거꾸로 randomization axis를 정해야 합니다.

```text
real failure observation
    ↓
which transition/observation mismatch caused it?
    ↓
add physically plausible randomization
    ↓
check whether reward hacking or conservative gait appears
    ↓
holdout dynamics + real low-risk validation
```

또한 actuator model과 action semantics를 보존해야 합니다. Torque policy, joint-position target policy, learned actuator model은 같은 randomization range를 공유하지 않습니다.

---

## **8. 무엇을 보여 줬고, 무엇은 아직 아닌가**

### **8.1 이 논문이 보여 준 것**

- MuJoCo에서만 학습한 recurrent control policy를 실제 Fetch arm에 추가 학습 없이 배포했습니다.
- 95개 dynamics parameter를 randomize하고, timing과 observation noise까지 closed-loop uncertainty에 포함했습니다.
- Randomization 없는 FF policy는 real test 10회에서 성공하지 못했습니다.
- LSTM policy는 real 28 trials에서 $0.89\pm0.06$ success를 기록했습니다.
- Action timestep과 observation noise randomization 제거가 큰 성능 저하로 이어졌습니다.
- LSTM policy가 변경된 puck contact condition에서도 비슷한 success를 유지했습니다.

### **8.2 이 결과만으로 말할 수 없는 것**

**첫째, LSTM이 실제 dynamics parameter를 정확히 식별했다는 증거는 아닙니다.**

Hidden state를 mass/friction ground truth와 비교한 identification analysis가 없습니다. 성능 차이는 history가 유용하다는 evidence이지, interpretable SysID 정확도 검증은 아닙니다.

**둘째, 모든 real contact variation에 대한 generalization 결과가 아닙니다.**

Main task와 한 종류의 modified puck condition에서 평가했습니다.

**셋째, vision-based end-to-end transfer가 아닙니다.**

Puck position은 PhaseSpace motion capture로 측정합니다. Camera image에서 object pose를 추정하는 perception gap은 다루지 않습니다.

**넷째, large-scale real benchmark가 아닙니다.**

Architecture별 real trial 수가 10-28회이고, 조건마다 trial 수가 다릅니다. 결과는 설계 방향을 보여 주지만 정밀한 statistical comparison에는 제한적입니다.

**다섯째, safety와 hardware limit를 체계적으로 다루지 않습니다.**

Collision, actuator thermal state, torque saturation, emergency recovery 같은 deployment layer는 논문의 중심이 아닙니다.

**여섯째, randomization distribution은 수동 설계입니다.**

Real data로 range를 자동 보정하거나, transfer failure에 따라 curriculum을 업데이트하지 않습니다.

**일곱째, 평균 성능 objective가 worst-case guarantee를 주지는 않습니다.**

Training distribution의 tail이나 support 밖 조건에서는 실패할 수 있습니다.

---

## **9. 정리하며: Randomization만큼 중요한 것은 Adaptation이다**

이번 논문의 흐름은 다음과 같습니다.

```text
정확한 real dynamics를 알기 어렵다
        ↓
simulation의 dynamics를 episode마다 randomize한다
        ↓
policy에는 mu를 숨긴다
        ↓
state-action history로 현재 dynamics에 필요한 context를 추론한다
        ↓
critic은 training 때 mu를 보고 더 안정적으로 value를 학습한다
        ↓
simulation-only policy를 real Fetch에 바로 배포한다
```

핵심을 다시 정리하면 다음과 같습니다.

- Dynamics randomization은 fixed simulator가 아니라 dynamics distribution에서 policy를 학습하는 방법입니다.
- 이 논문은 mass와 friction뿐 아니라 controller gain, action timing, observation noise까지 randomize했습니다.
- Task는 7-DOF Fetch arm의 puck pushing이며, state는 52D, action은 7D relative joint target입니다.
- Sparse binary reward를 학습하기 위해 HER를 사용했고, recurrent off-policy learning을 위해 RDPG를 사용했습니다.
- LSTM은 state-action history를 task-relevant dynamics context로 압축합니다.
- Actor는 dynamics parameter를 보지 않지만, critic은 simulation에서만 $\mu$를 받는 omniscient critic입니다.
- LSTM은 real robot에서 $0.89\pm0.06$ success를 보였고, randomization 없는 FF는 0/10이었습니다.
- Action timestep과 observation noise를 고정하면 real success가 각각 0.29, 0.25로 크게 떨어졌습니다.
- 다만 small-scale pushing 실험이며, explicit parameter identification이나 broad real-world guarantee를 증명한 것은 아닙니다.

2편의 visual domain randomization이

> Real image를 simulation appearance distribution의 한 sample로 만들자.

였다면, 3편의 dynamics randomization은

> Real closed-loop system을 training dynamics distribution 안에서 policy가 적응 가능한 한 경우로 만들자.

라고 정리할 수 있습니다.

다음 글에서는 이 생각이 quadruped locomotion으로 넘어가면서 actuator model, latency, reference motion, system identification과 어떻게 결합되는지 살펴보겠습니다.

## **참고 자료**

- [Peng et al., arXiv paper and source](https://arxiv.org/abs/1710.06537)
- [Peng et al., ICRA 2018 publication](https://doi.org/10.1109/ICRA.2018.8460528)
- [Supplementary video](https://youtu.be/XUW0cnvqbwM)
- [Hindsight Experience Replay](https://arxiv.org/abs/1707.01495)
- [Deep Deterministic Policy Gradient](https://arxiv.org/abs/1509.02971)
