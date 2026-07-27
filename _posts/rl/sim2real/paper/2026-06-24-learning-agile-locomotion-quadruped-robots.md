---
title: "[Sim2Real Paper 4] Learning Agile Locomotion"
date: 2026-06-24 17:32:00 +0900
last_modified_at: 2026-07-27 22:47:54 +0900
categories: [RL, Sim2Real, Paper]
tags: [sim2real, quadruped-locomotion, minitaur, ppo, actuator-model, latency, dynamics-randomization, system-identification]
description: Tan et al.의 Minitaur Sim2Real을 PPO, leg-space action, open-loop reference와 feedback, actuator model, latency, randomization, compact observation ablation까지 원문 기준으로 정리한다.
math: true
image:
  path: /assets/img/posts/rl/sim2real/agile-locomotion/00-preview.png
  alt: Simulation과 실제 Minitaur가 gallop하는 장면
---

## **0. 전체 그림: Randomization만으로는 부족하다**

앞선 **[Dynamics Randomization](/posts/sim-to-real-transfer-dynamics-randomization/)**에서는 여러 mass, friction, controller timing에서 recurrent policy를 학습해 Fetch robot으로 transfer했다.

Tan et al.의 **Sim-to-Real: Learning Agile Locomotion For Quadruped Robots**는 이 문제를 quadruped locomotion으로 가져온다.

Legged locomotion의 reality gap은 contact 때문에 더 까다롭다. 작은 motor-response 오차가 touchdown timing을 바꾸고, 달라진 contact force와 body attitude가 다음 action의 오차를 키우면서 넘어짐으로 이어질 수 있다.

따라서 “parameter를 넓게 randomize하면 언젠가 real robot도 포함될 것”이라는 접근만으로는 부족할 수 있다.

이 논문이 제시한 전략은 두 축.

1. **Simulation fidelity를 먼저 높인다.** Robot geometry와 mass를 측정하고, actuator와 latency를 따로 모델링한다.

2. **남은 mismatch에는 robust policy를 학습한다.** Dynamics randomization, 외력 perturbation, compact observation을 사용한다.

![Simulation과 real Minitaur의 gallop](/assets/img/posts/rl/sim2real/agile-locomotion/00-preview.png){: width="1100" .d-block .mx-auto }
_위는 PyBullet simulation, 아래는 실제 Minitaur의 gallop이다. Policy는 simulation에서 PPO로 학습한 뒤 real robot에 추가 fine-tuning 없이 배포되었다. 출처: [Tan et al., Figure 1](https://arxiv.org/pdf/1804.10332)._

Actuator와 latency model이 빠지면 simulation에서 잘 달리던 policy도 real robot에서 동작하지 않았다. 저자들은 system identification으로 nominal model을 먼저 맞춘 뒤 randomization과 perturbation으로 residual mismatch를 다뤘다. 또 simulation에서는 12D observation이 유리했지만, trot transfer에는 4D IMU-only observation이 더 안정적이었다. 이 결과는 flat ground의 gallop과 reference-guided trot에 한정되며, 범용 velocity-command locomotion 결과는 아니다.

> Actuator와 latency model의 오차가 너무 크면, random perturbation으로 robust하게 학습해도 real robot으로 transfer되지 않는다.

즉 Sim2Real은 **정확한 nominal model과 적절한 robustness의 조합**이다.

---

## **1. 논문 정보**

| 항목 | 내용 |
|---|---|
| Title | Sim-to-Real: Learning Agile Locomotion For Quadruped Robots |
| Authors | Jie Tan, Tingnan Zhang, Erwin Coumans, Atil Iscen, Yunfei Bai, Danijar Hafner, Steven Bohez, Vincent Vanhoucke |
| Venue | Robotics: Science and Systems, RSS 2018 |
| Robot | Ghost Robotics Minitaur |
| Tasks | Galloping, trotting |
| Simulator | PyBullet |
| RL algorithm | Proximal Policy Optimization, PPO |
| Transfer | Simulation-only training 후 real robot zero-shot deployment |
| Main tools | System identification, nonlinear actuator model, latency model, dynamics randomization, perturbation, compact observation |
| Source | [arXiv](https://arxiv.org/abs/1804.10332), [RSS paper](https://www.roboticsproceedings.org/rss14/p10.pdf), [Video](https://www.youtube.com/watch?v=lUZUr7jxoqM) |

이 논문은 현재 legged RL에서도 익숙한 설계들을 일찍 한데 묶었다.

| 설계 요소 | 이 논문에서의 역할 |
|---|---|
| PPO와 parallel simulation | simulation rollout으로 feedforward policy 학습 |
| Leg-space position target | invalid motor configuration을 줄이고 안전한 exploration 유도 |
| Actuator와 latency model | real command-to-motion response를 simulator에 반영 |
| Dynamics randomization과 perturbation | nominal model에 남은 uncertainty에 robustness 학습 |
| Deployable observation | encoder와 IMU처럼 real robot에서 측정 가능한 값만 policy에 제공 |

다만 오늘날의 command-conditioned locomotion과는 차이가 있다. 이 policy는 임의의 velocity command를 추종하는 범용 policy가 아니라, **flat ground에서 정해진 방향으로 gallop 또는 trot하는 gait policy**.

---

## **2. Robot과 Control Problem을 먼저 정확히 보기**

### **2.1 Minitaur hardware와 control loop**

Minitaur에는 direct-drive actuator가 8개 있다. 각 다리는 motor 2개로 sagittal plane에서 움직인다.

Policy와 controller가 사용하는 sensor는 두 종류이다.

- Motor encoder: 8개 motor angle
- IMU: base orientation과 angular velocity

STM32 microcontroller가 actuator command와 sensor I/O를 처리하고, neural-network inference는 Nvidia Jetson TX2가 수행한다.

![Minitaur hardware control loop](/assets/img/posts/rl/sim2real/agile-locomotion/01-hardware-control-loop.png){: width="1200" .d-block .mx-auto }
_Jetson TX2가 policy action을 STM32로 보내고, STM32가 motor command를 실행한 뒤 encoder와 IMU observation을 되돌려 준다. 출처: [Tan et al., Figure 2](https://arxiv.org/pdf/1804.10332)._

Control loop 안에서 data는 아래 순서로 이동한다.

| 단계 | 입력과 출력 |
|---|---|
| Encoder와 IMU | observation을 UART로 Jetson TX2에 전달 |
| Jetson TX2 | neural policy inference로 leg-space action 생성 |
| STM32 position controller | action을 PWM과 motor torque로 변환 |
| Minitaur dynamics와 contact | 다음 sensor observation을 생성 |

TX2는 real-time operating system에서 동작하지 않았다. 실제 control frequency는 약 150-200 Hz 사이에서 변했다.

이 구조만 봐도 reality gap의 원인이 단순 rigid-body parameter가 아니라는 것을 알 수 있다.

- UART communication delay
- TX2 inference와 scheduling jitter
- Microcontroller PD-loop delay
- Battery voltage에 따른 motor response
- Encoder/IMU noise와 bias

이 모든 요소가 observation-to-action closed loop를 바꾼다.

### **2.2 왜 POMDP인가**

논문은 locomotion을 POMDP로 정의한다.

Robot의 완전한 physical state에는 base position, velocity, foot contact force 등이 들어갈 수 있지만, Minitaur에서 모두 직접 측정할 수 있는 것은 아니다.

$$
s_t \in \mathcal{S},
\qquad
o_t \sim O(\cdot \mid s_t)
$$

Policy는 full state가 아니라 observation만 보고 action을 낸다.

$$
a_t \sim \pi_{\theta}(a_t\mid o_t)
$$

이 논문은 recurrent policy를 사용하지 않는다. 제한된 observation을 feedforward PPO policy에 넣는다. 따라서 policy가 긴 history로 hidden state를 추정하기보다, 현재 측정값만으로 안정적인 feedback을 만들도록 설계했다.

### **2.3 12D observation과 4D observation**

처음 사용한 observation은 12차원.

| Feature | Dimension |
|---|---:|
| Base roll, pitch | 2 |
| Roll/pitch angular velocity | 2 |
| Eight motor angles | 8 |
| Total | 12 |

사용 가능한 sensor 값을 무조건 모두 넣지는 않았다.

- IMU yaw는 drift가 빠르므로 제외했다.
- Motor velocity는 계산할 수 있지만 noise가 커서 제외했다.
- Base position과 foot contact force는 해당 sensor가 없어 제외했다.

Gallop policy는 이 12D observation을 사용한다.

Trotting에서는 처음에 12D를 사용했지만 real transfer가 seed마다 불안정했다. 이후 motor angle을 제거하고 다음 4D IMU observation만 남겼다.

$$
o_t =
[\phi_t,\theta_t,\omega^x_t,\omega^y_t]
$$

그 결과 simulation과 real에서 안정적으로 비슷한 trot이 나타났다.

“더 많은 observation은 항상 좋다”는 생각과 반대되는 결과. Simulation에서 정확한 motor angle을 policy가 적극 활용할수록, real observation distribution의 작은 차이에 더 민감해질 수 있다.

### **2.4 Action은 motor angle 8개가 아니라 leg-space pose다**

각 leg action은 swing $s$와 extension $e$로 표현된다.

$$
\theta_1=e+s,
\qquad
\theta_2=e-s
$$

네 다리에 각각 $(s,e)$가 있으므로 policy action은 총 8차원 target pose.

![Motor space와 leg space action](/assets/img/posts/rl/sim2real/agile-locomotion/02-leg-space-action.png){: width="1100" .d-block .mx-auto }
_왼쪽은 두 motor angle $\theta_1,\theta_2$, 오른쪽은 swing $s$와 extension $e$로 같은 leg pose를 표현한다. 출처: [Tan et al., Figure 3](https://arxiv.org/pdf/1804.10332)._

Motor-angle space를 그대로 사용하면 self-collision을 만드는 invalid configuration이 non-convex하게 흩어져 있다. 반면 leg space에서는 rectangle bound로 invalid action을 쉽게 제외할 수 있다.

이것은 단순 좌표 변환 이상의 의미가 있다.

> Action space에 robot kinematics의 유효 구조를 넣어 exploration이 물리적으로 가능한 영역에서 일어나게 한다.

Policy는 safety와 학습 용이성을 위해 torque가 아니라 position target을 출력한다. Low-level actuator model이 target angle을 motor torque로 바꾼다.

### **2.5 Reward는 전진 거리와 mechanical energy 두 항이다**

Reward는 복잡한 gait-shaping 항으로 구성되지 않는다.

$$
r_n
=
(\mathbf{p}_n-\mathbf{p}_{n-1})\cdot\mathbf{d}
-
w\Delta t
\left|
\boldsymbol{\tau}_n\cdot\dot{\mathbf{q}}_n
\right|
$$

| Term | 의미 |
|---|---|
| $(\mathbf{p}_n-\mathbf{p}_{n-1})\cdot\mathbf{d}$ | 원하는 방향으로 이동한 거리 |
| $\Delta t|\boldsymbol{\tau}\cdot\dot{\mathbf{q}}|$ | 한 step의 mechanical-energy proxy |
| $w=0.008$ | 두 항의 trade-off |

Episode는 1,000 steps 후 끝나거나, base tilt가 0.5 rad를 넘으면 넘어졌다고 보고 종료한다.

이 reward는 “어떤 leg pair를 언제 움직여라”를 직접 지시하지 않는다. Gallop은 단순 forward-progress와 energy objective에서 emergent behavior로 나타난다.

다만 reward 계산에는 simulation에서 아는 base position, torque, motor velocity가 필요하다. 이것들이 policy observation에 들어가는 것은 아니다.

---

## **3. Policy는 완전 Scratch와 Reference-guided 사이를 연결한다**

### **3.1 Open-loop reference + learned feedback**

Action은 두 부분의 합이다.

$$
a(t,o)
=
\bar{a}(t)
+
\pi_{\theta}(o)
$$

- $\bar{a}(t)$: 사용자가 주는 periodic open-loop reference
- $\pi_{\theta}(o)$: observation을 보고 balance와 motion을 보정하는 learned feedback

이 식은 human guidance의 양을 연속적으로 조절할 수 있게 한다.

| Setting | 의미 |
|---|---|
| $\bar a(t)=0$, 넓은 policy bound | Scratch learning |
| Reference + 작은 residual bound | 원하는 gait style을 유지하며 feedback 학습 |
| Policy bound $=0$ | 완전한 hand-designed open loop |

이 구조는 현재의 residual policy, reference-conditioned locomotion과도 연결된다.

### **3.2 Gallop은 scratch에서 emergent하게 나왔다**

Gallop에서는

$$
\bar{a}(t)=0
$$

으로 두고 feedback action bound를 넓게 설정한다.

- Swing: $[-0.5,0.5]$ rad
- Extension: $[\frac{\pi}{2}-0.5,\frac{\pi}{2}+0.5]$ rad

Baseline Bullet actuator model에서는 빠른 gait가 아니라 느린 walk만 학습됐다. 실제 Minitaur에 올리면 즉시 넘어졌다.

Actuator와 latency model을 개선한 뒤에는 대부분의 hyperparameter/seed run에서 gallop이 나타났다. 일부 run에서는 trot, pace, 일반적인 동물 gait와 다른 움직임도 나타났다.

이 결과는 simulator fidelity가 transfer만 바꾼 것이 아니라 **학습 가능한 behavior family 자체도 바꿨다**는 의미가 있다.

### **3.3 Trot은 reference로 gait topology를 지정했다**

Trot에서는 diagonal leg pair가 같은 phase로 움직이고, 다른 diagonal pair는 180도 위상이 다르게 움직여야 한다.

논문은 다음 reference를 사용한다.

$$
\bar{s}(t)=0.3\sin(4\pi t)
$$

$$
\bar{e}(t)=0.35\sin(4\pi t)+2
$$

다른 diagonal pair에는 180도 phase offset을 준다. Learned feedback bound는 swing과 extension 모두 $[-0.25,0.25]$ rad로 제한한다.

이 reference만으로 real robot이 전진하지는 못했다. Minitaur는 balance를 잃고 뒤로 주저앉았다.

| Action component | 역할 |
|---|---|
| Periodic reference | trot의 rhythm, diagonal phase, style을 지정 |
| Learned feedback | balance, perturbation recovery, forward motion을 보정 |

즉 “trot을 hand-code했다”와 “trot이 완전히 scratch에서 발견됐다” 사이의 방법.

---

## **4. Simulation Fidelity를 어떻게 높였는가**

### **4.1 System identification: 평균 model을 먼저 맞춘다**

저자들은 Minitaur를 분해해 다음 값을 측정했다.

- 각 link dimension
- Link mass
- Center of mass
- Motor friction

Inertia는 직접 측정하기 어려워 link shape와 mass, uniform-density 가정으로 추정했다.

이 nominal model은 randomization의 중심이 된다.

$$
\mu_{\text{train}}
\sim
\rho(\mu\mid\hat{\mu}_{\text{identified}})
$$

System identification과 dynamics randomization은 경쟁 관계가 아니다.

| 방법 | Training distribution에서의 역할 |
|---|---|
| System identification | real robot에 가까운 plausible center를 찾음 |
| Dynamics randomization | 중심 주변의 residual error와 time variation을 덮음 |

Nominal model이 너무 틀리면, 필요한 randomization range가 지나치게 넓어지고 policy가 conservative해질 수 있다.

### **4.2 Bullet의 기본 position constraint가 실제 motor와 달랐다**

Bullet의 기본 position control은 step 끝에서 target error constraint를 만족하도록 계산된다.

$$
e_{n+1}
=
k_p(\bar q-q_{n+1})
+
k_d(\dot{\bar q}-\dot q_{n+1})
=0
$$

이 방식은 실제 PD servo처럼 현재 state에서 torque를 계산하는 것과 다르다.

큰 gain을 사용하면 simulation에서는 constraint가 안정적으로 만족되지만, real motor에서는 oscillation이 생길 수 있다. 또한 기본 model은 overdamped하게 동작해 빠른 gait exploration을 제한했다.

### **4.3 DC motor + nonlinear torque saturation**

저자들은 ideal DC motor 관계를 출발점으로 사용한다.

$$
\tau=K_tI
$$

$$
I
=
\frac{V_{\mathrm{pwm}}-V_{\mathrm{emf}}}{R},
\qquad
V_{\mathrm{emf}}=K_t\dot q
$$

Position control의 PWM command는 현재 motor state로 계산한다.

$$
V_{\mathrm{pwm}}
=
V
\left[
k_p(\bar q-q_n)
+
k_d(\dot{\bar q}-\dot q_n)
\right]
$$

Microcontroller 구현에 맞춰 target velocity는 $\dot{\bar q}=0$으로 둔다.

하지만 실제 motor에서 torque-current relation은 큰 current에서 linear하지 않고 saturate한다. 저자들은 측정 기반 piecewise-linear function으로 이 비선형성을 추가했다.

![Actuator model의 sim-real trajectory validation](/assets/img/posts/rl/sim2real/agile-locomotion/03-actuator-model-validation.png){: width="900" .d-block .mx-auto }
_점선은 desired motor angle, 파랑은 real response, 빨강은 개선된 simulation response다. Sim과 real이 비슷한 phase lag와 amplitude를 보인다. 출처: [Tan et al., Figure 4](https://arxiv.org/pdf/1804.10332)._

이 figure에서 simulation이 desired signal을 완벽하게 따라가는 것이 목표가 아니다. **Real actuator가 target을 따라가지 못하는 방식까지 simulation이 재현하는 것**이 목표이다.

### **4.4 Latency는 observation history로 재현했다**

Feedback controller에서 latency는 stability를 직접 바꾼다.

$$
a_t=\pi(o_{t-\ell})
$$

저자들은 simulation observation history와 timestamp를 저장하고, 현재 시각에서 latency만큼 과거인 두 observation을 찾아 linear interpolation한다.

실제 system에서 PWM spike를 한 step 보낸 뒤 motor motion이 sensor로 보고될 때까지의 latency를 측정했다.

| Control layer | Measured latency |
|---|---:|
| STM32 microcontroller의 PD servo | 약 3 ms |
| Jetson TX2 locomotion policy loop | 보통 15-19 ms |

Real-time OS가 아니기 때문에 control step과 latency 모두 변할 수 있다. 논문은 이 값을 simulation nominal model과 randomization range에 반영한다.

---

## **5. 남은 Gap에 Robustness를 학습시키기**

### **5.1 Dynamics randomization range**

Episode 시작에 physical parameter를 uniform range에서 sample한다.

| Parameter | Lower | Upper |
|---|---:|---:|
| Link mass | nominal의 80% | 120% |
| Motor friction | 0 Nm | 0.05 Nm |
| Link inertia | nominal의 50% | 150% |
| Motor strength | nominal의 80% | 120% |
| Control step | 3 ms | 20 ms |
| Latency | 0 ms | 40 ms |
| Battery voltage | 14.0 V | 16.8 V |
| Foot-ground contact friction | 0.5 | 1.25 |
| IMU bias | -0.05 rad | 0.05 rad |
| IMU noise standard deviation | 0 rad | 0.05 rad |

Range가 parameter마다 다른 이유도 중요하다.

- Mass와 motor friction은 직접 측정했으므로 비교적 좁게 둔다.
- Inertia는 uniform-density 가정으로 추정했으므로 50-150%로 넓게 둔다.
- Motor strength는 wear에 따라 달라질 수 있다.
- Battery voltage는 charge state에 따라 바뀐다.
- Control step과 latency는 non-real-time system 때문에 흔들린다.
- Contact friction은 rubber foot와 여러 carpet의 일반적인 범위를 사용한다.

즉 무작정 모든 값을 같은 비율로 흔든 것이 아니라 **측정 confidence와 deployment variation**에 따라 범위를 정했다.

### **5.2 Random external perturbation**

Training 중 simulated base에 외력을 가한다.

| 항목 | 값 |
|---|---:|
| Perturbation interval | 200 steps, 약 1.2 s |
| Duration | 10 steps, 약 0.06 s |
| Magnitude | 130-220 N |
| Direction | Random |

짧고 큰 force로 balance를 무너뜨리고, policy가 여러 attitude에서 recovery하도록 만든다.

Perturbation은 특정 parameter mismatch를 직접 모델링하지 않는다. 대신 model error가 만들어낼 수 있는 state deviation을 외력으로 넓게 경험시킨다.

다만 perturbation이 actuator model을 대체하지는 못했다. 뒤의 ablation에서 baseline simulator에 perturbation만 추가해도 real transfer가 실패한다.

### **5.3 Compact observation은 정보 손실이자 regularization이다**

Observation을 줄이면 policy가 사용할 수 있는 정보도 줄어든다. Simulation performance만 보면 12D observation이 유리하다.

하지만 motor angle distribution이 sim과 real에서 다르면, 12D policy가 simulation-specific correlation을 배울 수 있다.

4D observation은 다음 trade-off를 택한다.

| 효과 | Simulation | Real deployment |
|---|---|---|
| Motor-angle channel 제거 | 사용할 정보가 줄어 peak return이 낮아질 수 있음 | mismatch가 큰 channel을 제거해 observation gap을 줄임 |
| IMU-only feedback | gait phase와 joint state를 직접 알기 어려움 | 같은 의미로 측정 가능한 attitude signal에 집중 |

이것은 observation을 무조건 최소화하라는 뜻이 아니다. Task에 필요한 정보와 deployment에서 신뢰할 수 있는 정보의 교집합을 사용하라는 뜻.

---

## **6. PPO Training Setting**

논문은 PPO를 선택한 이유로 stable한 on-policy method이며 parallelization이 쉽다는 점을 든다.

Policy와 value function은 각각 fully connected hidden layer 두 개를 사용한다. Network size는 hyperparameter search로 정한다.

| Gait | Observation | Policy hidden layers | Value hidden layers | Training time |
|---|---:|---:|---:|---:|
| Trotting | 4D | (125, 89) | (89, 55) | 4.35 h |
| Galloping | 12D | (185, 95) | (95, 85) | 3.25 h |

각 PPO update에서 최대 1,000 steps의 rollout 25개를 parallel하게 수집한다. 각 task는 7 million simulation steps까지 학습한다.

![Trotting과 galloping PPO learning curves](/assets/img/posts/rl/sim2real/agile-locomotion/04-learning-curves.png){: width="780" .d-block .mx-auto }
_위는 trotting, 아래는 galloping return이다. 각 policy는 최대 7 million simulation steps까지 학습했다. 출처: [Tan et al., Figure 5](https://arxiv.org/pdf/1804.10332)._

Paper 3의 RDPG+HER와 비교하면 차이가 분명하다.

| Peng et al. pushing | Tan et al. locomotion |
|---|---|
| Sparse goal reward | Dense forward-distance/energy reward |
| HER replay 필요 | HER 불필요 |
| Off-policy RDPG | On-policy PPO |
| LSTM implicit adaptation | Feedforward feedback policy |
| Dynamics $\mu$를 critic에 입력 | 논문은 별도 privileged critic 구조를 제시하지 않음 |

Dynamics randomization은 특정 RL algorithm에 종속된 기법이 아니다. Task reward, action, observation, data-collection 구조에 따라 SAC, DDPG, PPO 등과 결합할 수 있다.

---

## **7. 실제 결과와 Ablation**

### **7.1 Gallop과 trot의 sim-real speed**

| Gait | Simulation | Real |
|---|---:|---:|
| Galloping | 1.34 m/s, 2.48 body lengths/s | 1.18 m/s, 2.18 body lengths/s |
| Trotting | 0.50 m/s, 0.93 body lengths/s | 0.60 m/s, 1.11 body lengths/s |

Gallop은 simulation보다 real에서 느렸고, trot은 real에서 오히려 조금 빨랐다. 따라서 “sim과 real trajectory가 완전히 같다”는 결과가 아니다.

중요한 것은 두 policy 모두 real robot에서 gait를 유지했고, real data fine-tuning 없이 실행되었다는 점.

### **7.2 Handcrafted gait와 energy 비교**

| Real gait | Speed | Average mechanical power |
|---|---:|---:|
| Handcrafted trot | 0.56 m/s | 92.72 W |
| Learned trot | 0.60 m/s | 71.78 W |
| Handcrafted gallop | 1.21 m/s | 290.00 W |
| Learned gallop | 1.18 m/s | 188.79 W |

Learned gait는 비슷한 speed에서 mechanical power를 줄였다.

- Trot: 약 23% 감소
- Gallop: 약 35% 감소

Reward에 energy term이 있었기 때문에 단순히 최대 속도만 추구하지 않고, 비슷한 속도에서 더 낮은 mechanical power의 gait를 찾았다.

단, 이 table은 Minitaur의 두 handcrafted controller와 비교한 결과. 모든 classical controller보다 RL이 효율적이라는 일반 결론은 아니다.

### **7.3 Reality gap을 return difference로 측정했다**

논문은 success/failure만으로 reality gap을 재지 않는다. Full episode인 1,000 steps, 약 6초 동안 balance했는지는 중요한 지표지만 speed와 energy 차이를 놓친다.

그래서 같은 reward return을 simulation과 real에서 계산하고 차이를 본다.

$$
G_{\text{gap}}
=
\left|
\mathbb{E}[R_{\text{sim}}]
-
\mathbb{E}[R_{\text{real}}]
\right|
$$

Evaluation protocol도 단일 lucky seed만 보는 것보다 넓다.

1. 각 configuration에서 hyperparameter와 seed가 다른 controller 100개를 학습한다.
2. Simulation return이 높은 top 3를 선택한다.
3. 각 controller를 real Minitaur에서 3번 실행한다.
4. 총 9회 real run의 평균 return을 보고한다.

다만 top 3를 simulation performance로 고르는 selection protocol이므로 전체 100개 policy의 transfer success distribution을 보고한 것은 아니다.

### **7.4 Simulator가 틀리면 perturbation으로도 못 막았다**

![Simulation fidelity와 perturbation ablation](/assets/img/posts/rl/sim2real/agile-locomotion/05-simulation-fidelity-ablation.png){: width="900" .d-block .mx-auto }
_왼쪽은 baseline simulation, 가운데는 baseline simulation+perturbation, 오른쪽은 개선된 actuator/latency simulation+perturbation이다. 파랑은 sim, 빨강은 real expected return이다. 출처: [Tan et al., Figure 6](https://arxiv.org/pdf/1804.10332)._

세 group 모두 simulation에서는 높은 return을 보였다.

그러나 real에서는 다음 차이가 나타났다.

| Training setup | Real behavior |
|---|---|
| Baseline simulation | 큰 sim-real gap |
| Baseline + perturbation | 여전히 큰 sim-real gap |
| Improved actuator/latency + perturbation | sim과 real return이 가까워짐 |

저자들은 actuator model과 latency simulation 중 하나만 빠져도 learned controller가 real robot에서 동작하지 않았다고 보고한다.

> Robustness는 잘못된 simulator를 무한히 보상해 주는 대체재가 아니다.

먼저 dominant mismatch를 model에 반영하고, 남은 오차를 randomization과 perturbation으로 덮어야 한다.

### **7.5 Randomization은 peak performance를 낮추고 variance를 줄였다**

![Body inertia 변화에 대한 randomization 효과](/assets/img/posts/rl/sim2real/agile-locomotion/06-inertia-randomization.png){: width="900" .d-block .mx-auto }
_Blue policy는 nominal inertia 근처에서 높은 peak return을 보이지만 range 양끝에서 급격히 무너진다. Randomized policy는 peak는 낮지만 inertia 변화 전반에서 비슷한 return을 유지한다. 출처: [Tan et al., Figure 7](https://arxiv.org/pdf/1804.10332)._

Randomization 없는 policy는 학습한 nominal inertia 근처에서 더 높은 return을 낸다. 그러나 inertia가 달라지면 성능이 급격히 떨어진다.

Randomized policy는 반대이다.

- 평균 peak는 낮아진다.
- Dynamics 변화에 따른 return variance도 낮아진다.

모든 parameter test를 합친 결과도 같은 경향.

![Randomization의 robustness-optimality trade-off](/assets/img/posts/rl/sim2real/agile-locomotion/07-robustness-optimality.png){: width="900" .d-block .mx-auto }
_Randomization을 사용하면 small/large observation 모두에서 mean return과 standard deviation이 함께 낮아진다. 낮은 mean은 보수적 behavior, 낮은 standard deviation은 dynamics 변화에 대한 robustness를 뜻한다. 출처: [Tan et al., Figure 8](https://arxiv.org/pdf/1804.10332)._

논문 표현대로 randomization은 “free meal”이 아니다.

$$
\text{robustness increase}
\quad\Longleftrightarrow\quad
\text{nominal optimality decrease}
$$

그래서 randomization range는 넓을수록 좋은 것이 아니라, 실제 deployment variation을 덮는 데 필요한 만큼이어야 한다.

### **7.6 12D는 sim에서 좋았지만 4D가 real에서 좋았다**

![Observation size와 randomization의 sim-real transfer](/assets/img/posts/rl/sim2real/agile-locomotion/08-observation-transfer.png){: width="900" .d-block .mx-auto }
_Large 12D observation은 simulation return이 높지만 real return이 크게 떨어진다. Small 4D observation과 randomization을 함께 사용한 조건에서 sim-real gap이 가장 작았다. 출처: [Tan et al., Figure 9](https://arxiv.org/pdf/1804.10332)._

Figure 9의 조합은 네 가지.

1. Small 4D observation
2. Small 4D + randomization
3. Large 12D observation
4. Large 12D + randomization

Simulation에서는 12D가 유리하다. Policy가 motor angle까지 사용할 수 있기 때문이다.

Real에서는 반대. 12D policy의 sim-real gap이 더 크다. 저자들은 차원이 커질수록 training observation이 sparse해지고, real에서 비슷한 observation을 만날 가능성이 낮아진다고 해석한다.

Small observation + randomization 조건에서는 top 3 controller의 real run 9회가 모두 3 m 이상 trot했고, 약 6초의 episode 전체에서 balance를 유지했다.

다만 이 결과를 “proprioception은 적을수록 좋다”로 일반화하면 위험하다. Motor angle이 command tracking과 terrain adaptation에 필수인 현대 quadruped policy도 많다. 이 Minitaur setup에서는 motor-angle channel의 sim-real mismatch가 extra information의 이득보다 컸다고 읽어야 한다.

---

## **8. Fidelity와 Robustness를 나눠 보기**

### **8.1 Fidelity와 robustness는 서로 다른 축이다**

Real transition을

$$
P_{\text{real}}
$$

identified nominal simulation을

$$
P_{\hat{\mu}}
$$

라고 하겠다.

System identification, actuator model, latency model은 중심 오차를 줄인다.

$$
d(P_{\hat{\mu}},P_{\text{real}})\downarrow
$$

Randomization은 그 중심 주변의 distribution에서 policy를 학습한다.

$$
\mu\sim\rho(\mu\mid\hat{\mu})
$$

두 단계의 역할은 다르다.

| 축 | 목적 |
|---|---|
| Fidelity | training distribution의 중심을 real dynamics 쪽으로 이동 |
| Robustness | 그 중심 주변에서 policy가 성공하는 범위를 넓힘 |

중심이 너무 멀리 있으면 폭만 넓혀도 real system을 포함하지 못하거나, 지나치게 conservative한 policy가 된다.

### **8.2 Actuator model은 action semantics를 보존한다**

Policy가 출력하는 것은 leg-space position target이다. Simulation과 real의 low-level actuator가 같은 target을 서로 다르게 실현하면 high-level policy의 action 의미가 달라진다.

$$
a_t^{\text{policy}}
\xrightarrow{\text{actuator}}
\tau_t
$$

따라서 action semantics를 맞추려면,

- Torque-current saturation
- Back EMF
- PD implementation
- Battery voltage
- Delay

를 다뤄야 한다.

URDF mass를 잘 맞춰도 actuator mapping이 틀리면 policy가 학습한 control authority가 real에서 존재하지 않을 수 있다.

### **8.3 Compact observation은 deployment-aware feature selection이다**

Training observation distribution을 $p_{\text{sim}}(o)$, real distribution을 $p_{\text{real}}(o)$라고 하겠다.

Observation feature를 추가하면 simulation에서 value estimation이 쉬워질 수 있다. 하지만 추가 channel의 domain gap이 크면

$$
D\!\left(
p_{\text{sim}}(o),
p_{\text{real}}(o)
\right)
$$

가 커질 수 있다.

따라서 observation design의 기준은 “simulator에서 얻을 수 있는가?”가 아니다.

1. Real robot에서 같은 의미로 측정 가능한가?
2. Noise, bias, latency가 허용 가능한가?
3. Task에 실제로 필요한가?
4. Randomization으로 gap을 현실적으로 모델링할 수 있는가?

이 기준은 현재 robot RL에서도 그대로 유효하다.

### **8.4 Open-loop reference는 behavior prior다**

$$
a(t,o)=\bar a(t)+\pi(o)
$$

에서 $\bar a(t)$는 gait의 phase relationship을 미리 제공한다. Policy는 전체 behavior topology를 처음부터 찾는 대신 balance와 efficiency correction에 집중한다.

Reference를 두면 원하는 gait style과 phase를 지정하면서 exploration space를 줄일 수 있다.

- 원하는 gait style을 쉽게 지정할 수 있다.
- Exploration space가 줄어든다.
- User control과 learned feedback을 분리할 수 있다.

단점도 있다.

- Reference에 없는 behavior를 발견하기 어려울 수 있다.
- Phase와 frequency가 fixed prior가 된다.
- Terrain과 command가 바뀌면 reference generator도 확장해야 한다.

Gallop scratch 실험과 trot reference 실험을 함께 둔 이유는 이 spectrum을 보여 주기 위해서다.

---

## **9. 현재 Quadruped Sim2Real에 주는 실전 교훈**

### **9.1 먼저 dominant mismatch를 측정해야 한다**

Randomization config를 만들기 전에 실제 hardware에서 다음을 측정해야 한다.

- Command-to-motion latency
- Control-frequency jitter
- Motor target tracking
- Torque/current saturation
- Battery-voltage dependence
- Sensor bias/noise
- Ground-contact friction range

측정 없이 모든 parameter를 넓게 흔들면 학습 난이도만 높아지고 failure 원인을 알기 어렵다.

### **9.2 Nominal calibration과 randomization margin을 분리해야 한다**

예를 들어 link mass range는 **측정한 nominal mass와 manufacturing·payload uncertainty margin을 분리해** 구성해야 한다.

Nominal 값 자체가 틀린 것을 넓은 range로 숨기면 sim holdout에서 성능은 좋아 보여도 real policy가 불필요하게 보수적일 수 있다.

### **9.3 Control timestep과 latency는 별도로 다뤄야 한다**

Control timestep은 action update 간격이고, latency는 observation이나 action이 실제로 늦게 반영되는 시간.

둘은 비슷해 보이지만 같은 값이 아니다.

| 시간 요소 | 의미 |
|---|---|
| Control-step jitter | 다음 policy query 시각과 action 유지 시간이 달라짐 |
| Latency | policy가 오래된 state를 보거나 action이 늦게 적용됨 |

Modern deployment에서도 simulator의 `dt`, action decimation, inference delay, DDS/communication delay를 한 숫자로 뭉치면 원인을 놓치기 쉽다.

### **9.4 Real validation은 낮은 위험부터 단계적으로 해야 한다**

이 논문은 research demonstration이지만, 실제 robot 적용에서는 다음 순서가 안전하다.

1. Motor target tracking과 latency 단독 검증
2. Suspended or supported low-amplitude action test
3. Stand policy와 perturbation recovery
4. Low-speed gait
5. Command range 확대
6. Terrain과 payload holdout

Randomized simulation return이 높다는 이유만으로 바로 agile gait를 실행하면 안 된다.

---

## **10. 결과를 해석할 수 있는 범위**

**첫째, flat ground와 고정 running direction을 다룬다.**

Velocity command를 실시간으로 바꾸거나 turn하는 범용 locomotion policy가 아니다.

**둘째, terrain perception이 없다.**

Heightmap, depth camera, LiDAR를 사용한 perceptive locomotion은 다음 문제이다.

**셋째, Minitaur의 leg kinematics가 제한적.**

각 leg가 sagittal plane에서 움직이는 8-actuator platform이다. 12-DOF quadruped의 lateral stepping과 yaw control로 그대로 일반화할 수 없다.

**넷째, trot은 user-provided periodic reference에 의존한다.**

Gallop은 scratch에서 나왔지만 trot의 diagonal phase structure는 reference로 지정했다.

**다섯째, feedforward policy이며 online adaptation module이 없다.**

History로 dynamics를 추정하는 RNN이나 RMA-style adaptation은 사용하지 않는다.

**여섯째, real evaluation은 top simulation policies를 선택해 수행한다.**

각 condition에서 100개를 학습했지만 real에는 top 3만 배포했다. 전체 seed의 transfer success rate는 아니다.

**일곱째, actuator와 latency ablation은 중요하지만 정밀한 component별 수치 table은 제한적.**

논문은 둘 중 하나가 없어도 real에서 동작하지 않았다고 보고하지만, motor-model error와 latency error 각각의 continuous sensitivity curve까지 제공하지는 않는다.

**여덟째, randomization range는 수동 설계이다.**

Real failure data로 distribution을 자동 업데이트하지 않는다.

**아홉째, hardware safety layer는 자세히 다루지 않는다.**

Torque/temperature limit, fall detection 이후 recovery, emergency stop 절차는 논문의 핵심 범위가 아니다.

---

## **11. Model과 Policy를 함께 설계해야 한다**

Minitaur 실험에서는 URDF parameter 외에도 actuator mapping, saturation, battery voltage, control timing과 latency가 action의 실제 의미를 바꿨다. System identification이 distribution의 중심을 맞췄고, randomization과 perturbation은 그 주변의 residual mismatch를 견디게 했다. Baseline simulator에 perturbation만 넣어서는 transfer되지 않았다는 ablation이 두 역할의 차이를 잘 보여준다.

4D observation의 결과도 정보는 많을수록 좋다는 직관과 달랐다. Real robot에서 같은 의미와 품질로 측정할 수 있는 feature를 고르는 일이 더 중요했다. 다만 gallop과 trot 결과는 flat ground, 고정 방향, simulation 성능으로 고른 top policy라는 범위 안에서 해석해야 한다.

Paper 3이

> Dynamics distribution을 넓히고 history로 그 차이에 적응하자.

였다면, Paper 4는 다음 문장을 추가한다.

> Randomization 전에 actuator, latency, action, observation이 real system과 같은 의미를 갖도록 simulator를 먼저 고쳐야 한다.

다음 글인 **[Agile and Dynamic Motor Skills](/posts/learning-agile-dynamic-motor-skills/)**에서는 같은 actuator-aware Sim2Real 흐름이 더 큰 ANYmal과 fall recovery까지 확장된다.

## **참고 자료**

- [Tan et al., arXiv paper and source](https://arxiv.org/abs/1804.10332)
- [RSS 2018 proceedings paper](https://www.roboticsproceedings.org/rss14/p10.pdf)
- [Official accompanying video](https://www.youtube.com/watch?v=lUZUr7jxoqM)
- [PPO paper](https://arxiv.org/abs/1707.06347)
- [PyBullet project](https://github.com/bulletphysics/bullet3)
