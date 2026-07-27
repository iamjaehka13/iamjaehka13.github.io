---
title: "[Sim2Real Paper 5] Agile and Dynamic Motor Skills"
date: 2026-06-24 17:33:00 +0900
last_modified_at: 2026-07-27 22:47:54 +0900
categories: [RL, Sim2Real, Paper]
tags: [sim2real, legged-robots, anymal, actuator-network, hybrid-simulator, trpo, system-identification, dynamics-randomization]
description: Hwangbo et al.의 ANYmal Sim2Real을 hybrid simulator, actuator network, stochastic rigid-body model, TRPO policy, 정량 실기체 결과와 ablation까지 원문 기준으로 정리한다.
math: true
image:
  path: /assets/img/posts/rl/sim2real/agile-motor-skills/00-preview.png
  alt: Stochastic rigid-body model과 learned actuator network를 결합한 ANYmal Sim2Real 학습 절차
---

## **0. 전체 그림: Actuator를 대충 모델링하면 왜 걷지도 못할까**

이전 글: [Learning Agile Locomotion: Minitaur의 actuator model과 dynamics randomization](/posts/learning-agile-locomotion-quadruped-robots/)

앞선 Tan et al.의 Minitaur 논문은 actuator response와 control latency를 simulator에 넣고, 남은 차이를 dynamics randomization으로 덮었다.

Hwangbo et al.의 **Learning agile and dynamic motor skills for legged robots**는 이 문제를 32 kg급 quadruped인 ANYmal에서 더 깊게 파고든다.

ANYmal의 12개 joint는 **Series Elastic Actuator, SEA**로 구동된다. Policy가 joint position target 하나를 내도 실제 joint torque가 만들어지기까지 다음 과정이 이어진다.

| 단계 | 입력에서 출력으로 | Reality gap의 원인 |
|---|---|---|
| Policy | Observation $\rightarrow$ position target | Observation noise, policy extrapolation |
| Joint-level PD | Position error $\rightarrow$ desired torque | Gain, sampling, delay |
| Current controller | Desired torque $\rightarrow$ desired motor current | Internal controller state, bandwidth |
| Field-oriented control | Current command $\rightarrow$ phase voltage | Electrical dynamics |
| Physical actuator | Voltage $\rightarrow$ measured joint torque | Motor, transmission, friction, elastic element |

여기에 communication delay, sensor filtering, controller 내부 상태, nonlinear friction과 actuator bandwidth까지 들어간다. 이 전체를 손으로 정확히 식별하기는 어렵다.

논문의 해법: simulator를 두 부분으로 분리.

1. Link, inertia, contact처럼 물리식으로 잘 기술되는 부분은 **rigid-body simulator**가 계산한다.
2. Command에서 torque까지의 복잡한 부분은 실제 robot data로 학습한 **actuator network**가 계산한다.

![Hwangbo et al.의 전체 Sim2Real 절차](/assets/img/posts/rl/sim2real/agile-motor-skills/00-preview.png){: width="1200" .d-block .mx-auto }
_CAD 기반 stochastic rigid-body model을 만들고, 실제 actuator data로 actuator net을 학습한 뒤, 둘을 결합한 hybrid simulator에서 policy를 학습해 ANYmal에 직접 배포한다. 출처: [Hwangbo et al., Figure 1](https://arxiv.org/pdf/1901.08652)._

> 같은 RL 절차를 사용해도 ideal actuator model과 손으로 맞춘 analytical actuator model로 학습한 policy는 실제 robot에서 한 걸음도 떼지 못했다. 반면 learned actuator model을 넣은 policy는 별도의 real-world fine-tuning 없이 transfer되었다.

> 잘 아는 dynamics는 physics로 남기고, 현실적으로 식별하기 어려운 subsystem만 data-driven model로 바꾸면 빠르면서도 충분히 현실적인 simulator를 만들 수 있다.

여기서 neural network가 전체 physics를 대체한 것은 아니다. Rigid body와 contact는 analytical simulator에 남기고 command-to-torque subsystem만 actuator net이 담당한다. 또한 4분 미만의 real actuator data가 simulator identification에 들어갔으므로 real data가 전혀 없는 설정도 아니다. Policy의 trial-and-error만 simulation에서 수행됐다.

Actuator model의 가치는 torque prediction graph 하나가 아니라 real-robot ablation에서 드러난다. 같은 pipeline에서 model만 바꿨을 때 transfer 성공 여부가 갈렸다. Locomotion, high speed와 recovery도 하나의 universal controller가 아니라 pipeline을 공유하는 별도 policy.

---

## **1. 논문 정보**

| 항목 | 내용 |
|---|---|
| Title | Learning agile and dynamic motor skills for legged robots |
| Authors | Jemin Hwangbo, Joonho Lee, Alexey Dosovitskiy, Dario Bellicoso, Vassilios Tsounis, Vladlen Koltun, Marco Hutter |
| Venue | Science Robotics, 2019 |
| Robot | ANYmal, 약 32 kg, 12 series elastic actuators |
| Tasks | Command-conditioned locomotion, high-speed locomotion, fall recovery |
| RL algorithm | Trust Region Policy Optimization, TRPO |
| Policy action | 12개 low-impedance joint position targets |
| Simulator | Stochastic rigid-body simulator + learned actuator networks |
| Transfer | Simulation-only policy training 후 real ANYmal에 직접 배포 |
| 핵심 근거 | Actuator prediction 오차, actuator-model ablation, real tracking·speed·recovery 결과 |
| Source | [arXiv](https://arxiv.org/abs/1901.08652), [Science Robotics DOI](https://doi.org/10.1126/scirobotics.aau5872), [공식 요약 영상](https://youtu.be/aTDkYFZFWug) |

이 논문은 세 가지 서로 다른 task를 보여주지만, 하나의 policy가 세 가지를 모두 수행하는 것은 아니다.

| 구분 | 세 task의 구성 |
|---|---|
| 공통 | Hybrid simulator, observation/action 설계, TRPO training pipeline |
| task별로 다름 | Reward, command distribution, initial-state distribution, trained policy weights |

따라서 이 논문의 기여는 universal controller보다 **여러 동적 skill을 실제 robot으로 옮길 수 있는 reusable training pipeline**에 가깝다.

---

## **2. Reality Gap을 어디에서 줄였는가**

### **2.1 Policy action은 실제 torque가 아니다**

Robot dynamics를 가장 단순하게 쓰면

$$
x_{t+1}=F(x_t,a_t)
$$

하지만 이 논문에서 policy action $a_t$는 torque가 아니라 desired joint position $q_t^{\mathrm{des}}$이다. 실제 transition은 적어도 두 단계로 나뉜다.

$$
\tau_t
=
G\left(q_t^{\mathrm{des}},x_t,h_t\right)
$$

$$
x_{t+1}
=
F_{\mathrm{rigid}}\left(x_t,\tau_t;\theta\right)
$$

- $G$: actuator, low-level controller, communication과 mechanical response
- $h_t$: 직접 보이지 않는 actuator state를 대신하는 history
- $F_{\mathrm{rigid}}$: link와 contact의 rigid-body dynamics
- $\theta$: mass, center of mass, joint location 등의 model parameter

Rigid-body model을 아무리 잘 만들어도 $G$가 틀리면 같은 action에서 다른 torque가 나온다. 그러면 foot-contact timing과 impulse가 바뀌고, 그 차이가 다음 state와 다음 action으로 누적된다.

이 때문에 actuator error는 부차적인 torque 오차가 아니라 **policy가 학습하는 transition kernel의 오차**.

### **2.2 Hybrid simulator의 닫힌 loop**

![Hybrid simulator의 policy와 actuator network](/assets/img/posts/rl/sim2real/agile-motor-skills/05-hybrid-simulator.png){: width="900" .d-block .mx-auto }
_Policy net은 observation과 joint-state history에서 position target을 만들고, actuator net은 velocity·position-error history에서 12개 torque를 예측한다. Rigid-body simulator가 그 torque로 다음 state를 계산한다. 출처: [Hwangbo et al., Figure 5](https://arxiv.org/pdf/1901.08652)._

그림의 한 cycle에서는 아래 연산이 반복된다.

1. Rigid-body simulator가 generalized coordinate $q$와 velocity $u$를 계산한다.
2. Joint velocity와 position error를 history buffer에 저장한다.
3. Policy가 body state, history, previous action과 command를 읽는다.
4. Policy가 12개 joint position target을 출력한다.
5. Actuator net이 각 joint torque를 예측한다.
6. 예측 torque를 rigid-body simulator에 적용해 다음 state를 만든다.

Actuator net은 deploy되는 policy 내부 module이 아니다. **Policy를 학습할 때만 simulator 내부에서 real actuator response를 흉내 내는 model**이다.

실제 robot에서는 진짜 actuator와 low-level controller가 그 역할을 한다.

### **2.3 빠른 simulator도 방법론의 일부다**

논문에 보고된 계산량은 아래와 같다.

| 항목 | 논문 수치 |
|---|---:|
| Rigid-body simulator 단독 | 약 900,000 time steps/s |
| Actuator nets 포함 hybrid simulator | 약 500,000 time steps/s |
| Real time 대비 | 약 1,000배 |
| 학습 hardware | 일반 desktop의 CPU 1개 + GPU 1개 |
| 가장 긴 training session | 11시간 이하 |
| Policy inference | single CPU thread에서 약 25 $\mu$s |

Hybrid simulator 실행 시간의 약 절반은 actuator nets 평가에 사용되었다. 즉 learned model은 공짜가 아니지만, 수억 개 transition을 생성할 수 있을 만큼 작고 빠르게 설계되었다.

여기서 중요한 trade-off는 다음.

| Simulator 설계 | 장점 | 실패 지점 |
|---|---|---|
| 지나치게 단순한 model | 빠른 sample 생성 | Actuator delay와 bandwidth mismatch로 transfer 실패 가능 |
| 지나치게 복잡한 model | 높은 nominal fidelity 가능 | RL에 필요한 수억 transition 생성이 느림 |
| Hybrid simulator | Tractable physics와 작은 learned subsystem 결합 | Real actuator 계측과 model coverage가 필요 |

---

## **3. Stochastic Rigid-Body Model**

### **3.1 Nominal model은 CAD에서 시작한다**

ANYmal의 link geometry와 inertial property는 CAD model에서 가져온다. Contact는 Coulomb friction cone을 존중하는 hard-contact solver로 계산한다.

하지만 CAD가 곧 실제 robot은 아니다.

- Cable과 electronics의 mass가 완전히 반영되지 않을 수 있다.
- 조립 오차로 center of mass와 joint 위치가 달라질 수 있다.
- Robot configuration과 payload가 바뀔 수 있다.

저자들은 inertial property에 최대 약 20%의 오차가 있을 수 있다고 봤다.

### **3.2 하나의 ANYmal이 아니라 30개 model에서 학습한다**

Policy는 30개의 stochastic ANYmal model에서 학습된다.

| Randomized quantity | Distribution |
|---|---|
| Link center of mass position | nominal + $U(-2,2)$ cm |
| Link mass | nominal + $U(-15,15)$% |
| Joint position | nominal + $U(-2,2)$ cm |

목적함수는 다음처럼 해석할 수 있다.

$$
\max_{\pi}
\mathbb{E}_{\theta\sim p(\theta)}
\left[
J(\pi;F_{\mathrm{rigid}},f_\phi,\theta)
\right]
$$

여기서 $f_\phi$는 actuator net이다.

이 구조에서 두 도구의 역할은 다르다.

| 도구 | 줄이려는 gap |
|---|---|
| CAD와 rigid-body identification | nominal physics의 중심 오차 |
| Actuator network | command-to-torque의 systematic mismatch |
| Dynamics randomization | 남아 있는 inertial·kinematic uncertainty |
| Observation noise | simulator sensor와 real estimator의 차이 |

즉 randomization으로 모든 것을 덮는 것이 아니다. **평균 model을 먼저 현실 쪽으로 옮기고, 그 주변의 uncertainty만 distribution으로 만든다.**

---

## **4. Actuator Network를 자세히 보기**

### **4.1 왜 analytical SEA model이 어려운가**

ANYmal SEA는 motor, high-ratio transmission, elastic element와 encoder 두 개로 구성된다.

Command-to-torque chain 안에는 다음 hidden state가 존재한다.

- Joint-level PD controller state
- Desired-current PID state
- Motor velocity
- Field-oriented controller dynamics
- Transmission friction과 damping
- Spring deflection
- 여러 software/hardware layer의 delay

저자들이 인용한 기존 analytical SEA model은 거의 100개 parameter를 요구했다. 일부 parameter는 측정할 수 있지만, 일부는 datasheet를 믿거나 실험적으로 맞춰야 한다.

특히 limited bandwidth가 있는 SEA에서는 response delay가 amplitude에 따라 달라질 수 있다. 고정 latency 하나를 넣는 것만으로는 충분하지 않다.

### **4.2 입력은 현재값 하나가 아니라 짧은 history다**

Position error를 다음처럼 정의하겠다.

$$
e_t=q_t^{\mathrm{des}}-q_t
$$

Actuator net은 joint별로 다음 값을 받는다.

$$
\hat{\tau}_t
=
f_\phi
\left(
e_t,\dot q_t,
e_{t-10\mathrm{ms}},\dot q_{t-10\mathrm{ms}},
e_{t-20\mathrm{ms}},\dot q_{t-20\mathrm{ms}}
\right)
$$

현재와 10 ms, 20 ms 전 state를 함께 쓰는 이유는 actuator가 partially observable하기 때문이다.

같은 현재 error라도,

- 방금 target이 급격히 변한 경우
- 오랫동안 같은 target을 추종한 경우
- 반대 방향으로 움직이다가 정지한 경우

실제 torque는 다를 수 있다. 짧은 history가 hidden controller state와 response delay의 흔적을 제공한다.

History가 길수록 무조건 좋은 것은 아니다.

- 너무 짧거나 sparse하면 high-frequency dynamics를 놓친다.
- 너무 길거나 dense하면 overfitting과 계산량이 증가한다.
- 최소한 communication delay와 mechanical response time보다 긴 window가 필요하다.

논문은 validation error를 보며 이 구성을 경험적으로 정했다.

### **4.3 4분 미만의 real data를 어떻게 모았는가**

Actuator net은 supervised regression으로 학습된다.

$$
\mathcal{L}_{\mathrm{act}}
=
\frac{1}{N}\sum_t
\left\|
\tau_t^{\mathrm{measured}}
-
f_\phi(e_{t:t-h},\dot q_{t:t-h})
\right\|_2^2
$$

Data collection controller는 sine-wave foot trajectory를 만들고 inverse kinematics로 joint target을 계산했다.

| Data-collection setting | 값 |
|---|---:|
| Foot trajectory amplitude | 5-10 cm |
| Foot trajectory frequency | 1-25 Hz |
| Sampling rate | 400 Hz |
| Collection time | 4분 미만 |
| Dataset size | 100만 samples 이상 |
| Train/validation split | 약 90% / 10% |

12개 actuator에서 동시에 data가 들어오기 때문에 짧은 시간에도 sample 수가 많다. 저자들은 사람이 robot을 밀어 disturbance도 추가했다.

Sample 개수보다 **excitation coverage**를 봐야 한다. 낮은 frequency만 수집하면 locomotion policy가 만드는 빠른 command에서 model이 부정확해지고, simulation 안에서 비현실적인 oscillation이 생겼다.

### **4.4 Network는 작고 bounded하다**

각 actuator network는 다음 구조.

| Layer | 구성 |
|---|---|
| Input | Current, 10 ms, 20 ms 전 velocity와 position-error history |
| Hidden 1-3 | 각 32 units, softsign |
| Output | Predicted joint torque |

12개 joint를 모두 평가하는 데 걸린 시간은 activation에 따라 다음과 같았다.

| Activation | 12 actuators inference |
|---|---:|
| softsign | 12.2 $\mu$s |
| tanh | 31.6 $\mu$s |

두 activation의 validation RMS는 비슷한 0.7-0.8 Nm였고, 저자들은 더 빠른 softsign을 선택했다.

### **4.5 Torque prediction에서 무엇이 달라졌는가**

![Learned actuator model과 ideal actuator model의 torque 예측](/assets/img/posts/rl/sim2real/agile-motor-skills/06-actuator-model-validation.png){: width="1300" .d-block .mx-auto }
_초록 점선은 measured torque, 빨간 실선은 learned model, 주황 dash-dot은 zero-delay·infinite-bandwidth를 가정한 ideal model이다. A는 validation data, B-E는 실제 learned locomotion/high-speed policy가 만든 test data다. 출처: [Hwangbo et al., Figure 6](https://arxiv.org/pdf/1901.08652)._

| Dataset | Learned actuator RMS | Ideal model RMS |
|---|---:|---:|
| Validation set | 0.740 Nm | 3.55 Nm |
| Trained policy가 만든 test data | 0.966 Nm | 5.74 Nm |

Test error가 validation error보다 커졌다는 점도 중요하다. Data-collection controller와 learned locomotion policy가 만드는 state distribution이 완전히 같지 않기 때문이다.

그럼에도 learned model의 test error는 ideal model보다 훨씬 작았다.

이 결과가 보여주는 것은 **torque prediction fidelity**이다. 이것만으로 policy transfer를 증명하는 것은 아니다. Transfer 근거는 다음 actuator-model ablation에서 나온다.

### **4.6 결정적 ablation: torque graph가 아니라 실제 한 걸음**

저자들은 policy training 절차는 동일하게 두고 actuator model만 세 종류로 바꿨다.

| Model | 가정 |
|---|---|
| Ideal | Zero latency, infinite bandwidth |
| Analytical | 실제 controller code + CAD/실험 parameter + hand-tuned latency·damping·friction |
| Learned | Real command/state/torque data로 학습한 history-conditioned network |

결과는 명확했다.

- Ideal model policy: 실제 ANYmal에서 한 걸음도 떼기 전에 넘어짐
- Analytical model policy: 실제 ANYmal에서 한 걸음도 떼기 전에 넘어짐
- Learned model policy: real locomotion transfer 성공

두 alternative policy에서는 limb가 격하게 떨렸다. 저자들은 multiple delay와 limited bandwidth를 충분히 설명하지 못한 것이 원인일 가능성이 높다고 해석했다.

Analytical model은 대충 만든 baseline도 아니다. 실제 controller code와 identified parameter를 넣고, latency·damping·friction을 real data에 맞춰 **일주일 이상** 조정했지만 성공하지 못했다.

관련 supplementary video:

- [Ideal actuator model policy](https://youtu.be/NYMEA2PD9rQ)
- [Analytical actuator model policy](https://youtu.be/WbRXZKUR5Ew)
- [Learned actuator model policy](https://youtu.be/23mBeaGmQ2o)

다만 이 ablation을 일반 법칙으로 확대하면 안 된다.

> 이 결과는 ANYmal SEA와 당시 analytical modeling setup에서 learned actuator model이 결정적이었다는 강한 platform-specific evidence다. 모든 robot에서 analytical actuator model이 항상 실패한다는 뜻은 아니다.

---

## **5. Policy는 무엇을 보고 무엇을 출력하는가**

### **5.1 RL algorithm은 TRPO다**

이 논문은 PPO나 SAC가 아니라 **Trust Region Policy Optimization, TRPO**를 사용한다.

목적은 일반적인 discounted return maximization.

$$
\pi^*
=
\arg\max_\pi
\mathbb{E}_{\tau\sim p_\pi}
\left[
\sum_{t=0}^{\infty}\gamma^t r_t
\right]
$$

TRPO는 update 전후 policy가 지나치게 멀어지지 않도록 KL divergence constraint를 둔다.

$$
\max_\theta
\mathbb{E}
\left[
\frac{\pi_\theta(a_t\mid o_t)}
{\pi_{\theta_{\mathrm{old}}}(a_t\mid o_t)}
A_t
\right]
$$

subject to

$$
\mathbb{E}
\left[
D_{\mathrm{KL}}
\left(
\pi_{\theta_{\mathrm{old}}}
\;\|\;
\pi_\theta
\right)
\right]
\le \delta
$$

저자들은 모든 task에 원 TRPO의 default parameter를 사용했다고 보고한다. 약 2.5억 transition을 4시간가량에 생성·처리할 수 있었던 것은 algorithm 자체보다 fast simulator와 custom implementation의 조합 덕분이다.

### **5.2 Observation은 real robot에서 얻을 수 있는 값만 사용한다**

Policy observation은 다음 요소를 포함한다.

$$
o_k
=
\left\langle
\phi^g,\,
r_z,\,
v,\,
\omega,\,
q,\,
\dot q,\,
\Theta,\,
a_{k-1},\,
C
\right\rangle
$$

| Symbol | 의미 |
|---|---|
| $\phi^g$ | IMU frame에서 본 gravity direction |
| $r_z$ | Flat terrain leg kinematics와 1D Kalman filter로 추정한 base height |
| $v,\omega$ | Base linear·angular velocity |
| $q,\dot q$ | 12개 joint position·velocity |
| $\Theta$ | 10 ms, 20 ms 전 joint-state history |
| $a_{k-1}$ | Previous action |
| $C$ | Forward/lateral velocity와 yaw-rate command |

Fall recovery에서는 robot이 발로 서 있지 않기 때문에 flat-ground kinematics 기반 base-height estimate를 신뢰할 수 없다. 따라서 recovery policy observation에서는 height를 제거했다.

IMU orientation도 quaternion 전체를 그대로 쓰지 않는다. IMU로 안정적으로 관측 가능한 roll/pitch에 해당하는 gravity direction $\phi^g\in S^2$를 사용한다. Global yaw는 task에 필요하지 않고 drift가 생길 수 있다.

Joint history는 locomotion 학습에 필수였다. 저자들은 history가 명시적 foot-force sensor 없이 contact를 간접 추론하게 해준 것으로 해석한다. 이것은 실험적 해석이지, contact state가 network 내부에 직접 복원됐음을 증명한 것은 아니다.

### **5.3 Noise와 normalization은 선택 사항이 아니었다**

Real joint velocity는 position을 수치 미분해 얻으므로 noise가 크다. Training에서는 다음 noise를 추가했다.

| Observation | Training noise |
|---|---|
| Joint velocity | $U(-0.5,0.5)$ rad/s |
| Base linear velocity | $U(-0.08,0.08)$ m/s |
| Base angular velocity | $U(-0.16,0.16)$ |

원문의 base angular velocity noise unit 표기는 `m/s`로 되어 있지만, quantity 자체는 angular velocity이므로 단위를 그대로 확대 해석하지 않는 편이 안전하다.

저자들은 noisy velocity를 빼고 position history만으로 velocity를 추론하게 했을 때 학습 자체가 실패했다고 보고했다. 이론적으로 finite difference가 가능해도, 실제 non-convex optimization에서는 유용한 preprocessing과 feature 제공이 중요하다는 예.

### **5.4 Action은 low-impedance joint position target이다**

Policy는 12개 desired joint position을 출력한다.

$$
a_t=q_t^{\mathrm{des}}
$$

Low-level command는 fixed-gain impedance form이다.

$$
\tau_t^{\mathrm{des}}
=
k_p(q_t^{\mathrm{des}}-q_t)
-k_d\dot q_t
$$

Low-level impedance controller의 설정은 아래와 같다.

| Parameter | 값 |
|---|---:|
| $k_p$ | 50 Nm/rad |
| $k_d$ | 0.1 Nm/(rad/s) |
| Desired joint velocity | 0 |

이것은 미리 만든 time-indexed joint trajectory를 강하게 추종하는 전통적 position controller와 다르다. Policy가 매 state에서 새로운 target을 만들기 때문에 position error가 생길 것을 학습 중부터 고려한다.

저자들은 torque action보다 position action이 초기 exploration에서 서 있는 controller에 가깝게 시작하고, action landscape가 더 smooth해 학습하기 쉬웠다고 설명한다.

### **5.5 Policy network와 bounded activation**

Policy는 두 hidden layer MLP.

| Layer | 구성 |
|---|---|
| Input | Current observation, joint-state history, previous action, command |
| Hidden 1 | 256 units, tanh |
| Hidden 2 | 128 units, tanh |
| Output | 12 joint position targets |

Simulation 성능이 비슷해도 ReLU policy와 tanh policy의 real 성능은 크게 달랐다.

저자들의 해석: out-of-distribution state에서 unbounded ReLU feature가 지나치게 큰 action을 만들 가능성. Bounded tanh는 disturbance를 받았을 때 더 보수적인 output을 만든다.

이 결과 역시 “tanh가 항상 최고”라는 일반 법칙보다 다음 설계 원칙으로 읽는 편이 좋다.

> Real robot이 training distribution 밖으로 벗어날 가능성이 있다면 network output의 extrapolation behavior까지 control design의 일부로 봐야 한다.

---

## **6. Reward와 Curriculum**

### **6.1 왜 처음부터 모든 penalty를 세게 주지 않았는가**

Locomotion reward에는 velocity tracking뿐 아니라 torque, joint speed, foot clearance, slip, orientation과 smoothness cost가 들어간다.

모든 constraint penalty를 처음부터 크게 주면 “움직이지 않기”가 쉬운 local optimum이 될 수 있다. 반대로 penalty가 너무 약하면 빠르지만 거칠고 위험한 motion을 배운다.

논문은 objective term을 먼저 배우고, 이후 constraint를 강화하는 curriculum을 사용한다.

$$
k_{c,0}=0.3
$$

$$
k_{c,j+1}
=
(k_{c,j})^{0.997}
$$

$k_c$는 점차 1에 가까워진다.

- Velocity objective, recovery orientation objective: curriculum scaling을 적용하지 않음
- Torque, joint-speed, slip, smoothness 등 constraint cost: $k_c$를 곱함

| 학습 단계 | Objective와 constraint의 관계 |
|---|---|
| 초기 | Command를 따라 움직이거나 몸을 뒤집는 task objective를 먼저 찾음 |
| 후기 | 같은 objective를 유지하면서 torque, slip, impact와 joint speed cost를 강화 |

이 curriculum은 sample difficulty를 바꾸는 방식이 아니라 **cost landscape를 바꾸는 curriculum**이다.

### **6.2 Locomotion cost의 구성**

논문의 supplementary material은 velocity error에 bounded logistic kernel을 사용한다.

$$
K(x)
=
-\frac{1}{e^x+2+e^{-x}}
$$

초기 error가 커도 cost가 무한히 커지지 않도록 해, 넘어져 episode를 끝내는 것이 오히려 유리해지는 상황을 줄인다.

Locomotion cost는 command tracking과 actuator·contact regularization으로 나뉜다.

| Cost | 역할 |
|---|---|
| Base linear/angular velocity tracking | Command 수행 |
| Squared torque | Energy·actuator load 감소 |
| Squared joint speed | 과도한 motion 억제 |
| Foot clearance | Swing foot 높이 확보 |
| Foot slip | Stance contact 안정화 |
| Base orientation | 몸통을 upright로 유지 |
| Torque-difference smoothness | 급격한 action 변화 억제 |

Gait sequence나 contact schedule은 reward에 직접 주어지지 않았다. Learned controller가 speed에 따라 walking trot과 flying-trot-like pattern을 선택했다.

### **6.3 Recovery는 initial-state distribution이 핵심이다**

Fall recovery는 upright locomotion과 초기 state가 완전히 다르다.

Naive하게 random pose를 만들면 link가 서로 관통하거나 물리적으로 불가능한 contact가 생길 수 있다. 저자들은 다음 절차로 valid fallen state를 만들었다.

1. ANYmal을 1.0 m 높이에 둔다.
2. Base orientation과 joint position을 randomize한다.
3. 1.2초 동안 떨어뜨려 contact dynamics를 실제로 진행한다.
4. 충돌 후 얻은 valid state를 recovery episode의 초기값으로 사용한다.

![Recovery policy를 위한 sampled initial states](/assets/img/posts/rl/sim2real/agile-motor-skills/09-recovery-initial-states.png){: width="1100" .d-block .mx-auto }
_Robot을 random pose로 떨어뜨려 얻은 recovery training initial states. 단순 pose sampling보다 실제 contact dynamics를 거친 state를 사용한다. 출처: [Hwangbo et al., Figure S3](https://arxiv.org/pdf/1901.08652)._

Recovery에서는 41개 collision body가 관여하고, body collision geometry의 크기와 위치도 randomize했다. 비현실적인 internal collision이 생기는 sample은 제거했다.

Recovery cost는 upright orientation뿐 아니라 다음 safety-related term을 포함한다.

- Torque와 high joint-speed cost
- Joint acceleration
- Contact slip
- Body-contact impulse
- Internal contact count
- Torque smoothness
- Upright 이후 nominal joint pose

“뒤집기만 하면 된다”가 아니라 impact와 fragile component collision을 피하도록 reward를 다듬는 데 약 일주일이 걸렸다. 이는 reward engineering이 사라진 것이 아니라 simulation 안으로 이동했음을 보여준다.

### **6.4 Training horizon과 discount**

| Task | Discount $\gamma$ | Return half-life | Simulated experience | Wall-clock training |
|---|---:|---:|---:|---:|
| Command-conditioned / high-speed | 0.9988 | 5.77 s | 9 simulated days | 약 4 h |
| Fall recovery | 0.993 | 4.93 s | 79 simulated days | 약 11 h |

Locomotion trajectory는 최대 6초이며, joint limit violation이나 base-ground collision 시 종료된다.

Discount를 너무 낮추면 immediate movement는 배우지만 natural standing posture가 약해졌고, 너무 높으면 convergence가 느려질 수 있었다.

---

## **7. Result 1: Command-Conditioned Locomotion**

Command는 세 성분.

$$
C_t=
\left[
v_x^{\mathrm{cmd}},
v_y^{\mathrm{cmd}},
\omega_z^{\mathrm{cmd}}
\right]
$$

Command는 아래 범위에서 sample했다.

| Command | Training range |
|---|---:|
| Forward velocity | $[-1.0,1.0]$ m/s |
| Lateral velocity | $[-0.4,0.4]$ m/s |
| Yaw rate | $[-1.2,1.2]$ rad/s |

Policy는 command sequence나 command 변경 timing을 미리 알지 못한다. Runtime에 들어오는 command를 observation으로 받아 gait를 바꾼다.

### **7.1 Random command tracking**

![Learned controller의 random command tracking](/assets/img/posts/rl/sim2real/agile-motor-skills/07-learned-random-command-tracking.png){: width="1300" .d-block .mx-auto }
_2초마다 바뀌는 forward, lateral, yaw command를 30초 동안 추종한 결과. 점선은 command, 실선은 measured velocity다. 출처: [Hwangbo et al., Figure S1](https://arxiv.org/pdf/1901.08652)._

30초 동안 2초마다 command를 바꿔 총 15번의 transition을 만들었다.

| Metric | Learned policy |
|---|---:|
| Average linear-velocity error | 0.143 m/s |
| Average yaw-rate error | 0.174 rad/s |
| Five-minute continuous test | Failure 0회 |

학습 범위의 forward command는 최대 1.0 m/s였지만, 다른 command를 0으로 두고 1.23 m/s를 명령했을 때 실제 1.2 m/s를 안정적으로 달성했다. 이는 제한된 범위 밖의 아주 가까운 command에 대한 결과이지, arbitrary extrapolation을 의미하지는 않는다.

### **7.2 기존 model-based controller와 비교**

![기존 model-based controller의 random command tracking](/assets/img/posts/rl/sim2real/agile-motor-skills/08-model-based-random-command-tracking.png){: width="1300" .d-block .mx-auto }
_동일한 command profile을 기존 ANYmal model-based controller에 적용한 결과. 특히 yaw-rate tracking 차이가 크다. 출처: [Hwangbo et al., Figure S2](https://arxiv.org/pdf/1901.08652)._

| Metric | Learned RL | Prior model-based |
|---|---:|---:|
| Linear-velocity error | 0.143 m/s | 0.231 m/s |
| Yaw-rate error | 0.174 rad/s | 0.278 rad/s |
| Average torque magnitude | 8.23 Nm | 11.7 Nm |
| Mechanical power | 78.1 W | 97.3 W |

논문은 같은 command profile에서 prior controller의 linear error가 약 95%, yaw-rate error가 약 60% 더 높았다고 보고한다.

### **7.3 Step-command 결과와 gait**

![Command-conditioned locomotion의 정량 결과](/assets/img/posts/rl/sim2real/agile-motor-skills/02-command-locomotion-results.png){: width="1200" .d-block .mx-auto }
_A는 1.0 m/s에서 발견된 gait, B는 simulation과 real tracking, C-E는 기존 flying trot·dynamic lateral walk와 velocity error, mechanical power, torque를 비교한다. 출처: [Hwangbo et al., Figure 2](https://arxiv.org/pdf/1901.08652)._

0.25, 0.5, 0.75, 1.0 m/s command를 각각 4.5초씩 step input으로 주었다.

- Real average velocity error: 2.2%
- Simulation보다 real error가 1.1 percentage point 높음
- Dynamic lateral walk보다 velocity error가 1.5-2.5배 낮음
- Flying trot보다 velocity error가 5-7배 낮음
- Dynamic lateral walk와 mechanical power는 비슷함
- Flying trot보다 mechanical power가 1.2-2.5배 효율적
- 기존 gait보다 average torque가 23-36% 낮음

저자들은 learned policy가 knee를 10-15도 더 곧게 펴는 posture를 사용해 torque를 줄였다고 분석한다. 기존 controller에서는 이 posture가 fall rate를 높여 쓰기 어려웠다.

여기서 “RL이 항상 model-based보다 낫다”고 결론 내리면 과하다. 비교 대상은 같은 ANYmal에서 사용하던 특정 controller와 gait 설정. 하지만 동일 hardware에서 accuracy, power, torque를 함께 측정했다는 점은 강한 실기체 evidence.

---

## **8. Result 2: Hardware Limit에 가까운 High-Speed Locomotion**

High-speed policy의 command range는 forward direction에 더 집중되어 있다.

| Command | Training range |
|---|---:|
| Forward velocity | $[-1.6,1.6]$ m/s |
| Lateral velocity | $[-0.2,0.2]$ m/s |
| Yaw rate | $[-0.3,0.3]$ rad/s |

Real test에서는 command를 서서히 1.6 m/s까지 높이고, 10 m를 달린 뒤 0으로 낮췄다.

![High-speed policy의 real ANYmal 결과](/assets/img/posts/rl/sim2real/agile-motor-skills/03-high-speed-results.png){: width="780" .d-block .mx-auto }
_A는 forward velocity, B-C는 joint velocity와 torque, D는 gait pattern이다. Policy는 real hardware의 40 Nm torque와 12 rad/s joint-speed limit까지 사용했다. 출처: [Hwangbo et al., Figure 3](https://arxiv.org/pdf/1901.08652)._

| Metric | Result |
|---|---:|
| Command | 1.6 m/s |
| Simulation measured speed | 1.58 m/s |
| Real measured speed | 1.50 m/s |
| Previous ANYmal record | 1.20 m/s |
| Improvement over previous record | 25% |
| Reached torque limit | 40 Nm |
| Reached joint-speed limit | 12 rad/s |

Speed는 최소 3 gait cycle에 걸쳐 평균했다.

Gait는 ordinary flying trot과 비슷하지만 flight phase가 더 길고 좌우 duration이 비대칭이다. 저자들은 하나의 near-optimal mode일 수 있다고 해석했으며, 자연 동물 gait와 같다고 주장하지 않았다.

이 결과의 의미는 단순 최고 속도보다 **constraint-aware behavior가 policy training 안에서 나왔다는 점**.

전통적인 modular controller에서는 planner가 뒤쪽 actuator limit을 완전히 알지 못해 실행 불가능한 reference를 만들 수 있다. 이 policy는 training simulation에 torque와 joint-speed constraint가 포함되어 있어, limit에 닿으면서도 실행 가능한 motion을 직접 학습했다.

관련 영상: [High-speed locomotion, Movie S6](https://youtu.be/wR3xnK0ZCNs).

---

## **9. Result 3: 3초 이내 Dynamic Fall Recovery**

Recovery는 locomotion보다 contact topology가 훨씬 복잡하다.

- Foot뿐 아니라 knee, side panel, body가 바닥에 닿을 수 있다.
- 자기 다리와 body 사이 internal contact도 생긴다.
- 미리 정한 contact sequence가 없다.
- Momentum을 만들어 몸 전체를 굴려야 한다.

Real experiment에서는 upside-down에 가까운 pose와 자기 다리 위에 몸이 얹힌 pose를 포함해 **9개의 random configuration**을 시험했다.

![Real ANYmal의 learned fall recovery](/assets/img/posts/rl/sim2real/agile-motor-skills/04-fall-recovery.png){: width="1400" .d-block .mx-auto }
_Random initial configuration에서 앞발로 contact를 만들고, leg mass와 momentum을 이용해 몸을 굴린 뒤 upright pose로 돌아온다. 전체 recovery는 3초 이내다. 출처: [Hwangbo et al., Figure 4](https://arxiv.org/pdf/1901.08652)._

아홉 configuration의 결과를 묶으면 아래와 같다.

- 9개 test configuration 모두 upright recovery 성공
- Example recovery는 3초 이내
- Hardware 첫 시도에서 recovery task 성공
- Joint-velocity constraint를 완화한 뒤 success rate 100% 달성
- 실기체 실험 둘째 날에 보고된 결과를 확보

“첫 시도 성공”과 “최종 100%”를 혼동하면 안 된다. 처음부터 모든 random state에서 100%였다는 뜻이 아니라, 첫 hardware deployment가 성공했고 이후 joint-velocity constraint를 조정해 success rate를 높였다는 설명이다.

또한 recovery policy는 simulation에서 20 Hz로 학습했지만 real test에서는 100 Hz로 실행해도 성능이 비슷했다. 저자들은 flip-up motion의 joint speed가 대부분 6 rad/s 이하였기 때문에 가능했다고 설명한다. Locomotion처럼 빠른 behavior에는 200 Hz가 필요했다.

관련 영상: [Fall recovery, Movie S7](https://youtu.be/bbp2vcNb7jg).

---

## **10. Simulation과 Real Deployment를 연결한 세부 설계**

### **10.1 Control frequency**

| Policy | Real evaluation rate |
|---|---:|
| Command-conditioned locomotion | 200 Hz |
| High-speed locomotion | 200 Hz |
| Fall recovery | 100 Hz |

Recovery network는 100 Hz에서도 single CPU core 계산량의 약 0.25%만 사용했다. 학습 때 복잡한 simulator를 사용해도 deployment에는 small MLP만 남는다.

### **10.2 Real actuator data는 simulator용이고 policy는 simulation-only다**

이 논문을 “real data를 전혀 쓰지 않은 Sim2Real”이라고 부르면 틀리다.

Real actuator data와 simulation-only policy training의 관계는 아래 순서로 구분해야 한다.

| 단계 | 사용되는 data 또는 model |
|---|---|
| 1. Real actuator excitation | Command, joint state, measured torque를 수집 |
| 2. Supervised actuator modeling | History에서 torque를 예측하는 actuator net 학습 |
| 3. Hybrid simulation | Learned actuator net과 stochastic rigid-body model 결합 |
| 4. Policy optimization | Hybrid simulator 안에서만 TRPO rollout 수행 |
| 5. Direct deployment | Actuator net 없이 policy만 real ANYmal에 배포 |

Policy optimization에는 real rollout reward가 들어가지 않았지만, simulator calibration에는 real actuator data가 들어갔다.

따라서 정확한 표현은 다음.

> Real actuator data로 simulator를 보강한 뒤, policy 자체는 simulation에서만 학습하고 real robot에 직접 transfer했다.

### **10.3 세 달 동안 hardware가 변해도 동작했다**

저자들은 모든 policy를 수정 없이 real robot에서 3개월 이상 시험했다.

그 사이에 약 2 kg의 configuration 차이와 기존보다 spring이 3배 stiff한 새 drive를 포함한 hardware change가 있었지만 policy가 계속 동작했다고 보고한다.

이 결과는 robustness의 유용한 evidence지만, systematic sweep이나 confidence interval이 있는 benchmark는 아니다. Discussion의 field observation으로 해석하는 것이 적절하다.

---

## **11. 앞선 Sim2Real 논문과 연결하기**

### **11.1 Peng et al.: distribution을 넓힌다**

Dynamics randomization은 simulator parameter $\theta$를 distribution으로 만든다.

$$
\theta\sim p(\theta)
$$

장점은 exact identification에 대한 낮은 의존도. 하지만 nominal actuator response 자체가 크게 틀리면 아주 넓은 distribution이 필요하고, policy가 지나치게 보수적이 될 수 있다.

### **11.2 Tan et al.: analytical actuator model을 정교하게 만든다**

Minitaur에서는 motor voltage, back-EMF와 latency를 반영한 compact analytical actuator model이 효과적이었다.

### **11.3 Hwangbo et al.: 어려운 subsystem만 학습한다**

ANYmal SEA에서는 actuator/software stack이 더 복잡했다. 그래서 command-to-torque mapping을 learned model로 대체한다.

| Paper | Nominal fidelity | Robustness | Policy |
|---|---|---|---|
| Peng et al. | Randomized dynamics family | 넓은 dynamics randomization | Recurrent policy |
| Tan et al. | Identified analytical actuator + latency | Parameter randomization + perturbation | PPO |
| Hwangbo et al. | Rigid-body physics + learned actuator | Stochastic model + noise | TRPO |

세 논문은 서로 대체 관계가 아니다.

| 도구 | 서로 다른 역할 |
|---|---|
| System identification | Nominal model의 중심을 현실에 맞춤 |
| Learned actuator model | 손으로 쓰기 어려운 systematic subsystem gap을 줄임 |
| Domain randomization | Identification 뒤에 남은 uncertainty를 견디게 함 |

실제 Sim2Real pipeline에서는 세 가지를 함께 쓰는 경우가 많다.

---

## **12. 이 논문이 증명한 것과 증명하지 않은 것**

### **12.1 강하게 말할 수 있는 것**

1. ANYmal SEA에서는 actuator-model fidelity가 locomotion transfer 성공 여부를 바꿨다.
2. History-conditioned actuator network는 ideal model보다 real torque를 훨씬 정확히 예측했다.
3. Physics와 learned subsystem model을 결합해 약 500K steps/s의 빠른 hybrid simulator를 만들 수 있었다.
4. Simulation-trained policy가 command tracking, 1.5 m/s running, 3초 이내 recovery를 real ANYmal에서 수행했다.
5. 같은 hardware의 기존 controller와 비교해 tracking error, torque와 power가 개선되었다.

### **12.2 조심해서 말해야 하는 것**

1. **모든 analytical actuator model이 실패한다:** 이 논문은 ANYmal의 특정 SEA와 구현에 대한 결과.
2. **Real data가 전혀 필요 없다:** Actuator net 학습에는 real data와 torque measurement가 필요하다.
3. **하나의 universal policy다:** 세 task는 별도 reward와 별도 policy로 학습했다.
4. **Reward engineering이 사라졌다:** Recovery cost와 safety term을 다듬는 데 약 일주일이 걸렸다.
5. **모든 terrain에서 robust하다:** 이 논문의 중심은 flat-ground agile skill과 recovery이며 exteroceptive rough-terrain locomotion이 아니다.
6. **Actuator model만 맞으면 transfer된다:** Rigid-body randomization, observation noise, bounded policy, history와 curriculum도 함께 사용했다.

---

## **13. 한계와 재현 시 주의점**

### **13.1 Real actuator instrumentation이 필요하다**

Actuator network를 만들려면 command, position, velocity와 torque를 정확한 timestamp로 기록해야 한다.

Robot에 torque sensing이나 logging infrastructure가 없으면 같은 접근을 바로 적용하기 어렵다. Torque label 자체가 biased하면 network는 그 bias를 학습한다.

### **13.2 Training coverage 밖에서는 model도 틀릴 수 있다**

Data collection은 1-25 Hz, 5-10 cm foot trajectory를 사용했다. 실제 policy가 더 높은 frequency, 더 큰 error나 다른 thermal condition을 만들면 actuator net은 extrapolation한다.

Validation split이 random sample split이라면 같은 excitation trajectory의 인접 sample이 train과 validation에 함께 들어갈 가능성도 있다. 논문은 trajectory-level holdout 여부를 상세히 보고하지 않는다.

현대적으로 재현한다면 최소한 다음 holdout을 분리하는 편이 좋다.

- Excitation frequency holdout
- Amplitude holdout
- Joint holdout 또는 actuator-unit holdout
- Policy-generated trajectory test
- Battery voltage와 actuator temperature condition

### **13.3 Joint-independent model의 한계**

논문은 12개 actuator dynamics가 서로 독립이라고 가정한다. Shared power supply, hydraulic accumulator나 thermal coupling이 강한 robot에서는 joint별 network로 충분하지 않을 수 있다.

그 경우 actuator model 입력에 bus voltage, temperature, neighboring-joint command를 넣거나 multi-actuator model을 고려해야 한다.

### **13.4 Contact와 state-estimation gap은 남는다**

Actuator fidelity가 좋아도 ground compliance, friction transition, impact loss와 base velocity estimator의 bias는 완전히 해결되지 않는다.

이 논문은 flat terrain 중심이고, terrain perception은 다루지 않는다. 다음 rough-terrain 논문에서는 proprioception과 terrain curriculum, 이후 연구에서는 exteroception과 adaptation이 중요해진다.

### **13.5 Safety cost도 simulator fidelity에 의존한다**

Recovery policy가 simulation에서 body-impact cost를 줄였다고 해서 real hardware stress가 자동으로 안전한 것은 아니다.

- Collision geometry approximation
- Contact impulse model
- Fragile cable·cover 미모델링
- Motor temperature
- Repeated impact fatigue

같은 요소는 별도 hardware safety 검증이 필요하다.

---

## **14. 재현한다면 무엇을 먼저 확인할까**

이 논문의 핵심을 다른 robot에서 재현할 때는 RL부터 돌리기보다 다음 순서가 안전하다.

### **Step 1. Action-to-torque chain을 계측한다**

- Timestamp
- Desired position 또는 torque
- Measured joint position과 velocity
- Measured torque 또는 current
- Battery voltage
- Actuator temperature

Timestamp alignment과 unit부터 검증한다.

### **Step 2. Analytical baseline을 만든다**

Ideal PD baseline과 가능한 analytical actuator model을 먼저 구현한다. Learned model의 이득을 판단할 비교 대상이 필요하다.

### **Step 3. Excitation coverage를 설계한다**

Policy가 사용할 position error, velocity와 frequency 범위를 안전하게 덮는다. Random command만 넣기보다 frequency sweep과 amplitude sweep을 분리한다.

### **Step 4. Actuator model을 out-of-distribution에서 평가한다**

RMS 하나만 보지 말고 다음을 확인한다.

- Phase delay
- Peak torque timing
- Sign reversal
- High-frequency attenuation
- Saturation
- Policy-generated trajectory error

### **Step 5. Simulator ablation을 먼저 통과한다**

| Ablation | 확인하려는 질문 |
|---|---|
| Ideal actuator | Delay와 bandwidth를 무시해도 transfer되는가 |
| Analytical actuator | 식별한 compact model로 충분한가 |
| Learned actuator | Data-driven command-to-torque model이 추가 이득을 주는가 |
| Learned actuator + randomization | Nominal fidelity와 residual robustness를 함께 쓰면 어떤가 |

각 조건에서 simulation robustness와 real low-risk behavior를 단계적으로 비교한다.

### **Step 6. Real deployment는 낮은 energy부터 시작한다**

Joint-position bound, torque limit, velocity limit, emergency stop과 fall-protection 환경을 둔다. 논문의 1.5 m/s나 dynamic recovery를 첫 실험으로 따라 하면 안 된다.

---

## **15. Actuator Model은 Simulator의 부품이다**

Hwangbo et al.은 rigid body와 contact는 physics로 계산하고, 식별하기 어려운 SEA command-to-torque mapping만 history-conditioned actuator net으로 바꿨다. 4분 미만의 400 Hz actuator data에서 100만 개 이상의 sample을 얻었고, policy trial-and-error는 이 hybrid simulator 안에서 수행했다.

Learned model의 torque RMS는 validation 0.740 Nm, policy test 0.966 Nm였다. 더 직접적인 근거는 ideal·analytical actuator model policy가 실제 로봇에서 걷지 못한 반면 learned model policy는 transfer됐다는 ablation. 이 결과는 actuator net 하나만의 효과로 분리할 수는 없다. Stochastic rigid-body model, observation noise, bounded policy, state history와 cost curriculum이 함께 사용됐다.

이 pipeline에서 학습한 별도 TRPO policy들은 실제 ANYmal에서 command tracking, 1.5 m/s running과 3초 이내 fall recovery를 수행했다.

> Legged Sim2Real에서 actuator는 action 뒤에 붙는 세부 구현이 아니라, policy가 학습하는 environment dynamics의 핵심 구성요소다.

다음 글: [Learning Quadrupedal Locomotion over Challenging Terrain](/posts/learning-quadrupedal-locomotion-challenging-terrain/)

다음 편에서는 이 actuator-aware pipeline이 uneven terrain으로 확장되면서 terrain curriculum과 observation history를 만나게 된다.

---

## **참고 자료**

- [Hwangbo et al., arXiv abstract](https://arxiv.org/abs/1901.08652)
- [Hwangbo et al., full paper and supplementary material](https://arxiv.org/pdf/1901.08652)
- [Science Robotics DOI](https://doi.org/10.1126/scirobotics.aau5872)
- [Official overview video, Movie S1](https://youtu.be/aTDkYFZFWug)
- [Command-conditioned locomotion, Movie S2](https://youtu.be/23mBeaGmQ2o)
- [Learned vs model-based controller, Movie S3](https://youtu.be/aqVPyIgZ15M)
- [Analytical actuator model failure, Movie S4](https://youtu.be/WbRXZKUR5Ew)
- [Ideal actuator model failure, Movie S5](https://youtu.be/NYMEA2PD9rQ)
- [High-speed locomotion, Movie S6](https://youtu.be/wR3xnK0ZCNs)
- [Fall recovery, Movie S7](https://youtu.be/bbp2vcNb7jg)
