---
title: "DIAYN: 보상 없이 다양한 스킬을 발견하는 방법"
date: 2026-07-18 15:45:00 +0900
categories: [RL, Study]
tags: [diayn, unsupervised-reinforcement-learning, skill-discovery, mutual-information, soft-actor-critic, hierarchical-rl]
description: DIAYN 논문의 정보이론 목적함수부터 discriminator 보상, SAC 구현, VIC와의 차이, 실험 결과와 로봇 적용 시 한계까지 정리한다.
math: true
image:
  path: /assets/img/posts/rl/diayn/00-diayn-preview.png
  alt: DIAYN이 보상 없이 발견한 HalfCheetah, Ant, Hopper의 다양한 locomotion skill
---

## **0. 전체 그림: 목표를 주지 않고 스킬을 배울 수 있을까?**

일반적인 강화학습은 사람이 먼저 목표를 정합니다.

```text
앞으로 가라
-> 전진 속도 보상
-> 에너지와 넘어짐 패널티
-> 보상의 합을 최대화하는 정책 학습
```

이 방식은 목표가 분명할 때 강력합니다. 그러나 환경에서 앞으로 어떤 과제를 수행할지 아직 모른다면, 과제마다 보상 함수를 다시 설계해야 합니다. 보상이 sparse하거나 잘못 설계되면 탐색 자체가 시작되지 않을 수도 있습니다.

Eysenbach et al.의 **Diversity Is All You Need, DIAYN**은 질문을 반대로 뒤집습니다.

> 특정 과제를 먼저 정하지 말고, 서로 확실히 구별되는 여러 행동 방식을 미리 배워두면 어떨까?

DIAYN은 외부 task reward 없이 latent skill $z$를 조건으로 받는 정책을 학습합니다. 각 skill이 서로 다른 상태 분포를 만들도록 하고, 나중에 필요한 skill을 선택하거나 fine-tuning하거나 상위 정책이 조합하게 합니다.

DIAYN을 한 문장으로 압축하면 다음과 같습니다.

> **현재 상태만 보고 어떤 skill이 실행되었는지 맞힐 수 있도록 정책을 학습하고, 그 분류 가능성을 intrinsic reward로 사용한다.**

다만 첫 문장부터 주의할 점이 있습니다.

> **서로 다른 행동**과 **사람에게 유용한 행동**은 같은 말이 아닙니다.

DIAYN은 diversity를 직접 최적화합니다. 안정적인 보행, 에너지 효율, 안전성은 목적함수에 따로 넣지 않는 한 보장되지 않습니다. 이 구분이 논문의 강점과 한계를 모두 이해하는 출발점입니다.

## **1. 논문 정보**

| 항목 | 내용 |
|---|---|
| Title | Diversity Is All You Need: Learning Skills without a Reward Function |
| Authors | Benjamin Eysenbach, Abhishek Gupta, Julian Ibarz, Sergey Levine |
| Venue | ICLR 2019 |
| Problem | 외부 reward가 없는 unsupervised skill discovery |
| Base RL algorithm | Soft Actor-Critic, SAC |
| Skill variable | categorical latent variable $z$ |
| 핵심 목적 | skill $Z$와 state $S$의 mutual information 최대화 |
| Intrinsic reward | $\log q_\phi(z\mid s)-\log p(z)$ |
| 주요 활용 | pretraining, hierarchical RL, imitation |
| 실험 환경 | 2D navigation, Inverted Pendulum, Mountain Car, HalfCheetah, Hopper, Ant |
| Source | [arXiv](https://arxiv.org/abs/1802.06070), [OpenReview](https://openreview.net/forum?id=SJx63jRqFm), [Project videos](https://sites.google.com/view/diayn/), [Official code note](https://github.com/ben-eysenbach/sac/blob/master/DIAYN.md) |

논문이 상정하는 학습은 두 단계입니다.

```text
Unsupervised stage
task reward 없이 다양한 skill 학습

          ↓

Supervised downstream stage
필요한 skill 선택, fine-tuning, 계층적 조합, imitation
```

따라서 DIAYN의 주장은 단순히 "reward 없이 문제를 해결한다"가 아닙니다. 더 정확하게는 **task reward가 없는 사전 탐색 단계에서 재사용 가능한 행동 repertoire를 만든다**는 주장입니다.

## **2. DIAYN에서 말하는 skill은 무엇인가?**

DIAYN의 policy는 일반적인 $\pi(a\mid s)$가 아니라 다음과 같습니다.

$$
\pi_\theta(a\mid s,z)
$$

- $s$: 현재 환경 상태
- $a$: 현재 행동
- $z$: 이번 episode에서 실행할 skill ID

$z$가 고정되면 하나의 조건부 정책이 됩니다.

$$
\pi_z(a\mid s)
=
\pi_\theta(a\mid s,z)
$$

논문은 이 조건부 정책 하나를 **skill**이라고 부릅니다. 별도의 policy network를 skill 수만큼 만드는 것이 아니라, 하나의 network가 $z$를 입력받아 여러 행동 양식을 표현합니다.

예를 들어 $K=4$개의 categorical skill이 있다면 다음처럼 생각할 수 있습니다.

```text
z = 0 -> 아직 의미 없음
z = 1 -> 아직 의미 없음
z = 2 -> 아직 의미 없음
z = 3 -> 아직 의미 없음
```

초기에는 어떤 $z$에도 사람이 정한 의미가 없습니다. 학습이 진행되면서 어떤 skill은 앞으로 이동하고, 어떤 skill은 뒤로 이동하며, 어떤 skill은 뛰거나 회전하는 식으로 서로 다른 상태 분포를 만들게 됩니다.

여기서 중요한 점은 **skill label과 의미 사이의 대응도 학습 결과**라는 것입니다. $z=2$가 반드시 "오른쪽 걷기"여야 하는 이유는 없습니다. random seed가 달라지면 같은 번호가 전혀 다른 행동을 나타낼 수 있습니다.

## **3. Prior $p(z)$는 사전지식이 아니다**

에피소드 시작 시 skill은 다음 분포에서 하나 뽑습니다.

$$
z\sim p(z)
$$

DIAYN은 categorical skill $K$개에 대해 이 분포를 uniform으로 고정합니다.

$$
p(z)=\frac{1}{K}
$$

여기서 prior는 "미리 학습한 지식"이라는 뜻이 아닙니다.

> 결과 상태를 보기 전에 어떤 skill을 실행할지 정하는 **skill sampling distribution**입니다.

$K=10$이라면 각 skill이 선택될 확률은 계속 약 $10\%$입니다. 잘 학습된 skill도 $10\%$, 아직 구별되지 않는 skill도 $10\%$를 받습니다.

### **3.1 왜 prior를 학습하지 않고 고정하는가?**

처음에는 모든 skill이 미숙합니다. 우연히 $z=1$이 다른 skill보다 조금 독특한 상태에 도달했다고 해보겠습니다.

```text
z=1이 우연히 잘 구별됨
-> z=1을 더 자주 선택
-> z=1 데이터가 더 많이 쌓임
-> z=1이 더 빨리 개선됨
-> z=1을 더 자주 선택
```

반대로 초기 성능이 낮은 skill은 데이터 자체를 적게 받아 회복하기 어려워집니다. 논문은 이를 **Matthew Effect**, 즉 잘되는 skill에 학습 기회가 더 몰리는 양의 피드백으로 설명합니다.

DIAYN은 $p(z)$를 uniform으로 고정하여 이 sampling collapse를 차단합니다.

> 내가 헷갈렸던 지점: "모든 skill을 똑같이 뽑으면 비효율적이지 않나?"
>
> 당장 잘하는 skill만 보면 비효율적으로 보입니다. 하지만 unsupervised skill discovery의 목적은 최고 성능 skill 하나를 찾는 것이 아니라 **여러 skill을 끝까지 살려두는 것**입니다. Uniform prior는 성능 최적화 장치가 아니라 skill coverage를 보존하는 장치입니다.

## **4. Mutual information으로 다양성을 정의하기**

DIAYN은 "두 행동이 얼마나 다른가"를 사람이 만든 거리 함수로 정의하지 않습니다. 대신 skill $Z$와 방문 상태 $S$ 사이의 mutual information을 사용합니다.

$$
I(S;Z)
=
H(Z)-H(Z\mid S)
$$

각 항의 의미는 다음과 같습니다.

| 항 | 의미 |
|---|---|
| $H(Z)$ | 전체 skill sampling distribution의 다양성 |
| $H(Z\mid S)$ | 상태 $S$를 본 뒤에도 skill $Z$가 얼마나 불확실한가 |
| $I(S;Z)$ | 상태를 보면 skill에 대해 얼마나 많은 정보를 얻는가 |

$H(Z)$는 uniform prior로 이미 최대가 됩니다.

$$
H(Z)=\log K
$$

따라서 policy가 실제로 줄여야 하는 것은 $H(Z\mid S)$입니다. 현재 상태를 봤을 때 어떤 skill인지 거의 확실히 맞힐 수 있어야 합니다.

### **4.1 Mutual information이 큰 상태 분포**

다음과 같은 skill이 있다고 해보겠습니다.

```text
z=1 -> 주로 왼쪽 영역 방문
z=2 -> 주로 오른쪽 영역 방문
z=3 -> 주로 위쪽 영역 방문
```

현재 위치만 봐도 어떤 $z$인지 쉽게 추측할 수 있으므로 $I(S;Z)$가 큽니다.

반대로 모든 skill이 같은 위치에 머문다면 상태를 보고 $z$를 맞힐 수 없습니다.

```text
z=1 -> 중앙
z=2 -> 중앙
z=3 -> 중앙
```

이 경우 $H(Z\mid S)$가 크고 mutual information은 작습니다.

### **4.2 왜 action이 아니라 state로 구별하는가?**

관절 torque만 다르고 실제 로봇이나 환경은 똑같이 움직이는 두 policy를 생각해보겠습니다. Action은 다르지만 외부에서 관찰 가능한 결과는 같습니다.

DIAYN은 이런 차이를 의미 있는 skill diversity로 보지 않습니다. 그래서 skill은 action 자체가 아니라 **그 action이 만든 state**를 통해 구별되어야 합니다.

논문은 이를 다음 항으로 표현합니다.

$$
-I(A;Z\mid S)
$$

같은 상태에서 skill마다 action만 달라지는 것을 목적에서 제거하려는 항입니다.

## **5. 전체 목적함수는 왜 이런 모양인가?**

논문의 출발 목적함수는 다음과 같습니다.

$$
\mathcal{F}(\theta)
=
I(S;Z)
+H(A\mid S)
-I(A;Z\mid S)
$$

entropy 식을 전개하면 다음처럼 정리됩니다.

$$
\begin{aligned}
\mathcal{F}(\theta)
&= H(Z)-H(Z\mid S)
+H(A\mid S)
-\left(H(A\mid S)-H(A\mid S,Z)\right) \\
&= H(Z)-H(Z\mid S)+H(A\mid S,Z)
\end{aligned}
$$

이제 세 항의 역할이 명확해집니다.

| 목적함수 항 | 학습에서 하는 일 |
|---|---|
| $H(Z)$ | 다양한 skill이 sampling되게 함. DIAYN에서는 uniform prior로 고정 |
| $-H(Z\mid S)$ | 상태에서 skill ID를 쉽게 맞히도록 함 |
| $H(A\mid S,Z)$ | 각 skill 내부의 policy entropy를 높여 탐색을 유지 |

### **5.1 단순히 분류만 잘되면 충분하지 않은 이유**

Entropy 항이 없다면 두 skill이 아주 미세한 차이만 만들어도 discriminator가 구별할 수 있습니다. 예를 들어 서로 다른 관절 하나를 작은 각도로 유지하는 것만으로 label을 맞힐 수 있을지도 모릅니다.

DIAYN은 각 skill 안에서도 action entropy를 높입니다.

$$
H(A\mid S,Z)
$$

정책이 어느 정도 무작위로 행동하는데도 skill identity가 유지되려면, 다른 skill과 겹치지 않는 더 넓고 안정적인 상태 영역을 찾아야 합니다. 논문 저자들은 이를 단순 discriminability보다 더 넓은 diversity를 만드는 장치로 해석합니다.

다만 entropy를 무조건 크게 한다고 좋은 것은 아닙니다. Appendix 실험에서는 entropy coefficient가 너무 크면 action randomness 때문에 오히려 skill을 구별하기 어려워집니다. 논문은 모든 실험에 $\alpha=0.1$을 사용했습니다.

## **6. 계산할 수 없는 posterior를 discriminator로 근사하기**

문제는 실제 posterior $p(z\mid s)$를 모른다는 것입니다. 특정 상태가 어떤 skill에서 나왔을 확률을 환경 전체에 대해 정확히 계산하기 어렵습니다.

DIAYN은 이를 discriminator로 근사합니다.

$$
q_\phi(z\mid s)
\approx
p(z\mid s)
$$

Discriminator는 상태를 입력받고 skill ID에 대한 categorical probability를 출력합니다.

```text
input:  state feature f(s)
output: [P(z=0|s), P(z=1|s), ..., P(z=K-1|s)]
```

실제 실행한 $z$를 이미 알고 있으므로 discriminator 학습은 일반적인 supervised classification입니다.

$$
\mathcal{L}_{D}(\phi)
=
-\mathbb{E}_{s,z}
\left[
\log q_\phi(z\mid s)
\right]
$$

Variational lower bound를 사용하면 원래 목적함수는 다음과 같이 최적화할 수 있습니다.

$$
\mathcal{G}(\theta,\phi)
=
\mathbb{E}_{z\sim p(z),\,s\sim\pi_z}
\left[
\log q_\phi(z\mid s)-\log p(z)
\right]
+H(A\mid S,Z)
$$

첫 번째 기댓값은 RL reward로, 마지막 entropy 항은 maximum-entropy RL로 처리할 수 있습니다.

## **7. Intrinsic reward의 의미**

DIAYN의 pseudo-reward는 다음과 같습니다.

$$
r_z(s)
=
\log q_\phi(z\mid s)-\log p(z)
$$

논문의 실제 알고리즘에서는 transition 뒤의 상태를 사용합니다.

$$
r_t
=
\log q_\phi(z\mid s_{t+1})
-\log p(z)
$$

Uniform prior라면 다음과 같습니다.

$$
r_t
=
\log q_\phi(z\mid s_{t+1})
+\log K
$$

무작위 추측 수준인 $q_\phi(z\mid s)=1/K$에서는 reward가 0입니다. 완벽히 맞히면 최대값은 $\log K$입니다.

$$
r_{\max}=\log K
$$

반면 정답 skill의 확률이 0에 가까워지면 reward는 큰 음수가 될 수 있습니다. 구현에서는 `softmax` 후 `log`를 따로 계산하기보다 `log_softmax`를 사용해야 수치적으로 안전합니다.

```python
log_probs = torch.log_softmax(discriminator(skill_obs), dim=-1)
log_q = log_probs.gather(1, skill_id[:, None]).squeeze(1)
log_p = -math.log(num_skills)
reward = log_q - log_p
```

### **7.1 이 보상은 절대평가가 아니라 상대평가다**

Discriminator가 완벽해서 $q_\phi(z\mid s)=p(z\mid s)$라고 가정하면 Bayes rule로 다음을 얻습니다.

$$
\begin{aligned}
r(s,z)
&= \log \frac{p(z\mid s)}{p(z)} \\
&= \log \frac{p(s\mid z)}{p(s)}
\end{aligned}
$$

- $p(s\mid z)$: 이 skill이 해당 상태를 얼마나 자주 방문하는가
- $p(s)$: 모든 skill을 섞었을 때 해당 상태가 얼마나 흔한가

따라서 높은 reward를 받는 상태는 다음과 같습니다.

> **내 skill은 자주 방문하지만 다른 skill은 잘 방문하지 않는 상태**

일반 task reward와 가장 다른 지점입니다. 전진 reward는 다른 policy가 무엇을 하든 전진하면 높습니다. DIAYN reward는 다른 skill도 같은 상태를 방문하기 시작하면 낮아질 수 있습니다.

### **7.2 왜 $-\log p(z)$를 남겨두는가?**

$p(z)$가 고정되어 있으므로 $-\log p(z)$는 policy gradient 관점에서 baseline처럼 보입니다. 그래도 논문은 이 항을 reward에 남깁니다.

Appendix의 설명은 두 가지입니다.

1. Skill을 구별할 수 없는 absorbing state에서는 $q(z\mid s)=1/K$가 되므로 uniform prior일 때 reward가 0이 됩니다.
2. 이 baseline이 없으면 모든 log probability가 음수이므로 agent가 episode를 빨리 끝내는 행동을 선호할 수 있습니다.

논문은 discriminator가 chance보다 낫다는 가정 아래 보상이 비음수가 된다고 설명합니다. 다만 실제 function approximation에서는 모든 sample에 대해 항상 $q(z\mid s)\ge p(z)$가 보장되는 것은 아닙니다.

### **7.3 같은 transition의 reward가 바뀔 수 있는가?**

가능합니다. Reward를 만드는 $q_\phi$ 자체가 학습 중이기 때문입니다.

```text
같은 (s', z=3)

학습 초기 q(z=3|s') = 0.30
학습 중기 q(z=3|s') = 0.70
학습 후기 q(z=3|s') = 0.95
```

따라서 DIAYN은 고정된 reward function을 사용하는 task RL보다 non-stationarity가 강합니다.

Off-policy replay에서 구현 선택은 두 가지입니다.

| 방식 | 장점 | 위험 |
|---|---|---|
| 수집 시 reward 저장 | TD target 안정 | 과거 $q_\phi$ 기준으로 남음 |
| Batch에서 reward 재계산 | 최신 $q_\phi$와 일관 | Critic target이 움직임 |

이 비교는 원 논문의 핵심 실험 항목은 아니며, 실제 재구현에서 생기는 설계 문제입니다. 따라서 어떤 방식이 "원래 DIAYN의 정답"이라고 단정하면 안 됩니다.

## **8. 알고리즘 전체 흐름**

![DIAYN algorithm from the original paper](/assets/img/posts/rl/diayn/diayn-algorithm.png)
_DIAYN의 policy-discriminator 학습 흐름. 출처: [Eysenbach et al., Figure 1](https://arxiv.org/abs/1802.06070)._

학습 순서는 다음과 같습니다.

1. 에피소드 시작 시 $z\sim p(z)$를 한 번 sampling합니다.
2. 해당 에피소드 동안 같은 $z$를 유지합니다.
3. Policy $\pi_\theta(a\mid s,z)$가 action을 출력합니다.
4. Environment에서 $s_{t+1}$을 얻습니다.
5. Discriminator가 $q_\phi(z\mid s_{t+1})$를 계산합니다.
6. $r_t=\log q_\phi(z\mid s_{t+1})-\log p(z)$를 만듭니다.
7. SAC가 이 reward를 최대화하도록 actor와 critic을 업데이트합니다.
8. Discriminator는 실제 skill ID를 맞히도록 cross-entropy로 업데이트됩니다.

코드에 가까운 형태로 보면 다음과 같습니다.

```python
for episode in range(num_episodes):
    obs = env.reset()
    z = sample_uniform_skill(num_skills)

    done = False
    while not done:
        action = actor.sample(obs, z)
        next_obs, _, done, info = env.step(action)

        logits = discriminator(skill_features(next_obs))
        log_q = torch.log_softmax(logits, dim=-1)[z]
        reward = log_q + math.log(num_skills)

        replay_buffer.add(obs, z, action, reward, next_obs, done)

        update_sac_actor_and_critic()
        update_discriminator_with_cross_entropy()

        obs = next_obs
```

### **8.1 SAC의 기본 개념**

위 알고리즘의 7번에는 "SAC가 actor와 critic을 업데이트한다"는 문장이 들어갑니다. 로봇 강화학습에서 PPO를 주로 접했다면 이 부분부터 낯설 수 있습니다.

**[Soft Actor-Critic, SAC](https://arxiv.org/abs/1801.01290)**는 연속 제어를 위해 설계된 **off-policy maximum-entropy Actor-Critic** 알고리즘입니다. 일반적인 강화학습이 discounted reward를 최대화한다면 SAC는 reward와 Policy entropy를 함께 최대화합니다.

$$
J_{\text{SAC}}(\pi)
=
\mathbb{E}_{\pi}
\left[
\sum_{t=0}^{\infty}
\gamma^t
\left(
r(s_t,a_t)
+
\alpha
\mathcal{H}\bigl(\pi(\cdot\mid s_t)\bigr)
\right)
\right]
$$

Policy entropy는 다음과 같습니다.

$$
\mathcal{H}\bigl(\pi(\cdot\mid s)\bigr)
=
\mathbb{E}_{a\sim\pi}
\left[
-\log\pi(a\mid s)
\right]
$$

따라서 한 action sample의 관점에서는 SAC가 대략 다음 값을 크게 만드는 Policy를 찾는다고 볼 수 있습니다.

$$
r(s,a)-\alpha\log\pi(a\mid s)
$$

- Reward가 크면 task를 잘 수행합니다.
- $-\log\pi(a\mid s)$가 크면 한 action에 지나치게 확정적으로 수렴하지 않습니다.
- Temperature $\alpha$는 reward와 entropy의 상대적 비중을 조절합니다.

$\alpha$가 크면 Policy가 더 넓은 action distribution을 유지하고, 너무 크면 유용한 동작보다 randomness가 강해질 수 있습니다. $\alpha$가 작아지면 일반적인 reward maximization에 가까워지고 Policy가 더 결정적으로 변합니다.

여기서 **Soft**는 action을 부드럽게 움직인다는 뜻이 아닙니다. Bellman backup과 Policy objective에 entropy가 포함되어, 단 하나의 최고 action만 보는 hard maximum 대신 여러 가능성의 가치를 함께 반영한다는 뜻입니다.

SAC의 핵심 구성은 다음과 같습니다.

| 구성 | 역할 |
|---|---|
| Stochastic Actor $\pi_\theta(a\mid s)$ | 평균과 분산을 출력하고 continuous action을 sampling |
| Twin Critic $Q_{\psi_1},Q_{\psi_2}$ | action의 장기 return을 추정하고 작은 값을 사용해 과대평가 완화 |
| Target network | Critic이 따라갈 TD target의 급격한 변화를 완화 |
| Replay buffer | 과거와 최근 transition을 섞어 반복 학습 |
| Temperature $\alpha$ | reward와 Policy entropy 사이의 균형 조절 |

현대 SAC의 Critic target은 보통 다음처럼 씁니다.

$$
\begin{aligned}
a'
&\sim
\pi_\theta(\cdot\mid s'), \\
y
&=
r
+
\gamma(1-d)
\left[
\min_i \bar Q_i(s',a')
-
\alpha\log\pi_\theta(a'\mid s')
\right]
\end{aligned}
$$

Critic은 $Q_i(s,a)$가 이 target $y$에 가까워지도록 학습합니다. Actor는 다음 loss를 최소화합니다.

$$
J_\pi
=
\mathbb{E}_{s\sim\mathcal{D},\,a\sim\pi_\theta}
\left[
\alpha\log\pi_\theta(a\mid s)
-
\min_i Q_{\psi_i}(s,a)
\right]
$$

즉 Actor는 Critic이 높게 평가하는 action을 만들면서도 Policy entropy를 유지합니다. Replay buffer $\mathcal{D}$의 과거 transition을 다시 사용하므로 SAC는 off-policy입니다.

> **초기 SAC와 현대 SAC는 코드 모양이 다릅니다.**
>
> DIAYN 논문 시기의 초기 SAC와 이 글의 참고 구현은 별도의 Value network와 target Value network를 사용합니다. 이후 널리 쓰이는 SAC는 explicit Value network를 제거하고 target Q를 사용하며, $\alpha$를 자동 조절하는 구성을 자주 사용합니다. 네트워크 배치는 달라도 off-policy replay와 maximum-entropy Actor-Critic이라는 핵심은 같습니다.

### **8.2 로봇 강화학습에서 익숙한 PPO와 무엇이 다른가?**

로봇 강화학습, 특히 수천 개 환경을 병렬로 실행하는 simulation 기반 locomotion에서는 [PPO](https://arxiv.org/abs/1707.06347)가 널리 사용됩니다. 새 rollout을 빠르게 대량 생성할 수 있고, clipped objective가 큰 Policy update를 제한하며, vectorized environment 구조와 결합하기 쉽기 때문입니다.

SAC가 PPO보다 항상 좋거나, PPO가 SAC보다 항상 안정적인 것은 아닙니다. 두 알고리즘은 데이터가 비싼지, 병렬 simulation을 얼마나 사용할 수 있는지, replay에서 생기는 non-stationarity를 감당할 수 있는지에 따라 장단점이 달라집니다.

**학습 분류**

- PPO: On-policy Actor-Critic
- SAC: Off-policy Actor-Critic

**데이터 사용**

- PPO: 현재 Policy로 모은 rollout을 여러 epoch 사용한 뒤 교체
- SAC: Replay buffer의 과거·현재 transition을 반복 사용

**Policy update**

- PPO: Probability ratio를 clipped surrogate objective로 제한
- SAC: Soft Q-value와 entropy로 stochastic Actor update

**Critic 역할**

- PPO: Return과 advantage 추정을 위한 Value function
- SAC: Actor가 선택할 action의 soft Q-value 학습

**Entropy**

- PPO: 보조 bonus로 자주 추가
- SAC: Maximum-entropy objective의 핵심 항

**강점이 드러나는 조건**

- PPO: 대규모 병렬 simulation과 높은 rollout throughput
- SAC: Interaction이 비싸고 경험 재사용이 중요한 조건

**주요 부담**

- PPO: Policy가 바뀔 때마다 새 rollout이 계속 필요
- SAC: Replay distribution, Q-function, target 안정성 관리

PPO도 stochastic Policy를 사용할 수 있고 entropy bonus를 자주 넣습니다. 따라서 차이를 "PPO는 탐색하지 않고 SAC만 탐색한다"로 이해하면 안 됩니다. 본질적인 차이는 **현재 Policy의 rollout을 중심으로 학습하는가**, 아니면 **Replay buffer의 off-policy transition으로 soft Q-learning을 하는가**입니다.

데이터 흐름을 나란히 놓으면 차이가 더 선명합니다.

```text
PPO
parallel rollout 수집
-> reward와 value로 advantage 계산
-> 같은 rollout에서 clipped objective를 여러 epoch 최적화
-> 다음 Policy의 새 rollout로 교체
```

```text
SAC
transition을 replay buffer에 계속 저장
-> 과거와 최근 경험이 섞인 mini-batch sampling
-> soft Bellman target으로 Twin Critic update
-> Critic과 entropy를 사용해 Actor update
-> target network를 천천히 갱신
```

대규모 simulator에서는 sample을 새로 만드는 비용이 상대적으로 작아 PPO의 제한된 데이터 재사용이 큰 문제가 아닐 수 있습니다. 반대로 실제 interaction이나 고비용 simulation에서는 같은 transition을 반복 사용하는 SAC의 sample efficiency가 중요해질 수 있습니다.

### **8.3 DIAYN은 왜 PPO가 아니라 SAC를 선택했는가?**

첫 번째 이유는 DIAYN의 목적함수와 maximum-entropy SAC가 직접 연결되기 때문입니다.

$$
\mathcal{F}(\theta)
=
H(Z)
-
H(Z\mid S)
+
H(A\mid S,Z)
$$

마지막 항은 skill $z$와 state $s$가 주어졌을 때도 Policy가 action entropy를 유지하라는 뜻입니다.

$$
H(A\mid S,Z)
=
\mathbb{E}_{s,z}
\left[
\mathcal{H}\bigl(\pi_\theta(\cdot\mid s,z)\bigr)
\right]
$$

SAC의 state를 $(s,z)$로 확장하면 SAC가 원래 최적화하던 Policy entropy가 바로 $H(A\mid S,Z)$에 대응합니다. DIAYN이 필요로 하는 행동 엔트로피를 별도의 알고리즘으로 새로 만들 필요가 없습니다.

두 번째 이유는 Discriminator reward를 일반적인 scalar reward처럼 SAC에 전달할 수 있기 때문입니다.

$$
r_{\text{DIAYN}}(s,z)
=
\log q_\phi(z\mid s)
-
\log p(z)
$$

SAC는 이 값이 task reward인지, 사람이 설계한 reward인지, Discriminator가 만든 intrinsic reward인지 구분하지 않습니다. Critic은 주어진 reward의 discounted return을 학습하고 Actor는 그 Q-value를 높이는 action distribution을 학습합니다.

세 번째로 SAC를 사용할 때 얻는 실용적 이점은 Replay buffer에서 여러 skill의 transition을 재사용할 수 있다는 점입니다. 이것은 $H(A\mid S,Z)$에서 직접 강제되는 이유라기보다 off-policy 구현이 주는 장점입니다.

```text
z=1 transition
z=2 transition
z=3 transition
...
-> 하나의 replay buffer
-> [s, z, a, s'] batch
-> skill-conditioned Critic과 Policy 학습
```

DIAYN은 연속 제어 benchmark에서 많은 skill을 동시에 학습합니다. Off-policy SAC는 각 skill이 만든 경험을 버리지 않고 다시 사용할 수 있습니다.

그렇다고 DIAYN을 PPO로 구현할 수 없다는 뜻은 아닙니다.

```text
PPO 기반 DIAYN
-> rollout 동안 z 고정
-> Discriminator reward를 rollout에 기록
-> intrinsic reward로 advantage와 return 계산
-> PPO clipped update + entropy bonus
```

이 구조도 가능하지만 원 논문의 구현과는 다릅니다. Replay buffer를 사용하지 않으므로 Discriminator와 Policy는 현재 rollout을 중심으로 학습하며, maximum-entropy 목적도 SAC와 같은 soft Bellman 구조가 아니라 PPO objective의 entropy regularization으로 들어갑니다.

> **DIAYN이 SAC를 선택한 이유는 SAC가 PPO보다 항상 우수해서가 아닙니다. DIAYN의 $H(A\mid S,Z)$ 항과 maximum-entropy SAC가 자연스럽게 맞고, 여러 skill의 연속 제어 경험을 off-policy replay로 재사용할 수 있기 때문입니다.**

실제 초기 SAC의 Value, Q, Policy update가 DIAYN reward와 연결되는 코드는 [DIAYN PyTorch 구현 흐름](/posts/diayn-pytorch-code-walkthrough/)에서 이어서 확인할 수 있습니다.

## **9. Actor, Critic, Discriminator는 무엇이 다른가?**

세 network가 모두 무언가를 "평가"하는 것처럼 보여 헷갈리기 쉽습니다.

| 구성 | 입력 | 출력 | 역할 |
|---|---|---|---|
| Actor $\pi_\theta$ | $s,z$ | Action distribution | 행동 선택 |
| Critic $Q_\psi$ | $s,a,z$ | Expected return | 장기 보상 평가 |
| Discriminator $q_\phi$ | $f(s)$ | Skill probability | Skill 분류 |

Discriminator는 현재 상태에서 한 step의 reward를 만듭니다. Critic은 그 reward의 장기 누적값을 학습합니다. Actor는 critic이 높게 평가하는 action을 선택합니다.

$$
q_\phi(z\mid s)
\longrightarrow
r_t
\longrightarrow
Q_\psi(s,a,z)
\longrightarrow
\pi_\theta(a\mid s,z)
$$

### **9.1 Discriminator가 현재 state만 보는데 장기 skill이 가능한 이유**

좁은 복도에서는 모든 skill이 같은 상태를 지나야 하고, 복도를 나온 뒤에야 서로 다른 방으로 갈 수 있다고 해보겠습니다.

복도 안에서는 discriminator reward가 낮습니다. 하지만 critic은 discounted return을 봅니다.

$$
Q(s_t,a_t,z)
=
\mathbb{E}
\left[
\sum_{k=0}^{\infty}
\gamma^k r(s_{t+k},z)
\right]
$$

현재 reward가 낮아도 나중에 skill을 확실히 구별할 수 있는 상태에 도달한다면 그 행동의 $Q$ 값은 높아질 수 있습니다. 논문의 hallway 실험이 이 점을 보여줍니다. Single-state discriminator가 있다고 해서 모든 시점의 상태 집합이 완전히 분리되어야 하는 것은 아닙니다.

### **9.2 Actor가 discriminator까지 직접 미분하는가?**

일반적인 model-free DIAYN에서는 그렇지 않습니다.

```text
Actor
-> non-differentiable environment transition
-> next state
-> Discriminator
```

이 전체 경로로 gradient를 보내는 것이 아닙니다. Discriminator 출력은 scalar reward가 되고, critic이 return을 학습하며, actor는 critic을 통해 간접적으로 업데이트됩니다.

Discriminator는 별도의 classification loss로 업데이트합니다. 구현 시 critic loss가 discriminator parameter까지 의도치 않게 흘러가지 않도록 reward 계산 경계를 명확히 해야 합니다.

## **10. 일반 SAC와 DIAYN의 구현 차이**

앞 절에서는 SAC 자체와 PPO의 차이를 설명했습니다. 이제 SAC를 기준으로 일반 task 학습과 DIAYN 구현이 정확히 어디서 달라지는지 비교하겠습니다.

DIAYN은 완전히 새로운 policy optimizer라기보다 **SAC의 조건 변수와 reward source를 바꾼 구조**입니다.

| 구성 | 일반 task SAC | DIAYN |
|---|---|---|
| Actor | $\pi(a\mid s)$ 또는 $\pi(a\mid s,c)$ | $\pi(a\mid s,z)$ |
| Critic | $Q(s,a)$ | $Q(s,a,z)$ |
| Reward | Task reward | Discriminator reward |
| 추가 network | 없음 | $q_\phi(z\mid f(s))$ |
| Condition | 목표 command $c$ | Latent skill $z$ |
| Sampling | Task가 command 제공 | Episode마다 uniform $z$ |
| 추가 loss | 없음 | discriminator cross-entropy |
| 목표 | Task 성능 | 구별되는 state distribution |

논문의 초기 SAC 구현은 Q function, value function, policy에 모두 $z$를 현재 state와 concatenate했습니다. 기본 SAC 설정에서 hidden unit 수를 128에서 300으로 늘렸는데, 저자들은 많은 skill을 표현하려면 더 큰 model capacity가 필요했다고 설명합니다.

> 내가 헷갈렸던 지점: "결국 reward만 바꾸고 discriminator 하나 추가한 것 아닌가?"
>
> 코드 변경만 보면 맞습니다. 하지만 학습 dynamics는 훨씬 크게 바뀝니다. Policy가 state distribution을 바꾸고, 그 state로 discriminator가 바뀌고, discriminator가 다시 reward와 critic target을 바꿉니다. **정책과 reward model이 함께 변하는 coupled learning system**입니다.

### **10.1 SAC 관점에서는 state가 $(s,z)$로 확장된다**

에피소드 안에서 $z$가 고정되므로 SAC가 보는 문제는 다음 확장 상태를 가진 MDP처럼 생각할 수 있습니다.

$$
\tilde{s}_t=(s_t,z)
$$

전이는 다음과 같습니다.

$$
(s_t,z)
\xrightarrow{a_t}
(s_{t+1},z)
$$

물리적인 state와 action이 같아도 $z$에 따라 reward와 future return이 다를 수 있습니다. 그래서 actor뿐 아니라 critic에도 $z$가 반드시 들어가야 합니다.

```text
같은 오른쪽 이동 action

z = 오른쪽 상태를 만드는 skill
-> 높은 future intrinsic return

z = 왼쪽 상태를 만드는 skill
-> 낮은 future intrinsic return
```

### **10.2 Replay data는 여러 policy의 mixture다**

DIAYN의 전체 state-skill 분포는 하나의 policy visitation distribution이 아닙니다.

$$
p(s,z)
=
p(z)d_{\pi_z}(s)
$$

$d_{\pi_z}(s)$는 skill $z$의 state visitation distribution입니다. Replay buffer에는 모든 skill의 transition이 섞여 있고, discriminator는 이 mixture에서 각 sample의 label을 구별합니다.

Uniform prior는 이 mixture의 label balance를 유지합니다. 동시에 skill 수 $K$가 커질수록 skill 하나가 받는 데이터는 대략 $1/K$로 줄어듭니다. 따라서 $K$는 단순히 크게 설정할 수 있는 숫자가 아니라 data budget, network capacity, discriminator difficulty와 함께 결정해야 합니다.

## **11. VIC와 DIAYN의 차이**

DIAYN과 가장 가까운 선행 연구 중 하나가 **Variational Intrinsic Control, VIC**입니다.

VIC는 시작 상태 $s_0$에서 option $\Omega$를 선택하고, option 실행 뒤의 final state $s_f$를 보고 어떤 option이었는지 맞히도록 학습합니다.

$$
I(\Omega;S_f\mid S_0)
$$

대표적인 intrinsic reward 형태는 다음과 같습니다.

$$
r_I
=
\log q(\Omega\mid s_0,s_f)
-\log p_C(\Omega\mid s_0)
$$

DIAYN 논문이 강조한 차이는 세 가지입니다.

| 구분 | VIC 계열 | DIAYN |
|---|---|---|
| Skill prior | 학습 | uniform으로 고정 |
| Discriminator 입력 | 주로 final state | 매 step의 state |
| Policy entropy | 낮거나 별도 핵심이 아님 | maximum-entropy policy를 목적에 포함 |

![Effective number of skills when learning the prior](/assets/img/posts/rl/diayn/diayn-fixed-prior-vic.png)
_학습되는 prior는 일부 skill에 sampling mass가 몰리며 effective skill 수를 줄였다. 출처: [Eysenbach et al., Figure 4](https://arxiv.org/abs/1802.06070)._

논문은 effective number of skills를 다음처럼 측정합니다.

$$
N_{\mathrm{eff}}
=
e^{H(Z)}
$$

Appendix의 HalfCheetah, Inverted Pendulum, Mountain Car 비교에서는 $p(z)$를 학습할 때 effective skill 수가 약 10배까지 줄어드는 결과를 보고합니다.

다만 정확한 독해가 필요합니다. DIAYN 논문의 VIC 비교 구현은 DIAYN에서 $p(z)$를 학습하도록 바꾼 형태를 중심으로 분석합니다. VIC 원 논문의 모든 구조와 현대적인 재구현을 포괄적으로 비교한 결과라고 일반화하면 안 됩니다.

## **12. 논문에서 실제로 발견한 skill**

![Locomotion skills discovered without task reward](/assets/img/posts/rl/diayn/diayn-locomotion-skills.png)
_외부 task reward 없이 발견한 HalfCheetah, Ant, Hopper의 움직임. 출처: [Eysenbach et al., Figure 3](https://arxiv.org/abs/1802.06070)._

논문은 2D point navigation부터 111-DOF observation을 쓰는 Ant까지 적용합니다.

| 환경 | 발견한 행동 예시 |
|---|---|
| 2D Navigation | 서로 다른 방향과 영역으로 이동 |
| Inverted Pendulum | 서로 다른 위치에서 균형, 왕복 진동 |
| Mountain Car | 서로 다른 timing과 velocity로 정상 도달 |
| HalfCheetah | 앞뒤 달리기, 다양한 속도, flip, 넘어지기 |
| Hopper | 균형, 앞뒤 hopping, diving |
| Ant | 여러 방향 이동, 곡선 궤적, jump, 제자리 회전 |

여기서 결과를 과장하지 않는 것이 중요합니다.

- HalfCheetah와 Hopper에서는 task reward를 보지 않고도 benchmark task에서 높은 점수를 받는 skill 일부가 생겼습니다.
- Ant는 여러 방향으로 움직였지만, 논문은 **직선으로 전진하는 skill은 없었다**고 명시합니다.
- Flip, face flop, 즉시 넘어지기처럼 task 관점에서는 쓸모없거나 위험한 행동도 diversity의 일부로 학습됩니다.

즉 Figure 3은 "DIAYN이 유용한 locomotion만 발견했다"는 그림이 아닙니다.

> Reward가 없는데도 물리적으로 다양한 behavior mode가 생겼다는 증거이면서, 동시에 diversity만으로 quality를 보장할 수 없다는 증거입니다.

## **13. Downstream task에는 어떻게 사용하는가?**

### **13.1 Policy initialization**

Unsupervised pretraining 후 각 benchmark의 true reward를 평가해 가장 좋은 skill을 고르고, actor와 critic weight를 task-specific reward로 fine-tuning합니다.

![Policy initialization results](/assets/img/posts/rl/diayn/diayn-policy-initialization.png)
_DIAYN pretraining으로 초기화한 policy와 random initialization의 fine-tuning 비교. 출처: [Eysenbach et al., Figure 5](https://arxiv.org/abs/1802.06070)._

HalfCheetah, Hopper, Ant 모두 DIAYN initialization이 초기 학습을 빠르게 했습니다. 그러나 그래프 해석에는 조건이 있습니다.

> 저자들은 unsupervised pretraining 비용이 무료이거나 여러 downstream task에 amortize된다고 가정하고, 해당 step을 그래프에서 제외했습니다.

따라서 이 그림은 **전체 계산량이 항상 줄었다**는 증거가 아니라, pretraining 이후의 task-specific adaptation이 빨라졌다는 증거입니다.

### **13.2 Hierarchical RL**

Low-level skill을 고정하고, meta-controller가 몇 step 동안 실행할 $z$를 선택합니다.

$$
\pi_{\mathrm{high}}(z\mid s)
\quad\longrightarrow\quad
\pi_{\mathrm{low}}(a\mid s,z)
$$

논문에서는 Ant navigation에서 선택한 skill을 100 step, Cheetah hurdle에서는 10 step 동안 실행합니다. 복잡한 action sequence를 직접 만들지 않고 skill index를 고르는 문제로 바꾸는 것입니다.

![Hierarchical RL results with DIAYN skills](/assets/img/posts/rl/diayn/diayn-hierarchical-rl.png)
_Cheetah hurdle과 sparse-reward Ant navigation 결과. 출처: [Eysenbach et al., Figure 7](https://arxiv.org/abs/1802.06070)._

Cheetah hurdle에서는 DIAYN skill 조합이 강한 결과를 보입니다. Ant navigation은 더 미묘합니다. Discriminator가 center of mass에 집중하도록 $f(s)$를 지정한 **DIAYN+prior**가 큰 성능 향상을 만들고, 순수 DIAYN은 같은 수준에 도달하지 못합니다.

이 결과는 중요한 사실을 보여줍니다.

> 어떤 state feature로 skill을 구별하게 할지가 downstream usefulness를 크게 결정한다.

### **13.3 Imitation without expert actions**

Expert state trajectory $\tau^*=\{s_i\}$만 주어졌을 때 discriminator로 가장 그럴듯한 skill을 찾습니다.

$$
\hat z
=
\arg\max_z
\prod_{s_t\in\tau^*}
q_\phi(z\mid s_t)
$$

이 방법은 action label 없이 기존 skill repertoire에서 expert와 가장 가까운 feedback controller를 찾습니다. HalfCheetah의 upright, flip, faceplant는 모방했지만 handstand는 실패했습니다.

즉 새로운 행동을 생성하는 범용 imitation이라기보다, **이미 발견한 skill 중 expert trajectory를 가장 잘 설명하는 것을 검색하는 방식**입니다.

## **14. 이 논문의 강점**

### **14.1 Behavior distance를 직접 설계하지 않는다**

Novelty search처럼 행동 간 거리를 사람이 정의하는 대신, state에서 skill을 분류하는 문제로 바꿉니다. 고차원 연속제어에도 적용하기 쉬운 형태입니다.

### **14.2 하나의 간단한 목적함수로 여러 용도를 연결한다**

같은 skill repertoire와 discriminator를 pretraining, hierarchical control, imitation에 재사용합니다. Skill discovery를 단순한 시각화 실험이 아니라 downstream task의 구성 요소로 연결한 점이 큽니다.

### **14.3 Adversarial game이 아니라 cooperative game이다**

Discriminator는 skill을 더 잘 맞히려 하고, policy도 discriminator가 더 잘 맞힐 상태를 만듭니다. 서로 반대 목적을 갖는 GAN식 saddle-point game보다 목표 방향이 일치합니다.

### **14.4 Fixed prior라는 단순한 선택이 collapse를 줄인다**

학습 가능한 prior가 이론적으로 더 유연해 보이지만, 실전에서는 초기 우연이 sampling imbalance로 증폭될 수 있습니다. Uniform prior는 모든 skill에 지속적인 학습 기회를 보장합니다.

## **15. 한계와 비판적으로 읽을 지점**

### **15.1 Diversity는 quality가 아니다**

DIAYN critic이 높게 평가하는 것은 안정성이나 효율이 아닙니다.

> "이 행동이 앞으로 얼마나 이 skill답고 다른 skill과 구별되는 상태를 만드는가?"

넘어지기, 뒤집기, 센서 포화 상태처럼 구별하기 쉬운 결과도 높은 intrinsic return을 만들 수 있습니다.

### **15.2 Discriminator feature가 사실상 behavior specification이다**

$q_\phi(z\mid f(s))$에서 $f(s)$를 어떻게 선택하는지가 중요합니다.

- Center of mass를 주면 이동 방향 skill을 만들기 쉽습니다.
- Joint angle 전체를 주면 자세나 미세한 관절 차이에 집중할 수 있습니다.
- Episode time, reset artifact, skill ID가 누출되면 행동을 바꾸지 않고도 분류할 수 있습니다.
- Simulator-only privileged state를 주면 real robot에서 의미 없는 skill이 생길 수 있습니다.

따라서 "reward engineering이 사라졌다"기보다, 일부 설계 부담이 **discriminator observation engineering**으로 이동했다고 보는 편이 정확합니다.

### **15.3 Skill 수 $K$를 늘리는 데 비용이 따른다**

Uniform prior에서는 skill당 데이터 비율이 대략 $1/K$입니다. $K$를 늘리면 이론적 mutual information 상한 $\log K$는 커지지만, 각 skill이 받는 sample은 줄고 network capacity 요구는 커집니다.

Skill 수가 많다고 자동으로 더 많은 의미 있는 behavior가 생기는 것은 아닙니다. 서로 거의 같은 skill이 여러 label로 나뉠 수도 있습니다.

### **15.4 Reward와 critic target이 함께 움직인다**

Policy, state distribution, discriminator, reward, critic이 강하게 결합되어 있습니다. Discriminator가 너무 약하면 reward가 거의 0이고, 너무 강하면 사소한 nuisance feature를 암기할 수 있습니다.

Learning rate, update ratio, normalization, capacity가 결과에 직접 영향을 줍니다. 원 논문의 "cooperative game"이라는 설명이 function approximation에서 자동 안정성을 보장하는 것은 아닙니다.

### **15.5 실험은 simulated benchmark 중심이다**

논문은 당시의 MuJoCo/Gym benchmark에서 실험했으며 real robot 결과는 없습니다. Contact uncertainty, actuator limit, latency, sensor noise, perception error, hardware safety가 포함된 실제 로봇 검증으로 읽으면 안 됩니다.

### **15.6 Downstream 결과의 비용과 supervision을 구분해야 한다**

- Policy initialization 그래프는 unsupervised pretraining 비용을 제외합니다.
- 가장 좋은 skill 선택에는 downstream reward 평가가 필요합니다.
- Ant navigation의 강한 결과는 center-of-mass feature라는 task-relevant prior를 사용합니다.

따라서 "완전한 무감독 학습만으로 모든 downstream task를 해결했다"는 결론은 과합니다.

## **16. 로봇에 적용한다면 무엇이 달라져야 하는가?**

DIAYN의 수학적 구조는 특정 로봇 형태에 묶여 있지 않습니다.

$$
\pi_\theta(a\mid s,z),
\qquad
q_\phi(z\mid f(s)),
\qquad
r=\log q_\phi(z\mid f(s))-\log p(z)
$$

다족보행 로봇, 휴머노이드, 바퀴형 이동로봇, 매니퓰레이터, 드론 모두 같은 구조를 사용할 수 있습니다. 달라지는 것은 $s$, $a$, $f(s)$가 실제로 무엇을 뜻하는지와 어떤 행동을 허용할지입니다.

> **DIAYN 자체는 embodiment-agnostic이지만, 발견되는 skill의 의미와 안전성은 embodiment와 observation 설계에 강하게 의존합니다.**

### **16.1 공통으로 유지되는 학습 구조**

원 논문은 maximum-entropy off-policy 알고리즘인 SAC를 사용했습니다. 그러나 핵심 구조는 다른 Actor-Critic 알고리즘에도 옮길 수 있습니다.

```text
Skill 시작
-> z ~ Uniform({1, ..., K})

Policy / Critic 입력
-> physical state s + one_hot(z)

Discriminator 입력
-> 선택한 physical feature f(s)
-> z는 절대 포함하지 않음

Intrinsic reward
-> log q(z | f(s')) - log p(z)

Update
-> intrinsic reward로 Actor-Critic update
-> (f(s), z)로 Discriminator classification update
```

SAC라면 replay buffer에서 과거 transition을 재사용하고, PPO라면 현재 rollout 안에 `z`, `skill_obs`, intrinsic reward를 함께 저장합니다. 강화학습 알고리즘은 달라질 수 있지만 다음 조건은 유지되어야 합니다.

1. Actor와 Critic은 현재 skill $z$를 알아야 합니다.
2. Discriminator는 $z$를 입력으로 받지 않고 physical state에서 추측해야 합니다.
3. 하나의 skill 구간에서는 같은 $z$가 유지되어야 합니다.
4. Discriminator loss와 RL loss의 gradient 경계가 분리되어야 합니다.

원 논문은 episode 시작에 $z$를 뽑아 종료까지 유지합니다. 실제 로봇에서는 episode가 매우 길거나 명확한 reset이 없을 수 있으므로, 일정한 **skill horizon**을 정의해 구간마다 $z$를 바꾸는 설계도 가능합니다. 다만 매 control step마다 $z$를 바꾸면 하나의 skill이 일관된 상태분포를 만드는 원래 목적과 달라집니다.

### **16.2 로봇 종류에 따라 달라지는 $s$, $a$, $f(s)$**

같은 DIAYN이라도 로봇의 상태와 행동 공간이 다르면 발견되는 skill도 달라집니다.

**다족보행·휴머노이드**

- Policy state: 관절각, 관절속도, 몸통 자세, 접촉
- Action: joint target 또는 torque
- Discriminator feature: base velocity, heading, contact pattern, end-effector 궤적

**바퀴형 이동로봇**

- Policy state: odometry, velocity, LiDAR·vision feature
- Action: linear·angular velocity 또는 wheel command
- Discriminator feature: 이동 방향, 경로 형태, 도달 영역, map coverage

**매니퓰레이터**

- Policy state: joint state, end-effector pose, object state
- Action: joint position, velocity 또는 torque
- Discriminator feature: end-effector 궤적, object pose, grasp·contact mode

**드론**

- Policy state: attitude, body rate, velocity, altitude
- Action: thrust 또는 body-rate command
- Discriminator feature: 비행 방향, 고도 변화, trajectory shape, 공간 coverage

여기서 $f(s)$는 단순한 classifier 입력이 아니라 **무엇을 다른 행동으로 간주할지 정하는 behavior specification**입니다.

- 이동 위치와 속도를 주면 서로 다른 이동 방향이나 경로가 만들어지기 쉽습니다.
- 접촉과 end-effector pose를 주면 grasp나 manipulation mode가 나뉘기 쉽습니다.
- 모든 joint state를 그대로 주면 사람이 보기 어려운 미세 자세 차이에 skill label이 할당될 수 있습니다.
- 센서 bias, episode time, reset artifact를 주면 실제 행동이 아니라 nuisance feature로 skill을 구별할 수 있습니다.

따라서 로봇 종류만 바꾸고 같은 $f(s)$를 기계적으로 재사용하면 안 됩니다. 원하는 skill이 task-space behavior인지, 자세 diversity인지, 탐색 coverage인지 먼저 정해야 합니다.

### **16.3 실제 로봇에서는 pure DIAYN이 위험할 수 있다**

DIAYN은 유용성이나 안전성이 아니라 구별 가능성을 보상합니다. 로봇 종류에 따라 다음과 같은 행동도 쉽게 구별되는 skill이 될 수 있습니다.

- 다족보행·휴머노이드: 넘어짐, 과도한 충격, 불안정한 진동
- 이동로봇: 벽이나 장애물에 반복적으로 충돌, 제자리 고속 회전
- 매니퓰레이터: self-collision, joint limit 고착, 물체를 작업공간 밖으로 밀기
- 드론: 급격한 자세 변화, geofence 이탈, 위험한 고도 접근
- 공통: actuator saturation, 큰 action-rate, 과도한 전류·에너지·열 발생

실제 시스템에서는 최소한 다음 안전 계층을 함께 고려해야 합니다.

- **Hard state/action limit**: joint, velocity, torque, thrust, workspace 범위를 제한합니다.
- **Collision·fall·geofence constraint**: 로봇과 주변 환경의 물리적 손상을 방지합니다.
- **Safety controller 또는 action filter**: 학습 Policy의 위험한 명령을 실행 전에 차단합니다.
- **Termination과 safe reset**: 위험 상태에서 episode를 중단하고 복구합니다.
- **Energy·smoothness regularization**: 고주파 진동, 급격한 명령, hardware wear를 억제합니다.
- **Domain randomization과 sensor noise**: simulator artifact나 특정 sensor bias가 skill identity가 되는 것을 줄입니다.

여기서는 hard constraint와 auxiliary reward를 구분해야 합니다.

- **Hard constraint / safety shield**는 가능한 행동 집합을 제한합니다.
- **Energy·smoothness penalty**는 최적화 목적함수 자체를 바꿉니다.

후자를 추가하면 논문 그대로의 pure reward-free DIAYN은 아니지만, 여전히 **task reward 없이 skill을 발견한다**는 목적은 유지할 수 있습니다. 실제 로봇에서는 방법의 순수성보다 안전하고 재사용 가능한 repertoire를 얻는 것이 더 중요합니다.

### **16.4 Discriminator feature는 로봇 간 범용성을 결정한다**

Simulator의 privileged state를 그대로 사용하면 real robot에서 관측할 수 없는 feature에 skill이 의존할 수 있습니다. 반대로 raw sensor 전체를 넣으면 배경, 조명, sensor drift처럼 행동과 무관한 정보로 분류할 수 있습니다.

범용적인 로봇 skill을 원한다면 다음 기준이 필요합니다.

1. **관측 가능성**: 배포 시 실제 sensor로 얻을 수 있는 feature인가?
2. **행동 관련성**: 로봇의 motion이나 interaction 결과를 나타내는가?
3. **불변성**: 배경, sensor ID, reset seed 같은 nuisance variable에 과도하게 민감하지 않은가?
4. **좌표계 선택**: world-frame 위치가 필요한지, body/object-relative feature가 필요한지 명확한가?
5. **Downstream 관련성**: 나중에 선택하거나 조합할 가치가 있는 차이를 표현하는가?

예를 들어 object manipulation skill을 원한다면 joint angle만 분류하는 것보다 object-relative end-effector pose와 contact state를 사용하는 편이 목적에 가깝습니다. 장소에 무관한 이동 skill을 원한다면 절대 world position보다 body-frame velocity와 local trajectory feature가 더 적합할 수 있습니다.

### **16.5 Real-world data 비용과 reset 문제**

Simulation에서는 수백만 transition과 실패 reset이 비교적 저렴하지만 실제 로봇에서는 그렇지 않습니다.

- 위험한 탐색이 hardware 손상과 운영 중단으로 이어질 수 있습니다.
- 자동 reset이 어려우면 특정 실패 상태의 데이터가 과도하게 쌓일 수 있습니다.
- Battery, temperature, payload, floor condition 변화가 Discriminator의 shortcut이 될 수 있습니다.
- Skill 수 $K$가 커질수록 skill당 실제 데이터가 줄어듭니다.

따라서 실제 적용은 보통 다음과 같은 단계적 구성이 더 현실적입니다.

```text
Simulation 또는 offline data에서 skill pretraining
-> sensor와 dynamics randomization
-> 안전 제약 안에서 real-world adaptation
-> skill quality와 redundancy 평가
-> downstream selection / hierarchy / fine-tuning
```

이 과정에서 simulation에서만 분리되던 skill이 실제 sensor에서는 겹칠 수 있고, 반대로 hardware의 미세 편차가 새로운 shortcut을 만들 수도 있습니다. 그래서 real-world adaptation에서는 diversity 점수뿐 아니라 안전성, 재현성, 에너지, task usefulness를 함께 측정해야 합니다.

### **16.6 가장 먼저 확인할 구현 오류**

로봇 형태와 관계없이 Actor input에는 $z$가 들어가지만 Discriminator input에는 절대 들어가면 안 됩니다.

```python
# Correct
actor_obs = torch.cat([robot_obs, one_hot_z], dim=-1)
disc_obs = select_behavior_features(robot_state)

# Wrong: label leakage
disc_obs = torch.cat([robot_obs, one_hot_z], dim=-1)
```

Label leakage가 생기면 Discriminator accuracy와 intrinsic reward는 매우 높아지지만 Policy는 서로 다른 행동을 만들 필요가 없습니다. Vectorized environment나 여러 로봇에서 병렬 수집할 때는 각 environment의 reset 시점과 `z` 갱신도 따로 관리해야 합니다.

## **17. 구현 체크리스트**

| 점검 항목 | 확인할 내용 |
|---|---|
| Skill sampling | environment reset 때 uniform sampling되는가? |
| Skill persistence | episode 중 같은 $z$가 유지되는가? |
| Actor condition | actor observation에 $z$가 들어가는가? |
| Critic condition | value/critic도 $z$를 알고 있는가? |
| Label leakage | discriminator observation에서 $z$가 완전히 제외되는가? |
| Reward state | $s_t$와 $s_{t+1}$ 중 무엇을 쓰는지 일관적인가? |
| Numerical stability | `log_softmax`와 `gather`를 사용하는가? |
| Gradient boundary | RL loss가 discriminator를 의도치 않게 업데이트하지 않는가? |
| Update balance | discriminator accuracy가 chance나 100%에 즉시 고정되지 않는가? |
| Per-skill coverage | 각 skill sample 수와 state coverage를 따로 기록하는가? |
| Safety | fall, limit, contact, actuator constraint가 있는가? |
| Evaluation | diversity뿐 아니라 stability, energy, usefulness도 따로 측정하는가? |

## **18. 최종 정리**

DIAYN의 핵심 연결을 다시 정리하면 다음과 같습니다.

```text
Uniform skill prior p(z)
-> 모든 skill에 학습 기회 보장

Skill-conditioned policy pi(a|s,z)
-> 하나의 network가 여러 behavior mode 표현

Discriminator q(z|s)
-> 현재 state에서 skill ID 예측

log q(z|s) - log p(z)
-> skill-specific state를 만드는 intrinsic reward

Maximum-entropy SAC
-> 각 skill 내부의 탐색 유지

Learned skill repertoire
-> selection, fine-tuning, hierarchy, imitation에 재사용
```

이 논문에서 가장 중요한 통찰은 "보상이 없어도 다양하게 움직일 수 있다"는 결과만이 아닙니다.

> **Skill discovery를 상태와 latent variable 사이의 정보량을 최대화하는 문제로 바꾸면, 분류기가 reward를 만들고 기존 maximum-entropy RL이 그 reward를 최적화할 수 있다.**

동시에 가장 중요한 한계도 같은 곳에서 나옵니다.

> **분류하기 쉬운 차이가 반드시 유용하고 안전한 차이는 아니다.**

그래서 DIAYN은 완성된 robot control solution이라기보다, task reward 이전에 behavior repertoire를 만드는 강력한 출발점으로 보는 것이 정확합니다. 실제 로봇에 적용할 때는 어떤 state feature를 다양화할지, 어떤 행동을 금지할지, 발견한 skill의 quality를 어떻게 평가할지가 다음 문제입니다.

## **참고 자료**

- [Diversity Is All You Need: Learning Skills without a Reward Function](https://arxiv.org/abs/1802.06070)
- [ICLR 2019 OpenReview](https://openreview.net/forum?id=SJx63jRqFm)
- [Official DIAYN project videos](https://sites.google.com/view/diayn/)
- [Official DIAYN implementation note](https://github.com/ben-eysenbach/sac/blob/master/DIAYN.md)
- [Variational Intrinsic Control](https://arxiv.org/abs/1611.07507)
- [Soft Actor-Critic](https://arxiv.org/abs/1801.01290)
- [Soft Actor-Critic Algorithms and Applications](https://arxiv.org/abs/1812.05905)
- [Proximal Policy Optimization Algorithms](https://arxiv.org/abs/1707.06347)
