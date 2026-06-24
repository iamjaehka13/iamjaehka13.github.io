---
title: "[Sim2Real Paper 4] Learning Agile Locomotion"
date: 2026-06-24 17:32:00 +0900
categories: [RL, Sim2Real, Paper]
tags: [sim2real, quadruped-locomotion, dynamics-randomization, actuator-model, latency]
description: "Tan et al.의 Sim-to-Real: Learning Agile Locomotion For Quadruped Robots를 통해 quadruped Sim2Real의 actuator model, latency, system identification, randomization을 정리한다."
---

## **0. 전체 그림: Quadruped Sim2Real의 기본 조합**

3편에서는 Peng et al.의 dynamics randomization을 봤습니다.

Mass, friction, damping, controller gain, action timestep, observation noise 같은 physical parameter를 흔들면 real dynamics에 더 잘 버티는 policy를 만들 수 있다는 내용이었습니다.

Tan et al.의 **Sim-to-Real: Learning Agile Locomotion For Quadruped Robots**는 이 아이디어를 quadruped locomotion으로 가져옵니다.

이 논문은 quadruped Sim2Real 입문에서 중요합니다. 이유는 하나입니다.

> 실제 보행 transfer는 randomization 하나로 끝나지 않고, actuator model, latency, system identification, compact observation, perturbation이 같이 필요하다는 것을 보여준다.

실험 robot은 Ghost Robotics의 **Minitaur**입니다. 논문은 simulation에서 trotting과 galloping policy를 학습하고, real Minitaur에 올립니다.

## **1. 논문이 다루는 문제**

Quadruped locomotion은 manipulation보다 transfer가 더 까다롭습니다.

로봇은 계속 contact를 만들고 끊습니다. 발이 지면에 닿는 순간 force가 생기고, body attitude가 흔들리며, actuator가 원하는 target을 못 따라가면 바로 넘어질 수 있습니다.

Simulation에서 좋은 gait가 나왔다고 해도 real robot에서는 다음 차이 때문에 깨질 수 있습니다.

- actuator torque-speed 특성
- motor command와 sensor feedback 사이의 latency
- body mass와 inertia 오차
- foot-ground friction 차이
- IMU bias와 sensor noise
- control step 변동
- battery voltage와 motor strength 변화

이 논문의 질문은 다음입니다.

> Deep RL로 학습한 quadruped gait를 real robot에 안정적으로 옮기려면 simulator를 어떻게 만들어야 하는가?

## **2. 논문 정보**

| 항목 | 내용 |
|---|---|
| Title | Sim-to-Real: Learning Agile Locomotion For Quadruped Robots |
| Authors | Jie Tan, Tingnan Zhang, Erwin Coumans, Atil Iscen, Yunfei Bai, Danijar Hafner, Steven Bohez, Vincent Vanhoucke |
| Year | 2018 |
| Venue | Robotics: Science and Systems 2018 |
| Robot | Ghost Robotics Minitaur |
| Tasks | galloping, trotting |
| Simulator | Bullet |
| Key transfer tools | system identification, actuator model, latency simulation, dynamics randomization, perturbation, compact observation |
| Source | [arXiv](https://arxiv.org/abs/1804.10332), [RSS PDF](https://www.roboticsproceedings.org/rss14/p10.pdf) |

이 논문은 "quadruped RL policy를 sim에서 학습해서 real robot에 올린다"는 흐름에서 초기에 매우 중요한 예시입니다.

## **3. 핵심 아이디어: Simulator를 고치고 Policy도 robust하게 만들기**

이 논문은 reality gap을 두 방향에서 줄입니다.

첫째, simulator 자체를 현실에 가깝게 만듭니다.

- robot body parameter를 system identification으로 맞춥니다.
- actuator model을 더 현실적으로 만듭니다.
- latency를 simulation에 넣습니다.

둘째, policy가 남아 있는 gap에 버티도록 학습합니다.

- dynamics parameter를 randomize합니다.
- random perturbation을 넣습니다.
- observation space를 compact하게 만듭니다.

즉 구조는 다음과 같습니다.

| 축 | 역할 |
|---|---|
| system identification | 평균적인 robot model을 현실에 가깝게 맞춤 |
| actuator model | motor command와 실제 motion 차이를 줄임 |
| latency simulation | feedback delay로 인한 instability를 미리 반영 |
| dynamics randomization | 남은 parameter error에 robust하게 만듦 |
| perturbation | 외란에 버티는 gait를 유도 |
| compact observation | real에서 불안정하거나 unreliable한 정보를 줄임 |

이 조합이 quadruped Sim2Real의 기본 감각입니다.

## **4. Actuator Model과 Latency**

논문에서 actuator model과 latency는 매우 중요합니다.

Bullet의 기본 motor model은 real Minitaur actuator와 다릅니다. Simulation에서는 motor command가 즉시 반영되고, sensor도 즉시 feedback을 주는 것처럼 보입니다.

하지만 real robot에서는 command가 motor motion으로 나타나기까지 시간이 걸리고, 그 motion이 sensor measurement로 돌아오기까지도 delay가 있습니다.

논문은 latency를 feedback control instability의 주요 원인으로 봅니다.

> Simulation에서 feedback이 즉시 돌아오면 controller의 안정 영역이 실제보다 훨씬 커진다.

그래서 latency를 measurement history에서 interpolation하는 방식으로 simulation에 넣습니다.

논문에서는 microcontroller의 PD servo latency와 Jetson TX2에서 실행되는 locomotion controller latency를 따로 측정합니다. TX2 쪽 locomotion controller latency는 대략 15-19ms 수준으로 보고됩니다.

이 점은 Go2에도 그대로 중요합니다.

Policy frequency, low-level controller frequency, UDP/DDS 통신, actuator response가 실제 closed-loop delay를 만듭니다. 이 delay를 무시하면 simulation gait는 좋아도 real robot에서 oscillation하거나 넘어질 수 있습니다.

## **5. Dynamics Randomization**

논문은 system identification으로 평균 model을 맞춘 뒤에도 randomization을 사용합니다.

Randomization 대상은 다음과 같은 축입니다.

| Randomization axis | 의미 |
|---|---|
| mass | body parameter uncertainty |
| inertia | uniform density 가정 등으로 생기는 오차 |
| motor friction | actuator wear, friction 차이 |
| motor strength | motor 출력 변화 |
| control step | control timing 변동 |
| latency | non-real-time system delay 변동 |
| battery voltage | fully charged 여부에 따른 motor behavior 차이 |
| lateral friction | foot와 carpet floor 사이의 마찰 |
| IMU noise / bias | sensor measurement error |

논문은 randomization이 optimality와 robustness 사이의 trade-off라고 설명합니다.

Randomization 범위가 너무 크면 policy가 안정적이지만 느리고 둔한 gait를 만들 수 있습니다. 너무 작으면 real gap을 견디지 못합니다.

그래서 이 논문은 system identification으로 측정한 값을 중심으로, 작은 safety margin을 붙여 randomization range를 잡습니다.

## **6. 결과: Galloping과 Trotting**

논문은 두 가지 gait를 real Minitaur에서 보여줍니다.

첫 번째는 galloping입니다.

기본 simulator에서는 agile gait가 잘 나오지 않았고, real robot에서는 gap 때문에 바로 넘어졌습니다. 하지만 actuator model과 latency를 개선한 뒤에는 galloping gait가 학습되었습니다.

논문은 galloping speed를 simulation에서 약 1.34 m/s, real world에서 약 1.18 m/s로 보고합니다.

두 번째는 trotting입니다.

Trotting은 open-loop reference signal을 제공해서 원하는 gait style을 유도합니다. 이 reference만으로는 real robot에서 안정적으로 움직일 수 없고, learned feedback controller가 balance를 유지해야 합니다.

Trotting에서는 compact observation이 특히 중요했습니다. Observation을 줄여 IMU 중심의 정보로 재학습했을 때 simulation과 real robot에서 더 안정적인 움직임이 나왔습니다.

## **7. Sim2Real 관점에서의 해석**

이 논문은 quadruped Sim2Real에서 중요한 교훈을 줍니다.

첫째, randomization만으로 충분하지 않을 수 있습니다.

Actuator model과 latency가 너무 틀리면, policy는 real robot에서 첫 발도 제대로 못 뗄 수 있습니다.

둘째, simulator fidelity만으로도 충분하지 않습니다.

아무리 system identification을 해도 foot friction, IMU noise, battery state, control timing 같은 uncertainty는 남습니다. 그래서 randomization과 perturbation이 필요합니다.

셋째, observation design이 transfer에 영향을 줍니다.

Simulation에서는 알 수 있는 정보라도 real robot에서 noisy하거나 latency가 있거나 추정이 불안정하면 policy가 그 정보에 의존하다가 real에서 깨질 수 있습니다.

정리하면 다음입니다.

> Quadruped Sim2Real은 actuator fidelity와 policy robustness를 동시에 맞춰야 한다.

## **8. Go2 Sim2Real에서 가져갈 점**

Go2를 다룰 때 이 논문에서 바로 가져갈 질문은 다음입니다.

1. Actuator command가 실제 joint motion으로 어떻게 변하는지 알고 있는가?
2. Policy action과 sensor observation 사이의 closed-loop latency를 측정했는가?
3. Simulation의 PD gain과 real low-level controller semantics가 같은가?
4. IMU, joint velocity, base velocity estimation noise를 training에 넣었는가?
5. Foot friction range를 실제 deployment 바닥 기준으로 잡았는가?
6. Randomization range가 gait를 지나치게 conservative하게 만들지는 않는가?
7. Real robot에서 unreliable한 observation을 policy가 과하게 쓰고 있지는 않은가?

특히 Go2에서는 actuator model을 단순히 torque limit 하나로 보는 것은 부족할 수 있습니다.

실제 deploy에서는 joint target tracking, motor saturation, command delay, low-level controller clipping, battery state, joint velocity estimation이 같이 들어갑니다.

Tan et al.의 논문은 이 점을 아주 일찍 보여줍니다.

## **9. 이 논문의 한계**

이 논문은 quadruped Sim2Real의 핵심 입문 논문이지만, 그대로 모든 robot에 적용되지는 않습니다.

- Minitaur는 direct-drive actuator에 가까운 구조라 actuator analytic model을 만들기 상대적으로 쉽습니다.
- ANYmal이나 Go2처럼 actuator/control stack이 더 복잡한 robot에서는 learned actuator model이나 별도 calibration이 필요할 수 있습니다.
- Terrain은 주로 carpet/floor 중심이며, rough terrain generalization이 주제는 아닙니다.
- Trotting은 open-loop reference를 사용해 gait style을 유도합니다.
- Randomization range는 여전히 수동 설계에 의존합니다.

그래도 quadruped Sim2Real에서 actuator, latency, randomization을 한 번에 봐야 한다는 감각은 이 논문에서 잘 잡힙니다.

## **10. 정리하며: Robust Policy만으로는 부족하다**

이번 글에서는 Tan et al.의 **Sim-to-Real: Learning Agile Locomotion For Quadruped Robots**를 정리했습니다.

- Quadruped Sim2Real에서는 actuator model과 latency가 매우 중요합니다.
- System identification은 평균 model을 맞추고, randomization은 남은 uncertainty를 덮습니다.
- Compact observation은 real sensor mismatch를 줄이는 데 도움이 됩니다.
- Random perturbation과 dynamics randomization은 robust gait를 만드는 데 사용됩니다.
- Galloping과 trotting policy가 simulation에서 학습된 뒤 real Minitaur로 transfer되었습니다.

4편의 핵심은 이렇게 정리할 수 있습니다.

> Legged Sim2Real에서는 simulator를 고치는 것과 policy를 robust하게 만드는 것을 같이 해야 한다.

다음 글에서는 이 흐름이 ANYmal처럼 더 복잡한 actuator와 full-size quadruped로 넘어가면서 어떻게 바뀌는지 보겠습니다.
