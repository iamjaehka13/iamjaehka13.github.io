---
title: "[Sim2Real Paper 5] Agile and Dynamic Motor Skills"
date: 2026-06-24 17:33:00 +0900
categories: [RL, Sim2Real, Paper]
tags: [sim2real, legged-robots, anymal, actuator-network, reinforcement-learning]
description: Hwangbo et al.의 Learning agile and dynamic motor skills for legged robots를 통해 ANYmal 실기체 transfer에서 actuator net과 hybrid simulator의 역할을 정리한다.
---

## **0. 전체 그림: 복잡한 Actuator는 학습해서 모델링한다**

4편의 Tan et al.은 Minitaur에서 actuator model과 latency가 quadruped Sim2Real의 핵심이라는 점을 보여줬습니다.

하지만 모든 robot의 actuator가 analytic model로 잘 설명되는 것은 아닙니다.

Hwangbo et al.의 **Learning agile and dynamic motor skills for legged robots**는 이 문제를 ANYmal에서 다룹니다.

ANYmal은 더 큰 quadruped이고, actuator와 low-level control stack이 더 복잡합니다. Motor command가 실제 torque로 변하는 과정에는 actuator dynamics, signal delay, low-level controller, joint compliance, damping이 섞입니다.

이 논문의 핵심은 다음입니다.

> Rigid-body dynamics는 physics simulator로 처리하고, 복잡한 actuator/software dynamics는 learned actuator net으로 모델링하자.

이 논문은 learned locomotion policy를 실제 ANYmal에 올린 대표적인 초기 논문입니다.

## **1. 논문이 다루는 문제**

Legged robot에서 RL policy를 simulation에서 학습하는 것은 어렵지 않습니다. 진짜 어려운 것은 그 policy를 real robot에 올리는 것입니다.

특히 ANYmal 같은 robot에서는 actuator command와 실제 joint torque 사이의 mapping이 단순하지 않습니다.

문제는 다음과 같습니다.

- actuator 내부 dynamics가 복잡합니다.
- command와 torque 사이에 여러 source의 delay가 있습니다.
- low-level controller dynamics가 들어갑니다.
- joint compliance와 damping이 있습니다.
- contact-rich locomotion에서는 작은 torque mismatch도 gait를 깨뜨릴 수 있습니다.

Analytic actuator model을 손으로 맞추는 것은 어렵습니다.

그래서 이 논문은 physical system에서 데이터를 모아 actuator behavior를 network로 학습합니다.

## **2. 논문 정보**

| 항목 | 내용 |
|---|---|
| Title | Learning agile and dynamic motor skills for legged robots |
| Authors | Jemin Hwangbo, Joonho Lee, Alexey Dosovitskiy, Dario Bellicoso, Vassilios Tsounis, Vladlen Koltun, Marco Hutter |
| Year | 2019 |
| Venue | Science Robotics |
| Robot | ANYmal |
| Skills | velocity command following, fast locomotion, fall recovery |
| Key transfer tools | system identification, actuator net, dynamics randomization, hybrid simulator |
| Source | [arXiv](https://arxiv.org/abs/1901.08652), [Science Robotics DOI](https://www.science.org/doi/10.1126/scirobotics.aau5872) |

이 논문은 "RL locomotion이 simulation toy가 아니라 실제 full-size quadruped에 올라갈 수 있다"는 것을 강하게 보여준 논문입니다.

## **3. 핵심 아이디어: Hybrid Simulator**

논문은 simulator를 두 부분으로 나눕니다.

첫째, rigid-body dynamics입니다.

ANYmal의 link, joint, contact 같은 rigid-body 부분은 물리 simulator가 계산합니다. 이 부분은 비교적 명확한 physical model로 다룰 수 있습니다.

둘째, actuator/software dynamics입니다.

Command가 실제 generalized force로 변하는 과정은 analytic model로 정확히 쓰기 어렵습니다. 그래서 이 mapping을 deep network로 학습합니다.

> **Actuator Net**이란?
>
> 실제 robot에서 수집한 actuator data를 이용해 command와 joint state history로부터 actuator torque를 예측하는 learned model입니다.

논문은 이 actuator net을 simulation loop 안에 넣습니다. 그래서 policy는 ideal actuator가 아니라 learned actuator dynamics가 들어간 simulator에서 학습됩니다.

이를 hybrid simulator라고 볼 수 있습니다.

| 구성 | 역할 |
|---|---|
| rigid-body simulator | link, joint, contact dynamics 계산 |
| actuator net | actuator command에서 torque로 가는 복잡한 mapping 모델링 |
| dynamics randomization | 남은 model uncertainty를 덮음 |
| RL policy | velocity command following 등 control skill 학습 |

## **4. 왜 Actuator Net이 중요한가**

논문은 ideal actuator model과 analytical actuator model을 비교합니다.

Ideal actuator model은 actuator가 무한 bandwidth와 zero latency를 가진다고 가정합니다. Analytical model은 실제 controller code와 hand-tuned parameter를 사용합니다.

하지만 두 alternative 모두 real robot에서 제대로 걷지 못했습니다.

논문은 이 실패가 delay와 limited bandwidth를 충분히 설명하지 못했기 때문이라고 봅니다.

이 점이 중요합니다.

> Legged Sim2Real에서 actuator mismatch는 작은 보정 문제가 아니라, policy가 한 걸음도 못 걷게 만드는 핵심 원인일 수 있다.

Actuator net은 이 문제를 data-driven 방식으로 줄입니다.

실제 robot에서 actuator response data를 모으고, command-to-torque mapping을 학습한 뒤, 그 model을 simulation에 넣어 policy를 학습합니다.

## **5. 결과: ANYmal에서 실제 동작하는 Learned Policy**

논문은 세 가지 결과를 강조합니다.

첫째, velocity command following입니다.

ANYmal이 high-level body velocity command를 따라가도록 학습합니다. 논문은 기존 controller보다 더 정확하고 energy-efficient하게 command를 추종한다고 보고합니다.

둘째, fast locomotion입니다.

ANYmal은 physical system에서 약 1.5 m/s 속도에 도달합니다. 논문은 이것이 당시 ANYmal의 이전 speed record보다 빠르다고 설명합니다.

셋째, fall recovery입니다.

ANYmal이 복잡한 자세로 넘어진 상태에서 스스로 몸을 뒤집고 일어나는 recovery skill을 학습합니다. 이 skill은 여러 internal/external contact와 momentum coordination이 필요하기 때문에 hand-designed controller로 만들기 어렵습니다.

## **6. Sim2Real 관점에서의 해석**

이 논문의 핵심은 "randomization만으로는 부족한 경우가 있다"는 점입니다.

Dynamics randomization은 불확실성을 덮는 데 강합니다. 하지만 mean model이 너무 틀리면 policy가 학습 중 경험하는 dynamics 자체가 real robot과 다릅니다.

Hwangbo et al.은 mean model을 actuator net으로 더 현실적으로 만들고, 남은 uncertainty를 randomization으로 처리합니다.

이 구조는 실전에서 매우 중요합니다.

| 문제 | 접근 |
|---|---|
| rigid-body parameter 오차 | system identification |
| actuator/low-level control mismatch | learned actuator net |
| 남은 불확실성 | dynamics randomization |
| real robot safety | simulation에서 충분히 학습 후 direct deployment |

즉, 이 논문은 dynamics randomization을 대체하는 논문이 아닙니다.

Dynamics randomization이 잘 작동하도록 simulator의 actuator side를 더 현실적으로 만든 논문입니다.

## **7. Go2 Sim2Real에서 가져갈 점**

Go2에서도 이 논문은 중요합니다.

Unitree Go2의 deploy stack에서는 policy action이 바로 torque로 들어가지 않는 경우가 많습니다. 보통 policy는 joint position target이나 normalized action을 내고, low-level controller가 이를 추종합니다.

그 사이에는 다음 요소가 있습니다.

- PD gain
- action scaling
- joint target clipping
- motor response
- command delay
- low-level control frequency
- torque/current saturation
- battery state
- joint velocity estimation

이 mapping이 simulation과 real robot에서 다르면 policy는 real에서 전혀 다른 dynamics를 보게 됩니다.

Go2에서 이 논문을 읽고 가져갈 질문은 다음입니다.

1. Policy action이 real actuator에서 어떤 torque/current/motion으로 변하는가?
2. Simulation의 actuator model이 그 mapping을 어느 정도 설명하는가?
3. Delay와 bandwidth limitation을 넣었는가?
4. Analytical model로 부족하다면 actuator data를 이용해 model을 학습할 수 있는가?
5. Randomization은 actuator mismatch를 덮고 있는가, 아니면 simulator가 너무 틀린 것을 숨기고 있는가?

특히 Go2에서 real deploy가 "발을 떼지 못함", "body가 흔들림", "특정 속도에서 yaw drift" 같은 형태로 깨진다면 actuator side를 봐야 합니다.

Reward나 policy architecture만 볼 문제가 아닐 수 있습니다.

## **8. 이 논문의 한계**

이 논문도 만능은 아닙니다.

- Actuator net을 학습하려면 real robot actuator data가 필요합니다.
- Actuator model이 학습된 조건 밖에서는 여전히 mismatch가 생길 수 있습니다.
- Rough terrain이나 perceptive locomotion은 주제가 아닙니다.
- Learned policy의 safety boundary는 여전히 deployment 과정에서 조심해야 합니다.
- Simulator, actuator net, randomization range를 모두 잘 맞춰야 합니다.

그래도 legged Sim2Real에서 "actuator가 진짜 중요하다"는 점을 가장 강하게 보여주는 논문 중 하나입니다.

## **9. 정리하며: Actuator가 Reality Gap의 중심이다**

이번 글에서는 Hwangbo et al.의 **Learning agile and dynamic motor skills for legged robots**를 정리했습니다.

- ANYmal에 learned locomotion policy를 실제로 transfer한 대표 논문입니다.
- 복잡한 actuator/software dynamics를 learned actuator net으로 모델링합니다.
- Rigid-body simulator와 actuator net을 합쳐 hybrid simulator를 만듭니다.
- Ideal actuator나 hand-tuned analytical actuator model은 real deployment에서 실패할 수 있습니다.
- Velocity tracking, high-speed locomotion, fall recovery를 real ANYmal에서 보여줍니다.

5편의 핵심은 이렇게 정리할 수 있습니다.

> Legged Sim2Real에서는 policy보다 먼저, policy action이 실제 actuator에서 무엇이 되는지를 이해해야 한다.

다음 글에서는 같은 ANYmal 계열에서 rough terrain과 proprioception 기반 zero-shot transfer로 넘어갑니다.
