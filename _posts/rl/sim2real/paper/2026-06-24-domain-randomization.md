---
title: "[Sim2Real Paper 2] Domain Randomization"
date: 2026-06-24 17:30:00 +0900
categories: [RL, Sim2Real, Paper]
tags: [sim2real, domain-randomization, visual-domain-randomization, robot-vision, object-localization]
description: Tobin et al.의 Domain Randomization 논문을 통해 real world를 simulation variation 중 하나로 보이게 만드는 Sim2Real 아이디어를 정리한다.
---

## **0. 전체 그림: 현실을 하나의 variation으로 만들기**

이전 글에서는 Jakobi et al.의 **Noise and The Reality Gap**을 통해 Sim2Real의 기본 문제를 봤습니다.

Simulation은 현실과 완전히 같을 수 없습니다. Sensor, actuator, contact, lighting, texture, camera, friction 같은 요소들이 조금씩 다르고, 그 차이가 쌓이면 simulation에서 잘 되던 policy나 model이 real world에서 깨질 수 있습니다.

Jakobi et al.이 말한 핵심은 simulation에 적절한 noise를 넣어 현실의 불확실성을 미리 경험시키자는 것이었습니다.

Tobin et al.의 **Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World**는 이 생각을 더 직접적인 Sim2Real 방법으로 정리합니다.

핵심 문장은 이렇게 볼 수 있습니다.

> Real world를 simulation distribution 안의 하나의 sample처럼 보이게 만들자.

즉, simulator를 현실과 똑같이 만들려고만 하는 것이 아니라, simulator를 아주 다양하게 흔들어서 model이 특정 simulation appearance에 과적합되지 않도록 만드는 것입니다.

이 논문은 특히 **visual domain randomization**의 기본 논문으로 볼 수 있습니다. 여기서 randomization의 대상은 주로 texture, lighting, camera pose, distractor object, image noise 같은 시각 요소입니다.

## **1. 논문이 다루는 문제**

로봇이 vision을 사용하려면 image에서 필요한 정보를 뽑아야 합니다. 예를 들어 table 위에 있는 object의 위치를 찾아야 grasping을 할 수 있습니다.

문제는 real image label을 많이 모으기 어렵다는 점입니다.

- 실제 로봇으로 데이터를 모으는 것은 느립니다.
- Object 위치를 정확히 labeling하는 것은 비용이 큽니다.
- 조명, 배경, camera 위치, object texture가 바뀌면 image distribution이 쉽게 달라집니다.
- Photorealistic simulator를 만드는 것도 어렵고, 충분히 현실적인 rendering을 얻는 것도 쉽지 않습니다.

반면 simulation에서는 label을 자동으로 얻을 수 있습니다. Object의 position, segmentation, depth, camera pose 같은 정보는 simulator 안에서 정확히 알고 있기 때문입니다.

하지만 simulation image와 real image는 다릅니다.

여기서 생기는 질문은 다음입니다.

> Photorealistic simulation 없이도, simulation image만으로 real image에서 동작하는 model을 만들 수 있을까?

Tobin et al.의 답은 domain randomization입니다.

## **2. 논문 정보**

| 항목 | 내용 |
|---|---|
| Title | Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World |
| Authors | Josh Tobin, Rachel Fong, Alex Ray, Jonas Schneider, Wojciech Zaremba, Pieter Abbeel |
| Year | 2017 |
| Venue | IROS 2017 |
| Task | object localization from RGB image |
| Simulator | MuJoCo built-in renderer |
| Model | modified VGG-style convolutional network |
| Transfer setting | target-domain real images 없이 simulated RGB labels로 transfer |
| Source | [arXiv](https://arxiv.org/abs/1703.06907), [PDF](https://arxiv.org/pdf/1703.06907) |

이 논문은 quadruped locomotion 논문은 아닙니다. Dynamics randomization 논문도 아닙니다.

하지만 Sim2Real에서 domain randomization이라는 말을 이해하려면 이 논문이 중요합니다. 이유는 간단합니다. 이 논문이 말하는 관점이 이후 Sim2Real의 기본 문장처럼 쓰이기 때문입니다.

> Simulator를 하나의 고정된 world로 두지 말고, 가능한 여러 world의 distribution으로 보자.

## **3. 핵심 아이디어: Photorealism 대신 Randomization**

Sim2Real에서 한 가지 접근은 simulator를 현실과 최대한 비슷하게 만드는 것입니다.

이 접근에서는 texture, lighting, camera, material, sensor noise, physics parameter를 실제 환경에 가깝게 맞추려고 합니다. 이를 system identification이나 photorealistic rendering 쪽 접근이라고 볼 수 있습니다.

Tobin et al.의 접근은 다릅니다.

Simulator를 현실과 똑같이 만들려고 하기보다, simulator의 appearance를 매우 다양하게 바꿉니다.

> **Domain Randomization**이란?
>
> Training 중 simulator의 여러 parameter를 random하게 바꿔서, model이 특정 simulation domain에 과적합되지 않고 다양한 domain에서 유지되는 feature를 학습하도록 만드는 방법입니다.

이 논문에서는 주로 visual domain을 randomize합니다.

| Randomization 대상 | 의미 |
|---|---|
| object texture | object 색과 pattern을 계속 바꿈 |
| table / floor / skybox texture | 배경과 주변 appearance를 계속 바꿈 |
| camera pose / FOV | camera 위치, 방향, 시야각을 바꿈 |
| light | 조명 개수, 위치, 방향, specular property를 바꿈 |
| distractor object | 관심 없는 물체를 scene에 추가함 |
| image noise | image에 noise를 추가함 |

중요한 점은 texture가 realistic할 필요가 없다는 것입니다.

논문에서는 random RGB color, random gradient, checker pattern 같은 단순하고 비현실적인 texture도 사용합니다. 목적은 예쁜 simulation image를 만드는 것이 아닙니다. 목적은 model이 texture나 lighting 같은 우연한 visual cue에 기대지 못하게 만드는 것입니다.

## **4. 실험 구조**

논문이 다루는 task는 object localization입니다.

Model은 single RGB image를 입력으로 받고, table 위에 있는 geometric object의 Cartesian coordinate를 예측합니다. 이후 이 object detector를 실제 robot grasping pipeline에 연결합니다.

### **4.1 Training**

Training data는 simulation에서 만듭니다.

Simulator는 MuJoCo built-in renderer를 사용합니다. 이 renderer는 photorealistic rendering을 목표로 한 것이 아닙니다. 하지만 simulator에서는 object 위치 label을 정확히 알 수 있고, scene을 빠르게 많이 만들 수 있습니다.

각 training sample마다 scene의 appearance를 바꿉니다.

1. Object와 distractor의 위치를 바꿉니다.
2. Object, table, floor, skybox, robot texture를 바꿉니다.
3. Camera 위치, 방향, field of view를 바꿉니다.
4. Light 개수와 위치, 방향, specular 특성을 바꿉니다.
5. Image noise를 추가합니다.

이렇게 하면 model은 특정 색, 특정 조명, 특정 camera 위치에만 맞춰지는 것이 아니라, object 위치를 예측하는 데 더 본질적인 visual feature를 찾도록 압박받습니다.

### **4.2 Test**

Test는 real world image에서 합니다.

중요한 점은 target-domain real robot image로 model을 다시 학습하지 않는다는 것입니다.

일부 실험은 ImageNet pretrained weights를 initialization으로 사용합니다. 하지만 논문은 충분한 simulated training data가 있으면 random initialization도 거의 비슷한 transfer 성능을 낼 수 있다고 보고합니다.

즉 핵심은 real robot scene에서 labeled image를 모아 fine-tuning하지 않고, simulation에서 만든 labeled image로 학습한 detector를 실제 image에 바로 적용한다는 점입니다.

즉, 이 논문의 실험은 다음 질문을 직접 확인합니다.

> Simulation variation을 충분히 크게 만들면, real image도 그 variation 안에 들어온 것처럼 처리될 수 있는가?

## **5. 결과: Real image에서도 object 위치를 찾는다**

논문 결과의 핵심은 simulation image만으로 학습한 detector가 real image에서도 object 위치를 꽤 정확히 찾았다는 점입니다.

논문은 real webcam image 480장을 사용해 평가합니다. 8개의 geometric object가 있고, 각 object마다 60장의 labeled image가 있습니다.

평가 조건은 세 가지입니다.

| 조건 | 의미 |
|---|---|
| Object only | table 위에 목표 object만 있음 |
| Distractors | 목표 object 외에 다른 object도 있음 |
| Occlusions | 목표 object가 부분적으로 가려짐 |

Full method의 평균 detection error는 다음과 같이 보고됩니다.

| Evaluation type | Average detection error |
|---|---:|
| Object only | 1.3 ± 0.6 cm |
| Distractors | 1.8 ± 1.7 cm |
| Occlusions | 2.4 ± 3.0 cm |

논문은 전체적으로 object detector가 real world에서 평균적으로 약 1.5 cm 수준의 정확도를 얻었다고 정리합니다.

이 결과가 중요한 이유는 두 가지입니다.

첫째, model은 target-domain real robot image로 fine-tuning하지 않았습니다.

둘째, simulation texture는 realistic하지 않았습니다.

즉, 현실을 정밀하게 복사한 simulator가 아니라, 충분히 다양하게 randomized된 simulator에서 학습한 model이 real image로 넘어간 것입니다.

## **6. Ablation에서 중요한 부분**

이 논문에서 특히 볼 만한 부분은 ablation입니다. 어떤 randomization이 transfer에 중요한지 확인하기 때문입니다.

| Method | Object only | Distractors | Occlusions |
|---|---:|---:|---:|
| Full method | 1.3 ± 0.6 | 1.8 ± 1.7 | 2.4 ± 3.0 |
| No noise added | 1.4 ± 0.7 | 1.9 ± 2.0 | 2.4 ± 2.8 |
| No camera randomization | 2.0 ± 2.1 | 2.4 ± 2.3 | 2.9 ± 3.5 |
| No distractors in training | 1.5 ± 0.6 | 7.2 ± 4.5 | 7.4 ± 5.3 |

여기서 가장 눈에 띄는 것은 distractor입니다.

Training 때 distractor를 넣지 않으면, real test에서 distractor나 occlusion이 있을 때 error가 크게 증가합니다. 즉, model은 training 중에 본 variation에 대해서만 robust해집니다.

이 점이 중요합니다.

Domain randomization은 마법처럼 모든 현실 차이를 해결하는 방법이 아닙니다. Training distribution 안에 넣어준 variation에 대해 model이 버티는 것입니다.

정리하면 다음과 같습니다.

> Randomization은 많이 넣는 것이 아니라, real world에서 실제로 마주칠 variation을 빠뜨리지 않고 넣는 것이 중요하다.

## **7. Sim2Real 관점에서의 해석**

Tobin et al.의 domain randomization은 1편에서 본 noise 관점을 modern deep learning 방식으로 확장합니다.

Jakobi et al.에서는 simulation에 noise를 넣어 controller가 깨끗한 simulation에 overfit되지 않게 했습니다.

Tobin et al.에서는 simulation image의 visual domain을 크게 흔들어 detector가 simulation appearance에 overfit되지 않게 합니다.

두 논문의 공통점은 같습니다.

> 현실을 정확히 복제하기 어렵다면, 현실에서 생길 수 있는 variation을 simulation distribution 안에 넣어라.

하지만 차이도 있습니다.

| 관점 | Jakobi et al., 1995 | Tobin et al., 2017 |
|---|---|---|
| 주요 대상 | robot controller | deep visual detector |
| 문제 | simulation과 real behavior 차이 | simulated image와 real image 차이 |
| 방법 | sensor/motor noise | visual domain randomization |
| 핵심 목적 | fragile controller 방지 | appearance overfitting 방지 |
| transfer 방식 | evolved controller를 real robot에 적용 | simulated image로 학습한 detector를 real image에 적용 |

Tobin 논문에서 중요한 것은 visual feature 학습입니다.

Model이 object의 색이나 배경 texture 같은 쉬운 shortcut을 쓰면 real world에서 깨질 수 있습니다. 그래서 simulation에서 그런 shortcut을 계속 바꿔버립니다. 그러면 model은 더 안정적인 cue를 찾아야 합니다.

## **8. Go2 Sim2Real에서 가져갈 점**

이 논문을 Go2 locomotion에 그대로 적용하면 안 됩니다.

Tobin et al.의 논문은 visual domain randomization입니다. Go2 보행 policy transfer에서 핵심이 되는 actuator delay, motor strength, joint friction, contact, terrain, mass, inertia 같은 dynamics 문제를 직접 다룬 논문은 아닙니다.

하지만 Sim2Real 관점은 그대로 가져올 수 있습니다.

Go2에서 생각해야 할 질문은 다음과 같습니다.

1. Real robot에서 실제로 바뀌는 domain parameter가 무엇인가?
2. Policy가 그 variation에 invariant해야 하는가, 아니면 그 variation을 관측하고 대응해야 하는가?
3. Training distribution 안에 real deployment condition이 들어오는가?
4. Randomization이 task-relevant signal까지 망가뜨리고 있지는 않은가?
5. Simulation에서만 가능한 shortcut을 policy가 쓰고 있지는 않은가?

Visual domain randomization을 Go2에 적용할 수 있는 경우도 있습니다.

예를 들어 camera 기반 terrain perception, object following, marker detection, visual navigation을 한다면 lighting, texture, camera pose, motion blur, exposure, distractor, occlusion 같은 visual randomization이 중요합니다.

반대로 proprioception 기반 locomotion이라면 이 논문의 구체적인 randomization 축보다는 domain randomization의 사고방식을 dynamics 쪽으로 옮겨야 합니다.

| Tobin 논문의 visual randomization | Go2 locomotion에서 대응되는 생각 |
|---|---|
| texture randomization | terrain appearance 또는 material variation |
| camera pose randomization | sensor mounting / extrinsic uncertainty |
| lighting randomization | visual perception robustness |
| distractor object | irrelevant observation 제거 |
| image noise | sensor noise |
| domain distribution | dynamics parameter distribution |

핵심은 하나입니다.

> Real world가 training distribution 밖에 있으면 Sim2Real은 깨진다.

## **9. 이 논문의 한계**

이 논문은 Sim2Real에서 매우 중요한 출발점이지만, 모든 문제를 해결한 논문은 아닙니다.

한계는 분명합니다.

- Task가 object localization이라 locomotion dynamics를 다루지 않습니다.
- Geometric object 중심이라 real-world object complexity가 제한적입니다.
- Grasping은 detector와 motion planner를 연결한 구조이지, end-to-end manipulation policy transfer는 아닙니다.
- Contact-rich manipulation이나 legged locomotion처럼 dynamics가 중요한 문제는 별도의 randomization 축이 필요합니다.
- Randomization range를 어떻게 정해야 하는지는 여전히 hand-tuning에 가깝습니다.

그래도 이 논문은 Sim2Real에서 domain randomization이 왜 작동할 수 있는지 직관을 잘 줍니다.

Photorealistic simulator를 완벽하게 만들지 못해도, model이 simulation의 특정 appearance에 묶이지 않게 할 수 있습니다.

## **10. 정리하며: Visual Randomization에서 Dynamics Randomization으로**

이번 글에서는 Tobin et al.의 **Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World**를 정리했습니다.

- Domain randomization은 simulator를 하나의 고정된 world가 아니라 여러 world의 distribution으로 보는 방법입니다.
- 이 논문은 visual domain randomization의 대표적인 초기 논문입니다.
- 핵심 아이디어는 real world를 simulation variation 중 하나처럼 보이게 만드는 것입니다.
- Photorealistic rendering이 없어도, 충분히 다양한 simulated image로 real image transfer가 가능함을 보였습니다.
- 하지만 randomization은 넣은 variation에 대해서만 robustness를 줍니다.
- Go2 locomotion에서는 이 아이디어를 visual randomization 그대로가 아니라 dynamics randomization 관점으로 확장해서 읽어야 합니다.

1편의 질문이 이것이었다면,

> Simulation을 믿을 수 있는가?

2편의 답은 이렇게 정리할 수 있습니다.

> 하나의 simulation을 믿지 말고, 가능한 simulation들의 distribution을 학습에 사용하자.

다음 글에서는 이 domain randomization 아이디어가 vision이 아니라 robot control dynamics 쪽으로 어떻게 확장되는지 살펴보겠습니다.
