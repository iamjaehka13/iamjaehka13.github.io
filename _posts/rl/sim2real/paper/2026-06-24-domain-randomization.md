---
title: "[Sim2Real Paper 2] Domain Randomization"
date: 2026-06-24 17:30:00 +0900
last_modified_at: 2026-07-27 21:16:00 +0900
categories: [RL, Sim2Real, Paper]
tags: [sim2real, domain-randomization, visual-domain-randomization, robot-vision, object-localization, fetch-robot, synthetic-data]
description: Tobin et al.의 visual domain randomization을 random texture, camera·lighting variation, VGG detector, real-image localization ablation과 Fetch grasping 결과까지 원문 기준으로 정리한다.
math: true
image:
  path: /assets/img/posts/rl/sim2real/domain-randomization/00-preview.png
  alt: 비현실적으로 randomize한 simulation training image와 실제 tabletop test image
---

## **0. 전체 그림: 현실을 하나의 variation으로 만들기**

이전 글인 **[Noise and The Reality Gap](/posts/noise-and-the-reality-gap/)**에서는 sensor·motor variation을 simulation에 넣어 controller의 과적합을 줄이는 관점을 봤다. Tobin et al.의 **Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World**는 같은 문제를 visual perception으로 옮긴다.

> Real world를 simulation distribution 안의 하나의 sample처럼 보이게 만들자.

핵심: texture, lighting, camera pose, distractor, image noise를 계속 바꿔 특정 simulation appearance에 기대지 못하게 만들기.

Target-domain real image를 training에 사용하지 않았는데도 geometric object를 평균 약 1.5 cm 오차로 찾았다. 이 수치만 보는 것보다 어떤 variation이 transfer를 만들었는지 보는 편이 중요하다. Randomization은 realism을 높이기보다 task와 무관한 visual cue를 불안정하게 만들었고, training에서 distractor를 빼자 clutter 성능이 크게 무너졌다.

![Randomized simulation training image와 실제 test image](/assets/img/posts/rl/sim2real/domain-randomization/01-training-vs-real.png){: width="1150" .d-block .mx-auto }
_왼쪽의 비현실적인 simulation image만으로 detector를 학습한 뒤, 오른쪽 실제 webcam image에 추가 학습 없이 적용한다. 출처: [Tobin et al., Figure 1](https://arxiv.org/pdf/1703.06907)._

이 그림에서는 simulation 한 장이 현실과 얼마나 닮았는지보다 training image끼리의 차이를 봐야 한다. 색, 조명, camera와 object 구성이 계속 바뀌면서 **공통으로 남는 shape와 spatial cue**만 비교적 안정적인 단서가 된다.

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
| Transfer setting | target-domain real image를 training에 사용하지 않는 zero-shot sim-to-real |
| Source | [arXiv](https://arxiv.org/abs/1703.06907), [PDF](https://arxiv.org/pdf/1703.06907), [IEEE DOI](https://doi.org/10.1109/IROS.2017.8202133) |

이 논문은 quadruped locomotion 논문은 아니다. Dynamics randomization 논문도 아니다.

하지만 Sim2Real에서 domain randomization이라는 말을 이해하려면 이 논문이 중요하다. 이유는 간단하다. 이 논문이 말하는 관점이 이후 Sim2Real의 기본 문장처럼 쓰이기 때문이다.

> Simulator를 하나의 고정된 world로 두지 말고, 가능한 여러 world의 distribution으로 보자.

## **2. Photorealism 대신 Randomization**

로봇이 vision을 사용하려면 image에서 필요한 정보를 뽑아야 한다. 예를 들어 table 위에 있는 object의 위치를 찾아야 grasping을 할 수 있다.

문제는 real image label을 많이 모으기 어렵다는 점.

- 실제 로봇으로 데이터를 모으는 것은 느리다.
- Object 위치를 정확히 labeling하는 것은 비용이 크다.
- 조명, 배경, camera 위치, object texture가 바뀌면 image distribution이 쉽게 달라진다.
- Photorealistic simulator를 만드는 것도 어렵고, 충분히 현실적인 rendering을 얻는 것도 쉽지 않다.

반면 simulation에서는 label을 자동으로 얻을 수 있다. Object의 position, segmentation, depth, camera pose 같은 정보는 simulator 안에서 정확히 알고 있기 때문이다.

하지만 simulation image와 real image는 다르다.

여기서 생기는 질문은 다음과 같다:

> Photorealistic simulation 없이도, simulation image만으로 real image에서 동작하는 model을 만들 수 있을까?

Tobin et al.의 답은 domain randomization.

> **Domain Randomization**이란?
>
> Training 중 simulator의 여러 parameter를 random하게 바꿔서, model이 특정 simulation domain에 과적합되지 않고 다양한 domain에서 유지되는 feature를 학습하도록 만드는 방법.

이 논문에서는 주로 visual domain을 randomize한다.

| Randomization 대상 | 의미 |
|---|---|
| object texture | object 색과 pattern을 계속 바꿈 |
| table / floor / skybox texture | 배경과 주변 appearance를 계속 바꿈 |
| camera pose / FOV | camera 위치, 방향, 시야각을 바꿈 |
| light | 조명 개수, 위치, 방향, specular property를 바꿈 |
| distractor object | 관심 없는 물체를 scene에 추가함 |
| image noise | image에 noise를 추가함 |

![Domain randomization으로 생성한 여러 training scene](/assets/img/posts/rl/sim2real/domain-randomization/02-randomized-scenes.png){: width="900" .d-block .mx-auto }
_같은 task label을 유지하면서 texture, lighting, camera, target 위치와 distractor 구성을 바꾼 training scene 일부. 출처: [Tobin et al., supplementary figure source](https://arxiv.org/abs/1703.06907)._

Texture는 realistic할 필요가 없다.

논문에서는 random RGB color, random gradient, checker pattern 같은 단순하고 비현실적인 texture도 사용한다. 목적은 예쁜 simulation image가 아니다. Texture나 lighting 같은 우연한 visual cue에 대한 의존 차단.

논문에서 사용한 randomization 범위를 실제 값으로 풀어 쓰면 아래와 같다.

| 요소 | 논문의 구체적인 설정 |
|---|---|
| Distractor | table 위에 0-10개, 개수와 shape를 sample마다 변경 |
| Texture | random RGB, 두 RGB 사이 gradient, 두 RGB checker pattern 중 선택 |
| Camera position | 대략 맞춘 nominal 위치 주변 $10\times5\times10$ cm box |
| Camera direction | table의 고정점을 향하게 한 뒤 각 방향으로 최대 0.1 rad offset |
| Field of view | nominal 값에서 최대 5% scale 변화 |
| Lighting | light 개수, 위치, 방향, specular property 변경 |
| Image corruption | noise type과 양 변경 |

따라서 "camera calibration이 필요 없다"는 표현도 조심해야 한다. 저자들은 실제 camera와 **대략 비슷한 viewpoint와 FOV를 simulation에 먼저 배치**한 뒤 그 주변을 randomize했다. 정밀한 extrinsic calibration은 피했지만, camera가 전혀 다른 위치에 있어도 된다는 뜻은 아니다.

실험은 object localization. Model은 single RGB image를 입력으로 받고, table 위에 있는 geometric object의 Cartesian coordinate를 예측한다. 이후 이 object detector를 실제 robot grasping pipeline에 연결한다.

Training data는 simulation에서 만든다. Simulator는 MuJoCo built-in renderer를 사용한다. 이 renderer는 photorealistic rendering을 목표로 한 것이 아니다. 하지만 simulator에서는 object 위치 label을 정확히 알 수 있고, scene을 빠르게 많이 만들 수 있다.

각 training sample마다 scene의 appearance를 바꾼다.

1. Object와 distractor의 위치를 바꾼다.
2. Object, table, floor, skybox, robot texture를 바꾼다.
3. Camera 위치, 방향, field of view를 바꾼다.
4. Light 개수와 위치, 방향, specular 특성을 바꾼다.
5. Image noise를 추가한다.

Test는 real world image에서 수행하며, target-domain real robot image로 model을 다시 학습하지 않는다.

### **2.1 Detector는 무엇을 입력받고 무엇을 출력하는가?**

![Domain-randomized object detector architecture](/assets/img/posts/rl/sim2real/domain-randomization/03-model-architecture.png){: width="1200" .d-block .mx-auto }
_224×224 monocular RGB image를 modified VGG-16에 넣고 object center의 $(x,y,z)$를 회귀한다. 출처: [Tobin et al., Figure 2](https://arxiv.org/pdf/1703.06907)._

Network는 VGG-16의 convolutional stack을 사용하되 fully connected layer를 256, 64 units로 줄이고 dropout을 제거했다. ReLU와 max pooling을 거친 뒤 object별 Cartesian center coordinate를 출력한다.

여기서 `sim-only`의 의미를 정확히 구분해야 한다. 대부분의 주 실험은 ImageNet-pretrained convolution weight로 초기화했으므로 모든 weight가 synthetic data만 본 것은 아니다. 다만 target tabletop image와 position label은 training에 쓰지 않았고, scratch ablation에서도 synthetic data가 충분하면 비슷한 real 성능을 얻었다. 따라서 핵심 주장은 **target-domain supervision 없이 transfer했다**는 데 있다.

$$
d_\theta(I)
=
\left\{(\hat x_i,\hat y_i,\hat z_i)\right\}_{i=1}^{N_{\mathrm{target}}}
$$

Training label은 simulator가 알고 있는 object center of mass의 world coordinate이며, loss는 L2 regression이다.

$$
\mathcal{L}(\theta)
=
\sum_i
\left\|
d_\theta(I)_i-y_i
\right\|_2^2
$$

Optimizer는 Adam, learning rate 후보는 $10^{-4}$와 $2\times10^{-4}$, batch size 후보는 25·50·100이었다. 저자들은 기본 Adam learning rate $10^{-3}$보다 작은 값이 모든 object를 table 중앙으로 예측하는 local optimum을 피하는 데 도움이 됐다고 보고한다.

Monocular camera인데도 $(x,y,z)$를 출력할 수 있었던 중요한 조건이 있다. **Table height를 고정**했기 때문에 실제 문제는 tabletop 평면 위의 2D localization에 가깝다. 임의의 3D 공간에서 full 6-DoF pose를 추정한 것이 아니다.

### **2.2 Real test set은 training data가 아니다**

즉, 이 논문의 실험은 다음 질문을 직접 확인한다.

> Simulation variation을 충분히 크게 만들면, real image도 그 variation 안에 들어온 것처럼 처리될 수 있는가?

논문은 real webcam image 480장을 사용해 평가한다. 8개의 geometric object가 있고, 각 object마다 60장의 labeled image가 있다.

평가 조건은 세 가지.

| 조건 | 의미 |
|---|---|
| Object only | table 위에 목표 object만 있음 |
| Distractors | 목표 object 외에 다른 object도 있음 |
| Occlusions | 목표 object가 부분적으로 가려짐 |

각 object의 60장은 object-only 20장, distractor 20장, partial-occlusion 20장으로 구성된다. Object는 camera에서 70-105 cm 떨어져 있었고 camera position은 real test image 전체에서 고정했다. Real label은 tabletop grid에 object를 맞춰 얻었다.

이 480장은 **최종 evaluation용**이다. Model weight를 update하거나 fine-tuning하는 데 사용하지 않았다. 다만 연구자가 real test 결과를 보며 method와 hyperparameter를 연구한 이상, 엄밀한 의미의 완전히 보이지 않은 future deployment까지 보장하는 것은 아니다.

Full method의 평균 detection error는 다음과 같이 보고된다.

| Evaluation type | Average detection error |
|---|---:|
| Object only | 1.3 ± 0.6 cm |
| Distractors | 1.8 ± 1.7 cm |
| Occlusions | 2.4 ± 3.0 cm |

논문은 전체적으로 object detector가 real world에서 평균적으로 약 1.5 cm 수준의 정확도를 얻었다고 정리한다.

Simulation holdout error는 약 0.3-0.5 cm였으므로 real error 1.5 cm와 여전히 차이가 있다. 즉 domain randomization이 reality gap을 제거한 것이 아니라 **robot grasping에 사용할 만큼 줄인 것**.

이 결과가 중요한 이유는 두 가지.

첫째, model은 target-domain real robot image로 fine-tuning하지 않았다.

둘째, simulation texture는 realistic하지 않았다.

즉 현실을 정밀하게 복사한 simulator가 아니라, 충분히 다양하게 randomized된 simulator에서 학습한 model이 real image로 넘어갔다.

### **2.3 Detector에서 실제 grasping까지**

![Fetch robot의 geometric-object와 Spam grasping](/assets/img/posts/rl/sim2real/domain-randomization/06-fetch-grasping.png){: width="1200" .d-block .mx-auto }
_위는 geometric object, 아래는 YCB Spam can을 clutter 속에서 찾고 집는 과정이다. 출처: [Tobin et al., Figure 6](https://arxiv.org/pdf/1703.06907)._

Detector가 실제 control에 충분한지 확인하기 위해 Fetch robot과 off-the-shelf motion planner를 연결했다.

| Grasping setting | 결과 |
|---|---:|
| 정확도가 안정적이었던 geometric-object detector 2개, 각 20회 | **38/40 성공** |
| YCB Spam can, unseen food-item distractor | **9/10 성공** |

몇몇 geometric distractor는 training에서 보지 못한 orientation으로 놓였고, target과 같은 색의 object가 가까이 있어도 detector가 동작했다. Spam 실험에서는 training distractor가 geometric shape였지만 real test distractor는 다른 food item이었다.

그러나 이것은 simulation에서 학습한 **end-to-end grasping policy transfer**가 아니다.

| Pipeline 단계 | 역할 |
|---|---|
| Sim-only visual detector | RGB image에서 target Cartesian position을 예측 |
| 기존 motion planner | 예측된 위치까지 robot arm trajectory를 생성 |
| 미리 정한 grasp routine | geometric object 또는 Spam can을 집음 |

논문이 증명한 것: randomized RGB로 학습한 localization network가 real manipulation pipeline에 쓸 만큼 정확했다는 점. Contact-rich manipulation dynamics까지 simulation에서 real로 이전한 것은 아니다.

## **3. Distribution 관점에서 본 원리**

단순히 simulation image 수를 늘리는 것만으로는 설명이 부족하다. **Real domain을 포함할 만큼 넓은 synthetic domain distribution을 만들고, 그 안에서 유지되는 feature를 학습한다**는 관점이 필요하다.

### **3.1 Domain을 하나의 distribution으로 본다**

Supervised learning 관점에서 object localization model은 image $x$를 받아 object position $y$를 예측한다.

$$
f_{\theta}: x \mapsto y
$$

일반적인 supervised learning은 training data와 test data가 같은 distribution에서 나온다고 가정한다.

$$
(x, y) \sim p_{\mathrm{train}}(x, y)
$$

하지만 Sim2Real에서는 그렇지 않는다.

Simulation에서 만든 image distribution과 real world image distribution이 다르다.

$$
p_{\mathrm{sim}}(x, y)
\neq
p_{\mathrm{real}}(x, y)
$$

이 차이가 visual reality gap.

Domain randomization은 하나의 simulation distribution을 고정하지 않는다. Simulator parameter $\phi$를 random하게 바꿔 여러 simulation domain을 만든다.

$$
\phi \sim p(\phi)
$$

그리고 각 parameter에서 image와 label을 생성한다.

$$
(x, y) \sim p_{\mathrm{sim}}(x, y \mid \phi)
$$

그러면 training distribution은 하나의 domain이 아니라 여러 randomized simulation domain의 mixture가 된다.

$$
p_{\mathrm{DR}}(x, y)
=
\int p_{\mathrm{sim}}(x, y \mid \phi) p(\phi) d\phi
$$

이 논문의 핵심 가정은 다음과 같다:

> $p_{\mathrm{DR}}$가 충분히 넓으면, real image distribution $p_{\mathrm{real}}$이 그 안의 하나의 domain처럼 들어올 수 있다.

즉 photorealism으로 $p_{\mathrm{sim}} \approx p_{\mathrm{real}}$을 만들려는 것이 아니라, randomized simulation distribution $p_{\mathrm{DR}}$가 real domain을 덮도록 만드는 접근.

이것은 논문의 작동 직관이지, finite sample과 finite network에서 성립하는 정리나 coverage 보장은 아니다. 어떤 nuisance axis를 빠뜨렸는지 real data 없이 완전히 확인하기도 어렵다.

### **3.2 Photorealism과 Domain Randomization의 차이**

Photorealistic simulation과 domain randomization은 서로 반대라기보다, reality gap을 줄이는 서로 다른 전략이다.

| 접근 | Training distribution을 만드는 방식 | 주요 위험 |
|---|---|---|
| Photorealism | 하나의 simulator를 real domain에 가깝게 맞춤 | 모델링하지 못한 visual detail에 취약 |
| Domain randomization | 서로 다른 appearance를 가진 simulated domain을 많이 생성 | range가 너무 넓거나 task signal까지 훼손할 수 있음 |

Domain randomization의 장점은 photorealistic renderer 없이도 시작할 수 있다는 점. Simulator가 예쁘지 않아도, label을 자동으로 만들고 appearance를 다양하게 바꿀 수 있으면 training data를 많이 만들 수 있다.

### **3.3 Invariant feature를 학습하게 만든다**

Visual model이 object 위치를 맞추려면 image에서 어떤 feature를 사용해야 한다.

Clean simulation에서 object가 항상 같은 색이고, table texture가 항상 같고, camera angle이 거의 고정되어 있다면 model은 쉬운 shortcut을 사용할 수 있다.

예를 들어 specific object color, background texture, 고정된 camera viewpoint와 lighting direction, distractor가 없다는 사실에 과적합될 수 있다.

이런 cue는 simulation에서는 잘 맞지만 real image에서는 쉽게 깨진다.

Domain randomization은 이 shortcut을 계속 흔든다.

Object texture가 매번 바뀌면 색에 의존하기 어렵다. Camera pose가 바뀌면 특정 pixel 위치에만 의존하기 어렵다. Distractor가 들어오면 object와 background를 더 구분해야 한다.

결국 model은 domain마다 바뀌는 feature보다, object localization에 더 안정적으로 필요한 feature를 학습하도록 압박받는다.

이 관점에서 domain randomization은 다음 목표를 갖는다.

$$
\text{learn features useful for } y
\text{ and invariant to } \phi
$$

여기서 $\phi$는 texture, lighting, camera pose, distractor 같은 nuisance factor이다.

| 구분 | 이 논문에서의 예 |
|---|---|
| Task-relevant signal | object geometry와 tabletop position |
| Nuisance variation | texture, lighting, camera pose, distractor |

Randomization은 nuisance variation을 일부러 크게 만들어, model이 task-relevant signal을 찾게 한다.

### **3.4 Coverage가 부족하면 transfer는 깨진다**

Domain randomization은 real world를 자동으로 해결하는 방법이 아니다.

Training distribution에 들어간 variation에 대해서만 robustness가 생긴다.

이 coverage 문제는 ablation에서 직접 드러난다.

![Training sample 수와 real-image error](/assets/img/posts/rl/sim2real/domain-randomization/04-training-samples-ablation.png){: width="1100" .d-block .mx-auto }
_ImageNet-pretrained model은 적은 data에서 유리하지만, synthetic sample이 충분해지면 scratch model도 비슷한 real error에 도달한다. 성능은 약 50,000 samples까지 개선됐다. 출처: [Tobin et al., Figure 4](https://arxiv.org/pdf/1703.06907)._

이 결과는 두 가지를 분리해서 읽어야 한다.

- Pretraining은 적은 synthetic data에서 sample efficiency를 높였다.
- 충분한 randomized data에서는 random initialization도 비슷한 transfer 성능을 냈으며, object에 따라 scratch model이 가장 좋기도 했다.

즉 ImageNet feature가 transfer의 필수조건은 아니었지만, data가 적을 때는 분명한 이점이 있었다.

![Unique texture 수와 real-image error](/assets/img/posts/rl/sim2real/domain-randomization/05-texture-ablation.png){: width="1100" .d-block .mx-auto }
_10,000 training images를 고정하고 unique texturization 수만 바꾼 결과. 1,000개 미만에서 real error가 크게 증가했다. 출처: [Tobin et al., Figure 5](https://arxiv.org/pdf/1703.06907)._

특히 low-data regime에서는 object position 조합을 늘리는 것보다 texture diversity를 확보하는 편이 더 중요했다. 이는 단순히 image 수만 세면 synthetic dataset의 실제 다양성을 과대평가할 수 있음을 보여준다.

| Method | Object only | Distractors | Occlusions |
|---|---:|---:|---:|
| Full method | 1.3 ± 0.6 | 1.8 ± 1.7 | 2.4 ± 3.0 |
| No noise added | 1.4 ± 0.7 | 1.9 ± 2.0 | 2.4 ± 2.8 |
| No camera randomization | 2.0 ± 2.1 | 2.4 ± 2.3 | 2.9 ± 3.5 |
| No distractors in training | 1.5 ± 0.6 | 7.2 ± 4.5 | 7.4 ± 5.3 |

여기서 가장 눈에 띄는 것은 distractor.

Training 때 distractor를 넣지 않으면, real test에서 distractor나 occlusion이 있을 때 error가 크게 증가한다. 즉 model은 training 중에 본 variation에 대해서만 robust해진다.

반면 image noise를 제거한 결과는 full method와 거의 같았다. 이 실험에서는 모든 randomization axis가 똑같이 중요하지 않았다.

| 제거한 요소 | Real test에서 관찰된 변화 |
|---|---|
| Image noise | full method와 거의 차이 없음 |
| Camera randomization | 세 평가 조건에서 일관되게 소폭 악화 |
| Training distractor | clutter와 occlusion error가 약 4배로 증가 |

이것은 domain randomization의 coverage 문제이다. Real variation이 training distribution에 포함되면 그 축에 대한 robustness를 배울 기회가 생기지만, 빠진 variation에 대해서는 보장이 없다.

따라서 domain randomization에서 중요한 것은 randomization의 양이 아니다. Real deployment에서 마주칠 variation을 빠뜨리지 않는 것.

### **3.5 Randomization range가 너무 넓어도 문제다**

Randomization range가 좁으면 real domain을 덮지 못한다.

하지만 너무 넓어도 문제가 생긴다.

Texture, lighting, camera, noise가 너무 강하게 흔들리면 image 안의 task-relevant signal까지 약해질 수 있다. Model은 object position을 학습하기보다, 너무 다양한 appearance를 평균적으로 버티는 데 capacity를 쓸 수 있다.

즉 domain randomization에는 trade-off가 있다.

| Randomization range | Training에서 생기는 일 | 예상되는 문제 |
|---|---|---|
| 너무 좁음 | simulation appearance가 제한됨 | real domain이 training support 밖에 남음 |
| Deployment variation과 비슷함 | nuisance cue가 흔들리고 task cue는 유지됨 | 유효한 invariant feature를 배울 가능성이 커짐 |
| 너무 넓음 | task-relevant signal까지 불안정해짐 | sample efficiency와 localization accuracy가 떨어질 수 있음 |

그래서 domain randomization은 "크게 흔들면 된다"가 아니라, **real world를 덮으면서 task structure는 유지하는 distribution을 설계하는 문제**.

## **4. Sim2Real 관점에서의 해석**

Tobin et al.의 domain randomization은 1편에서 본 noise 관점을 modern deep learning 방식으로 확장한다.

Jakobi et al.에서는 simulation에 noise를 넣어 controller가 깨끗한 simulation에 overfit되지 않게 했다.

Tobin et al.에서는 simulation image의 visual domain을 크게 흔들어 detector가 simulation appearance에 overfit되지 않게 한다.

두 논문의 공통점은 같다.

> 현실을 정확히 복제하기 어렵다면, 현실에서 생길 수 있는 variation을 simulation distribution 안에 넣어라.

하지만 차이도 있다.

| 관점 | Jakobi et al., 1995 | Tobin et al., 2017 |
|---|---|---|
| 주요 대상 | robot controller | deep visual detector |
| 문제 | simulation과 real behavior 차이 | simulated image와 real image 차이 |
| 방법 | sensor/motor noise | visual domain randomization |
| 핵심 목적 | fragile controller 방지 | appearance overfitting 방지 |
| transfer 방식 | evolved controller를 real robot에 적용 | simulated image로 학습한 detector를 real image에 적용 |

Tobin 논문에서 중요한 것은 visual feature 학습이다.

Model이 object의 색이나 배경 texture 같은 쉬운 shortcut을 쓰면 real world에서 깨질 수 있다. 그래서 simulation에서 그런 shortcut을 계속 바꿔버린다. 그러면 model은 더 안정적인 cue를 찾아야 한다.

이 관점은 visual perception뿐 아니라 넓은 Sim2Real 문제로 확장된다.

| Visual domain randomization | 더 일반적인 Sim2Real 의미 |
|---|---|
| texture randomization | surface appearance / material variation |
| camera pose randomization | sensor calibration / extrinsic uncertainty |
| lighting randomization | environment condition variation |
| distractor object | irrelevant observation 제거 |
| image noise | sensor noise |
| domain distribution | deployment condition distribution |

> Real world가 training distribution 밖에 있으면 Sim2Real은 깨진다.

따라서 Sim2Real에서 domain randomization은 단순한 augmentation이 아니다. Real deployment condition을 training distribution 안에 넣으려는 방법.

## **5. 이 논문의 한계**

이 논문은 Sim2Real에서 매우 중요한 출발점이지만, 모든 문제를 해결한 논문은 아니다.

첫째, task가 object localization이다.

이 논문은 visual detector의 Sim2Real transfer를 다룬다. Contact-rich manipulation, legged locomotion, closed-loop control dynamics를 직접 다루지는 않다.

둘째, geometric object 중심.

실험 대상은 비교적 단순한 geometric object이다. Real-world object category가 복잡해지거나, deformable object, transparent object, cluttered scene으로 가면 추가적인 문제가 생길 수 있다.

셋째, full pose estimation이 아니다.

Table height가 고정된 monocular image에서 object center translation을 예측한다. Arbitrary 3D 위치, orientation을 포함한 6-DoF pose, moving camera를 다루지 않는다. Real evaluation에서도 camera는 고정돼 있었다.

넷째, grasping은 end-to-end policy transfer가 아니다.

논문에서는 detector를 실제 robot grasping pipeline에 연결한다. 하지만 simulation에서 학습한 end-to-end manipulation policy를 그대로 real robot에 올리는 문제와는 다르다.

다섯째, dynamics gap은 다루지 않는다.

이 논문의 randomization은 visual appearance 중심. Robot control에서 중요한 mass, friction, actuator delay, contact, controller gain 같은 dynamics parameter는 다음 글에서 볼 dynamics randomization 쪽에 더 가깝다.

여섯째, randomization distribution은 사람이 설계한다.

어떤 parameter를 얼마나 흔들어야 real domain을 잘 덮는지 자동으로 알려주지는 않다. 결국 domain randomization은 여전히 task와 deployment condition을 이해하고 설계해야 하는 부분이 크다.

일곱째, 평균 1.5 cm가 모든 case에 동일한 것은 아니다.

Object와 조건에 따라 variance가 컸고, tetrahedron의 occlusion처럼 outlier가 큰 경우도 있었다. Simulation error 0.3-0.5 cm보다 real error가 높았기 때문에 visual gap도 남아 있었다.

그래도 이 논문은 Sim2Real에서 domain randomization이 왜 작동할 수 있는지 직관을 잘 준다.

Photorealistic simulator를 완벽하게 만들지 못해도, model이 simulation의 특정 appearance에 묶이지 않게 할 수 있다.

## **6. Visual Randomization에서 Dynamics Randomization으로**

Tobin et al.은 simulator를 하나의 고정된 world가 아니라 **simulated domain의 distribution**으로 다뤘다. Photorealistic rendering이나 target-domain fine-tuning 없이 real-image localization이 가능했고, detector를 기존 manipulation pipeline에 연결해 geometric object 38/40회, Spam can 9/10회 grasp에 성공했다. 다만 이것은 end-to-end contact policy transfer 결과가 아니다.

Ablation에서는 texture diversity와 distractor coverage가 중요했고 image noise의 영향은 작았다. 모든 randomization axis가 같은 가치가 있는 것은 아니며, range와 axis는 deployment condition에 대한 가설로 두고 검증해야 한다. 1편이 simulation의 오차를 어디까지 모델링할지 물었다면, 이 논문은 visual gap에 대해 아래처럼 답한다.

> 하나의 simulation을 믿지 말고, real world가 그 안의 한 variation처럼 보일 수 있는 distribution을 학습에 사용하자.

다음 글인 **[Dynamics Randomization](/posts/sim-to-real-transfer-dynamics-randomization/)**에서는 appearance가 아니라 mass, friction, damping, timing처럼 robot의 transition을 바꾸는 parameter를 다룬다.

## **참고 자료**

- [Tobin et al., arXiv paper and source](https://arxiv.org/abs/1703.06907)
- [IEEE IROS 2017 publication](https://doi.org/10.1109/IROS.2017.8202133)
- [DBLP bibliographic record](https://dblp.org/rec/conf/iros/TobinFRSZA17)
