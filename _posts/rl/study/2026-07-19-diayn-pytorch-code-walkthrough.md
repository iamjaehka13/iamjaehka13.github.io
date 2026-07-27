---
title: "[DIAYN 코드 읽기] PyTorch 구현 흐름"
date: 2026-07-19 04:05:00 +0900
last_modified_at: 2026-07-27 22:47:54 +0900
categories: [RL, Study]
tags: [diayn, pytorch, soft-actor-critic, mujoco, hopper, skill-discovery]
description: "DIAYN-PyTorch의 transition 흐름을 추적하고 robot_obs, behavior_features, skill horizon, safety constraint를 갖춘 범용 로봇 구조로 연결한다."
math: true
image:
  path: /assets/img/posts/rl/diayn-pytorch/00-diayn-pytorch-preview.png
  alt: 같은 Policy에서 나타난 세 가지 Hopper skill
---

[이전 글](/posts/diayn-diversity-is-all-you-need/)에서는 DIAYN의 mutual information 목적함수와 intrinsic reward를 유도했다. 이번 글의 목표는 수식을 한 번 더 설명하는 것이 아니다. **환경 transition 하나가 코드 안에서 어떻게 저장되고, discriminator reward가 되고, 다시 Policy와 Critic의 gradient로 연결되는지**를 실제 구현 순서대로 추적한다.

읽으면서 계속 붙잡을 질문은 네 가지.

1. 같은 Policy인데 `z`만 바꾸면 왜 다른 행동이 나오는가?
2. 환경 reward를 쓰지 않는다면 Q target의 reward는 언제 만들어지는가?
3. Discriminator와 Critic은 모두 상태를 평가하는데 역할이 어떻게 다른가?
4. 왜 결과에 전진, 후진뿐 아니라 제자리 유지와 빠른 termination도 함께 나타나는가?

이 글은 [akazemipour/DIAYN-PyTorch](https://github.com/akazemipour/DIAYN-PyTorch)를 **논문과 코드를 연결하는 작은 참고 구현**으로 사용한다. 저장소의 Hopper checkpoint를 현재 환경에서 다시 실행했고, 대표 GIF와 5-seed 측정값은 그 checkpoint에서 얻었다. 최신 DIAYN 기준 구현이나 논문 결과의 완전한 재현으로 해석해서는 안 된다.

코드를 읽을 때는 **저장소의 실제 변수명**과 **다른 로봇에도 재사용할 인터페이스 이름**을 구분한다. 예를 들어 저장소의 `state`는 문맥에 따라 physical state만 뜻하기도 하고 `[state, one_hot(z)]`를 뜻하기도 한다. 범용 구조에서는 이를 `robot_obs`, `policy_obs`, `behavior_features`로 분리해 부르겠다.

## 0. 결과부터 보기: 같은 Policy, 다른 `z`

아래 두 실행은 서로 다른 Policy 두 개가 아니다. **동일한 Policy network**에 서로 다른 one-hot skill을 넣은 결과.

<div class="row g-3 mb-4">
  <figure class="col-md-6 mb-0">
    <img src="https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-pytorch/gifs/skill8.gif" alt="Skill 8이 양의 x 방향으로 이동하는 Hopper 실행" decoding="async" style="width: 100%; border-radius: 6px;">
    <figcaption class="text-center mt-2"><strong>z = 8</strong> · 양의 x 방향 이동 경향</figcaption>
  </figure>
  <figure class="col-md-6 mb-0">
    <img src="https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-pytorch/gifs/skill9.gif" alt="Skill 9가 음의 x 방향으로 이동하는 Hopper 실행" decoding="async" style="width: 100%; border-radius: 6px;">
    <figcaption class="text-center mt-2"><strong>z = 9</strong> · 음의 x 방향 이동 경향</figcaption>
  </figure>
</div>

학습 전에 `z=8`이 전진, `z=9`가 후진이라는 의미는 없었다. 학습 과정에서 각 `z`가 서로 다른 상태 분포를 만들었고, 사람이 나중에 영상을 보고 의미를 붙인 것이다.

```text
같은 physical state s
        +
서로 다른 one_hot(z)
        ↓
하나의 skill-conditioned Policy π(a | s, z)
        ↓
서로 다른 action distribution과 state visitation
```

Action만 달라서는 충분하지 않다. Discriminator가 **도달한 물리 상태만 보고 어떤 `z`였는지 맞힐 수 있을 정도로** 결과 상태가 달라져야 한다.

## 1. 먼저 볼 파일과 네트워크

저장소 전체를 처음부터 읽을 필요는 없다. 다음 순서로 보면 논문 식이 코드로 바뀌는 지점을 빠르게 찾을 수 있다.

| 순서 | 파일 | 확인할 질문 |
|---:|---|---|
| 1 | [`main.py`](https://github.com/akazemipour/DIAYN-PyTorch/blob/master/main.py) | `z`는 언제 뽑고 transition에는 무엇을 저장하는가? |
| 2 | [`Brain/replay_memory.py`](https://github.com/akazemipour/DIAYN-PyTorch/blob/master/Brain/replay_memory.py) | 환경 reward 없이 어떤 tuple을 보관하는가? |
| 3 | [`Brain/model.py`](https://github.com/akazemipour/DIAYN-PyTorch/blob/master/Brain/model.py) | Policy, Q, Value, Discriminator의 입력이 어떻게 다른가? |
| 4 | [`Brain/agent.py`](https://github.com/akazemipour/DIAYN-PyTorch/blob/master/Brain/agent.py) | intrinsic reward와 각 loss는 어디서 만들어지는가? |
| 5 | [`Common/play.py`](https://github.com/akazemipour/DIAYN-PyTorch/blob/master/Common/play.py) | 학습된 각 skill을 어떻게 고정해서 재생하는가? |

이번 Hopper 실행은 physical state 11차원, action 3차원, categorical skill 20개를 사용한다. 따라서 Policy가 받는 입력은 `11 + 20 = 31`차원.

| Network | Tensor 흐름과 역할 |
|---|---|
| Policy | `[s, one_hot(z)]` 31차원 → 3차원 action distribution. 현재 skill에 맞는 행동을 sampling한다. |
| Q network 1, 2 | `[s, one_hot(z), a]` → scalar Q-value. 장기 intrinsic return을 추정한다. |
| Value network | `[s, one_hot(z)]` → scalar V-value. 초기 SAC 구조의 soft state value를 추정한다. |
| Discriminator | physical state `s` 11차원 → 20개 skill logits. 상태에서 실행된 skill을 분류한다. |

### 1.1. Hopper 변수와 범용 로봇 인터페이스 대응

이 저장소의 코드를 그대로 설명하는 부분에서는 원래 이름을 사용한다. 범용 로봇 구조를 설명할 때는 다음 이름을 사용한다.

| 범용 용어 | 이 저장소에서 대응하는 값 |
|---|---|
| `robot_obs` | one-hot skill을 붙이기 전 Hopper physical state 11차원 |
| `policy_obs` | `concat_state_latent()`가 만든 `[robot_obs, one_hot(z)]` 31차원 |
| `behavior_features` | Discriminator에 전달하는 `physical_states` 또는 `physical_next_states`. 이 구현에서는 `robot_obs` 전체와 같다. |
| `skill_horizon` | 별도 변수가 없으며 episode 길이가 그 역할을 한다. |
| `safety_constraint` | 별도 계층이 없다. MuJoCo action 범위와 environment termination만 존재한다. |

`robot_obs`와 `behavior_features`가 현재 Hopper에서는 같지만 개념적으로는 다르다. Policy는 제어에 필요한 상태를 받아야 하고, Discriminator는 **어떤 차이를 서로 다른 behavior로 간주할지**에 필요한 feature만 받아야 한다.

이 저장소는 별도의 Value network와 target Value network를 사용하는 **초기 형태의 SAC**를 구현한다. 최근 SAC 구현에서 흔한 `twin Q + target Q` 구성과 모양이 다르지만, DIAYN에서 중요한 `z` 조건, discriminator reward, maximum-entropy Policy의 연결은 그대로 확인할 수 있다.

또한 의존성은 `gym 0.17.3`, `torch 1.6.0`, `mujoco-py 2.0.2.13` 세대. 이 코드는 최신 실행 기반이라기보다 **논문 메커니즘을 읽기 위한 코드 동반 자료**로 보는 편이 정확하다.

## 2. Episode 단위: `z`를 한 번 뽑고 끝까지 유지한다

전체 실행 흐름부터 보면:

![DIAYN episode execution flow](/assets/img/posts/rl/diayn-pytorch/01-episode-flow.svg){: width="920" .d-block .mx-auto }
_바깥쪽 episode loop가 경험을 만들고, 각 environment step 뒤의 `agent.train()`이 replay batch를 사용해 네트워크를 갱신한다._

### 2.1. Uniform prior에서 skill 선택

`main.py`는 먼저 모든 skill에 같은 확률을 주는 prior를 만든다.

```python
p_z = np.full(
    params["n_skills"],
    1 / params["n_skills"],
)

agent = SACAgent(p_z=p_z, **params)
```

20개 skill이라면:

$$
p(z=k)=\frac{1}{20},
\qquad k\in\{0,\ldots,19\}
$$

그다음 episode 시작 시 `z`를 한 번 뽑는다.

```python
for episode in range(1 + min_episode, max_n_episodes + 1):
    z = np.random.choice(n_skills, p=p_z)

    state = env.reset()
    state = concat_state_latent(state, z, n_skills)
```

`z`는 **step마다 다시 뽑지 않는다.** 한 episode 동안 같은 값이 유지되어야 조건부 Policy $\pi(a\mid s,z)$가 일관된 상태 분포 $p(s\mid z)$를 만들 수 있다.

```text
episode 42: z = 8

s0 → a0 → s1 → a1 → s2 → ... → termination
└────────────── z=8이 계속 유지 ──────────────┘
```

만약 매 step마다 `z`를 바꾸면 Discriminator가 한 skill의 지속적인 결과를 학습하기 어려워지고, 논문에서 정의한 episode-level latent skill과도 다른 문제가 된다.

### 2.2. 정수 ID를 Policy 입력으로 바꾸기

`concat_state_latent()`는 정수 skill ID를 one-hot vector로 바꿔 physical state 뒤에 붙인다.

```python
def concat_state_latent(s, z_, n):
    z_one_hot = np.zeros(n)
    z_one_hot[z_] = 1
    return np.concatenate([s, z_one_hot])
```

예를 들어 `z=8`이면 Policy 입력은 다음 모양이다.

```text
physical state s     [ 11 values ]
one_hot(z=8)         [0, 0, ..., 1, ..., 0]  # 20 values
                     ----------------------
Policy input         [ 31 values ]
```

별도의 Policy 20개를 만드는 것이 아니다. 하나의 network가 `z`를 조건으로 받아 20개의 behavior mode를 표현한다.

### 2.3. Episode와 `skill_horizon`은 같은가?

이 저장소에서는 episode 시작에 `z`를 뽑고 `done`까지 유지하므로 다음 두 경계가 같다.

```text
Hopper episode boundary = skill boundary
```

하지만 실제 로봇은 수동 reset 없이 오랫동안 계속 동작할 수 있다. 이때는 한 skill을 유지할 control step 수를 `skill_horizon = H`로 따로 정의할 수 있다.

```python
if env_reset or skill_age >= skill_horizon:
    z = sample_uniform_skill(num_skills)
    skill_age = 0

policy_obs = torch.cat([robot_obs, one_hot(z)], dim=-1)
action = actor.sample(policy_obs)
skill_age += 1
```

여기서 지켜야 할 조건은 세 가지.

1. `z`는 control step마다 바꾸지 않고 최소 $H$ step 동안 유지한다.
2. 병렬 환경에서는 `skill_age`와 `z`를 environment별로 따로 관리한다.
3. Skill 경계에서 $z$가 바뀐다면 Critic의 bootstrap 경계도 명시한다.

세 번째 조건이 특히 중요하다. 이전 skill의 마지막 transition에서 다음 skill의 value를 그대로 bootstrap하면 서로 다른 조건부 Policy의 return이 섞인다. 각 horizon을 독립된 low-level option으로 취급한다면 다음처럼 구분하는 편이 안전하다.

```python
bootstrap_done = env_done | safety_done | skill_boundary
```

반대로 episode 전체에서 같은 `z`를 유지하면 원 논문과 가장 가까운 설정. `skill_horizon`을 도입하는 순간 continuing control 또는 option termination이라는 추가 설계가 생긴다는 점을 숨기면 안 된다.

## 3. Environment step과 replay buffer

한 step에서 실제로 실행되는 핵심 코드는 짧다.

```python
action = agent.choose_action(state)

next_state, env_reward, done, _ = env.step(action)
next_state = concat_state_latent(next_state, z, n_skills)

agent.store(state, z, done, action, next_state)
agent.train()
```

이 네 줄을 데이터 흐름으로 읽으면:

```text
[s, z]
  ↓ Policy sampling
a
  ↓ env.step(a)
s′, env_reward, done
  ↓ 같은 z를 s′에 결합
[s′, z]
  ↓ replay buffer 저장
(s+z, z, done, a, s′+z)
```

### 3.1. Policy는 평균 action이 아니라 sample을 출력한다

Policy는 `mu`와 `std`로 Gaussian distribution을 만들고, reparameterization trick으로 sample한 뒤 `tanh`를 적용한다.

```python
dist = Normal(mu, std)
u = dist.rsample()
action = torch.tanh(u)
```

따라서 같은 physical state와 같은 `z`에서도 매번 세부 action이 완전히 같지는 않다. SAC의 entropy 항은 각 skill 내부에서 탐색을 유지하며, `rsample()`은 Policy gradient가 sampling 과정을 통과할 수 있게 한다.

### 3.2. 환경 reward는 logging만 하고 학습에는 쓰지 않는다

Gym의 Hopper 환경은 원래 task reward를 반환한다.

```python
next_state, reward, done, _ = env.step(action)
episode_reward += reward
```

하지만 `store()`에는 `reward` 인자가 없다.

```python
def store(self, state, z, done, action, next_state):
    self.memory.add(state, z, done, action, next_state)
```

일반 SAC와 비교하면 replay tuple이 다르다.

```text
일반 task SAC
(state, action, environment reward, next_state, done)

이 DIAYN 구현
(state+z, z, done, action, next_state+z)
```

`episode_reward`는 기존 Hopper task 기준으로 결과를 관찰하기 위한 logging 값일 뿐이다. Q network가 학습할 reward는 transition을 저장할 때가 아니라, **replay batch를 꺼내 현재 Discriminator로 계산할 때** 만들어진다.

이 차이는 중요하다. Replay buffer의 동일한 transition이라도 Discriminator parameter $\phi$가 바뀌면 나중에 계산되는 intrinsic reward가 달라질 수 있다.

## 4. 같은 transition을 네트워크마다 다르게 본다

![Policy and discriminator tensor routing](/assets/img/posts/rl/diayn-pytorch/02-tensor-routing.svg){: width="920" .d-block .mx-auto }
_Policy와 Critic은 어떤 skill을 수행하는지 알아야 한다. Discriminator는 그 정답을 입력으로 받지 않고 physical state만으로 추측해야 한다._

### 4.1. Policy와 Critic에는 `z`가 필요하다

Policy는 다음 조건부 분포를 표현한다.

$$
\pi_\theta(a\mid s,z)
$$

Q network도 같은 state와 action이 어떤 skill 문맥에서 실행되었는지 알아야 한다.

$$
Q_\psi(s,a,z)
$$

예를 들어 음의 x 방향으로 움직이는 action은 `z=9`에는 높은 미래 intrinsic return을 만들 수 있지만, 다른 skill이 같은 상태를 차지하고 있다면 그 skill에는 좋은 action이 아닐 수 있다.

### 4.2. Discriminator에는 `z`를 넣으면 안 된다

Discriminator의 목표는 다음 posterior를 근사하는 것.

$$
q_\phi(z\mid s)
$$

따라서 입력은 physical state, 정답 label은 `z`. 코드에서는 `[s, one_hot(z)]`의 뒤쪽을 잘라내고 physical state만 전달한다.

```python
physical_states = torch.split(
    states,
    [self.n_states, self.n_skills],
    dim=-1,
)[0]

logits = self.discriminator(physical_states)
```

만약 Discriminator 입력에 one-hot `z`까지 그대로 들어가면 다음 shortcut이 생긴다.

```text
입력 끝부분 [0, 0, 1, 0, ...]
                 ↓
정답은 z=2라고 바로 읽음
                 ↓
Policy가 서로 다른 상태를 만들 필요가 없음
```

분류 정확도와 intrinsic reward는 높아지지만 skill diversity는 생기지 않는다. 이것이 **label leakage**다. DIAYN 구현을 볼 때 가장 먼저 확인해야 할 입력 분리.

### 4.3. Physical state와 `behavior_features`는 항상 같지 않다

Hopper 참고 구현은 11차원 physical state 전체를 Discriminator에 넣는다. 범용 로봇 코드에서는 이 slicing을 별도 함수로 드러내는 편이 낫다.

```python
robot_obs = build_robot_obs(sensor_data)
policy_obs = torch.cat([robot_obs, one_hot_z], dim=-1)

# z, episode time, reset ID 같은 shortcut은 제외한다.
behavior_features = select_behavior_features(robot_obs)
logits = discriminator(behavior_features)
```

`behavior_features`는 단순한 입력 축소가 아니라 behavior specification.

- 이동 skill을 원하면 body velocity, heading, local trajectory를 사용할 수 있다.
- Manipulation skill을 원하면 object-relative end-effector pose와 contact를 사용할 수 있다.
- 자세 diversity가 목적이면 joint configuration과 orientation을 사용할 수 있다.
- 장소에 무관한 skill이 필요하면 절대 world position보다 body-relative feature가 적합할 수 있다.

Policy에 필요한 sensor를 모두 Discriminator에도 넣으면 배경, sensor bias, battery state처럼 행동과 무관한 shortcut으로 skill을 분리할 수 있다. 반대로 feature를 지나치게 줄이면 실제로 다른 행동도 같은 것으로 취급된다. 따라서 `robot_obs`와 `behavior_features`는 목적이 다른 두 인터페이스로 관리해야 한다.

## 5. 핵심: Discriminator 출력이 reward가 되는 순간

`agent.train()`은 replay buffer에 batch size 256개 이상의 transition이 쌓이면 batch를 꺼낸다.

```python
batch = self.memory.sample(self.batch_size)
states, zs, dones, actions, next_states = self.unpack(batch)
```

그다음 `next_states`에서 physical state만 분리해 Discriminator에 넣는다.

```python
physical_next_states = torch.split(
    next_states,
    [self.n_states, self.n_skills],
    dim=-1,
)[0]

logits = self.discriminator(physical_next_states)
log_q = log_softmax(logits, dim=-1)

rewards = (
    log_q.gather(-1, zs).detach()
    - torch.log(p_z.gather(-1, zs) + 1e-6)
)
```

Tensor 역할을 분리하면:

| Tensor | Shape | 의미 |
|---|---:|---|
| `physical_next_states` | `[256, 11]` | one-hot skill을 제거한 Hopper 상태 |
| `logits` | `[256, 20]` | 각 transition에 대한 20개 skill 점수 |
| `log_q` | `[256, 20]` | `log q_phi(z | s')` |
| `zs` | `[256, 1]` | 실제 실행된 skill ID |
| `rewards` | `[256, 1]` | Q target에 들어갈 DIAYN reward |

코드가 계산하는 식은 논문과 같다.

$$
r_{\text{DIAYN}}(s',z)
=
\log q_\phi(z\mid s')-\log p(z)
$$

### 5.1. 숫자로 보는 reward

20개 skill의 uniform prior라면 $p(z)=1/20=0.05$다.

$$
r=\log q_\phi(z\mid s')+\log 20
$$

| 실제 skill에 준 확률 | Reward | 해석 |
|---:|---:|---|
| $q=0.01$ | $\log(0.01/0.05)\approx-1.61$ | prior보다도 못 맞힘 |
| $q=0.05$ | $0$ | 무작위 추측 수준 |
| $q=0.50$ | $\log 10\approx2.30$ | 상태가 해당 skill을 강하게 시사 |
| $q=0.90$ | $\log 18\approx2.89$ | 거의 확실히 구별 |
| $q=1.00$ | $\log 20\approx3.00$ | 이론적 최대치 |

따라서 reward가 크다는 것은 skill이 **더 모호하다**는 뜻이 아니다. 반대로 현재 상태에서 실제 skill이 prior보다 훨씬 쉽게 식별된다는 뜻.

Bayes rule로 보면 이 상대평가 구조가 더 선명하다.

$$
\frac{p(z\mid s)}{p(z)}
=
\frac{p(s\mid z)}{p(s)}
$$

Discriminator가 충분히 정확하다고 가정하면 높은 reward는 다음 상태를 뜻한다.

> 이 skill은 자주 방문하지만 전체 skill mixture에서는 상대적으로 드문 상태

즉 절대적으로 희귀한 상태가 아니라, **다른 skill과 비교했을 때 해당 `z`에 특이적인 상태**가 높은 보상을 받는다.

### 5.2. 같은 transition의 reward가 바뀔 수 있다

환경 reward는 보통 transition이 정해지면 고정된다. 이 구현의 reward는 현재 Discriminator로 replay batch를 처리할 때마다 다시 계산된다.

```text
수집 당시 q_phi(z|s′) = 0.20
학습 후   q_phi(z|s′) = 0.75

같은 (s, z, a, s′)라도 intrinsic reward가 달라짐
```

장점은 과거 데이터도 최신 분류 기준으로 다시 평가할 수 있다는 것. 반면 Critic이 따라가는 target 자체가 학습 중 움직이므로 일반적인 고정 task reward보다 non-stationarity가 크다.

### 5.3. `detach()`는 gradient 경계를 만든다

```python
log_q.gather(-1, zs).detach()
```

이 한 줄은 Discriminator 출력값을 SAC 관점에서 상수 reward로 취급한다. Q loss가 Discriminator parameter까지 의도치 않게 변경하지 않도록 gradient를 끊는다.

Actor도 다음 경로로 Discriminator를 직접 미분하지 않는다.

```text
Discriminator output
    ↓ detach
scalar intrinsic reward
    ↓ TD target
Critic Q(s, a, z)
    ↓
Actor update
```

`Actor → Environment → next state → Discriminator` 전체를 미분하는 모델 기반 구조가 아니다. Actor는 누적 intrinsic return을 학습한 Critic을 통해 간접적으로 개선된다.

## 6. 하나의 batch에서 세 학습기가 움직인다

![DIAYN network update flow](/assets/img/posts/rl/diayn-pytorch/03-update-flow.svg){: width="920" .d-block .mx-auto }
_Reward를 만드는 경로와 Discriminator 자체를 학습하는 경로는 분리되어 있다._

DIAYN에는 서로 다른 방식으로 학습되는 세 종류의 학습기가 있다.

| 학습기 | 학습 방식 | 질문 |
|---|---|---|
| Actor | Policy optimization | 어떤 action이 장기 intrinsic return과 entropy를 키우는가? |
| Q / Value | Temporal-difference learning | 앞으로 받을 intrinsic reward의 누적값은 얼마인가? |
| Discriminator | Supervised classification | 이 physical state는 어떤 `z`가 만들었는가? |

### 6.1. Value target

Policy가 현재 `[s,z]`에서 새 action과 log probability를 만든다.

```python
reparam_actions, log_probs = policy.sample_or_likelihood(states)

q1 = q_network1(states, reparam_actions)
q2 = q_network2(states, reparam_actions)
q = torch.min(q1, q2)

target_value = q.detach() - alpha * log_probs.detach()
value_loss = mse(value_network(states), target_value)
```

식으로 쓰면 다음 soft value target이다.

$$
V_{\text{target}}(s,z)
=
\min_i Q_i(s,a,z)-\alpha\log\pi(a\mid s,z)
$$

두 Q 중 작은 값을 사용해 Q-value 과대평가를 줄이고, $-\alpha\log\pi$로 Policy entropy를 포함한다.

### 6.2. Q target

앞에서 만든 DIAYN reward가 Q target에 들어간다.

```python
with torch.no_grad():
    target_q = (
        reward_scale * rewards
        + gamma * target_value_network(next_states) * (~dones)
    )
```

$$
y_Q
=
r_{\text{DIAYN}}(s',z)
+\gamma(1-d)V_{\text{target}}(s',z)
$$

Critic의 의미는 "좋은 Hopper 동작인가?"가 아니다.

> 이 action을 선택하면 앞으로 해당 `z`를 다른 skill과 구별해 주는 상태를 얼마나 오래 만들 수 있는가?

그래서 현재 step의 분류 reward가 낮더라도 이후 독특한 상태로 이어지는 action은 높은 Q-value를 가질 수 있다.

### 6.3. Policy loss

```python
policy_loss = (alpha * log_probs - q).mean()
```

최소화 관점에서 Policy는 높은 Q-value와 높은 entropy를 함께 선호한다.

$$
J_\pi
=
\mathbb{E}
\left[
\alpha\log\pi(a\mid s,z)
-\min_i Q_i(s,a,z)
\right]
$$

Policy backward 중 Q network를 통과하는 gradient는 action을 거쳐 Policy까지 전달된다. 이때 optimizer step은 `policy_opt`에만 적용되고, Q parameter에 생긴 임시 gradient는 뒤의 Q update 전에 `zero_grad()`로 지워진다.

### 6.4. Discriminator loss

Discriminator는 RL loss가 아니라 일반적인 multiclass classification loss를 사용한다.

```python
physical_states = split_physical_state(states)
logits = discriminator(physical_states)

discriminator_loss = cross_entropy(
    logits,
    zs.squeeze(-1),
)
```

$$
\mathcal{L}_D(\phi)
=
-\mathbb{E}_{s,z}
\left[\log q_\phi(z\mid s)\right]
$$

코드상 reward는 `next_states`의 $s'$에서 만들고, Discriminator classification loss는 `states`의 $s$에서 계산한다. Replay buffer 안의 연속 transition에서는 두 집합 모두 방문 상태 분포의 sample이므로 학습은 가능하지만, 코드를 읽을 때 현재 상태와 다음 상태가 섞이지 않도록 구분해야 한다.

마지막에는 local Value network를 target Value network로 조금씩 반영한다.

```python
target_param.data.copy_(
    tau * local_param.data
    + (1 - tau) * target_param.data
)
```

전체 결합 관계는 다음 순환으로 정리된다.

```text
Policy가 행동을 바꿈
→ skill별 방문 상태가 달라짐
→ Discriminator의 분류 문제가 달라짐
→ intrinsic reward가 달라짐
→ Critic target이 달라짐
→ Policy가 다시 바뀜
```

일반 task RL과 달리 보상 생성기까지 함께 변하므로, Policy와 Discriminator의 학습 속도와 입력 feature가 결과에 큰 영향을 준다.

## 7. Hopper에서 Discriminator가 실제로 보는 것

Hopper-v3의 observation은 대략 다음 방식으로 만들어진다.

```python
def _get_obs(self):
    return np.concatenate([
        self.sim.data.qpos.flat[1:],
        np.clip(self.sim.data.qvel.flat, -10, 10),
    ])
```

`qpos[0]`인 전역 x 위치는 observation에서 제외된다. Discriminator는 "x=5 m에 있으니 z=8"처럼 절대 위치를 바로 사용할 수 없다. 대신 다음 정보를 조합해 skill을 구별한다.

- 몸통 높이와 자세
- 관절 configuration
- 양수 또는 음수 방향의 generalized velocity
- hopping 과정의 속도 패턴
- 균형 유지 상태와 넘어지는 상태

따라서 양의 x 이동과 음의 x 이동은 절대 위치가 아니라 속도와 자세 분포의 차이로 구분될 수 있다. 반대로 사람 눈에 거의 제자리로 보이는 두 skill도 내부 관절 속도 분포가 다르면 Discriminator에는 구별 가능할 수 있다.

## 8. 20개 skill 결과를 어떻게 읽어야 하는가

영상 한 번만 보고 skill의 의미를 단정하지 않기 위해 각 skill을 서로 다른 seed로 5회씩 실행했다. 전역 x 변위는 Discriminator 입력이 아니라 분석을 위해 simulator에서 별도로 읽었다.

| Skill | x 변위 평균 ± 표준편차 | 평균 step | 관찰 |
|---:|---:|---:|---|
| 0 | +0.254 ± 0.024 | 1000.0 | 거의 제자리에서 episode 유지 |
| 3 | +0.115 ± 0.002 | 27.4 | 매우 빠르게 종료 |
| 6 | -0.021 ± 0.014 | 1000.0 | 수평 이동 없이 오래 유지 |
| 8 | +5.597 ± 2.597 | 825.2 | 큰 양의 x 이동, rollout 간 편차 큼 |
| 9 | -3.333 ± 1.117 | 862.6 | 뚜렷한 음의 x 이동 |
| 17 | +2.910 ± 1.039 | 1000.0 | 양의 x 이동을 끝까지 유지 |
| 19 | -1.179 ± 0.915 | 685.8 | 음의 x 이동 경향과 큰 변동 |

[20개 skill 전체 측정값 CSV](/assets/data/posts/rl/diayn-pytorch/skill-metrics-5-seeds.csv)에는 각 skill의 5회 평균, 표준편차, 최소·최대 episode step을 남겼다.

### 8.1. 오래 유지되는 상태와 빠른 termination

<div class="row g-3 mb-4">
  <figure class="col-md-6 mb-0">
    <img src="https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-pytorch/gifs/skill0.gif" alt="Skill 0이 거의 제자리에서 자세를 유지하는 Hopper 실행" decoding="async" style="width: 100%; border-radius: 6px;">
    <figcaption class="text-center mt-2"><strong>z = 0</strong> · 작은 x 변위, 1000 step 유지</figcaption>
  </figure>
  <figure class="col-md-6 mb-0">
    <img src="/assets/img/posts/rl/diayn-pytorch/gifs/skill3.gif" alt="Skill 3이 빠르게 termination되는 Hopper 실행" decoding="async" style="width: 100%; border-radius: 6px;">
    <figcaption class="text-center mt-2"><strong>z = 3</strong> · 평균 27.4 step 만에 종료</figcaption>
  </figure>
</div>

`z=0`은 수평 이동이 작아도 자세와 속도 분포를 오래 유지한다. `z=3`은 빠르게 넘어져 종료된다. 두 결과 모두 다른 skill과 구별되기는 쉽지만, 사람에게 유용한 skill이라는 보장은 없다.

### 8.2. 같은 방향 안에서도 다른 state distribution

<div class="row g-3 mb-4">
  <figure class="col-md-6 mb-0">
    <img src="https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-pytorch/gifs/skill17.gif" alt="Skill 17이 긴 episode 동안 양의 x 방향으로 이동하는 Hopper 실행" decoding="async" style="width: 100%; border-radius: 6px;">
    <figcaption class="text-center mt-2"><strong>z = 17</strong> · 양의 x 이동, 1000 step 유지</figcaption>
  </figure>
  <figure class="col-md-6 mb-0">
    <img src="https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-pytorch/gifs/skill19.gif" alt="Skill 19가 변동을 보이며 음의 x 방향으로 이동하는 Hopper 실행" decoding="async" style="width: 100%; border-radius: 6px;">
    <figcaption class="text-center mt-2"><strong>z = 19</strong> · 음의 x 이동, rollout 편차 큼</figcaption>
  </figure>
</div>

`z=8`과 `z=17`은 모두 양의 x 방향으로 움직이지만 생존 길이와 속도·자세 패턴이 다를 수 있다. DIAYN은 사람이 붙인 "전진"이라는 한 단어가 아니라 전체 상태 분포를 구별 대상으로 사용한다.

측정 결과를 behavior family로 거칠게 묶으면:

- `0, 5, 6, 10, 14, 16`: 긴 episode를 유지하면서 수평 이동이 작음
- `7, 8, 17, 18`: 평균적으로 큰 양의 x 이동
- `9, 19`: 음의 x 이동 경향
- `3, 12, 13`: 평균 생존 길이가 짧음

이 분류는 학습 label이 아니라 관찰 후 붙인 설명. 실제 Discriminator가 사용하는 경계는 x 변위 하나가 아니라 11차원 state feature 전체에 놓인다.

### 8.3. 유사한 행동이 여러 `z`에 할당되는 현상

20개의 label이 있다고 해서 사람이 구별할 수 있는 의미 있는 행동도 반드시 20개가 되는 것은 아니다. 실제 영상을 함께 놓고 보면 서로 다른 `z`인데도 같은 행동 범주로 보이는 경우가 있다.

정량 지표까지 가까운 세 쌍을 골라 비교하면:

| Skill pair | 평균 x 변위 | 평균 step | 사람이 보는 공통점 |
|---|---:|---:|---|
| `z=0` / `z=5` | +0.254 / +0.278 | 1000 / 1000 | 거의 제자리에서 자세 유지 |
| `z=6` / `z=16` | -0.021 / -0.055 | 1000 / 1000 | 수평 이동 없이 오래 유지 |
| `z=17` / `z=18` | +2.910 / +2.987 | 1000 / 1000 | 양의 x 방향으로 지속 이동 |

각 GIF는 같은 시간 구간을 좌우에 배치했다.

<figure class="mb-4">
  <img src="https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-pytorch/gifs/similar-skill0-skill5.gif" alt="제자리 자세 유지로 비슷해 보이는 Skill 0과 Skill 5 비교" decoding="async" style="width: 100%; border-radius: 6px;">
  <figcaption class="text-center mt-2"><strong>왼쪽 z=0 · 오른쪽 z=5</strong> — 둘 다 작은 x 변위로 1000 step을 유지한다.</figcaption>
</figure>

<figure class="mb-4">
  <img src="https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-pytorch/gifs/similar-skill6-skill16.gif" alt="수평 이동 없이 자세를 유지하는 Skill 6과 Skill 16 비교" decoding="async" style="width: 100%; border-radius: 6px;">
  <figcaption class="text-center mt-2"><strong>왼쪽 z=6 · 오른쪽 z=16</strong> — x 변위와 생존 길이만 보면 가장 유사한 쌍.</figcaption>
</figure>

<figure class="mb-4">
  <img src="https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-pytorch/gifs/similar-skill17-skill18.gif" alt="양의 x 방향으로 이동하는 Skill 17과 Skill 18 비교" decoding="async" style="width: 100%; border-radius: 6px;">
  <figcaption class="text-center mt-2"><strong>왼쪽 z=17 · 오른쪽 z=18</strong> — 모두 끝까지 양의 x 방향 이동을 유지한다.</figcaption>
</figure>

이 현상은 DIAYN의 목적함수가 **사람이 이해하는 행동 의미의 차이**를 직접 최적화하지 않기 때문에 생길 수 있다. DIAYN이 요구하는 것은 다음 조건이다.

$$
q_\phi(z\mid s)
\text{가 서로 다른 }z\text{를 구별할 수 있을 것}
$$

사람에게는 둘 다 "제자리에서 균형 잡기"로 보이더라도 Discriminator는 몸통 각도, 발의 자세, 관절속도처럼 영상에서 잘 드러나지 않는 차이를 사용할 수 있다. 그러면 두 skill은 같은 semantic category에 속해 보여도 11차원 state space에서는 분류 가능한 서로 다른 영역을 차지할 수 있다.

```text
사람의 행동 의미
z=6  → 제자리 유지
z=16 → 제자리 유지

Discriminator가 볼 수 있는 차이
z=6  → 자세 A + 속도 패턴 A
z=16 → 자세 B + 속도 패턴 B
```

따라서 이 결과를 바로 **mode collapse**라고 부르는 것은 과하다. 정확히 같은 상태분포로 붕괴했다면 Discriminator도 두 skill을 구별하기 어려워야 한다. 현재 영상과 `x displacement`, `episode length`만으로는 11차원 전체 상태분포가 같은지 판단할 수 없다.

현재 증거로 안전하게 말할 수 있는 것은:

> **서로 다른 latent skill이 사람 기준으로는 유사한 행동 의미를 갖는 semantic redundancy가 관찰된다.**

이것은 DIAYN의 중요한 한계 중 하나.

1. $I(S;Z)$가 커도 각 skill이 사람에게 유용하거나 의미적으로 고유하다는 보장은 없다.
2. 정해진 skill 수 $K$가 환경에 존재하는 의미 있는 행동 mode 수보다 크면, 하나의 행동 범주가 미세한 state 차이로 여러 label에 나뉠 수 있다.
3. Downstream task 관점에서는 20개 label 중 실제로 필요한 행동 repertoire가 더 작을 수 있다.
4. Discriminator가 task와 무관한 미세 feature를 사용하면 분류 성능과 체감 diversity가 어긋날 수 있다.

더 강한 결론을 내려면 영상 비교를 넘어 skill별 전체 state trajectory를 저장하고, pairwise state-distribution distance와 Discriminator confusion matrix를 확인해야 한다. 그 전까지는 **"20개 skill을 학습했다"와 "의미가 다른 유용한 행동 20개를 얻었다"를 구분해야 한다.**

### 8.4. GIF 한 개와 정량 평균은 다른 자료다

각 GIF는 고정된 `z`로 실행한 sampled rollout 하나의 앞부분. 표는 skill마다 5회 실행한 평균이다. 이 구현은 Policy를 `eval()` 모드로 바꾼 뒤에도 Gaussian 평균 action만 고정해서 쓰지 않고 계속 sample한다.

따라서 같은 `z`도 실행할 때마다 trajectory, x 변위, 종료 시점이 달라질 수 있다. GIF의 한 장면을 skill 전체의 확정적 의미로 읽으면 안 된다.

## 9. 코드에서 얻은 것과 구현 특성을 분리하기

이 저장소는 DIAYN의 중심 메커니즘을 작게 확인하기에는 좋지만, 모든 코드 선택이 논문 정의 그 자체는 아니다.

| 논문 메커니즘에 가까운 핵심 | 이 저장소에 특화된 선택 |
|---|---|
| episode마다 fixed prior에서 `z` sampling | Hopper에서 skill 20개 사용 |
| Policy와 Critic이 `z`에 condition | 11차원 observation 뒤에 one-hot 직접 결합 |
| Discriminator는 physical state로 `z` 분류 | 두 층 MLP와 hidden size 300 |
| $\log q(z\mid s)-\log p(z)$ reward | 초기 SAC의 별도 Value network 사용 |
| maximum-entropy off-policy 학습 | 오래된 Gym, PyTorch, `mujoco-py` 의존성 |

코드를 학습 자료로 사용할 때 특히 조심할 부분도 있다.

1. **README의 reward 설명**: reward가 클수록 skill이 더 ambiguous한 것이 아니라, 실제 skill이 상태에서 더 잘 식별된다.
2. **오래된 종료 API**: `done` 하나로 termination과 time-limit truncation을 구분하지 않는다. 최신 Gymnasium의 bootstrap 처리와 차이가 있다.
3. **Replay buffer 구현**: Python list가 가득 차면 `pop(0)`을 사용하므로 대규모 학습용으로 효율적이지 않다.
4. **Checkpoint 재개**: replay buffer는 checkpoint에 포함되지 않아 재개 직후 데이터 분포가 달라질 수 있다. 저장소 README도 이 구간의 Discriminator 거동을 주의한다.
5. **평가의 stochasticity**: `eval()`은 layer mode만 바꾸며 action sampling은 계속된다. deterministic evaluation이 필요하면 평균 action 경로를 별도로 구현해야 한다.

이 한계들은 DIAYN 식이 틀렸다는 뜻이 아니다. **논문에서 반드시 유지해야 할 구조와 참고 구현의 세부 선택을 분리해서 읽어야 한다**는 뜻.

## 10. Hopper 구현을 범용 로봇 코드로 번역하기

[이론 글의 범용 로봇 적용 절](/posts/diayn-diversity-is-all-you-need/#16-로봇에-적용한다면-무엇이-달라져야-하는가)에서 정리한 원칙을 코드로 옮겨 보자. 앞의 Hopper 코드를 다른 로봇으로 옮길 때는 네트워크 구조보다 먼저 다음 네 인터페이스를 분리하는 편이 안전하다.

### 10.1. `robot_obs`와 `behavior_features`

`robot_obs`는 Actor와 Critic이 제어에 사용하는 관측값. `behavior_features`는 Discriminator가 skill identity를 판별하는 관측값이다.

```python
robot_obs = observation_builder(sensor_data)
policy_obs = torch.cat([robot_obs, one_hot_z], dim=-1)
behavior_features = behavior_encoder(robot_obs)
```

두 값의 shape, normalization 통계, 좌표계는 별도로 관리해야 한다. 특히 `behavior_features`에는 `z`, environment ID, episode time, reset flag가 들어가면 안 된다.

### 10.2. `skill_horizon`과 skill별 데이터 경계

Episode reset이 자연스럽지 않은 로봇에서는 `skill_horizon` 동안 같은 `z`를 유지한다. Replay transition에는 **그 action을 실제로 생성한 `z`**를 저장해야 한다.

```python
transition = {
    "robot_obs": robot_obs,
    "skill_id": z,
    "action": executed_action,
    "next_robot_obs": next_robot_obs,
    "env_done": env_done,
    "safety_done": safety_done,
    "skill_done": skill_boundary,
}
```

`env_done`, `safety_done`, `skill_done`을 분리하면 environment 종료, safety 계층의 강제 중단, latent skill 교체를 혼동하지 않을 수 있다. Low-level Critic이 한 skill 구간의 return만 학습한다면 TD target에는 세 종료 조건을 모두 반영한다.

### 10.3. `safety_constraint`는 intrinsic reward와 다른 계층이다

DIAYN reward는 구별 가능성을 높일 뿐 안전을 보장하지 않는다. 실제 로봇에서는 Policy 출력과 actuator command 사이에 hard limit 또는 safety filter가 필요할 수 있다.

```python
raw_action = actor.sample(policy_obs)

executed_action, safety_info = safety_filter(
    raw_action,
    robot_state=robot_state,
    action_limits=action_limits,
)
safety_done = safety_info.emergency_stop

next_robot_obs, env_done = robot.step(executed_action)
```

여기서 replay buffer에는 `raw_action`이 아니라 **실제로 적용된 `executed_action`**을 저장해야 한다. Safety filter가 action을 바꿨는데 raw action을 저장하면 Critic은 실행되지 않은 action이 다음 상태를 만들었다고 학습한다.

Hard safety constraint와 auxiliary penalty도 구분해야 한다.

- Hard limit, collision shield, geofence, emergency stop은 가능한 action이나 state를 제한한다.
- Energy, smoothness, action-rate penalty는 최적화할 reward 자체를 바꾼다.

후자를 DIAYN reward에 더하면 논문 그대로의 pure objective는 아니지만 task reward 없이 안전하고 재사용 가능한 skill을 찾는 실용적 변형은 될 수 있다.

$$
r_{\text{total}}
=
r_{\text{DIAYN}}
-\lambda_E c_{\text{energy}}
-\lambda_S c_{\text{smoothness}}
$$

Penalty를 추가할 때는 어떤 행동을 억제하는지, 새로운 reward hacking 경로가 생기는지, exploration이 과도하게 줄지 따로 검증해야 한다.

### 10.4. 네 인터페이스를 합친 학습 루프

먼저 control loop는 skill을 유지하고, safety filter를 통과한 action으로 transition을 수집한다.

```python
for control_step in range(total_steps):
    if env_reset or skill_manager.at_boundary(skill_horizon):
        skill_manager.sample_uniform(num_skills)

    z = skill_manager.skill_id
    robot_obs = observation_builder(sensor_data)
    policy_obs = torch.cat([robot_obs, one_hot(z)], dim=-1)

    raw_action = actor.sample(policy_obs)
    executed_action, safety_info = safety_filter(raw_action)
    safety_done = safety_info.emergency_stop
```

Safety filter를 통과한 action으로 환경을 진행한 뒤, 실제 실행 action과 두 종류의 종료 조건을 저장한다.

```python
next_sensor_data, env_done = robot.step(executed_action)
next_robot_obs = observation_builder(next_sensor_data)
skill_done = skill_manager.advance(skill_horizon)

replay.add(robot_obs, z, executed_action, next_robot_obs,
           env_done, safety_done, skill_done)
```

학습할 때는 replay batch의 `robot_obs`에서 `behavior_features`를 만들고, Discriminator 분류와 intrinsic reward 계산에만 사용한다.

```python
batch = replay.sample(batch_size)

behavior_features = behavior_encoder(batch.robot_obs)
next_behavior_features = behavior_encoder(batch.next_robot_obs)

disc_logits = discriminator(behavior_features)
disc_loss = cross_entropy(disc_logits, batch.skill_id)

with torch.no_grad():
    next_log_q = log_softmax(discriminator(next_behavior_features), dim=-1)
    intrinsic_reward = (
        gather_skill_log_prob(next_log_q, batch.skill_id)
        - log_prior(batch.skill_id)
    )
```

이 코드는 특정 로봇의 완성된 구현이 아니라 ownership boundary를 보여주는 구조. 실제 시스템에서는 observation timestamp, control frequency, action unit, actuator limit, sensor latency를 기존 로봇 stack과 일치시켜야 한다.

## 11. Transition 하나로 전체 흐름 다시 연결하기

마지막으로 `z=8`인 transition 하나가 학습 신호가 되는 과정을 압축해 보자.

```text
1. Episode 시작
   z=8을 uniform prior에서 sampling

2. Policy 입력
   [physical state s, one_hot(z=8)]

3. 행동 실행
   a ~ π(a | s, z=8)
   env.step(a) → s′, done

4. Replay 저장
   (s+z, z=8, done, a, s′+z)
   environment reward는 저장하지 않음

5. Batch sampling
   s′에서 one_hot(z)를 제거하고 physical state만 D에 입력

6. Reward 생성
   r = log q_phi(z=8 | s′) - log p(z=8)
   reward tensor는 detach

7. Critic 학습
   r + gamma V_target(s′, z=8)로 Q target 계산

8. Policy 학습
   높은 Q와 높은 entropy를 만드는 action distribution으로 이동

9. Discriminator 학습
   physical state s의 정답 class가 z=8이 되도록 Cross Entropy 최소화
```

> **Discriminator는 현재 상태가 얼마나 `z`다운지 한 step의 reward를 만들고, Critic은 그 reward가 앞으로 얼마나 누적될지 예측한다.**

DIAYN은 기존 강화학습을 버리는 알고리즘이 아니다. SAC의 상태를 $(s,z)$로 확장하고, 고정된 task reward 대신 학습되는 분류기의 log-likelihood ratio를 reward로 사용하며, Discriminator의 supervised update를 하나 더 결합한다.

구현은 몇 줄의 입력 결합과 reward 교체처럼 보이지만 학습 동역학은 강하게 연결되어 있다.

```text
skill-conditioned Policy
        ↕
skill별 state distribution
        ↕
Discriminator의 분류 경계
        ↕
intrinsic reward와 Critic target
```

이 연결을 이해하면 왜 label leakage가 치명적인지, 왜 reward가 non-stationary한지, 왜 전진과 후진뿐 아니라 제자리 유지와 빠른 종료가 발견되는지 설명할 수 있다. 또한 **latent label의 개수와 사람이 구별하는 semantic skill의 개수는 같지 않을 수 있다**는 한계도 코드 수준에서 이해할 수 있다.

다른 로봇에서는 Hopper 구현을 그대로 복사하기보다 `robot_obs`, `behavior_features`, `skill_horizon`, `safety_constraint`를 독립된 인터페이스로 만들어야 한다. 어떤 값이 Policy·Discriminator·Critic·실제 actuator에 전달되는지 명시해야 같은 메커니즘을 안전하게 옮길 수 있다.

## 참고 자료

- [Diversity Is All You Need: Learning Skills without a Reward Function](https://arxiv.org/abs/1802.06070)
- [akazemipour/DIAYN-PyTorch](https://github.com/akazemipour/DIAYN-PyTorch)
- [DIAYN 개념 정리: 보상 없이 다양한 스킬을 발견하는 방법](/posts/diayn-diversity-is-all-you-need/)
- [20개 Hopper skill의 5-seed 측정값](/assets/data/posts/rl/diayn-pytorch/skill-metrics-5-seeds.csv)
