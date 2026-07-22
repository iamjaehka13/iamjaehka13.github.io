---
title: "METRA: 픽셀 거리가 아닌 시간적 거리로 스킬 공간 만들기"
date: 2026-07-22 20:30:00 +0900
categories: [RL, Study]
tags: [metra, lsd, diayn, unsupervised-reinforcement-learning, skill-discovery, wasserstein-distance, temporal-distance, representation-learning, soft-actor-critic, zero-shot-control]
description: "METRA가 mutual information 대신 Wasserstein dependency measure를 사용하고, 픽셀의 Euclidean 거리가 아닌 temporal distance로 metric-aware skill abstraction을 학습하는 과정을 정리한다."
math: true
image:
  path: /assets/img/posts/rl/metra/00-metra-preview.png
  alt: 픽셀 관측 환경에서 METRA로 학습한 Quadruped continuous skills
---

이전 [LSD 글](/posts/lsd-lipschitz-constrained-skill-discovery/)은 다음 질문으로 끝났다.

> 두 state의 차이를 observation-space Euclidean distance로 재는 것이 정말 최선인가?

State가 관절각과 위치처럼 잘 정규화된 수치라면 Euclidean distance가 어느 정도 의미를 가질 수 있다. 하지만 observation이 이미지라면 이야기가 달라진다. 로봇이 제자리에 있어도 조명이나 카메라 시점이 바뀌면 pixel distance는 매우 커질 수 있다. 반대로 단조로운 공간에서는 로봇이 멀리 이동해도 이미지 변화가 작을 수 있다.

**METRA, Metric-Aware Abstraction**은 이 문제를 다음 방향으로 바꾼다.

> State가 raw observation에서 얼마나 달라 보이는지가 아니라, 환경 dynamics에서 서로 오가는 데 몇 step이 필요한지를 거리로 사용하자.

METRA는 이 temporal distance에 연결된 작은 latent space를 만들고, 그 공간의 여러 방향으로 움직이는 skill policy를 함께 학습한다.

한 문장으로 압축하면 다음과 같다.

> **METRA는 상태공간 전체를 직접 덮으려 하지 않고, temporal distance를 과장하지 않는 compact latent space를 만든 뒤 그 공간의 여러 방향을 skill로 덮는다.**

## 0. 먼저 눈으로 보는 LSD와 METRA

공식 프로젝트의 pixel-based Quadruped 결과부터 보자. 두 영상은 모두 4차원 continuous skill에서 무작위로 뽑은 9개 skill을 두 번씩 실행한다.

<div class="row g-3 my-3">
  <div class="col-md-6">
    <p class="fw-semibold mb-2">LSD: pixel Euclidean metric</p>
    <img src="https://pub-7351ab7ce8d34a72861fbf2a7d06dd4c.r2.dev/assets/img/posts/rl/metra/13-quadruped-lsd.gif" alt="LSD가 발견한 9개 Quadruped skill 비교" loading="eager" style="width: 100%; border-radius: 6px;">
  </div>
  <div class="col-md-6">
    <p class="fw-semibold mb-2">METRA: temporal metric</p>
    <img src="https://pub-7351ab7ce8d34a72861fbf2a7d06dd4c.r2.dev/assets/img/posts/rl/metra/12-quadruped-metra.gif" alt="METRA가 발견한 9개 Quadruped skill 비교" loading="eager" style="width: 100%; border-radius: 6px;">
  </div>
</div>

_공식 프로젝트의 pixel-based Quadruped 비교. 각 칸의 좌우 영상은 동일한 skill을 두 번 실행해 consistency를 보여준다. 이 한 영상만으로 일반적 우위를 증명하는 것은 아니며, 전체 정량 결과는 뒤에서 따로 본다. 출처: [METRA official project](https://seohong.me/projects/metra/)._

차이는 trajectory plot에서 더 직접적으로 보인다.

<div class="row g-3 my-3">
  <div class="col-md-6">
    <img src="/assets/img/posts/rl/metra/11-quadruped-lsd-trajectories.png" alt="LSD Quadruped trajectories" style="width: 100%;">
    <p class="text-center text-muted small mt-2">LSD 4-D skills</p>
  </div>
  <div class="col-md-6">
    <img src="/assets/img/posts/rl/metra/10-quadruped-metra-trajectories.png" alt="METRA Quadruped trajectories" style="width: 100%;">
    <p class="text-center text-muted small mt-2">METRA 4-D skills</p>
  </div>
</div>

_같은 pixel-based Quadruped benchmark에서 그린 global $x$-$y$ trajectory. METRA 결과는 여러 skill이 서로 다른 방향으로 더 넓게 전개되는 모습을 보인다. 출처: [METRA official project](https://seohong.me/projects/metra/)._

여기서 바로 결론을 과장하면 안 된다.

- METRA가 image semantics를 완벽하게 이해했다는 뜻은 아니다.
- 모든 skill이 유용하거나 안정적인 locomotion이라는 뜻도 아니다.
- 중요한 차이는 **어떤 distance metric으로 representation을 제한했는가**다.

## 1. 논문 정보

| 항목 | 내용 |
|---|---|
| Title | METRA: Scalable Unsupervised RL with Metric-Aware Abstraction |
| Authors | Seohong Park, Oleh Rybkin, Sergey Levine |
| Venue | ICLR 2024 |
| 목표 | High-dimensional environment에서도 확장 가능한 unsupervised skill discovery |
| Policy | $\pi_\theta(a\mid s,z)$ |
| Representation | $\phi:\mathcal{S}\rightarrow\mathcal{Z}$ |
| 출발점 | Wasserstein dependency measure |
| Metric | Temporal distance |
| Intrinsic reward | $(\phi(s')-\phi(s))^\top z$ |
| Constraint | Adjacent state에서 $\|\phi(s)-\phi(s')\|_2\le1$ |
| Policy optimizer | SAC |
| Constraint optimizer | Dual gradient descent |
| Source | [arXiv](https://arxiv.org/abs/2310.08887), [Official project](https://seohong.me/projects/metra/), [Official code](https://github.com/seohongpark/METRA) |

## 2. 기존 방법은 왜 복잡한 환경에서 확장하기 어려운가?

논문은 기존 unsupervised RL을 크게 두 부류로 본다.

### 2.1 Pure exploration

RND, ICM, APT 같은 exploration 방법은 가능한 많은 state 또는 transition을 방문하려 한다.

작은 환경에서는 합리적이지만, 로봇의 상태가 다음 조합으로 이루어진다면 전체 coverage는 빠르게 어려워진다.

~~~text
global position
body orientation
joint positions and velocities
contact pattern
object configuration
camera pixels
~~~

각 요소의 가능한 조합을 모두 방문하는 것은 사실상 불가능하다.

### 2.2 Mutual-information skill discovery

DIAYN, DADS 같은 방법은 skill $Z$와 state 또는 transition 사이의 mutual information을 키운다.

$$
I(S;Z)
=
D_{\mathrm{KL}}
\left(
p(s,z)\,\|\,p(s)p(z)
\right)
$$

이 목적은 실제 $(s,z)$ 대응과 무작위로 섞은 대응을 구별한다. 하지만 KL divergence에는 state 사이의 물리적 거리나 도달 시간이 직접 들어 있지 않다.

다음 두 경우를 생각해 보자.

~~~text
Case A
z1 -> x = -0.01
z2 -> x = +0.01

Case B
z1 -> x = -100
z2 -> x = +100
~~~

State에서 skill을 완벽히 구별할 수 있다면 두 경우 모두 $I(S;Z)=H(Z)$까지 올라갈 수 있다. MI에는 Case B가 더 멀리 이동했다는 추가 점수가 없다.

![Pure exploration, MI, and WDM overview](/assets/img/posts/rl/metra/01-wdm-overview.png){: width="1200" .d-block .mx-auto }

_왼쪽부터 전체 state space를 직접 덮으려는 pure exploration, 구별되는 behavior를 찾지만 거리는 보지 않는 MI, 주어진 metric에서 멀리 분산된 behavior를 찾는 WDM의 차이. 출처: [Park et al., Figure 2](https://arxiv.org/abs/2310.08887)._

METRA의 목표는 둘 사이에 있다.

> 모든 state를 직접 방문하려 하지 말고, 제한된 크기의 skill space가 가능한 한 넓은 state variation을 대표하게 만들자.

## 3. Pixel L2가 control distance가 아닌 이유

LSD의 1-Lipschitz 제약은 다음 형태다.

$$
\|\phi(s)-\phi(s')\|_2
\le
\|s-s'\|_2
$$

State가 image $I$라면 오른쪽은 raw pixel distance가 된다.

$$
\|I-I'\|_2
$$

로봇의 실제 위치와 자세는 그대로인데 조명만 달라져도 이 값은 클 수 있다. 반대로 벽과 바닥이 반복되는 환경에서는 멀리 이동해도 두 image가 비슷할 수 있다.

![Pixel distance versus temporal distance](/assets/img/posts/rl/metra/06-pixel-vs-temporal.svg){: width="1200" .d-block .mx-auto }

_Raw pixel L2는 한 순간의 시각 변화에 크게 반응할 수 있다. Temporal metric은 한 transition의 latent 변화를 제한하고, 큰 latent displacement가 여러 step에 걸쳐 누적되게 만든다._

정확한 표현은 다음과 같다.

- LSD는 pixel 차이를 state-space metric으로 사용할 경우 nuisance variation을 크게 평가할 수 있다.
- METRA는 raw pixel L2를 거리로 사용하지 않는다.
- 대신 실제 transition graph에서 몇 step이 필요한지를 거리 기준으로 사용한다.

다만 METRA가 조명과 실제 이동을 명시적으로 분류하는 것은 아니다. 한 step에 생긴 시각 변화의 latent 크기를 제한할 뿐이다. 지속적이고 controllable한 시각 변화가 있거나 observation에 위치 단서가 전혀 없다면 representation이 여전히 원하는 구조를 배우지 못할 수 있다.

## 4. MI 대신 Wasserstein dependency measure

METRA는 다음 Wasserstein dependency measure, WDM에서 출발한다.

$$
I_{\mathcal{W}}(S;Z)
=
\mathcal{W}
\left(
p(s,z),p(s)p(z)
\right)
$$

비교하면 다음과 같다.

| 목적 | Divergence | Metric 사용 |
|---|---|---|
| Mutual information | KL divergence | 없음 |
| Wasserstein dependency measure | 1-Wasserstein distance | 있음 |

Wasserstein distance는 한 분포의 질량을 다른 분포로 운반하는 최소 비용으로 해석할 수 있다. 이 운반 비용을 계산하려면 underlying metric $d$가 필요하다.

따라서 WDM은 다음 두 질문을 함께 묻는다.

1. 실제 state-skill 대응은 독립적으로 섞은 대응과 다른가?
2. 그 차이는 선택한 metric에서 얼마나 큰가?

이것이 단순히 "KL 대신 Wasserstein을 썼다"에서 끝나지 않는 이유다. **어떤 metric을 넣는가가 발견되는 skill의 우선순위를 결정한다.**

## 5. WDM에서 intrinsic reward까지

WDM을 그대로 최적화하기는 어렵다. 논문은 여러 단계를 거쳐 계산 가능한 목적함수로 단순화한다.

![From WDM to METRA reward](/assets/img/posts/rl/metra/08-wdm-to-reward.svg){: width="1200" .d-block .mx-auto }

### 5.1 Kantorovich-Rubinstein duality

1-Wasserstein distance의 dual form을 사용하면 다음과 같이 쓸 수 있다.

$$
I_{\mathcal{W}}(S;Z)
=
\sup_{\|f\|_L\le1}
\left[
\mathbb{E}_{p(s,z)}f(s,z)
-
\mathbb{E}_{p(s)p(z)}f(s,z)
\right]
$$

$f(s,z)$는 실제 joint sample에 높은 score를, 독립 sample에 낮은 score를 주는 함수다. Scale만 무한히 키워 목적을 조작하지 못하도록 Lipschitz constraint가 필요하다.

### 5.2 State와 skill 표현을 내적으로 분해

논문은 score를 다음처럼 parameterize한다.

$$
f(s,z)
=
\phi(s)^\top\psi(z)
$$

그러면 WDM은 다음 tractable approximation으로 바뀐다.

$$
I_{\mathcal{W}}(S;Z)
\approx
\sup_{\phi,\psi}
\left[
\mathbb{E}_{p(s,z)}
\phi(s)^\top\psi(z)
-
\mathbb{E}_{p(s)}\phi(s)^\top
\mathbb{E}_{p(z)}\psi(z)
\right]
$$

여기서 주의할 점이 있다. $\phi$와 $\psi$에 독립적으로 Lipschitz constraint를 거는 것은 unrestricted $f$에 대한 원래 제약과 완전히 동일한 것이 아니라 계산을 위한 단순화다.

### 5.3 마지막 상태와 skill의 관계 사용

METRA는 전체 state distribution 대신 episode 마지막 상태에 대한

$$
I_{\mathcal{W}}(S_T;Z)
$$

를 사용한다. 그리고 $\psi(z)=z$로 두고, prior를 zero mean으로 맞춘다.

$$
\bar z
=
\mathbb{E}_{p(z)}[z]
=
0
$$

그러면 독립 marginal 항이 사라지고 다음 형태가 남는다.

$$
\mathbb{E}_{\tau,z}
\left[
(\phi(s_T)-\phi(s_0))^\top z
\right]
$$

### 5.4 Telescoping sum

Endpoint displacement는 transition 차이의 합으로 분해된다.

$$
\phi(s_T)-\phi(s_0)
=
\sum_{t=0}^{T-1}
\left(
\phi(s_{t+1})-\phi(s_t)
\right)
$$

따라서 한 step의 intrinsic reward는 다음과 같다.

$$
\boxed{
r_t^{\mathrm{METRA}}
=
\left(
\phi(s_{t+1})-\phi(s_t)
\right)^\top z
}
$$

이 reward는 skill 방향으로 latent state가 움직였을 때 커진다.

중요한 경계는 다음이다.

> 이 간결한 reward는 full WDM을 아무 손실 없이 그대로 계산한 것이 아니라, factorization, endpoint dependency, $\psi(z)=z$ 같은 단순화를 거친 tractable objective다.

## 6. METRA가 선택한 metric: temporal distance

METRA는 두 state 사이의 temporal distance를 다음처럼 정의한다.

$$
d_{\mathrm{temp}}(s_1,s_2)
=
\text{$s_1$에서 $s_2$에 도달하는 데 필요한 최소 environment step 수}
$$

예를 들면 다음과 같다.

~~~text
한 step으로 도달 가능       -> temporal distance 1
최소 20 step 필요           -> temporal distance 20
도달 불가능                 -> 매우 크거나 정의가 어려움
~~~

Temporal distance는 observation 좌표계보다 MDP transition dynamics에 의해 결정된다. 그래서 image가 입력이어도 raw pixel L2에 직접 의존하지 않는다.

원래 원하는 Lipschitz 관계는 다음이다.

$$
\|\phi(s_1)-\phi(s_2)\|_2
\le
d_{\mathrm{temp}}(s_1,s_2)
$$

하지만 모든 state pair의 shortest path를 계산할 수는 없다. METRA는 실제로 관찰한 adjacent transition만 사용한다.

$$
\boxed{
\|\phi(s_t)-\phi(s_{t+1})\|_2
\le1
}
$$

한 step으로 연결됐으므로 temporal distance가 1 이하라는 사실을 이용한 것이다.

## 7. Local constraint가 global bound가 되는 이유

다음 5-step 경로를 생각하자.

$$
s_0\rightarrow s_1\rightarrow\cdots\rightarrow s_5
$$

모든 edge에서 latent 변화가 1 이하라면 삼각부등식으로

$$
\begin{aligned}
\|\phi(s_5)-\phi(s_0)\|_2
&\le
\sum_{t=0}^{4}
\|\phi(s_{t+1})-\phi(s_t)\|_2\\
&\le5
\end{aligned}
$$

가 된다.

![Local constraints imply global temporal bound](/assets/img/posts/rl/metra/07-local-global-bound.svg){: width="1200" .d-block .mx-auto }

_모든 adjacent transition에 local bound를 걸고, 가능한 경로 중 가장 짧은 경로를 선택하면 endpoint latent distance는 temporal distance를 넘지 못한다._

이 논리는 reachable한 모든 경로에 적용된다. 가장 짧은 경로를 고르면

$$
\|\phi(s)-\phi(g)\|_2
\le
d_{\mathrm{temp}}(s,g)
$$

를 얻는다.

### 7.1 정확히 temporal distance를 복원하는가?

아니다. 제약은 equality가 아니라 upper bound다.

다음 collapse도 제약만 보면 허용된다.

$$
\phi(s)=0,\qquad \forall s
$$

모든 latent distance가 0이면 constraint를 완벽하게 만족한다. Collapse를 막는 힘은 constraint 자체가 아니라 directional objective다.

~~~text
Constraint
-> latent distance가 temporal distance를 과장하지 못하게 함

Objective
-> 허용된 범위에서 z 방향의 displacement를 크게 만듦
~~~

따라서 $\phi$는 temporal distance의 정확한 estimator가 아니다. 제한된 latent dimension에서 objective에 유용한 temporal structure를 선택적으로 펼치는 abstraction이다.

## 8. 실제 학습: SAC와 dual gradient descent

METRA는 세 가지 학습 대상을 가진다.

| 구성 요소 | 역할 |
|---|---|
| Policy $\pi_\theta(a\mid s,z)$ | $z$가 지시하는 latent 방향의 transition 생성 |
| Representation $\phi_\eta(s)$ | State를 metric-aware latent space로 변환 |
| Lagrange multiplier $\lambda$ | Adjacent-state constraint 위반 강도 조절 |

![METRA training loop](/assets/img/posts/rl/metra/09-metra-training-loop.svg){: width="1200" .d-block .mx-auto }

학습 루프는 다음과 같다.

~~~text
1. z ~ p(z)를 sample하고 episode 동안 고정
2. pi(a | s, z)로 trajectory 수집
3. replay buffer에 (s, z, s') 저장
4. Delta phi^T z와 constraint로 phi 업데이트
5. constraint 위반에 맞춰 lambda 업데이트
6. r = Delta phi^T z를 사용해 SAC actor/critic 업데이트
~~~

논문의 Algorithm 1에서 representation objective는 다음 항을 포함한다.

$$
\mathbb{E}
\left[
\Delta\phi^\top z
+
\lambda
\min
\left(
\varepsilon,
1-\|\Delta\phi\|_2^2
\right)
\right]
$$

여기서 $\Delta\phi=\phi(s')-\phi(s)$다.

- $\|\Delta\phi\|_2^2>1$이면 constraint term이 음수가 되어 representation update에 불리하다.
- $\lambda$는 dual update를 통해 위반 압력을 조절한다.
- $\varepsilon>0$은 constraint에 작은 relaxation을 둔다.
- Policy는 constraint penalty가 아니라 $r=\Delta\phi^\top z$를 reward로 받는다.

### 8.1 LSD와 구현적으로 무엇이 다른가?

| 항목 | LSD | METRA |
|---|---|---|
| Distance 기준 | State Euclidean distance | Temporal distance |
| 제약 구현 | Spectral normalization | Adjacent pair와 dual constraint |
| Reward | $\Delta\phi^\top z$ | $\Delta\phi^\top z$ |
| Policy | SAC | SAC |

Reward 모양은 같지만 constraint가 의미하는 metric이 다르다. **METRA는 LSD에 이름만 바꾼 것이 아니라, 같은 inner-product reward를 temporal metric에 연결하고 이를 WDM에서 다시 해석한 방법**이다.

Representation이 계속 바뀌므로 같은 replay transition의 intrinsic reward도 학습 중 달라질 수 있다. 일반적인 fixed task reward보다 critic target의 non-stationarity가 크다는 점은 구현에서 주의해야 한다.

## 9. 왜 Metric-Aware Abstraction인가?

Latent dimension이 2라고 해보자.

$$
\phi(s)\in\mathbb{R}^2
$$

실제 robot state에는 위치, 방향, 관절, 속도, 접촉, 물체 상태가 모두 들어갈 수 있다. 2차원에 전부 보존하는 것은 불가능하다.

METRA는 제한된 latent capacity를 다음 요소에 우선 사용하려 한다.

> 환경의 shortest path 기준으로 가장 길고 넓게 펼쳐진 controllable variation

![METRA temporal abstraction illustration](/assets/img/posts/rl/metra/02-temporal-abstraction.png){: width="1200" .d-block .mx-auto }

_64×64 RGB pixel state를 compact latent space로 압축하되, temporally close한 변화는 가깝게 두고 여러 step이 필요한 변화가 넓은 latent 방향을 차지하게 한다. 출처: [Park et al., Figure 1](https://arxiv.org/abs/2310.08887)._

평지 locomotion에서는 global position 변화가 수십, 수백 step에 걸쳐 누적되기 때문에 latent 주요 축으로 선택될 가능성이 높다. 반면 한두 step 안에 쉽게 바뀌는 작은 관절 자세는 압축될 수 있다.

논문은 이를 temporal PCA와 연결한다.

- 일반 PCA: Euclidean variance가 큰 축을 찾음
- METRA의 해석: Temporal manifold가 넓게 펼쳐진 축을 찾음

단, 공식 정리는 여러 단순화 아래 **linear squared METRA**가 temporal embedding space에서 PCA와 동등하다는 내용이다. 실제 nonlinear $\phi$가 항상 PCA처럼 동작한다는 일반 정리는 아니다.

## 10. Continuous skill과 discrete skill

### 10.1 Continuous skill

실험에서는 continuous skill을 표준 Gaussian에서 sample한다.

$$
z\sim\mathcal{N}(0,I)
$$

$z$는 latent displacement가 정렬될 방향과 크기를 제공한다. Ant와 Humanoid는 2-D, pixel Quadruped는 4-D continuous skill을 사용했다.

장점은 다음과 같다.

- Latent 방향을 연속적으로 선택할 수 있음
- Goal direction을 직접 skill command로 바꿀 수 있음
- High-level controller가 continuous action처럼 $z$를 선택할 수 있음

하지만 $z_1$과 $z_2$ 사이의 interpolation이 반드시 사람이 이해하는 중간 행동이라는 보장은 없다.

### 10.2 Discrete skill

Discrete setting은 zero-centered one-hot vector를 사용한다. $K$개 skill에서 $i$번째 code는 다음과 같다.

$$
[z_i]_j
=
\begin{cases}
1,&i=j\\
-\frac{1}{K-1},&i\ne j
\end{cases}
$$

따라서 prior mean은 0이다. HalfCheetah는 16개, Kitchen은 24개 discrete skill을 사용했다.

Discrete latent는 locomotion 방향뿐 아니라 static pose, flipping, 서로 다른 manipulation mode처럼 연속적인 한 축으로 표현하기 어려운 행동을 분리하기 쉽다.

## 11. Zero-shot goal reaching과 downstream controller

Representation $\phi$가 temporal structure를 학습했다면 현재 state $s$에서 goal $g$를 향하는 latent direction을 계산할 수 있다.

Continuous skill은 다음과 같다.

$$
z
=
\frac{\phi(g)-\phi(s)}
{\|\phi(g)-\phi(s)\|_2}
$$

Discrete skill은 차이가 가장 큰 dimension을 선택한다.

$$
z
=
\operatorname*{arg\,max}_{\mathrm{dim}}
\left(
\phi(g)-\phi(s)
\right)
$$

이 방법은 별도의 goal-conditioned policy 없이 skill을 고를 수 있다는 의미에서 zero-shot이다. 하지만 다음을 보장하지는 않는다.

- Obstacle을 고려한 최적 경로
- 모든 goal의 reachability
- Latent 직선과 실제 feasible path의 일치
- $\phi$가 버린 state information의 복원

논문의 downstream 평가는 zero-shot만 있는 것도 아니다. Frozen skill policy 위에 task reward를 받는 high-level controller

$$
\pi^h(z\mid s)
$$

를 학습하는 실험도 포함한다. 따라서 "METRA가 외부 task를 학습 없이 전부 해결했다"라고 쓰면 부정확하다.

## 12. 실험에서 무엇을 보여줬는가?

논문은 다섯 환경을 사용했다.

| Observation | Environment | Skill |
|---|---|---|
| State | Ant | 2-D continuous |
| State | HalfCheetah | 16 discrete |
| Pixel | DMC Quadruped | 4-D continuous |
| Pixel | DMC Humanoid | 2-D continuous |
| Pixel | Kitchen | 24 discrete |

Pixel observation은 $64\times64\times3$ camera image이며 frame stacking을 사용한다.

![METRA qualitative comparison](/assets/img/posts/rl/metra/03-qualitative-comparison.png){: width="1200" .d-block .mx-auto }

_11개 unsupervised RL 방법의 qualitative comparison. Locomotion은 skill별 global trajectory, Kitchen은 사전 정의된 여섯 task의 coincidental success를 표시한다. 논문 조건에서 METRA가 pixel Quadruped와 Humanoid에서 넓은 locomotion coverage를 보였다. 출처: [Park et al., Figure 3](https://arxiv.org/abs/2310.08887)._

공식 논문은 METRA가 비교한 방법 중 pixel-based Quadruped와 Humanoid에서 다양한 locomotion behavior를 발견한 유일한 방법이었다고 보고한다. 이 주장은 해당 benchmark, 구현, 학습 budget 안에서의 결과로 읽어야 한다.

<figure class="my-3">
  <img src="https://pub-7351ab7ce8d34a72861fbf2a7d06dd4c.r2.dev/assets/img/posts/rl/metra/14-humanoid-metra.gif" alt="Pixel-based Humanoid에서 학습된 16개 METRA skill" loading="eager" style="width: 100%; border-radius: 6px;">
  <figcaption class="text-center text-muted small mt-2">Pixel-based Humanoid에서 학습된 16개 METRA skill을 각각 두 번 실행한 모습. 출처: <a href="https://seohong.me/projects/metra/">METRA official project</a>.</figcaption>
</figure>

### 12.1 Pixel 실험의 중요한 조건

Quadruped와 Humanoid 환경은 위치를 image에서 추론할 수 있도록 gradient-colored floor를 사용했다.

<div class="row g-3 my-3">
  <div class="col-md-6">
    <img src="/assets/img/posts/rl/metra/04-quadruped-observation.png" alt="Quadruped pixel observation" style="width: min(100%, 480px); display: block; margin: 0 auto;">
    <p class="text-center text-muted small mt-2">Agent observation</p>
  </div>
  <div class="col-md-6">
    <img src="/assets/img/posts/rl/metra/05-quadruped-global-view.png" alt="Quadruped global environment view" style="width: min(100%, 480px); display: block; margin: 0 auto;">
    <p class="text-center text-muted small mt-2">Global environment view</p>
  </div>
</div>

_Gradient-colored floor가 위치 단서를 제공한다. 출처: [METRA official project](https://seohong.me/projects/metra/)._

이는 사소한 조건이 아니다. 시작과 끝에서 observation이 완전히 같다면 deterministic encoder는 두 상태를 다르게 표현할 근거가 없다.

~~~text
실제로 10 m 이동
+ observation에는 global position이나 visual landmark가 없음
+ 시작과 끝의 observation이 거의 같음
-> phi도 두 상태를 구별하기 어려움
~~~

따라서 "METRA는 어떤 visual cue도 없이 전역 위치를 스스로 복원했다"는 해석은 틀리다.

## 13. 이전 방법과 비교

| 방법 | 핵심 질문 | Distance 인식 | 대표 학습 신호 |
|---|---|---|---|
| DIAYN | 이 state는 어떤 skill이 만들었는가? | 없음 | $\log q(z\mid s)-\log p(z)$ |
| DADS | 이 skill은 어떤 transition을 만드는가? | Dynamics likelihood | Skill-conditioned likelihood ratio |
| CIC | 어떤 skill-transition이 구별되고 새로운가? | Contrastive similarity | CPC와 particle entropy |
| LSD | State Euclidean metric에서 얼마나 크게 이동했는가? | Euclidean state distance | $\Delta\phi^\top z$ + spectral normalization |
| METRA | Temporal metric에서 compact skill space를 얼마나 넓게 덮는가? | Temporal distance | $\Delta\phi^\top z$ + dual adjacency constraint |

METRA를 이들의 단순한 상위호환으로 읽으면 안 된다.

- DIAYN은 state distinguishability라는 명확한 목적을 가진다.
- DADS는 predictable transition과 skill-space planning을 강조한다.
- CIC는 general exploration benchmark를 위한 contrastive representation과 novelty를 사용한다.
- LSD는 잘 정의된 state feature에서 간단하고 직접적인 Euclidean constraint를 사용한다.
- METRA는 temporal metric을 이용해 high-dimensional observation으로 확장하려 한다.

## 14. 한계와 주의할 표현

### 14.1 Temporal distance는 비대칭일 수 있다

Latent Euclidean distance는 대칭이다.

$$
\|\phi(s)-\phi(g)\|_2
=
\|\phi(g)-\phi(s)\|_2
$$

하지만 실제 temporal distance는 비대칭일 수 있다.

~~~text
서 있는 상태 -> 넘어짐: 1 step
넘어진 상태 -> 일어남: 수십 step
~~~

METRA의 대칭 latent metric은 사실상 더 작은 양방향 distance에 묶인다.

$$
\|\phi(s)-\phi(g)\|_2
\le
\min
\left\{
d_{\mathrm{temp}}(s,g),
d_{\mathrm{temp}}(g,s)
\right\}
$$

논문은 이를 conservative abstraction이라고 설명하며 asymmetric quasimetric을 후속 방향으로 제시한다.

### 14.2 고정된 latent 방향으로 움직이는 behavior를 선호한다

$\psi(z)=z$로 단순화했고 episode 동안 $z$가 고정되므로 높은 return을 받으려면 같은 latent 방향으로 displacement를 누적하는 편이 유리하다.

이는 실제 state trajectory도 직선이어야 한다는 뜻은 아니다. Nonlinear $\phi$가 복잡한 gait cycle을 latent 직선으로 표현할 수 있다. 다만 다음 behavior는 endpoint displacement만으로 충분히 표현되지 않을 수 있다.

- 출발점으로 돌아오는 주기 행동
- 원을 그리는 행동
- 순서가 중요한 multi-stage manipulation
- 같은 endpoint를 갖는 서로 다른 경로

### 14.3 Abstraction은 의도적으로 정보를 버린다

METRA의 목표는 모든 state detail을 보존하는 representation learning이 아니다. Latent dimension이 작으면 gait phase, 접촉 순서, 작은 object state처럼 downstream task에 필요한 정보가 사라질 수 있다.

Temporal extent가 크다는 것과 모든 task에 유용하다는 것은 다르다.

### 14.4 큰 coverage가 안전한 행동을 의미하지 않는다

METRA reward에는 에너지, 충돌, 넘어짐, torque limit, thermal limit 같은 robot safety 기준이 자동으로 들어 있지 않다. 실제 robot에 적용하려면 별도의 safety constraint와 observation 설계가 필요하다.

### 14.5 Sample efficiency

논문은 단순성을 위해 vanilla SAC를 사용했고, pixel Quadruped와 Humanoid에서는 낮은 update-to-data ratio를 사용했다. 저자들도 wall-clock 성능과 별개로 sample efficiency에는 개선 여지가 있다고 명시한다.

## 15. 최종 정리

METRA의 논리를 순서대로 연결하면 다음과 같다.

1. Pure exploration으로 복잡한 state space 전체를 덮기는 어렵다.
2. MI는 behavior의 구별 가능성은 보지만 그 사이의 거리는 보지 않는다.
3. WDM은 underlying metric을 목적함수에 넣을 수 있다.
4. METRA는 full WDM을 inner-product endpoint objective로 단순화한다.
5. Telescoping sum으로 transition reward $\Delta\phi^\top z$를 얻는다.
6. Raw pixel L2 대신 minimum step 수인 temporal distance를 선택한다.
7. 모든 adjacent transition에서 latent displacement를 1 이하로 제한한다.
8. Triangle inequality가 multi-step state pair의 global upper bound를 만든다.
9. Directional objective가 collapse를 막고 temporally spread-out한 variation을 펼친다.
10. SAC policy와 dual-constrained representation을 함께 학습한다.
11. 학습된 latent direction은 zero-shot goal command나 high-level action으로 사용할 수 있다.
12. 하지만 결과는 observability, symmetric metric, latent capacity와 safety objective에 의존한다.

가장 중요한 식은 다음 하나다.

$$
\boxed{
\begin{aligned}
r_t^{\mathrm{METRA}}
&=
\left(
\phi(s_{t+1})-\phi(s_t)
\right)^\top z\\
\text{s.t.}\qquad
\|\phi(s_t)-\phi(s_{t+1})\|_2
&\le1
\end{aligned}
}
$$

한 문장으로 기억하면 다음과 같다.

> **METRA는 한 step의 latent 이동을 제한하면서, 각 skill 방향으로 여러 step의 displacement가 누적되게 만들어 temporal dynamics가 넓게 펼쳐진 behavior를 발견한다.**

## 참고 자료

- [Park et al., METRA: Scalable Unsupervised RL with Metric-Aware Abstraction](https://arxiv.org/abs/2310.08887)
- [ICLR 2024 OpenReview](https://openreview.net/forum?id=UtcuS52dwJ)
- [METRA official project and videos](https://seohong.me/projects/metra/)
- [METRA official implementation](https://github.com/seohongpark/METRA)
- [이전 글: LSD](/posts/lsd-lipschitz-constrained-skill-discovery/)
- [이전 글: DIAYN](/posts/diayn-diversity-is-all-you-need/)
- [이전 글: DADS](/posts/dads-dynamics-aware-skill-discovery/)
- [이전 글: CIC](/posts/cic-contrastive-intrinsic-control/)
