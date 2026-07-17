---
title: "[Deep Learning 4] Transformer는 어떤 순서로 작동하는가"
date: 2026-07-17 19:59:00 +0900
categories: [AI, Deep Learning]
tags: [deep-learning, transformer, llm, 3blue1brown, tokenization, embedding, attention, mlp, unembedding, softmax, logits]
description: "3Blue1Brown Deep Learning Chapter 5를 바탕으로 입력 문장이 token, embedding, attention, MLP, unembedding과 softmax를 거쳐 다음 token의 확률분포가 되는 전체 흐름을 정리한다."
image:
  path: /assets/img/posts/ai/deep-learning-4-transformer/00-preview.png
math: true
---

## **0. 이 글의 질문**

[3편](/posts/deep-learning-3-backpropagation/)까지는 일반적인 신경망의 계산과 학습을 정리했습니다.

```text
forward pass로 예측
→ cost 계산
→ backpropagation으로 gradient 계산
→ gradient descent로 parameter 수정
```

이 원리는 Transformer에서도 바뀌지 않습니다. 달라지는 것은 forward pass의 내부 구조입니다.

이 글은 3Blue1Brown의 **Deep Learning Chapter 5: Transformers, the tech behind LLMs**를 바탕으로 다음 질문에 답합니다.

> 입력 문장은 Transformer 안에서 어떤 순서로 처리되어 다음 token의 확률분포가 되는가?

Attention 내부의 query, key, value 계산은 다음 5편에서 별도로 다룹니다. 이번 글의 목표는 먼저 전체 지도와 각 block의 역할을 잡는 것입니다.

## **1. Transformer가 푸는 문제**

GPT 계열의 language model은 입력 text가 주어졌을 때 **다음 token**을 예측합니다.

입력 token sequence를

$$
x_1,x_2,\ldots,x_T
$$

라고 하면 model은 다음 확률분포를 출력합니다.

$$
P(x_{T+1}\mid x_1,x_2,\ldots,x_T)
$$

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-4-transformer/01-next-token-distribution.gif" alt="입력 text를 받아 다음 token 후보의 확률분포를 출력하는 Transformer" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

model이 문장 전체를 한 번에 작성하는 것이 아닙니다. 매번 다음 token 하나의 확률분포를 계산합니다.

## **2. 생성은 예측을 반복하는 과정이다**

다음 token의 확률분포가 나오면 그중 하나를 선택하고 입력 뒤에 붙입니다. 늘어난 sequence를 다시 model에 넣어 그다음 token을 예측합니다.

```text
현재 text
→ 다음 token 확률분포
→ token 하나 선택
→ 현재 text 뒤에 추가
→ 다시 예측
```

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-4-transformer/02-predict-sample-repeat.gif" alt="다음 token을 예측하고 선택해 문장 뒤에 추가하는 과정을 반복하는 text generation" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

따라서 text generation은 next-token prediction의 반복입니다. Transformer의 한 번의 forward pass가 만드는 것은 완성된 답변이 아니라 다음 선택을 위한 확률분포입니다.

## **3. 전체 흐름 먼저 보기**

decoder-only Transformer의 큰 흐름은 다음과 같습니다.

```text
text
→ tokenization
→ token embedding + position information
→ Transformer blocks 반복
   ├─ masked self-attention
   └─ MLP
→ 마지막 hidden vector
→ unembedding
→ logits
→ softmax
→ 다음 token 확률분포
```

실제 구현에는 residual connection과 layer normalization도 들어갑니다. Chapter 5는 전체 구조에 집중하므로, 이 글에서도 먼저 핵심 데이터 흐름을 설명하고 해당 요소는 뒤에서 위치만 짚습니다.

## **4. Text를 token으로 나눈다**

신경망은 문자열을 직접 matrix multiplication에 넣을 수 없습니다. 먼저 text를 vocabulary에 등록된 작은 단위로 나눕니다.

이 단위를 **token**이라고 합니다.

```text
"Transformers are powerful"
→ ["Transform", "ers", " are", " powerful"]
→ [token id 1, token id 2, token id 3, token id 4]
```

실제 분할 결과는 tokenizer와 vocabulary에 따라 달라집니다. token은 반드시 단어 하나와 같지 않으며 단어의 일부, 공백을 포함한 문자열, 문장부호가 될 수 있습니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-4-transformer/03-tokenization-embedding.gif" alt="입력 문장을 token으로 나누고 각 token을 vector로 바꾸는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

tokenization은 신경망 외부의 전처리입니다. 결과는 길이 $T$의 token ID sequence입니다.

## **5. Token ID를 embedding vector로 바꾼다**

token ID는 단순한 번호이므로 번호의 크기 자체에는 의미가 없습니다. 각 token ID를 $d_{model}$차원의 vector로 바꿉니다.

vocabulary 크기를 $V$라고 하면 embedding matrix는

$$
W_E\in\mathbb{R}^{d_{model}\times V}
$$

로 나타낼 수 있습니다. token $x_t$의 one-hot vector를 $\mathbf{e}_{x_t}$라고 하면 초기 embedding은

$$
\mathbf{h}_t^{(0)}=W_E\mathbf{e}_{x_t}
$$

입니다. 실제 구현에서는 one-hot vector와 matrix를 직접 곱하기보다 embedding table에서 token ID에 해당하는 row 또는 column을 조회합니다. matrix의 저장 방향은 library 표기에 따라 달라도 역할은 같습니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-4-transformer/06-embedding-matrix.gif" alt="embedding matrix에서 token에 해당하는 vector를 가져오는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

Embedding은 discrete한 token을 연속적인 vector 공간의 점으로 바꾸는 첫 단계입니다.

### **5.1 가까운 vector는 비슷한 사용 패턴을 가질 수 있다**

Embedding matrix의 값은 처음에는 random하게 시작하지만 training data를 이용한 학습 과정에서 계속 수정됩니다. 비슷한 문맥에서 비슷한 역할로 등장하는 token들은 model이 다음 token을 예측할 때 비슷하게 다루는 편이 유리하므로, embedding space에서도 가까운 위치에 놓이는 경향이 생길 수 있습니다.

두 embedding $\mathbf{u}$와 $\mathbf{v}$의 가까움을 단순한 Euclidean distance로 볼 수도 있고, 방향의 유사성을 cosine similarity로 볼 수도 있습니다.

$$
\operatorname{cosine}(\mathbf{u},\mathbf{v})
=
\frac{\mathbf{u}\cdot\mathbf{v}}
{\lVert\mathbf{u}\rVert\lVert\mathbf{v}\rVert}
$$

값이 1에 가까우면 두 vector가 비슷한 방향을 가리키고, 0에 가까우면 거의 직교하며, 음수이면 반대 방향 성분이 강합니다.

여기서 “가깝다”는 것은 사람이 정의한 사전적 의미가 그대로 좌표에 저장됐다는 뜻이 아닙니다. **training data 안에서의 사용 패턴을 model이 예측에 유용한 방식으로 압축한 결과**에 가깝습니다.

### **5.2 공간의 방향이 관계를 나타내기도 한다**

Embedding 하나는 공간의 점이고, 두 embedding의 차이는 한 점에서 다른 점으로 향하는 방향입니다.

$$
\mathbf{d}_{\text{gender}}
\approx
\operatorname{Embed}(\text{woman})
-
\operatorname{Embed}(\text{man})
$$

이와 비슷한 방향이 다른 단어 관계에서도 반복된다면 다음과 같은 vector arithmetic이 어느 정도 성립할 수 있습니다.

$$
\operatorname{Embed}(\text{king})
+
\left(
\operatorname{Embed}(\text{woman})
-
\operatorname{Embed}(\text{man})
\right)
\approx
\operatorname{Embed}(\text{queen})
$$

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-4-transformer/06a-semantic-directions.gif" alt="embedding space에서 단어 사이의 차이 vector가 의미 관계의 방향으로 나타나는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

이 예제의 핵심은 `king - man + woman = queen`이라는 공식을 외우는 것이 아닙니다. 학습 과정에서 model이 어떤 관계를 여러 좌표에 흩어진 **방향**으로 표현할 수 있다는 점입니다.

또한 영상의 해당 시각화는 이해를 돕기 위한 단순한 word-to-vector model의 예입니다. 모든 embedding model에서 동일한 관계가 정확히 나타나거나, 하나의 방향이 오직 하나의 의미만 담당한다고 보장할 수는 없습니다.

### **5.3 Dot product는 특정 방향과의 정렬을 측정한다**

어떤 관계를 나타내는 방향 $\mathbf{d}$를 가정하면, token embedding $\mathbf{e}_i$와의 dot product로 그 방향과 얼마나 정렬되는지 측정할 수 있습니다.

$$
s_i
=
\mathbf{d}^{T}\mathbf{e}_i
$$

예를 들어

$$
\mathbf{d}_{\text{plural}}
=
\operatorname{Embed}(\text{cats})
-
\operatorname{Embed}(\text{cat})
$$

라고 두고 여러 단어의 embedding과 dot product를 계산하면, 복수형 단어가 단수형보다 이 방향에 더 크게 정렬되는지 확인할 수 있습니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-4-transformer/06b-dot-product-directions.gif" alt="단수형과 복수형 embedding 차이 방향에 다른 단어 vector가 얼마나 정렬되는지 dot product로 비교하는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

이 dot product 관점은 다음 5편의 attention 계산으로 그대로 이어집니다. Attention도 query와 key의 dot product를 이용해 두 token 사이의 관련도를 수치화합니다.

### **5.4 고차원 vector가 화면에서 움직인다는 의미**

실제 embedding은 화면에 그릴 수 없는 고차원 vector입니다. 영상에 보이는 2D 또는 3D 점은 고차원 공간의 일부 방향을 선택해 투영한 결과입니다.

$$
\mathbf{e}\in\mathbb{R}^{d_{model}}
\quad\longrightarrow\quad
P\mathbf{e}\in\mathbb{R}^{2\text{ or }3}
$$

따라서 화면에서 두 점이 가까워 보이는 모습은 embedding 전체를 완벽하게 보여주는 것이 아닙니다. 선택한 projection에서 드러나는 일부 관계를 시각화한 것입니다.

## **6. 위치 정보도 필요하다**

같은 token이라도 문장 안의 위치가 다르면 역할이 달라질 수 있습니다.

```text
dog bites man
man bites dog
```

token embedding만 모아 놓으면 순서를 명시적으로 표현할 수 없습니다. 그래서 각 위치에 관한 정보를 token vector에 더하거나, attention 계산에서 위치 관계를 반영합니다.

개념적으로는 다음처럼 쓸 수 있습니다.

$$
\mathbf{h}_t^{(0)}
=
\operatorname{Embed}(x_t)+\operatorname{Position}(t)
$$

구체적인 방식은 model마다 다릅니다. learned positional embedding, sinusoidal encoding, rotary positional embedding 등 여러 방법이 사용됩니다.

## **7. 이제 문장은 vector sequence다**

길이 $T$의 문장은 이제 $T$개의 vector로 표현됩니다.

$$
H^{(0)}
=
\begin{bmatrix}
\vert & \vert & & \vert\\
\mathbf{h}_1^{(0)} & \mathbf{h}_2^{(0)} & \cdots & \mathbf{h}_T^{(0)}\\
\vert & \vert & & \vert
\end{bmatrix}
$$

각 vector는 처음에는 해당 token의 기본적인 정보와 위치 정보만 가집니다. 아직 주변 문맥은 충분히 반영되지 않았습니다.

Transformer block을 통과하면서 이 vector들이 문맥에 맞게 계속 수정됩니다.

## **8. Attention은 token끼리 정보를 주고받게 한다**

같은 단어도 주변 문맥에 따라 의미가 달라집니다.

```text
a machine learning model
a fashion model
```

attention block은 각 token vector가 다른 token을 참고하여 자신의 표현을 갱신하게 합니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-4-transformer/04-attention-context.gif" alt="같은 단어가 주변 문맥에 따라 다른 의미를 갖도록 attention이 vector를 갱신하는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

GPT 같은 autoregressive model에서는 미래 token을 미리 볼 수 없도록 **causal mask**를 적용합니다. 위치 $t$의 token은 자신과 앞쪽 token만 참고할 수 있습니다.

$$
\mathbf{h}_t
\text{ can attend to }
\mathbf{h}_1,\ldots,\mathbf{h}_t
$$

어떤 token을 얼마나 참고하는지 계산하는 구체적인 방법이 query, key, value와 attention score입니다. 이 부분은 5편의 중심 주제입니다.

## **9. MLP는 각 token vector를 개별적으로 변환한다**

attention 다음에는 MLP 또는 feed-forward network가 옵니다.

attention이 token 사이의 정보를 섞는다면, MLP는 각 위치의 vector에 같은 nonlinear transformation을 독립적으로 적용합니다.

$$
\operatorname{MLP}(\mathbf{h})
=
W_2\phi(W_1\mathbf{h}+\mathbf{b}_1)+\mathbf{b}_2
$$

여기서 $\phi$는 GELU 같은 nonlinear activation function입니다.

```text
Attention: token들이 서로 정보를 주고받는다.
MLP: 각 token이 가진 정보를 위치별로 변환한다.
```

MLP의 parameter가 학습된 지식을 어떻게 표현할 수 있는지는 6편에서 자세히 다룹니다.

## **10. Attention과 MLP를 여러 번 반복한다**

하나의 attention과 MLP만으로 끝나지 않습니다. 같은 종류의 block을 깊게 쌓되, 각 layer는 서로 다른 학습 parameter를 가집니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-4-transformer/05-attention-mlp-stack.gif" alt="attention block과 MLP block을 번갈아 여러 층 반복하는 Transformer" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

layer $l$의 흐름을 단순화하면 다음과 같습니다.

$$
\widetilde{H}^{(l)}
=
H^{(l-1)}+\operatorname{Attention}(H^{(l-1)})
$$

$$
H^{(l)}
=
\widetilde{H}^{(l)}+\operatorname{MLP}(\widetilde{H}^{(l)})
$$

여기에는 설명을 단순화하기 위해 layer normalization 표기를 생략했습니다. 중요한 것은 attention과 MLP의 출력이 residual connection을 통해 기존 표현에 더해진다는 점입니다.

## **11. Residual connection이 흐름을 보존한다**

Transformer block은 보통 계산 결과로 기존 vector를 완전히 교체하지 않고 변화량을 더합니다.

$$
\mathbf{h}_{out}
=
\mathbf{h}_{in}+F(\mathbf{h}_{in})
$$

이 구조는 원래 정보를 유지하면서 attention이나 MLP가 필요한 수정만 추가하도록 해줍니다. 또한 깊은 network에서 gradient가 여러 layer를 통과하기 쉽게 만듭니다.

Layer normalization은 각 sublayer 주변에서 activation의 scale을 조절해 학습을 안정화합니다. 정확한 pre-norm과 post-norm 배치는 architecture에 따라 다릅니다.

## **12. Vector는 문맥을 흡수하며 변한다**

처음의 embedding은 token 자체에 가까운 표현입니다. 여러 block을 통과한 뒤의 hidden vector에는 문장 속 역할과 주변 문맥이 반영됩니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-4-transformer/07-contextual-vectors.gif" alt="초기 token embedding이 여러 Transformer block을 통과하며 문맥이 풍부한 vector로 변하는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

```text
초기 vector
≈ token의 기본 표현 + 위치

마지막 layer의 vector
≈ 현재 문맥에서 다음 token 예측에 필요한 정보가 반영된 표현
```

여기서 구분해야 할 두 vector가 있습니다.

- **Token embedding**: embedding matrix에서 처음 조회한 고정된 시작 vector
- **Contextual hidden vector**: attention과 MLP를 통과하며 현재 문장에 맞게 계속 갱신되는 vector

같은 token ID라면 시작 embedding은 같습니다. 하지만 주변 문장이 다르면 attention에서 받아오는 정보가 달라지므로 이후 hidden vector의 이동 방향도 달라집니다.

예를 들어 `model`이라는 token의 초기 embedding을 $\mathbf{e}_{model}$이라고 하면 두 문장에서 시작점은 같습니다.

$$
\mathbf{h}_{model}^{(0)}
=
\mathbf{e}_{model}+\mathbf{p}_{t}
$$

그러나 layer $l$에서 attention과 MLP가 계산하는 변화량은 문맥에 의존합니다.

$$
\mathbf{h}_{model}^{(l)}
=
\mathbf{h}_{model}^{(l-1)}
+
\Delta\mathbf{h}_{attention}^{(l)}
+
\Delta\mathbf{h}_{MLP}^{(l)}
$$

```text
"machine learning model"
→ model vector가 neural network, training, prediction과 관련된 방향으로 수정

"fashion model"
→ model vector가 person, clothing, photography와 관련된 방향으로 수정
```

즉 embedding table 안의 `model` vector 자체를 매 문장마다 다시 쓰는 것이 아닙니다. 그 vector를 복사해 만든 현재 sequence의 hidden state가 layer를 통과하면서 이동합니다.

이 이동은 사람이 미리 지정한 규칙이 아닙니다. 다음 token prediction loss를 줄이도록 attention과 MLP의 parameter를 학습한 결과입니다.

“의미가 vector에 들어 있다”는 표현은 특정 좌표 하나가 명확한 단어 뜻 하나를 가진다는 뜻은 아닙니다. 정보는 많은 차원과 여러 layer에 분산되어 표현될 수 있습니다.

## **13. Context window는 한 번에 볼 수 있는 범위다**

Transformer는 한 번의 forward pass에서 처리할 수 있는 token 수에 한계가 있습니다. 이를 context length 또는 context window라고 합니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-4-transformer/08-context-window.gif" alt="고정된 개수의 token vector로 이루어진 Transformer context window" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

context window 밖의 token은 현재 forward pass의 attention 대상에 직접 포함되지 않습니다. 따라서 model이 사용할 수 있는 대화와 문서의 범위는 context 구성 방식에 영향을 받습니다.

## **14. 마지막 hidden vector에서 다음 token을 예측한다**

입력 sequence의 마지막 위치에 있는 hidden vector를 $\mathbf{h}_T^{(L)}$라고 하겠습니다.

이 vector는 causal attention을 통해 앞의 token 정보를 반영할 수 있으므로, 다음 token을 예측하는 데 사용됩니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-4-transformer/09-output-prediction.gif" alt="마지막 context vector를 이용해 다음 token의 확률분포를 만드는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

학습할 때는 마지막 위치 하나만 사용하는 것이 아니라 여러 위치에서 각각 그다음 token을 동시에 예측해 학습 신호를 만들 수 있습니다.

## **15. Unembedding이 vector를 vocabulary score로 바꾼다**

마지막 hidden vector의 크기는 $d_{model}$이지만, 필요한 출력은 vocabulary의 모든 token에 대한 score입니다.

그래서 unembedding matrix를 곱합니다.

$$
W_U\in\mathbb{R}^{V\times d_{model}}
$$

$$
\mathbf{z}=W_U\mathbf{h}_T^{(L)}+\mathbf{b}_U
$$

여기서

$$
\mathbf{z}\in\mathbb{R}^{V}
$$

이며 각 성분은 vocabulary token 하나의 raw score입니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-4-transformer/10-unembedding-matrix.gif" alt="unembedding matrix가 마지막 hidden vector를 vocabulary 크기의 score vector로 바꾸는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

이 raw score를 **logit**이라고 합니다. Logit은 아직 확률이 아니므로 음수일 수도 있고 전체 합이 1일 필요도 없습니다.

## **16. Softmax가 logit을 확률로 바꾼다**

각 token $i$의 확률은 softmax로 계산합니다.

$$
p_i
=
\frac{\exp(z_i)}{\sum_{j=1}^{V}\exp(z_j)}
$$

따라서

$$
0<p_i<1,
\qquad
\sum_{i=1}^{V}p_i=1
$$

입니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-4-transformer/11-softmax.gif" alt="vocabulary logit vector를 softmax로 다음 token 확률분포로 바꾸는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

가장 높은 확률의 token을 항상 선택할 수도 있고, 확률분포에서 sampling할 수도 있습니다. 선택 전략에 따라 생성 결과의 다양성과 결정성이 달라집니다.

## **17. 한 번의 forward pass 정리**

입력 text가 다음 token 확률분포가 되는 과정을 식과 함께 정리하면 다음과 같습니다.

### **17.1 Tokenization**

$$
\text{text}\rightarrow(x_1,x_2,\ldots,x_T)
$$

### **17.2 Initial representation**

$$
\mathbf{h}_t^{(0)}
=
\operatorname{Embed}(x_t)+\operatorname{Position}(t)
$$

### **17.3 Transformer blocks**

$$
H^{(0)}\rightarrow H^{(1)}\rightarrow\cdots\rightarrow H^{(L)}
$$

각 block 안에서는 attention으로 token 사이의 정보를 섞고, MLP로 각 위치의 표현을 변환합니다.

### **17.4 Unembedding**

$$
\mathbf{z}=W_U\mathbf{h}_T^{(L)}+\mathbf{b}_U
$$

### **17.5 Probability distribution**

$$
\mathbf{p}=\operatorname{softmax}(\mathbf{z})
$$

### **17.6 Generation**

$$
x_{T+1}\sim\mathbf{p}
$$

선택한 token을 입력 뒤에 붙이고 같은 과정을 반복합니다.

## **18. Transformer도 결국 학습되는 함수다**

Embedding, attention, MLP, unembedding에 들어 있는 matrix는 사람이 숫자를 직접 채우지 않습니다. 모두 training data에서 학습되는 parameter입니다.

model 전체를 $f_{\theta}$라고 하면

$$
\mathbf{p}
=
f_{\theta}(x_1,\ldots,x_T)
$$

입니다. 정답 next token에 높은 확률을 주도록 loss를 만들고, 3편에서 다룬 backpropagation으로 $\nabla_{\theta}C$를 계산해 parameter를 수정합니다.

즉 Transformer가 새로운 학습 원리를 사용하는 것은 아닙니다. 아주 큰 계산 그래프에 동일한 backpropagation을 적용합니다.

## **19. Attention과 MLP의 역할을 구분한다**

전체 구조를 이해할 때 두 block의 역할을 섞지 않는 것이 중요합니다.

| Block | 핵심 역할 | 위치 사이의 정보 교환 |
|---|---|---|
| Attention | 어떤 token의 정보를 참고할지 결정하고 문맥을 섞음 | 있음 |
| MLP | 각 token vector가 가진 feature를 nonlinear하게 변환 | 없음 |

두 block 모두 matrix multiplication과 학습 parameter를 사용하지만, sequence를 다루는 방식이 다릅니다.

## **20. 핵심 직관**

Transformer의 전체 흐름은 다음 한 문장으로 정리할 수 있습니다.

> Transformer는 text를 token vector의 sequence로 바꾸고, attention과 MLP를 반복해 각 vector에 문맥을 반영한 뒤, 마지막 vector를 vocabulary 전체의 다음 token 확률분포로 변환한다.

다시 순서만 적으면 다음과 같습니다.

```text
tokenize
→ embed
→ add position information
→ attention
→ MLP
→ blocks repeat
→ unembed
→ softmax
→ sample next token
→ repeat
```

## **21. 확인 질문**

1. Language model이 한 번의 forward pass에서 직접 출력하는 것은 무엇인가?
2. Token과 단어가 항상 같지 않은 이유는 무엇인가?
3. Embedding matrix의 역할은 무엇인가?
4. 위치 정보가 필요한 이유는 무엇인가?
5. Attention과 MLP는 각각 vector를 어떻게 다루는가?
6. Causal mask는 어떤 정보를 차단하는가?
7. Unembedding의 출력과 softmax의 출력은 어떻게 다른가?
8. 다음 token을 하나 선택한 뒤 text generation은 어떻게 계속되는가?

다음 [5편](/posts/deep-learning-5-attention/)에서는 이번 글에서 하나의 block으로 남겨 둔 attention을 열어보고, query, key, value가 어떤 계산을 거쳐 token 사이의 정보 이동을 만드는지 단계별로 정리합니다.
