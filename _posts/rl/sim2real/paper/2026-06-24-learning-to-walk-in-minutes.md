---
title: "[Sim2Real Paper 8] Learning to Walk in Minutes"
date: 2026-06-24 17:36:00 +0900
categories: [RL, Sim2Real, Paper]
tags: [sim2real, isaac-gym, legged-gym, massively-parallel-rl, quadruped-locomotion]
description: Rudin et al.의 Learning to Walk in Minutes를 통해 Isaac Gym과 legged gym 계열의 massively parallel RL locomotion 학습 흐름을 정리한다.
math: true
---

## **0. 전체 그림: Sim2Real Iteration Loop를 빠르게 만들기**

지금까지 본 논문들은 대부분 "어떻게 transfer를 잘할 것인가"를 다뤘습니다.

- noise로 reality gap 다루기
- visual domain randomization
- dynamics randomization
- actuator model과 latency
- learned actuator net
- proprioceptive rough terrain locomotion
- online adaptation

Rudin et al.의 **Learning to Walk in Minutes Using Massively Parallel Deep Reinforcement Learning**은 조금 다른 축을 봅니다.

질문은 다음입니다.

> Real robot에 transfer 가능한 legged locomotion policy를 얼마나 빠르게 학습하고 반복할 수 있는가?

이 논문은 Isaac Gym을 사용해 수천 개 robot을 single workstation GPU에서 병렬로 시뮬레이션합니다.

그 결과 flat terrain locomotion policy는 4분 이내, uneven terrain policy는 약 20분 안에 학습됩니다.

이 논문의 중요성은 단순히 "빠르다"가 아닙니다.

Sim2Real에서 reward, observation, randomization, terrain curriculum, actuator model을 계속 바꾸며 실험해야 하는데, 학습 시간이 분 단위가 되면 실험 방식 자체가 바뀝니다.

> 빠른 simulator는 좋은 policy를 한 번에 주는 도구가 아니라, 좋은 policy를 찾는 iteration loop를 빠르게 만드는 도구다.

## **1. 논문 정보**

| 항목 | 내용 |
|---|---|
| Title | Learning to Walk in Minutes Using Massively Parallel Deep Reinforcement Learning |
| Authors | Nikita Rudin, David Hoeller, Philipp Reist, Marco Hutter |
| Year | 2022 |
| Venue | Conference on Robot Learning 2021 / PMLR 2022 |
| Robot | ANYmal C, plus simulation examples on ANYmal B, A1, Cassie |
| Simulator | NVIDIA Isaac Gym |
| RL algorithm | PPO |
| Key idea | end-to-end GPU pipeline with thousands of parallel robots |
| Training result | flat terrain under 4 minutes, uneven terrain under about 20 minutes |
| Code | legged_gym |
| Source | [arXiv](https://arxiv.org/abs/2109.11978), [PMLR PDF](https://proceedings.mlr.press/v164/rudin22a/rudin22a.pdf), [legged_gym](https://github.com/leggedrobotics/legged_gym), [Project](https://leggedrobotics.github.io/legged_gym/) |

이 논문은 Isaac Gym / legged_gym / Isaac Lab 계열의 quadruped RL을 이해할 때 거의 기준점처럼 등장합니다.

특히 Unitree 계열이나 ANYmal 계열 policy를 GPU 병렬 환경에서 학습하는 흐름은 이 논문의 영향을 강하게 받았습니다.

## **2. 핵심 아이디어: End-to-End GPU Pipeline**

Massively parallel RL에서 중요한 것은 단순히 environment 수를 늘리는 것이 아닙니다.

Policy inference, physics simulation, reward computation, observation computation, rollout buffer, policy update가 모두 GPU pipeline 안에서 효율적으로 돌아야 합니다.

기존 CPU simulator 기반 pipeline은 대략 다음과 같습니다.

```text
CPU simulation
-> CPU reward / observation
-> copy rollout data to GPU
-> GPU policy update
-> copy policy action/state back
```

이때 CPU-GPU data transfer가 병목이 됩니다.

Rudin et al.은 Isaac Gym을 사용해 이 loop를 GPU 중심으로 바꿉니다.

```text
GPU physics simulation
-> GPU reward / observation
-> GPU policy inference
-> GPU rollout buffer
-> GPU PPO update
```

이 구조 덕분에 thousands of robots를 동시에 굴릴 수 있습니다.

논문의 핵심 구성은 다음입니다.

| 구성 | 역할 |
|---|---|
| Isaac Gym / PhysX GPU simulation | thousands of robots를 single GPU에서 병렬 simulation |
| PPO on GPU | rollout storage와 update를 GPU에서 처리 |
| large parallel rollout | 짧은 시간에 많은 experience 수집 |
| game-inspired curriculum | terrain difficulty를 policy performance에 맞게 조절 |
| Sim2Real additions | randomization, noise, pushes, actuator network |

즉 이 논문은 "GPU를 쓰면 빠르다"가 아니라, on-policy RL 전체 pipeline을 massively parallel regime에 맞게 다시 조정한 논문입니다.

## **3. 핵심 아이디어의 이론적 원리**

이 논문의 이론적 핵심은 on-policy RL에서 data collection과 policy update의 균형을 병렬 환경에 맞게 다시 잡는 것입니다.

단순히 robot 수를 늘리면 좋은 것이 아닙니다.

Robot 수, batch size, rollout horizon, GAE, timeout handling, terrain curriculum이 함께 맞아야 분 단위 학습이 가능합니다.

### **3.1 On-policy RL의 병목은 data collection이다**

PPO 같은 on-policy RL은 다음 두 단계를 반복합니다.

```text
collect rollout with current policy
-> update policy using collected rollout
```

수식으로 보면 objective는 다음과 같습니다.

$$
\max_{\pi}
\mathbb{E}_{\tau \sim p(\tau|\pi)}
\left[
\sum_{t=0}^{T-1}
\gamma^t r_t
\right]
$$

여기서 문제는 $\tau$를 모으는 데 시간이 많이 든다는 점입니다.

Legged locomotion에서는 한 step마다 다음 계산이 필요합니다.

```text
policy inference
physics step
contact handling
reward computation
observation computation
reset handling
```

Policy update는 GPU에서 병렬화하기 쉽습니다. 하지만 simulation과 reward/observation이 CPU에 있으면 data collection이 느려지고, GPU로 rollout data를 옮기는 비용도 커집니다.

그래서 논문은 data collection 자체를 GPU로 가져옵니다.

이것이 "end-to-end GPU pipeline"의 핵심입니다.

### **3.2 Batch size는 robot 수와 rollout horizon의 곱이다**

Massively parallel PPO에서 batch size는 다음처럼 볼 수 있습니다.

$$
B
=
n_{\mathrm{robots}}
\times
n_{\mathrm{steps}}
$$

$n_{\mathrm{robots}}$는 동시에 simulation하는 robot 수이고, $n_{\mathrm{steps}}$는 policy update 전에 각 robot이 걷는 step 수입니다.

Robot 수를 크게 늘리면 짧은 시간에 많은 sample을 모을 수 있습니다.

하지만 batch size를 고정한 상태에서 robot 수만 늘리면 각 robot의 rollout horizon이 짧아집니다.

$$
n_{\mathrm{steps}}
=
\frac{B}{n_{\mathrm{robots}}}
$$

이때 문제가 생깁니다.

Legged locomotion은 single transition만으로 배우기 어렵습니다. Gait, balance, contact, fall recovery는 시간 흐름 속에서 reward를 봐야 합니다.

논문은 너무 적은 consecutive steps를 주면 PPO가 좋은 policy로 수렴하지 못한다고 설명합니다. 특히 GAE는 여러 time step의 reward가 있어야 advantage estimate가 의미를 갖습니다.

따라서 massively parallel regime에는 trade-off가 있습니다.

| 너무 적은 robot | 너무 많은 robot |
|---|---|
| samples가 서로 비슷해져 diversity가 낮음 | robot당 horizon이 너무 짧아 temporal information 부족 |
| wall-clock time이 길어짐 | GAE와 locomotion dynamics를 배우기 어려움 |

논문은 이 trade-off를 실험했고, 2048-4096 robots와 약 100k-200k batch size가 좋은 균형이라고 봅니다.

실제 deployment experiment에서는 4096 robots, batch size 98304를 사용해 1500 policy updates를 20분 이내에 학습합니다.

### **3.3 Timeout과 failure termination은 다르게 처리해야 한다**

대규모 병렬 환경에서는 reset이 자주 일어납니다.

Reset은 크게 두 종류입니다.

| Reset type | 의미 |
|---|---|
| failure termination | robot이 넘어지거나 base contact가 생김 |
| time-out termination | episode max length에 도달했을 뿐 실패는 아님 |

이 둘을 같은 terminal state로 처리하면 critic 학습이 왜곡됩니다.

Failure termination은 실제로 future return이 낮아지는 terminal event입니다.

하지만 time-out은 단순히 rollout을 잘라낸 것입니다. Observation에 episode time을 넣지 않았다면 policy는 time-out을 예측할 수도 없습니다.

따라서 time-out에서는 value target을 0으로 끊으면 안 됩니다.

Critic target을 단순화하면 다음처럼 볼 수 있습니다.

Failure terminal이면:

$$
V_{\mathrm{target}}
=
r_t
$$

Time-out이면 다음 state의 value를 bootstrap해야 합니다.

$$
V_{\mathrm{target}}
=
r_t
+
\gamma V(s_{t+1})
$$

논문은 time-out bootstrapping이 critic loss를 줄이고 total reward를 약 10-20% 개선한다고 보고합니다.

이 디테일은 작아 보이지만, 짧은 rollout horizon과 많은 reset이 있는 massively parallel training에서는 중요합니다.

### **3.4 Game-inspired curriculum은 terrain difficulty를 robot별로 조절한다**

Rough terrain 학습에서는 처음부터 너무 어려운 terrain을 주면 policy가 실패만 반복합니다.

너무 쉬운 terrain만 주면 real rough terrain에서 깨집니다.

논문은 game-inspired curriculum을 사용합니다.

각 robot은 terrain type과 terrain level을 가집니다.

Terrain type은 다음과 같습니다.

| Terrain type | 예시 |
|---|---|
| flat | flat ground |
| sloped | smooth / rough slope |
| random rough | uneven surface |
| discrete obstacles | randomized blocks |
| stairs | up/down stairs |

Terrain level은 같은 terrain type 안에서 difficulty를 나타냅니다.

예를 들어 stairs와 obstacles는 step height가 5cm에서 20cm로 커지고, slope는 0도에서 25도까지 어려워집니다.

Rule은 단순합니다.

```text
robot crosses terrain border
-> level up

robot progresses less than half of target distance
-> level down

robot solves highest level
-> loop back to random level for diversity
```

이 방식은 6편의 adaptive terrain curriculum과 닮았지만, particle filter보다 단순하고 massively parallel setting에 잘 맞습니다.

수천 개 robot이 동시에 여러 level에 퍼져 있으므로, 현재 policy가 어느 난이도까지 풀 수 있는지 자체가 curriculum distribution이 됩니다.

### **3.5 Terrain을 tiled mesh로 만들고 robot을 이동시킨다**

GPU에서 수천 robot을 하나의 simulation으로 굴리면 terrain 생성에도 제약이 생깁니다.

각 robot reset마다 terrain mesh를 새로 만들면 비쌉니다.

논문은 terrain type과 level을 하나의 큰 mesh에 tile처럼 깔아둡니다.

그리고 robot의 terrain level을 바꿀 때 terrain을 regenerate하는 것이 아니라, robot을 해당 tile 위치로 이동시킵니다.

```text
one large terrain mesh
-> tiles contain terrain type x level
-> robot level changes by moving robot to another tile
```

이 구조는 curriculum을 거의 zero overhead로 구현하게 해줍니다.

또한 논문은 contact computation이 simulator time의 큰 부분을 차지한다고 보고, collision body를 feet, shanks, knees, base처럼 필요한 부분으로 줄이고, terrain representation도 throughput을 고려해 최적화합니다.

즉 빠른 학습은 알고리즘만의 문제가 아니라 environment 구현 문제이기도 합니다.

### **3.6 Sim2Real additions는 빠른 학습 안에 같이 들어간다**

이 논문은 infrastructure 논문처럼 보이지만, real robot transfer를 위해 필요한 요소도 포함합니다.

중요한 Sim2Real 요소는 다음입니다.

| 요소 | 역할 |
|---|---|
| friction randomization | foot-ground friction mismatch 대응 |
| observation noise | state estimator / sensor noise 대응 |
| random pushes | disturbance robustness |
| actuator network | ANYmal series elastic actuator dynamics 반영 |
| terrain curriculum | rough terrain robustness |
| terrain height measurements | perceptive locomotion input |

논문은 ground friction을 uniform range에서 randomize하고, robot에 random pushes를 줍니다. Push는 일정 시간마다 base velocity disturbance 형태로 들어갑니다.

ANYmal의 series elastic actuator는 단순 PD model로 정확히 표현하기 어렵기 때문에, 이전 Hwangbo et al. 흐름처럼 actuator network를 사용합니다. 이 논문에서는 current measurement를 LSTM actuator model에 넣어 torque를 계산합니다.

Action은 desired joint position입니다.

$$
a_t
\equiv
\hat{q}_t
$$

Motor torque는 low-level position control이나 actuator model을 통해 만들어집니다.

이 흐름은 4편과 5편의 actuator modeling과 직접 연결됩니다.

### **3.7 Observation과 reward는 gait-specific prior 없이 구성된다**

Policy observation에는 proprioceptive state와 terrain height measurement가 들어갑니다.

논문은 terrain around base에서 108개 height measurement를 사용합니다.

Action은 12개 joint의 desired position입니다.

Reward는 velocity tracking과 안정성/효율성 항으로 구성됩니다.

| Reward / penalty | 의미 |
|---|---|
| commanded velocity tracking | 명령 속도와 heading 추종 |
| undesired velocity penalty | 옆/수직 방향 움직임 억제 |
| torque penalty | actuator effort 감소 |
| joint acceleration penalty | 거친 움직임 억제 |
| action rate penalty | joint target 변화 부드럽게 |
| collision penalty | shank/knee/base collision 억제 |
| long step reward | 더 자연스러운 stepping 유도 |

중요한 점은 reward나 action space에 특정 gait schedule을 넣지 않는다는 것입니다.

논문은 gait-dependent element 없이도 policy가 trotting gait로 수렴한다고 설명합니다.

하지만 동시에 artifact도 생길 수 있습니다. 예를 들어 dragging leg나 이상한 base height 같은 behavior가 나올 수 있고, reward tuning을 통해 이를 정리해야 합니다.

즉 빠른 training은 reward design의 중요성을 없애지 않습니다.

### **3.8 Parallelism은 무조건 많을수록 좋은 것이 아니다**

이 논문에서 중요한 실험은 robot 수를 늘렸을 때 성능과 training time이 어떻게 바뀌는지입니다.

직관적으로는 robot 수가 많을수록 좋을 것 같지만, 실제로는 upper limit이 있습니다.

이유는 앞에서 본 것처럼 batch size와 rollout horizon의 trade-off 때문입니다.

| 경우 | 결과 |
|---|---|
| robot 수가 너무 적음 | wall-clock time이 길고 sample diversity가 낮음 |
| robot 수가 적당함 | throughput과 temporal information 균형 |
| robot 수가 너무 많음 | robot당 consecutive steps가 너무 짧아 performance 하락 |

논문은 rough terrain에서 16384 robots까지 실험하지만, 최종 실험에서는 4096 robots와 batch size 98304를 사용합니다.

이 점은 실전적으로 중요합니다.

Massively parallel RL은 "env 수를 최대한 크게"가 아니라, "policy update에 필요한 temporal structure를 보존하는 범위에서 크게"가 맞습니다.

## **4. Sim2Real 관점에서의 해석**

이 논문은 Sim2Real 자체의 technique이라기보다, Sim2Real workflow를 바꾸는 infrastructure 논문에 가깝습니다.

앞선 논문들이 transfer mechanism을 다뤘다면, 이 논문은 그 mechanism들을 실험하고 조합하는 속도를 크게 올립니다.

Sim2Real 관점에서 pipeline은 다음처럼 볼 수 있습니다.

```text
massively parallel simulation
-> fast PPO training
-> terrain curriculum and randomization
-> quick policy iteration
-> real robot deployment
-> inspect failure modes
-> adjust reward / observation / randomization / curriculum
```

핵심은 빠른 학습이 검증을 대체하지 않는다는 점입니다.

빠른 학습은 오히려 더 많은 검증을 가능하게 합니다.

예를 들어 다음 실험을 빠르게 반복할 수 있습니다.

| 실험 축 | 확인할 것 |
|---|---|
| reward weights | dragging leg, base height, foot clearance, torque artifact |
| observation set | terrain height, velocity estimate, previous action 필요성 |
| randomization range | real condition을 덮는지, 너무 넓어 보수적인지 |
| curriculum | terrain이 너무 쉽거나 어려운지 |
| actuator model | real actuator dynamics와 action response mismatch |
| command distribution | real deployment에서 필요한 speed/turning range |

즉 이 논문의 Sim2Real 메시지는 다음입니다.

> Sim2Real은 한 번에 맞히는 문제가 아니라, 빠르게 학습하고 빠르게 실패를 확인하며 gap을 줄이는 반복 과정이다.

## **5. 이 논문의 한계**

이 논문을 읽을 때 주의할 점도 있습니다.

첫째, 빠른 training이 좋은 reward를 자동으로 만들어주지는 않습니다.

논문도 reward tuning 후에야 dragging leg나 이상한 base height 같은 artifact를 줄일 수 있었다고 설명합니다.

둘째, Isaac Gym physics와 real robot 사이의 gap은 여전히 존재합니다.

GPU simulator가 빠르다고 해서 contact, actuator, terrain sensing이 현실과 완전히 같아지는 것은 아닙니다.

셋째, terrain height map에 의존하는 perceptive policy는 map 품질에 영향을 받습니다.

논문은 real deployment에서 height map이 완벽하지 않아 high velocity에서 robustness가 감소했고, hardware에서는 maximum linear velocity command를 줄였다고 설명합니다.

넷째, massively parallel regime은 PPO hyperparameter를 다시 생각해야 합니다.

Batch size, number of steps, mini-batch size, timeout handling을 기존 small-scale PPO 방식 그대로 두면 좋은 성능이 나오지 않을 수 있습니다.

다섯째, simulation curve만 보고 real transfer를 판단하면 위험합니다.

빠른 학습은 sim-only exploit도 빠르게 만들 수 있습니다. Real deployment나 sim-to-sim validation이 여전히 필요합니다.

그래도 이 논문의 가치는 큽니다.

> Legged Sim2Real에서 iteration speed 자체가 연구와 개발의 질을 바꿀 수 있다는 것을 보여준다.

## **6. 정리하며: 빠른 학습은 빠른 검증 루프를 만든다**

이번 글에서는 Rudin et al.의 **Learning to Walk in Minutes Using Massively Parallel Deep Reinforcement Learning**을 정리했습니다.

- Isaac Gym을 사용해 thousands of robots를 single workstation GPU에서 병렬로 시뮬레이션합니다.
- PPO pipeline 전체를 GPU 중심으로 구성해 data collection과 update를 빠르게 만듭니다.
- Batch size는 $B = n_{\mathrm{robots}} n_{\mathrm{steps}}$이며, robot 수와 rollout horizon 사이에 trade-off가 있습니다.
- Time-out termination은 failure termination과 다르게 bootstrap해야 critic 학습이 안정됩니다.
- Game-inspired curriculum은 terrain type과 level을 robot별로 조절합니다.
- Terrain을 tiled mesh로 구성하고 robot을 tile 사이로 이동시켜 curriculum overhead를 줄입니다.
- Sim2Real을 위해 friction randomization, observation noise, random pushes, actuator network를 함께 사용합니다.
- Flat terrain은 4분 이내, uneven terrain은 약 20분 안에 학습됩니다.
- 빠른 학습은 검증을 대체하는 것이 아니라 reward, observation, randomization, curriculum을 더 자주 검증하게 해줍니다.

8편의 핵심은 이렇게 정리할 수 있습니다.

> Sim2Real에서 빠른 학습은 빠른 실패 분석과 빠른 수정으로 이어질 때 가장 강력하다.

여기까지 오면 Sim2Real paper 흐름은 하나로 이어집니다.

Reality gap을 이해하고, visual/dynamics randomization을 배우고, actuator와 latency를 다루고, rough terrain과 online adaptation을 본 뒤, 마지막으로 Isaac Gym 계열의 빠른 반복 학습으로 연결됩니다.
