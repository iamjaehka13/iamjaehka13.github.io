---
title: "[Sim2Real Paper 5] Agile and Dynamic Motor Skills"
date: 2026-06-24 17:33:00 +0900
categories: [RL, Sim2Real, Paper]
tags: [sim2real, legged-robots, anymal, actuator-network, reinforcement-learning]
description: Hwangbo et al.의 Learning agile and dynamic motor skills for legged robots를 통해 ANYmal 실기체 transfer에서 actuator net과 hybrid simulator의 역할을 정리한다.
math: true
---

## **0. 전체 그림: Actuator Dynamics까지 Simulator 안으로 넣기**

4편의 Tan et al.은 quadruped Sim2Real에서 actuator model과 latency가 중요하다는 것을 보여줬습니다.

하지만 모든 actuator가 analytic model로 잘 설명되는 것은 아닙니다.

Hwangbo et al.의 **Learning agile and dynamic motor skills for legged robots**는 이 문제를 ANYmal에서 다룹니다.

ANYmal은 full-size quadruped이고, 12개의 series elastic actuator를 사용합니다. 이런 actuator는 motor, spring, gear, low-level controller, communication delay, sensor filtering, joint compliance가 함께 얽혀 있습니다.

이 논문의 핵심은 다음입니다.

> Rigid-body dynamics는 physics simulator로 계산하고, actuator와 software stack의 복잡한 dynamics는 data-driven actuator network로 모델링한다.

즉 simulator 전체를 전부 neural network로 바꾸는 것이 아닙니다.

물리적으로 잘 아는 부분은 rigid-body simulator에 맡기고, 손으로 모델링하기 어려운 actuator side만 network로 배웁니다.

이 구조가 논문에서 말하는 practical Sim2Real의 핵심입니다.

```text
rigid-body simulator
+ learned actuator net
+ stochastic modeling
-> hybrid simulator
-> train RL policy
-> direct deployment on ANYmal
```

이 논문은 실제 ANYmal에서 velocity command following, high-speed locomotion, fall recovery를 보여줍니다.

## **1. 논문 정보**

| 항목 | 내용 |
|---|---|
| Title | Learning agile and dynamic motor skills for legged robots |
| Authors | Jemin Hwangbo, Joonho Lee, Alexey Dosovitskiy, Dario Bellicoso, Vassilios Tsounis, Vladlen Koltun, Marco Hutter |
| Year | 2019 |
| Venue | Science Robotics |
| Robot | ANYmal |
| Tasks | velocity command following, high-speed locomotion, fall recovery |
| RL algorithm | TRPO |
| Key transfer tools | system identification, learned actuator net, hybrid simulator, dynamics randomization, direct deployment |
| Source | [arXiv](https://arxiv.org/abs/1901.08652), [Science Robotics DOI](https://www.science.org/doi/10.1126/scirobotics.aau5872) |

이 논문은 "simulation에서 학습한 policy를 full-size quadruped에 직접 올릴 수 있는가?"에 대한 대표적인 초기 답입니다.

논문의 답은 단순히 "domain randomization을 많이 하자"가 아닙니다.

> Simulator의 평균 모델을 먼저 현실적으로 만들고, 남은 uncertainty를 randomization으로 덮는다.

여기서 평균 모델을 현실적으로 만드는 핵심 도구가 actuator net입니다.

## **2. 핵심 아이디어: Hybrid Simulator**

이 논문은 simulator를 두 부분으로 나눕니다.

첫째, rigid-body dynamics입니다.

Robot의 link, joint, inertia, contact, Coulomb friction 같은 부분은 physics simulator가 계산합니다. 이 부분은 여전히 model-based physics가 강합니다.

둘째, actuator/software dynamics입니다.

Policy가 내는 joint position target이 실제 joint torque가 되기까지의 과정은 손으로 정확히 쓰기 어렵습니다.

이 논문은 이 mapping을 learned actuator network로 모델링합니다.

전체 loop는 다음처럼 볼 수 있습니다.

```text
policy observation
-> policy outputs joint position target
-> actuator net predicts joint torque
-> rigid-body simulator advances robot state
-> next observation
```

중요한 점은 actuator net이 policy 밖에 있다는 것입니다.

Policy가 actuator net을 직접 학습하는 것이 아니라, actuator net이 simulator의 일부가 됩니다. 그래서 policy는 학습 중부터 ideal actuator가 아니라 현실적인 actuator response를 가진 robot을 상대하게 됩니다.

논문이 보여준 결과는 세 가지입니다.

| Skill | 내용 |
|---|---|
| command-conditioned locomotion | high-level body velocity command를 정확하고 효율적으로 추종 |
| high-speed locomotion | 실제 ANYmal에서 약 1.5 m/s 주행 |
| fall recovery | 넘어진 자세에서 몸을 굴려 upright configuration으로 복귀 |

특히 논문은 ideal actuator model과 analytical actuator model로 학습한 policy가 real robot에서 한 걸음도 제대로 걷지 못했다고 보고합니다.

이 점이 5편의 핵심입니다.

> Legged Sim2Real에서 actuator mismatch는 작은 오차가 아니라 policy가 학습하는 transition 자체를 바꾸는 문제다.

## **3. 핵심 아이디어의 이론적 원리**

이 논문의 이론적 원리는 다음 한 문장으로 요약할 수 있습니다.

> Sim2Real transfer를 위해서는 policy objective만 robust하게 만들 것이 아니라, policy가 학습하는 simulator transition을 real transition에 가깝게 만들어야 한다.

### **3.1 Rigid-body dynamics와 actuator dynamics를 분리한다**

일반적인 robot dynamics는 다음처럼 볼 수 있습니다.

$$
x_{t+1}
=
F(x_t, a_t)
$$

여기서 $x_t$는 robot state이고, $a_t$는 policy action입니다.

하지만 legged robot에서는 policy action이 곧바로 body motion으로 이어지지 않습니다.

Policy action은 보통 joint position target, desired joint angle, normalized command 같은 형태입니다. 이 command가 실제 torque가 되는 과정이 따로 있습니다.

따라서 더 정확히는 다음처럼 나누어 볼 수 있습니다.

$$
\tau_t
=
G(a_t, x_t, h_t)
$$

$$
x_{t+1}
=
F_{\mathrm{rigid}}(x_t, \tau_t; \theta)
$$

여기서 $G$는 actuator와 low-level control stack의 dynamics이고, $F_{\mathrm{rigid}}$는 rigid-body simulator입니다. $\theta$는 mass, inertia, link geometry, contact parameter 같은 physical parameter입니다.

Tan et al.은 $G$를 analytic하게 모델링하려고 했습니다.

Hwangbo et al.은 $G$가 너무 복잡하므로 data-driven model로 학습합니다.

이 관점에서 hybrid simulator는 다음 구조입니다.

$$
x_{t+1}
=
F_{\mathrm{rigid}}
\left(
x_t,
f_{\phi}(a_t, h_t);
\theta
\right)
$$

$f_{\phi}$가 actuator net입니다.

즉 actuator net은 policy가 아니라 simulator transition의 일부입니다.

### **3.2 Actuator Net은 history-conditioned action-to-torque model이다**

Actuator의 내부 상태는 완전히 관측되지 않습니다.

예를 들어 internal controller state, motor velocity, spring deflection의 일부, filtering state, communication delay는 policy나 simulator가 직접 알기 어렵습니다.

그래서 논문은 current state 하나만 보지 않고 joint state history를 사용합니다.

Joint position target을 $q^{\mathrm{des}}_t$라고 하고, 실제 joint position을 $q_t$라고 하면 position error는 다음입니다.

$$
e_t
=
q^{\mathrm{des}}_t - q_t
$$

Actuator net은 position error history와 joint velocity history를 입력으로 받아 torque를 예측합니다.

$$
\hat{\tau}_t
=
f_{\phi}
\left(
e_t, \dot{q}_t,
e_{t-k_1}, \dot{q}_{t-k_1},
e_{t-k_2}, \dot{q}_{t-k_2}
\right)
$$

이 history가 중요한 이유는 actuator dynamics가 partially observable이기 때문입니다.

현재 error와 velocity만으로는 delay와 mechanical response를 구분하기 어렵습니다. 하지만 과거 error와 velocity를 함께 보면 actuator 내부 상태의 흔적을 어느 정도 복원할 수 있습니다.

학습은 supervised learning입니다.

Real robot에서 command, joint state, measured torque data를 모으고, 다음 loss를 줄입니다.

$$
\min_{\phi}
\sum_t
\left\|
\tau^{\mathrm{real}}_t
-
f_{\phi}(a_t, h_t)
\right\|^2
$$

이때 논문은 각 actuator가 독립적이라고 가정합니다. 즉 12개의 actuator를 하나의 거대한 coupled model로 보지 않고, 같은 구조의 actuator model을 joint별로 적용합니다.

이 가정 덕분에 model은 작고 빠릅니다.

하지만 이 가정은 hydraulic actuator처럼 actuator끼리 강하게 coupling된 시스템에서는 깨질 수 있습니다.

### **3.3 Actuator Net은 latency와 limited bandwidth를 transition에 넣는다**

Ideal actuator model은 보통 다음 가정을 합니다.

```text
command arrives immediately
actuator has infinite bandwidth
desired target is tracked without delay
```

하지만 real ANYmal의 actuator는 그렇지 않습니다.

Command가 전달되고, low-level controller가 계산하고, motor와 spring이 반응하고, sensor 값이 다시 들어오기까지 delay가 있습니다. 또한 actuator는 arbitrary torque를 즉시 만들 수 없습니다.

이 차이는 policy 입장에서 매우 큽니다.

Policy는 simulator에서 다음 transition을 보고 학습합니다.

$$
p_{\mathrm{sim}}(x_{t+1} \mid x_t, a_t)
$$

Ideal actuator를 쓰면 이 transition은 지나치게 빠르고 깨끗합니다.

반대로 actuator net을 넣으면 transition은 다음처럼 바뀝니다.

$$
p_{\mathrm{hybrid}}(x_{t+1} \mid x_t, a_t, h_t)
$$

여기서 $h_t$는 actuator history입니다.

즉 policy는 학습 중부터 delay, limited bandwidth, nonlinear response가 반영된 dynamics를 경험합니다.

이 점이 real transfer에 중요합니다.

> Actuator net은 torque prediction model이지만, Sim2Real 관점에서는 policy가 보는 dynamics distribution을 바꾸는 장치다.

### **3.4 System identification은 중심을 맞추고 randomization은 주변을 덮는다**

이 논문도 randomization을 사용합니다.

하지만 무작정 넓게 randomize하는 방식이 아니라, 먼저 model의 중심을 최대한 현실에 맞춥니다.

Rigid-body parameter는 CAD와 system identification을 통해 설정합니다. 다만 cable, electronics, assembly difference 때문에 inertial property에는 오차가 남습니다.

이를 다음처럼 볼 수 있습니다.

$$
\theta
\sim
p(\theta)
$$

$$
\max_{\pi}
\mathbb{E}_{\theta \sim p(\theta)}
\left[
J(\pi; F_{\mathrm{rigid}}, f_{\phi}, \theta)
\right]
$$

여기서 중요한 것은 $f_{\phi}$가 actuator side의 mean mismatch를 줄이고, $p(\theta)$가 남은 physical uncertainty를 덮는다는 점입니다.

역할을 나누면 다음과 같습니다.

| 요소 | 역할 |
|---|---|
| system identification / CAD model | rigid-body model의 nominal value를 정함 |
| actuator net | actuator/software dynamics의 mean model을 학습 |
| dynamics randomization | inertial/contact/model uncertainty에 robust하게 만듦 |
| observation noise | sensor uncertainty에 robust하게 만듦 |

이 구조는 3편, 4편과 이어집니다.

Dynamics randomization은 여전히 중요하지만, mean model이 너무 틀리면 randomization만으로는 부족합니다.

### **3.5 Policy action은 torque가 아니라 joint position target이다**

이 논문에서 policy는 직접 torque를 출력하지 않습니다.

Policy는 observation을 받아 joint position target을 출력합니다.

$$
a_t
=
\pi_{\psi}(o_t)
$$

$$
a_t
\equiv
q^{\mathrm{des}}_t
$$

그 다음 actuator net이 이 target과 joint history를 보고 torque를 예측합니다.

$$
\tau_t
=
f_{\phi}(q^{\mathrm{des}}_t, h_t)
$$

이 구조는 실기체 deploy 관점에서 자연스럽습니다.

많은 legged robot은 policy가 바로 motor current나 torque를 내기보다, joint target을 내고 low-level actuator/controller stack이 이를 처리합니다.

따라서 Sim2Real에서 중요한 것은 다음 질문입니다.

> Policy action이 real actuator stack을 통과한 뒤 어떤 torque와 motion이 되는가?

이 논문은 그 질문을 actuator net으로 직접 모델링합니다.

### **3.6 RL objective는 task마다 다르지만 simulator 구조는 공유된다**

논문은 TRPO로 policy를 학습합니다.

기본 objective는 discounted return maximization입니다.

$$
\max_{\pi}
\mathbb{E}_{\tau \sim p_{\pi}}
\left[
\sum_{t=0}^{\infty}
\gamma^t r_t
\right]
$$

Task가 바뀌면 reward, command distribution, initial state distribution이 바뀝니다.

하지만 simulator 구조는 공유됩니다.

```text
command-conditioned locomotion
high-speed locomotion
fall recovery

all use:
rigid-body simulator + actuator net + stochastic modeling
```

이 점이 중요합니다.

논문이 제안한 것은 특정 gait 하나가 아니라, agile motor skill을 학습하고 transfer하기 위한 simulation-training-deployment pipeline입니다.

## **4. Sim2Real 관점에서의 해석**

이 논문은 Sim2Real을 다음처럼 나누어 생각하게 해줍니다.

첫째, reality gap은 contact parameter에만 있는 것이 아닙니다.

Legged robot에서는 actuator side가 reality gap의 중심일 수 있습니다. 발이 지면을 밀 때 실제 torque가 simulation과 다르면 contact timing, body attitude, foot slip이 모두 달라집니다.

둘째, learned model은 policy가 아니라 simulator를 보강하는 데 쓸 수 있습니다.

Actuator net은 control policy가 아닙니다. Real actuator data로 학습한 differentiable model이고, simulation loop 안에서 torque predictor로 쓰입니다.

셋째, randomization은 mean model을 고친 뒤에 더 잘 작동합니다.

Simulator의 중심이 현실과 너무 멀면 robust policy는 과하게 보수적이 되거나, real robot에서 필요한 dynamics를 아예 보지 못할 수 있습니다.

이 논문의 Sim2Real pipeline은 다음처럼 정리할 수 있습니다.

```text
identify rigid-body model
-> collect actuator data on real robot
-> train actuator net
-> insert actuator net into simulator
-> randomize remaining uncertainty
-> train policy in simulation
-> deploy directly to real robot
```

4편과 비교하면 차이가 분명합니다.

| 논문 | actuator gap 처리 방식 |
|---|---|
| Tan et al. | actuator behavior를 analytic model과 latency modeling으로 반영 |
| Hwangbo et al. | actuator/software dynamics를 real data로 학습한 actuator net으로 반영 |

즉 5편은 "actuator가 복잡하면 model을 학습해서 simulator에 넣자"는 방향입니다.

## **5. 이 논문의 한계**

이 논문은 legged Sim2Real에서 매우 중요한 논문이지만, 그대로 모든 문제를 해결하지는 않습니다.

첫째, actuator data가 필요합니다.

Actuator net을 학습하려면 real robot에서 command, joint state, torque 데이터를 모아야 합니다. Logging infrastructure와 torque measurement가 없다면 적용이 어려워집니다.

둘째, data coverage가 중요합니다.

Actuator net은 수집한 데이터 분포 밖에서는 틀릴 수 있습니다. 논문도 다양한 frequency와 amplitude로 actuator를 excite해야 한다고 봅니다. 학습 data가 실제 policy가 만들 motion을 충분히 덮지 못하면 actuator net 자체가 새로운 reality gap이 됩니다.

셋째, actuator independence 가정이 있습니다.

논문은 actuator dynamics를 joint별로 독립적으로 모델링합니다. ANYmal에서는 실용적인 가정이지만, shared hydraulic system이나 coupling이 강한 actuator에서는 충분하지 않을 수 있습니다.

넷째, terrain perception이나 rough terrain generalization이 핵심 주제는 아닙니다.

이 논문은 actuator-aware Sim2Real과 agile skill transfer가 중심입니다. 복잡한 지형에서의 exteroception, height map, foothold adaptation은 이후 논문들이 더 직접적으로 다룹니다.

다섯째, task마다 별도 policy를 학습합니다.

Command following, high-speed locomotion, fall recovery는 각각 reward와 initial state distribution이 다릅니다. 하나의 policy가 모든 skill을 자연스럽게 조합하는 구조는 아닙니다.

그래도 이 논문의 메시지는 매우 강합니다.

> Full-size legged robot에서는 actuator/software dynamics를 무시하면 Sim2Real이 거의 불가능해질 수 있다.

## **6. 정리하며: Actuator가 Transition을 바꾼다**

이번 글에서는 Hwangbo et al.의 **Learning agile and dynamic motor skills for legged robots**를 정리했습니다.

- ANYmal에 learned RL policy를 직접 deploy한 대표적인 Sim2Real 논문입니다.
- Rigid-body dynamics는 physics simulator로 계산하고, actuator/software dynamics는 learned actuator net으로 모델링합니다.
- Actuator net은 position error와 joint velocity history를 입력으로 torque를 예측합니다.
- History input은 actuator의 hidden internal state, delay, limited bandwidth를 간접적으로 표현합니다.
- Hybrid simulator는 policy가 학습하는 transition을 real robot에 더 가깝게 만듭니다.
- System identification과 actuator net은 mean model을 맞추고, randomization은 남은 uncertainty를 덮습니다.
- Ideal actuator model과 hand-tuned analytical model은 실제 ANYmal에서 실패했고, learned actuator net이 transfer에 핵심 역할을 했습니다.
- 논문은 velocity command following, high-speed locomotion, fall recovery를 real ANYmal에서 보여줍니다.

5편의 핵심은 이렇게 정리할 수 있습니다.

> Sim2Real에서 actuator model은 부가 요소가 아니라, policy가 학습하는 dynamics 그 자체다.

다음 글에서는 이 흐름이 rough terrain locomotion으로 넘어가면서 observation design과 proprioception 기반 transfer가 어떻게 중요해지는지 보겠습니다.
