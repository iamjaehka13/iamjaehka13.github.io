---
title: "Gaitor: 여러 Gait를 잇는 Latent Space"
date: 2026-07-25 00:02:00 +0900
categories: [RL, Study]
tags: [gaitor, quadruped-locomotion, representation-learning, conditional-vae, gait-transition, anymal-c, whole-body-control, learning-from-demonstration, terrain-aware-locomotion, robotics]
description: "Gaitor가 전문가의 trot·crawl·pace trajectory를 조건부 VAE에 압축하고, gait label과 2D planning manifold를 분리해 연속 전환과 지형 적응을 만드는 과정을 정리한다."
math: true
image:
  path: /assets/img/posts/rl/gaitor/00-gaitor-preview.png
  alt: trot, crawl, pace를 연속적인 latent planning manifold로 연결하는 Gaitor
---

이전 [MCP 글](/posts/mcp-multiplicative-compositional-policies/)에서는 여러 motor primitive의 action distribution을 곱해 복합 행동을 만드는 방법을 살펴봤다. 이번에는 조합의 대상이 action primitive가 아니라 **보행 궤적의 표현**이다.

사족보행 로봇은 trot, crawl, pace처럼 서로 다른 gait를 사용할 수 있다. 가장 단순한 방법은 gait마다 controller를 따로 만들고 필요할 때 교체하는 것이다. 하지만 이 방식에서는 각 gait가 독립된 기술로 남기 때문에 다음 질문에 답하기 어렵다.

```text
trot과 crawl 사이에는 어떤 보행이 존재할까?
gait를 바꾸는 동안 contact schedule은 어떻게 이어져야 할까?
지형이 높아지면 보폭과 발 높이를 어떤 좌표에서 조절해야 할까?
```

**Gaitor**는 이 문제를 여러 gait의 expert trajectory를 하나의 conditional VAE에 학습시키는 방식으로 접근한다.

> **Gaitor는 trot·crawl·pace의 동역학을 공유 latent space에 압축하고, 그중 보행 계획에 유용한 2차원 구조를 조작해 연속적인 gait 전환과 지형 적응 trajectory를 생성한다.**

여기서 중요한 점은 Gaitor가 보상 없이 gait를 발견하는 강화학습 방법이 아니라는 것이다. Expert controller가 만든 데이터를 이용해 표현을 학습하고, latent planner도 behavioural cloning으로 학습한다. 최종 torque는 별도의 whole-body controller가 계산한다.

## 0. 결과부터 보기

![Gaitor의 trot, terrain climb, crawl, pace latent trajectory와 contact schedule](/assets/img/posts/rl/gaitor/01-paper-gait-transition.png){: width="1400" .d-block .mx-auto }

_위쪽은 trot, step climb, crawl, pace에 대응하는 robot motion이고, 가운데는 $z_0$-$z_1$ latent trajectory, 아래는 네 발의 contact schedule이다. 출처: Mitchell et al., Figure 1, [PMLR 논문](https://proceedings.mlr.press/v270/mitchell25a.html), [PDF](https://raw.githubusercontent.com/mlresearch/v270/main/assets/mitchell25a/mitchell25a.pdf) (CC BY 4.0)._

그림에서 먼저 볼 것은 검은 latent trajectory의 모양 자체보다 **색과 contact schedule의 관계**다.

- `Trot`: 대각선 발 두 개가 한 쌍으로 움직인다.
- `Crawl`: 한 번에 한 발씩 순차적으로 움직인다.
- `Pace`: 같은 쪽 앞발과 뒷발이 같은 phase로 움직인다.
- `Terrain climb`: gait는 trot으로 유지되지만 latent 궤적이 변형되어 swing 특성이 달라진다.

즉 Gaitor의 latent space는 단순한 데이터 압축 공간이 아니다. 어느 지점을 지나고 있는지가 보행 phase와 발 접촉 상태에 연결되고, 궤적의 크기와 모양은 swing height와 swing length에 연결된다.

<div class="ratio ratio-16x9">
  <iframe
    src="https://www.youtube.com/embed/eVFQbRyilCA"
    title="Gaitor supplementary video"
    loading="lazy"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen>
  </iframe>
</div>

_Gaitor 저자들이 공개한 [공식 영상](https://www.youtube.com/watch?v=eVFQbRyilCA). 연속 gait 전환과 12.5 cm platform 등반을 확인할 수 있다._

다만 그림과 영상의 범위를 넘어서 해석하면 안 된다.

- 실제 robot에서 완전한 pace gait를 안정적으로 시연한 결과는 아니다.
- 논문이 실제로 배포한 전환의 끝점은 **crawl/pace hybrid**다.
- 2차원 구조가 모든 gait와 모든 robot에서 항상 나타난다는 보장은 없다.
- Gaitor 전체의 안정성에는 VAE뿐 아니라 expert data와 WBC도 크게 기여한다.

## 1. 논문 정보

| 항목 | 내용 |
|---|---|
| Title | Gaitor: Learning a Unified Representation Across Gaits for Real-World Quadruped Locomotion |
| Authors | Alexander L. Mitchell, Wolfgang Merkt, Aristotelis Papatheodorou, Ioannis Havoutis, Ingmar Posner |
| Venue | CoRL 2024, PMLR 270 proceedings published in 2025 |
| Robot | ANYmal C |
| Training data | RLOC와 Dynamic Gaits가 생성한 약 30분의 expert trajectory |
| Gaits | Trot, crawl, pace |
| Representation | Conditional VAE, robot latent 10-D, terrain latent 10-D |
| Planning | $z_0$-$z_1$의 2D polar trajectory |
| Planner training | Behavioural cloning |
| Deployment | 400 Hz, robot CPU, 2.5 ms control budget |
| Source | [PMLR](https://proceedings.mlr.press/v270/mitchell25a.html), [PDF](https://raw.githubusercontent.com/mlresearch/v270/main/assets/mitchell25a/mitchell25a.pdf), [OpenReview](https://openreview.net/forum?id=ySI0tBYxpz), [arXiv](https://arxiv.org/abs/2405.19452) |

논문의 목적은 최고 성능의 locomotion controller를 만드는 것보다, **분리된 gait 사이의 공통 구조를 해석 가능한 표현으로 학습할 수 있는가**를 확인하는 데 가깝다.

## 2. Gait는 단순한 속도 명령이 아니다

Gait는 네 발이 어느 순서와 phase 관계로 지면을 밟는지를 뜻한다. 같은 전진 속도라도 contact pattern이 다르면 다른 gait다.

![Trot, crawl, pace의 대표적인 contact pattern](/assets/img/posts/rl/gaitor/02-gait-contact-patterns.svg){: width="1200" .d-block .mx-auto }

### 2.1 Trot

Trot에서는 대각선 발이 한 쌍으로 움직인다.

```text
LF + RH
RF + LH
```

비교적 빠르고 동적인 보행에 적합하지만, 두 발이 동시에 swing하기 때문에 support polygon은 crawl보다 작다.

### 2.2 Crawl

Crawl에서는 보통 한 번에 한 발만 움직이고 나머지 세 발이 지지한다.

```text
LF → RH → RF → LH
```

속도는 느리지만 정적 안정성을 확보하기 쉽다.

### 2.3 Pace

Pace에서는 같은 쪽의 앞발과 뒷발이 함께 움직인다.

```text
LF + LH
RF + RH
```

Trot과 비교하면 front-hind phase relationship이 반대다. 이 차이가 Gaitor의 연속 전환을 이해하는 핵심이다.

## 3. 기존 방식의 두 극단

논문은 기존 locomotion 방법을 크게 두 방향으로 본다.

### 3.1 Gait별로 controller를 따로 만드는 방법

```text
trot controller
crawl controller
pace controller
        ↓
high-level selector가 하나를 선택
```

각 gait를 안정적으로 최적화하기는 쉽지만, gait 사이의 공통 구조를 공유하지 못한다. 전환도 controller를 교체하는 별도 문제로 남는다.

### 3.2 큰 black-box model이 여러 gait를 모두 생성하는 방법

하나의 큰 model이 multi-modal locomotion distribution을 학습할 수도 있다. 그러나 latent variable이 무엇을 뜻하는지 알기 어렵고, 보폭이나 발 높이 같은 특성을 직접 조절하기 어려울 수 있다.

Gaitor는 두 방식의 중간 지점을 택한다.

```text
여러 gait를 하나의 model에 학습
        +
latent structure를 해석하고 직접 계획에 사용
```

## 4. 가장 중요한 구분: gait label과 latent trajectory

Gaitor를 처음 읽을 때 가장 헷갈리는 부분은 `gait를 무엇이 결정하는가`다. Decoder 입력에는 gait label $g$도 있고, robot latent $z_r$도 있다.

![gait label과 latent trajectory가 담당하는 서로 다른 역할](/assets/img/posts/rl/gaitor/03-g-vs-latent.svg){: width="1200" .d-block .mx-auto }

두 변수의 역할은 다음처럼 구분할 수 있다.

| 변수 | 담당하는 것 |
|---|---|
| $g$ | 다리 사이의 phase 관계와 gait family |
| $\phi$ | 현재 gait cycle의 진행 위치 |
| $\Delta\phi$ | phase 증가량, 즉 cadence |
| $R$ | 2D latent orbit의 반지름과 swing geometry |
| $z_0,z_1$ | phase와 $R$로 만든 planning coordinate |
| $z_2,\ldots,z_9$ | encoder가 추정한 나머지 robot dynamics 정보 |
| $a$ | 원하는 base heading과 velocity |
| $z_g$ | terrain condition |

Decoder를 단순화해 쓰면 다음과 같다.

$$
\hat X_r^+
=
D_\theta
\left(
\tilde z_r,\,
z_g,\,
a,\,
g
\right)
$$

논문에서 gait label은 연속적인 실수다.

$$
g=
\begin{cases}
1 & \text{trot}\\
0 & \text{crawl}\\
-1 & \text{pace}
\end{cases}
$$

따라서 $g=0.5$나 $g=-0.5$ 같은 중간값도 decoder에 넣을 수 있다. 이때 model은 학습된 gait 사이의 관계를 이용해 중간 contact schedule을 생성한다.

### 4.1 같은 latent point라도 $g$가 다르면 결과가 달라진다

$z_0,z_1$만 보면 보행 phase와 swing geometry를 알 수 있지만, 그것만으로 어떤 다리끼리 함께 움직일지는 완전히 정해지지 않는다.

```text
같은 (z₀, z₁), g = 1
→ trot의 phase relationship으로 decode

같은 (z₀, z₁), g = 0
→ crawl의 phase relationship으로 decode
```

즉 $g$는 gait 간의 **조건**이고, $z_0,z_1$은 해당 gait 안에서 시간에 따라 움직이는 **계획 좌표**다.

## 5. 10차원 VAE에서 2차원 planning manifold를 찾다

Gaitor의 robot latent는 처음부터 2차원으로 설계되지 않았다.

$$
z_r \in \mathbb R^{10}
$$

Encoder 입력의 한 시점 robot state는 다음 요소를 포함한다.

$$
x_k=
\left[
q_k,\,
ee_k,\,
\tau_k,\,
\lambda_k,\,
\dot c_k,\,
c_{\theta_x},\,
c_{\theta_y},\,
\Delta c_k
\right]
$$

각 항은 다음을 뜻한다.

- $q_k$: joint angle
- $ee_k$: base frame에서 본 end-effector position
- $\tau_k$: joint torque
- $\lambda_k$: contact force
- $\dot c_k$: base velocity
- $c_{\theta_x},c_{\theta_y}$: base roll과 pitch
- $\Delta c_k$: 기준 frame에 대한 base pose evolution

Encoder는 한 순간만 보지 않고 $N$개 state history를 입력받는다.

$$
X_r(k)
=
[x_{k-N+1},\ldots,x_k]
$$

이 history로 Gaussian posterior의 mean과 variance를 출력하고 robot latent를 sampling한다.

$$
q_\psi(z_r\mid X_r)
=
\mathcal N
\left(
\mu_\psi(X_r),
\operatorname{diag}(\sigma_\psi^2(X_r))
\right)
$$

Decoder는 이 latent와 조건을 받아 앞으로 $M$개 robot state를 예측한다.

$$
\hat X_r^+(k)
=
[\hat x_{k+1},\ldots,\hat x_{k+M}]
$$

### 5.1 VAE loss

기본 ELBO loss는 reconstruction error와 KL divergence로 구성된다.

$$
\mathcal L_{\text{ELBO}}
=
\operatorname{MSE}
\left(
X_r^+,\hat X_r^+
\right)
+
\beta
D_{\mathrm{KL}}
\left[
q(z_r\mid X_r)\,\|\,p(z_r)
\right]
$$

Reconstruction 항은 미래 trajectory를 정확히 복원하게 하고, KL 항은 latent distribution을 prior 근처에 정리한다. 논문은 GECO를 이용해 학습 중 $\beta$를 조정한다.

### 5.2 Contact predictor가 필요한 이유

Robot state를 잘 복원하는 것만으로 locomotion에 중요한 접촉 구조가 latent에 선명하게 남는다는 보장은 없다. 그래서 Gaitor는 performance predictor를 추가한다.

$$
\hat S^+
=
P_\omega(z_r,a,g)
$$

$S^+$는 미래의 각 발 contact state다. 전체 VAE loss는 다음과 같다.

$$
\boxed{
\mathcal L_{\text{VAE}}
=
\mathcal L_{\text{ELBO}}
+
\gamma
\operatorname{BCE}
\left(
S^+,\hat S^+
\right)
}
$$

BCE gradient는 contact predictor만 업데이트하는 것이 아니라 VAE encoder까지 전달된다. 따라서 encoder는 trajectory를 압축하면서도 **어떤 발이 언제 접촉하는지 분류하기 좋은 표현**을 만들도록 압력을 받는다.

### 5.3 왜 10차원인데 2차원이라고 부르는가?

학습 후 저자들은 각 latent dimension에 oscillation을 주입하고 decoder 출력을 관찰했다. 그 결과 $z_0,z_1$만으로도 완전한 locomotion trajectory를 재구성할 수 있었고, 두 축이 foot swing의 height와 length에 연결된다는 것을 확인했다.

- Figure 4 기준 수평 $z_0$: step height와 상관
- Figure 4 기준 수직 $z_1$: swing length와 상관
- 나머지 8개 dimension: 폐기하지 않고 encoder가 계속 추정

따라서 정확한 표현은 다음과 같다.

> **10-D VAE를 학습한 뒤, 그 안에서 planning에 유용한 2-D slice가 경험적으로 발견됐다.**

처음부터 2차원 bottleneck으로 학습했거나, 수학적으로 항상 두 축만 필요하다고 증명한 것은 아니다.

## 6. 2차원 latent orbit를 어떻게 만드는가?

![phase와 radius가 z0-z1 latent orbit를 만드는 과정](/assets/img/posts/rl/gaitor/05-latent-orbit.svg){: width="1200" .d-block .mx-auto }

Planner는 2차원 좌표를 직접 모두 출력하지 않는다. Phase $\phi(k)$와 terrain latent $z_g(k)$를 입력받아 radius $R(k)$를 예측한다.

$$
R(k)
=
\psi_{\text{plan}}
\left(
\phi(k),z_g(k)
\right)
$$

그다음 두 latent dimension을 다음 식으로 덮어쓴다.

$$
\boxed{
\tilde z_0(k)
=
R(k)\sin\phi(k)
}
$$

$$
\boxed{
\tilde z_1(k)
=
R(k)\cos\phi(k)
}
$$

$\sin(\phi+\pi/2)=\cos\phi$이므로 논문의 두 번째 식과 같은 표현이다.

$R$이 상수라면 원형 궤적이 된다. 하지만 실제 planner의 $R(k)$는 phase와 terrain에 따라 변한다. 그러므로 발이 obstacle을 넘을 시점에 특정 방향의 반지름만 커지는 **변형된 닫힌 궤적**을 만들 수 있다.

Phase는 매 step 다음처럼 업데이트된다.

$$
\phi(k)
=
\phi(k-1)+\Delta\phi_k
$$

$\Delta\phi_k$가 커지면 gait cycle을 더 빨리 돌기 때문에 cadence가 증가한다.

```text
φ        현재 cycle 위치
Δφ       cycle 진행 속도
R(φ,z_g) phase와 terrain에 따른 swing geometry
```

## 7. Gait 전환은 어떻게 연속적으로 일어나는가?

Trot에서 pace로 바로 switch한다고 생각하면 contact pattern이 크게 끊길 수 있다.

```text
trot: LF와 LH가 out-of-phase
pace: LF와 LH가 in-phase
```

Gaitor는 gait label $g$를 연속적으로 바꾸면서 이 phase relationship의 중간을 통과한다.

```text
g = 1.0   trot
g = 0.5   trot/crawl intermediate
g = 0.0   crawl
g = -0.5  crawl/pace intermediate
g = -1.0  pace condition
```

Crawl에서는 한 발씩 순차적으로 swing하므로 왼쪽 앞발과 뒷발의 phase 관계가 trot과 pace의 중간이 된다. 논문에서는 이 구조 때문에 전환 순서가 다음처럼 나타났다고 해석한다.

$$
\text{trot}
\leftrightarrow
\text{crawl}
\leftrightarrow
\text{pace}
$$

전환 중에도 $\phi$는 계속 진행한다. 현재 cycle을 초기화한 뒤 새 gait를 시작하는 것이 아니라, **움직이던 latent orbit을 유지하면서 decoder condition $g$를 서서히 바꾸는 것**이다.

### 7.1 정말 새로운 gait를 발견한 것인가?

논문에서 말하는 `unseen intermediary gait`는 training dataset에 별도 label과 trajectory로 들어 있지 않았던 중간 contact schedule을 뜻한다. 이 결과는 흥미롭지만 범위를 정확히 봐야 한다.

- Trot, crawl, pace라는 endpoint gait는 사람이 제공했다.
- $g=1,0,-1$의 순서도 사람이 지정했다.
- Model이 임의의 locomotion space에서 gait taxonomy 자체를 발견한 것은 아니다.
- 학습된 조건 사이를 연속적으로 통과할 때 의미 있는 intermediate가 나타난 것이다.

즉 DIAYN처럼 reward 없이 skill identity를 발견한 경우와는 다르다.

## 8. 전체 구조: trajectory generator와 controller를 분리한다

![Gaitor의 encoder, planner, decoder, contact predictor, WBC 데이터 흐름](/assets/img/posts/rl/gaitor/04-gaitor-architecture.svg){: width="1200" .d-block .mx-auto }

Gaitor의 deployment loop를 순서대로 보면 다음과 같다.

### 8.1 현재 robot history를 encode

$$
X_r(k)
\xrightarrow{\psi_{\text{enc}}}
z_r(k)
$$

이 단계는 현재 robot이 nominal trajectory에서 벗어났는지 포함한 동역학 상태를 latent에 다시 반영한다.

### 8.2 Terrain을 encode

$$
X_g(k)
\xrightarrow{\psi_{\text{ter}}}
z_g(k)
$$

$z_g$는 planner와 decoder 모두에 condition으로 들어간다.

### 8.3 Planner가 radius를 예측

$$
(\phi,z_g)
\xrightarrow{\psi_{\text{plan}}}
R
$$

예측한 $R$과 현재 phase로 $z_0,z_1$을 덮어쓴다. $z_2,\ldots,z_9$는 현재 history의 encoder output을 유지한다.

### 8.4 Decoder가 미래 trajectory를 예측

$$
(\tilde z_r,z_g,a,g)
\xrightarrow{\psi_{\text{dec}}}
\hat X_r^+
$$

여기서 joint angle, torque, future base pose 등을 추출한다.

### 8.5 Contact predictor가 contact schedule을 예측

$$
(\tilde z_r,a,g)
\xrightarrow{\psi_{\text{PP}}}
\hat S^+
$$

Contact schedule은 tracking controller가 어떤 발의 contact dynamics를 강제할지 결정하는 데 쓰인다.

### 8.6 WBC가 실제 control command를 계산

Decoder의 trajectory가 곧바로 motor torque가 되는 것은 아니다. Whole-body controller는 centroidal dynamics와 contact constraint를 이용해 실행 가능한 joint trajectory와 torque를 계산한다.

```text
Gaitor
desired future motion + desired contact schedule 생성

WBC
동역학과 접촉 제약을 만족하도록 최종 control 계산
```

이 때문에 Gaitor를 end-to-end torque policy라고 부르는 것은 부정확하다. 정확히는 **학습된 gait representation과 planner를 기존 model-based controller에 연결한 hybrid locomotion system**이다.

## 9. 지형 정보는 latent space를 어떻게 바꾸는가?

![depth camera에서 terrain latent와 planner로 이어지는 처리 과정](/assets/img/posts/rl/gaitor/06-terrain-pipeline.svg){: width="1200" .d-block .mx-auto }

ANYmal C의 네 depth camera로부터 2.5D height map을 만든다. 이후 전체 map을 그대로 network에 넣지 않고, 앞으로 밟을 foothold 위치의 높이를 sampling한다.

처리 순서는 다음과 같다.

```text
4 depth cameras
        ↓
filtered 2.5D height map
        ↓
predicted foothold의 높이 sampling
        ↓
front-hind 높이 차이로 control pitch 계산
        ↓
2차 LTI filter로 연속 신호 생성
        ↓
terrain encoder → z_g
```

Foothold가 바뀔 때 control pitch는 계단식으로 변한다. 이를 그대로 쓰면 planner 입력도 불연속적으로 튄다. Gaitor는 damping factor 0.5인 second-order LTI filter를 사용해, swing foot이 가장 높을 때 pitch response가 올라오도록 연속 신호로 바꾼다.

Terrain latent는 두 경로로 영향을 준다.

1. Planner가 phase별 radius $R$을 바꾼다.
2. Decoder가 같은 robot latent도 terrain condition에 맞는 trajectory로 해석한다.

따라서 단순히 `step을 발견하면 발을 5 cm 높인다`는 규칙이 아니다. Terrain condition에 따라 latent space의 local decoding과 planner trajectory가 함께 변한다.

## 10. 학습은 두 단계로 나뉜다

### 10.1 Representation learning

먼저 expert trajectory로 다음 component를 학습한다.

- Robot VAE encoder와 decoder
- Contact performance predictor
- Terrain encoder와 training-only terrain decoder

Dataset은 RLOC의 vision-based RL footstep planner와 Dynamic Gaits가 생성한다. 약 30분 분량이며 다음 조건을 포함한다.

- Trot과 crawl: 최대 12.5 cm pallet terrain
- Pace: flat terrain

Expert pace는 실제 robot에서 불안정했기 때문에 real-robot deployment에는 사용하지 않았다.

### 10.2 Planner learning

학습된 VAE로 expert trajectory를 encode해 $z_0^*,z_1^*$를 얻는다. 이를 polar coordinate로 변환한다.

$$
\phi^*(k)
=
\operatorname{atan2}
\left(
z_0^*(k),z_1^*(k)
\right)
$$

$$
R^*(k)
=
\sqrt{
z_0^*(k)^2+z_1^*(k)^2
}
$$

Planner는 $(\phi,z_g)$에서 expert radius $R^*$를 예측하도록 behavioural cloning으로 학습한다. 논문은 radius를 여러 discrete bin에 대한 확률로 예측한 뒤 weighted sum으로 연속 $R$을 계산한다.

핵심은 다음과 같다.

> Planner가 trial-and-error reward로 등반을 발견한 것이 아니라, expert trajectory가 latent space에서 그린 반지름 변화를 모방한다.

## 11. 실시간 배포 조건

| 구성 | 설정 |
|---|---|
| Encoder frequency | 50 Hz |
| Decoder/control frequency | 400 Hz |
| Input history | $N=80$ |
| Future prediction | $M=20$ |
| Robot latent | 10-D |
| Terrain latent | 10-D |
| Network | 각 network 3 layers, 256 units wide |
| Runtime | ANYmal C onboard CPU |
| Time budget | 2.5 ms at 400 Hz |
| Implementation | Bespoke C++와 vectorized code |

Encoder는 과거 history를 50 Hz로 요약하고, decoder와 controller는 400 Hz로 미래 trajectory를 갱신한다. 실제 robot control에서 중요한 것은 model parameter 수만이 아니라 **제어 주기 안에 추론과 WBC 계산을 끝내는가**다.

## 12. Platform climb에서 실제로 무엇이 바뀌었나?

![Gaitor가 12.5 cm platform을 오를 때 변하는 latent trajectory와 contact schedule](/assets/img/posts/rl/gaitor/07-paper-platform-climb.png){: width="1400" .d-block .mx-auto }

_Flat ground, step 접근, front feet가 step 위에 놓인 세 구간의 latent trajectory와 foot swing을 보여준다. 출처: Mitchell et al., Figure 5, [PMLR 논문](https://proceedings.mlr.press/v270/mitchell25a.html), [PDF](https://raw.githubusercontent.com/mlresearch/v270/main/assets/mitchell25a/mitchell25a.pdf) (CC BY 4.0)._

Robot이 12.5 cm platform에 접근할 때 planner는 latent orbit을 늘리고, decoder는 더 긴 foot swing을 만든다.

| 측정값 | Trot flat | Trot climb |
|---|---:|---:|
| Swing height | $8.30\pm0.58$ cm | $9.68\pm4.15$ cm |
| Swing length | $10.40\pm0.53$ cm | $13.90\pm1.65$ cm |
| WBC joint RMSE | $0.012$ rad | $0.013$ rad |

가장 크게 증가한 것은 swing height보다 swing length다. 발을 step 모서리 바로 뒤에 놓기보다 더 안쪽에 놓아 foothold margin을 확보하려는 변화로 해석할 수 있다.

### 12.1 RMSE는 무엇을 측정하는가?

논문의 RMSE는 Gaitor가 예측한 joint-space trajectory와 WBC가 최종적으로 만든 joint trajectory의 차이다.

| Mode | WBC joint RMSE |
|---|---:|
| Dynamic Gaits expert trot | $0.021$ rad |
| Gaitor trot, flat | $0.012$ rad |
| Gaitor trot, climb | $0.013$ rad |
| Gaitor crawl | $0.058$ rad |

낮은 RMSE는 WBC가 Gaitor trajectory를 크게 수정하지 않고도 추종할 수 있었음을 뜻한다. 그러나 이것을 다음과 같이 확대 해석하면 안 된다.

- 모든 terrain에서 성공률이 더 높다는 증거가 아니다.
- 외란 recovery가 더 강하다는 지표가 아니다.
- Energy efficiency나 sim-to-real generalization을 직접 측정한 값이 아니다.
- 다른 locomotion policy와 동일 조건에서 종합 성능을 비교한 benchmark가 아니다.

논문이 정량적으로 강하게 보여주는 것은 **생성된 trajectory가 WBC의 동역학 제약과 대체로 양립하고, 실제 robot에서 추종 가능했다**는 점이다.

## 13. 이전에 본 방법들과 무엇이 다른가?

| 방법 | 무엇을 학습하는가? | 조건 또는 조작 공간 | 최종 행동 생성 |
|---|---|---|---|
| [DIAYN](/posts/diayn-diversity-is-all-you-need/) | 보상 없이 구별되는 state-based skill | Discrete skill $z$ | SAC policy |
| [DADS](/posts/dads-dynamics-aware-skill-discovery/) | 서로 구별되는 dynamics skill | Skill $z$ | RL policy |
| [CIC](/posts/cic-contrastive-intrinsic-control/) | Contrastive state-skill representation | Continuous skill $z$ | DDPG-style policy |
| [MCP](/posts/mcp-multiplicative-compositional-policies/) | Motion primitive와 조합 gate | Primitive weight | Product-of-Gaussians policy |
| Gaitor | Expert gait trajectory의 공유 표현 | Continuous $g$, latent orbit $(\phi,R)$ | VAE trajectory + WBC |

차이를 한 줄씩 정리하면 다음과 같다.

```text
DIAYN 계열
어떤 behavior를 할지 reward 없이 발견

MCP
이미 배운 action primitive를 한 순간에 곱해서 조합

Gaitor
여러 expert gait trajectory를 하나의 연속적인 계획 공간에 정렬
```

Gaitor의 장점은 `보행이 달라지는 축`과 `보폭이 달라지는 축`을 사람이 조작할 수 있다는 것이다. 반대로 expert data가 정해 준 gait 범위 밖에서 완전히 새로운 locomotion mode를 탐색하는 능력은 목표가 아니다.

## 14. 논문의 강점

### 14.1 Representation이 실제 control interface가 된다

Latent space를 시각화하는 데서 끝나지 않고, $z_0,z_1$에 trajectory를 직접 주입해 real robot을 제어한다.

### 14.2 Gait 전환과 terrain adaptation을 같은 공간에서 다룬다

- $g$: gait family와 contact phase 관계
- $\phi,R$: 주기와 swing geometry
- $z_g$: terrain condition

이 세 요소가 decoder에서 만난다. Gait switch와 obstacle traversal을 별도 controller로 완전히 분리하지 않는다.

### 14.3 Model-based control과 학습을 현실적으로 결합한다

Learning model은 복잡한 trajectory manifold를 다루고, WBC는 dynamics와 contact feasibility를 담당한다. 실제 robot에서 400 Hz를 달성하기 위한 공학적 분업이다.

## 15. 한계와 주의할 점

### 15.1 Expert data의 범위를 벗어나기 어렵다

Gaitor의 표현은 RLOC와 Dynamic Gaits가 만든 약 30분의 trajectory에서 학습된다. Expert에 없는 실패 recovery, 큰 점프, 미끄러운 지면 특성까지 자동으로 배우는 구조는 아니다.

### 15.2 완전한 pace hardware 결과가 없다

Expert pace가 실제 robot에서 불안정했기 때문에 논문은 완전한 pace를 hardware에 배포하지 않았다. 실제 전환 결과를 `trot부터 pace까지 모두 안정적으로 시연했다`고 쓰면 과장이다.

### 15.3 2D disentanglement는 경험적 결과다

$z_0,z_1$이 swing height와 length에 연결된 것은 이 dataset과 학습 결과를 분석해 발견한 것이다. 다른 seed, robot morphology, gait set에서도 같은 축이 그대로 나타난다는 보장은 없다.

### 15.4 Gait ordering은 일부 사람이 부여했다

$g=1,0,-1$이라는 순서가 이미 trot-crawl-pace interpolation을 유도한다. 중간 contact schedule이 의미 있게 나타난 것은 model의 성과지만, gait topology 전체를 자율적으로 발견했다고 보기는 어렵다.

### 15.5 Planner의 표현력은 의도적으로 제한돼 있다

Planner는 10-D latent 전체가 아니라 $z_0,z_1$의 polar orbit만 조절한다. 해석 가능성과 실시간성을 얻는 대신, 더 복잡한 비주기 동작을 표현하는 능력은 제한될 수 있다.

### 15.6 안정성의 공로를 VAE에만 돌릴 수 없다

Expert trajectory, state estimation, terrain mapping, contact prediction, WBC가 모두 시스템의 일부다. Gaitor latent만 떼어 내도 동일한 real-world robustness가 유지된다고 결론 내릴 수 없다.

## 16. 읽으면서 헷갈렸던 질문

### Q1. $g$만 바꾸면 gait가 바뀌는데 왜 $z_0,z_1$이 필요한가?

$g$는 다리 사이의 coordination pattern을 정하고, $z_0,z_1$은 현재 cycle phase와 swing geometry를 정한다. `어떤 gait인가`와 `그 gait의 어느 phase에서 얼마나 크게 발을 움직이는가`는 다른 변수다.

### Q2. Latent가 10차원인가, 2차원인가?

Model의 robot latent는 10차원이다. 이 중 두 축이 locomotion planning에 가장 유용하다는 것을 분석으로 발견했고, deployment에서 그 두 축만 planner가 덮어쓴다.

### Q3. $z_0,z_1$을 덮어쓰면 closed-loop가 아닌 것 아닌가?

아니다. 매 cycle 현재 robot history를 다시 encode해 $z_2,\ldots,z_9$를 갱신하고, terrain도 다시 encode한다. Planner 역시 현재 terrain latent와 phase에서 $R$을 다시 예측한다. Open-loop oscillator 하나만 실행하는 구조가 아니다.

### Q4. Gaitor는 강화학습인가?

Gaitor의 최종 학습 pipeline은 VAE representation learning과 behavioural cloning이다. Dataset 생성에 RLOC의 RL footstep planner가 사용되지만, Gaitor planner 자체를 reward로 학습한 것은 아니다.

### Q5. Decoder가 torque를 직접 내는가?

아니다. Decoder가 예측한 joint angle, torque, base-pose trajectory와 contact schedule을 WBC에 전달하고, WBC가 dynamics constraint를 고려해 최종 command를 만든다.

### Q6. 중간 gait는 완전히 새로운 skill discovery인가?

Training endpoint 사이에서 dataset에 없던 contact schedule이 나타난 것은 맞다. 하지만 endpoint와 $g$의 순서는 사람이 제공했다. Unsupervised skill discovery와 같은 의미의 자율적 skill discovery는 아니다.

## 17. 내가 이 논문에서 가져갈 핵심

Gaitor의 핵심은 VAE를 사용했다는 사실 자체가 아니다. 더 중요한 것은 **표현을 실제 제어 변수로 바꾸는 과정**이다.

```text
1. 여러 expert gait를 하나의 conditional representation에 학습한다.
2. Latent dimension을 분석해 의미 있는 planning axis를 찾는다.
3. Phase와 terrain으로 그 축 위의 닫힌 trajectory를 만든다.
4. Gait label을 연속적으로 바꿔 contact relationship을 전환한다.
5. 생성 trajectory를 WBC에 연결해 real robot에서 실행한다.
```

이 구조는 representation learning 연구를 실제 robotics control에 연결할 때 좋은 기준을 준다.

> 좋은 latent space는 그림이 예쁜 공간이 아니라, 어떤 축을 어떻게 움직였을 때 robot behavior가 어떻게 바뀌는지 설명하고 실제 controller가 사용할 수 있는 공간이어야 한다.

Gaitor는 제한된 expert gait와 terrain이라는 범위 안에서 이 조건을 상당히 구체적으로 보여준다. 동시에 2D structure의 일반성, expert 의존성, 완전한 pace 배포 같은 부분은 다음 연구가 해결해야 할 과제로 남는다.

## 참고 자료

- [Gaitor PMLR page](https://proceedings.mlr.press/v270/mitchell25a.html)
- [Gaitor paper PDF](https://raw.githubusercontent.com/mlresearch/v270/main/assets/mitchell25a/mitchell25a.pdf)
- [Gaitor OpenReview](https://openreview.net/forum?id=ySI0tBYxpz)
- [Gaitor arXiv](https://arxiv.org/abs/2405.19452)
- [Gaitor official video](https://www.youtube.com/watch?v=eVFQbRyilCA)
