---
title: "[Linear Algebra] 3Blue1Brown 선형대수학의 본질 정리"
date: 2026-07-10 16:21:54 +0900
last_modified_at: 2026-07-17 16:04:25 +0900
categories: [Math, Study]
tags: [linear-algebra, 3blue1brown, vector, matrix, determinant, eigenvalue, eigenvector, basis, dot-product, cross-product, cramer-rule]
description: "3Blue1Brown의 선형대수학의 본질 시리즈를 바탕으로 벡터, 선형결합, 기저, 행렬, 행렬곱, determinant, 역행렬, 내적, 외적, 고유값, 고유벡터, 추상 벡터공간을 시각적 관점에서 정리한다."
image:
  path: /assets/img/posts/math/linear-algebra-3b1b/00-linear-algebra-preview-3b1b-ch13-hd.png
math: true
---

## **0. 이 글의 목표**

선형대수는 처음 배우면 이상하게 느껴집니다.

계산은 할 수 있습니다.

```text
행렬 곱하기
역행렬 구하기
determinant 계산하기
eigenvalue 구하기
```

그런데 막상 질문을 바꾸면 흔들립니다.

```text
행렬은 대체 무엇인가?

determinant가 0이라는 말은 공간에서 무슨 일이 일어났다는 뜻인가?

eigenvector는 왜 그렇게 중요하게 나오는가?

기저를 바꾼다는 것은 실제로 무엇을 바꾸는 것인가?
```

3Blue1Brown의 **Essence of Linear Algebra** 시리즈가 좋은 이유는 이 질문들을 계산 절차가 아니라 **공간의 움직임**으로 설명하기 때문입니다.

이 글은 영상을 그대로 옮긴 transcript가 아닙니다. 영상의 핵심 관점을 바탕으로, 내가 선형대수를 다시 볼 때 필요한 개념을 공부용으로 재구성한 글입니다.

각 섹션에는 원본 영상에서 짧게 발췌한 대표 study용 GIF를 붙였습니다. 그리고 글로만 읽으면 다시 헷갈릴 만한 지점에는 보조 GIF를 추가했습니다.

이 글의 1차 목적은 성능 최적화나 모바일 최적화가 아닙니다. 내가 다시 볼 때 “아, 이 개념이 공간에서 이렇게 움직이는 거였지”를 바로 떠올리기 위한 개인 study notebook입니다.

목표는 하나입니다.

> 선형대수를 숫자 계산 과목이 아니라, 벡터공간과 선형변환을 다루는 언어로 이해한다.

### **0.1 이 글의 범위와 출처 사용 기준**

1강부터 16강까지를 제대로 정리하려면 각 강의 핵심 질문이 분명해야 합니다.

이 글에서 각 강은 다음 범위로 봅니다.

| 3Blue1Brown 강 | 이 글의 섹션 | 핵심 질문 |
|---|---|---|
| 1강 | 벡터란 무엇인가 | 벡터를 화살표, 숫자 리스트, 공간의 원소로 함께 볼 수 있는가? |
| 2강 | 선형결합, span, basis | 어떤 벡터 조합이 공간을 만들 수 있는가? |
| 3강 | 행렬과 선형변환 | 행렬의 열벡터는 무엇을 의미하는가? |
| 4강 | 행렬곱 | 행렬곱을 변환의 합성으로 볼 수 있는가? |
| 5강 | 3차원 변환 | 2D 관점을 3D basis로 확장할 수 있는가? |
| 6강 | determinant | 면적/부피 스케일과 차원 collapse를 설명할 수 있는가? |
| 7강 | inverse, column space, null space | 선형시스템의 해 존재성을 기하학으로 볼 수 있는가? |
| 8강 | non-square matrix | 행렬을 서로 다른 차원 사이의 map으로 볼 수 있는가? |
| 9강 | dot product, duality | 내적을 projection과 linear functional로 볼 수 있는가? |
| 10강 | cross product | 외적을 oriented area와 normal vector로 볼 수 있는가? |
| 11강 | cross product와 선형변환 | 외적을 determinant와 duality로 다시 설명할 수 있는가? |
| 12강 | Cramer's rule | 해의 좌표를 determinant 비율로 해석할 수 있는가? |
| 13강 | 기저변환 | 같은 벡터를 다른 좌표계의 언어로 다시 읽을 수 있는가? |
| 14강 | 고유벡터와 고유값 | 변환 후에도 방향이 유지되는 축을 찾을 수 있는가? |
| 15강 | 고유값 계산 trick | characteristic equation을 determinant collapse로 이해할 수 있는가? |
| 16강 | 추상 벡터공간 | 화살표가 아닌 함수와 다항식도 벡터처럼 볼 수 있는가? |

3Blue1Brown 공식 FAQ 기준으로 still image나 짧은 clip 사용은 조건이 있습니다.

그래서 원본 시각자료를 직접 가져다 쓸 때는 다음 기준을 지키는 쪽이 맞습니다.

```text
1. 각 원본 영상에서 필요한 장면만 짧게 발췌
2. 글 마지막 참고자료에 3Blue1Brown 원본 영상 링크 제공
3. 주변 본문에서 개념 해석을 덧붙여, clip 자체만 통째로 재업로드하는 형태는 피함
```

즉 단순히 “출처 적었으니 아무거나 써도 된다”는 뜻은 아닙니다.

이 글에서는 1강부터 16강까지 각 강마다 원본 영상에서 짧게 발췌한 대표 GIF clip을 넣었습니다. 추가로 개념상 중요한 곳에는 보조 GIF clip을 더 넣었습니다.

각 GIF는 각 원본 영상에서 60초 미만으로 발췌했습니다. 너무 짧아서 개념 흐름이 잘리는 장면은 조금 더 길게 잡고, 느리게 늘어지는 장면은 빠르게 압축했습니다. GIF 자체에는 별도 글자를 덮지 않았으며, 원본 링크는 글 마지막 참고자료에 정리했습니다.

## **1. 선형대수의 핵심 관점**

선형대수의 중심에는 세 단어가 있습니다.

```text
vector
space
linear transformation
```

한국어로 쓰면 다음과 같습니다.

```text
벡터
공간
선형변환
```

여기서 가장 중요한 관점 전환은 이것입니다.

> 행렬은 숫자 표가 아니라 공간을 움직이는 규칙이다.

예를 들어 2차원 벡터

$$
\mathbf{x} =
\begin{bmatrix}
x \\
y
\end{bmatrix}
$$

가 있다고 합시다.

행렬 $A$를 곱한다는 것은 단순히 계산을 하는 것이 아닙니다.

$$
A \mathbf{x}
$$

는 벡터 $\mathbf{x}$가 놓인 공간 전체를 어떤 방식으로 늘리고, 줄이고, 회전시키고, 기울이는 것입니다.

그래서 선형대수를 제대로 이해하려면 다음 질문을 계속 해야 합니다.

```text
이 계산은 공간에서 무엇을 하고 있는가?

이 수식은 벡터를 어디로 보내는가?

이 값이 0이 된다는 것은 어떤 차원이 사라졌다는 뜻인가?
```

이 질문이 잡히면, determinant, inverse, basis, eigenvector 같은 개념들이 서로 따로 놀지 않습니다.

하나의 흐름으로 이어집니다.

## **2. 벡터란 무엇인가**

3Blue1Brown 1강은 벡터를 화살표, 숫자 리스트, 추상적인 공간의 원소라는 세 관점으로 연결합니다.

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch01-vectors.gif" alt="3Blue1Brown Ch.1 vectors visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

벡터는 분야마다 조금씩 다르게 보입니다.

물리에서는 벡터를 보통 화살표로 봅니다.

```text
힘
속도
가속도
변위
```

컴퓨터공학에서는 벡터를 숫자 리스트로 봅니다.

```text
[1.2, -0.7, 3.1]
```

수학에서는 이 둘을 더 추상적으로 묶어서 봅니다.

벡터는 어떤 공간 안의 원소이고, 그 공간에서는 적어도 다음 두 연산이 잘 정의되어 있어야 합니다.

```text
벡터 + 벡터
스칼라 * 벡터
```

2차원에서 벡터

$$
\mathbf{v} =
\begin{bmatrix}
3 \\
2
\end{bmatrix}
$$

는 원점에서 오른쪽으로 3, 위로 2만큼 이동한 화살표로 볼 수 있습니다.

하지만 더 중요한 것은 좌표값 자체가 아니라 이 벡터가 가지는 **방향과 크기**입니다.

### **2.1 벡터 덧셈**

벡터 덧셈은 이동을 이어 붙이는 것입니다.

$$
\mathbf{v} + \mathbf{w}
$$

는 먼저 $\mathbf{v}$만큼 이동하고, 그 끝에서 다시 $\mathbf{w}$만큼 이동한 결과입니다.

예를 들어

$$
\begin{bmatrix}
3 \\
2
\end{bmatrix}
+
\begin{bmatrix}
-1 \\
4
\end{bmatrix}
=
\begin{bmatrix}
2 \\
6
\end{bmatrix}
$$

입니다.

계산은 성분끼리 더하는 것이지만, 의미는 **두 이동의 합성**입니다.

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch01-vector-addition-detail.gif" alt="3Blue1Brown Ch.1 vector addition visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

### **2.2 스칼라 곱**

스칼라 곱은 벡터를 같은 방향으로 늘리거나 줄이는 것입니다.

$$
c \mathbf{v}
$$

여기서 $c$가 양수이면 방향은 유지됩니다.

$c$가 1보다 크면 길어지고, 0과 1 사이이면 짧아집니다.

$c$가 음수이면 방향이 반대로 뒤집힙니다.

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch01-scalar-multiplication-detail.gif" alt="3Blue1Brown Ch.1 scalar multiplication visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

예를 들어

$$
-2
\begin{bmatrix}
3 \\
2
\end{bmatrix}
=
\begin{bmatrix}
-6 \\
-4
\end{bmatrix}
$$

는 원래 벡터를 반대 방향으로 2배 늘린 것입니다.

## **3. 선형결합, span, basis**

3Blue1Brown 2강은 선형결합, span, basis를 다룹니다.

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch02-linear-combination.gif" alt="3Blue1Brown Ch.2 linear combination visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

벡터 $\mathbf{v}$와 $\mathbf{w}$가 있을 때,

$$
a\mathbf{v} + b\mathbf{w}
$$

처럼 스칼라를 곱해서 더한 것을 **선형결합(linear combination)**이라고 합니다.

이 식은 단순한 수식이 아니라 이런 의미입니다.

```text
v 방향으로 a만큼 가고,
w 방향으로 b만큼 간다.
```

위 원본 clip에서 봐야 할 것은 계산 순서가 아니라 **이동의 합성**입니다.

$\mathbf{v}$만큼 이동하고, 그 끝에서 다시 $\mathbf{w}$만큼 이동하면 결과 벡터 $\mathbf{v}+\mathbf{w}$가 됩니다.

즉 선형결합은 숫자를 섞는 계산이 아니라, 여러 방향의 이동을 조합해서 새로운 위치를 만드는 과정입니다.

### **3.1 span**

두 벡터 $\mathbf{v}$, $\mathbf{w}$로 만들 수 있는 모든 선형결합의 집합을 span이라고 합니다.

$$
\operatorname{span}(\mathbf{v}, \mathbf{w})
=
\{a\mathbf{v} + b\mathbf{w} \mid a,b \in \mathbb{R}\}
$$

2차원에서 두 벡터가 같은 직선 위에 있지 않으면, 두 벡터의 span은 평면 전체입니다.

반대로 두 벡터가 같은 직선 위에 있으면, 아무리 $a,b$를 바꿔도 그 직선 밖으로 나갈 수 없습니다.

이때 두 벡터는 **linearly dependent**, 즉 선형종속입니다.

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch02-span-dependent-detail.gif" alt="3Blue1Brown Ch.2 span and linear dependence visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

### **3.2 선형독립과 선형종속**

2강에서 중요한 감각은 이것입니다.

```text
새 벡터가 정말 새로운 방향을 추가하는가?
아니면 이미 있던 방향들의 조합으로 만들 수 있는가?
```

예를 들어 $\mathbf{w}=2\mathbf{v}$라면, $\mathbf{w}$는 새 방향을 추가하지 않습니다.

이 경우 두 벡터의 span은 평면 전체가 아니라 한 직선입니다.

반대로 $\mathbf{v}$와 $\mathbf{w}$가 같은 직선 위에 있지 않으면, 두 벡터는 서로 독립적인 방향을 제공합니다.

이때 두 벡터의 span은 2차원 평면 전체가 됩니다.

정리하면 다음과 같습니다.

| 상태 | 의미 | span |
|---|---|---|
| 선형독립 | 새 벡터가 새로운 방향을 추가함 | 더 높은 차원을 만들 수 있음 |
| 선형종속 | 새 벡터가 기존 벡터 조합으로 표현됨 | 차원이 늘지 않음 |

### **3.3 basis**

기저(basis)는 공간을 표현하기 위한 최소한의 방향 세트입니다.

2차원에서 표준기저는 보통 다음 두 벡터입니다.

$$
\mathbf{e}_1 =
\begin{bmatrix}
1 \\
0
\end{bmatrix},
\quad
\mathbf{e}_2 =
\begin{bmatrix}
0 \\
1
\end{bmatrix}
$$

그러면 어떤 벡터든 이렇게 표현할 수 있습니다.

$$
\begin{bmatrix}
x \\
y
\end{bmatrix}
=
x\mathbf{e}_1 + y\mathbf{e}_2
$$

여기서 좌표 $x,y$는 벡터 그 자체가 아닙니다.

그 벡터를 특정 기저 $\mathbf{e}_1, \mathbf{e}_2$ 기준으로 표현한 숫자입니다.

이 관점이 중요합니다.

> 좌표는 벡터가 아니라, 어떤 기저로 벡터를 읽었을 때 나오는 표현이다.

나중에 change of basis가 나올 때 이 말이 핵심이 됩니다.

## **4. 행렬과 선형변환**

3Blue1Brown 3강은 행렬을 선형변환으로 보는 관점을 잡습니다.

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch03-linear-transform.gif" alt="3Blue1Brown Ch.3 linear transformation visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

선형변환(linear transformation)은 벡터를 다른 벡터로 보내는 함수입니다.

$$
T(\mathbf{x}) = A\mathbf{x}
$$

여기서 $A$가 행렬입니다.

선형변환이라는 이름이 붙으려면 두 성질이 유지되어야 합니다.

$$
T(\mathbf{v} + \mathbf{w}) = T(\mathbf{v}) + T(\mathbf{w})
$$

$$
T(c\mathbf{v}) = cT(\mathbf{v})
$$

기하학적으로 보면 선형변환은 다음 특징을 가집니다.

```text
원점은 원점에 남는다.
직선은 직선으로 간다.
격자선은 평행성과 균일한 간격 구조를 유지한다.
```

이 조건 때문에 선형변환은 공간을 제멋대로 구기는 변환이 아닙니다.

공간 전체를 규칙적으로 움직이는 변환입니다.

위 원본 clip에서처럼, 선형변환에서는 격자 전체가 한 번에 움직입니다.

핵심은 파란색 basis vector와 초록색 basis vector입니다.

행렬은 모든 점의 이동을 따로 저장하지 않습니다.

대신 **basis vector가 어디로 가는지**만 저장합니다.

나머지 모든 벡터는 그 변환된 basis vector들의 선형결합으로 자동 결정됩니다.

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch03-basis-grid-detail.gif" alt="3Blue1Brown Ch.3 basis vectors determine the grid visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

### **4.1 행렬의 열벡터가 중요한 이유**

2차원 행렬을 보겠습니다.

$$
A =
\begin{bmatrix}
a & b \\
c & d
\end{bmatrix}
$$

이 행렬의 첫 번째 열은

$$
A\mathbf{e}_1 =
\begin{bmatrix}
a \\
c
\end{bmatrix}
$$

입니다.

두 번째 열은

$$
A\mathbf{e}_2 =
\begin{bmatrix}
b \\
d
\end{bmatrix}
$$

입니다.

즉 행렬의 열벡터는 각각 표준기저가 변환 후 어디로 가는지를 말합니다.

그리고 임의의 벡터

$$
\mathbf{x} =
\begin{bmatrix}
x \\
y
\end{bmatrix}
= x\mathbf{e}_1 + y\mathbf{e}_2
$$

에 대해

$$
A\mathbf{x}
= A(x\mathbf{e}_1 + y\mathbf{e}_2)
= xA\mathbf{e}_1 + yA\mathbf{e}_2
$$

가 됩니다.

그래서 행렬-벡터 곱은 이렇게 읽을 수 있습니다.

> 변환된 기저벡터들을 기존 좌표 $x,y$만큼 선형결합한 것.

이것이 3Blue1Brown 선형대수 시리즈의 가장 중요한 관점 중 하나입니다.

행렬을 보면 이제 숫자 표가 아니라 다음을 봐야 합니다.

```text
첫 번째 basis vector는 어디로 갔는가?
두 번째 basis vector는 어디로 갔는가?
공간 전체는 어떻게 움직였는가?
```

## **5. 행렬곱은 변환의 합성**

3Blue1Brown 4강은 행렬곱을 변환의 합성으로 해석합니다.

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch04-matrix-composition.gif" alt="3Blue1Brown Ch.4 matrix composition visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

행렬곱은 계산으로 보면 복잡합니다.

하지만 기하학적으로 보면 단순합니다.

> 행렬곱은 선형변환을 연속으로 적용한 것이다.

두 행렬 $A$, $B$가 있을 때

$$
AB\mathbf{x}
$$

는 보통 이렇게 읽습니다.

```text
먼저 B로 x를 변환한다.
그 결과를 다시 A로 변환한다.
```

즉 $AB$는 $B$ 다음에 $A$를 적용한 합성변환입니다.

$$
AB\mathbf{x} = A(B\mathbf{x})
$$

이 관점으로 보면 행렬곱의 순서가 왜 중요한지도 자연스럽습니다.

공간을 먼저 회전하고 나서 shear하는 것과, 먼저 shear하고 나서 회전하는 것은 일반적으로 다릅니다.

그래서 보통

$$
AB \ne BA
$$

입니다.

이것은 계산 규칙의 이상한 예외가 아닙니다.

변환의 순서가 다르면 공간의 최종 상태가 달라지기 때문입니다.

### **5.1 행렬곱의 열벡터 해석**

행렬곱도 열벡터 관점으로 다시 읽을 수 있습니다.

행렬 $B$의 열벡터를 $\mathbf{b}_1, \mathbf{b}_2$라고 하면,

$$
B =
\begin{bmatrix}
| & | \\
\mathbf{b}_1 & \mathbf{b}_2 \\
| & |
\end{bmatrix}
$$

입니다.

여기에 $A$를 곱하면

$$
AB =
\begin{bmatrix}
| & | \\
A\mathbf{b}_1 & A\mathbf{b}_2 \\
| & |
\end{bmatrix}
$$

가 됩니다.

즉 $AB$의 첫 번째 열은 $B$가 보낸 첫 번째 basis 방향을 다시 $A$로 보낸 결과입니다.

두 번째 열도 마찬가지입니다.

그래서 행렬곱은 “숫자표끼리 곱하는 이상한 규칙”이 아니라, 다음 질문으로 읽을 수 있습니다.

> $B$가 만든 새 basis 방향들을 $A$가 다시 어디로 보내는가?

이 해석을 잡으면 $AB$와 $BA$가 왜 다른지도 자연스럽습니다.

$AB$는 $B$가 먼저 공간을 움직이고, 그 결과를 $A$가 다시 움직입니다.

$BA$는 그 반대입니다.

공간 변환 순서가 바뀌면 최종 grid가 달라지므로 두 행렬곱은 일반적으로 같지 않습니다.

## **6. 3차원 선형변환**

3Blue1Brown 5강은 2차원에서 잡은 선형변환 관점을 3차원으로 확장합니다.

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch05-three-d-transform.gif" alt="3Blue1Brown Ch.5 3D transformation visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

2차원에서 했던 이야기는 3차원에서도 그대로 이어집니다.

3차원 표준기저는 다음입니다.

$$
\mathbf{e}_1 =
\begin{bmatrix}
1 \\
0 \\
0
\end{bmatrix},
\quad
\mathbf{e}_2 =
\begin{bmatrix}
0 \\
1 \\
0
\end{bmatrix},
\quad
\mathbf{e}_3 =
\begin{bmatrix}
0 \\
0 \\
1
\end{bmatrix}
$$

3차원 행렬

$$
A =
\begin{bmatrix}
| & | & | \\
\mathbf{a}_1 & \mathbf{a}_2 & \mathbf{a}_3 \\
| & | & |
\end{bmatrix}
$$

의 세 열벡터 $\mathbf{a}_1, \mathbf{a}_2, \mathbf{a}_3$는 각각 변환된 basis vector입니다.

즉,

```text
첫 번째 열: x축 basis가 어디로 갔는가
두 번째 열: y축 basis가 어디로 갔는가
세 번째 열: z축 basis가 어디로 갔는가
```

를 나타냅니다.

3차원에서도 임의의 벡터는 변환된 세 basis vector의 선형결합으로 이동합니다.

$$
A
\begin{bmatrix}
x \\
y \\
z
\end{bmatrix}
=
x\mathbf{a}_1 + y\mathbf{a}_2 + z\mathbf{a}_3
$$

2차원에서는 행렬의 두 열이 변환된 $\mathbf{e}_1,\mathbf{e}_2$를 담았습니다.

3차원에서는 세 열이 변환된 $\mathbf{e}_1,\mathbf{e}_2,\mathbf{e}_3$를 담습니다.

따라서 3D 행렬을 볼 때도 질문은 같습니다.

```text
x축 basis는 어디로 갔는가?
y축 basis는 어디로 갔는가?
z축 basis는 어디로 갔는가?
```

이 세 축이 변환 후에도 서로 독립적인 방향을 유지하면 3차원 부피가 남습니다.

반대로 세 축 중 하나가 다른 축들의 span 안으로 들어가면 공간은 평면이나 선으로 눌립니다.

이 관점이 바로 다음 강의 determinant로 이어집니다.

로봇공학에서 3차원 회전행렬을 볼 때도 이 관점이 유용합니다.

회전행렬의 각 열은 한 좌표계의 축이 다른 좌표계에서 어떻게 보이는지를 나타냅니다.

즉 회전행렬은 단순히 각도를 담은 표가 아니라, frame의 basis가 다른 frame에서 어떻게 표현되는지 담고 있습니다.

## **7. determinant는 면적과 부피의 스케일**

3Blue1Brown 6강은 determinant를 면적/부피 스케일로 설명합니다.

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch06-determinant.gif" alt="3Blue1Brown Ch.6 determinant visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

determinant는 보통 계산 공식으로 먼저 배웁니다.

2차원에서는

$$
\det
\begin{bmatrix}
a & b \\
c & d
\end{bmatrix}
= ad - bc
$$

입니다.

하지만 공식보다 중요한 것은 의미입니다.

> determinant는 선형변환이 면적 또는 부피를 몇 배로 바꾸는지 나타내는 값이다.

2차원에서는 단위 정사각형의 면적이 변환 후 몇 배가 되는지를 말합니다.

3차원에서는 단위 정육면체의 부피가 변환 후 몇 배가 되는지를 말합니다.

위 원본 clip에서 단위 정사각형은 선형변환을 거치며 평행사변형으로 바뀝니다.

이때 determinant는 그 평행사변형의 면적이 원래 단위 정사각형보다 몇 배인지 말합니다.

뒤쪽에서 도형이 거의 선처럼 눌리는 장면은 $\det(A) \rightarrow 0$인 상황입니다.

이 경우 면적이 사라지므로, 원래 2차원 정보가 낮은 차원으로 collapse됩니다.

### **7.1 determinant의 부호**

$\det(A) > 0$이면 orientation이 유지됩니다.

$\det(A) < 0$이면 orientation이 뒤집힙니다.

2차원에서는 종이를 뒤집는 것처럼, 오른손 좌표계와 왼손 좌표계가 바뀌는 느낌으로 볼 수 있습니다.

### **7.2 determinant가 0이라는 말**

$\det(A) = 0$이면 면적이나 부피가 0으로 찌그러졌다는 뜻입니다.

2차원 공간이 선 하나로 눌렸거나, 한 점으로 눌렸을 수 있습니다.

3차원 공간이 평면, 선, 점으로 눌렸을 수 있습니다.

이 말은 곧 어떤 방향의 정보가 사라졌다는 뜻입니다.

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch06-determinant-collapse.gif" alt="3Blue1Brown Ch.6 determinant collapse visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

그래서 determinant가 0이면 역변환을 만들 수 없습니다.

공간이 한 번 낮은 차원으로 찌그러지면, 원래 어디서 왔는지 되돌릴 정보가 사라지기 때문입니다.

## **8. 역행렬, column space, null space**

3Blue1Brown 7강은 inverse, column space, null space를 선형시스템의 기하학으로 연결합니다.

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch07-inverse-column-null.gif" alt="3Blue1Brown Ch.7 inverse column space null space visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

행렬 $A$의 역행렬 $A^{-1}$은 $A$가 한 변환을 되돌리는 변환입니다.

$$
A^{-1}A = I
$$

여기서 $I$는 항등변환입니다.

항등변환은 공간을 그대로 두는 변환입니다.

### **8.1 역행렬이 존재한다는 뜻**

역행렬이 존재하려면 $A$가 공간을 찌그러뜨려 차원을 잃어버리면 안 됩니다.

즉 2차원에서는 평면을 선으로 누르면 안 되고, 3차원에서는 공간을 평면이나 선으로 누르면 안 됩니다.

이 조건을 determinant로 보면 다음과 같습니다.

$$
\det(A) \ne 0
$$

determinant가 0이 아니면, 공간의 면적이나 부피가 완전히 사라지지는 않았습니다.

그래서 되돌릴 수 있습니다.

### **8.2 column space**

column space는 행렬 $A$가 만들어낼 수 있는 모든 출력 벡터의 집합입니다.

$$
\operatorname{Col}(A)
=
\{A\mathbf{x} \mid \mathbf{x} \in \mathbb{R}^n\}
$$

행렬의 열벡터들이 span하는 공간이라고도 볼 수 있습니다.

선형시스템

$$
A\mathbf{x} = \mathbf{b}
$$

가 해를 가지려면 $\mathbf{b}$가 column space 안에 있어야 합니다.

즉 $\mathbf{b}$가 $A$라는 변환으로 도달 가능한 위치여야 합니다.

### **8.3 null space**

null space는 $A$를 곱했을 때 0으로 가는 입력들의 집합입니다.

$$
\operatorname{Null}(A)
=
\{\mathbf{x} \mid A\mathbf{x} = \mathbf{0}\}
$$

null space가 0벡터만 포함하면, 어떤 비영벡터도 완전히 사라지지 않습니다.

하지만 null space 안에 0이 아닌 벡터가 있다면, 그 방향의 정보는 $A$를 통과하며 사라집니다.

이때는 보통 determinant도 0이고, 역행렬도 존재하지 않습니다.

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch07-column-null-detail.gif" alt="3Blue1Brown Ch.7 column space and null space visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

### **8.4 rank와 해의 개수**

7강에서 column space와 null space를 보는 이유는 선형시스템의 해를 단순 계산 문제가 아니라 구조 문제로 보기 위해서입니다.

$$
A\mathbf{x} = \mathbf{b}
$$

에서 가능한 경우는 크게 세 가지입니다.

| 상황 | 기하학적 의미 | 해 |
|---|---|---|
| $\mathbf{b}$가 column space 밖에 있음 | 변환 $A$로는 $\mathbf{b}$에 도달 불가 | 해 없음 |
| $\mathbf{b}$가 column space 안에 있고 null space가 0뿐임 | 도달 가능하고 입력이 하나로 정해짐 | 해 하나 |
| $\mathbf{b}$가 column space 안에 있고 null space가 큼 | 도달 가능하지만 여러 입력이 같은 출력으로 감 | 해 무한히 많음 |

rank는 column space의 차원입니다.

즉 행렬이 실제로 출력 공간 안에서 몇 차원까지 만들어낼 수 있는지를 나타냅니다.

nullity는 null space의 차원입니다.

즉 입력 중에서 출력으로 보이지 않고 사라지는 자유도의 수입니다.

이 둘은 서로 연결됩니다.

$$
\operatorname{rank}(A) + \operatorname{nullity}(A) = n
$$

여기서 $n$은 입력 차원입니다.

이 식은 “입력 자유도는 출력으로 살아남는 방향과 0으로 사라지는 방향으로 나뉜다”는 뜻으로 볼 수 있습니다.

### **8.4.1 용어를 공간, 숫자, 벡터로 분리하기**

이 지점에서 헷갈리는 이유는 보통 수학이 어려워서라기보다, 서로 다른 종류의 말이 한꺼번에 섞이기 때문입니다.

특히 다음 세 가지를 분리해서 봐야 합니다.

```text
벡터: 공간 안의 원소 하나
공간: 벡터들이 모여서 이루는 집합
숫자: 그 공간의 차원, 배율, 부피 변화율 같은 측정값
```

예를 들어 column space는 공간입니다.

행렬이 만들어낼 수 있는 모든 출력 벡터의 집합입니다.

반면 rank는 숫자입니다.

column space의 차원을 나타내는 값입니다.

null space도 공간입니다.

행렬을 통과했을 때 0으로 사라지는 입력 벡터들의 집합입니다.

nullity는 숫자입니다.

null space의 차원입니다.

정리하면 다음처럼 볼 수 있습니다.

| 용어 | 종류 | 의미 |
|---|---|---|
| vector $\mathbf{v}$ | 벡터 하나 | 방향과 크기를 가진 원소 |
| span | 공간 | 주어진 벡터들의 선형결합으로 만들 수 있는 전체 집합 |
| basis | 벡터들의 집합 | 공간을 만드는 최소 독립 벡터들 |
| dimension | 숫자 | basis vector가 몇 개 필요한지 |
| column space | 공간 | 행렬이 만들 수 있는 모든 출력 |
| rank | 숫자 | column space의 차원 |
| null space, kernel | 공간 | 출력이 0이 되는 모든 입력 |
| nullity | 숫자 | null space의 차원 |
| determinant | 숫자 | 전체 면적/부피 변화율 |

이 구분이 잡히면 뒤의 eigenvalue도 훨씬 덜 헷갈립니다.

eigenvector는 벡터입니다.

eigenspace는 공간입니다.

eigenvalue는 숫자입니다.

즉 eigenvalue를 “고유벡터의 길이”처럼 보면 안 되고, eigenspace를 “벡터 하나”처럼 봐도 안 됩니다.

### **8.5 rank가 낮으면 무엇이 사라지는가**

여기서 내가 헷갈렸던 핵심은 이것입니다.

```text
det(A) = 0이면 역행렬이 없다고 하는데,
그러면 남아 있는 정보까지 전부 못 쓰는 것인가?
```

정확히는 그렇지 않습니다.

전체 공간에서의 역행렬은 없지만, 정보가 실제로 남아 있는 더 낮은 차원의 부분공간에서는 역변환처럼 다룰 수 있습니다.

예를 들어

$$
A =
\begin{bmatrix}
1 & 0 & 0 & 0 \\
0 & 2 & 0 & 0 \\
0 & 0 & 3 & 0 \\
0 & 0 & 0 & 0
\end{bmatrix}
$$

라고 합시다.

이 행렬은

$$
(x_1, x_2, x_3, x_4)
\mapsto
(x_1, 2x_2, 3x_3, 0)
$$

로 작용합니다.

여기서 $x_4$ 정보는 완전히 사라집니다.

따라서 전체 4차원에서는 출력만 보고 $x_4$를 복원할 수 없습니다.

그래서

$$
\det(A)=0, \qquad \operatorname{rank}(A)=3
$$

이고, 전체 $4 \times 4$ 역행렬은 존재하지 않습니다.

하지만 앞의 세 좌표만 보면

$$
A_{\text{reduced}}
=
\begin{bmatrix}
1 & 0 & 0 \\
0 & 2 & 0 \\
0 & 0 & 3
\end{bmatrix}
$$

이고,

$$
A_{\text{reduced}}^{-1}
=
\begin{bmatrix}
1 & 0 & 0 \\
0 & \frac{1}{2} & 0 \\
0 & 0 & \frac{1}{3}
\end{bmatrix}
$$

는 존재합니다.

즉, 중요한 구분은 다음입니다.

```text
전체 4차원 정보를 전부 복원할 수 있는가?  -> 아니오
살아남은 3차원 정보 안에서는 되돌릴 수 있는가? -> 가능
```

그래서 rank가 $r$인 행렬은 적절한 좌표계에서 보면 본질적으로

$$
r\text{차원} \rightarrow r\text{차원}
$$

의 가역 변환과, 나머지 방향을 0으로 보내는 collapse가 섞인 것으로 볼 수 있습니다.

이 관점은 뒤에서 eigenvalue를 볼 때 그대로 다시 나옵니다.

어떤 eigenvalue가 0이라는 말은 그 eigenvector 방향이 완전히 사라졌다는 뜻입니다.

반대로 0이 아닌 eigenvalue 방향은 적어도 그 방향의 scale 정보가 살아 있다는 뜻입니다.

### **8.6 covariance, PCA, 의사역행렬**

데이터 관점에서도 같은 일이 일어납니다.

4차원 데이터의 covariance matrix를

$$
C \in \mathbb{R}^{4 \times 4}
$$

라고 합시다.

만약

$$
\det(C)=0
$$

이면 covariance의 rank가 4보다 작다는 뜻입니다.

예를 들어 데이터가 항상

$$
x_4 = x_1 + x_2
$$

를 만족한다면, 좌표는 4개지만 $x_4$는 이미 $x_1, x_2$로 결정됩니다.

따라서 데이터는 $\mathbb{R}^4$ 전체에 퍼져 있는 것이 아니라, 그 안의 3차원 부분공간에 놓입니다.

이 경우 전체 covariance는 역행렬이 없을 수 있습니다.

하지만 데이터가 실제로 놓인 3차원 부분공간의 좌표로 바꾸면 reduced covariance를 만들 수 있고, 그 안에서 모든 방향의 분산이 0이 아니라면 역행렬을 가질 수 있습니다.

대칭 covariance matrix는 보통 다음처럼 고유분해됩니다.

$$
C = U \Lambda U^T
$$

예를 들어

$$
\Lambda = \operatorname{diag}(5, 2, 1, 0)
$$

이면 마지막 eigenvector 방향의 분산이 0이라는 뜻입니다.

PCA는 바로 이런 구조를 사용합니다.

0이 아닌 eigenvalue 방향만 남기면

$$
\Lambda_r = \operatorname{diag}(5, 2, 1)
$$

이고, 이 reduced space에서는

$$
\Lambda_r^{-1}
=
\operatorname{diag}
\left(
\frac{1}{5},
\frac{1}{2},
1
\right)
$$

처럼 역을 취할 수 있습니다.

4차원 형식을 유지하면서 낮은 rank 구조를 다루고 싶을 때는 Moore-Penrose 의사역행렬을 씁니다.

다만 의사역행렬은 사라진 원래 정보를 복원하는 도구가 아닙니다.

사라진 방향은 이미 관측되지 않았기 때문에 복원할 수 없습니다.

의사역행렬은 살아남은 column space 안에서 가능한 대표적인 해를 선택하는 도구에 가깝습니다.

## **9. 정방행렬이 아닌 행렬**

3Blue1Brown 8강은 정방행렬이 아닌 행렬을 차원 사이의 변환으로 봅니다.

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch08-nonsquare-map.gif" alt="3Blue1Brown Ch.8 nonsquare matrix visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

행렬은 꼭 $n \times n$ 정방행렬일 필요가 없습니다.

행렬 크기 $m \times n$은 다음처럼 읽을 수 있습니다.

```text
n차원 입력을 받아서
m차원 출력으로 보낸다.
```

즉 열의 개수는 입력 차원이고, 행의 개수는 출력 차원입니다.

예를 들어 $2 \times 3$ 행렬은 3차원 벡터를 2차원 벡터로 보냅니다.

$$
A \in \mathbb{R}^{2 \times 3}
$$

이면

$$
A : \mathbb{R}^3 \rightarrow \mathbb{R}^2
$$

로 볼 수 있습니다.

반대로 $3 \times 2$ 행렬은 2차원 벡터를 3차원 벡터로 보냅니다.

$$
A : \mathbb{R}^2 \rightarrow \mathbb{R}^3
$$

이 관점은 projection과 embedding을 이해하는 데 좋습니다.

예를 들어 카메라 모델에서는 3차원 공간의 점이 2차원 이미지 평면으로 투영됩니다.

SLAM에서도 3D point, camera pixel, LiDAR point, state vector 사이를 오가는 mapping이 계속 나옵니다.

정방행렬이 아닌 행렬을 보면 이렇게 질문하면 됩니다.

```text
이 변환은 몇 차원 입력을 몇 차원 출력으로 보내는가?

정보가 줄어드는가?

새로운 차원에 embedding되는가?

어떤 방향의 정보가 관측되지 않는가?
```

## **10. 내적과 duality**

3Blue1Brown 9강은 내적을 projection과 duality 관점으로 설명합니다.

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch09-dot-product.gif" alt="3Blue1Brown Ch.9 dot product visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

내적(dot product)은 계산으로는 성분별 곱의 합입니다.

$$
\mathbf{v} \cdot \mathbf{w}
=
v_1w_1 + v_2w_2 + \cdots + v_nw_n
$$

하지만 기하학적으로는 projection과 관련이 있습니다.

$$
\mathbf{v} \cdot \mathbf{w}
=
\|\mathbf{v}\|\|\mathbf{w}\|\cos\theta
$$

여기서 $\theta$는 두 벡터 사이의 각도입니다.

이 식은 내적이 다음 정보를 담고 있다는 뜻입니다.

```text
두 벡터가 얼마나 같은 방향을 보는가?
한 벡터를 다른 벡터 방향으로 얼마나 투영할 수 있는가?
```

내적은 단순히 성분끼리 곱해서 더한 값이 아닙니다.

한 벡터를 다른 벡터 방향으로 projection했을 때, 그 방향 성분이 얼마나 남는지를 나타냅니다.

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch09-dot-projection-detail.gif" alt="3Blue1Brown Ch.9 dot product projection visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

그래서 같은 방향이면 양수, 직교하면 0, 반대 방향이면 음수가 됩니다.

### **10.1 내적의 부호**

내적이 양수이면 두 벡터가 대체로 같은 방향입니다.

내적이 0이면 두 벡터는 서로 직교합니다.

내적이 음수이면 두 벡터가 대체로 반대 방향입니다.

### **10.2 duality**

duality 관점에서는 벡터 하나를 숫자를 출력하는 선형함수로 볼 수 있습니다.

예를 들어 고정된 벡터 $\mathbf{v}$가 있을 때,

$$
f(\mathbf{x}) = \mathbf{v} \cdot \mathbf{x}
$$

는 입력 벡터 $\mathbf{x}$를 받아 스칼라 하나를 출력합니다.

즉 벡터 $\mathbf{v}$는 단순히 공간 안의 화살표이면서 동시에, 다른 벡터를 숫자로 보내는 선형함수처럼 행동합니다.

이 관점은 최적화, 기계학습, 로봇공학에서 자주 나옵니다.

예를 들어 residual이 어떤 방향으로 가장 크게 변하는지, gradient가 어떤 방향을 가리키는지 이해할 때 내적과 duality가 바탕에 있습니다.

### **10.3 row vector를 linear functional로 보기**

내적과 duality를 더 직접적으로 쓰면, row vector는 벡터를 숫자로 보내는 선형함수입니다.

예를 들어

$$
\begin{bmatrix}
a & b
\end{bmatrix}
\begin{bmatrix}
x \\
y
\end{bmatrix}
= ax + by
$$

입니다.

왼쪽의 row vector $\begin{bmatrix}a & b\end{bmatrix}$는 2D 벡터를 받아 스칼라 하나를 내놓습니다.

그런데 같은 계산은 벡터

$$
\mathbf{v} =
\begin{bmatrix}
a \\
b
\end{bmatrix}
$$

와의 내적으로도 볼 수 있습니다.

$$
\mathbf{v} \cdot \mathbf{x} = ax + by
$$

즉 어떤 linear functional은 하나의 벡터와 대응될 수 있습니다.

이 대응이 11강에서 외적을 다시 해석할 때 중요해집니다.

## **11. 외적**

3Blue1Brown 10강은 외적을 계산법과 기하학적 의미로 설명합니다.

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch10-cross-product.gif" alt="3Blue1Brown Ch.10 cross product visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

3Blue1Brown 11강은 외적을 선형변환과 duality 관점에서 한 단계 더 깊게 봅니다.

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch11-cross-product-duality.gif" alt="3Blue1Brown Ch.11 cross product duality visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

3차원에서 외적(cross product)은 두 벡터로부터 새로운 벡터를 만듭니다.

$$
\mathbf{v} \times \mathbf{w}
$$

이 벡터는 다음 성질을 가집니다.

```text
v와 w 모두에 수직이다.
크기는 v와 w가 만드는 평행사변형의 넓이와 같다.
방향은 오른손 법칙으로 정해진다.
```

즉 외적은 단순히 수직 벡터를 찾는 도구가 아닙니다.

두 벡터가 만드는 oriented area를 벡터 형태로 표현한 것입니다.

### **11.1 외적과 determinant**

외적은 determinant와도 연결됩니다.

두 벡터가 만드는 면적은 determinant의 면적 스케일 관점과 이어집니다.

또한 어떤 벡터 $\mathbf{u}$에 대해

$$
\mathbf{u} \cdot (\mathbf{v} \times \mathbf{w})
$$

는 세 벡터가 만드는 평행육면체의 signed volume을 나타냅니다.

즉 내적, 외적, determinant는 서로 따로 있는 공식이 아니라, 길이, 면적, 부피를 다루는 하나의 기하학적 언어입니다.

### **11.2 외적의 계산식**

외적의 계산식은 보통 이렇게 씁니다.

$$
\mathbf{v} \times \mathbf{w}
=
\begin{bmatrix}
v_2w_3 - v_3w_2 \\
v_3w_1 - v_1w_3 \\
v_1w_2 - v_2w_1
\end{bmatrix}
$$

하지만 이 식을 외우는 것보다 중요한 것은 결과 벡터가 해야 하는 일입니다.

```text
1. v와 수직이어야 한다.
2. w와 수직이어야 한다.
3. 크기는 v와 w가 만드는 평행사변형 넓이여야 한다.
4. 방향은 오른손 법칙을 따라야 한다.
```

즉 계산식은 이 네 조건을 만족하는 벡터를 성분으로 풀어 쓴 것입니다.

### **11.3 11강의 핵심: 외적을 duality로 보기**

11강의 더 깊은 포인트는 외적을 단순한 계산 trick이 아니라, determinant와 duality에서 나온 대상으로 보는 것입니다.

두 벡터 $\mathbf{v}, \mathbf{w}$를 고정하고, 임의의 벡터 $\mathbf{u}$를 넣어서 다음 값을 만든다고 합시다.

$$
f(\mathbf{u}) =
\det
\begin{bmatrix}
| & | & | \\
\mathbf{v} & \mathbf{w} & \mathbf{u} \\
| & | & |
\end{bmatrix}
$$

이 값은 $\mathbf{v}, \mathbf{w}, \mathbf{u}$가 만드는 signed volume입니다.

여기서 $\mathbf{v}, \mathbf{w}$는 고정되어 있고, $\mathbf{u}$만 입력입니다.

그러면 $f$는 3D 벡터 $\mathbf{u}$를 숫자 하나로 보내는 linear functional입니다.

duality 관점에 따르면 이런 linear functional은 어떤 벡터 $\mathbf{p}$와의 내적으로 표현할 수 있습니다.

$$
f(\mathbf{u}) = \mathbf{p} \cdot \mathbf{u}
$$

이때 그 $\mathbf{p}$가 바로

$$
\mathbf{v} \times \mathbf{w}
$$

입니다.

따라서 외적은 이렇게 다시 정의할 수 있습니다.

> $\mathbf{v} \times \mathbf{w}$는 모든 $\mathbf{u}$에 대해 $\mathbf{u}$와 내적했을 때, $\mathbf{v}, \mathbf{w}, \mathbf{u}$의 signed volume을 돌려주는 벡터다.

이 설명이 중요한 이유는 외적, determinant, 내적이 한 구조 안에서 만난다는 점입니다.

외적은 “3D에서만 나오는 이상한 공식”이 아니라, volume을 측정하는 linear functional을 벡터로 표현한 것입니다.

## **12. Cramer's rule**

3Blue1Brown 12강은 Cramer's rule을 determinant의 비율로 보는 기하학적 설명입니다.

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch12-cramers-rule.gif" alt="3Blue1Brown Ch.12 Cramer's rule visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

Cramer's rule은 선형시스템

$$
A\mathbf{x} = \mathbf{b}
$$

의 해를 determinant 비율로 표현하는 방법입니다.

예를 들어 2차원에서

$$
\mathbf{x} =
\begin{bmatrix}
x \\
y
\end{bmatrix}
$$

를 구할 때, $x$와 $y$를 determinant의 비율로 쓸 수 있습니다.

중요한 것은 Cramer's rule이 실제 수치계산에서 가장 효율적인 방법이라는 뜻은 아니라는 점입니다.

현대 수치선형대수에서는 큰 시스템을 풀 때 보통 LU, QR, Cholesky, iterative solver 등을 씁니다.

하지만 Cramer's rule은 개념적으로 의미가 있습니다.

> 선형시스템의 해를 determinant, 즉 공간의 면적/부피 변화 비율로 해석할 수 있게 해준다.

다시 말해 $A\mathbf{x}=\mathbf{b}$는 어떤 좌표 조합 $\mathbf{x}$가 변환 $A$를 거쳐 $\mathbf{b}$에 도달하는 문제입니다.

Cramer's rule은 그 좌표 조합을 공간의 signed area 또는 signed volume 비율로 읽게 해줍니다.

### **12.1 2D에서 Cramer's rule이 왜 determinant 비율이 되는가**

2차원에서 행렬 $A$의 두 열벡터를 $\mathbf{a}_1,\mathbf{a}_2$라고 합시다.

$$
A =
\begin{bmatrix}
| & | \\
\mathbf{a}_1 & \mathbf{a}_2 \\
| & |
\end{bmatrix}
$$

방정식

$$
A\mathbf{x} = \mathbf{b}
$$

는 다음 말과 같습니다.

$$
x\mathbf{a}_1 + y\mathbf{a}_2 = \mathbf{b}
$$

즉 $\mathbf{b}$를 만들기 위해 $\mathbf{a}_1$ 방향을 $x$만큼, $\mathbf{a}_2$ 방향을 $y$만큼 섞는 문제입니다.

이제 첫 번째 열을 $\mathbf{b}$로 바꾼 행렬을 봅니다.

$$
\begin{bmatrix}
| & | \\
\mathbf{b} & \mathbf{a}_2 \\
| & |
\end{bmatrix}
$$

여기서 $\mathbf{b}=x\mathbf{a}_1+y\mathbf{a}_2$이므로 determinant는

$$
\det(\mathbf{b}, \mathbf{a}_2)
=
\det(x\mathbf{a}_1 + y\mathbf{a}_2,\mathbf{a}_2)
$$

입니다.

determinant는 각 열에 대해 선형적이므로,

$$
\det(x\mathbf{a}_1 + y\mathbf{a}_2,\mathbf{a}_2)
=
x\det(\mathbf{a}_1,\mathbf{a}_2)
+ y\det(\mathbf{a}_2,\mathbf{a}_2)
$$

가 됩니다.

그런데 같은 벡터 두 개가 만드는 평행사변형의 면적은 0입니다.

$$
\det(\mathbf{a}_2,\mathbf{a}_2)=0
$$

따라서

$$
\det(\mathbf{b}, \mathbf{a}_2)
=
x\det(\mathbf{a}_1,\mathbf{a}_2)
$$

이고,

$$
x =
\frac{\det(\mathbf{b}, \mathbf{a}_2)}
{\det(\mathbf{a}_1,\mathbf{a}_2)}
$$

가 됩니다.

같은 방식으로

$$
y =
\frac{\det(\mathbf{a}_1, \mathbf{b})}
{\det(\mathbf{a}_1,\mathbf{a}_2)}
$$

입니다.

이것이 Cramer's rule입니다.

여기서 핵심은 분모와 분자가 모두 면적이라는 점입니다.

즉 Cramer's rule은 좌표 $x,y$를 면적 비율로 읽는 방법입니다.

### **12.2 Cramer's rule을 강하게 주장하면 안 되는 지점**

Cramer's rule은 개념적으로 매우 예쁩니다.

하지만 실제 큰 선형시스템을 풀 때 좋은 알고리즘이라는 뜻은 아닙니다.

계산량과 수치 안정성 때문에 실제 구현에서는 보통 다음 방법을 씁니다.

```text
LU decomposition
QR decomposition
Cholesky decomposition
iterative solver
```

따라서 이 강의에서 가져갈 포인트는 “Cramer's rule로 계산하자”가 아닙니다.

정확한 포인트는 다음입니다.

> 선형시스템의 해는 변환된 basis가 만드는 면적/부피의 비율로 해석될 수 있다.

## **13. 기저변환**

3Blue1Brown 13강은 change of basis를 “벡터를 움직이는 것”이 아니라 “같은 벡터를 다른 좌표계 언어로 읽는 것”으로 설명합니다.

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch13-change-of-basis.gif" alt="3Blue1Brown Ch.13 change of basis visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

기저변환(change of basis)은 처음에는 헷갈립니다.

그 이유는 우리가 보통 벡터와 좌표를 같은 것으로 착각하기 때문입니다.

하지만 엄밀히는 다릅니다.

```text
벡터: 공간 안의 실제 대상
좌표: 특정 기저로 그 벡터를 표현한 숫자
```

같은 벡터라도 어떤 기저를 쓰느냐에 따라 좌표는 달라질 수 있습니다.

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch13-coordinate-language-detail.gif" alt="3Blue1Brown Ch.13 same vector different coordinates visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

change of basis에서 실제 벡터 자체가 움직이는 것은 아닙니다.

움직이는 것은 basis, 즉 그 벡터를 읽는 좌표계입니다.

하지만 오른쪽의 coordinate 숫자는 변합니다.

즉 change of basis는 실제 벡터를 바꾸는 것이 아니라, 같은 벡터를 다른 좌표계의 언어로 다시 읽는 과정입니다.

### **13.1 다른 사람의 좌표계로 읽기**

표준기저가 아닌 새로운 기저

$$
\mathbf{b}_1,\mathbf{b}_2
$$

가 있다고 합시다.

어떤 벡터 $\mathbf{v}$가 이 새 기저에서 좌표

$$
\begin{bmatrix}
\alpha \\
\beta
\end{bmatrix}
$$

를 가진다는 것은

$$
\mathbf{v}
=
\alpha \mathbf{b}_1 + \beta \mathbf{b}_2
$$

라는 뜻입니다.

기저 행렬

$$
P =
\begin{bmatrix}
| & | \\
\mathbf{b}_1 & \mathbf{b}_2 \\
| & |
\end{bmatrix}
$$

를 만들면, 새 기저 좌표를 표준기저 좌표로 바꾸는 과정은

$$
\mathbf{v}_{standard} = P\mathbf{v}_{basis}
$$

입니다.

반대로 표준기저 좌표를 새 기저 좌표로 읽고 싶으면

$$
\mathbf{v}_{basis} = P^{-1}\mathbf{v}_{standard}
$$

를 사용합니다.

### **13.2 같은 변환을 다른 좌표계에서 보기**

변환 $A$를 새 기저 기준으로 표현하면 보통 다음 형태가 나옵니다.

$$
P^{-1}AP
$$

이 식은 이렇게 읽을 수 있습니다.

```text
P: 새 기저 좌표를 표준기저 좌표로 바꾼다.
A: 표준기저에서 변환을 적용한다.
P^{-1}: 결과를 다시 새 기저 좌표로 읽는다.
```

즉 $P^{-1}AP$는 새로운 변환이 아닙니다.

같은 변환을 다른 좌표계에서 표현한 것입니다.

로봇공학의 좌표계 변환도 이 관점과 닿아 있습니다.

world frame에서 본 벡터, body frame에서 본 벡터, LiDAR frame에서 본 벡터는 실제 물리량은 같을 수 있지만 좌표 표현은 다릅니다.

### **13.3 행렬은 변환 자체가 아니라 좌표 표현이다**

이 장에서 가장 중요한 결론은 다음입니다.

```text
선형변환은 실제 작용이고,
행렬은 그 작용을 특정 basis에서 적은 숫자표다.
```

같은 선형변환이라도 basis를 바꾸면 행렬 모양은 달라질 수 있습니다.

하지만 변환 자체가 바뀐 것은 아닙니다.

예를 들어 어떤 회전이나 stretching이 있다고 합시다.

표준기저에서 보면 행렬이 $A$일 수 있습니다.

하지만 고유벡터로 만든 기저에서 보면 같은 변환이 $D$처럼 훨씬 단순하게 보일 수 있습니다.

그 관계가 바로

$$
D = P^{-1}AP
$$

입니다.

여기서 $P$는 변환을 새로 만드는 행렬이 아니라, 좌표 언어를 바꾸는 행렬입니다.

이 관점이 잡히면 diagonalization이 덜 이상하게 보입니다.

대각화는 행렬을 억지로 예쁜 표로 바꾸는 조작이 아니라, 변환이 가장 단순하게 보이는 basis를 찾는 과정입니다.

## **14. 고유벡터와 고유값**

3Blue1Brown 14강은 eigenvector를 선형변환 이후에도 같은 직선 위에 남는 특수한 방향으로 설명합니다.

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch14-eigenvectors.gif" alt="3Blue1Brown Ch.14 eigenvectors and eigenvalues visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

고유벡터(eigenvector)는 선형변환을 적용해도 방향이 바뀌지 않는 벡터입니다.

방향은 유지되고, 길이만 늘어나거나 줄거나 반대로 뒤집힙니다.

수식으로는 다음과 같습니다.

$$
A\mathbf{v} = \lambda \mathbf{v}
$$

여기서 $\mathbf{v}$가 고유벡터이고, $\lambda$가 고유값(eigenvalue)입니다.

이 식의 의미는 간단합니다.

```text
A가 v를 변환해도,
결과는 여전히 v가 놓인 직선 위에 있다.
```

대부분의 벡터는 선형변환을 거치면 방향이 바뀝니다.

하지만 어떤 특수한 방향은 변환 후에도 같은 직선 위에 남습니다.

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch14-eigen-direction-detail.gif" alt="3Blue1Brown Ch.14 eigenvector direction survives transformation visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

그 방향이 eigenvector이고, 그 방향으로 얼마나 늘거나 줄었는지를 나타내는 값이 eigenvalue입니다.

즉 고유벡터는 선형변환이 공간을 움직일 때 변환의 핵심 방향을 알려줍니다.

### **14.1 고유값의 의미**

$\lambda = 2$이면 그 방향으로 2배 늘어납니다.

$\lambda = 0.5$이면 그 방향으로 절반으로 줄어듭니다.

$\lambda = -1$이면 같은 직선 위에서 방향이 반대로 뒤집힙니다.

$\lambda = 0$이면 그 방향이 0으로 눌립니다.

그래서 eigenvalue는 각 eigenvector 방향에서 변환이 얼마나 강하게 작용하는지 알려줍니다.

### **14.2 헷갈리기 쉬운 지점**

내가 처음 헷갈렸던 부분은 고유벡터, 고유값, 고유공간, 길이가 서로 섞였다는 점입니다.

정리하면 다음과 같습니다.

| 용어 | 무엇인가 | 의미 |
|---|---|---|
| eigenvector | 0이 아닌 벡터 | 변환 후에도 자기 span을 벗어나지 않는 방향 |
| eigenvalue | 숫자 | 그 방향을 몇 배로 늘리거나 줄이는 배율 |
| eigenspace | 공간 | 같은 eigenvalue를 갖는 eigenvector들의 집합 |
| normalized eigenvector | 길이가 1인 eigenvector | 계산 편의를 위해 크기만 맞춘 것 |

가장 중요한 오해는 이것입니다.

```text
고유벡터는 특별히 긴 벡터가 아니다.
고유값은 고유벡터의 길이가 아니다.
```

고유벡터의 본질은 길이가 아니라 방향입니다.

만약 $\mathbf{v}$가 고유벡터라면, $2\mathbf{v}$, $-5\mathbf{v}$, $100\mathbf{v}$도 모두 같은 고유값을 갖는 고유벡터입니다.

왜냐하면

$$
A(c\mathbf{v})
=
cA\mathbf{v}
=
c\lambda \mathbf{v}
=
\lambda(c\mathbf{v})
$$

이기 때문입니다.

즉 고유벡터 하나가 중요하다기보다, 그 벡터가 가리키는 방향 전체가 중요합니다.

계산할 때 고유벡터를

$$
\|\mathbf{v}\| = 1
$$

이 되도록 정규화하는 경우가 많습니다.

하지만 이것은 고유벡터의 길이를 1로 맞춘 것이지, 고유값을 1로 만든 것이 아닙니다.

예를 들어

$$
\|\mathbf{v}\| = 1,
\qquad
\lambda = 100
$$

도 가능합니다.

이 경우 고유벡터는 단위길이지만, 행렬은 그 방향을 100배로 늘립니다.

또 하나 중요한 점은, 같은 eigenvalue에 대응하는 eigenvector가 하나만 있는 것이 아니라는 점입니다.

어떤 고유값 $\lambda$에 대해

$$
E_\lambda
=
\operatorname{ker}(A-\lambda I)
$$

를 그 고유값의 eigenspace라고 합니다.

여기서 0벡터를 제외한 모든 벡터가 그 고유값에 대한 고유벡터입니다.

예를 들어

$$
E_3
=
\operatorname{span}
\left\{
\begin{bmatrix}
1 \\
0
\end{bmatrix}
\right\}
$$

라면, $x$축 위의 모든 0이 아닌 벡터가 고유값 3에 대한 고유벡터입니다.

심지어

$$
A = 2I
$$

라면 모든 벡터에 대해

$$
A\mathbf{v} = 2\mathbf{v}
$$

이므로, $\mathbb{R}^2$ 전체가 고유값 2에 대한 eigenspace가 됩니다.

이 경우에는 한 직선뿐 아니라 평면 전체의 모든 0이 아닌 벡터가 고유벡터입니다.

그래서 “하나의 고유값에는 고유벡터 하나”라고 보면 안 됩니다.

정확히는 다음에 가깝습니다.

```text
하나의 고유값에는 그 고유값에 대응하는 고유공간이 있다.
그 고유공간 안의 0이 아닌 모든 벡터가 고유벡터다.
```

### **14.2.1 고유벡터를 방향 공간으로 보기**

고유벡터를 이해할 때는 “딱 하나의 화살표”보다 “방향을 나타내는 공간”으로 보는 편이 좋습니다.

예를 들어

$$
A
\begin{bmatrix}
1 \\
0
\end{bmatrix}
=
3
\begin{bmatrix}
1 \\
0
\end{bmatrix}
$$

라면 위 벡터 하나만 고유벡터인 것이 아닙니다.

다음 벡터들도 모두 같은 고유값 3에 대한 고유벡터입니다.

$$
\begin{bmatrix}
2 \\
0
\end{bmatrix},
\qquad
\begin{bmatrix}
-5 \\
0
\end{bmatrix},
\qquad
\begin{bmatrix}
100 \\
0
\end{bmatrix}
$$

전부 같은 $x$축 위에 있기 때문입니다.

그래서 이 경우 고유공간은

$$
E_3
=
\operatorname{span}
\left\{
\begin{bmatrix}
1 \\
0
\end{bmatrix}
\right\}
$$

입니다.

여기서 0벡터는 eigenspace 안에는 들어가지만 eigenvector라고 부르지는 않습니다.

eigenvector 정의에서 $\mathbf{v}\ne\mathbf{0}$ 조건이 붙기 때문입니다.

0벡터는 모든 방향에 동시에 속하는 애매한 대상이라서, “방향이 유지된다”는 정보를 주지 못합니다.

더 특수한 경우도 있습니다.

$$
A = 2I
$$

이면 모든 벡터에 대해

$$
A\mathbf{v}=2\mathbf{v}
$$

입니다.

이때는 $x$축만 고유공간인 것이 아니라, $\mathbb{R}^2$ 전체가 고유값 2에 대한 고유공간입니다.

즉 하나의 고유값이 여러 독립적인 방향을 동시에 가질 수도 있습니다.

이 차이를 이렇게 기억하면 좋습니다.

```text
고유벡터 하나 = 방향을 찍는 대표 화살표
고유공간 = 같은 고유값을 공유하는 방향들의 전체 공간
고유값 = 그 공간 안에서 적용되는 배율
```

### **14.3 왜 중요한가**

어떤 행렬이 충분한 수의 독립적인 고유벡터를 가지면, 그 행렬은 고유벡터 기저에서 매우 단순하게 표현됩니다.

대각행렬처럼 보일 수 있습니다.

$$
A = PDP^{-1}
$$

여기서 $D$는 고유값들이 대각에 놓인 행렬입니다.

이 말은 복잡한 변환도 적절한 기저에서는 각 축을 독립적으로 늘리고 줄이는 변환처럼 보일 수 있다는 뜻입니다.

이 관점은 다음 주제들과 연결됩니다.

```text
PCA
covariance matrix
stability analysis
vibration mode
optimization Hessian
graph Laplacian
SLAM normal equation
```

## **15. 고유값을 계산하는 trick**

3Blue1Brown 15강은 2x2 행렬에서 eigenvalue를 빠르게 계산하는 방법을 다루지만, 핵심은 여전히 $\det(A-\lambda I)=0$이 어떤 방향의 collapse를 뜻한다는 점입니다.

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch15-eigenvalue-trick.gif" alt="3Blue1Brown Ch.15 eigenvalue trick visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

고유값은 다음 식에서 나옵니다.

$$
A\mathbf{v} = \lambda \mathbf{v}
$$

이를 정리하면

$$
(A - \lambda I)\mathbf{v} = \mathbf{0}
$$

입니다.

고유벡터 $\mathbf{v}$는 0벡터가 아니어야 합니다.

그런데 0이 아닌 벡터가 $(A-\lambda I)$를 통과해서 0이 되려면, 이 변환은 어떤 방향을 0으로 눌러야 합니다.

즉 determinant가 0이어야 합니다.

$$
\det(A - \lambda I) = 0
$$

이 식이 characteristic equation입니다.

여기서 중요한 점은 계산 절차보다 기하학적 의미입니다.

```text
A - lambda I가 어떤 방향을 0으로 누르는 lambda를 찾는다.
그 방향이 eigenvector다.
```

고유값 계산은 갑자기 튀어나온 공식이 아닙니다.

determinant가 0이면 차원이 collapse된다는 관점에서 자연스럽게 나옵니다.

### **15.1 $A-\lambda I$가 0행렬이어야 한다는 뜻이 아니다**

여기서 헷갈리기 쉬운 표현이 있습니다.

```text
A - lambda I가 0이어야 한다.
```

이렇게 말하면 부정확합니다.

필요한 것은 행렬 $A-\lambda I$ 전체가 0행렬이 되는 것이 아닙니다.

정확히 필요한 것은 다음입니다.

$$
(A-\lambda I)\mathbf{v}
=
\mathbf{0},
\qquad
\mathbf{v} \ne \mathbf{0}
$$

즉 $A-\lambda I$가 어떤 0이 아닌 방향을 0으로 보내야 합니다.

왜냐하면 고유벡터의 정의가

$$
A\mathbf{v}=\lambda\mathbf{v}
$$

이고, 오른쪽은

$$
\lambda \mathbf{v}
=
\lambda I\mathbf{v}
$$

로 쓸 수 있기 때문입니다.

따라서

$$
A\mathbf{v}-\lambda I\mathbf{v}
=
\mathbf{0}
$$

이고,

$$
(A-\lambda I)\mathbf{v}
=
\mathbf{0}
$$

가 됩니다.

이 말은 다음과 같습니다.

```text
A와 lambda I가 v 방향에서는 같은 일을 한다.
그래서 그 둘의 차이인 A - lambda I는 v 방향을 0으로 보낸다.
```

즉 $A-\lambda I$의 kernel 안에 고유벡터가 들어갑니다.

$$
\mathbf{v}
\in
\operatorname{ker}(A-\lambda I)
$$

### **15.2 왜 determinant가 0이어야 하는가**

다시

$$
B = A-\lambda I
$$

라고 두겠습니다.

우리는

$$
B\mathbf{v}=\mathbf{0},
\qquad
\mathbf{v}\ne\mathbf{0}
$$

인 벡터를 찾고 있습니다.

만약 $\det(B)\ne0$이면 $B$는 역행렬을 가집니다.

그러면 양변에 $B^{-1}$을 곱해서

$$
\mathbf{v}
=
B^{-1}\mathbf{0}
=
\mathbf{0}
$$

만 나오게 됩니다.

하지만 고유벡터는 0벡터가 될 수 없습니다.

따라서 0이 아닌 해가 존재하려면 $B$는 역행렬을 가지면 안 됩니다.

즉

$$
\det(B)=0
$$

이어야 합니다.

다시 $B=A-\lambda I$를 넣으면

$$
\det(A-\lambda I)=0
$$

입니다.

여기서 중요한 점은 이것입니다.

```text
A 자체의 determinant가 0이어야 하는 것이 아니다.
A - lambda I의 determinant가 0이어야 한다.
```

$A$ 자체는 역행렬을 가질 수도 있습니다.

하지만 특정 $\lambda$를 골랐을 때 $A-\lambda I$가 어떤 방향을 collapse시키면, 그 방향이 고유벡터가 됩니다.

전체 흐름은 다음 한 줄로 정리됩니다.

$$
A\mathbf{v}
=
\lambda\mathbf{v}
\Rightarrow
(A-\lambda I)\mathbf{v}
=
\mathbf{0}
\Rightarrow
\mathbf{v}
\in
\operatorname{ker}(A-\lambda I)
\Rightarrow
\det(A-\lambda I)
=
0
$$

여기서 $\det(A-\lambda I)=0$은 $A-\lambda I$가 전체 공간을 한 점으로 보낸다는 뜻이 아닙니다.

더 정확히는 적어도 하나의 0이 아닌 방향을 0으로 보낸다는 뜻입니다.

즉

$$
\operatorname{rank}(A-\lambda I) < n
$$

이 되고, 그 결과 null space가 0벡터만 있는 공간보다 커집니다.

그 새로 생긴 null space가 바로 해당 $\lambda$의 eigenspace입니다.

정리하면 계산의 목적은 다음입니다.

```text
lambda를 아무 숫자나 넣으면 A - lambda I는 대개 invertible이다.
그때는 kernel이 0뿐이라 eigenvector가 없다.

특별한 lambda를 넣으면 A - lambda I가 singular해진다.
그때 0이 아닌 kernel이 생기고, 그 kernel이 eigenspace가 된다.
```

### **15.3 실제 예제로 보기**

예를 들어

$$
A =
\begin{bmatrix}
3 & 0 \\
1 & 2
\end{bmatrix}
$$

라고 합시다.

고유값은

$$
\det(A-\lambda I)=0
$$

에서 구합니다.

먼저

$$
A-\lambda I
=
\begin{bmatrix}
3-\lambda & 0 \\
1 & 2-\lambda
\end{bmatrix}
$$

이고,

$$
\det(A-\lambda I)
=
(3-\lambda)(2-\lambda)
$$

입니다.

따라서

$$
(3-\lambda)(2-\lambda)=0
$$

이므로

$$
\lambda=3
\quad \text{or} \quad
\lambda=2
$$

입니다.

이제 각 고유값을 다시 넣어서 kernel을 구합니다.

먼저 $\lambda=3$이면

$$
A-3I
=
\begin{bmatrix}
0 & 0 \\
1 & -1
\end{bmatrix}
$$

입니다.

따라서

$$
\begin{bmatrix}
0 & 0 \\
1 & -1
\end{bmatrix}
\begin{bmatrix}
x \\
y
\end{bmatrix}
=
\begin{bmatrix}
0 \\
0
\end{bmatrix}
$$

를 풀면

$$
x-y=0
$$

이므로 $y=x$입니다.

즉

$$
\mathbf{v}
=
x
\begin{bmatrix}
1 \\
1
\end{bmatrix}
$$

이고,

$$
E_3
=
\operatorname{span}
\left\{
\begin{bmatrix}
1 \\
1
\end{bmatrix}
\right\}
$$

입니다.

다음으로 $\lambda=2$이면

$$
A-2I
=
\begin{bmatrix}
1 & 0 \\
1 & 0
\end{bmatrix}
$$

입니다.

따라서

$$
\begin{bmatrix}
1 & 0 \\
1 & 0
\end{bmatrix}
\begin{bmatrix}
x \\
y
\end{bmatrix}
=
\begin{bmatrix}
0 \\
0
\end{bmatrix}
$$

를 풀면 $x=0$이고, $y$는 자유롭게 정할 수 있습니다.

즉

$$
\mathbf{v}
=
y
\begin{bmatrix}
0 \\
1
\end{bmatrix}
$$

이고,

$$
E_2
=
\operatorname{span}
\left\{
\begin{bmatrix}
0 \\
1
\end{bmatrix}
\right\}
$$

입니다.

이 예제에서 순서는 항상 같습니다.

```text
1. det(A - lambda I) = 0으로 eigenvalue를 찾는다.
2. 각 lambda를 A - lambda I에 다시 넣는다.
3. ker(A - lambda I)를 구한다.
4. 그 kernel의 0이 아닌 벡터들이 eigenvector다.
```

### **15.4 eigenbasis와 대각화**

eigenbasis는 “행렬을 대각행렬로 바꿔주는 마법의 물체”라기보다, 고유벡터들로 만든 새로운 좌표계입니다.

위 예제에서는 두 고유벡터 방향

$$
\begin{bmatrix}
1 \\
1
\end{bmatrix},
\qquad
\begin{bmatrix}
0 \\
1
\end{bmatrix}
$$

이 서로 독립입니다.

따라서 이 둘은 $\mathbb{R}^2$의 기저가 될 수 있습니다.

이 고유벡터들을 열로 모으면

$$
P =
\begin{bmatrix}
1 & 0 \\
1 & 1
\end{bmatrix}
$$

입니다.

이 $P$는 표준 좌표계와 고유벡터 좌표계 사이를 바꿔주는 행렬입니다.

고유벡터 좌표계에서 $A$를 보면

$$
P^{-1}AP
=
D
=
\begin{bmatrix}
3 & 0 \\
0 & 2
\end{bmatrix}
$$

처럼 대각행렬이 됩니다.

왜냐하면 고유벡터 방향에서는 $A$가 복잡하게 방향을 섞는 것이 아니라, 각 축을 독립적으로 3배, 2배 하는 일만 하기 때문입니다.

그래서

$$
A=PDP^{-1}
$$

이고,

$$
A^n
=
(PDP^{-1})^n
=
PD^nP^{-1}
$$

로 계산할 수 있습니다.

대각행렬의 거듭제곱은 쉽습니다.

$$
D^n
=
\begin{bmatrix}
3^n & 0 \\
0 & 2^n
\end{bmatrix}
$$

이기 때문입니다.

따라서 eigenbasis를 이해하는 핵심은 다음입니다.

```text
eigenbasis = 고유벡터들로 만든 좌표계
diagonalization = 그 좌표계에서 행렬을 다시 표현하는 것
```

### **15.5 대각화가 안 되는 경우도 있다**

모든 행렬이 eigenbasis를 가지는 것은 아닙니다.

대각화를 하려면 전체 공간을 채울 만큼 충분히 많은 독립적인 고유벡터가 필요합니다.

$n$차원 공간에서는 독립적인 고유벡터가 $n$개 있어야 eigenbasis가 됩니다.

예를 들어 어떤 행렬이 고유값은 있어도 고유벡터 방향이 하나밖에 없다면, 그 고유벡터들만으로 전체 공간을 표현할 수 없습니다.

이 경우에는

```text
eigenvalue는 구할 수 있지만,
eigenbasis는 만들 수 없고,
P^{-1}AP = D 꼴의 완전한 대각화도 안 된다.
```

또 2D에서 순수 회전처럼 모든 벡터의 방향을 바꿔버리는 변환은 실수 범위에서 고유벡터가 없을 수 있습니다.

예를 들어 원점을 중심으로 90도 회전시키면, 0이 아닌 어떤 실수 벡터도 자기 원래 직선 위에 남지 않습니다.

따라서 실수 평면에서는 eigenvector가 없습니다.

이런 경우까지 생각하면 eigenvalue/eigenvector의 의미가 더 선명해집니다.

```text
eigenvector가 있다는 말은,
그 변환이 적어도 어떤 방향은 섞지 않고 자기 직선 위에 남긴다는 뜻이다.
```

## **16. 추상 벡터공간**

3Blue1Brown 16강은 벡터공간을 2D/3D 화살표에서 벗어나 함수, 다항식, 신호 같은 대상으로 확장합니다.

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch16-abstract-vector-spaces.gif" alt="3Blue1Brown Ch.16 abstract vector spaces visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

지금까지는 벡터를 주로 화살표로 생각했습니다.

하지만 벡터공간은 더 넓은 개념입니다.

다음 대상들도 조건만 맞으면 벡터처럼 다룰 수 있습니다.

```text
다항식
함수
신호
이미지
확률변수
행렬
```

예를 들어 다항식

$$
p(x) = 1 + 2x + 3x^2
$$

을 벡터처럼 볼 수 있습니다.

기저를

$$
1,\ x,\ x^2
$$

로 잡으면, 이 다항식은 좌표

$$
\begin{bmatrix}
1 \\
2 \\
3
\end{bmatrix}
$$

처럼 표현됩니다.

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch16-polynomial-basis-detail.gif" alt="3Blue1Brown Ch.16 polynomial basis visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
</figure>

함수도 마찬가지입니다.

두 함수를 더할 수 있고, 스칼라를 곱할 수 있으며, 그 결과가 다시 같은 종류의 함수라면 함수들의 집합도 벡터공간이 될 수 있습니다.

이 추상화 덕분에 선형대수는 단순히 2D, 3D 화살표에만 머무르지 않습니다.

신호처리, 머신러닝, 최적화, 제어, SLAM에서도 같은 언어를 사용할 수 있습니다.

### **16.1 미분도 행렬처럼 볼 수 있다**

추상 벡터공간에서 특히 중요한 예시는 다항식 공간입니다.

3차 이하 다항식들의 공간을

$$
P_3
=
\{a_0+a_1x+a_2x^2+a_3x^3\}
$$

라고 합시다.

이 공간의 basis를

$$
B=\{1,x,x^2,x^3\}
$$

로 잡으면, 다항식

$$
p(x)=5+4x+5x^2+x^3
$$

은 좌표로

$$
[p]_B
=
\begin{bmatrix}
5 \\
4 \\
5 \\
1
\end{bmatrix}
$$

처럼 표현됩니다.

이제 미분 연산자 $D$를 생각해봅니다.

$$
D(1)=0,\qquad
D(x)=1,\qquad
D(x^2)=2x,\qquad
D(x^3)=3x^2
$$

선형변환의 행렬은 basis vector들이 변환된 결과를 열에 넣어서 만듭니다.

따라서 이 basis에서 미분 연산자는 다음 행렬로 표현됩니다.

$$
[D]_B
=
\begin{bmatrix}
0 & 1 & 0 & 0 \\
0 & 0 & 2 & 0 \\
0 & 0 & 0 & 3 \\
0 & 0 & 0 & 0
\end{bmatrix}
$$

실제로 곱해보면

$$
[D]_B[p]_B
=
\begin{bmatrix}
0 & 1 & 0 & 0 \\
0 & 0 & 2 & 0 \\
0 & 0 & 0 & 3 \\
0 & 0 & 0 & 0
\end{bmatrix}
\begin{bmatrix}
5 \\
4 \\
5 \\
1
\end{bmatrix}
=
\begin{bmatrix}
4 \\
10 \\
3 \\
0
\end{bmatrix}
$$

입니다.

이 좌표는 함수

$$
4+10x+3x^2
$$

를 뜻합니다.

실제로

$$
\frac{d}{dx}(5+4x+5x^2+x^3)
=
4+10x+3x^2
$$

이므로 정확히 일치합니다.

즉 미분이라는 연산도 basis를 정하면 행렬곱으로 표현할 수 있습니다.

여기서 다시 중요한 결론이 나옵니다.

```text
행렬은 선형변환 그 자체가 아니라,
특정 basis에서 그 선형변환을 적은 좌표 표현이다.
```

### **16.2 고유벡터에서 고유함수로**

고유벡터 개념도 함수공간으로 그대로 확장됩니다.

행렬에서 고유벡터는

$$
A\mathbf{v}
=
\lambda\mathbf{v}
$$

를 만족하는 벡터였습니다.

미분 연산자에서는 같은 구조가

$$
D(f)
=
\lambda f
$$

가 됩니다.

즉

$$
f'(x)
=
\lambda f(x)
$$

를 만족하는 함수를 찾는 문제입니다.

대표적인 해는

$$
f(x)=e^{\lambda x}
$$

입니다.

왜냐하면

$$
\frac{d}{dx}e^{\lambda x}
=
\lambda e^{\lambda x}
$$

이기 때문입니다.

따라서 $e^{\lambda x}$는 미분 연산자 $D$의 eigenfunction이고, $\lambda$는 그 eigenvalue입니다.

이 예시는 eigenvalue/eigenvector가 단순히 2D 화살표에만 붙는 개념이 아니라는 것을 보여줍니다.

핵심 구조는 항상 같습니다.

```text
변환을 적용했는데,
대상의 형태나 방향은 유지되고,
scale만 바뀐다.
```

행렬에서는 그 대상이 벡터이고, 미분에서는 그 대상이 함수입니다.

## **17. 선형대수는 어디에 응용되는가**

선형대수는 벡터와 행렬을 계산하는 과목을 넘어, 많은 데이터를 표현하고 변환하며 그 안의 구조를 찾는 데 사용됩니다.

서로 달라 보이는 분야도 다음과 같은 공통 문제를 다룹니다.

```text
대상을 벡터로 표현한다.
행렬로 변환을 표현한다.
연립방정식이나 최소제곱 문제를 푼다.
고유값과 고유벡터로 중요한 방향을 찾는다.
기저를 바꾸어 문제를 더 단순하게 본다.
```

### **17.1 컴퓨터 그래픽스와 영상 처리**

컴퓨터 그래픽스에서는 물체의 이동, 회전, 확대와 축소를 행렬로 표현합니다.

3차원 공간의 점을 카메라 좌표계로 옮기고, 다시 2차원 화면에 투영하는 과정도 여러 선형변환의 합성입니다.

영상 역시 각 pixel 값을 모은 벡터나 행렬로 볼 수 있습니다. 그래서 image filtering, compression, feature extraction 같은 작업에도 행렬 연산과 기저변환이 사용됩니다.

### **17.2 데이터 분석과 인공지능**

데이터 분석에서는 하나의 sample을 feature vector로 표현하고, 전체 dataset을 행렬로 구성합니다.

PCA는 covariance matrix의 eigenvector를 이용해 데이터가 가장 크게 퍼져 있는 방향을 찾습니다. 이를 통해 데이터의 중요한 구조를 유지하면서 차원을 줄일 수 있습니다.

신경망의 layer도 기본적으로 입력 벡터에 weight matrix를 곱하고 bias를 더하는 연산으로 시작합니다.

$$
\mathbf{y} = W\mathbf{x} + \mathbf{b}
$$

학습 과정에서는 이 변환이 여러 층에 걸쳐 반복되고, gradient를 이용해 행렬의 값이 갱신됩니다.

### **17.3 로봇공학과 SLAM**

로봇공학에서는 위치, 속도, 힘, sensor measurement를 벡터로 표현합니다. 회전과 좌표계 변환은 행렬로 표현하며, robot frame과 world frame 사이의 관계를 계산할 때 기저변환의 관점이 사용됩니다.

SLAM에서는 sensor measurement와 예측값의 차이를 residual로 만들고, Jacobian으로 이를 현재 추정값 근처에서 선형화합니다. 이후 linear system을 풀어 pose와 map을 갱신합니다.

covariance matrix의 eigenvector와 eigenvalue는 추정값의 uncertainty가 어느 방향으로 얼마나 큰지를 해석하는 데 사용됩니다.

### **17.4 신호 처리와 통신**

소리, 진동, 전파 같은 신호도 시간에 따라 나열된 값의 벡터로 볼 수 있습니다.

Fourier transform은 신호를 시간 영역의 표현에서 주파수 성분을 기준으로 한 표현으로 바꾸는 기저변환입니다. 이 관점을 이용하면 noise 제거, 압축, 주파수 분석이 쉬워집니다.

통신에서는 여러 신호가 섞인 관계를 행렬로 표현하고, 원하는 신호를 복원하거나 간섭을 줄이기 위해 inverse, least squares, singular value decomposition 같은 도구를 사용합니다.

### **17.5 과학과 공학의 수치 계산**

물리 현상이나 공학 시스템을 계산하려면 미분방정식을 유한한 개수의 변수로 근사하는 경우가 많습니다. 이 과정에서 거대한 linear system이 만들어집니다.

구조 해석, 유체 해석, 열전달, 회로 해석에서는 이 linear system을 안정적이고 효율적으로 푸는 것이 핵심입니다.

행렬의 rank, condition number, eigenvalue는 해가 존재하는지, 계산이 얼마나 민감한지, 시스템이 안정적인지를 판단하는 기준이 됩니다.

결국 선형대수는 복잡한 현실의 문제를 벡터와 변환의 언어로 바꾸고, 계산 가능한 형태로 다루게 해주는 공통 도구입니다.

## **18. 한 장 요약**

| 개념 | 기하학적 의미 | 수식 | 왜 중요한가 |
|---|---|---|---|
| Vector | 공간 안의 방향과 크기 | $\mathbf{v}$ | 상태, 위치, 속도, residual의 기본 단위 |
| Linear combination | 여러 방향을 섞어 위치를 만든다 | $a\mathbf{v}+b\mathbf{w}$ | span, basis, coordinate의 출발점 |
| Span | 만들 수 있는 모든 벡터의 집합 | $\operatorname{span}(\cdot)$ | 도달 가능한 공간을 이해 |
| Basis | 공간을 재는 좌표축 | $\mathbf{e}_1,\mathbf{e}_2$ | 좌표 표현의 기준 |
| Matrix | basis vector를 어디로 보내는지 담은 변환 | $A\mathbf{x}$ | 선형변환의 표현 |
| Matrix multiplication | 변환의 합성 | $AB\mathbf{x}=A(B\mathbf{x})$ | 순서가 중요한 이유 설명 |
| Determinant | 면적/부피 스케일 | $\det(A)$ | collapse, invertibility 판단 |
| Inverse | 변환을 되돌리는 변환 | $A^{-1}$ | 선형시스템 해, 복원 가능성 |
| Column space | 도달 가능한 출력 공간 | $\operatorname{Col}(A)$ | $A\mathbf{x}=\mathbf{b}$ 해 존재 조건 |
| Rank | column space의 차원 | $\operatorname{rank}(A)$ | 살아남은 독립 방향 수 |
| Null space | 0으로 사라지는 입력 방향 | $\operatorname{Null}(A)$ | 잃어버린 정보, 관측 불가능 방향 |
| Dot product | projection과 방향 유사도 | $\mathbf{v}\cdot\mathbf{w}$ | gradient, residual, projection |
| Cross product | oriented area와 수직 방향 | $\mathbf{v}\times\mathbf{w}$ | normal vector, geometry |
| Change of basis | 같은 벡터를 다른 좌표계로 읽기 | $P^{-1}AP$ | frame 변환, diagonalization |
| Eigenvector | 변환 후에도 방향이 유지되는 벡터 | $A\mathbf{v}=\lambda\mathbf{v}$ | 주된 방향, 안정성, PCA |
| Eigenvalue | eigenvector 방향의 scale | $\lambda$ | conditioning, uncertainty, mode 분석 |
| Eigenspace | 같은 eigenvalue를 공유하는 방향 공간 | $\operatorname{ker}(A-\lambda I)$ | 여러 고유벡터를 하나의 공간으로 이해 |
| Eigenbasis | 고유벡터들로 만든 basis | $P^{-1}AP=D$ | 복잡한 변환을 축별 scale로 분리 |
| Abstract vector space | 화살표 밖의 벡터 개념 | functions, polynomials | 신호, 이미지, 함수공간까지 확장 |
