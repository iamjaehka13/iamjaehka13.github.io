---
title: "6. Policy Gradient DRL"
date: 2025-09-12 12:15:25 +0900
categories: [RL, Study]
tags: [reinforcement-learning, deep-reinforcement-learning, policy-gradient, ddpg, trpo, natural-policy-gradient, ppo]
description: DDPG, TRPO, Natural Policy Gradient, PPO의 핵심 아이디어와 발전 흐름을 정리한다.
math: true
---

## **1. DDPG (Deep Deterministic Policy Gradient)**

DDPG는 연속적인 행동 공간(continuous action spaces)을 처리하기 위해 DQN의 장점과 Policy Gradient의 장점을 결합한 **Actor-Critic** 알고리즘입니다.

**1. DDPG가 해결하려는 문제**

- **DQN의 한계:** DQN은 이미지와 같은 고차원 상태 공간은 잘 처리하지만, 행동 공간이 연속적일 때는 사용할 수 없습니다. 이를 해결하기 위해 행동 공간을 잘게 나누는 이산화(discretization)를 시도할 수 있지만, 이는 차원의 저주(curse of dimensionality)를 초래하고 행동 공간의 구조적 정보를 손실시키는 단점이 있습니다.
- **기존 Policy Gradient의 한계:** 일반적인 Policy Gradient 알고리즘은 **확률적 정책(stochastic policy)** $\pi(a \mid s)$를 학습합니다. 이는 학습 과정에서 많은 샘플이 필요하고 분산이 크다는 단점이 있습니다.

**2. DDPG의 핵심 아이디어**

- **결정적 정책(Deterministic Policy):** DDPG는 확률적인 정책 $\pi$ 대신 **결정적 정책(deterministic policy)** $a = \mu(s)$를 학습합니다. 즉, 주어진 상태 $s$에 대해 에이전트는 하나의 행동 $a$를 결정적으로 선택합니다.
- **Actor-Critic 구조:** DDPG는 Policy Gradient의 Actor-Critic 구조를 따릅니다.
- **Actor:** 결정적 정책 $\mu(s; \theta)$를 학습하여 최적의 행동을 직접 출력합니다.
- **Critic:** 행동 가치 함수 $Q(s,a; \phi)$를 학습하여 Actor의 행동을 평가합니다.
- **DQN의 요소 도입:** DDPG는 DQN의 성공적인 기술인 Experience Replay와 Target Network를 그대로 사용합니다. 이는 학습의 안정성을 높여줍니다.

### **1.1 DDPG의 작동 방식 및 알고리즘**

DDPG는 다음의 네 가지 핵심 구성 요소를 가집니다.

1. **Actor Network:** $\mu(s; \theta)$, 상태 $s$를 입력으로 받아 결정적 행동 $a$를 출력합니다.
2. **Critic Network:** $Q(s, a; \phi)$, 상태 $s$와 행동 $a$를 입력으로 받아 해당 행동의 Q-value $Q(s,a)$를 출력합니다.
3. **Target Actor Network:** $\hat{\mu}(s; \hat{\theta})$, Actor 네트워크와 동일한 구조를 가지며, 일정 주기로 Actor 네트워크의 파라미터를 복사하여 업데이트됩니다.
4. **Target Critic Network:** $\hat{Q}(s,a; \hat{\phi})$, Critic 네트워크와 동일한 구조를 가지며, 일정 주기로 Critic 네트워크의 파라미터를 복사하여 업데이트됩니다.

**업데이트 과정**

1. **행동 선택 및 탐색:** Actor 네트워크 $\mu$는 현재 상태 $s_t$에 대한 행동 $a_t$를 결정적으로 출력합니다. 하지만 탐험(exploration)을 위해 이 행동에 노이즈 $N_t$를 더해 최종 행동을 결정합니다. 즉, $a_t = \mu(s_t;\theta) + N_t$입니다.
2. **경험 저장:** 에이전트가 $a_t$를 실행하고 얻은 경험 $(s_t, a_t, r_{t+1}, s_{t+1})$을 경험 재생 버퍼에 저장합니다.
3. **미니배치 샘플링:** 버퍼에서 미니배치를 무작위로 샘플링합니다.
4. **Critic 네트워크 업데이트:** 샘플링된 다음 상태 $s_{i+1}$에 대해, Target Actor Network $\hat{\mu}$가 다음 행동을 선택하고 Target Critic Network $\hat{Q}$가 그 가치를 평가합니다. 이 타겟 Q-value와 현재 Critic 네트워크가 예측한 Q-value의 차이를 최소화하는 방향으로 Critic을 업데이트합니다.
5. **Actor 네트워크 업데이트:** 결정적 정책 경사 정리를 사용하여 Actor를 업데이트합니다. 업데이트 규칙은 Critic이 행동에 부여한 Q-value를 증가시키는 방향으로 Actor의 정책 파라미터를 변경하는 것입니다. 즉, Critic의 행동 기울기 $\nabla_a Q$와 Actor의 정책 기울기 $\nabla_\theta \mu$를 곱하여 Actor의 파라미터를 업데이트합니다.
6. **타겟 네트워크 업데이트:** 학습의 안정성을 위해 타겟 네트워크들을 소프트 업데이트(soft update)합니다.

![DDPG algorithm](/assets/img/posts/rl-policy-gradient-drl/ddpg-algorithm.png)

### **1.2 DPG와 SPG의 차이**

| 특징 | 확률적 정책 경사 (Stochastic PG) | 결정적 정책 경사 (Deterministic PG) |
| --- | --- | --- |
| 정책 | $\pi(a \vert s)$ | $\mu_\theta(s)$ 또는 결정적 정책 |
| 기울기 업데이트 | $Q^\pi(s,a)\nabla_\theta \log \pi_\theta(a \vert s)$ | 상태에 대해 $\nabla_\theta \mu_\theta(s)\nabla_a Q^\mu(s,a)$를 계산 |
| 샘플링 | 상태-행동 쌍 $(s,a)$에서 샘플링 | 상태 $s$에서만 샘플링 |
| 장점 | 탐험(exploration)이 내재됨 | 더 적은 샘플로 기울기 추정 가능 |

결정적 정책 경사는 상태-행동 쌍이 아닌 상태 공간에 대해서만 기울기를 계산하므로, **샘플 효율성**이 더 높습니다. DDPG는 이 장점을 활용하여 연속적인 행동 공간 문제에 효과적으로 적용됩니다.

## **2. TRPO**

### **2.1 TRPO의 주요 개념**

TRPO는 정책 파라미터 $\theta$를 업데이트하여 기대 보상(expected return)을 최대화하는데, 이때 **정책 공간 내의 KL 다이버전스(Kullback-Leibler divergence) 제약 조건**을 적용하여 업데이트 범위를 제한합니다.

이 제약 조건은 정책 업데이트가 이전 정책과 너무 멀리 떨어지지 않도록 보장하며, 기대 보상의 단조로운 향상을 보장합니다. 따라서 TRPO는 DDPG와 달리 **학습률(stepsize)을 신중하게 선택할 필요가 없습니다.**

**2.1.1 DDPG의 문제점**

- DDPG를 사용할 때 가장 큰 문제는 **적절한 범위의 스텝 사이즈를 선택하는 방법**입니다.
- 스텝 사이즈가 너무 크면 노이즈에 압도되어 성능이 나빠지거나, 너무 작으면 학습 진행이 매우 느려지는 경향이 있습니다.
- 경사 상승법(gradient ascent)에서는 가장 가파른 방향을 정한 다음 앞으로 나아갑니다. 그러나 스텝 사이즈가 너무 크면 때로는 재앙적인 결과를 초래할 수 있습니다.

**2.1.2 TRPO의 해결책**

- TRPO(Trust Region Policy Optimization)는 **소수화-최대화(Minorization-Maximization) 알고리즘**과 **신뢰 영역(Trust Region)**이라는 두 가지 개념을 도입하여 DDPG에서 발생하는 문제점을 해결했습니다.
- TRPO는 정책 공간 내에서 KL 발산 제약을 만족하는 신뢰 영역 안에서 정책 파라미터 $\theta$를 업데이트하여 기댓값 반환(expected return)을 최대화합니다.
- 신뢰 영역 내에서의 정책 업데이트는 기댓값 반환의 **단조적 향상**을 보장하기 때문에, TRPO에서는 stepsize에 대해 걱정할 필요가 없습니다.
- 저자들은 이론적으로 정당화된 알고리즘을 실용적인 TRPO 알고리즘으로 만들기 위해 일련의 근사(approximations)를 적용했습니다.
- TRPO는 높은 성능을 달성했지만, 구현이 매우 복잡하고 딥 CNN이나 RNN을 사용하는 작업에는 많은 계산 비용이 필요하여 실용적이지는 않습니다.
- $\delta$에 의해 제어되는 신뢰 영역을 사용함으로써 탐색 범위를 그 영역 내로 제한합니다.
- 이론적으로 이러한 영역은 새로운 최적 정책이 이전 정책보다 성능이 우수함을 보장하며, 반복을 계속함으로써 결국 지역적 또는 전역적 최적점에 도달하게 됩니다.

### **2.2 DRL 목표**

강화학습(DRL)의 목표는 기댓값 반환 $\eta(\pi)$를 최대화하는 것입니다.

![DRL objective](/assets/img/posts/rl-policy-gradient-drl/drl-objective.png)

### **2.3 대안적 접근법**

새로운 정책 $\pi$의 성능 $\eta(\pi)$를 이전 정책 $\pi_{\text{old}}$의 성능 $\eta(\pi_{\text{old}})$과 어드밴티지 함수 $A^{\pi_{\text{old}}}$를 이용해 계산할 수 있습니다.

![Performance difference equation](/assets/img/posts/rl-policy-gradient-drl/performance-difference.png)

![State visitation frequency](/assets/img/posts/rl-policy-gradient-drl/state-visitation-frequency.png)

![Performance difference summary](/assets/img/posts/rl-policy-gradient-drl/performance-difference-summary.png)

- 정책 성능 $\eta$는 반드시 향상됩니다. 하지만 실제 근사 환경에서는 추정 및 근사 오차로 인해 이 값이 음수가 되는 상태가 존재할 수 있습니다.
- 또한 $\rho^\pi(s)$가 새로운 정책 $\pi$에 복잡하게 의존하기 때문에 위 식을 최적화하기 어렵습니다.

### **2.4 국소적 근사**

정책 업데이트로 인한 상태 방문 빈도의 변화를 무시하고 $\rho^\pi$ 대신 $\rho^{\pi_{\text{old}}}$를 사용하여 $\eta(\pi)$를 국소적으로 근사한 함수를 도입합니다.

![Local approximation for TRPO](/assets/img/posts/rl-policy-gradient-drl/local-approximation.png)

- 이 근사는 첫 번째 오더(first-order)까지 $\eta$와 일치합니다.
- 이는 $L_{\pi_{\text{old}}}$를 조금이라도 향상시키는 작은 단계는 $\eta$ 또한 향상시킨다는 것을 의미합니다. 그러나 얼마나 큰 단계를 밟아야 하는지에 대한 지침은 제공하지 않습니다.

### **2.5 보수적 정책 반복(Conservative Policy Iteration)**

이 문제를 해결하기 위해 **보수적 정책 반복(Kakade 2002)** 방법을 사용합니다.

- $\pi(a \mid s) = (1-\alpha)\pi_{\text{old}}(a \mid s) + \alpha \pi^{\prime}(a \mid s)$와 같은 혼합 정책(mixture policy)을 사용합니다.
- 이 혼합 정책에 대해 다음과 같은 하한선이 성립합니다.

![Conservative policy iteration bound](/assets/img/posts/rl-policy-gradient-drl/conservative-policy-iteration-bound.png)

- 하지만 이 하한선은 혼합 정책에만 적용된다는 한계가 있습니다.

### **2.6 일반적인 확률적 정책으로 확장**

위의 정책 개선 하한선을 혼합 정책뿐만 아니라 **일반적인 확률적 정책**으로 확장하여 실용성을 높입니다.

- 먼저 $\alpha$를 전체 변동 거리(Total Variation distance)로 대체하고 $\epsilon$을 적절히 변경합니다.
- 그 후, 전체 변동 거리의 제곱이 **KL 발산**보다 작거나 같다는 성질을 이용하여 최종적으로 KL 발산으로 대체합니다.

![Stochastic policy bound](/assets/img/posts/rl-policy-gradient-drl/stochastic-policy-bound.png)

### **2.7 소수화-최대화(MM) 알고리즘**

MM 알고리즘은 반복적인 최적화 기법입니다. 각 단계에서 다음을 수행합니다.

1. **소수화(Minorization) 단계:** 현재 정책 $\pi_i$에서, 실제 목적 함수 $\eta$를 근사하는 하한선 함수 $M_i$를 찾습니다. $M_i$는 $\eta$보다 최적화하기 쉬우며, $\pi_i$ 지점에서 $\eta$와 같은 값을 가집니다.
2. **최대화(Maximization) 단계:** $M_i$를 최대화하여 다음 정책 $\pi_{i+1}$을 찾습니다. $\pi_{i+1}$은 $M_i$의 최적점입니다.
3. **반복:** 이 과정을 새로운 정책 $\pi_{i+1}$에 대해 반복합니다. 즉, $\pi_{i+1}$에서 새로운 하한선 함수 $M_{i+1}$을 찾고, 이를 최적화하여 $\pi_{i+2}$를 찾는 식으로 진행됩니다.

이 과정을 계속하면 정책은 지속적으로 개선됩니다. 정책의 수가 유한하기 때문에 결국 지역적 또는 전역적 최적점에 수렴하게 됩니다.

**2.7.1 MM 알고리즘을 모델에 적용하기**

![MM algorithm applied to TRPO](/assets/img/posts/rl-policy-gradient-drl/mm-algorithm.png)

### **2.8 신뢰 영역(Trust Region) 제약**

TRPO는 KL 발산에 **하드 제약**을 두어 정책의 변화량을 직접적으로 통제합니다.

최적화 문제는 다음과 같이 변환됩니다. $L_{\theta_{\text{old}}}(\theta)$를 최대화하되, 모든 상태 $s$에 대해 KL 발산의 최댓값이 작은 값 $\delta$보다 작거나 같다는 제약을 만족해야 합니다.

- 이론적으로는 벌점을 사용하는 방식과 수학적으로 동일하지만, 실제로는 KL 발산 계수 $C$를 조절하는 것보다 $\delta$를 조절하는 것이 더 쉽고 안정적입니다.
- 하지만 모든 상태에 대해 이 제약을 확인하는 것은 계산적으로 **비현실적**입니다.

### **2.9 발견적 근사 및 몬테카를로 시뮬레이션**

실용적인 해결을 위해 두 가지 중요한 근사를 적용합니다.

![TRPO expected KL constraint](/assets/img/posts/rl-policy-gradient-drl/trpo-expected-kl-constraint.png)

**발견적 근사:** 모든 상태에서 **최대 KL 발산** 제약 대신, 상태에 대한 **기댓값 KL 발산**으로 대체합니다.

**몬테카를로 시뮬레이션:** 기대값을 샘플 평균으로 대체하여 문제를 해결합니다. 이때 중요도 샘플링(Importance Sampling)을 사용합니다.

- **중요도 샘플링**을 통해 이전 정책에서 얻은 샘플을 버리지 않고 재사용할 수 있어 효율적입니다.

![TRPO importance sampling objective](/assets/img/posts/rl-policy-gradient-drl/trpo-importance-sampling-objective.png)

### **2.10 최종 최적화 문제**

위의 근사들을 적용한 최종적인 최적화 문제는 다음과 같습니다. 새로운 정책 $\theta$의 Q-value 기댓값을 최대화하되, 이전 정책과 새로운 정책 간의 평균 KL 발산이 $\delta$보다 작거나 같다는 제약을 만족해야 합니다.

### **2.11 TRPO의 실용적 알고리즘**

TRPO는 각 반복마다 다음 세 단계를 반복하여 정책을 업데이트합니다.

1. **데이터 수집:** 현재 정책을 사용하여 상태-행동 쌍과 그에 대한 Q-value의 몬테카를로 추정치를 수집합니다.
2. **추정:** 수집한 샘플을 평균하여 위의 최적화 문제에 대한 목적 함수와 제약 조건을 구성합니다.
3. **근사적 최적화:** 자연 정책 경사법(Natural Policy Gradient)을 켤레 경사법(Conjugate Gradient)과 백트래킹 라인 탐색(Backtracking Line Search)과 함께 사용하여 제약이 있는 최적화 문제를 근사적으로 해결합니다. 이 과정은 경사 자체를 계산하는 것보다 약간 더 많은 비용이 듭니다.

### **2.12 TRPO의 단점**

![TRPO limitations](/assets/img/posts/rl-policy-gradient-drl/trpo-limitations.png)

## **3. 자연 정책 경사(Natural Policy Gradient, NPG) 알고리즘**

TRPO는 다음 문제를 해결하려고 합니다.

![NPG original problem](/assets/img/posts/rl-policy-gradient-drl/npg-original-problem.png)

**NPG는 이 문제를 근사하여 해결하는 방법입니다.**

- **1차 테일러 근사:** $L_{\theta_{\text{old}}}(\theta)$는 1차(선형) 테일러 급수로 근사합니다.

![NPG first order approximation](/assets/img/posts/rl-policy-gradient-drl/npg-first-order.png)

- **2차 테일러 근사:** 기댓값 KL 발산은 2차(2차 함수) 테일러 급수로 근사합니다.

![NPG second order approximation](/assets/img/posts/rl-policy-gradient-drl/npg-second-order.png)

이를 통해 원래의 최적화 문제는 다음과 같이 변환됩니다.

![NPG quadratic problem](/assets/img/posts/rl-policy-gradient-drl/npg-quadratic-problem.png)

여기서 $H$는 피셔 정보 행렬(Fisher Information Matrix)로, $\theta$가 정책에 미치는 민감도(곡률)를 나타냅니다.

**자연 경사(Natural Gradient)**

- 일반적인 정책 경사 $\nabla_\theta L_{\theta_{\text{old}}}$는 매개변수 공간에서 가장 가파른 방향을 나타냅니다.
- 자연 경사 $H^{-1}\nabla_\theta L_{\theta_{\text{old}}}$는 정책 공간에서 가장 가파른 방향을 나타냅니다. 즉, 정책 자체의 변화를 고려한 최적의 업데이트 방향입니다.

**최적 업데이트**

- NPG를 사용하면 정책 업데이트를 분석적으로(analytically) 얻을 수 있습니다.
- NPG는 일반적인 1차 경사 상승법보다 수렴 속도가 빠르지만, $H^{-1}$를 계산하는 데 많은 비용이 들기 때문에 딥러닝과 같이 매개변수가 많은 경우에는 비효율적입니다.

**실용적인 해결책: 공액 경사법(Conjugate Gradient)과 라인 탐색(Line Search)**

TRPO는 $H^{-1}$를 직접 계산하는 대신, $Hx = g$ 형태의 선형 방정식을 $x$에 대해 푸는 것으로 문제를 바꿉니다. 여기서 $g = \nabla_\theta L_{\theta_{\text{old}}}(\theta)$입니다.

- **공액 경사법(Conjugate Gradient, CG):** 이 방정식을 효율적으로 푸는 반복적인 수치 방법입니다.
- **라인 탐색(Line Search):** CG로 계산한 업데이트 방향 $x$에 대해 최적의 스텝 사이즈를 찾기 위해 사용됩니다. 라인 탐색은 KL 제약 조건을 만족하고 목적 함수의 성능을 개선하는 가장 큰 스텝 사이즈를 찾습니다.

이러한 방법들을 통해 TRPO는 **안정적이면서도 효과적인 정책 업데이트**를 수행할 수 있게 됩니다. 하지만 공액 경사법의 사용으로 인해 구현이 더 복잡해집니다. 라인 탐색이 없으면, 가끔 성능 저하를 일으킬 수 있는 너무 큰 스텝이 계산될 수 있습니다.

![TRPO and NPG procedure](/assets/img/posts/rl-policy-gradient-drl/trpo-npg-procedure.png)

## **4. Proximal Policy Optimization (PPO)**

TRPO(Trust Region Policy Optimization)는 높은 성능을 보였지만, 정책이 지나치게 많이 변하는 것을 방지하기 위한 **KL 제약 조건** 때문에 구현과 계산이 복잡합니다.

TRPO의 최적화 문제는 다음과 같습니다.

![PPO TRPO objective](/assets/img/posts/rl-policy-gradient-drl/ppo-trpo-objective.png)

만약 이러한 trust region 제약 없이 단순히 기대값을 최대화한다면, 큰 파라미터 업데이트가 발생할 수 있고 이는 곧 불안정성을 초래하게 됩니다. 즉, 정책 비율(policy ratio)이 크게 변동할 수 있기 때문입니다.

이를 해결하기 위해 PPO는 **Clipped surrogate objective**를 도입했습니다. 정책 비율을 다음과 같이 정의합니다.

![PPO policy ratio](/assets/img/posts/rl-policy-gradient-drl/ppo-ratio.png)

그리고 목적 함수는 다음과 같이 설정합니다.

![PPO clipped objective](/assets/img/posts/rl-policy-gradient-drl/ppo-clipped-objective.png)

여기서 **clip** 연산은 정책 비율이 너무 크게 변하는 것을 잘라내어, TRPO의 KL 제약 대신 **벌점 역할**을 합니다.

이 방법은 계산량을 줄여줍니다. 예를 들어, 단순히 **1차 확률적 경사 상승(Stochastic Gradient Ascent)**만으로도 가능합니다. 또한 $L^{\text{CLIP}}(\theta)$는 $L^{\text{TRPO}}(\theta)$의 하한(lower bound) 역할을 하여 정책 성능에 대한 보장된 하한선을 제공합니다.

이러한 장점 덕분에 PPO는 OpenAI에서 기본(default) DRL 알고리즘으로 자리 잡게 되었습니다.

![PPO clipping plot](/assets/img/posts/rl-policy-gradient-drl/ppo-clipping-plot.png)

![PPO algorithm](/assets/img/posts/rl-policy-gradient-drl/ppo-algorithm.png)

## **5. 주요 발전 흐름**

![Policy gradient development flow](/assets/img/posts/rl-policy-gradient-drl/policy-gradient-development-flow.png)

- **DQN:** 강화학습의 상태 공간을 이산적(discrete)에서 연속적(continuous)으로 확장한 큰 도약을 이루었습니다.
- **A3C, DDPG:** Policy Gradient 알고리즘을 이용하여 연속적인 행동 수행을 가능하게 했고, 로보틱스 제어 등 응용 범위를 넓혔습니다.
- **TRPO:** KL 다이버전스 제약이 포함된 surrogate objective를 도입하여, 기대 보상(return)이 **비감소(non-decreasing)**함을 보장하면서 DDPG보다 안정적인 성능을 제공했습니다.
- **PPO:** TRPO의 복잡성을 줄이기 위해 clipped surrogate objective를 도입했습니다. 성능은 유지하면서도 구현 및 계산 복잡도를 크게 완화하여, 현재 가장 널리 쓰이는 DRL 알고리즘 중 하나가 되었습니다.
