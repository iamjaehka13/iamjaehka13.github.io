---
title: "LSD: 정적인 구별 가능성에서 멀리 이동하는 스킬로"
date: 2026-07-22 15:08:00 +0900
categories: [RL, Study]
tags: [lsd, diayn, dads, unsupervised-reinforcement-learning, skill-discovery, lipschitz-continuity, spectral-normalization, soft-actor-critic, zero-shot-control]
description: "Lipschitz-constrained Skill Discovery가 기존 mutual-information 기반 스킬의 정적인 해를 어떻게 벗어나는지, Gaussian 목적함수 분해부터 방향성 보상, spectral normalization, zero-shot goal reaching과 한계까지 정리한다."
math: true
image:
  path: /assets/img/posts/rl/lsd/00-lsd-preview.png
  alt: LSD로 학습된 여러 방향의 Ant continuous skill
---

[DIAYN](/posts/diayn-diversity-is-all-you-need/)은 상태를 보고 실행된 skill을 구별할 수 있게 만들었다. [DADS](/posts/dads-dynamics-aware-skill-discovery/)는 현재 상태와 skill로 다음 상태를 예측하게 만들어 반복 가능하고 계획 가능한 변화를 찾았다. 두 방법 모두 unsupervised skill discovery의 중요한 기준을 제시했지만, 한 가지 질문은 그대로 남는다.

> **서로 구별되기만 하면 충분한가, 아니면 실제로 크게 움직여야 하는가?**

Mutual information은 두 skill이 아주 조금만 다른 상태를 만들어도 충분히 높아질 수 있다. Ant가 멀리 걷지 않고 제자리에서 관절 자세만 다르게 만드는 것이 대표적인 쉬운 해다. Skill 번호는 잘 맞힐 수 있지만, locomotion이나 넓은 탐색에 바로 쓰기는 어렵다.

LSD, **Lipschitz-constrained Skill Discovery**는 목표를 다음처럼 바꾼다.

> Skill $z$를 표현공간에서의 **이동 방향**으로 만들고, 그 방향으로 가능한 한 크게 이동하라. 단, 표현 함수가 실제 상태 차이를 과장해서는 안 된다.

이 글을 한 문장으로 압축하면 다음과 같다.

> **LSD는 $z$와 표현 변화 $\phi(s_T)-\phi(s_0)$의 방향을 맞추고, 1-Lipschitz 제약으로 큰 latent 이동이 실제 state variation을 동반하게 만든다.**

## 0. 먼저 눈으로 보는 DIAYN과 LSD의 차이

논문 프로젝트 페이지가 제공하는 Ant continuous-skill 비교부터 보자. 두 영상은 같은 2차원 latent 방향들을 두 번씩 실행한다.

<div class="row g-3 my-3">
  <div class="col-md-6">
    <p class="fw-semibold mb-2">DIAYN: 주로 제자리 자세 차이</p>
    <video autoplay loop muted playsinline controls preload="metadata" poster="/assets/img/posts/rl/lsd/01-ant-continuous-diayn-poster.jpg" style="width: 100%; border-radius: 6px;">
      <source src="/assets/img/posts/rl/lsd/01-ant-continuous-diayn.mp4" type="video/mp4">
    </video>
  </div>
  <div class="col-md-6">
    <p class="fw-semibold mb-2">LSD: 방향별로 멀리 이동</p>
    <video autoplay loop muted playsinline controls preload="metadata" poster="/assets/img/posts/rl/lsd/02-ant-continuous-lsd-poster.jpg" style="width: 100%; border-radius: 6px;">
      <source src="/assets/img/posts/rl/lsd/02-ant-continuous-lsd.mp4" type="video/mp4">
    </video>
  </div>
</div>

_공식 프로젝트 페이지의 Ant 2-D continuous-skill 비교. DIAYN의 MI 목적은 작은 자세 차이로도 skill을 구별할 수 있지만, LSD는 실제 state variation을 키우도록 설계됐다. 출처: [Park et al., LSD project](https://seohong.me/projects/lsd/)._

여기서 중요한 것은 "DIAYN은 항상 정지하고 LSD는 항상 걷는다"가 아니다. 정확한 주장은 다음과 같다.

- 일반적인 MI 목적은 **큰 이동을 특별히 더 선호하지 않는다**.
- 따라서 feature engineering이 없으면 작은 자세 차이가 더 쉬운 최적화 해가 될 수 있다.
- LSD는 목적함수 자체에 latent displacement의 크기를 키우는 압력을 넣는다.

## 1. 논문 정보

| 항목 | 내용 |
|---|---|
| Title | Lipschitz-constrained Unsupervised Skill Discovery |
| Authors | Seohong Park, Jongwook Choi, Jaekyeom Kim, Honglak Lee, Gunhee Kim |
| Venue | ICLR 2022 |
| 문제 | 외부 task reward 없이 dynamic하고 far-reaching한 skill 발견 |
| Policy | $\pi_\theta(a\mid s,z)$ |
| Representation | $\phi:S\rightarrow Z$ |
| 핵심 목적 | $z$와 $\phi(s_T)-\phi(s_0)$의 방향 정렬 |
| Constraint | $\phi$에 대한 1-Lipschitz 제약 |
| Policy optimizer | SAC |
| Skill | Continuous와 discrete 모두 제시 |
| Downstream | Hierarchical fine-tuning, zero-shot goal following |
| Source | [arXiv](https://arxiv.org/abs/2202.00914), [OpenReview](https://openreview.net/forum?id=BGvt0ghNgA), [Official project](https://seohong.me/projects/lsd/), [Official code](https://github.com/seohongpark/LSD) |

논문이 강조하는 것은 단순한 state coverage뿐만이 아니다. 학습한 $\phi$에서 목표 방향을 바로 계산해 별도 planning이나 추가 학습 없이 goal-following에 사용할 수 있다는 점도 핵심 결과다.

## 2. 왜 MI는 정적인 skill에도 만족할 수 있는가?

Continuous skill을 사용하는 DIAYN류 목적을 단순화하면 다음과 같다.

$$
I(Z;S)
\ge
\mathbb{E}_{z,s}[\log q(z\mid s)] + H(Z)
$$

Posterior를 단위 공분산 Gaussian으로 두자.

$$
q(z\mid s)=\mathcal{N}(z;\mu(s),I)
$$

그러면 log-likelihood는 상수를 제외하면 다음 squared error가 된다.

$$
\log q(z\mid s)
=
-\frac{1}{2}\|z-\mu(s)\|_2^2 + C
$$

이 목적이 원하는 것은 상태에서 skill $z$를 복원하는 것이다. $mu(s)=z$가 되면 이미 최적이다. 그 상태가 시작점에서 1 cm 떨어졌는지 10 m 떨어졌는지는 직접 묻지 않는다.

예를 들어 Ant의 각 skill이 다음과 같이 다른 관절 자세를 만든다고 하자.

```text
z1 -> 앞다리를 조금 굽힘
z2 -> 뒷다리를 조금 벌림
z3 -> 몸통을 약간 낮춤
```

Discriminator는 이 차이만으로 $z$를 맞힐 수 있다. MI 관점에서는 성공이지만, 이동 skill 관점에서는 만족스럽지 않을 수 있다.

이것이 LSD가 지적한 **lower-hanging fruit**다. 멀리 이동하는 안정적인 locomotion을 배우는 것보다 제자리 자세를 조금 바꾸는 편이 먼저 학습되기 쉽다.

## 3. $z$를 표현공간의 이동 방향으로 바꾸기

LSD는 조건부 MI 형태에서 아이디어를 끌어낸다.

$$
I(Z;S_T\mid S_0)
$$

시작 상태와 최종 상태를 보고 skill을 추론하는 posterior를 다음처럼 둔다.

$$
q(z\mid s_0,s_T)
=
\mathcal{N}
\left(
z;
\phi(s_T)-\phi(s_0),
I
\right)
$$

여기서

$$
\Delta\phi=\phi(s_T)-\phi(s_0)
$$

라고 쓰면 Gaussian log-likelihood는 다음과 같다.

$$
\log q(z\mid s_0,s_T)
=
-\frac{1}{2}\|z-\Delta\phi\|_2^2+C
$$

제곱을 전개해 보자.

$$
-\frac{1}{2}
\left(
\|z\|^2-2z^\top\Delta\phi+\|\Delta\phi\|^2
\right)
$$

$p(z)$가 고정돼 있으므로 기대값에서 $\|z\|^2$ 항은 상수로 볼 수 있다. 남는 핵심은 두 항이다.

$$
z^\top\Delta\phi
-
\frac{1}{2}\|\Delta\phi\|^2
$$

| 항 | 역할 |
|---|---|
| $z^\top\Delta\phi$ | 표현 변화 방향을 skill $z$와 정렬한다. |
| $-\frac{1}{2}\|\Delta\phi\|^2$ | 표현 변화의 크기가 무한히 커지지 않게 제한한다. |

미분해 보면 더 명확하다.

$$
\frac{\partial}{\partial\Delta\phi}
\left(
z^\top\Delta\phi-\frac{1}{2}\|\Delta\phi\|^2
\right)
=z-\Delta\phi
$$

따라서 최적점은

$$
\Delta\phi=z
$$

다. 즉 원래 Gaussian 목적은 **방향뿐 아니라 크기까지 $z$에 맞추려 한다**. $z$의 크기만큼 이동하고 나면 더 멀리 갈 이유가 없다.

## 4. LSD는 왜 quadratic penalty를 제거했는가?

LSD는 위 두 항 중 방향 정렬 항만 남긴다.

$$
J^{\mathrm{LSD}}
=
\mathbb{E}_{z,\tau}
\left[
(\phi(s_T)-\phi(s_0))^\top z
\right]
$$

이제 $\Delta\phi$가 $z$ 방향으로 정렬되어 있다면 크기가 커질수록 목적함수도 계속 커진다.

```text
Gaussian MI objective
Delta phi를 z와 같은 벡터로 맞춤

LSD objective
Delta phi를 z 방향으로 정렬하고 가능한 한 크게 만듦
```

이 지점에서 LSD는 더 이상 MI lower bound를 최적화하는 방법이 아니다. **MI를 분해해 얻은 directional term에서 영감을 받았지만, 최종 목적은 log-probability도 mutual information도 아니다.**

![LSD direction-alignment objective](/assets/img/posts/rl/lsd/09-lsd-objective.svg){: width="1150" .d-block .mx-auto }
_$z$와 $\Delta\phi$의 내적을 키우되, 표현공간의 거리가 실제 state-space 거리보다 커질 수 없게 제한한다._

## 5. 제약이 없으면 $\phi$가 reward를 조작한다

방향 항만 남기면 새로운 문제가 생긴다. Policy가 실제로 더 움직이지 않아도 표현 함수의 출력 scale만 키우면 된다.

$$
\phi'(s)=c\phi(s),\qquad c\gg1
$$

그러면 같은 transition에서도

$$
z^\top(\phi'(s_T)-\phi'(s_0))
=
c\,z^\top(\phi(s_T)-\phi(s_0))
$$

가 되어 reward를 임의로 키울 수 있다. 이는 policy가 좋은 skill을 배운 것이 아니라 reward model이 단위를 부풀린 것이다.

LSD는 이를 막기 위해 $\phi$를 1-Lipschitz로 제한한다.

$$
\forall x,y\in S,\qquad
\|\phi(x)-\phi(y)\|_2
\le
\|x-y\|_2
$$

이 식의 의미는 간단하다.

> $\phi$는 두 state 사이의 거리를 실제보다 크게 과장할 수 없다.

코시-슈바르츠 부등식을 적용하면 한 transition의 reward에는 다음 upper bound가 생긴다.

$$
\begin{aligned}
r_t
&=z^\top(\phi(s_{t+1})-\phi(s_t))\\
&\le \|z\|\,\|\phi(s_{t+1})-\phi(s_t)\|\\
&\le \|z\|\,\|s_{t+1}-s_t\|
\end{aligned}
$$

따라서 작은 실제 변화에서 큰 reward를 얻기 위해 $\phi$만 확대하는 경로가 막힌다.

### 5.1 Lipschitz는 거리 보존이 아니다

여기서 가장 주의해야 할 부분이다.

$$
\|\Delta\phi\|\le\|\Delta s\|
$$

는 expansion만 막는다. 다음은 여전히 가능하다.

$$
\|\Delta s\|=100,\qquad \|\Delta\phi\|=0
$$

즉 $\phi$는 실제로 큰 차이를 무시하거나 강하게 축소할 수 있다. LSD가 요구하는 것은 isometry나 거리 보존이 아니라 **거리 과장 방지**다.

## 6. Spectral normalization은 무엇을 제한하는가?

논문은 1-Lipschitz 제약을 구현하기 위해 spectral normalization을 사용한다.

선형층

$$
f(x)=Wx+b
$$

에서 두 출력의 차이는 bias가 소거되어

$$
f(x_1)-f(x_2)=W(x_1-x_2)
$$

가 된다. 이 선형층이 입력 차이를 최대 몇 배까지 늘릴 수 있는지는 spectral norm으로 측정한다.

$$
\sigma(W)
=
\max_{\|v\|_2=1}\|Wv\|_2
$$

이는 $W$의 가장 큰 singular value다. Spectral normalization은 weight를 다음처럼 바꾼다.

$$
\bar W=\frac{W}{\sigma(W)}
$$

그러면

$$
\sigma(\bar W)=1
$$

이 되어 그 선형층의 최대 확대율이 1로 제한된다.

### 6.1 숫자로 보는 예시

$$
W=
\begin{bmatrix}
3&0\\
0&0.5
\end{bmatrix}
$$

이 행렬은 첫 번째 축을 3배, 두 번째 축을 0.5배로 바꾼다. 가장 큰 singular value는 3이다.

$$
\bar W
=
\frac{1}{3}W
=
\begin{bmatrix}
1&0\\
0&1/6
\end{bmatrix}
$$

모든 singular value가 1이 되는 것은 아니다. 최대값만 1이 되고 나머지는 같은 비율로 줄어든다. 따라서 spectral normalization은 orthogonalization이 아니다.

### 6.2 여러 층을 연결하면

MLP가 선형층과 ReLU처럼 1-Lipschitz activation으로 구성되어 있다면 전체 Lipschitz 상수는 각 층의 상수 곱으로 upper-bound할 수 있다.

$$
\operatorname{Lip}(\phi)
\le
\prod_l\sigma(W_l)
\prod_l\operatorname{Lip}(\rho_l)
$$

모든 선형층의 spectral norm을 1로 제한하고 activation도 1-Lipschitz라면 전체 네트워크는 at most 1-Lipschitz가 된다.

실제 구현에서는 가장 큰 singular value를 full SVD로 매번 계산하지 않고 power iteration으로 추정한다. 따라서 다음을 구분해야 한다.

- 수학적으로 정확한 spectral norm과 적절한 단순 구조라면 Lipschitz upper bound가 성립한다.
- 실제 학습에서는 spectral norm 추정 오차가 있다.
- Residual sum, normalization layer, 미정규화 branch가 있다면 전체 상수를 별도로 계산해야 한다.
- 각 층의 곱은 실제 global Lipschitz constant에 대한 보수적인 upper bound일 수 있다.

LSD에서 spectral normalization의 주목적은 단순한 학습 안정화가 아니다. **Reward를 만드는 latent distance를 실제 state variation에 묶는 것**이다.

## 7. Episode 목적을 step reward로 바꾸기

LSD 목적은 telescoping sum으로 정확히 분해된다.

$$
\begin{aligned}
\phi(s_T)-\phi(s_0)
&=\sum_{t=0}^{T-1}
\left(\phi(s_{t+1})-\phi(s_t)\right)
\end{aligned}
$$

따라서

$$
J^{\mathrm{LSD}}
=
\mathbb{E}_{z,\tau}
\left[
\sum_{t=0}^{T-1}
z^\top
(\phi(s_{t+1})-\phi(s_t))
\right]
$$

이고 한 step의 intrinsic reward는 다음과 같다.

$$
r_t^{\mathrm{LSD}}
=
z^\top
\left(
\phi(s_{t+1})-\phi(s_t)
\right)
$$

이 reward는 매 transition마다 계산할 수 있으므로 SAC 같은 off-policy RL 알고리즘에 바로 넣을 수 있다.

### 7.1 경로 길이를 최대화하는가?

엄밀히는 아니다. Step reward를 모두 더하면 중간 항이 상쇄되어 시작점과 끝점의 representation displacement가 된다.

```text
앞으로 이동 -> 양의 reward
다시 뒤로 복귀 -> 앞에서 얻은 reward가 상쇄
```

따라서 LSD는 무작정 오래 돌아다닌 path length보다 **skill 방향으로 누적된 순변위**를 선호한다. 논문에서 말하는 far-reaching을 "총 이동 거리"라고만 번역하면 이 차이를 놓칠 수 있다.

## 8. 실제 학습에서는 무엇이 업데이트되는가?

LSD에는 크게 두 학습 대상이 있다.

| 구성 요소 | 입력 | 역할 |
|---|---|---|
| Policy $\pi_\theta(a\mid s,z)$ | state와 skill | 해당 $z$ 방향의 변화를 만드는 action 선택 |
| Representation $\phi_\psi(s)$ | state | reward에 사용할 latent state 표현 생성 |

학습 흐름은 다음과 같다.

![LSD training loop](/assets/img/posts/rl/lsd/10-lsd-training-loop.svg){: width="1150" .d-block .mx-auto }
_Episode마다 $z$를 뽑아 고정하고, transition의 표현 차이로 reward를 만든다. $\phi$는 spectral normalization 아래 SGD로, policy는 SAC로 번갈아 갱신한다._

```text
1. z ~ p(z)를 sample하고 episode 동안 고정
2. pi(a | s, z)로 trajectory 수집
3. r_t = z^T(phi(s_{t+1}) - phi(s_t)) 계산
4. spectral normalization 아래 phi 업데이트
5. intrinsic reward로 SAC actor와 critic 업데이트
```

Policy가 $\phi$를 거쳐 environment까지 직접 미분되는 것은 아니다. $\phi$가 scalar reward를 만들고, critic이 그 장기 return을 학습하며, actor는 critic을 통해 간접적으로 업데이트된다.

Representation과 policy가 동시에 학습되므로 $z$의 의미도 사전에 정해져 있지 않다.

```text
초기 random transition 차이
        ↓
phi가 z와 정렬되는 차이를 표현
        ↓
그 차이에 intrinsic reward 부여
        ↓
policy가 해당 변화를 더 크게 반복
        ↓
z 방향의 행동 의미가 형성
```

## 9. Continuous LSD와 discrete LSD

### 9.1 Continuous LSD

논문의 주요 continuous 실험은 보통

$$
z\sim\mathcal{N}(0,I),\qquad z\in\mathbb{R}^2
$$

를 사용한다. $z$의 각 방향이 $\phi$ 공간의 이동 방향과 대응한다. 가까운 방향의 $z$가 가까운 이동 방향을 만들 가능성은 있지만, 다음을 보장하지는 않는다.

$$
\pi(\cdot\mid s,z_1+z_2)
=
\pi(\cdot\mid s,z_1)+\pi(\cdot\mid s,z_2)
$$

즉 continuous latent는 보간 가능한 조건 공간이지, 독립 행동의 엄밀한 선형 합성 공간이 아니다.

### 9.2 Discrete LSD는 왜 일반 one-hot을 쓰지 않는가?

일반 one-hot code는 모든 skill code의 평균이 0이 아니다. LSD의 inner-product reward에서는 이 공통 평균 방향을 따라 모든 skill이 같은 먼 상태로 가는 collapse가 가능하다.

그래서 논문은 zero-centered one-hot code를 사용한다.

$$
[z_i]_j=
\begin{cases}
1,&i=j\\
-\frac{1}{N-1},&i\ne j
\end{cases}
$$

모든 skill code의 평균은 0이 된다. $k$번째 skill reward는 다음처럼 해석할 수 있다.

$$
r_k
=
\Delta\phi_k
-
\frac{1}{N-1}
\sum_{i\ne k}\Delta\phi_i
$$

즉 자기 차원의 변화는 키우고 다른 skill 차원의 변화와 대비한다.

<figure class="my-3">
  <video autoplay loop muted playsinline controls preload="metadata" poster="/assets/img/posts/rl/lsd/04-ant-discrete-skills-poster.jpg" style="width: 100%; border-radius: 6px;">
    <source src="/assets/img/posts/rl/lsd/04-ant-discrete-skills.mp4" type="video/mp4">
  </video>
  <figcaption class="text-center text-muted small mt-2">Ant에서 한 번의 discrete LSD 학습으로 얻은 locomotion, rotation, posing, flipping 계열의 16개 skill. 출처: <a href="https://seohong.me/projects/lsd/">LSD official project</a>.</figcaption>
</figure>

논문은 continuous LSD가 주로 locomotion을 발견한 반면, discrete LSD는 더 다양한 종류의 행동을 발견했다고 보고한다.

## 10. Zero-shot goal following

LSD에서는 $z$가 representation displacement의 방향과 정렬된다. 현재 상태 $s$에서 목표 상태 $g$로 가고 싶다면 다음 skill을 선택한다.

$$
z
=
\alpha
\frac{\phi(g)-\phi(s)}
{\|\phi(g)-\phi(s)\|}
$$

그리고 매 step 또는 control decision마다 현재 상태에서 목표 방향을 다시 계산해 policy에 넣는다.

```text
현재 state s와 goal state g
        ↓
phi(g) - phi(s)의 방향 계산
        ↓
그 방향을 z로 선택
        ↓
pi(a | s, z) 실행
        ↓
새 상태에서 방향 재계산
```

<figure class="my-3">
  <video autoplay loop muted playsinline controls preload="metadata" poster="/assets/img/posts/rl/lsd/03-zero-shot-goal-following-poster.jpg" style="width: min(100%, 620px); border-radius: 6px; display: block; margin: 0 auto;">
    <source src="/assets/img/posts/rl/lsd/03-zero-shot-goal-following.mp4" type="video/mp4">
  </video>
  <figcaption class="text-center text-muted small mt-2">학습된 $\phi$의 목표 방향을 사용해 spiral 형태의 여러 목표를 순서대로 따라가는 Ant. 영상은 4배속이다. 출처: <a href="https://seohong.me/projects/lsd/">LSD official project</a>.</figcaption>
</figure>

이 방식은 DADS처럼 skill dynamics model로 후보 sequence를 planning하지 않는다. 하지만 "아무 조건 없이 모든 목표를 해결한다"는 뜻도 아니다.

- 목표 $g$에 대해 $\phi(g)$를 계산할 수 있어야 한다.
- 학습된 policy가 해당 representation 방향을 실제로 따라갈 수 있어야 한다.
- Goal이 reachable region 밖에 있으면 방향을 계산해도 도달은 보장되지 않는다.
- Partial goal만 주어지고 완전한 state $g$를 만들 수 없다면 별도 goal representation이 필요하다.

## 11. 실험 결과는 무엇을 보여주는가?

논문은 Ant, Humanoid, HalfCheetah locomotion과 FetchPush, FetchSlide, FetchPickAndPlace manipulation 환경을 사용했다. Locomotion state 차원은 scale 영향을 줄이기 위해 정규화했고, 주요 continuous 설정은 2차원 Gaussian skill이다. 실험은 8개 run으로 반복하고 95% confidence interval을 보고했다.

### 11.1 Continuous skill trajectory

![Continuous skill trajectories](/assets/img/posts/rl/lsd/05-continuous-skill-trajectories.png){: width="1150" .d-block .mx-auto }
_Ant와 Humanoid의 continuous skill trajectory. LSD는 feature engineering 없이 여러 방향으로 넓은 이동 범위를 만들었다. 각 plot의 축 범위가 같다는 점을 함께 확인해야 한다. 출처: [Park et al., Figure 2](https://arxiv.org/abs/2202.00914)._

DIAYN, DADS 등 일부 baseline에 `-XYO`가 붙은 것은 locomotion을 유도하는 feature engineering을 사용한 변형이다. LSD는 hand-engineered x-y discriminator input 없이 비교했다.

### 11.2 State-space coverage

![State space coverage](/assets/img/posts/rl/lsd/06-state-space-coverage.png){: width="1000" .d-block .mx-auto }
_200개 trajectory가 차지한 x-y plane의 $1\times1$ bin 수로 계산한 coverage. 별표가 붙은 방법은 feature engineering을 사용했다. 논문 실험에서 LSD가 Ant와 Humanoid 모두 가장 높은 coverage를 보였다. 출처: [Park et al., Figure 3](https://arxiv.org/abs/2202.00914)._

Coverage가 높다는 사실만으로 모든 행동이 안정적이거나 실용적이라는 뜻은 아니다. 이 metric은 x-y 공간을 얼마나 넓게 차지했는지를 측정한다.

### 11.3 Goal-following downstream task

![Downstream goal results](/assets/img/posts/rl/lsd/07-downstream-goal-results.png){: width="1000" .d-block .mx-auto }
_AntGoal, AntMultiGoals, HumanoidGoal, HumanoidMultiGoals 결과. 실선 LSD는 학습한 skill policy 위에 meta-controller를 학습한 결과이고, 점선 LSD Zero-shot은 $\phi(g)-\phi(s)$ 방향을 바로 사용한다. 출처: [Park et al., Figure 5](https://arxiv.org/abs/2202.00914)._

논문 조건에서 LSD는 네 goal-following 환경의 최종 reward가 가장 높았고, AntMultiGoals에서는 zero-shot skill selection도 강한 결과를 보였다. 여기서 zero-shot은 **downstream policy를 추가 학습하지 않았다**는 뜻이지, 목표 상태나 사전학습된 $\phi$ 없이 동작한다는 뜻은 아니다.

### 11.4 Ablation이 보여주는 핵심

![LSD ablation](/assets/img/posts/rl/lsd/08-ablation.png){: width="1000" .d-block .mx-auto }
_Reward 형태, 현재·다음 state 표현 방식, 1-Lipschitz 제약을 조합한 Ant ablation. 오른쪽 아래의 inner product + representation difference + Lipschitz constraint 조합에서 넓은 coverage가 나타났다. 출처: [Park et al., Figure 7](https://arxiv.org/abs/2202.00914)._

이 결과에서 특히 중요한 점은 **DIAYN에 spectral normalization만 추가해도 LSD가 되지 않는다**는 것이다.

```text
Spectral normalization만 있음
-> representation 확대는 제한
-> 그러나 멀리 이동하라는 목적은 없음

LSD 전체 조합
-> inner product가 방향과 크기를 밀어줌
-> Delta phi가 transition 변화를 표현
-> Lipschitz가 허위 scale 확대를 차단
```

논문은 세 요소 중 하나라도 제거하면 coverage가 크게 줄었다고 보고한다.

## 12. DIAYN, DADS, CIC, LSD를 한 표로 비교하기

| 방법 | 핵심 질문 | 학습 신호 | 잘하는 것 | 직접 보장하지 않는 것 |
|---|---|---|---|---|
| DIAYN | 이 상태는 어떤 skill이 만들었는가? | $\log q(z\mid s)-\log p(z)$ | 구별되는 state visitation | 큰 이동, transition predictability |
| DADS | 이 skill은 현재 상태에서 어떤 변화를 만드는가? | skill-conditioned dynamics likelihood ratio | 예측 가능한 transition과 skill-space planning | 표현 거리의 큰 변화 |
| CIC | 어떤 skill-transition 표현이 구별되고 새로운가? | contrastive representation과 k-NN entropy | 고차원 continuous skill, URLB pretraining | 각 $z$의 사람 기준 의미와 고유성 |
| LSD | $z$ 방향으로 얼마나 크게 이동했는가? | $z^\top(\phi(s')-\phi(s))$ | dynamic, far-reaching skill과 방향 기반 goal control | semantic usefulness, 정확한 행동 합성 |

이들을 상위호환 관계로 읽으면 안 된다.

- DIAYN은 state distinguishability를 직접 최적화한다.
- DADS는 transition predictability와 planning을 중시한다.
- CIC는 general reward-free exploration benchmark에 맞춘 contrastive representation과 entropy를 사용한다.
- LSD는 state variation의 크기와 방향을 직접 밀어준다.

무엇이 더 좋은지는 downstream task와 원하는 skill의 성질에 따라 달라진다.

## 13. LSD의 한계와 주의할 표현

### 13.1 Euclidean observation distance가 곧 행동 의미는 아니다

LSD의 제약은 다음 state-space norm을 기준으로 한다.

$$
\|s'-s\|_2
$$

State에 위치, 관절각, 속도, 방향이 함께 들어 있으면 어떤 차원이 큰지에 따라 발견되는 skill도 달라진다. 논문도 locomotion 환경에서 state dimension을 정규화했다.

따라서 LSD가 발견한 행동은 "물리적으로 가장 멀리 이동하는 행동"이라기보다 **정의한 normalized observation metric에서 큰 변화를 만드는 행동**이다.

### 13.2 Pixel space에는 바로 적용하기 어렵다

두 이미지의 Euclidean pixel distance가 제어 관점의 의미 있는 거리를 나타내지는 않는다. 조명 변화나 배경 texture가 크게 달라질 수 있기 때문이다. 논문도 pixel observation처럼 Lipschitz 기준이 semantically meaningful하지 않은 환경을 한계로 명시한다.

### 13.3 Continuous LSD는 magnitude를 충분히 사용하지 않는다

Continuous LSD의 핵심은 $z$의 방향 정렬이다. 논문은 continuous setting이 주로 멀리 이동하는 locomotion skill을 발견하며, $z$ magnitude까지 행동 세기로 의미 있게 사용하는 것은 후속 과제로 남긴다.

### 13.4 큰 변화가 곧 유용하거나 안전한 행동은 아니다

LSD reward에는 다음이 자동으로 들어 있지 않다.

- 에너지 효율
- 넘어짐 방지
- 충돌 회피
- actuator limit과 thermal constraint
- 인간이 원하는 semantic behavior

로봇에 적용한다면 task-independent safety constraint나 regularization을 별도로 설계해야 한다. 큰 state variation만 밀면 뒤집기나 불안정한 관절 동작도 목적함수 관점에서는 좋은 skill일 수 있다.

### 13.5 Zero-shot은 보장 정리가 아니다

$\phi(g)-\phi(s)$ 방향을 선택하는 규칙은 매우 간단하고 강력하지만, 모든 환경에서 목표 도달을 보장하는 controller는 아니다. Representation의 geometry, policy의 controllability, obstacle과 dynamics가 맞아야 한다.

## 14. 다음 논문으로 이어지는 질문

LSD를 이해하고 나면 다음 질문이 자연스럽게 남는다.

> 두 state의 차이를 observation-space Euclidean distance로 재는 것이 정말 최선인가?

관측값은 크게 다르지만 한 step 만에 쉽게 오갈 수 있는 상태가 있을 수 있다. 반대로 관측값은 비슷해 보여도 환경 dynamics상 도달하기 매우 어려운 상태가 있을 수 있다.

LSD는 대략 다음 metric에 묶여 있다.

$$
d_{\mathrm{LSD}}(s,s')=\|s-s'\|_2
$$

후속 연구인 METRA는 이 기준을 **환경 dynamics에서의 temporal distance**와 연결하는 방향으로 확장한다.

```text
LSD
관측 공간에서 실제보다 거리를 과장하지 마라

METRA
환경에서 서로 도달하기 어려운 상태를 더 멀게 표현하라
```

이 차이는 다음 글에서 별도로 다루는 편이 맞다. LSD 글의 결론은 Euclidean metric의 한계를 인정하되, METRA의 해법까지 미리 전개하지 않는 것이다.

## 15. 최종 정리

LSD의 논리를 순서대로 다시 연결하면 다음과 같다.

1. MI 기반 skill discovery는 작은 state 차이만으로도 skill을 구별할 수 있다.
2. Gaussian posterior를 분해하면 방향 정렬 항과 크기 penalty가 나타난다.
3. LSD는 크기 penalty를 제거하고 $z^\top\Delta\phi$만 최대화한다.
4. 그대로 두면 $\phi$가 scale을 키워 reward를 조작할 수 있다.
5. 1-Lipschitz 제약이 latent distance의 과장을 막는다.
6. Spectral normalization은 각 선형층의 최대 확대율을 제한한다.
7. Telescoping sum으로 per-step intrinsic reward를 얻는다.
8. SAC policy와 representation $\phi$를 번갈아 학습한다.
9. 학습된 방향 구조로 zero-shot goal skill을 선택할 수 있다.
10. 그러나 결과는 observation metric과 state normalization에 의존한다.

가장 중요한 식은 하나다.

$$
\boxed{
r_t^{\mathrm{LSD}}
=
z^\top
\left(
\phi(s_{t+1})-\phi(s_t)
\right),
\qquad
\|\phi(x)-\phi(y)\|
\le
\|x-y\|
}
$$

한 문장으로 기억하면 다음과 같다.

> **LSD는 skill을 latent 이동 방향으로 만들고, 표현 함수가 거리를 속이지 못하게 한 상태에서 그 방향의 실제 변화를 최대화한다.**

## 참고 자료

- [Park et al., Lipschitz-constrained Unsupervised Skill Discovery](https://arxiv.org/abs/2202.00914)
- [ICLR 2022 OpenReview](https://openreview.net/forum?id=BGvt0ghNgA)
- [LSD official project and videos](https://seohong.me/projects/lsd/)
- [LSD official code](https://github.com/seohongpark/LSD)
- [이전 글: DIAYN](/posts/diayn-diversity-is-all-you-need/)
- [이전 글: DADS](/posts/dads-dynamics-aware-skill-discovery/)
- [이전 글: CIC](/posts/cic-contrastive-intrinsic-control/)
