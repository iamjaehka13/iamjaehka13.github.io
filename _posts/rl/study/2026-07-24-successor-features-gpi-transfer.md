---
title: "SF + GPI: 새 보상에서 정책 재사용"
date: 2026-07-24 22:25:25 +0900
categories: [RL, Study]
tags: [successor-features, generalized-policy-improvement, gpi, transfer-reinforcement-learning, successor-representation, policy-reuse, value-function, q-learning, dqn, robotics]
description: "Successor Features가 정책의 미래 feature 발생량과 reward preference를 분리하고, GPI가 새 task에서 여러 source policy를 즉시 재평가하고 재사용하는 원리를 정리한다."
math: true
image:
  path: /assets/img/posts/rl/sf-gpi/00-sf-gpi-preview.png
  alt: Successor Features와 GPI를 이용한 새로운 reward task로의 policy transfer
---

이전 [CSD 글](/posts/constrained-skill-discovery/)까지는 외부 task reward 없이 방향과 이동 크기가 다른 behavior repertoire를 만드는 방법을 살펴봤다. 그런데 다양한 policy나 skill을 얻었다고 새 task가 자동으로 해결되는 것은 아니다.

예를 들어 robot에게 다음과 같은 policy가 있다고 하자.

```text
빠르게 전진하는 policy
에너지를 적게 쓰는 policy
충돌을 피하는 policy
정확하게 회전하는 policy
```

새 task가 주어지면 다시 질문해야 한다.

> 어떤 policy가 새 reward에서 유용하며, 여러 policy의 지식을 어떻게 재사용할 것인가?

**Successor Features, SF**와 **Generalized Policy Improvement, GPI**는 이 transfer 문제를 다룬다.

- SF는 각 policy가 앞으로 만들어 낼 결과를 feature vector로 예측한다.
- 새 task는 그 feature를 얼마나 선호하는지 나타내는 reward weight $w$로 표현한다.
- GPI는 이전 policy들을 새 reward에서 다시 평가하고, 그 값들의 maximum에 greedy한 새 policy를 만든다.

한 문장으로 압축하면 다음과 같다.

> **Successor Features는 미래의 행동 결과를 reward와 분리해 저장하고, GPI는 새 reward가 주어졌을 때 그 결과 예측을 즉시 재평가해 기존 policy들을 재사용한다.**

## 0. 먼저 전체 구조

일반적인 action-value function에는 두 종류의 정보가 섞여 있다.

1. 이 행동을 한 뒤 앞으로 무엇이 일어나는가?
2. 그 결과는 현재 task에서 얼마나 좋은가?

SF는 이 둘을 분리한다.

$$
\boxed{
Q_w^\pi(s,a)
=
\psi^\pi(s,a)^\top w
}
$$

![Successor Features와 reward weight로 Q를 분해하는 구조](/assets/img/posts/rl/sf-gpi/01-q-decomposition.svg){: width="1200" .d-block .mx-auto }

여기서

- $\psi^\pi(s,a)$: policy $\pi$를 계속 따를 때 미래에 각 feature가 얼마나 누적되는가
- $w$: 새 task가 각 feature를 얼마나 좋아하거나 싫어하는가

이다.

Dynamics와 policy가 그대로이고 reward preference만 바뀐다면 $\psi^\pi$는 재사용하고 $w$만 바꿀 수 있다.

## 1. 논문 정보

| 항목 | 내용 |
|---|---|
| Title | Successor Features for Transfer in Reinforcement Learning |
| Authors | André Barreto, Will Dabney, Rémi Munos, Jonathan J. Hunt, Tom Schaul, Hado van Hasselt, David Silver |
| Venue | NeurIPS 2017 |
| Transfer setting | Dynamics는 같고 reward function만 달라지는 task family |
| Reward model | $r(s,a,s')=\phi(s,a,s')^\top w$ |
| Predictive representation | $\psi^\pi(s,a)$ |
| Value decomposition | $Q_w^\pi(s,a)=\psi^\pi(s,a)^\top w$ |
| Policy reuse | Generalized Policy Improvement |
| Algorithms | SFQL, SFDQN |
| Experiments | Four-room navigation, MuJoCo two-joint reacher |
| Source | [NeurIPS](https://papers.nips.cc/paper_files/paper/2017/hash/350db081a661525235354dd3e19b8c05-Abstract.html), [arXiv](https://arxiv.org/abs/1606.05312) |

이 논문은 새로운 behavior를 비지도 방식으로 발견하는 논문이 아니다. Source policy들은 일반적으로 이전 extrinsic task에서 학습된다.

논문의 질문은 다음에 가깝다.

> Reward가 다른 여러 task를 차례로 만날 때, 과거 task에서 학습한 value와 policy를 새 task에 어떻게 전달할까?

## 2. 먼저 고정해야 하는 가정

논문이 다루는 task family는 다음 MDP 요소를 공유한다.

$$
\mathcal S,\quad
\mathcal A,\quad
p(s'\mid s,a),\quad
\gamma
$$

달라지는 것은 reward다.

$$
r_w(s,a,s')
=
\phi(s,a,s')^\top w
$$

$\phi(s,a,s')\in\mathbb R^d$는 한 transition에서 발생한 feature이고, $w\in\mathbb R^d$는 task preference다.

예를 들어 robot transition feature를 다음처럼 잡을 수 있다.

$$
\phi
=
\begin{bmatrix}
\text{forward progress}\\
\text{energy use}\\
\text{collision}\\
\text{heading error}
\end{bmatrix}
$$

Task마다 $w$를 바꾸면 서로 다른 reward가 된다.

$$
w_{\text{fast}}
=
\begin{bmatrix}
1.0 & -0.05 & -1.0 & -0.1
\end{bmatrix}^\top
$$

$$
w_{\text{safe}}
=
\begin{bmatrix}
0.4 & -0.2 & -3.0 & -0.3
\end{bmatrix}^\top
$$

같은 transition도 첫 번째 task에서는 빠른 전진 때문에 좋을 수 있고, 두 번째 task에서는 collision 때문에 나쁠 수 있다.

### 2.1 선형 reward 가정은 강한가?

형식적으로는 $\phi$를 충분히 크게 만들면 어떤 reward도 표현할 수 있다. 각 transition을 one-hot feature로 만들거나 reward 자체를 feature에 넣을 수도 있다.

하지만 transfer 관점에서는 이것으로 충분하지 않다.

- Feature 차원이 너무 크면 공유 구조가 약해진다.
- 잘못된 feature basis에서는 비슷한 task가 가까운 $w$로 표현되지 않는다.
- Feature scale이 다르면 $w$의 거리와 SF prediction error가 왜곡된다.

좋은 $\phi$는 여러 task reward를 낮은 차원으로 표현하면서, 실제로 비슷한 behavior가 필요한 task들이 가까운 $w$를 갖게 해야 한다.

## 3. Q-function을 왜 분리해야 하는가?

일반적인 action value는 다음과 같다.

$$
Q_w^\pi(s,a)
=
\mathbb E^\pi
\left[
\sum_{k=0}^{\infty}
\gamma^k r_{t+k+1}
\mid S_t=s,A_t=a
\right]
$$

Reward model을 대입하면

$$
Q_w^\pi(s,a)
=
\mathbb E^\pi
\left[
\sum_{k=0}^{\infty}
\gamma^k
\phi_{t+k+1}^\top w
\right]
$$

$w$는 합과 expectation 밖으로 꺼낼 수 있다.

$$
Q_w^\pi(s,a)
=
\left(
\mathbb E^\pi
\left[
\sum_{k=0}^{\infty}
\gamma^k\phi_{t+k+1}
\right]
\right)^\top w
$$

괄호 안을 Successor Features라고 정의한다.

$$
\boxed{
\psi^\pi(s,a)
=
\mathbb E^\pi
\left[
\sum_{k=0}^{\infty}
\gamma^k\phi_{t+k+1}
\mid S_t=s,A_t=a
\right]
}
$$

따라서

$$
\boxed{
Q_w^\pi(s,a)
=
\psi^\pi(s,a)^\top w
}
$$

가 된다.

이 식의 의미는 계산 편의 이상이다.

```text
ψ^π(s,a)
현재 action 이후 policy π가 만들어 낼 장기적인 결과

w
그 결과를 현재 task에서 평가하는 기준
```

Reward가 바뀌어도 policy와 dynamics가 같다면 미래 결과 예측 $\psi^\pi$는 그대로다. 새 $w$를 곱하면 같은 policy를 새 task에서 즉시 평가할 수 있다.

## 4. Successor Feature는 정확히 무엇을 저장하는가?

$\phi$와 $\psi$를 구분해야 한다.

$$
\phi(s,a,s')
=
\text{현재 한 transition에서 발생한 feature}
$$

$$
\psi^\pi(s,a)
=
\text{현재 action 이후 policy }\pi\text{를 따를 때의 discounted feature return}
$$

![Immediate feature와 Successor Feature의 시간적 차이](/assets/img/posts/rl/sf-gpi/02-successor-timeline.svg){: width="1200" .d-block .mx-auto }

예를 들어 한 step feature가

$$
\phi_t
=
\begin{bmatrix}
0.02\\
0.10\\
0
\end{bmatrix}
$$

라면 지금 2 cm 전진하고 에너지를 조금 사용했으며 collision은 없었다는 의미일 수 있다.

반면

$$
\psi^\pi(s,a)
=
\begin{bmatrix}
4.8\\
18.0\\
0.3
\end{bmatrix}
$$

라면 현재 action 뒤에 $\pi$를 계속 따를 경우 할인된 기준으로 약 4.8 단위의 전진 feature, 18 단위의 energy feature, 0.3 단위의 collision feature가 누적될 것으로 예상한다는 뜻이다.

### 4.1 SF는 dynamics model인가?

완전한 dynamics model은 아니다.

Dynamics model은 보통 다음 transition distribution을 예측한다.

$$
p(s'\mid s,a)
$$

이를 알면 임의의 새 policy와 reward를 사용해 planning할 수 있다.

SF는 다음만 예측한다.

$$
\psi^\pi(s,a)
=
\text{policy }\pi\text{ 아래의 미래 feature 누적}
$$

따라서 SF에는 다음 정보가 함께 들어 있다.

```text
environment dynamics
+ continuation policy π
+ feature representation φ
```

정확한 표현은 **policy-conditioned predictive representation**이다.

```text
scalar Q
특정 policy + 특정 reward

successor features
특정 policy + 교체 가능한 linear reward

full dynamics model
교체 가능한 policy + 교체 가능한 reward
```

SF는 scalar value와 full world model 사이에 있는 representation으로 볼 수 있다.

## 5. Successor Representation과의 관계

Successor Features의 출발점은 Dayan의 Successor Representation, SR이다.

State를 one-hot feature로 두면

$$
\phi(s)=e_s
$$

SF의 각 성분은 미래에 특정 state를 할인해서 몇 번 방문할지 나타낸다.

$$
\psi^\pi(s)
=
\mathbb E^\pi
\left[
\sum_{k=0}^{\infty}\gamma^k e_{S_{t+k}}
\mid S_t=s
\right]
$$

즉 SR은 미래 state occupancy를 저장한다.

SF는 one-hot state 대신 일반 feature를 사용한다.

$$
\text{SR}
\quad
\text{future state occupancy}
$$

$$
\text{SF}
\quad
\text{future feature occupancy}
$$

이 일반화 덕분에 연속 state와 function approximation에 적용하기 쉬워진다.

## 6. SF는 어떻게 학습하는가?

SF도 Bellman equation을 만족한다.

$$
\psi^\pi(s,a)
=
\mathbb E
\left[
\phi(s,a,s')
+\gamma
\mathbb E_{a'\sim\pi(\cdot\mid s')}
\psi^\pi(s',a')
\right]
$$

Deterministic policy라면

$$
\psi^\pi(s,a)
=
\mathbb E
\left[
\phi(s,a,s')
+\gamma\psi^\pi(s',\pi(s'))
\right]
$$

이다.

![Successor Feature critic의 vector TD update](/assets/img/posts/rl/sf-gpi/03-sf-bellman.svg){: width="1200" .d-block .mx-auto }

일반 critic의 TD target은 scalar다.

$$
y_Q
=
r+\gamma Q(s',a')
$$

SF critic의 TD target은 $d$차원 vector다.

$$
y_\psi
=
\phi(s,a,s')
+\gamma\psi_{\theta^-}(s',a')
$$

Loss는 다음처럼 계산할 수 있다.

$$
\mathcal L_{\text{SF}}(\theta)
=
\left\|
y_\psi-\psi_\theta(s,a)
\right\|_2^2
$$

각 SF 차원은 $\phi_i$를 pseudo-reward로 사용하는 하나의 General Value Function처럼 볼 수 있다.

```text
ψ₁: future forward-progress return
ψ₂: future energy-use return
ψ₃: future collision return
...
```

## 7. Reward가 바뀌면 무엇을 재사용하는가?

Source policy $\pi_i$와 SF $\psi^{\pi_i}$가 저장돼 있다고 하자.

새 task의 reward가

$$
r_{\text{new}}(s,a,s')
=
\phi(s,a,s')^\top w_{\text{new}}
$$

라면 source policy를 새 task에서 다음처럼 평가한다.

$$
Q_{\text{new}}^{\pi_i}(s,a)
=
\psi^{\pi_i}(s,a)^\top w_{\text{new}}
$$

중요한 점은 이 policy가 원래 어떤 reward로 학습됐는지가 아니다.

예를 들어 $\pi_1$이 빠른 전진 task로 학습됐더라도, $\psi^{\pi_1}$에 energy와 collision feature 예측이 포함돼 있다면 안전 task의 $w_{\text{safe}}$로 다시 평가할 수 있다.

이 단계까지는 **policy evaluation transfer**다. 여러 source policy 중 어떤 값을 사용해 행동할지는 아직 정하지 않았다.

## 8. Generalized Policy Improvement

일반 policy improvement는 policy 하나의 $Q^\pi$에 greedy한 새 policy를 만든다.

$$
\pi'(s)
\in
\arg\max_a Q^\pi(s,a)
$$

GPI는 이를 여러 source policy로 확장한다.

$$
\boxed{
\pi_{\text{GPI}}(s)
\in
\arg\max_a
\max_i
\widetilde Q_w^{\pi_i}(s,a)
}
$$

SF를 대입하면

$$
\boxed{
\pi_{\text{GPI}}(s)
\in
\arg\max_a
\max_i
\widetilde\psi^{\pi_i}(s,a)^\top w
}
$$

![여러 source Q의 upper envelope에 greedy한 GPI](/assets/img/posts/rl/sf-gpi/04-gpi-upper-envelope.svg){: width="1200" .d-block .mx-auto }

### 8.1 Policy 하나를 고르는 것이 아니다

GPI는 episode 시작 시 다음처럼 policy ID 하나를 고정하지 않는다.

$$
i^*
=
\arg\max_i V^{\pi_i}(s_0)
$$

매 state에서 각 action을 다시 평가한다.

```text
state s1
π1의 continuation value가 유리한 action 선택

state s2
π3의 continuation value가 유리한 action 선택

state s3
π2의 continuation value가 유리한 action 선택
```

따라서 GPI policy는 source policy 어느 하나와도 완전히 같지 않을 수 있다.

### 8.2 Action을 평균하는 것도 아니다

GPI는 다음처럼 source action의 평균을 내지 않는다.

$$
a
\ne
\frac{1}{n}
\sum_i\pi_i(s)
$$

정확한 GPI는 전체 action space의 각 $a$에 대해 여러 continuation policy의 value를 계산한 뒤 upper envelope에 greedy한 action을 고른다.

$$
\max_i Q^{\pi_i}(s,a)
$$

현재 action $a$를 취한 뒤 어느 source policy $\pi_i$를 계속 따를 때 좋은지를 평가하는 것이다.

## 9. GPI가 보장하는 것과 보장하지 않는 것

Source value approximation이 다음 오차를 가진다고 하자.

$$
\left|
Q^{\pi_i}(s,a)
-\widetilde Q^{\pi_i}(s,a)
\right|
\le\epsilon
$$

논문의 Generalized Policy Improvement theorem은 다음을 보장한다.

$$
\boxed{
Q^{\pi_{\text{GPI}}}(s,a)
\ge
\max_i Q^{\pi_i}(s,a)
-\frac{2\epsilon}{1-\gamma}
}
$$

$\epsilon=0$이면

$$
Q^{\pi_{\text{GPI}}}(s,a)
\ge
\max_i Q^{\pi_i}(s,a)
$$

이다.

정확한 해석은 다음과 같다.

> 새 task에서 GPI policy는 저장된 source policy 중 가장 좋은 것보다 나쁘지 않다.

다음 의미는 아니다.

> GPI policy가 새 task의 최적 policy다.

Policy library에 계단을 오르는 behavior가 전혀 없다면 GPI가 그 능력을 반드시 새로 만들어 내는 것은 아니다.

### 9.1 비슷한 source task가 있으면 최적에 가까워진다

Target task의 weight를 $w_i$, source task weight들을 $w_j$라고 하자. Feature norm의 최대값을 $\phi_{\max}$라고 하면 논문의 두 번째 bound는 다음 형태다.

$$
Q_i^*(s,a)
-Q_i^{\pi_{\text{GPI}}}(s,a)
\le
\frac{2}{1-\gamma}
\left(
\phi_{\max}
\min_j\lVert w_i-w_j\rVert
+\epsilon
\right)
$$

이 식은 두 요소를 보여준다.

1. Target과 가까운 source task가 library에 있어야 한다.
2. SF와 reward weight의 근사 오차가 작아야 한다.

다만 $w$-space의 거리는 $\phi$의 coordinate system과 scale에 의존한다. Feature basis가 나쁘면 $\lVert w_i-w_j\rVert$이 작다는 사실이 실제 policy similarity를 뜻하지 않을 수 있다.

## 10. 전체 transfer 흐름

![SF와 GPI를 이용한 새 task transfer pipeline](/assets/img/posts/rl/sf-gpi/05-transfer-pipeline.svg){: width="1200" .d-block .mx-auto }

### Source task 학습

각 task에서 policy와 SF를 학습한다.

$$
\mathcal L
=
\left\{
\left(
\pi_i,\psi^{\pi_i},w_i
\right)
\right\}_{i=1}^{n}
$$

### 새 task reward 파악

$w_{\text{new}}$가 task description으로 주어지거나 reward sample에서 추정된다.

$$
\min_w
\sum
\left(
r-\phi^\top w
\right)^2
$$

### 모든 source policy 재평가

$$
\widetilde Q_{\text{new}}^{\pi_i}(s,a)
=
\widetilde\psi^{\pi_i}(s,a)^\top
\widetilde w_{\text{new}}
$$

### GPI 행동

$$
\pi_{\text{GPI}}(s)
\in
\arg\max_a
\max_i
\widetilde Q_{\text{new}}^{\pi_i}(s,a)
$$

이 policy는 target task RL을 시작하기 전부터 사용할 수 있다. 그래서 zero-shot behavior 또는 jump-start를 제공한다.

그 뒤 target task를 더 학습하고 새 policy와 SF를 library에 추가할 수도 있다.

## 11. 간단한 수치 예시

Feature를 다음 세 개로 두자.

$$
\phi
=
\begin{bmatrix}
\text{forward}\\
\text{energy}\\
\text{collision}
\end{bmatrix}
$$

현재 state와 action에서 source policy들의 SF가 다음과 같다고 하자.

$$
\psi^{\pi_1}
=
\begin{bmatrix}
8\\5\\2
\end{bmatrix},
\quad
\psi^{\pi_2}
=
\begin{bmatrix}
5\\2\\0.2
\end{bmatrix},
\quad
\psi^{\pi_3}
=
\begin{bmatrix}
2\\0.5\\0
\end{bmatrix}
$$

새 task가 빠른 전진을 선호하면

$$
w_{\text{fast}}
=
\begin{bmatrix}
1\\-0.1\\-0.5
\end{bmatrix}
$$

이고 각 value는 다음과 같다.

$$
Q^{\pi_1}
=
8-0.5-1=6.5
$$

$$
Q^{\pi_2}
=
5-0.2-0.1=4.7
$$

$$
Q^{\pi_3}
=
2-0.05=1.95
$$

이 state-action에서는 $\pi_1$의 continuation이 가장 유리하다.

반대로 collision penalty가 큰 task라면

$$
w_{\text{safe}}
=
\begin{bmatrix}
0.5\\-0.2\\-4
\end{bmatrix}
$$

가 되고 collision feature가 거의 없는 $\pi_2$나 $\pi_3$가 더 유리해질 수 있다.

GPI는 이 비교를 매 state와 action에서 다시 수행한다.

## 12. 논문 실험

### 12.1 Four-room navigation

![Four-room 환경과 서로 다른 task의 최적 trajectory](/assets/img/posts/rl/sf-gpi/07-paper-four-room.png){: width="650" .d-block .mx-auto }

_Four-room에는 세 class의 object와 goal region이 있다. Object class별 reward를 바꾸면 같은 dynamics에서 서로 다른 최적 trajectory가 생긴다. 출처: [Barreto et al., Figure 1](https://arxiv.org/abs/1606.05312)._

논문은 세 object class의 reward weight를

$$
w\sim\operatorname{Uniform}([-1,1]^3)
$$

에서 샘플링해 250개 task를 순서대로 학습한다.

비교 방법은 다음과 같다.

- QL: 새 task의 Q-learning
- PRQL: 이전 policy 재사용
- SFQL: Successor Features와 GPI

![Four-room 250개 task의 transfer 성능](/assets/img/posts/rl/sf-gpi/06-paper-four-room-results.png){: width="1100" .d-block .mx-auto }

_SFQL 계열은 task당 평균 return과 누적 return에서 Q-learning과 PRQL보다 높은 결과를 보인다. 이 figure는 원 논문의 특정 four-room 설정 결과이며 모든 transfer 문제에서의 일반적 우위를 의미하지 않는다. 출처: [Barreto et al., Figure 2](https://arxiv.org/abs/1606.05312)._

### 12.2 Simulated robotic reacher

두 번째 실험은 MuJoCo의 two-joint torque-controlled arm이다.

- 전체 target: 12개
- 실제 training target: 4개
- test target: 8개
- Baseline: DQN
- 제안 방법: SFDQN

![SFDQN과 DQN의 robotic reacher transfer 결과](/assets/img/posts/rl/sf-gpi/08-paper-reacher-results.png){: width="1100" .d-block .mx-auto }

_실선은 training task, 흐린 점선은 아직 학습하지 않은 task다. 오른쪽 위는 8개 test target에서의 평균 성능이다. SFDQN은 한 task를 학습할 때 다른 target의 성능도 함께 개선되는 transfer를 보인다. 출처: [Barreto et al., Figure 3](https://arxiv.org/abs/1606.05312)._

이 실험은 SF+GPI가 tabular navigation에만 한정되지 않고 neural-network value approximation과 결합될 수 있음을 보여준다. 다만 action은 discretized되어 있으며 현대적인 continuous-control actor-critic에 그대로 옮긴 결과는 아니다.

## 13. UVFA, HER와 무엇이 다른가?

이전 [UVFA + HER 글](/posts/uvfa-her-goal-conditioned-reinforcement-learning/)과 비교하면 역할이 더 분명해진다.

### UVFA

$$
Q(s,a,g)
$$

Goal이나 task를 network input으로 넣어 하나의 function approximator가 여러 task의 value를 직접 예측한다.

### HER

실패 trajectory의 goal을 실제 달성한 goal로 relabel해 sparse reward data를 늘린다.

### SF + GPI

$$
Q(s,a,\pi_i,w)
=
\psi^{\pi_i}(s,a)^\top w
$$

여러 source policy의 미래 feature 예측을 새 reward에서 다시 평가하고 그 maximum으로 policy improvement를 수행한다.

| 구분 | UVFA | HER | SF + GPI |
|---|---|---|---|
| 핵심 문제 | 여러 goal의 value 표현 | Sparse reward data | Reward가 바뀐 task로 policy transfer |
| 재사용 단위 | Parametric value function | Relabeled transition | Source policy와 SF library |
| 새 task 처리 | $g$를 입력으로 Q 직접 예측 | Goal을 바꿔 replay | $\psi^\pi$에 새 $w$를 곱해 재평가 |
| Policy composition | 별도 보장 없음 | 없음 | GPI bound |

후속 연구인 **USFA, Universal Successor Features Approximator**는 UVFA식 function approximation과 SF+GPI 구조를 결합한다.

$$
\psi(s,a,z)
$$

여기서 $z$는 평가 대상 reward가 아니라 **앞으로 따를 policy의 descriptor**다.

$$
Q(s,a,z,w)
=
\psi(s,a,z)^\top w
$$

- $z$: 어떤 behavior policy의 미래를 예측하는가
- $w$: 그 미래를 어떤 reward로 평가하는가

## 14. DIAYN, LSD, METRA, CSD와의 관계

Skill discovery 방법은 다음을 묻는다.

> 외부 task reward 없이 어떤 다양한 policy를 만들 것인가?

SF+GPI는 다음을 묻는다.

> 이미 만든 policy들을 새 reward에서 어떻게 평가하고 재사용할 것인가?

두 흐름은 다음처럼 연결할 수 있다.

```text
unsupervised skill discovery
    -> behavior policy library
    -> 각 policy의 successor features 학습
    -> 새 task reward w 제공
    -> GPI로 policy reuse
```

하지만 자동으로 연결되는 것은 아니다.

### Skill z와 reward w는 다르다

METRA나 CSD의 $z$는 policy에 입력되어 behavior를 만든다.

$$
\pi(a\mid s,z)
$$

SF의 $w$는 behavior 결과를 평가한다.

$$
Q=\psi^\top w
$$

Skill latent space와 downstream reward feature space가 자동으로 정렬되는 것은 아니다.

### Behavior가 다양하다고 좋은 library는 아니다

GPI에서 중요한 것은 여러 $w$ 방향에서 높은 projection을 가질 SF를 확보하는 것이다.

![중복된 policy library와 SF extremal coverage 비교](/assets/img/posts/rl/sf-gpi/09-policy-library-coverage.svg){: width="1200" .d-block .mx-auto }

겉으로 다른 motion이 많아도 downstream feature 기준의 SF가 비슷하면 GPI 관점에서는 중복일 수 있다.

좋은 library는 단순히 policy 개수가 많은 것이 아니라, 가능한 linear reward 방향에서 선택될 **extremal successor features**를 잘 덮어야 한다.

이 관점은 SF transfer와 multi-objective RL의 convex coverage set으로 이어진다. 다만 이 내용은 원 논문의 직접적인 알고리즘보다 후속 연구에서 더 명확하게 발전했다.

## 15. Robot continuous control에 적용할 때

원 논문의 GPI 식은 discrete action에서 자연스럽다.

$$
\arg\max_a
\max_i
\psi^{\pi_i}(s,a)^\top w
$$

Continuous action에서는 모든 $a$를 열거할 수 없다.

### 15.1 Source actor proposal 사용

각 source actor가 action 후보를 제안하게 할 수 있다.

$$
a_i=\pi_i(s)
$$

그 후보를 SF critic들로 교차 평가한다.

$$
a^*
\in
\arg\max_{a_i}
\max_j
\psi^{\pi_j}(s,a_i)^\top w
$$

이것은 전체 continuous action space에서의 full GPI가 아니라 source actor가 제안한 후보 집합 위의 **restricted GPI**다. 따라서 원래 theorem을 그대로 적용하기 어렵다.

### 15.2 Policy selector와 full GPI를 구분해야 한다

다음 식은 구현하기 쉽다.

$$
i^*
=
\arg\max_i
\psi^{\pi_i}(s,\pi_i(s))^\top w
$$

하지만 이것은 각 actor가 자기 action을 자기 continuation value로 평가하는 policy selection에 가깝다.

Full GPI에 더 가까우려면 actor $i$가 제안한 action을 continuation policy $j$의 SF critic도 평가해야 한다.

$$
\psi^{\pi_j}
\left(
s,\pi_i(s)
\right)
$$

### 15.3 매 step switching은 부드럽지 않을 수 있다

GPI는 state마다 지배적인 source policy가 달라질 수 있다.

Robot의 low-level torque나 joint target을 매 step 서로 다른 policy가 사실상 지배하면 다음 문제가 생길 수 있다.

- Gait phase 불연속
- Torque jump
- Action chattering
- Safety constraint 위반

실제 robot에서는 다음 구조가 더 보수적이다.

```text
high-level GPI
    behavior/option을 낮은 주기로 선택

low-level policy
    일정 horizon 동안 부드러운 control 유지
```

다만 이것은 원래 one-step GPI와 다른 option-level approximation이다.

## 16. 핵심 한계

### 16.1 Dynamics가 바뀌면 직접 재사용할 수 없다

SF는 특정 dynamics와 policy 아래에서 학습된다. 질량, 마찰, actuator delay, morphology가 바뀌면 $\psi^\pi$도 부정확해진다.

원 논문의 핵심 설정은 **same dynamics, different rewards**다.

### 16.2 새 reward 정보가 필요하다

SF+GPI는 새 task가 무엇인지 스스로 추론하는 방법이 아니다.

$w_{\text{new}}$가 주어지거나 reward sample로 추정돼야 한다. Task description도 reward signal도 없다면 무엇을 최적화할지 알 수 없다.

### 16.3 Feature 설계 문제가 남는다

사람이

$$
\phi
=
[\text{progress},\text{energy},\text{slip},\text{collision}]
$$

를 설계하면 reward engineering이 feature engineering으로 이동할 수 있다.

후속 deep SF+GPI 연구에서는 source reward function들을 feature basis로 사용해 hand-designed $\phi$ 의존을 줄이는 방향을 제안했다. 하지만 task family가 공통 feature span과 dynamics를 공유해야 한다는 기본 가정은 남는다.

### 16.4 Long horizon에서 approximation error가 커진다

GPI bound의 오차 항은

$$
\frac{2\epsilon}{1-\gamma}
$$

이다. $\gamma$가 1에 가까우면 작은 SF 또는 $w$ estimation error도 큰 value error로 확대될 수 있다.

또한

$$
\left|
\widetilde\psi^\top\widetilde w
-\psi^\top w
\right|
$$

에는 SF network error, feature model error, off-policy evaluation error, reward weight estimation error가 모두 들어간다.

### 16.5 Library 밖의 완전히 새로운 능력은 보장하지 않는다

GPI는 source value들을 이용해 기존 policy보다 좋아질 수 있지만, 필요한 behavior가 library에 없다면 최적성이 보장되지 않는다.

### 16.6 시간적 skill composition은 별도 문제다

GPI theorem에는 skill horizon, termination, phase alignment, switching cost가 없다. Value-based reuse와 자연스러운 장기 primitive composition은 다른 문제다.

## 17. 구현 체크리스트

### Task family

- Dynamics가 task 사이에서 정말 같은가?
- 모든 reward가 공통 $\phi$의 linear span 안에 있는가?
- $\phi$와 $w$ scale이 정규화됐는가?

### SF critic

- Output shape이 `[batch, feature_dim]`인가?
- TD target에서 immediate feature와 next SF의 단위가 같은가?
- Source policy마다 continuation policy가 정확히 구분되는가?
- Off-policy SF evaluation error를 측정하는가?

### GPI

- Episode-level policy selector를 GPI라고 부르고 있지 않은가?
- Current action과 continuation policy를 분리해 평가하는가?
- Continuous action이면 후보 집합의 제한을 명시하는가?
- Switching frequency와 hysteresis가 robot control에 안전한가?

### Evaluation

- Best source policy 대비 GPI 성능을 비교하는가?
- Target optimal policy 대비 결과를 별도로 구분하는가?
- $w$ distance뿐 아니라 SF-space coverage를 확인하는가?
- Dynamics shift에서 SF calibration이 얼마나 무너지는가?

## 18. 헷갈렸던 질문 정리

### Q1. SF는 feature encoder인가?

단순한 state embedding이 아니다. Policy를 계속 따랐을 때 미래 feature가 할인되어 얼마나 누적될지 예측하는 vector value function이다.

### Q2. SF가 dynamics와 reward를 완전히 분리하는가?

Reward preference $w$와는 분리한다. 하지만 $\psi^\pi$에는 dynamics, policy, feature representation이 함께 들어 있다.

### Q3. 새 reward에서는 SF network를 다시 학습하지 않아도 되는가?

Dynamics와 policy가 같고 $\phi$가 새 reward를 표현한다면 기존 SF로 source policy를 바로 재평가할 수 있다. 새 task에 특화된 policy와 SF를 추가로 학습하는 것은 선택 사항이다.

### Q4. GPI는 가장 좋은 source policy를 선택하는가?

그보다 강하다. 각 state-action에서 source Q들의 maximum을 만든 뒤 그 함수에 greedy한 새 policy를 정의한다.

### Q5. GPI는 새 task 최적 policy를 보장하는가?

아니다. 정확한 보장은 best source policy 대비 성능이다. Target과 가까운 source task가 있고 approximation error가 작을 때 최적과의 gap이 작아진다.

### Q6. Zero-shot이면 새 task reward를 몰라도 되는가?

아니다. $w$ 또는 reward sample이 필요하다. Zero-shot은 target-task policy learning 전에 source SF를 재사용할 수 있다는 뜻이다.

### Q7. PPO에도 SF를 넣을 수 있는가?

Vector state-value critic을 학습하는 것은 가능하다. 하지만 하나의 SF-PPO policy를 만드는 것만으로 여러 source policy에 대한 full GPI가 자동으로 구현되지는 않는다.

### Q8. Skill discovery와 바로 합치면 되는가?

각 skill policy의 SF를 학습해 library로 사용할 수는 있다. 하지만 skill $z$, reward feature $\phi$, task weight $w$의 의미를 분리하고 SF-space coverage를 검증해야 한다.

## 19. 정리

SF+GPI에서 기억할 것은 네 가지다.

1. **Reward를 immediate feature와 preference로 분해한다.**

   $$
   r=\phi^\top w
   $$

2. **Policy의 미래 feature 발생량을 Successor Features로 저장한다.**

   $$
   \psi^\pi
   =
   \mathbb E^\pi
   \left[
   \sum_k\gamma^k\phi_{t+k+1}
   \right]
   $$

3. **새 reward에서 source policy를 dot product로 즉시 재평가한다.**

   $$
   Q_w^\pi=\psi^{\pi\top}w
   $$

4. **GPI는 source Q들의 maximum에 greedy한 policy를 만든다.**

   $$
   \pi_{\text{GPI}}(s)
   \in
   \arg\max_a\max_i
   \psi^{\pi_i}(s,a)^\top w
   $$

Skill discovery가 behavior repertoire를 만드는 문제라면, SF+GPI는 그 repertoire의 장기적인 결과를 새 목적함수에서 평가하고 재사용하는 문제다.

가장 정확한 한 문장은 다음과 같다.

> **Successor Features는 정책의 장기 행동 결과를 reward와 분리된 vector로 저장하고, GPI는 새 reward에서 여러 source policy의 continuation value를 비교해 best source보다 나쁘지 않은 새 policy를 만든다.**

## 참고 자료

- [Barreto et al., Successor Features for Transfer in Reinforcement Learning, NeurIPS 2017](https://papers.nips.cc/paper_files/paper/2017/hash/350db081a661525235354dd3e19b8c05-Abstract.html)
- [arXiv version with supplementary material](https://arxiv.org/abs/1606.05312)
- [Dayan, Improving Generalization for Temporal Difference Learning: The Successor Representation](https://doi.org/10.1162/neco.1993.5.4.613)
- [Barreto et al., Transfer in Deep Reinforcement Learning Using Successor Features and Generalised Policy Improvement](https://proceedings.mlr.press/v80/barreto18a.html)
- [Borsa et al., Universal Successor Features Approximators](https://arxiv.org/abs/1812.07626)
