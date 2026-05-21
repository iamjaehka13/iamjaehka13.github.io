---
title: "4. RL(Reinforcement Learning)"
date: 2025-09-06 17:18:00 +0900
categories: [RL, Study]
tags: [reinforcement-learning, monte-carlo, temporal-difference, sarsa, q-learning, double-q-learning]
description: DP와 RL의 차이, GPI, MC, TD, Sarsa, Q-learning, Double Q-learning을 정리한다.
math: true
---

## **1. 동적 계획법(DP) vs 강화학습(RL)**

동적 계획법(DP)과 강화학습(RL)은 모두 순차적 행동 결정 문제, 즉 **MDP(마르코프 결정 과정)를 풀어 최적 정책을 찾는다는 동일한 목표**를 가지고 있습니다. 하지만 목표에 도달하는 방식과 근본적인 가정에서 다음과 같은 결정적인 차이를 보입니다.

가장 핵심적인 차이는 **'환경 모델(Model)의 필요 유무'**이며, 이로 인해 가치를 업데이트하는 방식과 벨만 방정식을 다루는 방식이 완전히 달라집니다.

### **1.1 계산 방식: Full Backup vs Sample Backup**

- **동적 계획법 (Full Backup):** DP는 환경의 완벽한 지도(모델)를 가지고 있으므로, 한 상태의 가치를 업데이트할 때 그곳에서 갈 수 있는 **'모든' 가능한 다음 상태**들의 가치를 전부 계산에 반영합니다. 마치 선거 결과를 예측하기 위해 전체 유권자의 데이터를 모두 사용하는 것과 같습니다. 이를 **Full Backup**이라고 합니다.

![Full backup in dynamic programming](/assets/img/posts/rl-reinforcement-learning/full-backup.png)

- **강화학습 (Sample Backup):** RL은 지도가 없으므로, 오직 **직접 가본 하나의 경험(sample)**만을 바탕으로 현재 상태의 가치를 업데이트합니다. 선거 예측을 위해 무작위로 추출한 일부 표본 집단의 데이터만 사용하는 것과 같습니다. 이를 **Sample Backup**이라고 합니다.

![Sample backup in reinforcement learning](/assets/img/posts/rl-reinforcement-learning/sample-backup.png)

### **1.2 문제 풀이 방식: 방정식을 푸는가(DP) vs 정답을 추정하는가(RL)**

최적 정책을 찾는 것은 결국 **벨만 최적 방정식**의 해를 구하는 것과 같습니다.

- **동적 계획법 (방정식 풀이):** DP는 **방정식의 모든 항(상태 전이 확률 $P$, 보상 함수 $R$)을 알고 있습니다.** 따라서 가치 반복과 같은 알고리즘을 통해 방정식을 직접 **풀어서(Solving)** 해($v^*$, $q^*$)를 계산해냅니다. 이는 명확한 **계획(Planning)** 과정입니다.

![Solving Bellman optimality equation in DP](/assets/img/posts/rl-reinforcement-learning/rl-solving.png)

- **강화학습 (정답 추정):** RL은 **방정식의 중요 항들($P$, $R$)을 모릅니다.** 따라서 방정식을 직접 풀 수 없고, 대신 **환경과의 수많은 상호작용을 통해** 얻은 데이터로 방정식의 해($q^*$)가 무엇일지를 **통계적으로 추정(Estimating)**해 나갑니다. 이는 불확실성 속에서 답을 찾아가는 **학습(Learning)** 과정입니다.

![Estimating optimal action values in RL](/assets/img/posts/rl-reinforcement-learning/rl-estimating.png)

## **2. 일반화된 정책 반복 (Generalized Policy Iteration, GPI)**

일반화된 정책 반복(GPI)은 강화학습 알고리즘의 근간을 이루는 **핵심적인 프레임워크 또는 개념**입니다. GPI는 정책 평가(Policy Evaluation)와 정책 개선(Policy Improvement)이라는 두 과정이 서로 상호작용하며 최적 정책을 찾아가는 전체적인 구조를 설명합니다.

GPI는 서로를 끊임없이 개선시키는 두 가지 엔진으로 구성됩니다.

1. **정책 평가 (Policy Evaluation):** "현재 내가 가진 전략(정책)이 얼마나 좋은가?"를 평가하는 과정입니다. 현재 정책 $\pi$를 따랐을 때의 가치 함수($v_\pi$ 또는 $q_\pi$)가 얼마일지를 계산하거나 추정합니다.
2. **정책 개선 (Policy Improvement):** "평가된 가치를 바탕으로 어떻게 전략을 더 좋게 만들 수 있을까?"를 결정하는 과정입니다. 평가된 가치 함수를 기준으로, 각 상태에서 더 높은 가치를 주는 행동을 하도록 정책을 업데이트합니다. 보통 현재 가치에 대해 탐욕적(greedy)으로 행동하는 새로운 정책을 만듭니다.

### **2.1 평가와 개선의 춤: 최적점을 향한 상호작용**

GPI의 핵심은 이 두 과정이 서로를 완벽하게 만든다는 점입니다.

- 더 나은 정책은 더 정확한 가치 평가의 기준이 됩니다.
- 더 정확한 가치 평가는 더 나은 정책 개선을 위한 길을 열어줍니다.

이 상호작용은 마치 두 개의 선이 위아래로 진동하며 하나의 점으로 수렴하는 춤과 같습니다.

![Generalized policy iteration loop](/assets/img/posts/rl-reinforcement-learning/gpi-loop.png)

- **개선(아래로 향하는 화살표):** 현재 가치 함수에 맞게 정책을 업데이트합니다.
- **평가(위로 향하는 화살표):** 현재 정책에 맞게 가치 함수를 업데이트합니다.

이 두 과정이 서로를 끌어주고 밀어주며 계속되다 보면, 결국 정책과 가치 함수가 더 이상 변하지 않는 안정적인 균형점에 도달하게 됩니다. 이 지점이 바로 최적 정책($\pi^*$)과 최적 가치 함수($v^*$, $q^*$)입니다.

### **2.2 '일반화된(Generalized)'의 의미**

GPI가 '일반화된'이라고 불리는 이유는, **정책 평가와 개선 과정이 반드시 완벽하게 끝날 필요가 없기 때문**입니다.

- **정책 반복(Policy Iteration):** 평가를 완벽히 끝낸 후 개선을 수행하는 정석적인 방법입니다.
- **가치 반복(Value Iteration):** 평가를 단 한 스텝만 진행하고 바로 개선을 통합합니다.
- **대부분의 RL 알고리즘:** 평가와 개선을 매우 유연하게 섞습니다. 예를 들어, 몇 번의 경험(sample)으로 가치를 약간만 업데이트하고, 바로 정책을 조금 개선하는 식입니다.

이처럼 두 과정의 상호작용 깊이나 순서를 어떻게 구성하느냐에 따라 다양한 알고리즘이 파생됩니다. 결론적으로, **거의 모든 강화학습 알고리즘은 GPI라는 거대한 프레임워크를 각자의 방식으로 구현한 것**이라고 볼 수 있습니다.

## **3. 몬테카를로 방법 (Monte Carlo method, MC)**

### **3.1 몬테카를로 방법이란?**

**몬테카를로(MC) 방법**은 **모델 없이(model-free)**, **실제 경험**을 통해 가치 함수를 학습하는 강화학습 알고리즘입니다. DP와 달리 환경의 규칙을 전혀 모르기 때문에, 에이전트가 **하나의 에피소드를 처음부터 끝까지 완료**한 뒤에야 그 경험을 바탕으로 학습을 진행합니다.

MC는 GPI 프레임워크 안에서 **정책 평가를 수행하는 한 가지 방법**으로, **에피소드 단위의 샘플 기반 다단계 백업(sample multi-step backup)**을 사용합니다.

![Monte Carlo method overview](/assets/img/posts/rl-reinforcement-learning/mc-overview.png)

### **3.2 MC Prediction (Policy Evaluation)**

MC의 핵심은 어떤 상태-행동 쌍의 가치를, 그 행동을 한 이후부터 **에피소드가 끝날 때까지 얻은 실제 보상들의 총합**, 즉 반환값($G_t$)의 평균으로 추정하는 것입니다.

- **반환값 (Return)**

![Return equation for Monte Carlo method](/assets/img/posts/rl-reinforcement-learning/mc-return.png)

- **가치 추정:** $Q(s, a) \approx$ 상태 $s$에서 행동 $a$를 했을 때 얻었던 모든 반환값($G_t$)들의 평균

![Monte Carlo value estimate](/assets/img/posts/rl-reinforcement-learning/mc-value-estimate.png)

큰 수의 법칙(Law of Large Numbers)에 따라, 수많은 에피소드를 경험하여 이 평균을 계산하면 **추정치 $Q(s, a)$**는 **실제 가치 $q(s, a)$**에 수렴하게 됩니다.

- **First-Visit MC:** 한 에피소드에서 $(s, a)$ 쌍을 여러 번 방문해도, **오직 처음 방문했을 때의 반환값**만 평균 계산에 사용합니다.
- **Every-Visit MC:** 한 에피소드에서 $(s, a)$ 쌍을 방문할 때마다 얻은 **모든 반환값**을 평균 계산에 사용합니다.

### **3.3 가치 업데이트 방식: 점진적 평균과 고정 스텝 사이즈**

수많은 반환값을 모두 저장했다가 매번 평균을 다시 계산하는 것은 비효율적입니다. 따라서 MC는 보통 다음과 같은 점진적인(incremental) 업데이트 방식을 사용합니다.

**3.3.1 점진적 평균 업데이트 (Incremental Mean)**

새로운 반환값 $G_t$를 얻었을 때, 기존의 평균값 $Q(S_t, A_t)$를 다음과 같이 약간만 수정하여 새로운 평균을 계산합니다.

하지만 이런 방식을 사용할 경우, 과거에서부터 얻은 $G_t$와 최근 얻은 $Q(s, a)$가 같은 가치를 지니게 되어 좋지 않습니다.

![Incremental mean update](/assets/img/posts/rl-reinforcement-learning/mc-incremental-mean.png)

**3.3.2 고정 스텝 사이즈($\alpha$) 업데이트**

실제로는 $n$ 대신 고정된 학습률(step-size) $\alpha$를 사용하는 경우가 더 많습니다.

![Fixed step size Monte Carlo update](/assets/img/posts/rl-reinforcement-learning/mc-fixed-step-size.png)

이 방식은 **비정상적 문제(non-stationary problem)**, 즉 환경의 규칙이 시간에 따라 변할 수 있는 상황에 더 효과적입니다. 고정된 $\alpha$를 사용하면 오래된 경험은 점차 잊고 **최신 경험에 더 큰 가중치**를 두어 변화하는 환경에 적응할 수 있기 때문입니다.

### **3.4 Exploitation vs Exploration**

강화학습 에이전트가 온라인으로 의사결정을 내릴 때 마주하는 근본적인 선택 문제입니다. 이는 마치 단골 식당에 갈지, 새로운 맛집을 찾아 나설지 고민하는 것과 같습니다.

**핵심 질문:** 현재까지의 정보로 최선의 선택을 할 것인가, 아니면 더 나은 선택지를 찾기 위해 새로운 시도를 할 것인가?

**3.4.1 활용 (Exploitation)**

**정의:** 현재까지 알고 있는 정보 중 가장 좋다고 판단되는 선택을 하는 것입니다.

- **방법:** 현재 시점에서 **가장 높은 Q-가치(Q-value)를 가진 행동을 선택**합니다.
- **목표:** 이미 유망하다고 알려진 전략을 통해 정책을 **효율적으로 개선**하고 즉각적인 보상을 극대화합니다.
- **단점:** 더 좋은 미지의 선택지를 영원히 발견하지 못하고 **지역 최적해(local optimum)에 갇힐 위험**이 있습니다.

**3.4.2 탐험 (Exploration)**

**정의:** 더 나은 선택지를 찾기 위해 **새로운 정보를 수집**하는 것입니다.

- **방법:** 의도적으로 현재의 최선이 아닌, **무작위 행동**을 선택하여 새로운 경험을 쌓습니다.
- **목표:** 아직 가보지 않은 상태-행동 공간을 탐색하여 **더 높은 보상을 주는 새로운 전략**을 발견하는 것입니다.
- **단점:** 단기적으로는 비효율적인 행동을 수행하여 **손해(낮은 보상)를 볼 수 있습니다.**

**3.4.3 균형 맞추기: ε-탐욕 (Epsilon-Greedy) 정책**

결국 최적의 정책을 찾기 위해서는 탐험과 활용 사이의 균형을 맞추는 것이 중요합니다.

이를 위한 가장 대표적인 방법이 **ε-탐욕(Epsilon-Greedy)** 정책입니다.

- **확률 $1-\epsilon$로 활용:** 현재 Q값이 가장 높은 행동을 선택합니다.
- **확률 $\epsilon$로 탐험:** 가능한 모든 행동 중 하나를 무작위로 선택합니다.

여기서 **입실론($\epsilon$)** 값은 에이전트가 얼마나 자주 탐험할지를 결정하는 하이퍼파라미터입니다. 학습 초기에는 높은 $\epsilon$값으로 다양한 탐험을 하고, 학습이 진행될수록 $\epsilon$값을 점차 줄여나가 활용의 비중을 높이는 전략이 일반적입니다.

![Epsilon-greedy policy](/assets/img/posts/rl-reinforcement-learning/epsilon-greedy.png)

어떤 ε-greedy 정책이든, 주어진 Q-value에 따라 새롭게 정의된 ε-greedy 정책은 항상 이전 정책보다 개선됩니다. 즉, 새로운 정책의 상태 가치 함수는 항상 기존 정책의 가치 함수보다 크거나 같음을 보장합니다.

![Epsilon-greedy policy improvement](/assets/img/posts/rl-reinforcement-learning/epsilon-greedy-improvement.png)

**3.4.4 GLIE(Greedy in Limit with Infinite Exploration)**

모든 $(s, a)$를 무한히 탐색하고, 최종적으로 탐욕적 정책에 수렴할 경우 GLIE(Greedy in Limit with Infinite Exploration)를 만족합니다.

![GLIE condition](/assets/img/posts/rl-reinforcement-learning/glie-condition.png)

**3.4.5 GLIE MC Control**

ε-greedy 정책을 쓰되, $\epsilon \to 0$으로 줄여나가면 GLIE 조건을 만족합니다.

![GLIE Monte Carlo control](/assets/img/posts/rl-reinforcement-learning/glie-mc-control.png)

결국 이를 통해서 $Q(s, a)$가 $q^*(s, a)$로 수렴합니다.

### **3.5 Monte Carlo method pseudo code**

![Monte Carlo method pseudo code](/assets/img/posts/rl-reinforcement-learning/mc-pseudocode.png)

## **4. TD(Temporal Difference Learnings)**

### **4.1 TD 학습이란?**

몬테카를로(MC)의 **샘플링** 장점과 동적 계획법(DP)의 **부트스트래핑** 장점을 결합한 모델 프리(model-free) 강화학습 방법입니다. 에피소드가 끝날 때까지 기다리지 않고, **한 스텝마다 다음 상태의 추정치를 이용해 현재의 예측을 업데이트하여 빠르고 효율적으로 학습**합니다.

- **Model-free (모델 불필요):** 환경의 동작 원리(transition probability)를 몰라도 학습할 수 있습니다.
- **Bootstrapping (부트스트래핑):** 완전한 결과(리턴) 대신, 다음 상태의 추정 가치(Q-value)를 이용해 현재 가치를 업데이트합니다.

![Temporal Difference learning overview](/assets/img/posts/rl-reinforcement-learning/td-overview.png)

### **4.2 On-Policy vs Off-Policy**

TD 제어 알고리즘을 이해하기 위한 핵심 개념으로, **학습하려는 정책**과 **행동하는 정책**의 일치 여부를 나타냅니다.

**4.2.1 목표 정책 (Target Policy)**

**정의:** 에이전트가 **최종적으로 학습하고자 하는 이상적인 정책**입니다.

이 정책의 목표는 보상을 최대로 만드는 최적 정책($\pi^*$)이 되는 것입니다. 즉, 학습이 완료되었을 때 에이전트가 따르길 바라는 정답 또는 공략집과 같습니다. 이는 주로 활용(Exploitation)에 초점을 맞춘 탐욕 정책(Greedy Policy)인 경우가 많습니다.

**4.2.2 행동 정책 (Behavior Policy)**

**정의:** 에이전트가 환경과 상호작용하며 **경험(데이터)을 쌓기 위해 실제로 행동을 선택하는 데 사용하는 정책**입니다.

최적의 경로를 찾기 위해서는 탐험(Exploration)을 반드시 포함해야 합니다. 따라서 **보통 ε-탐욕 정책(ε-Greedy Policy)이 행동 정책**으로 사용됩니다.

**4.2.3 On-Policy: 목표 정책(Target Policy) = 행동 정책(Behavior Policy)**

On-Policy 학습에서는 **목표 정책과 행동 정책이 동일**합니다. 에이전트는 현재 자신이 따르는 정책(e.g., ε-탐욕)의 가치를 배우고, 그 정책을 점진적으로 개선합니다.

- **대표 알고리즘:** **Sarsa**
- **장점:** 학습하는 정책과 행동하는 정책이 같아 학습 과정이 비교적 안정적이며, 가치 함수가 잘 수렴하는 경향이 있습니다.
- **단점:** 정책이 조금이라도 개선되면, 그 이전 정책으로 얻은 **과거의 모든 경험은 폐기**해야 하므로 데이터 효율성이 떨어집니다. 또한 탐험을 줄이면 더 좋은 경로를 찾지 못할 수 있고, 탐험을 계속하면 학습된 정책이 최적이 아닌 준최적(suboptimal)에 머무를 수 있습니다.

![Sarsa overview](/assets/img/posts/rl-reinforcement-learning/sarsa-overview.png)

![Sarsa pseudo code](/assets/img/posts/rl-reinforcement-learning/sarsa-pseudocode.png)

**4.2.4 Off-Policy: 목표 정책(Target Policy) ≠ 행동 정책(Behavior Policy)**

Off-Policy 학습에서는 **목표 정책과 행동 정책이 다릅니다**. 에이전트는 자유롭게 탐험하는 행동 정책(e.g., ε-greedy)을 따르면서도, 학습은 이상적인 최적 정책(e.g., greedy)을 목표로 진행합니다.

- **대표 알고리즘:** **Q-Learning**
- **장점:** 행동 정책과 목표 정책이 분리되어 있어, 과거에 다른 정책으로 얻은 경험을 재사용(Experience Replay)할 수 있습니다. 또한 지속적으로 환경을 탐험하면서도 **최적 정책($\pi^*$)을 직접 학습**할 수 있습니다.
- **단점:** 행동 정책과 목표 정책의 차이가 클 경우, 이 차이를 보정하는 과정(e.g., **중요도 샘플링**)에서 특정 경험의 가치가 과대평가되어 업데이트 값의 편차가 매우 커질 수 있습니다. 이 높은 분산은 학습 불안정성으로 이어질 수 있습니다.

![Q-learning overview](/assets/img/posts/rl-reinforcement-learning/q-learning-overview.png)

![Q-learning pseudo code](/assets/img/posts/rl-reinforcement-learning/q-learning-pseudocode.png)

**4.2.5 중요도 샘플링**

중요도 샘플링은 행동 정책으로 얻은 데이터를 목표 정책 기준으로 보정할 때 사용하는 방법입니다. 원문에서는 세부 설명 대신 이미지로 요약합니다.

![Importance sampling summary](/assets/img/posts/rl-reinforcement-learning/importance-sampling-summary.png)

![Importance sampling distribution comparison](/assets/img/posts/rl-reinforcement-learning/importance-sampling-plot.png)

## **5. Bias vs Variance**

### **5.1 편향(Bias)과 분산(Variance) 개념**

강화학습 모델의 성능을 평가할 때, 예측이 얼마나 정확하고 일관적인지를 나타내는 두 가지 중요한 척도입니다. 과녁 맞히기를 생각하면 이해하기 쉽습니다.

- **편향 (Bias):** 예측값들의 평균이 실제 정답(과녁의 중심)과 얼마나 멀리 떨어져 있는가? (**정확성**)
- **분산 (Variance):** 예측값들이 자기들끼리 얼마나 널리 흩어져 있는가? (**일관성**)

### **5.2 MC vs TD**

**5.2.1 몬테카를로(MC): 높은 분산, 제로 편향 (High Variance, Zero Bias)**

MC의 업데이트 목표인 리턴($G_t$)은 에피소드가 끝난 후 얻는 실제 보상의 총합입니다. 다른 추정치가 개입되지 않은 순수한 정답 샘플이므로 **편향이 없습니다(unbiased)**. 하지만 리턴값은 에피소드 전체의 수많은 무작위 행동, 상태 전이, 보상에 의해 결정되므로, 매번 궤적이 달라질 때마다 값의 변동이 커 **분산이 매우 높습니다.**

![Monte Carlo bias and variance](/assets/img/posts/rl-reinforcement-learning/mc-bias-variance.png)

**5.2.2 시간차 학습(TD): 낮은 분산, 약간의 편향 (Low Variance, Some Bias)**

TD의 업데이트 목표인 TD 타겟($R_{t+1} + \gamma Q(S_{t+1}, A_{t+1})$)은 현재의, 아직 부정확할 수 있는 추정치 $Q$를 사용합니다. 이처럼 추정치에 기반한 추정치이기 때문에 **약간의 편향이 존재합니다(biased)**. 그러나 업데이트가 단 한 스텝의 결과에만 의존하므로, 전체 궤적에 의존하는 MC보다 불확실성이 훨씬 적어 **분산이 낮습니다.**

![Temporal Difference bias and variance](/assets/img/posts/rl-reinforcement-learning/td-bias-variance.png)

**5.2.3 MC vs TD 종합 비교**

| 구분 | 몬테카를로 (MC) | 시간차 학습 (TD) |
| --- | --- | --- |
| 편향/분산 | 높은 분산, 제로 편향 | 낮은 분산, 약간의 편향 |
| 업데이트 시점 | 에피소드 종료 후 일괄 업데이트 | 매 스텝마다 즉시 업데이트 |
| 업데이트 목표 | 실제 리턴 $G_t$ | TD 타겟 $R_{t+1} + \gamma Q(S_{t+1}, A_{t+1})$ |
| 환경 요구사항 | 종료 환경(Episodic)만 가능 | 종료 + 지속(Continuing) 환경 모두 가능 |
| Markov 특성 | 비마르코프 환경에서도 효과적 | 마르코프 환경에서 더 효율적 |
| 민감도 | 초기값에 덜 민감 | 초기값에 더 민감 |
| 메모리/계산 | 더 많이 필요 | 더 적게 필요 |
| 수렴 속도 | 수학적으로는 미정 | 실전에서는 보통 더 빠름 |

**5.2.4 최종 요약**

- MC는 무편향이지만 분산이 크고, TD는 약간의 편향이 있지만 분산이 낮습니다.
- MC는 단순하고 직관적이며 에피소드 환경에 적합하고, TD는 더 효율적이며 에피소드 및 지속 환경 모두에 적용 가능합니다.
- 실용적인 관점에서 볼 때, TD가 보통 더 빠르게 수렴합니다.

## **6. Sarsa vs Q-learning**

Sarsa(On-Policy)와 Q-러닝(Off-Policy)의 가장 큰 차이는 **탐험(exploration)으로 인한 실수의 가능성을 가치 평가에 반영하는가**에 있습니다. 이는 에이전트가 학습하는 최종 정책의 성향을 결정합니다.

### **상황 설정: 절벽 걷기 (Cliff Walking)**

- **목표:** 출발점(S)에서 도착점(G)까지 최단 경로로 도착해야 합니다.
- **위험:** 중간에 **절벽(The Cliff)** 구역이 있습니다. 이곳에 빠지면 큰 페널티를 받고 출발점으로 돌아갑니다.
- **최적 경로:** 절벽 바로 위쪽을 따라가는 것이 가장 빠릅니다.
- **안전 경로:** 절벽을 멀리 돌아가는 안전한 길이 있습니다.

### **6.1 Sarsa의 접근법: 안전한 현실주의자**

Sarsa는 On-Policy이므로, **자신이 실제로 행동할 정책(ε-greedy)의 가치**를 배웁니다.

- **학습 과정:** Sarsa는 최적 경로인 절벽 바로 위를 따라가다 보면, ε 확률로 탐험적인 행동(아래로 이동)을 하여 절벽에 빠질 수 있다는 것을 경험으로 알게 됩니다. 절벽에 빠질 때마다 받는 큰 페널티는 절벽 주변 상태들의 Q-가치를 낮춥니다.
- **결과:** Sarsa는 "절벽 바로 위 경로는 이론상 최적이지만, 내 탐험적인 행동 때문에 너무 위험해. 차라리 조금 멀리 돌아가더라도 안전한 길이 더 낫다"라고 판단합니다. 따라서 **최적 경로가 아닌, 위험을 회피하는 안전한 경로를 학습**하게 됩니다.

**Sarsa는 탐험으로 인한 페널티의 가능성까지 고려하여, 준최적(near-optimal)이지만 안전한 정책을 학습합니다.**

### **6.2 Q-러닝의 접근법: 대담한 이상주의자**

Q-러닝은 Off-Policy이므로, **실제 행동과 관계없이 항상 최적의 행동(max)을 가정하고 가치를 학습**합니다.

- **학습 과정:** Q-러닝은 절벽 바로 위의 상태에서 Q-가치를 업데이트할 때, max 연산을 통해 항상 최선인 오른쪽 이동의 가치만을 참고합니다. ε 확률로 절벽에 빠져 큰 페널티를 받더라도, 그 경험은 **최적 가치를 업데이트하는 데 반영되지 않습니다.**
- **결과:** Q-러닝은 절벽에 빠지는 위험을 가치 함수에 반영하지 않으므로, **가장 빠른 최적 경로의 가치가 가장 높다고 학습**합니다. 하지만 학습 중인 에이전트는 여전히 ε-greedy 정책으로 행동하므로, 학습 과정에서 **실제로 절벽에 자주 빠지게 됩니다.**

**Q-러닝은 탐험으로 인한 페널티를 무시하고 최적 정책을 직접 학습하지만, 그 과정에서 더 많은 위험을 감수합니다.**

### **6.3 한눈에 보는 요약**

| 구분 | Sarsa (현실주의자) | Q-러닝 (이상주의자) |
| --- | --- | --- |
| 학습 방식 | On-Policy (실제 행동 기반) | Off-Policy (최적 행동 가정) |
| 탐험의 영향 | 탐험의 위험을 Q-가치에 반영함 | 탐험의 위험을 Q-가치에 반영 안 함 |
| 학습 정책 | 안전하지만 준최적인 정책 | 최적이지만 위험한 정책 |
| 경로 선택 | 느리지만 안전한 경로 선호 | 빠르지만 위험한 경로 선호 |

![Sarsa vs Q-learning cliff walking comparison](/assets/img/posts/rl-reinforcement-learning/sarsa-vs-qlearning.png)

### **6.4 Expected Sarsa: Sarsa와 Q-러닝의 장점을 결합한 알고리즘**

Expected Sarsa는 이름 그대로, 다음 행동 $A'$의 가치를 기댓값(Expectation)으로 계산하는 On-Policy TD 알고리즘입니다.

기존의 Sarsa는 다음 상태 $S'$에서 **딱 하나의 행동 $A'$을 샘플링**하여 그 행동의 Q값인 $Q(S', A')$을 사용했습니다. 이 방식은 어떤 행동이 뽑히냐에 따라 업데이트 값이 달라져 분산(variance)이 컸습니다.

Expected Sarsa는 이러한 분산을 줄이기 위해, 다음 상태 $S'$에서 **가능한 모든 행동들의 Q값에 그 행동을 할 확률을 곱해 평균**을 냅니다.

![Expected Sarsa update](/assets/img/posts/rl-reinforcement-learning/expected-sarsa.png)

**6.4.1 Sarsa, Expected Sarsa, Q-러닝 비교**

| 구분 | Sarsa (기본) | Expected Sarsa (기대값) | Q-러닝 (최대값) |
| --- | --- | --- | --- |
| 업데이트 목표 | 다음 행동의 샘플값 $Q(S', A')$ | 다음 행동의 기댓값 $\mathbb{E}[Q(S', A')]$ | 다음 행동의 최댓값 $\max_{a'} Q(S', a')$ |
| 분산 (Variance) | 높음 | 낮음 | 낮음 |
| 학습 정책 | On-Policy | On-Policy | Off-Policy |
| 계산 복잡도 | 낮음 | 높음(모든 행동에 대한 계산 필요) | 낮음 |

## **7. Double Q-learning**

### **7.1 Q-learning의 문제점: 최대화 편향 (Maximization Bias)**

기본 Q-러닝의 업데이트 공식에는 **max 연산**이 포함됩니다.

![Maximization bias in Q-learning](/assets/img/posts/rl-reinforcement-learning/q-learning-max-bias.png)

학습 초기에는 Q값 추정치가 부정확하고 노이즈가 많습니다. 이때 max 연산은 여러 불확실한 추정치 중에서 우연히 가장 높게 측정된 값을 선택할 가능성이 높습니다.

이는 마치 여러 명의 초보 감정사에게 물건의 가치를 물어보고, 그중 **가장 높은 가격을 부른 사람의 말을 무조건 믿는 것**과 같습니다. 이 과정이 반복되면, 에이전트는 Q값을 실제보다 지속적으로 과대평가(overestimate)하게 됩니다. 이 문제를 **최대화 편향**이라고 하며, 이는 학습 속도를 늦추고 불안정하게 만드는 원인이 됩니다.

### **7.2 Double Q-learning의 해결책: 역할 분담**

**Double Q-러닝**은 이 과대평가 문제를 해결하기 위해 **두 개의 독립적인 Q-함수(Q 네트워크)**, 즉 $Q_A$와 $Q_B$를 사용합니다. 핵심 아이디어는 행동 선택과 가치 평가의 역할을 분리하는 것입니다.

1. **행동 선택 (Action Selection):** 다음 상태 $S'$에서 어떤 행동이 최선일지 **하나의 Q함수($Q_A$)를 이용해 결정**합니다.

![Double Q-learning action selection](/assets/img/posts/rl-reinforcement-learning/double-q-select.png)

2. **가치 평가 (Value Evaluation):** 위에서 선택된 행동 $a^*$의 가치가 얼마인지 **다른 Q함수($Q_B$)를 이용해 평가**합니다.

이 값을 이용해 업데이트를 수행하며, 다음번에는 두 Q함수의 역할을 서로 바꿔서 진행합니다. 즉, $Q_B$가 선택하고 $Q_A$가 평가합니다.

![Double Q-learning value evaluation](/assets/img/posts/rl-reinforcement-learning/double-q-evaluate.png)

왜 이 방법이 효과적일까요?

$Q_A$가 특정 행동의 가치를 실수로 과대평가하더라도, 그 실수가 독립적인 $Q_B$에도 똑같이 일어날 확률은 매우 낮습니다. 즉, **한 명이 실수를 하더라도 다른 한 명이 그 실수를 바로잡아주는 역할**을 하여, 무조건 가장 높은 값만 좇던 **기존 Q-러닝의 편향을 크게 줄여줍니다.**

### **7.3 최종 요약**

- Double Q-러닝은 max 연산 때문에 발생하는 Q-러닝의 과대평가(overestimation) 문제를 해결하기 위한 기법입니다.
- 두 개의 Q-함수를 두어 하나는 최적 행동을 선택하는 데, 다른 하나는 그 행동의 가치를 평가하는 데 사용하여 서로의 실수를 보정해 줌으로써 훨씬 안정적이고 빠른 학습을 가능하게 합니다.

![Double Q-learning pseudo code](/assets/img/posts/rl-reinforcement-learning/double-q-pseudocode.png)
