---
title: "MCP: 여러 Motor Primitive를 곱해 행동을 조합하기"
date: 2026-07-24 23:10:00 +0900
categories: [RL, Study]
tags: [mcp, multiplicative-compositional-policies, product-of-experts, hierarchical-reinforcement-learning, motor-primitives, motion-imitation, transfer-learning, ppo, robotics, humanoid-control]
description: "MCP가 Gaussian motor primitive를 곱해 한 timestep에서 여러 운동 요소를 조합하고, motion imitation으로 배운 primitive를 새 task에 전달하는 원리를 정리한다."
math: true
image:
  path: /assets/img/posts/rl/mcp/00-mcp-preview.png
  alt: 여러 motor primitive의 공통 action 영역을 찾는 Multiplicative Compositional Policies
---

이전 [SF + GPI 글](/posts/successor-features-gpi-transfer/)에서는 이미 학습한 policy들을 **value 수준**에서 새 reward에 맞게 재평가하는 방법을 살펴봤다. 그런데 기존 policy 하나를 선택하는 것만으로는 부족한 task도 있다.

예를 들어 humanoid가 상자를 운반하려면 같은 순간에 다음 동작이 함께 필요하다.

```text
균형을 유지한다
목표 방향으로 걷는다
두 팔로 상자를 고정한다
상자의 흔들림에 맞춰 자세를 보정한다
```

`걷기`, `균형 잡기`, `물체 들기` 중 하나만 고르는 문제가 아니다. 여러 운동 요소를 **한 timestep에서 동시에 협응**해야 한다.

**MCP, Multiplicative Compositional Policies**는 이 문제를 다음 관점으로 푼다.

> 여러 primitive 중 하나를 선택하지 말고, 여러 primitive의 action distribution을 곱해 모두가 함께 허용하는 하나의 action distribution을 만들자.

한 문장으로 먼저 정리하면 다음과 같다.

> **MCP는 motion imitation으로 재사용 가능한 Gaussian motor primitive를 학습하고, 새 task에서는 goal-conditioned gate가 primitive들을 precision-weighted product로 조합하도록 만든다.**

## 0. 먼저 결과부터 보기

![MCP가 수행한 T-Rex dribbling, biped box carrying, humanoid heading task](/assets/img/posts/rl/mcp/01-paper-teaser.png){: width="1400" .d-block .mx-auto }

_왼쪽부터 T-Rex의 공 dr리블, biped의 상자 운반, humanoid의 heading control이다. 파란 선은 이동 궤적이다. 출처: [MCP 공식 프로젝트 페이지](https://xbpeng.github.io/projects/MCP/)._

논문은 14-DoF Ant, 23-DoF biped, 34-DoF humanoid, 55-DoF T-Rex를 대상으로 실험했다. 가장 어려운 실험은 T-Rex가 접촉 동역학을 이용해 공을 목표 지점까지 드리블하는 task였다.

<div class="ratio ratio-16x9">
  <iframe
    src="https://www.youtube.com/embed/ChxSx8-sX_c"
    title="MCP supplementary video"
    loading="lazy"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen>
  </iframe>
</div>

_MCP 저자들이 공개한 [supplementary video](https://www.youtube.com/watch?v=ChxSx8-sX_c). 실제 behavior와 primitive activation은 정지 그림보다 영상에서 더 분명하게 보인다._

이 결과를 해석할 때 범위를 먼저 제한해야 한다.

- MCP가 모든 transfer task에서 항상 최고였다는 뜻은 아니다.
- 실제 robot 실험이 아니라 physics simulator의 character control 결과다.
- Primitive가 `걷기`, `돌기`, `균형`처럼 사람이 해석하기 좋은 이름으로 분리된다는 보장은 없다.
- 논문이 강하게 보여준 것은 **복잡한 고차원 task에서 motion prior를 가진 조합형 action space가 유용할 수 있다**는 점이다.

## 1. 논문 정보

| 항목 | 내용 |
|---|---|
| Title | MCP: Learning Composable Hierarchical Control with Multiplicative Compositional Policies |
| Authors | Xue Bin Peng, Michael Chang, Grace Zhang, Pieter Abbeel, Sergey Levine |
| Venue | NeurIPS 2019 |
| 핵심 표현 | Multiplicative composition of Gaussian primitives |
| Pre-training | Walking과 turning motion imitation |
| Transfer | Primitive 고정, 새 task용 gating network 학습 |
| Policy optimizer | PPO |
| Primitive 수 | 주 실험에서 $K=8$ |
| Control | 30 Hz policy, joint PD controller의 target rotation 출력 |
| Transfer tasks | Heading, box carrying, ball dribbling, Ant holdout direction |
| Source | [NeurIPS](https://papers.neurips.cc/paper_files/paper/2019/hash/95192c98732387165bf8e396c0f2dad2-Abstract.html), [Paper PDF](https://xbpeng.github.io/projects/MCP/MCP_2019.pdf), [arXiv](https://arxiv.org/abs/1905.09808), [Project](https://xbpeng.github.io/projects/MCP/) |

MCP는 [DIAYN](/posts/diayn-diversity-is-all-you-need/), [DADS](/posts/dads-dynamics-aware-skill-discovery/), [CIC](/posts/cic-contrastive-intrinsic-control/), [LSD](/posts/lsd-lipschitz-constrained-skill-discovery/), [METRA](/posts/metra-metric-aware-abstraction/)처럼 외부 task reward 없이 behavior를 발견하는 논문이 아니다.

Motion data를 이용해 운동 구성요소를 배우고, 그 구성요소를 새 task에서 **어떻게 조합할 것인가**가 중심 문제다.

## 2. 기존 계층 정책의 한계: 하나를 고를 것인가, 함께 쓸 것인가?

일반적인 Mixture of Experts 형태를 생각해보자.

$$
\pi_{\text{mix}}(a\mid s,g)
=
\sum_{i=1}^{K}
w_i(s,g)\pi_i(a\mid s,g)
$$

여기서

- $\pi_i$: $i$번째 primitive의 action distribution
- $w_i$: 현재 primitive를 선택할 확률 또는 mixture weight
- $s$: 현재 robot state
- $g$: 현재 task goal

이다.

분포 자체는 여러 mode를 함께 가질 수 있지만, 표준적인 mixture sampling은 먼저 component를 하나 고른 뒤 그 component에서 action을 뽑는 방식으로 해석할 수 있다.

```text
primitive 1 또는 primitive 2
걷기 OR 돌기
```

MCP는 다음 product를 사용한다.

$$
\boxed{
\pi_{\text{MCP}}(a\mid s,g)
=
\frac{1}{Z(s,g)}
\prod_{i=1}^{K}
\pi_i(a\mid s)^{w_i(s,g)}
}
$$

$Z(s,g)$는 결과의 적분이 1이 되도록 만드는 normalization constant다.

![Additive mixture와 multiplicative product의 차이](/assets/img/posts/rl/mcp/02-mixture-vs-product.svg){: width="1200" .d-block .mx-auto }

Product에서는 primitive 하나가 어떤 action에 거의 0의 확률을 주면 최종 분포에서도 그 action의 확률이 거의 0이 된다.

```text
primitive 1: 균형을 잃는 action은 허용하지 않음
primitive 2: 왼발이 목표 방향과 반대로 가는 action은 허용하지 않음
primitive 3: 상자를 놓치는 arm action은 허용하지 않음

최종 policy:
세 제약을 함께 통과하는 action을 선호
```

이 때문에 additive mixture를 `OR`, multiplicative product를 `AND`로 이해할 수 있다.

### 2.1 로그 공간에서 보면 더 명확하다

Product에 로그를 취하면 다음과 같다.

$$
\log \pi_{\text{MCP}}(a\mid s,g)
=
\sum_{i=1}^{K}
w_i(s,g)\log \pi_i(a\mid s)
-\log Z(s,g)
$$

각 primitive의 log probability가 가중합된다. 한 primitive라도 해당 action을 강하게 거부하면 전체 score가 크게 내려간다.

따라서 MCP를 단순한 ensemble 평균이라기보다 다음처럼 보는 편이 정확하다.

> **여러 primitive가 제시한 action constraint의 교집합을 찾는 Product of Experts.**

### 2.2 여러 action을 동시에 실행하는 것은 아니다

`Multiple primitives are activated simultaneously`라는 표현은 오해하기 쉽다. MCP가 simulator에 여러 action vector를 보내는 것은 아니다.

```text
π₁, π₂, ..., πₖ
        ↓ product
하나의 composite Gaussian π
        ↓ sample
하나의 action vector aₜ
```

동시에 활성화된다는 뜻은 여러 primitive가 **하나의 최종 distribution을 만드는 데 함께 기여한다**는 뜻이다.

## 3. Gaussian primitive를 곱하면 무엇이 나오는가?

연속 제어 policy는 보통 diagonal Gaussian을 출력한다. 이 글에서는 논문의 $\sigma_i^j$가 variance를 뜻한다는 혼동을 피하려고, action dimension $j$의 variance를 $v_{ij}$로 쓰겠다.

$$
\pi_i(a\mid s)
=
\mathcal N
\left(
\mu_i(s),
\operatorname{diag}(v_i(s))
\right)
$$

Weighted Gaussian product의 결과도 Gaussian이다.

$$
\pi_{\text{MCP}}(a\mid s,g)
=
\mathcal N
\left(
\mu(s,g),
\operatorname{diag}(v(s,g))
\right)
$$

Action dimension $j$에서 primitive $i$의 **effective precision**을 다음처럼 정의하자.

$$
\boxed{
\lambda_{ij}
=
\frac{w_i}{v_{ij}}
}
$$

그러면 최종 variance와 mean은 다음과 같다.

$$
\boxed{
v_j
=
\left(
\sum_{i=1}^{K}\lambda_{ij}
\right)^{-1}
}
$$

$$
\boxed{
\mu_j
=
\frac{
\sum_{i=1}^{K}\lambda_{ij}\mu_{ij}
}{
\sum_{i=1}^{K}\lambda_{ij}
}
}
$$

![Gate weight와 inverse variance가 primitive의 실제 영향력을 결정하는 과정](/assets/img/posts/rl/mcp/03-gaussian-precision.svg){: width="1200" .d-block .mx-auto }

Primitive의 영향력은 $w_i$ 하나로 결정되지 않는다.

| 요소 | 값이 커질 때 의미 |
|---|---|
| Gate weight $w_i$ | 현재 goal에서 primitive $i$를 전반적으로 더 사용 |
| Variance $v_{ij}$ | action dimension $j$에 대한 주장을 약하게 함 |
| Precision $1/v_{ij}$ | 해당 action dimension에 더 강하게 개입 |
| Effective precision $\lambda_{ij}=w_i/v_{ij}$ | 실제 composite mean과 variance에 미치는 영향 |

즉 primitive는 두 가지를 함께 출력한다.

```text
μᵢ(s): 내가 제안하는 action
vᵢ(s): 각 action dimension에서 내 제안을 얼마나 강하게 주장할 것인가
```

일반 Gaussian policy에서 variance를 exploration noise로만 생각하기 쉽지만, MCP에서는 **관절별 routing strength** 역할까지 한다.

### 3.1 한 차원에서 직접 유도하기

한 action dimension만 생각하면 weighted product는 다음과 같다.

$$
\prod_i
\mathcal N(a;\mu_i,v_i)^{w_i}
\propto
\exp
\left[
-\frac12
\sum_i
\frac{w_i}{v_i}
(a-\mu_i)^2
\right]
$$

제곱항을 전개한다.

$$
\sum_i \frac{w_i}{v_i}(a-\mu_i)^2
=
\left(\sum_i\frac{w_i}{v_i}\right)a^2
-2
\left(\sum_i\frac{w_i\mu_i}{v_i}\right)a
+C
$$

다음 두 값을 두면

$$
\Lambda
=
\sum_i\frac{w_i}{v_i},
\qquad
\eta
=
\sum_i\frac{w_i\mu_i}{v_i}
$$

완전제곱으로 정리할 수 있다.

$$
\Lambda a^2-2\eta a
=
\Lambda
\left(
a-\frac{\eta}{\Lambda}
\right)^2
+C'
$$

따라서

$$
\mu=\frac{\eta}{\Lambda},
\qquad
v=\frac{1}{\Lambda}
$$

가 된다. Precision이 더해진다는 말은 여기서 나온다.

### 3.2 여러 primitive가 강하게 주장하면 분포가 좁아진다

$$
\frac{1}{v_j}
=
\sum_i\frac{w_i}{v_{ij}}
$$

여러 primitive가 같은 action 영역에 높은 precision을 주면 최종 variance는 작아진다. 이는 공통으로 허용되는 action을 더 확신 있게 고르는 장점이 있다.

반대로 primitive들이 지나치게 작은 variance를 출력하면 composite distribution이 너무 좁아져 exploration이 줄 수 있다. 따라서 MCP에서는 mean뿐 아니라 variance 학습의 안정성도 중요하다.

### 3.3 Weight의 비율과 전체 크기는 역할이 다르다

모든 gate weight를 같은 상수 $c>0$으로 키워보자.

$$
w_i'=cw_i
$$

최종 mean은 변하지 않는다.

$$
\mu_j'=\mu_j
$$

하지만 variance는 다음처럼 바뀐다.

$$
v_j'=\frac{v_j}{c}
$$

따라서 수식에서 다음 해석이 따라온다.

- Weight의 **상대 비율**은 어느 primitive mean을 더 따를지 결정한다.
- Weight의 **전체 크기**는 composite distribution의 확신도를 조절한다.

논문의 gate가 softmax가 아니라 각 weight에 sigmoid를 사용해 $[0,1]$로 제한한 점도 이와 연결된다. Weight 합이 반드시 1일 필요는 없다.

## 4. MCP actor의 전체 구조

MCP actor는 두 종류의 network로 구성된다.

![State와 goal이 MCP gate와 primitive를 통과해 하나의 action distribution을 만드는 구조](/assets/img/posts/rl/mcp/04-mcp-architecture.svg){: width="1200" .d-block .mx-auto }

### 4.1 Primitive networks

각 primitive는 현재 state $s$만 본다.

$$
\pi_i(a\mid s)
=
\mathcal N
\left(
\mu_i(s),\Sigma_i(s)
\right)
$$

Primitive의 질문은 다음과 같다.

> 현재 몸 상태에서 어떤 action pattern이 물리적으로 자연스러운가?

논문의 character state에는 root 기준 link position, quaternion rotation, linear velocity, angular velocity가 포함된다.

### 4.2 Gating network

Gate는 state와 goal을 함께 본다.

$$
w(s,g)
=
\left[
w_1(s,g),\ldots,w_K(s,g)
\right]
$$

Gate의 질문은 다음과 같다.

> 현재 goal을 달성하려면 이 운동 구성요소들을 어떤 비율과 강도로 사용할 것인가?

논문 구현은 state와 goal을 별도 network로 encoding한 뒤 feature를 합치고, sigmoid output으로 primitive weight를 만든다.

### 4.3 왜 primitive에는 goal을 보여주지 않는가?

Primitive까지 goal $g$를 본다면 하나의 primitive가 모든 goal-conditioned behavior를 혼자 담당할 수 있다.

```text
primitive 1이 s와 g를 모두 봄
→ primitive 1 하나가 왼쪽, 오른쪽, 전진을 전부 학습
→ gate는 항상 primitive 1만 사용
→ 나머지 primitive가 필요 없어짐
```

MCP는 비대칭 구조를 사용한다.

$$
\text{gate}: (s,g)\rightarrow w
$$

$$
\text{primitive}: s\rightarrow(\mu_i,\Sigma_i)
$$

같은 state에서 goal만 바뀌면 primitive output은 그대로이고 gate의 조합이 달라져야 한다. 논문은 이 구조가 하나의 primitive가 모든 goal을 흡수하는 degeneracy를 막고 specialization을 유도한다고 설명한다.

다만 이것은 diversity를 **보장**하지 않는다. MCP에는 DIAYN의 mutual information처럼 primitive 차이를 직접 최대화하는 objective가 없다.

## 5. PPO에서는 무엇이 달라지는가?

MCP는 새로운 critic이나 policy-gradient 알고리즘을 제안한 논문이 아니다. 최종 composite distribution을 하나의 일반 Gaussian actor로 취급하고 PPO로 학습한다.

$$
\pi_\theta(a\mid s,g)
=
\mathcal N
\left(
\mu_\theta(s,g),
\Sigma_\theta(s,g)
\right)
$$

PPO probability ratio는 평소와 같다.

$$
r_t(\theta)
=
\exp
\left[
\log\pi_\theta(a_t\mid s_t,g_t)
-
\log\pi_{\theta_{\text{old}}}(a_t\mid s_t,g_t)
\right]
$$

차이는 composite mean과 variance가 다음 parameter들로 만들어진다는 점이다.

```text
gate weight wᵢ
primitive mean μᵢ
primitive variance vᵢ
        ↓
composite μ, v
        ↓
log π(a|s,g)
        ↓
PPO loss
```

Automatic differentiation으로 gradient가 gate와 primitive 양쪽에 흐른다.

Positive advantage를 받은 action에 대해 학습은 다음 중 여러 경로를 사용할 수 있다.

- 가까운 mean을 가진 primitive의 $w_i$를 높인다.
- Primitive mean $\mu_i$를 해당 action 쪽으로 이동시킨다.
- Primitive variance $v_{ij}$를 줄여 특정 관절에서 영향력을 높인다.
- 충돌하는 primitive의 weight를 낮추거나 variance를 키운다.

환경 dynamics를 통과해 직접 미분하는 것은 아니다. PPO가 샘플링한 action의 log probability를 이용하는 score-function gradient 구조는 그대로다.

## 6. 학습은 두 단계로 나뉜다

![Motion imitation pre-training과 downstream transfer의 역할 분리](/assets/img/posts/rl/mcp/05-pretrain-transfer.svg){: width="1200" .d-block .mx-auto }

### 6.1 1단계: Motion imitation pre-training

Pre-training goal은 reference motion의 다음 두 state다.

$$
g_t
=
\left(
\hat s_{t+1},
\hat s_{t+2}
\right)
$$

하나의 MCP policy가 walking과 turning motion clip들을 함께 따라 한다. Reference motion은 episode 시작에 무작위로 선택되며, episode 중에도 다른 motion으로 바뀐다.

이 random switching은 단순히 clip 하나를 암기하는 것보다 다음 전환 상태를 경험하게 한다.

```text
forward walk → left turn
right turn → forward walk
```

Pre-training에서는 primitive와 gate를 함께 end-to-end로 학습한다.

$$
\pi_{1:K}^{*},w^{*}
=
\arg\max_{\pi_{1:K},w}
J_{\text{pre}}
\left(
\pi_{1:K},w
\right)
$$

Supplementary material 기준으로 biped와 humanoid는 약 230초의 walking·turning mocap을 공유하고, T-Rex는 11초의 artist-authored animation을 사용했다.

### 6.2 2단계: Downstream task transfer

새 task에서는 pre-trained primitive를 고정한다.

$$
\pi_1^{*},\ldots,\pi_K^{*}
$$

그리고 새 goal space에 맞는 gate $\omega$만 학습한다.

$$
\omega^{*}
=
\arg\max_{\omega}
J_{\text{transfer}}
\left(
\pi_{1:K}^{*},\omega
\right)
$$

이제 downstream policy는 raw joint action을 처음부터 찾는 대신 다음 공간을 탐색한다.

> 이미 자연스러운 움직임을 만드는 primitive들을 어떤 방식으로 조합할 것인가?

논문은 frozen primitive library를 새 task에서 사용할 **nonlinear basis 또는 새로운 action space**로 해석한다.

### 6.3 Primitive를 왜 고정하는가?

Primitive를 고정하면 두 가지 효과가 있다.

1. Motion imitation에서 얻은 움직임을 catastrophic forgetting으로 잃지 않는다.
2. 새 task의 sparse하거나 거친 reward가 자연스러운 motion prior를 파괴하지 않는다.

Supplementary ablation에서는 primitive까지 fine-tuning한 방법과 gate만 학습한 방법이 쉬운 task에서는 비슷했지만, 복잡한 humanoid task에서는 primitive를 고정한 쪽의 이점이 더 컸다. 저자들은 transfer 단계에 reference motion이 없기 때문에 primitive를 fine-tuning하면 움직임이 부자연스러워질 수 있다고 해석했다.

## 7. Primitive 하나는 완성된 스킬 하나인가?

반드시 그렇지 않다.

MCP는 다음 의미를 primitive에 직접 부여하지 않는다.

```text
primitive 1 = 걷기
primitive 2 = 돌기
primitive 3 = 물체 들기
```

모든 primitive는 같은 imitation objective 아래에서 end-to-end로 학습된다. 실제 논문의 activation 분석에서는 다음 specialization이 관찰됐다.

- Primitive 1은 left stance에서 강하게 활성화
- Primitive 2는 right stance에서 강하게 활성화
- 각 primitive의 mean action을 PCA로 나타내면 서로 다른 cluster 형성

따라서 primitive는 완전한 trajectory-level skill보다 다음에 가까울 수 있다.

```text
보행의 특정 phase
특정 관절 협응 pattern
몸통 안정화 요소
action space의 특정 방향
```

이 점이 DIAYN 계열의 $z$와 가장 크게 다른 부분이다.

### 7.1 진짜 spatial composition은 action dimension별로 일어난다

Gate weight $w_i$는 primitive 전체 중요도를 정하지만, variance $v_{ij}$는 action dimension별 영향력을 바꾼다.

예를 들어 다음 조합이 가능하다.

```text
왼쪽 다리 관절: primitive 1의 precision이 큼
오른쪽 다리 관절: primitive 2의 precision이 큼
몸통 관절: primitive 3의 precision이 큼
팔 관절: primitive 4의 precision이 큼
```

그래서 MCP는 primitive mean vector 전체를 단순히 평균 내는 구조보다 더 세밀하다.

$$
\alpha_{ij}
=
\frac{\lambda_{ij}}{\sum_l\lambda_{lj}}
$$

$$
\mu_j
=
\sum_i\alpha_{ij}\mu_{ij}
$$

$\alpha_{ij}$가 action dimension마다 다르므로, 왼쪽 다리는 한 primitive를 따르고 팔은 다른 primitive를 따르는 조합이 가능하다.

## 8. 왜 복잡한 task에서 structured exploration이 중요한가?

고차원 character를 raw action space에서 처음부터 학습한다고 하자. 관절마다 독립 Gaussian noise를 넣으면 대부분의 초기 behavior는 다음과 같다.

```text
균형을 잃음
몇 step 안에 넘어짐
접촉을 만들지 못함
상자를 잡거나 공을 미는 상태까지 도달하지 못함
```

MCP에서는 random gate weight도 motion imitation으로 배운 primitive들을 조합한다. 따라서 exploration이 다음처럼 구조화된다.

```text
여러 방향으로 걷기
보행 phase를 유지하며 회전하기
균형을 잃지 않은 채 물체 근처로 접근하기
```

이 차이는 task reward를 잘 설계했다는 뜻이 아니다. Reward를 받기 위한 의미 있는 state까지 도달할 확률을 높이는 **action prior**의 차이다.

## 9. Temporal composition과 MCP의 composition은 다르다

![Option의 시간적 조합과 MCP의 action-space 조합 비교](/assets/img/posts/rl/mcp/06-composition-levels.svg){: width="1200" .d-block .mx-auto }

Option 기반 hierarchy는 대체로 한 skill을 여러 timestep 동안 유지한다.

$$
z_t
\rightarrow
a_t,a_{t+1},\ldots,a_{t+H}
$$

MCP gate는 policy frequency인 30 Hz에서 매 timestep weight를 다시 계산한다.

$$
w_t=w(s_t,g_t)
$$

$$
a_t\sim\pi_{\text{MCP}}(a\mid s_t,g_t)
$$

따라서 MCP의 hierarchy는 다음에 가깝다.

```text
representation hierarchy
action-space 또는 spatial abstraction
```

다음 구조를 명시적으로 가진 temporal hierarchy는 아니다.

```text
option termination
skill duration
high-level planner
subgoal sequencing
```

Carry task에서 `접근 → 들어 올리기 → 운반 → 내려놓기`가 나타나지만, 이것은 명시적인 option sequence가 아니라 state와 goal에 따라 gate output이 계속 바뀐 결과다.

## 10. 실험 결과는 무엇을 보여주는가?

논문 Table 1의 normalized return 중 핵심 결과를 정리하면 다음과 같다.

| Task | Scratch | Finetune | Latent Space | MCP |
|---|---:|---:|---:|---:|
| Heading: Biped | 0.927 | 0.970 | 0.970 | **0.976** |
| Carry: Biped | 0.027 | 0.324 | 0.456 | **0.575** |
| Dribble: Biped | 0.072 | 0.651 | 0.768 | **0.782** |
| Dribble: Humanoid | 0.076 | 0.598 | 0.751 | **0.805** |
| Dribble: T-Rex | 0.065 | 0.074 | 0.115 | **0.781** |
| Holdout: Ant | **0.951** | 0.885 | 0.745 | 0.812 |

표에서 읽어야 할 핵심은 세 가지다.

### 10.1 쉬운 heading task에서는 차이가 작다

Biped heading에서는 finetune, latent-space, MCP가 모두 높은 성능을 냈다. 단순한 goal에서는 raw action이나 일반 latent representation도 충분할 수 있다.

### 10.2 Locomotion과 manipulation이 결합될수록 차이가 커졌다

Carry와 dribble에서는 이동, 균형, 접촉 제어를 함께 처리해야 한다. 논문의 비교 설정에서 MCP는 task가 복잡해질수록 더 큰 이점을 보였다.

특히 T-Rex dribbling에서는 MCP만 높은 normalized return을 얻었다. 다만 이것은 해당 simulator, reward, baseline, training budget 안에서의 결과다.

### 10.3 MCP가 항상 최고는 아니다

Ant holdout direction에서는 Scratch가 0.951, MCP가 0.812였다. Primitive action space는 exploration을 구조화하지만, 동시에 표현 가능한 action 범위를 제한할 수 있다. Raw action policy가 쉽게 탐색할 수 있는 간단한 morphology와 task에서는 직접 학습이 더 나을 수 있다.

Supplementary experiment에서는 primitive 수를 4, 8, 16, 32개로 늘려 비교했다. 4개와 8개 사이에는 뚜렷한 차이가 없었고, 너무 많은 primitive는 학습 효율을 낮췄다. 32개 weight는 humanoid의 28-D action보다 오히려 커져 dimensionality reduction 이점도 약해졌다.

## 11. 이전에 본 방법들과 어디가 다른가?

| 방법 | 핵심 질문 | 학습 또는 선택 단위 | 조합 위치 |
|---|---|---|---|
| DIAYN · DADS · CIC · LSD · METRA · CSD | 어떤 behavior를 발견할 것인가? | 일정 horizon 동안 유지되는 $z$ | Conditioned policy $\pi(a\mid s,z)$ |
| SF + GPI | 새 reward에서 어떤 기존 policy가 유용한가? | Policy별 successor value | $Q$ 또는 value 수준 |
| MCP | 여러 운동 요소를 같은 순간에 어떻게 합칠까? | Gaussian motor primitive | Action distribution 수준 |

### 11.1 Skill discovery와 MCP

DIAYN 계열은 서로 다른 state distribution이나 transition을 만드는 skill latent $z$를 학습한다.

$$
\pi(a\mid s,z)
$$

MCP는 motion imitation으로 얻은 primitive distribution들을 매 timestep 곱한다.

$$
\pi(a\mid s,g)
\propto
\prod_i
\pi_i(a\mid s)^{w_i(s,g)}
$$

DIAYN의 $z$는 trajectory-level behavior mode에 가깝고, MCP primitive는 action-level 운동 구성요소에 가깝다.

### 11.2 SF + GPI와 MCP

SF + GPI는 여러 policy의 action value를 비교한다.

$$
\pi_{\text{GPI}}(s)
\in
\arg\max_a
\max_i
\tilde Q_i(s,a)
$$

MCP는 여러 policy value를 비교하지 않는다. Primitive의 action distribution을 먼저 곱하고, 그 composite에서 action을 뽑는다.

```text
SF + GPI:
어느 source policy의 가치 예측을 따를까?

MCP:
여러 primitive가 공통으로 허용하는 action은 무엇일까?
```

두 방법은 대체 관계라기보다 서로 다른 transfer 층위를 다룬다.

## 12. 구현할 때 실제로 봐야 할 tensor와 gradient

Batch size를 $B$, primitive 수를 $K$, action dimension을 $D$라고 하자.

```text
state                    [B, state_dim]
goal                     [B, goal_dim]
gate_weight w            [B, K]
primitive_mean μ         [B, K, D]
primitive_variance v     [B, K, D]
effective_precision λ    [B, K, D]
composite_mean           [B, D]
composite_variance       [B, D]
```

핵심 계산은 다음과 같다.

```python
# w: [B, K]
# primitive_mean, primitive_var: [B, K, D]
weight = w.unsqueeze(-1)

precision = weight / primitive_var
precision_sum = precision.sum(dim=1)

composite_var = 1.0 / precision_sum
composite_mean = (
    precision * primitive_mean
).sum(dim=1) / precision_sum

dist = Normal(
    composite_mean,
    composite_var.sqrt(),
)
action = dist.sample()
log_prob = dist.log_prob(action).sum(dim=-1)
```

수치적으로는 다음이 필요하다.

- Variance 또는 log standard deviation에 lower bound 적용
- `precision_sum`이 0에 가까워지지 않도록 epsilon 적용
- Variance와 standard deviation notation을 코드에서 명확히 분리
- Gate weight만 보지 말고 $w_i/v_{ij}$를 함께 logging
- Primitive별 mean, variance, usage frequency를 모두 시각화

Primitive specialization을 분석하려면 단순 activation $w_i$보다 다음 값이 더 직접적이다.

$$
\bar\lambda_i
=
\frac{1}{D}
\sum_{j=1}^{D}
\frac{w_i}{v_{ij}}
$$

관절별 influence map $\lambda_{ij}$를 보면 어느 primitive가 어느 action dimension을 실제로 지배하는지 확인할 수 있다.

## 13. 한계와 주의할 주장

### 13.1 Motion corpus가 성능 상한을 만든다

MCP는 unsupervised skill discovery가 아니다. Walking과 turning reference motion으로 pre-training했다.

Downstream optimal action이 primitive 조합으로 표현 가능한 영역을 벗어나면 gate만 바꿔서는 해결하기 어렵다.

$$
a^{*}(s,g)
\notin
\mathcal A_{\text{primitive}}(s)
$$

예를 들어 walking data만으로 학습한 primitive에 공중제비나 기어가기를 요구하면 표현력이 부족할 수 있다.

### 13.2 Primitive collapse를 직접 막는 diversity objective가 없다

비대칭 구조는 specialization을 유도하지만 다음 상태를 이론적으로 금지하지 않는다.

$$
\pi_1\approx\pi_2\approx\cdots\approx\pi_K
$$

또는 일부 primitive가 거의 사용되지 않을 수 있다. 이 문제는 primitive별 effective precision과 usage를 직접 확인해야 한다.

### 13.3 Gaussian product는 unimodal이다

Gaussian을 곱한 결과도 하나의 Gaussian이다. 최적 행동이 `왼쪽으로 크게 회피` 또는 `오른쪽으로 크게 회피`처럼 서로 멀리 떨어진 두 mode를 가져야 한다면, 하나의 Gaussian product가 중간의 좋지 않은 action을 만들 수 있다.

### 13.4 Primitive끼리 충돌할 수 있다

Product가 항상 의미 있는 조합을 만드는 것은 아니다.

```text
primitive 1: 관절을 강하게 왼쪽으로
primitive 2: 관절을 강하게 오른쪽으로
```

두 primitive가 호환 가능한 부분 행동을 학습하지 못했다면 precision-weighted 평균이 물리적으로 유용하다는 보장은 없다.

### 13.5 Weight만으로 primitive activation을 해석하면 부족하다

실제 영향력은

$$
\lambda_{ij}=\frac{w_i}{v_{ij}}
$$

이다. $w_i$가 커도 variance가 매우 크면 해당 관절에 미치는 영향은 작다.

또 $w_i$와 $v_{ij}$를 같은 비율로 함께 바꾸면 $\lambda_{ij}$가 같게 유지될 수 있다. 따라서 parameter 자체의 의미가 완전히 식별되는 것은 아니다.

### 13.6 Long-horizon temporal planning을 직접 해결하지 않는다

MCP는 action-space composition에는 강하지만 option termination, subgoal decomposition, high-level planning을 명시적으로 학습하지 않는다. 논문도 spatial abstraction에 temporal abstraction을 결합하는 것을 향후 과제로 제시했다.

### 13.7 Baseline 해석에도 여지가 있다

[NeurIPS 공개 리뷰](https://proceedings.neurips.cc/paper_files/paper/2019/file/95192c98732387165bf8e396c0f2dad2-Reviews.html)에서는 다음 쟁점이 제기됐다.

- Option-Critic과 MCP의 pre-training·transfer 조건이 충분히 공정한가?
- Primitive 하나를 sampling하는 MOE 외에, 여러 primitive mean을 선형 결합하는 additive baseline도 필요하지 않은가?

따라서 결과를 다음처럼 일반화하면 과하다.

> Multiplication은 모든 additive composition보다 항상 우월하다.

논문이 직접 보여준 범위는 다음이다.

> 저자들이 구성한 비교 방법과 simulated character benchmark에서 MCP가 복잡한 carry·dribble task에 강한 성능을 보였다.

## 14. 헷갈렸던 질문만 다시 정리

### Q1. Primitive 하나가 걷기 스킬 하나인가?

아니다. 보행 phase, 특정 관절 coordination, 안정화 pattern처럼 더 작은 운동 요소일 수 있다.

### Q2. 여러 primitive를 활성화하면 여러 action을 동시에 보내는가?

아니다. 여러 primitive가 하나의 composite distribution을 만들고, 환경에는 하나의 action vector만 보낸다.

### Q3. Gate weight가 가장 큰 primitive가 action을 결정하는가?

항상 그렇지 않다. 관절별 실제 영향력은 $w_i/v_{ij}$다.

### Q4. MCP가 새로운 RL optimizer인가?

아니다. PPO는 그대로 사용하고 actor의 action distribution 구조를 바꾼 방법이다.

### Q5. MCP는 unsupervised skill discovery인가?

아니다. 논문의 primitive는 reference motion imitation으로 학습된다.

### Q6. MCP는 장기적인 skill 순서를 배우는 hierarchical RL인가?

명시적인 의미에서는 아니다. Gate는 매 timestep primitive를 조합하며, option duration이나 termination을 직접 모델링하지 않는다.

### Q7. 왜 새 task에서 primitive를 고정하는가?

Motion prior를 보존하고, 새 task reward가 primitive를 파괴하는 catastrophic forgetting을 줄이기 위해서다.

## 15. 최종 정리

MCP의 핵심은 `skill library에서 하나를 선택한다`가 아니다.

$$
\boxed{
\pi(a\mid s,g)
\propto
\prod_i
\pi_i(a\mid s)^{w_i(s,g)}
}
$$

이 식을 구현 수준까지 풀면 다음과 같다.

1. Primitive는 state에서 Gaussian action proposal $(\mu_i,v_i)$를 만든다.
2. Gate는 state와 goal에서 primitive-level weight $w_i$를 만든다.
3. 실제 관절별 영향력은 precision-weighted 값 $w_i/v_{ij}$다.
4. Product는 primitive들이 공통으로 허용하는 하나의 Gaussian을 만든다.
5. Pre-training에서는 motion imitation으로 primitive와 gate를 함께 학습한다.
6. Transfer에서는 primitive를 고정하고 새 task용 gate만 학습한다.
7. 이 구조는 raw action보다 구조화된 exploration을 제공하지만, motion corpus 밖의 행동과 장기 planning은 직접 해결하지 못한다.

지금까지의 흐름을 가장 짧게 연결하면 다음과 같다.

```text
DIAYN 계열:
어떤 behavior들을 발견할 것인가?

SF + GPI:
새 reward에서 어떤 기존 policy의 value를 재사용할 것인가?

MCP:
여러 motor primitive를 같은 timestep의 action으로 어떻게 합칠 것인가?
```

MCP를 `여러 스킬을 곱한다`는 한 문장으로만 기억하면 variance의 역할과 action dimension별 composition을 놓치기 쉽다. 더 정확한 표현은 다음과 같다.

> **MCP는 goal-based global routing과 state-based joint-level precision routing을 결합한 compositional Gaussian actor다.**

## 참고

- [Peng et al., MCP, NeurIPS 2019](https://papers.neurips.cc/paper_files/paper/2019/hash/95192c98732387165bf8e396c0f2dad2-Abstract.html)
- [MCP official project page and supplementary video](https://xbpeng.github.io/projects/MCP/)
- [MCP paper PDF](https://xbpeng.github.io/projects/MCP/MCP_2019.pdf)
- [MCP arXiv](https://arxiv.org/abs/1905.09808)
- [NeurIPS public reviews](https://proceedings.neurips.cc/paper_files/paper/2019/file/95192c98732387165bf8e396c0f2dad2-Reviews.html)
