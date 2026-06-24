---
title: "[Sim2Real Paper 7] Rapid Motor Adaptation"
date: 2026-06-24 17:35:00 +0900
categories: [RL, Sim2Real, Paper]
tags: [sim2real, rapid-motor-adaptation, rma, quadruped-locomotion, online-adaptation]
description: Kumar et al.의 RMA 논문을 통해 terrain, payload, actuator 상태 변화에 online으로 적응하는 Sim2Real locomotion 구조를 정리한다.
---

## **0. 전체 그림: Robustness에서 Adaptation으로**

6편에서는 Lee et al.의 rough terrain locomotion을 봤습니다.

그 논문에서 중요한 것은 proprioceptive history였습니다. Robot은 terrain을 직접 보지 않아도, joint와 body의 시간 흐름을 통해 contact, slip, terrain 상태를 어느 정도 추론할 수 있습니다.

Kumar et al.의 **RMA: Rapid Motor Adaptation for Legged Robots**는 이 아이디어를 더 명시적인 구조로 만듭니다.

핵심은 다음입니다.

> Robot이 지금 어떤 환경에 있는지 online으로 추정하고, policy가 그 추정값을 사용해 즉시 적응하게 하자.

RMA는 robustness만으로 모든 상황을 버티려 하지 않습니다. 대신 hidden environment factor를 빠르게 추정해서 policy input으로 넣습니다.

## **1. 논문이 다루는 문제**

Real robot은 매번 같은 환경에서 걷지 않습니다.

실제 deployment에서는 다음 변화가 계속 생깁니다.

- terrain friction이 바뀝니다.
- ground가 deformable할 수 있습니다.
- payload가 올라갑니다.
- actuator strength가 달라질 수 있습니다.
- robot wear and tear가 생깁니다.
- slope, stairs, vegetation, sand, grass 같은 환경이 나옵니다.

Domain randomization은 이런 variation에 robust한 policy를 만들 수 있습니다.

하지만 모든 variation을 하나의 policy가 평균적으로 버티게 만들면, policy가 지나치게 conservative해질 수 있습니다.

RMA의 질문은 다음입니다.

> Hidden environment factor를 real time으로 추정해서, 하나의 policy가 상황에 맞게 행동을 바꾸게 할 수 있을까?

## **2. 논문 정보**

| 항목 | 내용 |
|---|---|
| Title | RMA: Rapid Motor Adaptation for Legged Robots |
| Authors | Ashish Kumar, Zipeng Fu, Deepak Pathak, Jitendra Malik |
| Year | 2021 |
| Venue | Robotics: Science and Systems 2021 |
| Robot | Unitree A1 |
| Key idea | base policy + adaptation module |
| Transfer | simulation training, real A1 deployment without fine-tuning |
| Adaptation target | terrain, payload, friction, motor strength 등 hidden extrinsics |
| Source | [arXiv](https://arxiv.org/abs/2107.04034), [Project](https://ashish-kmr.github.io/rma-legged-robots/) |

이 논문은 legged locomotion에서 online adaptation을 이해할 때 가장 대표적으로 보는 논문 중 하나입니다.

## **3. 핵심 아이디어: Base Policy와 Adaptation Module**

RMA는 두 개의 module로 구성됩니다.

첫 번째는 **base policy**입니다.

Base policy는 현재 state, 이전 action, 그리고 environment를 요약한 latent vector를 입력으로 받아 desired joint position을 출력합니다.

두 번째는 **adaptation module**입니다.

Adaptation module은 최근 state-action history를 보고 latent extrinsics vector를 예측합니다. 이 vector는 현재 terrain, friction, payload, motor condition 같은 hidden factor를 압축한 정보입니다.

> **Extrinsics vector**란?
>
> Robot 밖의 환경 또는 robot 상태 변화가 locomotion에 미치는 영향을 policy가 사용할 수 있도록 압축한 latent representation입니다.

Deployment에서는 adaptation module이 real robot의 최근 history만 보고 이 vector를 추정합니다.

## **4. Training 구조**

RMA training은 두 단계입니다.

### **4.1 Base Policy Training**

Simulation에서는 privileged information을 알 수 있습니다.

예를 들어 mass, friction, motor strength, terrain height 같은 environment factor를 simulator가 알고 있습니다.

Base policy는 이 privileged factor를 encoded latent vector로 받아 RL로 학습됩니다. 즉 policy는 "현재 환경이 어떤지 알고 있다면 어떻게 걸어야 하는가"를 먼저 배웁니다.

### **4.2 Adaptation Module Training**

Real robot에서는 privileged factor를 직접 알 수 없습니다.

그래서 adaptation module을 따로 학습합니다.

Adaptation module은 recent state-action history를 입력으로 받고, base policy가 사용하던 latent extrinsics vector를 예측하도록 supervised learning으로 학습됩니다.

이때 학습 data는 simulation에서 만들 수 있습니다. Simulation에서는 history와 ground-truth extrinsics를 모두 알 수 있기 때문입니다.

## **5. Deployment 구조**

Deployment에서는 두 module이 서로 다른 주기로 동작합니다.

논문에서 base policy는 100Hz로 desired joint positions를 출력합니다. Adaptation module은 10Hz로 extrinsics vector를 예측합니다.

이 asynchronous design은 A1처럼 onboard compute가 제한적인 robot에서 중요합니다.

| Module | 역할 | 주기 |
|---|---|---:|
| base policy | state와 extrinsics를 보고 action 출력 | 100Hz |
| adaptation module | history를 보고 extrinsics 추정 | 10Hz |
| low-level PD | desired joint position을 torque로 변환 | robot controller |

이 구조는 실전적으로 중요합니다.

Online adaptation을 한다고 해서 heavy model을 매 control step마다 돌릴 필요는 없습니다. 상대적으로 느리게 변하는 environment factor는 낮은 frequency로 추정하고, 빠른 control은 base policy가 담당합니다.

## **6. 결과에서 중요한 부분**

RMA는 Unitree A1에 배포됩니다.

논문은 rocky, slippery, deformable surface, grass, long vegetation, concrete, pebbles, stairs, sand 등 다양한 real terrain에서 결과를 보여줍니다.

또한 payload 변화, step-down, deformable foam 같은 out-of-distribution setup도 평가합니다.

논문에서 중요한 비교는 RMA와 RMA without adaptation입니다.

Adaptation module이 없으면 policy는 hidden condition을 추정하지 못합니다. 그 결과 payload나 slippery terrain 같은 상황에서 성능이 크게 떨어집니다.

즉 RMA의 핵심은 단순히 "많이 randomize한 policy"가 아닙니다.

> Randomization으로 다양한 환경을 만들고, history로 현재 환경을 추정해서 그에 맞게 행동한다.

## **7. Sim2Real 관점에서의 해석**

RMA는 domain randomization의 다음 단계로 볼 수 있습니다.

기존 dynamics randomization은 policy가 다양한 dynamics에 robust해지도록 합니다. 하지만 policy에게 현재 dynamics가 무엇인지 알려주지 않으면, policy는 모든 경우에 평균적으로 안전한 행동을 선택할 수밖에 없습니다.

RMA는 hidden dynamics를 latent vector로 넣어줍니다.

| 방법 | policy가 환경 차이를 다루는 방식 |
|---|---|
| dynamics randomization | 다양한 dynamics에서 평균적으로 robust해짐 |
| recurrent policy | history로 dynamics를 암묵적으로 추론 |
| privileged teacher-student | training 때 privileged info를 쓰고 deployment policy로 압축 |
| RMA | adaptation module이 extrinsics를 online 추정해서 policy에 제공 |

이 점에서 RMA는 robustness와 adaptation을 분리합니다.

Base policy는 extrinsics가 주어졌을 때 잘 걷는 법을 배우고, adaptation module은 real history에서 그 extrinsics를 추정합니다.

## **8. Go2 Sim2Real에서 가져갈 점**

Go2에서도 RMA 구조는 매우 직접적으로 참고할 만합니다.

Go2 deployment에서 바뀔 수 있는 extrinsics는 다음과 같습니다.

| Extrinsics 후보 | 의미 |
|---|---|
| ground friction | 바닥 재질, 미끄러짐 |
| terrain height / roughness | 발이 닿는 높이와 충격 |
| payload | robot 위에 올라간 추가 무게 |
| motor strength | actuator 출력 변화 |
| joint damping / friction | 관절 상태, 온도, wear |
| latency | communication/control delay |
| slope | body attitude와 command tracking 영향 |

Go2에서 policy가 이런 값을 직접 관측하지 못한다면, history 기반 adaptation이 필요할 수 있습니다.

질문은 다음입니다.

1. 현재 policy가 hidden dynamics를 추론할 history를 가지고 있는가?
2. Base policy가 extrinsics를 받는 구조가 필요한가?
3. Adaptation module을 simulation에서 supervised로 학습할 수 있는가?
4. Extrinsics target을 실제 physical parameter로 둘 것인가, latent vector로 둘 것인가?
5. Onboard compute에서 adaptation module을 몇 Hz로 돌릴 수 있는가?

특히 real Go2에서 payload, 바닥 friction, actuator 상태가 바뀌는 환경을 목표로 한다면 RMA식 구조는 강한 후보가 됩니다.

## **9. 이 논문의 한계**

RMA도 모든 문제를 해결하지는 않습니다.

- Adaptation module은 simulation에서 학습한 extrinsics structure에 의존합니다.
- History로 추론할 수 없는 factor는 잘 적응하기 어렵습니다.
- Extrinsics estimation이 틀리면 base policy도 잘못 행동할 수 있습니다.
- Real sensor noise와 delay가 adaptation input에 영향을 줍니다.
- Terrain perception이나 obstacle planning을 직접 해결하는 것은 아닙니다.

그래도 "robust policy 하나"에서 "online adaptation policy"로 넘어가는 핵심 논문입니다.

## **10. 정리하며: 현재 Dynamics를 추정해서 걷기**

이번 글에서는 Kumar et al.의 **RMA: Rapid Motor Adaptation for Legged Robots**를 정리했습니다.

- RMA는 base policy와 adaptation module로 구성됩니다.
- Base policy는 privileged extrinsics를 사용해 다양한 환경에서 걷는 법을 배웁니다.
- Adaptation module은 recent state-action history로 extrinsics를 online 추정합니다.
- Real A1에 fine-tuning 없이 배포되어 다양한 terrain과 payload 변화에 대응합니다.
- Domain randomization이 robustness를 만든다면, RMA는 현재 domain에 맞는 adaptation을 만듭니다.

7편의 핵심은 이렇게 정리할 수 있습니다.

> Real world가 계속 바뀐다면, policy는 robust할 뿐 아니라 지금 어떤 world인지 추정해야 한다.

다음 글에서는 이런 legged locomotion 학습을 Isaac Gym / massively parallel RL로 매우 빠르게 만드는 흐름을 보겠습니다.
