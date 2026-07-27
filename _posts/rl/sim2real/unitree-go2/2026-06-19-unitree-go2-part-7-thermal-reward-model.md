---
title: "[Unitree Go2 part 7] 모터 온도를 Reward로 넣기"
date: 2026-06-19 15:00:00 +0900
last_modified_at: 2026-07-27 22:47:54 +0900
categories: [RL, Sim2Real, Unitree Go2]
tags: [unitree-go2, sim2real, reinforcement-learning, thermal-model, reward-shaping, reported-temperature]
description: Unitree Go2 lowstate 로그에서 reported actuator temperature를 보고, 온도 자체가 아니라 load 기반 temperature-rate proxy를 thermal-aware reinforcement learning reward로 연결한 과정을 정리한다.
image: /assets/img/posts/unitree/sim2real/unitree-go2-part-7-thermal-reward-model/vx15_model_input_closeup.png
math: true
---

## **1. Part 6에서 남은 문제**

Part 6에서는 실제 Go2에서 baseline policy를 굴리면서 `/lowstate` 데이터를 모았다. 그때 기록한 핵심 값은 joint position, joint velocity, estimated torque, reported actuator temperature, battery current, pack voltage이었다.

그 데이터를 모은 이유는 단순했다. 이제 목표가 "걷는다"에서 끝나지 않았기 때문. 실제 로봇에서 장시간 보행을 하려면, policy가 command를 잘 따라가는지뿐 아니라 어떤 actuator에 부담이 쌓이는지도 봐야 한다.

처음에는 real robot log를 모으면 바로 thermal-aware controller로 넘어갈 수 있을 것 같았다. 그런데 로그를 보면 문제가 조금 더 복잡했다. 평균 온도나 전체 전류만 보면 괜찮아 보여도, 특정 actuator만 먼저 뜨거워지는 경우가 있었다. 한 모터가 먼저 thermal bottleneck이 되면 전체 운용 시간은 그 모터가 제한한다.

그래서 이번 글의 질문은 다음처럼 바뀌었다.

> 실제 Go2에서 보인 reported thermal behavior를 학습 중 policy가 볼 수 있는 신호로 어떻게 바꿀 것인가?

그래서 이번 단계의 목표는 다음과 같았다.

1. 실제 로그에서 reported actuator temperature가 어떻게 올라가는지 보기
2. torque, joint velocity, current 같은 load 값으로 온도 상승률을 설명하는 함수 만들기
3. 그 함수를 MuJoCo 학습 환경에 넣어 training-time thermal state로 사용하기
4. 온도 상승을 줄이는 방향의 reward를 설계하기

여기서 선을 먼저 그어야 한다. 우리가 직접 motor winding temperature를 측정한 것은 아니다. Go2에서 읽은 값은 onboard reported actuator temperature. 그래서 이 글에서도 계속 **reported actuator temperature**라고 부르겠다.

## **2. 처음 생각: 온도를 바로 벌주면 되지 않나**

처음 생각하면 간단해 보인다.

> 온도가 높아지면 penalty를 주면 되는 것 아닌가?

하지만 RL reward로 넣으려면 그렇게 단순하지 않았다.

첫째, reported temperature는 빠르게 변하는 값이 아니다. 보행 action은 수십 Hz로 바뀌지만, 온도는 느리게 누적된다. 현재 온도만 penalty로 주면 policy 입장에서는 어떤 action이 지금의 온도를 만든 것인지 알기 어렵다.

둘째, reported temperature는 정수 단위로 기록되고, sensor나 firmware 내부 filtering이 들어간 값이다. 샘플마다 단순 차분해서 `dT/dt`를 만들면 노이즈와 양자화가 크게 섞인다.

셋째, 현재 온도가 낮아도 지금 torque와 power가 크면 몇십 초 뒤에 문제가 될 수 있다. 반대로 현재 온도가 높아도 load가 작고 cooling 중이면 그 순간의 action을 무조건 나쁘다고 볼 수 없다. 온도는 결과이고, reward가 보고 싶은 것은 그 결과를 만드는 현재 load에 더 가깝다.

그래서 reward에 바로 넣고 싶은 값은 온도 자체가 아니라, **현재 load가 앞으로 reported temperature를 얼마나 올릴 것인지**이었다. 즉, high-fidelity thermal simulator가 아니라 학습에 쓸 수 있는 compact thermal risk proxy가 필요했다.

## **3. 실제 로그에서 본 문제: 열이 균일하게 오르지 않음**

먼저 실제 로그를 보면 actuator별 reported temperature 상승이 균일하지 않다.

![real log spatial thermal imbalance](/assets/img/posts/unitree/sim2real/unitree-go2-part-7-thermal-reward-model/real_log_spatial_thermal_imbalance.png){: .d-block .mx-auto }

이 그림의 값은 절대 온도가 아니라, 각 motor가 분석 window 시작 시점 대비 얼마나 더 뜨겁게 보고되었는지를 나타낸다. 즉 motor $j$에 대해 다음 값을 계산한 것.

$$
\Delta T^{\mathrm{peak}}_j
= \max_t \left(T_j(t) - T_j(t_0)\right)
$$

따라서 단위는 `C`. 예를 들어 어떤 칸이 `8 C`라면, 그 motor의 reported actuator temperature가 해당 window 시작점보다 최대 `8 C` 더 높게 보고되었다는 뜻이다. 이 값은 실제 winding temperature를 직접 측정한 값이 아니라 Go2가 `/lowstate`로 제공한 onboard reported actuator temperature의 상승량.

같은 보행 중에도 어떤 motor는 거의 평균 근처에 있고, 어떤 motor는 훨씬 빠르게 올라간다. 이게 중요한 이유는 thermal bottleneck이 평균으로 생기지 않기 때문.

예를 들어 12개 motor 평균이 괜찮아 보여도, 한두 개 motor가 빠르게 올라가면 그 motor가 전체 rollout을 제한한다. 그래서 thermal reward도 전체 평균만 줄이는 방향이면 부족하다. 어느 motor가 hotspot이 되는지, 그리고 그 motor에 torque와 positive mechanical power가 계속 들어가는지를 같이 봐야 한다.

이 지점에서 Part 6의 데이터 수집이 reward 설계 문제로 연결된다. Policy가 받아야 할 신호는 막연한 온도 감소보다 **hotspot actuator에 쌓이는 load를 줄이는 방향**이어야 했다.

## **4. 온도 상승률 모델**

그래서 먼저 motor별 reported-temperature rate를 설명하는 작은 모델을 만들었다. 목적은 정교한 actuator thermal simulator가 아니라, 실제 Go2 log에서 관찰한 상승 경향을 학습 중에 재사용할 수 있는 proxy로 만드는 것이다.

사용한 temperature-rate proxy는 아래 식.

$$
\begin{aligned}
\dot{T}_j =
&\beta_{0,g}
+\beta_{\tau,g}\tau_j^2
+\beta_{p,g}^{+}\max(\tau_j\dot{q}_j,0) \\
&+\beta_{|p|,g}|\tau_j\dot{q}_j|
+\beta_{I,g}I^2
-\beta_{c,g}(T_j-T_{\mathrm{amb}})
\end{aligned}
$$

여기서 $j$는 motor index이고, $g$는 motor group. 각 항은 서로 다른 부하와 cooling 효과를 나타낸다.

| 항 | 의미 |
| --- | --- |
| $\tau_j^2$ | torque가 클수록 생기는 Joule-heating류 부담 |
| $\max(\tau_j\dot{q}_j,0)$ | motor가 양의 mechanical work를 할 때의 power 부담 |
| $\lvert\tau_j\dot{q}_j\rvert$ | positive/negative work를 모두 포함한 load proxy |
| $I^2$ | battery current 기반 전체 부하 proxy |
| $-(T_j-T_{\mathrm{amb}})$ | 주변 온도와의 차이에 따른 cooling |

엄밀히 말하면 이 모델은 actuator 내부 열전달을 완전히 설명하는 모델이 아니다. 여기서 필요한 것은 논문용 motor physics simulator가 아니라, 실제 Go2 로그에서 관찰된 reported temperature 상승 경향을 학습 중에 재현할 수 있는 risk proxy이다.

## **5. 12개 motor를 그대로 따로 fit하지 않은 이유**

Go2에는 12개 actuator가 있다. 가장 단순한 방법은 12개 motor마다 coefficient를 따로 fit하는 것. 하지만 데이터가 충분히 많지 않은 상태에서 그렇게 하면 특정 log에 과하게 맞을 위험이 크다.

그래서 motor를 다음 6개 group으로 묶었다.

$$
\{\mathrm{front}, \mathrm{rear}\}
\times
\{\mathrm{hip}, \mathrm{thigh}, \mathrm{calf}\}
$$

즉, front hip, front thigh, front calf, rear hip, rear thigh, rear calf의 coefficient를 학습한다. 좌우 motor는 같은 group coefficient를 공유하지만, 실제 training-time temperature state는 12개 motor를 따로 유지한다.

이렇게 하면 두 가지 장점이 있다.

1. coefficient가 해석 가능하다. 예를 들어 front/rear, hip/thigh/calf 차이를 볼 수 있다.
2. 12개를 완전히 독립으로 fit하는 것보다 overfit 위험이 줄어든다.

아래 그림은 group별 coefficient를 정리한 것.

![thermal fit coefficients](/assets/img/posts/unitree/sim2real/unitree-go2-part-7-thermal-reward-model/thermal_fit_coefficients.png){: .d-block .mx-auto }

## **6. fitting data와 validation**

모델 fitting에는 실제 Go2 walking log를 사용했다. 주요 fitting data는 `vx0.5`, `vx0.7`, 그리고 2026-05-27에 수집한 `vx0.5 + stand + rest + vx0.5` segment이었다.

Held-out validation에는 fitting에 직접 쓰지 않은 구간을 사용했다. 여기서 보고 싶은 것은 "온도를 완벽하게 맞췄다"가 아니라, active walking 구간에서 reported-temperature trend를 reward proxy로 쓸 수 있을 정도로 따라가는지이었다.

![vx1.5 real telemetry compact](/assets/img/posts/unitree/sim2real/unitree-go2-part-7-thermal-reward-model/vx15_real_telemetry_compact.png){: .d-block .mx-auto }

| validation segment | mean motor RMSE | end max error |
| --- | ---: | ---: |
| 기존 `vx1.0` validation | 1.26 C | 3.26 C |
| 2026-05-27 `active_vx0.5` stress | 2.49 C | +7.22 C |
| 2026-05-27 `active_vx1.5` stress | 1.22 C | +2.26 C |

이 숫자를 해석할 때도 조심해야 한다. 이 모델은 "실제 motor core temperature를 정확히 맞췄다"가 아니다. 실제 로그의 reported actuator temperature를 active walking 구간에서 어느 정도 재현하는 proxy이다.

또 하나의 주의점은 2026-05-27 bag에는 `/cmd_vel`이 직접 들어 있지 않았다는 점. 그래서 `vx0.5`, `vx1.5` 같은 label은 directory name과 manual phase split에서 온 metadata. 논문이나 발표에서는 이 부분을 과장하면 안 된다.

## **7. MuJoCo 학습 환경에 온도 state 넣기**

다음 단계는 이 proxy를 학습 환경 안으로 넣는 것이었다. 학습 중에는 실제 sensor가 없기 때문에, MuJoCo에서 나오는 torque와 joint velocity를 이용해 12개 motor temperature state를 업데이트했다.

$$
T_{j,t+1} = T_{j,t} + \Delta t \dot{T}_j
$$

구현에서는 simulated torque, joint velocity, current proxy를 모델에 넣고, 예측된 $\dot{T}$를 EMA로 smoothing한다. 그리고 policy observation에도 thermal state를 추가했다.

기본 locomotion policy observation은 47-D이었다. Thermal policy는 여기에 30-D thermal/load observation을 추가해서 77-D가 된다.

Thermal observation에는 대략 다음 정보가 들어간다.

| observation | 의미 |
| --- | --- |
| 12개 temperature margin | limit temperature까지 남은 여유 |
| 12개 temperature rate | EMA로 smoothing한 reported-temperature rate |
| current / power / torque summary | 전체 load 상태 |
| max temperature / hotspot gap / max rate | 가장 위험한 motor 쪽 요약 |

여기서도 목적은 policy에게 "지금 어느 motor가 위험한가"와 "지금 action이 thermal load를 만들고 있는가"를 알려주는 것이다. 즉, observation을 늘린 이유는 policy를 더 복잡하게 만들기 위해서가 아니라, thermal risk를 상태로 볼 수 있게 하기 위해서이었다.

![model input closeup](/assets/img/posts/unitree/sim2real/unitree-go2-part-7-thermal-reward-model/vx15_model_input_closeup.png){: .d-block .mx-auto }

## **8. 첫 번째 시도: 온도 상승률 penalty**

가장 먼저 넣은 thermal reward는 fitted temperature rate에 대한 penalty이었다. 이 시도는 직관적으로 가장 직접적.

첫 reward는 positive temperature rate를 motor별 위험도에 따라 가중했다.

$$
\ell_{\dot{T}}
=
\mathrm{mean}_j
\left[
w_j \cdot
g_j(T) \cdot
\frac{\max(\mathrm{EMA}(\dot{T}_j), 0)}{s_{\dot{T}}}
\right]
$$

그리고 reward에는 이 값을 음수로 넣는다.

$$
r_{\mathrm{thermal}}
=
-\lambda_{\dot{T}} \ell_{\dot{T}}
$$

구현상 중요한 디테일은 세 가지.

첫째, 음의 temperature rate는 크게 벌주지 않는다. 즉, motor가 식고 있으면 그 자체는 나쁜 action으로 보지 않는다.

둘째, predicted temperature가 warning temperature 근처로 갈수록 gate가 커진다. 현재 temperature가 충분히 낮으면 같은 $\dot{T}$라도 penalty가 상대적으로 약하고, warning 근처에서는 더 강해진다.

셋째, motor별 weight를 둔다. 실제 로그에서 더 자주 hotspot이 되는 group에 penalty가 더 민감하게 들어가도록 했다.

이렇게 하면 일반적인 torque regularization 대신 실제 Go2 log에서 fitting한 reported-temperature rate를 줄이는 방향으로 policy를 학습시킬 수 있다.

하지만 이 reward만으로는 문제가 남았다.

## **9. 왜 speed_deficit이 필요했나**

Thermal reward를 넣으면 policy가 가장 쉽게 찾을 수 있는 해킹이 있다.

> 안 걸으면 안 뜨거워진다.

이건 우리가 원하는 해결책이 아니다. 우리는 Go2가 command를 따라 걸으면서 thermal risk를 줄이길 원한다. 그래서 thermal policy에는 speed deficit penalty가 같이 들어간다.

구현은 command 방향의 실제 속도를 보고, command speed보다 너무 느리면 벌주는 형태다.

$$
\ell_{\mathrm{speed}}
=
\max(\|v^{cmd}_{xy}\| - v_{\mathrm{along\ cmd}} - \epsilon, 0)^2
$$

여기서 $\epsilon$은 작은 tolerance. 현재 설정에서는 `0.10 m/s` 정도의 여유를 두고, command speed가 너무 작은 경우에는 이 penalty를 끈다.

즉, thermal policy는 "덜 뜨거워져라"만 받는 것이 아니라, "그래도 command 방향으로 걸어라"를 같이 받는다. 이 항이 없으면 thermal reward는 locomotion task를 해결하는 대신 task 자체를 피하는 방향으로 학습될 수 있다.

## **10. 그래도 온도만 보면 부족했다**

초기 thermal-only reward는 fitted $\dot{T}$를 줄이는 데 집중했다. 그런데 여기에는 약점이 있다.

온도 모델은 proxy. policy가 이 proxy만 보고 최적화하면, 실제 actuator load를 줄이지 않고도 surrogate를 낮추는 방향을 찾을 수 있다. 예를 들어 특정 다리에 부담을 몰거나, yaw가 틀어진 상태에서 이상한 load distribution을 만들 수도 있다.

이건 reward 설계에서 흔한 문제다. reward가 우리가 원하는 물리적 목적을 충분히 표현하지 못하면, policy는 reward가 허용하는 빈틈을 찾는다. 이번 경우에는 "reported-temperature rate를 낮춰라"와 "실제 actuator load를 건강하게 분산해라"가 완전히 같은 말이 아니었다.

그래서 이후에는 temperature rate만 보지 않고, torque와 positive mechanical power를 직접 reward에 넣었다.

최종 reward에서 각 term이 맡은 역할은 아래와 같다.

| term | 역할 |
| --- | --- |
| `thermal_log_dtemp` | fitted positive reported-temperature rate를 줄임 |
| `speed_deficit` | thermal reward 때문에 느려지거나 멈추는 reward hacking 방지 |
| `thermal_weighted_torque` | hotspot weight가 큰 motor의 torque 제곱을 직접 줄임 |
| `thermal_weighted_power` | 양의 mechanical power 부담을 직접 줄임 |
| `thermal_power_margin` | command speed 기준 power budget을 넘는 경우만 강하게 penalty |
| `thermal_torque_margin` | command speed 기준 torque-squared budget을 넘는 경우만 강하게 penalty |

여기서 margin term은 무조건 torque와 power를 작게 만들려는 항이 아니다. command speed에 따른 budget을 두고, 그 budget을 넘는 excess만 penalty로 준다.

$$
\ell_{\mathrm{margin}}
=
\max \left(0, \frac{P^+ - \bar{P}(v^{cmd})}{s_P}\right)^2
+
\max \left(0, \frac{\sum_j \tau_j^2 - \bar{Q}(v^{cmd})}{s_Q}\right)^2
$$

이렇게 한 이유: policy가 필요한 만큼의 load는 쓰되, 특정 상황에서 과도한 torque/power를 쓰는 행동은 피하게 만드는 것.

## **11. 결국 비교해야 할 세 policy**

이번 실험에서 비교할 policy family는 크게 세 개.

| policy | observation | thermal reward |
| --- | --- | --- |
| Baseline | 47-D locomotion obs | 없음 |
| Thermal Feedback | 77-D locomotion + thermal obs | fitted positive $\dot{T}$ penalty |
| Thermal-Torque Feedback | 77-D locomotion + thermal obs | $\dot{T}$ + torque/power + margin penalty |

Baseline은 기존 locomotion reward만 본다.

Thermal Feedback은 온도 observation과 fitted temperature-rate penalty를 받는다. 그래서 이 policy는 "앞으로 temperature가 올라갈 것 같은 action을 줄여라"는 신호를 받는다.

Thermal-Torque Feedback은 여기에 torque와 positive power를 직접 묶는다. 즉, "온도 surrogate를 낮춰라"에서 끝나는 것이 아니라, "실제로 actuator load를 만드는 원인을 줄여라"에 더 가깝게 reward를 바꾼 것이다.

이 세 policy를 분리해서 보는 이유는 중요하다. Thermal Feedback이 실패하더라도 그건 단순히 버릴 결과가 아니다. 온도-only reward가 어디까지 통하고 어디서 깨지는지를 보여주는 ablation이 된다.

## **12. 이번 글에서 주장하지 않는 것**

여기서 선을 분명히 그어야 한다.

이번 Part 7은 thermal model과 reward를 만든 글. 아직 이 글만으로 "thermal policy가 baseline보다 무조건 좋다"라고 주장하면 안 된다.

특히 다음 confound를 조심해야 한다.

1. policy마다 realized speed가 다르면 energy per meter와 temperature rise 비교가 왜곡될 수 있다.
2. thermal reward가 gait를 바꿔 yaw drift나 lateral drift를 키울 수 있다.
3. fitted thermal model은 proxy이므로, proxy만 낮추는 reward hacking이 생길 수 있다.
4. learned thermal policy는 아직 hardware deployment 결과로 주장하면 안 된다. 실제 Go2 hardware는 log collection과 model grounding에 사용한 것.

그래서 다음 글에서는 실제로 학습한 모델들을 비교할 때, command만 맞추는 것이 아니라 realized speed와 distance-normalized metric을 같이 보려고 한다.

## **13. 다음 글**

Part 8에서는 이제 실제 policy comparison으로 넘어간다.

봐야 할 질문은 단순하다.

> 온도 reward를 넣으면 정말 더 좋은 보행이 되는가?

하지만 답은 그렇게 단순하지 않았다. 온도-only 모델은 특정 metric에서는 좋아 보이지만, yaw drift나 hotspot accumulation이 나빠지는 경우가 있었다. 결국 temperature rate만 reward로 넣는 것보다, torque와 positive power를 직접 묶은 Thermal-Torque Feedback 쪽이 더 해석 가능한 방향으로 갔다.

다음 글에서는 baseline, thermal-only, thermal-torque policy를 같은 조건에서 비교하고, 왜 thermal-only reward가 이상한 해를 찾을 수 있었는지 정리하겠다.
