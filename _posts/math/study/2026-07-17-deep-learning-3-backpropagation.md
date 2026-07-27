---
title: "[Deep Learning 3] Backpropagation과 Gradient 계산"
date: 2026-07-17 19:43:54 +0900
categories: [AI, Deep Learning]
tags: [deep-learning, neural-network, 3blue1brown, backpropagation, gradient, chain-rule, computational-graph, partial-derivative, mini-batch]
description: "3Blue1Brown Deep Learning Chapter 3과 4를 바탕으로 출력 오차가 뒤쪽 layer부터 전달되며 각 weight와 bias의 gradient를 계산하는 과정을 직관과 수식으로 정리한다."
image:
  path: /assets/img/posts/ai/deep-learning-3-backpropagation/00-preview.png
math: true
---

## **0. 이 글의 질문**

[2편](/posts/deep-learning-2-gradient-descent/)에서는 신경망이 cost를 줄이기 위해 negative gradient 방향으로 parameter를 수정한다는 것을 정리했습니다.

$$
\theta \leftarrow \theta-\eta\nabla C(\theta)
$$

그런데 이 식은 중요한 계산 하나를 이미 알고 있다고 가정합니다.

$$
\nabla C(\theta)
=
\left[
\frac{\partial C}{\partial \theta_1},
\frac{\partial C}{\partial \theta_2},
\ldots
\right]^T
$$

신경망에는 수많은 weight와 bias가 있습니다. 각 parameter가 cost에 미치는 영향을 어떻게 전부 계산할 수 있을까요?

이 글은 3Blue1Brown의 **Deep Learning Chapter 3: Backpropagation, intuitively**와 **Chapter 4: Backpropagation calculus**를 함께 보며 다음 질문에 답합니다.

> 출력에서 발견한 오차를 뒤쪽 layer부터 전달하면서 모든 weight와 bias의 gradient를 어떻게 계산하는가?

## **1. Gradient descent와 backpropagation은 다르다**

두 용어는 함께 등장하지만 역할이 다릅니다.

- **backpropagation**: 현재 mini-batch에서 gradient를 계산한다.
- **gradient descent**: 계산된 gradient를 이용해 parameter를 갱신한다.

```text
forward pass
→ cost 계산
→ backpropagation으로 gradient 계산
→ gradient descent로 parameter 갱신
```

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-3-backpropagation/01-negative-gradient.gif" alt="cost를 가장 빠르게 감소시키는 negative gradient 방향을 구하는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

backpropagation은 학습 전체를 뜻하지 않습니다. 학습 한 step 안에서 미분값을 효율적으로 구하는 알고리즘입니다.

## **2. 먼저 한 training example만 생각한다**

입력 하나와 정답 하나를 고정합니다.

$$
(\mathbf{x},\mathbf{y})
$$

출력 layer의 activation을 $\mathbf{a}^{(L)}$라고 하면, 한 sample의 squared cost는 다음과 같습니다.

$$
C_0
=
\sum_j\left(a_j^{(L)}-y_j\right)^2
$$

정답이 숫자 2라면 2번 output neuron은 1에 가까워져야 하고, 나머지 output neuron은 0에 가까워져야 합니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-3-backpropagation/02-output-nudges.gif" alt="정답에 맞게 output activation을 위아래로 움직여야 하는 방향" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

따라서 출력에서 시작하면 각 activation을 어느 방향으로 움직여야 cost가 줄어드는지 알 수 있습니다. 이 원하는 변화가 역방향 계산의 출발점입니다.

## **3. Output neuron을 바꾸는 세 가지 방법**

마지막 layer의 neuron 하나를 보면

$$
z_j^{(L)}
=
\sum_k w_{jk}^{(L)}a_k^{(L-1)}+b_j^{(L)}
$$

$$
a_j^{(L)}=\sigma\left(z_j^{(L)}\right)
$$

입니다. 이 output activation을 바꾸는 방법은 세 가지입니다.

1. bias $b_j^{(L)}$를 바꾼다.
2. weight $w_{jk}^{(L)}$를 바꾼다.
3. 이전 layer의 activation $a_k^{(L-1)}$을 바꾼다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-3-backpropagation/03-ways-to-change-output.gif" alt="bias weight 이전 layer activation을 바꿔 output neuron을 조절하는 방법" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

세 번째 방법이 중요합니다. 이전 activation은 그 앞 layer의 weight와 bias로 결정되므로, 같은 질문을 한 layer 앞에서 다시 할 수 있습니다.

## **4. Weight의 영향은 입력 activation에 비례한다**

weighted sum을 weight 하나에 대해 미분하면

$$
\frac{\partial z_j^{(L)}}{\partial w_{jk}^{(L)}}
=
a_k^{(L-1)}
$$

입니다.

이전 neuron이 강하게 활성화되어 있다면 연결 weight의 작은 변화가 $z_j^{(L)}$를 크게 바꿉니다. 반대로 activation이 거의 0이면 그 weight를 바꿔도 영향이 작습니다.

따라서 직관적으로는 다음과 같이 읽을 수 있습니다.

> 활성화된 neuron에서 나온 연결일수록 현재 sample의 학습 신호를 더 크게 받는다.

하지만 이것만으로 weight를 무조건 키운다는 뜻은 아닙니다. 변화의 부호와 전체 크기는 출력 오차와 activation function의 derivative까지 함께 곱해져 결정됩니다.

## **5. 이전 layer로 원하는 변화를 전달한다**

이전 activation에 대한 영향은

$$
\frac{\partial z_j^{(L)}}{\partial a_k^{(L-1)}}
=
w_{jk}^{(L)}
$$

입니다.

즉 output neuron의 오차 신호는 연결 weight에 비례해 이전 neuron으로 전달됩니다. 하나의 이전 neuron이 여러 output neuron에 연결되어 있다면, 모든 경로에서 온 영향을 더해야 합니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-3-backpropagation/04-propagate-to-previous-layer.gif" alt="output의 원하는 변화가 weight에 비례해 이전 layer activation으로 전달되는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

이렇게 마지막 layer에서 얻은 정보를 한 layer씩 뒤로 전달하기 때문에 **backpropagation**이라고 부릅니다.

## **6. 역방향으로 같은 문제를 반복한다**

이전 layer의 activation을 어느 방향으로 바꿔야 하는지 알았다면, 그 activation을 만든 weight와 bias가 받을 변화도 계산할 수 있습니다.

```text
output error
→ 마지막 layer의 weight와 bias
→ 이전 layer의 activation
→ 그 activation을 만든 weight와 bias
→ 더 이전 layer의 activation
```

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-3-backpropagation/05-backward-pass.gif" alt="출력 오차에서 시작해 여러 layer를 역방향으로 이동하는 backpropagation" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

각 layer마다 완전히 새로운 계산을 만드는 것이 아닙니다. 뒤에서 받은 오차와 현재 layer가 저장해 둔 값을 이용해 같은 형태의 계산을 반복합니다.

## **7. 계산 그래프로 보면 더 명확하다**

수식을 단순하게 보기 위해 각 layer에 neuron이 하나씩만 있는 network를 생각합니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-3-backpropagation/06-simple-network.gif" alt="각 layer에 neuron 하나가 있는 단순한 network와 weight bias" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

마지막 연결의 계산은 다음 의존 관계를 가집니다.

$$
w^{(L)},a^{(L-1)},b^{(L)}
\rightarrow z^{(L)}
\rightarrow a^{(L)}
\rightarrow C_0
$$

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-3-backpropagation/07-computational-graph.gif" alt="weight activation bias에서 z와 output activation을 거쳐 cost를 계산하는 계산 그래프" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

forward pass는 이 화살표를 왼쪽에서 오른쪽으로 따라 값을 계산합니다. backward pass는 오른쪽에서 왼쪽으로 따라가며 sensitivity를 계산합니다.

## **8. Chain rule로 경로의 영향을 곱한다**

$w^{(L)}$가 바뀌면 $z^{(L)}$가 바뀌고, 그 결과 $a^{(L)}$가 바뀌며, 마지막으로 $C_0$가 바뀝니다.

따라서 chain rule을 적용하면

$$
\frac{\partial C_0}{\partial w^{(L)}}
=
\frac{\partial C_0}{\partial a^{(L)}}
\frac{\partial a^{(L)}}{\partial z^{(L)}}
\frac{\partial z^{(L)}}{\partial w^{(L)}}
$$

입니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-3-backpropagation/08-chain-rule.gif" alt="작은 변화가 계산 그래프를 따라 전달되는 비율을 chain rule로 곱하는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

각 항은 직접 계산할 수 있습니다.

$$
\frac{\partial C_0}{\partial a^{(L)}}
=2\left(a^{(L)}-y\right)
$$

$$
\frac{\partial a^{(L)}}{\partial z^{(L)}}
=\sigma'\left(z^{(L)}\right)
$$

$$
\frac{\partial z^{(L)}}{\partial w^{(L)}}
=a^{(L-1)}
$$

따라서

$$
\frac{\partial C_0}{\partial w^{(L)}}
=
2\left(a^{(L)}-y\right)
\sigma'\left(z^{(L)}\right)
a^{(L-1)}
$$

가 됩니다.

## **9. Bias와 이전 activation도 같은 방식이다**

bias는

$$
\frac{\partial z^{(L)}}{\partial b^{(L)}}=1
$$

이므로

$$
\frac{\partial C_0}{\partial b^{(L)}}
=
2\left(a^{(L)}-y\right)
\sigma'\left(z^{(L)}\right)
$$

입니다.

이전 activation에 대해서는

$$
\frac{\partial z^{(L)}}{\partial a^{(L-1)}}=w^{(L)}
$$

이므로

$$
\frac{\partial C_0}{\partial a^{(L-1)}}
=
2\left(a^{(L)}-y\right)
\sigma'\left(z^{(L)}\right)
w^{(L)}
$$

입니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-3-backpropagation/09-gradient-components.gif" alt="weight bias 이전 activation에 대한 cost의 partial derivative를 계산하는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

마지막 식이 바로 앞 layer로 전달되는 신호입니다. 이제 이 값을 시작점으로 다시 chain rule을 적용할 수 있습니다.

## **10. Error signal을 정의한다**

실제 network 식을 간결하게 쓰기 위해 layer $l$의 pre-activation에 대한 cost의 derivative를 error signal로 정의합니다.

$$
\boldsymbol{\delta}^{(l)}
\equiv
\frac{\partial C_0}{\partial \mathbf{z}^{(l)}}
$$

출력 layer에서는

$$
\boldsymbol{\delta}^{(L)}
=
\frac{\partial C_0}{\partial \mathbf{a}^{(L)}}
\odot
\sigma'\left(\mathbf{z}^{(L)}\right)
$$

입니다. squared cost를 사용하면

$$
\boldsymbol{\delta}^{(L)}
=
2\left(\mathbf{a}^{(L)}-\mathbf{y}\right)
\odot
\sigma'\left(\mathbf{z}^{(L)}\right)
$$

가 됩니다. $\odot$는 element-wise product입니다.

여기서 $\boldsymbol{\delta}$는 단순히 예측값에서 정답을 뺀 값이 아닙니다. activation function의 local derivative까지 포함한 **pre-activation에 대한 cost의 변화율**입니다.

## **11. 이전 layer의 error를 재귀적으로 계산한다**

다음 layer의 error를 알고 있다면 현재 layer의 error는

$$
\boldsymbol{\delta}^{(l)}
=
\left(W^{(l+1)}\right)^T
\boldsymbol{\delta}^{(l+1)}
\odot
\sigma'\left(\mathbf{z}^{(l)}\right)
$$

로 계산합니다.

이 식은 두 단계를 담고 있습니다.

1. $\left(W^{(l+1)}\right)^T\boldsymbol{\delta}^{(l+1)}$로 다음 layer의 error를 현재 layer 방향으로 모은다.
2. $\sigma'(\mathbf{z}^{(l)})$를 곱해 현재 activation function의 local sensitivity를 반영한다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-3-backpropagation/10-full-network-backprop.gif" alt="여러 neuron이 있는 network에서 chain rule을 이용해 error와 gradient를 역방향 계산하는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

transpose가 등장하는 이유는 forward pass의 선형변환 방향을 거꾸로 따라가며 각 이전 neuron에 연결된 영향을 합쳐야 하기 때문입니다.

## **12. Weight와 bias의 gradient를 얻는다**

layer $l$의 error signal을 구하면 parameter gradient는 바로 계산됩니다.

$$
\frac{\partial C_0}{\partial W^{(l)}}
=
\boldsymbol{\delta}^{(l)}
\left(\mathbf{a}^{(l-1)}\right)^T
$$

$$
\frac{\partial C_0}{\partial \mathbf{b}^{(l)}}
=
\boldsymbol{\delta}^{(l)}
$$

원소 하나로 보면

$$
\frac{\partial C_0}{\partial w_{jk}^{(l)}}
=
\delta_j^{(l)}a_k^{(l-1)}
$$

입니다.

즉 weight gradient는 다음 두 값의 곱입니다.

- 이 연결이 도착하는 neuron의 error signal $\delta_j^{(l)}$
- 이 연결이 출발하는 neuron의 activation $a_k^{(l-1)}$

Chapter 3에서 본 “활성화된 연결이 더 큰 변화를 받는다”는 직관이 이 식에 그대로 나타납니다.

## **13. Forward pass의 값을 저장하는 이유**

backward pass 식에는 $\mathbf{a}^{(l-1)}$, $\mathbf{z}^{(l)}$, $W^{(l)}$가 필요합니다.

그래서 일반적인 학습 과정은 forward pass에서 중간값을 저장해 두고 backward pass에서 재사용합니다.

```text
Forward:
  z[l] = W[l] @ a[l-1] + b[l]
  a[l] = activation(z[l])
  z[l], a[l] 저장

Backward:
  저장한 값으로 delta[l] 계산
  dW[l], db[l] 계산
```

중간값을 저장하면 계산을 줄일 수 있지만 memory를 사용합니다. 깊은 network에서 activation memory가 큰 이유도 여기에 있습니다.

## **14. 왜 각 parameter를 따로 미분하지 않는가**

parameter마다 처음부터 forward 계산을 다시 따라가며 derivative를 구하면 같은 중간 계산이 반복됩니다.

backpropagation은 뒤쪽에서 계산한

$$
\frac{\partial C_0}{\partial \mathbf{z}^{(l)}}
$$

을 앞 layer가 재사용하게 합니다.

```text
한 번의 forward pass로 중간값 계산
한 번의 backward pass로 모든 layer의 gradient 계산
```

이 공유가 핵심입니다. backpropagation은 chain rule 자체가 아니라, 계산 그래프의 공통 부분을 재사용하며 chain rule을 적용하는 효율적인 방법입니다.

## **15. 다음 layer에서 오는 영향을 모두 더한다**

layer $l$의 $k$번째 neuron은 다음 layer의 여러 neuron과 연결됩니다. 따라서 $a_k^{(l)}$이 cost에 미치는 영향은 다음 layer의 각 연결을 통해 전달되는 영향을 모두 더해 구해야 합니다.

다음 layer의 neuron 수를 $n_{l+1}$이라고 하면

$$
\frac{\partial C_0}{\partial a_k^{(l)}}
=
\sum_{j=1}^{n_{l+1}}
\frac{\partial C_0}{\partial z_j^{(l+1)}}
\frac{\partial z_j^{(l+1)}}{\partial a_k^{(l)}}
=
\sum_{j=1}^{n_{l+1}}
w_{jk}^{(l+1)}\delta_j^{(l+1)}
$$

입니다.

- $k$: 현재 layer $l$에서 영향받는 neuron의 index
- $j$: 다음 layer $l+1$에서 error signal을 보내는 neuron의 index
- $w_{jk}^{(l+1)}$: 현재 layer의 $k$번째 neuron에서 다음 layer의 $j$번째 neuron으로 가는 weight
- $\delta_j^{(l+1)}$: 다음 layer의 $j$번째 neuron이 가진 error signal

즉 다음 layer의 각 error signal에 해당 연결 weight를 곱하고, 그 결과를 $j=1$부터 $n_{l+1}$까지 모두 더합니다.

이 계산을 현재 layer의 모든 neuron $k$에 대해 한꺼번에 쓰면

$$
\frac{\partial C_0}{\partial \mathbf{a}^{(l)}}
=
\left(W^{(l+1)}\right)^T\boldsymbol{\delta}^{(l+1)}
$$

입니다. 여기서 activation function의 derivative까지 element-wise로 곱하면 현재 layer의 error signal을 얻습니다.

$$
\boldsymbol{\delta}^{(l)}
=
\frac{\partial C_0}{\partial \mathbf{a}^{(l)}}
\odot
\sigma'\left(\mathbf{z}^{(l)}\right)
=
\left(W^{(l+1)}\right)^T\boldsymbol{\delta}^{(l+1)}
\odot
\sigma'\left(\mathbf{z}^{(l)}\right)
$$

따라서 matrix multiplication은 단순한 표기 축약이 아니라, 다음 layer의 여러 경로에서 오는 영향을 현재 layer의 각 neuron별로 모으는 계산입니다.

## **16. Mini-batch에서는 gradient를 평균낸다**

지금까지는 한 sample의 cost $C_0$를 미분했습니다. 실제 학습에서는 mini-batch $B$에 있는 sample별 gradient를 평균냅니다.

$$
\nabla C_B
=
\frac{1}{|B|}
\sum_{i\in B}
\nabla C_i
$$

그다음 gradient descent가 이 값을 사용합니다.

$$
\theta
\leftarrow
\theta-\eta\nabla C_B
$$

sample 하나가 원하는 변화는 다른 sample이 원하는 변화와 충돌할 수 있습니다. mini-batch 평균은 현재 batch 전체에서 cost를 줄이는 타협된 방향을 만듭니다.

## **17. 전체 알고리즘**

한 mini-batch에 대한 학습 step을 정리하면 다음과 같습니다.

### **17.1 Forward pass**

각 layer에서

$$
\mathbf{z}^{(l)}
=W^{(l)}\mathbf{a}^{(l-1)}+\mathbf{b}^{(l)}
$$

$$
\mathbf{a}^{(l)}=\sigma\left(\mathbf{z}^{(l)}\right)
$$

을 계산하고 중간값을 저장합니다.

### **17.2 Output error**

$$
\boldsymbol{\delta}^{(L)}
=
\frac{\partial C}{\partial \mathbf{a}^{(L)}}
\odot
\sigma'\left(\mathbf{z}^{(L)}\right)
$$

### **17.3 Backward pass**

$$
\boldsymbol{\delta}^{(l)}
=
\left(W^{(l+1)}\right)^T
\boldsymbol{\delta}^{(l+1)}
\odot
\sigma'\left(\mathbf{z}^{(l)}\right)
$$

### **17.4 Parameter gradient**

$$
\frac{\partial C}{\partial W^{(l)}}
=
\boldsymbol{\delta}^{(l)}
\left(\mathbf{a}^{(l-1)}\right)^T
$$

$$
\frac{\partial C}{\partial \mathbf{b}^{(l)}}
=
\boldsymbol{\delta}^{(l)}
$$

### **17.5 Parameter update**

$$
W^{(l)}\leftarrow W^{(l)}-\eta\frac{\partial C}{\partial W^{(l)}}
$$

$$
\mathbf{b}^{(l)}\leftarrow \mathbf{b}^{(l)}-\eta\frac{\partial C}{\partial \mathbf{b}^{(l)}}
$$

## **18. Error signal이 역방향으로 흐르는 과정**

backpropagation을 외울 때는 식보다 정보의 흐름을 먼저 잡는 것이 좋습니다.

1. forward pass에서 현재 예측을 만든다.
2. 출력이 정답에서 얼마나 벗어났는지 측정한다.
3. 출력 neuron의 error signal을 계산한다.
4. weight를 거꾸로 따라가며 이전 layer에 책임을 분배한다.
5. 각 neuron의 error와 이전 activation을 곱해 weight gradient를 만든다.
6. 같은 계산을 입력 쪽으로 반복한다.

> backpropagation은 출력 오차를 계산 그래프의 역방향으로 전달하며, 각 parameter가 그 오차에 얼마나 기여했는지를 chain rule로 계산하는 알고리즘이다.

## **19. 확인 질문**

다음 질문에 답할 수 있으면 이번 글의 흐름을 이해한 것입니다.

1. backpropagation과 gradient descent의 역할은 어떻게 다른가?
2. 왜 weight gradient가 이전 layer의 activation에 비례하는가?
3. 왜 backward 식에 다음 layer weight의 transpose가 등장하는가?
4. $\boldsymbol{\delta}^{(l)}$는 무엇에 대한 derivative인가?
5. forward pass의 activation과 pre-activation을 저장하는 이유는 무엇인가?
6. 한 neuron에서 cost로 가는 경로가 여러 개라면 derivative를 어떻게 합치는가?
7. mini-batch에서는 sample별 gradient를 어떻게 결합하는가?

이제 신경망이 parameter를 학습하는 기본 흐름이 완성되었습니다. forward pass가 예측을 만들고, backpropagation이 gradient를 계산하며, gradient descent가 parameter를 수정합니다.

다음 [4편](/posts/deep-learning-4-transformer/)에서는 이 기본 계산 구조가 Transformer에서는 어떤 순서로 확장되는지 정리합니다.
