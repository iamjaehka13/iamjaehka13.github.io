---
layout: post
title: "[AI Paper] 추론 가속에서 World Model과 데이터 효율까지"
date: 2026-08-16 12:45:00 +0900
last_modified_at: 2026-08-16 14:03:26 +0900
categories: [AI, Paper]
tags: [yc-paper-club, llm-inference, speculative-decoding, saguaro, diffusion-mpc, model-predictive-control, world-model, jepa, representation-collapse, pac-bayes, benign-overfitting, soft-inductive-bias, scaling-law, data-efficiency, ensemble, distillation]
description: "Speculative Speculative Decoding, Diffusion MPC, LeWorldModel, soft inductive bias, fixed-data pretraining을 논문별 섹터로 나누어 문제 설정·핵심 구조·결과와 평가 경계를 정리한다."
image:
  path: /assets/img/posts/yc-paper-club-inference-world-model-data-efficiency/preview.png
  alt: "추론 병렬화, Diffusion MPC, latent world model, soft inductive bias와 data-constrained scaling을 잇는 핵심 도식"
math: true
toc: true
---

## **0. 다섯 논문의 구성**

다섯 논문은 추론 가속, robot planning, pixel world model, generalization, fixed-data pretraining이라는 서로 다른 병목을 다룬다.

1. [Paper 1 · Speculative Speculative Decoding](#paper-1-ssd) — LLM inference의 직렬 대기 시간
2. [Paper 2 · Diffusion Model Predictive Control](#paper-2-dmpc) — Planning module의 분리와 runtime adaptation
3. [Paper 3 · LeWorldModel](#paper-3-lewm) — Latent dynamics의 representation collapse
4. [Paper 4 · Deep Learning Is Not So Mysterious or Different](#paper-4-soft-bias) — Generalization의 soft inductive bias
5. [Paper 5 · Pre-training Under Infinite Compute](#paper-5-infinite-compute) — 고정 data의 compute scaling

---

## **Paper 1. Speculative Speculative Decoding** {#paper-1-ssd}

> **문제:** Draft model과 target verification 사이의 직렬 대기
>
> **핵심 구조:** Verification outcome별 다음 draft의 병렬 사전 계산과 cache
>
> **평가 경계:** Target distribution 보존과 추가 draft GPU·cache 비용

### **1.1 Autoregressive decoding의 sequential bottleneck**

[Autoregressive sampling](/posts/cs231n-lecture-7/#62-autoregressive-sampling과-decoding)에서는 이미 생성한 prefix가 다음 token의 조건이 된다.

$$
x_t\sim p_\theta(\cdot\mid x_{<t})
$$

Training에서는 정답 token 전체를 알고 있으므로 sequence 축의 여러 위치를 한꺼번에 계산할 수 있다. 반면 inference에서는 $x_t$가 정해져야 $x_{t+1}$의 입력이 생긴다. [Causal Transformer](/posts/cs231n-lecture-8/#8-language-model을-위한-causal-transformer)의 큰 matrix multiplication 능력이 있어도 token 생성 loop 자체는 직렬로 남는다.

이 병목은 단순한 대기 시간 이상의 의미를 가진다. 같은 latency budget 안에 실행할 수 있는 reasoning token, search branch, agent rollout 수가 tokens/s에 의해 제한되기 때문이다. 추론 가속의 목표는 작은 model로 답을 바꾸는 것이 아니라 **큰 target model의 분포를 유지하면서 한 번의 비싼 forward pass로 더 많은 token을 확정하는 것**이다.

![동일한 prompt를 autoregressive decoding, 일반 speculative decoding과 SSD로 생성할 때 terminal 출력이 채워지는 속도의 차이]({{ '/assets/img/posts/yc-paper-club-inference-world-model-data-efficiency/ssd-throughput-demo.gif' | relative_url }})

### **1.2 Speculative decoding의 draft–verify 구조**

Speculative decoding은 작은 draft model $q$가 먼저 $K$개의 후보 token을 순차 생성하고, 큰 target model $p$가 후보 위치 전체를 한 번에 검증한다.

$$
\tilde x_{t:t+K-1}\sim q(\cdot\mid x_{<t})
$$

Draft token $x$의 채택 확률은 단순 threshold가 아니라 두 분포의 비율로 정해진다.

$$
P(\text{accept }x)
=\min\left(1,\frac{p(x)}{q(x)}\right)
$$

거절이 발생하면 다음 residual distribution에서 다시 뽑는다.

$$
r(x)\propto \max\bigl(p(x)-q(x),0\bigr)
$$

모든 후보가 채택되면 target forward pass에서 계산한 다음 위치의 token을 bonus token으로 얻는다. 이 rejection correction과 bonus token 때문에 최종 sample은 draft의 근사가 아니라 target distribution을 그대로 따른다. Draft와 target이 가까울수록 평균 acceptance rate

$$
\alpha
=\sum_x\min\bigl(p(x),q(x)\bigr)
=1-\frac12\lVert p-q\rVert_1
$$

가 커지고, target model 한 번을 실행할 때 확정되는 token 수도 늘어난다.

![Draft token 생성, target의 병렬 검증, prefix 채택, rejection correction과 bonus token으로 완성되는 일반 speculative decoding]({{ '/assets/img/posts/yc-paper-club-inference-world-model-data-efficiency/ordinary-speculative-decoding.gif' | relative_url }})

Draft 길이 $K$를 무작정 늘리는 것은 해법이 아니다. Draft 계산량은 길이에 비례해 커지고, 긴 prefix 전체가 받아들여질 확률은 낮아진다. 따라서 실제 이득은 target forward의 절약량과 draft latency 사이의 균형에서 결정된다.

### **1.3 SSD의 verification-outcome speculation**

일반 speculative decoding에도 한 번 더 직렬 의존성이 남아 있다.

$$
\text{draft}_i
\rightarrow \text{verify}_i
\rightarrow \text{draft}_{i+1}
\rightarrow \text{verify}_{i+1}
$$

현재 draft가 끝나야 target verification이 시작되고, 그 결과를 알아야 다음 prefix용 draft를 만들 수 있다. Speculative Speculative Decoding(SSD)은 target이 현재 후보를 검증하는 동안 별도 draft device가 **가능성 높은 verification outcome별 다음 후보를 미리 계산**한다.

Outcome은 단순히 몇 token이 채택되었는지만 뜻하지 않는다. 채택된 prefix 길이와 그 뒤의 bonus token이 함께 다음 prefix를 결정한다. Vocabulary의 모든 token으로 branch하면 비용이 폭발하므로, Saguaro는 draft logits에서 가능성이 높은 bonus token과 branch에 계산 예산을 집중한다.

![일반 speculative decoding에 남은 draft와 verify의 순차 구간을 verification-outcome branch의 선계산으로 겹치는 SSD]({{ '/assets/img/posts/yc-paper-club-inference-world-model-data-efficiency/ssd-parallel-speculation.gif' | relative_url }})

실제 verification 결과가 미리 준비한 cache에 있으면 다음 draft latency는 target verification 뒤에 숨는다. Cache miss가 나면 backup draft 경로로 복구하므로 출력 분포의 정확성은 target verification이 계속 보장한다. CPU가 branch 결과를 추측해 먼저 실행하는 speculative execution과 비슷하지만, 여기서는 확률적 token branch와 별도 accelerator 사이의 scheduling이 핵심이다.

### **1.4 Cache hit·branch allocation·throughput의 교환**

SSD의 성능은 다음 네 요소가 함께 만든다.

- 실제 verification outcome이 cache에 들어 있을 확률 $p_{\mathrm{hit}}$
- Hit와 miss에서 한 iteration이 확정하는 token 수 $E_{\mathrm{hit}},E_{\mathrm{miss}}$
- Primary pre-speculation과 backup draft의 상대 latency $T_p,T_b$
- Branch 수와 길이에 필요한 추가 draft compute·memory

Branch를 많이 만들면 hit rate와 hit 시 확정 token 수를 높일 수 있지만 draft compute와 cache memory가 커진다. Cache miss에는 backup draft latency가 추가되고, batch가 커지면 request마다 outcome이 달라져 miss 처리와 branch allocation이 더 어려워진다. 따라서 single-request latency와 batched throughput은 같은 지표가 아니다. [Training utilization에서 HFU와 MFU를 구분](/posts/cs231n-lecture-11/#6-hfu와-mfu-기반-throughput-측정)했듯, inference에서도 GPU가 바쁘다는 사실과 사용자가 token을 빨리 받는다는 사실을 분리해서 봐야 한다.

![SSD의 cache miss, branch allocation, batch tradeoff와 latency·throughput 결과의 누적 비교]({{ '/assets/img/posts/yc-paper-club-inference-world-model-data-efficiency/ssd-cache-results.gif' | relative_url }})

논문은 최적화된 Saguaro가 강한 speculative-decoding baseline보다 평균 30% 빠르고, autoregressive decoding보다 최대 5배 빠른 결과를 보고한다. 이는 Llama 계열 target·draft, 별도 draft GPU, 특정 batch와 hardware 설정의 결과다. SSD가 lossless하다는 말은 target distribution을 보존한다는 뜻이며, 추가 GPU와 cache가 필요 없다는 뜻은 아니다.

---

## **Paper 2. Diffusion Model Predictive Control** {#paper-2-dmpc}

> **문제:** 고차원 action 탐색과 one-step dynamics의 horizon 누적 오차
>
> **핵심 구조:** Action proposal·multi-step dynamics·runtime objective의 분리
>
> **평가 경계:** 매 step의 diffusion sampling 비용과 dynamics adaptation용 추가 data

### **2.1 Receding-horizon control의 model·proposal·objective 분해**

[Model predictive control](/posts/cs231n-lecture-17/#62-receding-horizon-model-predictive-control)은 현재 state에서 horizon $H$의 action sequence를 평가하고 첫 action만 실행한 뒤 새 관측에서 다시 계획한다.

$$
a^*_{t:t+H-1}
=\arg\max_{a_{t:t+H-1}}
J\bigl(s_{t+1:t+H},a_{t:t+H-1}\bigr)
$$

여기에는 세 역할이 있다.

1. 가능성 높은 action sequence를 제안하는 proposal
2. Action을 실행했을 때의 미래를 예측하는 dynamics model
3. 예측된 trajectory의 선호도를 계산하는 objective

전통적인 MPC는 optimizer가 넓은 action space를 직접 탐색해야 하고, one-step dynamics를 horizon 끝까지 반복하면 작은 model error가 다음 입력으로 누적된다. D-MPC는 proposal과 dynamics를 모두 multi-step diffusion model로 만들되 두 module은 분리한다.

![MPC의 proposal·dynamics·objective 분해에서 diffusion 기반 action proposal과 multi-step dynamics로 이어지는 설계 공간]({{ '/assets/img/posts/yc-paper-club-inference-world-model-data-efficiency/diffusion-mpc-design-space.gif' | relative_url }})

### **2.2 Diffusion action proposal과 multi-step dynamics**

시점 $t$까지의 state·action history를 $h_t$라고 하면 action proposal은 horizon 전체의 행동 후보를 생성한다.

$$
a_{t:t+H-1}\sim
\rho_\phi(\cdot\mid s_t,h_t)
$$

Dynamics model은 현재 state와 action sequence를 조건으로 미래 state sequence 전체를 예측한다.

$$
s_{t+1:t+H}\sim
p_\psi(\cdot\mid s_t,h_t,a_{t:t+H-1})
$$

두 distribution은 모두 diffusion model로 학습된다. Planning 때는 proposal에서 여러 action sequence를 sample하고, dynamics rollout에 runtime reward를 적용해 가장 좋은 후보를 고른다. 선택한 sequence 전체를 open-loop로 실행하지 않고 첫 action 뒤에 다시 계획하므로 model error를 다음 관측에서 계속 수정할 수 있다.

![Offline trajectory에서 multi-step action proposal과 dynamics를 학습하고 sample·rollout·ranking으로 첫 action을 고르는 D-MPC planner]({{ '/assets/img/posts/yc-paper-club-inference-world-model-data-efficiency/diffusion-mpc-planner.gif' | relative_url }})

One-step predictor를 $H$번 반복하는 대신 future trajectory의 joint distribution을 직접 예측하면 autoregressive compounding error를 완화할 수 있다. 다만 multi-step model도 distribution 밖의 state에서는 틀릴 수 있으므로 [closed-loop replanning](/posts/cs231n-lecture-17/#63-model-bias와-closed-loop-replanning)은 여전히 필요하다.

### **2.3 Diffuser·Decision Diffuser·Diffusion Policy·D-MPC의 경계**

네 방법은 모두 diffusion을 쓰지만 무엇을 생성하고 언제 model을 사용하는지가 다르다.

| 방법 | 학습·생성 단위 | Dynamics의 위치 | Runtime objective 변경 |
|---|---|---|---|
| Diffusion Policy | Demonstration 기반 action chunk | 별도 dynamics 없음 | 불가, 새 objective에는 재학습 필요 |
| Diffuser | State·action trajectory | Joint trajectory model 내부 | Classifier guidance로 differentiable reward 최적화 가능 |
| Decision Diffuser | State trajectory와 inverse dynamics | State planning 뒤 action 복원 | 불가, 학습한 return·constraint conditioning 범위에 한정 |
| D-MPC | Action proposal + action-conditioned state trajectory | 별도 multi-step diffusion dynamics | 명시적으로 가능 |

[Diffusion Policy](/posts/cs231n-lecture-17/#92-diffusion-policy의-action-sequence-denoising)는 observation에서 실행할 action sequence 자체를 생성하는 behavior-cloning policy다. D-MPC의 action proposal은 바로 실행할 policy가 아니라 search를 좋은 후보 쪽으로 좁히는 proposal distribution이다. 또한 이 연구의 실험은 raw video가 아니라 D4RL의 저차원 state 기반 continuous control이다.

### **2.4 Novel reward·novel dynamics adaptation과 ablation**

Proposal·dynamics·objective를 분리하면 서로 다른 변화에 다른 방식으로 대응할 수 있다.

- Reward 변화: 학습하지 않은 lunge·balance·jump objective를 runtime에 바꾸고 같은 proposal과 dynamics로 후보를 다시 평가
- Dynamics 변화: Walker2D에 발 관절 토크 결함을 넣은 환경에서 새 play data로 dynamics만 fine-tuning
- Search 변화: Candidate 수와 ranking objective를 바꾸어 계산량과 성능을 조정

![고정 reward 결과에서 새로운 동작 objective, 고장 난 walker의 dynamics 적응과 component ablation으로 이어지는 D-MPC 실험]({{ '/assets/img/posts/yc-paper-club-inference-world-model-data-efficiency/diffusion-mpc-adaptation.gif' | relative_url }})

이 적응은 zero-shot이 아니다. Defect 환경의 play data 100 episode로 dynamics를 갱신하고 action proposal과 value를 재사용한다. 논문 표에서 결함 환경에 투입한 D-MPC의 fine-tuning 전 score 약 22.74가 30.65로 회복되며, joint trajectory model은 같은 식의 component 교체가 어렵다.

Ablation에서는 diffusion proposal, multi-step action proposal, multi-step dynamics가 각각 성능에 기여한다. 6개 D4RL locomotion domain-level 조합에서 D-MPC의 fixed-reward 평균은 약 65.98로 model-based MPC baseline인 MBOP의 약 33.13보다 높고 여러 offline RL 방법과 경쟁적이다. Sampling과 매 step planning의 비용은 남으며, 원 논문은 이를 빠른 reactive MLP로 distill해 같은 조합 평균 약 65.08을 유지하는 결과도 제시한다.

---

## **Paper 3. LeWorldModel** {#paper-3-lewm}

> **문제:** Representation과 dynamics의 공동 학습에서 발생하는 latent collapse
>
> **핵심 구조:** JEPA prediction과 SIGReg의 two-term objective
>
> **평가 경계:** Goal-image planning과 prediction error 기반 surprise signal

### **3.1 Observation–action–future latent의 예측 구조**

[Learned dynamics](/posts/cs231n-lecture-17/#6-learned-dynamics와-model-based-planning)의 목적은 현재 관측과 action에서 가능한 미래를 예측하는 것이다. 실제 system에서는 완전한 physical state보다 camera observation을 얻는 경우가 많다. Pixel을 그대로 복원하면 배경 texture와 조명처럼 control에 불필요한 세부까지 예측해야 하므로, compact latent에서 dynamics를 학습하는 편이 효율적일 수 있다.

LeWorldModel(LeWM)은 image observation $o_t$를 encoder로 latent에 넣고 action-conditioned predictor가 다음 latent를 예측한다.

$$
z_t=f_\theta(o_t),
\qquad
\hat z_{t+1}=g_\phi(z_t,a_t)
$$

Model-free policy도 내부 feature에 미래를 예측하는 정보가 생길 수 있다. 차이는 model-based 구조가 imagined rollout과 prediction error를 명시적으로 꺼내 planning과 진단에 쓸 수 있다는 데 있다.

![State·action·next state에서 sensor observation과 model-free·model-based 구조, PushT의 실제 다음 frame 예측으로 이어지는 world-model 문제 설정]({{ '/assets/img/posts/yc-paper-club-inference-world-model-data-efficiency/world-model-problem.gif' | relative_url }})

### **3.2 Representation–dynamics co-learning의 collapse**

Encoder와 predictor를 함께 학습하면서 prediction error만 최소화하면 자명한 해가 생긴다.

$$
f_\theta(o)=c,
\qquad
g_\phi(c,a)=c
$$

모든 image를 같은 상수 vector $c$로 보내면 예측과 target latent가 언제나 같아진다. Loss는 작지만 state와 action의 차이를 전혀 표현하지 못한다. 이것이 joint-embedding predictive architecture에서의 representation collapse다.

Teacher의 moving average, pretrained encoder, reconstruction loss, privileged state label은 collapse를 막을 수 있지만 각자 추가 dependency나 supervision을 만든다. [DINO의 centering·sharpening](/posts/cs231n-lecture-12/#92-centeringsharpening-기반-collapse-방지)이 teacher–student output distribution을 제어했다면, LeWM은 teacher 없이 batch latent 자체의 distribution을 제약한다.

### **3.3 JEPA·SIGReg의 two-term objective**

LeWM의 objective는 next-latent prediction과 SIGReg의 합이다.

$$
\mathcal L
=\mathcal L_{\mathrm{pred}}
+\lambda\mathcal L_{\mathrm{SIGReg}}
$$

첫 항은 predicted latent와 실제 다음 observation의 latent를 가깝게 만든다.

$$
\mathcal L_{\mathrm{pred}}
=\left\lVert
g_\phi(f_\theta(o_t),a_t)-f_\theta(o_{t+1})
\right\rVert_2^2
$$

SIGReg는 **Sketched-Isotropic-Gaussian Regularizer**다. Batch latent를 여러 random direction $u_m$으로 projection한 scalar $u_m^\top z$가 표준 Gaussian에 가까워지도록 제약한다. 모든 sample이 한 점으로 모이면 이 조건을 만족할 수 없으므로 collapse가 막힌다. 고차원 density 전체를 직접 맞추지 않고 유한 개의 1차원 projection을 검사한다는 점에서 `Sketched`라는 이름이 붙는다.

![공동 학습의 trivial collapse, 기존 anti-collapse 방법, JEPA predictor와 Gaussian latent projection으로 완성되는 LeWM의 two-term objective]({{ '/assets/img/posts/yc-paper-club-inference-world-model-data-efficiency/lewm-collapse-sigreg.gif' | relative_url }})

논문의 기본값은 projection 수 $M=1024$, $\lambda=0.1$이다. $M$은 넓은 범위에서 민감하지 않아 실질적인 tuning knob는 $\lambda$ 하나에 가깝지만 loss term은 prediction과 SIGReg 두 개다. Decoder는 reconstruction loss의 필수 component가 아니라 latent prediction을 사람이 볼 수 있게 복원하는 시각화 도구다.

### **3.4 Latent planning·physical probing·surprise evaluation**

Goal image를 encoder로 보낸 $z_{\mathrm{goal}}$이 있으면 candidate action sequence를 latent dynamics로 rollout하고 마지막 latent의 거리를 줄이는 후보를 CEM으로 찾는다.

$$
a^*_{t:t+H-1}
=\arg\min_a
\left\lVert
\hat z_{t+H}(a)-z_{\mathrm{goal}}
\right\rVert_2^2
$$

이는 goal image가 정확히 주어진다는 조건의 visual control이다. 자연어 지시나 sparse reward만으로 임의의 실제 로봇 task를 바로 푼다는 뜻은 아니다.

![PushT·PushCube open-loop latent prediction, goal-latent planning, 속도 비교와 color change·teleport의 prediction discrepancy]({{ '/assets/img/posts/yc-paper-club-inference-world-model-data-efficiency/lewm-planning-surprise.gif' | relative_url }})

LeWM은 약 15M parameter이고 single GPU에서 수 시간 안에 학습된다. Foundation encoder 기반 world model과 비교한 특정 planning benchmark에서 최대 48배 빠르고, observation encoding에 DINO-WM보다 약 200배 적은 visual token을 사용한다. 여러 2D·3D task에서 경쟁적이지만 일부 3D task와 TwoRoom에서는 더 큰 foundation representation이 강하다.

관측된 다음 latent와 prediction 사이의 discrepancy는 violation-of-expectation signal로도 쓸 수 있다. 정상 변화보다 물체 teleportation에서 error가 크게 증가하고, 단순 color change에서는 차이가 작거나 일부 환경에서 유의하지 않다. 따라서 이는 물리적으로 불가능한 사건을 감지하는 유용한 신호이지, 모든 OOD event에 대해 보정된 uncertainty probability는 아니다.

---

## **Paper 4. Deep Learning Is Not So Mysterious or Different** {#paper-4-soft-bias}

> **문제:** Parameter 수만으로 설명되지 않는 overparameterized model의 generalization
>
> **핵심 관점:** PAC-Bayes complexity와 compressible solution을 선호하는 soft inductive bias
>
> **주장 경계:** 고전 통계 개념의 재사용과 representation·optimization의 고유성

### **4.1 Expected risk·empirical risk·complexity의 분해**

Overparameterization, benign overfitting, double descent는 neural network만의 초자연적인 현상이 아니다. 이 position paper의 출발점은 generalization을 다음 세 항의 균형으로 보는 것이다.

$$
\text{test risk}
\lesssim
\text{training risk}
+\text{solution complexity}
+\text{confidence term}
$$

Loss가 폭 $\Delta$인 bounded interval에 있고 $n$개의 sample이 독립이며 hypothesis space가 countable할 때, 다음 형태의 bound가 probability $1-\delta$ 이상으로 성립한다.

$$
R(h)
\le \hat R(h)
+\Delta\sqrt{
\frac{K(h\mid A)\log 2+\log(1/\delta)}{2n}
}
$$

$K(h\mid A)$는 architecture $A$가 주어졌을 때 학습된 solution $h$를 기술하는 길이다. PAC-Bayes에서는 특정 weight vector 하나 대신 prior $P$와 data-dependent posterior $Q$의 차이 $\mathrm{KL}(Q\Vert P)$가 complexity 역할을 한다. 핵심은 raw parameter count가 아니라 **학습 뒤 선택된 해가 얼마나 압축 가능하고 prior와 얼마나 가까운가**다.

![Training risk와 solution complexity의 generalization bound, overparameterization과 compressible solution·flat basin의 관계]({{ '/assets/img/posts/yc-paper-club-inference-world-model-data-efficiency/pac-bayes-overparameterization.gif' | relative_url }})

### **4.2 Overparameterization과 compressible solution의 부피**

Parameter가 많아지면 가능한 함수 공간은 넓어진다. 동시에 optimizer는 training loss가 더 낮고, weight perturbation에도 비슷한 함수를 내는 넓은 solution region을 찾을 수도 있다. 하나의 정확한 weight vector보다 그 주변의 큰 부피가 같은 성능을 낸다면 posterior를 더 넓게 둘 수 있고 description cost가 작아질 여지가 생긴다.

그러나 flatness 자체는 parameterization에 따라 달라진다. 같은 함수를 reparameterization해 Hessian의 크기를 바꿀 수 있으므로

$$
\text{more parameters}
\not\Rightarrow
\text{automatic generalization}
$$

이다. 더 큰 model의 이득은 넓은 hypothesis space 자체가 아니라 optimization과 prior가 그 안에서 어떤 solution을 고르는지에 달려 있다.

### **4.3 Benign overfitting과 regularized polynomial**

고차 다항식은 sample의 noise까지 정확히 interpolation할 만큼 유연하다.

$$
f(x;w)=\sum_{j=0}^{J}w_jx^j
$$

여기에 차수가 높을수록 강해지는 penalty를 적용한다.

$$
\mathcal L(w)
=-\log p(y\mid f(x;w))
+\sum_{j=0}^{J}\gamma^j w_j^2,
\qquad \gamma>1
$$

Model은 높은 차수를 금지하지 않는다. 대신 구조적 signal은 낮은 차수로 설명하고, 꼭 필요한 위치에서만 높은 차수를 사용하도록 preference를 준다. 이처럼 training data를 완전히 fit하면서도 test error가 작을 수 있는 현상이 benign overfitting이다.

![고차 다항식의 interpolation, 차수별 regularization과 flexible hypothesis space 안의 soft inductive bias]({{ '/assets/img/posts/yc-paper-club-inference-world-model-data-efficiency/benign-overfitting-soft-bias.gif' | relative_url }})

Hard inductive bias는 hypothesis를 아예 제거한다. Soft inductive bias는 모든 함수를 남겨 두되 단순하고 압축 가능한 해에 더 높은 prior나 낮은 optimization cost를 준다. Expressivity와 data efficiency를 함께 얻으려면 `무엇을 표현할 수 있는가`와 `어떤 해를 먼저 찾는가`를 분리해서 봐야 한다.

### **4.4 Deep learning의 비특수성과 특수성**

이 논문의 주장은 딥러닝에 특별한 것이 전혀 없다는 뜻이 아니다.

- Overparameterization·benign overfitting·double descent는 polynomial regression과 kernel method에서도 나타남
- Representation learning은 raw input에서 task에 유용한 feature 자체를 학습한다는 점에서 여전히 중요함
- Mode connectivity는 서로 다른 solution 사이에 낮은 loss 경로가 존재하는 neural landscape의 구조를 보여 줌
- Transformer의 universality와 in-context learning은 고전적인 고정 feature model보다 넓은 algorithmic behavior를 만듦

따라서 기존 통계학의 언어를 버리는 대신, representation과 optimization이 만드는 soft bias를 그 언어 안에서 더 정확히 기술하는 것이 과제다.

---

## **Paper 5. Pre-training Under Infinite Compute** {#paper-5-infinite-compute}

> **문제:** Fresh data가 고정된 환경에서 epoch와 parameter 증가가 만드는 overfitting
>
> **핵심 구조:** 강한 weight decay·parameter scaling·ensemble·sequence distillation
>
> **평가 경계:** 특정 corpus와 training recipe에서 추정한 loss asymptote와 data efficiency

### **5.1 Compute-optimal scaling 이후의 data bottleneck**

Compute-optimal scaling은 주어진 FLOPs에서 model parameter와 fresh token을 함께 늘리는 비율을 찾는다. 반면 data-constrained regime에서는 seed corpus $D$를 고정한 채 architecture와 training recipe 전체를 최적화한다.

$$
\mathcal L_D^*
=\min_H\mathcal L\bigl(\mathcal A(D,H)\bigr)
$$

$H$는 learning rate, epoch, weight decay 같은 단일-model training hyperparameter를 나타낸다. Parameter 수 $N$과 ensemble member 수 $K$는 뒤에서 별도의 scaling 축으로 두고, distillation은 그 결과를 student로 옮기는 별도 intervention이다. `Infinite compute`는 실제 무한한 training run을 실행했다는 뜻이 아니다. Compute constraint를 제거했을 때의 최저 loss를 finite experiment에 맞춘 scaling law의 **asymptote**로 추정하는 문제 설정이다.

![Compute-optimal scaling에서 web-data bottleneck, 고정 data와 풍부한 compute의 asymptotic question으로 이어지는 문제 설정]({{ '/assets/img/posts/yc-paper-club-inference-world-model-data-efficiency/infinite-compute-problem.gif' | relative_url }})

### **5.2 Epoching·parameter scaling의 overfitting**

200M DCLM token을 고정하면 단순한 두 방향이 모두 한계에 부딪힌다.

- 같은 model이 data를 더 많이 반복하면 training loss는 줄지만 validation loss가 다시 증가
- 같은 data에서 parameter만 키우면 1.4B model이 600M model보다 나빠지는 구간 발생

Fresh data가 충분할 때 쓰던 epoch와 regularization을 그대로 유지하면 큰 model이 제한된 sample의 idiosyncrasy까지 외운다. 따라서 parameter size마다 learning rate, epoch, weight decay를 함께 다시 선택해야 한다.

### **5.3 Weight decay와 parameter-scaling asymptote**

[AdamW의 weight decay](/posts/cs231n-lecture-3/#7-adamw-l2-regularization과-weight-decay의-분리)는 parameter update마다 weight를 직접 줄인다. Fixed-data·overparameterized regime에서는 표준 관행의 $0.1$보다 최대 약 30배 강한 decay가 최적점으로 나타난다. 모든 LLM에 `weight decay=3`을 쓰라는 규칙이 아니라, data-to-parameter ratio가 작아질수록 optimum이 크게 이동한다는 결과다.

Parameter 수 $N$에 대한 regularized validation loss는 다음 power law로 fit된다.

$$
\widehat{\mathcal L}_{D,N}
=\frac{A_D}{N^{\alpha_D}}+E_D
$$

200M token 실험에서는 $N$을 billion 단위로 둘 때

$$
\widehat{\mathcal L}_{200\mathrm M,N}
=\frac{0.05}{N^{1.02}}+3.43
$$

가 보고된다. $N\to\infty$일 때 $3.43$이 관측값이 아니라 fit으로 추정한 asymptote다.

![Standard epoching의 overfit, 강한 regularization, parameter scaling과 ensemble scaling이 같은 plot에 누적되는 고정-data recipe 비교]({{ '/assets/img/posts/yc-paper-club-inference-world-model-data-efficiency/infinite-compute-scaling-recipes.gif' | relative_url }})

### **5.4 Ensemble scaling과 parameter–member double limit**

서로 다른 initialization과 data order로 학습한 $K$개 model의 logit을 평균한다.

$$
p_{\mathrm{ens}}(x)
\propto
\exp\left(
\frac1K\sum_{k=1}^{K}\log p_k(x)
\right)
$$

300M member의 $K\to\infty$ ensemble은 single-model parameter scaling보다 낮은 loss asymptote를 보인다. 논문은 member 크기 $N$과 member 수 $K$를 함께 키우는 double limit를 사용해, model 하나를 크게 만드는 축과 독립 model을 늘리는 축이 결합될 수 있음을 보인다.

Ensemble은 공짜가 아니다. Training과 inference compute·memory는 member 수만큼 늘어난다. 이 실험의 질문은 compute가 풍부하고 data가 병목일 때 **같은 sample에서 얼마나 더 많은 독립적인 해를 뽑아낼 수 있는가**다.

### **5.5 Distillation과 inference-cost 회수**

큰 ensemble을 배포하지 않고도 여러 teacher가 얻은 이득을 sequence-level knowledge distillation으로 student에 옮길 수 있다. $K$개의 teacher 중 하나를 고른 뒤 그 member에서 새 sequence dataset $D'$를 무조건부 생성하고, 원래 corpus $D$와 합쳐 300M student를 처음부터 학습한다.

$$
I\sim\operatorname{Uniform}\{1,\ldots,K\},
\qquad
x'_{1:T}\sim p_{M_I},
\qquad
D_{\mathrm{student}}=D\cup D'
$$

8개의 300M teacher member가 만든 synthetic sequence로 300M student를 학습하면 ensemble이 만든 loss improvement의 83%가 유지된다. 이 설정은 10B synthetic-token pool에서 original:synthetic sample을 1:9로 섞고, student를 16 epoch 학습하되 synthetic data의 반복을 최대 3회로 제한한다. 같은 크기의 300M teacher가 생성한 data로 새 300M student를 학습하는 self-distillation에서도 추가 개선이 나타난다. 이 결과는 token별 soft logit에 KL loss를 적용한 방식이 아니라, 여러 teacher가 생성한 sequence를 새 training data로 압축한 결과다.

![Data-size scaling, ensemble distillation의 83% 보존, downstream transfer와 math continued pretraining의 data-efficiency 결과]({{ '/assets/img/posts/yc-paper-club-inference-world-model-data-efficiency/ensemble-distillation-cpt.gif' | relative_url }})

결과의 배수는 서로 다른 실험을 가리킨다.

- Joint parameter·ensemble scaling의 200M-token asymptote를 standard recipe가 맞추려면 5.17배의 data가 더 필요하다는 extrapolation
- 실제 finite 구성인 5개의 1.4B model은 약 3.75배 data efficiency
- PIQA·SciQ·ARC Easy에서 best ensemble이 best unregularized model보다 평균 9% 개선
- MegaMath-Web-Pro의 4B-token recipe가 비교 대상 73B-token continued-pretraining recipe를 넘어선 17.5배 data efficiency

즉 임의의 4B token이 언제나 73B token을 대체하는 것이 아니다. Dataset, baseline recipe, evaluation metric이 정해진 조건에서 regularization·ensemble·distillation의 조합이 sample 활용도를 크게 높였다는 결과다.

---

## **참고 자료**

**영상**

- [Y Combinator, *Inference, Diffusion, World Models, and More | YC Paper Club*](https://www.youtube.com/watch?v=wE1ZgJdt4uM)

**Paper 1 · Speculative Speculative Decoding**

- [Tanishq Kumar, Tri Dao, Avner May, *Speculative Speculative Decoding*](https://arxiv.org/abs/2603.03251)
- [Yaniv Leviathan, Matan Kalman, Yossi Matias, *Fast Inference from Transformers via Speculative Decoding*](https://arxiv.org/abs/2211.17192)

**Paper 2 · Diffusion Model Predictive Control**

- [Guangyao Zhou et al., *Diffusion Model Predictive Control*](https://arxiv.org/abs/2410.05364)
- [Cheng Chi et al., *Diffusion Policy: Visuomotor Policy Learning via Action Diffusion*](https://arxiv.org/abs/2303.04137)
- [Michael Janner et al., *Planning with Diffusion for Flexible Behavior Synthesis*](https://arxiv.org/abs/2205.09991)
- [Ajay et al., *Is Conditional Generative Modeling all you need for Decision Making?*](https://arxiv.org/abs/2211.15657)

**Paper 3 · LeWorldModel**

- [Lucas Maes et al., *LeWorldModel: Stable End-to-End Joint-Embedding Predictive Architecture from Pixels*](https://arxiv.org/abs/2603.19312)

**Paper 4 · Deep Learning Is Not So Mysterious or Different**

- [Andrew Gordon Wilson, *Position: Deep Learning is Not So Mysterious or Different*](https://proceedings.mlr.press/v267/wilson25a.html)

**Paper 5 · Pre-training Under Infinite Compute**

- [Konwoo Kim et al., *Pre-training under infinite compute*](https://arxiv.org/abs/2509.14786)
- [Jordan Hoffmann et al., *Training Compute-Optimal Large Language Models*](https://arxiv.org/abs/2203.15556)
