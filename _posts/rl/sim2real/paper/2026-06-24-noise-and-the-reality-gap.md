---
title: "[Sim2Real Paper 1] Noise and the Reality Gap"
date: 2026-06-24 12:45:00 +0900
categories: [RL, Sim2Real, Paper]
tags: [sim2real, reality-gap, robot-simulation, noise, evolutionary-robotics]
description: Jakobi et al.의 Noise and The Reality Gap을 읽고, Sim2Real에서 simulation noise와 현실 전이 문제를 어떻게 봐야 하는지 정리한다.
---

## **1. 이 논문을 왜 먼저 보나**

Sim2Real을 공부할 때 가장 먼저 잡아야 하는 단어는 `reality gap`입니다.

요즘은 Sim2Real이라고 하면 domain randomization, system identification, actuator model, latency, privileged learning 같은 말을 먼저 떠올리기 쉽습니다. 하지만 그 전에 더 기본적인 질문이 있습니다.

> simulation에서 잘 되는 controller가 왜 real robot에서는 깨지는가?

Jakobi, Husbands, Harvey의 **Noise and The Reality Gap: The Use of Simulation in Evolutionary Robotics**는 이 질문을 아주 직접적으로 다룹니다.

논문은 1995년에 나온 오래된 evolutionary robotics 논문입니다. 지금 우리가 쓰는 PPO, Isaac Gym, legged gym, quadruped locomotion과는 시대도 다르고 방법도 다릅니다. 그래도 Sim2Real을 할 때 이 논문을 먼저 보는 이유는 분명합니다.

이 논문은 simulation을 믿어도 되는지, 믿는다면 어떤 조건에서 믿을 수 있는지를 묻습니다.

## **2. 논문 정보**

- **Title:** Noise and The Reality Gap: The Use of Simulation in Evolutionary Robotics
- **Authors:** Nick Jakobi, Phil Husbands, Inman Harvey
- **Year:** 1995
- **Robot:** Khepera two-wheeled robot
- **Tasks:** obstacle avoidance, light seeking
- **Controller:** recurrent dynamical neural network, evolved in simulation
- **Source:** [PDF](https://cse-robotics.engr.tamu.edu/dshell/cs689/papers/jakobi95noise.pdf)

지금 기준으로 보면 실험 scale은 작습니다. 사족보행도 아니고, deep RL도 아닙니다. 하지만 핵심 질문은 지금도 그대로입니다.

> simulation에서 학습한 behavior가 real robot에서도 같은 behavior로 나오는가?

## **3. 논문이 보는 문제**

논문은 naive simulation을 경계합니다. 여기서 말하는 naive simulation은 실제 robot과 환경의 상호작용을 충분히 모델링하지 않은 simulation입니다.

예를 들어 simulation에서 sensor가 항상 깨끗한 값을 주고, motor가 command를 정확히 따르고, 바닥 마찰이나 sensor noise가 없다고 가정하면 controller는 그런 깨끗한 세계에 맞춰집니다.

문제는 real robot이 그렇지 않다는 점입니다.

- sensor reading은 깨끗하지 않음
- actuator response는 완전히 deterministic하지 않음
- 같은 command를 줘도 매번 완전히 같은 motion이 나오지 않음
- 환경과 robot 사이의 coupling이 simulation보다 복잡함

결국 controller는 simulation에서만 가능한 shortcut을 학습할 수 있습니다.

이게 reality gap입니다.

## **4. 실험 구조**

논문은 Khepera robot simulation을 만들고, 그 안에서 neural network controller를 evolution으로 학습합니다. 이후 학습된 controller를 실제 Khepera robot에 올려서 simulation behavior와 real behavior가 얼마나 비슷한지 비교합니다.

실험 task는 두 가지입니다.

1. **Obstacle avoidance**
   - 장애물을 피하면서 움직이는 behavior
   - IR proximity sensor가 중요함

2. **Light seeking**
   - light source를 찾아가는 behavior
   - ambient light sensor가 중요함

핵심은 같은 task를 여러 noise level에서 학습했다는 점입니다.

- zero noise
- observed noise
- double noise

`observed noise`는 실제 robot에서 관찰된 noise level에 가까운 조건입니다. 즉 논문은 단순히 noise를 넣느냐 마느냐가 아니라, **현실과 비슷한 noise level이 transfer에 어떤 영향을 주는지**를 봅니다.

## **5. 핵심 아이디어: envelope of noise**

이 논문에서 가장 중요한 개념은 `envelope of noise`입니다.

완벽한 simulation을 만드는 것은 어렵습니다. 특히 sensor, actuator, contact, environment interaction이 복잡해질수록 모든 것을 정확히 모델링하기는 힘듭니다.

그러면 한 가지 방법은 simulation에 적절한 noise를 넣는 것입니다.

여기서 중요한 것은 noise가 단순한 방해물이 아니라는 점입니다. 적절한 noise는 controller가 깨끗한 simulation의 특수한 조건에 overfit되는 것을 막습니다.

다르게 말하면, simulation 안에서 조금 흔들리는 세계를 경험한 controller는 real robot의 불완전함을 더 잘 견딜 수 있습니다.

이 관점은 지금의 domain randomization과 바로 이어집니다.

현대 Sim2Real에서는 noise라는 말을 더 넓게 씁니다.

- sensor noise
- action delay
- motor strength variation
- friction variation
- mass variation
- terrain variation
- observation dropout

Jakobi et al.의 논문은 이런 현대적 randomization의 아주 초기 형태를 보여준다고 볼 수 있습니다.

## **6. 결과에서 중요한 부분**

논문의 결과는 단순히 "noise를 넣으면 좋다"가 아닙니다.

더 정확한 결론은 이겁니다.

> noise level이 현실과 맞아야 한다.

Obstacle avoidance에서는 observed noise 조건이 가장 좋은 평균 correspondence score를 보였습니다. 논문 표 기준으로 zero noise는 평균 correspondence score가 6.2, observed noise는 8.0, double noise는 6.8이었습니다.

Light seeking에서도 비슷합니다. zero noise는 5.6, observed noise는 7.8, double noise는 5.4였습니다.

즉 noise가 없으면 simulation에 과적합된 fragile behavior가 나오기 쉽고, noise가 너무 많으면 controller가 오히려 과한 noise에 의존하는 이상한 behavior를 만들 수 있습니다.

이 부분이 중요합니다.

Sim2Real에서 randomization을 넣는다고 해서 무조건 좋은 것이 아닙니다. 너무 좁으면 real gap을 못 견디고, 너무 넓으면 학습이 느슨해지거나 실제로 필요 없는 robust behavior를 학습할 수 있습니다.

## **7. Zero noise가 왜 위험한가**

zero noise simulation에서는 robot이 같은 상황에서 항상 같은 방식으로 반응합니다.

그러면 controller는 그 determinism을 이용할 수 있습니다. 예를 들어 simulation에서는 정확히 90도 회전하는 전략이 잘 먹힐 수 있습니다.

하지만 real robot에서는 같은 command를 줘도 매번 정확히 90도 회전하지 않습니다. 바닥 상태, actuator response, sensor value, wheel slip이 조금씩 다릅니다.

그래서 simulation에서는 안정적인 loop처럼 보이던 behavior가 real robot에서는 점점 틀어지고, 결국 장애물에 부딪히거나 task를 실패할 수 있습니다.

Go2로 바꿔 생각하면 비슷합니다.

Simulation에서 어떤 gait가 항상 같은 contact timing, 같은 motor response, 같은 friction 위에서만 성공한다면, real robot에서는 작은 delay나 actuator 차이만으로도 발이 끌리거나 body가 기울 수 있습니다.

## **8. Too much noise도 위험하다**

반대로 noise를 너무 많이 넣어도 문제가 됩니다.

논문에서는 double noise 조건에서 simulation에서는 괜찮아 보이지만 real robot에서는 제대로 재현되지 않는 behavior가 나옵니다. Controller가 현실에는 없는 과한 noise를 이용하는 방식으로 학습될 수 있기 때문입니다.

이건 현대 Sim2Real에서도 그대로 중요합니다.

예를 들어 motor strength randomization을 너무 넓게 주면 policy가 conservative하게 굳거나, command tracking을 포기하는 방향으로 갈 수 있습니다. Terrain이나 friction randomization을 너무 넓게 주면 실제 deployment 조건에서는 불필요하게 느리고 둔한 gait가 나올 수 있습니다.

그래서 randomization은 "많이 넣으면 안전하다"가 아닙니다.

실제 robot에서 발생 가능한 variation을 기준으로 잡아야 합니다.

## **9. Go2 Sim2Real 관점에서 읽기**

이 논문은 Khepera robot을 다룹니다. Go2 같은 quadruped locomotion과는 다릅니다. 그래도 내 입장에서는 다음 점이 바로 연결됩니다.

### **Simulation을 깨끗하게 만들수록 좋은 게 아니다**

처음에는 simulation을 최대한 이상적으로 만들고 싶어집니다. 그러면 reward curve도 잘 나오고, gait도 깔끔해 보입니다.

하지만 real robot으로 넘길 생각이라면, 깨끗한 simulation은 오히려 위험할 수 있습니다. Real robot에서 반드시 생기는 흔들림을 policy가 학습 중에 한 번도 보지 못하기 때문입니다.

### **Noise는 실제 원인을 보고 넣어야 한다**

Go2에서 생각해야 할 noise와 variation은 Khepera의 IR sensor noise와 다릅니다.

Go2에서는 이런 것들이 더 중요합니다.

- action delay
- motor strength variation
- PD tracking error
- joint velocity noise
- base angular velocity noise
- contact timing variation
- friction variation
- terrain unevenness

즉 이 논문을 Go2에 적용한다는 것은 IR sensor noise를 따라 하자는 뜻이 아닙니다. Go2에서 real gap을 만드는 축을 찾아서, 그 축을 simulation에 넣어야 한다는 뜻입니다.

### **Correspondence를 봐야 한다**

Simulation에서 reward가 높다고 끝이 아닙니다.

이 논문은 simulation behavior와 real behavior의 correspondence를 따로 봅니다. 이게 좋습니다.

Go2에서도 같은 식으로 봐야 합니다.

- simulation에서 gait가 좋은가?
- real robot에서도 같은 command에서 비슷한 motion이 나오는가?
- 속도만 비슷한가, 아니면 foot contact와 body attitude도 비슷한가?
- torque/current/load 분포도 비슷한가?
- delay나 sensor noise가 들어가도 무너지지 않는가?

이런 식으로 simulation score와 real behavior correspondence를 분리해서 봐야 합니다.

## **10. 이 논문을 읽고 가져갈 것**

이 논문에서 가져갈 것은 세 가지입니다.

첫째, simulation은 반드시 한계가 있습니다.

Simulation을 정교하게 만들 수는 있지만, real robot과 완전히 같게 만들 수는 없습니다. 그래서 policy가 simulation의 빈틈을 이용하지 않도록 해야 합니다.

둘째, 적절한 noise는 transfer를 도와줄 수 있습니다.

Noise는 단순히 학습을 방해하는 요소가 아닙니다. 현실에 존재하는 uncertainty를 simulation에서 미리 경험시키는 장치가 될 수 있습니다.

셋째, noise level은 맞아야 합니다.

Noise가 없으면 brittle policy가 나오고, noise가 너무 많으면 현실에 없는 조건에 맞춘 이상한 policy가 나올 수 있습니다.

## **11. 지금 기준으로 한계도 있다**

이 논문을 현대 quadruped Sim2Real에 그대로 가져오면 안 됩니다.

- robot이 Khepera라서 legged contact dynamics가 없음
- task가 obstacle avoidance와 light seeking으로 단순함
- controller가 modern deep RL policy가 아님
- correspondence score가 주관적 평가를 포함함
- actuator saturation, torque limit, contact impulse, terrain interaction 같은 문제가 작음

그래도 이 논문은 Sim2Real의 기본 감각을 잡는 데 좋습니다.

복잡한 modern method를 보기 전에, 먼저 이 질문을 던지게 만들기 때문입니다.

> 내 simulation은 real robot이 겪는 uncertainty를 어느 정도 포함하고 있는가?

## **12. 내 체크리스트**

이 논문을 Go2 Sim2Real 쪽으로 읽으면 체크리스트는 이렇게 됩니다.

1. Simulation에서 너무 deterministic한 조건에 overfit되고 있지 않은가?
2. Real robot에서 실제로 흔들리는 축이 무엇인지 알고 있는가?
3. Randomization range가 현실보다 너무 좁거나 너무 넓지 않은가?
4. Reward가 simulation-only shortcut을 허용하고 있지 않은가?
5. Simulation reward와 real behavior correspondence를 분리해서 보고 있는가?
6. Real robot에서 같은 command를 반복했을 때 variation을 측정했는가?
7. Policy가 noise를 견디는지, noise를 이용하는지 구분하고 있는가?

이 논문은 오래됐지만, Sim2Real을 시작할 때 가장 기본적인 질문을 던집니다.

Simulation을 믿을 수 있는가?

믿을 수 있다면, 어떤 noise와 어떤 validation이 있어야 하는가?
