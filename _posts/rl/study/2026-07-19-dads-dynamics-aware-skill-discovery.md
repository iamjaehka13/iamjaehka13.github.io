---
title: "DADS: DIAYN의 다양성에서 예측 가능한 스킬로"
date: 2026-07-19 21:30:00 +0900
last_modified_at: 2026-07-27 22:47:54 +0900
categories: [RL, Study]
tags: [dads, diayn, unsupervised-reinforcement-learning, skill-discovery, model-based-rl, soft-actor-critic, mutual-information, mpc]
description: "DIAYN의 상태 다양성에서 출발해 DADS의 조건부 mutual information, skill dynamics, intrinsic reward, SAC 학습과 latent-space planning을 비교 중심으로 정리한다."
math: true
image:
  path: /assets/img/posts/rl/dads/00-dads-preview-card.png
  alt: DADS로 학습한 Humanoid가 여러 목표점을 따라 이동하는 연속 동작
---

[이전 글](/posts/diayn-diversity-is-all-you-need/)의 DIAYN은 현재 상태에서 실행된 skill을 맞히는 discriminator로 서로 다른 state visitation을 만들었다.

$$
q_\phi(z\mid s)
$$

그런데 서로 **다르게 보이는 skill**을 얻었다고 해서 바로 계획에 사용할 수 있는 것은 아니다. 같은 skill을 같은 상태에서 여러 번 실행했을 때 결과가 크게 흔들린다면, 상위 controller는 그 skill을 어디에 배치해야 할지 알기 어렵다.

DADS, **Dynamics-Aware Discovery of Skills**는 이 지점에서 질문을 바꾼다.

> 현재 상태 $s$에서 skill $z$를 실행했을 때, 다음 상태 $s^{\prime}$를 얼마나 잘 예측할 수 있는가?

DIAYN이 skill별 **state visitation**을 구별한다면, DADS는 skill별 **state transition**을 구별하고 예측한다. 그리고 학습 과정에서 얻은 skill dynamics를 downstream planning에 그대로 재사용한다.

> **DADS는 서로 다르면서도 반복 가능한 상태 변화를 skill로 학습하고, 그 변화 모델 위에서 latent-space planning을 수행한다.**

## 0. 먼저 보는 전체 구조

DADS에는 두 개의 학습 대상이 있다.

| 구성 요소 | 역할 |
|---|---|
| Skill policy $\pi_\theta(a\mid s,z)$ | 현재 상태와 skill을 받아 실제 action을 만든다. |
| Skill dynamics $q_\phi(s^{\prime}\mid s,z)$ | 현재 상태에서 해당 skill이 만들 다음 상태를 예측한다. |

전체 과정은 두 단계로 나뉜다.

```text
Unsupervised pretraining
policy와 skill dynamics를 함께 학습

                ↓

Downstream planning
skill dynamics로 z sequence를 평가하고 실행
```

즉 DADS는 **model-free RL로 저수준 skill을 학습**하지만, downstream task에서는 **learned model로 고수준 planning**을 수행한다.

## 1. 논문 정보

| 항목 | 내용 |
|---|---|
| Title | Dynamics-Aware Unsupervised Discovery of Skills |
| Authors | Archit Sharma, Shixiang Gu, Sergey Levine, Vikash Kumar, Karol Hausman |
| Venue | ICLR 2020 |
| 문제 | 외부 task reward 없이 예측 가능하고 다양한 skill 발견 |
| Policy | $\pi_\theta(a\mid s,z)$ |
| Skill model | $q_\phi(s^{\prime}\mid s,z)$ |
| 핵심 목적 | $I(S^{\prime};Z\mid S)$ 최대화 |
| Policy optimizer | EC-SAC |
| Downstream control | Skill-space MPC, 논문에서는 MPPI 사용 |
| Skill space | Discrete와 continuous latent 모두 실험 |
| Source | [arXiv](https://arxiv.org/abs/1907.01657), [OpenReview](https://openreview.net/forum?id=HJgLZR4KvH), [Official code](https://github.com/google-research/dads), [Google Research overview](https://research.google/blog/dads-unsupervised-reinforcement-learning-for-skill-discovery/) |

이 표에서 중요한 것은 task reward가 없는 pretraining과, task reward를 planning 기준으로만 사용하는 downstream phase가 분리된다는 점.

따라서 DADS의 zero-shot 주장은 **새 task에서 policy gradient 학습을 다시 하지 않는다**는 뜻. Downstream goal이나 후보 trajectory를 평가할 reward까지 필요 없다는 뜻은 아니다.

## 2. DIAYN과 DADS는 무엇을 다르게 보는가?

DIAYN과 DADS를 가장 짧게 비교하면:

| 질문 | DIAYN | DADS |
|---|---|---|
| 무엇을 구별하는가? | skill별 상태 분포 | skill별 상태 전이 |
| 학습 모델 | $q(z\mid s)$ | $q(s^{\prime}\mid s,z)$ |
| Mutual information | $I(S;Z)$ | $I(S^{\prime};Z\mid S)$ |
| 높은 보상의 의미 | 이 상태를 보면 $z$를 맞힐 수 있음 | 이 transition은 현재 $z$로 잘 예측되고 다른 $z$와 구별됨 |
| Downstream 사용 | skill 선택, fine-tuning, meta-controller | learned skill dynamics를 이용한 planning |

DIAYN을 "최종 상태만 보는 방법"이라고 설명하면 부정확하다. DIAYN discriminator는 trajectory에서 방문한 상태로 skill-conditioned state distribution을 구별한다. DADS는 **현재 상태를 조건으로 두고 다음 상태의 변화를 모델링한다**는 점에서 다르다.

예를 들어 다음 두 skill을 생각해보자.

```text
z = 1
오른쪽 영역으로 가지만 경로와 이동량이 실행마다 크게 달라짐

z = 2
왼쪽 영역으로 이동
```

두 skill은 방문하는 상태 영역이 달라 DIAYN의 discriminator로 구별될 수 있다. 그러나 DIAYN 목적함수에는 $z=1$의 반복 trajectory가 얼마나 흔들리는지 직접 줄이는 항이 없다. DADS는 현재 상태와 skill이 정해졌을 때 다음 상태의 불확실성을 줄여 이 predictability를 직접 요구한다.

DADS의 문제의식은:

> Diversity만으로는 부족하다. 여러 번 조합할 skill이라면 **어떤 변화를 만들지 예측 가능해야 한다.**

다만 이것을 "DADS가 DIAYN의 완전한 상위호환"이라고 읽으면 안 된다. 두 방법은 skill diversity를 정의하는 기준과 downstream 사용 목적이 다르다. DADS는 그중 model-based composition에 필요한 predictability를 목적함수에 직접 넣은 방법이다.

## 3. 처음의 $z$에는 여전히 아무 의미가 없다

DADS의 policy도 DIAYN과 마찬가지로 skill-conditioned policy.

$$
\pi_\theta(a\mid s,z)
$$

초기에는 $z$가 무엇을 의미하는지 정해져 있지 않다.

```text
z = 0 → 의미 없음
z = 1 → 의미 없음
z = 2 → 의미 없음
...
```

Random initialization과 exploration 때문에 각 $z$에서 우연히 조금씩 다른 transition이 나타난다. Skill dynamics는 그중 현재 $z$에서 반복되고 다른 $z$와 구별되는 변화를 포착한다. 그 변화에는 높은 intrinsic reward가 주어지고, SAC가 이를 강화한다.

```text
우연히 z별 작은 행동 차이가 발생
        ↓
q(s' | s, z)가 반복 가능한 차이를 더 잘 예측
        ↓
해당 transition의 intrinsic reward 증가
        ↓
policy가 그 변화를 더 자주 재현
        ↓
z의 행동 의미가 점차 형성
```

DIAYN과 DADS 모두 **의미 없는 latent label에서 출발한다**는 점은 같다. 차이는 어떤 우연한 차이를 보상으로 증폭하는가에 있다.

```text
DIAYN → skill별 상태의 차이를 증폭
DADS  → skill별 예측 가능한 상태 변화의 차이를 증폭
```

또한 skill은 고정된 action sequence가 아니다. 동일한 $z$라도 현재 상태가 달라지면 policy가 다른 action을 선택할 수 있다.

$$
a_t\sim\pi_\theta(\cdot\mid s_t,z)
$$

중요한 것은 관절 action이 매번 동일한지가 아니라, **closed-loop policy가 거시적으로 일관된 상태 변화를 만드는가**.

## 4. 핵심 목적함수: $I(S^{\prime};Z\mid S)$

DADS는 다음 conditional mutual information을 최대화한다.

$$
I(S';Z\mid S)
$$

이 식은 두 가지 형태로 쓸 수 있다.

$$
I(S';Z\mid S)
=
H(Z\mid S)-H(Z\mid S,S')
$$

현재 상태만 봤을 때보다 transition 전체를 봤을 때 어떤 skill인지 더 명확해야 한다는 뜻이다.

상태 변화의 관점에서는 다음처럼 쓸 수 있다.

$$
I(S';Z\mid S)
=
H(S'\mid S)-H(S'\mid S,Z)
$$

이 형태가 DADS의 의도를 가장 직접적으로 보여준다.

| 항 | 최적화 방향 | 의미 |
|---|---:|---|
| $H(S^{\prime}\mid S)$ | 크게 | 같은 현재 상태에서도 서로 다른 skill은 다양한 다음 상태를 만든다. |
| $H(S^{\prime}\mid S,Z)$ | 작게 | 현재 상태와 skill이 정해지면 다음 상태는 예측 가능해야 한다. |

### 4.1 Diversity와 predictability를 함께 요구한다

Predictability만 줄이면 모든 skill이 가만히 있는 해가 나올 수 있다.

```text
모든 z → 항상 정지
```

이 결과는 예측하기 쉽지만 skill diversity가 없다. 반대로 diversity만 키우면 매번 다른 방향으로 튀는 불안정한 behavior가 높은 평가를 받을 수 있다.

DADS는 두 요구를 동시에 둔다.

```text
서로 다른 z
→ 서로 다른 transition

같은 s와 같은 z
→ 반복할 때 비슷한 transition
```

이것이 논문에서 말하는 **diverse and predictable skills**.

## 5. 알 수 없는 transition을 skill dynamics로 근사하기

Policy가 만드는 실제 skill-conditioned transition은:

$$
p(s'\mid s,z)
=
\int p(s'\mid s,a)\pi_\theta(a\mid s,z)\,da
$$

하지만 환경 dynamics $p(s^{\prime}\mid s,a)$를 알 수 없으므로 이 분포를 직접 계산할 수 없다. DADS는 이를 학습 가능한 skill dynamics로 근사한다.

$$
q_\phi(s'\mid s,z)
\approx
p(s'\mid s,z)
$$

Skill dynamics는 관측한 transition의 log-likelihood를 높이는 supervised learning으로 학습한다.

$$
\max_\phi
\mathbb{E}_{s,z,s'}
[\log q_\phi(s'\mid s,z)]
$$

Policy와 skill dynamics의 역할은 다르다.

| Network | 학습 질문 |
|---|---|
| Policy $\pi_\theta$ | 어떤 action을 해야 현재 $z$다운 transition이 만들어지는가? |
| Skill dynamics $q_\phi$ | 현재 $s,z$에서 실제로 어떤 $s^{\prime}$가 나오는가? |

논문 구현에서는 전체 $s^{\prime}$보다 state delta를 예측한다.

$$
q_\phi(s'-s\mid s,z)
$$

현재 절대 위치 자체보다 skill이 만든 변화를 중심으로 학습하기 쉽기 때문. Mixture-of-Experts와 같은 출력 구조는 논문 구현 선택이며 DADS 목적함수의 필수 조건은 아니다.

## 6. Skill dynamics가 intrinsic reward를 만드는 방법

Conditional mutual information은 다음 density ratio를 포함한다.

$$
I(S';Z\mid S)
=
\mathbb{E}
\left[
\log
\frac{p(s'\mid s,z)}{p(s'\mid s)}
\right]
$$

DADS는 실제 transition distribution 대신 $q_\phi$를 사용하고, 분모의 marginal을 prior에서 뽑은 다른 skill들로 근사한다.

$$
r_z(s,a,s')
\approx
\log q_\phi(s'\mid s,z)
-
\log
\left(
\frac{1}{L}
\sum_{i=1}^{L}
q_\phi(s'\mid s,z_i)
\right)
$$

각 항을 말로 바꾸면:

| 항 | 질문 |
|---|---|
| $\log q_\phi(s^{\prime}\mid s,z)$ | 실제 transition이 현재 선택한 $z$로 얼마나 잘 설명되는가? |
| 다른 $z_i$에 대한 평균 likelihood | 이 transition을 다른 skill들도 비슷하게 설명할 수 있는가? |

따라서 높은 reward를 받으려면 두 조건이 필요하다.

```text
현재 z로는 transition을 잘 예측할 수 있음
                    +
다른 z로는 같은 transition을 잘 설명하지 못함
```

단순히 model likelihood만 높이는 것과 다르다. 모든 skill이 같은 transition을 만들면 분자와 분모가 비슷해져 구별 보상이 사라진다.

![DADS training and intrinsic reward loop](/assets/img/posts/rl/dads/01-dads-training-loop.png){: width="760" .d-block .mx-auto }
_Policy가 만든 transition을 skill dynamics가 학습하고, 현재 skill과 prior에서 뽑은 다른 skill의 likelihood 비율이 intrinsic reward가 된다. 출처: [Sharma et al., Figure 2](https://arxiv.org/abs/1907.01657)._

> 내가 헷갈렸던 지점: "Skill dynamics가 policy action을 직접 정하는가?"
>
> 아니다. $q_\phi$는 transition의 확률을 평가해 scalar reward를 만든다. 실제 action은 policy가 만들고, policy는 SAC의 critic을 통해 이 reward를 장기적으로 높이는 방향으로 학습된다.

## 7. 실제 학습은 SAC로 어떻게 이어지는가?

DADS와 SAC는 같은 종류의 이름이 아니다.

```text
DADS
→ 무엇을 intrinsic reward로 삼을지 정의

SAC
→ 그 reward를 최대화하도록 policy와 critic을 학습
```

논문은 원칙적으로 DADS reward를 다른 RL 알고리즘으로도 최적화할 수 있다고 설명한다. 실제 실험의 agent optimizer는 **EC-SAC**다.

한 iteration의 흐름은:

1. Prior $p(z)$에서 skill을 뽑는다.
2. $\pi_\theta(a\mid s,z)$로 새로운 transition batch를 수집한다.
3. 수집한 $(s,z,s^{\prime})$로 $q_\phi$를 학습한다.
4. 현재 $q_\phi$로 각 transition의 intrinsic reward를 계산한다.
5. 그 reward를 사용해 SAC policy와 critic을 업데이트한다.

> 구현 메모: SAC는 off-policy update가 가능한 알고리즘이지만, 원 DADS는 현재 policy로 모은 최근 batch 중심의 학습 절차를 사용했다. 후속 off-DADS가 과거 transition의 본격적인 재사용을 다룬다. 또한 원 DADS의 저수준 skill policy는 EC-SAC로 학습했으며, PPO는 discrete-skill hierarchical meta-controller 비교에서 사용됐다.

## 8. 학습된 model을 planning에 다시 사용한다

DADS의 가장 중요한 차이는 intrinsic reward를 만드는 데 사용한 $q_\phi$가 학습 후에도 남는다는 것.

$$
q_\phi(s_{t+1}\mid s_t,z_t)
$$

Planner는 여러 skill sequence를 sampling한다.

$$
(z_1,z_2,\ldots,z_{H_P})
$$

각 후보를 평가할 때는 하나의 $z_i$를 $H_Z$ model step 동안 고정해 미래 상태를 전개한다.

$$
\hat{s}_{t+h+1}
\sim
q_\phi(\cdot\mid \hat{s}_{t+h},z_i),
\qquad
h=0,\ldots,H_Z-1
$$

그다음 다음 $z_{i+1}$로 바꾸고 같은 과정을 반복한다. 이렇게 예측한 전체 trajectory에서 downstream reward가 가장 높은 sequence를 고르며, 논문은 이 탐색에 MPPI를 사용한다.

![Latent-space MPC with learned DADS skills](/assets/img/posts/rl/dads/02-dads-latent-space-mpc.png){: width="920" .d-block .mx-auto }
_위쪽 planner는 skill dynamics로 후보 $z$ sequence를 평가한다. 선택한 첫 skill은 아래쪽 실제 environment에서 policy가 실행하고, 새로운 상태에서 다시 계획한다. 출처: [Sharma et al., Figure 3](https://arxiv.org/abs/1907.01657)._

### 8.1 Action space가 아니라 skill space에서 계획한다

일반적인 action-space MBRL은 매우 짧은 제어 주기의 action을 긴 horizon 동안 예측해야 한다.

```text
a0, a1, a2, ..., a999
```

DADS는 저수준 action을 policy에 맡기고, planner는 더 느린 시간 해상도의 latent skill을 선택한다.

```text
z0, z1, z2, ..., zK
```

Planner는 선택한 첫 $z$를 실제 policy에 전달해 $H_Z$ environment step 동안 실행하고, 바뀐 실제 상태에서 다시 계획한다.

이것이 temporal abstraction.

```text
Planner
→ 어느 행동 모드를 사용할지 결정

Skill policy
→ 그 모드를 실제 low-level action으로 실행
```

### 8.2 Zero-shot의 정확한 의미

새 목표가 주어졌을 때 DADS는 policy를 추가로 fine-tuning하지 않고 learned skill과 dynamics를 사용해 바로 planning한다. 하지만 planner가 후보 trajectory의 좋고 나쁨을 판단할 task reward나 cost는 필요하다.

따라서 정확한 표현은:

> **Task reward 없이 skill repertoire를 사전학습하고, 새 task에서는 그 reward를 planning 기준으로만 사용한다.**

## 9. 실험을 읽기 전에: x-y prior

Ant navigation의 주요 정량 실험에서는 skill dynamics가 관심을 두는 observation을 Cartesian coordinate $(x,y)$로 제한했다. 논문은 이를 **x-y prior**라고 부른다.

```text
q가 몸 전체의 모든 상태 차이를 예측하도록 두는 대신
→ x-y 이동을 잘 예측하고 구별하도록 학습
```

따라서 이동 방향 중심의 skill이 나타난 것은 DADS 목적함수만의 결과가 아니다. 연구자가 prediction target을 통해 "어떤 차이를 behavior diversity로 볼 것인가"라는 inductive bias를 넣었다.

이 지점은 DIAYN의 discriminator feature 선택과 연결된다.

| 방법 | Behavior를 정의하는 입력 |
|---|---|
| DIAYN | Discriminator가 보는 $f(s)$ |
| DADS | Skill dynamics가 예측하는 state feature 또는 delta |

비지도 skill discovery라도 representation 선택까지 완전히 비지도인 것은 아니다. 이 조건을 먼저 알고 다음 continuous latent와 trajectory variance 결과를 읽어야 한다.

## 10. Continuous latent skill은 무엇을 추가하는가?

DADS는 discrete skill과 continuous skill을 모두 사용할 수 있다. Ant 실험에서는 다음 2차원 continuous latent를 사용했다.

$$
z\in[-1,1]^2
$$

Discrete skill 20개와 달리 continuous space에는 이론적으로 무한한 $z$가 있다. x-y prior를 사용한 Ant 실험에서는 latent 좌표를 부드럽게 바꾸면 trajectory 방향도 비교적 부드럽게 변하는 결과가 나타났다.

![Continuous DADS Ant trajectories](/assets/img/posts/rl/dads/03-dads-continuous-trajectories.png){: width="880" .d-block .mx-auto }
_2차원 continuous latent에서 sampling한 Ant의 x-y trajectory. 다양한 이동 방향이 하나의 compact latent space에 배치된다. 출처: [Sharma et al., Figure 5](https://arxiv.org/abs/1907.01657)._

![Orientation over the continuous DADS latent space](/assets/img/posts/rl/dads/04-dads-latent-orientation-map.png){: width="880" .d-block .mx-auto }
_각 latent 좌표에서 나온 trajectory 방향의 heatmap. 이 실험에서는 주변 latent가 비교적 연속적인 방향 변화를 만든다. 출처: [Sharma et al., Figure 5](https://arxiv.org/abs/1907.01657)._

그러나 continuous latent가 다음 벡터 산술을 보장하는 것은 아니다.

$$
z_{\text{forward}}
+
z_{\text{right}}
\stackrel{?}{=}
z_{\text{diagonal}}
$$

DADS 목적함수는 latent 좌표축에 "전후 이동"이나 "좌우 이동"이라는 의미를 직접 부여하지 않는다. 같은 behavior family를 표현하는 latent space가 회전되거나 휘어 있어도 목적함수를 만족할 수 있다.

논문의 실험적 주장은 **interpolation에 따라 behavior가 부드럽게 변했다**는 것이다. 임의의 두 skill을 더하면 의미 있는 조합이 된다는 주장이 아니다. 실제 downstream control은 latent arithmetic보다 learned dynamics 위에서의 planning을 사용한다.

## 11. 실험에서 DIAYN과 무엇이 달랐는가?

논문은 Ant navigation에서 동일한 skill을 여러 번 실행했을 때 x-y trajectory의 표준편차를 측정했다.

![Skill trajectory variance comparison](/assets/img/posts/rl/dads/05-dads-skill-variance.png){: width="900" .d-block .mx-auto }
_논문이 보고한 normalized trajectory standard deviation. x-y prior를 사용한 DADS가 비교 조건 중 가장 낮은 분산을 보였다. 출처: [Sharma et al., Figure 6](https://arxiv.org/abs/1907.01657)._

이 결과에서 읽어야 하는 것은 "모든 환경에서 DADS가 항상 DIAYN보다 우수하다"가 아니다.

논문이 확인하려던 가설은 더 제한적.

> Transition predictability를 직접 최적화하면, 같은 skill을 반복했을 때 trajectory variance가 줄고 장기 composition이 쉬워지는가?

논문의 Ant 조건에서는 DADS skill의 분산이 DIAYN skill보다 낮았다. 같은 종류의 meta-controller를 학습했을 때도 DADS skill은 목표 이동에 조합될 수 있었지만, 해당 DIAYN baseline은 성능이 거의 개선되지 않았다.

![Hierarchical control with DIAYN and DADS skills](/assets/img/posts/rl/dads/06-dads-hierarchical-comparison.png){: width="900" .d-block .mx-auto }
_값이 낮을수록 목표에 가깝다. 논문에서는 Hierarchical DIAYN보다 DADS skill을 사용한 meta-controller와 DADS+MPPI가 더 낮은 normalized distance를 보였다. 출처: [Sharma et al., Figure 8](https://arxiv.org/abs/1907.01657)._

이 비교에는 중요한 비용 차이도 있다.

```text
Hierarchical controller
→ 새 goal마다 meta-controller 학습 데이터 필요

DADS + MPPI
→ 새 goal에서 policy 학습 없이 planning
```

논문은 DADS+MPPI가 새 goal에서 추가 policy training 없이 동작했음을 강조한다. 그렇다고 planning 계산이 공짜이거나 dynamics model error가 사라지는 것은 아니다.

## 12. 한계와 비판적으로 읽을 지점

### 12.1 Predictable은 useful과 같은 말이 아니다

가만히 있기, 느리게 움직이기처럼 단순한 behavior는 예측하기 쉽다. Diversity 항이 모든 skill의 collapse를 막더라도 안전성, 에너지 효율, 인간에게 유용한 동작은 별도 목적이 없으면 보장되지 않는다.

### 12.2 Planner는 발견하지 못한 skill을 만들어내지 못한다

MPC는 현재 repertoire에서 좋은 sequence를 고른다. 낭떠러미를 뛰어넘는 behavior가 pretraining에서 발견되지 않았다면 planner가 latent sequence만으로 새 점프 policy를 발명할 수는 없다.

### 12.3 One-step model error가 누적된다

$q_\phi(s^{\prime}\mid s,z)$를 여러 번 적용해 긴 미래를 예측하면 작은 오차가 쌓인다. Model mismatch가 큰 영역에서 planner가 실제로는 불가능한 trajectory를 선택할 수도 있다. Receding-horizon replanning이 오차를 줄여주지만 제거하지는 않는다.

### 12.4 발견되는 skill은 state representation에 의존한다

x-y prior처럼 prediction target을 바꾸면 어떤 behavior가 서로 다르다고 평가되는지도 달라진다. Representation 선택은 단순한 구현 세부가 아니라 behavior specification.

### 12.5 원 DADS는 data reuse가 제한적이다

원 논문은 최근 policy batch 중심으로 학습한다. 실제 로봇처럼 interaction 비용이 큰 환경에서는 이 sample efficiency가 문제가 된다. 후속 off-DADS가 과거 transition 재사용과 real-world skill discovery를 다룬 이유다.

### 12.6 Sim-to-real에서는 policy뿐 아니라 model도 옮겨야 한다

DADS planning은 learned skill dynamics를 신뢰한다. Simulation에서 예측한 이동량과 실제 로봇의 이동량이 다르면 policy가 어느 정도 동작하더라도 planner의 sequence 선택은 틀릴 수 있다.

```text
일반 skill policy transfer
→ policy 실행 가능성 검증

DADS planning transfer
→ policy 실행 가능성
 + skill dynamics calibration
 + planner robustness 검증
```

## 13. DADS에서 남는 연결

Policy $\pi(a\mid s,z)$의 $z$는 처음부터 의미를 갖지 않는다. DIAYN이 $q(z\mid s)$로 skill-conditioned state distribution을 구별했다면, DADS는 $q(s^{\prime}\mid s,z)$로 skill-conditioned transition을 예측한다. 그 결과 $I(S^{\prime};Z\mid S)$는 서로 다른 $z$의 diversity와 같은 $z$의 predictability를 함께 요구한다. 학습된 skill dynamics는 intrinsic reward를 만드는 데서 끝나지 않고 downstream MPC에도 재사용된다.

Mixture-of-Experts의 expert 수, prior sample 수와 MPPI update 식은 구현할 때 다시 확인하면 된다. 논문의 연결은 아래 문장에 더 잘 남는다.

> **스킬을 장기 계획에 사용하려면 서로 다르기만 해서는 부족하다. 결과를 예측할 수 있어야 한다.**

## 참고 자료

- [Sharma et al., Dynamics-Aware Unsupervised Discovery of Skills](https://arxiv.org/abs/1907.01657)
- [ICLR 2020 OpenReview](https://openreview.net/forum?id=HJgLZR4KvH)
- [Google Research DADS repository](https://github.com/google-research/dads)
- [Google Research: DADS Unsupervised Reinforcement Learning for Skill Discovery](https://research.google/blog/dads-unsupervised-reinforcement-learning-for-skill-discovery/)
- [Eysenbach et al., Diversity Is All You Need](https://arxiv.org/abs/1802.06070)
- [이전 글: DIAYN 논문 리뷰](/posts/diayn-diversity-is-all-you-need/)
