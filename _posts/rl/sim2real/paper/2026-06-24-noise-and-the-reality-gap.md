---
title: "[Sim2Real Paper 1] Noise and The Reality Gap"
date: 2026-06-24 12:45:00 +0900
last_modified_at: 2026-07-27 21:06:00 +0900
categories: [RL, Sim2Real, Paper]
tags: [sim2real, reality-gap, robot-simulation, noise, evolutionary-robotics, robust-control, khepera]
description: Jakobi et al.의 1995년 논문을 바탕으로 실측 기반 Khepera simulator, 세 가지 noise 조건, simulation-real trajectory correspondence, envelope-of-noise 가설과 현대 domain randomization과의 차이를 정리한다.
math: true
image:
  path: /assets/img/posts/rl/sim2real/noise-reality-gap/00-preview.png
  alt: 세 가지 simulation noise 조건에서 진화한 Khepera obstacle-avoidance trajectory 비교
---

## **0. 전체 그림: Simulation은 왜 현실과 달라지는가**

Sim2Real을 이해하려면 먼저 **Reality Gap**이라는 문제를 잡아야 합니다.

Simulation은 빠르고 안전하며 reset도 쉽습니다. 하지만 실제 로봇에서는 같은 action을 줘도 actuator 응답이 조금씩 달라지고, sensor에는 noise가 섞이며, 바닥 마찰과 contact도 매번 완전히 같지 않습니다. Controller가 simulation의 정확성과 반복 가능성에 기대어 학습했다면 이 작은 차이들이 실제 배포에서 큰 behavior 차이로 이어질 수 있습니다.

> **Reality Gap**이란?
>
> Simulation에서 학습하거나 검증한 controller가 실제 robot에서 같은 behavior와 성능을 재현하지 못하는 차이를 말합니다.

Jakobi, Husbands, Harvey의 **Noise and The Reality Gap: The Use of Simulation in Evolutionary Robotics**는 이 문제를 아주 초기에 정면으로 다룬 논문입니다.

1995년에 나온 evolutionary robotics 논문이라 지금의 PPO, GPU parallel simulation, quadruped locomotion과는 방법이 다릅니다. 그래도 이 논문이 던진 질문은 지금도 그대로 남아 있습니다.

> Simulation을 현실과 완전히 같게 만들 수 없다면, 우리는 simulation을 어떻게 써야 하는가?

처음에는 제목만 보고 simulation에 noise를 많이 넣는 논문이라고 생각하기 쉽습니다. 실제 절차는 더 신중합니다. 측정 가능한 sensor·motor dynamics를 실제 robot 데이터로 먼저 맞추고, 모델에 남은 stochastic variation만 실측 크기의 noise로 표현했습니다. 마지막에는 simulation score보다 simulation과 real robot의 **trajectory correspondence**를 직접 비교했습니다. Underlying model이 부정확하면 noise가 모든 차이를 메우지 못하고, 현실보다 큰 noise 역시 transfer를 해칠 수 있다는 것이 실험에서 드러납니다.

## **1. 논문 정보**

| 항목 | 내용 |
|---|---|
| Title | Noise and The Reality Gap: The Use of Simulation in Evolutionary Robotics |
| Authors | Nick Jakobi, Phil Husbands, Inman Harvey |
| Year | 1995 |
| Venue | ECAL 1995, *Advances in Artificial Life*, pp. 704-720 |
| Robot | Khepera two-wheeled robot |
| Tasks | obstacle avoidance, light seeking |
| Controller | recurrent dynamical neural network |
| Training method | evolutionary robotics |
| Source | [Paper PDF](https://cse-robotics.engr.tamu.edu/dshell/cs689/papers/jakobi95noise.pdf), [DOI](https://doi.org/10.1007/3-540-59496-5_337) |

지금 기준으로 보면 실험은 작습니다. 사족보행도 아니고, modern deep RL도 아닙니다. 하지만 핵심 질문은 지금도 그대로입니다.

> Simulation에서 얻은 behavior가 real robot에서도 같은 behavior로 나오는가?

## **2. 실측 모델 위에 현실적인 noise를 넣기**

이 논문에서 가장 중요한 개념은 **envelope of noise**입니다.

완벽한 simulation을 만드는 것은 어렵습니다. 특히 robot이 실제 환경과 상호작용할수록 모든 sensor, actuator, contact, material property를 정확히 모델링하기는 어렵습니다.

그러면 한 가지 방법은 simulation에 적절한 noise를 넣는 것입니다.

> **Envelope of noise**란?
>
> 실제 robot에서 생기는 불확실성을 simulation 안에서 일정 범위의 noise로 감싸서, controller가 깨끗한 simulation에만 맞춰지지 않도록 하는 방법입니다.

이 논문에서 noise는 난도를 올리기 위한 방해물이 아니라, **real world에서 피할 수 없는 불확실성을 training distribution 안으로 옮기는 장치**입니다.

적절한 noise는 controller가 simulation의 특수한 조건에 overfit되는 것을 막습니다. Simulation 안에서 조금 흔들리는 세계를 경험한 controller는 실제 robot의 불완전함에도 더 잘 버틸 수 있습니다.

다만 순서를 뒤집으면 안 됩니다. 저자들은 먼저 실제 Khepera에서 많은 sensor·motor 데이터를 수집하고, 이 값으로 robot-environment interaction을 모델링했습니다. Noise는 부정확한 toy simulator를 정당화하는 수단이 아니라, **검증된 underlying model에 남아 있는 stochastic variation을 표현하는 수단**에 가깝습니다.

### **2.1 무엇을 얼마나 자세히 모델링했는가?**

Khepera는 지름 5.8 cm, 높이 3.0 cm의 차동구동 robot입니다. 전방 6개와 후방 2개, 총 8개의 active IR proximity sensor를 가지며 같은 receiver를 ambient-light sensor로도 사용할 수 있습니다.

Simulator는 lookup table이 아니라 2차원 공간에서 연속적으로 움직이는 수학 모델이었습니다.

| 구성 요소 | 논문의 모델링 방식 |
|---|---|
| Control/update 주기 | neural network 입출력과 simulator를 100 ms마다 갱신 |
| Wheel/motor | 실제 speed·position 응답을 측정하고 PID dynamics와 static friction을 모델링 |
| PID 계수 | 실제 robot과 같은 $K_p=3800$, $K_i=800$, $K_d=100$ 사용 |
| IR proximity | sensor마다 180도 범위의 ray 10개를 쏘고 거리·입사각으로 반사 강도 계산 |
| Ambient light | 직접광과 2차 반사를 ray tracing으로 계산 |
| Lamp | 60 W desk lamp를 밝기가 다른 5개 point source로 근사 |
| Parameter 설정 | 실제 sensor·motor 실험값에 curve fitting하여 상수와 mapping 결정 |

이 세부사항은 이 논문의 메시지를 바로잡아 줍니다.

> **High fidelity와 robustness는 대체 관계가 아니다.**
>
> 측정 가능한 dynamics는 가능한 한 모델링하고, 정확히 고정하기 어려운 variation은 noise로 다룬다.

### **2.2 두 task는 무엇이 달랐는가?**

![Obstacle avoidance와 light seeking 실험 환경](/assets/img/posts/rl/sim2real/noise-reality-gap/01-task-environments.png){: width="1050" .d-block .mx-auto }
_Obstacle avoidance는 50 cm 정사각형 arena와 반지름 4 cm의 cylinder 네 개를 사용했다. Light seeking은 110 cm x 70 cm arena 한쪽에 60 W lamp를 두었다. 출처: [Jakobi et al., Figures 1-2](https://cse-robotics.engr.tamu.edu/dshell/cs689/papers/jakobi95noise.pdf)._

두 task는 같은 robot을 쓰지만 제어 시간 척도가 다릅니다.

- **Obstacle avoidance**는 가까운 obstacle을 IR sensor로 감지한 직후 방향을 바꿔야 합니다. 작은 sensor·motor 차이가 충돌 여부를 바꾸므로 빠른 closed-loop 반응이 중요합니다.
- **Light seeking**은 arena 반대편에서 시작해 lamp 쪽으로 이동합니다. 즉각적인 회전뿐 아니라 천천히 휘어지는 경로도 성공할 수 있어 fitness landscape가 상대적으로 부드럽습니다.

이 차이는 "noise가 transfer에 미치는 영향이 task dynamics에 따라 달라질 수 있다"는 점을 보여줍니다.

### **2.3 Controller는 강화학습으로 학습한 것이 아니다**

이 논문은 PPO나 SAC를 사용하지 않습니다. Controller는 arbitrary recurrent dynamical neural network이고, distributed genetic algorithm으로 network 구조와 parameter를 진화시킵니다.

| 항목 | 설정 |
|---|---:|
| Population | 64 individuals |
| Evolution budget | run당 1,000 fitness evaluations |
| Noise 조건당 반복 | task별 5 runs |
| 전체 run 수 | 2 tasks x 3 noise levels x 5 runs = 30 |
| Evaluation당 trial | 2 trials의 평균 |
| Trial 길이 | simulated 20 seconds |
| Network 규모 | genotype 30 slots 중 보통 neuron 10-12개 사용 |
| Network I/O update | 100 ms |

최적화 방법은 현대 RL과 다르지만 transfer 문제의 구조는 같습니다.

| Controller가 이용한 규칙 | 배포 결과 |
|---|---|
| Real robot에도 성립하는 규칙 | simulation의 behavior가 현실로 transfer될 수 있음 |
| Simulator에만 성립하는 규칙 | simulation score는 높아도 reality-gap failure가 발생 |

### **2.4 Evolution은 무엇을 최적화했는가?**

Obstacle avoidance에서는 빠르게 전진하되 좌우 회전이 한쪽으로 치우치지 않는 controller를 찾았습니다. 실제 fitness는 아래 식입니다.

$$
F_{\mathrm{avoid}}
=
V\left(1-\sqrt{D}\right)
$$

- $V$: 각 time step에서 두 wheel speed를 합산하고 정규화한 값
- $D$: 좌우 wheel-speed 차이의 signed sum에 절댓값을 취한 값

원래 선행 연구의 식에는 proximity sensor penalty도 있었지만, 저자들은 arena가 충분히 복잡하므로 빠르게 오래 움직이려면 obstacle avoidance가 암묵적으로 필요하다고 보고 그 항을 제거했습니다. 이 설계는 reward가 behavior를 어떻게 우회적으로 규정하는지 보여줍니다.

Light seeking의 fitness는 매 time step의 lamp까지 거리 $D_i$를 사용했습니다.

$$
F_{\mathrm{light}}
=
\frac{1}{\sum_{i=1}^{n}D_i^2}
$$

가까운 거리를 오래 유지할수록 fitness가 커집니다. 두 task 모두 simulation에서 계산한 fitness로 controller를 진화시켰고, real robot에서 추가 학습하지 않았습니다.

### **2.5 세 가지 noise 조건**

저자들은 obstacle avoidance와 light seeking 각각에 대해 세 가지 noise 조건을 사용했습니다. 조건마다 5회의 evolutionary run을 수행한 뒤, 진화한 controller를 실제 Khepera에 올려 simulation behavior와 비교했습니다.

| 조건 | 의미 |
|---|---|
| zero noise | 측정된 stochastic variation을 추가하지 않음 |
| observed noise | 실제 실험에서 구한 표준편차를 갖는 대략적인 Gaussian noise |
| double noise | 같은 분포에서 표준편차만 2배 |

`observed noise`가 sensor별 noise profile을 완벽히 재현했다는 뜻은 아닙니다. 논문은 sensor 간 차이나 개별 noise profile 대신, 실측 크기에 맞춘 단순 분포를 사용했습니다. 이 점 때문에 저자들도 envelope-of-noise 가설에 대한 증거를 **inconclusive**, 즉 결정적이지 않다고 표현합니다.

저자들의 주관적 점수를 조건별 평균으로 요약하면 observed-noise 조건이 두 task 모두 가장 높았습니다.

| Task | Noise | Behavior quality | Sim-real correspondence |
|---|---|---:|---:|
| Obstacle avoidance | Zero | 4.0 | 6.2 |
| Obstacle avoidance | Observed | **6.0** | **8.0** |
| Obstacle avoidance | Double | 4.8 | 6.8 |
| Light seeking | Zero | 6.4 | 5.6 |
| Light seeking | Observed | **6.8** | **7.8** |
| Light seeking | Double | 5.8 | 5.4 |

`Behavior quality`는 simulation에서 반복 실행했을 때 전략이 얼마나 optimal하고 robust한지를, `correspondence`는 simulation과 real trajectory가 얼마나 닮았는지를 나타냅니다. 둘 다 최대 10점이며 **저자들의 주관적 평가**입니다. Noise 조건마다 controller가 5개뿐이고 confidence interval이나 통계 검정도 없습니다. 따라서 숫자의 순위는 흥미로운 관찰이지 강한 정량적 증명은 아닙니다.

> 이 실험에서는 현실과 비슷한 크기의 noise가 가장 높은 평균 점수를 보였다. 그러나 noise가 많을수록 transfer가 좋아진다는 뜻은 아니다.

이 결과는 noise의 양보다 **real robot에서 생기는 variation을 적절한 범위로 감싸는 일**이 중요하다는 쪽으로 읽어야 합니다.

## **3. Trajectory로 읽는 실제 결과**

평균 점수만 보면 observed noise가 좋아 보입니다. 하지만 trajectory를 함께 보면 각 controller가 simulation의 어떤 규칙을 이용했는지가 더 분명하게 드러납니다.

### **3.1 Obstacle avoidance: 정확한 90도 회전이라는 편법**

![Obstacle avoidance의 simulation-real trajectory 비교](/assets/img/posts/rl/sim2real/noise-reality-gap/02-obstacle-sim-real-trajectories.png){: width="1200" .d-block .mx-auto }
_열은 zero, observed, double noise에서 선택한 controller다. 위는 실제 Khepera, 아래는 simulation trajectory이며 흰색 또는 검은색 tail이 이동 경로와 방향을 나타낸다. 출처: [Jakobi et al., Figure 3](https://cse-robotics.engr.tamu.edu/dshell/cs689/papers/jakobi95noise.pdf)._

Zero-noise controller 중 하나는 obstacle을 만날 때마다 **항상 정확히 90도 회전**하는 전략을 진화시켰습니다. Deterministic simulator에서는 같은 상황에 항상 같은 반응이 나오므로 arena 외곽을 계속 순환할 수 있었습니다.

하지만 실제 robot은 동일한 회전을 두 번 완전히 똑같이 수행하지 않습니다. 몇 도씩 생기는 오차가 누적되자 steady cycle이 깨졌고, 한쪽을 제대로 보지 못하는 controller는 결국 obstacle에 부딪혔습니다.

| 환경 | 같은 상황에서의 반응 | 결과 |
|---|---|---|
| Zero-noise simulator | 매번 거의 같은 90도 회전 | 안정적인 주기 궤도를 유지 |
| Real robot | 회전각에 작은 오차가 발생 | 오차가 누적되어 주기 궤도가 붕괴 |

이것은 현대적인 의미의 **simulator exploit**입니다. Policy가 task의 본질적인 구조를 배운 것이 아니라 simulator가 지나치게 반복 가능하다는 성질을 이용한 것입니다.

Observed-noise controller는 반복할 때마다 조금씩 다른 sensor·motor 결과를 경험했으므로 정확한 주기 궤도에 의존하기 어려웠습니다. 그 결과 local feedback에 더 의존하는 strategy가 선택될 가능성이 커졌고, real trajectory와의 correspondence도 평균적으로 높았습니다.

### **3.2 Light seeking: noise가 너무 많아도 편법이 생긴다**

![Light seeking의 simulation-real trajectory 비교](/assets/img/posts/rl/sim2real/noise-reality-gap/03-light-seeking-sim-real-trajectories.png){: width="1200" .d-block .mx-auto }
_세 noise 조건에서 선택한 light-seeking controller의 실제 trajectory(위)와 simulation trajectory(아래). 출처: [Jakobi et al., Figure 5](https://cse-robotics.engr.tamu.edu/dshell/cs689/papers/jakobi95noise.pdf)._

Double-noise의 실패는 반대 방향의 교훈을 줍니다. 논문이 설명한 한 controller는 좌우 light sensor가 반대쪽 wheel을 구동하는 Braitenberg식 coupling을 사용했습니다. Simulator에서는 큰 noise가 robot을 계속 좌우로 흔들어 정지 상태에서 빠져나오게 했고, 결과적으로 lamp 쪽으로 전진했습니다.

실제 robot의 noise는 그만큼 크지 않았습니다. Controller가 움직임을 만들어 내기 위해 의존했던 jitter가 사라지자 simulation과 같은 behavior를 재현하지 못했습니다.

> **너무 적은 noise뿐 아니라 너무 많은 noise도 simulation-only strategy를 만든다.**

따라서 double noise는 단순히 학습을 어렵게 만든 것이 아닙니다. 현실에는 없는 stochastic dynamics를 만들었고, evolution이 그것을 이용할 수 있게 했습니다.

### **3.3 Observed noise가 최고였다는 결과를 어디까지 믿어야 하는가?**

두 task 모두 observed noise에서 평균 behavior score와 correspondence score가 가장 높았습니다. 다만 저자들은 **robust behavior를 가장 잘 만든 noise level과 correspondence를 가장 높인 noise level이 같았다는 사실은 우연일 수 있다**고 명시했습니다.

Run당 fitness evaluation은 trial 2개의 평균뿐이어서 stochastic fitness의 분산을 충분히 줄이지 못했습니다. Zero noise에서는 초기 조건에 따라 성공과 실패가 갈리는 brittle strategy가, double noise에서는 같은 genotype도 evaluation마다 점수가 크게 달라지는 문제가 있었습니다. Observed noise는 이 둘 사이에서 가장 좋은 비용 대비 균형을 보였지만, 실험 규모가 작고 평가지표가 주관적이므로 일반 법칙으로 단정할 수 없습니다.

## **4. 현대 RL 관점에서 다시 쓰기**

> 이 절의 MDP 수식은 1995년 원문에 나온 표기가 아니라, 논문의 아이디어를 현대 reinforcement-learning 언어로 재해석한 것입니다.

이 논문의 이론적 의미는 "simulation에 noise를 넣었다"보다 넓습니다. Controller가 하나의 깨끗한 simulator에 과적합되는 문제를 줄이고, real world에서 나타날 transition variation에 버티게 만드는 과정으로 볼 수 있습니다.

### **4.1 Clean simulation은 하나의 좁은 MDP다**

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

### **4.2 Noise는 transition distribution을 넓힌다**

Noise를 넣는다는 것은 simulator를 하나의 deterministic world로 두지 않고, 여러 possible world를 갖는 distribution으로 바꾸는 것과 비슷합니다.

이를 parameterized simulator로 보면 다음처럼 쓸 수 있습니다.

$$
\mathcal{M}_{\xi}
= (\mathcal{S}, \mathcal{A}, P_{\xi}, R_{\xi}, \gamma),
\quad
\xi \sim p(\xi)
$$

여기서 $\xi$는 sensor noise와 motor noise 같은 stochastic variation을 나타냅니다. 이 논문은 mass나 friction을 episode마다 바꾸지는 않았으므로, $\xi$를 현대 dynamics-randomization parameter 전체와 동일시하면 안 됩니다.

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

### **4.3 Noise envelope은 coverage 문제다**

Noise envelope은 넓을수록 좋은 값이 아니라 **coverage와 realism 사이의 설계 변수**입니다.

| Noise envelope | Training에서 생기는 일 | 예상되는 transfer 문제 |
|---|---|---|
| 너무 좁음 | clean하고 제한된 case만 경험 | 실제 perturbation이 training support 밖으로 벗어남 |
| 실측 범위와 비슷함 | 현실적인 variation 안에서 반복 학습 | simulator shortcut에 대한 의존을 줄일 가능성이 있음 |
| 너무 넓음 | 현실에 없는 perturbation까지 견뎌야 함 | task signal이 흐려지거나 비현실적 noise를 이용할 수 있음 |

그래서 이 논문의 중요한 메시지는 "noise를 많이 넣자"가 아닙니다.

> Real robot에서 실제로 생기는 variation을 덮을 만큼은 넓고, task structure를 잃을 만큼은 넓지 않은 noise envelope이 필요하다.

이것이 현대 Sim2Real에서 randomization range를 잡는 문제와 연결됩니다.

### **4.4 적절한 noise는 simulator shortcut을 불안정하게 만든다**

Clean simulation에서는 controller가 현실에서는 성립하지 않는 shortcut을 사용할 수 있습니다.

실제 zero-noise obstacle controller가 정확한 90도 회전에 의존했던 것이 이 경우입니다. 반대로 double-noise light seeker는 현실보다 큰 jitter를 locomotion mechanism처럼 이용했습니다.

이런 strategy는 simulation 안에서는 높은 score를 얻을 수 있지만, real robot에서는 작은 noise나 delay만 들어와도 깨질 수 있습니다.

Noise를 넣으면 이런 shortcut이 불안정해집니다. Controller는 한 번의 깨끗한 trajectory에만 의존할 수 없고, 여러 perturbation 아래에서도 유지되는 feature와 behavior를 찾아야 합니다.

현대적인 표현으로 말하면, 적절한 noise는 policy가 simulation-specific feature에 overfit되는 것을 줄이고, real world에서도 유지될 가능성이 높은 invariant behavior를 학습하도록 압력을 줍니다. 다만 3.2절의 double-noise 사례처럼 **현실과 맞지 않는 noise는 새로운 simulator shortcut을 만들 수도 있습니다.**

### **4.5 Correspondence는 reward와 다르다**

이 논문에서 중요한 또 다른 점은 real transfer를 단순히 simulation score로 판단하지 않는다는 것입니다.

Simulation에서 reward가 높아도 real robot에서 같은 behavior가 나오지 않으면 transfer에 실패한 것입니다.

그래서 논문은 simulation behavior와 real behavior의 correspondence를 봅니다.

이 관점은 지금도 중요합니다.

$$
\text{high sim reward}
\not\Rightarrow
\text{high real correspondence}
$$

즉 Sim2Real에서는 policy performance뿐 아니라, simulation에서 보인 behavior가 real robot에서 얼마나 재현되는지도 봐야 합니다.

이것은 이후 domain randomization, dynamics randomization, actuator model 논문으로 이어지는 중요한 기준입니다.

## **5. 현대 Sim2Real과 연결하기**

이 논문은 작은 Khepera robot과 evolutionary controller를 다룹니다. 하지만 Sim2Real 관점에서 보면 이후 연구의 기본 문장을 이미 갖고 있습니다.

> Real world를 정확히 복제할 수 없다면, real world에서 생기는 불확실성을 training distribution 안에 넣어야 한다.

### **5.1 Simulation fidelity와 robustness는 같이 봐야 한다**

Sim2Real에는 서로 보완적인 두 축이 있습니다.

| 축 | 대표 방법 | 역할 |
|---|---|---|
| Simulation fidelity | system identification, actuator modeling, contact fitting, sensor calibration | nominal simulator와 real robot 사이의 구조적 차이를 줄임 |
| Controller robustness | noise injection, domain randomization, external perturbation | 모델링 후에도 남는 uncertainty에 controller가 버티도록 함 |

이 논문은 실제로 두 방향을 함께 사용했습니다. Motor·sensor response는 실측하여 simulator fidelity를 높였고, 측정된 stochastic variation은 noise로 추가해 controller robustness를 높였습니다.

### **5.2 Noise injection과 domain randomization은 같은가?**

현대 Sim2Real에서는 noise라는 단어보다 randomization이라는 단어를 더 많이 씁니다.

문제의 철학은 이어지지만 구현은 다릅니다.

| 구분 | Jakobi et al., 1995 | 현대 domain/dynamics randomization |
|---|---|---|
| 주된 변화 | 매 step의 sensor·motor stochastic noise | episode 또는 step마다 물리·시각 parameter 변화 |
| 기준 simulator | 실측값으로 맞춘 하나의 Khepera model | nominal model 또는 system identification 결과 |
| 예시 | 실제 표준편차의 0배, 1배, 2배 | mass, friction, latency, motor strength, terrain, texture |
| 목표 | 현실의 stochastic behavior와 correspondence | real domain이 training-domain distribution 안에 포함되도록 함 |

두 방법 모두 하나의 깨끗한 simulator에 controller가 과적합되는 문제를 줄이려 한다는 공통점이 있습니다.

따라서 이 논문을 **domain randomization 그 자체**라고 부르는 것은 과합니다. 두 개념의 관계는 아래 정도로 표현하는 편이 정확합니다.

> 실측 noise를 training에 포함해 robustness를 얻으려 한 초기 Sim2Real 연구이며, 이후 domain randomization으로 이어지는 중요한 문제의식을 보여준다.

4.3절의 noise envelope과 마찬가지로, 현대 randomization range도 "많이 넣는 옵션"이 아닙니다. 어떤 parameter를 어느 범위로 흔들 것인지는 real deployment condition에 대한 가설이며, 실제 hardware 데이터로 계속 수정해야 합니다.

### **5.3 현대 로봇에서는 correspondence를 어떻게 볼 것인가?**

Correspondence는 모든 robot에 공통인 단일 점수가 아닙니다. 같은 command와 유사한 초기 조건에서 simulation과 hardware의 **behavior trace를 어떤 축으로 비교할 것인지**를 task에 맞게 정해야 합니다.

Legged locomotion이라면 다음과 같은 값이 후보가 될 수 있습니다.

| Correspondence 축 | 의미 |
|---|---|
| gait timing | swing/stance phase가 비슷하게 유지되는가 |
| body attitude | roll/pitch/yaw가 simulation과 비슷한가 |
| command response | 같은 command에 비슷한 velocity가 나오는가 |
| actuator load | torque/current가 비현실적으로 커지지 않는가 |
| disturbance response | 작은 perturbation에 비슷하게 복구되는가 |

각 값을 한 시점에서 정확히 일치시키는 것이 목표는 아닙니다. 평균, 분산, transient response, failure mode를 함께 비교해 simulation과 real robot의 동작 구조가 얼마나 같은지 확인해야 합니다. 최종 기준은 simulation reward가 아니라 real behavior입니다.

## **6. 이 논문의 한계**

이 논문은 Sim2Real의 기본 질문을 잘 보여주지만, 현대 legged robot RL 논문과는 차이가 큽니다.

첫째, task와 robot이 작습니다.

Khepera는 wheeled robot이고, task도 obstacle avoidance와 light seeking입니다. Quadruped locomotion처럼 contact-rich하고 high-dimensional한 control 문제를 다루지는 않습니다.

둘째, controller와 training 방식이 modern RL과 다릅니다.

논문은 recurrent dynamical neural network controller를 evolutionary method로 학습합니다. PPO, actor-critic, value function, policy gradient 같은 현대 deep RL 구조를 다루지는 않습니다.

셋째, noise model은 단순하고 사람이 정합니다.

Observed noise는 대략적인 Gaussian distribution이며 sensor별 noise profile과 sensor 간 차이도 모델링하지 않았습니다. 어떤 uncertainty를 어떤 distribution으로 넣어야 하는지 자동으로 찾는 방법도 제안하지 않습니다.

넷째, correspondence 평가가 주관적입니다.

각 controller의 behavior quality와 sim-real correspondence를 저자들이 10점 척도로 평가했습니다. 조건당 표본은 5개이며 객관적 trajectory distance, confidence interval, statistical test가 없습니다.

다섯째, 복잡한 contact dynamics를 다루지 않습니다.

Khepera의 stepper motor와 평면 differential drive는 비교적 정확하게 모델링하기 쉬운 편입니다. 저자들도 sensor coupling이 복잡해지면 같은 접근이 빠르게 어려워질 수 있으며, 당시에는 더 복잡한 문제에 real-world evolution이 여전히 필요하다고 결론 내렸습니다.

그래서 이 글을 읽을 때는 "이 논문을 그대로 quadruped locomotion에 적용하자"가 아니라, 다음 원리를 가져가는 것이 좋습니다.

> Real transfer를 목표로 한다면, clean simulator에서만 좋은 controller를 믿으면 안 된다.

## **7. Reality Gap에서 Domain Randomization으로**

이 논문에서 reality gap은 parameter 몇 개가 틀린 상태보다 넓은 개념입니다. Simulation에서 얻은 behavior가 real robot에서 재현되지 않으면 transfer에 실패한 것입니다. 이를 줄이기 위해 저자들은 측정 가능한 dynamics를 먼저 모델링하고, 남은 uncertainty를 noise로 다뤘습니다.

Zero-noise controller는 완벽한 반복성을, double-noise controller는 현실에 없는 jitter를 shortcut으로 이용했습니다. Observed noise의 평균 결과가 가장 좋았지만 조건당 controller가 5개뿐이고 평가도 주관적이었으므로, 이를 현대 domain randomization의 보편 법칙으로 확대할 수는 없습니다. 대신 아래 질문은 그대로 남습니다.

> Simulation이 틀릴 수밖에 없다면, 어떤 차이는 모델링하고 어떤 차이는 training distribution으로 감쌀 것인가?

다음 글인 **[Domain Randomization](/posts/domain-randomization/)**은 같은 질문을 sensor·motor noise에서 visual appearance의 distribution으로 옮깁니다.

## **참고 자료**

- [Jakobi, Husbands, Harvey, "Noise and The Reality Gap" PDF](https://cse-robotics.engr.tamu.edu/dshell/cs689/papers/jakobi95noise.pdf)
- [Springer DOI: 10.1007/3-540-59496-5_337](https://doi.org/10.1007/3-540-59496-5_337)
- [ECAL 1995 bibliographic record](https://dblp.org/rec/conf/ecal/JacobiHH95)
