---
title: "OhDRL: MDP에서 MPO까지 이어지는 강화학습"
date: 2026-07-28 01:20:00 +0900
last_modified_at: 2026-07-28 01:25:00 +0900
categories: [RL, Study]
tags: [reinforcement-learning, deep-reinforcement-learning, mdp, bellman-equation, dynamic-programming, monte-carlo, temporal-difference, dqn, policy-gradient, actor-critic, ppo, distributional-rl, mpo]
description: "직접 작성하고 필기한 OhDRL.pdf 164페이지를 따라 MDP, Bellman equation, DP, RL, DQN, Policy Gradient, Distributional RL, MPO가 이어지는 전체 흐름을 정리한다."
math: true
image:
  path: /assets/img/posts/rl/ohdrl-complete-flow/00-ohdrl-overview.jpg
  alt: MDP에서 MPO까지 이어지는 OhDRL 전체 목차
---

강화학습을 공부하면서 만든 `OhDRL.pdf`는 총 164페이지다. 처음에는 MDP, Bellman equation, Dynamic Programming을 각각 분리해서 봤고, 이후 MC·TD·Q-Learning, DQN, Policy Gradient, Distributional RL, MPO까지 범위를 넓혔다.

개념을 하나씩 볼 때는 이해한 것 같았지만 전체를 다시 펼쳐 보면 질문이 남았다.

- Bellman equation은 DQN과 어디에서 다시 만나는가?
- Policy Gradient는 Q-Learning과 완전히 다른 길인가?
- TRPO, PPO, MPO는 모두 정책 변화를 제한하는데 무엇이 다른가?
- Distributional RL은 기존 value learning의 무엇을 바꾼 것인가?

이 글은 그 질문에 답하기 위한 **전체 지도**다. 기존 A1~A8은 각 주제를 따로 공부한 기록으로 그대로 유지하고, 여기서는 PDF 1페이지부터 마지막 페이지까지 한 번에 따라간다. 내용 일부가 겹치는 것도 의도적이다. 세부 개념을 따로 파고든 기록과, 그 개념들이 어떤 순서로 이어졌는지를 복원하는 통합 기록은 역할이 다르기 때문.

![OhDRL 전체 목차](/assets/img/posts/rl/ohdrl-complete-flow/00-ohdrl-overview.jpg)

*직접 작성한 `OhDRL.pdf`, p.1. MDP에서 MPO까지 공부한 전체 순서.*

## **0. 먼저 전체 흐름**

PDF의 장 구분과 기존 세부 글은 다음처럼 대응한다.

| 기록 | PDF 범위 | 핵심 질문 | 세부 글 |
| --- | --- | --- | --- |
| A1 | p.5–16 | 강화학습 문제를 어떻게 정의하는가? | [MDP](/posts/mdp/) |
| A2 | p.17–25 | 미래 보상을 재귀식으로 어떻게 표현하는가? | [Bellman Equation](/posts/bellman-equation/) |
| A3 | p.26–39 | 환경 모델을 안다면 최적 정책을 어떻게 계산하는가? | [Dynamic Programming](/posts/dynamic-programming/) |
| A4 | p.40–62 | 모델을 모를 때 경험으로 어떻게 추정하는가? | [Reinforcement Learning](/posts/reinforcement-learning/) |
| A5 | p.63–102 | 표를 쓸 수 없을 만큼 상태가 커지면 어떻게 하는가? | [Deep Reinforcement Learning](/posts/deep-reinforcement-learning/) |
| A6 | p.103–124 | 연속 행동과 불안정한 정책 업데이트를 어떻게 다루는가? | [Policy Gradient DRL](/posts/policy-gradient-drl/) |
| A7 | p.125–142 | 평균 Q값이 버리는 return 정보를 어떻게 보존하는가? | [Distributional RL](/posts/distributional-reinforcement-learning/) |
| A8 | p.143–164 | 안정성과 데이터 효율을 추론 관점에서 어떻게 결합하는가? | [MPO](/posts/maximum-a-posteriori-policy-optimisation/) |

한 줄로 압축하면 다음과 같다.

> **문제를 MDP로 정의하고, Bellman equation으로 시간축을 접은 뒤, 알려진 모델에서는 DP로 계산하고 알려지지 않은 모델에서는 표본으로 학습한다. 상태가 커지면 신경망을 붙이고, 행동과 정책 업데이트가 어려워지면 Policy Gradient 계열로 넘어간다. 이후 value의 표현을 분포로 확장하거나, policy improvement 자체를 확률적 추론으로 다시 해석한다.**

### **0.1 알고리즘 이름보다 먼저 볼 네 가지 축**

전체 글에서 계속 확인할 기준:

| 축 | 확인할 질문 |
| --- | --- |
| **Representation** | 무엇을 저장하거나 근사하는가? $V$, $Q$, policy, return distribution |
| **Target** | 학습 목표는 실제 return인가, bootstrap target인가? |
| **Data** | 현재 policy의 데이터만 쓰는가, 과거 데이터도 재사용하는가? |
| **Improvement constraint** | policy가 너무 크게 변하지 않도록 무엇으로 제한하는가? |

이 네 축을 잡아 두면 수십 개 알고리즘도 서로 단절된 이름으로 보이지 않는다.

## **1. Deep Reinforcement Learning은 어디에 놓이는가**

PDF의 첫 네 페이지는 ML, DL, RL의 관계부터 시작한다.

- **Supervised Learning:** 정답 label이 있는 데이터에서 입력과 출력의 관계 학습
- **Unsupervised Learning:** label 없이 데이터의 구조나 분포 발견
- **Reinforcement Learning:** 정답 행동 대신 환경이 주는 reward를 통해 장기적인 행동 전략 학습

강화학습 데이터는 고정된 dataset만으로 주어지지 않는다. 현재 policy가 행동하고, 그 행동이 다음에 보게 될 데이터까지 바꾼다.

$$
S_t
\xrightarrow{A_t\sim\pi(\cdot\mid S_t)}
(R_{t+1},S_{t+1})
$$

**Deep RL = Deep Learning + Reinforcement Learning.** 신경망은 이미지나 연속 센서처럼 큰 상태를 표현하고, RL은 그 표현 위에서 장기 의사결정을 학습한다.

![Deep Reinforcement Learning의 위치](/assets/img/posts/rl/ohdrl-complete-flow/01-deep-rl-context.jpg)

*직접 작성한 `OhDRL.pdf`, p.4. RL의 순차 의사결정과 DL의 함수 근사를 결합한 DRL.*

여기서 신경망부터 시작하지 않는 이유가 중요하다. 신경망이 무엇을 출력해야 하는지 알려면 먼저 **문제, 가치, 최적성**을 정의해야 한다. 그 출발점이 MDP.

## **2. MDP: 강화학습 문제의 문법**

### **2.1 Grid world에서 시작하는 이유**

Grid world는 단순하지만 강화학습의 핵심 요소를 모두 갖는다.

- 칸의 위치: state
- 상하좌우 이동: action
- 도착 또는 위험 지점: reward
- 미끄러질 가능성: stochastic transition
- 각 칸에서 선택할 행동: policy

![Grid world 예시](/assets/img/posts/rl/ohdrl-complete-flow/02-gridworld.jpg)

*직접 작성한 `OhDRL.pdf`, p.6. 상태, 행동, 보상, 목표가 한 화면에 들어간 Grid world.*

결정론적 환경에서는 같은 $(s,a)$가 항상 같은 $s'$를 만든다. 확률적 환경에서는 의도한 방향으로 갈 확률과 옆으로 미끄러질 확률이 함께 존재한다. Policy가 행동을 골라도 결과까지 완전히 결정하는 것은 아니라는 뜻.

### **2.2 Markov property**

상태 $S_t$가 Markov property를 만족한다는 것은 현재 상태가 주어졌을 때 미래가 과거 이력과 조건부 독립이라는 의미다.

$$
\Pr(S_{t+1}\mid S_t,A_t,S_{t-1},A_{t-1},\ldots)
=
\Pr(S_{t+1}\mid S_t,A_t)
$$

“과거를 무조건 버려도 된다”는 뜻은 아니다. 미래 예측에 필요한 과거 정보가 있다면 그 정보까지 포함해 **state를 다시 정의**해야 한다.

로봇의 현재 위치만으로 속도를 알 수 없다면 위치 하나는 Markov state가 아닐 수 있다. 위치와 속도를 함께 넣거나, 여러 관측을 쌓거나, recurrent state를 사용하는 이유가 여기서 나온다.

### **2.3 MDP tuple**

Discounted MDP를 다음 tuple로 둔다.

$$
\mathcal{M}
=
(\mathcal{S},\mathcal{A},p,r,\gamma)
$$

![MDP의 구성 요소](/assets/img/posts/rl/ohdrl-complete-flow/03-mdp-tuple.jpg)

*직접 작성한 `OhDRL.pdf`, p.9. MDP tuple과 model-based/model-free 분기.*

- $\mathcal{S}$: state space
- $\mathcal{A}$: action space
- $p(s'\mid s,a)$: 상태 $s$에서 행동 $a$를 했을 때 다음 상태 $s'$로 갈 전이확률
- $r(s,a,s')$: 해당 transition에서 받을 immediate reward의 기대값
- $\gamma\in[0,1]$: discount factor

보상 자체도 확률변수라면 전이와 보상을 joint distribution 하나로 묶을 수도 있다.

$$
p(s',r\mid s,a)
=
\Pr(S_{t+1}=s',R_{t+1}=r\mid S_t=s,A_t=a)
$$

환경 모델을 안다는 것은 이 확률 구조를 계산에 사용할 수 있다는 뜻이다.

### **2.4 Reward와 Return**

Reward $R_{t+1}$은 한 step의 피드백. Policy가 최대화하려는 것은 한 번의 reward가 아니라 누적된 return이다.

$$
G_t
=
R_{t+1}
+
\gamma R_{t+2}
+
\gamma^2R_{t+3}
+\cdots
$$

![Reward를 장기 return으로 묶는 과정](/assets/img/posts/rl/ohdrl-complete-flow/04-return.jpg)

*직접 작성한 `OhDRL.pdf`, p.14. Discounted return과 $\gamma$의 역할.*

$\gamma$가 작으면 가까운 reward를 강하게 보고, 1에 가까우면 먼 미래까지 오래 본다. 단순한 “미래를 덜 중요하게 보는 취향”만은 아니다. 무한 horizon return을 유한하게 만들고, 추정 문제의 수치적 성질에도 영향을 준다.

### **2.5 Policy와 목표**

확률적 policy:

$$
\pi(a\mid s)
=
\Pr(A_t=a\mid S_t=s)
$$

결정적 policy:

$$
a=\mu(s)
$$

MDP의 목적은 기대 return을 최대화하는 optimal policy $\pi^*$를 찾는 것.

$$
\pi^*
\in
\arg\max_\pi
\mathbb{E}_{\tau\sim\pi}
\left[
\sum_{t=0}^{\infty}\gamma^tR_{t+1}
\right]
$$

하지만 policy 후보를 전부 실행해 볼 수는 없다. 각 state와 action이 장기적으로 얼마나 좋은지 나타낼 압축된 평가값이 필요하다. Value function의 등장.

## **3. Bellman Equation: 긴 미래를 한 step으로 접기**

### **3.1 State value와 action value**

정책 $\pi$ 아래에서 state의 가치:

$$
v_\pi(s)
=
\mathbb{E}_\pi[G_t\mid S_t=s]
$$

state에서 특정 action까지 고정한 가치:

$$
q_\pi(s,a)
=
\mathbb{E}_\pi[G_t\mid S_t=s,A_t=a]
$$

![State value와 action value](/assets/img/posts/rl/ohdrl-complete-flow/05-value-functions.jpg)

*직접 작성한 `OhDRL.pdf`, p.18. $v_\pi$, $q_\pi$, advantage의 관계.*

둘의 관계:

$$
v_\pi(s)
=
\sum_a\pi(a\mid s)q_\pi(s,a)
$$

Advantage는 action value에서 state의 평균적 가치를 뺀 상대적 이득.

$$
A_\pi(s,a)
=
q_\pi(s,a)-v_\pi(s)
$$

이 식은 나중에 Actor-Critic, TRPO, PPO까지 계속 다시 나온다.

### **3.2 Bellman expectation equation**

Return을 첫 reward와 나머지 return으로 분해하면:

$$
G_t
=
R_{t+1}
+
\gamma G_{t+1}
$$

따라서:

$$
v_\pi(s)
=
\mathbb{E}_\pi
\left[
R_{t+1}
+
\gamma v_\pi(S_{t+1})
\mid S_t=s
\right]
$$

![Bellman expectation equation의 전개](/assets/img/posts/rl/ohdrl-complete-flow/06-bellman-expectation.jpg)

*직접 작성한 `OhDRL.pdf`, p.20. 기대값을 policy와 transition probability까지 펼친 Bellman equation.*

환경 모델을 알고 있다면 합으로 전개할 수 있다.

$$
v_\pi(s)
=
\sum_a\pi(a\mid s)
\sum_{s',r}
p(s',r\mid s,a)
\left[
r+\gamma v_\pi(s')
\right]
$$

핵심은 먼 미래를 전부 tree로 펼치지 않는다는 점. Bellman equation은 다음 state의 value로 현재 value를 재귀적으로 표현한다. 반복 계산이나 학습에서는 다음 state의 현재 estimate를 가져와 값을 갱신하며, 이 연산이 **backup**. 실제 return을 끝까지 관측하지 않고 현재 estimate를 target에 넣는 방식이 **bootstrapping**이다.

### **3.3 Bellman optimality equation**

현재 policy를 평가하는 데서 멈추지 않고 가장 좋은 action을 선택하면:

$$
v_*(s)
=
\max_a
\sum_{s',r}
p(s',r\mid s,a)
\left[
r+\gamma v_*(s')
\right]
$$

Action value 형태:

$$
q_*(s,a)
=
\sum_{s',r}
p(s',r\mid s,a)
\left[
r+\gamma\max_{a'}q_*(s',a')
\right]
$$

![Bellman optimality equation](/assets/img/posts/rl/ohdrl-complete-flow/07-bellman-optimality.jpg)

*직접 작성한 `OhDRL.pdf`, p.24. Expectation 대신 max가 들어가는 최적 Bellman backup.*

$q_*$를 알면 환경 모델 없이도 greedy action을 바로 고를 수 있다.

$$
\pi_*(s)
\in
\arg\max_a q_*(s,a)
$$

이제 분기점.

- **전이확률과 보상을 아는 경우:** Bellman equation의 합을 직접 계산하는 Dynamic Programming
- **전이확률을 모르는 경우:** 실제 transition을 표본으로 관측하는 Reinforcement Learning

## **4. Dynamic Programming: Known MDP에서의 계산**

### **4.1 Planning과 Learning**

![Known MDP와 Unknown MDP](/assets/img/posts/rl/ohdrl-complete-flow/08-planning-vs-learning.jpg)

*직접 작성한 `OhDRL.pdf`, p.28. 모델을 이용하는 planning과 경험을 이용하는 learning.*

DP는 가능한 다음 상태를 모두 합산하는 **full backup**을 사용한다. 이를 위해 $p(s',r\mid s,a)$를 알아야 한다.

### **4.2 Policy Iteration**

Policy Iteration은 두 단계를 번갈아 수행한다.

**Policy evaluation**

현재 policy $\pi_k$에 일치하는 value를 계산:

$$
v_{\pi_k}(s)
\leftarrow
\sum_a\pi_k(a\mid s)
\sum_{s',r}
p(s',r\mid s,a)
\left[
r+\gamma v_{\pi_k}(s')
\right]
$$

**Policy improvement**

평가한 value를 기준으로 greedy policy 생성:

$$
\pi_{k+1}(s)
\in
\arg\max_a
\sum_{s',r}
p(s',r\mid s,a)
\left[
r+\gamma v_{\pi_k}(s')
\right]
$$

Policy Improvement Theorem은 모든 state에서 새 policy의 선택이 기존 value보다 나쁘지 않다면 전체 policy도 나빠지지 않음을 연결한다.

### **4.3 Value Iteration**

Policy evaluation을 완전히 수렴시킨 뒤 개선하지 않고, 한 번의 optimality backup마다 두 과정을 섞는다.

$$
v_{k+1}(s)
=
\max_a
\sum_{s',r}
p(s',r\mid s,a)
\left[
r+\gamma v_k(s')
\right]
$$

![Value Iteration 예시](/assets/img/posts/rl/ohdrl-complete-flow/09-value-iteration-example.jpg)

*직접 작성한 `OhDRL.pdf`, p.31. Full backup을 반복해 value를 전달하는 자동차 상태 예시.*

| 구분 | Policy Iteration | Value Iteration |
| --- | --- | --- |
| 평가 | 현재 policy를 충분히 평가 | 한 번 또는 짧은 평가 |
| 개선 | 평가 후 명시적으로 수행 | optimality backup 안에 포함 |
| iteration당 비용 | 상대적으로 큼 | 상대적으로 작음 |
| 공통 전제 | 알려진 환경 모델, full backup | 알려진 환경 모델, full backup |

유한 MDP와 적절한 조건에서 둘 다 optimal policy로 수렴한다. 문제는 현실의 모든 state에서 모든 다음 state를 합산하기 어렵다는 점이다.

> **DP의 병목은 Bellman equation이 아니라 full backup에 필요한 정확한 모델과 계산량.**

이제 합을 표본 하나로 바꾼다.

## **5. Reinforcement Learning: Unknown MDP에서의 추정**

### **5.1 Full backup에서 sample backup으로**

![DP와 RL의 backup 차이](/assets/img/posts/rl/ohdrl-complete-flow/10-dp-vs-rl.jpg)

*직접 작성한 `OhDRL.pdf`, p.41. 전체 모델을 합산하는 DP와 관측 transition을 쓰는 RL.*

DP target:

$$
\sum_{s',r}
p(s',r\mid s,a)
\left[
r+\gamma v(s')
\right]
$$

Sample target:

$$
R_{t+1}
+
\gamma v(S_{t+1})
$$

기대값을 정확히 계산하는 대신 표본을 반복해서 보며 추정한다. 이 강의 흐름에서 RL은 주로 model-free sample-based learning을 뜻한다. RL 전체가 반드시 model-free라는 의미는 아니다.

### **5.2 Generalized Policy Iteration**

거의 모든 control 알고리즘 안에는 두 과정이 있다.

1. **Policy evaluation:** 현재 policy가 얼마나 좋은지 추정
2. **Policy improvement:** 더 좋아 보이는 action의 확률 증가

![Generalized Policy Iteration](/assets/img/posts/rl/ohdrl-complete-flow/11-gpi.jpg)

*직접 작성한 `OhDRL.pdf`, p.43. Evaluation과 improvement가 서로를 끌어가는 GPI.*

두 과정이 각각 완전히 끝날 필요는 없다. 한두 번 평가하고 조금 개선해도 서로 상호작용하며 optimal policy 쪽으로 이동할 수 있다. DP, MC, TD, Actor-Critic을 같은 틀에서 볼 수 있는 이유.

### **5.3 Monte Carlo: episode가 끝난 뒤 실제 return 사용**

MC prediction은 episode가 끝난 후 관측한 return $G_t$를 target으로 사용한다.

$$
Q(S_t,A_t)
\leftarrow
Q(S_t,A_t)
+
\alpha
\left[
G_t-Q(S_t,A_t)
\right]
$$

같은 state-action이 한 episode에 여러 번 등장할 때 update 기준도 나뉜다.

- **First-visit MC:** episode에서 처음 등장한 시점의 return만 사용
- **Every-visit MC:** 등장한 모든 시점의 return을 각각 사용

Stationary return의 sample mean을 구한다면 방문 횟수 $N(s,a)$에 따라 $\alpha=1/N(s,a)$를 사용할 수 있다. 최근 경험을 계속 반영해야 하는 non-stationary 문제에서는 고정된 $\alpha$가 더 자연스럽다.

특징:

- 환경 모델 불필요
- bootstrap 없음
- terminal까지 기다려야 함
- 고정된 policy value의 표본으로는 unbiased하지만 variance가 큼

Control에서는 $\epsilon$-greedy로 exploration을 유지한다.

$$
\pi(a\mid s)
=
\begin{cases}
1-\epsilon+\epsilon/|\mathcal A|,&a=\arg\max_{a'}Q(s,a')\\
\epsilon/|\mathcal A|,&\text{otherwise}
\end{cases}
$$

GLIE는 모든 state-action을 무한히 탐색하면서도 극한에서는 greedy policy가 되는 조건. 단순히 $\epsilon=0$으로 빨리 줄이는 것과 다르다.

### **5.4 TD: 끝까지 기다리지 않고 bootstrap**

TD(0)의 state-value update:

$$
V(S_t)
\leftarrow
V(S_t)
+
\alpha
\underbrace{
\left[
R_{t+1}
+
\gamma V(S_{t+1})
-
V(S_t)
\right]
}_{\delta_t}
$$

![Temporal-Difference learning](/assets/img/posts/rl/ohdrl-complete-flow/12-td-learning.jpg)

*직접 작성한 `OhDRL.pdf`, p.51. MC의 episode return과 TD의 one-step bootstrap 비교.*

$\delta_t$는 TD error. 실제 reward 한 개와 다음 value estimate를 섞는다.

### **5.5 Sarsa와 Q-Learning**

Sarsa target:

$$
Y_t^{\text{Sarsa}}
=
R_{t+1}
+
\gamma Q(S_{t+1},A_{t+1})
$$

Q-Learning target:

$$
Y_t^{\text{Q}}
=
R_{t+1}
+
\gamma\max_{a'}Q(S_{t+1},a')
$$

![Sarsa와 Q-Learning](/assets/img/posts/rl/ohdrl-complete-flow/14-sarsa-vs-q-learning.jpg)

*직접 작성한 `OhDRL.pdf`, p.59. Target policy와 behavior policy가 같은 Sarsa, 다른 Q-Learning.*

- **Sarsa:** 실제 behavior가 선택한 $A_{t+1}$을 target에 사용. On-policy.
- **Q-Learning:** behavior가 exploration 중이어도 greedy action을 target에 사용. Off-policy.

Cliff walking에서 Sarsa는 탐색 중 절벽에 떨어질 위험까지 반영해 안전한 길을 선호할 수 있다. Q-Learning은 greedy target의 최단 경로를 학습한다. 어느 쪽이 “항상 더 좋다”가 아니라 어떤 policy를 평가하는지가 다르다.

### **5.6 On-policy, off-policy, importance sampling**

- **Target policy $\pi$:** 배우고 싶은 policy
- **Behavior policy $\mu$:** 데이터를 생성하는 policy

둘이 다르면 $\mu$가 만든 trajectory로 $\pi$의 기대값을 추정해야 한다. Importance sampling ratio:

$$
\rho_{t:T-1}
=
\prod_{k=t}^{T-1}
\frac{\pi(A_k\mid S_k)}
{\mu(A_k\mid S_k)}
$$

분포 차이를 보정할 수 있지만 긴 horizon에서는 ratio의 곱 때문에 variance가 폭증할 수 있다. Off-policy의 데이터 재사용 이점과 추정 불안정성이 함께 생기는 지점.

### **5.7 MC와 TD의 bias–variance**

![MC와 TD의 비교](/assets/img/posts/rl/ohdrl-complete-flow/13-mc-vs-td.jpg)

*직접 작성한 `OhDRL.pdf`, p.57. Return을 끝까지 관측하는 MC와 bootstrap하는 TD.*

| 구분 | MC | TD |
| --- | --- | --- |
| target | 실제 episode return | reward + 현재 추정값 |
| bootstrap | 없음 | 있음 |
| bias | 상대적으로 낮음 | 현재 value error 때문에 생길 수 있음 |
| variance | 높음 | 상대적으로 낮음 |
| update 시점 | episode 종료 후 | 매 step |
| continuing task | 직접 적용 어려움 | 자연스럽게 적용 |

Expected Sarsa는 다음 action 하나를 샘플링하지 않고 policy 아래의 기대 Q를 사용한다.

$$
Y_t^{\text{ExpSarsa}}
=
R_{t+1}
+
\gamma
\sum_{a'}
\pi(a'\mid S_{t+1})Q(S_{t+1},a')
$$

Sarsa보다 target variance를 줄이면서 Q-Learning보다 target policy의 action probability를 명시적으로 반영하는 형태. On-policy 설정에서는 이 target policy가 behavior policy와 같다.

### **5.8 Double Q-Learning**

Q-Learning의 $\max$는 같은 noisy estimate로 action을 선택하고 평가한다. 우연히 큰 오차가 난 action이 선택되기 쉬워 maximization bias 발생.

Double Q-Learning은 선택과 평가를 분리한다.

$$
a^*
=
\arg\max_a Q_A(s',a)
$$

$$
Y
=
r+\gamma Q_B(s',a^*)
$$

![Double Q-Learning](/assets/img/posts/rl/ohdrl-complete-flow/15-double-q-learning.jpg)

*직접 작성한 `OhDRL.pdf`, p.61. 두 estimator가 action selection과 evaluation을 나누는 구조.*

### **5.9 Multi-step과 TD($\lambda$)**

One-step TD와 full-return MC 사이에는 여러 길이의 target이 있다.

$$
G_t^{(n)}
=
\sum_{k=0}^{n-1}\gamma^kR_{t+k+1}
+
\gamma^nV(S_{t+n})
$$

$\lambda$-return은 여러 $n$-step return의 가중합.

$$
G_t^\lambda
=
(1-\lambda)
\sum_{n=1}^{\infty}
\lambda^{n-1}G_t^{(n)}
$$

- $\lambda=0$: one-step TD
- $\lambda\to1$: MC에 가까운 긴 return

Backward view의 eligibility trace는 과거 state-action에 credit을 전달한다. 나중의 GAE, multi-step critic target을 이해하는 기반.

이제 tabular value를 전부 저장할 수 없을 때의 문제로 이동한다.

## **6. Deep Reinforcement Learning: 표를 신경망으로 바꾸기**

### **6.1 Function approximation**

Q-table:

$$
(s,a)\longmapsto Q(s,a)
$$

Deep Q-network:

$$
s
\xrightarrow{\text{neural network}}
\left[
Q(s,a_1),\ldots,Q(s,a_{|\mathcal A|})
\right]
$$

신경망은 비슷한 state 사이에서 정보를 공유하고 이미지 같은 고차원 입력을 처리한다. 대신 tabular update에서 없던 문제가 생긴다.

- 연속된 transition의 강한 상관관계
- 같은 network가 target과 prediction을 동시에 변경
- off-policy + bootstrapping + function approximation의 불안정성
- 한 sample의 update가 다른 state의 출력까지 변경

### **6.2 DQN의 두 핵심 안정화 장치**

![DQN의 핵심 기여](/assets/img/posts/rl/ohdrl-complete-flow/16-dqn-stabilization.jpg)

*직접 작성한 `OhDRL.pdf`, p.69. Experience replay와 target network를 중심으로 한 DQN 안정화.*

**Experience Replay**

transition을 buffer에 저장하고 무작위 minibatch로 재사용한다.

$$
(S_t,A_t,R_{t+1},S_{t+1})
\rightarrow
\mathcal D
$$

시간적으로 인접한 sample의 상관을 줄이고, 한 transition을 여러 update에 활용한다.

**Target Network**

Behavior network $\theta$와 target network $\theta^-$를 분리한다.

$$
Y_t^{\text{DQN}}
=
R_{t+1}
+
\gamma
\max_{a'}
Q(S_{t+1},a';\theta^-)
$$

$$
L(\theta)
=
\mathbb E_{\mathcal D}
\left[
\left(
Y_t^{\text{DQN}}
-
Q(S_t,A_t;\theta)
\right)^2
\right]
$$

Target parameter는 일정 주기마다 복사하거나 천천히 update. 움직이는 target을 잠시 고정하는 장치다.

![DQN의 데이터 흐름](/assets/img/posts/rl/ohdrl-complete-flow/17-dqn-data-flow.jpg)

*직접 작성한 `OhDRL.pdf`, p.71. Environment, behavior Q-network, replay buffer의 관계.*

Atari DQN은 연속 4 frame을 입력으로 사용해 정지 화면 하나에서 알 수 없는 속도와 방향을 표현한다. 앞서 본 Markov state 설계가 실제 network input에서 다시 등장한 사례.

### **6.3 Multi-step DQN**

One-step target 대신 여러 reward를 모은 target:

$$
Y_t^{(n)}
=
\sum_{k=0}^{n-1}\gamma^kR_{t+k+1}
+
\gamma^n
\max_aQ(S_{t+n},a;\theta^-)
$$

Reward 정보가 더 빠르게 전파되지만 horizon이 길수록 variance와 off-policy 보정 문제가 커진다.

### **6.4 Double DQN**

DQN도 max over noisy estimates 때문에 Q를 과대평가할 수 있다.

Behavior network로 action 선택:

$$
a^*
=
\arg\max_aQ(S_{t+1},a;\theta)
$$

Target network로 평가:

$$
Y_t^{\text{DDQN}}
=
R_{t+1}
+
\gamma
Q(S_{t+1},a^*;\theta^-)
$$

![Double DQN](/assets/img/posts/rl/ohdrl-complete-flow/18-double-dqn.jpg)

*직접 작성한 `OhDRL.pdf`, p.77. Action selection과 evaluation의 network를 분리한 Double DQN.*

### **6.5 Prioritized Experience Replay**

Uniform sampling 대신 TD error가 큰 transition을 더 자주 본다.

$$
p_i
=
|\delta_i|+\varepsilon,
\qquad
P(i)
=
\frac{p_i^\alpha}
{\sum_kp_k^\alpha}
$$

Sampling distribution이 바뀌어 생기는 bias는 importance weight로 보정.

$$
w_i
=
\left(
\frac{1}
{N P(i)}
\right)^\beta
$$

큰 error가 항상 “좋은 데이터”라는 보장은 없다. Noise나 outlier도 우선순위가 커질 수 있으므로 $\alpha$, $\beta$, clipping과 결합해 사용한다.

### **6.6 Dueling DQN**

Q를 state value와 action advantage로 분리한다.

$$
Q(s,a)
=
V(s)
+
\left[
A(s,a)
-
\frac{1}{|\mathcal A|}
\sum_{a'}A(s,a')
\right]
$$

![Dueling DQN](/assets/img/posts/rl/ohdrl-complete-flow/19-dueling-dqn.jpg)

*직접 작성한 `OhDRL.pdf`, p.82. State value stream과 advantage stream을 분리한 network.*

$Q=V+A$만 쓰면 같은 상수를 $V$에 더하고 $A$에서 빼도 Q가 같아지는 identifiability 문제가 있다. Advantage의 평균을 0으로 만들어 기준을 고정.

Value-based method는 discrete action에서 $\arg\max_aQ(s,a)$를 쉽게 계산한다. Action이 연속이면 모든 action을 열거할 수 없다. Policy를 직접 출력하는 쪽으로 넘어갈 이유.

## **7. Policy Gradient와 Actor-Critic**

### **7.1 Policy를 직접 미분**

Parameter $\theta$를 가진 policy:

$$
\pi_\theta(a\mid s)
$$

목표:

$$
J(\theta)
=
\mathbb E_{\tau\sim\pi_\theta}
\left[
\sum_t\gamma^tR_{t+1}
\right]
$$

Policy Gradient Theorem:

$$
\nabla_\theta J(\theta)
\propto
\mathbb E_{\pi_\theta}
\left[
Q^{\pi_\theta}(S_t,A_t)
\nabla_\theta
\log\pi_\theta(A_t\mid S_t)
\right]
$$

![Policy Gradient Theorem](/assets/img/posts/rl/ohdrl-complete-flow/20-policy-gradient-theorem.jpg)

*직접 작성한 `OhDRL.pdf`, p.87. Trajectory likelihood의 log-derivative를 이용한 policy gradient.*

Reward가 큰 trajectory에서 실행한 action의 log-probability를 높인다. 환경 dynamics를 미분하지 않고도 policy를 update할 수 있다는 점이 핵심.

### **7.2 REINFORCE와 baseline**

REINFORCE는 MC return을 weight로 사용한다.

$$
\theta
\leftarrow
\theta
+
\alpha
G_t
\nabla_\theta
\log\pi_\theta(A_t\mid S_t)
$$

Unbiased하지만 $G_t$의 variance가 크다. State-dependent baseline을 빼도 기대 gradient는 바뀌지 않는다.

$$
\theta
\leftarrow
\theta
+
\alpha
\left[
G_t-b(S_t)
\right]
\nabla_\theta
\log\pi_\theta(A_t\mid S_t)
$$

$b(S_t)=V(S_t)$로 두면 weight는 advantage estimate가 된다.

### **7.3 Actor-Critic**

![Actor-Critic의 구성](/assets/img/posts/rl/ohdrl-complete-flow/21-actor-critic.jpg)

*직접 작성한 `OhDRL.pdf`, p.93. Policy를 내는 actor와 value를 추정하는 critic.*

- **Actor:** $\pi_\theta(a\mid s)$를 update
- **Critic:** $V_\phi(s)$ 또는 $Q_\phi(s,a)$를 학습

One-step advantage estimate:

$$
\hat A_t
=
R_{t+1}
+
\gamma V_\phi(S_{t+1})
-
V_\phi(S_t)
$$

Actor loss:

$$
L_{\text{actor}}
=
-
\mathbb E
\left[
\log\pi_\theta(A_t\mid S_t)
\hat A_t
\right]
$$

Critic loss:

$$
L_{\text{critic}}
=
\mathbb E
\left[
\left(
R_{t+1}
+
\gamma V_\phi(S_{t+1})
-
V_\phi(S_t)
\right)^2
\right]
$$

REINFORCE의 full return 대신 critic의 bootstrap estimate를 사용하면서 variance를 줄이고 매 step update 가능. 대신 critic bias가 actor update에도 들어온다.

### **7.4 A3C와 A2C**

A3C는 여러 worker가 서로 다른 environment copy에서 trajectory를 모으고 global parameter를 비동기적으로 update한다.

![A3C의 비동기 worker 구조](/assets/img/posts/rl/ohdrl-complete-flow/21a-a3c.jpg)

*직접 작성한 `OhDRL.pdf`, p.98. 여러 worker actor-critic이 global network를 비동기 update하는 A3C.*

- Replay buffer 없이 경험의 상관 완화
- 여러 exploration trajectory
- n-step return
- actor, critic, entropy loss 결합

A2C는 같은 구조를 동기식 batch update로 바꾼 형태. Worker가 모두 rollout을 끝낸 뒤 gradient를 묶어 update하므로 GPU batch 연산과 일관된 parameter version을 사용하기 쉽다.

이제 policy를 직접 학습할 수 있다. 남은 문제는 연속 action과 **한 번의 policy update가 지나치게 클 때 생기는 성능 붕괴**.

## **8. Continuous Control과 제한된 Policy Update**

### **8.1 DDPG: deterministic actor와 off-policy critic**

연속 action에서 DQN식 $\arg\max_aQ(s,a)$는 계산하기 어렵다. DDPG는 actor가 action을 직접 낸다.

$$
a=\mu_\theta(s)
$$

Critic target:

$$
Y_t
=
R_{t+1}
+
\gamma
Q_{\phi^-}
\left(
S_{t+1},
\mu_{\theta^-}(S_{t+1})
\right)
$$

Actor gradient:

$$
\nabla_\theta J
\approx
\mathbb E
\left[
\nabla_aQ_\phi(s,a)
\big|_{a=\mu_\theta(s)}
\nabla_\theta\mu_\theta(s)
\right]
$$

![DDPG의 actor와 critic update](/assets/img/posts/rl/ohdrl-complete-flow/22-ddpg.jpg)

*직접 작성한 `OhDRL.pdf`, p.107. DQN의 replay·target network와 deterministic actor를 결합한 DDPG.*

DDPG의 구성:

- Replay buffer
- Behavior actor/critic
- Target actor/critic
- Soft target update
- Deterministic policy 밖에 exploration noise 추가

$$
a_t
=
\mu_\theta(s_t)
+
\mathcal N_t
$$

Off-policy 데이터 재사용은 효율적이지만 critic error가 actor를 잘못된 방향으로 강하게 끌 수 있다.

### **8.2 TRPO: parameter 거리가 아니라 policy 거리를 제한**

같은 크기의 parameter update라도 network 위치에 따라 action distribution을 크게 바꿀 수 있다. TRPO는 expected return의 local surrogate를 개선하되 old/new policy의 KL divergence를 제한한다.

$$
\max_\theta
\quad
\mathbb E_t
\left[
\frac{
\pi_\theta(A_t\mid S_t)
}{
\pi_{\theta_{\text{old}}}(A_t\mid S_t)
}
\hat A_t
\right]
$$

subject to:

$$
\mathbb E_t
\left[
D_{\mathrm{KL}}
\left(
\pi_{\theta_{\text{old}}}(\cdot\mid S_t)
\Vert
\pi_\theta(\cdot\mid S_t)
\right)
\right]
\le\delta
$$

![TRPO의 trust region 직관](/assets/img/posts/rl/ohdrl-complete-flow/23-trpo-intuition.jpg)

*직접 작성한 `OhDRL.pdf`, p.110. 너무 작은 step, 너무 큰 step, trust region.*

논문의 monotonic improvement 논리는 performance bound와 surrogate objective에서 출발하지만, 실제 TRPO는 여러 근사를 사용한다. 따라서 구현된 neural policy가 매 iteration 엄밀히 단조 개선한다고 단순화하면 안 된다.

### **8.3 Natural Policy Gradient**

KL divergence의 2차 근사에는 Fisher Information Matrix $F$가 나타난다.

일반 gradient:

$$
\Delta\theta
\propto
g
$$

Natural gradient:

$$
\Delta\theta
\propto
F^{-1}g
$$

Parameter 좌표의 Euclidean steepest direction이 아니라 policy distribution 공간의 geometry를 반영한다. TRPO는 conjugate gradient와 line search로 큰 Fisher matrix의 inverse를 직접 만들지 않고 trust-region step을 근사한다.

### **8.4 PPO: clipped surrogate**

Probability ratio:

$$
r_t(\theta)
=
\frac{
\pi_\theta(A_t\mid S_t)
}{
\pi_{\theta_{\text{old}}}(A_t\mid S_t)
}
$$

Clipped objective:

$$
L^{\text{CLIP}}(\theta)
=
\mathbb E_t
\left[
\min
\left(
r_t(\theta)\hat A_t,
\operatorname{clip}
\left(
r_t(\theta),1-\epsilon,1+\epsilon
\right)
\hat A_t
\right)
\right]
$$

![PPO clipped objective](/assets/img/posts/rl/ohdrl-complete-flow/24-ppo.jpg)

*직접 작성한 `OhDRL.pdf`, p.123. Ratio clipping으로 policy update의 추가 이득을 제한하는 PPO.*

Clipping은 ratio가 범위를 벗어났을 때 objective의 이득을 잘라낸다. 모든 state에서 실제 KL이 반드시 제한된다는 hard constraint는 아니다. 실무에서는 observed KL, entropy, value loss, gradient norm도 함께 확인한다.

| 알고리즘 | Data | Policy | 핵심 안정화 |
| --- | --- | --- | --- |
| DDPG | off-policy replay | deterministic | target networks, soft update |
| TRPO | on-policy | stochastic | explicit average KL constraint |
| NPG | 주로 on-policy | stochastic | Fisher geometry |
| PPO | on-policy | stochastic | clipped surrogate |

여기까지는 value를 하나의 기대값으로 다뤘다. 다음 장은 policy update가 아니라 **critic이 표현하는 대상**을 바꾼다.

## **9. Distributional RL: 평균 Return에서 분포로**

### **9.1 Q는 return distribution의 평균**

Return을 확률변수로 쓰면:

$$
Z^\pi(s,a)
=
\sum_{t=0}^{\infty}
\gamma^tR_{t+1}
$$

기존 Q는 그 평균.

$$
Q^\pi(s,a)
=
\mathbb E
\left[
Z^\pi(s,a)
\right]
$$

같은 평균을 갖는 두 action도 variance, 꼬리, multimodality는 다를 수 있다.

![기대값이 숨기는 return distribution](/assets/img/posts/rl/ohdrl-complete-flow/25-mean-hides-risk.jpg)

*직접 작성한 `OhDRL.pdf`, p.127. 평균 통근 시간은 같지만 위험 구조가 다른 예시.*

### **9.2 Distributional Bellman equation**

$$
Z^\pi(s,a)
\overset{D}{=}
R(s,a)
+
\gamma
Z^\pi(S',A')
$$

$\overset{D}{=}$는 값 하나가 아니라 분포가 같다는 뜻.

고정 policy evaluation의 distributional Bellman operator는 적절한 Wasserstein metric에서 contraction 성질을 갖는다. Control에서는 greedy policy가 함께 바뀌므로 같은 안정성이 일반적으로 유지되지 않는다. 실제 알고리즘은 표현 가능한 distribution family로 projection하거나 quantile loss를 사용한다.

![Distributional RL 알고리즘의 표현 차이](/assets/img/posts/rl/ohdrl-complete-flow/26-distributional-overview.jpg)

*직접 작성한 `OhDRL.pdf`, p.131. Scalar DQN에서 C51, QR-DQN, IQN으로.*

### **9.3 C51**

고정 support:

$$
z_i
=
V_{\min}
+
i\Delta z,
\qquad i=0,\ldots,50
$$

Network는 atom 위치가 아니라 확률 $p_i(s,a)$를 학습한다.

$$
Z_\theta(s,a)
=
\sum_i
p_i(s,a)\delta_{z_i}
$$

Bellman update로 이동한 atom은 고정 support 위에 다시 projection. 장점은 categorical distribution의 단순함, 제약은 $V_{\min}$과 $V_{\max}$를 미리 정해야 한다는 점.

### **9.4 QR-DQN**

확률 질량 $1/N$을 고정하고 quantile 위치를 학습한다.

$$
Z_\theta(s,a)
=
\frac{1}{N}
\sum_{i=1}^{N}
\delta_{\theta_i(s,a)}
$$

![C51과 QR-DQN](/assets/img/posts/rl/ohdrl-complete-flow/27-c51-vs-qr-dqn.jpg)

*직접 작성한 `OhDRL.pdf`, p.134. 고정 위치·학습 확률과 고정 확률·학습 위치의 차이.*

Quantile regression은 과대·과소 오차에 quantile level $\tau$에 따른 비대칭 weight를 준다. 실전에서는 quantile Huber loss를 사용해 미분 안정성을 높인다.

### **9.5 IQN**

QR-DQN이 정해진 quantile set을 출력한다면 IQN은 $\tau\in[0,1]$를 입력으로 받는 quantile function을 학습한다.

$$
Z_\tau(s,a)
\approx
F^{-1}_{Z(s,a)}(\tau)
$$

![IQN의 sampled quantile](/assets/img/posts/rl/ohdrl-complete-flow/28-iqn.jpg)

*직접 작성한 `OhDRL.pdf`, p.139. $\tau$를 sampling해 implicit quantile function을 근사하는 IQN.*

Uniform $\tau$로 평균을 근사하면 risk-neutral action selection. 낮은 quantile을 더 강조하면 risk-averse, 높은 quantile을 강조하면 risk-seeking decision rule을 구성할 수 있다.

중요한 경계:

> **Distribution을 학습하는 것과 risk-sensitive policy를 사용하는 것은 같은 말이 아니다.** 분포를 배운 뒤 action selection에서 어떤 functional을 적용할지 별도로 정해야 한다.

마지막 장의 MPO는 distributional critic의 후속 알고리즘이 아니다. 다른 질문을 다룬다.

- **Distributional RL:** value를 무엇으로 표현할 것인가?
- **MPO:** critic을 이용해 policy를 어떻게 안정적으로 개선할 것인가?

## **10. MPO: Policy Improvement를 추론으로 보기**

### **10.1 출발점**

PPO/TRPO는 안정적이지만 on-policy data를 반복해서 새로 모아야 한다. Off-policy value method는 replay data를 재사용하지만 policy update가 불안정할 수 있다.

![MPO의 문제의식](/assets/img/posts/rl/ohdrl-complete-flow/29-mpo-overview.jpg)

*직접 작성한 `OhDRL.pdf`, p.144. On-policy 안정성과 off-policy 데이터 효율을 함께 얻으려는 MPO.*

MPO는 RL과 probabilistic inference의 연결을 이용해 policy improvement를 두 단계로 나눈다.

1. E-step: Q가 높은 action을 선호하는 non-parametric distribution $q$ 생성
2. M-step: Parametric policy $\pi_\theta$가 $q$를 따라가도록 fitting

이를 이해하기 위해 Bayes, MAP, ELBO, EM이 먼저 등장한다.

### **10.2 Bayes, MLE, MAP**

Bayes' rule:

$$
p(\theta\mid X)
=
\frac{
p(X\mid\theta)p(\theta)
}{
p(X)
}
$$

- Prior $p(\theta)$: 데이터를 보기 전 믿음
- Likelihood $p(X\mid\theta)$: 해당 parameter가 관측을 만들 가능성
- Posterior $p(\theta\mid X)$: 관측 후 갱신된 믿음

MLE:

$$
\theta_{\text{MLE}}
=
\arg\max_\theta
\log p(X\mid\theta)
$$

MAP:

$$
\theta_{\text{MAP}}
=
\arg\max_\theta
\left[
\log p(X\mid\theta)
+
\log p(\theta)
\right]
$$

MAP의 prior term은 parameter가 데이터 likelihood만 따라 과도하게 움직이지 않도록 하는 regularization으로 읽을 수 있다.

### **10.3 ELBO와 EM**

Latent variable $Z$가 있을 때 evidence:

$$
\log p(X)
=
\mathcal L(q,\theta)
+
D_{\mathrm{KL}}
\left(
q(Z)
\Vert
p(Z\mid X,\theta)
\right)
$$

KL은 0 이상이므로:

$$
\log p(X)
\ge
\mathcal L(q,\theta)
$$

ELBO:

$$
\mathcal L(q,\theta)
=
\mathbb E_{q(Z)}
\left[
\log p(X,Z\mid\theta)
-
\log q(Z)
\right]
$$

EM은 두 변수를 번갈아 최적화한다.

- **E-step:** $\theta$를 고정하고 $q$를 개선
- **M-step:** $q$를 고정하고 $\theta$를 개선

![Expectation-Maximization의 E-step과 M-step](/assets/img/posts/rl/ohdrl-complete-flow/29a-em-algorithm.jpg)

*직접 작성한 `OhDRL.pdf`, p.153. Latent distribution과 model parameter를 번갈아 최적화하는 EM.*

### **10.4 RL as Inference**

Optimality variable $O$를 도입하고 높은 reward trajectory일수록 $O=1$일 likelihood를 크게 둔다.

$$
p(O=1\mid\tau)
\propto
\exp
\left(
\frac{1}{\alpha}
\sum_t r_t
\right)
$$

Posterior:

$$
p_\pi(\tau\mid O=1)
\propto
p_\pi(\tau)
p(O=1\mid\tau)
$$

![RL as Inference](/assets/img/posts/rl/ohdrl-complete-flow/30-rl-as-inference.jpg)

*직접 작성한 `OhDRL.pdf`, p.155. Reward maximization을 optimality posterior 추론으로 바꾸는 관점.*

기존 질문:

> 어떤 action이 future reward를 크게 만드는가?

추론 관점의 질문:

> 성공했다는 조건 아래 어떤 action이 실행됐을 가능성이 큰가?

### **10.5 MPO E-step**

현재 policy에서 너무 멀어지지 않으면서 Q가 큰 action에 더 큰 확률을 주는 $q$:

$$
\max_q
\mathbb E_{s}
\mathbb E_{a\sim q(\cdot\mid s)}
\left[
Q(s,a)
\right]
$$

subject to:

$$
\mathbb E_s
\left[
D_{\mathrm{KL}}
\left(
q(\cdot\mid s)
\Vert
\pi_{\text{old}}(\cdot\mid s)
\right)
\right]
\le\epsilon
$$

해의 형태:

$$
q(a\mid s)
\propto
\pi_{\text{old}}(a\mid s)
\exp
\left(
\frac{Q(s,a)}{\eta}
\right)
$$

![MPO E-step](/assets/img/posts/rl/ohdrl-complete-flow/31-mpo-e-step.jpg)

*직접 작성한 `OhDRL.pdf`, p.157. Current policy의 action sample을 Q로 재가중하는 E-step.*

실제 continuous action에서는 적분 대신 policy에서 여러 action을 sampling하고 softmax weight를 계산한다.

$$
w_{ij}
=
\frac{
\exp(Q(s_j,a_{ij})/\eta)
}{
\sum_k
\exp(Q(s_j,a_{kj})/\eta)
}
$$

$\eta$가 작으면 높은 Q action에 집중하고, 크면 current policy에 가까운 완만한 분포가 된다.

### **10.6 MPO M-step**

Non-parametric $q$를 parametric policy로 fitting:

$$
\max_\theta
\mathbb E_s
\mathbb E_{a\sim q(\cdot\mid s)}
\left[
\log\pi_\theta(a\mid s)
\right]
$$

동시에 old policy와의 KL constraint:

$$
\mathbb E_s
\left[
D_{\mathrm{KL}}
\left(
\pi_{\text{old}}(\cdot\mid s)
\Vert
\pi_\theta(\cdot\mid s)
\right)
\right]
\le\epsilon_\pi
$$

![MPO M-step](/assets/img/posts/rl/ohdrl-complete-flow/32-mpo-m-step.jpg)

*직접 작성한 `OhDRL.pdf`, p.160. Weighted maximum likelihood와 parametric policy trust region.*

Gaussian policy에서는 mean과 covariance의 KL budget을 분리할 수 있다.

- Mean update: 좋은 action 방향으로 policy 이동
- Covariance update: exploration 폭 조절

둘을 분리하지 않으면 mean을 옮기는 과정에서 variance가 너무 빠르게 줄어 premature convergence가 생길 수 있다.

### **10.7 Off-policy critic과 Retrace**

MPO는 replay buffer의 transition으로 critic을 학습한다. Behavior policy와 target policy가 다르므로 multi-step off-policy correction이 필요하다.

Retrace는 importance ratio를 잘라 variance 폭증을 제한한다.

$$
c_t
=
\lambda
\min
\left(
1,
\frac{
\pi(A_t\mid S_t)
}{
\mu(A_t\mid S_t)
}
\right)
$$

핵심 역할:

- Critic: 현재 policy의 $Q$ 평가
- E-step: Q로 action sample 재가중
- M-step: 재가중된 action을 policy에 fitting

![MPO 전체 알고리즘](/assets/img/posts/rl/ohdrl-complete-flow/33-mpo-algorithm.jpg)

*직접 작성한 `OhDRL.pdf`, p.164. Policy evaluation과 E/M-step을 합친 MPO worker.*

MPO의 KL constraint는 actuator safety constraint가 아니다. Policy distribution의 update 크기를 제한할 뿐 torque, velocity, collision, sim-to-real error는 별도 제약으로 다뤄야 한다.

## **11. 처음부터 끝까지 변한 것**

### **11.1 Bellman equation은 사라지지 않았다**

전체 흐름에서 가장 오래 남는 구조는 Bellman relation이다.

- **DP:** 모든 다음 상태를 합산해 Bellman backup
- **TD / Q-Learning:** 관측한 transition으로 Bellman target 추정
- **DQN:** 신경망과 target network로 Q Bellman error 최소화
- **DDPG:** Continuous actor가 만든 next action으로 critic target 구성
- **Distributional RL:** Bellman update의 대상을 평균이 아닌 return distribution으로 확장
- **MPO:** Off-policy critic이 policy improvement를 위한 Q를 제공

알고리즘 이름은 바뀌어도 “미래 정보를 현재 값으로 가져오는 구조”는 계속 남는다.

### **11.2 바뀐 것은 표현과 update 방식**

| 단계 | 주된 표현 | Data | Improvement |
| --- | --- | --- | --- |
| DP | Value table | Known model | Exact/full backup greedy |
| MC | Value table | Full episodes | Sample return + $\epsilon$-greedy |
| TD/Q | Value table | Transitions | Bootstrap + greedy |
| DQN | Neural Q | Replay buffer | Discrete $\arg\max Q$ |
| Policy Gradient | Neural policy | On-policy trajectories | Return/advantage gradient |
| Actor-Critic | Policy + value | Rollout 또는 replay | Critic-guided actor |
| TRPO/PPO | Stochastic policy | On-policy | Restricted policy update |
| Distributional RL | Return distribution | Replay buffer | Distributional Bellman learning |
| MPO | Critic + action distribution + policy | Off-policy replay | E-step reweighting + M-step fitting |

### **11.3 서로 다른 문제를 해결한 알고리즘을 일렬로 순위 매기지 않기**

- DQN과 PPO: discrete value control과 stochastic policy optimization의 차이
- PPO와 MPO: on-policy clipped update와 off-policy EM-style update의 차이
- C51과 MPO: value representation과 policy improvement라는 서로 다른 축
- MC와 TD: 정답/오답 관계가 아니라 bias–variance와 update timing의 trade-off

“최신 알고리즘이 이전 알고리즘을 완전히 대체했다”보다 **무슨 가정을 바꾸고 어떤 실패 모드를 줄였는가**를 보는 편이 정확하다.

## **12. 구현 코드를 읽을 때의 체크리스트**

### **12.1 먼저 transition contract**

- observation shape
- action semantics and range
- reward timing
- next observation
- terminated와 truncated의 구분
- terminal transition의 discount 처리

### **12.2 Value target**

- MC return인가?
- one-step인가, n-step인가?
- target network를 쓰는가?
- next action은 behavior, target policy, argmax 중 무엇인가?
- off-policy correction이 있는가?

### **12.3 Actor update**

- REINFORCE return인가?
- advantage estimate인가?
- critic Q를 직접 미분하는가?
- ratio clipping인가?
- KL hard constraint인가?
- Q-based action weight를 supervised fitting하는가?

### **12.4 안정성과 재현성**

- replay sampling
- target update 주기 또는 $\tau$
- reward scale
- observation normalization
- gradient clipping
- entropy coefficient
- KL threshold
- random seed와 evaluation policy

수식의 이름보다 실제 tensor가 어느 loss로 들어가고 어느 optimizer가 어떤 parameter를 바꾸는지 따라가는 것이 구현 분석의 핵심.

## **13. 이 통합본의 역할**

기존 A1~A8은 한 주제에 오래 머물며 공부한 상세 기록이다. 이 글은 그 글들을 대체하지 않는다. 일부 설명과 수식이 겹쳐도 삭제하지 않은 이유도 여기에 있다. 역할은 다음 하나.

> **MDP에서 시작한 정의가 Bellman equation, sample backup, neural approximation, policy optimization, return distribution, inference-based policy improvement로 어떻게 이어졌는지 한 화면에서 다시 찾을 수 있는 기준점.**

세부 derivation이나 구현이 필요할 때는 각 글로 돌아가면 된다.

1. [A1. MDP](/posts/mdp/)
2. [A2. Bellman Equation](/posts/bellman-equation/)
3. [A3. Dynamic Programming](/posts/dynamic-programming/)
4. [A4. Reinforcement Learning](/posts/reinforcement-learning/)
5. [A5. Deep Reinforcement Learning](/posts/deep-reinforcement-learning/)
6. [A6. Policy Gradient DRL](/posts/policy-gradient-drl/)
7. [A7. Distributional Reinforcement Learning](/posts/distributional-reinforcement-learning/)
8. [A8. Maximum a Posteriori Policy Optimisation](/posts/maximum-a-posteriori-policy-optimisation/)

## **참고 자료**

- Richard S. Sutton, Andrew G. Barto, [Reinforcement Learning: An Introduction](http://incompleteideas.net/book/the-book-2nd.html), 2nd ed.
- Volodymyr Mnih et al., [Human-level control through deep reinforcement learning](https://www.nature.com/articles/nature14236), Nature 2015.
- Hado van Hasselt, Arthur Guez, David Silver, [Deep Reinforcement Learning with Double Q-learning](https://arxiv.org/abs/1509.06461), 2015.
- Ziyu Wang et al., [Dueling Network Architectures for Deep Reinforcement Learning](https://arxiv.org/abs/1511.06581), 2015.
- Volodymyr Mnih et al., [Asynchronous Methods for Deep Reinforcement Learning](https://proceedings.mlr.press/v48/mniha16.html), ICML 2016.
- Timothy P. Lillicrap et al., [Continuous Control with Deep Reinforcement Learning](https://arxiv.org/abs/1509.02971), 2015.
- John Schulman et al., [Trust Region Policy Optimization](https://proceedings.mlr.press/v37/schulman15.html), ICML 2015.
- John Schulman et al., [Proximal Policy Optimization Algorithms](https://arxiv.org/abs/1707.06347), 2017.
- Marc G. Bellemare, Will Dabney, Rémi Munos, [A Distributional Perspective on Reinforcement Learning](https://proceedings.mlr.press/v70/bellemare17a.html), ICML 2017.
- Will Dabney et al., [Distributional Reinforcement Learning with Quantile Regression](https://arxiv.org/abs/1710.10044), 2017.
- Will Dabney et al., [Implicit Quantile Networks for Distributional Reinforcement Learning](https://proceedings.mlr.press/v80/dabney18a.html), ICML 2018.
- Abbas Abdolmaleki et al., [Maximum a Posteriori Policy Optimisation](https://arxiv.org/abs/1806.06920), 2018.
