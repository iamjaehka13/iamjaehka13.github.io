---
title: "[CIC 코드 읽기] 공식 구현의 Tensor와 Gradient 흐름"
date: 2026-07-20 22:42:00 +0900
categories: [RL, Study]
tags: [cic, pytorch, contrastive-learning, intrinsic-reward, ddpg, urlb, code-review]
description: "공식 rll-research/cic 구현에서 64D skill sampling, CPC tensor, k-NN intrinsic reward, gradient 경로와 DDPG update가 실제로 어떻게 연결되는지 추적한다."
math: true
image:
  path: /assets/img/posts/rl/cic-code/00-cic-code-preview.png
  alt: CIC 공식 코드의 skill sampling, CPC, k-NN reward와 DDPG update 흐름
---

[이전 글](/posts/cic-contrastive-intrinsic-control/)에서는 CIC가 왜 state transition과 skill 사이의 mutual information을 사용하고, contrastive representation과 particle entropy를 결합했는지 정리했다.

이번 글에서는 수식을 반복하지 않는다. 공식 [`rll-research/cic`](https://github.com/rll-research/cic) 구현에서 **replay batch 하나가 어떤 tensor로 바뀌고, 어떤 optimizer를 거쳐 actor까지 도달하는지**를 실행 순서대로 추적한다.

읽으면서 확인할 질문은 다음 네 가지다.

1. 64차원 skill $z$는 언제 뽑고, policy와 replay buffer에는 어떻게 들어가는가?
2. `compute_cpc_loss()`의 $B\times B$ matrix는 무엇을 positive와 negative로 보는가?
3. 실제 actor-critic reward는 CPC score인가, k-NN distance인가?
4. CPC, critic, actor의 gradient는 어디까지 흐르고 어디에서 끊기는가?

분석 기준은 공식 저장소의 마지막 공개 commit [`b523c38`](https://github.com/rll-research/cic/tree/b523c3884256346cb585bf06e52a7aadc127dcfc)이다. 이 저장소는 2022년 URLB 코드와 Python 3.8·구형 MuJoCo 환경을 기반으로 한다. 따라서 최신 PyTorch 예제로 고쳐 쓰기보다, **논문의 실제 공개 구현을 고정된 상태로 읽는 것**이 이번 글의 목적이다.

## 0. 결론부터 보는 실제 update 경로

공식 코드의 reward-free pretraining 경로는 다음과 같다.

![CIC official update flow](/assets/img/posts/rl/cic-code/01-cic-update-flow.svg){: width="1100" .d-block .mx-auto }
_한 replay batch에서 CPC representation과 DDPG policy가 갱신되는 두 경로. CPC loss는 actor에 직접 전달되지 않고, `state_net(next_obs)`의 k-NN reward가 critic을 거쳐 actor에 간접적으로 영향을 준다._

가장 중요한 결론은 한 줄로 정리할 수 있다.

> **CPC loss는 CIC encoder를 학습하고, actor-critic은 그 encoder의 next-state embedding에서 계산한 k-NN reward를 학습한다.**

즉 `contrastive loss + entropy reward`를 하나의 scalar reward로 합쳐 DDPG에 넣는 구조가 아니다. Representation learning과 policy learning은 서로 연결돼 있지만 optimizer와 gradient 경로는 분리돼 있다.

## 1. 어떤 파일부터 읽어야 하는가?

저장소 전체보다 다음 다섯 경로를 순서대로 읽는 편이 빠르다.

| 순서 | 파일 | 확인할 내용 |
|---:|---|---|
| 1 | [`pretrain.py`](https://github.com/rll-research/cic/blob/b523c3884256346cb585bf06e52a7aadc127dcfc/pretrain.py#L146-L217) | Environment loop, skill 갱신, action, replay 저장과 agent update 순서 |
| 2 | [`replay_buffer.py`](https://github.com/rll-research/cic/blob/b523c3884256346cb585bf06e52a7aadc127dcfc/replay_buffer.py#L144-L169) | $n$-step batch와 skill meta가 어떤 index로 묶이는가 |
| 3 | [`agent/cic.py`](https://github.com/rll-research/cic/blob/b523c3884256346cb585bf06e52a7aadc127dcfc/agent/cic.py#L17-L251) | CPC network, k-NN reward, CICAgent의 전체 update |
| 4 | [`agent/ddpg.py`](https://github.com/rll-research/cic/blob/b523c3884256346cb585bf06e52a7aadc127dcfc/agent/ddpg.py#L123-L314) | Skill-conditioned actor, twin critic, target Q와 optimizer |
| 5 | [`agent/cic.yaml`](https://github.com/rll-research/cic/blob/b523c3884256346cb585bf06e52a7aadc127dcfc/agent/cic.yaml) | 64D skill, 50-step horizon, batch size와 update 주기 |

상속 관계는 단순하다.

```text
DDPGAgent
  ├─ actor
  ├─ twin critic + target critic
  └─ environment interaction interface

CICAgent(DDPGAgent)
  ├─ continuous skill meta
  ├─ CIC contrastive module
  ├─ particle reward
  └─ reward-free update override
```

CIC는 새로운 actor-critic을 처음부터 구현하지 않는다. 기존 DDPG agent에 skill meta와 representation learning, intrinsic reward 생성을 추가한다.

## 2. 먼저 고정할 기호와 기본 설정

이 글에서는 tensor shape를 다음 기호로 쓴다.

| 기호 | 의미 | 기본 설정 |
|---|---|---:|
| $B$ | Replay batch size | 1024 |
| $D$ | Physical state observation 차원 | Domain마다 다름 |
| $A$ | Action 차원 | Domain마다 다름 |
| $Z$ | Continuous skill 차원 | 64 |
| $T$ | Contrastive temperature | 0.5 |
| $k$ | k-NN 이웃 수 | 16 |

주요 설정은 다음과 같다.

| 설정 | 값 | 코드에서의 의미 |
|---|---:|---|
| `obs_type` | `states` | 논문의 주 실험은 full-state observation 사용 |
| `skill_dim` | 64 | $z\in[0,1]^{64}$ |
| `update_skill_every_step` | 50 | 50 agent step마다 새 $z$ sampling |
| `batch_size` | 1024 | CPC와 DDPG가 같은 replay batch 사용 |
| `update_every_steps` | 2 | 두 environment step마다 한 번 update |
| `nstep` | 3 | Critic target에 3-step transition 사용 |
| `num_expl_steps` | Runtime 4000 | 초기에는 actor 대신 uniform random action |
| `critic_target_tau` | 0.01 | Target critic soft update 비율 |
| `num_train_frames` | 2,000,010 | Reward-free pretraining budget |

`agent/cic.yaml`에는 `num_expl_steps: 2000`이 적혀 있지만 이것이 runtime 값은 아니다. `pretrain.py::make_agent()`가 해당 값을 `num_seed_frames // action_repeat`로 덮어쓰므로 state-based 기본 설정에서는 4,000이 된다. 따라서 처음 4,000 step은 uniform random action으로 replay를 채우고, 그 구간이 끝난 뒤 agent update와 learned action이 함께 시작된다.

## 3. Skill은 50 step 동안 policy의 조건이 된다

Reward-free mode에서 [`init_meta()`](https://github.com/rll-research/cic/blob/b523c3884256346cb585bf06e52a7aadc127dcfc/agent/cic.py#L136-L148)는 각 성분을 독립적으로 uniform sampling한다.

$$
z\sim U([0,1]^{64})
$$

[`update_meta()`](https://github.com/rll-research/cic/blob/b523c3884256346cb585bf06e52a7aadc127dcfc/agent/cic.py#L150-L153)는 global step이 50의 배수일 때 새 skill을 반환한다.

```python
# simplified
if global_step % 50 == 0:
    z = sample_uniform_64d_skill()
```

그다음 `DDPGAgent.act()`는 state encoder의 출력과 skill을 이어 붙인다.

$$
o_t^{\mathrm{policy}}
=
[\,e(s_t),z_t\,]
\in\mathbb{R}^{D+64}
$$

State-based 기본 설정에서는 $e$가 `Identity`이므로 실제 입력은 $[s_t,z_t]$다. Actor는 이 입력으로 action mean을 만들고, 고정된 표준편차를 가진 truncated normal distribution에서 action을 sampling한다.

```text
physical state s_t      [D]
continuous skill z_t    [64]
                        -------- concat
actor input             [D + 64]
                        ↓
action                   [A]
```

DIAYN 구현과 달리 one-hot skill ID를 붙이는 것이 아니다. 64개의 실수로 이루어진 하나의 continuous vector를 그대로 policy condition으로 사용한다.

또한 50 step은 episode 길이가 아니다. Episode가 끝나면 `init_meta()`로 새 skill을 뽑지만, 긴 episode 안에서도 global step 기준으로 skill이 바뀐다.

## 4. Replay buffer에는 환경 reward도 저장된다

Environment loop는 대략 다음 순서로 돈다.

```text
update z → action 선택 → agent update
         → env.step(action) → time_step과 z 저장
```

Replay storage는 observation, action, environment reward, discount와 `skill` meta를 episode 단위 `.npz`로 저장한다. Sampling 시 3-step 설정을 적용해 다음 batch를 만든다.

```text
obs         [B, D]
action      [B, A]
extr_reward [B, 1]
discount    [B, 1]
next_obs    [B, D]
skill       [B, 64]
```

여기서 `extr_reward`가 존재한다는 점이 중요하다. Reward-free는 environment가 reward를 반환하지 않는다는 뜻이 아니다. **환경 reward는 저장하고 monitoring에도 사용하지만, pretraining의 critic target을 만들 때 intrinsic reward로 교체한다.**

```python
# CICAgent.update(), simplified
if reward_free:
    reward = intrinsic_reward
else:
    reward = extr_reward
```

따라서 downstream score를 기록할 수 있으면서도 policy는 그 task reward를 보지 않고 pretraining할 수 있다.

## 5. `CIC.forward()`: skill과 transition을 64차원에서 비교한다

CIC module은 네 개의 MLP를 선언한다.

| Module | 입력 | 출력 | 역할 |
|---|---:|---:|---|
| `state_net` | $[B,D]$ | $[B,64]$ | State embedding |
| `next_state_net` | $[B,D]$ | $[B,64]$ | 선언은 되지만 현재 `forward()`에서 사용되지 않음 |
| `skill_net` | $[B,64]$ | $[B,64]$ | Skill query embedding |
| `pred_net` | $[B,128]$ | $[B,64]$ | 두 state embedding을 transition key로 결합 |

실제 forward path는 다음과 같다.

$$
h_t=g_s(s_t),
\qquad
h_{t+1}=g_s(s_{t+1})
$$

$$
q_i=g_z(z_i)
$$

$$
k_i=g_{\mathrm{pred}}([h_t,h_{t+1}])
$$

즉 현재 state와 next state 모두 **같은 `state_net`**을 통과한다. 별도로 만들어진 `next_state_net`은 이 공개 commit의 forward path에서는 호출되지 않는다.

Tensor 흐름을 한 줄로 쓰면 다음과 같다.

```text
obs [B,D] ─────→ state_net ──→ h_t     [B,64] ─┐
                                                ├─ concat [B,128] → pred_net → key [B,64]
next_obs [B,D] → state_net ──→ h_t+1   [B,64] ─┘

skill [B,64] ──→ skill_net ────────────────→ query [B,64]
```

여기까지가 논문의 $(z,\tau)$ pair를 코드 tensor로 만드는 부분이다.

## 6. `compute_cpc_loss()`: $B\times B$ 비교 행렬

[`compute_cpc_loss()`](https://github.com/rll-research/cic/blob/b523c3884256346cb585bf06e52a7aadc127dcfc/agent/cic.py#L155-L169)는 query와 key를 L2 normalize한 뒤 모든 pair의 내적을 계산한다.

$$
C_{ij}
=
\frac{q_i^\top k_j}{T}
$$

Default batch에서는 다음 shape가 나온다.

```text
query       [1024, 64]
key         [1024, 64]
query @ key.T
             ↓
similarity  [1024, 1024]
```

대각선 $C_{ii}$는 같은 replay sample의 $(z_i,\tau_i)$이고, 나머지 $C_{ij}$는 batch 안의 negative pair다.

다만 공식 코드의 loss를 곧바로 표준 `cross_entropy(logits, arange(B))`와 같다고 쓰면 부정확하다. 구현은 positive score를 따로 계산하고, 전체 exponential sum에서 실제 diagonal score가 아니라 고정값 $e^{1/T}$를 뺀다.

$$
\ell_i
=
-\log
\frac{e^{C_{ii}}}
{\max\left(\sum_j e^{C_{ij}}-e^{1/T},\epsilon\right)}
$$

이는 흔히 쓰는 diagonal InfoNCE cross-entropy와 코드 수준에서 동일하지 않다. 구현을 재현하려면 이 식을 그대로 따라야 하고, 표준 InfoNCE로 교체한다면 별도의 알고리즘 변경으로 취급해야 한다.

`update_cic()`는 batch loss의 평균을 낸 뒤 `cic_optimizer`만 step한다.

```text
CPC loss.backward()
        ↓
state_net, skill_net, pred_net update
        ↓
actor, critic은 이 optimizer로 바뀌지 않음
```

## 7. 실제 intrinsic reward는 어디서 만들어지는가?

이 부분이 논문 수식과 코드를 연결할 때 가장 헷갈린다.

`CICAgent`에는 CPC loss를 reward처럼 반환하는 `compute_intr_reward()`가 존재한다. 그러나 default reward-free [`update()`](https://github.com/rll-research/cic/blob/b523c3884256346cb585bf06e52a7aadc127dcfc/agent/cic.py#L204-L249)는 이 함수를 호출하지 않는다.

실제로 실행되는 코드는 다음 호출이다.

```python
# official default path
intr_reward = compute_apt_reward(next_obs, next_obs)
```

Method 내부에서는 두 인자를 각각 `state_net`에 통과시킨다. 두 인자가 모두 `next_obs`이므로 reward particle은 다음과 같다.

$$
h_i=g_s(s'_i)
\in\mathbb{R}^{64}
$$

$$
D_{ij}=\lVert h_i-h_j\rVert_2
$$

즉 default code의 k-NN reward는 `pred_net([s,s'])`가 만든 transition key끼리의 거리가 아니라, **CPC로 함께 학습된 `state_net(next_obs)` embedding끼리의 거리**다.

Reward 계산은 다음 순서로 진행된다.

1. $[B,64]$ embedding 두 집합으로 $[B,B]$ pairwise distance를 만든다.
2. 각 row에서 가장 가까운 16개 거리를 선택한다.
3. Running statistic으로 distance scale을 normalize한다.
4. `0.0005`를 빼고 0 아래를 clipping한다.
5. 16개 값을 평균하고 $\log(1+d)$를 적용한다.

$$
r_i^{\mathrm{APT}}
=
\log\left(
1+\frac{1}{k}\sum_{j\in\mathrm{kNN}(i)}
\operatorname{clip}(\widetilde D_{ij}-c,0)
\right)
$$

Source와 target batch가 같기 때문에 각 sample의 self-distance 0도 nearest-neighbor 집합에 포함된다. $k=16$에서는 자기 자신과 나머지 가까운 15개 sample이 평균에 들어가는 셈이다.

Contrastive learning이 여전히 필요한 이유는 `state_net`이 CPC loss로 갱신되기 때문이다.

```text
z와 (s, s')의 CPC 학습
        ↓
state_net의 geometry 변화
        ↓
next-state k-NN distance 변화
        ↓
intrinsic reward 변화
```

따라서 CPC는 actor에게 직접 reward를 주지 않지만, actor가 받는 novelty의 좌표계를 간접적으로 만든다.

## 8. `CICAgent.update()`의 gradient를 끝까지 추적하기

한 replay batch의 update 순서는 다음과 같다.

```text
1. batch sampling
2. obs, next_obs encode
3. update_cic()       → CIC representation update
4. compute_apt_reward → detached intrinsic reward
5. concat(obs, skill)
6. update_critic()
7. update_actor()
8. soft update target critic
```

각 loss가 실제로 바꾸는 parameter를 분리하면 다음과 같다.

| 학습 신호 | 직접 갱신되는 parameter | 직접 갱신되지 않는 parameter |
|---|---|---|
| CPC loss | `state_net`, `skill_net`, `pred_net` | Actor, critic |
| Critic MSE | Twin critic | CIC module, actor |
| Actor loss $-Q$ | Actor | CIC module, target critic |
| Soft update | Target critic | Actor, CIC module |

`compute_apt_reward()`에는 `@torch.no_grad()`가 붙어 있다. 그러므로 critic loss가 reward 계산을 거슬러 `state_net`까지 역전파되지는 않는다.

$$
L_{\mathrm{CPC}}
\rightarrow
g_s,g_z,g_{\mathrm{pred}}
$$

$$
r_{\mathrm{kNN}}
\rightarrow
Q
\rightarrow
\pi
$$

Actor가 CPC loss를 직접 미분하지 않는다는 뜻이지, CPC가 policy와 무관하다는 뜻은 아니다. CPC가 embedding을 바꾸고, 그 embedding이 reward를 바꾸며, critic이 그 reward의 장기 return을 학습한다.

## 9. DDPG update는 SAC와 무엇이 다른가?

DIAYN과 DADS 글에서는 SAC가 중심이었다. CIC 공식 구현은 URLB의 공통 backbone인 DDPG 계열 agent를 사용한다.

Critic target은 다음 형태다.

$$
y_t
=
r_t^{\mathrm{kNN}}
+
\gamma_t
\min_{m\in\{1,2\}}
Q_{\bar\phi,m}(s'_{t},z_t,a'_{t})
$$

$$
a'_t\sim\pi_\theta(\cdot\mid s'_t,z_t)
$$

Twin critic은 각각 $y_t$와의 MSE를 줄인다.

$$
L_Q
=
\lVert Q_{\phi,1}-y_t\rVert^2
+
\lVert Q_{\phi,2}-y_t\rVert^2
$$

Actor는 sampled action의 minimum Q를 높인다.

$$
L_\pi
=
-\mathbb{E}
\left[
\min(Q_{\phi,1},Q_{\phi,2})
\right]
$$

SAC와 비교하면 다음 차이가 보인다.

| 항목 | SAC | 이 CIC 구현의 DDPG |
|---|---|---|
| Replay buffer | Off-policy | Off-policy |
| Critic | 보통 twin Q | Twin Q |
| Policy | Stochastic | Truncated normal noise를 사용하는 actor |
| Actor objective | $Q-\alpha\log\pi$ | $Q$만 최대화 |
| Target | Entropy term 포함 | Entropy term 없음 |
| 탐색 제어 | Learned/fixed temperature $\alpha$ | `stddev_schedule`과 초기 random action |

코드에서 `log_prob`과 entropy를 계산하지만 logging에만 사용한다. `actor_loss`에는 들어가지 않는다. 따라서 stochastic action을 쓴다는 이유만으로 SAC라고 부르면 안 된다.

## 10. Pretraining 이후에는 무엇이 재사용되는가?

Fine-tuning에서는 `reward_free=false`가 되어 environment reward를 그대로 critic에 넣는다.

```text
reward-free pretraining
  CPC representation + k-NN reward + DDPG
                  ↓
load pretrained actor/encoder
                  ↓
task fine-tuning
  extrinsic reward + DDPG
```

[`DDPGAgent.init_from()`](https://github.com/rll-research/cic/blob/b523c3884256346cb585bf06e52a7aadc127dcfc/agent/ddpg.py#L185-L190)은 pretrained encoder와 actor를 복사하고, 설정에 따라 critic trunk도 복사한다. Fine-tuning 중에는 `CICAgent.update()`가 `extr_reward`를 선택하므로 CPC와 particle reward는 사용하지 않는다.

한편 reward-free가 아닐 때 `CICAgent.init_meta()`는 모든 성분이 0.5인 skill을 기본값으로 반환한다.

$$
z=(0.5,0.5,\ldots,0.5)
$$

주석에는 paper의 CEM 또는 grid sweep으로 skill을 자동 선택할 수 있다고 적혀 있지만, 공개된 `finetune.py` 안에는 논문의 4K-step grid sweep 전체가 구현되어 있지 않다. 따라서 paper protocol을 재현하려면 후보 $z$ 평가와 best-skill 선택 절차를 별도로 추가해야 한다.

## 11. 공식 코드를 재사용하기 전에 확인할 부분

공식 구현은 논문 메커니즘을 이해하는 데 충분하지만, 그대로 장기 학습을 돌리기 전에는 다음 항목을 확인해야 한다.

### 11.1 선언됐지만 실행 경로에 없는 코드

- `next_state_net`은 생성되지만 `CIC.forward()`가 두 state에 모두 `state_net`을 사용하므로 gradient를 받지 않는다.
- `compute_intr_reward()`는 CPC loss 기반 reward를 만들지만 default `update()`에서 호출되지 않는다.
- `rew_type`은 저장만 되고 reward branch를 바꾸지 않는다.
- `scale`은 사용되지 않는 `compute_intr_reward()` 경로에만 적용된다.

이 변수들을 보고 여러 reward variant가 자동으로 선택된다고 생각하면 실제 실행 경로를 잘못 읽게 된다.

### 11.2 Logging을 켜면 발생하는 변수명 문제

Reward-free branch는 `intr_reward`를 계산하지만 metric 기록에서는 정의되지 않은 `apt_reward`를 참조한다. 기본 설정은 TensorBoard와 W&B가 모두 꺼져 있어 지나가지만, 둘 중 하나를 켜면 해당 branch에서 `NameError`가 날 수 있다.

수정 의도는 다음처럼 명확하다.

```python
# current intent
metrics["intr_reward"] = intr_reward.mean().item()
```

### 11.3 CPC denominator는 표준 cross-entropy가 아니다

앞에서 본 것처럼 denominator에서 실제 positive diagonal이 아니라 $e^{1/T}$를 뺀다. 이를 `F.cross_entropy()`로 바꾸면 더 익숙해 보이지만 동일한 loss가 아니다. 원 결과 재현과 구현 개선을 같은 commit에서 섞지 않는 편이 안전하다.

### 11.4 Skill boundary의 replay 정렬은 runtime trace가 필요하다

정적 코드 추적상 environment loop는 새 `meta`로 action을 만든 뒤, 결과 `time_step`과 함께 그 `meta`를 저장한다. 반면 replay sampler는 action을 `idx`에서 읽고 skill meta를 `idx-1`에서 읽는다. 따라서 정확히 50-step skill switch가 일어나는 transition에서는 새 action과 이전 skill이 한 step 어긋날 가능성이 있다.

또한 3-step sample이 skill boundary를 가로지르면 next observation은 새 skill에서 만들어졌지만 critic에는 시작 skill이 계속 붙는다. 이것이 의도한 option boundary 처리인지 확인하려면 다음 값을 동일한 transition ID로 logging해야 한다.

```text
global_step
action_skill
stored_skill
sampled_skill
obs index / action index / next_obs index
```

이 항목은 정적 분석에서 발견한 가능성이므로, 실제 학습 trace 없이 확정된 runtime bug라고 단정하지 않는다.

### 11.5 최소 smoke test

2M-step 학습 전에 다음 검증부터 하는 편이 안전하다.

1. $B=8$ batch에서 `query`, `key`, `cov`, `reward` shape를 assert한다.
2. `update_cic()` 후 actor·critic parameter가 변하지 않는지 확인한다.
3. `compute_apt_reward()`가 finite한 $[B,1]$을 반환하는지 확인한다.
4. TensorBoard를 켠 10-step run으로 metric branch를 검사한다.
5. 48~52 step의 skill ID를 출력해 replay boundary 정렬을 확인한다.
6. CPC loss와 k-NN reward histogram을 따로 기록한다.

## 12. 최종 정리

공식 코드를 한 replay batch 기준으로 다시 연결하면 다음과 같다.

1. 64D continuous skill을 뽑아 50 step 동안 policy input에 붙인다.
2. Replay buffer는 state, action, environment reward, discount와 skill을 저장한다.
3. `compute_cpc_loss()`는 skill query와 transition key의 $B\times B$ similarity를 만든다.
4. `update_cic()`는 CPC module만 갱신한다.
5. Default intrinsic reward는 `state_net(next_obs)`의 k-NN distance에서 계산된다.
6. Reward는 gradient가 끊긴 scalar로 critic target에 들어간다.
7. Twin critic이 장기 intrinsic return을 학습하고 actor는 $Q$를 최대화한다.
8. Fine-tuning에서는 intrinsic reward 대신 environment reward를 사용한다.

한 문장으로 압축하면 다음과 같다.

> **CIC 공식 구현은 contrastive loss로 novelty를 측정할 state representation을 학습하고, 그 representation의 k-NN reward를 DDPG가 최대화하는 두 단계 구조다.**

이 글에서 가장 중요한 코드상의 발견은 `CPC loss가 actor reward가 아니다`라는 사실만이 아니다. Default k-NN reward가 transition key 자체가 아니라 `state_net(next_obs)`에서 계산된다는 점, 그리고 public fine-tuning code에는 paper의 skill search 전체가 들어 있지 않다는 점까지 구분해야 논문과 구현을 정확히 연결할 수 있다.

## 참고 자료

- [Laskin et al., Contrastive Intrinsic Control for Unsupervised Skill Discovery](https://arxiv.org/abs/2202.00161)
- [rll-research/cic official repository](https://github.com/rll-research/cic)
- [분석에 사용한 commit `b523c38`](https://github.com/rll-research/cic/tree/b523c3884256346cb585bf06e52a7aadc127dcfc)
- [CIC 논문 정리](/posts/cic-contrastive-intrinsic-control/)
- [DIAYN 코드 읽기](/posts/diayn-pytorch-code-walkthrough/)
