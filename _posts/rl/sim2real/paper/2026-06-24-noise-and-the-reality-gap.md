---
title: "[Sim2Real Paper 1] Noise and The Reality Gap"
date: 2026-06-24 12:45:00 +0900
categories: [RL, Sim2Real, Paper]
tags: [sim2real, reality-gap, robot-simulation, noise, evolutionary-robotics]
description: Jakobi et al.의 Noise and The Reality Gap을 통해 Sim2Real에서 reality gap이 왜 생기고, simulation noise가 어떤 역할을 하는지 정리한다.
math: true
---

## **0. 전체 그림: Simulation은 왜 현실과 달라지는가**

Sim2Real을 이해하려면 먼저 **Reality Gap**이라는 문제를 잡아야 합니다.

강화학습에서는 보통 simulation에서 policy를 학습합니다. Simulation은 빠르고, 안전하고, reset이 쉽습니다. 로봇이 넘어져도 다시 세우면 되고, 수천 개 환경을 병렬로 돌릴 수도 있습니다.

하지만 실제 로봇은 다릅니다.

같은 action을 줘도 actuator가 완전히 똑같이 움직이지 않고, sensor에는 noise가 있으며, 바닥 마찰과 contact도 매번 조금씩 달라집니다. 그래서 simulation에서 잘 작동하던 policy가 실제 로봇에서는 바로 깨질 수 있습니다.

> **Reality Gap**이란?
>
> Simulation에서 학습하거나 검증한 robot behavior가 실제 robot에서 그대로 재현되지 않는 차이를 말합니다.

Jakobi, Husbands, Harvey의 **Noise and The Reality Gap: The Use of Simulation in Evolutionary Robotics**는 이 문제를 아주 초기에 정면으로 다룬 논문입니다.

논문은 1995년에 나온 오래된 evolutionary robotics 논문입니다. 지금의 PPO, Isaac Gym, legged gym, quadruped locomotion과는 시대도 다르고 방법도 다릅니다. 그래도 Sim2Real을 공부할 때 이 논문을 먼저 볼 만한 이유가 있습니다.

이 논문은 다음 질문을 던집니다.

> Simulation을 현실과 완전히 같게 만들 수 없다면, 우리는 simulation을 어떻게 써야 하는가?

## **1. 논문 정보**

| 항목 | 내용 |
|---|---|
| Title | Noise and The Reality Gap: The Use of Simulation in Evolutionary Robotics |
| Authors | Nick Jakobi, Phil Husbands, Inman Harvey |
| Year | 1995 |
| Robot | Khepera two-wheeled robot |
| Tasks | obstacle avoidance, light seeking |
| Controller | recurrent dynamical neural network |
| Training method | evolutionary robotics |
| Source | [PDF](https://cse-robotics.engr.tamu.edu/dshell/cs689/papers/jakobi95noise.pdf) |

지금 기준으로 보면 실험은 작습니다. 사족보행도 아니고, modern deep RL도 아닙니다. 하지만 핵심 질문은 지금도 그대로입니다.

> Simulation에서 얻은 behavior가 real robot에서도 같은 behavior로 나오는가?

## **2. 핵심 아이디어: Noise를 현실의 일부로 넣기**

이 논문에서 가장 중요한 개념은 **envelope of noise**입니다.

완벽한 simulation을 만드는 것은 어렵습니다. 특히 robot이 실제 환경과 상호작용할수록 모든 sensor, actuator, contact, material property를 정확히 모델링하기는 어렵습니다.

그러면 한 가지 방법은 simulation에 적절한 noise를 넣는 것입니다.

> **Envelope of noise**란?
>
> 실제 robot에서 생기는 불확실성을 simulation 안에서 일정 범위의 noise로 감싸서, controller가 깨끗한 simulation에만 맞춰지지 않도록 하는 방법입니다.

여기서 중요한 점은 noise가 단순한 방해물이 아니라는 것입니다. 이 논문에서 noise는 simulation을 일부러 더 어렵게 만들기 위한 장치가 아니라, **real world에서 피할 수 없는 불확실성을 training distribution 안으로 넣는 장치**입니다.

적절한 noise는 controller가 simulation의 특수한 조건에 overfit되는 것을 막습니다. Simulation 안에서 조금 흔들리는 세계를 경험한 controller는 실제 robot의 불완전함에도 더 잘 버틸 수 있습니다.

지금 용어로 바꿔 말하면, 이 논문은 domain randomization의 초기 형태를 보여준다고 볼 수 있습니다. 다만 이 논문은 modern deep RL이나 quadruped locomotion 논문이 아니라, evolutionary robotics에서 controller transfer를 다룬 초기 논문입니다.

| 1995년 논문에서의 관점 | 현대 Sim2Real에서의 대응 |
|---|---|
| sensor noise | observation noise |
| motor noise | actuator variation |
| noisy simulation | domain randomization |
| simulation-real correspondence | sim-to-real validation |
| envelope of noise | randomization range |

논문은 Khepera robot을 대상으로 simulation을 만들고, 그 안에서 neural network controller를 evolution으로 학습합니다. 이후 학습된 controller를 실제 Khepera robot에 올려서 behavior가 얼마나 비슷하게 나오는지 확인합니다.

실험 task는 obstacle avoidance와 light seeking입니다. Controller는 세 가지 noise 조건에서 학습됩니다.

| 조건 | 의미 |
|---|---|
| zero noise | simulation에 noise를 넣지 않음 |
| observed noise | 실제 robot에서 관찰된 수준의 noise를 넣음 |
| double noise | observed noise보다 더 큰 noise를 넣음 |

결과를 단순히 요약하면 observed noise 조건이 가장 좋았습니다.

| Task | zero noise | observed noise | double noise |
|---|---:|---:|---:|
| obstacle avoidance | 6.2 | 8.0 | 6.8 |
| light seeking | 5.6 | 7.8 | 5.4 |

여기서 correspondence score는 simulation behavior와 real robot behavior가 얼마나 잘 맞는지를 평가한 값입니다.

이 결과에서 바로 얻을 수 있는 결론은 다음입니다.

> Noise는 없는 것보다 있는 편이 좋을 수 있지만, 많을수록 좋은 것은 아니다.

즉 핵심은 noise의 양 자체가 아니라, **real robot에서 실제로 생기는 variation을 적절한 범위로 감싸는 것**입니다.

## **3. 핵심 아이디어의 이론적 원리**

이 논문의 이론적 의미는 "simulation에 noise를 넣었다"보다 더 넓게 볼 수 있습니다. 핵심은 controller가 하나의 깨끗한 simulator에 과적합되는 문제를 줄이고, real world에서 나타날 수 있는 transition variation에 대해 robust하게 만드는 것입니다.

### **3.1 Clean simulation은 하나의 좁은 MDP다**

Reinforcement learning 관점으로 보면, simulation environment는 하나의 MDP로 볼 수 있습니다.

$$
\mathcal{M}_{\mathrm{sim}}
= (\mathcal{S}, \mathcal{A}, P_{\mathrm{sim}}, R_{\mathrm{sim}}, \gamma)
$$

여기서 $P_{\mathrm{sim}}(s_{t+1} \mid s_t, a_t)$는 simulation 안에서 state와 action이 다음 state로 이어지는 transition입니다.

문제는 real robot의 transition이 이와 같지 않다는 점입니다.

$$
P_{\mathrm{real}}(s_{t+1} \mid s_t, a_t)
\neq
P_{\mathrm{sim}}(s_{t+1} \mid s_t, a_t)
$$

Naive simulation은 하나의 고정된 transition을 제공합니다. Sensor는 항상 깨끗하고, actuator는 명령을 거의 정확히 따르고, contact도 단순하게 처리됩니다.

그러면 controller는 다음 objective에 맞춰집니다.

$$
\max_{\pi} J(\pi; \mathcal{M}_{\mathrm{sim}})
$$

하지만 우리가 실제로 원하는 것은 real robot에서 잘 동작하는 controller입니다.

$$
\max_{\pi} J(\pi; \mathcal{M}_{\mathrm{real}})
$$

두 MDP의 transition이 다르면, simulation에서 높은 return을 얻는 policy가 real robot에서도 높은 return을 얻는다는 보장은 없습니다. 이 차이가 바로 reality gap입니다.

### **3.2 Noise는 transition distribution을 넓힌다**

Noise를 넣는다는 것은 simulator를 하나의 deterministic world로 두지 않고, 여러 possible world를 갖는 distribution으로 바꾸는 것과 비슷합니다.

이를 parameterized simulator로 보면 다음처럼 쓸 수 있습니다.

$$
\mathcal{M}_{\xi}
= (\mathcal{S}, \mathcal{A}, P_{\xi}, R_{\xi}, \gamma),
\quad
\xi \sim p(\xi)
$$

여기서 $\xi$는 sensor noise, motor noise, 환경 perturbation 같은 simulation variation을 나타냅니다.

Noise가 들어간 training은 하나의 simulator에서만 잘하는 policy를 찾는 것이 아니라, noise distribution 위에서 평균적으로 잘 동작하는 policy를 찾는 문제에 가까워집니다.

$$
\max_{\pi}
\mathbb{E}_{\xi \sim p(\xi)}
\left[
J(\pi; \mathcal{M}_{\xi})
\right]
$$

이 관점에서 envelope of noise는 $p(\xi)$의 support를 정하는 문제입니다.

즉, 어떤 불확실성을 포함할 것인지, 각 불확실성을 어느 정도 범위로 흔들 것인지가 중요합니다.

### **3.3 Noise envelope은 coverage 문제다**

Noise envelope이 너무 좁으면 real world가 training distribution 밖에 있을 수 있습니다.

```text
training distribution too narrow
-> policy only sees clean / limited cases
-> real perturbation falls outside training support
-> transfer fails
```

반대로 noise envelope이 너무 넓어도 문제가 생깁니다.

```text
training distribution too wide
-> policy must survive unrealistic perturbations
-> task signal becomes harder to exploit
-> policy becomes conservative or inefficient
```

그래서 이 논문의 중요한 메시지는 "noise를 많이 넣자"가 아닙니다.

> Real robot에서 실제로 생기는 variation을 덮을 만큼은 넓고, task structure를 잃을 만큼은 넓지 않은 noise envelope이 필요하다.

이것이 현대 Sim2Real에서 randomization range를 잡는 문제와 연결됩니다.

### **3.4 Noise는 shortcut을 막는다**

Clean simulation에서는 controller가 현실에서는 성립하지 않는 shortcut을 사용할 수 있습니다.

예를 들어 sensor가 항상 깨끗하면 controller는 아주 작은 sensor 차이에 민감하게 반응하는 전략을 학습할 수 있습니다. Motor가 항상 정확하면 controller는 실제 actuator가 따라가기 어려운 빠르고 날카로운 command를 사용할 수 있습니다.

이런 strategy는 simulation 안에서는 높은 score를 얻을 수 있지만, real robot에서는 작은 noise나 delay만 들어와도 깨질 수 있습니다.

Noise를 넣으면 이런 shortcut이 불안정해집니다. Controller는 한 번의 깨끗한 trajectory에만 의존할 수 없고, 여러 perturbation 아래에서도 유지되는 feature와 behavior를 찾아야 합니다.

현대적인 표현으로 말하면, noise는 policy가 simulation-specific feature에 overfit되는 것을 줄이고, real world에서도 유지될 가능성이 높은 invariant behavior를 학습하도록 압력을 줍니다.

### **3.5 Correspondence는 reward와 다르다**

이 논문에서 중요한 또 다른 점은 real transfer를 단순히 simulation score로 판단하지 않는다는 것입니다.

Simulation에서 reward가 높아도 real robot에서 같은 behavior가 나오지 않으면 transfer에 실패한 것입니다.

그래서 논문은 simulation behavior와 real behavior의 correspondence를 봅니다.

이 관점은 지금도 중요합니다.

$$
\text{high sim reward}
\nRightarrow
\text{high real correspondence}
$$

즉 Sim2Real에서는 policy performance뿐 아니라, simulation에서 보인 behavior가 real robot에서 얼마나 재현되는지도 봐야 합니다.

이것은 이후 domain randomization, dynamics randomization, actuator model 논문으로 이어지는 중요한 기준입니다.

## **4. Sim2Real 관점에서의 해석**

이 논문은 작은 Khepera robot과 evolutionary controller를 다룹니다. 하지만 Sim2Real 관점에서 보면 이후 연구의 기본 문장을 이미 갖고 있습니다.

> Real world를 정확히 복제할 수 없다면, real world에서 생기는 불확실성을 training distribution 안에 넣어야 한다.

### **4.1 Simulation fidelity와 robustness는 같이 봐야 한다**

Sim2Real에는 크게 두 방향이 있습니다.

첫째, simulator를 현실에 가깝게 맞추는 방향입니다.

```text
system identification
actuator modeling
contact parameter fitting
sensor calibration
```

둘째, policy가 남은 차이에 버티도록 만드는 방향입니다.

```text
noise injection
domain randomization
dynamics randomization
external perturbation
observation noise
```

이 논문은 두 번째 방향의 초기 형태에 가깝습니다. Simulator를 완벽하게 만들기 어렵다면, 현실에서 생기는 흔들림을 simulation에 넣어 controller가 fragile해지지 않게 만들자는 것입니다.

### **4.2 Randomization range는 설계 변수다**

현대 Sim2Real에서는 noise라는 단어보다 randomization이라는 단어를 더 많이 씁니다.

하지만 문제의 형태는 같습니다.

| Jakobi et al.의 noise | 현대 Sim2Real의 randomization |
|---|---|
| sensor noise | observation noise |
| motor noise | actuator strength / motor delay |
| environment noise | friction, terrain, mass, contact variation |
| observed noise | measured or realistic randomization range |
| double noise | overly broad randomization range |

이 논문이 보여주는 핵심은 randomization range를 크게 잡는 것이 항상 좋은 것이 아니라는 점입니다.

Range가 너무 좁으면 real world를 덮지 못합니다. Range가 너무 넓으면 policy가 실제로는 필요 없는 불확실성까지 견디느라 task performance를 잃을 수 있습니다.

따라서 Sim2Real에서 randomization은 "많이 넣는 옵션"이 아니라, real deployment condition을 보고 설계해야 하는 training distribution입니다.

### **4.3 Evaluation은 real behavior correspondence를 봐야 한다**

Sim2Real에서 중요한 질문은 다음입니다.

```text
simulation에서 성공했는가?
```

보다 더 정확히는 다음입니다.

```text
simulation에서 나온 behavior가 real robot에서도 같은 구조로 재현되는가?
```

이 차이가 중요합니다.

Policy가 simulation reward를 잘 얻더라도, real robot에서 sensor noise, actuator delay, contact variation 때문에 다른 behavior로 바뀌면 transfer에 실패한 것입니다.

그래서 Sim2Real 평가에서는 reward, success rate뿐 아니라 behavior correspondence를 같이 봐야 합니다.

Legged locomotion으로 옮겨 생각하면 다음과 같은 값이 correspondence에 해당할 수 있습니다.

| Correspondence 축 | 의미 |
|---|---|
| gait timing | swing/stance phase가 비슷하게 유지되는가 |
| body attitude | roll/pitch/yaw가 simulation과 비슷한가 |
| command response | 같은 command에 비슷한 velocity가 나오는가 |
| actuator load | torque/current가 비현실적으로 커지지 않는가 |
| disturbance response | 작은 perturbation에 비슷하게 복구되는가 |

핵심은 simulation reward가 아니라 real behavior가 최종 기준이라는 점입니다.

## **5. 이 논문의 한계**

이 논문은 Sim2Real의 기본 질문을 잘 보여주지만, 현대 legged robot RL 논문과는 차이가 큽니다.

첫째, task와 robot이 작습니다.

Khepera는 wheeled robot이고, task도 obstacle avoidance와 light seeking입니다. Quadruped locomotion처럼 contact-rich하고 high-dimensional한 control 문제를 다루지는 않습니다.

둘째, controller와 training 방식이 modern RL과 다릅니다.

논문은 recurrent dynamical neural network controller를 evolutionary method로 학습합니다. PPO, actor-critic, value function, policy gradient 같은 현대 deep RL 구조를 다루지는 않습니다.

셋째, noise model은 사람이 정합니다.

Observed noise와 double noise를 비교하지만, 어떤 uncertainty를 어떤 distribution으로 넣어야 하는지 자동으로 찾는 방법을 제안하지는 않습니다.

넷째, actuator dynamics나 contact model을 깊게 다루지는 않습니다.

현대 legged Sim2Real에서는 actuator delay, motor strength, joint friction, foot-ground contact, state estimation noise가 매우 중요합니다. 이 논문은 그런 세부 모델링보다는 simulation noise의 원리를 보여주는 초기 논문에 가깝습니다.

그래서 이 글을 읽을 때는 "이 논문을 그대로 quadruped locomotion에 적용하자"가 아니라, 다음 원리를 가져가는 것이 좋습니다.

> Real transfer를 목표로 한다면, clean simulator에서만 좋은 controller를 믿으면 안 된다.

## **6. 정리하며: Reality Gap에서 Domain Randomization으로**

이번 글에서는 Jakobi et al.의 **Noise and The Reality Gap**을 통해 Sim2Real의 가장 기본적인 문제를 정리했습니다.

- Reality gap은 simulation behavior와 real robot behavior 사이의 차이입니다.
- Clean simulation은 하나의 좁은 MDP이기 때문에 controller가 simulation-specific shortcut에 overfit될 수 있습니다.
- Noise envelope은 real world에서 생길 수 있는 transition variation을 training distribution 안에 넣는 방법입니다.
- Noise range가 너무 좁으면 real world를 덮지 못하고, 너무 넓으면 policy가 지나치게 conservative해질 수 있습니다.
- Sim2Real에서는 simulation reward뿐 아니라 real behavior correspondence를 봐야 합니다.
- 이 논문은 이후 domain randomization과 dynamics randomization으로 이어지는 기본 관점을 제공합니다.

이 논문은 오래됐지만, Sim2Real의 출발점을 잘 보여줍니다.

Simulation을 믿을 수 있는가?

믿을 수 있다면, 어떤 uncertainty를 simulation에 넣어야 하는가?

다음 글에서는 이 질문이 modern robotics에서 어떻게 확장되는지 보기 위해 **Domain Randomization** 계열 논문을 살펴보겠습니다.
