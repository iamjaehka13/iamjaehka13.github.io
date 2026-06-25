---
title: "[Sim2Real Paper 4] Learning Agile Locomotion"
date: 2026-06-24 17:32:00 +0900
categories: [RL, Sim2Real, Paper]
tags: [sim2real, quadruped-locomotion, dynamics-randomization, actuator-model, latency]
description: "Tan et al.의 Sim-to-Real: Learning Agile Locomotion For Quadruped Robots를 통해 quadruped Sim2Real의 actuator model, latency, system identification, randomization을 정리한다."
math: true
---

## **0. 전체 그림: Quadruped Sim2Real의 기본 조합**

3편에서는 Peng et al.의 dynamics randomization을 봤습니다.

Mass, friction, damping, controller gain, action timestep, observation noise 같은 physical parameter를 흔들면 real dynamics에 더 잘 버티는 policy를 만들 수 있다는 내용이었습니다.

Tan et al.의 **Sim-to-Real: Learning Agile Locomotion For Quadruped Robots**는 이 아이디어를 quadruped locomotion으로 가져옵니다.

이 논문은 quadruped Sim2Real 입문에서 중요합니다. 이유는 하나입니다.

> 실제 보행 transfer는 randomization 하나로 끝나지 않고, actuator model, latency, system identification, compact observation, perturbation이 같이 필요하다는 것을 보여준다.

실험 robot은 Ghost Robotics의 **Minitaur**입니다. 논문은 simulation에서 trotting과 galloping policy를 학습하고, real Minitaur에 올립니다.

Quadruped locomotion은 manipulation보다 transfer가 더 까다롭습니다. 로봇은 계속 contact를 만들고 끊습니다. 발이 지면에 닿는 순간 force가 생기고, body attitude가 흔들리며, actuator가 원하는 target을 못 따라가면 바로 넘어질 수 있습니다.

Simulation에서 좋은 gait가 나왔다고 해도 real robot에서는 다음 차이 때문에 깨질 수 있습니다.

- actuator torque-speed 특성
- motor command와 sensor feedback 사이의 latency
- body mass와 inertia 오차
- foot-ground friction 차이
- IMU bias와 sensor noise
- control step 변동
- battery voltage와 motor strength 변화

이 논문의 질문은 다음입니다.

> Deep RL로 학습한 quadruped gait를 real robot에 안정적으로 옮기려면 simulator와 policy 학습 구조를 어떻게 만들어야 하는가?

## **1. 논문 정보**

| 항목 | 내용 |
|---|---|
| Title | Sim-to-Real: Learning Agile Locomotion For Quadruped Robots |
| Authors | Jie Tan, Tingnan Zhang, Erwin Coumans, Atil Iscen, Yunfei Bai, Danijar Hafner, Steven Bohez, Vincent Vanhoucke |
| Year | 2018 |
| Venue | Robotics: Science and Systems 2018 |
| Robot | Ghost Robotics Minitaur |
| Tasks | galloping, trotting |
| Simulator | Bullet |
| Key transfer tools | system identification, actuator model, latency simulation, dynamics randomization, perturbation, compact observation |
| Source | [arXiv](https://arxiv.org/abs/1804.10332), [RSS PDF](https://www.roboticsproceedings.org/rss14/p10.pdf) |

이 논문은 "quadruped RL policy를 sim에서 학습해서 real robot에 올린다"는 흐름에서 초기에 매우 중요한 예시입니다.

## **2. 핵심 아이디어: Simulator를 고치고 Policy도 robust하게 만들기**

이 논문은 reality gap을 두 방향에서 줄입니다.

첫째, simulator 자체를 현실에 가깝게 만듭니다.

- robot body parameter를 system identification으로 맞춥니다.
- actuator model을 더 현실적으로 만듭니다.
- latency를 simulation에 넣습니다.

둘째, policy가 남아 있는 gap에 버티도록 학습합니다.

- dynamics parameter를 randomize합니다.
- random perturbation을 넣습니다.
- observation space를 compact하게 만듭니다.

즉 구조는 다음과 같습니다.

| 축 | 역할 |
|---|---|
| system identification | 평균적인 robot model을 현실에 가깝게 맞춤 |
| actuator model | motor command와 실제 motion 차이를 줄임 |
| latency simulation | feedback delay로 인한 instability를 미리 반영 |
| dynamics randomization | 남은 parameter error에 robust하게 만듦 |
| perturbation | 외란에 버티는 gait를 유도 |
| compact observation | real에서 불안정하거나 unreliable한 정보를 줄임 |

이 조합이 quadruped Sim2Real의 기본 감각입니다.

논문은 두 가지 gait를 real Minitaur에서 보여줍니다.

첫 번째는 galloping입니다. 기본 simulator에서는 agile gait가 잘 나오지 않았고, real robot에서는 gap 때문에 바로 넘어졌습니다. 하지만 actuator model과 latency를 개선한 뒤에는 galloping gait가 학습되었습니다. 논문은 galloping speed를 simulation에서 약 1.34 m/s, real world에서 약 1.18 m/s로 보고합니다.

두 번째는 trotting입니다. Trotting은 open-loop reference signal을 제공해서 원하는 gait style을 유도합니다. 이 reference만으로는 real robot에서 안정적으로 움직일 수 없고, learned feedback controller가 balance를 유지해야 합니다.

Trotting에서는 compact observation이 특히 중요했습니다. Observation을 줄여 IMU 중심의 정보로 재학습했을 때 simulation과 real robot에서 더 안정적인 움직임이 나왔습니다.

## **3. 핵심 아이디어의 이론적 원리**

이 논문의 이론적 핵심은 quadruped Sim2Real을 하나의 문제로 보지 않고, 여러 gap을 서로 다른 방식으로 줄이는 조합 문제로 본다는 점입니다.

```text
model mismatch
-> system identification / actuator model / latency model

residual uncertainty
-> dynamics randomization / perturbation

unreliable observation
-> compact observation
```

### **3.1 System identification은 nominal dynamics를 맞춘다**

3편에서 본 dynamics randomization은 가능한 dynamics distribution을 넓게 잡는 방법이었습니다.

하지만 randomization만으로 모든 것을 해결하려고 하면 distribution이 너무 넓어질 수 있습니다. 그러면 policy가 지나치게 보수적이거나 둔한 gait를 학습할 수 있습니다.

그래서 이 논문은 먼저 system identification으로 nominal model을 현실에 가깝게 맞춥니다.

Simulator parameter를 $\theta$라고 두면, simulation transition은 다음처럼 볼 수 있습니다.

$$
s_{t+1}
\sim
P_{\theta}(\cdot \mid s_t, a_t)
$$

System identification은 real robot trajectory와 simulation trajectory의 차이가 작아지도록 $\theta$를 찾는 과정입니다.

$$
\theta^{*}
=
\arg\min_{\theta}
\mathcal{L}
\left(
\tau_{\mathrm{real}},
\tau_{\mathrm{sim}}(\theta)
\right)
$$

여기서 $\tau_{\mathrm{real}}$은 실제 robot trajectory이고, $\tau_{\mathrm{sim}}(\theta)$는 parameter $\theta$로 굴린 simulation trajectory입니다.

이 접근의 목적은 real robot을 완벽하게 복사하는 것이 아닙니다. 평균적인 body parameter, mass, inertia, actuator behavior를 현실 근처로 가져와서 randomization이 덮어야 할 gap을 줄이는 것입니다.

즉 구조는 다음과 같습니다.

```text
system identification
-> center of simulation distribution을 real 근처로 이동

dynamics randomization
-> 남은 uncertainty를 distribution으로 덮음
```

### **3.2 Actuator model은 action과 motion 사이의 gap을 줄인다**

Legged robot에서 policy action은 곧바로 body motion이 되지 않습니다.

Policy가 joint target이나 motor command를 내면, actuator와 low-level controller가 그 command를 실제 joint torque와 motion으로 바꿉니다.

이상적인 simulator에서는 다음처럼 단순하게 생각할 수 있습니다.

$$
\tau
=
K_p(q_{\mathrm{des}} - q)
+
K_d(\dot{q}_{\mathrm{des}} - \dot{q})
$$

하지만 real actuator는 이보다 복잡합니다.

Motor torque는 joint state, motor speed, battery voltage, internal controller, friction, saturation, delay에 영향을 받습니다.

더 일반적으로는 다음처럼 볼 수 있습니다.

$$
\tau_t
=
g(u_t, q_t, \dot{q}_t, V_t, h_t)
$$

여기서 $u_t$는 command, $V_t$는 battery voltage, $h_t$는 actuator나 controller의 history를 나타냅니다.

Tan et al.은 Minitaur actuator에 대해 더 현실적인 actuator model을 넣습니다. 이 점이 중요한 이유는 quadruped locomotion에서는 actuator mismatch가 바로 gait mismatch로 이어지기 때문입니다.

```text
wrong actuator model
-> wrong joint tracking
-> wrong contact timing
-> wrong body attitude
-> fall or unstable gait
```

즉 actuator model은 단순한 low-level detail이 아닙니다. Policy가 학습하는 transition $P(s_{t+1} \mid s_t, a_t)$ 자체를 바꾸는 핵심 요소입니다.

### **3.3 Latency는 closed-loop stability를 바꾼다**

논문에서 actuator model과 함께 중요한 것이 latency입니다.

Simulation에서는 command가 즉시 적용되고, sensor feedback도 즉시 들어오는 것처럼 보이기 쉽습니다.

하지만 real robot에서는 action과 observation 사이에 시간이 걸립니다.

```text
policy computes action at time t
-> command reaches controller after delay
-> actuator moves after delay
-> sensor measurement returns after delay
-> policy sees delayed state
```

이를 수식으로 단순화하면, policy가 실제로 보고 있는 것은 현재 state가 아니라 delayed state입니다.

$$
a_t = \pi(o_{t-d_o})
$$

그리고 action도 즉시 적용되지 않고 delayed action으로 들어갑니다.

$$
s_{t+1}
\sim
P(s_t, a_{t-d_a})
$$

여기서 $d_o$는 observation delay, $d_a$는 action delay에 해당합니다.

이 차이는 closed-loop control에서 매우 큽니다. Feedback controller는 현재 상태를 보고 바로 보정한다고 가정하는데, 실제로는 과거 상태를 보고 늦게 action을 적용할 수 있습니다.

그래서 latency를 무시한 simulation은 실제보다 안정적인 controller를 허용합니다.

> Simulation에서 feedback이 즉시 돌아오면 controller의 안정 영역이 실제보다 훨씬 커질 수 있다.

논문은 latency를 measurement history에서 interpolation하는 방식으로 simulation에 넣습니다. 또한 microcontroller의 PD servo latency와 Jetson TX2에서 실행되는 locomotion controller latency를 따로 측정합니다. TX2 쪽 locomotion controller latency는 대략 15-19ms 수준으로 보고됩니다.

이론적으로 보면 latency modeling은 transition을 다음처럼 바꾸는 것입니다.

```text
ideal transition:
s_t, a_t -> s_{t+1}

delayed transition:
s_t, a_{t-d_a}, o_{t-d_o} -> s_{t+1}
```

즉 latency는 단순한 implementation detail이 아니라, policy가 학습해야 하는 closed-loop dynamics의 일부입니다.

### **3.4 Dynamics randomization은 남은 uncertainty를 덮는다**

System identification과 actuator model, latency modeling을 해도 simulator는 여전히 현실과 다릅니다.

Body mass, inertia, motor friction, foot-ground friction, control step, battery voltage, IMU noise 같은 요소는 정확히 고정하기 어렵습니다.

그래서 논문은 system identification으로 맞춘 nominal model 주변에서 dynamics randomization을 사용합니다.

논문에서 randomize한 축은 다음과 같습니다.

| Randomization axis | 의미 |
|---|---|
| mass | body parameter uncertainty |
| inertia | uniform density 가정 등으로 생기는 오차 |
| motor friction | actuator wear, friction 차이 |
| motor strength | motor 출력 변화 |
| control step | control timing 변동 |
| latency | non-real-time system delay 변동 |
| battery voltage | fully charged 여부에 따른 motor behavior 차이 |
| lateral friction | foot와 carpet floor 사이의 마찰 |
| IMU noise / bias | sensor measurement error |

3편에서 쓴 notation으로 보면, dynamics randomization은 다음 objective를 학습하는 것입니다.

$$
\max_{\pi}
\mathbb{E}_{\xi \sim p(\xi)}
\left[
J(\pi; \mathcal{M}_{\xi})
\right]
$$

여기서 이 논문의 특징은 $p(\xi)$를 완전히 임의로 크게 잡는 것이 아니라, system identification으로 얻은 nominal value 주변에 둔다는 것입니다.

```text
identified nominal parameter
-> add realistic margin
-> train robust policy around that region
```

따라서 system identification과 dynamics randomization은 경쟁 관계가 아니라 보완 관계입니다.

| 역할 | 의미 |
|---|---|
| system identification | distribution 중심을 real 근처로 이동 |
| dynamics randomization | 중심 주변의 residual uncertainty를 덮음 |

### **3.5 Compact observation은 unreliable signal에 대한 의존을 줄인다**

Simulation에서는 많은 값을 쉽게 볼 수 있습니다.

하지만 real robot에서 같은 값을 안정적으로 얻는 것은 별개의 문제입니다. 어떤 값은 noisy하고, 어떤 값은 latency가 크고, 어떤 값은 estimator가 필요합니다.

Policy가 이런 값에 과하게 의존하면 simulation에서는 잘 걷지만 real robot에서는 깨질 수 있습니다.

Compact observation은 policy에게 꼭 필요한 정보만 주고, unreliable하거나 sim-specific한 정보를 줄이는 접근입니다.

이것은 일종의 information bottleneck처럼 볼 수 있습니다.

```text
large observation
-> policy can exploit simulator-specific detail

compact observation
-> policy must rely on robust, deployable signal
```

논문에서 trotting policy는 observation을 줄였을 때 transfer가 더 안정적이었습니다. 특히 IMU 중심의 정보와 필요한 joint/motor state를 사용하는 쪽이 real deployment에 더 적합했습니다.

이 관점에서 observation design은 단순히 input dimension을 줄이는 문제가 아닙니다.

> Policy가 real에서 믿을 수 있는 정보만 사용하도록 만드는 Sim2Real regularization이다.

### **3.6 Perturbation은 recovery behavior를 학습시킨다**

Quadruped locomotion은 nominal gait만 잘한다고 충분하지 않습니다.

Real robot에서는 작은 충격, contact slip, sensor noise, uneven floor 때문에 state가 nominal trajectory에서 벗어납니다. Policy가 이런 state를 학습 중에 경험하지 못하면, 작은 외란에도 복구하지 못하고 넘어질 수 있습니다.

Perturbation은 policy가 nominal rollout 주변의 off-nominal state를 경험하게 만듭니다.

```text
nominal training only
-> policy learns to walk near ideal trajectory

training with perturbation
-> policy learns how to recover from nearby failures
```

이것은 dynamics randomization과 비슷하지만, 초점이 조금 다릅니다.

Dynamics randomization은 environment parameter를 바꿉니다. Perturbation은 rollout 중 robot state를 흔들어 recovery behavior를 학습하게 합니다.

둘 다 real deployment에서 policy가 fragile해지는 것을 막는 역할을 합니다.

## **4. Sim2Real 관점에서의 해석**

이 논문은 quadruped Sim2Real에서 중요한 교훈을 줍니다.

첫째, randomization만으로 충분하지 않을 수 있습니다.

Actuator model과 latency가 너무 틀리면, policy는 real robot에서 첫 발도 제대로 못 뗄 수 있습니다. 이 경우 randomization range를 아무리 넓혀도 policy가 필요한 actuator behavior를 제대로 학습하지 못할 수 있습니다.

둘째, simulator fidelity만으로도 충분하지 않습니다.

아무리 system identification을 해도 foot friction, IMU noise, battery state, control timing 같은 uncertainty는 남습니다. 그래서 randomization과 perturbation이 필요합니다.

셋째, observation design이 transfer에 영향을 줍니다.

Simulation에서는 알 수 있는 정보라도 real robot에서 noisy하거나 latency가 있거나 추정이 불안정하면 policy가 그 정보에 의존하다가 real에서 깨질 수 있습니다.

이 논문의 Sim2Real 구조는 다음처럼 정리할 수 있습니다.

```text
fit nominal model
-> add realistic actuator and latency model
-> randomize residual uncertainty
-> train policy with compact deployable observation
-> add perturbation for recovery
```

정리하면 다음입니다.

> Quadruped Sim2Real은 actuator fidelity와 policy robustness를 동시에 맞춰야 한다.

이 점이 앞선 dynamics randomization 논문과의 차이입니다. Peng et al.은 physical parameter distribution을 넓히는 관점을 보여줬고, Tan et al.은 legged locomotion에서는 actuator, latency, observation, perturbation까지 같이 맞춰야 한다는 것을 보여줍니다.

## **5. 이 논문의 한계**

이 논문은 quadruped Sim2Real의 핵심 입문 논문이지만, 그대로 모든 robot에 적용되지는 않습니다.

첫째, robot이 Minitaur입니다.

Minitaur는 direct-drive actuator에 가까운 구조라 actuator analytic model을 만들기 상대적으로 쉽습니다. 더 복잡한 actuator와 low-level controller stack을 가진 robot에서는 analytic actuator model만으로 부족할 수 있습니다.

둘째, terrain generalization이 주제는 아닙니다.

논문은 주로 carpet/floor 위의 galloping과 trotting transfer를 다룹니다. Rough terrain, deformable terrain, outdoor terrain generalization은 이후 논문들이 더 직접적으로 다룹니다.

셋째, trotting은 open-loop reference를 사용합니다.

Trotting policy는 reference signal을 통해 gait style을 유도합니다. 따라서 완전히 unconstrained하게 gait를 발견하는 문제와는 조금 다릅니다.

넷째, randomization range는 여전히 수동 설계에 의존합니다.

System identification을 통해 nominal value를 잡지만, 각 parameter를 어느 범위로 randomize할지는 여전히 사람이 정해야 합니다.

다섯째, actuator model이 robot-specific합니다.

이 논문에서 사용한 actuator model과 latency calibration은 Minitaur에 맞춘 것입니다. 다른 quadruped에 적용하려면 해당 robot의 actuator, controller, communication, sensor stack을 다시 분석해야 합니다.

그래도 quadruped Sim2Real에서 actuator, latency, randomization을 한 번에 봐야 한다는 감각은 이 논문에서 잘 잡힙니다.

## **6. 정리하며: Robust Policy만으로는 부족하다**

이번 글에서는 Tan et al.의 **Sim-to-Real: Learning Agile Locomotion For Quadruped Robots**를 정리했습니다.

- Quadruped Sim2Real에서는 actuator model과 latency가 매우 중요합니다.
- System identification은 nominal dynamics를 real 근처로 맞추고, randomization은 남은 uncertainty를 덮습니다.
- Actuator model은 policy action이 실제 joint torque와 motion으로 바뀌는 mapping을 현실적으로 만듭니다.
- Latency는 closed-loop stability를 바꾸므로 simulation 안에 반영해야 합니다.
- Compact observation은 real에서 unreliable한 signal에 대한 의존을 줄입니다.
- Random perturbation은 nominal gait 주변에서 recovery behavior를 학습하게 합니다.
- Galloping과 trotting policy가 simulation에서 학습된 뒤 real Minitaur로 transfer되었습니다.

4편의 핵심은 이렇게 정리할 수 있습니다.

> Legged Sim2Real에서는 simulator를 고치는 것과 policy를 robust하게 만드는 것을 같이 해야 한다.

다음 글에서는 이 흐름이 ANYmal처럼 더 복잡한 actuator와 full-size quadruped로 넘어가면서 어떻게 바뀌는지 보겠습니다.
