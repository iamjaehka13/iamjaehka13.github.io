---
title: "OhDRL: MDP부터 MPO까지"
date: 2025-10-17 01:20:00 +0900
last_modified_at: 2025-10-17 02:16:00 +0900
categories: [RL, Study]
tags: [reinforcement-learning, deep-reinforcement-learning, mdp, bellman-equation, dynamic-programming, monte-carlo, temporal-difference, dqn, policy-gradient, actor-critic, ppo, distributional-rl, mpo]
description: "MDP부터 MPO까지 정리한 164쪽짜리 강화학습 노트."
math: true
image:
  path: /assets/img/posts/rl/ohdrl-complete-flow/00-ohdrl-overview.jpg
  alt: MDP에서 MPO까지 이어지는 OhDRL 전체 목차
---

처음에는 MDP만 정리했다. 여기에 Bellman equation과 DP, MC·TD·Q-Learning을 덧붙이고 DQN, Policy Gradient, Distributional RL, MPO까지 공부하면서 `OhDRL.pdf`가 164쪽이 됐다.

각 개념을 A1~A8로 나눠 읽다 보니 장 사이의 연결이 헷갈려 PDF 순서대로 다시 묶었다.

![OhDRL 전체 목차](/assets/img/posts/rl/ohdrl-complete-flow/00-ohdrl-overview.jpg)

*직접 작성한 `OhDRL.pdf`, p.1. MDP에서 MPO까지 공부한 전체 순서.*

## **0. 목차**

| PDF | 내용 | 관련 글 |
| --- | --- | --- |
| p.2–4 | ML, DL, RL의 데이터와 학습 신호 | - |
| p.5–16 | Grid world, Markov property, MDP, reward, return, policy | [A1. MDP](/posts/mdp/) |
| p.17–25 | $v_\pi$, $q_\pi$, advantage, Bellman expectation·optimality | [A2. Bellman Equation](/posts/bellman-equation/) |
| p.26–39 | Full backup, Value Iteration, Policy Iteration | [A3. Dynamic Programming](/posts/dynamic-programming/) |
| p.40–62 | GPI, MC, TD, Sarsa, Q-Learning, importance sampling, Double Q, TD($\lambda$) | [A4. Reinforcement Learning](/posts/reinforcement-learning/) |
| p.63–102 | DQN, replay buffer, target network, Double·Dueling DQN, Policy Gradient, Actor-Critic | [A5. Deep RL](/posts/deep-reinforcement-learning/) |
| p.103–124 | DPG, DDPG, TRPO, NPG, PPO | [A6. Policy Gradient DRL](/posts/policy-gradient-drl/) |
| p.125–142 | Distributional Bellman, C51, QR-DQN, IQN | 9장 |
| p.143–164 | Bayes, MLE, MAP, ELBO, EM, RL as inference, MPO, Retrace | 10장 |

## **1. Deep Reinforcement Learning**

| 구분 | 데이터 생성 | 학습 신호 | 핵심 어려움 |
| --- | --- | --- | --- |
| Supervised Learning | 주어진 dataset | sample마다 label | generalization |
| Unsupervised Learning | 주어진 dataset | 데이터 자체의 구조 | representation과 objective 설계 |
| Reinforcement Learning | 현재 policy가 환경과 상호작용해 생성 | 지연되고 확률적인 reward | exploration, credit assignment, non-stationarity |

강화학습 데이터는 고정된 dataset만으로 주어지지 않는다. 현재 policy가 행동하고, 그 행동이 다음에 보게 될 데이터까지 바꾼다.

$$
S_t
\xrightarrow{A_t\sim\pi(\cdot\mid S_t)}
(R_{t+1},S_{t+1})
$$

RL에서 추가되는 문제:

- **Sequential dependence:** $A_t$가 $S_{t+1}$을 바꾸고, 이후 모든 sample의 출발점까지 변경
- **Delayed credit:** 마지막 성공 보상이 수십 step 전 행동 중 무엇 덕분인지 즉시 알 수 없음
- **Exploration:** 현재 좋아 보이는 행동만 반복하면 더 좋은 상태를 발견하지 못할 가능성

RL의 dataset은 policy parameter $\theta$와 독립적이지 않다.

$$
d^{\pi_\theta}(s)
=
\Pr(S_t=s\mid\pi_\theta)
$$

Policy를 바꾸면 state visitation distribution $d^{\pi_\theta}$도 함께 이동한다. 같은 loss를 줄이고 있는데도 학습 대상이 계속 달라지는 이유다.

![Deep Reinforcement Learning의 위치](/assets/img/posts/rl/ohdrl-complete-flow/01-deep-rl-context.jpg)

*직접 작성한 `OhDRL.pdf`, p.4. RL의 순차 의사결정과 DL의 함수 근사를 결합한 DRL.*

Network가 무엇을 출력할지 정하려면 문제, 가치, 최적성의 정의가 먼저 필요하다. 이 정의를 묶은 것이 MDP.

Deep learning이 붙는다고 RL의 목적이 바뀌는 것은 아니다. 바뀌는 것은 $V$, $Q$, $\pi$를 저장하는 방식.

```text
Tabular RL
각 state 또는 state-action의 값을 독립된 칸에 저장

Deep RL
parameter θ를 공유하는 함수로 여러 state의 값을 함께 근사
```

공유 parameter는 보지 못한 state로 일반화할 수 있게 하지만, 한 sample의 gradient가 다른 state의 예측까지 바꾸는 간섭도 만든다. DQN은 replay buffer와 target network로 이 간섭을 줄인다.

## **2. Markov Decision Process**

### **2.1 Grid world**

Grid world에서는 MDP의 구성요소를 한 화면에서 볼 수 있다.

- 칸의 위치: state
- 상하좌우 이동: action
- 도착 또는 위험 지점: reward
- 미끄러질 가능성: stochastic transition
- 각 칸에서 선택할 행동: policy

![Grid world 예시](/assets/img/posts/rl/ohdrl-complete-flow/02-gridworld.jpg)

*직접 작성한 `OhDRL.pdf`, p.6. 상태, 행동, 보상, 목표가 한 화면에 들어간 Grid world.*

결정론적 환경에서는 같은 $(s,a)$가 항상 같은 $s'$를 만든다. 반면 확률적 환경에는 의도한 방향으로 갈 가능성과 옆으로 미끄러질 가능성이 공존한다. Policy가 고르는 것은 행동이지 결과 그 자체가 아니다.

![결정론적 전이와 확률론적 전이](/assets/img/posts/rl/ohdrl-complete-flow/detail-p007-actions-deterministic-stochastic.jpg)

*직접 작성한 `OhDRL.pdf`, p.7. 같은 action도 environment dynamics에 따라 하나의 결과 또는 여러 확률적 결과로 이어진다.*

가령 `east`를 선택했을 때의 전이:

$$
\Pr(S_{t+1}=s_{\text{east}}\mid S_t=s,A_t=\text{east})=0.8
$$

$$
\Pr(S_{t+1}=s_{\text{north}}\mid S_t=s,A_t=\text{east})=0.1
$$

$$
\Pr(S_{t+1}=s_{\text{south}}\mid S_t=s,A_t=\text{east})=0.1
$$

Agent가 제어하는 것은 **action distribution**이고, environment가 결정하는 것은 그 action 이후의 **transition distribution**. 이 둘을 섞으면 “policy가 stochastic하다”와 “environment가 stochastic하다”를 구분하기 어려워진다.

### **2.2 Markov property**

상태 $S_t$가 Markov property를 만족한다는 것은 현재 상태가 주어졌을 때 미래가 과거 이력과 조건부 독립이라는 의미다.

$$
\Pr(S_{t+1}\mid S_t,A_t,S_{t-1},A_{t-1},\ldots)
=
\Pr(S_{t+1}\mid S_t,A_t)
$$

“과거를 무조건 버려도 된다”는 뜻은 아니다. 미래 예측에 필요한 과거 정보가 있다면 그 정보까지 포함해 **state를 다시 정의**해야 한다.

로봇의 현재 위치만으로 속도를 알 수 없다면 위치 하나는 Markov state가 아니다. 이때는 위치와 속도를 함께 넣거나, 여러 관측을 쌓거나, recurrent state를 사용한다.

### **2.2.1 Stochastic process에서 state로**

확률과정은 시간 index에 따라 나열된 random variable의 집합.

$$
\{S_0,S_1,S_2,\ldots\}
$$

Markov chain은 action이 없는 상태 전이만 다룬다.

$$
\Pr(S_{t+1}=s'\mid S_t=s)
$$

MDP는 여기에 agent의 선택 $A_t$와 reward $R_{t+1}$을 추가한다.

$$
\Pr(S_{t+1}=s',R_{t+1}=r\mid S_t=s,A_t=a)
$$

MDP의 `Decision`은 transition probability가 사라진다는 뜻이 아니다. **Agent의 action이 어떤 transition distribution을 사용할지 선택한다**는 의미.

### **2.2.2 State와 observation은 같은가**

이론의 $S_t$는 미래 예측에 충분한 정보를 가진 state. 실제 구현이 받는 값은 sensor observation $O_t$일 수 있다.

$$
O_t\sim p(o\mid S_t)
$$

카메라 한 장, noisy encoder, 가려진 지도처럼 $O_t$가 $S_t$를 완전히 드러내지 않으면 문제는 POMDP에 가까워진다. 해결 방향:

- frame stack으로 최근 motion 포함
- velocity estimator나 filter로 hidden state 추정
- RNN/Transformer hidden state에 observation history 압축
- belief state $b_t(s)=\Pr(S_t=s\mid O_{0:t},A_{0:t-1})$ 유지

Observation vector를 network에 넣었다고 자동으로 Markov state가 되지는 않는다. 로봇 RL에서는 observation에 미래 예측에 필요한 정보가 들어 있는지 따로 확인해야 한다.

### **2.3 MDP tuple**

Discounted MDP의 기본 tuple:

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

Reward 표기는 책이나 논문마다 조금씩 다르다.

$$
r(s)
,\qquad
r(s,a)
,\qquad
r(s,a,s')
$$

- $r(s)$: 현재 state만으로 reward가 결정
- $r(s,a)$: 현재 state와 action까지 반영
- $r(s,a,s')$: 실제 도착한 next state까지 반영

가장 일반적인 joint dynamics $p(s',r\mid s,a)$를 알고 있다면 expected reward는:

$$
r(s,a)
=
\sum_{s',r}
r\,p(s',r\mid s,a)
$$

모델 기반 계산에서는 이 expectation을 합산하고, model-free RL에서는 실제 관측한 $R_{t+1}$을 sample로 사용한다.

### **2.4 Reward와 Return**

Reward $R_{t+1}$은 한 step의 피드백. Policy의 최적화 대상은 그 한 번의 reward가 아니라 누적 return.

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

Reward와 return을 구분하지 않으면 credit assignment가 보이지 않는다.

```text
R_{t+1}
지금 transition 하나에 대한 즉각적 feedback

G_t
지금 선택 이후 전체 미래가 만든 누적 결과
```

Return은 재귀적으로도 표현 가능.

$$
G_t
=
R_{t+1}
+
\gamma G_{t+1}
$$

이 식에 expectation을 취하면 Bellman equation이 된다.

### **2.4.1 Episodic과 continuing task**

Episodic task에는 terminal time $T$가 존재:

$$
G_t
=
\sum_{k=0}^{T-t-1}
\gamma^kR_{t+k+1}
$$

Continuing task는 명시적인 끝이 없으므로 infinite horizon을 다룬다.

$$
G_t
=
\sum_{k=0}^{\infty}
\gamma^kR_{t+k+1}
$$

Reward가 bounded이고 $\gamma<1$이면:

$$
|G_t|
\le
\frac{R_{\max}}{1-\gamma}
$$

$\gamma$는 미래 reward의 비중, Bellman operator의 contraction, value scale을 함께 결정한다. Reward scale이 1이고 $\gamma=0.99$라면 이론적인 return 규모는 약 100.

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

![Grid world의 reward 설정과 optimal policy 변화](/assets/img/posts/rl/ohdrl-complete-flow/detail-p011-optimal-policy-gridworld.jpg)

*직접 작성한 `OhDRL.pdf`, p.11. 같은 transition dynamics에서도 living reward가 달라지면 최적 경로와 위험 선호가 바뀐다.*

Grid world 그림에서 living reward가 작게 음수면 빨리 끝내는 경로가 유리하고, 큰 음수면 위험을 감수하고서라도 더 짧은 경로를 택할 수 있다. 반대로 양의 living reward를 계속 주면 종료를 피하며 머무는 policy가 생길 수도 있다.

Reward engineering에서 정하는 것:

> Agent가 “의도”를 이해하는 것이 아니라, 정의된 return을 최대화하는 policy를 찾는 것.

잘못된 reward는 잘못된 최적 policy를 정확히 학습하게 만든다.

MDP의 목적은 기대 return을 최대화하는 optimal policy $\pi^{\ast}$를 찾는 것.

$$
\pi^*
\in
\arg\max_\pi
\mathbb{E}_{\tau\sim\pi}
\left[
\sum_{t=0}^{\infty}\gamma^tR_{t+1}
\right]
$$

Policy 후보를 전부 실행해 볼 수는 없다. 대신 각 state와 action의 장기 return을 value function으로 나타낸다.

유한 discounted MDP에는 deterministic optimal policy가 적어도 하나 존재한다. 그렇다고 optimal policy가 항상 하나뿐이라는 뜻은 아니다. 여러 action이 같은 최적 Q값을 가지면 여러 deterministic optimal policy와 그 혼합 stochastic policy가 모두 최적일 수 있다.

## **3. Bellman Equation**

### **3.1 State value와 action value**

정책 $\pi$ 아래 state의 가치:

$$
v_\pi(s)
=
\mathbb{E}_\pi[G_t\mid S_t=s]
$$

State에서 특정 action까지 고정한 가치:

$$
q_\pi(s,a)
=
\mathbb{E}_\pi[G_t\mid S_t=s,A_t=a]
$$

![State value와 action value](/assets/img/posts/rl/ohdrl-complete-flow/05-value-functions.jpg)

*직접 작성한 `OhDRL.pdf`, p.18. $v_\pi$, $q_\pi$, advantage의 관계.*

두 value의 관계:

$$
v_\pi(s)
=
\sum_a\pi(a\mid s)q_\pi(s,a)
$$

반대로 $q_\pi$는 transition model과 다음 state value로 표현할 수 있다.

$$
q_\pi(s,a)
=
\sum_{s',r}
p(s',r\mid s,a)
\left[
r+\gamma v_\pi(s')
\right]
$$

둘을 합치면 state에서 action을 평균내고, 그 action이 만드는 next state와 reward를 다시 평균내는 구조.

Advantage는 action value에서 그 state의 평균적 가치를 뺀 상대적 이득.

$$
A_\pi(s,a)
=
q_\pi(s,a)-v_\pi(s)
$$

이 식은 나중에 Actor-Critic, TRPO, PPO까지 계속 다시 나온다.

$A_\pi(s,a)>0$이면 현재 policy가 평균적으로 하던 선택보다 좋은 action, $A_\pi(s,a)<0$이면 평균보다 나쁜 action. Policy Gradient에서 좋은 action의 확률을 높이고 나쁜 action의 확률을 낮추는 weight가 되는 이유다.

Policy 아래에서 advantage를 action에 대해 평균내면 0:

$$
\sum_a
\pi(a\mid s)A_\pi(s,a)
=0
$$

Advantage는 state마다 value scale이 달라도 “그 state에서 상대적으로 나았는가”를 분리해 준다.

### **3.2 Bellman expectation equation**

Return을 첫 reward와 나머지 return으로 쪼개면:

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

중간 단계를 생략하지 않고 쓰면:

$$
\begin{aligned}
v_\pi(s)
&=
\mathbb E_\pi[G_t\mid S_t=s]\\
&=
\mathbb E_\pi[R_{t+1}+\gamma G_{t+1}\mid S_t=s]\\
&=
\mathbb E_\pi[R_{t+1}+\gamma v_\pi(S_{t+1})\mid S_t=s].
\end{aligned}
$$

첫 번째 등호는 value의 정의. 두 번째는 return의 재귀식. 마지막은 다음 state 이후 return의 conditional expectation을 $v_\pi(S_{t+1})$로 치환한 결과다.

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

합에 들어가는 두 확률분포:

1. $\pi(a\mid s)$: agent가 어떤 action을 선택하는가
2. $p(s',r\mid s,a)$: environment가 어떤 next state와 reward를 만드는가

Policy evaluation은 $\pi$를 고정하고 이 식의 fixed point를 구한다.

유한 state MDP를 행렬로 쓰면:

$$
\mathbf v_\pi
=
\mathbf r_\pi
+
\gamma P_\pi\mathbf v_\pi
$$

따라서 형식적으로:

$$
\mathbf v_\pi
=
(I-\gamma P_\pi)^{-1}\mathbf r_\pi
$$

작은 MDP라면 linear system으로 직접 풀 수 있다. State space가 커지면 inverse 계산이 비싸기 때문에 DP에서는 반복 backup을 사용한다.

Bellman equation은 먼 미래를 전부 펼치지 않고 다음 state의 value로 현재 value를 표현한다. 다음 state의 현재 estimate를 가져와 값을 갱신하는 연산이 **backup**, 실제 return 대신 estimate를 target에 넣는 방식이 **bootstrapping**.

Bellman expectation operator를:

$$
(\mathcal T^\pi V)(s)
=
\sum_a\pi(a\mid s)
\sum_{s',r}p(s',r\mid s,a)
\left[r+\gamma V(s')\right]
$$

로 두면 iterative policy evaluation은:

$$
V_{k+1}
=
\mathcal T^\pi V_k
$$

를 반복하는 것. $\gamma<1$인 discounted finite MDP에서 $\mathcal T^\pi$는 sup norm contraction이다.

$$
\|\mathcal T^\pi V-\mathcal T^\pi U\|_\infty
\le
\gamma
\|V-U\|_\infty
$$

초기값이 달라도 같은 $v_\pi$로 수렴한다.

### **3.3 Bellman optimality equation**

모든 policy 가운데 가장 큰 value를 optimal value로 정의:

$$
v_*(s)
=
\max_\pi v_\pi(s)
$$

$$
q_*(s,a)
=
\max_\pi q_\pi(s,a)
$$

![Optimal value와 optimal policy의 관계](/assets/img/posts/rl/ohdrl-complete-flow/detail-p022-optimal-value-policy.jpg)

*직접 작성한 `OhDRL.pdf`, p.22. Policy 사이의 value ordering과 optimal value, optimal policy의 존재.*

현재 policy 평가에서 한 걸음 더 나아가 가장 좋은 action을 고르면:

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

$q_{\ast}$를 알면 환경 모델 없이도 greedy action을 바로 고를 수 있다.

$$
\pi_*(s)
\in
\arg\max_a q_*(s,a)
$$

$v_{\ast}$만 알고 있을 때 action을 고르려면 transition model이 필요하다.

$$
\pi_*(s)
\in
\arg\max_a
\sum_{s',r}
p(s',r\mid s,a)
\left[r+\gamma v_*(s')\right]
$$

반면 $q_{\ast}$에는 “이 action을 한 뒤의 장기 결과”가 이미 담겨 있다. 그래서 model-free control은 $Q(s,a)\approx q_{\ast}(s,a)$를 직접 학습한다.

Bellman expectation equation은 fixed policy의 선형 expectation 관계다. Bellman optimality equation은 $\max$가 포함돼 일반적으로 nonlinear. 이 차이 때문에 “정책 평가”와 “최적 제어”의 난이도가 갈린다.

Optimality operator:

$$
(\mathcal T_*V)(s)
=
\max_a
\sum_{s',r}
p(s',r\mid s,a)
\left[r+\gamma V(s')\right]
$$

Discounted finite MDP에서는 이 operator도 contraction이므로 반복 적용하면 $v_{\ast}$로 수렴한다. Value Iteration은 이 연산을 반복한다.

Transition model의 유무에 따라 계산 방식이 달라진다.

- **전이확률과 보상을 아는 경우:** Bellman equation의 합을 직접 계산하는 Dynamic Programming
- **전이확률을 모르는 경우:** 실제 transition을 표본으로 관측하는 Reinforcement Learning

## **4. Dynamic Programming**

### **4.1 Planning과 Learning**

![Known MDP와 Unknown MDP](/assets/img/posts/rl/ohdrl-complete-flow/08-planning-vs-learning.jpg)

*직접 작성한 `OhDRL.pdf`, p.28. 모델을 이용하는 planning과 경험을 이용하는 learning.*

DP는 가능한 다음 상태를 모두 합산하는 **full backup**을 사용한다. 이를 위해 $p(s',r\mid s,a)$를 알아야 한다.

DP를 가능하게 하는 두 구조:

- **Optimal substructure:** optimal policy의 이후 부분도 해당 subproblem에서 optimal
- **Overlapping subproblems:** 같은 next state value가 여러 predecessor의 계산에 반복 등장

Bellman equation은 첫 번째 구조를 재귀식으로 만들고, value table은 두 번째 구조의 결과를 저장해 재사용한다.

한 state의 backup 비용이 대략 $O(\lvert\mathcal A\rvert\lvert\mathcal S\rvert)$이고 모든 state를 sweep하면 $O(\lvert\mathcal S\rvert^2\lvert\mathcal A\rvert)$. State가 조합적으로 늘어나는 실제 문제에서 full sweep이 막히는 이유다.

Update 순서에 따른 구분:

- **Synchronous backup:** $V_k$ 전체를 기준으로 $V_{k+1}$ 전체 계산
- **Asynchronous backup:** state를 순차적으로 갱신하며 방금 바뀐 값도 즉시 사용

둘 다 적절한 방문 조건 아래 수렴할 수 있지만, memory access와 value 전파 속도가 달라진다.

### **4.2 Policy Iteration**

Policy Iteration은 두 단계의 반복.

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

![Policy Improvement Theorem의 전개](/assets/img/posts/rl/ohdrl-complete-flow/detail-p035-policy-improvement-theorem.jpg)

*직접 작성한 `OhDRL.pdf`, p.35. 한 step의 개선이 전체 미래 return의 개선으로 이어지는 재귀적 논리.*

조금 더 정확한 조건:

$$
q_{\pi_k}(s,\pi_{k+1}(s))
\ge
v_{\pi_k}(s)
\qquad
\forall s
$$

그러면:

$$
v_{\pi_{k+1}}(s)
\ge
v_{\pi_k}(s)
\qquad
\forall s
$$

Greedy improvement는 위 조건을 자동으로 만족한다. 새 policy가 기존 policy와 같다면 Bellman optimality condition을 만족한 상태이므로 optimal.

![Policy Iteration 전체 algorithm](/assets/img/posts/rl/ohdrl-complete-flow/detail-p037-policy-iteration-algorithm.jpg)

*직접 작성한 `OhDRL.pdf`, p.37. Initialization, iterative evaluation, greedy improvement, policy-stable 종료 조건.*

알고리즘 수준에서 풀어 쓴 Policy Iteration:

1. $V(s)$와 $\pi(s)$ 초기화
2. $\pi$를 고정하고 Bellman expectation backup 반복
3. 모든 state에서 이전 action 저장
4. $V$를 기준으로 greedy action 계산
5. action이 하나라도 바뀌면 다시 evaluation
6. 모든 action이 유지되면 종료

Evaluation을 매번 완전 수렴시킬 필요는 없다. 몇 번만 evaluation하고 improvement하는 **Modified Policy Iteration**이 Policy Iteration과 Value Iteration 사이를 잇는다.

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

![Value Iteration pseudocode와 종료 조건](/assets/img/posts/rl/ohdrl-complete-flow/detail-p032-value-iteration-algorithm.jpg)

*직접 작성한 `OhDRL.pdf`, p.32. State sweep, 최대 residual $\Delta$, threshold $\theta$를 이용한 종료.*

Pseudocode에서 눈여겨볼 값은 residual.

$$
\Delta_k
=
\max_s
|V_{k+1}(s)-V_k(s)|
$$

$\Delta_k<\theta$가 되면 반복을 멈춘다. $\theta$가 지나치게 작으면 policy는 이미 같아졌는데 value의 소수점만 맞추느라 계산을 계속할 수 있고, 너무 크면 아직 잘못된 greedy action을 고른 상태에서 멈출 수 있다.

![Value Iteration 예시](/assets/img/posts/rl/ohdrl-complete-flow/09-value-iteration-example.jpg)

*직접 작성한 `OhDRL.pdf`, p.31. Full backup을 반복해 value를 전달하는 자동차 상태 예시.*

자동차 예제의 상태는 `cool`, `warm`, `overheated`, action은 `slow`, `fast`. `fast`는 즉각 reward가 클 수 있지만 warm 상태에서 과열 terminal로 갈 위험도 증가한다.

한 번의 backup이 묻는 것은 “지금 reward가 큰가”만이 아니다.

$$
Q_k(\text{warm},\text{fast})
=
\sum_{s',r}
p(s',r\mid\text{warm},\text{fast})
\left[
r+\gamma V_k(s')
\right]
$$

과열의 낮은 value가 반복을 통해 이전 state로 전파되면서 장기적으로 안전한 action이 선택될 수 있다. Delayed consequence가 Bellman backup으로 뒤로 전달되는 가장 작은 예제.

| 구분 | Policy Iteration | Value Iteration |
| --- | --- | --- |
| 평가 | 현재 policy를 충분히 평가 | 한 번 또는 짧은 평가 |
| 개선 | 평가 후 명시적으로 수행 | optimality backup 안에 포함 |
| iteration당 비용 | 상대적으로 큼 | 상대적으로 작음 |
| 공통 전제 | 알려진 환경 모델, full backup | 알려진 환경 모델, full backup |

유한 MDP와 적절한 조건에서 둘 다 optimal policy로 수렴한다. 문제는 현실의 모든 state에서 모든 다음 state를 합산하기 어렵다는 점이다.

### **4.4 Policy Iteration과 Value Iteration 비교**

두 방법은 완전히 별개라기보다 evaluation depth가 다른 GPI로 보는 편이 자연스럽다.

| Evaluation depth | 해석 |
| --- | --- |
| 수렴할 때까지 | Policy Iteration |
| 여러 sweep | Modified Policy Iteration |
| 한 번의 optimality backup | Value Iteration |

공통점은 model을 알고 있고, 모든 next state를 expectation으로 합산한다는 것. 이 조건이 사라지면 update 식의 expectation을 sample로 바꿔야 한다.

DP의 병목은 full backup에 필요한 정확한 model과 계산량.

## **5. Reinforcement Learning**

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

기대값을 정확히 계산하는 대신 표본을 반복해서 보며 추정한다. 아래에서 다루는 RL은 주로 model-free sample-based learning이며, RL 전체가 model-free인 것은 아니다.

Sample target은 무작위로 흔들리지만 conditional expectation은 full backup과 같다.

$$
\mathbb E
\left[
R_{t+1}+\gamma V(S_{t+1})
\mid S_t=s,A_t=a
\right]
=
\sum_{s',r}
p(s',r\mid s,a)
\left[r+\gamma V(s')\right]
$$

RL update는 noisy sample을 반복해서 보며 expectation의 fixed point로 접근하는 stochastic approximation. 모델을 몰라도 된다는 이점과 함께 sample 수, exploration, step-size라는 새 문제가 들어온다.

### **5.2 Generalized Policy Iteration, GPI**

GPI는 두 과정을 번갈아 수행한다.

1. **Policy evaluation:** 현재 policy가 얼마나 좋은지 추정
2. **Policy improvement:** 더 좋아 보이는 action의 확률 증가

![Generalized Policy Iteration](/assets/img/posts/rl/ohdrl-complete-flow/11-gpi.jpg)

*직접 작성한 `OhDRL.pdf`, p.43. Evaluation과 improvement가 서로를 끌어가는 GPI.*

Evaluation과 improvement는 각각 완전히 끝낼 필요가 없다. 한두 번 평가한 뒤 policy를 조금 개선하는 식으로 번갈아 진행할 수 있다. DP, MC, TD, Actor-Critic 모두 이 구조를 사용한다.

### **5.3 Monte Carlo: episode가 끝난 뒤 실제 return 사용**

MC prediction의 target은 episode가 끝난 뒤 관측한 return $G_t$.

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

같은 state-action이 한 episode에 여러 번 등장한다면 update 기준은 둘로 나뉜다.

- **First-visit MC:** episode에서 처음 등장한 시점의 return만 사용
- **Every-visit MC:** 등장한 모든 시점의 return을 각각 사용

Stationary return의 sample mean을 구한다면 방문 횟수 $N(s,a)$에 따라 $\alpha=1/N(s,a)$를 사용할 수 있다. 최근 경험을 계속 반영해야 하는 non-stationary 문제에서는 고정된 $\alpha$가 더 자연스럽다.

Sample mean의 incremental update를 직접 유도하면:

$$
\begin{aligned}
Q_n
&=
\frac{1}{n}\sum_{i=1}^nG_i\\
&=
\frac{n-1}{n}Q_{n-1}
+
\frac{1}{n}G_n\\
&=
Q_{n-1}
+
\frac{1}{n}
\left(G_n-Q_{n-1}\right).
\end{aligned}
$$

![Incremental mean과 constant step-size MC](/assets/img/posts/rl/ohdrl-complete-flow/detail-p046-incremental-mean.jpg)

*직접 작성한 `OhDRL.pdf`, p.46. 모든 return을 저장하지 않고 현재 평균과 새 sample만으로 update하는 과정.*

고정 $\alpha$를 반복해서 전개했을 때 생기는 최근 sample 중심의 지수 가중:

$$
Q_n
=
(1-\alpha)^nQ_0
+
\sum_{i=1}^{n}
\alpha(1-\alpha)^{n-i}G_i
$$

그래서 sample mean은 stationary value 추정, constant step-size는 변화하는 policy나 environment를 계속 따라갈 때 유리하다.

Monte Carlo의 특징:

- 환경 모델 불필요
- bootstrap 없음
- terminal까지 기다려야 함
- 고정된 policy value의 표본으로는 unbiased하지만 variance가 큼

Control 단계의 exploration은 $\epsilon$-greedy로 유지:

$$
\pi(a\mid s)
=
\begin{cases}
1-\epsilon+\epsilon/|\mathcal A|,&a=\arg\max_{a'}Q(s,a')\\
\epsilon/|\mathcal A|,&\text{otherwise}
\end{cases}
$$

![Epsilon-greedy MC control](/assets/img/posts/rl/ohdrl-complete-flow/detail-p048-epsilon-greedy-control.jpg)

*직접 작성한 `OhDRL.pdf`, p.48. Greedy action에도 random branch의 확률 $\epsilon/\lvert\mathcal A\rvert$이 더해지는 구조.*

GLIE는 모든 state-action을 무한히 탐색하면서도 극한에서는 greedy policy가 되는 조건. 단순히 $\epsilon=0$으로 빨리 줄이는 것과 다르다.

$$
\lim_{k\to\infty}\epsilon_k=0,
\qquad
\sum_{k=1}^{\infty}\epsilon_k=\infty
$$

$\sum_k\epsilon_k=\infty$는 탐험이 너무 빨리 끝나지 않게 하는 조건이다. 실제 수렴에는 state-action 방문 횟수와 step-size 조건도 필요하다.

![Monte Carlo control 전체 algorithm](/assets/img/posts/rl/ohdrl-complete-flow/detail-p050-monte-carlo-algorithm.jpg)

*직접 작성한 `OhDRL.pdf`, p.50. Episode 생성, 뒤에서부터 return 계산, visit별 Q update, greedy improvement.*

MC control의 한 episode를 순서대로 쓰면:

1. 현재 $\epsilon$-soft policy로 trajectory 생성
2. Terminal에서 시작해 $G\leftarrow\gamma G+R$로 return 누적
3. First-visit 조건을 만족하는 $(S_t,A_t)$의 return 저장
4. $Q(S_t,A_t)$를 sample mean 또는 step-size로 update
5. 같은 state의 policy를 $Q$에 대해 $\epsilon$-greedy로 개선

Evaluation과 improvement가 episode 안에서 번갈아 일어나는 GPI의 sample-based 구현.

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

$\delta_t$는 TD error. 실제 reward 하나와 다음 value estimate의 조합.

TD error를 단순한 loss로만 보면 의미가 좁아진다. 더 직접적인 해석은 **현재 transition이 기존 예측보다 얼마나 놀라웠는가**.

$$
\delta_t
=
\underbrace{R_{t+1}+\gamma V(S_{t+1})}_{\text{one-step target}}
-
\underbrace{V(S_t)}_{\text{current prediction}}
$$

- $\delta_t>0$: 예상보다 좋은 transition
- $\delta_t<0$: 예상보다 나쁜 transition
- $\delta_t\approx0$: 현재 Bellman relation과 일치

Terminal transition에서는 next value를 0으로 처리해야 한다.

$$
Y_t
=
R_{t+1}
+
\gamma(1-d_{t+1})V(S_{t+1})
$$

여기서 $d_{t+1}$은 true terminal indicator. Time-limit truncation을 terminal과 똑같이 처리할지는 environment contract에 따라 달라진다.

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

실제 update에서는 target과 현재 Q의 차이를 step-size만큼 반영:

$$
Q(S_t,A_t)
\leftarrow
Q(S_t,A_t)
+
\alpha
\left[
Y_t-Q(S_t,A_t)
\right]
$$

`Sarsa`라는 이름의 출처는 update에 들어가는 tuple:

$$
(S_t,A_t,R_{t+1},S_{t+1},A_{t+1})
$$

Q-Learning은 next action을 실제로 실행하기 전에 $\max$로 target을 만들 수 있다. 이 차이가 target policy와 behavior policy를 분리한다.

![Sarsa와 Q-Learning](/assets/img/posts/rl/ohdrl-complete-flow/14-sarsa-vs-q-learning.jpg)

*직접 작성한 `OhDRL.pdf`, p.59. Target policy와 behavior policy가 같은 Sarsa, 다른 Q-Learning.*

- **Sarsa:** 실제 behavior가 선택한 $A_{t+1}$을 target에 사용. On-policy.
- **Q-Learning:** behavior가 exploration 중이어도 greedy action을 target에 사용. Off-policy.

Cliff walking에서 Sarsa는 탐색 중 절벽에 떨어질 위험까지 반영해 안전한 길을 선호할 수 있다. Q-Learning은 greedy target의 최단 경로를 학습한다. 어느 쪽이 “항상 더 좋다”가 아니라 어떤 policy를 평가하는지가 다르다.

### **5.6 On-policy, off-policy, importance sampling**

- **Target policy $\pi$:** 배우고 싶은 policy
- **Behavior policy $\mu$:** 데이터를 생성하는 policy

둘이 다르면 $\mu$가 만든 trajectory로 $\pi$의 기대값을 추정해야 한다. 이때 등장하는 importance sampling ratio:

$$
\rho_{t:T-1}
=
\prod_{k=t}^{T-1}
\frac{\pi(A_k\mid S_k)}
{\mu(A_k\mid S_k)}
$$

분포 차이를 보정할 수 있지만 긴 horizon에서는 ratio의 곱 때문에 variance가 폭증할 수 있다. Off-policy의 데이터 재사용 이점과 추정 불안정성이 함께 생기는 지점.

![Off-policy evaluation과 importance sampling](/assets/img/posts/rl/ohdrl-complete-flow/detail-p054-importance-sampling.jpg)

*직접 작성한 `OhDRL.pdf`, p.54. Behavior distribution에서 뽑은 sample을 target distribution의 expectation으로 보정하는 원리.*

필요 조건은 support coverage:

$$
\pi(a\mid s)>0
\Longrightarrow
\mu(a\mid s)>0
$$

Target policy가 선택할 action을 behavior policy가 절대 선택하지 않는다면 ratio로 복원할 데이터 자체가 없다.

Ordinary importance sampling:

$$
\hat V_{\text{ordinary}}
=
\frac{1}{N}
\sum_{i=1}^{N}
\rho_iG_i
$$

Weighted importance sampling:

$$
\hat V_{\text{weighted}}
=
\frac{
\sum_{i=1}^{N}\rho_iG_i
}{
\sum_{i=1}^{N}\rho_i
}
$$

Ordinary estimator는 조건 아래 unbiased지만 variance가 매우 클 수 있다. Weighted estimator는 finite sample bias를 허용하는 대신 값의 범위를 안정시키는 경향. Per-decision IS, truncated ratio, Retrace가 긴 trajectory ratio의 폭발을 줄이려는 후속 설계다.

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

### **5.7.1 AB 예제가 보여 주는 차이**

![AB batch example](/assets/img/posts/rl/ohdrl-complete-flow/detail-p058-ab-example.jpg)

*직접 작성한 `OhDRL.pdf`, p.58. 같은 batch를 반복 학습해도 MC와 TD가 다른 fixed point로 가는 작은 예제.*

State A에서 대부분 B로 이동하고, B에서 여러 번 보상 1 또는 0을 관측했다고 하자.

- MC는 A에서 실제로 관측한 episode return만 평균
- TD는 $V(A)\leftarrow R+\gamma V(B)$ relation을 이용

Batch의 경험적 transition 구조를 모델처럼 재사용하면 TD는 B에서 얻은 많은 정보까지 A에 전파한다. MC는 A에서 시작한 return sample만 본다. “실제 return을 썼으니 언제나 MC가 더 정확하다”는 단순 결론이 성립하지 않는 이유.

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

![Sarsa, Q-Learning, Expected Sarsa target 비교](/assets/img/posts/rl/ohdrl-complete-flow/detail-p060-expected-sarsa.jpg)

*직접 작성한 `OhDRL.pdf`, p.60. Sampled next action, max action, expected next action의 차이.*

Q-Learning은 Expected Sarsa에서 target policy를 greedy deterministic policy로 둔 특수한 경우처럼 볼 수 있다.

$$
\sum_{a'}
\pi_{\text{greedy}}(a'\mid s')Q(s',a')
=
\max_{a'}Q(s',a')
$$

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

실제 Double Q-Learning은 매 step 둘 중 하나를 무작위로 update한다.

$$
\begin{aligned}
a^*&=\arg\max_aQ_A(s',a),\\
Q_A(s,a)&\leftarrow Q_A(s,a)
+\alpha\left[r+\gamma Q_B(s',a^*)-Q_A(s,a)\right]
\end{aligned}
$$

다른 절반에서는 $A$와 $B$의 역할을 교환. 두 estimator가 완전히 독립인 것은 아니지만 selection error와 evaluation error의 동일한 noise 사용을 줄인다.

### **5.9 Multi-step과 TD($\lambda$)**

One-step TD와 full-return MC 사이에 놓인 여러 길이의 target:

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

Backward view의 eligibility trace는 과거 state-action에 credit을 전달한다. 나중에 나올 GAE와 multi-step critic target의 기반이 되는 개념.

![n-step return과 TD lambda](/assets/img/posts/rl/ohdrl-complete-flow/detail-p062-td-lambda.jpg)

*직접 작성한 `OhDRL.pdf`, p.62. One-step TD에서 MC까지 이어지는 forward view와 eligibility trace의 backward view.*

State-value TD($\lambda$)의 accumulating trace:

$$
e_t(s)
=
\gamma\lambda e_{t-1}(s)
+
\mathbb I\{S_t=s\}
$$

모든 state를 현재 TD error로 update:

$$
V(s)
\leftarrow
V(s)
+
\alpha\delta_t e_t(s)
$$

$\lambda$가 클수록 먼 과거 state까지 credit이 오래 남고, 작을수록 최근 transition에 집중한다. 적절한 조건에서는 forward view의 $n$-step return 가중합과 backward view의 online trace가 같은 update를 만든다.

## **6. Deep Q-Network**

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

신경망의 이점은 비슷한 state 사이의 정보 공유와 고차원 입력 처리. 그 대가로 tabular update에는 없던 문제가 따라온다.

- 연속된 transition의 강한 상관관계
- 같은 network가 target과 prediction을 동시에 변경
- off-policy + bootstrapping + function approximation의 불안정성
- 한 sample의 update가 다른 state의 출력까지 변경

### **6.1.1 Naive DQN의 불안정성**

Q-Learning 식에 network만 바로 넣으면:

$$
y_t
=
r_t
+
\gamma\max_{a'}Q(s_{t+1},a';\theta)
$$

$$
L(\theta)
=
\left[
y_t-Q(s_t,a_t;\theta)
\right]^2
$$

Target $y_t$와 prediction 양쪽에 같은 $\theta$가 들어간다. Gradient step으로 prediction을 target에 가까이 옮기는 순간 target 자체도 함께 이동.

![Naive DQN의 moving target과 correlated sample 문제](/assets/img/posts/rl/ohdrl-complete-flow/detail-p068-naive-dqn.jpg)

*직접 작성한 `OhDRL.pdf`, p.68. Q-Learning에 network를 바로 붙였을 때 target과 prediction이 동시에 변하는 구조.*

불안정성을 만드는 세 요소, 흔히 말하는 deadly triad:

1. **Function approximation:** 여러 state가 parameter를 공유
2. **Bootstrapping:** 현재 estimate를 target에 사용
3. **Off-policy learning:** 데이터를 만든 policy와 평가 대상이 다름

셋 중 하나만 있다고 반드시 발산하는 것은 아니다. 하지만 세 요소가 결합하면 작은 Q error가 target과 다른 state로 증폭될 수 있다. DQN은 이를 완전히 제거하지 않고 replay와 frozen target으로 학습 역학을 완화한다.

### **6.2 Replay buffer와 target network**

![DQN의 핵심 기여](/assets/img/posts/rl/ohdrl-complete-flow/16-dqn-stabilization.jpg)

*직접 작성한 `OhDRL.pdf`, p.69. Experience replay와 target network를 중심으로 한 DQN 안정화.*

**Experience Replay**

Transition을 buffer에 저장한 뒤 무작위 minibatch로 재사용.

$$
(S_t,A_t,R_{t+1},S_{t+1})
\rightarrow
\mathcal D
$$

시간적으로 인접한 sample의 상관을 줄이고, 한 transition을 여러 update에 활용한다.

Replay buffer가 만드는 변화:

- 연속 frame의 강한 autocorrelation 완화
- 최근 trajectory 하나가 gradient를 독점하는 현상 감소
- 과거 transition 재사용으로 sample efficiency 증가
- policy가 바뀐 뒤 수집한 데이터와 과거 데이터가 섞이는 off-policy dataset 형성

마지막 항목은 장점이면서 위험. 아주 오래된 behavior data가 현재 policy와 크게 다르면 distribution shift가 커질 수 있다.

**Target Network**

Behavior network $\theta$와 target network $\theta^-$의 분리:

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

![Online network와 target network의 분리](/assets/img/posts/rl/ohdrl-complete-flow/detail-p072-target-network.jpg)

*직접 작성한 `OhDRL.pdf`, p.72. Prediction을 학습하는 online network와 TD target을 만드는 frozen network.*

Hard update:

$$
\theta^-\leftarrow\theta
\qquad
\text{every }C\text{ updates}
$$

Soft update:

$$
\theta^-
\leftarrow
\tau\theta
+
(1-\tau)\theta^-,
\qquad
\tau\ll1
$$

원래 Atari DQN은 periodic hard copy를 사용했다. DDPG와 SAC 계열에서는 soft Polyak update가 흔하다. 둘의 목적은 같지만 target이 움직이는 시간 scale이 다르다.

![DQN의 데이터 흐름](/assets/img/posts/rl/ohdrl-complete-flow/17-dqn-data-flow.jpg)

*직접 작성한 `OhDRL.pdf`, p.71. Environment, behavior Q-network, replay buffer의 관계.*

![DQN 전체 pseudocode](/assets/img/posts/rl/ohdrl-complete-flow/detail-p074-dqn-algorithm.jpg)

*직접 작성한 `OhDRL.pdf`, p.74. Epsilon-greedy data collection과 replay minibatch update가 한 loop에 들어간 DQN.*

한 minibatch update의 실제 순서:

1. Replay buffer에서 $(s_i,a_i,r_i,s'_i,d_i)$ sampling
2. Online network의 selected Q 계산

   $$
   q_i
   =
   Q(s_i,a_i;\theta)
   $$

3. Target network로 bootstrap target 계산

   $$
   y_i
   =
   r_i
   +
   \gamma(1-d_i)
   \max_{a'}Q(s'_i,a';\theta^-)
   $$

4. TD loss 최소화

   $$
   L
   =
   \frac1B
   \sum_i
   \ell(y_i-q_i)
   $$

5. 일정 주기마다 $\theta^-$ update

$\ell$은 MSE 대신 Huber loss를 자주 사용한다. 큰 TD error가 gradient를 과도하게 지배하는 현상을 줄이기 위한 선택.

Atari DQN은 연속 4 frame을 입력으로 사용해 정지 화면 하나에서 알 수 없는 속도와 방향을 표현한다. 앞서 본 Markov state 설계가 실제 network input에서 다시 등장한 사례.

![DQN의 frame stack과 CNN 입력](/assets/img/posts/rl/ohdrl-complete-flow/detail-p075-dqn-cnn-input.jpg)

*직접 작성한 `OhDRL.pdf`, p.75. $84\times84$ grayscale frame 네 장을 쌓아 motion 정보를 network에 전달하는 구조.*

Frame stack은 완전한 Markov state를 보장하는 장치가 아니라 짧은 motion history를 제공하는 근사. 로봇에서도 position만 넣을지, velocity와 previous action까지 넣을지의 문제가 같은 맥락이다.

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

$n$이 커질수록 실제 reward 비중은 늘고 bootstrap 비중은 줄어든다. 하지만 replay transition이 여러 behavior policy에서 왔다면 중간 action sequence가 현재 greedy policy와 다를 수 있다. Rainbow류 구현에서 $n$-step과 replay를 함께 쓸 때 trajectory fragment 저장과 terminal boundary 처리가 필요한 이유.

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

Uniform sampling 대신 TD error가 큰 transition을 더 자주 보는 방식.

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

![Prioritized Replay의 TD-error priority](/assets/img/posts/rl/ohdrl-complete-flow/detail-p079-prioritized-replay.jpg)

*직접 작성한 `OhDRL.pdf`, p.79. TD error를 learning progress의 proxy로 사용해 replay 확률을 바꾸는 과정.*

$\alpha=0$이면 uniform replay, 값이 커질수록 priority를 강하게 반영. $\beta=1$이면 importance correction을 완전히 적용하는 형태다. 실제 loss에서는 batch 최대 weight로 정규화하기도 한다.

$$
\tilde w_i
=
\frac{w_i}{\max_j w_j}
$$

Transition을 update한 뒤 새 TD error로 priority도 다시 갱신해야 한다. 새 sample이 한 번도 선택되지 않는 것을 막기 위해 현재 최대 priority로 삽입하는 구현도 흔하다.

### **6.6 Dueling DQN**

Q를 state value와 action advantage로 분해:

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

![Dueling DQN의 identifiability 문제](/assets/img/posts/rl/ohdrl-complete-flow/detail-p084-dueling-identifiability.jpg)

*직접 작성한 `OhDRL.pdf`, p.84. $V$와 $A$를 유일하게 분리할 수 없는 문제와 max/mean subtraction.*

원 논문에서 제시한 두 aggregator:

$$
Q(s,a)
=
V(s)
+
\left[
A(s,a)-\max_{a'}A(s,a')
\right]
$$

또는:

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

Mean subtraction은 모든 action advantage에 gradient를 분배하기 쉬워 실전에서 널리 사용된다. Dueling architecture가 모든 환경에서 자동 개선을 보장하는 것은 아니다. 여러 action의 차이가 작고 state value를 먼저 파악하는 것이 유리한 구간에서 특히 의미가 크다.

Value-based method는 discrete action에서 $\arg\max_aQ(s,a)$를 쉽게 계산한다. 하지만 연속 action은 전부 열거할 수 없다. Policy를 직접 출력하는 쪽으로 넘어가는 이유다.

## **7. Policy Gradient와 Actor-Critic**

### **7.1 Policy를 직접 미분**

Parameter $\theta$를 가진 policy:

$$
\pi_\theta(a\mid s)
$$

최적화 목표:

$$
J(\theta)
=
\mathbb E_{\tau\sim\pi_\theta}
\left[
\sum_t\gamma^tR_{t+1}
\right]
$$

Trajectory probability:

$$
p_\theta(\tau)
=
p(s_0)
\prod_{t=0}^{T-1}
\pi_\theta(a_t\mid s_t)
p(s_{t+1}\mid s_t,a_t)
$$

Expected return을 trajectory integral로 쓰면:

$$
J(\theta)
=
\int
p_\theta(\tau)R(\tau)\,d\tau
$$

Log-derivative trick:

$$
\nabla_\theta p_\theta(\tau)
=
p_\theta(\tau)
\nabla_\theta\log p_\theta(\tau)
$$

Environment dynamics는 $\theta$와 독립이므로 log trajectory에서 policy term만 미분에 남는다.

$$
\nabla_\theta\log p_\theta(\tau)
=
\sum_t
\nabla_\theta
\log\pi_\theta(a_t\mid s_t)
$$

따라서:

$$
\nabla_\theta J(\theta)
=
\mathbb E_{\tau\sim\pi_\theta}
\left[
R(\tau)
\sum_t
\nabla_\theta
\log\pi_\theta(a_t\mid s_t)
\right]
$$

![Policy Gradient의 sampling approximation](/assets/img/posts/rl/ohdrl-complete-flow/detail-p088-policy-gradient-sampling.jpg)

*직접 작성한 `OhDRL.pdf`, p.88. 남아 있는 expectation을 trajectory minibatch 평균으로 바꾸는 과정.*

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

Reward가 큰 trajectory에서 실행한 action의 log-probability를 높이는 구조. 환경 dynamics에 대한 미분은 필요 없다.

전체 episode return을 모든 action에 곱할 필요는 없다. Action $A_t$보다 과거에 받은 reward는 그 action의 결과가 아니므로 reward-to-go를 사용한다.

$$
G_t
=
\sum_{k=t}^{T-1}
\gamma^{k-t}R_{k+1}
$$

이 causality 적용만으로도 불필요한 variance가 줄어든다.

### **7.2 REINFORCE와 baseline**

REINFORCE가 weight로 쓰는 값은 MC return.

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

![REINFORCE algorithm](/assets/img/posts/rl/ohdrl-complete-flow/detail-p089-reinforce-algorithm.jpg)

*직접 작성한 `OhDRL.pdf`, p.89. Episode를 끝까지 sampling하고 reward-to-go로 policy parameter를 update하는 Monte Carlo Policy Gradient.*

REINFORCE의 실제 순서:

1. $\pi_\theta$로 complete episode 생성
2. 각 $t$에서 reward-to-go $G_t$ 계산
3. $G_t\nabla_\theta\log\pi_\theta(A_t\mid S_t)$ 누적
4. Gradient ascent로 $\theta$ update

On-policy estimator이므로 update 전 policy가 만든 trajectory가 필요하다. Policy를 크게 바꾼 뒤 같은 trajectory를 무제한 재사용하면 estimator의 분포 가정이 깨진다.

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

Baseline이 bias를 만들지 않는 이유:

$$
\begin{aligned}
&\mathbb E_{a\sim\pi_\theta(\cdot\mid s)}
\left[
b(s)\nabla_\theta\log\pi_\theta(a\mid s)
\right]\\
&=
b(s)
\sum_a
\pi_\theta(a\mid s)
\frac{\nabla_\theta\pi_\theta(a\mid s)}
{\pi_\theta(a\mid s)}\\
&=
b(s)
\nabla_\theta
\sum_a\pi_\theta(a\mid s)
=0.
\end{aligned}
$$

조건은 baseline이 현재 sampled action에 직접 의존하지 않는다는 것.

![REINFORCE with baseline algorithm](/assets/img/posts/rl/ohdrl-complete-flow/detail-p091-reinforce-baseline-algorithm.jpg)

*직접 작성한 `OhDRL.pdf`, p.91. Policy network와 state-value baseline을 따로 학습하는 구조.*

Value baseline의 학습은 다음 regression:

$$
L_V(\phi)
=
\mathbb E
\left[
\left(G_t-V_\phi(S_t)\right)^2
\right]
$$

이때 actor와 value network가 별개 parameter를 쓸 수도 있고 encoder를 공유할 수도 있다. 공유할 경우 value loss가 policy representation까지 바꾼다는 점을 구현에서 확인해야 한다.

### **7.3 Actor-Critic**

![Actor-Critic의 구성](/assets/img/posts/rl/ohdrl-complete-flow/21-actor-critic.jpg)

*직접 작성한 `OhDRL.pdf`, p.93. Policy를 내는 actor와 value를 추정하는 critic.*

- **Actor:** $\pi_\theta(a\mid s)$를 update
- **Critic:** $V_\phi(s)$ 또는 $Q_\phi(s,a)$를 학습

Policy Gradient의 weight에 가능한 여러 동치 표현:

$$
Q^\pi(s,a)
=
V^\pi(s)+A^\pi(s,a)
$$

State-only baseline $V^\pi(s)$를 빼도 기대 gradient가 같으므로:

$$
\nabla_\theta J
\propto
\mathbb E
\left[
A^\pi(s,a)
\nabla_\theta\log\pi_\theta(a\mid s)
\right]
$$

![Policy Gradient의 Q, advantage, TD-error 형태](/assets/img/posts/rl/ohdrl-complete-flow/detail-p094-policy-gradient-forms.jpg)

*직접 작성한 `OhDRL.pdf`, p.94. REINFORCE, baseline, Actor-Critic이 같은 policy gradient에서 갈라지는 방식.*

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

![One-step Actor-Critic algorithm](/assets/img/posts/rl/ohdrl-complete-flow/detail-p096-actor-critic-algorithm.jpg)

*직접 작성한 `OhDRL.pdf`, p.96. TD error 하나로 critic과 actor를 함께 update하는 online Actor-Critic.*

실제 combined objective의 세 가지 구성:

$$
L
=
L_{\text{actor}}
+
c_vL_{\text{critic}}
-
c_e\mathcal H(\pi_\theta)
$$

- $L_{\text{actor}}$: advantage가 큰 action의 log-probability 증가
- $L_{\text{critic}}$: return 또는 bootstrap target 회귀
- $\mathcal H$: policy가 너무 빨리 deterministic해지는 것을 억제

Actor loss를 계산할 때 $\hat A_t$를 `detach`하는 구현이 일반적이다. Actor gradient가 critic target을 통해 의도치 않게 critic parameter로 흐르지 않도록 gradient 경로를 분리하기 위함.

### **7.4 A3C와 A2C**

A3C는 여러 worker가 서로 다른 environment copy에서 trajectory를 모으고 global parameter를 비동기적으로 update한다.

![A3C의 비동기 worker 구조](/assets/img/posts/rl/ohdrl-complete-flow/21a-a3c.jpg)

*직접 작성한 `OhDRL.pdf`, p.98. 여러 worker actor-critic이 global network를 비동기 update하는 A3C.*

- Replay buffer 없이 경험의 상관 완화
- 여러 exploration trajectory
- n-step return
- actor, critic, entropy loss 결합

![A3C worker와 global parameter update](/assets/img/posts/rl/ohdrl-complete-flow/detail-p099-a3c-implementation.jpg)

*직접 작성한 `OhDRL.pdf`, p.99. Local parameter sync, rollout, accumulated gradient, global asynchronous update.*

각 worker 내부의 흐름:

1. Global $\theta,\phi$를 local parameter로 복사
2. 최대 $t_{\max}$ step rollout
3. Terminal이 아니면 마지막 $V(S_t)$로 bootstrap
4. 뒤에서부터 $R\leftarrow r+\gamma R$ 계산
5. Actor와 critic gradient 누적
6. Global parameter에 asynchronous apply

Worker들이 서로 다른 policy version으로 gradient를 계산할 수 있어 parameter staleness가 존재한다. 대신 여러 독립 trajectory가 replay 없이 data correlation을 완화한다.

A2C는 같은 구조를 동기식 batch update로 바꾼 형태. Worker가 모두 rollout을 끝낸 뒤 gradient를 묶어 update하므로 GPU batch 연산과 일관된 parameter version을 사용하기 쉽다.

![A3C와 A2C의 asynchronous/synchronous 차이](/assets/img/posts/rl/ohdrl-complete-flow/detail-p102-a2c.jpg)

*직접 작성한 `OhDRL.pdf`, p.102. Worker별 즉시 update와 rollout batch 동기화의 차이.*

| 구분 | A3C | A2C |
| --- | --- | --- |
| worker update | 비동기 | 동기 |
| parameter version | worker마다 다를 수 있음 | batch 시작 시 일치 |
| 장점 | CPU 병렬성과 decorrelation | GPU batch 효율과 재현성 |
| 위험 | stale gradient, thread nondeterminism | 느린 worker를 기다리는 barrier |

## **8. Continuous Control: DDPG, TRPO, PPO**

### **8.1 DDPG: deterministic actor와 off-policy critic**

연속 action에서 계산하기 어려운 DQN식 $\arg\max_aQ(s,a)$. DDPG는 이 탐색 대신 actor가 action을 직접 내도록 만든다.

$$
a=\mu_\theta(s)
$$

Stochastic Policy Gradient는 action distribution까지 평균낸다.

$$
\nabla_\theta J(\theta)
=
\mathbb E_{s\sim\rho^\pi,a\sim\pi_\theta}
\left[
Q^\pi(s,a)
\nabla_\theta\log\pi_\theta(a\mid s)
\right]
$$

Deterministic Policy Gradient는 action integral을 actor output 하나로 바꾼다.

$$
\nabla_\theta J(\theta)
=
\mathbb E_{s\sim\rho^\mu}
\left[
\nabla_\theta\mu_\theta(s)
\nabla_aQ^\mu(s,a)
\big|_{a=\mu_\theta(s)}
\right]
$$

![Stochastic PG와 Deterministic PG 비교](/assets/img/posts/rl/ohdrl-complete-flow/detail-p105-deterministic-policy-gradient.jpg)

*직접 작성한 `OhDRL.pdf`, p.105. Action distribution 적분을 deterministic actor의 chain rule로 바꾸는 DPG.*

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

Critic loss:

$$
L_Q(\phi)
=
\mathbb E_{\mathcal D}
\left[
\left(
Q_\phi(s,a)-y
\right)^2
\right]
$$

$$
y
=
r
+
\gamma(1-d)
Q_{\phi^-}
\left(
s',
\mu_{\theta^-}(s')
\right)
$$

Actor loss는 critic이 actor action에 주는 Q를 최대화.

$$
L_\mu(\theta)
=
-
\mathbb E_{s\sim\mathcal D}
\left[
Q_\phi(s,\mu_\theta(s))
\right]
$$

여기서는 $\phi$를 고정하고 action을 거쳐 $\theta$로 gradient가 흐른다. Critic parameter까지 actor optimizer가 바꾸지 않도록 optimizer 경계를 분리해야 한다.

DDPG를 이루는 구성:

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

![DDPG 전체 algorithm](/assets/img/posts/rl/ohdrl-complete-flow/detail-p108-ddpg-algorithm.jpg)

*직접 작성한 `OhDRL.pdf`, p.108. Replay sampling, critic target, deterministic actor gradient, soft target update의 전체 순서.*

Soft target update:

$$
\theta^-
\leftarrow
\tau\theta+(1-\tau)\theta^-
$$

$$
\phi^-
\leftarrow
\tau\phi+(1-\tau)\phi^-
$$

Deterministic policy 자체에는 sampling entropy가 없으므로 data collection에서 exploration noise가 별도로 필요하다. Training 시 noise를 더한 behavior action과 evaluation 시 noise 없는 actor action을 구분해야 한다.

Off-policy 데이터 재사용은 효율적이지만 critic error가 actor를 잘못된 방향으로 강하게 끌 수 있다.

Actor는 critic이 실제 data support 밖에서 만든 Q surface의 gradient도 따른다. 좁은 overestimation peak를 actor가 증폭할 수 있는 구조. TD3는 이를 줄이기 위해 twin critic, delayed actor update, target policy smoothing을 추가했다.

### **8.2 TRPO: parameter 거리가 아니라 policy 거리를 제한**

같은 크기의 parameter update라도 network 안의 위치에 따라 action distribution 변화는 크게 달라진다. TRPO가 택한 기준은 parameter 거리가 아니라 old/new policy의 KL divergence.

Performance difference identity:

$$
\eta(\pi)
=
\eta(\pi_{\text{old}})
+
\mathbb E_{s\sim\rho^\pi,a\sim\pi}
\left[
A^{\pi_{\text{old}}}(s,a)
\right]
$$

정확한 식에는 **새 policy의 state visitation $\rho^\pi$**가 들어간다. 하지만 새 policy를 실행하기 전에는 이 분포를 직접 알기 어렵다.

![TRPO의 performance difference와 local surrogate](/assets/img/posts/rl/ohdrl-complete-flow/detail-p111-trpo-performance-difference.jpg)

*직접 작성한 `OhDRL.pdf`, p.111. 새 policy의 occupancy가 들어가는 정확한 목적과 old-policy occupancy로 만든 local approximation.*

TRPO는 state distribution을 old policy 것으로 고정한 surrogate를 만든다.

$$
L_{\pi_{\text{old}}}(\pi)
=
\eta(\pi_{\text{old}})
+
\mathbb E_{s\sim\rho^{\pi_{\text{old}}},a\sim\pi}
\left[
A^{\pi_{\text{old}}}(s,a)
\right]
$$

Old policy sample로 다시 쓰면 importance ratio가 등장.

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

Surrogate가 실제 $\eta(\pi)$와 가까우려면 policy update가 작아야 한다. Policy distance를 제한하는 이유는 단순한 regularization 취향이 아니라 **state visitation을 old policy 것으로 대체한 근사의 유효 범위**를 지키기 위해서다.

### **8.2.1 Conservative update와 MM**

Conservative Policy Iteration은 old policy와 candidate policy를 섞는다.

$$
\pi_{\text{new}}
=
(1-\alpha)\pi_{\text{old}}
+
\alpha\pi'
$$

$\alpha$를 작게 두면 policy collapse 가능성을 줄일 수 있지만 neural policy parameter update에 직접 적용하기 불편하다. TRPO는 policy 사이의 total variation/KL distance를 이용해 더 일반적인 성능 하한으로 연결한다.

![Minorization-Maximization과 TRPO 하한](/assets/img/posts/rl/ohdrl-complete-flow/detail-p114-mm-algorithm.jpg)

*직접 작성한 `OhDRL.pdf`, p.114. 현재 policy에서 실제 objective에 접하는 lower bound를 만들고 그 bound를 최대화하는 MM 관점.*

MM의 반복 구조:

1. 현재 $\theta_i$에서 실제 objective의 lower bound $M_i(\theta)$ 구성
2. $M_i(\theta_i)=\eta(\theta_i)$가 되도록 접촉
3. $\theta_{i+1}=\arg\max_\theta M_i(\theta)$
4. 새 지점에서 lower bound 재구성

이론은 max-state KL bound를 사용하지만, 구현에서는 sampled state의 **average KL constraint**로 근사한다. Neural policy의 실제 update가 매 iteration 단조 개선한다고 보장되지는 않는다.

![Practical TRPO algorithm](/assets/img/posts/rl/ohdrl-complete-flow/detail-p118-trpo-practical-algorithm.jpg)

*직접 작성한 `OhDRL.pdf`, p.118. Trajectory collection, advantage estimation, constrained optimization의 실용적 반복.*

실제 TRPO의 순서:

1. $\pi_{\text{old}}$로 trajectory 수집
2. Return/critic으로 $\hat A_t$ 추정
3. Sampled surrogate gradient $g$ 계산
4. KL Hessian-vector product 구현
5. Conjugate Gradient로 $F^{-1}g$ 근사
6. Backtracking line search로 surrogate 개선과 KL constraint 동시 확인

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

![Natural Policy Gradient의 1차 목적과 2차 KL 근사](/assets/img/posts/rl/ohdrl-complete-flow/detail-p119-natural-policy-gradient.jpg)

*직접 작성한 `OhDRL.pdf`, p.119. Objective는 1차, KL constraint는 Fisher matrix를 이용한 2차 근사.*

Local constrained problem:

$$
\max_{\Delta\theta}
\quad
g^\top\Delta\theta
$$

subject to:

$$
\frac12
\Delta\theta^\top
F
\Delta\theta
\le\delta
$$

해의 방향과 scale:

$$
\Delta\theta
=
\sqrt{
\frac{2\delta}
{g^\top F^{-1}g}
}
F^{-1}g
$$

Parameter 좌표의 Euclidean steepest direction이 아니라 policy distribution 공간의 geometry를 반영한다. TRPO는 conjugate gradient와 line search로 큰 Fisher matrix의 inverse를 직접 만들지 않고 trust-region step을 근사한다.

$F^{-1}$를 명시적으로 계산하지 않는다. 필요한 것은 $Fx$라는 Hessian-vector product. Automatic differentiation으로 이를 계산하고 Conjugate Gradient로 $Fx=g$를 반복해서 푼다.

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

Clipping은 advantage의 부호에 따라 해석이 달라진다.

**$\hat A_t>0$인 좋은 action**

$$
\min
\left(
r_t\hat A_t,
(1+\epsilon)\hat A_t
\right)
$$

확률을 높이되 $r_t>1+\epsilon$ 이후 추가 이득을 제거.

**$\hat A_t<0$인 나쁜 action**

$$
\min
\left(
r_t\hat A_t,
(1-\epsilon)\hat A_t
\right)
$$

확률을 낮추되 $r_t<1-\epsilon$ 방향의 과도한 변화에 추가 이득이 없도록 만든다.

PPO가 ratio 자체를 항상 범위 안에 투영하는 것은 아니다. Objective의 일부 구간을 평평하게 만들 뿐, 다른 sample과 shared parameter 때문에 최종 KL은 커질 수 있다.

Clipping은 ratio가 범위를 벗어났을 때 objective의 이득을 잘라낸다. 모든 state에서 실제 KL이 반드시 제한된다는 hard constraint는 아니다. 실무에서는 observed KL, entropy, value loss, gradient norm도 함께 확인한다.

### **8.4.1 GAE와 PPO loss**

PPO 구현에서 자주 쓰이는 advantage estimator, GAE:

$$
\delta_t
=
r_t
+
\gamma V(s_{t+1})
-
V(s_t)
$$

$$
\hat A_t^{\text{GAE}(\gamma,\lambda)}
=
\sum_{l=0}^{T-t-1}
(\gamma\lambda)^l
\delta_{t+l}
$$

$\lambda$가 작으면 one-step TD에 가까워 낮은 variance와 큰 bootstrap bias, 1에 가까우면 긴 return에 가까워 작은 bias와 큰 variance. 앞의 TD($\lambda$)가 policy optimization에서 다시 등장한 것.

실제 PPO loss:

$$
L
=
-
L^{\text{CLIP}}
+
c_vL_V
-
c_e\mathcal H(\pi)
$$

같은 rollout을 여러 minibatch epoch 재사용하되 policy가 old policy에서 너무 멀어지기 전에 중단해야 한다. `clip_fraction`, approximate KL, entropy, explained variance를 함께 보는 이유.

| 알고리즘 | Data | Policy | 핵심 안정화 |
| --- | --- | --- | --- |
| DDPG | off-policy replay | deterministic | target networks, soft update |
| TRPO | on-policy | stochastic | explicit average KL constraint |
| NPG | 주로 on-policy | stochastic | Fisher geometry |
| PPO | on-policy | stochastic | clipped surrogate |

![RL·DRL 알고리즘 전체 비교](/assets/img/posts/rl/ohdrl-complete-flow/detail-p124-drl-comparison.jpg)

*직접 작성한 `OhDRL.pdf`, p.124. Model 유무, state/action space, on/off-policy, objective를 한 표로 정리한 장의 마지막 슬라이드.*

## **9. Distributional Reinforcement Learning**

### **9.1 Return distribution과 Q**

지금까지 $Q^\pi(s,a)$는 하나의 실수였다. 그런데 실제로 한 상태에서 같은 행동을 반복해도 매번 같은 return이 나오지는 않는다.

- 환경 전이 $S_{t+1}\sim P(\cdot\mid S_t,A_t)$의 무작위성
- 즉시 보상 $R_{t+1}$의 무작위성
- stochastic policy $A_t\sim\pi(\cdot\mid S_t)$의 무작위성
- 위 세 요소가 미래 여러 step에 걸쳐 누적되는 효과

Return은 처음부터 확률변수.

$$
Z^\pi(s,a)
\overset{D}{=}
\left(
\sum_{k=0}^{\infty}
\gamma^kR_{t+k+1}
\;\middle|\;
S_t=s,\ A_t=a
\right)
$$

기존 action value는 이 분포의 첫 번째 moment, 즉 평균만 남긴 값.

$$
Q^\pi(s,a)
=
\mathbb E
\left[
Z^\pi(s,a)
\right]
$$

한 step의 reward distribution과 return distribution도 구분해야 한다. $R(s,a)$는 지금 받을 보상, $Z^\pi(s,a)$는 그 이후 모든 확률적 전이와 행동을 통과해 누적되는 discounted sum. Distributional RL의 직접적인 학습 대상은 후자다.

같은 평균 아래에 전혀 다른 variance, 꼬리, multimodality가 숨어 있을 수 있다.

![기대값이 숨기는 return distribution](/assets/img/posts/rl/ohdrl-complete-flow/25-mean-hides-risk.jpg)

*직접 작성한 `OhDRL.pdf`, p.127. 평균 통근 시간은 같지만 위험 구조가 다른 예시.*

예를 들어 자동차와 기차의 기대 통근 시간이 모두 42분이라고 하자.

$$
\mathbb E[Z_{\text{car}}]
=
30\cdot\frac45
+
90\cdot\frac15
=42,
\qquad
Z_{\text{train}}=42
$$

기대값만 보면 동률. 분포를 펼치면 자동차는 30분과 90분에 질량이 놓인 bimodal distribution, 기차는 42분 근처에 집중된 distribution이다. 사고가 있는 날의 최악 구간을 중시하는지, 평소의 짧은 시간을 중시하는지에 따라 선택은 달라진다.

Distributional critic이 표현하는 것은 **return의 aleatoric variability**에 가깝다. 데이터 부족으로 생기는 model parameter의 epistemic uncertainty와는 다르다. Return distribution을 출력한다고 critic의 불확실성이 모두 해결되지는 않는다.

### **9.2 Distributional Bellman equation**

Scalar Bellman equation:

$$
Q^\pi(s,a)
=
\mathbb E
\left[
R_{t+1}
+
\gamma Q^\pi(S_{t+1},A_{t+1})
\mid S_t=s,A_t=a
\right]
$$

기대값을 취하기 전의 확률변수 관계:

$$
Z^\pi(s,a)
\overset{D}{=}
R_{t+1}
+
\gamma
Z^\pi(S',A')
$$

$S'\sim P(\cdot\mid s,a)$, $A'\sim\pi(\cdot\mid S')$. $\overset{D}{=}$는 두 sample이 항상 같은 숫자라는 뜻이 아니라 양변이 같은 확률법칙을 따른다는 표시다.

Distributional Bellman operator:

$$
(\mathcal T^\pi Z)(s,a)
\overset{D}{=}
R_{t+1}
+
\gamma Z(S',A')
$$

현재 분포를 reward만큼 평행이동하고 $\gamma$만큼 축소한 다음, 가능한 다음 상태와 행동의 확률에 따라 섞는 연산이다. Scalar Bellman backup의 결과가 weighted average 하나라면 distributional backup의 결과는 **shifted-and-scaled mixture distribution**.

![Distributional Bellman equation과 policy evaluation](/assets/img/posts/rl/ohdrl-complete-flow/detail-p128-distributional-bellman.jpg)

*직접 작성한 `OhDRL.pdf`, p.128. 고정 policy에서 distributional Bellman operator를 반복했을 때의 fixed-point 관점.*

고정된 policy $\pi$를 평가할 때 $\mathcal T^\pi$는 maximal $p$-Wasserstein metric에서 $\gamma$-contraction.

$$
\bar d_p
\left(
\mathcal T^\pi Z_1,\mathcal T^\pi Z_2
\right)
\le
\gamma
\bar d_p(Z_1,Z_2)
$$

여기서

$$
\bar d_p(Z_1,Z_2)
=
\sup_{s,a}
W_p
\left(
Z_1(s,a),Z_2(s,a)
\right)
$$

$\gamma<1$이므로 반복할수록 두 후보 분포 사이 거리가 줄고, 고정 policy의 고유한 return distribution $Z^\pi$에 수렴하는 구조.

Control에서는 상황이 달라진다. 다음 action이 고정된 $\pi$에서 나오지 않고 현재 분포의 평균으로 greedy하게 선택된다.

$$
A^*
=
\arg\max_{a'}
\mathbb E
\left[
Z(S',a')
\right]
$$

$$
(\mathcal TZ)(s,a)
\overset{D}{=}
R_{t+1}
+
\gamma
Z
\left(
S',
\arg\max_{a'}
\mathbb E[Z(S',a')]
\right)
$$

평균이 아주 조금 바뀌어 greedy action이 뒤집히면 target distribution 전체가 갑자기 다른 action의 분포로 교체될 수 있다. 이 optimality operator는 일반적으로 distribution space에서 contraction이 아니며 연속성조차 보장되지 않는다. 최적 $Q^{\ast}$의 기대값은 하나여도, 서로 다른 optimal policy가 만드는 최적 return distribution은 여러 개일 수 있다는 문제.

실제 Distributional RL은 무한히 복잡한 분포를 그대로 저장하지 않는다.

1. 표현 가능한 분포 family 선택
2. Distributional Bellman target 구성
3. 그 target을 표현 공간으로 projection 또는 regression
4. 평균을 사용해 control action 선택

### **9.2.1 확률분포의 거리**

두 scalar 값의 오차는 $\lvert x-y\rvert$로 충분하지만, 두 확률분포를 비교하려면 거리의 정의가 필요하다.

Metric $d(P,Q)$의 조건:

1. $d(P,Q)\ge0$, 그리고 $d(P,Q)=0\iff P=Q$
2. $d(P,Q)=d(Q,P)$
3. $d(P,R)\le d(P,Q)+d(Q,R)$

![확률분포의 거리와 divergence](/assets/img/posts/rl/ohdrl-complete-flow/detail-p130-distribution-metrics.jpg)

*직접 작성한 `OhDRL.pdf`, p.130. Total variation, KL divergence, Wasserstein distance의 차이와 손필기 해석.*

**Total variation distance**

$$
\delta(P,Q)
=
\sup_A
\left|
P(A)-Q(A)
\right|
$$

두 분포가 같은 사건에 부여하는 확률 차이의 최댓값. Support가 살짝 이동했을 뿐인데 겹침이 사라지면 큰 값으로 튈 수 있다.

**KL divergence**

$$
D_{\mathrm{KL}}(P\Vert Q)
=
\mathbb E_{X\sim P}
\left[
\log\frac{p(X)}{q(X)}
\right]
$$

비대칭이고 triangle inequality를 만족하지 않아 엄밀한 metric은 아니다. $P$가 질량을 두는 곳에서 $Q=0$이면 무한대가 될 수도 있다.

**$p$-Wasserstein distance**

1차원에서는 quantile function으로 표현 가능.

$$
W_p(P,Q)
=
\left[
\int_0^1
\left|
F_P^{-1}(\tau)
-
F_Q^{-1}(\tau)
\right|^p
d\tau
\right]^{1/p}
$$

확률 질량을 한 분포에서 다른 분포로 옮기는 데 필요한 이동량으로 해석 가능하다. 두 Dirac distribution $\delta_x,\delta_y$의 거리는 단순히 $\lvert x-y\rvert$. Support가 겹치지 않아도 “얼마나 이동했는가”가 연속적으로 남기 때문에 return atom의 위치를 다루는 데 자연스럽다.

Distributional Bellman evaluation은 Wasserstein metric으로 설명되지만, C51이 학습하는 것은 Wasserstein loss가 아니다. 고정 support에 projection한 categorical target과 cross-entropy를 사용한다. QR-DQN은 quantile regression을 사용해 이 차이를 피한다.

### **9.3 C51: 고정된 위치, 학습되는 확률**

![Distributional RL 알고리즘의 표현 차이](/assets/img/posts/rl/ohdrl-complete-flow/26-distributional-overview.jpg)

*직접 작성한 `OhDRL.pdf`, p.131. Scalar DQN에서 C51, QR-DQN, IQN으로.*

C51은 $[V_{\min},V_{\max}]$ 안에 $N=51$개의 support atom을 고정한다.

$$
z_i
=
V_{\min}
+
i\Delta z,
\qquad
\Delta z
=
\frac{V_{\max}-V_{\min}}{N-1},
\qquad i=0,\ldots,N-1
$$

Network가 각 action마다 출력하는 것은 atom의 위치가 아니라 그 위치에 놓일 확률.

$$
Z_\theta(s,a)
=
\sum_{i=0}^{N-1}
p_i(s,a)\delta_{z_i}
$$

$$
p_i(s,a)
=
\operatorname{softmax}_i
\left(
\ell_\theta(s,a)
\right)
$$

Action selection에 사용하는 값은 분포의 기대값:

$$
Q_\theta(s,a)
=
\mathbb E[Z_\theta(s,a)]
=
\sum_i z_ip_i(s,a)
$$

#### **C51 target과 categorical projection**

Transition $(s,a,r,s',d)$에서 다음 greedy action:

$$
a^*
=
\arg\max_{a'}
\sum_jz_jp_j(s',a')
$$

Terminal mask까지 포함한 target atom:

$$
\hat z_j
=
\operatorname{clip}
\left(
r
+
\gamma(1-d)z_j,\,
V_{\min},V_{\max}
\right)
$$

$\hat z_j$는 대개 고정 grid 위에 정확히 놓이지 않는다. Support coordinate:

$$
b_j
=
\frac{\hat z_j-V_{\min}}{\Delta z},
\qquad
l_j=\lfloor b_j\rfloor,
\qquad
u_j=\lceil b_j\rceil
$$

Target atom $j$의 질량 $p_j(s',a^*)$를 아래·위 support로 선형 분배.

$$
m_{l_j}
\mathrel{+}=
p_j(s',a^*)(u_j-b_j)
$$

$$
m_{u_j}
\mathrel{+}=
p_j(s',a^*)(b_j-l_j)
$$

$l_j=u_j$인 정확한 grid point에서는 질량 전체를 그 atom에 더해야 한다. 구현에서 이 case를 빼면 정수 위치의 확률이 사라지는 bug.

![C51의 categorical projection](/assets/img/posts/rl/ohdrl-complete-flow/detail-p132-c51-projection.jpg)

*직접 작성한 `OhDRL.pdf`, p.132. Bellman 이동 뒤 support 양옆으로 확률 질량을 나누는 C51 projection.*

현재 선택 action의 log probability와 projected target $m$ 사이 cross-entropy:

$$
\mathcal L_{\text{C51}}
=
-
\sum_{i=0}^{N-1}
m_i
\log p_i(s,a)
$$

Target branch는 `detach` 또는 target network로 gradient를 끊는다. Online network로 next action을 고르고 target network에서 그 분포를 가져오면 Double DQN식 action selection/evaluation 분리도 가능.

C51의 장단점:

- 장점: discrete categorical output, 안정적인 cross-entropy, 분포 모양의 명시적 표현
- 제약: $V_{\min},V_{\max}$를 사전에 정해야 함
- 범위가 좁을 때: 실제 return이 양 끝 atom으로 clip
- 범위가 넓을 때: 동일한 51개 atom으로 표현하므로 해상도 저하
- projection: Bellman target을 정확히 보존하는 연산이 아니라 표현 공간으로 되돌리는 근사

### **9.4 QR-DQN: 고정된 확률, 학습되는 위치**

C51의 parameterization을 뒤집은 형태가 QR-DQN.

![C51과 QR-DQN](/assets/img/posts/rl/ohdrl-complete-flow/27-c51-vs-qr-dqn.jpg)

*직접 작성한 `OhDRL.pdf`, p.134. 고정 위치·학습 확률과 고정 확률·학습 위치의 차이.*

C51:

$$
Z_\theta(s,a)
=
\sum_i p_i(s,a)\delta_{z_i}
$$

QR-DQN:

$$
Z_\theta(s,a)
=
\frac1N
\sum_{i=1}^{N}
\delta_{\theta_i(s,a)}
$$

각 atom의 질량은 $1/N$으로 고정하고 network가 quantile 위치 $\theta_i(s,a)$를 학습한다. Quantile midpoint는:

$$
\hat\tau_i
=
\frac{\tau_{i-1}+\tau_i}{2},
\qquad
\tau_i=\frac{i}{N}
$$

평균 Q는 quantile 위치의 평균.

$$
Q_\theta(s,a)
\approx
\frac1N
\sum_{i=1}^N
\theta_i(s,a)
$$

고정 support 범위와 categorical projection이 필요 없다는 차이도 여기서 생긴다.

#### **왜 quantile regression인가**

일반 $L_2$ regression이 찾는 것은 conditional mean, $L_1$ regression이 찾는 것은 conditional median. 원하는 $\tau$-quantile에는 비대칭 pinball loss를 사용한다.

$$
\rho_\tau(u)
=
\left|
\tau-\mathbb I\{u<0\}
\right|
|u|
$$

과소추정 $u>0$과 과대추정 $u<0$에 서로 다른 가중치를 주는 구조. 미분 안정성을 위해 Huber loss와 결합한다.

$$
\mathcal L_\kappa(u)
=
\begin{cases}
\frac12u^2,
& |u|\le\kappa\\
\kappa
\left(
|u|-\frac12\kappa
\right),
& |u|>\kappa
\end{cases}
$$

$$
\rho_{\tau}^{\kappa}(u)
=
\left|
\tau-\mathbb I\{u<0\}
\right|
\frac{\mathcal L_\kappa(u)}{\kappa}
$$

![Quantile regression과 pairwise loss](/assets/img/posts/rl/ohdrl-complete-flow/detail-p136-quantile-regression.jpg)

*직접 작성한 `OhDRL.pdf`, p.136. Target quantile과 prediction quantile의 모든 조합에 비대칭 loss를 적용하는 과정.*

Target action:

$$
a^*
=
\arg\max_{a'}
\frac1N
\sum_{j=1}^N
\theta_j(s',a')
$$

Target sample:

$$
y_j
=
r
+
\gamma(1-d)
\theta_j^-(s',a^*)
$$

Prediction $i$와 target $j$의 pairwise TD error:

$$
u_{ij}
=
y_j-\theta_i(s,a)
$$

최종 loss:

$$
\mathcal L_{\text{QR}}
=
\frac1{NN'}
\sum_{i=1}^{N}
\sum_{j=1}^{N'}
\rho_{\hat\tau_i}^{\kappa}(u_{ij})
$$

Tensor로는 prediction `[B,N,1]`, target `[B,1,N']`, difference `[B,N,N']`. Scalar TD loss보다 메모리와 계산량이 늘지만, sampled gradient로 Wasserstein quantile projection을 직접 최적화할 수 있다는 이점.

### **9.5 IQN**

QR-DQN은 정해 둔 $N$개 quantile midpoint마다 별도 output을 낸다. IQN이 학습하는 대상은 $\tau\in[0,1]$를 입력으로 받는 quantile function 자체.

$$
Z_\tau(s,a)
\approx
F^{-1}_{Z(s,a)}(\tau)
$$

고정된 quantile index가 아니라 매 update마다 $\tau$를 sampling. 표현 해상도가 quantile output 개수에만 묶이지 않고 network capacity와 training sample 수로 옮겨간다.

![IQN의 sampled quantile](/assets/img/posts/rl/ohdrl-complete-flow/28-iqn.jpg)

*직접 작성한 `OhDRL.pdf`, p.139. $\tau$를 sampling해 implicit quantile function을 근사하는 IQN.*

IQN은 state feature와 quantile embedding을 결합한다.

$$
\psi(s)\in\mathbb R^d
$$

$$
\phi_j(\tau)
=
\operatorname{ReLU}
\left(
\sum_{i=0}^{n-1}
\cos(\pi i\tau)w_{ij}
+
b_j
\right)
$$

$$
Z_\tau(s,\cdot)
=
f
\left(
\psi(s)\odot\phi(\tau)
\right)
$$

![IQN network와 sampled quantile update](/assets/img/posts/rl/ohdrl-complete-flow/detail-p142-iqn-implementation.jpg)

*직접 작성한 `OhDRL.pdf`, p.142. State feature와 cosine quantile embedding을 합치고 sampled quantile loss를 계산하는 IQN 구현 흐름.*

대표 tensor shape:

```text
state_features  : [B, D]
tau             : [B, N, 1]
tau_embedding   : [B, N, D]
joint_features  : [B, N, D]
quantile_values : [B, N, A]
```

Action selection용 $\tilde\tau_k$, current loss용 $\tau_i$, target용 $\tau'_j$의 sample 수를 서로 다르게 둘 수 있다. 코드에서 `num_quantiles`, `num_target_quantiles`, `num_greedy_quantiles`가 따로 등장하는 이유.

#### **분포를 배운 뒤 어떻게 위험을 반영할까**

Uniform $\tau$의 평균:

$$
Q(s,a)
=
\mathbb E_{\tau\sim U[0,1]}
\left[
Z_\tau(s,a)
\right]
$$

이 값으로 $\arg\max_aQ(s,a)$를 고르면 여전히 risk-neutral policy. Distributional model을 학습했다는 사실만으로 위험 회피가 생기지는 않는다.

Distortion function $\beta:[0,1]\to[0,1]$를 적용하면 action selection에 사용할 quantile 구간을 바꿀 수 있다.

$$
Q_\beta(s,a)
=
\mathbb E_{\tau\sim U[0,1]}
\left[
Z_{\beta(\tau)}(s,a)
\right]
$$

![Risk-sensitive action selection](/assets/img/posts/rl/ohdrl-complete-flow/detail-p140-risk-sensitive-rl.jpg)

*직접 작성한 `OhDRL.pdf`, p.140. 평균과 표준편차, distorted quantile을 이용한 risk-averse·risk-seeking action selection.*

하위 $\alpha$ 구간을 평균내는 lower-tail CVaR 예시:

$$
\operatorname{CVaR}_\alpha(Z)
=
\frac1\alpha
\int_0^\alpha
F_Z^{-1}(\tau)d\tau
$$

낮은 return이 실패를 뜻하는 문제에서 이 값을 최대화하면 tail failure를 더 민감하게 본다. 반대로 상위 quantile을 강조하면 낙관적 선택 가능. 어느 방향이 “안전”인지는 reward 부호와 task 정의에 달려 있으므로 distortion의 의미를 먼저 확인해야 한다.

> **Distribution을 학습하는 것과 risk-sensitive policy를 사용하는 것은 같은 말이 아니다.** 분포를 배운 뒤 action selection에서 어떤 functional을 적용할지 별도로 정해야 한다.

### **9.6 C51, QR-DQN, IQN 비교**

| 구분 | C51 | QR-DQN | IQN |
| --- | --- | --- | --- |
| 분포 표현 | 고정 atom의 categorical probability | 균일 질량의 학습 quantile 위치 | $\tau$를 입력받는 implicit quantile function |
| Network output | `[B,A,N]` logits | `[B,A,N]` quantile values | `[B,N,A]` sampled quantile values |
| Target 처리 | 고정 support로 categorical projection | Pairwise quantile regression | Sampled pairwise quantile regression |
| 주 loss | Cross-entropy | Quantile Huber | Quantile Huber |
| Return bound | $V_{\min},V_{\max}$ 필요 | 불필요 | 불필요 |
| Action selection | 분포의 평균 | Quantile 평균 | Sampled quantile 평균 또는 distortion |
| 주의점 | Support clipping, projection index | `[N,N']` 축, quantile crossing | $\tau$ 축, sample 수, risk distortion |

세 방법 모두 DQN의 뼈대를 버리지 않는다.

```text
transition sampling
    -> next action selection
    -> distributional Bellman target
    -> target network에서 target distribution
    -> current action distribution과 loss
    -> optimizer step
    -> 주기적 target update
```

달라진 지점은 scalar target `y: [B]`의 distributional target 확장.

### **9.7 구현 주의점**

**1. `terminated`와 `truncated`를 같은 terminal로 처리**

환경의 진짜 terminal에서는 bootstrap을 제거. Time-limit truncation은 underlying MDP가 계속된다면 bootstrap을 유지해야 한다. 무조건 `(1-done)`을 곱하면 긴 horizon return 분포가 아래로 bias될 수 있다.

**2. Target branch에 gradient가 연결**

Bellman target을 만드는 target network output, C51 projection, QR/IQN target quantile은 optimizer graph에서 분리. 그렇지 않으면 prediction이 target을 쫓는 동시에 target도 prediction 쪽으로 움직이는 구조.

**3. Action 축과 atom/quantile 축 혼동**

`argmax`는 distribution axis가 아니라 기대 Q로 축약한 action axis에 적용한다.

```text
dist       [B, A, N]
q_values   [B, A]       # reduce N
next_action[B]          # argmax A
chosen_dist[B, N]       # gather A
```

**4. C51 support 범위를 reward scale과 무관하게 설정**

Reward clipping, episode horizon, $\gamma$가 바뀌면 plausible return 범위도 바뀐다. Support endpoint에 probability mass가 계속 쌓이는지 histogram으로 확인할 필요.

**5. Distributional critic을 uncertainty estimator로 과대해석**

Return variability, critic parameter uncertainty, model uncertainty는 다른 대상. Ensemble이나 Bayesian approximation 없이 하나의 return distribution만 보고 epistemic uncertainty까지 얻었다고 주장할 수 없다.

**6. Quantile이 항상 정렬될 것이라고 가정**

Network output $\theta_i$가 index 순서대로 완벽히 증가한다는 hard constraint는 보통 없다. Quantile crossing이 생길 수 있으며, 평균 계산에는 곧바로 치명적이지 않아도 해석용 CDF나 risk metric에서는 검사 대상.

### **9.8 Scalar RL과의 차이**

Scalar RL:

$$
(s,a)\longmapsto Q(s,a)
$$

Distributional RL:

$$
(s,a)\longmapsto Z(s,a)
\longmapsto
\begin{cases}
\mathbb E[Z] & \text{risk-neutral control}\\
\rho(Z) & \text{risk-sensitive control}
\end{cases}
$$

Bellman recursion, target network, replay buffer는 그대로 남는다. 바뀐 것은 critic의 표현과 loss. 더 많은 정보를 보존하는 만큼 계산량과 설계 선택지도 함께 늘어난다.

MPO는 distributional critic의 후속 알고리즘이 아니다.

- **Distributional RL:** value를 무엇으로 표현할 것인가?
- **MPO:** critic을 이용해 policy를 어떻게 안정적으로 개선할 것인가?

## **10. Maximum a Posteriori Policy Optimisation**

### **10.1 MPO의 구성**

PPO/TRPO는 on-policy update가 안정적이지만 새 rollout이 필요하다. DDPG는 replay buffer를 재사용하지만 actor가 critic의 local error를 직접 따라갈 수 있다. MPO는 off-policy critic과 KL로 제한한 policy update를 함께 사용한다.

![MPO의 문제의식](/assets/img/posts/rl/ohdrl-complete-flow/29-mpo-overview.jpg)

*직접 작성한 `OhDRL.pdf`, p.144. On-policy 안정성과 off-policy 데이터 효율을 함께 얻으려는 MPO.*

MPO update:

1. Replay buffer로 off-policy critic 학습
2. E-step에서 Q가 높은 action을 선호하는 non-parametric distribution $q$ 생성
3. M-step에서 parametric policy $\pi_\theta$를 $q$에 weighted fitting
4. E-step과 M-step 각각에 KL trust region
5. Gaussian policy의 mean과 covariance update를 별도 제약

DDPG/SAC는 $Q(s,\pi_\theta(s))$를 actor까지 직접 미분한다. MPO는 그 사이에 **Q가 높은 action의 분포 $q$**를 만들고 policy를 $q$에 fitting한다.

### **10.2 Bayes' rule**

Bayes' rule:

$$
P(H\mid D)
=
\frac{
P(D\mid H)P(H)
}{
P(D)
}
$$

- $P(H)$: 데이터를 보기 전 hypothesis의 prior
- $P(D\mid H)$: 그 hypothesis가 관측 $D$를 만들 likelihood
- $P(H\mid D)$: 관측 뒤의 posterior
- $P(D)=\sum_HP(D\mid H)P(H)$: 모든 hypothesis를 평균낸 evidence

![Bayes rule의 네 항](/assets/img/posts/rl/ohdrl-complete-flow/detail-p146-bayes-rule.jpg)

*직접 작성한 `OhDRL.pdf`, p.146. Prior, likelihood, evidence, posterior의 역할.*

Evidence는 posterior가 전체 hypothesis에 대해 합이 1이 되게 만드는 정규화 상수. Parameter optimization에서는 $\theta$와 무관해 자주 생략되지만, Bayesian inference 문제에서 계산이 어려운 핵심 항이기도 하다.

#### **흰 공·검은 공 예제**

두 가설:

- $H_1$: 검은 공 3개, 흰 공 1개
- $H_2$: 검은 공 2개, 흰 공 2개

초기 prior가 $P(H_1)=P(H_2)=1/2$이고 첫 관측이 검은 공 $B$라면:

$$
P(H_1\mid B)
=
\frac{
\frac34\cdot\frac12
}{
\frac34\cdot\frac12
+
\frac12\cdot\frac12
}
=
\frac35
$$

$$
P(H_2\mid B)=\frac25
$$

공을 다시 넣고 다음 색을 관측하면 직전 posterior가 다음 prior가 된다.

![관측마다 posterior를 갱신하는 공 예제](/assets/img/posts/rl/ohdrl-complete-flow/detail-p147-bayes-ball-example.jpg)

*직접 작성한 `OhDRL.pdf`, p.147. 검은 공과 흰 공을 순차 관측하며 두 bag hypothesis의 확률을 갱신하는 예제.*

관측이 추가되면 같은 계산을 반복한다.

```text
old belief
    x new likelihood
    -> normalization
    -> new belief
```

MPO도 current policy를 출발 분포로 두고 critic이 제공한 “좋은 행동이라는 evidence”로 action distribution을 재가중한다는 점에서 같은 모양을 가진다.

### **10.2.1 MLE와 MAP**

Hypothesis를 연속 parameter $\theta$로 바꾸면:

$$
p(\theta\mid X)
=
\frac{
p(X\mid\theta)p(\theta)
}{
p(X)
}
$$

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

Data likelihood만 보는 MLE와 달리 MAP에는 prior가 한 번 더 들어간다. 다만 dataset의 각 sample마다 prior를 반복해서 더하는 식은 아니다. **전체 dataset likelihood에 prior 한 번**.

앞면 확률이 $\theta$인 동전을 $N$번 던져 앞면 $x$번을 관측하면:

$$
p(x\mid\theta)
=
\binom Nx
\theta^x(1-\theta)^{N-x}
$$

Uniform prior에서는 posterior가 likelihood에 비례. Beta prior $\theta\sim\operatorname{Beta}(\alpha,\beta)$를 쓰면 conjugacy에 의해:

$$
\theta\mid x
\sim
\operatorname{Beta}
\left(
\alpha+x,\,
\beta+N-x
\right)
$$

![편향 동전 likelihood와 posterior](/assets/img/posts/rl/ohdrl-complete-flow/detail-p149-biased-coin-posterior.jpg)

*직접 작성한 `OhDRL.pdf`, p.149. $N=5$, 앞면 $x=2$인 관측에서 discrete parameter 후보의 likelihood와 posterior.*

Gaussian prior를 둔 neural-network MAP는 흔히 $L_2$ regularization과 연결된다.

$$
\log p(\theta)
=
-\frac{1}{2\sigma^2}
\Vert\theta\Vert_2^2
+
C
$$

MPO의 이름에 들어간 MAP도 policy parameter가 sample weight만 과하게 추종하지 않도록 이전 policy 주변의 prior 또는 KL constraint를 두는 관점과 이어진다.

### **10.3 ELBO와 EM**

Latent variable $Z$를 주변화한 evidence:

$$
p(X\mid\theta)
=
\int
p(X,Z\mid\theta)dZ
$$

$Z$의 경우의 수가 많거나 posterior가 복잡하면 이 적분을 직접 계산하기 어렵다. 계산 가능한 auxiliary distribution $q(Z)$를 곱하고 나누면:

$$
\log p(X\mid\theta)
=
\log
\mathbb E_{Z\sim q}
\left[
\frac{
p(X,Z\mid\theta)
}{
q(Z)
}
\right]
$$

Log의 concavity와 Jensen inequality:

$$
\log p(X\mid\theta)
\ge
\mathbb E_q
\left[
\log p(X,Z\mid\theta)
-
\log q(Z)
\right]
$$

오른쪽 항이 ELBO(Evidence Lower Bound).

$$
\mathcal L(q,\theta)
=
\mathbb E_q
\left[
\log p(X,Z\mid\theta)
-
\log q(Z)
\right]
$$

동일한 관계를 KL identity로 쓰면:

$$
\log p(X\mid\theta)
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

Evidence와 $\theta$를 고정했을 때 ELBO를 크게 만드는 일은 approximate posterior $q$를 true posterior에 가깝게 만드는 일과 같다.

![ELBO 유도와 variational distribution](/assets/img/posts/rl/ohdrl-complete-flow/detail-p152-elbo.jpg)

*직접 작성한 `OhDRL.pdf`, p.152. Intractable posterior 대신 $q(Z)$를 도입해 evidence lower bound를 만드는 유도.*

#### **EM의 coordinate ascent**

EM은 $q$와 $\theta$를 번갈아 최적화한다.

![Expectation-Maximization의 E-step과 M-step](/assets/img/posts/rl/ohdrl-complete-flow/29a-em-algorithm.jpg)

*직접 작성한 `OhDRL.pdf`, p.153. Latent distribution과 model parameter를 번갈아 최적화하는 EM.*

E-step:

$$
q_{i+1}
=
\arg\max_q
\mathcal L(q,\theta_i)
$$

Exact posterior가 계산 가능하면:

$$
q_{i+1}(Z)
=
p(Z\mid X,\theta_i)
$$

M-step:

$$
\theta_{i+1}
=
\arg\max_\theta
\mathcal L(q_{i+1},\theta)
$$

또는 expected complete-data log-likelihood:

$$
Q(\theta\mid\theta_i)
=
\mathbb E_{
Z\sim p(Z\mid X,\theta_i)
}
\left[
\log p(X,Z\mid\theta)
\right]
$$

$$
\theta_{i+1}
=
\arg\max_\theta
Q(\theta\mid\theta_i)
$$

![EM algorithm의 세부 계산](/assets/img/posts/rl/ohdrl-complete-flow/detail-p154-em-algorithm-details.jpg)

*직접 작성한 `OhDRL.pdf`, p.154. Posterior를 구하는 E-step과 expected complete-data likelihood를 높이는 M-step.*

Exact E/M-step이면 data log-likelihood가 감소하지 않는 monotonic improvement 성질. Deep RL의 MPO에서는 critic approximation, sampled action integral, minibatch update, partial optimization이 들어가므로 고전 EM의 이상적인 보장을 그대로 실험 코드 전체에 옮겨 말하면 과장이다. EM은 구조를 제공하고, 실제 안정성은 KL constraint와 근사 품질에 달려 있다.

### **10.4 Reinforcement Learning as Inference**

일반 강화학습:

$$
\max_\pi
\mathbb E_{\tau\sim p_\pi}
\left[
\sum_t\gamma^tr_t
\right]
$$

추론 관점에서는 trajectory가 “optimal하다”는 가상의 binary variable $O$를 도입한다.

Policy가 유도하는 trajectory prior:

$$
p_\pi(\tau)
=
p(s_0)
\prod_{t\ge0}
p(s_{t+1}\mid s_t,a_t)
\pi(a_t\mid s_t)
$$

높은 reward trajectory가 $O=1$일 unnormalized likelihood를 크게 설정:

$$
p(O=1\mid\tau)
\propto
\exp
\left(
\frac1\alpha
\sum_t\gamma^tr_t
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

Control과 inference의 조건부 분포:

```text
Control:
어떤 action이 future reward를 크게 만드는가?

Inference:
성공했다는 조건 아래 어떤 action이 실행됐을 가능성이 큰가?
```

Auxiliary policy $q$를 도입해 optimality evidence의 lower bound를 구성하면 reward와 policy KL이 함께 나타난다.

$$
\mathcal J(q,\pi_\theta)
=
\mathbb E_{\tau\sim q}
\left[
\sum_t\gamma^tr_t
\right]
-
\alpha
\mathbb E_{s\sim\mu_q}
\left[
D_{\mathrm{KL}}
\left(
q(\cdot\mid s)
\Vert
\pi_\theta(\cdot\mid s)
\right)
\right]
+
\log p(\theta)
$$

![RL-as-inference ELBO와 MPO objective](/assets/img/posts/rl/ohdrl-complete-flow/detail-p156-rl-inference-elbo.jpg)

*직접 작성한 `OhDRL.pdf`, p.156. Trajectory optimality의 ELBO가 reward와 policy KL regularization으로 바뀌는 과정.*

$q$는 개선된 행동 분포, $\pi_\theta$는 parametric policy, $\log p(\theta)$는 MAP prior. MPO는 이 objective를 E-step과 M-step으로 분해한다.

Discounted infinite-horizon objective를 probability model로 옮길 때는 termination distribution이나 time-dependent optimality likelihood도 필요하다. 아래에서는 MPO update에 필요한 variational objective만 사용한다.

### **10.5 MPO E-step**

Iteration $i$에서 current policy $\pi_i=\pi_{\theta_i}$를 고정. Replay buffer로 이 policy의 action value $Q_i(s,a)$를 평가한 뒤, state distribution $\mu(s)$를 고정한 one-step improvement 문제를 푼다.

Soft-regularized form:

$$
\max_q
\mathbb E_{s\sim\mu}
\left[
\mathbb E_{a\sim q}[Q_i(s,a)]
-
\alpha
D_{\mathrm{KL}}
\left(
q(\cdot\mid s)
\Vert
\pi_i(\cdot\mid s)
\right)
\right]
$$

MPO는 reward와 KL을 fixed coefficient로 더하지 않고 hard KL budget을 둔다.

$$
\max_q
\mathbb E_{s\sim\mu}
\mathbb E_{a\sim q(\cdot\mid s)}
\left[
Q_i(s,a)
\right]
$$

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

정규화 constraint까지 포함한 Lagrangian의 stationary solution:

$$
q_i(a\mid s)
\propto
\pi_i(a\mid s)
\exp
\left(
\frac{Q_i(s,a)}{\eta}
\right)
$$

![MPO E-step](/assets/img/posts/rl/ohdrl-complete-flow/31-mpo-e-step.jpg)

*직접 작성한 `OhDRL.pdf`, p.157. Current policy의 action sample을 Q로 재가중하는 E-step.*

$\eta>0$는 temperature이자 E-step KL constraint의 dual variable. Dual objective의 한 형태:

$$
g(\eta)
=
\eta\epsilon
+
\eta
\mathbb E_{s\sim\mu}
\left[
\log
\mathbb E_{a\sim\pi_i}
\left[
\exp
\left(
\frac{Q_i(s,a)}{\eta}
\right)
\right]
\right]
$$

$$
\eta^*
=
\arg\min_{\eta>0}g(\eta)
$$

![Hard-constrained E-step](/assets/img/posts/rl/ohdrl-complete-flow/detail-p158-mpo-hard-estep.jpg)

*직접 작성한 `OhDRL.pdf`, p.158. Arbitrary reward scale에 대응하기 위해 expected KL budget으로 E-step을 제한하는 식.*

Continuous action 적분은 직접 계산하지 않는다. 대신 각 replay state $s_j$에서 current policy action $a_{ij}\sim\pi_i(\cdot\mid s_j)$를 $N$개 sampling:

$$
w_{ij}
=
\frac{
\exp(Q_i(s_j,a_{ij})/\eta)
}{
\sum_k
\exp(Q_i(s_j,a_{kj})/\eta)
}
$$

수치적으로는 state별 maximum을 빼고 softmax:

$$
\tilde Q_{ij}
=
Q_i(s_j,a_{ij})
-
\max_kQ_i(s_j,a_{kj})
$$

$$
w_{ij}
=
\operatorname{softmax}_i
\left(
\tilde Q_{ij}/\eta
\right)
$$

![Non-parametric action distribution](/assets/img/posts/rl/ohdrl-complete-flow/detail-p159-mpo-nonparametric-q.jpg)

*직접 작성한 `OhDRL.pdf`, p.159. Closed form $q_i(a\mid s)\propto\pi_i(a\mid s)\exp(Q_i/\eta)$와 sample 기반 근사.*

$q_i$는 모든 state를 입력받는 neural policy가 아니다. 각 sampled state의 action과 weight로 표현된 non-parametric distribution이다.

$\eta$ 값에 따른 weight:

- 작음: 최고 Q sample에 weight 집중, aggressive improvement
- 큼: weight가 균일해져 current policy에 가까운 conservative improvement
- KL budget $\epsilon$이 작음: 최적 $\eta$가 커지는 경향
- Critic scale이 커짐: fixed temperature 대신 dual optimization이 필요한 이유

E-step의 Q와 weight는 M-step의 고정된 target이다. Actor loss의 gradient는 critic으로 흐르지 않는다.

### **10.6 MPO M-step**

Non-parametric $q_i$는 unseen state에서 action을 생성할 수 없다. M-step은 policy $\pi_\theta$가 이 weighted sample distribution을 일반화하도록 fitting.

$$
\max_\theta
\mathbb E_{s\sim\mu}
\mathbb E_{a\sim q(\cdot\mid s)}
\left[
\log\pi_\theta(a\mid s)
\right]
$$

Minibatch approximation:

$$
\mathcal L_{\text{fit}}(\theta)
=
-
\frac1B
\sum_{j=1}^B
\sum_{i=1}^N
w_{ij}
\log\pi_\theta(a_{ij}\mid s_j)
$$

Q값이 큰 action은 큰 $w_{ij}$를 받아 policy likelihood를 더 강하게 끌어올린다. 형태는 weighted behavior cloning과 비슷하다. 결정적인 차이는 label weight의 출처가 critic이라는 점.

Actor를 $q_i$에 한 번에 맞추면 finite sample과 critic error까지 과하게 추종할 수 있다. 이전 policy와의 M-step trust region:

$$
\mathbb E_s
\left[
D_{\mathrm{KL}}
\left(
\pi_i(\cdot\mid s)
\Vert
\pi_\theta(\cdot\mid s)
\right)
\right]
\le\epsilon_\pi
$$

![MPO M-step](/assets/img/posts/rl/ohdrl-complete-flow/32-mpo-m-step.jpg)

*직접 작성한 `OhDRL.pdf`, p.160. Weighted maximum likelihood와 parametric policy trust region.*

E-step과 M-step의 KL:

| 단계 | Constraint | 역할 |
| --- | --- | --- |
| E-step | $D_{\mathrm{KL}}(q_i\Vert\pi_i)\le\epsilon$ | Current policy가 sample할 수 있는 support 근처에서 improved distribution 구성 |
| M-step | $D_{\mathrm{KL}}(\pi_i\Vert\pi_\theta)\le\epsilon_\pi$ | Parametric policy가 weighted sample에 과적합하며 급변하는 것 억제 |

E-step은 “어떤 action을 믿을까”, M-step은 “그 믿음을 policy에 얼마나 반영할까”에 대한 별도 budget.

#### **Gaussian mean과 covariance를 왜 분리하는가**

Continuous control policy:

$$
\pi_\theta(a\mid s)
=
\mathcal N
\left(
\mu_\theta(s),
\Sigma_\theta(s)
\right)
$$

하나의 KL constraint만 쓰면 mean을 좋은 action 쪽으로 옮기는 비용과 covariance를 줄이는 비용이 같은 budget을 경쟁한다. Weighted samples를 빠르게 fit하면서 covariance까지 급격히 줄어 탐색이 조기에 사라질 수 있다.

MPO는 mean과 covariance에 별도 constraint를 둔다.

$$
C_\mu(\theta)
\le\epsilon_\mu,
\qquad
C_\Sigma(\theta)
\le\epsilon_\Sigma
$$

- $C_\mu$: covariance를 고정하고 mean 변화만 측정
- $C_\Sigma$: mean을 고정하고 covariance 변화만 측정

![Mean과 covariance의 decoupled KL](/assets/img/posts/rl/ohdrl-complete-flow/detail-p161-mpo-decoupled-kl.jpg)

*직접 작성한 `OhDRL.pdf`, p.161. Gaussian policy KL을 mean과 covariance contribution으로 나눠 서로 다른 update budget을 두는 M-step.*

Lagrangian:

$$
\mathcal L_{\text{M-step}}
=
\mathbb E_{s,a\sim q_i}
\left[
\log\pi_\theta(a\mid s)
\right]
+
\eta_\mu
\left(
\epsilon_\mu-C_\mu
\right)
+
\eta_\Sigma
\left(
\epsilon_\Sigma-C_\Sigma
\right)
$$

Policy parameter $\theta$는 최대화, positive dual variables는 constraint violation이 줄도록 반대 방향 최적화. 실제 코드는 `softplus(raw_dual)` 같은 parameterization으로 dual이 음수가 되지 않게 한다.

### **10.7 Off-policy critic과 Retrace**

E-step weight는 critic이 매긴 Q의 순서로 결정된다. Policy improvement 전에 현재 policy $\pi_i$의 $Q^{\pi_i}$를 replay trajectory로 평가해야 한다.

![MPO의 off-policy policy evaluation](/assets/img/posts/rl/ohdrl-complete-flow/detail-p162-mpo-policy-evaluation.jpg)

*직접 작성한 `OhDRL.pdf`, p.162. Replay buffer의 behavior data와 target policy 사이를 Retrace로 보정해 critic target을 구성하는 단계.*

Replay data를 만든 behavior policy $b$와 지금 평가하려는 target policy $\pi_i$가 다르므로 importance ratio:

$$
\rho_k
=
\frac{
\pi_i(a_k\mid s_k)
}{
b(a_k\mid s_k)
}
$$

긴 trajectory에서 $\prod_k\rho_k$를 그대로 곱하면 하나의 큰 ratio 때문에 variance가 폭발할 수 있다. Retrace coefficient의 일반형:

$$
c_k
=
\lambda
\min(1,\rho_k),
\qquad
0\le\lambda\le1
$$

Target network $\bar Q$를 기준으로 TD residual:

$$
\delta_j
=
\left[
r_j
+
\gamma(1-d_j)
\mathbb E_{a\sim\pi_i(\cdot\mid s_{j+1})}
\bar Q(s_{j+1},a)
\right]
-
\bar Q(s_j,a_j)
$$

$N$-step Retrace target:

$$
Q_t^{\text{ret}}
=
\bar Q(s_t,a_t)
+
\sum_{j=t}^{t+N-1}
\gamma^{j-t}
\left(
\prod_{k=t+1}^{j}c_k
\right)
\delta_j
$$

$j=t$일 때 product는 1. 첫 TD residual은 그대로 반영되고, 더 먼 residual일수록 clipped importance coefficient의 product로 영향이 줄어든다.

![Retrace의 multi-step off-policy target](/assets/img/posts/rl/ohdrl-complete-flow/detail-p163-retrace.jpg)

*직접 작성한 `OhDRL.pdf`, p.163. Full importance sampling product 대신 clipped coefficient를 사용하는 Retrace return.*

Critic loss:

$$
\mathcal L_Q(\phi)
=
\mathbb E
\left[
\left(
Q_\phi(s_t,a_t)
-
\operatorname{stopgrad}
\left[
Q_t^{\text{ret}}
\right]
\right)^2
\right]
$$

MPO의 critic update:

- Replay buffer: behavior transition과 가능하면 behavior action probability 저장
- Target critic $\bar Q$: bootstrap 기준
- Retrace: behavior-target mismatch를 제한된 ratio로 보정
- Online critic $Q_\phi$: Retrace target에 regression

$\lambda=0$이면 사실상 one-step target 쪽, 1에 가까울수록 긴 correction을 더 활용. Bias와 variance, trajectory segment 길이 사이의 trade-off.

### **10.8 MPO update 순서**

![MPO 전체 알고리즘](/assets/img/posts/rl/ohdrl-complete-flow/33-mpo-algorithm.jpg)

*직접 작성한 `OhDRL.pdf`, p.164. Off-policy policy evaluation, non-parametric E-step, constrained M-step을 합친 MPO worker.*

```text
1. Environment interaction
   a_t ~ pi_theta(. | s_t)
   replay <- (s_t, a_t, r_t, s_{t+1}, done, behavior_log_prob)

2. Policy evaluation
   replay trajectory sample
   -> target critic으로 Retrace target
   -> online critic regression

3. E-step
   replay state마다 current policy action N개 sample
   -> critic Q evaluation
   -> eta dual optimization
   -> action-sample 축 softmax weight

4. M-step
   weighted log likelihood 최대화
   -> old/new mean KL와 covariance KL 계산
   -> policy와 KL dual update

5. Target synchronization
   target critic update
   old policy snapshot 갱신
```

Gradient 경로:

```text
critic loss       -> critic only
eta dual loss     -> eta only
E-step weights    -> stop gradient
weighted MLE      -> actor
KL dual loss      -> KL dual variables
```

E-step weight를 만드는 Q에 actor gradient를 통과시키거나 M-step KL의 old policy를 optimizer가 함께 바꾸는 순간, 알고리즘의 분해는 무너진다.

### **10.9 DDPG, SAC, PPO와 비교**

| 항목 | DDPG | SAC | PPO | MPO |
| --- | --- | --- | --- | --- |
| Data | Off-policy replay | Off-policy replay | On-policy rollout | Off-policy replay |
| Actor | Deterministic | Stochastic | Stochastic | Stochastic |
| Improvement signal | $\nabla_aQ\nabla_\theta\pi$ | Reparameterized $Q+\alpha H$ | Clipped ratio $\hat A$ | Q-weighted action likelihood |
| 중간 improved distribution | 없음 | Entropy-regularized actor 자체 | 없음 | Non-parametric $q$ |
| Update 제한 | Target/slow learning | Entropy, twin critic, target | Ratio clipping, KL monitor | E/M-step KL budgets |
| Data reuse | 높음 | 높음 | 낮음 | 높음 |

**DDPG**

$$
\nabla_\theta J
\approx
\mathbb E_s
\left[
\nabla_aQ_\phi(s,a)
\vert_{a=\mu_\theta(s)}
\nabla_\theta\mu_\theta(s)
\right]
$$

Critic surface의 local gradient를 actor가 직접 추종.

**SAC**

$$
\min_\theta
\mathbb E
\left[
\alpha\log\pi_\theta(a\mid s)
-
Q_\phi(s,a)
\right]
$$

Stochastic actor를 entropy-regularized Q objective에 직접 맞춘다.

**PPO**

$$
\max_\theta
\mathbb E
\left[
\min
\left(
r_t(\theta)\hat A_t,
\operatorname{clip}(r_t,1-\epsilon,1+\epsilon)\hat A_t
\right)
\right]
$$

Current rollout의 sampled action probability ratio를 제한.

**MPO**

$$
Q
\longrightarrow
w_i
\longrightarrow
\sum_iw_i\log\pi_\theta(a_i\mid s)
$$

MPO는 Q를 actor까지 직접 미분하지 않는다. Q로 sampled action의 weight를 만들고, weighted log-likelihood로 actor를 학습한다.

### **10.10 한계**

**Critic ranking error**

절대 Q가 틀려도 action 사이 순서가 맞으면 E-step은 어느 정도 작동할 수 있다. 반대로 작은 overestimation으로 나쁜 action이 최고 weight를 받으면 policy가 그 방향을 모방. KL은 이동량을 줄일 뿐 ranking을 고치지 않는다.

**Current policy support**

E-step은 current policy에서 뽑은 action 안에서만 선택한다. 새로운 좋은 action이 Gaussian tail에서도 거의 나오지 않으면 critic이 알아도 q가 그 action을 사용할 수 없다. Covariance를 너무 빨리 줄이면 생기는 탐색 고갈.

**Replay distribution shift**

State batch는 과거 behavior mixture에서 온다. Current policy가 거의 방문하지 않는 state에서 M-step fitting이 이뤄질 수 있으며, critic extrapolation error가 함께 커질 가능성.

**Hyperparameter interaction**

Action sample 수, $\epsilon$, $\epsilon_\mu$, $\epsilon_\Sigma$, critic update 비율, Retrace horizon, target update가 서로 독립적이지 않다. Action sample 수가 너무 작으면 q의 Monte Carlo 근사가 거칠고, 너무 큰 KL budget은 critic error를 빠르게 추종.

MPO의 KL constraint는 actuator safety constraint가 아니다. Policy distribution의 update 크기를 제한할 뿐 torque, velocity, collision, sim-to-real error는 별도 제약으로 다뤄야 한다.

로봇 적용 시 추가 항목:

- Action clipping과 physical unit 확인
- Torque, velocity, joint-position limit
- Emergency stop과 supervisory controller
- Sensor latency와 action delay randomization
- Replay data의 unsafe transition 처리 정책
- Hardware 배포 전 deterministic/mean action 검증
- KL 값과 물리적 trajectory 변화가 비례한다고 가정하지 않기

## **11. 알고리즘 비교**

### **11.1 Bellman target**

- **DP:** 모든 다음 상태를 합산해 Bellman backup
- **MC:** Bellman bootstrap 없이 실제 episode return으로 value 추정
- **TD / Q-Learning:** 관측한 transition으로 Bellman target 추정
- **DQN:** 신경망과 target network로 Q Bellman error 최소화
- **Actor-Critic:** Critic은 Bellman/return target, actor는 critic이 만든 advantage 또는 Q 사용
- **DDPG:** Continuous actor가 만든 next action으로 critic target 구성
- **Distributional RL:** Bellman update의 대상을 평균이 아닌 return distribution으로 확장
- **MPO:** Off-policy critic이 policy improvement를 위한 Q를 제공

알고리즘별 one-step target:

**TD prediction**

$$
y_t^{\text{TD}}
=
r_t
+
\gamma V(s_{t+1})
$$

**Q-Learning**

$$
y_t^{Q}
=
r_t
+
\gamma\max_{a'}Q(s_{t+1},a')
$$

**DQN**

$$
y_t^{\text{DQN}}
=
r_t
+
\gamma
\max_{a'}
Q_{\theta^-}(s_{t+1},a')
$$

**Double DQN**

$$
y_t^{\text{Double DQN}}
=
r_t
+
\gamma
Q_{\theta^-}
\left(
s_{t+1},
\arg\max_{a'}Q_\theta(s_{t+1},a')
\right)
$$

**DDPG**

$$
y_t^{\text{DDPG}}
=
r_t
+
\gamma
Q_{\phi^-}
\left(
s_{t+1},
\mu_{\theta^-}(s_{t+1})
\right)
$$

**Distributional target**

$$
\mathcal Y_t^Z
\overset{D}{=}
r_t
+
\gamma
Z_{\theta^-}(s_{t+1},a^*)
$$

공통 형태는 `reward + discounted future estimate`.

### **11.2 표현과 update 방식**

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

#### **Value representation**

```text
Table
  -> scalar neural value/Q
  -> state-dependent distribution
```

- 작은 discrete MDP: table이 가장 해석 가능
- 큰 state space: function approximation 필요
- 평균 이상의 return 구조: categorical 또는 quantile distribution

#### **Policy representation**

```text
Value로부터 implicit policy:
argmax_a Q(s,a)

Explicit stochastic policy:
pi_theta(a | s)

Explicit deterministic policy:
a = mu_theta(s)
```

Discrete action의 개수가 작을 때는 $\arg\max_aQ$로 충분하다. Continuous action에서는 모든 $a$를 열거할 수 없으므로 별도의 actor가 필요.

#### **Data reuse**

- On-policy: 현재 policy가 만든 rollout 중심
- Off-policy: behavior가 다른 replay transition도 재사용
- Model-based DP: 실제 sample 대신 알려진 transition model 전체 사용

Data reuse가 높다고 무조건 우월한 것은 아니다. Policy-distribution mismatch를 보정하거나 견딜 critic 설계가 함께 필요하다.

#### **Policy update 제한**

- Greedy replacement: tabular policy iteration
- Small gradient step: Policy Gradient, DDPG, SAC
- Ratio clipping: PPO
- KL-constrained step: TRPO, MPO
- Action distribution fitting: MPO

### **11.3 알고리즘별 차이**

- DQN과 PPO: discrete value control과 stochastic policy optimization의 차이
- PPO와 MPO: on-policy clipped update와 off-policy EM-style update의 차이
- C51과 MPO: value representation과 policy improvement라는 서로 다른 축
- MC와 TD: 정답/오답 관계가 아니라 bias–variance와 update timing의 trade-off

### **11.4 알고리즘 선택 기준**

**1. Environment model**

작은 $P(s'\mid s,a)$와 $R(s,a)$를 정확히 알고 있다면 baseline은 DP. Model 없이 interaction만 가능하다면 sample-based RL.

**2. Action space**

- 작은 discrete: DQN 계열 후보
- Continuous: PPO, SAC, DDPG, MPO 같은 actor 계열
- 매우 큰 discrete/combinatorial: 단순 DQN의 모든 action 출력도 병목

**3. Data 수집 비용**

- Simulator를 수천 개 병렬 실행: PPO의 on-policy 비용이 상대적으로 작음
- 실제 robot, 긴 simulation, 느린 environment: off-policy replay의 가치 증가

**4. Exploration**

- Deterministic execution과 외부 noise: DDPG 계열
- Entropy를 objective에 포함: SAC
- Covariance를 별도 trust region으로 제어: MPO

**5. Policy update 제한**

- 구현 단순성과 병렬성: PPO clipping
- 명시적 policy geometry: TRPO/NPG
- Off-policy + KL-constrained fitting: MPO

**6. Return representation**

- 평균 control이면 scalar critic
- Tail risk, multimodality, richer learning signal이 필요하면 distributional critic
- 단, risk functional과 safety constraint는 별도

### **11.5 자주 섞이는 개념**

| 혼동 | 실제 구분 |
| --- | --- |
| State와 observation | State는 Markov 정보를 담는 이론 변수, observation은 agent가 받는 측정 |
| Reward와 return | Reward는 한 step 신호, return은 discounted 누적 확률변수 |
| Value와 Q | $V$는 state에서 policy를 따른 평균, $Q$는 첫 action까지 조건화 |
| Evaluation과 control | 고정 policy 가치 계산과 policy improvement |
| On-policy와 on-line | 현재 policy data 사용 여부와 stream update 여부는 다른 축 |
| Off-policy와 replay | Replay는 흔한 구현 수단, off-policy의 정의는 behavior와 target policy 차이 |
| Target network와 old policy | Bootstrap target 고정용 network와 policy-ratio/KL 기준 snapshot |
| Entropy와 action noise | Objective가 stochasticity를 보상하는 것과 외부 noise를 더하는 것 |
| Return distribution과 epistemic uncertainty | 환경·정책이 만드는 결과 분포와 model parameter 불확실성 |
| Trust region과 physical safety | Policy update 거리 제한과 actuator·collision 제약 |

## **12. 구현 체크리스트**

### **12.1 Transition**

강화학습 구현의 최소 단위:

$$
(s_t,a_t,r_t,s_{t+1},d_t)
$$

수식은 같아 보여도 이 tuple의 의미가 다르면 다른 알고리즘이 된다.

**Observation**

- Shape `[num_envs, obs_dim]`인지 `[batch, stack, H, W]`인지
- Frame stack, history, recurrent hidden state 포함 여부
- Normalization statistic을 training/evaluation에서 공유하는지
- Privileged observation이 actor가 아니라 critic에만 들어가는지
- Skill, command, goal 같은 condition이 어느 network에 들어가는지

**Action**

- Network output이 torque, position target, velocity, normalized command 중 무엇인지
- `tanh` 뒤 `[-1,1]`에서 physical range로 변환하는 위치
- Environment clipping 전 action과 replay에 저장하는 action이 같은지
- Gaussian log probability 계산 시 `tanh` Jacobian correction이 있는지

**Reward timing**

`env.step(a_t)`가 돌려준 reward가 $(s_t,a_t,s_{t+1})$ 중 어느 상태를 기준으로 계산됐는지. Index 한 칸 차이는 n-step return 전체를 어긋나게 한다.

**Termination**

```text
terminated:
MDP terminal, future return 없음

truncated:
time limit 또는 외부 cutoff, underlying process는 계속될 수 있음
```

Bootstrap mask를 단순 `done` 하나로 만들기 전에 environment API의 의미 확인.

**Replay contract**

```text
obs
action
reward
next_obs
terminated
truncated
behavior_log_prob   # Retrace/IS 계열이면 필요 가능
discount            # transition별 discount를 직접 저장할 수도 있음
```

Circular buffer index가 episode boundary를 넘어 n-step sequence를 이어 붙이지 않는지도 검사 대상.

### **12.2 Value target**

Value target의 기본 형태:

```python
target = reward + discount * bootstrap_mask * next_value
```

**Return horizon**

- Full episode MC return
- One-step TD
- Fixed n-step
- $\lambda$-return / GAE
- Retrace 같은 corrected multi-step return

**Next value**

- $V(s')$
- $Q(s',a')$, $a'\sim\pi$
- $\max_{a'}Q(s',a')$
- Target actor가 낸 $Q(s',\mu^-(s'))$
- Distributional atom/quantile target

**Target source**

- Online network
- Frozen/periodic target network
- Polyak-averaged target
- Old value snapshot

**Gradient**

Target은 보통:

```python
with torch.no_grad():
    target = make_target(batch)
```

Target tensor의 `requires_grad`, online/target parameter 공유 여부, target update 시점을 직접 확인. `detach()` 하나가 빠지면 Bellman regression의 의미가 바뀐다.

**Shape**

Scalar critic:

```text
reward      [B, 1]
done_mask   [B, 1]
next_q      [B, 1]
target      [B, 1]
```

Distributional critic:

```text
C51 target probability       [B, N]
QR pairwise delta            [B, N, N']
IQN sampled quantile values  [B, N, A]
```

`[B]`와 `[B,1]` broadcasting이 우연히 `[B,B]`를 만드는 bug는 loss 값이 정상처럼 보여도 학습을 망가뜨릴 수 있다.

### **12.3 Actor update**

Actor update에서는 scalar loss와 gradient 경로를 함께 확인한다.

**REINFORCE**

```text
log pi_theta(a_t | s_t)
    x detached return
    -> actor
```

**Actor-Critic / PPO**

```text
log probability 또는 probability ratio
    x detached advantage
    -> actor
```

Advantage 계산에 value network가 들어가도 actor loss에서 value parameter까지 역전파하지 않는 것이 일반적.

**DDPG**

```text
actor(s)
    -> action
    -> critic(s, action)
    -> actor parameter
```

Critic input action에 대한 gradient는 필요하지만 actor update 동안 critic parameter 자체는 optimizer 대상이 아니다.

**SAC**

```text
actor reparameterized action
    -> Q and log_prob
    -> actor
```

`rsample()`과 `sample()`의 차이가 중요한 구간.

**PPO**

- Rollout 때 저장한 `old_log_prob`
- Update 때 계산한 `new_log_prob`
- `ratio = exp(new - old)`
- Advantage normalization
- Clip fraction과 approximate KL

Old policy 정보가 update epoch 중 바뀌면 ratio 기준이 사라진다.

**MPO**

```text
sampled actions
    -> detached critic Q
    -> detached E-step weights
    -> weighted actor log_prob
```

E-step temperature와 M-step KL dual optimizer가 actor optimizer와 분리돼 있는지 확인.

### **12.4 안정성과 재현성**

학습 중 기록할 항목:

**Data**

- Replay size와 age distribution
- Episode length와 termination reason
- Action saturation 비율
- Observation clipping 비율
- On-policy라면 rollout policy version

**Critic**

- Target mean/std/min/max
- Prediction mean/std
- TD error 또는 quantile loss
- Q overestimation 지표
- Target/online parameter distance
- C51 endpoint mass, quantile range

**Actor**

- Entropy 또는 action std
- KL(old, new)
- PPO clip fraction
- Gradient norm
- Mean action과 saturation
- MPO E-step weight entropy, effective sample size

E-step weight의 effective sample size:

$$
\operatorname{ESS}
=
\frac{
1
}{
\sum_{i=1}^Nw_i^2
}
$$

ESS가 1에 가까우면 사실상 action sample 하나만 모방. $\eta$, Q scale, KL budget 문제를 의심할 단서.

**Reproducibility**

- Python, NumPy, framework, simulator seed
- Vector environment별 seed offset
- Deterministic evaluation action 규칙
- Evaluation normalization의 freeze
- Checkpoint에 optimizer, target network, normalizer, replay metadata 포함
- Config와 git commit hash 기록

GPU kernel과 병렬 simulator 때문에 seed 고정만으로 bitwise reproducibility가 보장되지는 않는다. 최소 여러 seed의 평균·분산과 동일 evaluation protocol 필요.

### **12.5 로봇 제어**

RL tensor가 맞아도 physical interface가 틀리면 정책 성능보다 먼저 위험이 생긴다.

| 항목 | 확인할 contract |
| --- | --- |
| Control period | Training physics/control decimation과 deployment 주기 |
| Unit | rad/deg, N/Nm, m/mm, body/world frame |
| Action delay | Command 생성부터 actuator 반영까지 |
| Observation delay | Sensor timestamp, filtering, synchronization |
| Limit | Joint position, velocity, torque, temperature |
| Reset | Simulation reset과 실제 robot recovery의 차이 |
| Safety | E-stop, watchdog, fall detector, command timeout |

Policy의 KL이 작아도 torque trajectory는 크게 달라질 수 있다. Observation normalization이 조금 틀려도 action은 saturation될 수 있다. 알고리즘 수식 밖의 interface contract까지 포함해야 실제 재현.

### **12.6 코드 확인 순서**

처음부터 class 전체를 읽는 대신, 한 update batch를 끝까지 따라가는 편이 빠르다.

1. Config에서 $\gamma$, horizon, batch size, action scale 확인
2. `env.step()`의 transition 의미 확인
3. Buffer 또는 rollout storage에 실제 저장되는 field 확인
4. Batch sample 직후 tensor shape와 device 기록
5. Target 계산식 한 줄로 복원
6. Critic loss와 optimizer parameter set 확인
7. Actor loss의 gradient path 표시
8. Target/old policy update 시점 확인
9. Evaluation action과 training action 차이 확인
10. Checkpoint resume가 모든 state를 복원하는지 확인

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
