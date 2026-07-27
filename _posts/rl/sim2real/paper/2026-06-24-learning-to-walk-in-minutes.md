---
title: "[Sim2Real Paper 8] Learning to Walk in Minutes: 4096개 로봇으로 PPO를 다시 설계하기"
date: 2026-01-18 17:36:00 +0900
last_modified_at: 2026-01-18 17:36:00 +0900
categories: [RL, Sim2Real, Paper]
tags: [sim2real, isaac-gym, legged-gym, massively-parallel-rl, quadruped-locomotion, ppo, terrain-curriculum, anymal, gpu-simulation]
description: Rudin et al.의 Learning to Walk in Minutes를 end-to-end GPU pipeline, PPO batch와 rollout horizon, timeout bootstrapping, game-inspired terrain curriculum, reward와 Sim2Real 구성, 실제 ANYmal 배포 및 공개 코드 차이까지 원문 기준으로 분석한다.
math: true
image:
  path: /assets/img/posts/rl/sim2real/walk-minutes/00-preview.png
  alt: Isaac Gym의 거대한 terrain에서 동시에 학습하는 수천 대의 ANYmal
---

## **0. 제목의 “몇 분”은 정확히 무엇을 뜻하는가**

이전 글: [RMA: recent history로 environment latent를 추정하는 online adaptation](/posts/rma-rapid-motor-adaptation/)

Rudin et al.의 **Learning to Walk in Minutes Using Massively Parallel Deep Reinforcement Learning**은 제목만 보면 “GPU를 많이 쓰면 강화학습이 빨라진다”는 논문처럼 보인다. 실제 contribution은 simulator 속도보다 넓다.

> 4096개 robot이 동시에 만드는 대규모 on-policy batch를 PPO가 제대로 사용할 수 있도록 rollout horizon, mini-batch, timeout, terrain curriculum과 simulation layout을 함께 다시 설계한 논문이다.

제목의 `minutes`가 가리키는 wall-clock time은 아래와 같다.

| Task | Training time |
|---|---:|
| Flat-terrain locomotion | 4분 미만 |
| Perceptive rough-terrain locomotion | 20분 미만 |

Rough-terrain policy는:

- 4096 parallel robots
- Robot당 24 consecutive steps
- Batch size 98,304
- 1,500 PPO updates
- 약 147 million transitions
- Intel i9-11900K + NVIDIA RTX A6000

설정으로 학습되었다.

따라서 “20분”은 robot 한 대가 20분 동안 걸어서 배운다는 뜻이 아니다.

$$
4096\;\text{robots}
\times24\;\text{steps/update}
\times1500\;\text{updates}
=147{,}456{,}000\;\text{transitions}
$$

거대한 simulation experience를 한 GPU에서 20분 이내의 wall-clock time으로 처리했다는 뜻.

![수천 개 ANYmal을 병렬로 학습하는 Isaac Gym terrain](/assets/img/posts/rl/sim2real/walk-minutes/00-preview.png){: width="1250" .d-block .mx-auto }
_하나의 GPU simulation 안에서 수천 개 ANYmal이 서로 다른 terrain과 level을 동시에 경험한다. 빠른 학습은 robot 하나의 trajectory를 가속한 결과가 아니라 대규모 parallel rollout의 결과다. 출처: [Rudin et al., Figure 1](https://proceedings.mlr.press/v164/rudin22a/rudin22a.pdf)._

이 논문을 제대로 읽으려면 다음 네 질문에 답해야 한다.

1. 왜 environment 수를 무작정 늘리면 오히려 PPO 성능이 떨어지는가?
2. 24-step rollout과 20초 episode는 어떻게 동시에 가능한가?
3. Time-limit reset을 true terminal처럼 처리하면 왜 critic이 망가지는가?
4. 수천 개 robot의 curriculum을 terrain 재생성 없이 어떻게 갱신하는가?

---

## **1. 논문 정보**

| 항목 | 내용 |
|---|---|
| Title | Learning to Walk in Minutes Using Massively Parallel Deep Reinforcement Learning |
| Authors | Nikita Rudin, David Hoeller, Philipp Reist, Marco Hutter |
| Venue | 5th Conference on Robot Learning, CoRL 2021 |
| Proceedings | PMLR 164:91-100, 2022 |
| Main robot | ANYbotics ANYmal C |
| Additional simulation | ANYmal B, arm을 단 ANYmal C, Unitree A1, Cassie |
| Simulator | NVIDIA Isaac Gym, GPU PhysX |
| RL algorithm | Custom GPU PPO |
| Rough policy | 4096 envs, 98,304 batch, 1,500 updates |
| Control | 50 Hz policy, desired joint positions |
| Terrain input | Base 주변 sampled height measurements |
| Main result | Flat <4 min, rough terrain <20 min |
| Real deployment | Fixed rough-terrain policy를 실제 ANYmal C에 배포 |
| Source | [PMLR](https://proceedings.mlr.press/v164/rudin22a.html), [arXiv](https://arxiv.org/abs/2109.11978), [Project](https://leggedrobotics.github.io/legged_gym/), [Official code](https://github.com/leggedrobotics/legged_gym) |

논문의 목적은 당시 가능한 최고 robustness를 달성하는 것이 아니었다.

저자들은 결론에서 목표를 명확히 제한한다.

> 복잡한 실제 robotics task도 분 단위로 학습할 수 있으며, 그렇게 얻은 policy가 실제 hardware에서 사용할 수 있음을 보이는 것.

이 claim boundary가 중요하다.

- 최고 성능의 perceptive locomotion architecture를 제안한 논문은 아님
- 모든 Sim2Real gap을 없앤 논문도 아님
- GPU throughput만 측정한 benchmark도 아님
- 빠른 policy를 실제 ANYmal에 배포해 end-to-end 유효성을 확인한 논문

---

## **2. 기존 CPU 중심 RL Pipeline의 병목**

### **2.1 PPO update만 GPU에 있어서는 충분하지 않다**

일반적인 robot RL loop는 policy inference, physics·contact simulation, reward·observation calculation, reset, rollout storage와 PPO update를 반복한다.

Neural network update는 GPU에서 병렬화하기 쉽다.

하지만 physics, reward와 observation이 CPU에 있으면 매 step 또는 update마다 data가 CPU와 GPU 사이를 오간다.

| 위치 | 매 control step의 작업 |
|---|---|
| CPU | Physics, reward와 observation |
| CPU $\rightarrow$ GPU | Observation을 PCIe로 복사 |
| GPU | Policy inference |
| GPU $\rightarrow$ CPU | Action을 PCIe로 복사 |

Environment 수가 커질수록 이 전송과 synchronization 비용도 커진다.

### **2.2 End-to-end GPU pipeline**

Isaac Gym은 simulation state를 GPU tensor로 제공한다.

Rudin et al.의 pipeline은 GPU physics $\rightarrow$ state tensor $\rightarrow$ observation/reward $\rightarrow$ policy inference $\rightarrow$ rollout buffer $\rightarrow$ PPO update로 이어진다.

속도는 GPU simulator 하나에서 나오지 않는다. **Data collection과 optimization 사이의 CPU round trip을 거의 없앤 구조**가 함께 필요하다.

### **2.3 하나의 simulation에 수천 개 robot을 넣는다**

각 robot마다 별도 process를 띄우는 CPU 방식과 달리, Isaac Gym은 하나의 simulation world에서 수천 actor를 vectorized tensor로 처리한다.

Vectorized state는 개념적으로

$$
\mathbf X_t
\in
\mathbb{R}^{N_{\text{env}}\times d_x}
$$

$$
\mathbf A_t
=
\pi_\theta(\mathbf X_t)
\in
\mathbb{R}^{N_{\text{env}}\times d_a}
$$

4096개 robot의 observation과 action이 Python loop가 아니라 batched tensor operation으로 계산된다.

하지만 robot 수만 늘린다고 학습이 무조건 빨라지는 것은 아니다.

---

## **3. On-policy Batch를 분해해서 보기**

### **3.1 Batch size는 두 축의 곱이다**

PPO는 현재 policy로 rollout을 모은 뒤 policy를 update한다.

한 update의 batch size는:

$$
B
=
N_{\text{robots}}
\times
T_{\text{rollout}}
$$

이다.

- $N_{\text{robots}}$: 동시에 굴리는 environment 수
- $T_{\text{rollout}}$: update 전 robot 하나가 연속해서 걷는 step 수

Final rough-terrain 설정은:

$$
B
=
4096\times24
=
98,304
$$

### **3.2 Batch를 고정하고 robot 수를 늘리면 horizon이 줄어든다**

$$
T_{\text{rollout}}
=
\frac{B}{N_{\text{robots}}}
$$

예를 들어 $B=98,304$일 때:

| Robots | Steps per robot |
|---:|---:|
| 128 | 768 |
| 512 | 192 |
| 2,048 | 48 |
| 4,096 | 24 |
| 8,192 | 12 |
| 16,384 | 6 |

Robot 수를 늘리면 같은 batch를 더 빨리 모을 수 있지만, 각 trajectory의 연속 구간은 짧아진다.

Legged locomotion에서는 contact sequence, gait cycle과 fall consequence가 시간에 걸쳐 나타난다.

GAE도 연속 reward를 사용한다.

$$
\hat A_t^{\text{GAE}}
=
\sum_{l=0}^{T-t-1}
(\gamma\lambda)^l
\delta_{t+l}
$$

$$
\delta_t
=
r_t
+
\gamma V(s_{t+1})
-
V(s_t)
$$

Rollout이 지나치게 짧으면 advantage가 충분한 temporal structure를 담지 못하고 bootstrap 의존도가 커진다.

### **3.3 이 task의 practical threshold는 약 0.5초였다**

Policy는 50 Hz이다.

$$
\Delta t_{\text{policy}}
=
0.02\;\text{s}
$$

24 step은:

$$
24\times0.02
=
0.48\;\text{s}
$$

논문은 25 consecutive steps, 약 0.5초보다 짧아지면 학습이 어려워졌다고 설명한다. Final config는 24 step이므로 25를 엄밀한 hard threshold라기보다 **약 0.5초 부근의 경험적 경계**로 읽는 것이 맞다.

### **3.4 Rollout horizon과 episode length는 다르다**

Final rollout은 24 step, 0.48초지만 episode는 최대 20초이다.

PPO update가 끝날 때 environment를 reset하지 않는다.

| 시간 단위 | 길이 | 끝날 때 일어나는 일 |
|---|---:|---|
| Episode | 최대 20 s | Failure 또는 timeout이면 environment reset |
| Rollout segment | 0.48 s | PPO update, episode는 계속 이어질 수 있음 |

즉 하나의 episode가 여러 policy version과 update boundary를 가로지른다.

이 구조 때문에 timeout 처리가 특히 중요해진다.

---

## **4. Parallelism은 많을수록 좋은가**

### **4.1 논문의 scaling experiment**

저자들은 robot 수를 128에서 16,384까지 변화시키고 세 batch size를 비교했다.

| Batch | Plot marker |
|---:|---|
| 49,152 | Circle |
| 98,304 | Cross |
| 196,608 | Triangle |

별도의 high-quality baseline으로:

$$
20,000\;\text{robots}
\times
50\;\text{steps}
=
1,000,000
$$

sample batch도 실험했다.

![Robot 수에 따른 final reward와 training time](/assets/img/posts/rl/sim2real/walk-minutes/04-parallelism-reward-time.png){: width="1300" .d-block .mx-auto }
_왼쪽은 1,500 update 뒤 final reward, 오른쪽은 total training time이다. Robot 수가 늘면 학습 시간은 줄지만, 고정 batch에서 robot당 horizon이 너무 짧아지는 지점부터 final reward가 급격히 떨어진다. 점선은 20,000 robots와 1M batch의 고품질·고비용 baseline이다. 출처: [Rudin et al., Figure 4a-b](https://proceedings.mlr.press/v164/rudin22a/rudin22a.pdf)._

### **4.2 Robot이 너무 적을 때**

Robot 수가 적으면 각 robot에서 긴 trajectory를 얻는다.

하지만 인접한 step은 서로 매우 비슷하다.

같은 robot의 $s_t,s_{t+1},s_{t+2},\ldots$를 길게 모으면 temporal correlation이 강해지고, 같은 batch 안의 sample diversity가 감소한다.

논문은 robot 수가 너무 적을 때 reward가 완만하게 떨어지는 이유를, sample이 IID 가정에서 더 멀어지는 현상으로 해석한다.

### **4.3 Robot이 너무 많을 때**

Robot 수가 지나치게 많으면:

- Robot당 consecutive horizon 감소
- GAE의 temporal context 감소
- Value bootstrap 비중 증가
- Contact와 gait cycle의 장기 효과 포착 어려움

으로 성능이 급격히 떨어진다.

### **4.4 Sweet spot**

![Training time과 final reward의 trade-off](/assets/img/posts/rl/sim2real/walk-minutes/05-parallelism-tradeoff.png){: width="900" .d-block .mx-auto }
_왼쪽 위가 높은 reward와 짧은 time을 동시에 만족하는 영역이다. 이 task에서는 약 2,048~4,096 robots와 100k~200k batch가 좋은 절충점이었다. 색은 robot 수, marker는 batch size다. 출처: [Rudin et al., Figure 4c](https://proceedings.mlr.press/v164/rudin22a/rudin22a.pdf)._

Throughput은 약 4,000 robot까지 거의 선형으로 좋아지지만 이후 증가폭이 둔화된다.

> `num_envs`를 GPU memory가 허용하는 최대값으로 설정하는 것이 아니라, 최소한의 temporal horizon을 보존하면서 throughput과 sample diversity를 함께 최적화해야 한다.

---

## **5. Final PPO 설정**

Supplementary의 final PPO hyperparameter는 아래와 같다.

| 항목 | 값 |
|---|---:|
| Environments | 4,096 |
| Steps per environment | 24 |
| Batch size | 98,304 |
| Mini-batch size | 24,576 |
| Mini-batches per epoch | 4 |
| Learning epochs | 5 |
| PPO clip | 0.2 |
| Entropy coefficient | 0.01 |
| Discount $\gamma$ | 0.99 |
| GAE $\lambda$ | 0.95 |
| Desired KL | 0.01 |
| Learning rate | KL 기반 adaptive |
| Rough updates | 1,500 |
| Flat updates | 공개 config 기준 300 |

### **5.1 큰 mini-batch**

Mini-batch 하나가 24,576 sample.

$$
\frac{98,304}{4}
=
24,576
$$

일반적인 small-scale PPO보다 매우 크다.

수천 environment에서 같은 시점에 얻은 sample은 trajectory source가 다양하므로 큰 mini-batch가 gradient variance를 낮추면서도 정보 중복을 과도하게 만들지 않았다.

### **5.2 Adaptive learning rate**

현재 policy와 update된 policy의 KL divergence를 측정한다.

$$
D_{\mathrm{KL}}
\left(
\pi_{\text{new}}
\parallel
\pi_{\text{old}}
\right)
$$

Target은:

$$
D_{\mathrm{KL}}^*=0.01
$$

이다.

Update가 너무 크면:

$$
D_{\mathrm{KL}}>2D_{\mathrm{KL}}^*
\Rightarrow
\alpha
\leftarrow
\max(10^{-5},\alpha/1.5)
$$

너무 작으면:

$$
D_{\mathrm{KL}}<0.5D_{\mathrm{KL}}^*
\Rightarrow
\alpha
\leftarrow
\min(10^{-2},1.5\alpha)
$$

로 learning rate를 조절한다.

Massive batch가 gradient noise를 줄인다고 해도 policy update magnitude를 자동으로 안전하게 제한해 주는 것은 아니다. KL 기반 schedule은 PPO clip과 별도로 update scale을 조절한다.

### **5.3 총 sample 수**

Rough policy:

$$
98,304
\times
1,500
=
147,456,000
$$

전체 학습량: 147,456,000 transitions.

Flat config를 300 update로 보면:

$$
98,304
\times
300
=
29,491,200
$$

transition이다.

“분 단위 학습”은 sample-efficient하다는 주장과 다르다.

> 이 논문이 개선한 것은 같은 wall-clock 시간에 매우 많은 simulation sample을 처리하는 compute efficiency와 throughput이다.

Sample efficiency를 평가하려면 transition 수 대비 성능을 별도로 비교해야 한다.

---

## **6. Timeout은 Failure가 아니다**

### **6.1 두 종류의 reset**

| Reset | 의미 | Future return 처리 |
|---|---|---|
| Failure / crash | Base contact 등 실제 실패 | Terminal로 끊어도 됨 |
| Time limit | 20초가 지나 episode를 관리상 reset | 다음 value를 bootstrap해야 함 |

Episode time이 observation에 없으면 agent는 20초 timeout을 예측할 수 없다.

Timeout 직전 state가 안정적인 보행 중이어도 value target을 0으로 만들면:

$$
\hat V_t
\approx
r_t
$$

가 되어 critic에게 “이 좋은 state 뒤에는 미래가 없다”는 잘못된 label을 준다.

### **6.2 올바른 truncated transition**

Time limit에서는:

$$
\hat V_t
=
r_t
+
\gamma V(s_{t+1})
$$

처럼 bootstrap해야 한다.

Implementation에서는 timeout indicator를 별도로 전달해 reward/return에 final state value를 더할 수 있다.

```python
if timed_out:
    reward += gamma * value(next_observation)

if failed:
    bootstrap_mask = 0
```

### **6.3 왜 massively parallel setting에서 더 중요했나**

Robot당 rollout은 0.48초이고 episode는 20초.

각 batch에 서로 다른 episode age를 가진 4096개 robot이 섞여 있으므로, 어떤 update에서도 timeout transition이 들어올 수 있다.

“Timeout이 batch 마지막 step에서만 발생한다”는 가정을 사용할 수 없다.

![Timeout bootstrapping의 reward와 critic loss 효과](/assets/img/posts/rl/sim2real/walk-minutes/08-timeout-bootstrap.png){: width="1300" .d-block .mx-auto }
_위쪽은 flat terrain, 아래쪽은 rough terrain이다. Timeout을 bootstrap하면 critic loss가 크게 낮아지고 total reward가 약 10~20% 높아진다. 학습 자체는 bootstrapping 없이도 가능했지만 final quality가 떨어졌다. 출처: [Rudin et al., Appendix Figure 9](https://proceedings.mlr.press/v164/rudin22a/rudin22a.pdf)._

작아 보이는 timeout 처리 하나가 실제 learning objective를 바꾼 셈이다.

Gym 환경에서 task-defined terminal인 `terminated`와 time/resource limit인 `truncated`를 분리해야 하는 이유가 여기에 있다.

---

## **7. Simulation Throughput은 Physics 구현 문제이기도 하다**

### **7.1 실제 병목은 simulation과 contact**

Supplementary의 timing 분석에서는:

1. Physics simulation
2. Observation와 reward 계산
3. Policy/actuator inference

순으로 비용이 컸다.

Policy와 actuator network inference는 batch size가 커져도 GPU에서 비교적 일정하게 유지된다.

반면 contact가 많은 physics는 robot 수와 scene 상태에 따라 증가한다.

![Environment step time, iteration time과 VRAM](/assets/img/posts/rl/sim2real/walk-minutes/09-throughput-vram.png){: width="1300" .d-block .mx-auto }
_왼쪽 위는 environment step 구성별 시간, 오른쪽 위는 고정 batch의 learning iteration 시간이다. 아래는 flat/rough terrain의 VRAM 사용량이다. Robot 수 증가로 data collection은 빨라지지만 policy update 시간은 거의 고정되고, rough mesh와 rendering이 memory를 더 사용한다. 출처: [Rudin et al., Appendix Figures 7-8](https://proceedings.mlr.press/v164/rudin22a/rudin22a.pdf)._

### **7.2 Physics와 policy의 time scale**

Policy는 50 Hz.

$$
\Delta t_{\text{policy}}
=
0.02\;\text{s}
$$

Simulation step은:

$$
\Delta t_{\text{sim}}
=
0.005\;\text{s}
$$

이고 action 하나당 네 번의 physics/actuator step을 수행한다.

$$
\text{decimation}
=
\frac{0.02}{0.005}
=
4
$$

Time step을 더 작게 하면 안정성 여유는 생길 수 있지만 계산량이 선형으로 늘어난다. 더 크게 하면 actuator network와 contact simulation 안정성이 깨질 수 있다.

원문 부록에는 “0.005초보다 작은 step을 사용할 수 없다”는 문장이 있지만, 앞뒤 문맥은 throughput을 위해 step을 최대화하다 actuator model 안정성 한계에 도달했다는 설명이다. 공개 설정도 `dt=0.005`, `decimation=4`.

재현에서는 문장 하나를 해석해 임의로 바꾸기보다 이 pair를 기준으로 확인하는 편이 안전하다.

### **7.3 Collision body를 줄인다**

Contact detection은 비싸다.

논문은 필요한 collision body만 남길다.

- Feet
- Shanks
- Knees
- Base

Visual mesh의 모든 세부 부위에 collision을 붙이면 realism보다 계산 비용과 불안정성이 커질 수 있다.

### **7.4 Height field를 triangle mesh로 바꾼 이유**

Height field는 같은 $(x,y)$에 하나의 높이만 가질 수 있어 수직 벽을 표현하기 어렵다.

계단 edge를 steep slope로 근사하려면 resolution을 높여야 하고 contact 비용이 커진다.

논문은 low-resolution height field를 triangle mesh로 변환한 뒤 vertical surface를 보정한다.

이 선택은:

- Step geometry 유지
- Terrain resolution 비용 감소
- GPU contact throughput 확보

를 함께 노린다.

### **7.5 Robot 배치도 성능에 영향을 준다**

PhysX는 robot 간 collision response를 무시하도록 설정해도 potential contact pair를 detect할 수 있다.

Robot을 너무 가깝게 두면 broad-phase contact 비용이 늘어난다.

Curriculum 초기에는 쉬운 level에 robot이 몰려 있고 넘어짐과 base contact도 많다. 학습이 진행되면 robot이 terrain 전체로 퍼지고 crash가 줄어 simulation time이 감소한다.

저자들은 training 초반과 후반 simulator time이 약 2배 차이 날 수 있다고 보고한다.

따라서 steps/s 하나만 기록할 때도:

- 학습 초기인지 후기인지
- Rendering이 켜져 있는지
- Flat인지 rough mesh인지
- Contact와 reset 빈도가 어떤지

를 함께 기록해야 한다.

### **7.6 VRAM**

4096 robot에서 측정한 대략적인 VRAM은 아래와 같다.

| Terrain | Rendering | VRAM |
|---|---|---:|
| Rough | On | 약 9 GB |
| Rough | Off | 약 6 GB |
| Flat | On | 약 7 GB |
| Flat | Off | 약 5 GB |

이 값은 RTX A6000과 당시 Isaac Gym implementation 기준이다. 다른 GPU, driver, framework와 terrain buffer에서는 달라질 수 있다.

---

## **8. Task: 단순히 앞으로 걷는 Policy가 아니다**

Robot은 다음을 따라야 한다.

- Base heading command
- Linear velocity command
- Rough terrain traversal

Training 중 randomized heading과 velocity command가 주어진다.

Main paper는 command가 episode 동안 고정된다고 설명한다.

Simulation traversability 평가는:

$$
v_x^{cmd}=0.75\;\text{m/s}
$$

$$
v_y^{cmd}
\sim
\mathcal U(-0.1,0.1)\;\text{m/s}
$$

에서 수행된다.

따라서 RMA 글의 forward-only policy와 달리 이 논문은 command-conditioned locomotion.

---

## **9. Terrain과 Game-Inspired Curriculum**

### **9.1 다섯 terrain family**

![Rough, slope, stair와 discrete obstacle terrain](/assets/img/posts/rl/sim2real/walk-minutes/02-terrain-types.png){: width="1200" .d-block .mx-auto }
_왼쪽 위부터 randomly rough terrain, 25도 slope, 20 cm stairs, 최대 ±20 cm discrete obstacles다. Flat terrain까지 포함해 다섯 family를 사용한다. 출처: [Rudin et al., Figure 2](https://proceedings.mlr.press/v164/rudin22a/rudin22a.pdf)._

| Terrain | Difficulty axis |
|---|---|
| Flat | 기준 |
| Smooth / rough slope | $0^\circ$ → $25^\circ$ |
| Random rough | Height variation |
| Stairs up/down | 5 cm → 20 cm step |
| Discrete obstacles | 5 cm → 20 cm magnitude |

각 terrain tile은 8 m × 8 m이다.

Slope와 stairs는 pyramid 형태로 배치해 여러 방향으로 traversable하게 만든다.

### **9.2 Robot마다 type과 level을 가진다**

각 environment는:

$$
(\text{terrain type},\text{terrain level})
$$

을 가진다.

Rule은 간단하다.

| Episode 결과 | 다음 terrain level |
|---|---|
| Terrain 경계를 넘어감 | Level + 1 |
| 기대 이동 거리의 절반도 못 감 | Level - 1 |
| 최고 level을 해결 | Random level로 loop |

수식으로 쓰면 episode 동안 실제 이동 거리를 $d$, command 기준 기대 거리를 $d^*$라고 할 때:

$$
d
<
0.5d^*
\Rightarrow
\text{level down}
$$

최고 level에서 random level로 보내는 이유는 쉬운 terrain을 완전히 잊는 catastrophic forgetting을 줄이고 training distribution을 넓히기 위해서다.

### **9.3 Terrain을 매번 다시 만들지 않는다**

수천 개 environment마다 reset 시 mesh를 생성하면 병목이 된다.

논문은 모든 terrain type과 level을 하나의 큰 tiled mesh에 미리 생성한다.

| Global mesh 축 | 의미 |
|---|---|
| Row | Difficulty level |
| Column | Terrain type |
| Curriculum update | Robot의 reset origin을 다른 tile로 이동 |

Geometry를 재생성하지 않으므로 curriculum update 비용이 거의 없다.

### **9.4 500 update와 1000 update의 차이**

![500·1000 update에서의 terrain curriculum 분포](/assets/img/posts/rl/sim2real/walk-minutes/03-curriculum-progress.png){: width="1250" .d-block .mx-auto }
_위는 500 update, 아래는 1000 update다. 초기에는 slope와 내려가는 stairs에서 먼저 높은 level로 이동하고, 올라가는 stairs와 obstacle은 더 오래 걸린다. 1000 update에는 robot이 모든 terrain의 높은 level까지 넓게 퍼진다. 출처: [Rudin et al., Figure 3](https://proceedings.mlr.press/v164/rudin22a/rudin22a.pdf)._

Curriculum 자체가 performance visualization 역할도 한다.

- Easy row에 robot이 몰림: 해당 terrain을 아직 못 풂
- High level까지 분포: 점차 어려운 terrain을 해결
- Top에서 random loop로 전체 분산: 최고 level을 반복적으로 통과

저자들은 1000 update에 모든 terrain의 최고 level에 도달했고, final convergence를 위해 1500 update까지 학습했다.

---

## **10. Observation, Action과 Control**

### **10.1 논문이 설명한 observation**

| Component | 의미 |
|---|---|
| Base linear velocity | Body-frame translational motion |
| Base angular velocity | Roll/pitch/yaw rate |
| Projected gravity | Body orientation을 yaw-independent하게 표현 |
| Joint positions | 12 actuated joints |
| Joint velocities | 12 actuated joints |
| Previous action | Action smoothness와 short history |
| Terrain heights | Base 주변 grid의 108 measurements |
| Commands | Heading와 linear velocity target |

Terrain measurement 하나는 terrain surface와 robot base 높이 사이의 거리.

이 policy는 blind policy가 아니다.

### **10.2 Height samples는 elevation map에서 온다**

Simulation에서는 ground-truth terrain에서 height를 query할 수 있다.

Real robot에서는 LiDAR scan으로 만든 elevation map에서 같은 위치의 height를 query한다.

| Domain | Height input 생성 경로 |
|---|---|
| Simulation | Perfect terrain mesh $\rightarrow$ sampled heights |
| Real | LiDAR + state estimation $\rightarrow$ elevation map $\rightarrow$ sampled heights |

이 interface가 Sim2Real의 중요한 gap이 된다.

### **10.3 Action**

Policy는 12개 desired joint position을 출력한다.

$$
\mathbf a_t
\equiv
\mathbf q_t^*
\in
\mathbb{R}^{12}
$$

PD controller 또는 learned actuator model이 torque를 만든다.

$$
\boldsymbol\tau_t
\approx
f_{\text{act}}
\left(
\mathbf q_t^*,
\mathbf q_t,
\dot{\mathbf q}_t,
h_t^{act}
\right)
$$

Policy action과 실제 motor torque를 구분해야 한다.

### **10.4 Gait phase나 foot trajectory는 없다**

Reward와 action에:

- Gait phase
- Desired contact schedule
- Predefined foot trajectory
- Reference motion

을 넣지 않는다.

그럼에도 ANYmal policy는 반복적으로 trot gait에 수렴했다.

하지만 이것을 “trot이 수학적으로 최적임을 증명했다”고 해석하면 안 된다. Robot morphology, command distribution, reward와 action regularization이 만든 결과.

---

## **11. Reward를 정확히 보기**

Tracking kernel을 다음처럼 정의한다.

$$
\phi(\mathbf x)
=
\exp
\left(
-
\frac{\lVert\mathbf x\rVert^2}{0.25}
\right)
$$

Supplementary에는 아래 아홉 reward term이 공개돼 있다.

| Reward term | Definition | Weight |
|---|---|---:|
| Linear velocity tracking | $\phi(\mathbf v^*_{b,xy}-\mathbf v_{b,xy})$ | $1\,dt$ |
| Angular velocity tracking | $\phi(\omega^*_{b,z}-\omega_{b,z})$ | $0.5\,dt$ |
| Vertical velocity | $-v_{b,z}^2$ | $4\,dt$ |
| Roll/pitch angular velocity | $-\lVert\boldsymbol\omega_{b,xy}\rVert^2$ | $0.05\,dt$ |
| Joint motion | $-\lVert\ddot{\mathbf q}\rVert^2-\lVert\dot{\mathbf q}\rVert^2$ | $0.001\,dt$ |
| Joint torque | $-\lVert\boldsymbol\tau\rVert^2$ | $0.00002\,dt$ |
| Action rate | $-\lVert\dot{\mathbf q}^*\rVert^2$ | $0.25\,dt$ |
| Collision | $-n_{\text{collision}}$ | $0.001\,dt$ |
| Feet air time | $\sum_f(t_{\text{air},f}-0.5)$ | $2\,dt$ |

모든 scale에 $dt$를 곱하는 것은 control rate가 바뀌어도 초당 reward scale이 크게 달라지지 않게 하기 위한 방법.

### **11.1 Tracking은 exponential kernel**

Squared error를 그대로 빼는 대신:

$$
r_v
=
\exp
\left(
-
\frac{\lVert\mathbf v^*-\mathbf v\rVert^2}{0.25}
\right)
$$

를 사용한다.

Error가 작을 때 높은 reward를 주고, 매우 큰 error에서는 0에 가까워져 gradient contribution이 포화된다.

### **11.2 Feet air-time reward**

발이 contact하기 전 air time이 0.5초보다 길면 양의 값을 준다.

이 term은 짧고 잦은 foot shuffle보다 분명한 swing phase와 긴 step을 유도한다.

Reference gait는 아니지만 gait morphology에 영향을 주는 prior이다.

### **11.3 Collision과 crash**

- Knee, shank contact
- Foot가 vertical surface에 닿는 contact

는 collision penalty를 받는다.

Base contact는 crash로 간주해 reset한다.

Stair를 오를 때 foot만 쓰도록 유도하면서 body가 obstacle에 기대는 simulator exploit을 줄인다.

### **11.4 빠른 학습이 reward engineering을 없애지는 않는다**

저자들은 simple reward에서도 trot이 나오지만:

- Leg dragging
- 비정상적으로 높은 base
- 비정상적으로 낮은 base

같은 artifact가 발생했다고 설명한다.

Reward weight를 반복해서 조정한 뒤 실제 robot에 옮길 수 있는 policy를 얻었다.

즉 빠른 pipeline의 가치는 reward 설계가 필요 없어지는 것이 아니라:

> 잘못된 reward가 만든 behavior를 몇 시간 또는 며칠이 아니라 몇 분 단위로 확인하고 다시 실험할 수 있다는 것.

---

## **12. Sim2Real을 위한 네 가지 구성**

### **12.1 Friction randomization**

논문 설정:

$$
\mu
\sim
\mathcal U(0.5,1.25)
$$

각 robot은 서로 다른 foot-ground friction을 경험한다.

### **12.2 Observation noise**

Observation에는 아래 범위의 uniform noise를 더했다.

| Observation | Noise |
|---|---:|
| Joint position | $\pm0.01$ rad |
| Joint velocity | $\pm1.5$ rad/s |
| Base linear velocity | $\pm0.01$ m/s |
| Base angular velocity | $\pm0.2$ rad/s |
| Projected gravity | $\pm0.05$, 원문 표의 단위 표기는 불명확 |
| Commands | 0 |
| Terrain heights | $\pm0.1$ m |

Command에는 noise를 넣지 않는다. Command는 센서 측정치가 아니라 controller가 알고 있는 target이기 때문이다.

Terrain height noise $\pm0.1$ m는 상당히 크다. 완벽한 simulation height에 의존하는 것을 막지만, structured mapping error나 occlusion을 모두 재현하는 것은 아니다.

### **12.3 Random push**

논문은 10초마다 robot base의 x-y velocity를 최대 $\pm1$ m/s 범위로 바꾼다.

이는 force pulse를 정밀하게 적분한 model이라기보다 instantaneous velocity disturbance에 가깝다.

넘어질 듯한 상태에서 recovery action을 학습하는 데 도움을 준다.

### **12.4 LSTM actuator network**

ANYmal의 series elastic actuator는 ideal PD와 다르다.

논문은 Hwangbo et al.의 learned actuator model 흐름을 따르되:

- 과거 fixed-step measurement를 concat한 feed-forward network 대신
- Current measurement를 입력받는 LSTM

을 사용한다.

LSTM hidden state가 actuator temporal dynamics를 보존한다.

Policy 자체에 actuator history를 추가하는 여러 방식도 시도했지만 final performance 향상을 찾지 못했다고 보고한다.

### **12.5 A1에서는 actuator model을 그대로 쓰지 않았다**

Unitree A1 simulation으로 확장할 때는:

- ANYdrive actuator model 제거
- PD gain 감소
- Torque penalty 감소
- Default joint configuration 변경

이 필요했다.

따라서 “같은 config가 모든 robot에 그대로 적용됐다”는 설명은 틀리다.

---

## **13. Simulation 결과**

### **13.1 Traversability**

![Stairs, obstacle와 slope 난이도별 success rate](/assets/img/posts/rl/sim2real/walk-minutes/06-traversability.png){: width="1300" .d-block .mx-auto }
_왼쪽은 discrete obstacle와 stairs, 오른쪽은 slope의 success rate다. 평가는 0.75 m/s 전진 command와 [-0.1, 0.1] m/s lateral command에서 수행됐다. 출처: [Rudin et al., Figure 5](https://proceedings.mlr.press/v164/rudin22a/rudin22a.pdf)._

Traversability curve에서 직접 읽을 수 있는 결과는 아래와 같다.

- 20 cm까지 stairs up/down은 거의 100% success
- 20 cm는 training의 최대 stair height이자 ANYmal kinematic limit에 가까움
- Discrete obstacle은 height가 커질수록 success가 점진적으로 감소
- Neighbor cell이 +h와 -h이면 실제 step difference는 $2h$가 될 수 있음
- 25도보다 큰 uphill은 거의 오르지 못함
- Downhill은 더 큰 angle에서도 미끄러져 내려오는 방식으로 moderate success

Success는 terrain을 건너면서 base contact가 발생하지 않는 것으로 정의한다.

따라서 foot slip, motion quality와 energy가 모두 성공률에 직접 반영되는 metric은 아니다.

### **13.2 여러 morphology**

![ANYmal C+arm, ANYmal B, A1과 Cassie](/assets/img/posts/rl/sim2real/walk-minutes/07-other-robots.png){: width="1200" .d-block .mx-auto }
_왼쪽 위부터 20% 추가 무게의 arm을 단 ANYmal C, ANYmal B, Unitree A1, Cassie. 동일한 massively parallel pipeline의 적용 범위를 확인한 simulation 결과다. 출처: [Rudin et al., Figure 6](https://proceedings.mlr.press/v164/rudin22a/rudin22a.pdf)._

| Robot | 변경 사항 |
|---|---|
| ANYmal C + fixed arm | Reward와 PPO hyperparameter 변경 없이 재학습 |
| ANYmal B | Reward와 PPO hyperparameter 변경 없이 재학습 |
| Unitree A1 | Actuator model, PD gains, torque penalty와 default pose 변경 |
| Cassie | Single-foot stance를 유도하는 reward 추가 |

여기서 generality는 **동일한 trained policy weight가 morphology 사이에 zero-shot transfer**됐다는 뜻이 아니다.

각 robot을 simulation에서 다시 학습했다.

입력, action, reward와 actuator interface의 일부도 robot에 맞게 수정했다.

---

## **14. 실제 ANYmal C 배포**

![계단과 obstacle에서 실제 ANYmal C를 배포한 결과](/assets/img/posts/rl/sim2real/walk-minutes/10-real-deployment.png){: width="1250" .d-block .mx-auto }
_20분 이내에 학습한 fixed policy를 실제 ANYmal C에 배포했다. 계단과 불규칙 obstacle을 동적으로 통과하지만, 논문은 이 실기 결과에 대해 terrain별 대규모 success-rate 표를 제공하지 않는다. 출처: [Rudin et al., Figure 7 and project media](https://leggedrobotics.github.io/legged_gym/)._

### **14.1 Deployment data flow**

| Runtime input | 처리 경로 |
|---|---|
| Robot sensors | Base·joint state |
| LiDAR | Elevation map $\rightarrow$ local terrain heights |
| State + command + heights | Fixed policy $\rightarrow$ desired joint positions $\rightarrow$ motors |

Real robot에서 policy weight를 fine-tune하지 않는다.

논문은 additional action filtering이나 constraint satisfaction check도 적용하지 않았다고 설명한다. 이것은 해당 실험의 단순한 deployment path를 보여주는 것이지, 새로운 hardware에서 safety layer를 제거하라는 권고가 아니다.

### **14.2 Height map이 실제 bottleneck이었다**

Simulation에서는 terrain height가 정확하다.

Real elevation map에는:

- LiDAR occlusion
- Sparse return
- Mapping latency
- State-estimation drift
- Foot 주변 self-occlusion
- Moving body와 map alignment error

가 있다.

논문은 이 gap 때문에 고속에서 robustness가 떨어졌다고 보고한다.

Hardware에서는 maximum linear velocity command를:

$$
v_{\max}^{real}
=
0.6\;\text{m/s}
$$

로 낮췄다.

Simulation traversability test의 0.75 m/s보다 낮다.

즉 “simulation policy를 아무 수정 없이 동일 운용 envelope로 실행했다”는 주장은 정확하지 않다. Weight는 고정했지만 command envelope는 실제 perception 품질에 맞게 보수적으로 조정했다.

### **14.3 실기 evidence의 범위**

논문과 video는:

- Stair ascent/descent
- Discrete obstacle traversal
- Outdoor motion

을 보여준다.

그러나 각 terrain에서 수백 trial을 수행한 정량 benchmark는 아니다.

이 논문의 main evidence는 최고 robustness가 아니라 다음 결과:

> 분 단위로 학습된 perceptive policy가 실제 hardware에서 의미 있는 terrain locomotion을 수행했다.

---

## **15. 논문과 공개 `legged_gym` 코드를 섞지 않기**

Official code는 논문 구현을 이해하는 데 매우 유용하다.

하지만 paper prose와 최초 공개 commit `ae614c0`의 default config가 완전히 같지는 않다.

| 항목 | Paper | Initial public code |
|---|---|---|
| Terrain height samples | 108 | 17×11 = 187 |
| Total rough observation | 직접 명시 없음 | 235 |
| Push interval | 10 s | 15 s |
| Command duration | Episode 동안 고정 | 10 s마다 resample |
| Base linear velocity noise | $\pm0.01$ m/s | Config scale 0.1, normalization과 함께 적용 |
| Reward weights | Supplementary Table 2 | 일부 scale이 다름 |

Public code의 235D observation은:

$$
3\;\text{linear velocity}
+
3\;\text{angular velocity}
+
3\;\text{gravity}
+
3\;\text{commands}
+
12\;\text{joint position}
+
12\;\text{joint velocity}
+
12\;\text{previous action}
+
187\;\text{heights}
=
235
$$

### **15.1 이것이 의미하는 것**

논문의 정량 claim을 설명할 때는 paper 값을 기준으로 해야 한다.

공개 code를 실행할 때는 해당 commit의 config가 실제 runtime truth이다.

| 목적 | 기준 |
|---|---|
| Paper reproduction claim | Paper와 supplementary 수치 사용 |
| Official repo experiment | Commit hash와 runtime config dump 기록 |

“공식 코드니까 논문과 모든 숫자가 같을 것”이라고 가정하면 observation shape부터 달라진다.

### **15.2 지금은 Isaac Lab migration도 고려해야 한다**

Official repository는 Isaac Gym에서 Isaac Sim / Isaac Lab으로 환경이 이전됐고, 기존 `legged_gym`은 제한적으로 유지된다고 안내한다.

새 실습에서는 선택지가 두 개.

| 목적 | 권장 기준 |
|---|---|
| 논문 역사적 재현 | Isaac Gym Preview 3 + pinned `legged_gym` + `rsl_rl` v1.0.2 |
| 현재 framework에서 연구 확장 | Isaac Lab locomotion task |

두 환경의 PhysX version, tensor API, contact behavior와 config default가 다를 수 있으므로 result를 직접 동일선상에서 비교하면 안 된다.

---

## **16. 공개 코드에서 논문 아이디어 찾기**

### **16.1 Observation**

```python
self.obs_buf = torch.cat((
    self.base_lin_vel,
    self.base_ang_vel,
    self.projected_gravity,
    self.commands[:, :3],
    self.dof_pos - self.default_dof_pos,
    self.dof_vel,
    self.actions,
), dim=-1)

if self.cfg.terrain.measure_heights:
    self.obs_buf = torch.cat((self.obs_buf, heights), dim=-1)
```

논문의 deployable input이 tensor concatenation으로 그대로 나타난다.

### **16.2 Curriculum**

```python
distance = norm(root_xy - terrain_origin_xy)

move_up = distance > terrain_length / 2
move_down = (
    distance
    < norm(command_xy) * max_episode_length_s * 0.5
) & ~move_up

terrain_level += move_up - move_down
```

Highest level을 넘으면 random level로 보낸다.

### **16.3 Control decimation**

```python
for _ in range(decimation):
    torques = compute_torques(actions)
    simulate()
```

Config:

```python
sim.dt = 0.005
control.decimation = 4
```

이므로 policy rate는:

$$
\frac{1}{0.005\times4}
=
50\;\text{Hz}
$$

이다.

### **16.4 PPO runner**

```python
num_envs = 4096
num_steps_per_env = 24
max_iterations = 1500

batch_size = 4096 * 24
```

Paper의 핵심 scaling equation이 config level에서 직접 보인다.

---

## **17. 재현할 때 기록해야 할 것**

### **17.1 Hardware와 software**

- GPU model과 VRAM
- Driver와 CUDA
- Isaac Gym 또는 Isaac Lab version
- PhysX setting
- PyTorch version
- `legged_gym` commit
- `rsl_rl` commit/tag
- Headless/rendering 여부

20분은 RTX A6000 기준 wall-clock 결과.

GPU가 다르면 단순하게 FLOPS 비율로 시간을 환산할 수 없다. Contact throughput과 memory bandwidth, kernel occupancy가 함께 영향을 준다.

### **17.2 Training throughput**

- Environment steps/s
- Policy transitions/s
- Seconds per PPO iteration
- Physics / observation / inference / update breakdown
- 초기와 후기 throughput
- Reset/contact rate

### **17.3 Learning**

- `num_envs`
- `num_steps_per_env`
- Batch와 mini-batch
- PPO epochs
- KL와 adaptive learning rate
- Critic loss
- Timeout bootstrap 적용 여부
- Terrain level distribution

### **17.4 Sim2Real**

- Friction와 mass randomization
- Observation noise 단위
- Push mechanism과 interval
- Actuator model input/output
- Control dt와 latency
- Height map source와 update rate
- Real command limit

학습 시간만 재현하고 real deployment interface가 다르면 이 논문의 전체 claim을 재현한 것이 아니다.

---

## **18. 많이 하는 오해**

### **오해 1: 4096개를 쓰면 언제나 4096배 빠르다**

아니다.

약 4000개 이후 throughput scaling이 둔화되고, 고정 batch에서는 horizon이 너무 짧아져 policy quality가 떨어진다.

### **오해 2: 20분밖에 data를 안 썼다**

Wall-clock이 20분 미만인 것이고 simulation transition은 약 147 million개이다.

### **오해 3: 24 step episode다**

24 step은 PPO rollout horizon. Episode는 최대 20초이며 여러 update를 가로지른다.

### **오해 4: Timeout도 done이므로 value를 0으로 둔다**

Time-limit truncation은 task terminal이 아니다. Bootstrap을 하지 않으면 critic target이 왜곡된다.

### **오해 5: Terrain curriculum은 새 mesh를 계속 생성한다**

하나의 tiled mesh에서 robot reset 위치를 다른 level tile로 옮긴다.

### **오해 6: 같은 policy가 ANYmal, A1, Cassie에 transfer됐다**

각 morphology별로 다시 학습했고 A1과 Cassie에는 설정 변경도 필요했다.

### **오해 7: 빠르게 학습했으니 Sim2Real gap도 작다**

실제 height map error 때문에 command velocity를 0.6 m/s로 낮췄다. Simulator 속도와 model fidelity는 별개의 축이다.

---

## **19. 이 논문의 한계**

### **19.1 Sample efficiency보다 compute throughput**

147 million transition을 사용하는 방식은 simulation이 매우 빠를 때 강하다.

Expensive rendering, deformable physics, fluid simulation이나 real-world data collection처럼 sample 하나가 비싼 task에서는 같은 전략이 그대로 적용되지 않는다.

### **19.2 On-policy scaling의 한계**

PPO는 rollout policy와 update policy가 가까워야 한다.

Robot 수를 늘려도 batch를 무한히 키우면 stale data와 update 비용이 늘고, batch를 고정하면 horizon이 줄어든다.

### **19.3 Perception gap**

Ground-truth simulation heights와 LiDAR elevation map은 품질이 다르다.

Uniform height noise만으로:

- Occlusion
- Map hole
- Moving-object artifact
- Pose drift
- Temporal delay

를 모두 모델링할 수 없다.

### **19.4 Real experiment의 정량성**

Simulation에는 terrain difficulty별 curve가 있지만 real deployment는 주로 qualitative figure와 video.

“20분 policy가 실제로 동작한다”는 증거는 강하지만, 최고 robustness 비교나 failure probability를 정밀하게 판단하기에는 부족하다.

### **19.5 Safety**

논문은 실제 배포에서 additional filtering과 constraint satisfaction을 사용하지 않았다고 설명한다.

새 robot에서 이를 그대로 따르는 것은 안전한 재현 절차가 아니다.

필요한 항목은:

- Joint target clamp
- Torque/velocity limit
- Action-rate limit
- Tilt/base-contact termination
- Watchdog
- Low-speed command envelope
- Manual emergency stop

이다.

### **19.6 빠른 iteration은 overfitting도 빠르게 만든다**

Reward와 terrain을 자주 바꿀 수 있다는 것은 좋지만, 같은 simulation benchmark에 반복 최적화하면 simulator artifact에 더 빨리 overfit할 수도 있다.

Holdout terrain, 다른 physics setting과 real test를 분리해야 한다.

---

## **20. 앞선 Sim2Real 논문과 연결하기**

| Paper 흐름 | 이 논문에서의 역할 |
|---|---|
| Noise and Reality Gap | Observation noise와 perception mismatch |
| Domain Randomization | Friction, mass와 disturbance variation |
| Dynamics Randomization | 여러 physical context에서 policy robustness |
| Agile Locomotion | Actuator dynamics와 latency-aware transfer |
| Agile Motor Skills | Learned actuator model과 high-performance control |
| Challenging Terrain | Terrain curriculum과 proprioceptive/perceptive locomotion |
| RMA | Runtime environment adaptation |
| Learning in Minutes | 이 구성들을 빠르게 반복하는 GPU training infrastructure |

마지막 논문은 앞선 방법을 대체하지 않는다. Reward, observation, randomization, actuator model, terrain curriculum과 policy architecture를 여러 번 바꿔 학습해야 하는 Sim2Real 연구에서 iteration cost를 줄인다.

---

## **21. 실전에서 가져갈 설계 원칙**

### **원칙 1: `num_envs`보다 `num_envs × horizon`을 본다**

Environment 수만 보고 scaling을 판단하지 않는다.

### **원칙 2: Episode boundary와 rollout boundary를 분리한다**

PPO update마다 environment를 reset할 필요가 없다.

### **원칙 3: `terminated`와 `truncated`를 분리한다**

Timeout은 value bootstrapping이 필요하다.

### **원칙 4: Physics throughput을 profile한다**

Policy inference보다 contact, terrain과 reset이 병목일 수 있다.

### **원칙 5: Curriculum state를 distribution으로 본다**

수천 robot의 terrain level 분포 자체가 policy capability의 online summary.

### **원칙 6: 빠른 training과 real robustness를 혼동하지 않는다**

분 단위 학습은 빠른 검증 loop를 만들 뿐, hardware validation을 없애지 않는다.

### **원칙 7: Paper와 code의 버전을 함께 기록한다**

Observation shape와 push interval부터 다를 수 있다.

---

## **22. 재현 Checklist**

### **GPU Pipeline**

- [ ] Physics state tensor가 GPU에 유지되는가?
- [ ] Reward와 observation이 vectorized GPU operation인가?
- [ ] Action/observation의 CPU round trip이 없는가?
- [ ] Rendering을 끈 throughput도 별도로 측정했는가?

### **PPO**

- [ ] $B=N_{\text{env}}\times T_{\text{rollout}}$를 확인했는가?
- [ ] Robot당 horizon이 약 0.5초를 유지하는가?
- [ ] Batch 98,304와 mini-batch 24,576의 shape가 맞는가?
- [ ] 5 epochs, clip 0.2, entropy 0.01인가?
- [ ] KL target 0.01 기반 adaptive learning rate인가?

### **Reset**

- [ ] Crash와 timeout signal이 분리되어 있는가?
- [ ] Timeout transition에서 value bootstrap을 하는가?
- [ ] PPO update가 끝났다고 environment를 reset하지 않는가?

### **Terrain**

- [ ] 8 m tile과 terrain type/level mapping이 맞는가?
- [ ] Level-up/down 거리 기준이 맞는가?
- [ ] 최고 level에서 random level로 loop하는가?
- [ ] Triangle mesh의 vertical surface가 올바른가?

### **Control**

- [ ] Simulation 0.005 s, decimation 4, policy 50 Hz인가?
- [ ] Action이 desired joint position인가?
- [ ] Actuator network state가 reset 때 함께 reset되는가?
- [ ] Robot별 PD gain과 torque limit이 맞는가?

### **Sim2Real**

- [ ] Noise의 단위와 normalization 순서를 확인했는가?
- [ ] Friction와 mass randomization 범위가 기록됐는가?
- [ ] Push가 force인지 velocity overwrite인지 구분했는가?
- [ ] Height map latency와 missing data를 검증했는가?
- [ ] Real command envelope를 simulation과 별도로 기록했는가?

---

## **23. 정리: 빠른 Simulator가 아니라 빠른 연구 Loop**

이 논문의 핵심 equation은 단순하다.

$$
B
=
N_{\text{robots}}
\times
T_{\text{rollout}}
$$

하지만 이 식을 실제 4096-environment locomotion에 적용하려면 다음 여섯 층이 함께 필요했다.

1. **GPU residency:** Physics, reward, observation, inference와 PPO를 GPU에 유지한다.
2. **On-policy semantics:** 약 0.5초의 per-robot horizon, 98,304 sample batch와 timeout bootstrapping을 보존한다.
3. **Physics throughput:** Contact body, terrain representation과 robot placement를 최적화한다.
4. **Curriculum:** 하나의 tiled terrain mesh에서 robot별 level을 이동시킨다.
5. **Transfer stack:** Friction, noise, push randomization과 LSTM actuator network를 사용한다.
6. **Real interface:** Simulation height sample을 LiDAR elevation-map input으로 교체한다.

대표 rough-terrain policy는:

$$
4096
\times
24
\times
1500
=
147,456,000
$$

transition을 RTX A6000 한 장에서 20분 이내에 처리했다.

Simulation에서는 20 cm stairs를 거의 완벽하게 통과했고, 실제 ANYmal C에서도 stairs와 obstacle traversal을 보였다.

그러나 real elevation map 오차 때문에 maximum command를 0.6 m/s로 낮췄고, 실기 정량 benchmark는 제한적이었다.

> Massively parallel RL은 학습에 필요한 simulation experience를 없애는 방법이 아니라, 충분한 trajectory horizon과 올바른 RL semantics를 유지하면서 그 경험을 매우 짧은 wall-clock time에 수집·최적화하는 시스템 설계다.

그리고 Sim2Real 관점에서 더 중요한 메시지는:

> 빠른 학습의 진짜 가치는 한 번에 정답 policy를 얻는 것이 아니라, reward·observation·randomization·perception interface를 실제 robot 결과와 대조하며 더 자주 수정할 수 있게 만드는 데 있다.

이 글로 8편의 Sim2Real paper 흐름은 다음처럼 연결된다.

| 흐름 | 핵심 질문 |
|---|---|
| Reality gap | Simulation과 real observation·dynamics는 왜 다른가 |
| Randomization | 불확실성을 어떤 distribution으로 학습할 것인가 |
| Actuator/dynamics modeling | Action-to-torque gap을 어떻게 줄일 것인가 |
| Rough-terrain perception | Hidden contact와 terrain을 무엇으로 관측할 것인가 |
| Online adaptation | 현재 environment context에 맞춰 action을 어떻게 바꿀 것인가 |
| Massively parallel iteration | 이 모든 설계를 얼마나 빠르게 검증할 것인가 |

전체 목록: [Sim2Real Paper 아카이브](/categories/paper/)

---

## **참고 자료**

- [Rudin et al., Learning to Walk in Minutes Using Massively Parallel Deep Reinforcement Learning](https://proceedings.mlr.press/v164/rudin22a.html)
- [PMLR paper PDF](https://proceedings.mlr.press/v164/rudin22a/rudin22a.pdf)
- [arXiv:2109.11978](https://arxiv.org/abs/2109.11978)
- [Official project and video](https://leggedrobotics.github.io/legged_gym/)
- [Official legged_gym repository](https://github.com/leggedrobotics/legged_gym)
- [Initial public code commit ae614c0](https://github.com/leggedrobotics/legged_gym/tree/ae614c029977157123225f538ecdd3f873e54bd4)
- [Isaac Lab locomotion migration guide](https://isaac-sim.github.io/IsaacLab/main/source/migration/migrating_from_isaacgymenvs.html)
