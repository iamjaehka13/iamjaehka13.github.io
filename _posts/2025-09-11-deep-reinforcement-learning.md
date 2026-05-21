---
title: "5. DRL(Deep Reinforcement Learning)"
date: 2025-09-11 18:03:59 +0900
categories: [RL, Study]
tags: [reinforcement-learning, deep-reinforcement-learning, dqn, double-dqn, dueling-dqn, policy-gradient, actor-critic, a3c, a2c]
description: DQN, Double DQN, Dueling DQN, Policy Gradient, REINFORCE, Actor-Critic, A3C, A2C를 정리한다.
math: true
---

## **1. Reinforcement Learning vs Deep Reinforcement Learning**

강화 학습(RL)은 **Q-table**이라는 표를 사용하여 각 상태(state)와 행동(action)에 대한 최적의 Q-value(가치)를 찾아 정책을 업데이트합니다. 하지만 상태나 행동의 수가 많아지면 Q-table의 크기가 기하급수적으로 커져서 **차원의 저주(the curse of dimensionality)**에 빠지게 됩니다.

반면, 심층 강화 학습(DRL)은 Q-table 대신 **심층 신경망(Deep Neural Network)**을 사용합니다. 이 신경망이 복잡한 상태를 처리하고 Q-함수나 정책을 근사(function approximation)하는 역할을 합니다. 이를 통해 차원의 저주 문제를 완화하고, 로봇 제어, 자율 주행, 게임 등 복잡한 환경에 적용할 수 있게 됩니다.

## **2. Naive DQN**

Naive **DQN**은 **Q-learning** 알고리즘에 심층 신경망(Deep Neural Network)을 단순히 결합한 모델입니다. Q-table을 사용하는 기존 Q-learning과 달리, 신경망이 Q-함수 $Q(s, a; \theta)$를 근사(approximate)하는 역할을 합니다.

이 모델은 주로 이미지와 같은 고차원 데이터를 처리하기 위해 CNN(Convolutional Neural Network)을 사용하여 게임 화면 픽셀로부터 직접 Q-value를 추정합니다. 하지만 이 단순한 구조 때문에 두 가지 치명적인 문제점을 안고 있습니다.

### **2.1 Naive DQN의 문제점**

1. **샘플 간의 시간적 상관성 (Temporal Correlations Between Samples):** 에이전트가 환경과 상호작용하며 데이터를 순차적으로 수집하고 즉시 학습에 사용하면, 연속된 데이터 샘플들이 서로 강한 상관관계를 가지게 됩니다. 이는 딥러닝 학습의 기본 전제인 **독립 항등 분포(i.i.d.)** 가정을 위반하여 학습을 불안정하게 만듭니다.
2. **비정상적인 타겟 (Non-stationary Target):** Q-learning은 현재 상태의 Q-value와 다음 상태의 Q-value를 비교하여 신경망을 업데이트합니다. Naive DQN에서는 현재 Q-value를 추정하는 신경망과 타겟 Q-value를 계산하는 신경망이 동일합니다. 따라서 신경망 파라미터 $\theta$가 업데이트될 때마다 타겟값도 함께 변동하여 학습이 수렴하기 어렵습니다.

![Naive DQN problems](/assets/img/posts/rl-deep-reinforcement-learning/naive-dqn-problems.png)

## **3. DQN**

DQN(Deep Q-Network)은 Naive DQN의 문제를 해결하기 위해 두 가지 핵심 기술을 도입했습니다. 또한 이미지 픽셀과 점수만을 이용해 학습하는 **End-to-end RL** 방식을 채택하여 최소한의 도메인 지식만으로도 뛰어난 성능을 보입니다.

### **3.1 경험 리플레이 (Experience Replay)**

경험 리플레이는 에이전트가 환경과 상호작용하며 얻은 **(상태, 행동, 보상, 다음 상태)** 쌍을 리플레이 버퍼(Replay Buffer)라는 메모리에 저장하는 기술입니다.

- **문제 해결:** 학습 시 버퍼에서 무작위로 미니 배치(mini-batch)를 추출하여 사용합니다. 이 덕분에 연속적인 샘플들의 시간적 상관성을 없애고, 딥러닝의 i.i.d. 가정을 만족시킵니다.
- **데이터 효율성:** 한 번 수집한 데이터를 여러 번 재사용하여 데이터 효율성을 높입니다.
- **희귀한 경험:** 중요한 희귀 경험(rare experiences)이 한 번 사용되고 버려지지 않고 버퍼에 저장되어 여러 번 학습에 활용될 수 있습니다.

![Experience replay overview](/assets/img/posts/rl-deep-reinforcement-learning/experience-replay-overview.png)

**3.1.1 경험 리플레이의 메커니즘**

경험 리플레이는 에이전트가 환경과 상호작용하면서 얻는 경험들을 즉시 학습에 사용하지 않고, 리플레이 버퍼라는 대규모 메모리에 저장했다가 나중에 무작위로 샘플링하여 학습하는 기법입니다. 이는 DQN의 핵심 기술 중 하나로, Naive DQN이 겪었던 시간적 상관성과 데이터 효율성 문제를 해결해 줍니다.

**동작 과정**

1. **경험 생성:** 에이전트는 현재 상태 $s_t$에서 $\epsilon$-greedy 정책을 사용하여 행동 $a_t$를 선택합니다. 이 행동을 환경에서 실행한 후 보상 $r_{t+1}$과 다음 상태 $s_{t+1}$을 관찰합니다.
2. **버퍼에 저장:** 에이전트는 방금 얻은 경험 $(s_t, a_t, r_{t+1}, s_{t+1})$을 즉시 신경망 업데이트에 사용하지 않고 리플레이 버퍼에 저장합니다. 이 과정은 매 스텝마다 반복됩니다.
3. **무작위 샘플링:** 신경망을 업데이트할 때, 에이전트는 버퍼에 저장된 경험들 중에서 무작위로 하나의 미니 배치를 추출합니다.
4. **네트워크 업데이트:** 추출된 미니 배치 데이터를 사용하여 Q-network를 업데이트합니다. 이 과정은 데이터의 시간적 순서와 무관하게 이루어지므로, 데이터 간의 상관성을 없애고 딥러닝의 기본 전제인 i.i.d.를 만족시켜 학습을 안정화합니다.

![Experience replay mechanism](/assets/img/posts/rl-deep-reinforcement-learning/experience-replay-mechanism.png)

### **3.2 타겟 네트워크 (Target Network)**

타겟 네트워크는 비정상적인 타겟 문제를 해결하기 위해 도입되었습니다.

- **문제 해결:** 업데이트에 사용되는 행동 Q-network(Behavior Q-Network)와 별개로, 타겟 값을 계산하는 Target Q-Network를 따로 둡니다.
- **메커니즘:** 타겟 네트워크의 파라미터는 일정 단계마다 행동 네트워크의 파라미터로 **고정적으로 업데이트**됩니다. 이 덕분에 타겟 값이 자주 변하지 않아 학습이 안정적으로 이루어집니다.

![Target network overview](/assets/img/posts/rl-deep-reinforcement-learning/target-network.png)

### **3.3 DQN pseudo code**

![DQN pseudo code](/assets/img/posts/rl-deep-reinforcement-learning/dqn-pseudocode.png)

### **3.4 DQN의 CNN 활용**

DQN은 게임 화면의 픽셀 데이터를 직접 입력으로 사용합니다.

- **고차원 데이터 압축:** 과거 4프레임의 84x84 픽셀 이미지를 입력으로 받아 CNN을 통해 약 256 차원의 더 작은 상태 벡터로 압축합니다.
- **Max Pooling 미사용:** 게임 화면에서 작은 움직임이 매우 중요하기 때문에, DQN에서는 Max Pooling을 사용하지 않고 stride를 통해 이미지를 축소합니다.

![DQN CNN architecture](/assets/img/posts/rl-deep-reinforcement-learning/dqn-cnn-architecture.png)

### **3.5 Multi-step Learning**

다단계 학습(Multi-step Learning)은 n-step return을 사용하여 Q-value를 업데이트하는 방식입니다. 즉, 단일 보상이 아닌 앞으로 $n$번의 행동을 통해 얻을 보상들의 합을 계산하여 현재의 Q-value를 결정합니다. 이 방식은 에이전트가 단기적인 보상에만 의존하지 않고, 더 넓은 미래를 내다보며 학습하도록 돕습니다.

**3.5.1 n단계 보상($R_t^{(n)}$) 계산**

$n$단계 보상은 현재 시점 $t$부터 미래의 $n$번째 스텝까지 얻게 되는 감가상각된(discounted) 보상들의 합입니다.

![N-step return](/assets/img/posts/rl-deep-reinforcement-learning/n-step-return.png)

여기서 $\gamma$는 할인율(discount factor)로, 미래의 보상이 현재에 얼마나 중요한지를 나타냅니다. $n$단계 보상은 $n$번째 스텝까지의 실제 보상을 모두 더한 뒤, 마지막 상태 $s_{t+n}$의 최대 Q-value를 더하여 계산됩니다.

**3.5.2 DQN에의 적용**

다단계 학습을 DQN에 적용하면, 기존 DQN의 손실 함수(loss function)를 다음과 같이 수정하여 사용합니다.

![N-step DQN loss](/assets/img/posts/rl-deep-reinforcement-learning/n-step-dqn-loss.png)

이 손실 함수는 $n$단계 보상 값과 현재 Q-network가 예측한 Q-value 사이의 차이를 최소화하도록 신경망 파라미터 $\theta$를 업데이트합니다. 여기서 $\hat{\theta}$는 **타겟 네트워크**의 파라미터로, 학습의 안정성을 위해 고정된 값을 사용합니다.

**3.5.3 주요 이점**

- **학습 속도 향상:** 적절하게 설정된 $n$ 값을 사용하면 1-step 학습보다 더 빠르게 수렴할 수 있습니다. 이는 에이전트가 단일 스텝의 피드백 대신 더 긴 보상 경로를 통해 정보를 얻기 때문입니다.
- **정보 효율성 증대:** 한 번의 업데이트에 더 많은 보상 정보를 활용하므로 데이터 효율성이 높아집니다.

## **4. Double DQN**

Double DQN은 **Q-learning의 과대평가 편향(overestimation bias)** 문제를 해결하기 위해 DQN을 개선한 알고리즘입니다.

**과대평가 편향이란?**

- 일반적인 Q-learning은 다음 상태의 Q-value를 계산할 때 **max 연산**을 사용합니다.
- 이 max 연산은 Q-value에 있는 작은 노이즈나 추정 오류 때문에 실제 값보다 더 높은 값을 선택하는 경향이 있습니다. 이로 인해 모든 Q-value가 전반적으로 과대평가될 수 있습니다.
- 모든 Q-value가 균등하게 과대평가되면 큰 문제가 되지 않을 수 있지만, 과대평가가 특정 값에만 치우치게 되면 에이전트의 정책이 왜곡될 수 있습니다.

### **4.1 Double Q-learning과 Double DQN**

- **Double Q-learning**은 행동 선택과 행동 가치 평가를 분리하여 이 문제를 해결합니다. 즉, 하나의 네트워크는 다음 행동을 선택하고, 다른 네트워크는 그 행동의 가치를 평가합니다.
- **Double DQN**은 이 아이디어를 DQN에 적용한 것입니다. 새로운 네트워크를 추가하는 대신, 이미 존재하는 타겟 네트워크(target network)를 두 번째 네트워크처럼 활용합니다.
- **기존 DQN의 손실 함수:**

![DQN loss](/assets/img/posts/rl-deep-reinforcement-learning/dqn-loss.png)

- **Double DQN의 손실 함수:**

![Double DQN loss](/assets/img/posts/rl-deep-reinforcement-learning/double-dqn-loss.png)

이 식에서, 현재 네트워크 $Q$는 다음 행동을 선택하고, 타겟 네트워크 $\hat{Q}$는 그 선택된 행동의 가치를 평가합니다. 이 방식은 기존 DQN보다 행동 가치를 더 정확하게 추정하고, 최종적으로 더 나은 정책을 만들어내는 것으로 입증되었습니다.

### **4.2 Prioritized Replay**

Prioritized Replay는 에이전트가 경험을 저장하는 경험 버퍼(Replay buffer)에서 더 중요한 경험을 더 자주 샘플링하도록 만들어 학습 효율을 높이는 방법입니다.

**4.2.1 일반적인 Replay와 문제점**

- 일반적인 DQN은 경험 버퍼에서 **균일하게 무작위 샘플링**을 합니다.
- 이 방법은 학습 과정에서 자주 발생하는 반복적인 경험이 희귀하지만 중요한 경험보다 더 많이 샘플링될 수 있다는 단점이 있습니다. 이는 학습의 비효율성을 초래합니다.

**4.2.2 우선순위 부여 방법**

- Prioritized Replay는 각 경험에 우선순위 $p_i$를 부여합니다.
- 이 우선순위는 경험으로부터 에이전트가 얼마나 많이 배울 수 있는지를 나타내는 TD error를 기준으로 측정합니다. TD error가 크다는 것은 현재 Q-value와 다음 상태의 Q-value 사이에 큰 차이가 있어, 예측이 많이 틀렸다는 것을 의미합니다.
- 우선순위는 아래와 같이 계산됩니다.

![Prioritized replay priority](/assets/img/posts/rl-deep-reinforcement-learning/prioritized-replay-priority.png)

$\epsilon$은 우선순위가 0인 경험도 샘플링될 수 있도록 더해주는 작은 값입니다.

**4.2.3 문제점 해결 및 보완**

1. **다양성 손실:** 우선순위가 높은 경험만 계속 샘플링하면 학습 데이터의 다양성이 줄어들어 과적합(overfitting)이 발생할 수 있습니다. 이를 해결하기 위해 확률적 샘플링(Stochastic sampling prioritization)을 사용합니다. 이는 우선순위 $p_i$에 따라 경험을 샘플링하되, 하이퍼파라미터 $\alpha$를 통해 얼마나 우선순위를 적용할지 조절합니다. $\alpha = 0$이면 균일 샘플링입니다.
2. **편향 발생:** 우선순위 샘플링은 기존의 균일 샘플링과 분포가 달라지므로 Q-learning 업데이트에 편향을 유발합니다.

이 편향을 보정하기 위해 **중요도 샘플링 가중치(Importance Sampling weights)**를 사용합니다. 각 경험 $i$에 대한 가중치 $w_i$는 다음과 같이 계산됩니다.

![Importance sampling weight](/assets/img/posts/rl-deep-reinforcement-learning/importance-sampling-weight.png)

Q-learning 업데이트 시에는 TD error에 이 가중치를 곱하여 편향을 보정합니다. 하이퍼파라미터 $\beta$는 편향 보정의 정도를 결정하며, 학습 후반부에 편향 보정이 중요해지므로 $\beta$를 0에서 1까지 서서히 증가시킵니다.

### **4.3 Double DQN with prioritized replay pseudo code**

![Double DQN with prioritized replay pseudo code](/assets/img/posts/rl-deep-reinforcement-learning/prioritized-double-dqn-pseudocode.png)

## **5. Dueling DQN**

Dueling DQN은 DQN의 구조를 개선하여 학습 효율을 높인 모델입니다. 이 모델은 **상태 가치($V$)와 어드밴티지($A$)를 분리하여 학습**하는 것이 핵심입니다.

### **5.1 Dueling DQN의 구조**

- Dueling DQN은 **하나의 CNN 인코더**를 공유합니다. 이 인코더는 입력 이미지(예: Atari 게임 화면)로부터 특징을 추출하는 역할을 합니다.
- CNN 인코더의 출력은 두 개의 분리된 스트림(stream)으로 나뉩니다.
  1. **상태 가치($V(s)$) 스트림:** 현재 상태 $s$가 얼마나 가치 있는지를 나타내는 스칼라 값 $V(s)$를 추정합니다.
  2. **어드밴티지($A(s,a)$) 스트림:** 각 행동 $a$가 현재 상태 $s$에서 얼마나 더 나은지, 또는 나쁜지를 나타내는 벡터 $A(s,a)$를 추정합니다.
- 이 두 스트림의 출력은 하나의 합산 모듈(aggregator)을 통해 최종 Q-value $Q(s,a)$로 합쳐집니다.

### **5.2 핵심 아이디어**

- Dueling DQN의 핵심 아이디어는 **가치 있는 상태를 식별하는 것**과 **각 행동의 효과를 평가하는 것**을 분리하는 것입니다.
- 예를 들어, 자동차 게임 Enduro에서 차가 없는 빈 도로를 달릴 때는 어떤 행동(좌회전, 우회전)을 하더라도 즉각적인 결과에 큰 차이가 없습니다. 이 경우 상태 가치 $V(s)$는 여전히 중요하지만, 각 행동의 어드밴티지 $A(s,a)$는 거의 0에 가깝습니다.
- Dueling DQN은 이와 같은 상황에서 상태 가치 $V(s)$를 효율적으로 학습할 수 있습니다. Q-value가 업데이트될 때마다 $V(s)$도 함께 업데이트되기 때문입니다.
- 이 방식 덕분에 에이전트가 모든 상태-행동 쌍의 Q-value를 일일이 학습할 필요 없이, 중요한 상태에 집중할 수 있어 학습이 더 효율적으로 이루어집니다.

### **5.3 Identifiability Issue (식별성 문제)**

$Q(s,a) = V(s) + A(s,a)$라는 단순한 합산 방식은 **식별성 문제**를 일으킵니다.

- **문제의 본질:** 하나의 Q-value에 대해 $V$와 $A$를 유일하게 결정할 수 없다는 것입니다. 예를 들어 $Q(s,a)=V(s)+A(s,a)=(V(s)+c)+(A(s,a)-c)$와 같이 무수히 많은 조합이 가능합니다. 이 때문에 $V$와 $A$가 각각 $V(s)$와 $A(s,a)$의 좋은 추정치가 되지 못합니다.
- **해결 방법:** 이 문제를 해결하기 위해 가장 좋은 행동의 어드밴티지 값을 0으로 강제하거나, 모든 어드밴티지 값의 평균을 빼주는 방식을 사용합니다.
- **방법 1 (최댓값 빼기)**

![Dueling DQN max subtract aggregator](/assets/img/posts/rl-deep-reinforcement-learning/dueling-max-subtract.png)

- **방법 2 (평균값 빼기)**

![Dueling DQN mean subtract aggregator](/assets/img/posts/rl-deep-reinforcement-learning/dueling-mean-subtract.png)

### **5.4 Dueling DQN의 구현**

- Dueling DQN은 네트워크의 마지막 부분에 합산 모듈을 추가하여 구현됩니다.
- $V(s)$ 스트림은 단일 스칼라 값을, $A(s,a)$ 스트림은 행동의 개수 $|A|$만큼의 값을 출력합니다.
- 이 모든 과정은 순방향 전파와 역전파(backpropagation)를 통해 함께 학습됩니다. 특별한 알고리즘적 수정 없이 $V(s)$와 $A(s,a)$가 동시에 계산됩니다.
- 이 네트워크 구조는 Q-value의 순위를 유지하므로, $\epsilon$-greedy와 같은 탐색 정책을 그대로 사용할 수 있습니다. 행동을 결정할 때는 $A$ 스트림의 출력만 봐도 충분합니다.

## **6. Policy Gradient (정책 경사) 알고리즘**

Policy Gradient 알고리즘은 연속적인 행동 공간(continuous action spaces)을 가진 강화학습 문제에 널리 사용됩니다. DQN이 Q-value를 학습하여 최적의 행동을 간접적으로 찾는 것과 달리, Policy Gradient는 최적의 정책(policy) $\pi$를 **직접적으로 학습**합니다.

- **정책 $\pi$:** 상태 $s$가 주어졌을 때 행동 $a$를 선택할 확률 분포 $\pi(a \mid s; \theta)$로 표현됩니다. 여기서 $\theta$는 정책을 결정하는 파라미터(신경망의 가중치)입니다.
- **학습 과정:** 정책 네트워크는 특정 상태에서 각 행동을 선택할 확률을 출력합니다. 에이전트는 이 확률에 따라 행동을 선택하고, 그 결과로 얻은 보상에 따라 정책 파라미터 $\theta$를 업데이트합니다. 목표는 **총 보상(total reward)을 최대화**하는 것입니다.

**DQN과의 차이점**

- DQN은 Q-value를 학습하여 **최적의 행동을 간접적으로** 찾지만, Policy Gradient는 **최적의 정책을 직접적으로 학습**합니다.
- DQN은 경험 재생(Experience Replay)을 사용하지만, Policy Gradient는 보통 사용하지 않습니다.

### **6.1 Policy Gradient Theorem**

**목표 함수(Objective function) $J(\theta)$:** 에이전트가 얻는 총 보상의 기댓값입니다.

![Policy gradient objective](/assets/img/posts/rl-deep-reinforcement-learning/policy-gradient-objective.png)

$\tau$는 에이전트가 환경에서 얻는 궤적(trajectory)을 의미합니다.

이 목표 함수를 최대화하기 위해 **경사 상승법(gradient ascent)**을 사용합니다. 즉, 정책 파라미터 $\theta$를 아래와 같이 업데이트합니다.

![Policy gradient update](/assets/img/posts/rl-deep-reinforcement-learning/policy-gradient-update.png)

$\alpha$는 학습률입니다.

**정책 경사 정리**는 이 복잡한 식을 계산하는 방법을 제시합니다.

![Policy gradient theorem](/assets/img/posts/rl-deep-reinforcement-learning/policy-gradient-theorem.png)

- 이 식은 궤적 $\tau$ 전체의 총 보상 $r(\tau)$과 각 시점의 로그 정책 확률의 기울기 $\nabla_\theta \log \pi(a_t \mid s_t; \theta)$를 곱한 값의 기댓값으로 표현됩니다.
- 이 정리는 **환경의 동적 모델 $p(s_{t+1} \mid s_t, a_t)$을 알 필요가 없어 매우 유용**합니다.
- 에이전트가 환경 모델을 알 필요가 없고, 기댓값을 **샘플링**을 통해 근사할 수 있습니다. 즉, 여러 궤적을 생성하고 평균을 내어 기울기를 계산합니다.

## **7. REINFORCE**

REINFORCE는 **몬테카를로(Monte Carlo)** 방법을 사용하여 정책 경사 정리를 구현한 대표적인 알고리즘입니다.

![REINFORCE algorithm](/assets/img/posts/rl-deep-reinforcement-learning/reinforce-algorithm.png)

### **7.1 REINFORCE with Baseline (기준선이 있는 REINFORCE)**

REINFORCE 알고리즘은 샘플링된 궤적에 따라 기울기의 **분산(variance)이 매우 커질 수 있다**는 문제가 있습니다. 이를 해결하기 위해 기준선(baseline) $b(s_t)$를 도입합니다.

- **기준선:** 행동 $a$와 무관한 함수라면 어떤 것도 기준선이 될 수 있습니다.
- **목표 함수 수정:** 총 보상 대신 $G_t - b(s_t)$를 사용합니다.

![REINFORCE with baseline](/assets/img/posts/rl-deep-reinforcement-learning/reinforce-baseline.png)

- 기준선 $b(s_t)$를 추가해도 **기울기의 기댓값은 변하지 않아** 편향(bias)이 생기지 않습니다.
- 분산을 효과적으로 줄여 학습의 안정성을 높입니다.
- 좋은 기준선으로는 현재 상태 $s$의 가치인 상태 가치 함수(state-value function) $V(s)$를 사용하는 것이 일반적입니다.

![Baseline as state value function](/assets/img/posts/rl-deep-reinforcement-learning/baseline-state-value.png)

### **7.2 DQN vs Policy Gradient**

- **DQN:** Q-learning 기반으로, CNN을 이용한 Q-function approximation을 사용합니다.
- **Policy Gradient:** 정책을 직접 학습합니다.
- **명시적 정책:** Policy Gradient는 정책을 직접 학습하기 때문에 더 원리적인 접근법으로 여겨집니다.
- **Q-value 불필요:** Q-function을 계산할 필요 없이 최적의 행동을 직접 학습합니다.
- **경험 재생:** Policy Gradient는 총 보상을 사용하므로 경험 재생이 필요하지 않습니다.
- **구현의 용이성:** Policy Gradient는 DQN보다 코딩이 더 간단한 경우가 많습니다.

AlphaGo와 같은 복잡한 시스템에서는 Policy Gradient와 몬테카를로 트리 탐색(MCTS)을 결합하여 사용하기도 합니다.

## **8. Actor-Critic**

Actor-Critic 방법은 강화학습에서 **두 개의 신경망**을 사용하여 정책을 학습하는 방식입니다.

1. **Actor 네트워크:** 정책 $\pi(a \mid s)$를 담당합니다. 주어진 상태 $s$에서 어떤 행동 $a$를 할지 확률적으로 결정하는 역할을 합니다. Policy Gradient 방법을 사용하여 정책 파라미터 $\theta$를 업데이트합니다.
2. **Critic 네트워크:** 가치 함수 $V(s)$ 또는 $Q(s,a)$를 담당합니다. Actor가 선택한 행동과 그로 인한 상태의 가치를 **평가**하는 역할을 하며, 이를 통해 정책 업데이트를 돕습니다. Critic은 가치 함수 파라미터 $\phi$를 업데이트합니다.

### **8.1 Actor-Critic의 장점**

- **분산 감소:** REINFORCE와 같은 순수 Policy Gradient 방식은 에피소드 전체의 총 보상 $G_t$를 사용하기 때문에 분산이 큽니다. Critic이 제공하는 가치 정보, 예를 들어 $G_t - V(s_t)$를 사용하면 이 **분산을 효과적으로 줄여** 학습의 안정성을 높일 수 있습니다.
- **온라인 학습의 편리성:** REINFORCE는 하나의 에피소드가 끝난 후에야 업데이트가 가능하지만, Actor-Critic은 **TD(Temporal Difference) 방법**을 사용하여 각 스텝마다 즉시 업데이트할 수 있어 **온라인 학습**에 적합합니다.
- **학습 가속화:** 분산 감소로 인해 모델이 더 안정적으로 학습하고, TD 방법을 통해 더 자주 업데이트되므로 **학습 속도가 빨라집니다**.

### **8.2 Actor-Critic의 역할**

**Critic**

![Critic update](/assets/img/posts/rl-deep-reinforcement-learning/actor-critic-critic.png)

- **가치 함수 추정:** 현재 상태의 가치 $V(s)$를 추정합니다.
- **손실 함수 최소화:** 추정한 가치와 실제 타겟 값, 예를 들어 $G_t$ 또는 $r_{t+1}+V(s_{t+1})$ 사이의 오차를 최소화하는 방향으로 파라미터 $\phi$를 업데이트합니다.

**Actor**

![Actor update](/assets/img/posts/rl-deep-reinforcement-learning/actor-critic-actor.png)

- **정책 업데이트:** Critic이 제공하는 평가를 바탕으로 정책 파라미터 $\theta$를 업데이트합니다.

### **8.3 다양한 Policy Gradient 형태**

Policy Gradient는 여러 가지 동등한 형태로 표현될 수 있으며, 각각 다른 Critic과 결합하여 사용됩니다.

![Policy gradient forms](/assets/img/posts/rl-deep-reinforcement-learning/policy-gradient-forms.png)

### **8.4 Actor-Critic 알고리즘의 일반적인 흐름**

1. **초기화:** Critic 네트워크와 Actor 네트워크를 무작위로 초기화합니다.
2. **에피소드 진행:** 에이전트는 현재 정책 $\pi$에 따라 행동 $a$를 선택합니다.
3. 환경과 상호작용하여 보상 $r$과 다음 상태 $s^{\prime}$를 얻습니다.
4. **Critic 업데이트:** TD error $\delta = r + V(s^{\prime}) - V(s)$를 계산하여 Critic 네트워크를 업데이트합니다. 이는 Critic 자신의 예측을 개선하는 과정입니다.
5. **Actor 업데이트:** Critic이 계산한 TD error $\delta$를 사용하여 Actor 네트워크를 업데이트합니다. $\delta$가 클수록 해당 행동에 대한 정책의 확률을 높이는 방향으로 학습합니다.
6. 다음 상태 $s^{\prime}$로 이동하여 과정을 반복합니다.

이러한 협력적인 학습을 통해 Actor는 Critic의 피드백을 받아 정책을 개선하고, Critic은 Actor의 경험을 통해 가치 예측을 더 정확하게 만듭니다.

![Actor-Critic flow](/assets/img/posts/rl-deep-reinforcement-learning/actor-critic-flow.png)

## **9. A3C (Asynchronous Advantage Actor-Critic)**

A3C는 **비동기적 병렬 학습**이라는 아이디어를 도입한 Actor-Critic 알고리즘입니다. 여러 개의 에이전트가 동시에, 그리고 서로에게 영향을 주지 않고 독립적으로 학습하는 것이 핵심입니다.

### **9.1 A3C의 구조와 작동 방식**

- **Global Network:** A3C의 중심에는 모든 워커가 공유하는 하나의 글로벌 네트워크가 있습니다. 이 네트워크는 Actor와 Critic의 파라미터 $(\theta, \phi)$를 가지고 있습니다.
- **Worker Agents:** 여러 개의 워커가 병렬로 작동하며, 각 워커는 자신만의 환경 복사본을 가지고 있습니다. 예를 들어 여러 명의 에이전트가 각자 다른 환경에서 같은 게임을 하는 것과 비슷합니다.
- **비동기적 업데이트:** 각 워커는 글로벌 네트워크에서 최신 파라미터를 복사해와서 자신의 환경에서 $t_{\max}$ 스텝만큼 경험을 쌓습니다. 이 경험을 바탕으로 Actor와 Critic의 기울기를 계산한 후, **자신의 차례가 되는 대로** 글로벌 네트워크를 업데이트합니다. 다른 워커의 업데이트가 끝날 때까지 기다리지 않습니다.

### **9.2 A3C의 주요 장점**

- **경험의 비상관화(Decorrelation):** DQN은 Experience Replay를 사용해 경험 간의 시간적 상관관계를 끊어주지만, A3C는 이 과정을 생략합니다. 여러 워커가 각기 다른 시점에서 다양한 경험을 쌓기 때문에 경험 자체가 이미 서로 독립적입니다. 이는 메모리와 연산량을 크게 줄여줍니다.
- **온라인 학습:** 각 스텝마다 기울기를 계산하고 업데이트하는 TD 방식을 사용하기 때문에, 에피소드가 끝날 때까지 기다릴 필요가 없습니다. 이는 온라인 학습에 매우 유리합니다.
- **CPU 친화적:** A3C는 병렬 처리를 위해 여러 개의 스레드를 사용하므로, GPU 없이도 멀티코어 CPU에서 효율적으로 실행될 수 있습니다.

### **9.3 어드밴티지 함수(Advantage Function)의 활용**

- **어드밴티지의 의미:** A3C는 어드밴티지라는 개념을 사용합니다. 어드밴티지 $A(s,a)$는 특정 상태 $s$에서 행동 $a$를 했을 때, 예상했던 것보다 얼마나 더 좋거나 나빴는지를 나타냅니다. 단순히 보상이 좋고 나쁨을 판단하는 것을 넘어, 예상치를 뛰어넘는 보상에 더 집중하게 해줍니다.
- **N-step return $G_t^{(n)}$:** A3C는 어드밴티지를 계산할 때, Q-value인 $Q(s,a)$를 직접 추정하지 않고 **N-step return**을 사용합니다.

![A3C N-step return](/assets/img/posts/rl-deep-reinforcement-learning/a3c-n-step-return.png)

이 값은 $n$ step 동안의 실제 보상과 마지막 상태의 가치 $V$를 합친 것입니다. 이 방식은 분산을 줄이면서 학습 속도를 가속하는 데 큰 도움이 됩니다.

![A3C overview](/assets/img/posts/rl-deep-reinforcement-learning/a3c-overview.png)

## **10. A2C (Advantage Actor-Critic)**

A2C는 A3C의 **동기식** 버전입니다. A3C의 비동기 업데이트 방식이 초래하는 문제점을 해결하기 위해 등장했습니다.

### **10.1 동기식 업데이트의 필요성**

A3C에서는 여러 워커가 서로 다른 시점의 파라미터를 가지고 학습하기 때문에, 각 워커의 업데이트가 최신 정보가 아닐 수 있습니다. 이렇게 되면 여러 워커의 기울기가 합쳐졌을 때 최적의 방향이 아닐 수 있다는 문제가 발생합니다.

### **10.2 A2C의 해결책**

- A2C는 코디네이터(Coordinator)를 도입하여 모든 워커를 동기화합니다.
- 모든 워커는 정해진 $t_{\max}$ step을 마칠 때까지 **기다립니다**.
- 모든 워커가 기울기 계산을 끝내면, 코디네이터는 이를 한데 모아 **하나의 큰 배치(batch) 업데이트**를 수행합니다.
- 다음 반복에서는 모든 워커가 **완전히 동일하고 최신 파라미터**를 가지고 시작합니다.

### **10.3 A2C의 장점**

- **학습의 일관성:** 동기식 업데이트 덕분에 학습이 더 안정적이고 일관성이 높아져, 때로는 A3C보다 수렴 속도가 빠를 수 있습니다.
- **GPU 효율:** A3C는 각 워커가 CPU 코어를 사용하는 반면, A2C는 여러 워커의 기울기를 한데 모아 **GPU를 활용한 대규모 배치 연산**에 매우 효율적입니다.

요약하자면, A3C는 빠른 비동기 업데이트를 통해 학습 속도를 높이고, A2C는 안정적인 동기식 업데이트를 통해 학습의 일관성과 GPU 효율성을 높였다고 볼 수 있습니다.
