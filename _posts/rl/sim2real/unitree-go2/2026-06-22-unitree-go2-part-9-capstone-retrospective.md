---
title: "[Unitree Go2 part 9] 종합설계 후기"
date: 2026-06-22 11:00:00 +0900
categories: [RL, Sim2Real, Unitree Go2]
tags: [unitree-go2, sim2real, reinforcement-learning, capstone-design, thermal-reward, locomotion, lidar-slam]
description: Unitree Go2 종합설계를 마무리하며 모터 온도 reward, torque/load 관점, 실제 로봇 실험에서 느낀 문제 정의의 중요성, 그리고 다음 연구 방향을 정리한다.
image: /assets/img/posts/unitree/sim2real/unitree-go2-part-8-thermal-policy-comparison/vx1p5_yaw10m_comparison_preview.jpg
math: true
---

## **1. 종합설계를 끝내고**

이번 글은 새로운 실험 결과라기보다, Unitree Go2 종합설계를 마무리하면서 남은 생각을 정리하는 글입니다.

종합설계를 진행하면서 가장 크게 느낀 것은 실제 로봇 연구에서는 아이디어 자체보다도 **문제를 어떻게 정의하느냐**가 훨씬 중요하다는 점이었습니다.

처음에는 "모터 온도"를 꽤 직접적인 문제로 봤습니다. 전류가 커지면 torque가 커지고, torque가 커지면 발열도 커진다는 흐름이 있었기 때문입니다. 그래서 보행 중 actuator reported temperature를 보고, 이를 reward나 feedback에 넣으면 더 thermal-safe한 locomotion을 만들 수 있을 것이라고 생각했습니다.

하지만 실제 로봇을 움직이고, 데이터를 모으고, sim-to-real을 겪으면서 생각이 조금 바뀌었습니다.

> 어쩌면 우리가 처음부터 봐야 했던 것은 온도 자체가 아니라, 온도를 만들게 되는 보행의 충격과 motor load였을 수 있다.

이게 이번 종합설계를 끝내고 가장 크게 남은 부분입니다.

## **2. 지도와 주제 설정**

우리 학교에는 로봇을 전문적으로 다루는 연구실이나 교수님이 많지 않았습니다. 지도교수님의 주 연구 분야도 모터 쪽에 가까웠기 때문에, 로봇 시스템, 강화학습, sim-to-real에 대한 세부적인 방향 설정은 스스로 고민해야 하는 부분이 많았습니다.

이게 꼭 나쁜 경험이었다는 뜻은 아닙니다. 오히려 직접 부딪혀보면서 배운 것도 많았습니다. 다만 실제 로봇 연구에서는 초반에 어떤 문제를 잡고, 어떤 가정을 두고, 어떤 지표로 검증할지를 정하는 것이 생각보다 훨씬 중요했습니다.

처음에는 다음 흐름이 자연스럽다고 생각했습니다.

```text
motor current -> motor torque -> motor heating -> reported actuator temperature
```

그래서 motor current, torque, reported actuator temperature의 관계를 보고, 장시간 보행에서 특정 motor가 뜨거워지는 문제를 다루려고 했습니다.

당시에는 이 접근이 타당하다고 생각했습니다. 실제로 Part 7과 Part 8에서 정리한 것처럼, reported actuator temperature를 모델링하고, 이를 reward에 넣는 것 자체는 충분히 해볼 만한 시도였습니다.

하지만 지금 다시 보면 아쉬움도 남습니다.

## **3. 온도보다 먼저 봐야 했던 것**

온도는 느린 값입니다.

로봇의 action은 짧은 control step마다 바뀌지만, reported actuator temperature는 훨씬 느리게 누적됩니다. 그래서 온도를 reward로 바로 넣으면 policy 입장에서는 어떤 action이 지금의 온도를 만들었는지 알기 어렵습니다.

결국 Part 8에서 봤던 것처럼, 온도-only reward는 기대처럼 동작하지 않았습니다.

Thermal Feedback policy는 온도 observation과 fitted temperature-rate penalty를 받았지만, 실제로는 Baseline보다 더 좋은 thermal behavior로 이어지지 않았습니다. 오히려 yaw drift가 커지고, thermal metric도 나빠졌습니다.

이 결과를 보면서 결론이 조금 바뀌었습니다.

> 온도는 결과에 가깝고, torque와 positive mechanical power는 원인에 더 가깝다.

그래서 Thermal-Torque Feedback에서는 온도 surrogate만 보지 않고, torque와 positive power를 reward에 직접 묶었습니다. 이때야 비로소 Baseline보다 thermal dose, max rise, hotspot dose가 좋아졌습니다.

이 결과 자체는 좋았지만, 동시에 이런 생각도 들었습니다.

처음부터 "모터 온도를 줄이자"가 아니라 "불필요한 motor load와 contact shock을 줄이는 보행을 만들자"로 문제를 잡았다면 더 자연스러웠을지도 모릅니다.

## **4. 실제 로봇에서 더 크게 느낀 것**

시뮬레이션에서는 보행이 꽤 깔끔해 보입니다. 하지만 실제 Go2를 아스팔트 바닥이나 경기장 트랙에서 `1.5 m/s` 정도로 걸려보면 느낌이 다릅니다.

로봇이 지면을 밟을 때 생기는 진동과 충격이 생각보다 큽니다. 그리고 그 충격은 단순히 "보행이 된다"는 영상만으로는 잘 보이지 않습니다.

특히 앞다리가 더 뜨거워지는 현상을 보면서도 다시 생각하게 됐습니다. 처음에는 motor별 torque나 temperature trace만 봤지만, 실제 보행을 보면 앞다리는 단순히 다리를 앞으로 보내는 역할만 하는 것이 아닙니다.

앞다리는 stance phase에서 몸체를 받아내고, 지면 충격을 버티고, body pitch나 forward motion을 안정화하는 역할을 크게 합니다. 반면 뒷다리는 상대적으로 추진력을 만드는 쪽에 더 가깝습니다.

그러면 앞다리가 더 뜨거워지는 이유도 단순히 "front motor coefficient가 크다" 정도로 끝낼 문제가 아닐 수 있습니다.

> 앞다리에 더 큰 충격량과 지지 부하가 걸리는 gait 자체가 thermal hotspot을 만들고 있었을 수 있다.

이 관점에서 보면 문제는 reported temperature prediction보다 더 넓어집니다.

```text
stiff gait
-> larger contact impulse
-> larger joint tracking effort
-> larger actuator load
-> higher reported actuator temperature
```

즉, thermal-safe locomotion을 만들려면 온도만 볼 것이 아니라, contact impulse, stance load, body motion, torque peak를 같이 봐야 합니다.

## **5. 그래도 의미 있었던 것**

아쉬움이 남는다고 해서 이번 종합설계가 의미 없었다는 뜻은 아닙니다.

오히려 실제 로봇을 이용해 sim-to-real을 경험한 것은 꽤 큰 수확이었습니다. 시뮬레이션에서 가능해 보이는 policy도 실제 로봇에서는 sensor noise, actuator delay, 지면 상태, motor load, control 안정성 때문에 훨씬 복잡해집니다.

특히 이번 프로젝트에서는 다음을 직접 겪었습니다.

1. simulation에서 걷던 policy가 실제 로봇에서는 움직이지 않을 수 있다.
2. Domain Randomization은 단순 옵션이 아니라 real deployment에 꽤 중요하다.
3. reward를 하나 추가한다고 원하는 행동이 바로 나오지 않는다.
4. 온도 같은 느린 상태는 원인과 결과를 분리해서 봐야 한다.
5. 실제 로봇에서는 contact와 vibration이 생각보다 큰 변수다.

Part 5에서는 sim-to-real 성공을, Part 6에서는 real Go2 log collection을, Part 7에서는 thermal reward model을, Part 8에서는 thermal-only reward의 실패와 Thermal-Torque Feedback의 필요성을 정리했습니다.

이번 Part 9는 그 흐름을 마무리하면서, 내가 문제를 어디서 조금 좁게 봤는지를 돌아보는 글에 가깝습니다.

## **6. 다음에는 LiDAR SLAM과 연결해보고 싶다**

후속 연구에서는 로봇개의 보행 motion이 LiDAR SLAM 성능에 미치는 영향을 분석해보고 싶습니다.

로봇개는 바퀴 로봇과 다르게 걸을 때 몸체가 계속 흔들립니다. 발을 디딜 때 충격이 생기고, base pitch/roll/yaw도 흔들립니다. LiDAR는 그 몸체 위에 올라가기 때문에, gait-induced body motion이 그대로 LiDAR scan에 들어갑니다.

이 움직임은 SLAM에 두 가지 방향으로 영향을 줄 수 있습니다.

첫째, scan 내부 distortion을 키워 scan matching을 어렵게 만들 수 있습니다.

둘째, 반대로 특정한 body motion은 주변 구조를 더 다양한 각도에서 보게 만들어 observability를 높일 수도 있습니다.

그래서 다음에는 단순히 "로봇이 잘 걷는다"가 아니라, 다음 질문을 보고 싶습니다.

> 어떤 gait와 body motion이 LiDAR SLAM failure를 유발하는가?

조금 더 구체적으로는 다음을 분석해보고 싶습니다.

1. gait-induced sensor motion이 LiDAR scan distortion에 미치는 영향
2. body pitch/roll/yaw와 scan matching error의 관계
3. 발 디딤 충격이 odometry drift나 mapping failure로 이어지는 조건
4. SLAM에 유리한 gait 또는 body motion이 따로 있는지

장기적으로는 locomotion policy가 command tracking만 잘하는 것이 아니라, 주변을 더 잘 인식하고 지도화할 수 있도록 움직이는 방향으로 가고 싶습니다.

즉, 다음 관심사는 **perception-aware locomotion**입니다.

```text
locomotion policy
-> body motion / sensor motion
-> LiDAR scan quality
-> SLAM robustness
```

로봇이 잘 걷는 것과 로봇이 세상을 잘 보는 것은 분리된 문제가 아닐 수 있습니다.

## **7. 정리**

이번 종합설계를 한 문장으로 정리하면 이렇습니다.

> 온도를 줄이는 문제라고 생각했지만, 결국은 motor load와 contact shock을 어떻게 줄일 것인가의 문제였다.

처음부터 완벽한 문제 정의를 하지는 못했습니다. thermal reward를 만들었고, thermal-only reward가 잘 안 됐고, torque와 power를 같이 넣으면서 결과가 좋아졌습니다. 하지만 그 과정을 지나고 나서야 "온도"보다 앞에 있는 원인들을 더 봐야 한다는 생각이 선명해졌습니다.

그래서 이번 프로젝트는 성공과 아쉬움이 같이 남습니다.

실제로 Go2를 걷게 만들었고, 데이터를 모았고, thermal reward와 torque-aware reward를 비교했습니다. 동시에, 실제 로봇 연구에서는 주제 설정과 문제 정의가 얼마나 중요한지도 배웠습니다.

다음에는 이 경험을 바탕으로 단순히 thermal-safe하거나 energy-efficient한 보행을 넘어서, perception과 locomotion이 서로 영향을 주는 문제를 더 깊게 보고 싶습니다.

종합설계는 끝났지만, 오히려 이제서야 내가 어떤 문제를 보고 싶은지 조금 더 분명해진 것 같습니다.
