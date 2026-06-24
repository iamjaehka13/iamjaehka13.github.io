---
title: "[Sim2Real Paper 1] Noise and the Reality Gap"
date: 2026-06-24 12:45:00 +0900
categories: [RL, Sim2Real, Paper]
tags: [sim2real, reality-gap, robot-simulation, noise, evolutionary-robotics]
description: Jakobi et al.의 Noise and The Reality Gap을 통해 Sim2Real에서 reality gap이 왜 생기고, simulation noise가 어떤 역할을 하는지 정리한다.
---

## **0. 전체 그림: Simulation은 왜 현실과 달라지는가**

Sim2Real을 이해하려면 먼저 **Reality Gap**이라는 문제를 잡아야 합니다.

강화학습에서는 보통 simulation에서 policy를 학습합니다. Simulation은 빠르고, 안전하고, reset이 쉽습니다. 로봇이 넘어져도 다시 세우면 되고, 수천 개 환경을 병렬로 돌릴 수도 있습니다.

하지만 실제 로봇은 다릅니다.

같은 action을 줘도 actuator가 완전히 똑같이 움직이지 않고, sensor에는 noise가 있으며, 바닥 마찰과 contact도 매번 조금씩 달라집니다. 그래서 simulation에서 잘 작동하던 policy가 실제 로봇에서는 바로 깨질 수 있습니다.

> **Reality Gap**이란?
>
> Simulation에서 학습하거나 검증한 robot behavior가 실제 robot에서 그대로 재현되지 않는 차이를 말합니다.

Jakobi, Husbands, Harvey의 **Noise and The Reality Gap: The Use of Simulation in Evolutionary Robotics**는 이 문제를 아주 초기에 정면으로 다룬 논문입니다.

논문은 1995년에 나온 오래된 evolutionary robotics 논문입니다. 지금의 PPO, Isaac Gym, legged gym, quadruped locomotion과는 시대도 다르고 방법도 다릅니다. 그래도 Sim2Real을 공부할 때 이 논문을 먼저 볼 만한 이유가 있습니다.

이 논문은 다음 질문을 던집니다.

> Simulation을 현실과 완전히 같게 만들 수 없다면, 우리는 simulation을 어떻게 써야 하는가?

## **1. 논문이 다루는 문제**

논문이 경계하는 것은 **naive simulation**입니다.

여기서 naive simulation은 실제 로봇과 환경의 불확실성을 충분히 반영하지 않은 simulation을 뜻합니다. 예를 들어 sensor가 항상 깨끗한 값을 주고, motor가 명령을 정확히 따르고, 바닥이나 벽과의 상호작용도 단순하게 모델링되어 있는 simulation입니다.

이런 simulation에서는 controller가 좋아 보일 수 있습니다. 하지만 그 controller가 실제 로봇에서도 좋다는 뜻은 아닙니다.

문제는 controller가 simulation의 깨끗한 조건에 과적합될 수 있다는 점입니다.

- simulation sensor는 깨끗하지만 real sensor는 noisy합니다.
- simulation motor는 명령을 정확히 따르지만 real actuator는 지연과 오차가 있습니다.
- simulation contact는 단순하지만 real contact는 마찰, 미끄러짐, 충격이 섞입니다.
- simulation에서는 같은 action이 같은 결과를 내지만 real robot에서는 반복마다 조금씩 달라집니다.

정리하면, simulation이 너무 이상적이면 controller는 현실에서 버틸 수 없는 fragile behavior를 학습할 수 있습니다.

## **2. 논문 정보**

| 항목 | 내용 |
|---|---|
| Title | Noise and The Reality Gap: The Use of Simulation in Evolutionary Robotics |
| Authors | Nick Jakobi, Phil Husbands, Inman Harvey |
| Year | 1995 |
| Robot | Khepera two-wheeled robot |
| Tasks | obstacle avoidance, light seeking |
| Controller | recurrent dynamical neural network |
| Training method | evolutionary robotics |
| Source | [PDF](https://cse-robotics.engr.tamu.edu/dshell/cs689/papers/jakobi95noise.pdf) |

지금 기준으로 보면 실험은 작습니다. 사족보행도 아니고, modern deep RL도 아닙니다. 하지만 핵심 질문은 지금도 그대로입니다.

> Simulation에서 얻은 behavior가 real robot에서도 같은 behavior로 나오는가?

## **3. 핵심 아이디어: Noise를 현실의 일부로 넣기**

이 논문에서 가장 중요한 개념은 **envelope of noise**입니다.

완벽한 simulation을 만드는 것은 어렵습니다. 특히 robot이 실제 환경과 상호작용할수록 모든 sensor, actuator, contact, material property를 정확히 모델링하기는 어렵습니다.

그러면 한 가지 방법은 simulation에 적절한 noise를 넣는 것입니다.

> **Envelope of noise**란?
>
> 실제 robot에서 생기는 불확실성을 simulation 안에서 일정 범위의 noise로 감싸서, controller가 깨끗한 simulation에만 맞춰지지 않도록 하는 방법입니다.

여기서 중요한 점은 noise가 단순한 방해물이 아니라는 것입니다.

적절한 noise는 controller가 simulation의 특수한 조건에 overfit되는 것을 막습니다. Simulation 안에서 조금 흔들리는 세계를 경험한 controller는 실제 robot의 불완전함에도 더 잘 버틸 수 있습니다.

지금 용어로 바꿔 말하면, 이 논문은 domain randomization의 초기 형태를 보여준다고 볼 수 있습니다.

| 1995년 논문에서의 관점 | 현대 Sim2Real에서의 대응 |
|---|---|
| sensor noise | observation noise |
| motor noise | actuator variation |
| noisy simulation | domain randomization |
| simulation-real correspondence | sim-to-real validation |
| envelope of noise | randomization range |

## **4. 실험 구조**

논문은 Khepera robot을 대상으로 simulation을 만들고, 그 안에서 neural network controller를 evolution으로 학습합니다. 이후 학습된 controller를 실제 Khepera robot에 올려서 behavior가 얼마나 비슷하게 나오는지 확인합니다.

실험 task는 두 가지입니다.

### **4.1 Obstacle avoidance**

첫 번째 task는 장애물 회피입니다.

로봇은 IR proximity sensor를 이용해 주변 장애물을 감지하고, 장애물을 피하면서 움직여야 합니다.

이 task에서 중요한 것은 sensor 값이 현실에서 완전히 깨끗하지 않다는 점입니다. 장애물과의 거리, 각도, 표면 상태에 따라 sensor reading은 조금씩 흔들릴 수 있습니다.

### **4.2 Light seeking**

두 번째 task는 빛을 찾아가는 행동입니다.

로봇은 light sensor를 이용해 light source 방향으로 움직여야 합니다. 이 경우에도 sensor noise와 환경 조건이 behavior에 영향을 줍니다.

### **4.3 Noise 조건**

논문은 controller를 세 가지 noise 조건에서 학습합니다.

| 조건 | 의미 |
|---|---|
| zero noise | simulation에 noise를 넣지 않음 |
| observed noise | 실제 robot에서 관찰된 수준의 noise를 넣음 |
| double noise | observed noise보다 더 큰 noise를 넣음 |

핵심은 noise를 넣었는지 여부만 보는 것이 아닙니다. **noise level이 현실과 얼마나 잘 맞는지**를 봅니다.

## **5. 결과: Noise는 많을수록 좋은 것이 아니다**

결과를 단순히 요약하면 observed noise 조건이 가장 좋았습니다.

Obstacle avoidance 결과는 다음과 같이 정리할 수 있습니다.

| Noise condition | Mean correspondence score |
|---|---:|
| zero noise | 6.2 |
| observed noise | 8.0 |
| double noise | 6.8 |

Light seeking에서도 비슷한 경향이 나옵니다.

| Noise condition | Mean correspondence score |
|---|---:|
| zero noise | 5.6 |
| observed noise | 7.8 |
| double noise | 5.4 |

여기서 correspondence score는 simulation behavior와 real robot behavior가 얼마나 잘 맞는지를 평가한 값입니다.

결과에서 중요한 점은 두 가지입니다.

첫째, noise가 없는 simulation은 위험합니다.

Zero noise 조건에서는 controller가 깨끗하고 deterministic한 simulation에 맞춰질 수 있습니다. 이런 controller는 실제 robot에서 sensor나 actuator가 조금만 흔들려도 behavior가 깨질 수 있습니다.

둘째, noise를 너무 많이 넣어도 좋지 않습니다.

Double noise 조건은 observed noise보다 항상 좋은 결과를 만들지 않았습니다. Noise가 너무 크면 controller가 실제 현실에는 없는 과한 불확실성에 맞춰질 수 있습니다.

정리하면 이 논문의 결론은 "noise를 많이 넣자"가 아닙니다.

> 현실에서 실제로 생기는 불확실성에 맞는 noise를 simulation에 넣어야 한다.

## **6. Sim2Real 관점에서의 해석**

이 논문은 Khepera robot을 다루지만, Sim2Real의 기본 감각은 지금도 그대로 적용됩니다.

### **6.1 깨끗한 simulation은 좋은 simulation이 아닐 수 있다**

처음에는 simulation을 최대한 이상적으로 만들고 싶어집니다. 그러면 reward curve도 잘 나오고, behavior도 깔끔해 보입니다.

하지만 real robot으로 policy를 옮길 생각이라면, 너무 깨끗한 simulation은 오히려 위험할 수 있습니다. Real robot에서 반드시 생기는 흔들림을 policy가 학습 중에 한 번도 경험하지 못하기 때문입니다.

### **6.2 Randomization range가 중요하다**

현대 Sim2Real에서는 noise 대신 randomization이라는 말을 더 많이 씁니다.

Go2 같은 quadruped locomotion에서는 다음과 같은 축을 생각할 수 있습니다.

| Randomization axis | Go2에서의 의미 |
|---|---|
| action delay | policy action이 실제 joint motion으로 반영되는 지연 |
| motor strength | actuator 출력 차이 또는 tracking 능력 차이 |
| friction | 발과 지면 사이의 마찰 변화 |
| mass / inertia | robot model과 실제 hardware 차이 |
| observation noise | IMU, joint velocity, base velocity 추정 오차 |
| terrain variation | 평평하지 않은 바닥, 작은 충격, contact 변화 |

하지만 이 값들을 무작정 크게 흔들면 안 됩니다. 현실보다 너무 좁으면 transfer가 안 되고, 현실보다 너무 넓으면 policy가 task를 제대로 수행하지 못하거나 필요 이상으로 conservative해질 수 있습니다.

### **6.3 Simulation reward와 real behavior는 따로 봐야 한다**

Simulation reward가 높다고 real robot에서 같은 behavior가 나온다는 보장은 없습니다.

Go2에서도 같은 관점이 필요합니다.

- simulation에서 gait가 좋아 보이는가?
- real robot에서도 같은 command에서 비슷한 motion이 나오는가?
- foot contact timing이 비슷한가?
- body attitude가 크게 무너지지 않는가?
- torque, current, actuator load가 과하지 않은가?
- delay나 sensor noise가 들어가도 policy가 버티는가?

즉 simulation score와 real behavior correspondence를 분리해서 봐야 합니다.

## **7. Go2 Sim2Real에서 가져갈 점**

이 논문을 Go2 Sim2Real 관점으로 읽으면 다음 체크리스트가 나옵니다.

1. Simulation이 너무 deterministic하지 않은가?
2. Real robot에서 실제로 흔들리는 축을 알고 있는가?
3. Randomization range가 현실보다 너무 좁거나 넓지 않은가?
4. Policy가 simulation-only shortcut을 쓰고 있지 않은가?
5. Simulation reward와 real behavior correspondence를 따로 보고 있는가?
6. 같은 command를 real robot에서 반복했을 때 variation을 측정했는가?
7. Noise를 견디는 policy인지, noise를 이용하는 policy인지 구분하고 있는가?

특히 Go2에서는 actuator와 delay 쪽이 중요합니다. Simulation에서 joint target이 잘 따라가는 것처럼 보여도, 실제 actuator가 그 target을 같은 속도와 정확도로 따라간다는 보장은 없습니다.

그래서 이 논문을 읽고 바로 가져갈 수 있는 결론은 다음입니다.

> Sim2Real을 하려면 simulation을 완벽하게 믿는 것이 아니라, 현실에서 생기는 불확실성을 simulation 안에서 적절히 경험시켜야 한다.

## **8. 정리하며: Reality Gap에서 Domain Randomization으로**

이번 글에서는 Jakobi et al.의 **Noise and The Reality Gap**을 통해 Sim2Real의 가장 기본적인 문제를 정리했습니다.

- Reality gap은 simulation behavior와 real robot behavior 사이의 차이입니다.
- 깨끗한 simulation은 controller를 fragile하게 만들 수 있습니다.
- 적절한 noise는 controller가 현실의 불확실성에 더 잘 버티게 만들 수 있습니다.
- 하지만 noise가 너무 많아도 좋지 않습니다.
- 중요한 것은 real robot에서 실제로 생기는 variation에 맞는 noise range를 잡는 것입니다.

이 논문은 오래됐지만, Sim2Real의 출발점을 잘 보여줍니다.

Simulation을 믿을 수 있는가?

믿을 수 있다면, 어떤 uncertainty를 simulation에 넣어야 하는가?

다음 글에서는 이 질문이 modern robotics에서 어떻게 확장되는지 보기 위해 **Domain Randomization** 계열 논문을 살펴보겠습니다.
