---
title: "CSD: 방향뿐 아니라 이동 크기까지 맞추는 스킬 발견"
date: 2026-07-24 21:34:41 +0900
last_modified_at: 2026-07-27 22:47:54 +0900
categories: [RL, Study]
tags: [csd, constrained-skill-discovery, lsd, metra, unsupervised-reinforcement-learning, skill-discovery, quadruped-locomotion, ppo, representation-learning, zero-shot-control, anymal]
description: "CSD가 LSD와 METRA의 latent transition maximization을 norm matching으로 바꾸고, 방향과 속도를 함께 제어하는 연속 스킬 공간과 zero-shot goal tracking을 만드는 과정을 정리한다."
math: true
image:
  path: /assets/img/posts/rl/csd/00-csd-preview.png
  alt: 방향과 이동 크기를 함께 맞추는 Constrained Skill Discovery
---

이전 [LSD 글](/posts/lsd-lipschitz-constrained-skill-discovery/)과 [METRA 글](/posts/metra-metric-aware-abstraction/)에서는 다음 아이디어를 봤다.

> State transition을 latent space의 여러 방향으로 최대한 크게 만들면, 멀리 도달하는 다양한 skill을 발견할 수 있다.

이 목적은 exploration에는 강하다. 하지만 로봇 locomotion에서는 문제가 생긴다. 거의 모든 skill이 서로 다른 방향으로 **최대한 빠르게** 움직이려 한다. Skill vector $z$의 크기를 줄여도 reward 크기만 작아질 뿐, 로봇에게 "조금만 움직여라"라는 명령이 되지는 않는다.

**CSD, Constrained Skill Discovery**는 이 한 항을 바꾼다.

> Latent transition을 무조건 키우지 말고, 주어진 skill vector의 방향과 크기에 맞춰라.

이 변화로 $z$의 각도는 이동 방향, $\lVert z\rVert$은 latent transition의 크기를 나타낼 수 있다. 작은 $z$는 느린 이동이나 정지에 가까운 행동으로 연결되고, 큰 $z$는 빠른 이동으로 연결된다.

> **CSD는 "어느 방향으로 멀리 갈 것인가"를 학습하던 LSD/METRA 목적을 "어느 방향으로 얼마나 갈 것인가"를 학습하는 norm-matching 문제로 바꾼다.**

## 0. 먼저 결과부터 보기

![CSD와 LSD, METRA의 실제 XY trajectory 비교](/assets/img/posts/rl/csd/01-paper-skill-trajectories.png){: width="1120" .d-block .mx-auto }

_왼쪽의 꽃잎 모양이 샘플링한 2-D skill. LSD와 METRA는 skill 크기와 무관하게 바깥 경계까지 이동하는 경향이 강하다. CSD는 같은 방향에서도 짧은 trajectory와 긴 trajectory를 함께 만든다. 출처: [Atanassov et al., Figure 1](https://arxiv.org/abs/2410.07877)._

그림에서는 coverage의 최대 반지름보다 trajectory 길이의 분포를 봐야 한다.

- LSD와 METRA는 여러 방향으로 멀리 간다.
- CSD는 여러 방향뿐 아니라 **여러 이동 크기**를 채운다.
- 원점 근처의 짧은 trajectory도 학습되므로 저속 이동과 정지가 가능해진다.

즉 CSD의 목표는 단순한 "더 넓은 exploration"보다 **조작 가능한 locomotion skill manifold**에 가깝다.

## 1. 논문 정보

| 항목 | 내용 |
|---|---|
| Title | Constrained Skill Discovery: Quadruped Locomotion with Unsupervised Reinforcement Learning |
| Authors | Vassil Atanassov, Wanming Yu, Alexander Luis Mitchell, Mark Nicholas Finean, Ioannis Havoutis |
| 공개 상태 | arXiv preprint, ICLR 2025 submission |
| Robot | ANYmal quadruped |
| Policy | $\pi_\theta(a\mid s,z)$ |
| Encoder | $\phi:\mathcal S\rightarrow\mathcal Z$ |
| Skill space | 주 실험은 2-D continuous disk, 추가 실험은 3-D |
| Policy optimizer | PPO |
| Encoder optimizer | Adam, Smooth L1 loss |
| 핵심 변화 | Latent transition maximization $\rightarrow$ norm matching |
| Downstream demo | 추가 학습 없는 Cartesian goal tracking |
| Source | [arXiv](https://arxiv.org/abs/2410.07877), [OpenReview](https://openreview.net/forum?id=tdfHABLdxR) |

현재 공개된 OpenReview 페이지의 표기는 **ICLR 2025에 제출된 논문**. 따라서 이 글에서는 ICLR 2025 accepted paper라고 쓰지 않는다.

그리고 이름의 `Constrained`를 먼저 분명히 해야 한다.

> 여기서 constraint는 안전 제약을 다루는 CMDP의 cost constraint가 아니다. Latent distance가 실제 state distance를 과장하지 못하게 하는 **Lipschitz distance constraint**다.

## 2. LSD와 METRA에서는 왜 작은 z도 빨라지는가?

LSD와 METRA의 policy reward는 핵심적으로 다음 내적 형태.

$$
r_t^{\text{LSD/METRA}}
=
\left(
\phi(s_{t+1})-\phi(s_t)
\right)^\top z
$$

여기서

$$
\Delta\phi_t
=
\phi(s_{t+1})-\phi(s_t)
$$

라고 두면 reward는 $\Delta\phi_t^\top z$. 내적은 다음 두 가지에 의해 커진다.

$$
\Delta\phi_t^\top z
=
\lVert\Delta\phi_t\rVert
\lVert z\rVert
\cos\theta
$$

1. $\Delta\phi_t$와 $z$의 방향을 맞춘다.
2. $\lVert\Delta\phi_t\rVert$을 크게 만든다.

![LSD와 METRA의 projection maximization, CSD의 norm matching 비교](/assets/img/posts/rl/csd/02-objective-comparison.svg){: width="1200" .d-block .mx-auto }

### 2.1 z를 작게 만들면 해결되지 않는 이유

$z$가 작아지면 reward의 전체 scale은 작아진다. 하지만 같은 방향에서 후보 transition을 비교하면 여전히 큰 $\Delta\phi_t$가 유리하다.

예를 들어 $z=0.1$이고 방향이 완전히 같다고 하자.

$$
\Delta\phi_1^\top z = 1\times0.1=0.1
$$

$$
\Delta\phi_2^\top z = 10\times0.1=1.0
$$

두 번째 transition이 target보다 훨씬 커도 더 높은 reward를 받는다. 내적에는 "이 정도면 충분하다"는 정지점이 없다. Lipschitz constraint가 허용하는 범위까지 latent transition을 키우려 한다.

따라서 LSD와 METRA에서 $z$의 크기는 대체로 다음에 가깝다.

> 원하는 이동량이 아니라 reward scale.

이것이 서로 다른 방향은 잘 발견하면서도 대부분의 skill이 고속 이동으로 몰리는 이유다.

## 3. CSD는 전체 벡터를 맞춘다

CSD는 Gaussian regressive discriminator에서 나온 원래 MSE 형태를 유지한다.

$$
q_\phi(z\mid s_0,s_T)
=
\mathcal N
\left(
z;
\phi(s_T)-\phi(s_0),
I
\right)
$$

분산이 고정된 Gaussian의 log-likelihood를 최대화하는 것은 다음 제곱오차를 최소화하는 것과 같다.

$$
\mathcal L_{\text{episode}}
=
\frac12
\left\|
\left(
\phi(s_T)-\phi(s_0)
\right)-z
\right\|_2^2
$$

반대로 reward 관점에서는 음의 MSE를 최대화한다.

$$
J_{\text{CSD}}
=
-\frac12
\mathbb E
\left[
\left\|
\left(
\phi(s_T)-\phi(s_0)
\right)-z
\right\|_2^2
\right]
$$

이제 최적점은 명확하다.

$$
\phi(s_T)-\phi(s_0)=z
$$

Transition이 $z$보다 작아도 오차고, $z$보다 커도 오차. 방향뿐 아니라 norm까지 맞아야 한다.

### 3.1 MSE를 전개하면 무엇이 달라졌는가?

$$
\left\|\Delta\phi-z\right\|^2
=
\left\|\Delta\phi\right\|^2
-2\Delta\phi^\top z
+\left\|z\right\|^2
$$

LSD/METRA가 주로 가운데 alignment 항을 최대화한다면, CSD는 $\lVert\Delta\phi\rVert^2$ 항을 버리지 않는다. 이 항이 transition을 무한히 키우는 행동에 비용을 준다.

| 목적 | 방향 오류 | 너무 작은 transition | 너무 큰 transition |
|---|---:|---:|---:|
| Inner product maximization | 불리함 | 덜 유리함 | 계속 유리함 |
| Norm matching | 불리함 | 오차 | 오차 |

CSD는 새로운 거대한 모델을 추가하는 대신, 앞선 유도에서 버렸던 **quadratic term을 다시 살린다**.

## 4. 그런데 Lipschitz constraint는 왜 그대로 필요한가?

Encoder와 policy가 동시에 학습되면 둘이 쉬운 편법을 만들 수 있다. 실제 state는 거의 변하지 않았는데 encoder 출력만 크게 변하게 하면 skill matching이 되는 것처럼 보일 수 있다.

CSD는 다음 constraint를 둔다.

$$
\left\|
\phi(s')-\phi(s)
\right\|_2
\le
\left\|
s'-s
\right\|_2
$$

이 제약은 encoder가 실제 state 변화보다 더 큰 latent 변화를 만들어 내는 것을 막는다.

Skill matching과 결합하면 다음 관계가 생긴다.

$$
\Delta\phi\approx z
\quad\Rightarrow\quad
\lVert z\rVert
\approx
\lVert\Delta\phi\rVert
\le
\lVert\Delta s\rVert
$$

즉 큰 $z$를 맞추려면 실제 state도 충분히 변해야 한다.

다만 이 식을 다음처럼 읽으면 안 된다.

> $\lVert z\rVert=1$이면 로봇이 정확히 1 m 이동한다.

State vector에는 base position뿐 아니라 joint position, velocity, body orientation 등이 함께 들어간다. 따라서 $\lVert s^{\prime}-s\rVert$은 물리적 미터 거리와 동일하지 않다. 논문도 latent distance와 실제 traveled distance가 같은 크기라고 보장하지는 않는다고 명시한다.

정확한 해석은:

> $\lVert z\rVert$이 커질수록 더 큰 latent transition을 요구하고, 학습된 representation에서 이것이 대체로 더 큰 locomotion motion과 연결된다.

## 5. 에피소드 목적을 step reward로 바꾸기

원래 목표는 episode 전체 transition을 $z$에 맞추는 것.

$$
\phi(s_T)-\phi(s_0)\approx z
$$

하지만 PPO는 매 step의 reward가 필요하다. Episode가 $N$ step이라면 telescoping sum은:

$$
\phi(s_T)-\phi(s_0)
=
\sum_{t=0}^{N-1}
\left(
\phi(s_{t+1})-\phi(s_t)
\right)
$$

따라서 각 step에서 대략

$$
\phi(s_{t+1})-\phi(s_t)
\approx
\frac{z}{N}
$$

가 되도록 만들 수 있다. 논문의 per-step error는 이를 다음처럼 쓴다.

$$
e_t
=
\left\|
N
\left(
\phi(s_{t+1})-\phi(s_t)
\right)-z
\right\|_2^2
$$

![Episode skill을 per-step target과 reward로 바꾸는 과정](/assets/img/posts/rl/csd/03-stepwise-target.svg){: width="1200" .d-block .mx-auto }

Policy에 주는 intrinsic reward는 오차를 양의 유계값으로 바꾼 형태다.

$$
r_t^{\text{int}}
=
\frac{1}{1+\sigma e_t}
$$

- $e_t=0$이면 $r_t^{\text{int}}=1$
- 오차가 커질수록 reward는 0에 가까워진다.
- $\sigma$는 error scale을 조절한다.

논문 부록은 per-step loss의 합을 episodic loss의 upper bound로 설명한다. 중요한 점은 **원래 episode objective와 per-step objective가 완전히 같은 식은 아니라는 것**. 제곱노름과 여러 step의 합을 연결할 때 horizon-dependent scale이 개입할 수 있지만, 각 step에서 $\Delta\phi_t=z/N$을 만드는 target은 일관된다.

## 6. Encoder와 PPO는 어떻게 같이 학습되는가?

논문의 전체 학습 구조는 다음 그림처럼 encoder의 supervised learning과 policy의 reinforcement learning이 결합된 형태.

![CSD 논문의 encoder와 policy 학습 구조](/assets/img/posts/rl/csd/04-paper-training-loop.png){: width="1080" .d-block .mx-auto }

_Encoder는 state pair를 latent transition으로 바꾸고 skill $z$와의 오차를 줄인다. Policy는 그 오차로 만든 intrinsic reward와 locomotion regularization reward를 받는다. 출처: [Atanassov et al., Figure 2](https://arxiv.org/abs/2410.07877)._

### 6.1 Rollout에서 저장되는 것

각 environment는 episode 시작 시 continuous skill $z$를 샘플링한다.

~~~text
policy input:       robot observation + skill z
environment output: next state
encoder input:      current state and next state
training sample:    (s_t, z, a_t, s_{t+1}, done)
~~~

논문 주 실험의 skill은 반지름 50인 2-D 원 내부에서 uniform하게 샘플링한다. Episode는 300 step이므로 최대 skill의 step당 latent target은 대략 $50/300\approx0.17$이다.

### 6.2 같은 오차를 두 학습기가 다르게 사용한다

![Encoder와 PPO의 서로 다른 gradient 경로](/assets/img/posts/rl/csd/05-gradient-paths.svg){: width="1200" .d-block .mx-auto }

**Encoder $\phi$**

Encoder는 transition과 정답 skill을 받아 직접 regression을 수행한다.

$$
\mathcal L_\phi
=
\operatorname{SmoothL1}
\left(
N(\phi(s_{t+1})-\phi(s_t)),
z
\right)
$$

이 loss를 encoder parameter에 직접 backpropagation한다. 논문은 큰 오차에 대한 L2의 민감도를 줄이기 위해 실제 구현에서는 Smooth L1을 사용한다.

**Policy $\pi_\theta$**

Policy는 encoder loss를 직접 미분하지 않는다. 다음 순서로 간접 학습한다.

~~~text
encoder error e_t
    -> intrinsic reward r_t
    -> return and advantage
    -> PPO clipped objective
    -> policy parameter update
~~~

환경 dynamics를 통과해 policy output에서 encoder까지 end-to-end로 미분하는 구조가 아니다. Policy는 높은 reward를 만든 action의 확률을 PPO로 높인다.

### 6.3 실제 network와 control rate

부록에 나온 구현은:

| 구성 | 설정 |
|---|---|
| Encoder | MLP [256, 128, 64], ReLU |
| Policy | MLP [512, 256, 128], ELU |
| Policy update | PPO |
| Encoder update | Adam + Smooth L1 |
| Simulation | Isaac Sim + Orbit |
| Policy action rate | 50 Hz |
| Low-level PD rate | 400 Hz |
| Action | Nominal pose 기준 12개 관절의 desired position offset |

Policy observation은 joint position/velocity, base linear/angular velocity, base quaternion, previous action을 사용한다. Encoder는 여기에 world-frame base position까지 포함한 full state를 사용한다.

이 구분은 배포 때 중요하다.

- Policy가 항상 absolute world position을 요구하는 것은 아니다.
- 하지만 goal tracking에서 $\phi(s_{\text{des}})-\phi(s_t)$를 계산하려면 encoder에 일관된 world-frame base position이 필요하다.
- 실제 ANYmal 실험에서는 제조사 state estimator를 사용했다.

## 7. z는 정확히 무엇을 제어하는가?

![CSD의 continuous locomotion skill manifold](/assets/img/posts/rl/csd/10-continuous-skill-manifold.svg){: width="1200" .d-block .mx-auto }

2-D 실험에서는 결과적으로 다음 대응이 나타난다.

$$
\operatorname{angle}(z)
\longleftrightarrow
\text{locomotion direction}
$$

$$
\lVert z\rVert
\longleftrightarrow
\text{latent transition magnitude}
\approx
\text{motion magnitude or speed}
$$

여기서 조심할 점이 있다. CSD가 `walk`, `trot`, `bound` 같은 discrete gait label을 자동으로 붙이는 것은 아니다. 논문이 보여주는 핵심 결과는 다음에 가깝다.

> 방향과 속도가 연속적으로 변하는 locomotion command space.

관절 coordination이나 contact sequence가 skill에 따라 달라질 수는 있지만, 이를 명시적인 gait taxonomy로 검증한 결과는 아니다.

### 7.1 작은 z가 정지에 가까워지는 이유

CSD에서는 작은 $z$에 대해 큰 transition을 만들면 MSE가 커진다.

$$
z\approx0
\quad\Rightarrow\quad
\Delta\phi\approx0
$$

여기에 energy, smoothness, orientation 같은 regularization reward가 더해지면 policy는 불필요하게 크게 움직이는 것보다 안정적으로 서 있는 행동을 선호한다.

즉 정지는 norm matching만의 단독 산물이라기보다 다음 결합에서 나온다.

~~~text
small skill target
+ overshoot penalty from norm matching
+ locomotion regularization
= low-speed or near-stationary behavior
~~~

## 8. Zero-shot goal tracking은 왜 가능한가?

학습이 끝나면 encoder와 policy를 이용해 desired state를 skill로 바꿀 수 있다.

$$
z_{\text{des},t}
=
\phi(s_{\text{des}})
-\phi(s_t)
$$

논문은 별도의 완전한 target posture를 설계하지 않는다. $s_{\text{des}}$는 현재 state를 복사한 뒤 **base position만 Cartesian goal로 교체**해 만든다. 따라서 latent difference는 현재 locomotion state를 크게 유지하면서 목표 위치로 가기 위해 필요한 변화를 나타낸다.

그리고 이 skill을 policy에 넣는다.

$$
a_t
\sim
\pi_\theta
\left(
a\mid s_t,z_{\text{des},t}
\right)
$$

![CSD의 closed-loop zero-shot goal tracking](/assets/img/posts/rl/csd/07-goal-feedback.svg){: width="1200" .d-block .mx-auto }

핵심은 $z_{\text{des}}$를 한 번만 계산하지 않는다는 것.

~~~text
현재 state 측정
-> goal과의 latent 차이 계산
-> 그 차이를 skill command로 실행
-> 새로운 state 측정
-> latent 차이 다시 계산
~~~

이것은 open-loop skill playback이 아니라 **closed-loop feedback control**.

### 8.1 목표에 가까워지면 왜 감속하는가?

이상적으로 policy가 한 episode horizon 동안 skill target을 정확히 실현한다고 하자.

$$
\phi(s_{t+N})-\phi(s_t)
\approx
z_{\text{des},t}
$$

그리고

$$
z_{\text{des},t}
=
\phi(s_{\text{des}})-\phi(s_t)
$$

이므로

$$
\phi(s_{t+N})
\approx
\phi(s_{\text{des}})
$$

가 된다.

실제 controller는 매 step 현재 state로 $z_{\text{des},t}$를 다시 계산한다. 목표에 가까워질수록 latent error가 줄어들고, $\lVert z_{\text{des},t}\rVert$도 작아진다.

$$
\text{far from goal}
\Rightarrow
\lVert z_{\text{des},t}\rVert\ \text{large}
$$

$$
\text{near goal}
\Rightarrow
\lVert z_{\text{des},t}\rVert\ \text{small}
$$

$$
\text{at goal}
\Rightarrow
z_{\text{des},t}\approx0
$$

LSD처럼 작은 $z$에서도 고속 motion만 존재하면 목표를 지나친 뒤 반대 방향으로 다시 크게 움직이는 overshoot가 반복될 수 있다. CSD는 작은 norm에 대응하는 저속 skill을 학습했기 때문에 목표 근처에서 감속하고 정착할 수 있다.

## 9. 실험에서 실제로 확인된 것

### 9.1 속도 분포

![LSD, METRA, CSD의 평균 base velocity 분포](/assets/img/posts/rl/csd/06-paper-velocity-distribution.png){: width="1080" .d-block .mx-auto }

_1,000개 trajectory의 episode 평균 base speed 분포. LSD와 METRA는 약 2.5 m/s 부근에 집중하지만, CSD는 0에서 3 m/s까지 훨씬 넓게 분포한다. 출처: [Atanassov et al., Figure 3](https://arxiv.org/abs/2410.07877)._

이 결과가 뒷받침하는 주장은:

- LSD와 METRA skill은 대부분 높은 평균 속도에 몰린다.
- CSD는 낮은 속도부터 높은 속도까지 더 넓은 범위를 만든다.
- Skill norm을 바꾸는 것이 실제 locomotion intensity 조절로 연결된다.

다만 이 histogram만으로 모든 속도 구간이 완전히 균등하거나 선형적으로 calibration됐다고 말할 수는 없다.

### 9.2 Goal tracking 비교

![CSD와 LSD의 goal tracking trajectory 비교](/assets/img/posts/rl/csd/08-paper-goal-tracking.png){: width="1100" .d-block .mx-auto }

_위쪽은 CSD, 아래쪽은 LSD다. CSD는 여러 목표에 접근해 정착하지만 LSD는 목표를 반복해서 지나치는 trajectory를 보인다. 출처: [Atanassov et al., Figure 6](https://arxiv.org/abs/2410.07877)._

이 실험은 단순히 CSD가 목표 방향을 찾았다는 것보다 더 중요하다.

- 방향 제어만 가능하면 목표 쪽으로 갈 수 있다.
- 크기 제어까지 가능해야 목표 근처에서 감속할 수 있다.
- 매 step skill을 갱신해야 disturbance와 model error를 feedback으로 보정할 수 있다.

### 9.3 실제 ANYmal

![실제 ANYmal의 연속 목표 위치 추종](/assets/img/posts/rl/csd/09-paper-real-anymal.png){: width="1100" .d-block .mx-auto }

_실제 ANYmal이 첫 번째 목표와 두 번째 목표를 연속으로 추종한 결과. Orange는 측정된 base position, 점선은 target. 출처: [Atanassov et al., Figure 7](https://arxiv.org/abs/2410.07877)._

논문은 simulation policy를 실제 ANYmal에 배포하고 두 개의 Cartesian position target을 순서대로 추종한다. 추가 goal-reaching policy training 없이 학습된 encoder와 skill policy를 feedback controller로 재사용했다는 점이 핵심.

하지만 `arbitrary points`라는 표현을 무제한 workspace, 장애물 회피, 전역 경로 계획까지 가능한 것으로 확대하면 안 된다. 공개된 실험은 평평한 실내 공간에서의 local Cartesian goal tracking이다.

## 10. 3-D skill은 yaw까지 어떻게 넣는가?

2-D latent는 주로 XY 이동 방향과 크기를 표현한다. Position뿐 아니라 desired heading까지 맞추려면 latent dimension 하나를 추가한다.

논문의 3-D 실험에서는 desired state에 다음을 넣는다.

~~~text
dimension 1: XY-related latent transition
dimension 2: XY-related latent transition
dimension 3: relative desired yaw
~~~

그래서

$$
z_{\text{des},t}
=
\phi(s_{\text{des}})-\phi(s_t)
$$

가 position error와 heading error를 함께 담도록 학습된다.

다만 각 latent axis가 사전에 `x`, `y`, `yaw`로 지정된 것은 아니다. Encoder가 full state에서 변화가 크고 skill matching에 유리한 구조를 스스로 정렬한 결과. 더 높은 차원을 추가한다고 반드시 사람이 원하는 의미가 한 축씩 깔끔하게 분리되는 것도 아니다.

## 11. 이것은 정말 reward-free locomotion인가?

엄밀히 말하면 아니다.

CSD는 다음 task-specific reward를 사용하지 않는다.

- 목표 속도 tracking reward
- 목표 방향 reward
- 목표 위치 reward
- 사전에 정의한 gait imitation reward

하지만 실제 로봇에 배포할 수 있는 motion을 만들기 위해 다음 regularization reward를 사용한다.

- energy conservation
- action smoothness
- feet air time
- flat orientation
- nominal base height
- unwanted contact penalty

논문의 ablation에서는 intrinsic reward만 사용한 policy가 엎어진 상태로 구르는 local optimum에 빠진다. Body-contact termination을 추가하면 locomotion이 나타나지만, 전체 regularization을 사용한 policy가 더 안정적.

따라서 가장 정확한 표현은:

> **Task-specific 이동 reward 없이 skill objective와 표준 locomotion regularization으로 연속 locomotion skill space를 학습했다.**

`보상 설계가 전혀 없는 locomotion`이라고 표현하면 과장이다.

## 12. 한계와 조심해야 할 주장

### 12.1 Skill norm은 물리 단위가 아니다

$\lVert z\rVert$은 latent transition target. m/s나 m와 직접 같은 값이 아니다. 특정 speed command와 정확히 대응시키려면 별도 calibration이 필요하다.

### 12.2 Full-state distance는 여전히 편법을 허용한다

Encoder가 full state를 보므로 joint oscillation이나 body motion처럼 XY 이동과 무관한 큰 변화에 latent dimension을 사용할 수 있다. Lipschitz constraint는 거리를 과장하지 못하게 할 뿐, 어떤 state component가 유용한지는 정하지 않는다.

### 12.3 Regularization이 결과의 의미를 바꾼다

논문은 큰 real-state motion도 constraint를 만족할 수 있다고 인정한다. 실제로 낮은 norm이 작은 locomotion으로 연결되는 데에는 energy와 smoothness regularization의 영향도 있다.

### 12.4 Per-step surrogate는 episodic objective와 동일하지 않다

Per-step loss는 PPO 학습을 가능하게 하는 surrogate. Long-horizon behavior와 stepwise matching 사이에는 approximation이 들어간다.

### 12.5 Goal tracking은 navigation 전체가 아니다

이 방법에는 다음 요소가 없다.

- obstacle-aware global planner
- perceptive terrain reasoning
- collision-free waypoint generation
- global localization failure recovery

또한 real-world goal tracking은 state estimator의 world-frame position 품질에 의존한다.

### 12.6 발견된 skill이 모두 의미 있는 gait는 아니다

넓은 velocity distribution은 확인됐지만, contact pattern이나 gait family의 다양성을 체계적으로 분류한 연구는 아니다.

## 13. DIAYN, LSD, METRA, CSD 비교

| Method | 구별 기준 | Transition 크기 | Distance constraint | 주된 결과 |
|---|---|---|---|---|
| DIAYN | $q(z\mid s)$ 분류 | 직접 제어하지 않음 | 없음 | 구별되는 state distribution |
| LSD | $\Delta\phi^\top z$ | 최대화 | Euclidean state distance | 멀리 도달하는 방향별 skill |
| METRA | $\Delta\phi^\top z$ | 최대화 | Temporal distance | Dynamics-aware 방향별 skill |
| CSD | $\lVert\Delta\phi-z\rVert^2$ | $z$와 matching | Euclidean state distance | 방향과 크기를 조절하는 skill |

관계를 흐름으로 보면:

~~~text
DIAYN
  state에서 skill을 구별할 수 있는가?

LSD
  구별되는 것만으로 부족하다.
  실제 state distance를 반영하며 멀리 가자.

METRA
  raw Euclidean distance가 항상 좋은 metric은 아니다.
  temporal distance를 사용하자.

CSD
  항상 멀리 가는 것도 로봇 제어에는 문제다.
  방향과 크기를 target에 맞추자.
~~~

CSD가 METRA를 모든 면에서 대체한다고 보는 것도 정확하지 않다. CSD 주 실험은 Euclidean full-state distance를 사용하고, METRA의 장점은 high-dimensional observation에서 temporal metric을 학습하는 데 있다. 두 논문은 서로 다른 문제 축을 강조한다.

## 14. 구현한다면 확인할 체크리스트

### Skill sampling

- $z$를 episode 중 유지하는가?
- 원 내부 uniform sampling에서 radius 분포가 의도대로 구현됐는가?
- $\lVert z\rVert$별 sample 수가 지나치게 편향되지 않는가?

### Encoder

- Policy observation과 encoder state를 구분했는가?
- World-frame base position의 scale과 normalization이 안정적인가?
- Joint feature가 position signal을 압도하지 않는가?
- Lipschitz penalty 또는 dual variable이 실제로 작동하는가?

### Intrinsic reward

- $N\Delta\phi_t$와 $z$의 scale이 맞는가?
- $\sigma$ 때문에 reward가 거의 0 또는 1로 포화되지 않는가?
- Encoder update 중 reward target이 너무 빠르게 변하지 않는가?

### PPO

- Intrinsic reward와 regularization reward scale을 따로 로깅하는가?
- PPO advantage에 encoder gradient가 의도치 않게 연결되지 않는가?
- Skill norm별 return, velocity, fall rate를 별도로 측정하는가?

### Evaluation

- Skill angle과 실제 이동 방향의 관계를 측정하는가?
- Skill norm과 speed의 monotonicity를 확인하는가?
- Goal 근처 overshoot와 settling time을 측정하는가?
- Gait/contact diversity를 주장한다면 contact pattern도 분석하는가?

## 15. 헷갈렸던 질문 정리

### Q1. CSD는 PPO를 새로 만든 논문인가?

아니다. Policy optimization에는 기존 PPO를 사용한다. 새 핵심은 encoder objective와 intrinsic reward.

### Q2. Encoder와 policy를 하나의 loss로 end-to-end 학습하는가?

아니다. Encoder는 Smooth L1 regression으로 직접 업데이트되고, policy는 encoder error에서 만든 reward를 통해 PPO로 간접 업데이트된다.

### Q3. \(z\)가 작으면 왜 느려지는가?

큰 transition도 reward를 더 주던 inner product와 달리, CSD에서는 target보다 큰 transition도 오차이기 때문. Regularization도 불필요한 큰 motion을 억제한다.

### Q4. Goal tracking을 위해 다시 학습하는가?

아니다. Desired state와 current state의 latent 차이를 매 step skill로 넣는다. 이 의미에서 zero-shot이다.

### Q5. Zero-shot이면 planner도 필요 없는가?

아니다. 논문이 보여준 것은 local Cartesian goal tracking. 장애물이 있는 navigation에는 별도 planner와 perception이 필요하다.

### Q6. CSD의 \(z\)는 velocity command와 같은가?

사용 감각은 비슷해질 수 있지만 물리 단위가 정해진 velocity command는 아니다. 학습된 latent transition command.

## 16. 이동 방향에서 이동량까지

LSD와 METRA의 inner product는 alignment와 큰 transition을 함께 선호한다. 여러 방향으로 뻗는 skill은 얻을 수 있지만, 같은 방향에서 느리게 움직이거나 멈추는 command를 표현하기는 어렵다. CSD는 $\Delta\phi$와 $z$ 전체를 matching해 작은 $z$를 작은 motion과 연결한다.

$$
\text{maximize }
\Delta\phi^\top z
\quad\longrightarrow\quad
\text{minimize }
\lVert\Delta\phi-z\rVert^2
$$

이 magnitude control은 closed-loop goal tracking에서도 그대로 쓰인다. 목표가 가까워질수록 매 step 다시 계산한 $z_{\text{des}}$가 작아지고 policy가 감속한다. 수식의 변화는 짧지만, exploration 중심의 skill space를 로봇에서 조작하기 쉬운 command space로 바꾸는 부분은 여기에 있다.

## 참고 자료

- [Atanassov et al., Constrained Skill Discovery, arXiv](https://arxiv.org/abs/2410.07877)
- [OpenReview submission page](https://openreview.net/forum?id=tdfHABLdxR)
- [LSD: Lipschitz-constrained Unsupervised Skill Discovery](https://arxiv.org/abs/2202.00914)
- [METRA: Scalable Unsupervised RL with Metric-Aware Abstraction](https://arxiv.org/abs/2310.08887)
- [PPO: Proximal Policy Optimization Algorithms](https://arxiv.org/abs/1707.06347)
