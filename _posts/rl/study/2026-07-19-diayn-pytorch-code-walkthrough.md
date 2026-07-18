---
title: "[DIAYN 실습] PyTorch 코드로 따라가는 Hopper 스킬 학습"
date: 2026-07-19 04:05:00 +0900
categories: [RL, Study]
tags: [diayn, pytorch, soft-actor-critic, mujoco, hopper, skill-discovery]
description: "DIAYN-PyTorch의 episode loop와 agent update를 따라가며 latent skill, discriminator intrinsic reward, SAC 학습이 실제 코드에서 연결되는 과정을 살펴본다."
math: true
image:
  path: /assets/img/posts/rl/diayn-pytorch/00-diayn-pytorch-preview.jpg
  alt: DIAYN-PyTorch의 서로 다른 Hopper 스킬 실행 장면
---

[이전 글](/posts/diayn-diversity-is-all-you-need/)에서는 DIAYN의 mutual information 목적함수와 intrinsic reward가 왜 필요한지 살펴봤습니다. 이번 글에서는 같은 내용을 다시 유도하지 않고, 실제 [DIAYN-PyTorch 저장소](https://github.com/akazemipour/DIAYN-PyTorch)의 코드가 한 episode를 어떻게 실행하고 한 번의 gradient update를 어떻게 만드는지 순서대로 따라갑니다.

이 구현을 한 문장으로 정리하면 다음과 같습니다.

> 하나의 SAC policy가 categorical skill $z$를 조건으로 행동하고, discriminator가 물리 상태만 보고 $z$를 맞힌 확률로 intrinsic reward를 만든다.

실습에는 저장소가 제공하는 **Hopper 사전학습 checkpoint**를 사용했습니다. 뒤에서 보는 영상은 짧은 테스트 학습으로 새로 얻은 결과가 아니라, 저장소의 기존 checkpoint를 현재 환경에서 다시 실행한 결과입니다.

## **0. 먼저 전체 loop 보기**

논문의 알고리즘은 skill을 뽑고, policy로 환경을 움직이고, discriminator reward로 policy와 discriminator를 함께 개선하는 구조입니다.

![DIAYN algorithm from the original paper](/assets/img/posts/rl/diayn/diayn-algorithm.png){: width="780" .d-block .mx-auto }
_Eysenbach et al., Figure 1의 DIAYN 학습 흐름. [원 논문](https://arxiv.org/abs/1802.06070). 아래에서는 이 흐름이 실제 코드에서 어떤 순서로 실행되는지 살펴본다._

이 저장소의 실행 흐름으로 바꾸면 다음과 같습니다.

![DIAYN episode execution flow](/assets/img/posts/rl/diayn-pytorch/01-episode-flow.svg){: .d-block .mx-auto }

코드를 읽을 때는 두 개의 반복을 구분하면 이해하기 쉽습니다.

1. `main.py`의 **episode와 environment step loop**
2. `agent.train()`의 **network update**

바깥쪽 loop가 경험을 만들고, 안쪽의 학습 함수가 replay buffer에서 경험을 꺼내 intrinsic reward와 loss를 계산합니다.

## **1. 학습 시작: skill distribution과 agent 만들기**

먼저 Hopper 환경의 state와 action 차원을 읽고, 모든 skill을 같은 확률로 선택하는 prior를 만듭니다.

```python
test_env = gym.make(params["env_name"])
n_states = test_env.observation_space.shape[0]
n_actions = test_env.action_space.shape[0]

p_z = np.full(
    params["n_skills"],
    1 / params["n_skills"],
)

agent = SACAgent(p_z=p_z, **params)
```

이번 실행에서는 Hopper state가 11차원, action이 3차원이고 skill은 20개입니다.

$$
p(z=k)=\frac{1}{20}, \qquad k\in\{0,\ldots,19\}
$$

`SACAgent`를 만들면 내부에 다음 network가 생성됩니다.

| Network | 입력 | 출력 |
|---|---|---|
| Policy | physical state 11 + skill 20 | action distribution 3 |
| Q network 1, 2 | state-skill 31 + action 3 | Q-value |
| Value network | state-skill 31 | state value |
| Discriminator | physical state 11 | 20개 skill logits |

이 저장소는 별도의 Value network를 사용하는 초기 SAC 구조입니다. 최근 SAC 구현에서 흔히 보는 twin Q와 target Q만의 구성과는 network 배치가 조금 다릅니다.

## **2. Episode 시작: $z$를 한 번 뽑고 고정한다**

학습은 `main.py`의 episode loop에서 시작합니다.

```python
for episode in range(1 + min_episode, max_n_episodes + 1):
    z = np.random.choice(n_skills, p=p_z)

    state = env.reset()
    state = concat_state_latent(state, z, n_skills)
```

여기서 `z`는 episode 시작 시 한 번만 뽑습니다. 한 episode 안에서 매 step마다 다른 skill을 선택하지 않습니다. 그래야 하나의 $z$가 일관된 state distribution을 만들 수 있습니다.

처음 선택된 `z`에는 사람이 정한 의미가 없습니다.

```text
z = 0  → 아직 의미 없음
z = 1  → 아직 의미 없음
...
z = 19 → 아직 의미 없음
```

`concat_state_latent()`는 정수 skill ID를 one-hot vector로 바꾼 뒤 Hopper state 뒤에 붙입니다.

```python
def concat_state_latent(s, z_, n):
    z_one_hot = np.zeros(n)
    z_one_hot[z_] = 1
    return np.concatenate([s, z_one_hot])
```

따라서 policy가 받는 입력은 31차원이 됩니다.

```text
Hopper physical state  11
skill one-hot          20
-------------------------
policy input           31
```

하지만 모든 network가 이 31차원을 그대로 보는 것은 아닙니다.

![Policy and discriminator tensor routing](/assets/img/posts/rl/diayn-pytorch/02-tensor-routing.svg){: .d-block .mx-auto }

Policy와 Q, Value network는 어떤 skill을 실행 중인지 알아야 하므로 `state + z`를 받습니다. 반대로 discriminator는 물리 상태만 보고 어떤 skill인지 추측해야 합니다. 정답인 `z`가 discriminator 입력에 포함되면 robot이 서로 다른 움직임을 만들지 않아도 분류가 가능해지는 label leakage가 발생합니다.

## **3. 한 environment step에서 일어나는 일**

안쪽 step loop의 핵심은 다섯 줄입니다.

```python
action = agent.choose_action(state)

next_state, reward, done, _ = env.step(action)

next_state = concat_state_latent(next_state, z, n_skills)
agent.store(state, z, done, action, next_state)
logq_zs = agent.train()
```

실행 순서대로 풀면 다음과 같습니다.

```text
현재 physical state와 z
→ Policy가 action sampling
→ Hopper가 한 step 이동
→ next physical state 관측
→ 같은 z를 next state에도 결합
→ replay buffer에 transition 저장
→ network update 시도
```

### **3.1 Policy는 deterministic action이 아니라 sample을 출력한다**

`choose_action()`은 state를 tensor로 바꾼 뒤 `PolicyNetwork.sample_or_likelihood()`를 호출합니다.

```python
def choose_action(self, states):
    states = np.expand_dims(states, axis=0)
    states = from_numpy(states).float().to(self.device)

    action, _ = self.policy_network.sample_or_likelihood(states)
    return action.detach().cpu().numpy()[0]
```

Policy network는 action의 평균과 표준편차를 만들고, reparameterization trick으로 Gaussian sample을 뽑은 뒤 `tanh`를 적용합니다.

```python
dist = Normal(mu, std)
u = dist.rsample()
action = torch.tanh(u)
```

같은 state와 같은 skill이어도 매번 완전히 같은 action이 나오는 것은 아닙니다. SAC의 entropy가 각 skill 내부의 탐색을 유지하는 부분이 코드에서는 이 sampling으로 나타납니다.

### **3.2 Gym reward는 받지만 replay buffer에는 저장하지 않는다**

`env.step()`은 원래 Hopper task reward를 반환합니다.

```python
next_state, reward, done, _ = env.step(action)
episode_reward += reward
```

하지만 `agent.store()`의 인자를 보면 `reward`가 없습니다.

```python
def store(self, state, z, done, action, next_state):
    self.memory.add(state, z, done, action, next_state)
```

일반적인 off-policy RL transition과 비교하면 차이가 분명합니다.

```text
일반 SAC
(state, action, task reward, next_state, done)

이 DIAYN 구현
(state+z, z, done, action, next_state+z)
```

Gym reward는 episode 결과를 logging하는 데만 사용합니다. Q network가 실제로 학습할 reward는 잠시 뒤 discriminator 출력으로 다시 계산합니다.

## **4. Replay buffer에서 batch 꺼내기**

`agent.train()`은 경험이 batch size보다 적을 때는 아무것도 업데이트하지 않습니다.

```python
def train(self):
    if len(self.memory) < self.batch_size:
        return None

    batch = self.memory.sample(self.batch_size)
    states, zs, dones, actions, next_states = self.unpack(batch)
```

기본 batch size는 256이므로, 최소 256개의 transition이 쌓인 뒤부터 environment step마다 한 번씩 update를 시도합니다.

`states`와 `next_states`에는 이미 one-hot `z`가 붙어 있습니다. 별도의 `zs`는 discriminator가 맞혀야 할 class label로 사용합니다.

## **5. 핵심: Discriminator가 reward를 만든다**

intrinsic reward가 만들어지는 코드는 `Brain/agent.py`의 다음 부분입니다.

```python
physical_next_states = torch.split(
    next_states,
    [self.n_states, self.n_skills],
    dim=-1,
)[0]

logits = self.discriminator(physical_next_states)
p_z = p_z.gather(-1, zs)
logq_z_ns = log_softmax(logits, dim=-1)

rewards = (
    logq_z_ns.gather(-1, zs).detach()
    - torch.log(p_z + 1e-6)
)
```

한 줄씩 의미를 연결하면 다음과 같습니다.

1. `next_states`에서 뒤쪽의 one-hot `z` 20차원을 제거합니다.
2. physical state 11차원만 discriminator에 넣습니다.
3. 20개 skill에 대한 logits를 `log_softmax`로 log probability로 바꿉니다.
4. 실제 실행한 `z`의 값만 `gather()`로 선택합니다.
5. fixed prior의 $\log p(z)$를 뺍니다.

결과는 이전 글에서 본 식과 같습니다.

$$
r_{\text{DIAYN}}(s',z)
=
\log q_\phi(z\mid s')-\log p(z)
$$

discriminator가 next state만 보고 실제 `z`를 높은 확률로 맞힐수록 reward가 커집니다. 그러면 policy는 자신에게 주어진 `z`가 다른 skill과 구별되는 물리 상태를 만들도록 학습됩니다.

### **5.1 왜 `detach()`가 필요한가?**

```python
logq_z_ns.gather(-1, zs).detach()
```

Discriminator 출력은 SAC가 사용할 reward를 만들지만, Q loss나 policy loss가 discriminator parameter까지 직접 변경해서는 안 됩니다. `detach()`는 intrinsic reward를 RL update 관점에서 상수로 취급하게 합니다.

Discriminator는 뒤에서 자신의 classification loss로 따로 학습합니다.

## **6. 하나의 batch에서 SAC와 Discriminator가 함께 개선된다**

![DIAYN network update flow](/assets/img/posts/rl/diayn-pytorch/03-update-flow.svg){: .d-block .mx-auto }

먼저 policy가 현재 state에서 새 action과 log probability를 만듭니다.

```python
reparam_actions, log_probs = self.policy_network.sample_or_likelihood(states)

q1 = self.q_value_network1(states, reparam_actions)
q2 = self.q_value_network2(states, reparam_actions)
q = torch.min(q1, q2)
```

두 Q 중 작은 값을 사용해 과대평가를 줄이고, entropy 항이 포함된 Value target을 만듭니다.

```python
target_value = (
    q.detach()
    - self.config["alpha"] * log_probs.detach()
)

value = self.value_network(states)
value_loss = self.mse_loss(value, target_value)
```

앞에서 만든 DIAYN reward는 Q target으로 들어갑니다.

```python
target_q = (
    self.config["reward_scale"] * rewards.float()
    + self.config["gamma"]
    * self.value_target_network(next_states)
    * (~dones)
)
```

종료된 transition이면 다음 state value를 더하지 않습니다. 그다음 replay buffer에 저장된 action에 대한 두 Q loss를 계산합니다.

```python
q1 = self.q_value_network1(states, actions)
q2 = self.q_value_network2(states, actions)

q1_loss = self.mse_loss(q1, target_q)
q2_loss = self.mse_loss(q2, target_q)
```

Policy는 높은 Q-value와 높은 entropy를 함께 선호합니다.

```python
policy_loss = (
    self.config["alpha"] * log_probs - q
).mean()
```

마지막으로 discriminator는 현재 physical state에서 skill class를 맞히도록 Cross Entropy로 학습합니다.

```python
physical_states = torch.split(
    states,
    [self.n_states, self.n_skills],
    dim=-1,
)[0]

logits = self.discriminator(physical_states)
discriminator_loss = self.cross_ent_loss(
    logits,
    zs.squeeze(-1),
)
```

각 loss가 개선하려는 대상은 다음과 같습니다.

| Loss | 학습되는 내용 |
|---|---|
| `policy_loss` | intrinsic return이 크면서 entropy가 높은 action |
| `value_loss` | 현재 state-skill의 soft value |
| `q1_loss`, `q2_loss` | action의 장기 intrinsic return |
| `discriminator_loss` | physical state에서 실행한 skill 분류 |

Update가 끝나면 Value network를 target network에 조금씩 반영합니다.

```python
target_param.data.copy_(
    tau * local_param.data
    + (1 - tau) * target_param.data
)
```

정리하면 discriminator는 policy가 만든 state를 더 잘 분류하도록 학습되고, policy는 discriminator가 더 쉽게 분류할 state를 만들도록 학습됩니다. 두 network가 같은 목표를 서로 다른 loss로 밀어주는 구조입니다.

## **7. Hopper에서 discriminator가 실제로 보는 상태**

Hopper-v3의 observation은 다음처럼 만들어집니다.

```python
def _get_obs(self):
    return np.concatenate([
        self.sim.data.qpos.flat[1:],
        np.clip(self.sim.data.qvel.flat, -10, 10),
    ])
```

`qpos[0]`인 전역 x 위치는 observation에서 빠집니다. 대신 높이와 자세, 관절 위치, 전진 속도를 포함한 generalized velocity가 들어갑니다.

따라서 discriminator는 단순히 "멀리 이동했으니 다른 skill"이라고 분류할 수 없습니다. 절대 위치 대신 다음과 같은 차이를 사용해야 합니다.

- 양수 또는 음수 방향의 속도
- 몸통과 관절의 자세
- 균형을 유지할 때의 미세한 움직임
- 빠르게 넘어지는 상태
- hopping 과정의 속도 패턴

사람 눈에는 비슷하게 서 있는 두 skill도 내부 관절 속도가 다를 수 있습니다. 반대로 실제 state distribution까지 거의 같다면 두 label은 충분히 분리되지 않은 것입니다. 영상만으로 두 경우를 완전히 구분할 수는 없습니다.

## **8. 학습된 skill 재생하기**

학습 모드가 아니면 checkpoint를 불러오고 skill을 0부터 19까지 하나씩 실행합니다.

```python
logger.load_weights()

player = Play(
    env,
    agent,
    n_skills=params["n_skills"],
)

player.evaluate()
```

평가 loop도 학습 때와 마찬가지로 physical state에 고정된 one-hot `z`를 붙여 policy에 넣습니다.

```text
z = 0 고정 → 한 episode
z = 1 고정 → 한 episode
...
z = 19 고정 → 한 episode
```

주의할 점은 policy를 `eval()` 모드로 바꿔도 이 구현은 Gaussian의 평균 action만 쓰지 않고 계속 action을 sample한다는 것입니다. 따라서 같은 skill을 다시 실행하면 세부 trajectory와 종료 시점은 달라질 수 있습니다.

## **9. 20개 skill에서 관찰한 차이**

영상 한 번만 보고 skill의 성격을 단정하지 않기 위해, 각 skill을 서로 다른 seed로 5회씩 실행해 전역 x 변위와 생존 step을 확인했습니다. x 변위는 discriminator 입력이 아니라 분석을 위해 simulator에서 별도로 읽었습니다.

| Skill | 평균 x 변위 | 표준편차 | 평균 step | 관찰 |
|---:|---:|---:|---:|---|
| 0 | +0.254 | 0.024 | 1000.0 | 거의 제자리에서 episode 유지 |
| 3 | +0.115 | 0.002 | 27.4 | 매우 빠르게 종료 |
| 6 | -0.021 | 0.014 | 1000.0 | 거의 이동하지 않고 유지 |
| 8 | +5.597 | 2.597 | 825.2 | 강한 양의 x 이동, 일부 rollout은 조기 종료 |
| 9 | -3.333 | 1.117 | 862.6 | 뚜렷한 음의 x 이동 |
| 17 | +2.910 | 1.039 | 1000.0 | 양의 x 이동을 끝까지 유지 |
| 19 | -1.179 | 0.915 | 685.8 | 음의 x 이동 경향과 큰 변동 |

각 rollout에는 `10000 + skill × 100 + rollout index`로 seed를 지정했습니다. [20개 skill 전체 측정값 CSV](/assets/data/posts/rl/diayn-pytorch/skill-metrics-5-seeds.csv)도 함께 남겼습니다.

이 결과만 봐도 skill이 단순히 20개의 완전히 다른 의미로 깔끔하게 분리되지는 않습니다.

- Skill 0, 5, 6, 10, 14, 16은 긴 episode를 유지하면서 수평 이동이 작았습니다.
- Skill 7, 8, 17, 18은 평균적으로 양의 x 방향 이동이 컸습니다.
- Skill 9와 19는 음의 x 방향 이동을 보였습니다.
- Skill 3, 12, 13은 평균 생존 길이가 짧았습니다.

여기서 "서 있기", "앞으로 가기", "뒤로 가기"는 사람이 결과를 보고 붙인 설명입니다. 학습 중에 그런 이름이나 task reward를 제공한 것은 아닙니다.

## **10. 대표 skill GIF**

아래 GIF는 제공된 checkpoint에서 각 `z`를 고정해 실행한 한 번의 sampled rollout 중 앞부분을 반복한 것입니다. 정량 표는 별도의 5회 평가 평균이므로 GIF 한 개의 정확한 변위와 일치할 필요는 없습니다.

<div class="row g-4">
  <div class="col-md-6">
    <p><strong>Skill 0 — 거의 제자리에서 자세 유지</strong></p>
    <img src="/assets/img/posts/rl/diayn-pytorch/gifs/skill0.gif" alt="Skill 0: 거의 제자리에서 자세를 유지하는 Hopper" decoding="async" style="width: 100%; border-radius: 8px;">
  </div>
  <div class="col-md-6">
    <p><strong>Skill 3 — 빠른 termination</strong></p>
    <img src="/assets/img/posts/rl/diayn-pytorch/gifs/skill3.gif" alt="Skill 3: 빠르게 termination되는 Hopper" decoding="async" style="width: 100%; border-radius: 8px;">
  </div>
</div>

<div class="row g-4 mt-1">
  <div class="col-md-6">
    <p><strong>Skill 8 — 양의 x 방향 이동 경향</strong></p>
    <img src="/assets/img/posts/rl/diayn-pytorch/gifs/skill8.gif" alt="Skill 8: 양의 x 방향으로 이동하는 Hopper" decoding="async" style="width: 100%; border-radius: 8px;">
  </div>
  <div class="col-md-6">
    <p><strong>Skill 9 — 음의 x 방향 이동 경향</strong></p>
    <img src="/assets/img/posts/rl/diayn-pytorch/gifs/skill9.gif" alt="Skill 9: 음의 x 방향으로 이동하는 Hopper" decoding="async" style="width: 100%; border-radius: 8px;">
  </div>
</div>

<div class="row g-4 mt-1">
  <div class="col-md-6">
    <p><strong>Skill 17 — 긴 episode의 양의 x 이동</strong></p>
    <img src="/assets/img/posts/rl/diayn-pytorch/gifs/skill17.gif" alt="Skill 17: 긴 episode 동안 양의 x 방향으로 이동하는 Hopper" decoding="async" style="width: 100%; border-radius: 8px;">
  </div>
  <div class="col-md-6">
    <p><strong>Skill 19 — 변동이 큰 음의 x 이동</strong></p>
    <img src="/assets/img/posts/rl/diayn-pytorch/gifs/skill19.gif" alt="Skill 19: 변동이 크지만 음의 x 방향으로 이동하는 Hopper" decoding="async" style="width: 100%; border-radius: 8px;">
  </div>
</div>

## **11. 코드로 확인한 핵심**

이 저장소를 실행 순서대로 읽으면 DIAYN의 수식이 실제 학습으로 바뀌는 지점이 분명해집니다.

```text
Uniform p(z)
→ 모든 skill에 같은 episode sampling 기회

state + one_hot(z)
→ 하나의 policy가 여러 behavior mode 표현

Discriminator(physical state)
→ label leakage 없이 실행한 skill 추측

log q(z|s′) - log p(z)
→ replay batch에서 intrinsic reward 생성

SAC update + Discriminator update
→ 구별되는 state를 만드는 policy와 이를 구분하는 classifier가 함께 개선
```

가장 흥미로운 부분은 결과의 이름을 사람이 나중에 붙인다는 점입니다. 어떤 skill은 이동하고, 어떤 skill은 제자리에서 균형을 유지하며, 어떤 skill은 거의 비슷해 보이고, 어떤 skill은 빠르게 넘어집니다.

DIAYN이 직접 최적화한 것은 "유용한 행동 20개"가 아니라 **state만 보고 skill ID를 구별할 수 있는가**입니다. 코드의 discriminator input, intrinsic reward, policy sampling을 연결해 보면 왜 발견된 skill에 의미 있는 이동과 중복처럼 보이는 행동이 함께 포함되는지 이해할 수 있습니다.

## **참고 자료**

- [Diversity Is All You Need: Learning Skills without a Reward Function](https://arxiv.org/abs/1802.06070)
- [akazemipour/DIAYN-PyTorch](https://github.com/akazemipour/DIAYN-PyTorch)
- [DIAYN 개념 정리: 보상 없이 다양한 스킬을 발견하는 방법](/posts/diayn-diversity-is-all-you-need/)
