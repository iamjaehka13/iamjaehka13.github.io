---
title: "[Deep Learning 2] Gradient Descent와 신경망 학습"
date: 2026-07-17 17:28:51 +0900
categories: [AI, Deep Learning]
tags: [deep-learning, neural-network, 3blue1brown, gradient-descent, cost-function, loss-function, gradient, learning-rate, optimization, mnist]
description: "3Blue1Brown Deep Learning Chapter 2를 바탕으로 cost function, gradient, negative gradient와 learning rate를 연결해 신경망의 parameter가 어느 방향으로 수정되는지 정리한다."
image:
  path: /assets/img/posts/ai/deep-learning-2-gradient-descent/00-preview.png
math: true
---

## **0. 이 글의 질문**

[1편](/posts/deep-learning-1-neural-network-structure/)에서는 신경망을 다음 계산의 반복으로 정리했습니다.

$$
\mathbf{a}^{(l)}
=
\sigma\left(
W^{(l)}\mathbf{a}^{(l-1)}+\mathbf{b}^{(l)}
\right)
$$

입력이 주어지면 weight matrix와 bias vector를 이용해 다음 layer의 activation을 계산합니다.

하지만 가장 중요한 값인 weight와 bias를 어떻게 정해야 하는지는 아직 다루지 않았습니다.

Chapter 1의 신경망에는 13,002개의 parameter가 있습니다. 사람이 이 값을 하나씩 정하는 것은 불가능합니다.

그래서 질문이 바뀝니다.

> 현재 신경망의 오차를 줄이려면 각 parameter를 어느 방향으로 얼마나 수정해야 하는가?

이 글은 3Blue1Brown의 **Deep Learning Chapter 2: Gradient descent, how neural networks learn**을 바탕으로 이 질문에 답합니다.

이번 글에서는 gradient를 실제로 어떻게 효율적으로 계산하는지는 다루지 않습니다. 그 계산 알고리즘인 backpropagation은 [3편](/posts/deep-learning-3-backpropagation/)에서 이어집니다.

## **1. 신경망이 학습한다는 것**

일반적인 프로그램에서는 사람이 규칙을 직접 작성합니다.

```text
입력
→ 사람이 작성한 규칙
→ 출력
```

머신러닝에서는 사람이 모든 규칙을 직접 작성하지 않습니다.

대신 입력과 정답의 예시를 주고, 그 예시에서 오차가 작아지도록 parameter를 조정합니다.

```text
입력과 정답 데이터
→ 오차 측정
→ parameter 수정
→ 더 나은 출력
```

신경망에서 학습의 대상은 구조 자체가 아니라 그 구조 안의 weight와 bias입니다.

$$
\theta
=
\left(
W^{(1)},\mathbf{b}^{(1)},
W^{(2)},\mathbf{b}^{(2)},
W^{(3)},\mathbf{b}^{(3)}
\right)
$$

여기서 $\theta$는 신경망의 모든 parameter를 한꺼번에 나타냅니다.

학습을 한 문장으로 쓰면 다음과 같습니다.

> 신경망의 학습은 좋은 출력을 만들도록 parameter $\theta$를 반복해서 수정하는 과정이다.

## **2. training data와 label**

손글씨 숫자 분류에서는 이미지와 그 이미지가 나타내는 숫자를 한 쌍으로 준비합니다.

$$
(\mathbf{x}^{(i)}, \mathbf{y}^{(i)})
$$

- $\mathbf{x}^{(i)}$: $i$번째 손글씨 이미지의 784개 pixel 값
- $\mathbf{y}^{(i)}$: 그 이미지의 정답 label

숫자 3의 정답 벡터는 다음처럼 표현할 수 있습니다.

$$
\mathbf{y}
=
\begin{bmatrix}
0 & 0 & 0 & 1 & 0 & 0 & 0 & 0 & 0 & 0
\end{bmatrix}^{T}
$$

정답 class인 3의 위치만 1이고 나머지는 0입니다. 이런 표현을 one-hot vector라고 합니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-2-gradient-descent/01-training-data.gif" alt="label이 있는 손글씨 이미지를 이용해 신경망을 학습하는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

학습 데이터는 신경망이 무엇을 출력해야 하는지를 알려줍니다.

하지만 label만 제공한다고 parameter가 자동으로 바뀌지는 않습니다. 현재 출력이 정답에서 얼마나 벗어났는지를 하나의 숫자로 측정해야 합니다.

## **3. 한 sample의 오차 측정**

현재 parameter가 $\theta$일 때 입력 $\mathbf{x}^{(i)}$에 대한 신경망의 출력은

$$
\hat{\mathbf{y}}^{(i)}
=
f_{\theta}(\mathbf{x}^{(i)})
$$

입니다.

정답은 $\mathbf{y}^{(i)}$이므로 두 벡터의 차이를 이용해 오차를 만들 수 있습니다.

$$
C_i(\theta)
=
\left\|
f_{\theta}(\mathbf{x}^{(i)})
-
\mathbf{y}^{(i)}
\right\|^2
$$

출력 neuron별로 쓰면

$$
C_i(\theta)
=
\sum_{j=0}^{9}
\left(
a_j^{(L,i)}-y_j^{(i)}
\right)^2
$$

입니다.

정답에 가까운 출력이면 cost가 작습니다.

정답과 크게 다른 출력이면 cost가 큽니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-2-gradient-descent/02-sample-cost.gif" alt="신경망의 출력과 정답 출력 사이의 차이로 한 sample의 cost를 계산하는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

여기서는 squared error를 사용하지만 모든 분류 문제에서 항상 같은 loss를 사용하는 것은 아닙니다. 현대적인 분류 모델에서는 softmax와 cross-entropy 조합을 자주 사용합니다.

중요한 것은 구체적인 식보다 역할입니다.

> cost는 현재 parameter가 원하는 동작을 얼마나 잘 만들고 있는지 평가하는 숫자다.

## **4. 한 sample만 잘 맞추면 안 된다**

하나의 이미지에 대해서만 cost를 줄이면 신경망이 그 이미지 하나만 잘 맞추도록 바뀔 수 있습니다.

우리가 원하는 것은 여러 손글씨 이미지에서 공통으로 작동하는 parameter입니다.

그래서 전체 training data의 cost를 평균냅니다.

$$
C(\theta)
=
\frac{1}{N}
\sum_{i=1}^{N}
C_i(\theta)
$$

이를 대입하면

$$
C(\theta)
=
\frac{1}{N}
\sum_{i=1}^{N}
\left\|
f_{\theta}(\mathbf{x}^{(i)})
-
\mathbf{y}^{(i)}
\right\|^2
$$

입니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-2-gradient-descent/03-average-cost.gif" alt="여러 training sample의 cost를 평균내 전체 cost function을 만드는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

이제 신경망 학습은 명확한 최적화 문제로 바뀝니다.

$$
\theta^*
=
\operatorname*{arg\,min}_{\theta}
C(\theta)
$$

즉 전체 training data에 대한 cost가 작아지는 parameter $\theta^*$를 찾는 문제입니다.

## **5. cost function의 입력은 parameter다**

신경망 함수와 cost function의 입력을 구분해야 합니다.

### **5.1 신경망 함수**

$$
f_{\theta}(\mathbf{x})
$$

- 입력: 이미지 $\mathbf{x}$
- 고정된 값: 현재 parameter $\theta$
- 출력: 예측 $\hat{\mathbf{y}}$

### **5.2 cost function**

$$
C(\theta)
$$

- 입력: 모든 weight와 bias $\theta$
- 고정된 값: training data
- 출력: 전체 예측이 얼마나 나쁜지를 나타내는 하나의 숫자

Chapter 1의 네트워크에서는 $\theta$가 13,002개의 성분을 가집니다.

$$
\theta \in \mathbb{R}^{13002}
$$

따라서 cost function은 개념적으로 다음 함수입니다.

$$
C:
\mathbb{R}^{13002}
\rightarrow
\mathbb{R}
$$

13,002차원의 parameter vector를 받아 하나의 cost를 출력합니다.

이 공간은 직접 그릴 수 없습니다. 그래서 먼저 parameter가 하나뿐인 단순한 상황부터 생각합니다.

## **6. parameter가 하나라면 slope를 본다**

cost가 하나의 parameter $w$에만 의존한다고 가정해봅시다.

$$
C(w)
$$

목표는 $C(w)$가 가장 작은 지점으로 이동하는 것입니다.

현재 위치에서 derivative가 양수라면 $w$가 증가할수록 cost가 커진다는 뜻입니다. 따라서 $w$를 줄여야 합니다.

$$
\frac{dC}{dw} > 0
\quad\Rightarrow\quad
w \text{를 감소}
$$

derivative가 음수라면 $w$가 증가할수록 cost가 작아지는 방향입니다. 따라서 $w$를 늘려야 합니다.

$$
\frac{dC}{dw} < 0
\quad\Rightarrow\quad
w \text{를 증가}
$$

두 경우를 하나의 식으로 묶으면 다음과 같습니다.

$$
w_{t+1}
=
w_t
-
\eta
\frac{dC}{dw}(w_t)
$$

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-2-gradient-descent/04-one-dimensional-descent.gif" alt="cost function의 slope를 따라 parameter를 반복적으로 이동해 local minimum에 접근하는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

derivative와 반대 방향으로 움직이기 때문에 cost가 낮아지는 쪽으로 이동합니다.

이 과정을 새로운 위치에서 반복하면 valley의 아래쪽에 접근합니다.

## **7. parameter가 여러 개라면 gradient를 본다**

parameter가 두 개라면 cost function은 다음과 같습니다.

$$
C(w_1,w_2)
$$

이를 높이로 그리면 2차원 parameter plane 위에 놓인 surface가 됩니다.

현재 위치에서 $w_1$ 방향의 변화는 $\frac{\partial C}{\partial w_1}$이 나타냅니다.

$w_2$ 방향의 변화는 $\frac{\partial C}{\partial w_2}$가 나타냅니다.

두 partial derivative를 하나의 vector로 모은 것이 gradient입니다.

$$
\nabla C
=
\begin{bmatrix}
\frac{\partial C}{\partial w_1} \\
\frac{\partial C}{\partial w_2}
\end{bmatrix}
$$

<figure class="my-3">
  <img src="https://media.iamjaehka13.blog/assets/img/posts/ai/deep-learning-2-gradient-descent/05-gradient-surface.gif" alt="두 parameter의 cost surface에서 gradient와 가장 빠르게 감소하는 방향을 찾는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

gradient $\nabla C$는 현재 위치에서 cost가 가장 빠르게 증가하는 방향을 가리킵니다.

따라서 cost를 가장 빠르게 줄이는 방향은 negative gradient입니다.

$$
-\nabla C
$$

## **8. Gradient Descent update**

모든 parameter를 vector $\theta$로 묶으면 update rule은 다음과 같습니다.

$$
\boxed{
\theta_{t+1}
=
\theta_t
-
\eta\nabla_{\theta}C(\theta_t)
}
$$

각 기호의 의미는 다음과 같습니다.

| 기호 | 의미 |
|---|---|
| $\theta_t$ | 현재 step의 모든 parameter |
| $C(\theta_t)$ | 현재 parameter의 cost |
| $\nabla_{\theta}C(\theta_t)$ | cost가 가장 빠르게 증가하는 방향 |
| $-\nabla_{\theta}C(\theta_t)$ | cost가 가장 빠르게 감소하는 방향 |
| $\eta$ | 한 번에 이동할 크기를 정하는 learning rate |

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-2-gradient-descent/06-negative-gradient.gif" alt="negative gradient 방향으로 반복 이동해 cost function의 valley에 접근하는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

Gradient Descent는 이 update를 반복하는 알고리즘입니다.

```text
현재 parameter로 예측한다.
→ cost를 계산한다.
→ gradient를 계산한다.
→ negative gradient 방향으로 parameter를 이동한다.
→ 다시 cost를 계산한다.
→ 반복한다.
```

## **9. learning rate는 step의 크기다**

learning rate $\eta$는 negative gradient 방향으로 한 번에 얼마나 이동할지를 결정합니다.

### **9.1 learning rate가 너무 작을 때**

```text
한 step의 변화가 작다.
학습이 안정적일 수 있다.
minimum에 도달하는 데 오래 걸릴 수 있다.
```

### **9.2 learning rate가 너무 클 때**

```text
빠르게 이동할 수 있다.
minimum을 지나칠 수 있다.
cost가 진동하거나 발산할 수 있다.
```

그래서 $\eta$는 단순히 클수록 좋은 값이 아닙니다.

gradient 자체의 크기도 step에 영향을 줍니다. surface가 가파르면 gradient가 크고, minimum에 가까워져 surface가 평평해지면 gradient가 작아집니다.

하지만 실제 학습에서는 cost surface의 방향마다 scale이 다르고 noise도 있기 때문에 learning rate schedule이나 adaptive optimizer를 사용하기도 합니다.

이번 글에서는 가장 기본적인 Gradient Descent update의 의미에 집중합니다.

## **10. gradient의 각 성분이 말해주는 것**

13,002개의 parameter를 하나의 vector로 쓰면

$$
\theta
=
\begin{bmatrix}
\theta_1 \\
\theta_2 \\
\vdots \\
\theta_{13002}
\end{bmatrix}
$$

이고, gradient도 같은 shape을 가집니다.

$$
\nabla_{\theta}C
=
\begin{bmatrix}
\frac{\partial C}{\partial \theta_1} \\
\frac{\partial C}{\partial \theta_2} \\
\vdots \\
\frac{\partial C}{\partial \theta_{13002}}
\end{bmatrix}
$$

각 성분의 부호는 해당 parameter를 증가시켜야 하는지 감소시켜야 하는지를 알려줍니다.

각 성분의 절댓값은 그 parameter의 작은 변화가 현재 cost에 얼마나 민감하게 연결되는지를 알려줍니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-2-gradient-descent/07-parameter-updates.gif" alt="negative gradient의 각 성분이 개별 weight의 증가와 감소 방향을 나타내는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

예를 들어

$$
\frac{\partial C}{\partial \theta_k}
=
-1.25
$$

라면 $\theta_k$를 증가시키는 것이 cost를 줄이는 방향입니다.

update 식에 음수가 한 번 더 들어가기 때문입니다.

$$
\theta_k
\leftarrow
\theta_k
-
\eta(-1.25)
$$

반대로 gradient 성분이 큰 양수라면 그 parameter를 감소시키는 방향으로 update됩니다.

## **11. 13,002차원에서도 원리는 같다**

2차원 surface는 시각화를 위한 비유입니다.

실제 신경망에서는 parameter 하나가 공간의 축 하나에 대응합니다.

```text
1번째 축  → 첫 번째 weight
2번째 축  → 두 번째 weight
...
13002번째 축 → 마지막 bias
```

parameter의 현재 상태는 13,002차원 공간의 한 점입니다.

cost function은 그 점마다 하나의 높이를 대응시킵니다.

gradient는 그 공간에서 cost가 가장 빠르게 증가하는 방향이고, negative gradient는 cost가 가장 빠르게 감소하는 방향입니다.

<figure class="my-3">
  <img src="/assets/img/posts/ai/deep-learning-2-gradient-descent/08-high-dimensional-update.gif" alt="모든 weight와 bias를 negative gradient 방향으로 함께 수정하는 과정" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

차원은 크게 늘어나지만 update의 의미는 바뀌지 않습니다.

$$
\theta
\leftarrow
\theta
-
\eta\nabla_{\theta}C
$$

## **12. local minimum과 initialization**

신경망의 cost function은 일반적으로 단순한 그릇 모양의 convex function이 아닙니다.

valley와 평평한 영역, saddle point가 섞인 복잡한 surface입니다.

따라서 시작 위치인 initialization에 따라 이동 경로가 달라질 수 있습니다.

Gradient Descent가 도달한 지점이 전체 공간에서 가장 낮은 global minimum이라는 보장도 없습니다.

이 점 때문에 실제 학습에서는 다음 요소들이 중요해집니다.

```text
parameter initialization
learning rate
optimizer
batch 구성
normalization
network architecture
```

다만 신경망 학습에서 항상 정확한 global minimum을 찾아야만 좋은 모델이 되는 것은 아닙니다. training data와 unseen data에서 충분히 좋은 성능을 내는 parameter 영역을 찾는 것이 실제 목표에 더 가깝습니다.

## **13. training cost와 generalization은 다르다**

Gradient Descent가 직접 줄이는 것은 training data에 대해 정의한 cost입니다.

$$
C_{train}(\theta)
$$

training cost가 작다고 해서 새로운 입력에서도 반드시 좋은 성능을 내는 것은 아닙니다.

모델이 training example을 지나치게 외우면 overfitting이 발생할 수 있습니다.

그래서 데이터의 역할을 구분합니다.

| 데이터 | 역할 |
|---|---|
| Training set | parameter update에 사용 |
| Validation set | hyperparameter 선택과 학습 상태 점검에 사용 |
| Test set | 최종 generalization 성능 평가에 사용 |

학습의 계산 목표는 cost 최소화이지만, 모델을 사용하는 목적은 보지 못한 데이터에서도 올바르게 작동하는 것입니다.

## **14. 왜 smooth한 함수가 필요한가**

Gradient Descent는 현재 위치의 미분값을 이용해 다음 이동 방향을 정합니다.

따라서 parameter가 조금 바뀌었을 때 cost도 해석 가능한 방식으로 조금씩 변하는 것이 중요합니다.

만약 출력이 대부분의 구간에서 완전히 고정되어 있고 특정 경계에서만 갑자기 바뀐다면, 작은 parameter 변화가 어느 방향으로 도움이 되는지 gradient가 알려주기 어렵습니다.

이것이 신경망에서 differentiable activation과 smooth한 loss가 중요한 이유 중 하나입니다.

다만 sigmoid가 smooth하다는 이유만으로 항상 최선인 것은 아닙니다. 깊은 네트워크에서는 gradient가 매우 작아지는 saturation 문제가 있을 수 있어 ReLU 계열 activation을 자주 사용합니다.

## **15. 실제 계산에서는 mini-batch를 사용한다**

전체 training data가 매우 크면 매 update마다 모든 sample의 cost와 gradient를 계산하기 어렵습니다.

그래서 실제 학습에서는 일부 sample을 모은 mini-batch를 사용합니다.

$$
C_{B}(\theta)
=
\frac{1}{|B|}
\sum_{i\in B}
C_i(\theta)
$$

그리고 mini-batch gradient로 parameter를 update합니다.

$$
\theta
\leftarrow
\theta
-
\eta\nabla_{\theta}C_B(\theta)
$$

mini-batch gradient는 전체 dataset의 정확한 gradient는 아니지만, 계산 비용을 줄이고 반복적인 update를 가능하게 합니다.

이 방식이 **mini-batch stochastic gradient descent**의 기본 형태입니다.

## **16. Gradient Descent가 답하지 않는 질문**

Gradient Descent는 다음을 알려줍니다.

```text
gradient를 알고 있다면
각 parameter를 어느 방향으로 수정해야 하는가?
```

하지만 아직 다음 질문이 남습니다.

```text
13,002개 parameter 각각에 대한
cost의 partial derivative를
어떻게 효율적으로 계산하는가?
```

각 parameter를 조금씩 직접 바꾸어 cost 변화를 확인하는 방식은 너무 느립니다.

신경망의 layer 구조와 chain rule을 이용해 모든 gradient를 효율적으로 계산하는 알고리즘이 backpropagation입니다.

따라서 두 개념의 역할을 구분해야 합니다.

```text
Gradient Descent
→ 계산된 gradient를 이용해 parameter를 어떻게 update할 것인가

Backpropagation
→ 그 gradient를 신경망 내부에서 어떻게 계산할 것인가
```

## **17. 전체 흐름 요약**

신경망이 학습하는 전체 흐름은 다음과 같습니다.

```text
1. 입력과 정답으로 구성된 training data를 준비한다.
2. 현재 parameter로 forward pass를 수행한다.
3. 예측과 정답의 차이로 sample cost를 계산한다.
4. 여러 sample의 cost를 모아 cost function을 만든다.
5. cost function의 gradient를 계산한다.
6. negative gradient 방향으로 parameter를 update한다.
7. 이 과정을 반복한다.
```

핵심 식은 다음과 같습니다.

$$
\boxed{
\theta_{t+1}
=
\theta_t
-
\eta\nabla_{\theta}C(\theta_t)
}
$$

그리고 이 식의 의미는 다음 한 문장으로 정리할 수 있습니다.

> Gradient Descent는 cost를 가장 빠르게 줄이는 방향을 따라 신경망의 weight와 bias를 반복적으로 수정하는 방법이다.

다음 [3편](/posts/deep-learning-3-backpropagation/)에서는 이 update에 필요한 $\nabla_{\theta}C$를 각 layer를 거꾸로 따라가며 어떻게 계산하는지 backpropagation의 직관과 calculus를 함께 정리합니다.
