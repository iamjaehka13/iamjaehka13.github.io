---
title: "CIC: Contrastive Learning으로 다양한 행동을 연속 Skill에 연결하기"
date: 2026-07-20 22:00:00 +0900
categories: [RL, Study]
tags: [cic, contrastive-learning, unsupervised-reinforcement-learning, skill-discovery, intrinsic-reward, ddpg, urlb]
description: "DIAYN과 DADS 이후 CIC가 transition-skill contrastive learning과 particle entropy를 결합해 고차원 연속 skill을 학습하는 원리, 실제 DDPG 학습 구조, URLB 실험과 한계를 정리한다."
math: true
image:
  path: /assets/img/posts/rl/cic/00-cic-preview.png
  alt: CIC의 mutual information 목적과 Quadruped의 서로 다른 latent skill 방향
---

[DIAYN](/posts/diayn-diversity-is-all-you-need/)은 상태에서 실행된 skill을 맞힐 수 있도록 서로 구별되는 상태 분포를 만들었다. [DADS](/posts/dads-dynamics-aware-skill-discovery/)는 한 걸음 더 나아가, 현재 상태에서 skill이 만들 다음 상태를 예측하는 dynamics model을 학습했다.

그런데 더 어려운 환경에서는 또 다른 문제가 나타난다.

```text
skill을 서로 구별하는 것만으로
환경의 넓은 행동 공간을 실제로 탐색할 수 있는가?
```

기존 competence-based skill discovery는 비교적 간단한 환경에서는 다양한 행동을 만들었지만, DeepMind Control처럼 넘어져도 episode가 즉시 끝나지 않는 환경에서는 data-based exploration 방법보다 성능이 낮았다. CIC는 이 문제를 mutual information 자체보다 **그 mutual information을 추정하는 방법의 문제**로 본다.

> **CIC는 latent skill과 state transition을 contrastive하게 연결하고, 그 표현 공간의 entropy를 높여 넓은 행동 탐색과 호출 가능한 skill repertoire를 함께 학습한다.**

![CIC가 발견한 Walker, Quadruped, Jaco skill](/assets/img/posts/rl/cic/00-cic-discovered-skills.png){: width="1000" .d-block .mx-auto }
_같은 reward-free pretraining에서 발견된 Walker의 leap·jog, Quadruped의 일어나기·좌측 이동, Jaco의 물체 밀기 행동. 사람이 이 이름을 미리 부여한 것이 아니라 학습 후 관찰해 붙인 의미다. 출처: [Laskin et al., Figure 2](https://arxiv.org/abs/2202.00161)._

## 0. 먼저 보는 전체 구조

CIC에는 두 개의 학습 경로가 동시에 존재한다.

```text
Representation learning
(z, transition)을 contrastive learning으로 연결
                    ↓
행동 차이를 측정할 embedding 공간 형성

Exploration
embedding에서 k-NN entropy reward 계산
                    ↓
DDPG actor-critic이 새로운 transition을 탐색
```

이를 구성 요소별로 나누면 다음과 같다.

| 구성 요소 | 역할 |
|---|---|
| Skill-conditioned policy $\pi_\theta(a\mid s,z)$ | 현재 상태와 skill을 받아 action을 만든다. |
| Transition encoder $g_\tau(s,s')$ | 한 step의 상태 변화를 embedding으로 바꾼다. |
| Skill encoder $g_z(z)$ | continuous skill vector를 같은 비교 공간으로 투영한다. |
| Contrastive loss | 실제로 대응된 $z$와 transition은 가깝게, 다른 pair는 멀게 학습한다. |
| Particle entropy | embedding의 k-nearest neighbor 거리를 novelty reward로 사용한다. |
| DDPG actor-critic | intrinsic reward를 최대화하는 policy를 학습한다. |

핵심은 contrastive learning과 entropy exploration이 따로 노는 것이 아니라는 점이다.

> Contrastive learning은 **무엇을 서로 다른 행동으로 볼지** 정하고, particle entropy는 **그 공간을 얼마나 넓게 탐색할지** 정한다.

## 1. 논문 정보

| 항목 | 내용 |
|---|---|
| Title | Contrastive Intrinsic Control for Unsupervised Reinforcement Learning |
| Authors | Michael Laskin, Hao Liu, Xue Bin Peng, Denis Yarats, Aravind Rajeswaran, Pieter Abbeel |
| Venue | NeurIPS 2022 |
| 문제 | 외부 reward 없이 다양한 행동을 고차원 continuous skill에 대응시키기 |
| 핵심 목적 | $I(\tau;Z)$ 최대화, CIC에서는 $\tau=(S,S')$ |
| Representation | transition encoder와 skill encoder의 noise contrastive learning |
| Intrinsic reward | learned representation의 k-NN particle entropy |
| RL backbone | DDPG |
| Skill space | 64차원 continuous vector, $z\sim U([0,1]^{64})$ |
| 평가 | state-based URLB, 2M-step pretraining + 100K-step downstream adaptation |
| Source | [NeurIPS](https://proceedings.neurips.cc/paper_files/paper/2022/hash/debf482a7dbdc401f9052dbe15702837-Abstract.html), [arXiv](https://arxiv.org/abs/2202.00161), [Official code](https://github.com/rll-research/cic) |

CIC가 말하는 unsupervised RL도 pretraining과 downstream adaptation으로 나뉜다.

```text
Reward-free pretraining
intrinsic reward로 다양한 skill 학습

              ↓

Downstream adaptation
새 task의 extrinsic reward로 skill을 고르고
actor-critic을 추가 fine-tuning
```

따라서 CIC는 task reward 없이 완성된 범용 controller를 만드는 논문이 아니다. **새 task에 빠르게 적응할 수 있는 policy initialization과 behavior repertoire를 만드는 방법**이다.

## 2. DIAYN·DADS에서 CIC까지

CIC가 등장한 이유는 앞선 방법을 틀렸다고 선언하기 위해서가 아니다. 각 방법이 diversity를 정의하고 추정하는 방식에서 다음 질문이 이어진다.

### 2.1 DIAYN: 구별 가능하지만 넓게 탐색하는가?

DIAYN은 다음 목적을 사용한다.

$$
I(S;Z)=H(Z)-H(Z\mid S)
$$

상태를 보고 skill을 맞히기 쉬우면 높은 reward를 준다. 하지만 $H(S)$를 직접 최대화하지 않기 때문에, skill들이 좁은 상태 영역 안에서 작은 차이만 만들어도 구별될 수 있다.

### 2.2 DADS: 예측 가능하지만 density model이 확장되는가?

DADS는 다음 conditional mutual information을 사용한다.

$$
I(S';Z\mid S)
$$

그리고 $q(s'\mid s,z)$를 학습해 서로 다르고 예측 가능한 transition을 만든다. 이 model은 downstream planning에도 쓸 수 있다. 반면 high-dimensional state와 skill에서 conditional density를 직접 모델링하는 일은 어려워질 수 있다.

### 2.3 APT와 APS: explicit exploration을 추가하다

APT는 learned state representation의 particle entropy를 높여 환경을 넓게 탐색한다. 다만 policy에 $z$가 없으므로 발견한 행동을 특정 skill로 호출하는 구조는 만들지 않는다.

APS는 particle entropy와 successor-feature 기반 skill conditioning을 결합한다. 탐색과 callable skill을 함께 다루지만, CIC 논문의 실험 설정에서는 10차원 continuous skill을 사용했다.

### 2.4 CIC: exploration과 skill discrimination을 함께 확장하다

CIC가 선택한 조합은 다음과 같다.

```text
APT 계열의 particle entropy
                +
APS 계열의 forward MI decomposition
                +
z-transition contrastive discriminator
```

이를 간단히 비교하면 다음과 같다.

| 방법 | Diversity를 보는 기준 | Explicit entropy exploration | Skill 구조 | 주요 downstream 방식 |
|---|---|---:|---|---|
| DIAYN | 상태에서 $z$ 분류 | 아니오 | categorical | 선택·fine-tuning·meta-controller |
| DADS | $q(s'\mid s,z)$ likelihood | 예 | discrete/continuous | learned dynamics 기반 planning |
| APT | state embedding의 k-NN 거리 | 예 | 없음 | policy fine-tuning |
| APS | particle entropy + successor feature | 예 | continuous | task vector 추정과 fine-tuning |
| CIC | transition-skill contrastive representation | 예 | 64D continuous | skill 선택 후 policy fine-tuning |

이 표를 논문의 우열표로 읽으면 안 된다. 각각 exploration, predictability, planning, transfer 중 어디에 구조를 더 많이 부여하는지가 다르다.

## 3. $\tau$는 긴 trajectory가 아니다

CIC는 다음 mutual information을 최대화한다.

$$
I(\tau;Z)
$$

여기서 가장 먼저 주의할 것은 $\tau$의 의미다. 일반적으로 $\tau$는 긴 trajectory를 뜻하기도 하지만, CIC에서 사용한 $\tau$는 연속한 두 상태의 tuple이다.

$$
\tau_t=(s_t,s_{t+1})
$$

즉 CIC가 구별하는 것은 episode 전체가 아니라 **한 step에서 상태가 어떻게 변했는가**다.

```text
단일 상태만 보는 경우
s_t = 현재 자세와 위치

CIC transition을 보는 경우
(s_t, s_{t+1}) = 현재 상태에서 다음 상태로 생긴 변화
```

전진과 후진이 같은 위치를 지나더라도 변화 방향은 다르다. Transition을 사용하면 현재 위치만으로는 놓칠 수 있는 행동 방향과 속도 정보를 표현할 수 있다.

다만 $\tau$에 action $a_t$가 직접 포함되는 것은 아니다. Action은 environment를 통해 $s_t\rightarrow s_{t+1}$를 만들고, CIC는 그 결과 상태 pair를 표현한다.

## 4. Forward mutual information의 의미

Mutual information은 두 방향으로 분해할 수 있다.

$$
I(\tau;Z)
=
H(Z)-H(Z\mid\tau)
$$

$$
I(\tau;Z)
=
H(\tau)-H(\tau\mid Z)
$$

DIAYN은 첫 번째 방향에 가깝다. Skill prior의 entropy를 유지하면서 transition이나 state에서 $z$를 맞히기 쉽게 만든다.

CIC는 두 번째 **forward decomposition**을 선택한다.

| 항 | 원하는 성질 |
|---|---|
| $H(\tau)$ 증가 | 전체적으로 다양한 상태 변화를 탐색 |
| $H(\tau\mid Z)$ 감소 | 같은 $z$에서는 일정한 종류의 변화를 생성 |

따라서 CIC가 원하는 것은 다음과 같다.

```text
전체 skill을 합치면 넓은 transition 공간을 탐색
각 skill을 고정하면 그 skill과 연결된 행동 패턴 생성
```

실제 환경의 $p(\tau\mid z)$를 모르기 때문에 학습 가능한 $q(\tau\mid z)$를 도입하면 다음 lower bound를 얻는다.

$$
I(\tau;Z)
\ge
H(\tau)
+
\mathbb{E}_{\tau,z}[\log q(\tau\mid z)]
$$

문제는 두 항을 어떻게 추정할 것인가다. CIC는 $H(\tau)$에는 particle estimator를, $q(\tau\mid z)$에는 contrastive density estimator를 사용한다.

## 5. Contrastive learning으로 skill과 transition 연결하기

CIC는 transition과 skill을 각각 embedding으로 바꾼다.

$$
h_{\tau,i}=g_\tau(s_i,s'_i)
$$

$$
h_{z,i}=g_z(z_i)
$$

같은 rollout에서 실제로 대응된 $(z_i,\tau_i)$는 positive pair다. 같은 batch의 다른 transition $(z_i,\tau_j)$는 negative pair로 사용한다.

```text
positive
z_i  ↔  τ_i

negative
z_i  ↔  τ_j,  i ≠ j
```

두 embedding의 compatibility는 temperature $T$가 적용된 cosine similarity로 계산한다.

$$
f(\tau,z)
=
\frac{g_\tau(\tau)^\top g_z(z)}
{\lVert g_\tau(\tau)\rVert
 \lVert g_z(z)\rVert T}
$$

Batch 크기가 $N$일 때 contrastive objective는 실제 pair의 score는 높이고 다른 transition들의 score는 낮춘다.

$$
F_{\mathrm{CIC}}(\tau_i,z_i)
=
f(\tau_i,z_i)
-
\log\left(
\frac{1}{N}
\sum_{j=1}^{N}
\exp f(\tau_j,z_i)
\right)
$$

구현에서는 $N\times N$ similarity matrix를 만들고, 대각선 원소를 정답으로 둔 cross-entropy 문제와 같은 형태로 계산한다.

### 5.1 Raw observation을 사용하지 않는 것인가?

아니다. Raw state는 여전히 encoder의 입력이다.

```text
(raw s_t, raw s_{t+1})
            ↓
transition encoder
            ↓
h_tau
```

차이는 novelty를 raw observation의 Euclidean distance로 직접 계산하지 않는다는 점이다. 각 상태 차원은 scale과 의미가 다르기 때문에, raw distance는 큰 관절 속도나 센서 변화에 과도하게 반응할 수 있다.

CIC는 $z$와 transition을 연결하도록 학습된 representation에서 거리를 측정한다. 하지만 이 공간이 반드시 인간이 생각하는 `전진`, `회전`, `일어나기` 축으로 정리된다는 보장은 없다. Encoder는 loss를 줄이는 특징을 학습하며, observation 설계에 따라 위치·자세·접촉 패턴 같은 shortcut을 사용할 수도 있다.

> 정확한 표현은 **observation을 버린다**가 아니라, **observation으로 만든 transition representation에서 행동 차이를 측정한다**이다.

## 6. Particle entropy가 exploration reward를 만든다

Contrastive representation만 학습한다고 새로운 행동을 적극적으로 찾아가는 것은 아니다. Policy가 embedding 공간의 이미 알려진 영역을 반복해도 positive pair를 구별할 수 있기 때문이다.

CIC는 현재 transition embedding $h_i$와 가까운 $k$개 이웃 사이의 거리를 사용한다.

$$
H_{\mathrm{particle}}(\tau_i)
\propto
\frac{1}{N_k}
\sum_{h_j\in\mathrm{kNN}(h_i)}
\log\lVert h_i-h_j\rVert
$$

해석은 단순하다.

| Embedding 주변 | 의미 | Intrinsic reward |
|---|---|---:|
| 가까운 이웃이 많음 | 이미 자주 본 transition | 낮음 |
| 가장 가까운 이웃도 멂 | 기존과 다른 transition | 높음 |

따라서 actor는 다음 순환을 만든다.

```text
새로운 transition 생성
        ↓
embedding에서 기존 이웃과 멀어짐
        ↓
높은 particle entropy reward
        ↓
DDPG가 해당 행동을 강화
        ↓
새 데이터로 representation을 다시 학습
```

Raw state entropy와 달리 여기서 거리의 의미는 contrastive encoder가 계속 바꾼다. 이것이 CIC의 장점이면서 동시에 reward가 learned representation에 의존한다는 위험이기도 하다.

## 7. 가장 헷갈리는 부분: InfoNCE가 actor reward인가?

논문의 이론식만 보면 actor reward를 다음처럼 만들 것 같다.

$$
r^{\mathrm{int}}
=
H_{\mathrm{particle}}(\tau)
+
\lambda F_{\mathrm{CIC}}(\tau,z)
$$

실제로 논문은 discriminator, similarity, uncertainty, entropy-only 등 여러 reward 구성을 비교했다. 그러나 이후 모든 주요 실험에 사용한 practical variant는 **entropy-only reward + CIC representation learning**이었다.

```text
Encoder update
contrastive loss로 g_tau, g_z 학습

Actor-critic update
k-NN particle entropy를 reward로 사용
```

즉 contrastive loss의 gradient가 environment를 거쳐 actor까지 직접 전달되는 것은 아니다.

$$
L_{\mathrm{CIC}}
\rightarrow
g_\tau
\rightarrow
H_{\mathrm{particle}}
\rightarrow
Q
\rightarrow
\pi
$$

Contrastive learning은 actor가 받는 reward의 **좌표계**를 만들고, actor는 그 좌표계에서 novelty를 최대화한다.

논문은 entropy-only가 가장 잘 나온 이유를 다음과 같이 해석한다.

1. CPC representation learning이 비슷한 행동을 clustering한다.
2. 그 공간의 entropy만 높여도 서로 다른 행동을 탐색할 수 있다.
3. Particle entropy는 정확한 entropy가 아닌 비례량이므로 두 reward를 합치면 scale 조정이 필요하다.

![CIC practical architecture](/assets/img/posts/rl/cic/01-cic-architecture.png){: width="1050" .d-block .mx-auto }
_Replay transition에서 particle entropy와 contrastive representation을 계산하는 CIC 구조. 이 그림은 두 목적을 함께 보여주지만, 주요 실험의 선택된 RL reward는 entropy-only이며 contrastive term은 auxiliary representation loss로 사용됐다. 출처: [Laskin et al., Figure 3](https://arxiv.org/abs/2202.00161)._

이 구분은 공식 코드에서도 확인된다. [`update_cic()`](https://github.com/rll-research/cic/blob/b523c3884256346cb585bf06e52a7aadc127dcfc/agent/cic.py#L171-L184)는 contrastive encoder를 갱신하고, reward-free [`update()`](https://github.com/rll-research/cic/blob/b523c3884256346cb585bf06e52a7aadc127dcfc/agent/cic.py#L204-L249)는 k-NN 기반 `compute_apt_reward()`의 출력을 critic reward로 사용한다.

## 8. 실제 학습은 DDPG로 어떻게 이어지는가?

DIAYN과 DADS의 주요 구현은 SAC였지만 CIC는 DDPG를 사용한다. CIC 목적함수가 DDPG를 반드시 요구해서가 아니다. URLB의 모든 baseline과 같은 RL backbone으로 비교하고, state-based DeepMind Control에서 사용된 설정을 맞추기 위한 선택이다.

Policy와 critic은 skill-conditioned 형태다.

$$
\pi_\theta(a\mid s,z)
$$

$$
Q_\phi(s,a,z)
$$

Pretraining 한 iteration을 코드 흐름에 가깝게 쓰면 다음과 같다.

1. $z\sim U([0,1]^{64})$에서 continuous skill을 뽑는다.
2. 같은 $z$를 50 environment step 동안 유지한다.
3. $a_t\sim\pi_\theta(\cdot\mid s_t,z)$를 실행한다.
4. $(s_t,a_t,s_{t+1},z)$를 replay buffer에 저장한다.
5. Batch의 $(z_i,\tau_i)$로 contrastive encoders를 업데이트한다.
6. Learned embedding의 k-NN 거리로 intrinsic reward를 계산한다.
7. DDPG critic과 actor를 업데이트한다.
8. Target critic을 soft update한다.

이를 한 줄로 연결하면 다음과 같다.

```text
sample z → collect transition → CPC encoder update
         → k-NN reward → critic update → actor update
```

Actor는 contrastive loss를 직접 미분하지 않는다. 대신 critic이 예측한 장기 particle-entropy return을 높이는 action을 학습한다.

## 9. 왜 64차원 continuous skill인가?

Skill 수가 실제 행동 종류보다 적으면 하나의 skill이 여러 behavior를 담당할 수 있다. 그러면 같은 $z$가 서로 다른 transition을 만들고 skill의 의미가 불안정해질 수 있다.

CIC는 이를 피하기 위해 큰 continuous skill space를 사용한다.

$$
z\in[0,1]^{64}
$$

여기서 64차원은 64개의 사람이 해석 가능한 동작 축을 뜻하지 않는다. Contrastive discriminator가 많은 behavior를 서로 다른 latent 영역에 담을 수 있도록 capacity를 늘린 것이다.

논문의 ablation에서는 다음 경향이 나타났다.

- Raw 64D skill을 별도 encoder로 projection하는 것이 중요했다.
- 4·8차원보다 32·64차원에서 zero-shot score가 높았다.
- 64차원에서 가장 높은 결과를 보였고 128차원에서는 더 좋아지지 않았다.

![CIC skill dimension and adaptation ablations](/assets/img/posts/rl/cic/03-cic-design-ablations.png){: width="1100" .d-block .mx-auto }
_Skill projection, latent dimension, adaptation 방법, grid sweep 위치에 따른 ablation. 64차원 skill과 grid sweep이 해당 실험 조건에서 가장 높은 결과를 보였다. 출처: [Laskin et al., Figure 6](https://arxiv.org/abs/2202.00161)._

### 9.1 Continuous latent면 행동을 더하거나 섞을 수 있는가?

보장되지 않는다.

$$
z_{\mathrm{forward}}+z_{\mathrm{right}}
\stackrel{?}{=}
z_{\mathrm{diagonal}}
$$

CIC objective에는 latent의 덧셈이 행동의 합성이 되도록 만드는 항이 없다. Continuous space는 interpolation과 dense sampling의 가능성을 주지만, 좌표축의 의미·선형성·disentanglement를 보장하지 않는다.

따라서 정확한 결론은 다음과 같다.

> CIC는 많은 행동을 큰 continuous space에 대응시키지만, 그 공간을 사람이 해석하거나 선형적으로 조합할 수 있게 만들지는 않는다.

## 10. URLB 실험에서 확인한 것

CIC는 state-based Unsupervised Reinforcement Learning Benchmark에서 평가됐다.

| 조건 | 설정 |
|---|---|
| Domain | Walker, Quadruped, Jaco |
| Downstream task | 총 12개 |
| Pretraining | task reward 없이 2M environment step |
| Fine-tuning | task별 extrinsic reward로 100K step |
| Seed | task·algorithm별 10개 |
| 공통 backbone | DDPG |
| 주 지표 | Interquartile Mean, IQM |

![CIC URLB aggregate results](/assets/img/posts/rl/cic/02-cic-urlb-results.png){: width="1100" .d-block .mx-auto }
_12개 URLB downstream task의 aggregate statistics. Optimality Gap은 낮을수록 좋고 나머지 score는 높을수록 좋다. 출처: [Laskin et al., Figure 5](https://arxiv.org/abs/2202.00161)._

논문이 보고한 IQM 기준으로 CIC는 다음 결과를 보였다.

- 다음 competence-based 방법인 APS보다 79% 높은 score
- 전체 차선 방법인 ProtoRL보다 18% 높은 score

이 결과를 `CIC가 모든 환경에서 항상 우수하다`로 일반화하면 안 된다. 정확한 범위는 **state observation을 사용하는 URLB, 2M-step pretraining, 100K-step adaptation 조건**이다.

### 10.1 왜 두 구성 요소가 모두 필요한가?

논문은 Quadruped Stand의 zero-shot extrinsic reward를 모니터링해 두 요소를 제거한 ablation을 비교했다.

![CIC representation and entropy ablation](/assets/img/posts/rl/cic/04-cic-representation-ablation.png){: width="760" .d-block .mx-auto }
_Particle entropy와 CIC representation learning을 함께 사용한 경우만 높은 reward를 유지했다. 이 extrinsic reward는 학습에 사용한 보상이 아니라 reward-free pretraining 중 행동을 진단하기 위한 지표다. 출처: [Laskin et al., Figure 7](https://arxiv.org/abs/2202.00161)._

```text
Particle entropy만 사용
→ 탐색할 representation의 행동 구조가 부족해 collapse

Contrastive representation만 사용
→ discriminator reward만으로 넓은 탐색을 만들지 못해 collapse

둘을 함께 사용
→ 행동적으로 구조화된 공간을 넓게 탐색
```

이 ablation이 CIC의 핵심 주장과 가장 직접적으로 연결된다. Contrastive learning과 entropy는 둘 중 하나를 선택하는 대체재가 아니라 서로 다른 역할을 맡는다.

## 11. Downstream adaptation은 zero-shot 명령 수행이 아니다

Pretraining이 끝나면 다음 policy를 얻는다.

$$
z\longrightarrow\pi(a\mid s,z)
$$

하지만 CIC에는 다음 mapping이 없다.

$$
\text{task command}\longrightarrow z
$$

새 task에서 논문은 먼저 4,000 environment interaction 동안 candidate skill을 시험한다. 제한된 budget에서 다음과 같은 단순 grid sweep이 가장 잘 작동했다.

$$
z=(v,v,\ldots,v),
\qquad
v\in\{0,0.1,\ldots,1.0\}
$$

그중 extrinsic return이 가장 높은 $z^*$를 선택하고, 남은 96,000 step 동안 $z^*$를 고정한 채 DDPG actor-critic을 task reward로 fine-tuning한다.

```text
pretrained skill repertoire
          ↓
4K step 동안 z 후보 평가
          ↓
가장 좋은 z* 선택
          ↓
96K step task-specific policy fine-tuning
```

따라서 CIC의 강점은 즉시 정답 skill을 찾아주는 것이 아니라, random initialization보다 downstream adaptation에 유리한 행동 구조를 미리 학습한다는 데 있다.

DADS와 비교하면 활용 방식도 다르다.

| DADS | CIC |
|---|---|
| Learned skill dynamics로 $z$ sequence planning | 후보 $z$를 실제 평가한 뒤 선택 |
| Policy 추가 학습 없이 MPC 가능 | 선택한 $z$로 actor-critic fine-tuning |
| Task cost로 model rollout 평가 | Extrinsic reward로 skill과 policy 평가 |

## 12. CIC가 해결하지 않은 문제

### 12.1 Task-to-skill mapping이 없다

`오른쪽으로 빠르게 이동` 같은 command를 적절한 $z$로 즉시 바꾸는 controller는 별도로 필요하다. 논문의 grid sweep은 평가 protocol이지 범용 task encoder가 아니다.

### 12.2 Latent composition을 보장하지 않는다

두 $z$의 평균이나 합이 두 행동의 의미 있는 조합이 된다는 보장이 없다. 연속 latent와 compositional latent는 다른 성질이다.

### 12.3 Full-state MDP에 한정됐다

논문은 state-based URLB만 다뤘다. Camera image처럼 부분 관측·고차원 pixel 입력에서 같은 결과가 유지되는지는 검증하지 않았다.

### 12.4 행동의 의미와 안전을 보장하지 않는다

Entropy를 높이는 과정에서는 불안정하거나 거친 동작도 발견된다. 논문도 Walker와 Quadruped의 chaotic exploration을 실제 로봇에 그대로 적용하면 손상 위험이 있다고 명시한다.

실제 시스템에서는 최소한 다음 제약이 필요하다.

```text
joint / torque / velocity limits
fall and collision constraints
workspace and contact safety
unsafe transition filtering
reset and emergency-stop policy
```

### 12.5 Reward가 learned geometry에 의존한다

Encoder가 어떤 특징을 강조하는지에 따라 k-NN distance의 의미도 달라진다. Representation shortcut이나 학습 중 geometry 변화는 critic이 보는 reward distribution을 바꿀 수 있다.

## 13. 공식 코드 분석은 별도 글로 보는 것이 좋은 이유

논문 글에서는 `왜 이런 objective를 선택했는가`가 중심이다. 공식 저장소 분석에서는 다음 실제 경로를 확인해야 한다.

| 파일·함수 | 확인할 내용 |
|---|---|
| `agent/cic.py::CIC.forward()` | $s$, $s'$, $z$가 query와 key로 변환되는 과정 |
| `compute_cpc_loss()` | Batch similarity matrix와 positive diagonal 구성 |
| `update_cic()` | Contrastive encoder만 갱신되는 gradient 경로 |
| `compute_apt_reward()` | k-NN 거리, RMS normalization, clipping, log reward |
| `CICAgent.update()` | Encoder update와 DDPG critic·actor update 연결 |
| `update_meta()` | 64D skill을 50 step마다 다시 sampling하는 과정 |
| `agent/ddpg.py` | Skill-conditioned observation이 actor와 critic으로 들어가는 과정 |

특히 논문 수준에서는 $h_i$를 transition embedding으로 설명하지만, 공식 코드의 default k-NN reward 경로가 어떤 tensor를 실제로 사용하는지는 코드에서 따로 추적할 가치가 있다. 이 부분은 수식 설명과 섞기보다 companion post에서 tensor shape와 line-by-line flow로 확인하는 편이 정확하다.

## 14. 최종 정리

CIC에서 남겨야 할 핵심은 여섯 가지다.

1. CIC의 $\tau=(s,s')$는 긴 trajectory가 아니라 한 step의 state transition이다.
2. $I(\tau;Z)=H(\tau)-H(\tau\mid Z)$로 diversity와 skill consistency를 함께 본다.
3. Contrastive learning은 skill과 transition을 연결하는 representation을 만든다.
4. Actor-critic은 그 representation의 k-NN particle entropy를 intrinsic reward로 최대화한다.
5. 64차원 continuous skill은 큰 repertoire를 담지만 해석 가능성이나 선형 composition을 보장하지 않는다.
6. CIC는 zero-shot command controller가 아니라 downstream fine-tuning을 위한 reward-free pretraining 방법이다.

한 문장으로 다시 압축하면 다음과 같다.

> **CIC는 contrastive learning으로 행동을 skill에 정리하고, particle entropy로 그 행동 공간을 넓게 탐색한다.**

DIAYN이 `서로 구별되는 상태`, DADS가 `서로 다르고 예측 가능한 상태 변화`를 강조했다면, CIC는 `명시적으로 넓게 탐색하면서 큰 continuous skill space에 행동을 정리하는 방법`을 보여준다.

## 참고 자료

- [Laskin et al., Contrastive Intrinsic Control for Unsupervised Reinforcement Learning](https://proceedings.neurips.cc/paper_files/paper/2022/hash/debf482a7dbdc401f9052dbe15702837-Abstract.html)
- [arXiv:2202.00161](https://arxiv.org/abs/2202.00161)
- [CIC supplementary material](https://proceedings.neurips.cc/paper_files/paper/2022/file/debf482a7dbdc401f9052dbe15702837-Supplemental-Conference.pdf)
- [rll-research/cic official implementation](https://github.com/rll-research/cic)
- [DIAYN 논문 정리](/posts/diayn-diversity-is-all-you-need/)
- [DADS 논문 정리](/posts/dads-dynamics-aware-skill-discovery/)
