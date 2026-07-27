---
title: "[Sim2Real Paper 6] Challenging Terrain Locomotion"
date: 2026-06-24 17:34:00 +0900
last_modified_at: 2026-07-27 21:22:15 +0900
categories: [RL, Sim2Real, Paper]
tags: [sim2real, quadruped-locomotion, rough-terrain, proprioception, privileged-learning, teacher-student, tcn, terrain-curriculum, anymal]
description: Lee et al.의 blind rough-terrain locomotion을 privileged teacher, TCN student, PMTG, adaptive terrain curriculum, 자연환경 실험과 ablation까지 원문 기준으로 정리한다.
math: true
image:
  path: /assets/img/posts/rl/sim2real/challenging-terrain/00-preview.png
  alt: 산악 지형과 물, 눈, 진흙, 숲을 이동하는 ANYmal
---

## **0. 전체 그림: 지형을 보지 않고도 왜 버틸 수 있었을까**

이전 글: [Agile and Dynamic Motor Skills: hybrid simulator와 actuator network](/posts/learning-agile-dynamic-motor-skills/)

앞선 Hwangbo et al.의 논문은 learned actuator network와 stochastic rigid-body model을 결합해 flat ground locomotion, high-speed running과 fall recovery를 실제 ANYmal로 옮겼습니다.

Lee et al.의 **Learning Quadrupedal Locomotion over Challenging Terrain**은 그 pipeline을 자연 지형으로 확장합니다.

문제는 simulator를 더 정교하게 만드는 것만으로 해결되지 않습니다.

실제 야외에는 다음 현상이 있습니다.

- 발이 박히고 무너지는 mud와 snow
- 밟는 순간 움직이는 rubble과 loose board
- 발과 정강이를 가로막는 vegetation
- 마찰이 급격히 낮아지는 wet surface
- 물, 눈, 풀 때문에 geometry perception이 불안정한 상황

이 모든 deformable contact와 obstruction을 빠른 rigid-body simulator에 사실적으로 넣기는 어렵습니다.

논문은 질문을 바꿉니다.

> 현실의 모든 terrain을 simulation에서 복제하는 대신, robot이 자기 몸에 돌아오는 proprioceptive response를 기억해 지금 벌어진 일을 추론하도록 만들 수 있는가?

![다양한 자연환경에 배포된 ANYmal](/assets/img/posts/rl/sim2real/challenging-terrain/00-preview.png){: width="1100" .d-block .mx-auto }
_동일 세대의 ANYmal에는 환경별 재조정 없이 같은 proprioceptive controller가 사용되었다. Training에는 rigid procedural terrain만 있었지만, deployment에서는 mountain trail, creek, vegetation, rubble, snow, mud와 forest를 통과했다. 출처: [Lee et al., Figure 1](https://arxiv.org/pdf/2010.11251)._

이 논문의 해법은 세 축으로 정리할 수 있습니다.

| 축 | Training에서 하는 일 | Deployment에 남는가 |
|---|---|---|
| Privileged teacher | Terrain·contact ground truth를 보며 rough-terrain skill 학습 | 아니요 |
| Proprioceptive student | Teacher action과 latent를 2초 body-response history에서 모방 | 예 |
| Adaptive terrain curriculum | 현재 policy가 간신히 통과할 난이도를 자동으로 샘플링 | Training에만 사용 |

Deploy되는 student는 camera, LiDAR, foot-contact sensor와 terrain height map을 사용하지 않습니다. Joint encoder, IMU와 state estimator가 주는 proprioceptive stream만 사용합니다.

다만 이것을 “눈 없이 terrain을 정확히 안다”고 표현하면 과합니다.

> Student는 terrain map을 명시적으로 복원해 planning하는 것이 아니라, 과거 body response에서 control에 필요한 hidden condition의 흔적을 암묵적으로 인코딩한다.

먼저 네 가지 claim boundary를 잡고 읽는 편이 좋습니다.

1. **Blind는 무센서가 아니다.** Joint encoder, IMU와 state estimator를 사용하되 camera·LiDAR terrain map을 쓰지 않습니다.
2. **History는 미래 terrain을 보지 못한다.** 이미 일어난 slip, collision과 tracking mismatch를 통해 hidden condition을 추론합니다.
3. **Natural terrain을 simulation에 그대로 만들지 않았다.** Rigid hills·steps·stairs와 friction variation에서 response strategy를 학습했습니다.
4. **TCN 하나의 성과가 아니다.** Privileged learning, DAgger, curriculum, PMTG, actuator model과 randomization이 함께 작동했습니다.

---

## **1. 논문 정보**

| 항목 | 내용 |
|---|---|
| Title | Learning Quadrupedal Locomotion over Challenging Terrain |
| Authors | Joonho Lee, Jemin Hwangbo, Lorenz Wellhausen, Vladlen Koltun, Marco Hutter |
| Venue | Science Robotics, 2020 |
| Robot | ANYmal-B, ANYmal-C |
| Simulator | RaiSim |
| Teacher RL | Trust Region Policy Optimization, TRPO |
| Student | Temporal Convolutional Network, TCN |
| Action structure | PMTG: 4 leg-frequency offsets + 12 foot-position residuals |
| Deploy input | Proprioceptive observation와 2초 history |
| Main tools | Privileged learning, DAgger, latent supervision, adaptive terrain curriculum, actuator network |
| Transfer | Simulation training 후 natural terrain에 direct deployment |
| Source | [arXiv](https://arxiv.org/abs/2010.11251), [Science Robotics DOI](https://doi.org/10.1126/scirobotics.abc5986), [Official project](https://leggedrobotics.github.io/rl-blindloco/) |

두 세대 robot은 kinematics, inertia와 actuator가 다릅니다. 논문은 같은 generation 안에서는 모든 환경에 같은 controller를 사용하고 환경별 tuning을 하지 않았다고 설명합니다.

이 말은 ANYmal-B용 weight 하나가 ANYmal-C에도 그대로 사용됐다는 뜻은 아닙니다. 각 robot generation에 맞는 model과 actuator network를 사용하는 pipeline으로 이해하는 것이 안전합니다.

---

## **2. 왜 Blind Rough-Terrain Locomotion은 POMDP인가**

### **2.1 Robot이 보는 것과 실제 state는 다르다**

환경의 실제 state에는 다음이 들어갈 수 있습니다.

$$
s_t
=
\left(
o_t,x_t
\right)
$$

- $o_t$: real robot에서도 얻을 수 있는 proprioceptive observation
- $x_t$: terrain geometry, contact, friction, disturbance 같은 hidden environment state

Teacher는 simulation에서 둘 다 봅니다.

$$
\bar a_t
=
\pi_T(o_t,x_t)
$$

Student는 $x_t$를 직접 볼 수 없습니다.

$$
a_t
=
\pi_S(o_t,H_t)
$$

$$
H_t
=
\{h_{t-1},h_{t-2},\ldots,h_{t-N}\}
$$

History $H_t$가 필요한 이유는 hidden condition이 시간에 걸친 response로 나타나기 때문입니다.

### **2.2 같은 현재 자세라도 과거가 다르면 상황이 다르다**

현재 joint angle과 body orientation이 같아도 다음 두 경우는 다릅니다.

| 현재 pose는 같아도 | 직전 history가 말해 주는 것 |
|---|---|
| 정상 tracking으로 pose에 도달 | Position error와 impact가 작음 |
| Obstacle에 걸린 뒤 pose에 도달 | Target mismatch, collision과 velocity 변화가 남음 |

단일 frame만 보면 구분이 어려울 수 있지만 history에는 다음 신호가 남습니다.

| Signal | 숨은 상황의 흔적 |
|---|---|
| Joint position error | Foot target 추종 실패, obstacle resistance |
| Joint velocity | Impact, slip, sudden obstruction |
| Base angular velocity | Unstable foothold와 body disturbance |
| Previous target | 의도한 motion과 실제 response의 차이 |
| Gait phase | Swing/contact 중 어느 시점에 mismatch가 발생했는지 |

즉 proprioception은 robot state만 재는 센서가 아닙니다.

> Action을 보냈을 때 몸이 어떻게 반응했는지를 통해 environment를 간접적으로 측정하는 interaction sensor이기도 하다.

### **2.3 그렇다고 cliff를 볼 수 있는 것은 아니다**

Proprioceptive inference는 contact가 일어난 뒤 강합니다. 아직 밟지 않은 절벽, 넓은 gap과 위험 obstacle을 멀리서 미리 알 수는 없습니다.

그래서 논문이 해결하는 것은 **reactive blind locomotion**이지, global terrain mapping이나 foothold planning이 아닙니다.

---

## **3. 전체 Architecture: Teacher, Student, Curriculum, PMTG**

![Privileged learning, terrain curriculum과 PMTG control architecture](/assets/img/posts/rl/sim2real/challenging-terrain/04-method-overview.png){: width="1300" .d-block .mx-auto }
_A는 privileged teacher와 proprioceptive student의 두 단계 학습, B는 particle-filter terrain curriculum, C는 policy가 foot trajectory generator를 residual과 frequency로 조절하는 control architecture다. 출처: [Lee et al., Figure 4](https://arxiv.org/pdf/2010.11251)._

그림을 data flow 순서대로 읽으면 다음과 같습니다.

### **Training Stage 1: Teacher**

Teacher는 deployable state $o_t$와 privileged terrain/contact state $x_t$를 받습니다. Terrain encoder가 $\bar l_t$를 만들고, teacher MLP가 action $\bar a_t$를 출력하며 TRPO로 업데이트됩니다.

### **Training Stage 2: Student**

Student는 current deployable state $o_t$와 history $H_t$만 받습니다. TCN이 inferred latent $l_t$를 만들고, teacher에서 복사한 policy head가 action $a_t$를 출력합니다. Supervision은 action imitation $a_t\approx\bar a_t$와 latent imitation $l_t\approx\bar l_t$를 함께 사용합니다.

### **Runtime Control**

| Runtime 단계 | 출력 |
|---|---|
| Direction command + proprioceptive history | Student latent와 action |
| Student policy | Leg frequencies + foot residuals |
| Foot trajectory generator | 각 leg의 3D foot target |
| Analytic inverse kinematics | Joint position target |
| Joint PD controller | Real actuator command |

### **Curriculum**

Terrain parameter particle마다 procedural rollout을 수행해 traversability를 추정합니다. Medium-difficulty particle에 높은 weight를 주고, 이를 resample·perturb해 다음 학습 난이도를 만듭니다.

이 네 component 중 하나만으로 결과가 나온 것이 아닙니다. 원문 ablation은 memory, privileged learning과 adaptive curriculum 각각이 필요했음을 보여줍니다.

---

## **4. Command는 목표 속도가 아니라 목표 방향이다**

앞선 command-conditioned locomotion은 보통 $(v_x,v_y,\omega_z)$의 목표값을 추종했습니다.

이 논문은 rough terrain에서 가능한 speed가 지형에 따라 달라진다는 점을 반영해 **방향만 명령**합니다.

$$
c_t
=
\left\langle
\left({}^B_{IB}\hat v_T\right)_{xy},
\left(\hat\omega_T\right)_z
\right\rangle
$$

Horizontal direction은 다음 unit vector입니다.

$$
\left({}^B_{IB}\hat v_T\right)_{xy}
=
\langle \cos\psi_T,\sin\psi_T\rangle
$$

Turning command는 다음 세 값 중 하나입니다.

$$
\left(\hat\omega_T\right)_z
\in
\{-1,0,1\}
$$

Policy는 가능한 한 command direction으로 진행하되, 실제 speed는 terrain difficulty와 dynamics에 맞춰 정합니다.

이 선택은 중요한 claim boundary를 만듭니다.

> 이 controller는 arbitrary target speed를 정밀 추종하는 policy가 아니라, rough terrain에서 주어진 방향으로 가능한 속도로 진행하는 policy다.

Stop command가 0.5초 동안 유지되면 base gait frequency를 0으로 만들어 FTG를 멈춥니다. 방향 command가 들어오거나 disturbance로 base speed가 0.3 m/s를 넘으면 gait frequency를 다시 1.25 Hz로 둡니다.

작은 state machine 하나가 남아 있다는 점도 중요합니다. 논문은 모든 discrete logic을 완전히 없앤 controller는 아닙니다.

---

## **5. PMTG: 자유로운 Joint Action 대신 Motion Prior 위에서 조절한다**

### **5.1 Leg phase와 foot trajectory**

각 leg에는 phase $\phi_i$가 있습니다.

$$
\phi_i(t)
=
\left(
\phi_{i,0}+(f_0+f_i)t
\right)
\bmod 2\pi
$$

- $\phi_i\in[0,\pi)$: nominal contact phase
- $\phi_i\in[\pi,2\pi)$: nominal swing phase
- $f_0=1.25$ Hz: base trot frequency
- $f_i$: policy가 출력하는 leg별 frequency residual

Foot trajectory generator $F(\phi_i)$는 기본 vertical stepping motion을 만듭니다.

Policy는 각 foot의 3D residual $\Delta r_{f_i,T}$도 출력합니다.

$$
r_{f_i,T}
=
F(\phi_i)+\Delta r_{f_i,T}
$$

Action은 총 16차원입니다.

| Component | Dimension |
|---|---:|
| Four leg-frequency offsets $f_i$ | 4 |
| Four 3D foot-position residuals | 12 |
| Total | 16 |

### **5.2 왜 trajectory generator를 남겼는가**

Policy가 12개 joint target을 완전히 자유롭게 만들 수도 있습니다. 이 논문은 기본 trot prior를 넣어 search space를 줄였습니다.

| Fixed structure | Learned adaptation |
|---|---|
| Periodic leg phase | Leg별 frequency 변화 |
| Nominal swing trajectory | 3D foot residual |
| Analytic inverse kinematics | Terrain에 따른 target 변경 |
| Joint PD tracking | High-level foot motion |

이 구조는 sample efficiency와 transfer 안정성을 높이는 대신 gait diversity를 제한할 수 있습니다. 실제로 논문의 controller는 trot만 보였습니다.

### **5.3 Foot target은 horizontal frame에서 정의한다**

각 leg의 target은 hip 아래에 붙은 horizontal frame $H_i$에서 정의됩니다. 이 frame의 z-axis는 gravity 방향과 정렬되고, yaw는 robot base와 같습니다.

Base가 순간적으로 roll/pitch되어도 foot target frame이 같이 기울지 않으므로 초기 random action과 rough-terrain disturbance에서 target이 덜 불안정해집니다.

Foot target은 analytic IK로 joint position target으로 바뀌고, learned actuator model이 포함된 simulation의 joint PD controller가 이를 추종합니다.

---

## **6. Privileged Teacher는 무엇을 보는가**

### **6.1 Deployable observation $o_t$**

Teacher와 student의 policy head가 받는 current observation에는 다음이 들어갑니다.

| Category | 주요 값 |
|---|---|
| Command | Desired horizontal direction, turning direction |
| Base | Gravity vector, angular velocity, linear velocity |
| Joint | 12 position + 12 velocity |
| Gait | 4 phase의 sin/cos, 4 frequency, base frequency |
| Short actuator history | 10 ms·20 ms 전 position error와 velocity |
| Previous action context | 이전 두 foot target |

Deploy 시 base velocity와 orientation은 IMU와 leg kinematics를 사용하는 state estimator에서 얻습니다.

### **6.2 Privileged state $x_t$**

Simulation-only privileged information에는 다음이 들어갑니다.

| Privileged feature | 목적 |
|---|---|
| 각 foot의 terrain normal | Contact surface orientation |
| 각 foot 주변 9개 height samples | Local terrain profile |
| Foot contact force/state | Ground interaction |
| Thigh·shank contact state | Foot 외 obstruction |
| Foot-ground friction | Slippage condition |
| Base external force | Disturbance |

Height sample은 각 foot 중심에서 반경 10 cm 원 위에 배치됩니다.

Teacher의 terrain encoder는 $x_t$를 latent $\bar l_t$로 압축합니다.

$$
\bar l_t
=
g_T(x_t)
$$

그 latent와 deployable observation을 policy head에 넣습니다.

$$
\bar a_t
=
\pi_T(o_t,\bar l_t)
$$

Command와 robot state는 privileged encoder 입력에서 제외됩니다. 따라서 $\bar l_t$가 terrain/contact condition에 집중하도록 설계했습니다.

### **6.3 Teacher reward**

Teacher는 TRPO로 학습됩니다. Reward는 다음 weighted sum입니다.

$$
r
=
0.05r_{lv}
+0.05r_{av}
+0.04r_b
+0.01r_{fc}
+0.02r_{bc}
+0.025r_s
+2\times10^{-5}r_\tau
$$

| Term | 목적 |
|---|---|
| $r_{lv}$ | Command direction의 projected speed |
| $r_{av}$ | Commanded turning direction |
| $r_b$ | Lateral deviation와 roll/pitch rate 억제 |
| $r_{fc}$ | Swing foot가 주변 height보다 높게 지나감 |
| $r_{bc}$ | Non-foot body collision 억제 |
| $r_s$ | Foot target의 second difference를 줄여 smoothness 확보 |
| $r_\tau$ | Actuator torque 감소 |

Linear reward는 projected speed $v_{pr}$가 0.6 m/s에 도달할 때까지 증가하고 그 이상에서는 saturation됩니다.

$$
r_{lv}
=
\begin{cases}
\exp\left[-2(v_{pr}-0.6)^2\right], & v_{pr}<0.6\\
1, & v_{pr}\ge0.6\\
0, & \text{stop command}
\end{cases}
$$

이는 “무조건 더 빨리”가 아니라 일정 수준까지 command direction 진행을 장려합니다.

### **6.4 Teacher를 직접 real robot에 쓰지 못하는 이유**

Teacher가 요구하는 terrain normal, height scan, friction과 exact contact force는 real deployment에서 안정적으로 얻기 어렵습니다.

Exteroceptive height map을 붙이면 일부 geometry는 얻을 수 있지만,

- snow surface의 실제 support height
- water 아래 바닥
- vegetation이 누울지 버틸지
- loose rubble의 움직임
- 발이 만든 terrain deformation

은 geometry sensor만으로 충분하지 않습니다.

Teacher는 최종 controller가 아니라 **좋은 behavior와 latent target을 생성하는 simulation expert**입니다.

---

## **7. Proprioceptive Student와 2초 Memory**

### **7.1 TCN input은 60채널 history다**

Student history sample $h_t\in\mathbb{R}^{60}$에는 command, gravity vector, base twist, joint state, leg phase와 frequency가 들어갑니다.

Actuator용 짧은 joint history와 previous foot target은 current observation $o_t$에는 있지만 long TCN history $h_t$에서는 제외됩니다.

History는 20 ms 간격으로 쌓입니다.

$$
H_t
\in
\mathbb{R}^{60\times N}
$$

Default deploy model은 TCN-100입니다.

$$
N=100
\quad\Rightarrow\quad
2.0\ \mathrm{s\ history}
$$

비교 model은 다음과 같습니다.

| Model | Receptive field |
|---|---:|
| TCN-1 | 0.02 s |
| TCN-20 | 0.4 s |
| TCN-100 | 2.0 s |

### **7.2 Dilated causal convolution**

TCN encoder는 세 개의 dilated causal convolution과 stride convolution을 번갈아 사용합니다.

Causal이라는 것은 future sample을 보지 않는다는 뜻입니다.

$$
l_t
=
f_{\mathrm{TCN}}
\left(
h_{t-1},\ldots,h_{t-N}
\right)
$$

Dilation을 사용하면 깊이를 과도하게 늘리지 않고 긴 temporal receptive field를 확보할 수 있습니다.

### **7.3 Student는 action과 latent를 동시에 모방한다**

Loss는 두 항입니다.

$$
\mathcal L
=
\left\|
\bar a_t-a_t
\right\|_2^2
+
\left\|
\bar l_t-l_t
\right\|_2^2
$$

- Action loss: teacher behavior를 직접 모방
- Latent loss: teacher가 privileged state에서 만든 terrain/contact representation을 history로 재현

Action만 맞추면 training data에서 같은 output을 내는 shortcut이 가능할 수 있습니다. Latent supervision은 student encoder가 teacher의 internal condition representation을 닮도록 추가 제약을 줍니다.

Supplementary ablation에서 latent loss를 뺀 TCN-100은 slope와 disturbance에서는 비슷했지만 step success가 낮았습니다.

### **7.4 DAgger로 covariate shift를 줄인다**

Ordinary behavior cloning은 teacher trajectory만 학습합니다. Student가 작은 오차로 다른 state에 들어가면 학습 data가 없어 error가 누적될 수 있습니다.

이 논문은 DAgger-style dataset aggregation을 사용합니다.

1. Student policy로 rollout합니다.
2. Student가 실제 방문한 state를 수집합니다.
3. 같은 state에서 teacher action과 latent를 query합니다.
4. Labelled sample을 supervised dataset에 추가합니다.
5. 확장된 dataset으로 student를 업데이트합니다.

즉 training distribution을 teacher가 잘 가는 state가 아니라 **현재 student가 실제로 가는 state** 쪽으로 맞춥니다.

### **7.5 Teacher policy head를 복사한다**

Teacher에서 terrain latent 이후의 MLP는 student로 복사됩니다. Student의 핵심 학습 대상은 privileged latent를 history에서 만들어내는 TCN encoder입니다.

이 구조는 action semantics를 teacher와 student 사이에 정렬하지만, teacher latent가 반드시 유일하거나 물리적으로 해석 가능한 state라는 뜻은 아닙니다.

---

## **8. Adaptive Terrain Curriculum**

### **8.1 Training terrain은 네 종류다**

Simulation은 deformable mud나 vegetation을 직접 만들지 않습니다.

| Terrain | Parameter | 학습되는 challenge |
|---|---|---|
| Hills | Roughness, Perlin frequency, amplitude | Slope, irregularity |
| Slippery hills | Hills + 낮은 friction | Slip |
| Steps | Block width, random height | Discrete elevation, foot trapping |
| Stairs | Step width, height | 반복적인 up/down |

Terrain은 매 episode 다른 random seed로 다시 생성됩니다.

### **8.2 Difficulty를 reward가 아니라 traversability로 측정한다**

Command direction으로의 projected speed를 $v_{pr}$라 하겠습니다.

한 transition의 success label은 다음과 같습니다.

$$
\nu(s_t,a_t,s_{t+1})
=
\begin{cases}
1,&v_{pr}(s_{t+1})>0.2\ \mathrm{m/s}\\
0,&v_{pr}(s_{t+1})<0.2\ \mathrm{m/s}\ \text{or termination}
\end{cases}
$$

Terrain parameter $c_T$의 traversability는 그 terrain에서 success label의 평균입니다.

$$
\operatorname{Tr}(c_T,\pi)
=
\mathbb E_{\xi\sim\pi}
\left[
\nu\mid c_T
\right]
$$

학습에 좋은 terrain은 너무 쉽지도, 너무 어렵지도 않은 구간입니다.

$$
0.5
\le
\operatorname{Tr}(c_T,\pi)
\le
0.9
$$

| Traversability | 해석 | Curriculum에서의 가치 |
|---|---|---|
| $\operatorname{Tr}\approx1.0$ | 이미 거의 항상 통과 | 새 학습 신호가 적음 |
| $\operatorname{Tr}\approx0.0$ | 조기 종료가 대부분 | 유용한 trajectory가 적음 |
| $0.5\le\operatorname{Tr}\le0.9$ | 성공과 실패가 함께 존재 | Learning frontier로 우선 sampling |

### **8.3 Particle filter로 learning frontier를 따라간다**

Terrain type마다 particle 10개를 유지하고, particle당 6 trajectory를 생성합니다. 10번 policy iteration마다 traversability를 모아 weight를 갱신합니다.

| Curriculum hyperparameter | 값 |
|---|---:|
| Particles | Terrain type당 10 |
| Trajectories per particle | 6 |
| Curriculum update | 10 policy iterations마다 |
| Transition probability | 0.8 |
| Replay-memory sample probability | 0.05 |

High-desirability particle을 resample하고 parameter grid의 인접 값으로 random walk합니다. Replay memory는 이전 terrain을 일부 다시 뽑아 catastrophic forgetting을 줄입니다.

![Particle filter가 만든 adaptive terrain curriculum](/assets/img/posts/rl/sim2real/challenging-terrain/07-adaptive-curriculum.png){: width="1000" .d-block .mx-auto }
_Hills에서는 너무 쉽거나 불가능한 parameter를 피하고, stairs에서는 초기 wide·shallow step에서 시작해 policy가 좋아질수록 narrower step까지 분포가 넓어진다. 출처: [Lee et al., Figure S1](https://arxiv.org/pdf/2010.11251)._

이 curriculum은 “난이도를 일정 비율로 선형 증가”시키는 방법과 다릅니다. 현재 policy 성능에 따라 parameter distribution이 움직입니다.

---

## **9. Sim2Real Stack**

### **9.1 Actuator network를 이어서 사용한다**

5편과 동일하게 joint-level SEA dynamics는 learned actuator network로 모델링합니다.

Joint마다 입력은 6차원입니다.

$$
\left[
e_t,\dot q_t,\,
e_{t-10\mathrm{ms}},\dot q_{t-10\mathrm{ms}},\,
e_{t-20\mathrm{ms}},\dot q_{t-20\mathrm{ms}}
\right]
$$

ANYmal-B와 C의 actuator가 다르므로 robot별 actuator model이 필요합니다.

### **9.2 Friction, disturbance와 observation noise**

Training에서는 foot-ground friction을 randomize하고, external disturbance와 observation noise를 넣습니다. Teacher는 random physical quantity 일부를 privileged input으로 받습니다.

따라서 natural-terrain generalization을 TCN 하나의 효과로만 돌리면 안 됩니다.

| Transfer stack | 담당하는 문제 |
|---|---|
| Realistic actuator model | Command-to-torque gap |
| Dynamics/friction variation | Physical-parameter uncertainty |
| Disturbance와 sensor noise | Perturbation·observation robustness |
| Terrain curriculum | 유효한 난이도 분포 |
| Privileged teacher | Sparse rough-terrain learning signal |
| Long-history student | Hidden terrain/contact condition |
| PMTG motion prior | 실행 가능한 periodic foot motion |

전체 조합이 transfer stack입니다.

### **9.3 Runtime**

Student neural-network controller는 onboard Intel i7-5600U CPU에서 TensorFlow C++ API로 400 Hz 실행됩니다.

TCN history는 20 ms 간격으로 저장되므로 50 Hz temporal sample grid를 사용하지만, controller inference와 low-level tracking loop는 더 높은 rate로 실행될 수 있습니다.

Policy output은 joint torque가 아니라 foot residual과 frequency입니다. Analytic IK와 joint PD가 실제 joint target을 계산·추종합니다.

---

## **10. Result 1: Simulation에 없던 자연환경**

![눈, 물, 진흙, vegetation과 DARPA stair deployment](/assets/img/posts/rl/sim2real/challenging-terrain/02-natural-deployments.png){: width="900" .d-block .mx-auto }
_A-F는 deformable·slippery terrain과 overground obstruction에 대한 deployment, G는 DARPA Subterranean Challenge의 약 45도, 18 cm-rise stair descent다. 출처: [Lee et al., Figure 2](https://arxiv.org/pdf/2010.11251)._

실제 deployment에는 다음 환경이 포함됩니다.

- Steep mountain trail
- Running-water creek
- Mud와 moss
- Thick vegetation
- Loose rubble
- Snow-covered hill
- Damp forest

Training terrain에는 deformability, flowing water와 vegetation이 없었습니다. 따라서 이 결과는 test environment가 training simulator parameter range 안에 정확히 들어 있었다는 의미의 일반적인 domain randomization 결과와는 다릅니다.

더 정확한 표현은 다음입니다.

> Rigid procedural terrain에서 학습한 proprioceptive response strategy가, 관측 가능한 body-response pattern이 유사한 현실의 미모델링 현상까지 견뎠다.

### **10.1 Natural-terrain 정량 비교**

논문은 기존 ANYmal model-based controller와 speed 및 mechanical cost of transport, COT를 비교했습니다.

$$
\mathrm{COT}
=
\frac{
\sum_{j=1}^{12}
\left[
\tau_j\dot q_j
\right]^+
}{
mgv
}
$$

| Terrain | Ours speed | Baseline speed | Ours COT | Baseline COT |
|---|---:|---:|---:|---:|
| Moss | 0.452 m/s | 0.199 m/s | 0.423 | 0.625 |
| Mud | 0.338 m/s | 0.197 m/s | 0.692 | 0.931 |
| Vegetation | 0.248 m/s | 측정 불가 | 1.23 | 측정 불가 |

Mechanical COT가 낮을수록 unit weight와 unit speed당 positive mechanical work가 적습니다.

단, baseline 숫자는 성공적으로 이동한 구간만 측정했습니다. Vegetation에서는 catastrophic failure 때문에 비교값을 만들지 못했고, baseline이 실패하면 사람이 더 안정적인 pose로 reset했습니다.

따라서 표만 보면 controller 차이를 오히려 과소평가할 수 있습니다. 반대로, 실험 횟수와 terrain condition이 대규모 표준 benchmark처럼 통제된 것도 아니므로 universal superiority로 확대하면 안 됩니다.

### **10.2 DARPA Subterranean Challenge**

이 controller는 CERBERUS team의 DARPA Subterranean Challenge Urban Circuit에서 이전 model-based controller를 대체했습니다.

| Field evidence | Result |
|---|---:|
| Robots | ANYmal-B 2대 |
| Missions | 4회 |
| Duration per mission | 60분 |
| Locomotion-controller failure | 0회 |
| Highlight | 약 45도, 18 cm stair descent |

Laboratory clip이 아니라 mission-duration deployment에서 failure 0회를 기록한 것이 이 논문의 중요한 강점입니다.

다만 robot 전체 system failure나 navigation performance까지 0이었다는 뜻은 아닙니다. 논문 표현은 **locomotion controller의 zero failure rate**입니다.

---

## **11. Result 2: Controlled Indoor Diagnostics**

![Indoor debris, foot trapping, payload와 omnidirectional 평가](/assets/img/posts/rl/sim2real/challenging-terrain/03-indoor-evaluation.png){: width="1250" .d-block .mx-auto }
_A는 움직이는 debris, B-C는 foot·shin obstruction response, D-E는 step/payload success, F-G는 direction별 speed와 heading error다. 출처: [Lee et al., Figure 3](https://arxiv.org/pdf/2010.11251)._

Natural-environment video만으로는 어떤 mechanism이 중요한지 분리하기 어렵습니다. 그래서 논문은 step, payload와 slippery surface를 통제해 실험했습니다.

### **11.1 Emergent foot-trapping response**

16.8 cm step에 swing foot가 부딪혔을 때 controller는 다음 swing에서 foot를 더 높이 들었습니다.

| Leg | Flat max clearance | Foot-trapping / step response |
|---|---:|---:|
| Left front | 12.9 cm | 22.5 cm |
| Right front | 13.6 cm | 18.5 cm |
| Left hind | 13.5 cm | 16.6 cm |
| Right hind | 9.06 cm | 15.9 cm |

Hind-leg clearance도 증가했습니다. Front leg가 step을 만났다는 과거 정보가 뒤이어 오는 hind-leg trajectory에 영향을 준 것입니다.

Mid-shin collision에도 대응했습니다. 즉 explicit foot-contact event 하나에 묶인 scripted reflex는 아니었습니다.

논문은 이를 foot-trapping reflex라 부르지만, reward에 “발이 걸리면 이렇게 들어라”라는 규칙을 직접 넣지는 않았습니다. Procedural steps와 history-based control에서 emergent하게 나온 response입니다.

### **11.2 10 kg unseen payload**

ANYmal-B에 10 kg payload를 부착했습니다. 이는 total robot weight의 22.7%였고 training에서 simulate하지 않은 mismatch였습니다.

- Proposed controller: payload를 달고도 최대 13.4 cm step 통과
- Baseline: payload condition에서 command speed와 관계없이 step 통과 실패
- Proposed controller: 8방향에서 약 0.4 m/s 유지
- Proposed controller: payload 유무 모두 평균 heading error 10도 이내
- Baseline: lateral direction heading error가 약 30도까지 증가

이 실험은 terrain inference뿐 아니라 model mismatch robustness도 보여줍니다.

### **11.3 Wet whiteboard slip**

Moistened whiteboard로 foot slippage를 만들었습니다.

- Baseline은 balance를 잃고 aggressive leg swing 후 fall
- Proposed controller는 commanded direction으로 계속 locomotion

Policy는 explicit friction estimator를 control loop에 사용하지 않습니다. 이후 diagnostic decoder로 TCN representation을 분석했을 때 first slip 이후 estimated friction이 낮아지는 pattern을 복원할 수 있었습니다.

관련 영상:

- [Unstable debris](https://youtu.be/Xnn4sVSpSh0)
- [Foot-trapping reflex](https://youtu.be/tPixnjLbTvE)
- [10 kg payload](https://youtu.be/3Nr47MXCFO0)
- [Slippery whiteboard](https://youtu.be/aMPwB3t4idU)

---

## **12. Ablation: 무엇이 실제로 필요했는가**

![Memory, privileged training과 curriculum ablation](/assets/img/posts/rl/sim2real/challenging-terrain/05-ablation-studies.png){: width="900" .d-block .mx-auto }
_B-D는 history length, E-G는 privileged training, H-J는 adaptive curriculum을 제거하거나 바꿨을 때의 결과다. 각 model은 5개 seed로 학습했고 error bar는 95% confidence interval이다. 출처: [Lee et al., Figure 5](https://arxiv.org/pdf/2010.11251)._

Diagnostic test는 slope, step과 external force 세 가지입니다. Step·slope 조건마다 100 trial을 수행했고 friction은 $U(0.4,1.0)$에서 샘플링했습니다.

### **12.1 Memory length**

Slope에서는 history length 차이가 크지 않았습니다. 지속적인 slope는 current pose와 gravity vector만으로도 어느 정도 대응할 수 있기 때문입니다.

Step과 disturbance에서는 차이가 컸습니다.

- 긴 memory일수록 높은 step success가 증가
- Hind leg가 step을 만날 때 short-memory failure가 특히 큼
- TCN-100은 TCN-1보다 50 N lateral force 후 direction deviation이 35.5% 낮음

External force는 5초 동안 적용했습니다.

이 결과는 “memory가 항상 모든 terrain에서 중요하다”보다 다음처럼 읽는 것이 정확합니다.

> 현재 observation만으로 충분한 quasi-static condition에서는 이득이 작지만, 과거 collision이 이후 leg action에 영향을 줘야 하는 event-driven condition에서는 긴 memory가 중요하다.

### **12.2 Direct RL vs privileged training**

같은 TCN-20 architecture를 privileged distillation 없이 TRPO로 직접 학습한 baseline은,

- 10도·25도 slope에서 locomotion 실패
- 16 cm·18 cm step 통과 실패
- Mean reward가 teacher/student 수준에 도달하지 못함
- Episode length가 짧아 balance와 locomotion 자체를 학습하지 못함

즉 student architecture가 약해서가 아니라 sparse·difficult rough-terrain RL problem을 deployable observation만으로 처음부터 푸는 것이 어려웠습니다.

Privileged teacher는 더 informative한 state에서 먼저 locomotion을 학습하고, student가 그 solution을 따라가게 해 optimization problem을 나눴습니다.

### **12.3 Uniform terrain sampling vs adaptive curriculum**

전체 terrain parameter range에서 uniform sampling한 teacher는 adaptive curriculum teacher보다,

- Slope speed가 낮음
- Step success가 낮음
- Mean reward plateau가 낮음
- Mean episode length가 짧음

Uniform sampling은 현재 policy가 거의 통과할 수 없는 terrain을 자주 뽑아 episode가 빨리 끝났습니다. Adaptive curriculum은 성공 가능한 frontier에서 더 긴 trajectory와 유용한 learning signal을 만들었습니다.

### **12.4 TCN vs GRU와 latent-loss ablation**

Supplementary experiment의 결론은 더 세밀합니다.

- GRU: slope에서는 TCN-100과 비슷하지만 step은 TCN-100보다 낮음
- GRU training update: TCN-100보다 약 3배 느림
- TCN-100 without latent loss: slope·disturbance는 비슷하나 step success가 낮음

![Student architecture와 latent-loss ablation](/assets/img/posts/rl/sim2real/challenging-terrain/09-student-architecture-ablation.png){: width="720" .d-block .mx-auto }
_TCN-100, GRU와 action-only imitation인 TCN-100 naive IL을 비교한다. 각 model은 5개 seed로 학습되었다. 출처: [Lee et al., Figure S3](https://arxiv.org/pdf/2010.11251)._

따라서 “TCN만 가능하다”는 결론은 아닙니다. GRU도 유효하지만 이 setup에서는 긴 TCN이 step handling과 training efficiency에 더 유리했습니다.

---

## **13. TCN이 정말 Terrain을 추론했는가**

### **13.1 Decoder는 학습용 module이 아니다**

저자들은 trained TCN의 intermediate representation을 고정하고, 별도의 decoder를 나중에 학습했습니다.

Decoder가 복원한 대상은 다음과 같습니다.

- Foot contact state
- Terrain elevation과 normal
- Friction coefficient
- External force

Regression은 mean과 uncertainty를 출력하며 Gaussian negative log-likelihood를 사용했습니다.

$$
\mathcal L_{\mathrm{decode}}
=
\sum_i
\frac{
(m_i-x_i^{gt})^2
}{
2\sigma_i^2
}
+\log\sigma_i
$$

중요한 점은 decoder가 policy training이나 real control에 들어가지 않았다는 것입니다. **Representation probing 도구**입니다.

### **13.2 Foot-trapping analysis**

![TCN representation과 saliency로 분석한 foot-trapping](/assets/img/posts/rl/sim2real/challenging-terrain/06-foot-trapping-analysis.png){: width="1200" .d-block .mx-auto }
_A는 16.8 cm step response, B는 latent에서 decode한 terrain/contact, C-D는 foot target height에 대한 input-history saliency다. FT는 최초 foot collision 시점이다. 출처: [Lee et al., Figure 6](https://arxiv.org/pdf/2010.11251)._

Front foot가 step에 부딪힌 뒤 decoder는,

- 앞쪽 elevation estimate를 높임
- Terrain-normal estimate를 vertical contact에 맞게 바꿈
- Elevation uncertainty를 증가시킴
- Step을 오른 뒤에도 rough-terrain uncertainty를 일정 시간 유지

Saliency map에서는 first collision 시점의 left-front joint position, velocity와 position-error channel이 이후 foot-clearance output에 계속 영향을 주었습니다.

이것은 TCN이 과거 collision event를 활용한다는 강한 정황입니다.

그러나 saliency와 decoder reconstruction은 causal proof가 아닙니다.

- Decoder가 representation에 있는 상관관계를 읽었을 수 있습니다.
- Latent의 특정 component가 policy action에 반드시 필요한지는 별도 intervention이 필요합니다.
- Real terrain에서 decoded geometry가 정확하다고 직접 검증한 것은 아닙니다.

따라서 안전한 결론은 다음입니다.

> TCN representation에는 contact, terrain과 disturbance를 복원할 수 있는 정보가 포함되어 있었고, policy output은 과거 collision 시점에 민감했다.

### **13.3 Slip, payload와 vegetation에서도 latent가 변했다**

![Slip, payload와 자연환경에서 decode한 privileged information](/assets/img/posts/rl/sim2real/challenging-terrain/08-decoded-privileged-information.png){: width="900" .d-block .mx-auto }
_A는 wet whiteboard에서 friction estimate, B는 10 kg payload의 downward force, C-D는 vegetation과 natural terrain의 force·terrain reconstruction이다. 출처: [Lee et al., Figure S2](https://arxiv.org/pdf/2010.11251)._

- Wet whiteboard: first slip 뒤 friction estimate 감소
- Normal ground 복귀: 약 2초 뒤 friction estimate 회복
- 10 kg payload: downward external force를 decode
- Dense vegetation: motion 반대 방향 force를 decode
- Natural terrain: elevation uncertainty가 크게 나타남

Student가 2초 history를 사용하는 이유와 이 recovery timing이 연결됩니다.

---

## **14. Training Cost와 Runtime**

| Stage | Hardware | 시간 |
|---|---|---:|
| Teacher TRPO | i7-8700K + RTX 2080 | 약 12 h |
| TCN-100 student | 같은 desktop | 약 4 h |
| Terrain curriculum update | 같은 desktop | 2.9 s |
| Real inference | Onboard i7-5600U | 400 Hz |

Teacher hyperparameter의 주요 값은 다음과 같습니다.

| TRPO setting | 값 |
|---|---:|
| Discount factor | 0.995 |
| KL threshold | 0.01 |
| Max episode length | 400 steps |
| Batch size | 80,000 |
| Total iterations | 10,000 |

Student는 Adam으로 4,000 iteration 학습되고, TCN batch size는 20,000입니다.

이 숫자는 당시 custom RaiSim pipeline의 결과입니다. 다른 simulator, GPU와 vectorized environment 수에서 wall-clock을 직접 비교하면 안 됩니다.

---

## **15. Zero-Shot Generalization을 정확히 해석하기**

### **15.1 무엇이 zero-shot인가**

Policy는 natural deployment terrain에서 reward를 받아 fine-tuning하지 않았고, mud·snow·vegetation별 parameter tuning도 하지 않았습니다.

따라서 environment-level zero-shot transfer라는 표현은 적절합니다.

### **15.2 무엇이 완전한 zero-data는 아닌가**

- Robot의 CAD/rigid-body model이 필요합니다.
- Robot별 SEA actuator network를 real data로 학습합니다.
- State estimator와 joint PD controller가 필요합니다.
- Reward, PMTG와 terrain generator를 사람이 설계합니다.

즉 real-world task data를 사용하지 않았다는 것과 real robot data·engineering이 전혀 없다는 것은 다릅니다.

### **15.3 왜 simple simulation이 natural terrain으로 확장됐는가**

논문 결과만으로 mechanism을 단 하나로 확정할 수는 없지만, evidence가 지지하는 설명은 다음과 같습니다.

| 학습 요소 | Natural-terrain transfer에 기여한 연결 고리 |
|---|---|
| Procedural terrain·friction·disturbance | Collision, slip, imbalance에 대한 다양한 body response 생성 |
| Privileged teacher | 정확한 terrain/contact state에서 좋은 response 발견 |
| TCN distillation | Real에서 관측 가능한 response history로 hidden condition 추론 |
| PMTG + actuator model | 실행 가능한 motion prior와 realistic actuation 제공 |

Natural terrain의 픽셀이나 geometry가 training과 같아서가 아니라, **controller가 처리해야 하는 proprioceptive event class가 겹쳤기 때문**이라고 보는 편이 타당합니다.

---

## **16. 이 논문이 증명한 것과 증명하지 않은 것**

### **16.1 강하게 말할 수 있는 것**

1. Long proprioceptive history는 step과 disturbance 대응을 개선했습니다.
2. Deployable observation만으로 direct RL한 baseline은 rough-terrain locomotion을 학습하지 못했고, privileged training은 성공했습니다.
3. Adaptive terrain curriculum은 uniform sampling보다 test success, reward와 episode length를 개선했습니다.
4. Controller는 simulation에 없던 mud, snow, rubble, vegetation과 water에서 동작했습니다.
5. DARPA field deployment에서 4회의 60분 mission 동안 locomotion failure 0회를 기록했습니다.
6. 10 kg unseen payload, wet board와 16.8 cm foot trapping에 controlled robustness를 보였습니다.

### **16.2 조심해서 말해야 하는 것**

1. **Terrain을 정확히 reconstruct했다:** Decoder는 probe이며 deploy policy가 explicit map을 쓰는 것이 아닙니다.
2. **Vision/LiDAR가 필요 없다:** Blind locomotion은 unseen cliff나 gap을 피할 수 없습니다.
3. **모든 자연환경에 generalize한다:** 보고된 deployment set에서의 evidence입니다.
4. **Teacher 없이 불가능하다:** 이 architecture와 training budget의 direct-RL baseline이 실패한 결과입니다.
5. **TCN이 GRU보다 항상 낫다:** 이 실험에서는 TCN-100이 step과 update time에서 유리했습니다.
6. **RL controller가 logic을 전혀 쓰지 않는다:** Stand/locomotion 전환용 작은 state machine과 fixed FTG가 있습니다.

---

## **17. 한계**

### **17.1 Blind controller는 선제 planning을 못 한다**

논문 표현대로 cliff 방향으로 command하면 걸어갈 수 있습니다.

Contact 후 반응하는 능력은 뛰어나지만, 치명적 terrain을 contact 전에 피하려면 exteroception이 필요합니다.

### **17.2 Gait diversity가 제한된다**

Controller는 trot만 보였습니다. PMTG의 fixed phase structure와 reward가 다른 gait 발견을 제한했을 수 있습니다.

더 빠른 terrain에서는 gallop, 느린 terrain에서는 crawl처럼 gait를 바꾸는 결과는 보여주지 않습니다.

### **17.3 Conservative locomotion**

Terrain을 몸으로 느껴야 하므로 gait가 조심스럽고 speed가 낮습니다. Safe terrain에서 exteroception을 사용하면 더 빠르고 효율적인 locomotion이 가능할 수 있습니다.

### **17.4 Pipeline이 복잡하다**

실제로는 다음을 모두 관리해야 합니다.

- Teacher TRPO
- Privileged feature design
- Student TCN
- DAgger data collection
- Latent/action loss balance
- Terrain particle filter
- PMTG와 IK
- Actuator model과 state estimator

단일 end-to-end policy보다 component가 많고 debugging point도 많습니다.

### **17.5 Privileged state 설계에 expert knowledge가 들어간다**

Teacher가 local height, normal, contact, friction과 disturbance를 보도록 사람이 정했습니다. 어떤 privileged variable을 넣느냐가 teacher behavior와 student latent를 바꿉니다.

### **17.6 Natural-terrain evaluation의 통제 수준**

Outdoor terrain은 반복 가능한 standardized benchmark가 아닙니다. Speed/COT 비교는 유용하지만 sample 수, terrain variation과 confidence interval이 모든 조건에서 상세히 제시되지는 않습니다.

DARPA mission evidence와 indoor controlled experiment를 함께 봐야 합니다.

---

## **18. 재현한다면 확인할 순서**

### **Step 1. Flat-ground baseline**

Actuator model, estimator, PMTG, IK와 400 Hz control loop가 flat ground에서 안정적인지 먼저 확인합니다.

### **Step 2. Teacher privileged state 검증**

Terrain height와 normal의 frame, contact state, force와 friction unit을 하나씩 확인합니다.

- Height-sample frame과 foot ordering
- Terrain-normal direction
- Contact-force sign
- Foot별 friction
- External-force frame

Frame mismatch는 teacher가 simulation exploit을 배우게 만들 수 있습니다.

### **Step 3. Curriculum 없이 작은 terrain**

거의 flat hills와 낮은 step에서 teacher reward와 termination을 검증합니다. Particle filter를 붙이기 전에 single-terrain overfit test를 통과해야 합니다.

### **Step 4. Adaptive curriculum**

Particle별 traversability, weight, resampling과 replay ratio를 log합니다.

Pass criterion은 terrain parameter가 무작정 max difficulty로 몰리는 것이 아니라 policy 성능과 함께 frontier가 이동하는 것입니다.

### **Step 5. Student distillation**

다음 loss를 따로 기록합니다.

- Action imitation loss
- Latent imitation loss
- Teacher-student rollout disagreement
- Episode return
- History length별 step success

Offline validation만으로 끝내지 말고 student rollout에서 DAgger query가 실제로 늘어나는지 확인합니다.

### **Step 6. Diagnostic simulation ablation**

TCN-1, TCN-20, TCN-100을 slope, step, 50 N disturbance에 비교합니다. Natural terrain video보다 mechanism debugging에 유용합니다.

### **Step 7. Low-risk real test**

1. Flat floor
2. Low-friction mat
3. 3-5 cm fixed step
4. Loose but bounded board
5. Small payload
6. Outdoor terrain

Torque·joint-speed limit, emergency stop, fall harness와 operator clearance를 먼저 둡니다.

### **Step 8. Exteroception과 결합**

Blind policy를 fallback base로 유지하고, valid terrain estimate가 있을 때만 exteroceptive residual을 추가하는 구조가 현실적입니다.

---

## **19. 5편과 7편 사이에서 이 논문의 위치**

### **5편: actuator hidden state**

Hwangbo et al.은 짧은 joint history로 actuator의 delay와 hidden response를 model 안에 넣었습니다.

### **6편: terrain/contact hidden state**

Lee et al.은 2초 proprioceptive history로 terrain, contact와 disturbance의 흔적을 policy 안에 넣었습니다.

### **7편: explicit adaptation vector**

다음 RMA는 environment dynamics를 privileged encoder가 explicit latent $z_t$로 만들고, adaptation module이 recent history에서 그 latent를 빠르게 예측하도록 구조화합니다.

| Paper | History가 담당하는 hidden state |
|---|---|
| Hwangbo 2019 | Short joint history $\rightarrow$ actuator torque model |
| Lee 2020 | 2초 proprioception $\rightarrow$ implicit terrain/contact latent $\rightarrow$ action |
| RMA 2021 | Recent history $\rightarrow$ explicit environment latent $\rightarrow$ base policy |

6편은 **history가 online adaptation mechanism이 될 수 있다**는 흐름을 real natural terrain에서 강하게 보여준 연결점입니다.

---

## **20. 정리: Terrain Map보다 먼저 Body Response를 읽는다**

이 논문의 핵심은 여섯 가지로 압축할 수 있습니다.

1. **Teacher:** Rigid hills, slippery hills, steps와 stairs에서 terrain profile·contact·friction·disturbance를 privileged input으로 받아 TRPO로 학습했습니다.
2. **Student:** Deployable observation과 2초 proprioceptive history로 teacher action과 latent를 함께 모방했고, DAgger로 student 방문 분포를 따라갔습니다.
3. **Structured action:** Policy는 PMTG의 leg frequency와 foot residual을 출력하며, IK와 joint PD가 이를 real actuator command로 바꿨습니다.
4. **Adaptive difficulty:** Particle-filter curriculum은 traversability 0.5-0.9의 learning frontier를 추적했고, long memory·privileged training·adaptive curriculum은 각각 ablation에서 이득을 보였습니다.
5. **Real evidence:** ANYmal은 mud, snow, vegetation, rubble와 running water에서 동작했고, controlled test에서는 16.8 cm trapping, 10 kg payload와 wet surface를 따로 평가했습니다.
6. **Boundary:** Decoder와 saliency는 hidden-condition information의 근거이지 explicit terrain reconstruction의 증명은 아니며, blind control은 contact 전 cliff·gap avoidance를 해결하지 못합니다.

6편의 결론은 다음과 같습니다.

> Simulation이 자연환경을 그대로 복제하지 못하더라도, robot이 자신의 response history에서 contact와 mismatch를 읽도록 학습하면 simple training domain을 넘어서는 robustness가 나타날 수 있다.

다음 글: [Rapid Motor Adaptation, RMA](/posts/rma-rapid-motor-adaptation/)

다음 편에서는 이 hidden-condition inference를 더 명시적인 environment latent와 adaptation module로 분리한 **Rapid Motor Adaptation, RMA**를 살펴봅니다.

---

## **참고 자료**

- [Lee et al., arXiv abstract](https://arxiv.org/abs/2010.11251)
- [Lee et al., full paper and supplementary material](https://arxiv.org/pdf/2010.11251)
- [Science Robotics DOI](https://doi.org/10.1126/scirobotics.abc5986)
- [Official project page](https://leggedrobotics.github.io/rl-blindloco/)
- [Official summary video](https://youtu.be/9j2a1oAHDL8)
- [Baseline failures in natural terrain](https://youtu.be/txjqn8h6pjU)
- [Unstable debris experiment](https://youtu.be/Xnn4sVSpSh0)
- [Foot-trapping reflex](https://youtu.be/tPixnjLbTvE)
- [10 kg payload experiment](https://youtu.be/3Nr47MXCFO0)
- [Foot-slippage experiment](https://youtu.be/aMPwB3t4idU)
