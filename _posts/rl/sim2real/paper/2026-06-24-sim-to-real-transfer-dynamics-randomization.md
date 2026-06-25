---
title: "[Sim2Real Paper 3] Dynamics Randomization"
date: 2026-06-24 17:31:00 +0900
categories: [RL, Sim2Real, Paper]
tags: [sim2real, dynamics-randomization, domain-randomization, robot-control, manipulation]
description: Peng et al.의 Sim-to-Real Transfer of Robotic Control with Dynamics Randomization을 통해 물리 파라미터 randomization의 기본 아이디어를 정리한다.
math: true
---

## **0. 전체 그림: Appearance가 아니라 Dynamics를 흔들기**

2편에서는 Tobin et al.의 visual domain randomization을 봤습니다.

그 논문의 핵심은 real image를 simulation variation 중 하나처럼 보이게 만들자는 것이었습니다. Texture, lighting, camera pose, distractor 같은 visual 요소를 계속 바꿔서 model이 특정 simulation appearance에 overfit되지 않게 만드는 방식입니다.

Peng et al.의 **Sim-to-Real Transfer of Robotic Control with Dynamics Randomization**은 같은 생각을 control 쪽으로 옮깁니다.

여기서 흔드는 것은 image texture가 아니라 **물리 파라미터**입니다.

> Real robot의 dynamics를 simulation dynamics distribution 안의 하나로 만들자.

즉, simulator의 mass, friction, damping, controller gain, action timestep, observation noise 같은 값들을 training 중 계속 바꿔서 policy가 하나의 simulator에만 맞춰지지 않도록 합니다.

이 논문은 Sim2Real에서 **dynamics randomization**을 이해할 때 기본으로 볼 만한 논문입니다. Visual domain randomization이 appearance gap을 다룬다면, dynamics randomization은 state transition gap을 다룹니다.

## **1. 논문 정보**

| 항목 | 내용 |
|---|---|
| Title | Sim-to-Real Transfer of Robotic Control with Dynamics Randomization |
| Authors | Xue Bin Peng, Marcin Andrychowicz, Wojciech Zaremba, Pieter Abbeel |
| Year | 2018 |
| Venue | ICRA 2018 |
| Task | object pushing |
| Robot | robotic arm |
| Algorithm | recurrent policy with off-policy RL |
| Key idea | dynamics parameter를 episode마다 randomize |
| Source | [arXiv](https://arxiv.org/abs/1710.06537), [PDF](https://arxiv.org/pdf/1710.06537) |

Tobin et al.이 vision model을 다뤘다면, Peng et al.은 robotic control policy를 다룹니다.

그래서 이 논문은 "domain randomization이 visual trick이 아니라 dynamics transfer에도 쓸 수 있다"는 흐름에서 중요합니다.

## **2. 핵심 아이디어: Dynamics Distribution에서 학습하기**

Simulation에서 control policy를 학습하면 많은 장점이 있습니다.

- 데이터를 빠르게 만들 수 있습니다.
- robot을 망가뜨릴 위험이 없습니다.
- reset이 쉽습니다.
- 많은 실패를 반복해도 비용이 작습니다.

하지만 control에서는 reality gap이 더 직접적으로 나타납니다.

같은 action을 줘도 simulation과 real robot의 결과가 다를 수 있습니다. Robot link mass가 조금 다르거나, joint damping이 맞지 않거나, object friction이 다르거나, controller latency가 있으면 policy가 예상한 state transition이 깨집니다.

문제는 모든 dynamics parameter를 정확히 식별하기 어렵다는 점입니다.

> 정확한 system identification 없이도 real robot에 transfer되는 control policy를 만들 수 있을까?

Peng et al.의 답은 dynamics randomization입니다.

일반적인 simulation training은 하나의 dynamics model에서 policy를 학습합니다.

$$
s_{t+1} = f_{\mathrm{sim}}(s_t, a_t)
$$

하지만 real world의 transition은 다릅니다.

$$
s_{t+1} = f_{\mathrm{real}}(s_t, a_t)
$$

Dynamics randomization은 하나의 simulator를 고정하지 않고, simulator parameter를 매 episode 바꿉니다.

> **Dynamics Randomization**이란?
>
> Training 중 mass, friction, damping, actuator gain, latency, noise 같은 physical parameter를 random하게 바꿔 policy가 여러 dynamics에서 버티도록 학습하는 방법입니다.

이 논문에서는 episode 시작 시 dynamics parameter set을 sample하고, 그 episode 동안은 같은 parameter를 유지합니다.

이렇게 하면 policy는 "하나의 정확한 dynamics"가 아니라 "가능한 dynamics들의 distribution"에서 성공해야 합니다.

논문에서 randomize한 parameter는 총 95개입니다.

주요 축은 다음과 같습니다.

| Randomization axis | 의미 |
|---|---|
| robot link mass | robot body 각 link의 mass 차이 |
| joint damping | joint 움직임의 damping 차이 |
| puck mass | 밀어야 하는 object의 질량 |
| puck friction | object와 table 사이의 마찰 |
| puck damping | object motion의 damping |
| table height | table 위치 calibration error |
| controller gain | position controller gain 차이 |
| action timestep | action이 적용되는 시간, latency에 가까운 효과 |
| observation noise | sensor uncertainty |

여기서 중요한 것은 friction, mass, damping만이 아닙니다.

Action timestep과 observation noise도 중요합니다. 논문은 action timestep randomization을 physical controller latency의 단순 모델로 사용합니다.

즉 dynamics randomization은 단순히 "무게 좀 흔들기"가 아닙니다. Robot, object, controller, sensor가 만드는 전체 closed-loop dynamics를 흔드는 것입니다.

논문이 다루는 task는 object pushing입니다.

Robot arm이 puck을 밀어서 목표 위치로 보내야 합니다. 이 task는 contact dynamics가 중요합니다. Puck과 table 사이의 friction, puck mass, robot action timing이 조금만 달라도 결과가 달라질 수 있습니다.

Policy는 simulation에서만 학습됩니다. 이후 real robot에 올려서 random initial configuration에서 puck을 목표 위치로 밀 수 있는지 평가합니다.

논문에서 중요한 설계는 recurrent policy입니다.

Dynamics parameter는 policy에게 직접 주어지지 않습니다. 대신 policy는 observation history를 통해 현재 환경이 어떤 dynamics인지 암묵적으로 추론해야 합니다.

> Dynamics randomization은 policy를 robust하게 만들 뿐 아니라, recurrent policy가 현재 dynamics를 history로부터 추정하게 만들 수 있다.

논문의 핵심 결과는 simulation에서만 학습한 policy가 real robot에서도 object pushing을 수행했다는 것입니다.

특히 randomization 없이 학습한 policy는 unfamiliar dynamics에 약했고, randomization을 넣은 recurrent policy가 real robot에서 더 안정적으로 동작했습니다.

또한 ablation에서 action timestep, observation noise, link mass, friction randomization을 끄면 real robot 적응 성능이 나빠졌습니다. 논문은 특히 action timestep과 observation noise를 끈 경우 성능 하락이 크다고 보고합니다. 이것은 latency와 sensor noise가 real transfer에서 중요한 축이라는 뜻입니다.

정리하면 다음입니다.

> Dynamics randomization은 mass와 friction만의 문제가 아니라, closed-loop control에서 생기는 timing과 sensing uncertainty까지 포함해야 한다.

## **3. 핵심 아이디어의 이론적 원리**

이 논문의 이론적 핵심은 dynamics parameter를 하나의 고정값으로 보지 않고, **MDP 자체가 parameter에 따라 달라지는 문제**로 보는 것입니다.

### **3.1 Dynamics parameterized MDP**

Control problem을 MDP로 보면 다음과 같이 쓸 수 있습니다.

$$
\mathcal{M}
=
(\mathcal{S}, \mathcal{A}, P, R, \gamma)
$$

여기서 $P(s_{t+1} \mid s_t, a_t)$는 state transition입니다.

하지만 robotics에서는 transition이 robot과 environment의 physical parameter에 의해 달라집니다.

예를 들어 mass, friction, damping, controller gain, action delay, sensor noise가 바뀌면 같은 state와 action에서도 다음 state가 달라질 수 있습니다.

이 parameter를 $\xi$라고 두면, MDP는 다음처럼 parameterized됩니다.

$$
\mathcal{M}_{\xi}
=
(\mathcal{S}, \mathcal{A}, P_{\xi}, R_{\xi}, \gamma)
$$

그리고 transition은 다음처럼 달라집니다.

$$
s_{t+1}
\sim
P_{\xi}(\cdot \mid s_t, a_t)
$$

정확한 system identification은 real world의 $\xi_{\mathrm{real}}$을 찾아서 simulator를 맞추려는 접근입니다.

$$
\xi_{\mathrm{sim}} \approx \xi_{\mathrm{real}}
$$

반면 dynamics randomization은 하나의 $\xi$를 찾는 대신, 가능한 $\xi$들의 distribution을 둡니다.

$$
\xi \sim p(\xi)
$$

그리고 policy를 여러 $\mathcal{M}_{\xi}$에서 학습합니다.

### **3.2 Objective는 여러 dynamics에서의 기대 성능이다**

고정 simulator에서 policy를 학습하면 objective는 다음과 비슷합니다.

$$
\max_{\pi}
J(\pi; \mathcal{M}_{\mathrm{sim}})
$$

하지만 dynamics randomization에서는 simulator parameter가 episode마다 바뀝니다.

따라서 objective는 여러 dynamics에 대한 기대값이 됩니다.

$$
\max_{\pi}
\mathbb{E}_{\xi \sim p(\xi)}
\left[
J(\pi; \mathcal{M}_{\xi})
\right]
$$

이 식의 의미는 간단합니다.

Policy는 하나의 dynamics에서만 잘하면 안 됩니다. Randomized parameter distribution 위에서 평균적으로 task를 수행할 수 있어야 합니다.

이때 real robot transfer가 되려면 real dynamics가 training distribution 안에 있어야 합니다.

$$
\xi_{\mathrm{real}} \in \mathrm{support}(p(\xi))
$$

이 조건이 깨지면, policy는 real world와 다른 dynamics에서만 학습된 것이 됩니다.

### **3.3 Robustness와 Adaptation은 다르다**

Dynamics randomization은 policy를 robust하게 만듭니다. 하지만 이 논문에서 중요한 점은 recurrent policy를 사용한다는 것입니다.

Dynamics parameter $\xi$는 policy input으로 직접 주어지지 않습니다.

즉 policy는 다음처럼 hidden parameter가 있는 상태에서 action을 내야 합니다.

$$
a_t = \pi(o_t)
$$

하지만 현재 observation 하나만으로는 dynamics를 알기 어렵습니다.

예를 들어 물체가 무거운지, 마찰이 큰지, action delay가 큰지는 한 순간의 observation만으로 바로 알 수 없습니다. 이전 action을 줬을 때 state가 어떻게 변했는지 봐야 합니다.

그래서 recurrent policy는 observation-action history를 내부 state에 압축합니다.

$$
h_t = g_{\theta}(h_{t-1}, o_t, a_{t-1})
$$

그리고 action은 이 hidden state를 사용해 출력됩니다.

$$
a_t = \pi_{\theta}(o_t, h_t)
$$

이때 $h_t$는 현재 dynamics에 대한 암묵적인 추정값처럼 동작할 수 있습니다.

즉 recurrent policy는 다음 정보를 history에서 읽어낼 수 있습니다.

```text
same action -> object moves little
-> object may be heavy or friction may be high

same command -> delayed response
-> control timestep or latency may be different

same push -> noisy observation
-> sensor noise may be large
```

이 관점에서 dynamics randomization은 단순히 robust policy를 만드는 것만이 아닙니다. 여러 dynamics를 경험하게 해서, policy가 history를 통해 현재 dynamics를 추론하도록 만드는 역할도 합니다.

### **3.4 Closed-loop control에서는 timing과 sensing도 dynamics다**

Dynamics randomization이라고 하면 mass나 friction만 떠올리기 쉽습니다.

하지만 이 논문은 action timestep과 observation noise도 randomize합니다.

이 점이 중요합니다.

Closed-loop control에서는 action이 언제 적용되는지, observation이 얼마나 noisy한지, sensor feedback이 얼마나 늦게 들어오는지가 transition을 바꿉니다.

```text
ideal simulation:
s_t -> a_t -> immediate transition -> clean s_{t+1}

real closed-loop system:
noisy observation -> delayed action -> actuator/controller response -> noisy next observation
```

따라서 timing과 sensing uncertainty도 dynamics gap의 일부입니다.

특히 feedback controller는 현재 state를 보고 action을 정하기 때문에, observation noise와 action delay는 policy가 보는 closed-loop system 자체를 바꿉니다.

이 논문에서 action timestep과 observation noise ablation이 중요한 이유가 여기에 있습니다.

> Real transfer에서는 physical parameter뿐 아니라 control loop의 시간 구조와 sensor uncertainty도 randomization 대상이 되어야 한다.

### **3.5 Randomization range는 distribution design 문제다**

Dynamics randomization도 1편, 2편과 같은 trade-off를 갖습니다.

Range가 너무 좁으면 real dynamics를 덮지 못합니다.

```text
too narrow
-> real robot outside parameter distribution
-> policy sees unfamiliar transition
-> transfer fails
```

Range가 너무 넓으면 policy가 지나치게 conservative해질 수 있습니다.

```text
too broad
-> policy must handle unrealistic dynamics
-> task becomes harder
-> behavior may become slow or overly cautious
```

그래서 dynamics randomization은 단순히 parameter를 많이 흔드는 것이 아닙니다.

어떤 parameter가 transfer에 중요한지, 그 parameter가 real world에서 어느 정도 변하는지, 그리고 policy가 그 variation을 robust하게 처리해야 하는지 또는 history로 추론해야 하는지를 정해야 합니다.

이 관점에서 randomization distribution $p(\xi)$는 일종의 design variable입니다.

## **4. Sim2Real 관점에서의 해석**

이 논문은 dynamics randomization을 단순하고 강한 형태로 보여줍니다.

System identification을 완벽하게 하려는 대신, real world가 들어올 수 있을 만큼 dynamics distribution을 넓게 잡습니다.

| 접근 | 의미 | 위험 |
|---|---|---|
| 정확한 system identification | real parameter를 최대한 맞춤 | 식별 비용이 크고 누락 parameter에 약함 |
| dynamics randomization | 가능한 parameter 범위에서 robust policy 학습 | 범위가 너무 넓으면 보수적 policy가 됨 |
| 둘의 조합 | 식별한 값을 중심으로 현실적 범위 randomize | 실전에서 가장 자주 쓰임 |

이 논문의 관점에서 Sim2Real은 다음처럼 정리할 수 있습니다.

```text
real robot dynamics unknown
-> define plausible dynamics distribution
-> train policy over sampled dynamics
-> use history/recurrent state to adapt within an episode
```

중요한 것은 randomization range입니다.

너무 좁으면 real world가 distribution 밖에 있을 수 있습니다. 너무 넓으면 policy가 task를 적극적으로 수행하지 못하고 conservative해질 수 있습니다.

이 관점은 1편 Jakobi의 noise 논문, 2편 Tobin의 visual domain randomization과도 이어집니다.

> Noise와 randomization은 많이 넣는 것이 아니라, real world의 variation을 잘 덮도록 넣는 것이다.

다만 dynamics randomization은 visual domain randomization보다 더 직접적으로 closed-loop behavior에 영향을 줍니다.

Visual model에서는 appearance가 바뀌어도 label이 같은 경우가 많습니다. 하지만 control에서는 parameter가 바뀌면 같은 action이 실제로 다른 next state를 만듭니다.

따라서 dynamics randomization은 단순한 input augmentation이 아니라, policy가 학습하는 transition model 자체를 넓히는 방법입니다.

## **5. 이 논문의 한계**

이 논문은 dynamics randomization의 기본을 보여주지만, 모든 robotics Sim2Real 문제를 해결한 논문은 아닙니다.

첫째, task가 object pushing입니다.

Object pushing은 contact dynamics가 중요한 task지만, legged locomotion처럼 빠른 hybrid contact, balance, gait stability를 직접 다루지는 않습니다.

둘째, robot arm manipulation입니다.

Robot arm이 table 위 puck을 미는 setting이므로, floating base robot이나 underactuated locomotion에서 생기는 문제와는 다릅니다.

셋째, randomization range는 사람이 정합니다.

논문은 많은 parameter를 randomize하지만, 어떤 parameter를 얼마나 흔들어야 하는지 자동으로 찾는 방법을 제안하지는 않습니다.

넷째, recurrent policy가 dynamics를 암묵적으로 추론하지만, explicit adaptation module은 아닙니다.

Policy 내부 state가 현재 dynamics를 어느 정도 담을 수는 있지만, RMA처럼 별도의 adaptation module이 extrinsics를 명시적으로 추정하는 구조는 아닙니다.

다섯째, actuator saturation이나 hardware safety 같은 문제는 깊게 다루지 않습니다.

Real robot control에서는 policy가 transfer되는 것뿐 아니라, actuator limit, thermal limit, collision safety, failure recovery 같은 문제가 중요합니다. 이 논문은 dynamics randomization의 기본 구조를 보여주는 데 초점이 있습니다.

그래도 이 논문은 Sim2Real에서 "물리 파라미터를 흔든다"는 말이 정확히 무엇을 뜻하는지 잘 보여줍니다.

## **6. 정리하며: Dynamics Randomization에서 Legged Locomotion으로**

이번 글에서는 Peng et al.의 **Sim-to-Real Transfer of Robotic Control with Dynamics Randomization**을 정리했습니다.

- Visual domain randomization이 appearance를 흔든다면, dynamics randomization은 physical parameter와 closed-loop transition을 흔듭니다.
- Dynamics parameter가 바뀌면 MDP의 transition $P_{\xi}$가 바뀝니다.
- Policy는 하나의 simulator가 아니라 dynamics distribution 위에서의 기대 성능을 최대화하도록 학습됩니다.
- Real transfer를 위해서는 real dynamics가 randomization distribution의 support 안에 들어와야 합니다.
- Recurrent policy는 observation-action history를 통해 현재 dynamics를 암묵적으로 추정할 수 있습니다.
- Mass와 friction뿐 아니라 action timestep, latency, observation noise 같은 control-loop 요소도 randomization 대상입니다.
- Randomization range는 너무 좁아도, 너무 넓어도 문제가 됩니다.

3편의 핵심은 이렇게 정리할 수 있습니다.

> Real robot을 정확히 복사하기 어렵다면, real robot이 들어올 수 있는 dynamics distribution에서 policy를 학습하자.

다음 글에서는 이 dynamics randomization이 quadruped locomotion으로 넘어가면서 actuator model, latency, system identification과 어떻게 결합되는지 보겠습니다.
