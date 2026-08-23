---
title: "[DIAYN 실험] Go2는 보행 보상 없이 스킬을 발견할까?"
date: 2026-08-23 18:00:00 +0900
last_modified_at: 2026-08-23 20:31:22 +0900
categories: [RL, Study]
tags: [diayn, unitree-go2, unsupervised-reinforcement-learning, skill-discovery, intrinsic-reward, quadruped-locomotion, ppo, isaac-gym]
description: "DIAYN을 Unitree Go2 시뮬레이션에 적용해 자세 shortcut, 안전 제약, 관측 ablation, K=10·20·30 확장과 frozen skill 반복 전환에서 확인한 결과와 한계를 정리한다."
math: true
image:
  path: https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-unitree-go2-experiment/00-preview.png
  alt: DIAYN의 K=20 latent skill이 서로 다른 Unitree Go2 움직임으로 분화된 clean simulation 평가
---

## **0. 결과부터 보기**

이 실험에서 확인하고 싶었던 것은 단순했다.

> **앞으로 가라는 보상도, 특정 속도로 걸으라는 보상도 주지 않았을 때 Unitree Go2의 latent skill 중 일부가 스스로 이동 행동으로 분화하는가?**

결과는 **조건부로 그렇다**였다. 기존 locomotion motor prior에서 시작해 DIAYN discriminator에 동적인 상태만 보여 주자, 일부 latent가 지속적인 평면 이동·곡선 이동·회전 행동으로 분화했다. 반면 모든 latent가 서로 다른 gait가 된 것은 아니다. 느린 mode와 겹치는 mode도 남았다.

학습을 끝낸 $K=30$ policy에서 `z22`와 `z17`을 2초씩 반복 전환한 후속 평가에서는, 한 대각선 방향으로 거의 직선인 이동이 누적됐다. 이는 새 policy를 학습한 결과가 아니라 발견된 두 skill을 시간 순서로 연결한 한 사례다.

아래는 $K=20$, iteration 1000의 clean deterministic 평가다. 각 칸은 같은 policy에 서로 다른 one-hot skill ID만 넣은 결과다.

<img src="https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-unitree-go2-experiment/07-k20-recovery.gif"
     alt="K=20 iteration 1000에서 서로 다른 이동과 회전 행동으로 분화한 Unitree Go2 latent skill 20개"
     width="800" height="360"
     class="d-block mx-auto"
     style="width: 100%; border-radius: 6px;">

*K=20, iteration 1000, seed 1. Observation noise·friction randomization·external push를 모두 끈 clean deterministic 20초 평가 중 8초 구간.*

최종 checkpoint를 skill마다 5 episode씩 다시 평가한 결과는 다음과 같다.

| Latent 수 | Episode | 중도 종료 | 전체 최저 높이 | Skill 평균 평면속도 범위 | Discriminator 정확도 범위 |
|---:|---:|---:|---:|---:|---:|
| $K=10$ | 50 | 0 | 0.3156 m | 0.1663–0.5263 m/s | 97.96–99.50% |
| $K=20$ | 100 | 0 | 0.3100 m | 0.1897–0.5524 m/s | 96.68–99.34% |
| $K=30$ | 150 | 0 | 0.3087 m | 0.0718–0.5193 m/s | 93.53–98.30% |

여기서 가장 중요한 문장은 다음 두 개다.

> **보행 방향·속도 reward 없이 일부 locomotion-like mode가 나타났다.**

> **높은 분류 정확도는 10개·20개·30개의 독립적인 gait를 발견했다는 뜻이 아니다.**

이 글은 [DIAYN 이론편](/posts/diayn-diversity-is-all-you-need/)에서 정리한 원리를 실제 Go2 simulation에 옮기며 겪은 구현 오류, shortcut, 안전성 실험, feature ablation, $K$ 확장 과정을 기록한다.

---

## **1. 이 실험은 무엇을 재현한 것인가?**

[DIAYN 논문](https://arxiv.org/abs/1802.06070)은 외부 task reward 없이 skill-conditioned policy가 서로 구별되는 상태 분포를 만들도록 학습한다. 핵심 구성은 다음과 같다.

$$
\pi_\theta(a\mid s,z), \qquad
r_{\text{DIAYN}}=\log q_\phi(z\mid f(s))-\log p(z)
$$

균등 prior $p(z)=1/K$를 사용하면 intrinsic reward는 다음처럼 쓸 수 있다.

$$
r_{\text{DIAYN}}=\log q_\phi(z\mid f(s))+\log K
$$

Policy는 어떤 skill $z$가 주어졌는지 알고 행동한다. Discriminator는 행동 결과의 feature $f(s)$만 보고 어떤 $z$였는지 맞힌다. Policy는 discriminator가 맞히기 쉬운 서로 다른 상태를 만드는 방향으로 학습된다.

그러나 이 실험은 원 논문의 benchmark를 그대로 복제한 것은 아니다.

| 구분 | 원 논문 | 이 실험 |
|---|---|---|
| Base RL | Maximum-entropy SAC | PPO |
| 대표 환경 | Ant, HalfCheetah, Hopper 등 | Unitree Go2, Isaac Gym simulation |
| 출발점 | 환경별 unsupervised training | 이미 locomotion capability가 있는 motor prior |
| Skill feature | 환경 state | 여러 후보를 ablation한 뒤 18D dynamic state |
| 추가 조건 | DIAYN 목적과 entropy | 물리 penalty, 저상 자세 termination, chance constraint |

따라서 정확한 질문은 **“DIAYN이 Go2 보행을 무에서 발명했는가?”**가 아니다.

> **이미 기본적인 관절 협응을 가진 Go2 policy 위에서, 외부 보행·방향·속도 reward 없이 latent가 행동 repertoire를 분할하는가?**

이 범위가 중요한 이유는 pretrained motor prior가 접촉과 관절 협응의 출발점을 제공하기 때문이다. 이번 결과만으로 DIAYN이 quadruped locomotion을 처음부터 학습했다고 말할 수는 없다.

또한 이 글에서 **보행 보상 없이**라는 표현은 다음을 뜻한다.

- 전진 방향 reward 없음
- 목표 속도 tracking reward 없음
- yaw command tracking reward 없음
- skill별 목표 궤적 없음
- DIAYN intrinsic reward는 있음
- 넘어짐·비정상 자세를 막는 물리 안전장치는 있음

즉 **reward 자체가 없는 것**이 아니라, 원하는 gait를 직접 지정하는 **외부 task reward가 없는 것**이다.

---

## **2. Go2에 DIAYN을 붙인 방법**

### **2.1 Policy 입력에만 skill을 추가했다**

기존 Go2 observation은 48차원이다. 여기에 one-hot skill $z$를 붙였다.

```text
actor observation = [Go2 observation 48D, one-hot skill K]

K=6  -> 54D
K=10 -> 58D
K=20 -> 68D
K=30 -> 78D
```

Skill은 environment가 reset될 때 균등하게 샘플링하고, 한 episode 동안 고정했다. Command는 항상 다음과 같이 두었다.

```text
vx command = 0
vy command = 0
yaw-rate command = 0
```

중요한 구현 원칙은 discriminator에 one-hot $z$를 넣지 않는 것이다.

```python
# policy는 skill ID를 알아야 한다.
actor_obs = concat(robot_obs, one_hot_z)

# discriminator는 행동 결과만 보고 skill ID를 맞혀야 한다.
disc_obs = select_behavior_features(robot_state)
```

만약 `disc_obs`에 $z$가 들어가면 label leakage가 생긴다. 분류 정확도는 높아져도 policy가 서로 다른 행동을 만들 이유가 사라진다.

### **2.2 기존 motor prior를 손상시키지 않고 시작했다**

48D locomotion checkpoint의 actor·critic 첫 layer를 $48+K$차원으로 확장했다.

- 기존 48개 입력 열은 그대로 복사
- 새 one-hot skill 열은 0으로 초기화
- 확장 직후에는 모든 skill이 같은 motor behavior에서 시작
- discriminator 출력도 균등분포 $q(z\mid f)=1/K$에서 시작하도록 초기화

이 방식은 “새 skill ID가 들어왔다는 이유만으로 policy 출력이 갑자기 변하는 것”을 막는다. 이후 행동 차이는 DIAYN 학습으로 생겨야 한다.

### **2.3 PPO와 discriminator를 분리했다**

PPO는 policy와 value function을 업데이트하고, 별도 optimizer가 discriminator를 업데이트했다. Policy reward로 넘기는 discriminator 출력은 detach해 두 optimizer의 gradient 경로를 분리했다.

```text
rollout
  ├─ PPO: policy/value update
  └─ discriminator: skill classification update

log q(z|f(s)) + log K
  └─ detach 후 PPO reward로 사용
```

이 구현에서 policy timestep은 simulation timestep 0.005초에 control decimation 4를 적용한 0.02초, 즉 50 Hz다.

---

## **3. 공통 실험 조건과 판정 기준**

### **3.1 Training과 영상 평가는 다른 조건이다**

최종 $K=10,20,30$ training은 upstream 환경 설정을 상속했다.

| 조건 | Training | 이 글의 최종 영상·수치 평가 |
|---|---|---|
| Observation noise | 켬 | 끔 |
| Friction randomization | 켬, 0.5–1.25 | 끔, nominal |
| External push | 켬, 15초 간격 설정 | 끔 |
| Policy action | stochastic | deterministic mean |
| Episode 길이 | 20초 | 20초 |

여기서 noise·friction·push는 **robustness를 증명하기 위해 새로 넣은 실험 변인**이 아니다. 기존 training 환경이 상속한 조건이다. 최종 결론은 모두 disturbance를 끈 clean deterministic 평가를 기준으로 냈다.

### **3.2 분류 정확도 하나로 성공을 판정하지 않았다**

평가에는 최소한 다음 네 축이 필요했다.

1. **Safety**: 20초를 끝까지 버티는가, base contact·tilt·low-height termination이 없는가?
2. **Posture**: 몸체 높이가 장시간 무너지지 않는가?
3. **Behavior**: 실제 평면 이동이나 회전 mode가 나타나는가?
4. **Separability**: discriminator가 dynamic feature에서 skill을 구별하는가?

초기 gate에서는 checkpoint마다 skill당 5 episode, 총 30 episode를 평가했다. $K$ 확장 progression 영상은 checkpoint마다 skill당 20초 한 episode를 기록했다. 최종 model 1000은 skill당 5 episode를 별도로 평가했다.

이 구분이 없으면 다음과 같은 잘못된 결론을 내리기 쉽다.

```text
q accuracy 99%
-> skill discovery 성공?

실제 행동 확인
-> 6개 모두 거의 정지, 관절 자세만 조금씩 다름
```

---

## **4. 시도한 실험 전체 지도**

<img src="https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-unitree-go2-experiment/01-experiment-map-v2.svg"
     alt="yaw shortcut, 저상 자세, 정적 자세를 제거하고 dynamic state와 chance constraint를 거쳐 K를 확장한 Go2 DIAYN 실험 흐름"
     width="1400" height="900"
     class="d-block mx-auto"
     style="width: 100%; border-radius: 6px;">

*한 번에 여러 조건을 바꾸지 않고, 공통 checkpoint에서 한 변인씩 분리했다.*

| 순서 | 바꾼 것 | 관찰 | 판단 |
|---:|---|---|---|
| 1 | 초기 3D 변위 feature | iteration 850에서 일부 skill 종료 | 장기 5000회 중단 |
| 2 | DIAYN reward에 `dt=0.02` 적용 | 종료는 사라졌지만 1500까지 몸체가 낮아지고 이동 약화 | reward 단위는 고쳤으나 행동 품질 실패 |
| 3 | `dx,dy,dyaw` → `dx,dy` | yaw shortcut 감소, 평면 이동 증가 | yaw는 원인 중 하나 |
| 4 | Quadratic height penalty -50/-100/-200 | 강도를 올려도 자세·다양성 gate가 동시에 깨짐 | scalar coefficient만으로 부족 |
| 5 | Linear height hinge | 725 통과, 750에서 다시 low-height tail 증가 | 짧은 성공을 장기 안전으로 해석 불가 |
| 6 | Mean Lagrangian | 평균은 맞춰도 희귀하고 깊은 excursion이 남음 | tail을 별도로 봐야 함 |
| 7 | Mean + chance constraint | 725 통과, 750에서 일부 자세 gate 실패 | rollout 평균 제약도 보장은 아님 |
| 8 | Frozen anchor / no-anchor | anchor는 안전하지만 saturation·overlap, 제거하면 자세 붕괴 | 안전성과 freedom의 trade-off |
| 9 | 33D proprioceptive feature | q 약 99%, locomotion 0/6 | static posture shortcut |
| 10 | 18D dynamic feature | 일부 이동·회전 mode 발생 | 핵심 ablation 채택 |
| 11 | Dynamic + chance model 600 | clean gate 통과 | $K$ 확장 source로 채택 |
| 12 | $K=10,20,30$ | 초기 붕괴 뒤 750–850에서 재형성 | 합쳐진 뒤 다시 분화하는 과정 관찰 |

아래부터는 결론을 바꾼 분기만 자세히 본다.

---

## **5. 첫 실패: reward의 시간 단위가 달랐다**

첫 schedule은 다음과 같았다.

```text
iteration 0–500
  기존 standing / motor prior 유지

iteration 500–700
  task tracking reward 1 -> 0
  DIAYN reward 0 -> 1

iteration 700 이후
  task tracking 0
  DIAYN + physical prior
```

처음에는 700까지 버텼지만 850에서 skill 0은 5/5, skill 3은 3/5 episode가 종료됐다. 5000까지 계속 돌릴 근거가 없어서 중단했다.

코드를 다시 확인하니 기존 environment reward는 policy timestep $dt=0.02$초로 적분되는데 DIAYN intrinsic reward는 step마다 그대로 더해지고 있었다.

```text
physical reward term: scale × raw_reward × 0.02
DIAYN reward term:    scale × intrinsic_reward
```

동일 coefficient만 놓고 보면 시간 단위가 50배 어긋난 셈이다. 이를 다음처럼 수정했다.

$$
r_{\text{DIAYN,step}}
=
\left(\log q_\phi(z\mid f(s))+\log K\right)\,dt
$$

수정 후 iteration 600–1500 clean 평가에서는 30 episode 모두 종료 없이 버텼다. 그러나 이것도 성공은 아니었다.

| Iteration | 전체 평균 높이 | 0.5 m 이상 이동한 skill |
|---:|---:|---:|
| 900 | 0.321 m | 1/6 |
| 1200 | 0.249 m | 0/6 |
| 1400 | 0.243 m | 0/6 |
| 1500 | 0.241 m | 1/6 |

Policy는 넘어지지 않으면서 몸체를 낮추고, 제자리 동작이나 yaw 차이로 skill을 구별하고 있었다. **생존과 좋은 skill은 다른 문제**였다.

---

## **6. 왜 걷기보다 몸체를 낮추는 행동이 쉬웠나?**

DIAYN은 걷기를 보상하지 않는다. Discriminator가 skill을 잘 맞힐 수 있는 상태를 보상한다.

몸체를 낮추거나 특정 관절 자세를 유지하는 행동은 다음 이유로 유리하다.

- episode의 거의 모든 timestep에서 지속되는 강한 식별 신호다.
- 네 다리의 접촉 순서를 정교하게 맞출 필요가 없다.
- 이동 중 균형을 잃을 위험보다 최적화하기 쉽다.
- energy나 locomotion quality를 목적함수가 직접 평가하지 않는다.

반면 걷기는 stance와 swing을 주기적으로 바꾸고, 접촉 충격을 견디며, 몸체를 앞으로 이동시켜야 한다. 다양성만 최적화하면 crouch나 yaw가 더 싼 해법이 되는 것이 자연스럽다.

이것이 **“서로 다름”과 “사람이 원하는 skill”이 같지 않다**는 DIAYN의 핵심 한계다.

### **6.1 Yaw shortcut을 분리했다**

같은 model 500, 같은 PPO·physical penalty에서 discriminator 입력만 바꿨다.

| Arm | Discriminator feature | Checkpoint | 결과 |
|---|---|---:|---|
| Physical 3D | $dx,dy,d\psi$ | 600 | 이동 0/6, 최대 yaw 2.859 rad |
| Physical 3D | $dx,dy,d\psi$ | 700 | 3/30 episode 종료 |
| Planar | $dx,dy$ | 700 | 0/30 종료, 이동 5/6, 최대 변위 2.970 m |
| Planar | $dx,dy$ | 800 | 0/30 종료, 최저 skill 평균 높이 0.292 m |

Yaw를 빼자 평면 이동이 늘었다. 따라서 yaw가 쉬운 shortcut이었다는 가설은 지지됐다. 그러나 자세가 낮아지는 현상은 남았다. **한 shortcut을 제거하면 다음으로 쉬운 shortcut이 나타났다.**

### **6.2 높이 reward를 세게 하면 해결될까?**

공통 planar model 700에서 높이 penalty만 비교했다.

| 방식 | 결과 |
|---|---|
| Quadratic -50 | 2/30 종료, 최저 0.220 m |
| Quadratic -100 | 2/30 종료, 이동 3/6 |
| Quadratic -200 | 종료 0, 한 skill은 시간의 44.5%를 0.30 m 아래에서 보냄 |
| Linear hinge -4, model 725 | 모든 gate 통과 |
| Linear hinge -4, model 750 | skill 2 평균 0.306 m, 33.8%가 0.30 m 아래 |

Quadratic penalty는 경계 근처에서 gradient가 작아진다. Linear hinge는 0.32 m 아래에서 일정한 기울기를 주기 때문에 초기에는 나았지만, 더 학습하자 DIAYN 이득과 높이 손실을 다시 교환했다.

계수를 키우는 것은 hard constraint가 아니다. Policy는 더 큰 intrinsic reward를 얻을 수 있다면 여전히 자세를 희생할 수 있다.

### **6.3 Mean constraint만으로는 tail을 막지 못했다**

고정 height reward 대신 skill별 Lagrangian multiplier를 둔 arm도 만들었다. Mean cost만 제한하면 짧고 깊은 저상 자세가 긴 정상 구간 평균에 묻힐 수 있었다.

그래서 다음 두 cost를 분리했다.

$$
c_{\text{mean}}(h)=\frac{0.32-h}{0.02},
\qquad
c_{\text{tail}}(h)=\mathbf{1}[h<0.30]
$$

Skill별 목표는 다음과 같았다.

$$
\mathbb{E}[c_{\text{mean}}]\le 0,
\qquad
\mathbb{E}[c_{\text{tail}}]\le 0.01
$$

Chance arm은 model 725 clean gate를 통과했지만 model 750에서 일부 skill의 평균 높이가 다시 기준 아래로 내려갔다. Training distribution의 rollout 평균 constraint가 deterministic evaluation의 모든 skill과 모든 순간을 보장하지 않는다는 뜻이다.

### **6.4 Anchor는 안전했지만 skill 공간을 눌렀다**

다음 arm에서는 iteration 700 policy를 frozen anchor로 두고, 학습 policy가 anchor action에서 정규화 action 기준 $\pm0.20$만 벗어나도록 잘랐다.

```text
executed_action = anchor_action
                + clip(candidate_action - anchor_action, -0.20, 0.20)
```

`action_scale=0.25`이므로 추가 joint target은 관절당 최대 0.05 rad였다. Policy standard deviation도 0.10으로 제한했다.

- model 750 clean: 0/30 종료, 이동 6/6
- randomized seed 1–3: 0/90 종료
- deterministic residual saturation: 750의 18.0% → 950의 36.9%
- training rollout saturation: 970에서 42.8%

여기서 saturation은 motor torque saturation이 아니다. `candidate_mean_action - anchor_action`이 $\pm0.20$ 경계를 넘은 action component의 비율이다.

Policy가 계속 경계를 밀면서 일부 skill endpoint가 합쳐졌다. 반대로 matched no-anchor arm은 model 725에서 더 잘 갈라졌지만 750에서 stationary collapse와 low-height 종료가 돌아왔다.

> Anchor는 안전성을 높였지만 skill freedom을 줄였고, anchor를 빼면 다양성 공간은 넓어졌지만 쉬운 위험 행동이 다시 열렸다.

---

## **7. 결정적 ablation: discriminator에 무엇을 보여 줄 것인가**

### **7.1 33D proprioceptive state는 정적 자세를 발견했다**

처음에는 robot의 물리 상태를 넓게 보여 줬다.

```text
base linear velocity       3
base angular velocity      3
projected gravity          3
joint position error      12
joint velocity            12
-----------------------------
total                     33D
```

Model 550 결과는 겉으로 보면 훌륭했다.

- training discriminator accuracy: 97.3%
- clean discriminator accuracy: 99.3–99.7%
- 평균 평면속도: 0.0017–0.0022 m/s
- locomotion-like skill: 0/6

Discriminator는 서로 다른 정적 joint posture를 거의 완벽하게 분류했다. Policy 입장에서는 가장 안정적이고 쉬운 정답이었다.

<img src="https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-unitree-go2-experiment/12-proprioceptive-static-shortcut.gif"
     alt="33D proprioceptive discriminator가 높은 분류 정확도를 얻었지만 여섯 Go2 skill이 거의 이동하지 않는 정적 자세 shortcut"
     width="960" height="360"
     class="d-block mx-auto"
     style="width: 100%; border-radius: 6px;">

*33D proprioceptive model 550, clean deterministic 평가. 여섯 skill은 서로 다른 미세 자세를 유지하지만 8초 동안 거의 이동하지 않는다.*

> **99% 정확도는 skill이 의미 있다는 증거가 아니라, 선택한 feature 안에서 label을 구별할 수 있다는 증거다.**

### **7.2 정적 channel을 빼고 18D dynamic state만 남겼다**

Absolute joint position과 projected gravity를 제거했다.

```text
base linear velocity       3
base angular velocity      3
joint velocity            12
-----------------------------
total                     18D
```

외부 locomotion·방향·속도 reward는 모두 0으로 유지했다.

| Iteration | Clean 결과 |
|---:|---|
| 550 | skill 2·4가 0.5 m 이상 이동, 나머지는 회전·정지 mode |
| 575 | skill 2는 약 0.251 m/s 곡선 이동, skill 4는 작은 loop |
| 600, unconstrained | 이동은 유지됐지만 5/30 low-height termination |

정적 자세만으로는 label을 구분하기 어려워지자 일부 skill이 지속적인 motion을 만들기 시작했다. 모든 skill이 걷지는 않았지만, 이 결과가 본래 질문에 가장 직접적으로 답했다.

<img src="https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-unitree-go2-experiment/13-dynamic-state-emergence.gif"
     alt="18D dynamic state를 사용한 model 550과 575를 비교했을 때 일부 Go2 skill의 곡선 이동이 나타나는 장면"
     width="720" height="540"
     class="d-block mx-auto"
     style="width: 100%; border-radius: 6px;">

*위 두 줄은 model 550, 아래 두 줄은 model 575다. 같은 skill layout에서 skill 2·4의 trajectory가 길어지는 것을 볼 수 있다.*

물론 18D에도 joint velocity가 있으므로 고주파 관절 운동 같은 다른 shortcut 가능성이 완전히 사라진 것은 아니다. 그래서 영상, base trajectory, 높이, joint velocity를 함께 봐야 한다.

### **7.3 Dynamic chance model 600을 확장 source로 선택했다**

Unconstrained model 600의 저상 자세 regression을 막기 위해 model 575에서 dynamic chance arm을 분기했다.

- clean 5 episode/skill: 0/30 종료, 최저 0.3012 m
- clean 20 episode/skill: 0/120 종료, 최저 0.29949 m
- movement는 주로 skill 2·4에 유지
- 최종 6개 skill의 dual multiplier는 모두 0
- randomized seed 1에서는 3/30 low-height 종료

이 checkpoint는 robust safety policy로 채택한 것이 아니다. **동일한 clean gate를 통과한 $K$ 확장 source**로 선택했다.

<img src="https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-unitree-go2-experiment/14-dynamic-safety-regression.gif"
     alt="18D dynamic model 575와 unconstrained model 600을 비교했을 때 이동은 유지되지만 아래쪽 model 600 일부 skill의 자세가 무너지는 장면"
     width="720" height="540"
     class="d-block mx-auto"
     style="width: 100%; border-radius: 6px;">

*위 두 줄은 model 575, 아래 두 줄은 unconstrained model 600이다. 아래쪽 skill 2처럼 움직임이 생겨도 자세 안전성이 함께 좋아지는 것은 아니다.*

최종 $K$ arm에 남은 안전장치는 다음과 같다.

- upstream physical penalties
- 0.30 m 아래가 0.20초 지속되면 episode 종료
- 0.26 m 아래는 즉시 종료
- policy action standard deviation cap 0.10
- skill별 mean-height + low-tail chance constraint
- **frozen anchor 없음**
- **locomotion speed reward 없음**

---

## **8. $K=6$에서 10·20·30으로 늘리면 무슨 일이 생기나?**

### **8.1 기존 여섯 skill은 보존하고 새 skill은 같은 곳에서 시작했다**

공통 source는 dynamic chance-constrained model 600이다.

```text
K=6 model 600
  ├─ K=10: 기존 6개 actor/critic skill 열 보존, 새 4개 열 = 0
  ├─ K=20: 기존 6개 actor/critic skill 열 보존, 새 14개 열 = 0
  └─ K=30: 기존 6개 actor/critic skill 열 보존, 새 24개 열 = 0
```

Shape가 바뀌는 구성은 reset했다.

- discriminator와 discriminator optimizer reset
- shape-incompatible PPO optimizer reset
- skill별 chance dual vector reset
- policy weight, policy std, absolute iteration은 보존

각 arm은 4096개 parallel environment, training seed 1로 600→700을 학습한 뒤 같은 $K$를 유지하며 700→1000까지 이어 갔다. Checkpoint는 50 iteration마다 저장했다.

이 비교는 $K=10,20,30$을 처음부터 독립 학습한 실험이 아니다. **같은 $K=6$ source에서 skill input을 확장한 뒤 나타난 migration dynamics**까지 포함한다.

### **8.2 확장 직후에는 새 skill들이 겹쳤다**

K=20 model 600에서 새 skill 6–19는 actor 입력 열이 모두 0으로 시작하므로 거의 같은 행동을 냈다. 8초 시점 body displacement도 좁은 구간에 모였다.

```text
new skill 6–19 at 8 s
dx = -0.568 ~ -0.510 m
dy =  0.574 ~  0.624 m
```

<img src="https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-unitree-go2-experiment/05-k20-after-expansion.gif"
     alt="K=6에서 K=20으로 확장한 직후 새 latent skill들이 거의 같은 Go2 움직임을 보이는 장면"
     width="800" height="360"
     class="d-block mx-auto"
     style="width: 100%; border-radius: 6px;">

*K=20, iteration 600, clean deterministic 평가. 기존 여섯 입력 열만 보존하고 새 열은 0으로 초기화했기 때문에 새 skill은 같은 behavior에서 출발한다.*

### **8.3 Iteration 650에서는 오히려 전부 무너졌다**

50 iteration을 학습한 model 650에서는 K=20의 20개 skill이 모두 0.52–1.20초 사이에 종료됐다.

<img src="https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-unitree-go2-experiment/06-k20-collapse.gif"
     alt="K=20 iteration 650에서 모든 Unitree Go2 skill이 초반에 low-height termination으로 종료되는 장면"
     width="800" height="360"
     class="d-block mx-auto"
     style="width: 100%; border-radius: 6px;">

*K=20, iteration 650. 20개 skill이 모두 20초를 채우지 못했다. 확장 직후 checkpoint가 안전했다고 해서 다음 checkpoint도 안전한 것은 아니었다.*

### **8.4 750–850에서 다시 안정적인 mode가 형성됐다**

Checkpoint별로 20초를 채우지 못한 skill 수는 다음과 같다.

| $K$ | 600 | 650 | 700 | 750 | 800 | 850 | 900 | 950 | 1000 |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 | 0/10 | 8/10 | 8/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 |
| 20 | 0/20 | 20/20 | 19/20 | 1/20 | 0/20 | 0/20 | 0/20 | 0/20 | 0/20 |
| 30 | 0/30 | 29/30 | 8/30 | 0/30 | 1/30 | 0/30 | 0/30 | 0/30 | 0/30 |

이 run에서는 **일부 skill이 겹친 뒤, 초기 학습 중 크게 무너지고, 다시 서로 다른 mode로 분화하는 과정**을 실제로 관찰했다.

다만 회복은 단조롭지 않았다. K=30 model 750은 모두 20초를 채웠지만 model 800의 skill 3은 10.12초에 low-height termination됐다. 이전 4초 영상에서는 보이지 않던 지연 실패였다.

<img src="https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-unitree-go2-experiment/08-k30-delayed-termination.gif"
     alt="K=30 iteration 800 skill 3이 10.12초에 low-height termination되는 지연 실패"
     width="640" height="360"
     class="d-block mx-auto"
     style="width: min(100%, 720px); border-radius: 6px;">

*K=30, iteration 800, skill 3의 8.5–12.5초 구간. 20초 평가가 필요한 이유를 보여 주는 사례다.*

---

## **9. 최종 $K=10,20,30$ 결과**

### **9.1 Trajectory는 분리됐지만 모두 별도 gait는 아니다**

아래 그림은 model 1000을 skill마다 5 episode 실행한 body-frame XY trajectory다.

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; align-items: start;">
  <figure style="margin: 0;">
    <img src="https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-unitree-go2-experiment/02-k10-final-trajectories.png" alt="K=10 model 1000의 skill별 body-frame XY trajectory" width="1280" height="1280" style="width: 100%; border-radius: 6px;">
    <figcaption style="text-align: center;">K=10</figcaption>
  </figure>
  <figure style="margin: 0;">
    <img src="https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-unitree-go2-experiment/03-k20-final-trajectories.png" alt="K=20 model 1000의 skill별 body-frame XY trajectory" width="1280" height="1280" style="width: 100%; border-radius: 6px;">
    <figcaption style="text-align: center;">K=20</figcaption>
  </figure>
  <figure style="margin: 0;">
    <img src="https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-unitree-go2-experiment/04-k30-final-trajectories.png" alt="K=30 model 1000의 skill별 body-frame XY trajectory" width="1280" height="1280" style="width: 100%; border-radius: 6px;">
    <figcaption style="text-align: center;">K=30</figcaption>
  </figure>
</div>

*각 선은 한 clean deterministic episode의 body-frame trajectory다. 같은 색은 같은 skill의 반복 episode다.*

관찰을 요약하면 다음과 같다.

- **K=10**: 비교적 compact하고 구별하기 쉬운 이동·회전 mode
- **K=20**: 시각적으로 이동 다양성과 안정성의 균형이 가장 좋음
- **K=30**: 더 많은 mode와 함께 느린 mode, 중복, yaw·curvature 차이도 증가
- K=30 skill 25의 평균 평면속도는 0.0718 m/s로 매우 느림
- 높은 q accuracy는 18D dynamic feature에서 구별된다는 뜻이지, 독립 gait의 개수가 아님

### **9.2 발견된 두 skill을 반복 전환하면 한 방향으로 누적되는가?**

최종 repertoire가 실제로 재사용될 수 있는지 보기 위해 $K=30$ model 1000을 고정하고, policy update 없이 skill ID만 바꾸는 후속 실험을 했다. 먼저 서로 다른 두 skill의 ordered pair $30\times29=870$개를 모두 확인했다. 각 pair는 첫 skill 2초, 두 번째 skill 2초를 한 cycle로 두고 20초 동안 반복했다. 그중 직선성을 우선해 `z22 -> z17`을 최종 비교 대상으로 고정했다.

```text
K=30 model 1000 frozen

z22 2초 -> z17 2초
-> 같은 순서를 5 cycle 반복

policy update 없음
action blending 없음
goal direction command 없음
```

최종 비교에서는 `z22` 고정, `z17` 고정, `z22 ↔ z17` 반복을 같은 초기조건에서 정확히 1000 policy transition, 20.00초 동안 동시에 실행했다. Skill을 바꾸는 순간 one-hot 입력을 교체하고 observation을 다시 계산해 다음 policy inference부터 새 skill이 보이게 했다.

반복 schedule은 다음과 같다.

$$
z(t)=
\begin{cases}
22, & 4k \le t < 4k+2 \\
17, & 4k+2 \le t < 4k+4
\end{cases}
$$

$$
k=0,\ldots,4
$$

이 실험은 world $+x$를 목표로 두지 않았다. 각 rollout의 시작점 $p_0$와 끝점 $p_T$를 잇는 방향을 사후 기준선으로 정의했다.

$$
u=\frac{p_T-p_0}{\lVert p_T-p_0\rVert},
\qquad
D=\lVert p_T-p_0\rVert
$$

$$
L=\sum_t \lVert p_{t+1}-p_t\rVert,
\qquad
\eta=\frac{D}{L}
$$

기준선의 수직 방향을 $u_\perp$라 하면 cross-track error는 다음과 같다.

$$
e_t=u_\perp^\top(p_t-p_0),
$$

$$
e_{\mathrm{RMS}}=\sqrt{\frac{1}{N}\sum_t e_t^2}
$$

$$
e_{\max}=\max_t |e_t|
$$

<img src="https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-unitree-go2-experiment/15-z22-z17-periodic-composition.gif"
     alt="고정 z22와 고정 z17은 각각 곡선으로 이동하지만 두 skill을 2초씩 반복한 Go2는 대각선 직선에 가까운 trajectory를 만드는 비교"
     width="960" height="180"
     class="d-block mx-auto"
     style="width: 100%; border-radius: 6px;">

*왼쪽은 z22 고정, 가운데는 z17 고정, 오른쪽은 z22와 z17을 2초씩 반복한 결과다. 우측 아래 WORLD XY는 같은 20초 rollout의 누적 trajectory다. [원본 크기로 열기](https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-unitree-go2-experiment/15-z22-z17-periodic-composition.gif)*

| 실행 | 순이동 $D$ | Path efficiency $\eta$ | RMS cross-track | 최대 cross-track | 최저 높이 | 중도 종료 |
|---|---:|---:|---:|---:|---:|---:|
| `z22` 고정 | 7.050 m | 0.8964 | 1.059 m | 1.447 m | 0.3139 m | 0 |
| `z17` 고정 | 7.683 m | 0.8808 | 1.275 m | 1.763 m | 0.3154 m | 0 |
| `z22 ↔ z17` 반복 | **8.280 m** | **0.9917** | **0.037 m** | **0.073 m** | 0.3098 m | 0 |

반복 조합의 최종 displacement는 $(-3.853,+7.329)$ m, world bearing은 약 $117.7^\circ$였다. RMS와 최대 cross-track은 순이동 거리의 각각 0.45%, 0.89%였다. 다섯 cycle의 기준선 방향 진행량도 1.710, 1.651, 1.637, 1.644, 1.638 m로 모두 양수였고, 변동계수는 1.67%였다. 한 cycle만 우연히 멀리 간 것이 아니라 같은 방향의 이동이 다섯 번 누적된 것이다.

이 결과가 뜻하는 범위는 제한적이다.

> **이 checkpoint의 `z22`와 `z17`은 특정 2초 주기로 연결했을 때, 추가 policy 학습 없이 거의 직선인 world-frame 이동을 만들었다.**

Pair와 dwell은 전체 탐색 후 고른 값이며 이동축도 endpoint로 사후 정의했다. 따라서 임의의 skill 조합이 일반적으로 유효하다거나 목표 방향을 추종하는 controller를 얻었다고 말할 수는 없다. 중간 skill switch는 training 중 episode 내내 $z$를 고정했던 조건 밖의 입력이며, 최대 switch action jump도 L2 기준 2.301이었다. 또한 이 실험에는 dynamics model, MPC, online replanning이 없다. 학습된 model로 skill sequence를 계획하는 [DADS](/posts/dads-dynamics-aware-skill-discovery/)와 달리, 사람이 고른 고정 주기를 실행한 open-loop temporal composition이다.

### **9.3 K=10 전체 progression**

<details data-diayn-gif style="margin: 1rem 0;">
  <summary><strong>K=10 전체 180.4초 GIF 불러오기</strong> · 54.7 MB</summary>
  <img data-src="https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-unitree-go2-experiment/09-k10-progression-600-1000.gif"
       alt="K=10의 iteration 600부터 1000까지 50 iteration 간격으로 이어 붙인 전체 progression"
       width="800" height="338"
       class="d-block mx-auto"
       style="width: 100%; border-radius: 6px; margin-top: 1rem;">
</details>

*Iteration 600, 650, …, 1000의 20.05초 source segment를 연결해 5 fps로 변환한 180.40초 clean deterministic GIF. [원본 크기로 열기](https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-unitree-go2-experiment/09-k10-progression-600-1000.gif)*

### **9.4 K=20 전체 progression**

<details data-diayn-gif style="margin: 1rem 0;">
  <summary><strong>K=20 전체 180.4초 GIF 불러오기</strong> · 93.4 MB</summary>
  <img data-src="https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-unitree-go2-experiment/10-k20-progression-600-1000.gif"
       alt="K=20의 iteration 600부터 1000까지 초기 overlap, collapse, recovery를 보여 주는 전체 progression"
       width="960" height="432"
       class="d-block mx-auto"
       style="width: 100%; border-radius: 6px; margin-top: 1rem;">
</details>

*Iteration 600→1000, 50 iteration 간격, checkpoint당 20.05초. 초기 overlap, 650 collapse, 750 이후 recovery를 같은 skill layout으로 비교할 수 있다. [원본 크기로 열기](https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-unitree-go2-experiment/10-k20-progression-600-1000.gif)*

### **9.5 K=30 전체 progression**

<details data-diayn-gif style="margin: 1rem 0;">
  <summary><strong>K=30 전체 180.4초 GIF 불러오기</strong> · 113.5 MB</summary>
  <img data-src="https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-unitree-go2-experiment/11-k30-progression-600-1000.gif"
       alt="K=30의 iteration 600부터 1000까지 지연 종료와 recovery를 포함한 전체 progression"
       width="960" height="450"
       class="d-block mx-auto"
       style="width: 100%; border-radius: 6px; margin-top: 1rem;">
</details>

*Iteration 600→1000, 50 iteration 간격, checkpoint당 20.05초. K=30 model 800 skill 3의 10.12초 지연 종료도 포함한다. [원본 크기로 열기](https://media.iamjaehka13.blog/assets/img/posts/rl/diayn-unitree-go2-experiment/11-k30-progression-600-1000.gif)*

---

## **10. 이 실험에서 배운 것**

### **10.1 Feature selection은 사실상 행동 명세다**

DIAYN은 “다양해져라”라고만 말하지 않는다. 정확히는 **discriminator가 보는 feature 안에서 다양해져라**라고 말한다.

```text
dyaw를 보여 줌
-> 회전이 쉬운 skill identity가 됨

joint position을 보여 줌
-> 정적 자세가 쉬운 skill identity가 됨

dynamic channel만 보여 줌
-> 지속적인 motion 차이가 상대적으로 유리해짐
```

Reward를 직접 설계하지 않아도 feature를 고르는 순간 어떤 차이를 가치 있게 볼지 정하고 있다. Unsupervised skill discovery에서도 representation choice는 중립적이지 않다.

### **10.2 Diversity와 quality는 별도 축이다**

다음 세 가지는 서로 다른 질문이다.

1. Discriminator가 skill을 구별하는가?
2. Skill이 물리적으로 안전한가?
3. Skill이 downstream에서 쓸 만한가?

33D arm은 1번을 거의 완벽히 만족했지만 locomotion은 없었다. Anchor arm은 2번을 개선했지만 일부 skill이 겹쳤다. 최종 dynamic arm에서는 한 pair의 open-loop 반복 전환 가능성까지 확인했지만, 전체 repertoire의 downstream utility를 검증한 것은 아니다.

### **10.3 안전장치는 terminal condition 하나로 끝나지 않는다**

Low-height termination은 위험한 trajectory를 자르지만, 경계 가까이 머무는 행동의 학습 신호까지 자동으로 고쳐 주지는 않는다. 반대로 큰 scalar penalty는 안전성과 다양성 사이의 trade-off를 없애지 못한다.

이번 실험에서는 다음 역할을 분리해야 했다.

- termination: 명백히 위험한 episode 중단
- mean constraint: 평균 자세 붕괴 억제
- tail constraint: 드물지만 깊은 excursion 감시
- action std cap: 초기 exploration 폭 제한
- clean long-horizon evaluation: training 통계가 놓친 지연 실패 확인

### **10.4 $K$를 키우면 자동으로 좋은 skill이 늘지 않는다**

$K$가 커지면 다음 효과가 동시에 생긴다.

- 새 latent가 차지할 행동 공간이 필요함
- skill당 data 비율이 줄어듦
- discriminator classification이 어려워짐
- intrinsic reward 상한 $\log K$가 달라짐
- 중복되거나 느린 mode도 별도 label로 분리될 수 있음

이번 run에서 K=30은 K=20보다 q accuracy 하한이 낮았고, 가장 느린 skill은 0.0718 m/s였다. **latent 개수는 repertoire 품질의 단조로운 knob가 아니었다.**

### **10.5 합쳐진 뒤 다시 분화할 수 있다**

K 확장 직후 새 skill 열이 모두 0이었으므로 여러 latent가 같은 행동에서 시작했다. 650에서는 안전성까지 크게 무너졌지만 750–850에서 다시 안정적인 mode가 형성됐다.

따라서 이 run에 한해서는 “skill이 일부 합쳐진 뒤 다시 분화하는가?”에 **그렇다**고 답할 수 있다. 다만 이것은 from-scratch 학습의 보편 법칙이 아니라 checkpoint expansion과 optimizer reset을 포함한 한 seed의 관찰이다.

---

## **11. 무엇을 확인했고, 무엇은 말할 수 없는가**

### **확인한 것**

- 기존 locomotion motor prior를 가진 Go2에서 일부 latent가 외부 방향·속도 reward 없이 이동·회전 mode로 분화했다.
- Yaw를 discriminator에 주면 회전 shortcut이 나타났다.
- Static joint pose를 주면 q accuracy 약 99%의 정적 자세 shortcut이 나타났다.
- 18D dynamic feature만 남기자 일부 locomotion-like behavior가 나타났다.
- K=6 checkpoint를 K=10·20·30으로 확장한 run에서 overlap, collapse, recovery, 재분화를 관찰했다.
- 4초 평가는 K=30 model 800의 10.12초 지연 실패를 놓쳤고, checkpoint당 20초 기록이 필요했다.
- Frozen K=30 policy에서 `z22`와 `z17`을 2초씩 반복하자, 한 clean 20초 rollout에서 8.280 m의 거의 직선인 이동이 다섯 cycle에 걸쳐 누적됐다.

### **말할 수 없는 것**

- DIAYN이 Go2 보행을 무에서 학습했다.
- K=30에서 30개의 독립 gait를 발견했다.
- K가 클수록 skill quality가 단조롭게 좋아진다.
- 높은 discriminator accuracy가 semantic usefulness를 보장한다.
- 임의의 두 skill을 반복하면 항상 새로운 유용한 이동이 만들어진다.
- 목표 방향을 입력받아 경로를 선택하는 goal-reaching controller를 얻었다.
- Simulation 결과가 실물 Go2의 안전성을 보장한다.

### **실험의 한계**

- Training seed는 1개다.
- K=10·20·30은 from-scratch 독립 학습이 아니라 같은 K=6 checkpoint 확장이다.
- K별 intrinsic reward ceiling $\log K$가 달라 reward scale이 완전히 동일하지 않다.
- 최종 정량 평가는 clean deterministic simulation이다.
- Training은 upstream observation noise·friction randomization·push 설정을 상속했다.
- Pretrained motor prior에서 시작했으므로 locomotion capability가 이미 존재했다.
- 18D feature에도 joint velocity가 있어 joint-motion shortcut 가능성이 남아 있다.
- Skill 조합은 `z22`·`z17`, 2초 dwell, 한 clean 초기조건의 open-loop schedule만 평가했다. Goal reaching, adaptive high-level selection, energy efficiency, switch smoothness는 검증하지 않았다.
- 현재 실험 checkout을 immutable public release로 정리하는 작업은 별도로 남아 있다.

---

## **12. 결론**

처음에는 DIAYN reward를 오래 주면 여러 걷기 skill이 자연스럽게 나올 것이라 예상했다. 실제로 가장 먼저 나온 것은 걷기가 아니라 yaw, 낮은 몸체, 정적 관절 자세였다.

이 실패는 DIAYN이 작동하지 않았다는 뜻이 아니다. 오히려 목적함수를 정확히 최적화한 결과다. Policy는 사람이 생각하는 “좋은 skill”이 아니라 discriminator가 가장 쉽게 구별하는 상태를 찾았다.

결정적인 변화는 reward 계수를 계속 키운 것이 아니라 **discriminator가 볼 수 있는 정보를 바꾼 것**이었다. Static channel을 제거하고 18D dynamic state만 남기자 일부 latent가 이동과 회전 mode로 분화했다. 이후 $K$를 늘리자 행동이 한 번 겹치고 크게 무너진 뒤 다시 갈라지는 과정도 관찰할 수 있었다.

학습 후에는 발견된 `z22`와 `z17`을 고정 주기로 연결했다. 두 skill을 각각 계속 실행하면 곡선을 그렸지만, 2초씩 반복한 결과에는 curvature가 크게 줄며 한 대각선 방향의 이동이 누적됐다. 이는 repertoire 재사용 가능성의 한 사례이지, DIAYN이 조합 policy나 planner까지 학습했다는 뜻은 아니다.

이번 실험의 결론은 “DIAYN으로 30가지 보행을 만들었다”가 아니다.

> **기존 motor capability 위에서 DIAYN은 task reward 없이 행동을 분할할 수 있었다. 그러나 어떤 skill이 생기는지는 discriminator feature와 feasible action set이 결정했고, 다양성·안전성·유용성은 따로 측정해야 했다.**

다음 단계로 가치 있는 비교는 세 가지다.

1. K=10·20·30을 각각 from-scratch multi-seed로 학습
2. Dynamic feature 안에서도 base motion과 joint motion을 다시 ablation
3. 더 많은 pair·dwell·초기조건에서 반복 조합을 검증하고, 목표 조건부 high-level selector로 확장

DIAYN의 원리를 이해하기 위한 실험은 여기서 충분히 목적을 달성했다. 한 pair에서는 재사용 가능성을 확인했으므로, 이제는 “더 오래 학습”보다 **이 사례를 다른 조합과 목표 조건으로 일반화할 수 있는가**를 검증하는 편이 더 의미 있다.

---

## **13. 재현 메모와 참고 자료**

최종 $K$ 확장 source checkpoint:

```text
logs/rough_go2_diayn_physical_dynamic_chance_constrained/
  Aug22_19-18-17_dynamic18_chance_constrained_from575_to600_seed001/
  model_600.pt
```

최종 평가 산출물:

```text
logs/rough_go2_diayn_physical_dynamic_chance_k{10,20,30}/
  evaluation_model1000_clean_seed001_5eps/
    episodes.csv
    skill_summary.csv
    trajectories.csv
    skill_trajectories.png
```

반복 skill 조합 산출물:

```text
logs/rough_go2_diayn_physical_dynamic_chance_k30/
  video_periodic_axis_free_line_model1000_clean_seed001_z22_z17_20s_3panel_minimal/
    diayn_k30_z22_z17_periodic_line_3panel.mp4
    trajectories_per_step.csv
    switch_events.csv
    recording_metadata.json
```

반복 조합은 50 Hz policy에서 정확히 1000 transition을 실행했다. `z22`와 `z17`은 각각 100 transition씩 유지했고, 200 transition의 cycle을 다섯 번 반복했다.

20초 progression source는 iteration 600, 650, …, 1000의 9개 segment로 구성했다. 각 segment는 20.05초, 401 frame이고 원본 합본은 180.45초, 3609 frame이다. 게시용 전체 GIF는 5 fps·64색으로 변환해 각각 902 frame, 180.40초다.

### **논문·공식 자료**

- [Diversity Is All You Need: Learning Skills without a Reward Function](https://arxiv.org/abs/1802.06070)
- [ICLR 2019 OpenReview](https://openreview.net/forum?id=SJx63jRqFm)
- [Official DIAYN project videos](https://sites.google.com/view/diayn/)
- [Official DIAYN implementation note](https://github.com/ben-eysenbach/sac/blob/master/DIAYN.md)
- [DIAYN 이론 정리](/posts/diayn-diversity-is-all-you-need/)

<script>
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('details[data-diayn-gif]').forEach((details) => {
      details.addEventListener('toggle', () => {
        if (!details.open) return;
        const image = details.querySelector('img[data-src]');
        if (!image) return;
        const source = image.dataset.src;
        image.src = source;
        const link = image.closest('a');
        if (link) link.href = source;
        image.removeAttribute('data-src');
      });
    });
  });
</script>
