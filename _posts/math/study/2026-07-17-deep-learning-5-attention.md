---
title: "[Deep Learning 5] Attention의 내부 계산"
date: 2026-07-17 20:13:20 +0900
categories: [AI, Deep Learning]
tags: [deep-learning, transformer, attention, self-attention, 3blue1brown, query, key, value, softmax, causal-mask, multi-head-attention]
description: "3Blue1Brown Deep Learning Chapter 6를 바탕으로 query, key, value, scaled dot-product, causal mask, softmax, weighted sum과 multi-head attention의 계산 순서와 행렬 차원을 정리한다."
image:
  path: /assets/img/posts/ai/deep-learning-5-attention/00-preview.png
math: true
---

## **0. 이 글의 질문**

[4편](/posts/deep-learning-4-transformer/)에서는 Transformer 전체의 데이터 흐름을 다음처럼 정리했습니다.

```text
tokenization
→ embedding
→ attention
→ MLP
→ unembedding
→ softmax
→ next-token probability
```

그중 attention은 “token들이 서로 정보를 주고받는다”는 하나의 block으로 남겨 두었습니다.

이 글은 3Blue1Brown의 **Deep Learning Chapter 6: Attention in transformers, step-by-step**을 바탕으로 다음 질문에 답합니다.

> Attention은 어떤 token의 정보를 가져올지 어떻게 정하고, 그 정보를 현재 token vector에 어떻게 반영하는가?

이번 글에서는 직관뿐 아니라 각 행렬의 입력·출력 차원과 실제 계산 순서를 함께 정리합니다.

## **1. Attention이 필요한 이유**

Embedding table에서 조회한 초기 token embedding은 주변 문장을 보지 않습니다. 같은 token ID는 같은 시작 vector를 가집니다.

하지만 같은 단어도 문맥에 따라 의미가 달라집니다.

```text
American shrew mole
one mole of carbon dioxide
a mole on the skin
```

세 문장의 `mole`은 시작 embedding은 같지만, Transformer 내부에서 필요한 contextual representation은 다릅니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-5-attention/01-context-changes-meaning.gif" alt="같은 단어의 embedding이 주변 문맥에 따라 서로 다른 방향으로 이동해야 하는 예시" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

Attention의 역할은 주변 token을 참고하여 현재 token의 hidden vector에 필요한 변화량을 만드는 것입니다.

$$
\mathbf{x}_i
\longrightarrow
\mathbf{x}_i+\Delta\mathbf{x}_i
$$

## **2. 한 문장으로 보는 attention**

Attention은 다음 두 질문을 분리해서 계산합니다.

1. **어디에서 가져올 것인가?** — query와 key로 attention weight를 계산한다.
2. **무엇을 가져올 것인가?** — value를 attention weight로 가중합한다.

```text
Query: 현재 token이 찾고 있는 정보
Key: 각 source token이 어떤 정보와 매칭되는지 나타내는 표지
Value: 매칭되었을 때 실제로 전달할 내용
```

단, 이는 계산을 이해하기 위한 직관입니다. 실제 head가 사람이 붙인 문법적 질문 하나만 수행한다고 보장되지는 않습니다.

## **3. 예제로 사용할 문장**

영상은 다음 문장을 사용합니다.

```text
A fluffy blue creature roamed the verdant forest.
```

설명을 위해 하나의 attention head가 다음 행동을 학습했다고 가정합니다.

```text
noun의 query: 나를 수식하는 앞쪽 adjective가 있는가?
adjective의 key: 나는 adjective이며 이 위치에 있다.
adjective의 value: 내 특성을 noun vector에 이런 방향으로 더하라.
```

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-5-attention/02-attention-head-goal.gif" alt="fluffy와 blue의 정보를 creature embedding에 반영하는 single attention head의 목표" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

이 예제에서 `creature`가 `fluffy`와 `blue`를 강하게 참고하도록 만드는 과정을 단계별로 보겠습니다.

## **4. 표기와 행렬 방향을 먼저 고정한다**

Sequence 길이를 $T$, model dimension을 $d_{model}$이라고 하겠습니다.

이 글에서는 token vector를 **행**으로 쌓는 일반적인 구현 표기를 사용합니다.

$$
X
=
\begin{bmatrix}
\mathbf{x}_1^T\\
\mathbf{x}_2^T\\
\vdots\\
\mathbf{x}_T^T
\end{bmatrix}
\in
\mathbb{R}^{T\times d_{model}}
$$

- 행 $i$: $i$번째 token의 hidden vector
- 열: hidden vector의 feature dimension

영상은 token vector를 열로 놓기 때문에 $K^TQ$와 column-wise softmax를 사용합니다. 이 글의 표기에서는 그 그림을 transpose한 $QK^T$와 row-wise softmax를 사용합니다. 두 방식은 같은 계산이며 행렬을 어느 방향으로 쌓았는지만 다릅니다.

## **5. Query를 만든다**

각 token vector를 query projection matrix에 통과시킵니다.

$$
W_Q\in\mathbb{R}^{d_{model}\times d_k}
$$

$$
Q=XW_Q
\in
\mathbb{R}^{T\times d_k}
$$

token $i$ 하나만 쓰면

$$
\mathbf{q}_i=\mathbf{x}_iW_Q
$$

입니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-5-attention/03-query-projection.gif" alt="각 token embedding에 query matrix를 곱해 query vector를 만드는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

Query는 현재 token이 다른 token에서 찾으려는 정보와 관련된 표현입니다. 예제에서는 `creature`의 query가 “앞에 있는 adjective”와 잘 매칭되는 방향이라고 상상할 수 있습니다.

$W_Q$의 값은 사람이 규칙으로 넣는 것이 아니라 next-token prediction loss를 줄이는 과정에서 학습됩니다.

## **6. Key를 만든다**

같은 입력 $X$를 별도의 key projection에 통과시킵니다.

$$
W_K\in\mathbb{R}^{d_{model}\times d_k}
$$

$$
K=XW_K
\in
\mathbb{R}^{T\times d_k}
$$

$$
\mathbf{k}_j=\mathbf{x}_jW_K
$$

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-5-attention/04-key-projection.gif" alt="각 token embedding에 key matrix를 곱해 key vector를 만드는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

Key는 source token이 어떤 query와 잘 맞는지를 판별하기 위한 표현입니다.

Query와 key는 같은 $d_k$차원 공간에 있어야 dot product를 계산할 수 있습니다. 하지만 두 projection matrix는 서로 다르므로 같은 token에서도 query와 key는 다른 vector가 됩니다.

## **7. Query와 key의 dot product로 score를 만든다**

Target token $i$의 query와 source token $j$의 key가 얼마나 정렬되는지 dot product로 계산합니다.

$$
s_{ij}
=
\mathbf{q}_i\cdot\mathbf{k}_j
$$

모든 token pair를 한 번에 계산하면

$$
S=QK^T
$$

입니다.

차원을 확인하면

$$
\underbrace{Q}_{T\times d_k}
\underbrace{K^T}_{d_k\times T}
=
\underbrace{S}_{T\times T}
$$

가 됩니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-5-attention/05-query-key-scores.gif" alt="모든 query와 key 조합의 dot product를 계산해 attention score matrix를 만드는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

이 글의 표기에서 $S_{ij}$는 다음을 뜻합니다.

> $i$번째 target token이 자신의 표현을 갱신할 때 $j$번째 source token을 얼마나 관련 있다고 보는가?

Score는 아직 확률이 아닙니다. 음수일 수도 있고 각 행의 합도 1이 아닙니다.

## **8. 왜 $\sqrt{d_k}$로 나누는가**

Scaled dot-product attention은 score를 다음처럼 만듭니다.

$$
\widetilde{S}
=
\frac{QK^T}{\sqrt{d_k}}
$$

Query와 key 성분이 평균 0, 분산 1 정도라고 단순화하면 dot product는 $d_k$개의 곱을 더하므로 분산이 대략 $d_k$에 비례해 커질 수 있습니다.

$$
\operatorname{Var}(\mathbf{q}\cdot\mathbf{k})
\approx d_k
$$

$\sqrt{d_k}$로 나누면 score의 scale을 완화할 수 있습니다.

$$
\operatorname{Var}
\left(
\frac{\mathbf{q}\cdot\mathbf{k}}{\sqrt{d_k}}
\right)
\approx 1
$$

Score가 지나치게 크면 softmax가 거의 one-hot처럼 포화되어 작은 score 차이가 과도하게 증폭되고 gradient도 불리해질 수 있습니다.

## **9. Causal mask로 미래를 차단한다**

GPT는 위치 $i$의 token이 미래 위치 $j>i$를 참고하면 안 됩니다. Training 중에는 미래 token이 정답을 직접 알려주는 leakage가 되기 때문입니다.

Mask matrix를

$$
M_{ij}
=
\begin{cases}
0, & j\le i\\
-\infty, & j>i
\end{cases}
$$

로 둡니다.

Masked score는

$$
\widehat{S}
=
\frac{QK^T}{\sqrt{d_k}}+M
$$

입니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-5-attention/08-causal-mask.gif" alt="미래 token에 해당하는 attention score를 negative infinity로 바꾸는 causal masking" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

왜 0이 아니라 $-\infty$로 바꾸는지가 중요합니다. Softmax 전에 0을 넣으면 $e^0=1$이므로 미래 위치에 양의 weight가 남습니다. 반면

$$
e^{-\infty}=0
$$

이므로 softmax 후에는 정확히 0이 됩니다.

## **10. Softmax로 attention weight를 만든다**

각 target token $i$에 대해 source 방향 $j$로 softmax를 적용합니다.

$$
A_{ij}
=
\frac{\exp(\widehat{S}_{ij})}
{\sum_{m=1}^{T}\exp(\widehat{S}_{im})}
$$

행렬로 쓰면

$$
A
=
\operatorname{softmax}
\left(
\frac{QK^T}{\sqrt{d_k}}+M
\right)
$$

입니다. Softmax는 각 행에 적용합니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-5-attention/06-softmax-pattern.gif" alt="각 target token의 attention score를 softmax로 정규화해 attention pattern을 만드는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

각 행은 다음 성질을 가집니다.

$$
A_{ij}\ge0,
\qquad
\sum_{j=1}^{T}A_{ij}=1
$$

따라서 $A_{ij}$를 target $i$가 source $j$에서 가져올 정보의 비율로 읽을 수 있습니다.

## **11. 영상의 compact formula 읽기**

지금까지의 “어디에서 가져올 것인가”를 한 줄로 쓰면 다음과 같습니다.

$$
A
=
\operatorname{softmax}
\left(
\frac{QK^T}{\sqrt{d_k}}+M
\right)
$$

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-5-attention/07-scaled-dot-product.gif" alt="query key dot product scaling softmax를 하나의 attention formula로 정리하는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

영상에서는 token vector가 열이므로 다음처럼 보입니다.

$$
A_{video}
=
\operatorname{softmax}
\left(
\frac{K^TQ}{\sqrt{d_k}}
\right)
$$

이는 이 글의 $A$를 transpose한 orientation입니다. $QK^T$와 $K^TQ$ 중 하나가 무조건 틀린 것이 아니라, token vector를 행과 열 중 어디에 배치했는지를 먼저 확인해야 합니다.

## **12. Value는 실제로 전달할 내용을 만든다**

Query와 key는 정보의 **경로와 비율**을 정했습니다. 이제 실제로 전달할 내용을 value projection으로 만듭니다.

$$
W_V\in\mathbb{R}^{d_{model}\times d_v}
$$

$$
V=XW_V
\in\mathbb{R}^{T\times d_v}
$$

$$
\mathbf{v}_j=\mathbf{x}_jW_V
$$

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-5-attention/09-value-vectors.gif" alt="각 source token의 hidden vector를 value projection에 통과시켜 전달할 value vector를 만드는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

Value는 “이 source token이 선택되었다면 target에 어떤 정보를 전달할 것인가?”에 해당합니다.

Key와 value는 같은 source token에서 만들어지지만 역할이 다릅니다.

- key: 선택 여부를 판단하는 데 사용
- value: 선택된 뒤 실제 가중합에 사용

## **13. Attention weight로 value를 가중합한다**

Target token $i$의 attention output은 모든 source value의 weighted sum입니다.

$$
\mathbf{o}_i
=
\sum_{j=1}^{T}
A_{ij}\mathbf{v}_j
$$

모든 target token을 한꺼번에 계산하면

$$
O=AV
$$

입니다.

차원은

$$
\underbrace{A}_{T\times T}
\underbrace{V}_{T\times d_v}
=
\underbrace{O}_{T\times d_v}
$$

입니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-5-attention/10-weighted-value-sum.gif" alt="attention pattern의 weight를 value vector에 곱하고 합쳐 contextual update를 만드는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

예제에서 `creature` 행의 $A_{ij}$가 `fluffy`와 `blue` 위치에서 크다면, output은 두 value의 큰 비율을 포함합니다.

```text
creature의 update
≈ 큰 비율 × fluffy value
 + 큰 비율 × blue value
 + 작은 비율 × 나머지 value
```

## **14. Residual connection으로 기존 표현에 더한다**

Attention output은 기존 hidden vector를 완전히 지우는 값이 아니라, 기존 표현에 추가할 변화량으로 사용됩니다.

Single head를 단순하게 쓰면

$$
X'=X+OW_O
$$

입니다. 여기서

$$
W_O\in\mathbb{R}^{d_v\times d_{model}}
$$

는 attention output을 model dimension으로 되돌리는 projection입니다.

$$
\underbrace{O}_{T\times d_v}
\underbrace{W_O}_{d_v\times d_{model}}
=
\underbrace{OW_O}_{T\times d_{model}}
$$

이제 $X$와 shape이 같으므로 residual addition이 가능합니다.

```text
기존 vector
+ attention이 제안한 contextual change
= 더 구체적인 contextual vector
```

실제 Transformer block에서는 layer normalization과 dropout의 위치도 architecture에 따라 함께 고려됩니다.

## **15. Value map을 두 단계로 보는 이유**

영상은 value가 embedding space에서 바로 변화량을 만드는 직관을 먼저 보여준 뒤, 실제 multi-head 구현에서는 작은 head dimension을 거친다고 설명합니다.

$$
\mathbb{R}^{d_{model}}
\xrightarrow{W_V}
\mathbb{R}^{d_v}
\xrightarrow{W_O}
\mathbb{R}^{d_{model}}
$$

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-5-attention/11-value-low-rank.gif" alt="큰 embedding space의 value map을 down projection과 up projection으로 분해하는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

$d_v<d_{model}$이면 전체 선형변환 $W_VW_O$의 rank는 최대 $d_v$로 제한됩니다.

$$
\operatorname{rank}(W_VW_O)
\le d_v
$$

즉 하나의 head가 제안하는 변화는 전체 $d_{model}$차원 공간 안에서도 제한된 subspace를 통해 만들어집니다. 여러 head가 서로 다른 projection을 사용하면 서로 다른 종류의 변화 방향을 제안할 수 있습니다.

## **16. Single-head attention 전체 식**

한 head의 계산을 처음부터 끝까지 쓰면 다음과 같습니다.

$$
Q=XW_Q,
\qquad
K=XW_K,
\qquad
V=XW_V
$$

$$
A
=
\operatorname{softmax}
\left(
\frac{QK^T}{\sqrt{d_k}}+M
\right)
$$

$$
O=AV
$$

$$
X'=X+OW_O
$$

이를 한 줄로 합치면

$$
X'
=
X+
\operatorname{softmax}
\left(
\frac{(XW_Q)(XW_K)^T}{\sqrt{d_k}}+M
\right)
(XW_V)W_O
$$

입니다.

## **17. Multi-head attention**

하나의 head는 하나의 query, key, value projection set을 가집니다. Multi-head attention은 $H$개의 head가 서로 다른 parameter로 같은 입력을 병렬 처리합니다.

$$
\operatorname{head}_h
=
\operatorname{softmax}
\left(
\frac{Q_hK_h^T}{\sqrt{d_k}}+M
\right)V_h
$$

$$
Q_h=XW_Q^{(h)},
\quad
K_h=XW_K^{(h)},
\quad
V_h=XW_V^{(h)}
$$

<figure class="my-3">
  <img src="https://pub-7351ab7ce8d34a72861fbf2a7d06dd4c.r2.dev/assets/img/posts/ai/deep-learning-5-attention/12-multi-head-attention.gif" alt="서로 다른 query key value projection을 가진 여러 attention head가 병렬로 contextual update를 만드는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

각 head는 서로 다른 attention pattern과 value subspace를 학습할 수 있습니다.

```text
head 1: 가까운 문법 관계에 민감할 수 있음
head 2: 대명사가 가리키는 대상을 추적할 수 있음
head 3: 멀리 떨어진 주제 정보를 가져올 수 있음
...
```

이 예시는 가능한 해석일 뿐이며 실제 head의 동작이 이렇게 깔끔하게 하나의 기능으로 분리된다고 보장할 수는 없습니다.

## **18. Concatenate와 output projection**

일반적인 구현에서는 각 head의 output을 feature dimension 방향으로 이어 붙입니다.

$$
O_{cat}
=
\operatorname{Concat}
\left(
\operatorname{head}_1,
\ldots,
\operatorname{head}_H
\right)
$$

보통 $Hd_v=d_{model}$이 되도록 정하면

$$
O_{cat}\in\mathbb{R}^{T\times d_{model}}
$$

입니다. 이후 하나의 output matrix를 곱합니다.

$$
W_O\in\mathbb{R}^{d_{model}\times d_{model}}
$$

$$
\operatorname{MHA}(X)=O_{cat}W_O
$$

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-5-attention/13-output-matrix.gif" alt="각 attention head의 작은 value output을 모아 하나의 output matrix로 model dimension에 투영하는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

영상에서 각 head의 `Value up` matrix를 한데 붙인 것이 일반적인 표기의 output matrix $W_O$에 해당합니다.

## **19. Self-attention과 cross-attention**

지금까지는 $Q$, $K$, $V$를 모두 같은 sequence $X$에서 만들었습니다.

$$
Q=XW_Q,
\quad
K=XW_K,
\quad
V=XW_V
$$

이를 **self-attention**이라고 합니다.

Cross-attention에서는 query와 key/value의 source가 다릅니다.

$$
Q=X_{target}W_Q
$$

$$
K=X_{source}W_K,
\qquad
V=X_{source}W_V
$$

예를 들어 번역 model의 decoder가 source language representation을 참고하거나, text-to-image model이 image representation을 text representation과 연결할 때 사용할 수 있습니다.

## **20. Attention matrix의 계산 비용**

Score matrix $QK^T$의 shape은 $T\times T$입니다.

$$
S\in\mathbb{R}^{T\times T}
$$

따라서 standard attention의 score 저장 공간은 대략

$$
O(T^2)
$$

이고, score 계산량은 head당 대략

$$
O(T^2d_k)
$$

입니다.

Context length가 두 배가 되면 attention pattern의 원소 수는 대략 네 배가 됩니다. 긴 context를 효율적으로 처리하기 위한 다양한 attention 변형이 연구되는 이유입니다.

## **21. Training할 때 모든 위치를 동시에 계산할 수 있다**

Causal mask 덕분에 하나의 sequence 안에서 각 위치는 자신의 이전 token만 참고합니다.

```text
position 1 → token 2 예측
position 2 → token 3 예측
position 3 → token 4 예측
...
```

각 위치의 prediction loss를 동시에 계산할 수 있으므로 training을 병렬화하기 좋습니다.

반면 text generation에서는 새 token이 이전 결과에 의존하므로 token을 순차적으로 생성합니다. 구현에서는 이전 token의 key와 value를 KV cache에 저장해 매 step마다 전부 다시 계산하는 비용을 줄일 수 있습니다.

## **22. 자주 혼동하는 부분**

### **22.1 Attention weight와 value는 다르다**

$A_{ij}$는 source $j$를 얼마나 참고할지 나타내는 scalar이고, $\mathbf{v}_j$는 실제로 가져올 vector입니다.

### **22.2 높은 attention weight가 곧 완전한 설명은 아니다**

Model의 최종 출력에는 여러 head, residual path, MLP와 이후 layer가 함께 영향을 줍니다. Attention pattern 하나만 보고 전체 model의 판단 이유를 단정하면 안 됩니다.

### **22.3 Query, key, value는 입력에 저장된 고정 속성이 아니다**

각 layer와 head마다 다른 projection matrix를 사용하므로 같은 token도 layer와 head에 따라 서로 다른 query, key, value가 됩니다.

### **22.4 $QK^T$와 $K^TQ$는 표기 convention을 확인해야 한다**

Token이 행인지 열인지 확인하지 않고 식만 비교하면 transpose 방향을 반대로 이해할 수 있습니다.

## **23. 계산 순서와 shape 정리**

| 단계 | 식 | Shape |
|---|---|---|
| 입력 | $X$ | $T\times d_{model}$ |
| Query | $Q=XW_Q$ | $T\times d_k$ |
| Key | $K=XW_K$ | $T\times d_k$ |
| Value | $V=XW_V$ | $T\times d_v$ |
| Score | $QK^T/\sqrt{d_k}+M$ | $T\times T$ |
| Pattern | $A=\operatorname{softmax}(\cdot)$ | $T\times T$ |
| Weighted value | $O=AV$ | $T\times d_v$ |
| Multi-head concat | $O_{cat}$ | $T\times(Hd_v)$ |
| Output projection | $O_{cat}W_O$ | $T\times d_{model}$ |
| Residual output | $X+O_{cat}W_O$ | $T\times d_{model}$ |

## **24. 핵심 직관**

Attention의 전체 흐름은 다음과 같습니다.

```text
X
├─ W_Q → Q: 무엇을 찾는가
├─ W_K → K: 무엇과 매칭되는가
└─ W_V → V: 무엇을 전달하는가

QKᵀ
→ scale
→ causal mask
→ softmax
→ attention weight A

A × V
→ source information의 weighted sum
→ output projection
→ residual connection
→ contextual representation
```

한 문장으로 정리하면 다음과 같습니다.

> Attention은 query와 key의 유사도로 정보의 경로와 비율을 정하고, 그 비율로 value를 가중합하여 각 token의 contextual representation을 갱신한다.

## **25. 확인 질문**

1. Query, key, value는 각각 어떤 역할을 하는가?
2. $QK^T$의 shape이 $T\times T$가 되는 이유는 무엇인가?
3. Score를 $\sqrt{d_k}$로 나누는 이유는 무엇인가?
4. Causal mask에서 미래 위치를 0이 아니라 $-\infty$로 바꾸는 이유는 무엇인가?
5. Attention weight와 value vector의 차이는 무엇인가?
6. $AV$가 각 target token의 weighted sum을 동시에 계산하는 이유를 설명할 수 있는가?
7. Multi-head attention에서 head마다 parameter가 다른 이유는 무엇인가?
8. 영상의 $K^TQ$와 일반적인 구현의 $QK^T$가 모두 가능하려면 무엇을 확인해야 하는가?
9. Standard attention의 context length 비용이 quadratic인 이유는 무엇인가?

다음 [6편](/posts/deep-learning-6-knowledge-representation/)에서는 Transformer의 다른 핵심 block인 MLP를 열어보고, 학습된 지식과 feature가 model 내부에 어떤 방식으로 표현될 수 있는지 정리합니다.
