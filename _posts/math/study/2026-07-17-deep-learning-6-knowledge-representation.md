---
title: "[Deep Learning 6] 학습된 지식은 모델 내부에 어떻게 표현되는가"
date: 2026-07-17 20:20:45 +0900
categories: [AI, Deep Learning]
tags: [deep-learning, transformer, llm, 3blue1brown, mlp, feed-forward-network, neuron, feature, superposition, interpretability]
description: "3Blue1Brown Deep Learning Chapter 7을 바탕으로 Transformer MLP의 up projection, activation, down projection과 residual update를 살펴보고 feature, neuron, superposition 관점에서 지식 표현을 정리한다."
image:
  path: /assets/img/posts/ai/deep-learning-6-knowledge-representation/00-preview.png
math: true
---

## **0. 이 글의 질문**

[5편](/posts/deep-learning-5-attention/)에서는 attention이 문맥 속 token 사이에서 정보를 이동시키는 계산을 살펴봤습니다.

Transformer block의 다른 큰 구성 요소는 MLP입니다.

```text
Attention
→ token 사이에서 정보를 이동

MLP
→ 각 token vector를 독립적으로 변환
```

이 글은 3Blue1Brown의 **Deep Learning Chapter 7: How might LLMs store facts**를 바탕으로 다음 질문에 답합니다.

> MLP는 hidden vector에서 어떤 feature를 감지하고, 학습된 정보를 다시 hidden space에 어떻게 써 넣을 수 있는가?

제목의 “어떻게 표현되는가”는 완전히 해결된 결론을 뜻하지 않습니다. 실제 LLM의 지식 저장에 대한 완전한 mechanistic explanation은 아직 어려운 문제입니다. 이 글은 영상의 toy example과 superposition 가설을 이용해 가능한 계산 구조를 이해하는 데 목적이 있습니다.

## **1. 사실은 어디에 있을까**

Model에 다음 문장을 넣었다고 생각해봅시다.

```text
Michael Jordan plays the sport of ___
```

Model이 `basketball`에 높은 확률을 준다면 Michael Jordan과 basketball의 연관성이 수많은 parameter 어딘가에 학습되었다고 볼 수 있습니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-6-knowledge-representation/01-where-facts-live.gif" alt="Michael Jordan 다음의 sport를 basketball로 예측하며 학습된 사실이 model 어디에 저장되는지 묻는 장면" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

영상은 연구 결과를 바탕으로 사실과 연관된 계산이 MLP에 많이 나타날 수 있다는 관점을 소개합니다. 다만 하나의 사실이 하나의 neuron이나 하나의 MLP에 온전히 저장된다는 뜻은 아닙니다.

## **2. MLP는 token끼리 대화하지 않는다**

Sequence length를 $T$, hidden dimension을 $d_{model}$이라고 하면 입력은

$$
X\in\mathbb{R}^{T\times d_{model}}
$$

입니다.

MLP는 각 행에 같은 함수를 독립적으로 적용합니다.

$$
\operatorname{MLP}(X)_i
=
\operatorname{MLP}(\mathbf{x}_i)
$$

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-6-knowledge-representation/03-mlp-parallel.gif" alt="sequence의 각 token vector가 다른 token과 통신하지 않고 같은 MLP를 병렬로 통과하는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

Attention에서는 $T\times T$ attention pattern으로 token 사이의 정보를 섞었습니다. MLP에는 이런 sequence mixing이 없습니다. 대신 attention을 통해 이미 문맥을 흡수한 각 hidden vector를 feature 관점에서 읽고 수정합니다.

## **3. MLP 전체 식과 shape**

MLP의 핵심은 두 번의 linear transformation과 그 사이의 nonlinear activation입니다.

$$
Z=XW_{up}+\mathbf{b}_{up}
$$

$$
A=\phi(Z)
$$

$$
U=AW_{down}+\mathbf{b}_{down}
$$

$$
X'=X+U
$$

각 shape은 다음과 같습니다.

| 값 | Shape | 역할 |
|---|---|---|
| $X$ | $T\times d_{model}$ | MLP 입력 hidden vectors |
| $W_{up}$ | $d_{model}\times d_{ff}$ | feature detection space로 확장 |
| $Z,A$ | $T\times d_{ff}$ | pre-activation과 neuron activation |
| $W_{down}$ | $d_{ff}\times d_{model}$ | hidden space에 쓸 update 생성 |
| $U,X'$ | $T\times d_{model}$ | update와 residual output |

일반적으로 $d_{ff}$는 $d_{model}$보다 큽니다. 영상의 GPT-3 예에서는 약 4배의 expansion을 사용합니다.

## **4. Feature를 방향으로 생각한다**

4편에서 고차원 hidden space의 방향이 의미나 feature와 연관될 수 있다고 봤습니다.

Toy example에서는 다음 세 방향이 있다고 가정합니다.

$$
\mathbf{m}:\text{ first name Michael}
$$

$$
\mathbf{j}:\text{ last name Jordan}
$$

$$
\mathbf{b}:\text{ basketball}
$$

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-6-knowledge-representation/02-feature-directions.gif" alt="고차원 hidden space에 Michael Jordan basketball을 나타내는 feature direction이 있다고 가정하는 장면" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

Hidden vector $\mathbf{x}$가 특정 방향과 얼마나 정렬되는지는 dot product로 측정할 수 있습니다.

$$
s_m=\mathbf{x}\cdot\mathbf{m}
$$

이 해석은 이해를 위한 단순화입니다. 실제 feature가 정확히 하나의 깨끗한 방향으로 존재한다고 먼저 가정해서는 안 됩니다.

## **5. Attention이 먼저 정보를 한 위치에 모을 수 있다**

`Michael Jordan`은 두 token에 걸쳐 있습니다. MLP는 token끼리 직접 통신하지 않으므로, Jordan 위치의 hidden vector가 두 이름을 모두 포함하려면 앞선 attention이 Michael 정보를 Jordan 위치로 전달해야 합니다.

```text
Michael token ──attention──▶ Jordan token
                            Michael + Jordan 정보를 가진 hidden vector
```

이처럼 attention과 MLP는 역할이 이어집니다.

- Attention: 필요한 문맥 정보를 한 token position으로 가져온다.
- MLP: 그 position의 hidden vector에서 feature 조합을 감지하고 update를 만든다.

## **6. Up projection은 많은 질문을 동시에 계산한다**

한 token vector를 기준으로 보면

$$
\mathbf{z}
=
\mathbf{x}W_{up}+\mathbf{b}_{up}
$$

입니다.

Row-vector convention에서 $W_{up}$의 각 열은 hidden space에서 하나의 probe direction으로 볼 수 있습니다.

$$
z_r
=
\mathbf{x}\cdot\mathbf{w}_{up,r}+b_{up,r}
$$

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-6-knowledge-representation/04-up-projection.gif" alt="up projection matrix의 여러 방향과 hidden vector의 dot product로 많은 feature score를 동시에 계산하는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

$d_{ff}$개의 성분은 hidden vector에 대해 서로 다른 질문을 동시에 던지는 것처럼 해석할 수 있습니다.

## **7. 두 feature의 조합을 감지하는 toy detector**

첫 번째 probe direction이

$$
\mathbf{w}_{up,1}=\mathbf{m}+\mathbf{j}
$$

라고 가정합니다.

그러면

$$
\mathbf{x}\cdot(\mathbf{m}+\mathbf{j})
=
\mathbf{x}\cdot\mathbf{m}
+
\mathbf{x}\cdot\mathbf{j}
$$

입니다.

단순하게 각 feature가 있으면 dot product가 1이라고 가정하면

| Hidden vector가 포함한 정보 | Dot product |
|---|---:|
| Michael과 Jordan 모두 | 2 |
| 둘 중 하나만 | 1 |
| 둘 다 없음 | 0 이하 |

아직 linear score만으로는 “둘 다 있는가”를 정확히 분리하지 못합니다.

## **8. Bias가 threshold를 이동한다**

해당 성분의 bias를 $-1$로 두면

$$
z_1
=
\mathbf{x}\cdot(\mathbf{m}+\mathbf{j})-1
$$

이 됩니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-6-knowledge-representation/05-bias-feature-detector.gif" alt="Michael과 Jordan 방향의 dot product에 negative bias를 더해 두 feature가 함께 있을 때만 양수가 되게 하는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

이제 toy assumption 아래에서는

```text
Michael + Jordan → 2 - 1 = 1
Michael only     → 1 - 1 = 0
Jordan only      → 1 - 1 = 0
neither          → 0 - 1 = -1
```

이 됩니다. Bias는 feature detector가 켜지는 threshold를 조절하는 역할을 할 수 있습니다.

## **9. Nonlinearity가 detector를 gate로 만든다**

ReLU는 다음 함수입니다.

$$
\operatorname{ReLU}(z)=\max(0,z)
$$

$$
a_1
=
\operatorname{ReLU}
\left(
\mathbf{x}\cdot(\mathbf{m}+\mathbf{j})-1
\right)
$$

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-6-knowledge-representation/06-relu-neuron.gif" alt="negative pre-activation을 0으로 자르는 ReLU가 Michael Jordan feature detector를 gate처럼 만드는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

Toy example에서는 Michael과 Jordan이 함께 있을 때만 $a_1>0$이므로 AND gate처럼 동작합니다.

실제 Transformer에서는 ReLU뿐 아니라 GELU, SwiGLU 같은 activation과 gated MLP가 사용되기도 합니다. 구체적인 식은 architecture마다 다르지만 linear transformation 사이에 nonlinearity를 넣는 핵심 역할은 같습니다.

## **10. Transformer에서 neuron은 무엇인가**

이 문맥에서 neuron은 activation function을 통과한 중간 vector의 한 성분입니다.

$$
\mathbf{a}=\phi(\mathbf{z})
\in\mathbb{R}^{d_{ff}}
$$

- $a_r$가 크다: $r$번째 neuron이 강하게 active
- ReLU에서 $a_r=0$: 해당 neuron이 inactive

Neuron 하나는 다음 두 parameter 방향과 연결됩니다.

1. $W_{up}$의 대응 열: 어떤 입력 pattern에 반응하는가?
2. $W_{down}$의 대응 행: active할 때 hidden space에 무엇을 쓰는가?

## **11. Down projection은 active feature를 update로 바꾼다**

두 번째 linear transformation은

$$
\mathbf{u}
=
\mathbf{a}W_{down}+\mathbf{b}_{down}
$$

입니다.

Row-vector convention에서 $W_{down}$의 각 행을 $\mathbf{w}_{down,r}$라고 하면

$$
\mathbf{u}
=
\sum_{r=1}^{d_{ff}}
a_r\mathbf{w}_{down,r}
+
\mathbf{b}_{down}
$$

로 볼 수 있습니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-6-knowledge-representation/07-down-projection.gif" alt="각 active neuron이 down projection의 대응 방향을 scale하고 합쳐 hidden space update를 만드는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

첫 neuron의 output direction이 basketball feature라고 가정하면

$$
\mathbf{w}_{down,1}=\mathbf{b}
$$

이고 $a_1=1$일 때 basketball 방향이 update에 포함됩니다.

하나의 output direction은 basketball뿐 아니라 Chicago Bulls, number 23처럼 함께 유용한 여러 feature 성분을 포함할 수도 있습니다.

## **12. Residual connection으로 지식을 써 넣는다**

MLP가 만든 update는 기존 vector에 더해집니다.

$$
\mathbf{x}'
=
\mathbf{x}+\mathbf{u}
$$

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-6-knowledge-representation/08-residual-update.gif" alt="MLP가 감지한 Michael Jordan feature에 대응하는 basketball 방향을 원래 hidden vector에 더하는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

Toy example 전체를 한 줄로 쓰면

$$
\mathbf{x}'
=
\mathbf{x}
+
\operatorname{ReLU}
\left(
\mathbf{x}\cdot(\mathbf{m}+\mathbf{j})-1
\right)
\mathbf{b}
$$

입니다.

입력 vector가 Michael과 Jordan을 모두 포함하면 basketball 방향을 더하고, 그렇지 않으면 이 toy neuron은 아무 변화도 만들지 않습니다.

## **13. Sequence 전체의 vectorized 계산**

모든 token position을 한꺼번에 계산하면

$$
\operatorname{MLP}(X)
=
\phi(XW_{up}+\mathbf{b}_{up})W_{down}
+
\mathbf{b}_{down}
$$

$$
X'=X+\operatorname{MLP}(X)
$$

입니다.

Bias는 각 행에 broadcasting됩니다. 같은 $W_{up}$과 $W_{down}$이 모든 position에 적용되지만, 각 position의 hidden vector가 다르므로 neuron activation도 다릅니다.

## **14. Parameter는 어디에 많은가**

MLP의 주요 parameter 수는

$$
d_{model}d_{ff}
+
d_{ff}d_{model}
$$

입니다. Bias를 포함하면

$$
2d_{model}d_{ff}+d_{ff}+d_{model}
$$

입니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-6-knowledge-representation/09-parameter-count.gif" alt="GPT-3 MLP의 up projection과 down projection parameter를 세어 전체 model parameter에서 차지하는 비중을 계산하는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

영상의 GPT-3 숫자에서는 MLP parameter가 전체 parameter의 큰 비중을 차지합니다. 이는 MLP가 model capacity에서 주변적인 부분이 아니라는 뜻입니다.

## **15. Toy example을 실제 model의 결론으로 착각하면 안 된다**

지금까지는 설명을 위해 다음처럼 매우 깨끗한 구조를 가정했습니다.

```text
한 up-projection direction → Michael Jordan detector
한 neuron activation      → 사실의 존재 여부
한 down-projection direction → basketball 정보
```

수학적으로 이런 계산이 가능하다는 것은 맞습니다. 하지만 실제 model에서 하나의 neuron이 하나의 사람이나 사실만 표현한다는 결론은 아닙니다.

실제 representation은 여러 neuron과 layer에 분산될 수 있으며, 한 neuron이 서로 관련 없어 보이는 여러 feature에 반응하는 polysemantic behavior를 보일 수도 있습니다.

## **16. Superposition 문제**

$n$차원 공간에서 서로 완전히 직교하는 방향은 최대 $n$개입니다.

$$
\mathbf{f}_i\cdot\mathbf{f}_j=0
\quad(i\ne j)
$$

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-6-knowledge-representation/10-superposition-idea.gif" alt="한 neuron이 하나의 feature를 나타낸다는 단순한 가정과 고차원 공간의 superposition 가설을 비교하는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

하지만 feature 방향이 완전히 직교할 필요 없이 거의 직교해도 된다면, 작은 interference를 허용하는 대신 차원 수보다 훨씬 많은 feature를 표현할 가능성이 생깁니다.

이처럼 제한된 activation dimension 위에 더 많은 feature를 겹쳐 표현한다는 관점을 **superposition**이라고 합니다.

## **17. 고차원에서는 거의 직교하는 방향이 많다**

고차원 random vector들은 서로 90도에 가까운 각도를 이루는 경향이 있습니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-6-knowledge-representation/11-nearly-orthogonal.gif" alt="100차원 공간의 많은 random vector 사이 각도가 90도 부근에 집중되는 현상을 보여주는 실험" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

Normalized vector $\mathbf{f}_i$와 $\mathbf{f}_j$의 dot product가 작으면 거의 직교합니다.

$$
\left|\mathbf{f}_i^T\mathbf{f}_j\right|\ll1
$$

완전히 0은 아니므로 feature 사이에 interference가 생길 수 있지만, model이 sparse하게 활성화되는 feature를 사용한다면 그 비용을 감수하고 더 많은 feature를 표현하는 것이 유리할 수 있습니다.

## **18. Feature와 neuron은 일대일이 아닐 수 있다**

Superposition이 사용된다면 하나의 feature는 특정 neuron 하나가 아니라 여러 neuron activation의 조합으로 나타납니다.

$$
\text{feature strength}
\approx
\mathbf{f}^T\mathbf{a}
$$

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-6-knowledge-representation/12-features-across-neurons.gif" alt="하나의 feature가 단일 neuron이 아니라 여러 neuron의 특정 activation 조합으로 표현되는 superposition" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

따라서 다음을 구분해야 합니다.

- **Neuron**: MLP activation vector의 좌표 하나
- **Feature**: model 계산에 의미 있는 방향 또는 pattern

Neuron basis와 feature basis가 일치할 수도 있지만 반드시 그런 것은 아닙니다.

## **19. Sparse autoencoder가 등장하는 이유**

Model activation $\mathbf{a}$에서 사람이 해석하기 쉬운 sparse feature $\mathbf{s}$를 찾고 싶다고 생각해봅시다.

$$
\mathbf{s}=\operatorname{Encoder}(\mathbf{a})
$$

$$
\widehat{\mathbf{a}}=\operatorname{Decoder}(\mathbf{s})
$$

Sparse autoencoder는 reconstruction error를 작게 만들면서 $\mathbf{s}$의 많은 성분이 0이 되도록 유도합니다.

$$
\mathcal{L}
=
\lVert\mathbf{a}-\widehat{\mathbf{a}}\rVert^2
+
\lambda\lVert\mathbf{s}\rVert_1
$$

목표는 neuron 좌표에 겹쳐 있는 feature direction을 더 분리된 sparse representation으로 찾는 것입니다. 다만 찾아낸 feature가 완전하거나 유일하다고 자동으로 보장되는 것은 아닙니다.

## **20. 지식은 고정된 데이터베이스 행이 아니다**

“MLP가 사실을 저장한다”는 표현을 database처럼 이해하면 안 됩니다.

```text
Michael Jordan → basketball
```

이라는 문자열 pair가 그대로 parameter 안에 기록되는 것이 아니라, 특정 contextual hidden state에 반응하는 detector와 그때 추가되는 output direction이 여러 weight에 분산되어 학습될 수 있습니다.

또한 최종 prediction에는 embedding, attention, 여러 MLP, residual stream, unembedding이 모두 관여합니다. 특정 사실을 MLP 하나에만 독점적으로 귀속시키는 것은 과도한 단순화입니다.

## **21. Attention과 MLP를 다시 연결한다**

| Block | 입력에서 하는 일 | 출력에 만드는 것 |
|---|---|---|
| Attention | 다른 token의 relevant information을 선택 | 문맥을 반영한 update |
| MLP | 현재 position의 feature combination을 감지 | 학습된 association을 반영한 update |

```text
Attention이 "Michael" 정보를 "Jordan" 위치로 전달
→ Jordan 위치 hidden vector가 두 이름을 함께 표현
→ MLP가 그 feature combination에 반응
→ basketball 관련 방향을 residual stream에 추가
```

실제 network에서는 이 과정이 여러 layer에서 반복되며 더 복잡한 feature와 관계를 단계적으로 만들 수 있습니다.

## **22. 전체 계산 순서**

```text
hidden vector x
→ up projection: xW_up + b_up
→ nonlinearity: GELU/ReLU/gating
→ neuron activations a
→ down projection: aW_down + b_down
→ residual addition: x + update
```

수식으로는

$$
\mathbf{x}'
=
\mathbf{x}
+
\phi
\left(
\mathbf{x}W_{up}+\mathbf{b}_{up}
\right)
W_{down}
+
\mathbf{b}_{down}
$$

입니다.

## **23. 핵심 직관**

MLP는 다음 두 단계로 기억할 수 있습니다.

1. Up projection의 방향들이 hidden vector에서 여러 feature pattern을 감지한다.
2. Active한 intermediate feature들이 down projection의 방향을 통해 hidden space에 update를 쓴다.

한 문장으로 정리하면 다음과 같습니다.

> Transformer MLP는 각 token의 contextual hidden vector에서 학습된 feature 조합을 nonlinear하게 감지하고, 그 activation에 따라 새로운 feature 방향을 residual stream에 추가할 수 있다.

단, 실제 feature는 개별 neuron과 일대일로 대응하지 않고 여러 neuron에 superposition되어 있을 수 있습니다.

## **24. 확인 질문**

1. MLP와 attention은 token 사이의 정보 교환 측면에서 어떻게 다른가?
2. $W_{up}$과 $W_{down}$의 shape과 역할은 무엇인가?
3. Up projection의 한 방향을 feature detector로 해석할 수 있는 이유는 무엇인가?
4. Bias와 nonlinear activation이 toy AND detector를 만드는 데 어떤 역할을 하는가?
5. Down projection을 active neuron별 output direction의 합으로 볼 수 있는 이유는 무엇인가?
6. Residual connection은 MLP update를 기존 정보와 어떻게 결합하는가?
7. Toy example이 실제 model의 지식 저장 방식을 증명하지 않는 이유는 무엇인가?
8. Feature와 neuron을 구분해야 하는 이유는 무엇인가?
9. Superposition이 model capacity와 interpretability에 어떤 tradeoff를 만드는가?
10. Sparse autoencoder는 어떤 문제를 풀려고 하는가?

이 글로 3Blue1Brown Deep Learning Chapter 1부터 7까지의 여섯 편 구성이 마무리됩니다. 신경망의 기본 계산에서 시작해 gradient descent와 backpropagation을 거쳐, Transformer의 전체 구조, attention, MLP와 feature representation까지 하나의 흐름으로 연결했습니다.
