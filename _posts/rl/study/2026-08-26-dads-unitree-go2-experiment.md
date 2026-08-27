---
title: "[DADS 실험] Go2의 전이는 예측 가능한 스킬로 분화할까?"
date: 2026-08-26 07:40:00 +0900
last_modified_at: 2026-08-28 00:30:25 +0900
categories: [RL, Study]
tags: [dads, diayn, unitree-go2, unsupervised-reinforcement-learning, skill-discovery, intrinsic-reward, dynamics-model, ppo, isaac-gym]
description: "DIAYN Go2 실험 트리를 DADS로 다시 실행해 reward 시간 단위, feature, 안전 제약, K 확장, 반복 조합, height-only와 height+roll matched 실험을 공통 평가 축으로 비교한다."
math: true
image:
  path: https://media.iamjaehka13.blog/assets/img/posts/rl/dads-unitree-go2-experiment/00-preview.png
  alt: DADS scratch K=30의 height-only와 height plus roll latent skill 전체 비교
---

## **0. 결과부터 보기**

이번 실험은 [이전 DIAYN Go2 실험](/posts/diayn-unitree-go2-experiment/)의 첫 질문을 유지하면서, objective만 바꾸었을 때 결과가 어떻게 달라지는지 비교했다.

> **앞으로 가라는 보상이나 skill별 목표 궤적 없이, Unitree Go2의 latent skill 중 일부가 서로 다른 이동 행동으로 분화하는가? 그리고 상태 자체가 아니라 transition의 예측 가능성을 학습하는 DADS로 바꾸면 결과가 어떻게 달라지는가?**

비교를 위해 로봇, simulator, policy 구조, PPO, schedule, seed, clean 평가, 영상 길이와 평가 항목을 유지했다. 바꾼 핵심은 state classifier를 skill-conditioned dynamics model로 교체하고, 그 likelihood ratio를 intrinsic reward로 사용하는 부분이다. K 확장·scratch progression은 50 iteration 간격으로 기록했고, safety arm은 DIAYN과 같은 model 700→725→750 gate를 사용했다.

- Raw intrinsic reward는 iteration 700에서 30 episode 중 19개가 무너졌다.
- `dt=0.02`를 곱하자 model 700은 30/30 episode를 채웠지만 model 800에서 다시 5/30이 종료됐다.
- 18D dynamic state의 chance-constrained model 600은 안전 지표를 통과했지만, 0.5 m 이상 이동한 skill이 1/6뿐이었다.
- 별도로 각 $K$의 actor·critic·dynamics model을 무작위로 초기화해 height-only control과 height+roll treatment를 맞춰 비교한 실험에서는 $K=30$ treatment만 최종 gate를 통과했다.

$K=30$ height+roll treatment의 model 1000은 skill당 5 episode, 총 150 episode를 모두 20초까지 실행했다. 0.5 m endpoint gate를 넘은 skill은 12개였고, 최저 skill 평균 높이는 0.3318 m, 평균 절대 roll은 1.293°였다.

이 숫자는 서로 다른 접촉 순서나 보행 주기를 확인한 12개의 독립 gait가 아니라, 0.5 m 이동 gate를 넘은 skill 12개를 뜻한다.

<img src="/assets/img/posts/rl/dads-unitree-go2-experiment/posters/13-e-k30-model1000.jpg"
     data-dads-gif-src="https://media.iamjaehka13.blog/assets/img/posts/rl/dads-unitree-go2-experiment/13-e-k30-model1000.gif"
     alt="K=30 DADS height-only control과 height plus roll treatment의 model 1000 전체 skill 20초 비교"
     width="960" height="900"
     decoding="async"
     class="d-block mx-auto"
     style="width: 100%; border-radius: 6px;">

*위쪽은 height-only control, 아래쪽은 height+roll treatment다. 같은 칸은 같은 skill ID이며, 두 arm은 동일하게 무작위 초기화한 model 0에서 갈라졌다.*

학습을 마치고 policy를 고정한 뒤, 30개 skill로 만들 수 있는 ordered pair 870개를 각각 최대 20초 동안 반복 실행했다. 동일한 exact-1000 selector는 DADS에서 `z11 → z18`, DIAYN에서 `z23 → z24`를 골랐다.

| Algorithm | 선택된 반복 | 순이동 | Path efficiency | RMS cross-track | Cycle 5회 평균 정렬도 |
|---|---|---:|---:|---:|---:|
| DADS | `z11 → z18` | 2.316 m | 0.8945 | 0.138 m | 0.9719 |
| DIAYN | `z23 → z24` | 9.715 m | 0.9798 | 0.345 m | 0.9938 |

DADS pair도 cycle 5회 동안 world frame의 같은 선 방향으로 진행했다. 같은 selector에서 DIAYN의 선택 결과가 더 멀고 효율적이었다.

이 글은 [DADS 이론편](/posts/dads-dynamics-aware-skill-discovery/)의 조건부 mutual information을 실제 Go2 simulation에 옮기고, DIAYN에서 했던 실험을 같은 순서로 다시 실행한 기록이다.

---

## **1. 이 실험은 무엇을 재현한 것인가?**

[DADS 논문](https://arxiv.org/abs/1907.01657)은 현재 상태 $s$가 같더라도 skill $z$에 따라 다음 상태 $s'$가 달라지고, 같은 $s,z$에서는 그 변화를 예측할 수 있도록 학습한다.

$$
I(S';Z\mid S)
=
H(S'\mid S)-H(S'\mid S,Z)
$$

환경의 transition density를 알 수 없으므로 skill-conditioned dynamics model을 학습한다.

$$
q_\phi(s'-s\mid s,z)
$$

Intrinsic reward는 현재 skill의 likelihood와 모든 skill에 대한 marginal likelihood의 비율이다.

$$
r_{\text{DADS}}
=
\log q_\phi(\Delta s\mid s,z)
-
\log\left(
\frac{1}{K}\sum_{k=0}^{K-1}
q_\phi(\Delta s\mid s,k)
\right)
$$

현재 $z$로는 transition을 잘 설명하고, 다른 $z$로는 설명하기 어려울수록 reward가 커진다.

다만 이 실험은 원 논문의 benchmark를 그대로 복제한 것이 아니다.

| 구분 | 원 DADS | 이 실험 |
|---|---|---|
| 저수준 policy 학습 알고리즘 | EC-SAC | PPO |
| 대표 환경 | Ant, Humanoid 등 | Unitree Go2, Isaac Gym |
| Skill model | $q(s'\mid s,z)$ | 4-component diagonal Gaussian mixture $q(\Delta s\mid s,z)$ |
| Discrete marginal | prior sampling | discrete $K$ 전체의 정확한 균등 평균 |
| Downstream 사용 | learned dynamics 기반 skill-space MPC, MPPI | frozen policy의 870개 pair 전수 실행과 open-loop 반복 |

원 DADS의 저수준 policy는 **EC-SAC**로 학습됐다. 여기서는 policy 학습 알고리즘까지 바꾸면 DIAYN과의 차이가 DADS objective 때문인지 SAC/PPO 차이 때문인지 분리하기 어려워 PPO를 유지했다.

조합 실험에서는 learned model로 미래를 계획하지 않고, 서로 다른 두 skill의 ordered pair 870개를 고정된 2+2초 schedule로 실행한 뒤 정해 둔 selector로 골랐다.

---

## **2. Go2에 DADS를 붙인 방법**

### **2.1 Policy 입력은 DIAYN과 같게 유지했다**

기존 Go2 observation 48차원에 one-hot skill $z$를 붙였다.

```text
actor observation = [Go2 observation 48D, one-hot skill K]

K=6  -> 54D
K=10 -> 58D
K=20 -> 68D
K=30 -> 78D
```

Skill은 episode가 시작할 때 균등하게 뽑고 episode 동안 고정했다. Command는 항상 0이다.

```text
vx command = 0
vy command = 0
yaw-rate command = 0
```

Policy에는 $z$가 입력되지만, dynamics model은 skill label 자체를 정답으로 예측하는 classifier가 아니다. 현재 feature와 $z$를 조건으로 실제 state delta의 density를 예측한다.

### **2.2 Feature arm마다 예측할 transition을 맞췄다**

DIAYN 글에서 discriminator에 보여 준 feature를 DADS에서는 state condition과 delta target으로 바꿨다.

| Arm | Condition | Prediction target | Horizon |
|---|---|---|---:|
| Physical 3D | horizon 시작의 local planar pose | body-frame $dx,dy,d\psi$ | 25 policy step |
| Planar | horizon 시작의 local planar pose | body-frame $dx,dy$ | 25 policy step |
| Proprioceptive | 이전 33D state | 현재 33D state와의 delta | 1 policy step |
| Dynamic | 이전 18D state | 현재 18D state와의 delta | 1 policy step |

Pose branch가 25-step target을 쓴 이유는 DIAYN의 displacement window와 시간 범위를 맞추기 위해서다. 이는 논문 기본식의 one-step DADS와 정확히 같지 않은 matched variant다.

Dynamics model은 state와 target의 running population statistics를 따로 유지하고, 정규화된 공간에서 4개의 diagonal Gaussian component를 출력한다. 분모는 sampled negative skill을 사용하는 대신 모든 $K$개의 likelihood를 계산해 정확히 평균했다.

### **2.3 Dynamics update와 PPO update 순서를 분리했다**

한 rollout의 실제 순서는 다음과 같다.

```text
1. base·safety reward로 rollout 수집
2. state와 delta normalization 갱신
3. q_phi(delta | state, z) 학습
4. 갱신된 q_phi로 rollout의 DADS reward 재계산
5. timeout bootstrap을 보존하면서 PPO storage에 intrinsic reward 추가
6. return 계산 후 PPO update
```

Policy timestep은 0.02초, 즉 50 Hz다. 최종 step reward에는 DIAYN과 같은 시간 단위를 적용했다.

$$
r_{\text{DADS,step}}=r_{\text{DADS}}\times 0.02
$$

---

## **3. 공통 실험 조건과 판정 기준**

### **3.1 같은 조건을 고정했다**

| 항목 | 값 |
|---|---|
| Robot / terrain | Unitree Go2 / plane |
| Training seed | 1 |
| Full training env | 4096 parallel environments |
| Physics / policy timestep | 0.005 s / 0.02 s |
| Control | 12D joint position offset, action scale 0.25 |
| Skill | episode마다 uniform sampling, episode 중 고정 |
| Command | $(0,0,0)$ |
| Checkpoint cadence | K 확장·scratch progression은 50 iteration, safety gate는 25 iteration |
| 최종 평가 | clean deterministic, skill당 5 episode, episode당 20초 |
| 영상 | 모든 skill, checkpoint당 1000 transition, 20.05초 encoding |

이 글에서 `model N`은 absolute iteration $N$에 저장한 checkpoint를 뜻한다.

Schedule도 그대로 유지했다.

```text
iteration 0–499
  temporary tracking support, intrinsic weight 0

iteration 500–699
  support 1 -> 0, intrinsic 0 -> 1

iteration 700 이후
  tracking 0, DADS intrinsic + physical terms
```

따라서 iteration 700 이후의 policy는 전진 방향·목표 속도·skill별 목표 궤적을 유도하는 reward를 받지 않는다.

### **3.2 Posterior accuracy만으로 성공을 판정하지 않았다**

Discrete DADS에서는 Bayes rule로 transition의 posterior를 계산할 수 있다.

$$
p(z\mid s,s')
\propto
q_\phi(s'-s\mid s,z)p(z)
$$

Posterior의 argmax가 실제 skill ID와 일치한 비율은 separability 지표일 뿐, 좋은 보행의 개수를 뜻하지 않는다. 판정에는 다음을 함께 썼다.

1. **Survival**: 20초 timeout까지 가는가?
2. **Height**: skill 평균 높이와 낮은 높이 tail이 기준을 지키는가?
3. **Motion**: skill 평균 endpoint가 0.5 m 이상 이동하는가?
4. **Posture**: roll·pitch와 termination이 허용 범위인가?
5. **Separability**: dynamics posterior가 transition에서 skill을 구별하는가?

**$K=6$ full source gate**는 30/30 생존, 모든 skill 평균 높이 0.32 m 이상, skill별 0.30 m 미만 비율 1% 이하, 이동 skill 최소 4/6을 함께 요구했다. 어느 하나라도 실패하면 다음 branch의 정식 source로 승격하지 않았다.

---

## **4. 시도한 실험 전체 지도**

<img src="https://media.iamjaehka13.blog/assets/img/posts/rl/dads-unitree-go2-experiment/01-experiment-map.svg"
     alt="시간 단위, pose feature, 높이 제약, proprioceptive와 dynamic feature, K 확장, 조합, scratch height roll 비교로 이어지는 Go2 DADS 실험 지도"
     width="1400" height="980"
     class="d-block mx-auto"
     style="width: 100%; border-radius: 6px;">

*A–E는 DIAYN 글의 질문 순서를 그대로 복제하되, 각 gate의 실패 여부를 다음 단계와 분리한 실험 tree다.*

| Branch | 바꾼 것 | 핵심 관찰 | 판정 |
|---|---|---|---|
| A | Raw reward 대 `dt` scaled reward | Raw model 700은 19/30 종료, scaled model 700은 30/30 생존 | 시간 단위 수정 채택 |
| A | Scaled branch를 800까지 연장 | skill 0이 5/5 종료 | 장기 gate 실패 |
| B | $dx,dy,d\psi$ 대 $dx,dy$ | Planar 700에서 이동 5/6이지만 1/30 tilt | Yaw 제거만으로 부족 |
| B | Height coefficient와 constraint | 생존은 개선됐지만 strict 0.32 m mean gate 실패 | 안전 arm 승격 없음 |
| B | 33D proprioceptive | 이동 3/6 | Diversity gate 실패 |
| B | 18D dynamic | 550의 2/6이 575에서 0/6, 600에서 1/6 | DIAYN과 다른 결과 |
| B | Dynamic + chance model 600 | 120/120 생존, 이동 1/6 | 안전하지만 source diversity 실패 |
| C | $K=10,20,30$ 고정 구간 확장 | 650 collapse 뒤 일부 회복 | source 이동 1/6 |
| D | 870 ordered pair exact-1000 반복 | DADS `z11→z18`, DIAYN `z23→z24` | 같은 selector의 제한된 비교 |
| E | Scratch height-only 대 height+roll | $K=30$ treatment만 최종 gate 통과 | 최종 비교 |

---

## **5. 첫 실패: intrinsic reward의 시간 단위가 달랐다**

처음에는 DADS likelihood ratio를 policy step마다 reward에 그대로 더했다.

```text
physical reward term: scale × raw_reward × 0.02
DADS reward term:     scale × intrinsic_reward
```

같은 coefficient처럼 보여도 policy timestep 기준으로 50배의 단위 차이가 생긴다. Raw branch의 model 700은 clean 30 episode 중 19개가 종료됐다.

| Model | 20초 완료 | 중도 종료 | 최저 높이 | 평균 절대 roll | Posterior accuracy |
|---:|---:|---:|---:|---:|---:|
| Raw 600 | 30/30 | 0 | 0.254 m | 16.49° | 74.25% |
| Raw 700 | 11/30 | 19 | 0.188 m | 16.92° | 65.81% |

<img src="/assets/img/posts/rl/dads-unitree-go2-experiment/posters/02-raw-model700.jpg"
     data-dads-gif-src="https://media.iamjaehka13.blog/assets/img/posts/rl/dads-unitree-go2-experiment/02-raw-model700.gif"
     alt="시간 적분을 적용하지 않은 DADS raw intrinsic model 700에서 여러 Go2 skill이 중도 종료되는 20초 평가"
     width="960" height="360"
     class="d-block mx-auto"
     style="width: 100%; border-radius: 6px;">

*Raw intrinsic model 700의 모든 $K=6$ skill. 한 번의 기록과 skill당 5 episode 집계는 구분해서 해석했다.*

Reward에 $dt=0.02$를 곱하자 model 700은 30/30 episode를 채웠다.

| Model | 20초 완료 | 중도 종료 | 최저 높이 | 평균 평면속도 | Posterior accuracy |
|---:|---:|---:|---:|---:|---:|
| Scaled 600 | 30/30 | 0 | 0.265 m | 0.0418 m/s | 55.15% |
| Scaled 700 | 30/30 | 0 | 0.316 m | 0.1177 m/s | 68.12% |
| Scaled 800 | 25/30 | 5 | 0.206 m | 0.0878 m/s | 42.28% |

<img src="/assets/img/posts/rl/dads-unitree-go2-experiment/posters/03-dt-scaled-model700.jpg"
     data-dads-gif-src="https://media.iamjaehka13.blog/assets/img/posts/rl/dads-unitree-go2-experiment/03-dt-scaled-model700.gif"
     alt="DADS intrinsic reward에 policy timestep을 곱한 model 700에서 모든 K=6 Go2 skill이 20초를 채우는 평가"
     width="960" height="360"
     class="d-block mx-auto"
     style="width: 100%; border-radius: 6px;">

*시간 단위를 맞춘 model 700은 이 checkpoint의 clean survival gate를 통과했다.*

`dt` scaling은 필요한 단위 교정이었다. 그러나 model 800에서는 skill 0이 5/5 episode에서 다시 넘어졌다. **단위를 고친 것과 장기적으로 좋은 skill을 얻는 것은 별개의 문제**였다.

---

## **6. 왜 예측 가능한 transition도 몸체를 낮출 수 있나?**

DADS가 predictability를 요구한다고 해서 걷기가 자동으로 선택되지는 않는다. 몸체를 낮추거나 일정한 관절 운동을 반복하는 transition도 다음 상태를 예측하기 쉽고 다른 skill과 구별될 수 있다.

```text
사람이 원하는 해
-> 안정적인 이동과 서로 다른 보행 mode

DADS가 허용하는 더 쉬운 해
-> 반복 가능한 자세 변화, 느린 motion, yaw, 관절 속도 차이
```

Predictability는 같은 $s,z$에서 결과가 덜 흔들리도록 압력을 주지만, 에너지 효율이나 locomotion quality를 직접 평가하지 않는다.

### **6.1 Yaw target을 분리했다**

같은 model 500에서 transition target만 비교했다.

| Arm | Target | Checkpoint | 생존 | 0.5 m 이상 이동 |
|---|---|---:|---:|---:|
| Physical 3D | $dx,dy,d\psi$ | 700 | 30/30 | 3/6 |
| Planar | $dx,dy$ | 700 | 29/30 | 5/6 |
| Planar | $dx,dy$ | 800 | 30/30 | 3/6 |

Yaw를 prediction target에서 빼자 model 700의 이동 skill은 3개에서 5개로 늘었다. 그러나 한 episode가 tilt로 종료됐고, 800에서는 이동 skill이 다시 3개로 줄었다.

따라서 이 run에서 yaw는 쉬운 차이 중 하나였지만, 제거 효과는 단조롭지 않았다. Target을 좁히면 그 target 안의 diversity 압력도 다시 배분된다.

### **6.2 Height coefficient만 키우면 충분한가?**

Planar model 700에서 quadratic height coefficient만 각각 -50, -100, -200으로 바꿔 model 750까지 실행했다.

| Height scale | 생존 | 이동 skill | 최저 skill 평균 높이 | 0.30 m 미만 sample | Strict 0.32 m mean gate |
|---:|---:|---:|---:|---:|---:|
| -50 | 30/30 | 4/6 | 0.2976 m | 15.68% | 실패 |
| -100 | 30/30 | 5/6 | 0.3060 m | 0% | 실패 |
| -200 | 30/30 | 4/6 | 0.3074 m | 0% | 실패 |

계수를 키우자 높이가 크게 낮아진 sample은 줄었지만, 모든 skill의 평균 높이를 0.32 m 이상으로 만드는 strict gate는 세 arm 모두 통과하지 못했다. 큰 scalar penalty는 hard guarantee가 아니다.

### **6.3 Linear·Lagrangian·chance arm도 첫 gate에서 멈췄다**

동일한 planar model 700에서 제약 방식만 바꿨다.

| Arm, model 725 | 생존 | 이동 skill | 최저 skill 평균 높이 | Gate |
|---|---:|---:|---:|---|
| Linear hinge | 30/30 | 5/6 | 0.3075 m | 실패 |
| Mean Lagrangian | 30/30 | 5/6 | 0.3159 m | 실패 |
| Mean + chance | 30/30 | 5/6 | 0.3189 m | 실패 |
| Frozen anchor | 30/30 | 5/6 | 0.3161 m | 실패 |
| Matched no-anchor | 30/30 | 5/6 | 0.3165 m | 실패 |

모든 arm이 20초 생존과 low-tail 조건을 만족했지만, 최악 skill의 평균 높이가 0.32 m 아래였다. 따라서 model 725가 첫 번째 실패 경계점이다.

---

## **7. 결정적 ablation: dynamics model에 무엇을 예측하게 할 것인가**

### **7.1 33D proprioceptive delta는 절반의 skill만 이동시켰다**

33D state feature는 다음 항목으로 구성했다.

```text
base linear velocity       3
base angular velocity      3
projected gravity          3
joint position error      12
joint velocity            12
-----------------------------
total                     33D
```

Model 550은 30/30 episode를 채웠고, 최저 skill 평균 높이는 0.3292 m였다. Posterior accuracy도 83.49%였다. 그러나 이동 gate를 넘은 skill은 3/6뿐이었다.

<img src="/assets/img/posts/rl/dads-unitree-go2-experiment/posters/04-proprio33-model550.jpg"
     data-dads-gif-src="https://media.iamjaehka13.blog/assets/img/posts/rl/dads-unitree-go2-experiment/04-proprio33-model550.gif"
     alt="33D proprioceptive delta를 예측한 DADS model 550의 K=6 Go2 skill 전체 20초 평가"
     width="960" height="360"
     class="d-block mx-auto"
     style="width: 100%; border-radius: 6px;">

*33D proprioceptive model 550. 안전 지표는 통과했지만 이동 skill 4/6 기준에는 미달했다.*

DIAYN의 같은 ablation에서는 static joint pose가 강한 classifier shortcut이 됐다. DADS는 절대 pose가 아니라 one-step delta likelihood를 학습하므로 결과가 똑같지는 않았다. 그래도 joint와 자세 channel에서 구별되는 transition을 만드는 것이 task-space 이동보다 쉬울 수 있다는 문제는 남았다.

### **7.2 18D dynamic delta만 남겨도 diversity가 늘지 않았다**

Absolute joint position과 projected gravity를 빼고 다음 18D만 남겼다.

```text
base linear velocity       3
base angular velocity      3
joint velocity            12
-----------------------------
total                     18D
```

| Iteration | 생존 | 이동 skill | 최대 skill 평균 변위 | Posterior accuracy |
|---:|---:|---:|---:|---:|
| 550 | 30/30 | 2/6 | 1.082 m | 14.75% |
| 575 | 30/30 | 0/6 | 0.025 m | 19.97% |
| 600 | 30/30 | 1/6 | 2.412 m | 41.44% |

DIAYN에서는 18D dynamic feature가 일부 locomotion-like mode를 열었다. 반면 이 DADS run에서는 model 550의 두 이동 skill이 575에서 사라졌고, 600에서 한 skill만 다시 이동했다.

<img src="/assets/img/posts/rl/dads-unitree-go2-experiment/posters/05-dynamic18-model600.jpg"
     data-dads-gif-src="https://media.iamjaehka13.blog/assets/img/posts/rl/dads-unitree-go2-experiment/05-dynamic18-model600.gif"
     alt="18D dynamic delta를 예측한 DADS model 600에서 한 개의 이동 skill과 다섯 개의 느린 mode가 나타나는 20초 평가"
     width="960" height="360"
     class="d-block mx-auto"
     style="width: 100%; border-radius: 6px;">

*18D dynamic model 600의 모든 skill. Feature 차원 축소만으로 넓은 이동 repertoire가 보장되지 않았다.*

### **7.3 Chance-constrained model 600은 안전했지만 source gate를 통과하지 못했다**

Dynamic model 575에서 mean-height와 low-tail chance constraint를 추가했다.

- clean 5 episode/skill: 30/30 생존
- clean 20 episode/skill: 120/120 생존
- 최저 skill 평균 높이: 0.3435 m
- 0.5 m 이상 이동한 skill: 1/6
- 20-episode posterior accuracy: 40.19%

안전 gate는 통과했지만 diversity gate는 통과하지 못했다. 이 model 600을 $K$ 확장의 정상 source로 승격할 수 없었다.

여기서 DIAYN과 DADS의 결과 차이가 가장 분명해졌다. 같은 18D representation을 사용했어도 DIAYN은 “현재 feature에서 skill을 구별할 수 있는가”를, DADS는 “현재 feature의 transition을 해당 skill로 예측할 수 있는가”를 최적화한다. Objective가 다르면 같은 representation도 다른 행동 압력을 만든다.

---

## **8. $K=6$에서 10·20·30으로 늘리면 어떻게 변하나?**

### **8.1 이동 skill 1/6인 model 600에서 확장했다**

Dynamic chance model 600에서 $K$만 늘렸을 때 학습 양상이 어떻게 변하는지 보기 위해 600→1000을 실행했다.

초기화는 DIAYN 확장과 같게 맞췄다.

```text
K=6 model 600
  ├─ K=10: 기존 6개 skill input 보존, 새 4개 열 = 0
  ├─ K=20: 기존 6개 skill input 보존, 새 14개 열 = 0
  └─ K=30: 기존 6개 skill input 보존, 새 24개 열 = 0
```

Actor 입력 차원 변경에 맞춰 PPO optimizer를 reset했고, dynamics model·optimizer·normalizer도 새 $K$에 맞게 reset했다. Absolute iteration은 600으로 유지했다. 모든 checkpoint를 50 iteration 간격으로 저장하고, 각 checkpoint에서 모든 skill을 20초 기록했다.

### **8.2 Model 650에서 세 $K$가 모두 크게 무너졌다**

Model 650을 skill당 5 episode씩 평가한 결과는 다음과 같다.

| $K$ | 완료 episode | Low-height 종료 | 이동 skill |
|---:|---:|---:|---:|
| 10 | 2/50 | 48/50 | 0/10 |
| 20 | 2/100 | 98/100 | 5/20 |
| 30 | 0/150 | 150/150 | 0/30 |

Checkpoint마다 skill별 한 episode를 기록한 progression 영상의 model 650에서도 K=10은 9/10, K=20은 20/20, K=30은 30/30 skill이 중도 종료됐다.

### **8.3 이후 회복은 있었지만 단조롭지 않았다**

Progression 영상의 중도 종료 skill 수는 다음과 같다.

| $K$ | 600 | 650 | 700 | 750 | 800 | 850 | 900 | 950 | 1000 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 | 0 | 9 | 0 | 0 | 0 | 0 | 0 | 0 | 1 |
| 20 | 0 | 20 | 12 | 0 | 1 | 0 | 0 | 0 | 0 |
| 30 | 0 | 30 | 6 | 6 | 1 | 0 | 1 | 0 | 0 |

이 표는 checkpoint마다 skill별 deterministic episode 하나를 집계한 결과다. 아래 9절의 최종 수치는 skill당 5 episode이므로 서로 대체하지 않는다.

K=20과 K=30은 650에서 전부 무너진 뒤 일부 checkpoint에서 다시 20초를 채웠다. 그러나 K=30은 750에서 6개가 종료되고 850에서 0개가 된 뒤 900에서 다시 1개가 종료됐다. 회복은 단조롭지 않았다.

### **8.4 전체 progression 영상**

<img src="/assets/img/posts/rl/dads-unitree-go2-experiment/posters/06-k10-progression.jpg"
     data-dads-gif-src="https://media.iamjaehka13.blog/assets/img/posts/rl/dads-unitree-go2-experiment/06-k10-progression.gif"
     alt="DADS K=10 iteration 600부터 1000까지 50 iteration 간격의 전체 20초 skill progression"
     width="800" height="338"
     decoding="async"
     class="d-block mx-auto"
     style="width: 100%; border-radius: 6px; margin: 1rem auto;">

<img src="/assets/img/posts/rl/dads-unitree-go2-experiment/posters/07-k20-progression.jpg"
     data-dads-gif-src="https://media.iamjaehka13.blog/assets/img/posts/rl/dads-unitree-go2-experiment/07-k20-progression.gif"
     alt="DADS K=20 iteration 600부터 1000까지 overlap collapse recovery를 포함한 전체 20초 skill progression"
     width="960" height="432"
     decoding="async"
     class="d-block mx-auto"
     style="width: 100%; border-radius: 6px; margin: 1rem auto;">

<img src="/assets/img/posts/rl/dads-unitree-go2-experiment/posters/08-k30-progression.jpg"
     data-dads-gif-src="https://media.iamjaehka13.blog/assets/img/posts/rl/dads-unitree-go2-experiment/08-k30-progression.gif"
     alt="DADS K=30 iteration 600부터 1000까지 반복 collapse와 recovery를 포함한 전체 20초 skill progression"
     width="960" height="450"
     decoding="async"
     class="d-block mx-auto"
     style="width: 100%; border-radius: 6px; margin: 1rem auto;">

*각 GIF는 iteration 600, 650, …, 1000의 모든 skill 20초 영상을 이어 붙였다.*

---

## **9. 최종 $K=10,20,30$과 반복 skill 조합**

### **9.1 Model 1000에서는 일부 회복했다**

| $K$ | Episode 완료 | 중도 종료 | 최저 skill 평균 높이 | 이동 skill | 최대 skill 평균 변위 | Posterior accuracy |
|---:|---:|---:|---:|---:|---:|---:|
| 10 | 45/50 | 5 tilt | 0.3179 m | 8/10 | 7.019 m | 64.94% |
| 20 | 100/100 | 0 | 0.3144 m | 11/20 | 10.376 m | 65.76% |
| 30 | 149/150 | 1 low-height | 0.3326 m | 12/30 | 2.190 m | 19.40% |

K=20은 모든 episode를 채웠고 가장 먼 skill의 평균 변위도 컸다. 하지만 최저 skill 평균 높이가 0.32 m 아래였다. K=30은 최저 skill 평균 높이 기준은 넘었지만, 한 episode가 low-height로 종료됐다. K=10은 다섯 번의 tilt가 있었다.

### **9.2 같은 selector로 870개 ordered pair를 다시 비교했다**

$K=30$ model 1000의 policy를 고정하고 서로 다른 두 skill의 ordered pair $30\times29=870$개를 모두 실행했다.

```text
skill A 2초 -> skill B 2초
-> 4초 cycle을 5회 반복

policy update 없음
action blending 없음
goal direction command 없음
정확히 1000 policy transition
1001 state sample
9번의 skill switch
```

Pair를 본 뒤 임의로 고르지 않기 위해 DIAYN과 DADS에 같은 selector를 적용했다. 이는 DIAYN 글의 초기 탐색에서 선택한 `z22 ↔ z17`을 그대로 재사용한 것이 아니다. 두 알고리즘을 같은 기준으로 비교하기 위해 870개 pair를 다시 평가했고, 이 protocol에서 DIAYN의 자동 1위는 `z23 → z24`였다. 먼저 다음 axis-free line gate를 만족해야 했다.

- 중도 종료와 fall 없음
- 순이동 1 m 이상
- path efficiency 0.75 이상
- 최대 cross-track / 순이동 0.15 이하
- 같은 방향으로 진행한 cycle 비율 0.80 이상
- cycle 평균 방향 정렬도 0.85 이상
- 최저 높이 0.30 m 이상

Gate를 통과한 후보는 다음 점수로 정렬했다.

$$
\text{score}
=D\eta
-0.50e_{\mathrm{RMS}}
-0.25e_{\max}
+0.50f_{\mathrm{cycle}+}
+0.50\bar{c}_{\mathrm{align}}
-0.02J_{\max}
$$

동일 selector의 자동 1위는 DADS `z11 → z18`, DIAYN `z23 → z24`였다.

DADS에서는 870개 중 865개가 1000 transition을 모두 실행했고 5개는 low-height 또는 tilt로 조기 종료됐다. 정확한 horizon을 끝까지 채우고 line gate까지 통과한 pair는 10개였다. DIAYN은 870개가 모두 완주했고 132개가 같은 gate를 통과했다. 아래 자동 1위 두 pair는 모두 1000 transition을 정확히 실행했다.

| 지표 | DADS `z11→z18` | DIAYN `z23→z24` |
|---|---:|---:|
| 순이동 $D$ | 2.316 m | 9.715 m |
| Path efficiency $\eta$ | 0.8945 | 0.9798 |
| RMS cross-track | 0.138 m | 0.345 m |
| 최대 cross-track | 0.248 m | 0.533 m |
| 최대 cross-track / 순이동 | 10.69% | 5.48% |
| Cycle 5회 평균 정렬도 | 0.9719 | 0.9938 |
| Cycle progress 변동계수 | 19.47% | 1.12% |
| 최저 높이 | 0.3280 m | 0.3144 m |
| 최대 switch action jump L2 | 2.697 | 3.814 |
| Axis-free score | 2.873 | 10.134 |

<img src="/assets/img/posts/rl/dads-unitree-go2-experiment/posters/09-diayn-composition.jpg"
     data-dads-gif-src="https://media.iamjaehka13.blog/assets/img/posts/rl/dads-unitree-go2-experiment/09-diayn-composition.gif"
     alt="동일 exact-1000 selector가 고른 DIAYN z23과 z24의 고정 실행 및 2초 반복 조합 3-panel 비교"
     width="960" height="180"
     class="d-block mx-auto"
     style="width: 100%; border-radius: 6px; margin-bottom: 1rem;">

*DIAYN exact-1000 자동 선택 결과. 고정 `z23`, 고정 `z24`, `z23↔z24` 반복을 같은 20초 horizon에서 비교한다.*

<img src="/assets/img/posts/rl/dads-unitree-go2-experiment/posters/10-dads-composition.jpg"
     data-dads-gif-src="https://media.iamjaehka13.blog/assets/img/posts/rl/dads-unitree-go2-experiment/10-dads-composition.gif"
     alt="동일 exact-1000 selector가 고른 DADS z11과 z18의 고정 실행 및 2초 반복 조합 3-panel 비교"
     width="960" height="180"
     class="d-block mx-auto"
     style="width: 100%; border-radius: 6px;">

*DADS exact-1000 자동 선택 결과. 오른쪽 반복 조합은 cycle 5회 모두 같은 선 방향으로 진행했다.*

위 표는 870개 pair를 함께 평가한 screening 결과이고, GIF는 선택된 pair를 두 고정 skill과 함께 별도로 다시 기록한 결과다. 3-panel 기록에서 DADS 반복 조합은 2.383 m, DIAYN 반복 조합은 9.676 m를 순이동하며 중도 종료 없이 20초를 채웠다.

DIAYN의 고정 `z23`과 `z24`는 각각 10.506 m와 9.210 m의 긴 원형 경로를 그렸지만, 순이동은 0.995 m와 2.738 m에 그쳤다. 같은 두 skill을 2초씩 번갈아 실행하자 경로 길이 9.896 m 중 9.676 m가 대각선 순이동으로 누적됐다.

DADS pair는 절대 RMS cross-track이 더 작지만 이동 거리도 훨씬 짧다. 거리로 정규화하면 DIAYN pair의 최대 cross-track 비율이 더 낮다. DIAYN pair는 cycle별 진행량도 더 일정했고, 동일한 scoring rule로 계산한 score도 10.134 대 2.873이었다.

---

## **10. 이 실험에서 배운 것**

### **10.1 같은 feature라도 objective가 다르면 결과가 달라진다**

DIAYN은 feature에서 skill ID를 분류하기 쉬운 상태를 만든다. DADS는 현재 상태와 skill을 조건으로 delta density를 학습한다. 18D dynamic feature라는 이름이 같아도 최적화 대상은 다르다.

DIAYN은 model 550–575에서 두 이동 mode가 이어졌다. DADS는 model 550의 2/6이 575에서 0/6으로 줄었고, model 600에서 1/6만 다시 이동했다.

### **10.2 Predictable은 useful과 같은 말이 아니다**

느리게 움직이기, 제자리에서 주기적으로 다리를 흔들기, 일정한 자세 변화를 반복하기도 예측 가능하다. DADS의 diversity term이 모든 skill collapse를 막더라도 사람이 원하는 locomotion quality를 직접 보장하지 않는다.

### **10.3 Representation은 여전히 행동 명세다**

```text
dx, dy, dyaw를 예측
-> yaw 차이도 skill identity가 될 수 있음

dx, dy만 예측
-> planar motion 차이에 더 직접적인 압력

18D dynamic delta를 예측
-> base motion과 joint velocity 차이를 모두 사용할 수 있음
```

Unsupervised skill discovery에서도 model에 어떤 state와 delta를 입력할지 정하는 순간, 무엇을 서로 다른 behavior로 간주할지도 함께 정해진다.

### **10.4 $K$는 repertoire 품질의 단조로운 knob가 아니다**

K=30은 label이 가장 많았지만 final posterior accuracy가 19.40%로 가장 낮았고, 이동 skill은 12/30이었다. K=20은 11/20이 이동했지만 height gate를 통과하지 못했다. 더 많은 latent가 더 많은 좋은 gait를 뜻하지 않았다.

### **10.5 Composition은 exact horizon과 selector가 필요하다**

20초처럼 보여도 1000 transition인지, 1001 state sample인지, switch가 몇 번인지가 다르면 pair를 공정하게 비교하기 어렵다. 이번에는 두 알고리즘 모두 870개 pair, 2+2초 dwell, cycle 5회, exact 1000 transition에 동일한 scoring rule을 적용했다.

그 결과 수동으로 보기 좋은 pair를 고르는 대신, 재현 가능한 자동 선택 결과를 얻었다.

---

## **11. 실험의 한계**

- Training seed는 1개다.
- 원 DADS의 EC-SAC 대신 PPO를 유지했다.
- C와 D는 diversity gate를 통과하지 못한 source에서 이어 간 고정 구간 진단이다.
- 이동 skill 수는 endpoint 0.5 m 기준이며, contact sequence·phase·energy는 분석하지 않았다.
- Composition은 2초 dwell과 한 초기조건의 open-loop schedule이며 MPC가 아니다.
- 정량 평가는 clean deterministic simulation과 skill당 5 episode가 중심이다.

---

## **12. 결론**

DIAYN 실험과 같은 Go2, PPO, schedule, safety arm, $K$, 영상과 평가 항목을 유지하고 objective를 DADS로 바꿨다. 목적은 **skill discovery objective에 따라 실험 tree의 어느 지점에서 결과가 갈리는지 보는 것**이었다.

첫 번째 교훈은 reward의 시간 단위가 중요하다는 점이었다. Intrinsic reward에 `dt`를 곱하지 않으면 raw DADS branch가 빠르게 무너졌다. 단위를 맞추자 model 700은 살아났지만, 800에서 다시 실패했다.

두 번째 교훈은 transition objective도 쉬운 해를 찾는다는 점이다. 18D dynamic delta를 사용하면 일부 이동 skill이 자연스럽게 늘어날 것이라 예상했지만, model 600에서 이동 gate를 넘은 것은 1/6뿐이었다. Predictability는 반복 가능한 변화를 요구하지만, 그 변화가 걷기일 필요는 없다.

K 확장에서는 650 collapse와 이후 회복이 나타났고, exact-1000 조합에서는 DADS의 `z11→z18`이 선형 누적 조건을 만족했다.

다음 절의 scratch matched 실험에서는 $K=30$ height+roll treatment가 150/150 episode를 채우고 12개 이동 skill을 남겼다.

> **같은 Go2 실험 tree에서 transition predictability로 목적을 바꾸면 학습 경로와 최종 repertoire가 달라졌다. 그러나 representation, 안전 제약, gate와 초기화가 여전히 결과를 크게 결정했고, 예측 가능성만으로 유용한 보행을 보장할 수는 없었다.**

---

## **13. 후속 실험: 높이와 roll을 처음부터 함께 억제하면 무엇이 남는가?**

A–D는 공통 $K=6$ 계보에서 출발하거나 그 checkpoint를 확장했다. E 실험은 각 $K$의 actor·critic·dynamics model을 무작위로 초기화해 iteration 0부터 학습했다.

각 $K$마다 하나의 model 0을 만든 뒤 optimizer update 전에 두 arm으로 갈랐다.

| 구분 | Height-only control | Height + roll treatment |
|---|---|---|
| $K$ | 10, 20, 30 | 10, 20, 30 |
| 시작 | 각 $K$의 공통 무작위 초기화 model 0 | control과 완전히 같은 model 0 |
| Schedule | 0–499 support, 500–699 crossfade, 700–1000 pure DADS | 동일 |
| Height mean floor | 0.32 m | 0.32 m |
| Height tail threshold | 0.28 m | 0.28 m |
| Persistent termination | 0.28 m 미만 0.50초 | 동일 |
| Roll square | 없음 | -20 |
| Mean absolute roll target | 없음 | 5° |
| Roll tail threshold | 없음 | 10° |
| 최종 평가 | clean deterministic, skill당 5 episode | 동일 |

### **13.1 Pure DADS 시작점인 model 700에서는 두 arm 모두 불안정했다**

| $K$ | Control 생존 / 이동 | Treatment 생존 / 이동 | 평균 절대 roll control→treatment |
|---:|---:|---:|---:|
| 10 | 50/50 · 0/10 | 45/50 · 1/10 | — |
| 20 | 100/100 · 9/20 | 82/100 · 3/20 | 10.26→2.73° |
| 30 | 140/150 · 13/30 | 119/150 · 1/30 | 10.63→1.61° |

Treatment는 K=20과 K=30에서 평균 절대 roll을 줄였지만, K=10에서 5개, K=20에서 18개, K=30에서 31개 episode가 종료됐다. 자세 지표 하나가 좋아졌다고 model 700을 성공으로 판단할 수 없었다.

### **13.2 Model 1000에서 K=30 treatment가 회복했다**

| $K$ / arm | 완료 | 종료 | 이동 skill | 최저 skill 평균 높이 | 평균 절대 roll | 최대 skill 평균 변위 | Gate |
|---|---:|---:|---:|---:|---:|---:|---|
| 10 control | 40/50 | 10 tilt | 5/10 | 0.3207 m | 5.153° | 2.557 m | NO-GO |
| 10 treatment | 45/50 | 5 tilt | 2/10 | 0.3411 m | 0.936° | 1.508 m | NO-GO |
| 20 control | 95/100 | 5 tilt | 10/20 | 0.3176 m | 7.636° | 6.420 m | NO-GO |
| 20 treatment | 95/100 | 5 tilt | 9/20 | 0.3488 m | 0.884° | 5.531 m | NO-GO |
| 30 control | 145/150 | 5 tilt | 13/30 | 0.3125 m | 9.682° | 3.919 m | NO-GO |
| 30 treatment | **150/150** | **0** | **12/30** | **0.3318 m** | **1.293°** | **4.492 m** | **PASS** |

K=10 treatment는 평균 roll을 81.8% 줄였지만 한 skill이 다섯 episode 모두 늦게 tilt로 종료됐다. K=20 treatment도 model 700의 18개 종료에서 model 1000의 5개 종료로 회복했지만 NO-GO다.

K=30 treatment는 model 700의 31개 종료·이동 1/30에서 model 1000의 종료 0·이동 12/30으로 바뀌었다. 최저 관측 높이는 0.3248 m, 최대 절대 roll은 6.949°였다. 최종 gate를 유일하게 통과했다.

<img src="/assets/img/posts/rl/dads-unitree-go2-experiment/posters/11-e-k10-model1000.jpg"
     data-dads-gif-src="https://media.iamjaehka13.blog/assets/img/posts/rl/dads-unitree-go2-experiment/11-e-k10-model1000.gif"
     alt="DADS scratch K=10 height-only control과 height plus roll treatment의 model 1000 전체 skill 비교"
     width="960" height="812"
     decoding="async"
     class="d-block mx-auto"
     style="width: 100%; border-radius: 6px; margin: 1rem auto;">

<img src="/assets/img/posts/rl/dads-unitree-go2-experiment/posters/12-e-k20-model1000.jpg"
     data-dads-gif-src="https://media.iamjaehka13.blog/assets/img/posts/rl/dads-unitree-go2-experiment/12-e-k20-model1000.gif"
     alt="DADS scratch K=20 height-only control과 height plus roll treatment의 model 1000 전체 skill 비교"
     width="960" height="864"
     decoding="async"
     class="d-block mx-auto"
     style="width: 100%; border-radius: 6px; margin: 1rem auto;">

K=30 비교는 글 첫머리의 대표 영상과 같다.

*각 GIF의 위쪽은 control, 아래쪽은 treatment다. 같은 칸은 같은 skill ID이고 모두 20초 horizon이다.*

### **13.3 K=30 trajectory에서 무엇을 볼 수 있나?**

<img src="https://media.iamjaehka13.blog/assets/img/posts/rl/dads-unitree-go2-experiment/14-e-k30-trajectories.png"
     alt="DADS scratch K=30 height-only control과 height plus roll treatment model 1000의 skill별 clean body-frame XY trajectory"
     width="1400" height="700"
     class="d-block mx-auto"
     style="width: 100%; border-radius: 6px;">

*각 skill의 첫 clean episode trajectory다. 왼쪽은 control, 오른쪽은 treatment다.*

5-episode endpoint 평가에서 treatment의 12개 skill이 0.5 m gate를 넘었고, 거리와 곡률도 서로 달랐다. 가까운 trajectory와 느린 mode도 남았다.

### **13.4 50 iteration마다 전체 과정을 보기**

<img src="/assets/img/posts/rl/dads-unitree-go2-experiment/posters/15-e-k10-progression.jpg"
     data-dads-gif-src="https://media.iamjaehka13.blog/assets/img/posts/rl/dads-unitree-go2-experiment/15-e-k10-progression-web-800w-2fps-128c.gif"
     alt="DADS scratch K=10 height-only와 height plus roll pair의 iteration 50부터 1000까지 전체 progression"
     width="960" height="812"
     decoding="async"
     class="d-block mx-auto"
     style="width: 100%; border-radius: 6px; margin: 1rem auto;">

<img src="/assets/img/posts/rl/dads-unitree-go2-experiment/posters/16-e-k20-progression.jpg"
     data-dads-gif-src="https://media.iamjaehka13.blog/assets/img/posts/rl/dads-unitree-go2-experiment/16-e-k20-progression-web-800w-2fps-128c.gif"
     alt="DADS scratch K=20 height-only와 height plus roll pair의 iteration 50부터 1000까지 전체 progression"
     width="960" height="864"
     decoding="async"
     class="d-block mx-auto"
     style="width: 100%; border-radius: 6px; margin: 1rem auto;">

<img src="/assets/img/posts/rl/dads-unitree-go2-experiment/posters/17-e-k30-progression.jpg"
     data-dads-gif-src="https://media.iamjaehka13.blog/assets/img/posts/rl/dads-unitree-go2-experiment/17-e-k30-progression-web-800w-2fps-128c.gif"
     alt="DADS scratch K=30 height-only와 height plus roll pair의 iteration 50부터 1000까지 전체 progression"
     width="960" height="900"
     decoding="async"
     class="d-block mx-auto"
     style="width: 100%; border-radius: 6px; margin: 1rem auto;">

*Iteration 50, 100, …, 1000에서 같은 위아래 layout으로 모든 skill을 20초씩 기록했다. 짧은 snapshot 대신 지연 종료와 회복을 함께 볼 수 있다.*

K=10과 K=20에는 실패가 남았지만, K=30 treatment는 안전 지표를 만족하면서 endpoint 이동도 보였다.

<style>
  .dads-gif-frame {
    position: relative;
    display: block;
    overflow: hidden;
    border-radius: 6px;
  }

  .dads-gif-frame[data-dads-gif-state="loading"]::after,
  .dads-gif-frame[data-dads-gif-state="error"]::after {
    position: absolute;
    right: 0.65rem;
    bottom: 0.65rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    background: rgb(0 0 0 / 72%);
    color: #fff;
    font-size: 0.78rem;
    line-height: 1.35;
    pointer-events: none;
  }

  .dads-gif-frame[data-dads-gif-state="loading"]::after {
    content: "GIF 불러오는 중";
  }

  .dads-gif-frame[data-dads-gif-state="error"]::after {
    content: "GIF 로딩 실패";
  }
</style>

<script>
  (() => {
    const images = [...document.querySelectorAll('img[data-dads-gif-src]')];
    if (images.length === 0) return;

    let activeImage = null;
    let pendingImage = null;
    let activationTimer = null;
    let scrollIdleTimer = null;
    let scrolling = false;
    let updateScheduled = false;
    let ready = document.readyState !== 'loading';

    const frameOf = (image) => image.closest('a.img-link') || image.parentElement;

    const showPoster = (image) => {
      const poster = image.dataset.dadsGifPoster;
      image.loading = 'lazy';
      if (image.getAttribute('src') !== poster) image.setAttribute('src', poster);

      const frame = frameOf(image);
      if (frame) {
        frame.dataset.dadsGifState = 'poster';
        frame.removeAttribute('aria-busy');
      }
    };

    const playGif = (image) => {
      const source = image.dataset.dadsGifSrc;
      if (image.getAttribute('src') === source) return;

      const frame = frameOf(image);
      if (frame) {
        frame.dataset.dadsGifState = 'loading';
        frame.setAttribute('aria-busy', 'true');
      }
      image.loading = 'eager';
      image.setAttribute('src', source);
    };

    const cancelPendingImage = () => {
      window.clearTimeout(activationTimer);
      activationTimer = null;
      pendingImage = null;
    };

    const selectImage = (nextImage) => {
      if (nextImage === activeImage && pendingImage === null) return;
      if (nextImage !== null && nextImage === pendingImage) return;
      cancelPendingImage();

      if (activeImage) showPoster(activeImage);
      activeImage = null;

      if (!nextImage) return;

      pendingImage = nextImage;
      activationTimer = window.setTimeout(() => {
        if (pendingImage !== nextImage) return;
        pendingImage = null;
        activeImage = nextImage;
        playGif(activeImage);
      }, 350);
    };

    const updateActiveImage = () => {
      updateScheduled = false;
      if (!ready) return;

      if (document.hidden) {
        selectImage(null);
        return;
      }

      const viewportCenter = window.innerHeight / 2;
      const visible = images
        .map((image) => ({ image, rect: image.getBoundingClientRect() }))
        .filter(({ rect }) => rect.bottom > 0 && rect.top < window.innerHeight)
        .sort((a, b) => {
          const aCenter = (a.rect.top + a.rect.bottom) / 2;
          const bCenter = (b.rect.top + b.rect.bottom) / 2;
          return Math.abs(aCenter - viewportCenter) - Math.abs(bCenter - viewportCenter);
        });

      const nextImage = visible.length > 0 ? visible[0].image : null;

      if (scrolling) {
        cancelPendingImage();
        if (activeImage && activeImage !== nextImage) {
          showPoster(activeImage);
          activeImage = null;
        }
        return;
      }

      selectImage(nextImage);
    };

    const scheduleUpdate = () => {
      if (updateScheduled) return;
      updateScheduled = true;
      window.requestAnimationFrame(updateActiveImage);
    };

    const handleScroll = () => {
      scrolling = true;
      cancelPendingImage();
      window.clearTimeout(scrollIdleTimer);
      scheduleUpdate();

      scrollIdleTimer = window.setTimeout(() => {
        scrolling = false;
        scheduleUpdate();
      }, 250);
    };

    document.querySelectorAll('article a.popup').forEach((anchor, index) => {
      anchor.dataset.gallery = `dads-media-${index}`;
    });

    images.forEach((image) => {
      image.dataset.dadsGifPoster = image.getAttribute('src');

      const frame = frameOf(image);
      if (frame) {
        frame.href = image.dataset.dadsGifSrc;
        frame.classList.add('dads-gif-frame');
        frame.dataset.dadsGifState = 'poster';
      }

      image.addEventListener('load', () => {
        if (image.getAttribute('src') !== image.dataset.dadsGifSrc) return;
        const loadedFrame = frameOf(image);
        if (loadedFrame) {
          loadedFrame.dataset.dadsGifState = 'playing';
          loadedFrame.removeAttribute('aria-busy');
        }
      });

      image.addEventListener('error', () => {
        if (image.getAttribute('src') !== image.dataset.dadsGifSrc) return;
        const failedFrame = frameOf(image);
        image.setAttribute('src', image.dataset.dadsGifPoster);
        if (failedFrame) {
          failedFrame.dataset.dadsGifState = 'error';
          failedFrame.removeAttribute('aria-busy');
        }
      });
    });

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    document.addEventListener('visibilitychange', scheduleUpdate);

    if (ready) {
      scheduleUpdate();
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        ready = true;
        scheduleUpdate();
      }, { once: true });
    }
  })();
</script>

<noscript>
  <p><a href="https://media.iamjaehka13.blog/assets/img/posts/rl/dads-unitree-go2-experiment/13-e-k30-model1000.gif">대표 K=30 GIF 원본 보기</a></p>
</noscript>
