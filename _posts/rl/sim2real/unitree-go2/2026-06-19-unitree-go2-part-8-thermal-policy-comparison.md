---
title: "[Unitree Go2 part 8] 온도 Reward는 왜 한 번 실패했나"
date: 2026-06-19 15:25:00 +0900
last_modified_at: 2026-06-23 00:00:00 +0900
categories: [RL, Sim2Real, Unitree Go2]
tags: [unitree-go2, sim2real, reinforcement-learning, thermal-reward, reward-hacking, mujoco]
description: Unitree Go2 thermal-only reward가 왜 기대와 다르게 동작했는지 ablation으로 분석하고, torque와 positive power를 reward에 직접 묶어야 했던 이유를 정리한다.
image: /assets/img/posts/unitree/sim2real/unitree-go2-part-8-thermal-policy-comparison/vx15_paper_thermal_metrics.png
math: true
---

## **1. 처음 기대와 실제 질문**

Part 7에서는 실제 Go2 `/lowstate` 로그에서 reported actuator temperature 모델을 만들고, 그 모델을 학습 환경의 thermal reward로 넣는 과정을 정리했습니다.

처음 기대는 단순했습니다.

> 온도 상승률을 penalty로 주면, policy가 알아서 덜 뜨거운 보행을 찾지 않을까?

하지만 결과는 그렇게 깔끔하지 않았습니다. 이 글은 성공한 thermal policy를 바로 보여주는 글이라기보다, 먼저 실패한 reward 설계를 분석하는 글에 가깝습니다.

실제로 확인해야 했던 질문은 이것이었습니다.

> 온도 상승률 proxy만 reward로 넣으면, policy가 실제 actuator load까지 좋은 방향으로 바꾸는가?

답은 아니었습니다.

온도만 reward로 넣으면 policy가 실제 actuator load를 줄이기보다, temperature surrogate가 덜 나빠 보이는 방식으로 움직일 수 있습니다. 이게 이번 글의 핵심입니다.

## **2. 비교한 세 모델**

이번 비교는 세 policy를 기준으로 봤습니다.

| policy | 의미 | thermal reward |
| --- | --- | --- |
| Baseline | 기존 보행 policy | 없음 |
| Thermal Feedback | 온도-only 모델 | fitted positive $\dot{T}$ penalty |
| Thermal-Torque Feedback | 온도+부하 모델 | $\dot{T}$ + torque/power + margin penalty |

Baseline은 locomotion reward만 보고 학습한 기준 모델입니다.

Thermal Feedback은 Part 7에서 만든 reported-temperature rate 모델을 보고, positive $\dot{T}$를 줄이도록 penalty를 받은 모델입니다.

Thermal-Torque Feedback은 Thermal Feedback에 torque와 positive mechanical power 관련 penalty를 추가한 모델입니다. 즉, 온도 surrogate만 보는 것이 아니라, 온도를 만드는 원인인 actuator load를 직접 묶은 모델입니다.

이 세 모델은 단순한 성능 순위 비교가 아닙니다. Baseline은 기존 보행의 기준선이고, Thermal Feedback은 "온도만 reward로 보면 되는가"를 확인하는 ablation입니다. Thermal-Torque Feedback은 그 ablation에서 드러난 빈틈을 막기 위해 만든 다음 설계입니다.

## **3. 비교 조건**

결과를 볼 때 가장 조심해야 하는 것은 속도입니다.

같은 `vx_cmd = 1.5 m/s`를 줘도 policy마다 실제 평균 속도가 달라집니다. 어떤 policy가 단순히 느리게 걸어서 덜 뜨거워진다면, 그건 좋은 thermal-aware locomotion이라고 보기 어렵습니다. 반대로 더 빠르게 걷지만 특정 actuator에 부하를 몰아도 좋은 결과라고 말하기 어렵습니다.

그래서 비교는 다음 기준으로 봤습니다.

| 항목 | 설정 |
| --- | --- |
| simulator | MuJoCo |
| command | `vx_cmd = 1.5 m/s` |
| rollout length | 480 s |
| thermal metric | corrected reported-temperature proxy |
| 비교 방식 | 이동거리로 normalize한 thermal metric |
| hardware role | real Go2 log collection과 model grounding |

여기서 중요한 선은 분명합니다. 이 결과는 learned thermal policy를 실제 Go2에 올려서 장시간 걸린 hardware result가 아닙니다. 실제 Go2 데이터는 thermal model을 만들고 grounding하는 데 사용했고, learned policy comparison은 MuJoCo에서 했습니다.

그래서 해석도 보수적으로 해야 합니다. 이 글에서 주장할 수 있는 것은 hardware deployment 성공이 아니라, `vx_cmd = 1.5 m/s` operating point에서 reward 설계가 corrected reported-temperature proxy와 gait behavior에 어떤 차이를 만들었는지입니다.

## **4. 결과: 온도-only는 기대처럼 좋아지지 않았다**

세 policy의 480초 rollout 결과부터 나란히 놓았습니다.

| policy | actual vx [m/s] | thermal dose [C*s/m] | max rise [C] | hotspot dose [C*s/m] |
| --- | ---: | ---: | ---: | ---: |
| Baseline | 1.30 | 44.2 | 45.0 | 216.1 |
| Thermal Feedback | 1.40 | 58.7 | 47.3 | 251.3 |
| Thermal-Torque Feedback | 1.36 | 34.2 | 40.9 | 157.8 |

여기서 `max rise [C]`는 rollout 동안 가장 많이 오른 reported temperature의 절대 상승량입니다. 반면 `thermal dose`와 `hotspot dose`는 이동거리로 normalize한 누적량이므로 단위가 `C*s/m`입니다. 뒤에서 쓰는 `peak reported-temp rise [C/m]`는 가장 많이 오른 reported-temperature rise를 이동거리로 나눈 값입니다.

표만 보면 이 차이가 잘 안 느껴집니다. 그래서 같은 `vx_cmd = 1.5 m/s`에서 짧은 10 m visualization을 같이 봤습니다. 아래 영상들은 thermal metric을 계산한 480 s rollout 자체가 아니라, 세 policy의 보행 형태, yaw drift, 발 궤적 차이를 보여주기 위한 시각화입니다. yaw drift를 드러내기 위해 이 짧은 시각화는 heading correction 없이 봤습니다.

먼저 10 m 지점에서 yaw가 얼마나 틀어지는지 보면 차이가 바로 보입니다. Thermal Feedback은 10 m에서 약 `-18.2 deg`까지 틀어지지만, Thermal-Torque Feedback은 거의 정면을 유지합니다.

<video controls playsinline preload="metadata" poster="/assets/img/posts/unitree/sim2real/unitree-go2-part-8-thermal-policy-comparison/vx1p5_yaw10m_comparison_preview.jpg" style="width: 100%; border-radius: 6px;">
  <source src="/assets/img/posts/unitree/sim2real/unitree-go2-part-8-thermal-policy-comparison/vx1p5_yaw10m_comparison.mp4" type="video/mp4">
</video>

사선 follow-view에서는 body 자세와 다리 움직임까지 비교할 수 있습니다.

<video controls playsinline preload="metadata" poster="/assets/img/posts/unitree/sim2real/unitree-go2-part-8-thermal-policy-comparison/vx1p5_follow_gait_comparison_preview.jpg" style="width: 100%; border-radius: 6px;">
  <source src="https://media.iamjaehka13.blog/assets/img/posts/unitree/sim2real/unitree-go2-part-8-thermal-policy-comparison/vx1p5_follow_gait_comparison.mp4" type="video/mp4">
</video>

마지막으로 top-view에서 rear feet trail을 같이 보면, Thermal Feedback의 발 궤적과 body yaw가 훨씬 더 흔들리는 것이 보입니다.

<video controls playsinline preload="metadata" poster="/assets/img/posts/unitree/sim2real/unitree-go2-part-8-thermal-policy-comparison/vx1p5_policy_comparison_preview.jpg" style="width: 100%; border-radius: 6px;">
  <source src="/assets/img/posts/unitree/sim2real/unitree-go2-part-8-thermal-policy-comparison/vx1p5_policy_comparison.mp4" type="video/mp4">
</video>

이 세 영상의 목적은 "누가 더 멋있게 걷는다"가 아니라, 온도-only reward가 보행 안정성과 load distribution에 빈틈을 만들 수 있다는 점을 눈으로 보여주는 것입니다. 이게 뒤에서 설명할 "온도만 보면 부족하고, torque와 power load를 같이 봐야 한다"는 해석을 시각적으로 보여줍니다.

![thermal metrics](/assets/img/posts/unitree/sim2real/unitree-go2-part-8-thermal-policy-comparison/vx15_paper_thermal_metrics.png){: .d-block .mx-auto }

여기서 제일 중요한 행은 Thermal Feedback입니다.

Thermal Feedback은 실제 속도가 `1.40 m/s`로 Baseline의 `1.30 m/s`보다 더 빠릅니다. 그래서 "느려져서 온도가 내려간 것"은 아닙니다. 그런데 thermal metric은 좋아지지 않았습니다.

Baseline과 비교하면 Thermal Feedback은:

1. thermal dose per meter가 `44.2`에서 `58.7`로 증가했습니다.
2. max reported-temperature rise가 `45.0 C`에서 `47.3 C`로 증가했습니다.
3. hotspot dose per meter가 `216.1`에서 `251.3`으로 증가했습니다.

즉, 온도-only reward는 "온도를 잘 줄이는 policy"로 바로 이어지지 않았습니다. 오히려 이 결과는 온도 proxy만 objective에 넣었을 때 policy가 어떤 빈틈을 찾을 수 있는지 보여줍니다.

## **5. 이걸 실패로만 보면 안 되는 이유**

처음에는 이 결과가 이상해 보였습니다.

온도 reward를 줬는데 왜 더 뜨거워지는가?

하지만 이것을 단순히 "온도 모델이 망했다"라고 보면 분석이 멈춥니다. 더 정확한 해석은 다음입니다.

> Thermal-only reward는 policy가 reward를 해킹할 수 있는 빈틈을 드러냈다.

여기서 reward hacking이라는 말은 policy가 나쁜 의도를 가졌다는 뜻이 아닙니다. 강화학습 policy는 우리가 써준 reward를 최대화할 뿐입니다. reward가 실제 목표를 충분히 잘 표현하지 못하면, policy는 사람이 원하지 않는 방식으로도 점수를 올릴 수 있습니다.

이번 경우에는 reported-temperature rate만 penalty로 줬습니다. 즉, reward는 policy에게 이렇게 말한 셈입니다.

> fitted positive $\dot{T}$를 줄여라.

하지만 우리가 진짜 원했던 것은 조금 다릅니다.

> 특정 actuator에 부담이 몰리지 않게 하면서, command를 따라 걷고, 실제 torque와 power load도 줄여라.

이 둘은 같은 말이 아닙니다.

그래서 Thermal Feedback의 나쁜 결과는 단순 실패가 아닙니다. 오히려 다음 reward 설계에서 어떤 물리량을 직접 묶어야 하는지 알려주는 실험이었습니다.

## **6. 온도만 보면 왜 빈틈이 생기나**

Thermal Feedback에서 사용한 핵심 항은 `thermal_log_dtemp`였습니다.

이 항은 EMA로 smoothing한 positive temperature rate를 보고 penalty를 줍니다.

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

이 구조는 직관적으로는 맞습니다. 뜨거워질 것 같은 motor의 positive temperature rate를 줄이라는 뜻이기 때문입니다.

하지만 이 항은 torque 자체를 직접 줄이라고 말하지 않습니다. positive mechanical power를 직접 줄이라고도 말하지 않습니다. 좌우 load balance를 직접 강하게 묶지도 않습니다.

그래서 policy 입장에서는 다음과 같은 이상한 해를 찾을 수 있습니다.

1. temperature surrogate가 덜 나빠지는 방향으로 load를 재분배한다.
2. 특정 motor나 특정 leg group에 부담을 몰아도 reward가 즉시 강하게 막지 못한다.
3. 전체 보행은 유지하지만 yaw, lateral drift, hotspot distribution이 이상해진다.
4. 결과적으로 "온도 reward를 받았는데 실제 thermal metric은 더 나빠지는" 상황이 생긴다.

이게 온도-only reward의 핵심 문제였습니다. 온도는 봤지만, 온도를 만드는 원인을 충분히 직접 제어하지 못한 것입니다.

## **7. torque를 봐야 원인이 보인다**

원인을 분석할 때 중요한 것은 temperature trace만 보는 것이 아니었습니다. 온도는 결과이고, torque와 positive mechanical power는 원인에 가깝습니다.

그래서 다음 질문을 봐야 했습니다.

> Thermal-only policy가 정말 actuator load를 줄였는가?

여기서 답이 깔끔하지 않았습니다. 온도-only 모델은 fitted $\dot{T}$ surrogate를 줄이는 방향으로 학습되었지만, torque와 positive power가 실제로 좋은 방향으로 정리되었다고 보기 어려웠습니다.

아래 그림처럼 policy별로 max reported-temperature trace를 보면, Thermal Feedback은 오히려 더 높은 온도 영역으로 올라갑니다.

![temperature trace](/assets/img/posts/unitree/sim2real/unitree-go2-part-8-thermal-policy-comparison/vx15_capstone_temperature_trace.png){: .d-block .mx-auto }

motor별 rise를 봐도 Thermal Feedback은 특정 motor hotspot 쪽 부담이 남습니다.

![motor temp rise](/assets/img/posts/unitree/sim2real/unitree-go2-part-8-thermal-policy-comparison/vx15_capstone_motor_temp_rise.png){: .d-block .mx-auto }

이 분석 때문에 결론이 바뀌었습니다.

> 온도 feedback만 줄 게 아니라, 온도를 만드는 물리적 원인인 torque와 positive power를 reward에 직접 묶어야 한다.

## **8. 그래서 Thermal-Torque Feedback으로 바꿨다**

Thermal-Torque Feedback은 Thermal Feedback에 다음 항들을 추가합니다.

| term | 역할 |
| --- | --- |
| `thermal_weighted_torque` | hotspot weight가 큰 motor의 torque 제곱을 직접 줄임 |
| `thermal_weighted_power` | 양의 mechanical power 부담을 직접 줄임 |
| `thermal_power_margin` | command speed 기준 power budget을 넘는 경우만 penalty |
| `thermal_torque_margin` | command speed 기준 torque-squared budget을 넘는 경우만 penalty |

Thermal-only는 "온도 surrogate를 낮춰라"에 가까웠습니다. Thermal-Torque Feedback은 "온도를 만드는 load 자체를 줄여라"에 더 가깝습니다.

margin term도 중요합니다. 무조건 torque와 power를 작게 만들면 policy가 느려지거나 보행을 포기할 수 있습니다. 그래서 command speed에 따라 허용 가능한 budget을 두고, 그 budget을 넘는 excess만 강하게 penalty로 줬습니다.

$$
\ell_{\mathrm{margin}}
=
\max \left(0, \frac{P^+ - \bar{P}(v^{cmd})}{s_P}\right)^2
+
\max \left(0, \frac{\sum_j \tau_j^2 - \bar{Q}(v^{cmd})}{s_Q}\right)^2
$$

이렇게 하면 policy가 필요한 만큼의 actuator load는 쓰되, 특정 motor에 과도하게 몰리는 부하를 줄이는 방향으로 학습됩니다. Part 7에서 만든 temperature-rate proxy는 그대로 쓰지만, proxy 하나에 모든 책임을 맡기지 않는 구조입니다.

## **9. 최종 결과 해석**

Thermal-Torque Feedback은 `vx_cmd = 1.5 m/s` 조건에서 다음과 같이 바뀌었습니다.

![summary metrics](/assets/img/posts/unitree/sim2real/unitree-go2-part-8-thermal-policy-comparison/vx15_capstone_summary_metrics.png){: .d-block .mx-auto }

Baseline 대비:

| metric | Baseline | Thermal-Torque Feedback | 변화 |
| --- | ---: | ---: | ---: |
| actual vx [m/s] | 1.30 | 1.36 | +0.06 |
| thermal dose [C*s/m] | 44.2 | 34.2 | -22.5% |
| max rise [C] | 45.0 | 40.9 | -9.2% |
| peak reported-temp rise [C/m] | 0.072 | 0.063 | -13.2% |
| hotspot dose [C*s/m] | 216.1 | 157.8 | -27.0% |

여기서 중요한 것은 actual vx입니다. Thermal-Torque Feedback은 Baseline보다 느리게 걸어서 thermal metric을 낮춘 것이 아닙니다. 실제 평균 속도는 `1.36 m/s`로 Baseline의 `1.30 m/s`보다 약간 높았습니다.

그래서 이 결과는 다음처럼 해석하는 것이 안전합니다.

> `vx_cmd = 1.5 m/s` MuJoCo corrected-fit evaluation에서 Thermal-Torque Feedback은 command tracking을 크게 포기하지 않으면서 corrected reported-temperature risk와 hotspot accumulation을 줄였다.

여기서도 "안전합니다"의 의미는 중요합니다. 이 문장은 실제 Go2 hardware에서 장시간 thermal policy deployment를 했다는 뜻이 아닙니다. 실제 로그로 grounded한 reported-temperature proxy를 기준으로, MuJoCo policy comparison에서 reward 설계 차이가 어떤 방향으로 나타났는지를 말하는 것입니다.

## **10. 이 결과가 말해주는 범위**

> 온도만 reward로 넣으면 reward hacking이 생길 수 있다. Thermal-aware locomotion을 만들려면 temperature feedback뿐 아니라 torque와 positive power 같은 physical load term을 같이 묶어야 한다.

Thermal Feedback의 나쁜 결과도 버릴 데이터는 아니었습니다. Temperature proxy 하나만 최적화했을 때 생기는 빈틈을 보여주는 ablation이었고, torque와 power term을 추가한 이유를 설명해줬습니다.

## **11. 해석의 제한**

Learned thermal policy 비교는 MuJoCo에서 수행했고, 실제 Go2는 log collection과 thermal model grounding에 사용했습니다. 따라서 이 결과를 실제 하드웨어 장시간 배포 성능으로 해석할 수는 없습니다. 비교 범위도 `vx_cmd = 1.5 m/s` operating point로 제한되며, 더 높은 속도에서는 reward를 다시 조정해야 할 수 있습니다.

이번 metric은 battery saving이나 motor winding temperature를 직접 측정한 값도 아닙니다. Go2가 제공하는 onboard reported actuator temperature를 바탕으로 만든 corrected risk proxy와 hotspot accumulation을 비교했습니다.

## **12. 온도 proxy에서 물리적 부하로**

Baseline과 Thermal-only를 비교했을 때, temperature-rate surrogate만 넣은 policy는 오히려 thermal dose와 hotspot dose가 증가했습니다. Policy가 surrogate의 빈틈을 이용해 특정 motor에 부담을 몰 수 있다는 뜻이었습니다. Torque와 positive power를 직접 묶은 뒤에는 objective가 actuator load 자체를 줄이는 쪽으로 바뀌었고, `vx_cmd = 1.5 m/s` MuJoCo corrected-fit 비교에서 세 thermal metric이 모두 낮아졌습니다.

> 온도 reward는 물리적 부하 항과 같이 설계해야 한다.
