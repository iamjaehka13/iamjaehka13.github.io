---
title: "[Deep Learning 1] 신경망의 계산 구조"
date: 2026-07-17 16:54:08 +0900
last_modified_at: 2026-07-27 22:47:54 +0900
categories: [AI, Deep Learning]
tags: [deep-learning, neural-network, 3blue1brown, neuron, activation, weight, bias, sigmoid, mnist, forward-pass]
description: "3Blue1Brown Deep Learning Chapter 1을 바탕으로 neuron, activation, weight, bias, layer와 forward pass를 연결해 신경망의 계산 구조를 정리한다."
image:
  path: /assets/img/posts/ai/deep-learning-1-neural-network-structure/00-preview-color.png
math: true
---

## **0. 이 글의 질문**

신경망을 처음 보면 여러 층의 원과 그 사이를 잇는 수많은 선부터 보인다. 실제 뇌를 흉내 낸 복잡한 장치처럼 느껴지지만, 계산만 떼어 보면 아래 연산의 반복.

```text
숫자를 입력한다.
입력에 weight를 곱한다.
결과를 더하고 bias를 붙인다.
activation function을 통과시킨다.
이 과정을 여러 층에서 반복한다.
```

3Blue1Brown의 **Deep Learning Chapter 1: But what is a neural network?**를 따라가며 아래 질문부터 확인한다.

> 신경망은 입력을 받아 출력을 만드는 어떤 계산 구조인가?

이번 글에서는 신경망이 parameter를 어떻게 학습하는지는 다루지 않는다. 먼저 학습의 대상이 되는 계산 구조 자체를 분명하게 이해한다.

## **1. 손글씨 숫자 인식 문제**

신경망의 구조를 보기 위해 손글씨 숫자 이미지를 분류하는 문제를 생각해봅시다.

입력 이미지는 $28 \times 28$ pixel로 구성된다. 각 pixel의 밝기를 0과 1 사이의 숫자로 표현하면 이미지 하나는 총 784개의 숫자가 된다.

$$
28 \times 28 = 784
$$

2차원 이미지를 한 줄로 펼치면 다음과 같은 벡터로 나타낼 수 있다.

$$
\mathbf{a}^{(0)}
=
\begin{bmatrix}
a_1^{(0)} \\
a_2^{(0)} \\
\vdots \\
a_{784}^{(0)}
\end{bmatrix}
\in \mathbb{R}^{784}
$$

여기서 각 성분은 특정 pixel의 밝기.

```text
0에 가까운 값  → 어두운 pixel
1에 가까운 값  → 밝은 pixel
```

즉 신경망은 이미지를 그림 그대로 받는 것이 아니다. 이미지를 표현하는 784차원 벡터를 입력으로 받는다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-1-neural-network-structure/01-input-activation.gif" alt="손글씨 이미지의 pixel 밝기가 input neuron의 activation으로 변환되는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

출력은 숫자 0부터 9까지 총 10개의 값이다.

$$
\mathbf{a}^{(3)} \in \mathbb{R}^{10}
$$

출력층의 각 성분은 입력 이미지가 특정 숫자에 해당한다고 네트워크가 판단하는 정도를 나타낸다.

```text
입력: 784개의 pixel 밝기
출력: 0부터 9까지의 숫자에 대응하는 10개의 값
```

따라서 이 신경망 전체는 784개의 숫자를 받아 10개의 숫자로 바꾸는 함수.

$$
f: \mathbb{R}^{784} \rightarrow \mathbb{R}^{10}
$$

## **2. neuron과 activation**

신경망 그림의 원 하나를 neuron이라고 부른다.

여기서 neuron을 생물학적인 신경세포로 복잡하게 생각할 필요는 없다. 계산 구조를 이해할 때 neuron은 하나의 숫자를 담는 자리.

그 숫자를 **activation**이라고 한다.

$$
a_j^{(l)}
$$

- $l$: 몇 번째 layer인지 나타낸다.
- $j$: 그 layer 안에서 몇 번째 neuron인지 나타낸다.

activation이 크다는 것은 그 neuron이 현재 입력에 강하게 반응했다는 뜻으로 볼 수 있다.

다만 activation의 의미가 항상 사람이 해석할 수 있는 하나의 개념과 정확히 대응하는 것은 아니다. 어떤 neuron 하나가 반드시 선, 원, 눈, 바퀴처럼 명확한 특징 하나만 담당한다고 단정할 수는 없다.

중요한 점은 이것이다.

> neuron은 값을 저장하는 위치이고, activation은 현재 입력이 들어왔을 때 그 위치에 계산된 값이다.

## **3. layer는 무엇인가**

neuron들을 모아 놓은 한 묶음을 layer라고 한다.

Chapter 1의 손글씨 분류 예시는 다음 구조를 사용한다.

| Layer | Neuron 수 | 역할 |
|---|---:|---|
| Input layer | 784 | pixel 밝기를 입력받음 |
| Hidden layer 1 | 16 | 입력을 새로운 표현으로 변환 |
| Hidden layer 2 | 16 | 앞 layer의 표현을 다시 변환 |
| Output layer | 10 | 숫자 0부터 9에 대한 출력 생성 |

이를 크기만 표시하면:

```text
784 → 16 → 16 → 10
```

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-1-neural-network-structure/02-network-layers.gif" alt="784개의 input neuron과 두 hidden layer, 10개의 output neuron으로 구성된 신경망" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

첫 번째 layer는 입력 데이터를 담기 때문에 input layer라고 한다.

마지막 layer는 최종 결과를 만들기 때문에 output layer라고 한다.

그 사이의 layer는 외부에서 정답을 직접 지정하지 않은 내부 표현을 만들기 때문에 hidden layer라고 한다.

`deep` neural network에서 **deep**은 이런 변환 layer가 여러 단계로 쌓여 있다는 뜻.

## **4. weight는 연결의 영향력이다**

앞 layer의 모든 neuron은 다음 layer의 neuron 계산에 사용된다.

앞 layer의 activation $a_k^{(l-1)}$이 다음 layer의 neuron $a_j^{(l)}$에 얼마나 영향을 주는지는 weight로 표현한다.

$$
w_{jk}^{(l)}
$$

이 weight는 이전 layer의 $k$번째 neuron에서 현재 layer의 $j$번째 neuron으로 들어오는 연결의 세기.

하나의 neuron은 이전 layer의 activation에 각각의 weight를 곱한 뒤 모두 더한다.

$$
z_j^{(l)}
=
\sum_k w_{jk}^{(l)}a_k^{(l-1)}
$$

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-1-neural-network-structure/03-weighted-sum.gif" alt="이전 layer의 activation과 weight를 이용해 weighted sum을 계산하는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

weight의 부호와 크기는 각 입력의 영향 방향을 나타낸다.

```text
큰 양수 weight  → 입력 activation이 커질수록 현재 neuron을 강하게 활성화
큰 음수 weight  → 입력 activation이 커질수록 현재 neuron을 억제
0에 가까운 weight → 현재 neuron에 미치는 영향이 작음
```

결국 weight는 네트워크가 입력의 어떤 조합에 반응할지를 결정한다.

## **5. bias는 활성화 기준을 이동시킨다**

weighted sum만으로는 neuron이 반응하기 시작하는 기준을 자유롭게 옮기기 어렵다.

그래서 neuron마다 bias를 더한다.

$$
z_j^{(l)}
=
\sum_k w_{jk}^{(l)}a_k^{(l-1)} + b_j^{(l)}
$$

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-1-neural-network-structure/05-bias.gif" alt="weighted sum에 bias를 더해 neuron의 활성화 기준을 조절하는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

bias는 neuron이 얼마나 쉽게 또는 어렵게 활성화될지를 조절하는 값으로 볼 수 있다.

예를 들어 weighted sum이 어느 정도 커져야 반응해야 하는 neuron이 있다면, bias를 이용해 그 기준을 이동시킬 수 있다.

선형대수 관점에서 본 weight와 bias의 차이:

```text
weight → 입력 공간을 늘리고, 줄이고, 섞는 역할
bias   → 변환된 결과 전체를 이동시키는 역할
```

그래서 $W\mathbf{a}+\mathbf{b}$는 순수한 linear transformation이 아니라 affine transformation이다.

## **6. activation function은 왜 필요한가**

weighted sum과 bias를 계산한 값 $z$는 그대로 다음 activation이 되지 않는다.

여기에 activation function을 적용한다.

Chapter 1에서는 sigmoid function을 사용한다.

$$
\sigma(z)
=
\frac{1}{1+e^{-z}}
$$

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-1-neural-network-structure/04-sigmoid.gif" alt="실수 입력을 0과 1 사이로 변환하는 sigmoid function" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

따라서 neuron 하나의 최종 activation:

$$
a_j^{(l)}
=
\sigma\left(
\sum_k w_{jk}^{(l)}a_k^{(l-1)} + b_j^{(l)}
\right)
$$

sigmoid는 매우 작은 값을 0에 가깝게, 매우 큰 값을 1에 가깝게 압축한다.

하지만 activation function의 더 중요한 역할은 **nonlinearity**를 추가하는 것.

만약 activation function 없이 행렬곱만 여러 번 적용하면

$$
W_3(W_2(W_1\mathbf{x}))
$$

는 결국 하나의 행렬 $W$를 곱하는 것과 같다.

$$
W_3W_2W_1\mathbf{x}
=
W\mathbf{x}
$$

layer를 여러 개 쌓아도 전체는 하나의 linear transformation을 벗어나지 못한다.

각 layer 사이에 nonlinear activation function이 들어가야 신경망이 단순한 직선이나 평면으로 표현할 수 없는 복잡한 관계를 만들 수 있다.

현대 신경망에서는 ReLU, GELU, SiLU 같은 다른 activation function도 많이 사용한다. 하지만 구체적인 함수가 달라져도 기본 구조는 같다.

```text
affine transformation
→ nonlinear activation
→ affine transformation
→ nonlinear activation
→ ...
```

## **7. 한 layer를 행렬로 표현하기**

neuron별 식을 하나씩 쓰면 연결 수가 늘어날수록 표현이 복잡해진다.

이를 행렬과 벡터로 묶으면 한 layer의 계산을 간단히 나타낼 수 있다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-1-neural-network-structure/06-weight-matrix.gif" alt="neuron별 weight를 하나의 weight matrix로 정리하는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

$$
\mathbf{a}^{(l)}
=
\sigma\left(
W^{(l)}\mathbf{a}^{(l-1)}
+
\mathbf{b}^{(l)}
\right)
$$

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-1-neural-network-structure/07-layer-vector-form.gif" alt="weight matrix와 activation vector, bias vector로 layer 계산을 표현하는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

예를 들어 784개의 입력을 16개의 hidden neuron으로 바꾸는 첫 번째 layer의 shape:

$$
W^{(1)} \in \mathbb{R}^{16 \times 784}
$$

$$
\mathbf{a}^{(0)} \in \mathbb{R}^{784},
\qquad
\mathbf{b}^{(1)} \in \mathbb{R}^{16}
$$

따라서

$$
W^{(1)}\mathbf{a}^{(0)} + \mathbf{b}^{(1)}
\in
\mathbb{R}^{16}
$$

이 된다.

전체 layer의 shape:

| 변환 | Weight matrix | Bias vector | 출력 activation |
|---|---|---|---|
| Input → Hidden 1 | $W^{(1)} \in \mathbb{R}^{16\times784}$ | $\mathbf{b}^{(1)} \in \mathbb{R}^{16}$ | $\mathbf{a}^{(1)} \in \mathbb{R}^{16}$ |
| Hidden 1 → Hidden 2 | $W^{(2)} \in \mathbb{R}^{16\times16}$ | $\mathbf{b}^{(2)} \in \mathbb{R}^{16}$ | $\mathbf{a}^{(2)} \in \mathbb{R}^{16}$ |
| Hidden 2 → Output | $W^{(3)} \in \mathbb{R}^{10\times16}$ | $\mathbf{b}^{(3)} \in \mathbb{R}^{10}$ | $\mathbf{a}^{(3)} \in \mathbb{R}^{10}$ |

이 표에서 행렬의 행 수는 현재 layer의 neuron 수이고, 열 수는 이전 layer의 neuron 수.

## **8. parameter는 무엇인가**

신경망에서 학습을 통해 바뀌는 값을 parameter라고 한다.

이 기본 신경망에서는 weight와 bias가 parameter이다.

```text
parameter = 모든 weight + 모든 bias
```

각 layer의 parameter 수를 계산해봅시다.

### **8.1 Input에서 Hidden 1**

$$
784 \times 16 + 16 = 12{,}560
$$

### **8.2 Hidden 1에서 Hidden 2**

$$
16 \times 16 + 16 = 272
$$

### **8.3 Hidden 2에서 Output**

$$
16 \times 10 + 10 = 170
$$

전체 parameter 수는

$$
12{,}560 + 272 + 170 = 13{,}002
$$


여기서 parameter와 activation을 구분해야 한다.

| 구분 | 의미 | 입력이 바뀌면 |
|---|---|---|
| Parameter | 학습된 weight와 bias | 같은 모델에서는 유지됨 |
| Activation | 현재 입력을 통과시키며 계산된 중간값 | 입력마다 달라짐 |

학습은 parameter를 조정하는 과정이고, inference는 고정된 parameter를 사용해 activation과 출력을 계산하는 과정.

## **9. forward pass**

입력에서 출력 방향으로 activation을 차례대로 계산하는 과정을 forward pass 또는 forward propagation이라고 한다.

이 네트워크에서는 다음 세 계산이 순서대로 실행된다.

$$
\mathbf{a}^{(1)}
=
\sigma\left(W^{(1)}\mathbf{a}^{(0)}+\mathbf{b}^{(1)}\right)
$$

$$
\mathbf{a}^{(2)}
=
\sigma\left(W^{(2)}\mathbf{a}^{(1)}+\mathbf{b}^{(2)}\right)
$$

$$
\mathbf{a}^{(3)}
=
\sigma\left(W^{(3)}\mathbf{a}^{(2)}+\mathbf{b}^{(3)}\right)
$$

이를 하나의 함수로 쓰면:

$$
f(\mathbf{x})
=
\sigma\left(
W^{(3)}
\sigma\left(
W^{(2)}
\sigma\left(
W^{(1)}\mathbf{x}+\mathbf{b}^{(1)}
\right)
+\mathbf{b}^{(2)}
\right)
+\mathbf{b}^{(3)}
\right)
$$

복잡해 보이지만 실제 구조는 같은 연산의 반복이다.

```text
입력 벡터
→ 행렬곱
→ bias 더하기
→ activation function
→ 행렬곱
→ bias 더하기
→ activation function
→ 출력 벡터
```

따라서 신경망 전체는 여러 함수가 순서대로 합성된 하나의 함수.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-1-neural-network-structure/08-network-function.gif" alt="784개의 입력을 10개의 출력으로 변환하는 하나의 함수로서의 신경망" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

## **10. hidden layer는 무엇을 표현하는가**

손글씨 숫자를 분류하려면 pixel 밝기만 보는 것보다 선, 곡선, 원처럼 더 높은 수준의 특징을 찾는 것이 유용해 보인다.

그래서 다음과 같은 계층적 표현을 떠올릴 수 있다.

```text
pixel
→ 짧은 선과 곡선
→ 여러 선이 결합된 부분 형태
→ 완성된 숫자
```

이 관점은 hidden layer가 왜 필요한지에 대한 좋은 직관을 준다. 앞 layer의 단순한 정보를 조합해 다음 layer에서 더 유용한 표현을 만들 수 있기 때문.

다만 실제로 학습된 fully connected network의 neuron이 사람이 기대한 특징을 항상 깔끔하게 분리해 표현하는 것은 아니다.

신경망은 사람이 직접 `이 neuron은 원을 찾아라`라고 지정해서 완성하는 구조가 아니다. 학습 과정에서 task의 오차를 줄이는 방향으로 weight와 bias가 조정되고, 그 결과 내부 표현이 형성된다.

따라서 hidden representation은 설계자의 직관과 비슷할 수도 있고, 여러 특징이 분산되어 사람이 해석하기 어려운 형태일 수도 있다.

## **11. 선형대수와 연결해서 보기**

신경망의 한 layer는 선형대수에서 본 구조와 직접 연결된다.

$$
\mathbf{a}^{(l)}
=
\sigma\left(W^{(l)}\mathbf{a}^{(l-1)}+\mathbf{b}^{(l)}\right)
$$

이 식을 단계별로 보면:

```text
W a  → vector를 다른 표현 공간으로 보내는 linear transformation
+ b  → 변환 결과를 이동시키는 translation
σ    → nonlinear한 변형을 추가
```

행렬의 각 행은 현재 layer의 neuron 하나가 이전 layer의 activation을 어떤 방식으로 조합하는지 나타낸다.

행렬의 각 열은 이전 layer의 neuron 하나가 현재 layer 전체에 어떤 영향을 주는지 나타낸다.

신경망이 큰 규모의 행렬곱을 반복하는 이유도 여기에 있다. 수많은 neuron의 weighted sum을 각각 계산하는 대신, 하나의 matrix-vector multiplication 또는 matrix-matrix multiplication으로 묶어 효율적으로 처리할 수 있다.

## **12. 이 글에서 구분해야 할 것**

### **12.1 neuron은 실제 뇌세포와 같지 않다**

인공신경망은 생물학적 신경계에서 아이디어를 얻었지만, 실제 뇌의 동작을 그대로 복제한 모델은 아니다.

계산 관점에서는 neuron을 숫자를 출력하는 함수 단위로 보는 편이 정확하다.

### **12.2 layer가 깊다고 무조건 좋은 것은 아니다**

layer와 parameter가 많아지면 더 복잡한 함수를 표현할 가능성은 커진다. 하지만 학습 비용, overfitting, 최적화 난이도도 함께 증가한다.

### **12.3 출력값이 곧 확률인 것은 아니다**

출력 activation이 크다는 것은 해당 class에 강하게 반응했다는 뜻이다. 이를 올바른 확률로 해석하려면 출력 activation과 loss function의 설계를 함께 봐야 한다.

### **12.4 구조와 학습은 다른 문제다**

지금까지 본 식은 현재 parameter가 주어졌을 때 출력을 계산하는 방법.

```text
구조: 주어진 weight와 bias로 출력을 어떻게 계산하는가?
학습: 좋은 출력을 만들도록 weight와 bias를 어떻게 수정하는가?
```

이번 글은 첫 번째 질문에 답했다. 두 번째 질문은 gradient descent에서 시작한다.

## **13. 한 번의 forward pass**

손글씨 숫자 분류에서는 28×28 이미지를 784차원 vector로 펼친 뒤, 각 layer에서 weight와 bias로 표현을 바꾸고 activation function을 적용한다. Hidden layer에서 이 계산을 반복한 결과가 output layer의 10개 값.

```text
image → input vector → affine transformation
      → nonlinear activation → hidden layers
      → 10-dimensional output
```

$$
\boxed{
\mathbf{a}^{(l)}
=
\sigma\left(
W^{(l)}\mathbf{a}^{(l-1)}
+
\mathbf{b}^{(l)}
\right)
}
$$

이 식을 여러 번 합성한 전체 네트워크도 결국 하나의 parameterized function이다.

> 신경망은 벡터를 입력받아, affine transformation과 nonlinear activation을 반복하고, 새로운 벡터를 출력하는 parameterized function이다.

다음 [2편](/posts/deep-learning-2-gradient-descent/)에서는 이 13,002개의 parameter를 무작정 바꾸는 대신, 오차를 가장 빠르게 줄이는 방향을 어떻게 찾는지 gradient descent를 중심으로 정리한다.
