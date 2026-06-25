---
title: "[Sim2Real Paper 6] Challenging Terrain Locomotion"
date: 2026-06-24 17:34:00 +0900
categories: [RL, Sim2Real, Paper]
tags: [sim2real, quadruped-locomotion, rough-terrain, proprioception, anymal]
description: Lee et al.의 Learning Quadrupedal Locomotion over Challenging Terrain을 통해 rough terrain에서 proprioception 기반 zero-shot transfer를 정리한다.
math: true
---

## **0. 전체 그림: 보이지 않는 Terrain을 History로 추론하기**

5편에서는 Hwangbo et al.의 ANYmal 논문을 봤습니다.

그 논문의 핵심은 actuator net과 hybrid simulator였습니다. 복잡한 actuator/software dynamics를 learned model로 simulation 안에 넣고, 실제 ANYmal에 policy를 직접 deploy하는 흐름이었습니다.

Lee et al.의 **Learning Quadrupedal Locomotion over Challenging Terrain**은 다음 단계로 넘어갑니다.

질문은 더 어렵습니다.

> Camera나 LiDAR 없이, joint encoder와 IMU 같은 proprioceptive signal만으로 자연 지형을 zero-shot으로 걸을 수 있는가?

이 논문은 rough terrain locomotion에서 매우 중요합니다.

왜냐하면 모든 terrain을 simulation에 정확히 넣는 대신, robot이 proprioceptive history를 통해 지금 밟고 있는 지형과 contact 상태를 암묵적으로 추론하게 만들기 때문입니다.

실제 자연 환경에는 다음과 같은 요소가 있습니다.

- mud, snow처럼 deformable한 terrain
- rubble처럼 움직이는 foothold
- vegetation처럼 다리를 방해하는 overground obstacle
- water, snow, dense vegetation처럼 camera/LiDAR terrain estimation을 깨뜨리는 환경
- 발이 닿은 뒤에야 드러나는 contact, slip, foot trapping

이 논문의 메시지는 단순합니다.

> 현실을 모두 정확히 시뮬레이션하지 않아도, robot이 proprioceptive stream에서 hidden environment state를 추론할 수 있으면 robust transfer가 가능하다.

## **1. 논문 정보**

| 항목 | 내용 |
|---|---|
| Title | Learning Quadrupedal Locomotion over Challenging Terrain |
| Authors | Joonho Lee, Jemin Hwangbo, Lorenz Wellhausen, Vladlen Koltun, Marco Hutter |
| Year | 2020 |
| Venue | Science Robotics |
| Robot | ANYmal-B, ANYmal-C |
| Simulator | RaiSim |
| Core setting | blind / proprioceptive rough-terrain locomotion |
| Policy architecture | TCN-based proprioceptive student |
| Key transfer tools | privileged teacher, proprioceptive student, DAgger-style distillation, adaptive terrain curriculum, actuator model |
| Transfer | simulation training, zero-shot deployment to natural terrain |
| Source | [arXiv](https://arxiv.org/abs/2010.11251), [Science Robotics DOI](https://www.science.org/doi/10.1126/scirobotics.abc5986), [Project](https://leggedrobotics.github.io/rl-blindloco/) |

이 논문은 "rough natural terrain에서도 proprioception만으로 어디까지 갈 수 있는가"를 보여주는 대표적인 논문입니다.

특히 중요한 점은 training terrain이 실제 deployment terrain을 그대로 복제하지 않는다는 것입니다.

Training은 simulation의 rigid terrain과 procedurally generated terrain에서 이루어집니다. 하지만 deployment는 mud, snow, rubble, water, vegetation, mountain trail, forest terrain 같은 자연 환경에서 이루어집니다.

## **2. 핵심 아이디어: Privileged Teacher와 Proprioceptive Student**

이 논문의 핵심 구조는 teacher-student입니다.

Simulation에서는 많은 정보를 알 수 있습니다.

예를 들어 terrain height, terrain normal, foot contact state, contact force, friction coefficient, external disturbance 같은 정보는 physics engine 내부에서 얻을 수 있습니다.

하지만 real robot에서는 이런 정보를 그대로 쓸 수 없습니다.

그래서 논문은 두 종류의 policy를 둡니다.

| Policy | Training input | Deployment |
|---|---|---|
| teacher policy | robot state + privileged terrain/contact information | simulation only |
| student policy | proprioceptive observation history | real robot deployment |

Teacher는 simulation에서 privileged information을 보고 rough terrain을 잘 걷도록 RL로 학습됩니다.

Student는 teacher가 만든 action과 latent representation을 따라 하도록 supervised learning으로 학습됩니다. Student는 real robot에서 얻을 수 있는 proprioceptive stream만 사용합니다.

즉 구조는 다음과 같습니다.

```text
train teacher with privileged terrain/contact information
-> roll out student and query teacher on visited states
-> train student to imitate teacher action and latent
-> deploy only student on real robot
```

이 구조의 장점은 분명합니다.

Teacher는 simulation의 정보를 마음껏 써서 어려운 task를 빨리 배웁니다. Student는 그 behavior를 proprioception만으로 재현하도록 학습됩니다.

이때 Student는 단일 observation이 아니라 history를 봅니다.

논문은 TCN(Temporal Convolutional Network)을 사용해 proprioceptive history를 처리합니다. 이 history가 terrain/contact state를 암묵적으로 추론하는 역할을 합니다.

## **3. 핵심 아이디어의 이론적 원리**

이 논문의 이론적 핵심은 rough terrain locomotion을 fully observable MDP가 아니라 partially observable control problem으로 본다는 점입니다.

Robot은 terrain을 직접 보지 못합니다.

하지만 body motion, joint velocity, joint tracking error, IMU response, previous foot target 같은 시간 흐름 속에는 terrain에 대한 흔적이 남습니다.

### **3.1 Blind locomotion은 POMDP에 가깝다**

일반적인 MDP에서는 state $s_t$를 알고 있다고 가정합니다.

$$
a_t \sim \pi(a_t \mid s_t)
$$

하지만 blind rough-terrain locomotion에서는 robot이 실제 environment state를 모두 볼 수 없습니다.

실제 hidden state에는 terrain geometry, friction, foot contact, slip, external disturbance가 포함됩니다.

이를 다음처럼 나눠 볼 수 있습니다.

$$
s_t
=
(o_t, x_t)
$$

여기서 $o_t$는 real robot에서 얻을 수 있는 proprioceptive observation이고, $x_t$는 simulation에서는 알 수 있지만 real deployment에서는 직접 얻기 어려운 privileged information입니다.

Teacher는 $o_t$와 $x_t$를 모두 봅니다.

$$
\bar{a}_t
=
\pi_T(o_t, x_t)
$$

Student는 $x_t$를 볼 수 없습니다. 대신 proprioceptive history를 봅니다.

$$
H_t
=
(h_{t-N}, \ldots, h_{t-1})
$$

$$
a_t
=
\pi_S(o_t, H_t)
$$

이론적으로 보면 $H_t$는 hidden state $x_t$에 대한 belief를 만들기 위한 정보입니다.

즉 Student는 terrain을 직접 보는 것이 아니라, 과거 proprioception을 통해 terrain/contact 상태를 추론합니다.

### **3.2 Proprioceptive history는 contact와 slip의 흔적을 담는다**

단일 frame의 proprioception만 보면 terrain 상태를 알기 어렵습니다.

예를 들어 발이 지형에 걸렸는지, 미끄러졌는지, 예상보다 빨리 닿았는지는 시간 변화 속에서 드러납니다.

다음 신호들이 history 안에 들어갑니다.

| Signal | History에서 드러나는 의미 |
|---|---|
| joint position error | actuator가 target을 못 따라간 정도 |
| joint velocity | foot collision, slip, resistance의 흔적 |
| base orientation / angular velocity | body가 terrain 때문에 흔들린 정도 |
| previous foot targets | 원래 의도한 swing/contact pattern |
| FTG phase and frequency | gait phase와 실제 response의 차이 |

따라서 Student는 다음과 같은 암묵적 inference를 합니다.

```text
joint tracking error increases
-> foot may be trapped or terrain may be higher than expected

base pitch/roll changes unexpectedly
-> contact condition or foothold stability changed

foot target was in swing phase but velocity suddenly drops
-> collision or obstacle contact occurred
```

이것이 논문이 말하는 proprioceptive feedback의 핵심입니다.

Proprioception은 단순히 robot state를 알려주는 센서가 아니라, terrain과 contact를 간접적으로 추론하는 sensor stream입니다.

### **3.3 TCN은 긴 history에서 latent environment state를 복원한다**

Student policy는 TCN을 사용합니다.

TCN은 temporal convolution을 이용해 sequence를 처리합니다. 논문에서 Student는 길이 $N$의 proprioceptive observation sequence를 입력으로 받습니다.

$$
H
=
\{h_{t-1}, \ldots, h_{t-N-1}\}
$$

TCN encoder는 이 history를 latent vector로 압축합니다.

$$
l_t
=
f_{\theta}^{\mathrm{TCN}}(H_t)
$$

그 다음 Student policy는 $o_t$와 $l_t$를 사용해 action을 냅니다.

$$
a_t
=
\pi_S(o_t, l_t)
$$

TCN을 쓰는 이유는 두 가지입니다.

첫째, history length를 명시적으로 조절할 수 있습니다.

둘째, recurrent network보다 training이 빠르고 안정적일 수 있습니다. 논문은 GRU와 비교했을 때 TCN이 학습 효율 면에서 유리하다고 설명합니다.

중요한 점은 TCN latent가 단순한 feature가 아니라는 것입니다.

논문은 decoder 분석을 통해 TCN representation에서 terrain shape, foot contact state, friction, external disturbance 같은 privileged information을 어느 정도 복원할 수 있음을 보입니다.

즉 TCN은 다음 역할을 합니다.

> 직접 관측할 수 없는 terrain/contact state를 proprioceptive history에서 암묵적으로 인코딩한다.

### **3.4 Teacher-student distillation은 privileged information을 deployable policy로 압축한다**

Teacher는 privileged information을 사용합니다.

Teacher state는 다음처럼 볼 수 있습니다.

$$
s_t^T
=
(o_t, x_t)
$$

$x_t$에는 terrain profile, foot contact state, contact force, friction coefficient, external force 같은 정보가 들어갑니다.

Teacher는 MLP encoder를 통해 terrain/contact 관련 latent를 만듭니다.

$$
\bar{l}_t
=
g_T(x_t)
$$

그리고 teacher action을 만듭니다.

$$
\bar{a}_t
=
\pi_T(o_t, \bar{l}_t)
$$

Student는 $\bar{a}_t$만 따라 하는 것이 아니라, teacher latent $\bar{l}_t$도 따라 합니다.

논문에서 student loss는 다음 구조입니다.

$$
\mathcal{L}
=
\left\|
\bar{a}_t - a_t
\right\|^2
+
\left\|
\bar{l}_t - l_t
\right\|^2
$$

이 두 번째 항이 중요합니다.

Action만 imitation하면 같은 action을 내는 shortcut을 배울 수 있습니다. 하지만 latent까지 맞추면 Student는 teacher가 terrain/contact를 표현하던 내부 표현을 proprioception history에서 복원하도록 압박받습니다.

즉 이 distillation은 단순 behavior cloning이 아닙니다.

> Teacher가 simulation에서 본 terrain/contact 지식을 Student의 proprioceptive latent space로 압축하는 과정이다.

또한 논문은 DAgger-style dataset aggregation을 사용합니다. Student가 rollout하면서 방문한 state에 대해 teacher를 query하고, 그 teacher output을 supervision으로 사용합니다.

이렇게 하면 Student가 실제로 방문하는 state distribution에서 teacher의 guidance를 받을 수 있습니다.

### **3.5 Adaptive terrain curriculum은 너무 쉬운 지형과 너무 어려운 지형을 피한다**

Rough terrain RL에서 terrain randomization을 크게 넣는 것만으로는 충분하지 않습니다.

처음부터 너무 어려운 terrain을 주면 policy가 학습하지 못합니다. 너무 쉬운 terrain만 주면 real rough terrain에서 깨집니다.

논문은 terrain parameter $c_T$를 사용해 terrain을 procedural하게 생성합니다.

예를 들어 다음 세 종류가 사용됩니다.

| Terrain type | 학습되는 현상 |
|---|---|
| Hills | slope, smooth height variation, slip |
| Steps | discrete elevation change, foot trapping |
| Stairs | repeated step-up / step-down |

각 terrain parameter에 대해 traversability를 정의합니다.

$$
Tr(c_T, \pi)
=
\mathbb{E}_{\xi \sim \pi}
\left[
\nu(s_t, a_t, s_{t+1} \mid c_T)
\right]
$$

여기서 $\nu$는 robot이 commanded direction으로 충분히 진행하면 1, 아니면 0에 가까운 label입니다. 논문은 commanded direction velocity threshold를 사용해 terrain이 traversable한지 평가합니다.

목표는 traversability가 너무 높거나 너무 낮은 terrain이 아닙니다.

논문은 대략 중간 난이도 terrain을 desirable하게 봅니다.

$$
Tr(c_T, \pi)
\in
[0.5, 0.9]
$$

직관은 다음입니다.

```text
Tr close to 1.0 -> too easy
Tr close to 0.0 -> too hard
Tr in middle -> learnable and useful
```

이를 위해 particle filter로 terrain parameter distribution을 유지합니다.

Policy가 좋아질수록 terrain distribution도 이동합니다. 처음에는 넓고 얕은 step처럼 쉬운 terrain을 주고, 이후 더 좁고 어려운 step, 더 거친 hill, 더 복잡한 profile로 이동합니다.

이 curriculum이 teacher와 student training 모두에 적용됩니다.

### **3.6 PMTG는 완전히 자유로운 action보다 안정적인 motion prior를 준다**

이 논문은 policy가 매 순간 joint target을 완전히 처음부터 생성하게 하지 않습니다.

PMTG(Policies Modulating Trajectory Generators)를 사용합니다.

기본 foot trajectory generator가 있고, policy는 phase frequency와 foot position residual을 출력합니다.

간단히 쓰면 다음과 같습니다.

$$
r_{f_i,T}
=
F(\phi_i)
+
\Delta r_{f_i,T}
$$

여기서 $F(\phi_i)$는 periodic foot trajectory generator이고, $\Delta r_{f_i,T}$는 policy가 만드는 residual입니다.

이 구조의 의미는 다음입니다.

| 구성 | 역할 |
|---|---|
| trajectory generator | 기본적인 stepping prior 제공 |
| policy residual | terrain/contact 상황에 맞게 motion 조정 |
| analytic IK + PD control | foot target을 joint position target으로 변환 |

이것은 Sim2Real에서 중요한 선택입니다.

완전히 자유로운 action space보다, 기본적인 legged motion prior 위에 residual을 얹는 편이 학습 안정성과 deployment 안정성에 도움이 됩니다.

### **3.7 Zero-shot generalization은 현실을 정확히 복제해서가 아니라 robust inference를 배워서 나온다**

이 논문의 중요한 해석은 다음입니다.

Training simulation은 자연 환경을 완전히 복제하지 않습니다.

Mud, snow, vegetation, running water, crumbling foothold를 정확히 모델링하지 않습니다. Training은 rigid terrain과 procedural terrain 중심입니다.

그런데도 real natural terrain에서 zero-shot transfer가 됩니다.

이것은 다음 조합 때문입니다.

```text
simple but diverse simulated terrain
-> adaptive curriculum
-> privileged teacher learns rough-terrain behavior
-> student learns proprioceptive latent inference
-> real deployment uses history to adapt online
```

즉 핵심은 모든 reality gap을 simulator 안에 넣는 것이 아닙니다.

Policy가 real에서 만난 mismatch를 proprioceptive history로 감지하고, 그에 맞는 behavior를 내도록 학습하는 것입니다.

## **4. Sim2Real 관점에서의 해석**

이 논문은 앞선 Sim2Real 논문들과 결이 조금 다릅니다.

앞선 논문들은 주로 simulator의 dynamics를 real에 가깝게 만들거나, randomization으로 parameter mismatch를 덮는 데 집중했습니다.

Lee et al.은 rough terrain에서 다음 사실을 보여줍니다.

> 모든 현실 조건을 simulation distribution 안에 직접 넣지 않아도, deploy policy가 hidden condition을 history로 추론하면 transfer가 가능하다.

Sim2Real 관점에서 이 논문의 pipeline은 다음입니다.

```text
train privileged teacher in simulation
-> use adaptive terrain curriculum to expose rough-terrain challenges
-> distill teacher action and latent into TCN student
-> student uses proprioceptive history only
-> deploy student zero-shot on natural terrain
```

여기서 중요한 transfer mechanism은 세 가지입니다.

첫째, privileged learning입니다.

Teacher는 simulation에서만 가능한 terrain/contact 정보를 보고 좋은 behavior를 학습합니다. Student는 이 정보를 직접 받지 않지만, teacher latent를 imitation하면서 비슷한 internal representation을 proprioception history에서 만듭니다.

둘째, terrain curriculum입니다.

Terrain randomization을 넓게만 넣는 것이 아니라, 현재 policy에게 적당히 어려운 terrain을 계속 제공합니다. 이는 policy가 실패만 반복하거나 쉬운 terrain에 과적합되는 것을 막습니다.

셋째, proprioceptive online adaptation입니다.

Student는 deployment 중에도 history를 계속 받습니다. 따라서 terrain이 바뀌거나 foot이 trap되거나 slip이 생기면, 그 흔적이 history에 들어가고 policy action이 바뀔 수 있습니다.

이 흐름은 다음 글의 RMA와 직접 이어집니다.

RMA는 여기서 암묵적으로 하던 hidden environment inference를 더 명시적인 adaptation module로 만듭니다.

## **5. 이 논문의 한계**

이 논문은 rough terrain locomotion에서 매우 강한 결과를 보여주지만, 한계도 분명합니다.

첫째, blind locomotion은 미리 보는 planning이 없습니다.

Camera나 LiDAR 없이 proprioception만 사용하기 때문에, cliff나 큰 gap처럼 밟기 전에 피해야 하는 위험을 미리 인식하기 어렵습니다. 논문도 blind locomotion은 inherent limitation이 있다고 설명합니다.

둘째, gait가 보수적일 수 있습니다.

Robot은 terrain을 몸으로 느끼며 진행해야 합니다. 따라서 안전하지만 빠른 perceptive locomotion보다 느리거나 보수적인 behavior가 나올 수 있습니다.

셋째, teacher-student training이 복잡합니다.

Teacher RL, terrain curriculum, student imitation, latent supervision, DAgger-style data aggregation까지 필요합니다. 단일 policy를 학습하는 것보다 pipeline이 무겁습니다.

넷째, curriculum 설계가 중요합니다.

Terrain parameter, traversability threshold, particle filter update 방식이 잘못되면 policy가 너무 쉬운 terrain에 머물거나, 너무 어려운 terrain에서 학습이 멈출 수 있습니다.

다섯째, 모든 hidden state를 history로 복원할 수는 없습니다.

Proprioceptive history는 강력하지만 완전한 terrain map은 아닙니다. 장거리 planning, obstacle avoidance, foothold selection에는 exteroception과 결합하는 방향이 필요합니다.

그래도 이 논문의 핵심 메시지는 강합니다.

> Rough terrain Sim2Real에서는 정확한 terrain reconstruction보다, proprioceptive history를 통한 robust inference가 더 중요한 경우가 있다.

## **6. 정리하며: History가 Adaptation의 시작이다**

이번 글에서는 Lee et al.의 **Learning Quadrupedal Locomotion over Challenging Terrain**을 정리했습니다.

- 이 논문은 blind/proprioceptive rough-terrain locomotion의 대표적인 Sim2Real 논문입니다.
- Teacher는 simulation에서 privileged terrain/contact information을 사용해 학습됩니다.
- Student는 TCN으로 proprioceptive history를 처리하고, real robot에서 사용할 수 있는 정보만 봅니다.
- Student는 teacher action뿐 아니라 teacher latent representation도 imitation합니다.
- Proprioceptive history는 foot trapping, slip, early contact, body disturbance 같은 hidden environment state의 흔적을 담습니다.
- Adaptive terrain curriculum은 traversability가 중간 정도인 terrain을 particle filter로 유지합니다.
- Training은 단순한 rigid/procedural terrain에서 이루어지지만, deployment는 mud, snow, rubble, vegetation, water 같은 자연 환경에 zero-shot으로 이루어집니다.
- 이 논문의 흐름은 RMA처럼 explicit online adaptation을 사용하는 후속 연구로 이어집니다.

6편의 핵심은 이렇게 정리할 수 있습니다.

> Robot이 terrain을 미리 볼 수 없다면, proprioceptive history가 terrain을 느끼고 추론하는 창이 된다.

다음 글에서는 이 history-based inference를 더 명시적인 online adaptation module로 만든 RMA를 보겠습니다.
