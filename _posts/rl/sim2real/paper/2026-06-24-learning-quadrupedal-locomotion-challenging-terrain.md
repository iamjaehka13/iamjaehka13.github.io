---
title: "[Sim2Real Paper 6] Challenging Terrain Locomotion"
date: 2026-06-24 17:34:00 +0900
categories: [RL, Sim2Real, Paper]
tags: [sim2real, quadruped-locomotion, rough-terrain, proprioception, anymal]
description: Lee et al.의 Learning Quadrupedal Locomotion over Challenging Terrain을 통해 rough terrain에서 proprioception 기반 zero-shot transfer를 정리한다.
---

## **0. 전체 그림: 보지 않고도 험지를 걷기**

5편에서는 Hwangbo et al.의 ANYmal locomotion 논문을 봤습니다.

그 논문의 핵심은 actuator net과 hybrid simulator였습니다. 복잡한 actuator dynamics를 학습해서 simulation에 넣고, learned policy를 real ANYmal에 올리는 방식이었습니다.

Lee et al.의 **Learning Quadrupedal Locomotion over Challenging Terrain**은 다음 질문으로 넘어갑니다.

> 실제 자연 환경처럼 예측하기 어려운 rough terrain에서도, simulation에서 학습한 locomotion controller가 zero-shot으로 버틸 수 있는가?

이 논문은 rough terrain에서 proprioception 기반 locomotion을 다룹니다.

특히 중요한 점은 exteroceptive perception에 기대지 않는다는 것입니다. Camera나 LiDAR로 terrain을 미리 보고 걷는 것이 아니라, joint encoder와 IMU 같은 proprioceptive signal의 history를 보고 terrain과 contact 상태를 추론합니다.

## **1. 논문이 다루는 문제**

자연 환경의 terrain은 simulation으로 정확히 만들기 어렵습니다.

실제 deployment에서는 다음 문제가 나옵니다.

- mud, snow처럼 deformable terrain이 있습니다.
- rubble처럼 foothold가 움직일 수 있습니다.
- vegetation이 발을 방해합니다.
- water, snow, dense vegetation은 camera/LiDAR 기반 terrain estimation을 어렵게 만듭니다.
- 발이 닿은 뒤에야 알 수 있는 contact와 slip이 있습니다.

이런 환경을 모두 simulation에 정확히 넣는 것은 거의 불가능합니다.

그럼에도 robot은 실제로 걸어야 합니다.

논문의 질문은 다음입니다.

> Simple simulated terrain에서 학습한 controller가, training에서 보지 못한 자연 terrain에서도 버틸 수 있을까?

## **2. 논문 정보**

| 항목 | 내용 |
|---|---|
| Title | Learning Quadrupedal Locomotion over Challenging Terrain |
| Authors | Joonho Lee, Jemin Hwangbo, Lorenz Wellhausen, Vladlen Koltun, Marco Hutter |
| Year | 2020 |
| Venue | Science Robotics |
| Robot | ANYmal-B, ANYmal-C |
| Core setting | blind / proprioceptive rough-terrain locomotion |
| Key ideas | privileged teacher, proprioceptive student, adaptive terrain curriculum |
| Transfer | simulation training, zero-shot deployment to natural terrain |
| Source | [arXiv](https://arxiv.org/abs/2010.11251), [Science Robotics DOI](https://www.science.org/doi/10.1126/scirobotics.abc5986), [Project](https://leggedrobotics.github.io/rl-blindloco/) |

이 논문은 rough terrain locomotion에서 "proprioception만으로 어디까지 가능한가"를 보여주는 대표적인 논문입니다.

## **3. 핵심 아이디어: Privileged Teacher와 Proprioceptive Student**

훈련 중 simulation에서는 많은 정보를 알 수 있습니다.

Terrain geometry, foot contact, contact force, terrain property 같은 정보는 simulator 내부에서 직접 접근할 수 있습니다. 하지만 real robot에서는 이런 privileged information을 그대로 쓸 수 없습니다.

그래서 논문은 두 단계 구조를 사용합니다.

첫째, teacher policy를 학습합니다.

Teacher는 simulation에서 privileged information을 봅니다. Terrain과 contact에 대한 정보를 사용해 rough terrain을 잘 걷는 policy를 학습합니다.

둘째, student policy를 학습합니다.

Student는 real robot에서 사용할 수 있는 proprioceptive observation history만 봅니다. Teacher를 imitation해서, privileged information 없이도 비슷하게 행동하도록 학습합니다.

> **Privileged Learning**이란?
>
> Training 중에는 simulator가 제공하는 추가 정보를 사용하고, deployment policy는 real robot에서 사용할 수 있는 observation만 사용하도록 distillation하는 방법입니다.

이 구조 덕분에 policy는 real deployment 때 camera나 LiDAR 없이도 terrain과 contact 상태를 history로부터 추론할 수 있습니다.

## **4. Proprioceptive History가 중요한 이유**

단일 순간의 proprioceptive observation만 보면 terrain 상태를 알기 어렵습니다.

하지만 history를 보면 달라집니다.

발이 예상보다 빨리 닿았는지, joint velocity가 갑자기 줄었는지, body pitch가 흔들렸는지, foot slip이 있었는지 같은 정보가 시간 흐름 속에 나타납니다.

논문은 student policy가 proprioceptive stream을 사용한다고 설명합니다. 이 stream을 통해 terrain과 contact-related latent feature를 부분적으로 회복할 수 있다고 봅니다.

즉 이 논문에서 observation history는 단순한 RNN 편의 기능이 아닙니다.

> 보이지 않는 terrain과 contact 상태를 추론하기 위한 sensor입니다.

## **5. Adaptive Terrain Curriculum**

Rough terrain policy를 학습하려면 terrain difficulty를 잘 조절해야 합니다.

처음부터 너무 어려운 terrain을 주면 policy가 학습하지 못합니다. 너무 쉬운 terrain만 주면 real rough terrain에서 깨집니다.

논문은 adaptive terrain curriculum을 사용합니다.

Terrain parameter distribution을 관리하면서, policy가 현재 학습 수준에서 지나갈 수 있지만 충분히 어려운 terrain을 계속 생성합니다.

이 부분은 Sim2Real에서 중요합니다.

Randomization만 많이 넣는다고 좋은 것이 아닙니다. Policy가 학습 가능한 난이도에서 점진적으로 어려운 terrain을 경험해야 합니다.

| 요소 | 역할 |
|---|---|
| procedurally generated terrain | 다양한 terrain profile 생성 |
| traversability measure | terrain이 현재 policy에 너무 쉽거나 어려운지 판단 |
| curriculum | 학습 진행에 따라 terrain difficulty 조정 |
| teacher-student distillation | privileged terrain 정보를 proprioception policy로 압축 |

## **6. 결과: 자연 환경 Zero-Shot Transfer**

논문은 controller를 두 세대의 ANYmal robot에 배포합니다.

Deployment 환경은 simulation에서 본 terrain보다 훨씬 복잡합니다.

- mud
- sand
- rubble
- thick vegetation
- snow
- running water
- mountain trail
- forest terrain

논문은 controller가 training 중 경험하지 않은 조건에서도 robustness를 유지한다고 보고합니다. 특히 deformable terrain, dynamic foothold, vegetation, water처럼 simulation에서 직접 모델링하지 않은 요소에서도 zero-shot generalization을 보여줍니다.

여기서 zero-shot이라는 말은 중요합니다.

Real terrain에서 추가 fine-tuning을 한 것이 아니라, simulation에서 학습한 controller를 그대로 deploy합니다.

## **7. Sim2Real 관점에서의 해석**

이 논문은 Sim2Real을 조금 다르게 보게 만듭니다.

앞선 논문들은 real world를 simulation distribution 안에 넣으려고 했습니다.

하지만 rough natural terrain에서는 모든 real condition을 simulation에 넣는 것이 어렵습니다. Mud, snow, vegetation, water의 정확한 dynamics를 모두 재현하기는 힘듭니다.

Lee et al.의 중요한 메시지는 다음입니다.

> 모든 현실을 정확히 모델링하지 않아도, policy가 proprioceptive history로 상황을 추론하고 대응할 수 있으면 transfer가 가능하다.

즉 randomization과 terrain curriculum은 policy에게 다양한 경험을 주고, proprioceptive history는 real에서 encounter한 차이를 online으로 감지하게 해줍니다.

이 흐름은 다음 RMA 논문으로 이어집니다.

RMA는 이 "보이지 않는 environment factor를 history로 추론한다"는 생각을 더 명시적인 adaptation module로 만듭니다.

## **8. Go2 Sim2Real에서 가져갈 점**

Go2 rough terrain이나 outdoor deployment를 생각하면 이 논문은 매우 중요합니다.

Go2에서 camera 없이 proprioception 기반으로만 걷는다면, policy가 terrain을 직접 보는 것은 아닙니다. 대신 foot contact, base attitude, joint tracking, slip, velocity error를 통해 terrain 상태를 간접적으로 추론해야 합니다.

Go2에서 가져갈 질문은 다음입니다.

1. Policy가 observation history를 보고 있는가?
2. History가 terrain/contact 상태를 추론할 만큼 충분한가?
3. Training terrain curriculum이 너무 단순하지 않은가?
4. Real terrain에서 나타나는 slip, early contact, delayed contact를 simulation에서 경험했는가?
5. Privileged information을 teacher에게 주고 student로 distill하는 구조가 필요한가?
6. Camera/LiDAR 없이도 proprioception만으로 충분한 task인가?

특히 Go2 deployment에서 rough terrain을 목표로 한다면 flat ground command tracking만으로는 부족합니다.

Policy가 "왜 body가 흔들렸는지", "왜 발이 예상보다 빨리 닿았는지", "왜 특정 방향으로 미끄러지는지"를 history에서 읽을 수 있어야 합니다.

## **9. 이 논문의 한계**

이 논문은 매우 강한 rough-terrain result를 보여주지만, 한계도 있습니다.

- 완전한 terrain perception이 필요한 고속 navigation까지 해결하는 것은 아닙니다.
- Blind locomotion은 obstacle을 미리 보고 계획하는 능력이 제한됩니다.
- Teacher-student training 구조가 복잡합니다.
- Terrain curriculum 설계가 중요합니다.
- Proprioceptive history가 모든 hidden state를 복원할 수 있는 것은 아닙니다.

그래도 proprioception 기반 zero-shot transfer를 이해하는 데는 핵심 논문입니다.

## **10. 정리하며: History가 Adaptation의 시작이다**

이번 글에서는 Lee et al.의 **Learning Quadrupedal Locomotion over Challenging Terrain**을 정리했습니다.

- Rough natural terrain은 simulation으로 정확히 복제하기 어렵습니다.
- 논문은 privileged teacher와 proprioceptive student 구조를 사용합니다.
- Student policy는 proprioceptive history만으로 terrain/contact 상태를 간접 추론합니다.
- Adaptive terrain curriculum은 policy가 학습 가능한 어려운 terrain을 계속 제공합니다.
- ANYmal은 mud, snow, rubble, vegetation, water 등 다양한 자연 환경에 zero-shot으로 배포됩니다.

6편의 핵심은 이렇게 정리할 수 있습니다.

> 모든 terrain을 미리 볼 수 없다면, robot은 proprioceptive history로 지금 밟고 있는 terrain을 추론해야 한다.

다음 글에서는 이 history-based adaptation을 더 명시적인 online adaptation module로 만든 RMA를 보겠습니다.
