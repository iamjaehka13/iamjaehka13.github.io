---
title: "7. Distributional Reinforcement Learning"
date: 2026-07-28 00:45:00 +0900
last_modified_at: 2026-07-28 00:51:00 +0900
categories: [RL, Study]
tags: [reinforcement-learning, distributional-rl, c51, qr-dqn, iqn, quantile-regression, risk-sensitive]
description: 기대 Q값 하나를 넘어 return의 전체 분포를 학습하는 Distributional RL과 C51, QR-DQN, IQN의 차이를 정리한다.
image:
  path: /assets/img/posts/rl/distributional-reinforcement-learning/00-distributional-overview.jpg
  alt: DQN, C51, QR-DQN, IQN이 return을 표현하는 방식의 비교
math: true
---

앞 글까지의 강화학습은 대부분 **기대 반환(expected return)** 을 중심으로 전개됐다. DQN은 $Q(s,a)$를 근사하고, Policy Gradient는 그 기대 반환이 커지도록 정책을 움직인다.

그런데 평균이 같으면 두 행동도 정말 같은 선택일까?

- 행동 A: 거의 항상 10의 return
- 행동 B: 절반은 0, 절반은 20의 return

둘의 기대값은 모두 10. 그러나 변동성, 실패 가능성, 큰 보상을 얻을 가능성은 완전히 다르다. 평균 $Q$ 하나만 남기면 이 차이는 사라진다.

**Distributional Reinforcement Learning**은 여기서 질문을 바꾼다.

> 앞으로 받을 보상의 평균은 얼마인가?

가 아니라,

> 앞으로 받을 보상은 어떤 확률분포를 이루는가?

를 학습하는 접근.

![DQN, C51, QR-DQN, IQN의 표현 차이](/assets/img/posts/rl/distributional-reinforcement-learning/00-distributional-overview.jpg)

*기대값 하나를 출력하는 DQN에서 return distribution을 표현하는 C51, QR-DQN, IQN으로의 변화. 직접 정리한 `OhDRL.pdf` 슬라이드.*

## **1. Q값 전에 return부터 다시 보기**

시점 $t$ 이후의 discounted return을 확률변수 $Z^\pi(s,a)$로 쓰면 다음과 같다.

$$
Z^\pi(s,a)
=
\sum_{k=0}^{\infty}\gamma^k R_{t+k+1}
$$

환경 전이와 보상이 확률적이고, 정책도 확률적일 수 있으므로 $Z^\pi(s,a)$ 역시 하나의 숫자가 아닌 **확률변수**다.

우리가 익숙한 action-value function은 이 확률변수의 평균.

$$
Q^\pi(s,a)
=
\mathbb{E}\left[Z^\pi(s,a)\right]
$$

즉 기존 Q-learning이 틀렸다기보다, 분포에서 평균만 꺼내 학습한 셈이다.

| 표현 | 담고 있는 정보 |
| --- | --- |
| $Q^\pi(s,a)$ | return의 평균 |
| $Z^\pi(s,a)$ | 평균, 분산, 꼬리, 다봉성 등을 포함한 전체 분포 |

여기서 중요한 구분 하나.

**Distributional RL은 보상의 확률분포를 예측하는 문제가 아니다.** 현재 상태와 행동에서 시작했을 때 앞으로 누적될 **return의 분포**를 모델링한다. 한 스텝 reward distribution보다 훨씬 장기적인 대상.

## **2. 평균이 지워 버리는 정보**

통근 시간을 예로 들어 보자.

- 자동차: 평소에는 30분, 사고가 나면 90분
- 기차: 항상 42분
- 자전거: 약 60분

자동차 사고 확률을 $1/5$라고 두면 평균 통근 시간은 다음과 같다.

$$
30 \times \frac{4}{5}
+
90 \times \frac{1}{5}
=
42\text{분}
$$

자동차와 기차의 평균은 42분으로 같아진다. 평균만 보면 동등한 선택. 실제 분포는 전혀 다르다.

![같은 기대값이 서로 다른 위험을 숨기는 통근 예시](/assets/img/posts/rl/distributional-reinforcement-learning/01-expected-value-hides-risk.jpg)

*다봉 분포와 분산 차이가 기대값 하나로 압축되는 예시. 직접 정리한 `OhDRL.pdf` 슬라이드.*

자동차의 42분은 자주 경험하는 시간도 아니다. 대부분 30분이거나, 가끔 90분. 평균은 그 사이에 있을 뿐이다. 이런 상황에서 필요한 정보:

- 가장 자주 나오는 결과
- 결과의 분산
- 실패 쪽 꼬리가 얼마나 긴지
- 특정 임계값보다 나쁠 확률

Distributional RL이 분포를 학습하는 이유도 이 정보 보존에 있다.

다만 **분포를 배운다고 자동으로 risk-aware policy가 되는 것은 아니다.** 마지막 action selection에서 여전히 분포의 평균만 비교한다면 정책은 risk-neutral이다. 위험 회피나 위험 선호를 반영하려면 quantile에 별도의 가중을 주는 risk distortion이 필요하다.

## **3. Distributional Bellman equation**

기존 Bellman equation은 기대값 사이의 관계.

$$
Q^\pi(s,a)
=
\mathbb{E}\left[
R(s,a)
+
\gamma Q^\pi(S',A')
\right]
$$

분포 관점에서는 다음처럼 쓴다.

$$
Z^\pi(s,a)
\overset{D}{=}
R(s,a)
+
\gamma Z^\pi(S',A')
$$

$\overset{D}{=}$는 두 확률변수의 값이 항상 같다는 뜻이 아니라, **분포가 같다**는 의미다.

이를 distributional Bellman operator $\mathcal{T}^\pi$로 표현하면:

$$
\mathcal{T}^\pi Z(s,a)
\overset{D}{=}
R(s,a)
+
\gamma Z(S',A')
$$

![Distributional Bellman equation과 Wasserstein contraction](/assets/img/posts/rl/distributional-reinforcement-learning/02-distributional-bellman.jpg)

*확률변수 사이의 Bellman 관계와 policy evaluation에서의 Wasserstein contraction. 직접 정리한 `OhDRL.pdf` 슬라이드.*

### **3.1 Policy evaluation과 control은 다르다**

고정된 정책 $\pi$의 return distribution을 평가하는 $\mathcal{T}^\pi$는 적절한 Wasserstein metric에서 contraction 성질을 갖는다. 반복 적용했을 때 참 분포 쪽으로 가까워질 수 있다는 이론적 기반.

하지만 control에서는 다음 행동을 greedy하게 고른다.

$$
a^*
=
\arg\max_{a'} \mathbb{E}[Z(S',a')]
$$

정책 자체가 계속 바뀌면서 distributional optimality operator는 같은 방식의 contraction을 일반적으로 보장하지 않는다. 그래서 실제 알고리즘은 무한히 복잡한 분포를 그대로 저장하지 않고, **표현 가능한 분포 집합으로 근사하거나 투영**한다.

바로 이 근사법의 차이가 C51, QR-DQN, IQN을 가른다.

## **4. C51: 위치는 고정하고 확률을 학습**

C51은 return이 놓일 수 있는 구간 $[V_{\min},V_{\max}]$를 먼저 정하고, 그 안에 51개의 atom을 균일하게 배치한다.

$$
z_i
=
V_{\min}
+
i\Delta z,
\qquad
\Delta z
=
\frac{V_{\max}-V_{\min}}{N-1}
$$

$N=51$. 신경망은 각 action마다 이 atom들의 **확률**을 출력한다.

$$
Z_\theta(s,a)
=
\sum_{i=0}^{N-1}
p_i(s,a)\,\delta_{z_i}
$$

- $z_i$: 고정된 return 위치
- $p_i(s,a)$: 네트워크가 학습하는 확률
- $\delta_{z_i}$: $z_i$에 질량을 놓는 Dirac distribution

Q값이 필요하면 분포의 기대값을 계산한다.

$$
Q_\theta(s,a)
=
\sum_i p_i(s,a)z_i
$$

### **4.1 C51 target**

transition $(s,a,r,s')$가 주어졌다고 하자. 다음 상태에서는 기대값이 가장 큰 행동을 선택한다.

$$
a^*
=
\arg\max_{a'}
\sum_i p_i(s',a')z_i
$$

다음 분포의 각 atom은 Bellman update를 거치며 이동한다.

$$
\hat z_i
=
\operatorname{clip}
\left(
r+\gamma z_i,\,
V_{\min},V_{\max}
\right)
$$

문제는 $\hat z_i$가 고정 support $z_i$와 정확히 일치하지 않는다는 점. 따라서 양옆 atom으로 확률 질량을 나누는 **categorical projection**이 필요하다. 투영한 target distribution과 현재 distribution 사이의 cross-entropy를 줄이는 방식.

### **4.2 장점과 제약**

C51은 DQN의 scalar output을 categorical distribution으로 바꿔 직관적이고 구현도 비교적 단순하다. 대신 $V_{\min}$과 $V_{\max}$를 미리 정해야 한다.

실제 return이 범위를 벗어나면 양 끝으로 잘린다. support가 지나치게 넓으면 51개 atom의 해상도가 떨어지는 반대 문제. **고정된 위치가 C51의 핵심이자 제약**이다.

## **5. QR-DQN: 확률은 고정하고 위치를 학습**

QR-DQN은 C51의 parameterization을 뒤집는다.

![C51과 QR-DQN의 distribution parameterization 비교](/assets/img/posts/rl/distributional-reinforcement-learning/03-c51-vs-qr-dqn.jpg)

*C51은 support 위치를 고정하고 확률을 학습한다. QR-DQN은 균일한 확률 질량을 고정하고 quantile 위치를 학습한다. 직접 정리한 `OhDRL.pdf` 슬라이드.*

C51:

$$
Z_\theta(s,a)
=
\sum_{i=1}^{N} p_i(s,a)\,\delta_{z_i}
$$

QR-DQN:

$$
Z_\theta(s,a)
=
\frac{1}{N}
\sum_{i=1}^{N}
\delta_{\theta_i(s,a)}
$$

QR-DQN의 각 출력 $\theta_i(s,a)$는 quantile 위치를 나타낸다. 보통 quantile fraction의 중점을 사용한다.

$$
\hat\tau_i
=
\frac{\tau_{i-1}+\tau_i}{2},
\qquad
\tau_i=\frac{i}{N}
$$

각 atom이 동일한 확률 질량 $1/N$을 갖기 때문에 Q값은 단순 평균.

$$
Q_\theta(s,a)
\approx
\frac{1}{N}\sum_{i=1}^{N}\theta_i(s,a)
$$

### **5.1 Quantile regression loss**

예측 quantile $\theta_i$와 Bellman target $y_j$의 오차:

$$
u_{ij}
=
y_j-\theta_i(s,a)
$$

QR-DQN은 quantile Huber loss를 사용한다.

$$
\rho_{\tau}^{\kappa}(u)
=
\left|\tau-\mathbb{I}\{u<0\}\right|
\frac{\mathcal{L}_{\kappa}(u)}{\kappa}
$$

여기서 $\mathcal{L}_{\kappa}$는 작은 오차에는 제곱, 큰 오차에는 절댓값처럼 동작하는 Huber loss. quantile마다 과소추정과 과대추정에 서로 다른 가중을 주어 원하는 누적확률 위치를 찾는다.

고정된 $V_{\min},V_{\max}$가 없어도 된다는 장점. 반면 $N$개의 quantile 출력과 target quantile 사이를 비교하므로 loss 계산은 보통 $N\times N$ pairwise 형태가 된다.

## **6. IQN: 원하는 quantile을 함수로 질의**

QR-DQN은 미리 정한 $N$개 quantile만 출력한다. IQN(Implicit Quantile Network)은 한 단계 더 나아가 quantile fraction $\tau\in[0,1]$를 입력받는 함수를 학습한다.

$$
Z_\tau(s,a)
\approx
F^{-1}_{Z(s,a)}(\tau)
$$

즉 네트워크에 “0.1 quantile은 얼마인가?”, “0.73 quantile은 얼마인가?”라고 연속적으로 질의하는 형태.

![IQN의 sampled quantile과 risk-sensitive policy](/assets/img/posts/rl/distributional-reinforcement-learning/04-iqn-risk-sensitive.jpg)

*IQN은 $\tau$를 샘플링해 quantile function을 근사하고, $\tau$의 샘플링 분포를 바꾸어 위험 성향을 표현할 수 있다. 직접 정리한 `OhDRL.pdf` 슬라이드.*

구현 흐름은 대략 다음과 같다.

1. 상태 $s$를 feature $\psi(s)$로 변환
2. $\tau\sim U[0,1]$ 샘플링
3. cosine basis로 $\tau$ embedding 생성
4. state feature와 quantile embedding을 element-wise 결합
5. action별 quantile value 출력

cosine embedding의 한 예:

$$
\phi(\tau)
=
\operatorname{ReLU}
\left(
\sum_{j=0}^{n-1}
\cos(\pi j\tau)w_j+b
\right)
$$

이후 $\psi(s)\odot\phi(\tau)$를 Q-network의 입력으로 사용한다.

### **6.1 Risk distortion**

평균적 정책은 $\tau\sim U[0,1]$에서 quantile을 샘플링해 평균을 근사한다. 하위 quantile을 더 많이 보면 보수적인 정책, 상위 quantile을 강조하면 낙관적인 정책으로 바꿀 수 있다.

예를 들어 CVaR 계열의 위험 회피를 단순화해 생각하면:

$$
\tau\sim U[0,\alpha],
\qquad 0<\alpha<1
$$

낮은 return 영역을 집중적으로 평가하는 방식. 여기서 다시 강조할 점은 **IQN이 분포를 제공하고, risk distortion이 그 분포를 어떻게 의사결정에 쓸지 정한다**는 분리다.

## **7. 세 알고리즘을 한 번에 비교**

| 구분 | C51 | QR-DQN | IQN |
| --- | --- | --- | --- |
| 분포 표현 | categorical | quantile atoms | implicit quantile function |
| 고정되는 것 | atom 위치 $z_i$ | 확률 질량 $1/N$ | 별도 고정 grid 없음 |
| 학습되는 것 | 각 atom의 확률 | quantile 위치 | $\tau$에 따른 quantile value |
| 주요 loss | projected target와 cross-entropy | quantile Huber loss | sampled quantile Huber loss |
| return 범위 지정 | 필요 | 불필요 | 불필요 |
| risk-sensitive 확장 | 제한적 | quantile 재가중 가능 | $\tau$ distortion이 자연스러움 |

핵심 발전 흐름:

> C51은 분포를 고정 grid 위에 올렸고, QR-DQN은 quantile 위치를 직접 움직였으며, IQN은 quantile 전체를 함수로 만들었다.

## **8. 구현에서 확인할 tensor shape**

Distributional RL 코드를 읽을 때는 수식보다 tensor shape를 먼저 따라가면 빠르다.

### **8.1 C51**

batch size $B$, action 수 $A$, atom 수 $N$:

```text
logits       : [B, A, N]
probabilities: [B, A, N]
support      : [N]
q_values     : [B, A]      # sum(probabilities * support)
```

선택한 action의 분포만 모으면 `[B, N]`. Bellman-shifted atom을 고정 support로 projection한 target도 `[B, N]`.

### **8.2 QR-DQN**

```text
quantiles       : [B, A, N]
chosen_quantiles: [B, N]
target_quantiles: [B, N']
pairwise_delta  : [B, N, N']
```

예측 quantile과 target quantile의 모든 조합을 비교하므로 마지막 loss tensor가 커진다.

### **8.3 IQN**

```text
state_features : [B, D]
tau            : [B, N, 1]
tau_embedding  : [B, N, D]
quantile_values: [B, N, A]
```

같은 상태에서도 매 update마다 다른 $\tau$가 샘플링된다. 코드에서 policy용 quantile 수, target용 quantile 수, action selection용 quantile 수가 따로 설정되는 경우도 흔하다.

## **9. Distributional RL이 항상 더 좋은가?**

분포를 학습하면 표현력은 늘지만 공짜는 아니다.

- output과 loss tensor 증가
- target distribution projection 또는 pairwise quantile loss 필요
- 분포 근사가 불안정하면 평균 Q까지 흔들릴 가능성
- risk objective를 잘못 고르면 지나치게 보수적이거나 위험한 정책
- stochasticity가 거의 없는 문제에서는 추가 복잡도의 실익이 작을 수 있음

또한 학습한 분포가 환경의 진짜 불확실성을 완벽히 설명한다고 보기도 어렵다. return distribution에는 환경 확률성, 정책 확률성, 장기 누적 효과가 섞인다. 모델의 epistemic uncertainty와도 다른 개념.

따라서 Distributional RL의 강점은 “불확실성을 모두 해결한다”가 아니다.

**scalar Q보다 풍부한 학습 신호와 의사결정 재료를 제공한다는 점.**

## **10. 앞선 RL 기초와의 연결**

1편부터 6편까지의 흐름에 이 글을 붙이면 위치가 선명해진다.

1. MDP: 상태, 행동, 보상, 전이
2. Bellman equation: 현재 가치와 다음 가치의 재귀 관계
3. DP와 RL: 알려진 모델에서 샘플 기반 학습으로
4. DQN: Q함수를 neural network로 근사
5. DRL: value-based와 policy-based 접근
6. Policy Gradient: 연속 행동과 안정적인 정책 업데이트
7. Distributional RL: Q의 평균을 넘어 return distribution 자체를 근사

Bellman equation을 버린 게 아니다. **Bellman update의 대상을 숫자에서 확률분포로 확장한 것**에 가깝다.

다음 글의 MPO는 다른 방향의 확장이다. 이번 글이 critic이 무엇을 표현할지 바꿨다면, MPO는 policy improvement를 **추론과 EM의 관점**으로 다시 구성한다.

## **참고 자료**

- Marc G. Bellemare, Will Dabney, Rémi Munos, [A Distributional Perspective on Reinforcement Learning](https://proceedings.mlr.press/v70/bellemare17a.html), ICML 2017.
- Will Dabney et al., [Distributional Reinforcement Learning with Quantile Regression](https://arxiv.org/abs/1710.10044), AAAI 2018.
- Will Dabney et al., [Implicit Quantile Networks for Distributional Reinforcement Learning](https://proceedings.mlr.press/v80/dabney18a.html), ICML 2018.
