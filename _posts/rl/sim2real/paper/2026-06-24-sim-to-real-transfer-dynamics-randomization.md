---
title: "[Sim2Real Paper 3] Dynamics Randomization"
date: 2026-06-24 17:31:00 +0900
categories: [RL, Sim2Real, Paper]
tags: [sim2real, dynamics-randomization, domain-randomization, robot-control, manipulation]
description: Peng et al.의 Sim-to-Real Transfer of Robotic Control with Dynamics Randomization을 통해 물리 파라미터 randomization의 기본 아이디어를 정리한다.
math: true
---

## **0. 전체 그림: Appearance가 아니라 Dynamics를 흔들기**

2편에서는 Tobin et al.의 visual domain randomization을 봤습니다.

그 논문의 핵심은 real image를 simulation variation 중 하나처럼 보이게 만들자는 것이었습니다. Texture, lighting, camera pose, distractor 같은 visual 요소를 계속 바꿔서 model이 특정 simulation appearance에 overfit되지 않게 만드는 방식입니다.

Peng et al.의 **Sim-to-Real Transfer of Robotic Control with Dynamics Randomization**은 같은 생각을 control 쪽으로 옮깁니다.

여기서 흔드는 것은 image texture가 아니라 **물리 파라미터**입니다.

> Real robot의 dynamics를 simulation dynamics distribution 안의 하나로 만들자.

즉, simulator의 mass, friction, damping, controller gain, action timestep, observation noise 같은 값들을 training 중 계속 바꿔서 policy가 하나의 simulator에만 맞춰지지 않도록 합니다.

이 논문은 Sim2Real에서 **dynamics randomization**을 이해할 때 기본으로 볼 만한 논문입니다.

## **1. 논문이 다루는 문제**

Simulation에서 control policy를 학습하면 많은 장점이 있습니다.

- 데이터를 빠르게 만들 수 있습니다.
- robot을 망가뜨릴 위험이 없습니다.
- reset이 쉽습니다.
- 많은 실패를 반복해도 비용이 작습니다.

하지만 control에서는 reality gap이 더 직접적으로 나타납니다.

같은 action을 줘도 simulation과 real robot의 결과가 다를 수 있습니다. Robot link mass가 조금 다르거나, joint damping이 맞지 않거나, object friction이 다르거나, controller latency가 있으면 policy가 예상한 state transition이 깨집니다.

문제는 모든 dynamics parameter를 정확히 식별하기 어렵다는 점입니다.

> 정확한 system identification 없이도 real robot에 transfer되는 control policy를 만들 수 있을까?

Peng et al.의 답은 dynamics randomization입니다.

## **2. 논문 정보**

| 항목 | 내용 |
|---|---|
| Title | Sim-to-Real Transfer of Robotic Control with Dynamics Randomization |
| Authors | Xue Bin Peng, Marcin Andrychowicz, Wojciech Zaremba, Pieter Abbeel |
| Year | 2018 |
| Venue | ICRA 2018 |
| Task | object pushing |
| Robot | robotic arm |
| Algorithm | recurrent policy with off-policy RL |
| Key idea | dynamics parameter를 episode마다 randomize |
| Source | [arXiv](https://arxiv.org/abs/1710.06537), [PDF](https://arxiv.org/pdf/1710.06537) |

Tobin et al.이 vision model을 다뤘다면, Peng et al.은 robotic control policy를 다룹니다.

그래서 이 논문은 "domain randomization이 visual trick이 아니라 dynamics transfer에도 쓸 수 있다"는 흐름에서 중요합니다.

## **3. 핵심 아이디어: Dynamics Distribution에서 학습하기**

일반적인 simulation training은 하나의 dynamics model에서 policy를 학습합니다.

이 경우 policy는 그 simulator의 transition에 맞춰집니다.

$$
s_{t+1} = f_{\text{sim}}(s_t, a_t)
$$

하지만 real world의 transition은 다릅니다.

$$
s_{t+1} = f_{\text{real}}(s_t, a_t)
$$

Dynamics randomization은 하나의 simulator를 고정하지 않고, simulator parameter를 매 episode 바꿉니다.

> **Dynamics Randomization**이란?
>
> Training 중 mass, friction, damping, actuator gain, latency, noise 같은 physical parameter를 random하게 바꿔 policy가 여러 dynamics에서 버티도록 학습하는 방법입니다.

이 논문에서는 episode 시작 시 dynamics parameter set을 sample하고, 그 episode 동안은 같은 parameter를 유지합니다.

이렇게 하면 policy는 "하나의 정확한 dynamics"가 아니라 "가능한 dynamics들의 distribution"에서 성공해야 합니다.

## **4. Randomization 대상**

논문에서 randomize한 parameter는 총 95개입니다.

주요 축은 다음과 같습니다.

| Randomization axis | 의미 |
|---|---|
| robot link mass | robot body 각 link의 mass 차이 |
| joint damping | joint 움직임의 damping 차이 |
| puck mass | 밀어야 하는 object의 질량 |
| puck friction | object와 table 사이의 마찰 |
| puck damping | object motion의 damping |
| table height | table 위치 calibration error |
| controller gain | position controller gain 차이 |
| action timestep | action이 적용되는 시간, latency에 가까운 효과 |
| observation noise | sensor uncertainty |

여기서 중요한 것은 friction, mass, damping만이 아닙니다.

Action timestep과 observation noise도 중요합니다. 논문은 action timestep randomization을 physical controller latency의 단순 모델로 사용합니다.

즉 dynamics randomization은 단순히 "무게 좀 흔들기"가 아닙니다. Robot, object, controller, sensor가 만드는 전체 closed-loop dynamics를 흔드는 것입니다.

## **5. 실험 구조**

논문이 다루는 task는 object pushing입니다.

Robot arm이 puck을 밀어서 목표 위치로 보내야 합니다. 이 task는 contact dynamics가 중요합니다. Puck과 table 사이의 friction, puck mass, robot action timing이 조금만 달라도 결과가 달라질 수 있습니다.

Policy는 simulation에서만 학습됩니다. 이후 real robot에 올려서 random initial configuration에서 puck을 목표 위치로 밀 수 있는지 평가합니다.

논문에서 중요한 설계는 recurrent policy입니다.

Dynamics parameter는 policy에게 직접 주어지지 않습니다. 대신 policy는 observation history를 통해 현재 환경이 어떤 dynamics인지 암묵적으로 추론해야 합니다.

이 점이 중요합니다.

> Dynamics randomization은 policy를 robust하게 만들 뿐 아니라, recurrent policy가 현재 dynamics를 history로부터 추정하게 만들 수 있다.

## **6. 결과에서 중요한 부분**

논문의 핵심 결과는 simulation에서만 학습한 policy가 real robot에서도 object pushing을 수행했다는 것입니다.

특히 randomization 없이 학습한 policy는 unfamiliar dynamics에 약했고, randomization을 넣은 recurrent policy가 real robot에서 더 안정적으로 동작했습니다.

또한 ablation에서 action timestep, observation noise, link mass, friction randomization을 끄면 real robot 적응 성능이 나빠졌습니다.

논문은 특히 action timestep과 observation noise를 끈 경우 성능 하락이 크다고 보고합니다. 이것은 latency와 sensor noise가 real transfer에서 중요한 축이라는 뜻입니다.

정리하면 다음입니다.

> Dynamics randomization은 mass와 friction만의 문제가 아니라, closed-loop control에서 생기는 timing과 sensing uncertainty까지 포함해야 한다.

## **7. Sim2Real 관점에서의 해석**

이 논문은 dynamics randomization을 단순하고 강한 형태로 보여줍니다.

System identification을 완벽하게 하려는 대신, real world가 들어올 수 있을 만큼 dynamics distribution을 넓게 잡습니다.

| 접근 | 의미 | 위험 |
|---|---|---|
| 정확한 system identification | real parameter를 최대한 맞춤 | 식별 비용이 크고 누락 parameter에 약함 |
| dynamics randomization | 가능한 parameter 범위에서 robust policy 학습 | 범위가 너무 넓으면 보수적 policy가 됨 |
| 둘의 조합 | 식별한 값을 중심으로 현실적 범위 randomize | 실전에서 가장 자주 쓰임 |

중요한 것은 randomization range입니다.

너무 좁으면 real world가 distribution 밖에 있을 수 있습니다. 너무 넓으면 policy가 task를 적극적으로 수행하지 못하고 conservative해질 수 있습니다.

이 관점은 1편 Jakobi의 noise 논문과도 이어집니다.

> Noise와 randomization은 많이 넣는 것이 아니라, real world의 variation을 잘 덮도록 넣는 것이다.

## **8. Go2 Sim2Real에서 가져갈 점**

Go2 locomotion에 이 논문을 그대로 적용하면 task는 다릅니다. Object pushing과 quadruped locomotion은 contact 구조가 다릅니다.

하지만 dynamics randomization의 사고방식은 그대로 중요합니다.

Go2에서 생각해야 할 randomization 축은 다음과 같습니다.

| Peng 논문의 축 | Go2에서 대응되는 축 |
|---|---|
| link mass | base/link mass, payload |
| joint damping | joint damping, motor friction |
| puck friction | foot-ground friction |
| controller gain | PD gain, actuator tracking |
| action timestep | policy delay, command latency |
| observation noise | IMU, joint velocity, state estimator noise |
| table height | terrain height, contact geometry |

특히 Go2에서는 action delay와 actuator tracking이 중요합니다.

Simulation에서는 action이 바로 joint target으로 반영되는 것처럼 보일 수 있습니다. 하지만 real robot에서는 command transport, low-level controller, motor response, joint friction, battery state 때문에 지연과 오차가 생깁니다.

그래서 Go2 Sim2Real에서 dynamics randomization을 볼 때는 다음 질문이 필요합니다.

1. Real robot에서 실제로 변하는 physical parameter가 무엇인가?
2. 그 parameter의 현실적인 범위를 측정했는가?
3. Policy가 parameter를 직접 보지 못해도 observation history로 적응할 수 있는가?
4. Delay와 sensor noise가 training distribution에 들어가 있는가?
5. Randomization이 너무 넓어서 gait가 필요 이상으로 conservative해지지는 않는가?

## **9. 이 논문의 한계**

이 논문은 dynamics randomization의 기본을 보여주지만, legged locomotion 자체를 다루지는 않습니다.

한계는 다음과 같습니다.

- Task가 object pushing이라 보행의 hybrid contact dynamics와 다릅니다.
- Robot arm manipulation이라 quadruped gait stability 문제는 직접 다루지 않습니다.
- Randomization range는 여전히 사람이 정해야 합니다.
- Real robot deployment에서 online adaptation module을 따로 학습하는 구조는 아닙니다.
- Terrain, actuator saturation, foot slip 같은 legged-specific issue는 이후 논문들이 더 직접적으로 다룹니다.

그래도 이 논문은 Sim2Real에서 "물리 파라미터를 흔든다"는 말이 정확히 무엇을 뜻하는지 잘 보여줍니다.

## **10. 정리하며: Dynamics Randomization에서 Legged Locomotion으로**

이번 글에서는 Peng et al.의 **Sim-to-Real Transfer of Robotic Control with Dynamics Randomization**을 정리했습니다.

- Visual domain randomization이 appearance를 흔든다면, dynamics randomization은 physical parameter를 흔듭니다.
- Mass, friction, damping, controller gain, action timestep, observation noise가 모두 transfer에 영향을 줍니다.
- Policy는 하나의 simulator가 아니라 dynamics distribution에서 성공하도록 학습됩니다.
- Recurrent policy는 observation history를 통해 현재 dynamics에 적응할 수 있습니다.
- Go2에서는 이 아이디어가 foot friction, actuator delay, motor strength, mass, sensor noise randomization으로 이어집니다.

3편의 핵심은 이렇게 정리할 수 있습니다.

> Real robot을 정확히 복사하기 어렵다면, real robot이 들어올 수 있는 dynamics distribution에서 policy를 학습하자.

다음 글에서는 이 dynamics randomization이 quadruped locomotion으로 넘어가면서 actuator model, latency, system identification과 어떻게 결합되는지 보겠습니다.
