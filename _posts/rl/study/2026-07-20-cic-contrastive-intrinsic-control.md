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

[DIAYN](/posts/diayn-diversity-is-all-you-need/)은 상태만 보고도 실행된 skill을 맞힐 수 있도록 서로 다른 상태 분포를 만들었다. [DADS](/posts/dads-dynamics-aware-skill-discovery/)는 현재 상태에서 각 skill이 만들 다음 상태를 모델링해, 서로 다르면서도 예측 가능한 변화를 학습했다.

CIC, **Contrastive Intrinsic Control**은 여기서 질문을 하나 더 던진다.

> Skill을 서로 구별할 수 있다는 사실만으로, 복잡한 환경의 행동 공간을 충분히 넓게 탐색했다고 말할 수 있는가?

답은 반드시 그렇지는 않다. 여러 skill이 좁은 상태 영역 안에서 작은 차이만 만들어도 분류기는 그들을 구별할 수 있다. 반대로 새로운 상태를 많이 방문하는 탐색 정책이 있더라도, 그 행동을 나중에 특정 skill로 다시 호출할 수 없다면 재사용 가능한 repertoire라고 보기 어렵다.

CIC는 이 두 문제를 분리해 해결한다.

> **Contrastive learning으로 skill과 state transition의 관계를 정리하고, particle entropy로 그 transition 공간을 넓게 탐색한다.**

![CIC가 발견한 Walker, Quadruped, Jaco skill](/assets/img/posts/rl/cic/00-cic-discovered-skills.png){: width="1000" .d-block .mx-auto }
_같은 reward-free pretraining에서 발견된 Walker의 leap·jog, Quadruped의 일어나기·좌측 이동, Jaco의 물체 밀기 행동. 사람이 이 이름을 미리 부여한 것이 아니라 학습 후 관찰해 붙인 의미다. 출처: [Laskin et al., Figure 2](https://arxiv.org/abs/2202.00161)._

## 0. 먼저 보는 전체 구조

CIC의 전체 학습은 다음 한 흐름으로 정리할 수 있다.

```text
continuous skill z 샘플링
          ↓
policy π(a | s, z)가 transition τ=(s, s') 생성
          ↓
contrastive learning으로 z와 τ의 embedding 학습
          ↓
embedding의 k-NN 거리로 particle entropy 계산
          ↓
그 값을 intrinsic reward로 DDPG actor-critic 업데이트
```

여기서 역할을 섞어 읽으면 CIC가 불필요하게 복잡해진다.

- **Contrastive learning**은 어떤 transition이 어떤 skill과 연결되는지 학습한다.
- **Particle entropy**는 이미 본 transition과 다른 행동을 찾도록 보상을 만든다.
- **DDPG**는 그 보상의 장기 누적값이 커지는 action을 학습한다.

즉 표현 학습은 행동 차이를 측정할 공간을 만들고, 강화학습은 그 공간을 실제로 넓혀 간다.

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

CIC의 `reward-free`는 **pretraining 중 task reward를 사용하지 않는다**는 뜻이다. 이후 downstream task에서는 extrinsic reward로 후보 skill을 평가하고 policy를 추가로 fine-tuning한다. 따라서 task reward 없이 완성된 범용 controller를 만드는 방법이 아니라, 새 task에 적응하기 좋은 policy initialization과 행동 repertoire를 만드는 방법이다.

## 2. 앞선 방법과 CIC의 차이

CIC는 DIAYN이나 DADS를 반드시 대체하는 방법이 아니다. 세 방법은 skill diversity를 어디에서 측정하고, 발견한 skill을 무엇에 사용하려는지가 다르다. CIC의 위치를 APT·APS까지 함께 놓으면 다음과 같다.

| 방법 | 행동 다양성을 측정하는 기준 | 얻는 구조 | 남는 질문 |
|---|---|---|---|
| DIAYN | 상태에서 $z$를 분류하는 $q(z\mid s)$ | 구별되는 categorical skill | 좁은 영역의 작은 차이만 배울 수 있음 |
| DADS | $q(s'\mid s,z)$의 조건부 likelihood | 예측 가능한 transition과 planning model | 고차원 conditional density model의 부담 |
| APT | learned state representation의 k-NN 거리 | 넓은 탐색 | 행동을 특정 $z$로 다시 호출할 수 없음 |
| APS | particle entropy와 successor feature | 탐색 가능한 continuous skill | 큰 skill space를 안정적으로 구별할 방법 |
| CIC | $z$-transition contrastive representation의 거리 | 넓은 탐색과 64D continuous skill | task-to-skill mapping과 latent 해석은 별도 문제 |

CIC가 선택한 변화는 두 가지다.

1. **상태가 아니라 transition을 구별한다.** 같은 위치를 지나더라도 전진과 후진처럼 변화 방향이 다른 행동을 나눌 수 있다.
2. **분류 확률이나 명시적 density model 대신 contrastive learning을 사용한다.** 실제 $z$와 transition pair를 batch 안의 다른 pair와 비교하므로 큰 continuous skill space에도 적용하기 쉽다.

여기에 particle entropy를 결합해, skill끼리 구별되는 데서 멈추지 않고 transition 공간 자체를 넓게 방문하도록 만든다. 이 관계를 이해하려면 먼저 CIC가 말하는 transition이 정확히 무엇인지 봐야 한다.

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

## 6. Particle entropy로 표현 공간을 넓게 탐색하기

Contrastive representation은 `어떤 transition이 어떤 skill과 대응하는가`를 학습한다. 그러나 이것만으로 policy가 새로운 행동을 적극적으로 찾는 것은 아니다. 이미 방문한 좁은 영역에서도 positive pair와 negative pair를 구별할 수 있기 때문이다.

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

Policy는 이 값을 intrinsic reward로 받아 다음 순환을 만든다.

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

Raw state에서 바로 거리를 재는 것과 달리, 여기서 거리의 의미는 contrastive encoder가 만든다. 따라서 `skill과 관련된 행동 차이`를 반영할 수 있지만, encoder가 바뀌면 같은 transition의 novelty도 바뀔 수 있다.

### 6.1 Contrastive score도 actor reward로 쓰는가?

앞에서 본 mutual information lower bound를 그대로 옮기면 intrinsic reward는 두 항의 합처럼 보인다.

$$
r^{\mathrm{int}}
=
H_{\mathrm{particle}}(\tau)
+
\lambda F_{\mathrm{CIC}}(\tau,z)
$$

논문은 이 아이디어에서 출발해 discriminator, similarity, uncertainty, entropy-only 등 여러 reward 구성을 비교했다. 그러나 주요 실험에서 최종적으로 사용한 형태는 **CIC representation learning + entropy-only actor reward**였다.

```text
Encoder update
contrastive loss로 g_tau, g_z 학습

Actor-critic update
k-NN particle entropy를 reward로 사용
```

즉 contrastive loss의 gradient가 environment를 지나 actor까지 직접 전달되는 것은 아니다. 두 학습은 다음 경로로 연결된다.

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

Contrastive learning이 비슷한 행동을 가까이 모으는 **거리 공간**을 만들면, actor는 그 공간에서 novelty를 최대화한다. 논문은 particle entropy가 정확한 entropy가 아니라 비례량이기 때문에 contrastive score와 직접 더할 경우 reward scale을 맞추기 어렵다는 점도 지적한다.

![CIC practical architecture](/assets/img/posts/rl/cic/01-cic-architecture.png){: width="1050" .d-block .mx-auto }
_Replay transition에서 particle entropy와 contrastive representation을 계산하는 CIC 구조. 이 그림은 두 목적을 함께 보여주지만, 주요 실험의 선택된 RL reward는 entropy-only이며 contrastive term은 auxiliary representation loss로 사용됐다. 출처: [Laskin et al., Figure 3](https://arxiv.org/abs/2202.00161)._

이 구분은 공식 코드에서도 확인된다. [`update_cic()`](https://github.com/rll-research/cic/blob/b523c3884256346cb585bf06e52a7aadc127dcfc/agent/cic.py#L171-L184)는 contrastive encoder를 갱신하고, reward-free [`update()`](https://github.com/rll-research/cic/blob/b523c3884256346cb585bf06e52a7aadc127dcfc/agent/cic.py#L204-L249)는 k-NN 기반 `compute_apt_reward()`의 출력을 critic reward로 사용한다.

여기에는 논문 설명과 공개 코드 사이의 구현상 세부 차이가 있다. 이 commit의 default update는 transition key `pred_net([s,s'])`가 아니라 `state_net(next_obs)` embedding끼리의 k-NN 거리를 reward로 사용한다. 정확한 tensor와 gradient 경로는 [공식 코드 분석 글](/posts/cic-official-code-walkthrough/)에서 별도로 추적했다.

정리하면 `contrastive loss는 표현 학습용`, `particle entropy는 actor-critic 보상용`이다. 이 구분을 잡고 나면 뒤의 DDPG 학습 흐름은 일반적인 off-policy actor-critic과 크게 다르지 않다.

## 7. 실제 학습은 DDPG로 어떻게 이어지는가?

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

## 8. 왜 64차원 continuous skill인가?

Skill 수가 실제 행동 종류보다 적으면 하나의 skill이 여러 behavior를 담당할 수 있다. 그러면 같은 $z$가 서로 다른 transition을 만들고 skill의 의미가 불안정해질 수 있다.

CIC는 이를 피하기 위해 큰 continuous skill space를 사용한다.

$$
z\in[0,1]^{64}
$$

여기서 64차원은 사람이 해석할 수 있는 동작 축 64개를 뜻하지 않는다. 많은 행동을 서로 다른 latent 영역에 담을 수 있도록 skill space의 용량을 늘린 것이다.

논문의 ablation에서는 다음 경향이 나타났다.

- Raw 64D skill을 별도 encoder로 projection하는 것이 중요했다.
- 4·8차원보다 32·64차원에서 zero-shot score가 높았다.
- 64차원에서 가장 높은 결과를 보였고 128차원에서는 더 좋아지지 않았다.

![CIC skill dimension and adaptation ablations](/assets/img/posts/rl/cic/03-cic-design-ablations.png){: width="1100" .d-block .mx-auto }
_Skill projection, latent dimension, adaptation 방법, grid sweep 위치에 따른 ablation. 64차원 skill과 grid sweep이 해당 실험 조건에서 가장 높은 결과를 보였다. 출처: [Laskin et al., Figure 6](https://arxiv.org/abs/2202.00161)._

### 8.1 Continuous latent면 행동을 더하거나 섞을 수 있는가?

보장되지 않는다.

$$
z_{\mathrm{forward}}+z_{\mathrm{right}}
\stackrel{?}{=}
z_{\mathrm{diagonal}}
$$

CIC 목적함수에는 latent의 덧셈이 행동의 합성이 되도록 만드는 항이 없다. Continuous space는 interpolation과 촘촘한 sampling의 가능성을 주지만, 각 좌표축의 의미·선형성·disentanglement를 보장하지 않는다.

따라서 정확한 결론은 다음과 같다.

> CIC는 많은 행동을 큰 continuous space에 대응시키지만, 그 공간을 사람이 해석하거나 선형적으로 조합할 수 있게 만들지는 않는다.

## 9. URLB 실험에서 확인한 것

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

- 비교한 competence-based 방법 중 다음 성능인 APS보다 79% 높은 score
- 전체 차선 방법인 ProtoRL보다 18% 높은 score

이 결과를 `CIC가 모든 환경에서 항상 우수하다`로 일반화하면 안 된다. 정확한 범위는 **state observation을 사용하는 URLB, 2M-step pretraining, 100K-step adaptation 조건**이다.

### 9.1 왜 두 구성 요소가 모두 필요한가?

논문은 Quadruped Stand의 zero-shot extrinsic reward를 모니터링해 두 요소를 제거한 ablation을 비교했다.

![CIC representation and entropy ablation](/assets/img/posts/rl/cic/04-cic-representation-ablation.png){: width="760" .d-block .mx-auto }
_Particle entropy와 CIC representation learning을 함께 사용한 경우만 높은 reward를 유지했다. 이 extrinsic reward는 학습에 사용한 보상이 아니라 reward-free pretraining 중 행동을 진단하기 위한 지표다. 출처: [Laskin et al., Figure 7](https://arxiv.org/abs/2202.00161)._

결과의 해석은 앞의 구조와 정확히 이어진다.

```text
Particle entropy만 사용
→ 넓게 움직일 이유는 있지만 행동을 정리할 representation이 약함

Contrastive representation만 사용
→ skill-transition 관계는 배우지만 넓게 탐색할 압력이 약함

둘을 함께 사용
→ 행동적으로 정리된 공간을 넓게 탐색
```

두 요소는 대체재가 아니다. Contrastive learning이 거리의 의미를 만들고, particle entropy가 그 거리 공간의 coverage를 넓힌다.

## 10. Downstream adaptation은 zero-shot 명령 수행이 아니다

Pretraining이 끝나면 다음 policy를 얻는다.

$$
z\longrightarrow\pi(a\mid s,z)
$$

하지만 CIC에는 다음 mapping이 없다.

$$
\text{task command}\longrightarrow z
$$

새 task에서 논문은 먼저 4,000 environment interaction 동안 후보 skill을 시험한다. 제한된 budget에서는 다음과 같은 단순한 grid sweep이 가장 잘 작동했다.

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

따라서 CIC의 강점은 명령을 받자마자 정답 skill을 찾아주는 데 있지 않다. Random initialization보다 downstream adaptation에 유리한 행동 구조를 미리 학습한다는 데 있다.

DADS와 비교하면 활용 방식도 다르다.

| DADS | CIC |
|---|---|
| Learned skill dynamics로 $z$ sequence planning | 후보 $z$를 실제 평가한 뒤 선택 |
| Policy 추가 학습 없이 MPC 가능 | 선택한 $z$로 actor-critic fine-tuning |
| Task cost로 model rollout 평가 | Extrinsic reward로 skill과 policy 평가 |

## 11. CIC가 해결하지 않은 문제

CIC의 실험 결과가 좋다고 해서 continuous skill space가 곧바로 범용 행동 인터페이스가 되는 것은 아니다.

| 남은 문제 | 정확한 의미 |
|---|---|
| Task-to-skill mapping | `오른쪽으로 빠르게 이동` 같은 command를 적절한 $z$로 바꾸는 controller가 없다. Grid sweep은 평가 절차이지 범용 task encoder가 아니다. |
| Latent 해석과 합성 | 두 $z$의 평균이나 합이 두 행동의 의미 있는 조합이 된다는 보장이 없다. Continuous latent와 compositional latent는 다른 성질이다. |
| State-based 검증 | 논문은 full-state URLB를 다뤘다. 부분 관측이나 고차원 camera image에서도 같은 결과가 유지되는지는 검증하지 않았다. |
| Representation 의존성 | Encoder가 강조하는 특징에 따라 k-NN 거리와 intrinsic reward의 의미가 달라진다. 학습 중 embedding geometry 변화는 critic의 reward distribution도 바꾼다. |
| 행동의 유용성과 안전 | Diversity는 안정성, 에너지 효율, 충돌 회피를 뜻하지 않는다. 불안정하거나 거친 행동도 새로운 transition이면 높은 보상을 받을 수 있다. |

마지막 항은 실제 로봇 적용에서 특히 중요하다. 논문도 Walker와 Quadruped의 거친 탐색을 물리 시스템에 그대로 적용하면 손상 위험이 있다고 명시한다. 최소한 joint·torque·velocity limit, fall·collision constraint, workspace 제한, 안전한 reset과 emergency stop을 별도 계층으로 두어야 한다.

즉 CIC가 학습하는 것은 **다양한 행동의 후보 공간**이다. 어떤 행동이 유용하고 안전한지는 downstream objective와 constraint가 추가로 결정해야 한다.

## 12. 최종 정리

CIC의 논리를 처음부터 다시 연결하면 다음과 같다.

1. $\tau=(s,s')$는 긴 trajectory가 아니라 한 step의 state transition이다.
2. $I(\tau;Z)=H(\tau)-H(\tau\mid Z)$는 전체 transition diversity와 skill별 일관성을 함께 요구한다.
3. Contrastive learning은 skill과 transition을 비교할 representation을 만든다.
4. Particle entropy는 그 representation에서 드문 transition에 높은 intrinsic reward를 준다.
5. DDPG는 이 reward의 장기 return을 높이는 skill-conditioned policy를 학습한다.
6. 64D continuous skill은 큰 repertoire를 담지만 해석 가능성, 합성 가능성, task-to-skill mapping을 보장하지 않는다.

한 문장으로 압축하면 다음과 같다.

> **CIC는 contrastive learning으로 행동을 skill에 정리하고, particle entropy로 그 행동 공간의 coverage를 넓힌다.**

DIAYN이 `서로 구별되는 상태`, DADS가 `서로 다르고 예측 가능한 상태 변화`를 강조했다면, CIC는 `구별되는 행동을 넓게 탐색해 큰 continuous skill space에 담는 방법`을 보여준다. 다만 이것은 zero-shot 명령 controller의 완성이 아니라, downstream adaptation을 위한 reward-free pretraining이다.

## 후속 글: 공식 코드에서는 어떻게 구현됐는가?

논문에서는 목적함수와 실험 해석에 집중했다. [CIC 공식 코드 분석](/posts/cic-official-code-walkthrough/)에서는 [`rll-research/cic`](https://github.com/rll-research/cic)의 `compute_cpc_loss()`, `update_cic()`, `compute_apt_reward()`, `CICAgent.update()`를 따라가며 tensor shape, gradient 경로, 50-step skill resampling과 DDPG update 순서를 분리해 확인한다.

## 참고 자료

- [Laskin et al., Contrastive Intrinsic Control for Unsupervised Reinforcement Learning](https://proceedings.neurips.cc/paper_files/paper/2022/hash/debf482a7dbdc401f9052dbe15702837-Abstract.html)
- [arXiv:2202.00161](https://arxiv.org/abs/2202.00161)
- [CIC supplementary material](https://proceedings.neurips.cc/paper_files/paper/2022/file/debf482a7dbdc401f9052dbe15702837-Supplemental-Conference.pdf)
- [rll-research/cic official implementation](https://github.com/rll-research/cic)
- [DIAYN 논문 정리](/posts/diayn-diversity-is-all-you-need/)
- [DADS 논문 정리](/posts/dads-dynamics-aware-skill-discovery/)
