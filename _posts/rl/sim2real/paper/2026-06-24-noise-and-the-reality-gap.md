---
title: "[Sim2Real Paper 1] Noise and The Reality Gap"
date: 2026-01-14 12:45:00 +0900
last_modified_at: 2026-01-14 12:45:00 +0900
categories: [RL, Sim2Real, Paper]
tags: [sim2real, reality-gap, robot-simulation, noise, evolutionary-robotics, robust-control, khepera]
description: Jakobi et al.의 1995년 논문을 바탕으로 실측 기반 Khepera simulator, 세 가지 noise 조건, simulation-real trajectory correspondence, envelope-of-noise 가설과 현대 domain randomization과의 차이를 정리한다.
math: true
image:
  path: /assets/img/posts/rl/sim2real/noise-reality-gap/00-preview.png
  alt: 세 가지 simulation noise 조건에서 진화한 Khepera obstacle-avoidance trajectory 비교
---

## **0. 전체 그림: Simulation은 왜 현실과 달라지는가**

Sim2Real을 공부하면서 가장 먼저 걸린 말은 **Reality Gap**이었다.

Simulation 쪽은 편하다. 빠르고 안전하고 reset도 쉽다. 문제는 그 편안함에 맞춰 controller가 학습된다는 것.

실제 로봇으로 옮기는 순간 변수가 더 붙는다:

```text
같은 action에도 조금씩 달라지는 actuator response
sensor에 섞이는 noise
매번 똑같지 않은 friction과 contact
통신·계산 과정에서 생기는 delay
```

Simulation의 정확한 반복성에 기대어 만든 전략이라면, 이 작은 차이만으로도 behavior 전체가 무너질 수 있다.

> **Reality Gap**이란?
>
> Simulation에서 학습하거나 검증한 controller가 실제 robot에서 같은 behavior와 성능을 재현하지 못하는 차이.

Jakobi, Husbands, Harvey의 **Noise and The Reality Gap: The Use of Simulation in Evolutionary Robotics**는 이 문제를 아주 일찍 정면으로 다룬 논문이다.

1995년의 evolutionary robotics와 지금의 PPO, GPU parallel simulation, quadruped locomotion은 방법부터 다르다. 그래도 질문 하나는 그대로 남았다.

> Simulation을 현실과 완전히 같게 만들 수 없다면, 우리는 simulation을 어떻게 써야 하는가?

제목만 보면 `simulation에 noise를 많이 넣자`는 이야기처럼 보인다. 실제 절차는 반대에 가깝다.

```text
1. 측정 가능한 sensor·motor dynamics부터 실제 robot 데이터에 맞춤
2. 그래도 남는 stochastic variation만 실측 크기의 noise로 추가
3. simulation score가 아니라 real trajectory와의 correspondence까지 비교
```

Underlying model이 틀리면 noise가 그 차이를 메워 주지 못했다. 반대로 현실보다 큰 noise도 transfer를 해쳤다. 결국 논문의 초점은 noise의 양보다 **어디까지 모델링하고, 무엇을 uncertainty로 남길 것인가**에 있었다.

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

지금 기준으로는 작은 실험이다. 사족보행도 아니고 modern deep RL도 아니다. 그래도 확인하려던 대상은 지금의 Sim2Real과 같다.

> Simulation에서 얻은 behavior가 real robot에서도 같은 behavior로 나오는가?

## **2. 실측 모델 위에 현실적인 noise를 넣기**

여기서 등장한 개념이 **envelope of noise**다.

완벽한 simulator? 현실적으로 어렵다. Robot-environment interaction이 복잡해질수록 sensor, actuator, contact, material property를 전부 정확히 맞추기 힘들어진다.

논문이 택한 방법:

> 실측한 model을 기준으로 두고, 그 주변을 현실적인 noise 범위로 감싼다.

> **Envelope of noise**란?
>
> 실제 robot에서 생기는 불확실성을 simulation 안의 일정 범위로 옮겨, controller가 깨끗한 simulation 하나에만 맞춰지지 않게 만드는 방법.

Noise의 역할은 난이도 상승이 아니다. **Real world에서 피할 수 없는 불확실성을 training distribution 안으로 옮기는 장치**에 가깝다.

조금씩 흔들리는 simulation을 계속 경험하면 정확한 반복성만 이용하는 strategy는 살아남기 어렵다. 대신 perturbation 아래에서도 유지되는 feedback strategy 쪽에 압력이 걸린다.

여기서 순서가 중요했다. 저자들은 실제 Khepera의 sensor·motor 데이터를 먼저 모아 underlying interaction을 맞췄다. Noise는 부정확한 toy simulator를 덮는 핑계가 아니라, **모델링 후에도 남는 stochastic variation**을 표현하는 쪽이었다.

### **2.1 무엇을 얼마나 자세히 모델링했는가?**

Khepera는 지름 5.8 cm, 높이 3.0 cm의 차동구동 robot. 전방 6개와 후방 2개, 총 8개의 active IR proximity sensor를 쓰고 같은 receiver를 ambient-light sensor로도 사용했다.

Simulator도 단순 lookup table이 아니었다. 2차원 공간에서 연속적으로 움직이는 수학 model 쪽에 가까웠다.

| 구성 요소 | 논문의 모델링 방식 |
|---|---|
| Control/update 주기 | neural network 입출력과 simulator를 100 ms마다 갱신 |
| Wheel/motor | 실제 speed·position 응답을 측정하고 PID dynamics와 static friction을 모델링 |
| PID 계수 | 실제 robot과 같은 $K_p=3800$, $K_i=800$, $K_d=100$ 사용 |
| IR proximity | sensor마다 180도 범위의 ray 10개를 쏘고 거리·입사각으로 반사 강도 계산 |
| Ambient light | 직접광과 2차 반사를 ray tracing으로 계산 |
| Lamp | 60 W desk lamp를 밝기가 다른 5개 point source로 근사 |
| Parameter 설정 | 실제 sensor·motor 실험값에 curve fitting하여 상수와 mapping 결정 |

이 정도로 underlying model을 만든 뒤에 noise가 들어갔다.

> **High fidelity와 robustness는 대체 관계가 아니다.**
>
> 측정 가능한 dynamics는 가능한 한 모델링하고, 정확히 고정하기 어려운 variation은 noise로 다룬다.

### **2.2 두 task는 무엇이 달랐는가?**

![Obstacle avoidance와 light seeking 실험 환경](/assets/img/posts/rl/sim2real/noise-reality-gap/01-task-environments.png){: width="1050" .d-block .mx-auto }
_Obstacle avoidance는 50 cm 정사각형 arena와 반지름 4 cm의 cylinder 네 개를 사용했다. Light seeking은 110 cm x 70 cm arena 한쪽에 60 W lamp를 두었다. 출처: [Jakobi et al., Figures 1-2](https://cse-robotics.engr.tamu.edu/dshell/cs689/papers/jakobi95noise.pdf)._

같은 robot을 썼지만 제어 시간 척도는 달랐다.

- **Obstacle avoidance**: 가까운 obstacle을 감지한 직후 방향 전환. 작은 sensor·motor 차이도 충돌 여부를 바꾸는 빠른 closed-loop task.
- **Light seeking**: arena 반대편에서 lamp 쪽으로 이동. 천천히 휘어지는 경로도 성공할 수 있어 상대적으로 부드러운 fitness landscape.

같은 noise라도 task dynamics에 따라 영향이 달라질 수밖에 없는 구성이다.

### **2.3 Controller는 강화학습으로 학습한 것이 아니다**

PPO나 SAC는 나오지 않는다. Controller는 arbitrary recurrent dynamical neural network, 학습은 distributed genetic algorithm을 이용한 구조·parameter evolution.

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

최적화기는 달라도 transfer 문제의 구조는 같다.

| Controller가 이용한 규칙 | 배포 결과 |
|---|---|
| Real robot에도 성립하는 규칙 | simulation의 behavior가 현실로 transfer될 수 있음 |
| Simulator에만 성립하는 규칙 | simulation score는 높아도 reality-gap failure가 발생 |

### **2.4 Evolution은 무엇을 최적화했는가?**

Obstacle avoidance의 목표는 빠른 전진과 한쪽으로 치우치지 않는 회전. Fitness는 아래 식이었다.

$$
F_{\mathrm{avoid}}
=
V\left(1-\sqrt{D}\right)
$$

- $V$: 각 time step에서 두 wheel speed를 합산하고 정규화한 값
- $D$: 좌우 wheel-speed 차이의 signed sum에 절댓값을 취한 값

선행 연구에 있던 proximity penalty는 빠졌다. Arena가 충분히 복잡하니 오래, 빠르게 움직이려면 obstacle avoidance가 암묵적으로 필요하다는 판단이었다. Reward가 behavior를 직접 명령하지 않고 우회적으로 규정한 사례이기도 하다.

Light seeking은 매 time step의 lamp 거리 $D_i$를 사용했다.

$$
F_{\mathrm{light}}
=
\frac{1}{\sum_{i=1}^{n}D_i^2}
$$

Lamp 가까이에 오래 머물수록 커지는 fitness. 두 task 모두 simulation에서만 evolution을 돌렸고 real robot에서는 추가 학습이 없었다.

### **2.5 세 가지 noise 조건**

두 task에 적용한 noise 조건은 세 가지. 각 조건에서 5회의 evolutionary run을 돌린 뒤 controller를 실제 Khepera에 올려 trajectory를 비교했다.

| 조건 | 의미 |
|---|---|
| zero noise | 측정된 stochastic variation을 추가하지 않음 |
| observed noise | 실제 실험에서 구한 표준편차를 갖는 대략적인 Gaussian noise |
| double noise | 같은 분포에서 표준편차만 2배 |

`observed noise`를 정교한 sensor noise model로 보면 안 된다. Sensor 간 차이나 개별 profile 대신 실측 크기에 맞춘 단순 분포를 썼다. 저자도 envelope-of-noise 가설의 증거를 **inconclusive**, 즉 결정적이지 않다고 표현했다.

저자들의 주관적 점수를 평균내면 observed-noise 조건이 두 task 모두 가장 높았다.

| Task | Noise | Behavior quality | Sim-real correspondence |
|---|---|---:|---:|
| Obstacle avoidance | Zero | 4.0 | 6.2 |
| Obstacle avoidance | Observed | **6.0** | **8.0** |
| Obstacle avoidance | Double | 4.8 | 6.8 |
| Light seeking | Zero | 6.4 | 5.6 |
| Light seeking | Observed | **6.8** | **7.8** |
| Light seeking | Double | 5.8 | 5.4 |

두 점수의 의미:

- `Behavior quality`: simulation에서 반복했을 때 strategy의 optimality와 robustness
- `Correspondence`: simulation과 real trajectory의 유사성

둘 다 최대 10점인 **저자들의 주관적 평가**다. 조건마다 controller는 5개뿐이고 confidence interval이나 통계 검정도 없다. 숫자의 순위는 흥미로운 관찰이지 강한 정량적 증명은 아니다.

> 이 실험에서는 현실과 비슷한 크기의 noise가 가장 높은 평균 점수를 보였다. 그러나 noise가 많을수록 transfer가 좋아진다는 뜻은 아니다.

읽을 때 남겨야 할 부분은 noise의 양보다 **real variation을 어느 범위까지 감쌀 것인가**다.

## **3. Trajectory로 읽는 실제 결과**

평균 점수에서는 observed noise가 좋아 보인다. Trajectory에서 더 흥미로운 부분: 각 controller가 simulation의 어떤 규칙을 이용했는가.

### **3.1 Obstacle avoidance: 정확한 90도 회전이라는 편법**

![Obstacle avoidance의 simulation-real trajectory 비교](/assets/img/posts/rl/sim2real/noise-reality-gap/02-obstacle-sim-real-trajectories.png){: width="1200" .d-block .mx-auto }
_열은 zero, observed, double noise에서 선택한 controller다. 위는 실제 Khepera, 아래는 simulation trajectory이며 흰색 또는 검은색 tail이 이동 경로와 방향을 나타낸다. 출처: [Jakobi et al., Figure 3](https://cse-robotics.engr.tamu.edu/dshell/cs689/papers/jakobi95noise.pdf)._

Zero-noise controller 하나가 찾은 답: obstacle을 만날 때마다 **정확히 90도 회전**. Deterministic simulator에서는 같은 상황에 같은 반응이 돌아오니 arena 외곽을 계속 순환할 수 있었다.

실제 robot에서는 같은 회전이 두 번 완전히 같지 않았다. 몇 도씩 쌓인 오차가 steady cycle을 깨뜨렸고, 한쪽을 제대로 보지 못하던 controller는 결국 obstacle과 충돌했다.

| 환경 | 같은 상황에서의 반응 | 결과 |
|---|---|---|
| Zero-noise simulator | 매번 거의 같은 90도 회전 | 안정적인 주기 궤도를 유지 |
| Real robot | 회전각에 작은 오차가 발생 | 오차가 누적되어 주기 궤도가 붕괴 |

지금 표현으로는 **simulator exploit**에 가깝다. Task 구조보다 simulator의 과도한 반복성을 이용한 strategy.

Observed-noise에서는 실행할 때마다 sensor·motor 결과가 조금씩 달랐다. 정확한 주기 궤도에 의존하기 어려워지고 local feedback을 쓰는 strategy 쪽이 살아남기 쉬워진 셈이다. Real trajectory와의 correspondence도 평균적으로 더 높았다.

### **3.2 Light seeking: noise가 너무 많아도 편법이 생긴다**

![Light seeking의 simulation-real trajectory 비교](/assets/img/posts/rl/sim2real/noise-reality-gap/03-light-seeking-sim-real-trajectories.png){: width="1200" .d-block .mx-auto }
_세 noise 조건에서 선택한 light-seeking controller의 실제 trajectory(위)와 simulation trajectory(아래). 출처: [Jakobi et al., Figure 5](https://cse-robotics.engr.tamu.edu/dshell/cs689/papers/jakobi95noise.pdf)._

Double-noise에서는 반대 문제가 나왔다. 한 controller는 좌우 light sensor가 반대쪽 wheel을 구동하는 Braitenberg식 coupling을 사용했다. 큰 noise가 robot을 계속 좌우로 흔들어 정지 상태에서 빠져나오게 했고, 그 흔들림 덕분에 lamp 쪽으로 전진했다.

그런데 real robot의 noise는 그만큼 크지 않았다. 움직임의 출발점으로 쓰던 jitter가 사라지자 simulation behavior도 함께 사라졌다.

> **너무 적은 noise뿐 아니라 너무 많은 noise도 simulation-only strategy를 만든다.**

Double noise가 한 일은 단순한 난이도 상승이 아니었다. 현실에 없는 stochastic dynamics를 만들었고 evolution은 다시 그 틈을 이용했다.

### **3.3 Observed noise가 최고였다는 결과를 어디까지 믿어야 하는가?**

두 task 모두 observed noise의 평균 score가 가장 높았다. 다만 저자도 **robust behavior와 correspondence의 최고 noise level이 우연히 같았을 수 있다**고 적어 두었다.

한 fitness evaluation은 trial 두 개의 평균뿐이었다. Stochastic fitness의 분산을 줄이기에는 부족한 수. Zero noise에서는 초기 조건에 따라 성공과 실패가 갈리는 brittle strategy, double noise에서는 같은 genotype도 evaluation마다 크게 흔들리는 score가 문제였다. Observed noise가 비용 대비 가장 좋은 균형처럼 보였지만, 일반 법칙으로 올리기에는 실험 규모와 평가 방식이 약하다.

## **4. 현대 RL 관점에서 다시 쓰기**

> 이 절의 MDP 수식은 1995년 원문 표기가 아니라, 논문의 아이디어를 현대 reinforcement-learning 언어로 다시 쓴 것.

단순히 `simulation에 noise를 넣었다`로 끝내면 놓치는 부분이 많다. 더 가까운 해석은 **하나의 깨끗한 transition에 과적합된 controller를 transition distribution 쪽으로 옮기는 과정**.

### **4.1 Clean simulation은 하나의 좁은 MDP다**

RL 표기로 옮기면 simulation environment 하나는 하나의 MDP:

$$
\mathcal{M}_{\mathrm{sim}}
= (\mathcal{S}, \mathcal{A}, P_{\mathrm{sim}}, R_{\mathrm{sim}}, \gamma)
$$

여기서 $P_{\mathrm{sim}}(s_{t+1} \mid s_t, a_t)$는 state와 action을 다음 state로 연결하는 simulation transition.

하지만 real robot의 transition은 같지 않다.

$$
P_{\mathrm{real}}(s_{t+1} \mid s_t, a_t)
\neq
P_{\mathrm{sim}}(s_{t+1} \mid s_t, a_t)
$$

Naive simulation이 주는 것은 좁고 고정된 transition. 깨끗한 sensor, 명령을 거의 정확히 따르는 actuator, 단순화된 contact.

Controller가 맞추는 objective도 결국 simulation 안의 성능:

$$
\max_{\pi} J(\pi; \mathcal{M}_{\mathrm{sim}})
$$

원하는 대상은 sim return이 아니라 real robot에서 버티는 controller.

$$
\max_{\pi} J(\pi; \mathcal{M}_{\mathrm{real}})
$$

두 transition이 다르면 높은 sim return이 real return으로 이어질 근거도 없다. 바로 이 틈이 reality gap.

### **4.2 Noise는 transition distribution을 넓힌다**

Noise injection을 MDP 관점에서 읽으면 deterministic world 하나를 possible world의 distribution으로 넓히는 작업에 가깝다.

Parameterized simulator 표기:

$$
\mathcal{M}_{\xi}
= (\mathcal{S}, \mathcal{A}, P_{\xi}, R_{\xi}, \gamma),
\quad
\xi \sim p(\xi)
$$

여기서 $\xi$가 나타내는 것은 sensor·motor의 stochastic variation. Mass나 friction을 episode마다 바꾸지는 않았으므로 현대 dynamics-randomization parameter 전체와 같은 변수는 아니다.

Training objective도 바뀐다. Simulator 한 점의 optimum이 아니라 noise distribution 위의 평균 return:

$$
\max_{\pi}
\mathbb{E}_{\xi \sim p(\xi)}
\left[
J(\pi; \mathcal{M}_{\xi})
\right]
$$

이때 envelope of noise는 $p(\xi)$의 support를 정하는 문제. 어떤 uncertainty를 포함할지, 각 축을 어느 범위까지 흔들지가 설계 대상.

### **4.3 Noise envelope은 coverage 문제다**

Noise envelope의 성격: 넓을수록 좋은 hyperparameter가 아니라 **coverage와 realism 사이의 설계 변수**.

| Noise envelope | Training에서 생기는 일 | 예상되는 transfer 문제 |
|---|---|---|
| 너무 좁음 | clean하고 제한된 case만 경험 | 실제 perturbation이 training support 밖으로 벗어남 |
| 실측 범위와 비슷함 | 현실적인 variation 안에서 반복 학습 | simulator shortcut에 대한 의존을 줄일 가능성이 있음 |
| 너무 넓음 | 현실에 없는 perturbation까지 견뎌야 함 | task signal이 흐려지거나 비현실적 noise를 이용할 수 있음 |

따라서 결론도 `noise를 많이 넣자`와는 거리가 멀다.

> Real robot에서 실제로 생기는 variation을 덮을 만큼은 넓고, task structure를 잃을 만큼은 넓지 않은 noise envelope이 필요하다.

현대 Sim2Real의 randomization range 문제와 바로 이어지는 지점.

### **4.4 적절한 noise는 simulator shortcut을 불안정하게 만든다**

Clean simulation이 열어 두는 위험: 현실에서는 성립하지 않는 shortcut.

Zero-noise obstacle controller의 정확한 90도 회전이 첫 번째 사례. 현실보다 큰 jitter를 locomotion mechanism처럼 쓴 double-noise light seeker가 두 번째 사례.

둘 다 simulation score는 높일 수 있었다. Real robot의 작은 noise나 delay 앞에서는 쉽게 붕괴.

현실적인 noise를 넣는 이유도 여기에 있다. 깨끗한 trajectory 하나에만 의존하는 shortcut을 불안정하게 만들기. 여러 perturbation 아래에서도 남는 feature와 behavior 쪽으로 policy를 밀기.

현대적인 표현으로는 simulation-specific feature에 대한 overfitting 억제와 invariant behavior에 대한 압력. 단, 3.2절의 double-noise처럼 **현실과 맞지 않는 noise는 또 다른 shortcut의 재료**가 될 수 있다.

### **4.5 Correspondence는 reward와 다르다**

또 하나 눈에 들어온 부분은 평가 기준이었다. Simulation score만으로 transfer를 판단하지 않았다는 점.

높은 sim reward와 real behavior 재현은 다른 문제.

논문이 별도로 확인한 값: simulation behavior와 real behavior의 correspondence.

$$
\text{high sim reward}
\not\Rightarrow
\text{high real correspondence}
$$

Sim2Real에서 같이 봐야 할 것: policy performance와 behavior correspondence. 이후 domain randomization, dynamics randomization, actuator model 논문에서도 계속 반복되는 기준이다.

## **5. 현대 Sim2Real과 연결하기**

작은 Khepera와 evolutionary controller를 다룬 논문이지만, 이후 Sim2Real 연구의 출발점은 이미 보인다.

> Real world를 정확히 복제할 수 없다면, real world에서 생기는 불확실성을 training distribution 안에 넣어야 한다.

### **5.1 Simulation fidelity와 robustness는 같이 봐야 한다**

Sim2Real의 두 축:

| 축 | 대표 방법 | 역할 |
|---|---|---|
| Simulation fidelity | system identification, actuator modeling, contact fitting, sensor calibration | nominal simulator와 real robot 사이의 구조적 차이를 줄임 |
| Controller robustness | noise injection, domain randomization, external perturbation | 모델링 후에도 남는 uncertainty에 controller가 버티도록 함 |

논문도 두 방향을 함께 썼다. Motor·sensor response는 실측값으로 맞추고, 그 주변의 stochastic variation은 noise로 추가. Fidelity와 robustness의 역할 분담이다.

### **5.2 Noise injection과 domain randomization은 같은가?**

현대 Sim2Real에서는 `noise`보다 `randomization`이라는 표현이 더 자주 나온다. 이어지는 문제의식, 달라진 구현:

| 구분 | Jakobi et al., 1995 | 현대 domain/dynamics randomization |
|---|---|---|
| 주된 변화 | 매 step의 sensor·motor stochastic noise | episode 또는 step마다 물리·시각 parameter 변화 |
| 기준 simulator | 실측값으로 맞춘 하나의 Khepera model | nominal model 또는 system identification 결과 |
| 예시 | 실제 표준편차의 0배, 1배, 2배 | mass, friction, latency, motor strength, terrain, texture |
| 목표 | 현실의 stochastic behavior와 correspondence | real domain이 training-domain distribution 안에 포함되도록 함 |

공통점은 깨끗한 simulator 하나에 대한 과적합을 줄인다는 것.

그렇다고 이 논문을 **domain randomization 그 자체**라고 부르기는 어렵다. 관계는 아래 정도가 적당하다.

> 실측 noise를 training에 포함해 robustness를 얻으려 한 초기 Sim2Real 연구이며, 이후 domain randomization으로 이어지는 중요한 문제의식을 보여준다.

현대 randomization range도 `많이 넣는 옵션`은 아니다. 어떤 parameter를 어느 범위로 흔들지에 대한 deployment hypothesis. 결국 hardware data로 계속 수정할 값.

### **5.3 현대 로봇에서는 correspondence를 어떻게 볼 것인가?**

Correspondence도 모든 robot에 공통인 단일 score가 아니다. 같은 command와 유사한 초기 조건에서 **behavior trace의 어느 축을 비교할 것인가**가 먼저다.

Legged locomotion에서 볼 만한 축:

| Correspondence 축 | 의미 |
|---|---|
| gait timing | swing/stance phase가 비슷하게 유지되는가 |
| body attitude | roll/pitch/yaw가 simulation과 비슷한가 |
| command response | 같은 command에 비슷한 velocity가 나오는가 |
| actuator load | torque/current가 비현실적으로 커지지 않는가 |
| disturbance response | 작은 perturbation에 비슷하게 복구되는가 |

한 시점의 exact match보다 평균, 분산, transient response, failure mode의 구조가 중요하다. 마지막 기준은 simulation reward가 아니라 real behavior.

## **6. 이 논문의 한계**

현대 legged robot RL로 가져오기 전에 남는 제한도 분명하다.

1. **작은 task와 robot**
   Khepera는 wheeled robot이고 task도 obstacle avoidance와 light seeking. Quadruped locomotion 같은 contact-rich, high-dimensional control과는 거리가 있다.

2. **Modern RL과 다른 controller·training**
   Recurrent dynamical neural network와 evolutionary method의 조합. PPO, actor-critic, value function, policy gradient는 범위 밖이다.

3. **사람이 정한 단순 noise model**
   대략적인 Gaussian distribution을 사용했고 sensor별 profile이나 sensor 간 차이는 생략. 어떤 uncertainty와 distribution이 필요한지 자동으로 찾는 방법도 없다.

4. **주관적인 correspondence 평가**
   저자들의 10점 척도, 조건당 표본 5개. 객관적 trajectory distance, confidence interval, statistical test는 없음.

5. **복잡한 contact dynamics의 부재**
   Stepper motor와 평면 differential drive는 상대적으로 모델링하기 쉬운 편. 저자도 sensor coupling이 복잡해지면 같은 접근이 빠르게 어려워질 수 있다고 봤다.

Quadruped locomotion에 그대로 복사할 논문이라기보다 아래 원리를 남긴 초기 사례.

> Real transfer를 목표로 한다면, clean simulator에서만 좋은 controller를 믿으면 안 된다.

## **7. Reality Gap에서 Domain Randomization으로**

이 논문에서 reality gap은 parameter 몇 개의 오차보다 넓다. Simulation behavior가 real robot에서 재현되지 않는 상태 전체를 가리킨다. 대응 방식은 측정 가능한 dynamics의 모델링과 남은 uncertainty의 noise 처리.

Zero-noise controller는 완벽한 반복성을, double-noise controller는 현실에 없는 jitter를 shortcut으로 썼다. Observed noise의 평균 결과가 가장 좋았지만 표본과 평가 방식은 약했다. 보편 법칙보다 아래 질문을 남긴 결과.

> Simulation이 틀릴 수밖에 없다면, 어떤 차이는 모델링하고 어떤 차이는 training distribution으로 감쌀 것인가?

다음 글인 **[Domain Randomization](/posts/domain-randomization/)**에서는 같은 질문이 sensor·motor noise에서 visual appearance distribution으로 이동한다.

## **참고 자료**

- [Jakobi, Husbands, Harvey, "Noise and The Reality Gap" PDF](https://cse-robotics.engr.tamu.edu/dshell/cs689/papers/jakobi95noise.pdf)
- [Springer DOI: 10.1007/3-540-59496-5_337](https://doi.org/10.1007/3-540-59496-5_337)
- [ECAL 1995 bibliographic record](https://dblp.org/rec/conf/ecal/JacobiHH95)
