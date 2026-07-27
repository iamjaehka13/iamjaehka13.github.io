---
title: "UVFA + HER: 실패 경험을 학습 데이터로 바꾸기"
date: 2026-07-23 00:58:00 +0900
last_modified_at: 2026-07-27 22:47:54 +0900
categories: [RL, Study]
tags: [uvfa, her, goal-conditioned-reinforcement-learning, hindsight-experience-replay, sparse-reward, experience-replay, off-policy, ddpg, sac, robotics]
description: "UVFA가 state와 goal을 함께 입력받아 여러 목표의 가치함수를 표현하는 방법과, HER가 실패 trajectory의 goal과 reward를 relabel해 sparse reward 학습을 가능하게 하는 원리를 정리한다."
math: true
image:
  path: /assets/img/posts/rl/uvfa-her/00-uvfa-her-preview.png
  alt: UVFA의 goal-conditioned value function과 HER의 hindsight relabeling 흐름
---

이전 [METRA 글](/posts/metra-metric-aware-abstraction/)까지는 외부 task reward 없이 여러 행동을 **발견하는 방법**을 살펴봤다. 이번에는 문제가 다르다.

```text
METRA
어떤 행동이 유용할지 정하지 않은 채 다양한 skill z를 발견한다.

UVFA + HER
목표 g가 주어졌을 때 그 목표에 도달하는 policy를 학습한다.
```

목표 위치가 계속 바뀌는 로봇 제어를 생각해 보자. 하나의 policy가 여러 목표를 처리하게 만들 수는 있지만, 성공했을 때만 reward를 주면 학습 초기에 거의 모든 episode가 실패한다. **UVFA, Universal Value Function Approximators**는 첫 번째 문제인 다중 목표 표현을 다루고, **HER, Hindsight Experience Replay**는 두 번째 문제인 sparse reward 학습을 다룬다.

> **UVFA는 가치함수에 목표를 넣어 여러 목표를 하나의 함수로 표현하고, HER는 실패한 경험을 실제 달성한 목표의 성공 경험으로 다시 해석한다.**

## 0. 먼저 전체 그림

두 논문은 같은 알고리즘이 아니다.

| 질문 | 답 |
|---|---|
| 목표가 달라지면 가치도 달라지는데 어떻게 표현할까? | UVFA: $V(s,g)$ 또는 $Q(s,a,g)$ |
| 성공 reward가 거의 나오지 않는데 무엇으로 학습할까? | HER: 실제 달성한 goal로 transition relabel |
| 둘을 합치면 무엇을 얻나? | Sparse reward에서 학습 가능한 goal-conditioned policy |

![같은 상태와 행동도 목표에 따라 가치가 달라지는 이유](/assets/img/posts/rl/uvfa-her/01-same-state-different-goals.svg){: width="1200" .d-block .mx-auto }

현재 상태에서 왼쪽으로 가는 행동은 목표가 왼쪽이면 좋지만, 목표가 오른쪽이면 나쁘다. 일반적인 $Q(s,a)$는 이 차이를 표현할 기준이 없다. 그래서 목표 $g$까지 조건으로 넣는다.

$$
Q(s,a)
\quad\longrightarrow\quad
Q(s,a,g)
$$

그런데 표현 능력이 생겼다고 성공 데이터가 자동으로 생기지는 않는다. HER는 여기서 실패 trajectory를 버리지 않고, **그 trajectory가 실제로 도달한 곳을 목표였다고 가정해 다시 학습**한다.

## 1. 두 논문 정보

### 1.1 Universal Value Function Approximators

| 항목 | 내용 |
|---|---|
| Title | Universal Value Function Approximators |
| Authors | Tom Schaul, Daniel Horgan, Karol Gregor, David Silver |
| Venue | ICML 2015 |
| 핵심 대상 | Goal-conditioned value function |
| 핵심 함수 | $V(s,g;\theta)$, $Q(s,a,g;\theta)$ |
| 핵심 주장 | State뿐 아니라 goal에 대해서도 일반화 |
| 구조 | Concatenated input, two-stream factorization |
| Source | [PMLR](https://proceedings.mlr.press/v37/schaul15.html), [PDF](https://proceedings.mlr.press/v37/schaul15.pdf) |

### 1.2 Hindsight Experience Replay

| 항목 | 내용 |
|---|---|
| Title | Hindsight Experience Replay |
| Authors | Marcin Andrychowicz et al. |
| Venue | NeurIPS 2017 |
| 핵심 대상 | Sparse, binary reward의 sample efficiency |
| 핵심 연산 | Goal relabeling과 reward recomputation |
| Base RL | 임의의 off-policy RL; 논문 실험은 DQN과 DDPG |
| 로봇 실험 | Pushing, sliding, pick-and-place |
| Source | [NeurIPS](https://proceedings.neurips.cc/paper/2017/hash/453fadbd8a1a3af50a9df4df899537b5-Abstract.html), [arXiv](https://arxiv.org/abs/1707.01495), [OpenAI robotics release](https://openai.com/index/ingredients-for-robotics-research/) |

여기서 흔히 하는 오해가 있다.

> HER가 UVFA를 대체하거나, UVFA와 HER가 하나의 새로운 actor-critic 알고리즘을 이루는 것은 아니다.

UVFA는 **함수의 조건화와 일반화 구조**에 가깝고, HER는 **replay data를 재구성하는 방법**.

## 2. UVFA는 왜 필요한가?

일반적인 value function은 현재 상태의 장기 return을 나타낸다.

$$
V^\pi(s)
=
\mathbb{E}_\pi
\left[
\sum_{t=0}^{\infty}\gamma^t r_t
\mid s_0=s
\right]
$$

이 식에는 어떤 목표를 수행하는지가 이미 reward function 안에 고정돼 있다. 목표를 바꾸면 reward가 바뀌고, 같은 상태의 가치도 바뀐다.

목표 $g$마다 별도 value function을 만들면:

$$
V_{g_1}(s),\quad V_{g_2}(s),\quad \ldots,\quad V_{g_K}(s)
$$

목표 수가 많거나 연속적이면 network를 목표마다 따로 만드는 방식은 확장되지 않는다. UVFA는 이 함수 집합을 하나의 parameterized function으로 합친다.

$$
\boxed{
V(s,g;\theta)\approx V_g^*(s)
}
$$

Action value를 사용하면:

$$
\boxed{
Q(s,a,g;\theta)\approx Q_g^*(s,a)
}
$$

실제 goal-conditioned actor-critic에서는 actor도 목표를 받는다.

$$
\pi_\theta(a\mid s,g)
$$

다만 원래 UVFA 논문의 중심 기여는 이름 그대로 **universal value function approximator**. Goal-conditioned actor는 이 value function으로부터 greedy policy를 만들거나, DDPG·SAC 같은 actor-critic으로 확장할 때 자연스럽게 등장한다.

## 3. Goal $g$는 전체 state가 아니다

로봇 state가 다음처럼 크다고 하자.

$$
s=
[q,\dot q,p_{base},R_{base},v_{base},\omega_{base},p_{object},\ldots]
$$

목표는 state 중 task에 필요한 일부만 나타낼 수 있다.

```text
Navigation goal       g = [x_target, y_target]
Pose goal             g = [x_target, y_target, yaw_target]
Manipulation goal     g = object_target_position
Reorientation goal    g = target_quaternion
```

HER를 사용하려면 두 goal을 구분해야 한다.

| 이름 | 의미 |
|---|---|
| Desired goal $g$ | Episode에서 원래 달성하려던 목표 |
| Achieved goal $m(s)$ | 현재 state가 실제로 달성한 결과 |

$m:\mathcal{S}\rightarrow\mathcal{G}$는 state에서 goal-space 값을 뽑는 함수다.

$$
m(s)=p_{object}
$$

예를 들어 object manipulation에서는 전체 joint state가 아니라 물체 위치만 achieved goal로 사용할 수 있다.

### 3.1 Goal-conditioned reward

Reward도 goal을 조건으로 받아야 한다.

$$
r(s,a,s',g)
$$

대표적인 sparse reward는:

$$
r(s',g)=
\begin{cases}
0, & \|m(s')-g\|_2<\varepsilon\\
-1, & \text{otherwise}
\end{cases}
$$

Goal-conditioned Bellman equation은 다음 형태가 된다.

$$
Q^*(s,a,g)
=
\mathbb{E}_{s'}
\left[
r(s,a,s',g)
+
\gamma\max_{a'}Q^*(s',a',g)
\right]
$$

목표가 바뀌면 reward와 value가 바뀌지만, 일반적인 goal-reaching 문제에서는 물리 transition 자체는 그대로.

$$
p(s'\mid s,a,g)=p(s'\mid s,a)
$$

이 가정이 나중에 HER relabeling을 정당화한다.

## 4. UVFA의 핵심은 goal-space 일반화다

UVFA를 단순히 observation 뒤에 goal vector를 붙이는 구현 팁으로만 이해하면 원 논문의 핵심을 놓친다.

일반적인 value approximation은 관측한 state에서 비슷한 미관측 state로 일반화한다.

```text
s1에서 학습
-> 구조가 비슷한 s2의 value도 추정
```

UVFA는 같은 아이디어를 goal 쪽에도 적용한다.

```text
g1, g2, g3에서 학습
-> 구조가 비슷한 unseen goal g4의 value도 추정
```

즉 함수는 state-goal 조합 전체를 입력으로 받는다.

$$
(s,g)\mapsto V(s,g)
$$

학습에서 직접 보지 않은 모든 goal을 자동으로 해결한다는 뜻은 아니다. 성능은 goal representation, training distribution, network inductive bias, 환경 구조에 의존한다. 가까운 목표가 비슷한 의미를 갖지 않는 encoding이라면 goal-space generalization도 약해진다.

## 5. Concatenation과 two-stream 구조

가장 단순한 UVFA는 state와 goal을 연결해 MLP에 넣는다.

$$
V(s,g)=F_\theta([s,g])
$$

원 논문은 여기에 더해 state와 goal을 별도 embedding으로 보내는 two-stream 구조를 탐구했다.

$$
V(s,g)
\approx
h\bigl(\phi(s),\psi(g)\bigr)
$$

![UVFA concatenated architecture와 two-stream architecture](/assets/img/posts/rl/uvfa-her/02-uvfa-architecture.svg){: width="1200" .d-block .mx-auto }

Value table을 행렬로 생각하면 이유가 보인다.

$$
M_{s,g}=V_g(s)
$$

- 행: state 또는 state-action
- 열: goal
- 원소: 그 state에서 goal을 향한 value

많은 환경에서는 이 거대한 행렬이 완전히 제각각이지 않고 저차원 공통 구조를 가진다. UVFA 논문은 관측한 value matrix를 low-rank factorization하여 state embedding $\phi(s)$와 goal embedding $\psi(g)$를 얻고, 실제 입력에서 이 embedding을 예측하는 방법을 제시했다.

![UVFA LavaWorld state and goal embeddings](/assets/img/posts/rl/uvfa-her/05-uvfa-lavaworld-embeddings.png){: width="960" .d-block .mx-auto }

_LavaWorld의 room layout과 학습된 state·goal embedding을 t-SNE로 시각화한 결과. 두 embedding 모두 원래 환경의 cycle과 dead-end 구조를 반영한다. 출처: [Schaul et al., Figure 2](https://proceedings.mlr.press/v37/schaul15.pdf)._

여기서 얻어야 할 결론은 특정 factorization 절차를 항상 그대로 써야 한다는 것이 아니다.

> **서로 다른 목표의 가치함수 사이에는 공유할 수 있는 구조가 있으며, 하나의 network가 이 구조를 이용해 state와 goal 양쪽으로 일반화할 수 있다.**

현대 구현에서는 보통 concat 또는 encoder 기반 구조를 end-to-end로 학습하지만, UVFA의 이론적 출발점은 이보다 깊다.

## 6. UVFA만으로 sparse reward가 해결되지는 않는다

목표를 표현할 수 있는 network가 생겼다고 하자. 성공했을 때만 $0$, 실패하면 $-1$을 받는 환경에서 무작위 goal을 계속 준다.

```text
episode 1 -> 실패
episode 2 -> 실패
episode 3 -> 실패
...
```

Replay buffer는 거의 같은 reward로 채워진다.

$$
r_t\approx -1
$$

Critic은 어떤 행동이 목표에 조금 더 가까워졌는지 알 수 없다. UVFA에는 여러 목표의 value를 표현할 **capacity**가 있지만, 성공 신호를 새로 만들어 주는 기능은 없다.

이 지점에서 HER가 필요하다.

## 7. HER의 핵심: 실패를 다른 목표의 성공으로 읽기

원래 목표가 빨간 지점인데 trajectory가 초록 지점에서 끝났다고 하자. 원래 목표 기준으로는 실패. 하지만 초록 지점이 목표였다면 동일한 행동은 성공 경험이 된다.

![HER goal relabeling](/assets/img/posts/rl/uvfa-her/03-her-relabeling.svg){: width="1200" .d-block .mx-auto }

원래 transition은:

$$
(s_t,a_t,g,r_t,s_{t+1})
$$

같은 episode의 미래 state $s_j$, $j>t$에서 새로운 목표를 고른다.

$$
g'=m(s_j)
$$

그 목표로 reward를 다시 계산한다.

$$
r'_t=r(s_t,a_t,s_{t+1},g')
$$

HER transition은:

$$
\boxed{
(s_t,a_t,g',r'_t,s_{t+1})
}
$$

정확히 무엇이 바뀌는지 정리하면:

| 항목 | 변경 여부 |
|---|---|
| State $s_t$ | 유지 |
| Action $a_t$ | 유지 |
| Next state $s_{t+1}$ | 유지 |
| Goal $g$ | $g'$로 변경 |
| Reward $r_t$ | $g'$ 기준으로 재계산 |

> HER는 transition을 조작하지 않는다. 이미 일어난 물리 경험은 그대로 두고, **그 경험을 평가하는 목표와 reward만 바꾼다.**

## 8. 원래 목표로 낸 action을 재사용해도 되는가?

여기가 HER에서 가장 헷갈리기 쉬운 부분이다.

$a_t$는 원래 목표 $g$를 보고 선택한 action.

$$
a_t\sim\pi_b(a\mid s_t,g)
$$

그런데 relabeled transition에서는 목표가 $g'$. 마치 $g'$를 보고 그 action을 낸 것처럼 보인다.

HER는 **그렇게 주장하지 않는다.** 이 데이터는 target policy가 직접 생성한 on-policy sample이 아니라, 다른 behavior policy가 만든 off-policy sample로 취급된다.

Q-learning 계열은 behavior policy와 target policy가 달라도 replay data로 Bellman target을 학습할 수 있다.

$$
y_t
=
r'_t
+
\gamma Q_{\bar\psi}
\left(
s_{t+1},
\pi_{\bar\theta}(s_{t+1},g'),
g'
\right)
$$

Critic loss는:

$$
\mathcal{L}_Q
=
\mathbb{E}
\left[
\left(Q_\psi(s_t,a_t,g')-y_t\right)^2
\right]
$$

Action $a_t$를 실제로 실행했다는 사실과 그 결과 $s_{t+1}$는 변하지 않는다. Goal이 환경 dynamics가 아니라 reward와 policy condition만 바꾼다는 가정 아래, 이 transition은 $g'$에 대해서도 유효하다.

## 9. HER는 update rule이 아니다

![HER data path and off-policy update](/assets/img/posts/rl/uvfa-her/04-her-training-path.svg){: width="1200" .d-block .mx-auto }

HER는 DDPG, DQN, SAC의 actor·critic loss를 새로 정의하지 않는다. Base RL 알고리즘 앞에서 replay data를 늘린다.

```text
1. desired goal g를 sample
2. pi(a | s, g)로 episode 수집
3. original transition 저장
4. achieved future goal g'를 sample
5. g' 기준 reward 재계산
6. relabeled transition 추가 저장
7. replay batch로 기존 off-policy RL update
```

간단한 pseudocode는:

~~~python
for episode in range(num_episodes):
    state = env.reset()
    goal = sample_desired_goal()
    trajectory = []

    while not done:
        action = actor(state, goal)
        next_state, done = env.step(action)
        trajectory.append((state, action, next_state, done))
        state = next_state

    for t, (state, action, next_state, done) in enumerate(trajectory):
        reward = compute_reward(achieved(next_state), goal)
        replay.add(state, action, goal, reward, next_state, done)

        for future_state in sample_future_states(trajectory, t, k=4):
            hindsight_goal = achieved(future_state)
            hindsight_reward = compute_reward(
                achieved(next_state), hindsight_goal
            )
            replay.add(
                state,
                action,
                hindsight_goal,
                hindsight_reward,
                next_state,
                done,
            )

    update_off_policy_agent(replay.sample(batch_size))
~~~

실제 구현에서는 episode 전체를 별도 저장하지 않고 rollout storage에서 batch를 만들 때 relabel할 수도 있다. 중요한 것은 저장 방식이 아니라 **goal과 reward의 일관된 재계산**이다.

## 10. 어떤 goal로 relabel할까?

HER 논문은 네 전략을 비교했다.

| 전략 | 추가 goal 선택 방법 |
|---|---|
| `final` | Episode의 마지막 achieved goal |
| `future` | 현재 transition보다 뒤에 나온 achieved goal |
| `episode` | 같은 episode의 임의 achieved goal |
| `random` | 지금까지 replay에 등장한 임의 achieved goal |

`future` 전략에서 transition $t$보다 뒤의 state를 고르는 이유는 causality와 학습 신호가 잘 맞기 때문.

$$
g'=m(s_j),\qquad j>t
$$

현재 action 이후 실제로 도달한 상태를 goal로 삼으므로, trajectory 후반에 성공 reward가 생기고 앞선 transition은 그 성공으로 bootstrap할 수 있다.

원 논문의 robotics experiment에서는 `future`의 $k=4$ 또는 $k=8$이 가장 좋은 결과를 보였고, $k$가 너무 크면 original goal data의 비중이 줄어 성능이 나빠졌다. 이 수치는 모든 환경의 고정 정답이 아니라 해당 실험의 결과.

### 10.1 원본 transition을 버리면 안 되는 이유

HER가 만드는 goal distribution은 agent가 이미 방문한 상태에 치우친다.

$$
p_{HER}(g)
\neq
p_{task}(g)
$$

Relabeled data만 과도하게 사용하면 policy가 실제 task goal보다 자기가 쉽게 도달하는 goal에 최적화될 수 있다. 그래서 original goal transition과 HER transition을 함께 학습한다.

## 11. DDPG와 SAC에서는 어디에 들어가는가?

HER 논문의 continuous-control 실험은 DDPG를 사용했다. 하지만 HER는 임의의 off-policy RL과 결합할 수 있으므로 SAC에도 같은 data layer를 붙일 수 있다.

### 11.1 DDPG + HER

Actor와 critic은 다음처럼 goal-conditioned된다.

$$
a=\mu_\theta(s,g)
$$

$$
Q_\psi(s,a,g)
$$

HER는 replay batch의 $g$와 $r$을 바꾸고, DDPG update는 그대로 수행한다.

### 11.2 SAC + HER

SAC에서는 stochastic actor를 사용한다.

$$
a\sim\pi_\theta(a\mid s,g)
$$

Critic target에는 entropy term이 추가된다.

$$
y_t
=
r'_t
+
\gamma
\mathbb{E}_{a'\sim\pi}
\left[
Q_{\bar\psi}(s_{t+1},a',g')
-
\alpha\log\pi(a'\mid s_{t+1},g')
\right]
$$

HER의 역할은 여전히 같다.

```text
HER  -> goal과 reward를 바꾼 replay sample 제공
SAC  -> 그 sample로 entropy-regularized actor/critic update
```

[DIAYN 글](/posts/diayn-diversity-is-all-you-need/)에서 본 SAC는 discriminator가 intrinsic reward를 만들었다. 여기서는 goal-conditioned sparse reward를 HER가 다시 계산한다는 점이 다르다.

## 12. PPO에 HER를 바로 붙이기 어려운 이유

Goal-conditioned PPO 자체는 가능하다.

$$
\pi_\theta(a\mid s,g),qquad V_\psi(s,g)
$$

문제는 hindsight relabeling이다. PPO의 clipped objective에는 rollout을 생성한 old policy의 probability ratio가 들어간다.

$$
\rho_t(\theta)
=
\frac{
\pi_\theta(a_t\mid s_t,g)
}{
\pi_{\theta_{old}}(a_t\mid s_t,g)
}
$$

Goal을 $g'$로 바꾸면 분모에 필요한 값은 사실:

$$
\pi_{\theta_{old}}(a_t\mid s_t,g')
$$

하지만 rollout 당시 action은 $g$ 조건에서 나왔다. 단순히 goal과 reward만 바꾸면 PPO가 전제로 하는 on-policy 관계가 깨진다.

따라서 정확한 구분은:

- **UVFA식 goal conditioning**은 PPO에도 자연스럽게 적용할 수 있다.
- **고전적 HER relabeling**은 replay를 사용하는 off-policy 알고리즘과 가장 자연스럽다.
- PPO와 hindsight를 결합하려면 importance correction이나 별도 알고리즘 설계가 필요하다.

## 13. HER가 implicit curriculum인 이유

학습 초기 policy는 시작점 근처밖에 가지 못한다. HER가 만드는 goal도 그 근처 achieved state.

```text
초기 policy
-> 가까운 곳만 도달
-> 가까운 hindsight goal에서 성공 학습
-> policy 범위가 조금 넓어짐
-> 더 먼 hindsight goal 생성
```

Policy가 좋아질수록 replay에서 등장하는 achieved goal도 자연스럽게 멀어진다. 그래서 HER를 implicit curriculum으로 볼 수 있다.

하지만 이 표현을 과장하면 안 된다.

> HER는 현재 exploration 범위 안에서 curriculum을 만든다. 한 번도 방문하지 못한 영역의 goal을 새로 창조하지는 않는다.

Policy가 좁은 지역에 완전히 갇히면 HER goal도 계속 그 지역에만 남는다. Exploration 문제를 완전히 해결하는 알고리즘은 아니다.

## 14. 논문 실험에서 실제로 무엇이 좋아졌나?

HER 논문은 Fetch arm을 이용한 세 가지 task를 사용했다.

```text
Pushing        상자를 테이블 위 목표 위치로 밀기
Sliding        퍽을 밀어 손이 닿지 않는 먼 목표로 보내기
Pick-and-place 물체를 집어 공중 목표 위치에 놓기
```

![HER DDPG learning curves](/assets/img/posts/rl/uvfa-her/06-her-learning-curves.png){: width="1200" .d-block .mx-auto }

_왼쪽은 여러 training goal, 오른쪽은 하나의 고정 goal을 사용한 결과. 해당 실험에서 plain DDPG는 sparse reward로 세 task를 해결하지 못했지만 DDPG+HER는 큰 폭으로 개선됐다. 빨간 선은 Section 4.5의 best HER setting이다. 출처: [Andrychowicz et al., Figures 2 and 3](https://proceedings.neurips.cc/paper_files/paper/2017/file/453fadbd8a1a3af50a9df4df899537b5-Paper.pdf)._

이 결과에서 중요한 것은 다음 두 가지.

1. HER는 multi-goal policy 학습에서 sparse reward를 유용한 데이터로 바꿨다.
2. 최종 관심 goal이 하나뿐인 경우에도, 학습 중 여러 goal을 사용하면 더 쉽게 배울 수 있었다.

다만 이 figure 하나로 모든 sparse-reward task에서 HER가 항상 성공한다고 일반화할 수는 없다. Goal relabeling이 유효하고, random exploration으로 의미 있는 achieved goal을 만들 수 있는 환경이라는 조건이 필요하다.

## 15. Reward shaping과 무엇이 다른가?

Dense reward shaping은 보통 목표까지의 거리를 이용한다.

$$
r_{dense}(s',g)
=
-\|m(s')-g\|_2
$$

이 방식은 매 step 방향을 알려주지만, 잘못된 metric이나 local optimum을 만들 수 있다. 예를 들어 물체를 장애물 너머로 보내야 하는데 Euclidean distance만 줄이면 장애물 앞에 붙는 행동이 보상상 유리할 수 있다.

HER는 원래 sparse success criterion을 유지한다.

$$
r_{HER}(s',g')
=
\begin{cases}
0,&\text{success}\\
-1,&\text{failure}
\end{cases}
$$

대신 어떤 goal로 경험을 해석할지를 바꾼다.

| 방법 | 바꾸는 것 |
|---|---|
| Reward shaping | Reward의 모양과 중간 선호도 |
| HER | Replay sample의 goal과 그 goal에 대한 reward |

HER도 reward engineering을 완전히 제거하지는 않는다. Goal representation, tolerance $\varepsilon$, success predicate는 여전히 사람이 정해야 한다.

## 16. HER가 성립하는 조건과 한계

### 16.1 Goal이 dynamics를 바꾸지 않아야 한다

HER의 핵심 가정은:

$$
p(s'\mid s,a,g)=p(s'\mid s,a)
$$

Goal이 단지 원하는 결과라면 괜찮다. 하지만 goal에 따라 물리 parameter, action 의미, 허용 제약이 바뀐다면 같은 transition을 다른 goal에 재사용하는 것이 정당하지 않을 수 있다.

### 16.2 Achieved goal과 reward를 계산할 수 있어야 한다

다음 두 함수가 필요하다.

$$
m(s)\rightarrow g_{achieved}
$$

$$
r(s,a,s',g)\rightarrow \mathbb{R}
$$

`2 m 앞으로 이동`, `물체를 특정 위치에 놓기`는 비교적 명확하다. 반면 `아름답게 걷기`, `자연스러운 행동`처럼 성공 predicate가 불명확한 목표는 고전적 HER로 다루기 어렵다.

### 16.3 Exploration 범위를 넘지 못한다

HER는 실제로 방문한 achieved state만 goal로 재사용한다. 문을 한 번도 통과하지 못했다면 문 너머 goal의 성공 데이터는 생기지 않는다.

### 16.4 Goal distribution mismatch가 생긴다

HER goal은 task가 요구한 분포가 아니라 policy가 방문한 분포에서 나온다. Original transition과 HER 비율을 조절하지 않으면 쉬운 hindsight goal에 편향될 수 있다.

### 16.5 Termination을 조심해야 한다

Goal 도달로 끝난 episode와 로봇이 넘어져 끝난 episode는 다르다.

```text
goal termination
-> relabeled goal 기준으로 다시 계산 가능

safety failure / physical termination
-> goal을 바꿔도 실제 termination은 유지

time limit
-> bootstrapping mask 정책을 별도로 명확히 정의
```

Goal만 바꾸면서 `done`을 무조건 성공 종료로 바꾸면 critic target이 틀어질 수 있다.

## 17. METRA의 $z$와 UVFA/HER의 $g$는 다르다

두 변수 모두 policy condition으로 들어가서 겉보기에는 비슷하다.

$$
\pi(a\mid s,z)
\qquad\text{vs}\qquad
\pi(a\mid s,g)
$$

하지만 의미는 다르다.

| 항목 | METRA의 $z$ | UVFA/HER의 $g$ |
|---|---|---|
| 의미 | 발견할 behavior direction | 달성해야 할 명시적 goal |
| 누가 정의하나 | 사전 분포에서 sample, 의미는 학습 중 형성 | Task 또는 사용자 |
| 목적 | 다양한 controllable behavior 발견 | 주어진 goal 달성 |
| Reward | Representation 변화에서 생성 | Goal success predicate로 계산 |
| Relabeling | 기본 구성요소 아님 | Achieved goal로 replay |

METRA는 **무엇을 할 수 있는가**를 발견한다. UVFA+HER는 **주어진 목표를 어떻게 달성할 것인가**를 학습한다.

둘을 결합하려면 METRA representation에서 goal을 정의할 수 있다.

$$
g_z=\phi(s_{target})
$$

Achieved goal은 다음이 된다.

$$
m(s)=\phi(s)
$$

이 경우 HER는 physical coordinate가 아니라 learned latent goal을 relabel할 수 있다. 그러나 $\phi$가 계속 바뀌면 저장된 goal과 reward의 의미도 바뀌므로 representation freezing, target encoder, reward recomputation 같은 추가 설계가 필요하다. 단순히 $z=g$라고 놓는 것으로 해결되지는 않는다.

## 18. 로봇 구현 전에 확인할 체크리스트

### Problem definition

- Desired goal $g$는 정확히 어떤 물리량인가?
- Achieved-goal mapping $m(s)$를 deterministic하게 계산할 수 있는가?
- Success tolerance $\varepsilon$는 센서 노이즈보다 충분히 큰가?
- Goal은 reward만 바꾸고 dynamics는 바꾸지 않는가?

### Observation contract

```text
actor_obs  = [robot_obs, desired_goal]
critic_obs = [robot_obs, action, desired_goal]
HER source = achieved_goal(next_state)
```

- Desired goal과 achieved goal의 단위·좌표계·정규화가 같은가?
- Quaternion처럼 비유클리드 구조를 단순 L2로 비교하고 있지 않은가?
- Goal 정보가 actor와 critic 양쪽에 일관되게 들어가는가?

### Replay contract

- Original transition을 유지하는가?
- Goal을 바꾼 뒤 reward를 반드시 다시 계산하는가?
- `future` goal은 현재 transition 이후 state에서 선택하는가?
- Safety termination과 goal termination을 구분하는가?
- HER ratio가 실제 task-goal distribution을 압도하지 않는가?

### Validation

- HER 없이 sparse reward가 실제로 얼마나 드문가?
- Relabeled batch의 성공 비율은 얼마인가?
- 원본 goal success와 HER goal success를 따로 기록하는가?
- Train goal이 아닌 holdout goal에서도 generalization되는가?
- Goal 좌표계나 tolerance를 바꿨을 때 결과가 유지되는가?

## 19. 내가 헷갈렸던 질문 정리

### Q1. UVFA가 새로운 RL update rule인가?

아니다. Value function을 state와 goal에 함께 조건화해 goal space까지 일반화하는 함수 구조. Bellman update 자체는 goal-conditioned 형태로 확장된다.

### Q2. HER는 실패를 성공이라고 거짓말하는가?

원래 목표에 성공했다고 말하지 않는다. **실제로 달성한 다른 목표 $g'$에 대해서는 성공이었다**고 재평가한다. Original goal data도 남긴다.

### Q3. Action은 원래 goal을 보고 냈는데 왜 쓸 수 있나?

Off-policy RL은 target policy와 다른 behavior가 만든 action도 학습에 사용할 수 있다. 물리 transition이 goal에 독립적이라는 가정이 함께 필요하다.

### Q4. HER를 쓰면 exploration 문제가 해결되나?

아니다. 방문한 상태를 더 잘 재사용할 뿐. 방문하지 못한 영역의 성공 경험은 만들 수 없다.

### Q5. Goal이 하나여도 HER가 의미 있나?

가능하다. 최종 evaluation goal이 하나여도 학습 중 다양한 achieved goal을 보조 목표로 사용하면 curriculum과 representation learning 효과를 얻을 수 있다. 원 논문의 single-goal 실험도 이 가능성을 보였다.

### Q6. PPO에도 UVFA+HER를 그대로 쓰면 되나?

Goal-conditioned PPO는 가능하지만, 고전적 HER relabeling은 off-policy replay를 전제로 한다. PPO rollout의 goal만 바꾸는 것은 on-policy probability ratio를 깨뜨릴 수 있다.

## 20. 표현과 데이터 재사용의 역할 분리

목표가 바뀌면 같은 state와 action의 가치도 달라진다. UVFA는 이를 $V(s,g)$ 또는 $Q(s,a,g)$ 하나로 표현해 state뿐 아니라 goal space에서도 일반화할 여지를 만든다. Goal마다 network를 따로 두는 대신 여러 value function이 공유하는 구조를 학습하는 셈이다.

HER는 함수 구조가 아니라 replay data를 바꾼다. 물리 transition은 그대로 두고 실제로 달성한 goal로 relabel한 뒤 reward를 다시 계산한다. 이 sample은 off-policy data이므로 replay 기반 RL과 자연스럽게 결합되지만, original goal data도 유지해야 하며 방문하지 못한 영역의 성공 경험까지 만들어 주지는 않는다.

> **UVFA가 여러 목표를 표현하는 좌표계를 만들고, HER가 실패 경험에서도 그 좌표계를 학습할 신호를 찾아낸다.**

## 참고 자료

- Tom Schaul et al., [Universal Value Function Approximators](https://proceedings.mlr.press/v37/schaul15.html), ICML 2015.
- Marcin Andrychowicz et al., [Hindsight Experience Replay](https://arxiv.org/abs/1707.01495), NeurIPS 2017.
- OpenAI, [Ingredients for Robotics Research](https://openai.com/index/ingredients-for-robotics-research/).
- 이전 글: [METRA: 픽셀 거리가 아닌 시간적 거리로 스킬 공간 만들기](/posts/metra-metric-aware-abstraction/).
- 관련 글: [DIAYN: 보상 없이 다양한 스킬을 발견하는 방법](/posts/diayn-diversity-is-all-you-need/).
