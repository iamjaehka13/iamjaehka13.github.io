---
title: "[Sim2Real Paper 2] Domain Randomization"
date: 2026-06-24 17:30:00 +0900
categories: [RL, Sim2Real, Paper]
tags: [sim2real, domain-randomization, visual-domain-randomization, robot-vision, object-localization]
description: Tobin et al.의 Domain Randomization 논문을 통해 real world를 simulation variation 중 하나로 보이게 만드는 Sim2Real 아이디어를 정리한다.
math: true
---

## **0. 전체 그림: 현실을 하나의 variation으로 만들기**

이전 글에서는 Jakobi et al.의 **Noise and The Reality Gap**을 통해 Sim2Real의 기본 문제를 봤습니다.

Simulation은 현실과 완전히 같을 수 없습니다. Sensor, actuator, contact, lighting, texture, camera, friction 같은 요소들이 조금씩 다르고, 그 차이가 쌓이면 simulation에서 잘 되던 policy나 model이 real world에서 깨질 수 있습니다.

Jakobi et al.이 말한 핵심은 simulation에 적절한 noise를 넣어 현실의 불확실성을 미리 경험시키자는 것이었습니다.

Tobin et al.의 **Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World**는 이 생각을 modern deep learning 기반 Sim2Real로 확장합니다.

핵심 문장은 이렇게 볼 수 있습니다.

> Real world를 simulation distribution 안의 하나의 sample처럼 보이게 만들자.

즉, simulator를 현실과 똑같이 만들려고만 하는 것이 아니라, simulator를 아주 다양하게 흔들어서 model이 특정 simulation appearance에 과적합되지 않도록 만드는 것입니다.

이 논문은 특히 **visual domain randomization**의 대표적인 초기 논문입니다. 여기서 randomization의 대상은 주로 texture, lighting, camera pose, distractor object, image noise 같은 시각 요소입니다.

## **1. 논문 정보**

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

## **2. 핵심 아이디어: Photorealism 대신 Randomization**

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

실험은 object localization입니다. Model은 single RGB image를 입력으로 받고, table 위에 있는 geometric object의 Cartesian coordinate를 예측합니다. 이후 이 object detector를 실제 robot grasping pipeline에 연결합니다.

Training data는 simulation에서 만듭니다. Simulator는 MuJoCo built-in renderer를 사용합니다. 이 renderer는 photorealistic rendering을 목표로 한 것이 아닙니다. 하지만 simulator에서는 object 위치 label을 정확히 알 수 있고, scene을 빠르게 많이 만들 수 있습니다.

각 training sample마다 scene의 appearance를 바꿉니다.

1. Object와 distractor의 위치를 바꿉니다.
2. Object, table, floor, skybox, robot texture를 바꿉니다.
3. Camera 위치, 방향, field of view를 바꿉니다.
4. Light 개수와 위치, 방향, specular 특성을 바꿉니다.
5. Image noise를 추가합니다.

Test는 real world image에서 합니다. 중요한 점은 target-domain real robot image로 model을 다시 학습하지 않는다는 것입니다.

즉, 이 논문의 실험은 다음 질문을 직접 확인합니다.

> Simulation variation을 충분히 크게 만들면, real image도 그 variation 안에 들어온 것처럼 처리될 수 있는가?

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

## **3. 핵심 아이디어의 이론적 원리**

이 논문의 이론적 핵심은 "simulation image를 다양하게 만들었다"가 아닙니다. 더 정확히 말하면, **real domain을 포함할 수 있을 만큼 넓은 synthetic domain distribution을 만들고, 그 distribution에서 유지되는 feature를 학습한다**는 것입니다.

### **3.1 Domain을 하나의 distribution으로 본다**

Supervised learning 관점에서 object localization model은 image $x$를 받아 object position $y$를 예측합니다.

$$
f_{\theta}: x \mapsto y
$$

일반적인 supervised learning은 training data와 test data가 같은 distribution에서 나온다고 가정합니다.

$$
(x, y) \sim p_{\mathrm{train}}(x, y)
$$

하지만 Sim2Real에서는 그렇지 않습니다.

Simulation에서 만든 image distribution과 real world image distribution이 다릅니다.

$$
p_{\mathrm{sim}}(x, y)
\neq
p_{\mathrm{real}}(x, y)
$$

이 차이가 visual reality gap입니다.

Domain randomization은 하나의 simulation distribution을 고정하지 않습니다. Simulator parameter $\phi$를 random하게 바꿔 여러 simulation domain을 만듭니다.

$$
\phi \sim p(\phi)
$$

그리고 각 parameter에서 image와 label을 생성합니다.

$$
(x, y) \sim p_{\mathrm{sim}}(x, y \mid \phi)
$$

그러면 training distribution은 하나의 domain이 아니라 여러 randomized simulation domain의 mixture가 됩니다.

$$
p_{\mathrm{DR}}(x, y)
=
\int p_{\mathrm{sim}}(x, y \mid \phi) p(\phi) d\phi
$$

이 논문의 핵심 가정은 다음입니다.

> $p_{\mathrm{DR}}$가 충분히 넓으면, real image distribution $p_{\mathrm{real}}$이 그 안의 하나의 domain처럼 들어올 수 있다.

즉 photorealism으로 $p_{\mathrm{sim}} \approx p_{\mathrm{real}}$을 만들려는 것이 아니라, randomized simulation distribution $p_{\mathrm{DR}}$가 real domain을 덮도록 만드는 접근입니다.

### **3.2 Photorealism과 Domain Randomization의 차이**

Photorealistic simulation은 simulation image를 real image와 최대한 비슷하게 만들려고 합니다.

```text
photorealism
-> make one simulator close to real world
```

Domain randomization은 방향이 다릅니다.

```text
domain randomization
-> make many simulated worlds
-> train model on broad visual variation
-> make real world look like one possible sample
```

두 접근은 서로 반대라기보다 다른 전략입니다.

| 접근 | 목표 | 위험 |
|---|---|---|
| photorealism | simulation을 real과 가깝게 만듦 | 놓친 visual detail에 취약 |
| domain randomization | real을 포함할 만큼 넓은 domain을 만듦 | range가 너무 넓으면 학습이 어려움 |

Domain randomization의 장점은 photorealistic renderer 없이도 시작할 수 있다는 점입니다. Simulator가 예쁘지 않아도, label을 자동으로 만들고 appearance를 다양하게 바꿀 수 있으면 training data를 많이 만들 수 있습니다.

### **3.3 Invariant feature를 학습하게 만든다**

Visual model이 object 위치를 맞추려면 image에서 어떤 feature를 사용해야 합니다.

Clean simulation에서 object가 항상 같은 색이고, table texture가 항상 같고, camera angle이 거의 고정되어 있다면 model은 쉬운 shortcut을 사용할 수 있습니다.

예를 들어 다음과 같은 cue에 과적합될 수 있습니다.

```text
specific object color
specific background texture
fixed camera viewpoint
fixed lighting direction
absence of distractors
```

이런 cue는 simulation에서는 잘 맞지만 real image에서는 쉽게 깨집니다.

Domain randomization은 이 shortcut을 계속 흔듭니다.

Object texture가 매번 바뀌면 색에 의존하기 어렵습니다. Camera pose가 바뀌면 특정 pixel 위치에만 의존하기 어렵습니다. Distractor가 들어오면 object와 background를 더 구분해야 합니다.

결국 model은 domain마다 바뀌는 feature보다, object localization에 더 안정적으로 필요한 feature를 학습하도록 압박받습니다.

이 관점에서 domain randomization은 다음 목표를 갖습니다.

$$
\text{learn features useful for } y
\text{ and invariant to } \phi
$$

여기서 $\phi$는 texture, lighting, camera pose, distractor 같은 nuisance factor입니다.

즉 model이 학습해야 하는 것은 다음 관계입니다.

```text
task-relevant signal: object geometry / position
nuisance variation: texture / lighting / camera / distractor
```

Randomization은 nuisance variation을 일부러 크게 만들어, model이 task-relevant signal을 찾게 합니다.

### **3.4 Coverage가 부족하면 transfer는 깨진다**

Domain randomization은 real world를 자동으로 해결하는 방법이 아닙니다.

Training distribution에 들어간 variation에 대해서만 robustness가 생깁니다.

논문의 ablation이 이 점을 잘 보여줍니다.

| Method | Object only | Distractors | Occlusions |
|---|---:|---:|---:|
| Full method | 1.3 ± 0.6 | 1.8 ± 1.7 | 2.4 ± 3.0 |
| No noise added | 1.4 ± 0.7 | 1.9 ± 2.0 | 2.4 ± 2.8 |
| No camera randomization | 2.0 ± 2.1 | 2.4 ± 2.3 | 2.9 ± 3.5 |
| No distractors in training | 1.5 ± 0.6 | 7.2 ± 4.5 | 7.4 ± 5.3 |

여기서 가장 눈에 띄는 것은 distractor입니다.

Training 때 distractor를 넣지 않으면, real test에서 distractor나 occlusion이 있을 때 error가 크게 증가합니다. 즉 model은 training 중에 본 variation에 대해서만 robust해집니다.

이것은 domain randomization의 coverage 문제입니다.

```text
real variation included in training distribution
-> model can become robust to it

real variation missing from training distribution
-> model may fail on that axis
```

따라서 domain randomization에서 중요한 것은 randomization을 많이 넣는 것이 아니라, real deployment에서 실제로 만날 variation을 빠뜨리지 않는 것입니다.

### **3.5 Randomization range가 너무 넓어도 문제다**

Randomization range가 좁으면 real domain을 덮지 못합니다.

하지만 너무 넓어도 문제가 생깁니다.

Texture, lighting, camera, noise가 너무 강하게 흔들리면 image 안의 task-relevant signal까지 약해질 수 있습니다. Model은 object position을 학습하기보다, 너무 다양한 appearance를 평균적으로 버티는 데 capacity를 쓸 수 있습니다.

즉 domain randomization에는 trade-off가 있습니다.

```text
too narrow
-> real world outside training support
-> transfer failure

too broad
-> task signal becomes hard to learn
-> lower sample efficiency or conservative model
```

그래서 domain randomization은 "크게 흔들면 된다"가 아니라, **real world를 덮으면서 task structure는 유지하는 distribution을 설계하는 문제**입니다.

## **4. Sim2Real 관점에서의 해석**

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

이 관점은 visual perception뿐 아니라 넓은 Sim2Real 문제로 확장됩니다.

| Visual domain randomization | 더 일반적인 Sim2Real 의미 |
|---|---|
| texture randomization | surface appearance / material variation |
| camera pose randomization | sensor calibration / extrinsic uncertainty |
| lighting randomization | environment condition variation |
| distractor object | irrelevant observation 제거 |
| image noise | sensor noise |
| domain distribution | deployment condition distribution |

핵심은 하나입니다.

> Real world가 training distribution 밖에 있으면 Sim2Real은 깨진다.

따라서 Sim2Real에서 domain randomization은 단순한 augmentation이 아닙니다. Real deployment condition을 training distribution 안에 넣으려는 방법입니다.

## **5. 이 논문의 한계**

이 논문은 Sim2Real에서 매우 중요한 출발점이지만, 모든 문제를 해결한 논문은 아닙니다.

첫째, task가 object localization입니다.

이 논문은 visual detector의 Sim2Real transfer를 다룹니다. Contact-rich manipulation, legged locomotion, closed-loop control dynamics를 직접 다루지는 않습니다.

둘째, geometric object 중심입니다.

실험 대상은 비교적 단순한 geometric object입니다. Real-world object category가 복잡해지거나, deformable object, transparent object, cluttered scene으로 가면 추가적인 문제가 생길 수 있습니다.

셋째, grasping은 end-to-end policy transfer가 아닙니다.

논문에서는 detector를 실제 robot grasping pipeline에 연결합니다. 하지만 simulation에서 학습한 end-to-end manipulation policy를 그대로 real robot에 올리는 문제와는 다릅니다.

넷째, dynamics gap은 다루지 않습니다.

이 논문의 randomization은 visual appearance 중심입니다. Robot control에서 중요한 mass, friction, actuator delay, contact, controller gain 같은 dynamics parameter는 다음 글에서 볼 dynamics randomization 쪽에 더 가깝습니다.

다섯째, randomization distribution은 사람이 설계합니다.

어떤 parameter를 얼마나 흔들어야 real domain을 잘 덮는지 자동으로 알려주지는 않습니다. 결국 domain randomization은 여전히 task와 deployment condition을 이해하고 설계해야 하는 부분이 큽니다.

그래도 이 논문은 Sim2Real에서 domain randomization이 왜 작동할 수 있는지 직관을 잘 줍니다.

Photorealistic simulator를 완벽하게 만들지 못해도, model이 simulation의 특정 appearance에 묶이지 않게 할 수 있습니다.

## **6. 정리하며: Visual Randomization에서 Dynamics Randomization으로**

이번 글에서는 Tobin et al.의 **Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World**를 정리했습니다.

- Domain randomization은 simulator를 하나의 고정된 world가 아니라 여러 world의 distribution으로 보는 방법입니다.
- 이 논문은 visual domain randomization의 대표적인 초기 논문입니다.
- 핵심 아이디어는 real world를 simulation variation 중 하나처럼 보이게 만드는 것입니다.
- 이론적으로는 randomized simulation domains의 mixture distribution을 만들고, 그 안에서 domain-invariant feature를 학습하는 것으로 볼 수 있습니다.
- Photorealistic rendering이 없어도, 충분히 다양한 simulated image로 real image transfer가 가능함을 보였습니다.
- 하지만 randomization은 넣은 variation에 대해서만 robustness를 줍니다.
- Randomization range는 real domain을 덮을 만큼 넓어야 하지만, task-relevant signal을 망가뜨릴 만큼 넓어서는 안 됩니다.

1편의 질문이 이것이었다면,

> Simulation을 믿을 수 있는가?

2편의 답은 이렇게 정리할 수 있습니다.

> 하나의 simulation을 믿지 말고, 가능한 simulation들의 distribution을 학습에 사용하자.

다음 글에서는 이 domain randomization 아이디어가 vision이 아니라 robot control dynamics 쪽으로 어떻게 확장되는지 살펴보겠습니다.
