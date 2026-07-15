---
title: "[Linear Algebra] 3Blue1Brown 선형대수학의 본질 정리"
date: 2026-07-10 16:21:54 +0900
last_modified_at: 2026-07-15 22:20:55 +0900
categories: [Math, Study]
tags: [linear-algebra, 3blue1brown, vector, matrix, determinant, eigenvalue, eigenvector, basis, dot-product, cross-product, cramer-rule]
description: "3Blue1Brown의 선형대수학의 본질 시리즈를 바탕으로 벡터, 선형결합, 기저, 행렬, 행렬곱, determinant, 역행렬, 내적, 외적, 고유값, 고유벡터, 추상 벡터공간을 시각적 관점에서 정리한다."
image: /assets/img/posts/math/linear-algebra-3b1b/00-linear-algebra-preview.png
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

이번 수정에서는 3Blue1Brown 공식 **Essence of Linear Algebra** playlist 기준으로 1강부터 16강까지의 공식 YouTube 영상을 각 개념 섹션에 임베드했습니다.

각 섹션에는 공식 YouTube embed를 먼저 두고, 바로 아래에는 원본 영상에서 짧게 발췌한 대표 study용 GIF를 붙였습니다. 그리고 글로만 읽으면 다시 헷갈릴 만한 지점에는 보조 GIF를 추가했습니다.

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
2. 각 GIF 바로 아래 caption에 3Blue1Brown 출처 명시
3. caption에 원본 영상 링크 제공
4. 주변 본문에서 개념 해석을 덧붙여, clip 자체만 통째로 재업로드하는 형태는 피함
```

즉 단순히 “출처 적었으니 아무거나 써도 된다”는 뜻은 아닙니다.

이 글에서는 원본 영상은 공식 YouTube embed로 연결하고, 1강부터 16강까지는 각 강마다 원본 영상에서 짧게 발췌한 대표 GIF clip을 함께 넣었습니다. 추가로 개념상 중요한 곳에는 보조 GIF clip을 더 넣었습니다.

각 GIF는 각 원본 영상에서 60초 미만으로 발췌했습니다. 너무 짧아서 개념 흐름이 잘리는 장면은 조금 더 길게 잡고, 느리게 늘어지는 장면은 빠르게 압축했습니다. GIF 자체에는 별도 글자를 덮지 않고, 바로 아래 caption에 출처와 원본 링크를 연결했습니다.

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

<div class="ratio ratio-16x9 my-3">
  <iframe src="https://www.youtube-nocookie.com/embed/fNk_zzaMoSs" title="3Blue1Brown Chapter 1 - Vectors" loading="lazy" allowfullscreen></iframe>
</div>

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch01-vectors.gif" alt="3Blue1Brown Ch.1 vectors visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
  <figcaption class="text-center text-muted small mt-2">
    Source: <a href="https://youtu.be/fNk_zzaMoSs">3Blue1Brown Ch.1</a>. 원본 영상에서 짧게 발췌한 study용 GIF clip입니다.
  </figcaption>
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
  <figcaption class="text-center text-muted small mt-2">
    Source: <a href="https://youtu.be/fNk_zzaMoSs">3Blue1Brown Ch.1</a>. 벡터 덧셈을 이동의 합성으로 보기 위한 보조 study용 GIF clip입니다.
  </figcaption>
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
  <figcaption class="text-center text-muted small mt-2">
    Source: <a href="https://youtu.be/fNk_zzaMoSs">3Blue1Brown Ch.1</a>. 스칼라 곱이 벡터의 길이와 방향을 바꾸는 과정을 보여주는 보조 study용 GIF clip입니다.
  </figcaption>
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

<div class="ratio ratio-16x9 my-3">
  <iframe src="https://www.youtube-nocookie.com/embed/k7RM-ot2NWY" title="3Blue1Brown Chapter 2 - Linear combinations, span, and basis vectors" loading="lazy" allowfullscreen></iframe>
</div>

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch02-linear-combination.gif" alt="3Blue1Brown Ch.2 linear combination visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
  <figcaption class="text-center text-muted small mt-2">
    Source: <a href="https://youtu.be/k7RM-ot2NWY">3Blue1Brown Ch.2</a>. 원본 영상에서 짧게 발췌한 study용 GIF clip입니다.
  </figcaption>
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
  <figcaption class="text-center text-muted small mt-2">
    Source: <a href="https://youtu.be/k7RM-ot2NWY">3Blue1Brown Ch.2</a>. span이 직선이나 평면으로 제한될 때 선형종속이 무엇을 뜻하는지 보여주는 보조 study용 GIF clip입니다.
  </figcaption>
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

<div class="ratio ratio-16x9 my-3">
  <iframe src="https://www.youtube-nocookie.com/embed/kYB8IZa5AuE" title="3Blue1Brown Chapter 3 - Linear transformations and matrices" loading="lazy" allowfullscreen></iframe>
</div>

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch03-linear-transform.gif" alt="3Blue1Brown Ch.3 linear transformation visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
  <figcaption class="text-center text-muted small mt-2">
    Source: <a href="https://youtu.be/kYB8IZa5AuE">3Blue1Brown Ch.3</a>. 원본 영상에서 짧게 발췌한 study용 GIF clip입니다.
  </figcaption>
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
  <figcaption class="text-center text-muted small mt-2">
    Source: <a href="https://youtu.be/kYB8IZa5AuE">3Blue1Brown Ch.3</a>. basis vector의 이동이 격자 전체의 이동을 결정하는 보조 study용 GIF clip입니다.
  </figcaption>
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

<div class="ratio ratio-16x9 my-3">
  <iframe src="https://www.youtube-nocookie.com/embed/XkY2DOUCWMU" title="3Blue1Brown Chapter 4 - Matrix multiplication as composition" loading="lazy" allowfullscreen></iframe>
</div>

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch04-matrix-composition.gif" alt="3Blue1Brown Ch.4 matrix composition visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
  <figcaption class="text-center text-muted small mt-2">
    Source: <a href="https://youtu.be/XkY2DOUCWMU">3Blue1Brown Ch.4</a>. 원본 영상에서 짧게 발췌한 study용 GIF clip입니다.
  </figcaption>
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

<div class="ratio ratio-16x9 my-3">
  <iframe src="https://www.youtube-nocookie.com/embed/rHLEWRxRGiM" title="3Blue1Brown Chapter 5 - Three-dimensional linear transformations" loading="lazy" allowfullscreen></iframe>
</div>

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch05-three-d-transform.gif" alt="3Blue1Brown Ch.5 3D transformation visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
  <figcaption class="text-center text-muted small mt-2">
    Source: <a href="https://youtu.be/rHLEWRxRGiM">3Blue1Brown Ch.5</a>. 원본 영상에서 짧게 발췌한 study용 GIF clip입니다.
  </figcaption>
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

<div class="ratio ratio-16x9 my-3">
  <iframe src="https://www.youtube-nocookie.com/embed/Ip3X9LOh2dk" title="3Blue1Brown Chapter 6 - The determinant" loading="lazy" allowfullscreen></iframe>
</div>

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch06-determinant.gif" alt="3Blue1Brown Ch.6 determinant visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
  <figcaption class="text-center text-muted small mt-2">
    Source: <a href="https://youtu.be/Ip3X9LOh2dk">3Blue1Brown Ch.6</a>. 원본 영상에서 짧게 발췌한 study용 GIF clip입니다.
  </figcaption>
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
  <figcaption class="text-center text-muted small mt-2">
    Source: <a href="https://youtu.be/Ip3X9LOh2dk">3Blue1Brown Ch.6</a>. determinant가 0에 가까워질 때 면적이 낮은 차원으로 collapse되는 보조 study용 GIF clip입니다.
  </figcaption>
</figure>

그래서 determinant가 0이면 역변환을 만들 수 없습니다.

공간이 한 번 낮은 차원으로 찌그러지면, 원래 어디서 왔는지 되돌릴 정보가 사라지기 때문입니다.

## **8. 역행렬, column space, null space**

3Blue1Brown 7강은 inverse, column space, null space를 선형시스템의 기하학으로 연결합니다.

<div class="ratio ratio-16x9 my-3">
  <iframe src="https://www.youtube-nocookie.com/embed/uQhTuRlWMxw" title="3Blue1Brown Chapter 7 - Inverse matrices, column space, and null space" loading="lazy" allowfullscreen></iframe>
</div>

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch07-inverse-column-null.gif" alt="3Blue1Brown Ch.7 inverse column space null space visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
  <figcaption class="text-center text-muted small mt-2">
    Source: <a href="https://youtu.be/uQhTuRlWMxw">3Blue1Brown Ch.7</a>. 원본 영상에서 짧게 발췌한 study용 GIF clip입니다.
  </figcaption>
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
  <figcaption class="text-center text-muted small mt-2">
    Source: <a href="https://youtu.be/uQhTuRlWMxw">3Blue1Brown Ch.7</a>. column space와 null space를 선형변환의 출력 가능 영역과 사라지는 입력 방향으로 보는 보조 study용 GIF clip입니다.
  </figcaption>
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

## **9. 정방행렬이 아닌 행렬**

3Blue1Brown 8강은 정방행렬이 아닌 행렬을 차원 사이의 변환으로 봅니다.

<div class="ratio ratio-16x9 my-3">
  <iframe src="https://www.youtube-nocookie.com/embed/v8VSDg_WQlA" title="3Blue1Brown Chapter 8 - Nonsquare matrices as transformations between dimensions" loading="lazy" allowfullscreen></iframe>
</div>

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch08-nonsquare-map.gif" alt="3Blue1Brown Ch.8 nonsquare matrix visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
  <figcaption class="text-center text-muted small mt-2">
    Source: <a href="https://youtu.be/v8VSDg_WQlA">3Blue1Brown Ch.8</a>. 원본 영상에서 짧게 발췌한 study용 GIF clip입니다.
  </figcaption>
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

<div class="ratio ratio-16x9 my-3">
  <iframe src="https://www.youtube-nocookie.com/embed/LyGKycYT2v0" title="3Blue1Brown Chapter 9 - Dot products and duality" loading="lazy" allowfullscreen></iframe>
</div>

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch09-dot-product.gif" alt="3Blue1Brown Ch.9 dot product visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
  <figcaption class="text-center text-muted small mt-2">
    Source: <a href="https://youtu.be/LyGKycYT2v0">3Blue1Brown Ch.9</a>. 원본 영상에서 짧게 발췌한 study용 GIF clip입니다.
  </figcaption>
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
  <figcaption class="text-center text-muted small mt-2">
    Source: <a href="https://youtu.be/LyGKycYT2v0">3Blue1Brown Ch.9</a>. 내적을 projection 길이와 방향성으로 해석하는 보조 study용 GIF clip입니다.
  </figcaption>
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

<div class="ratio ratio-16x9 my-3">
  <iframe src="https://www.youtube-nocookie.com/embed/eu6i7WJeinw" title="3Blue1Brown Chapter 10 - Cross products" loading="lazy" allowfullscreen></iframe>
</div>

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch10-cross-product.gif" alt="3Blue1Brown Ch.10 cross product visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
  <figcaption class="text-center text-muted small mt-2">
    Source: <a href="https://youtu.be/eu6i7WJeinw">3Blue1Brown Ch.10</a>. 원본 영상에서 짧게 발췌한 study용 GIF clip입니다.
  </figcaption>
</figure>

3Blue1Brown 11강은 외적을 선형변환과 duality 관점에서 한 단계 더 깊게 봅니다.

<div class="ratio ratio-16x9 my-3">
  <iframe src="https://www.youtube-nocookie.com/embed/BaM7OCEm3G0" title="3Blue1Brown Chapter 11 - Cross products in the light of linear transformations" loading="lazy" allowfullscreen></iframe>
</div>

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch11-cross-product-duality.gif" alt="3Blue1Brown Ch.11 cross product duality visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
  <figcaption class="text-center text-muted small mt-2">
    Source: <a href="https://youtu.be/BaM7OCEm3G0">3Blue1Brown Ch.11</a>. 원본 영상에서 짧게 발췌한 study용 GIF clip입니다.
  </figcaption>
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

<div class="ratio ratio-16x9 my-3">
  <iframe src="https://www.youtube-nocookie.com/embed/jBsC34PxzoM" title="3Blue1Brown Chapter 12 - Cramer's rule, explained geometrically" loading="lazy" allowfullscreen></iframe>
</div>

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch12-cramers-rule.gif" alt="3Blue1Brown Ch.12 Cramer's rule visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
  <figcaption class="text-center text-muted small mt-2">
    Source: <a href="https://youtu.be/jBsC34PxzoM">3Blue1Brown Ch.12</a>. 원본 영상에서 짧게 발췌한 study용 GIF clip입니다.
  </figcaption>
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

<div class="ratio ratio-16x9 my-3">
  <iframe src="https://www.youtube-nocookie.com/embed/P2LTAUO1TdA" title="3Blue1Brown Chapter 13 - Change of basis" loading="lazy" allowfullscreen></iframe>
</div>

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch13-change-of-basis.gif" alt="3Blue1Brown Ch.13 change of basis visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
  <figcaption class="text-center text-muted small mt-2">
    Source: <a href="https://youtu.be/P2LTAUO1TdA">3Blue1Brown Ch.13</a>. 원본 영상에서 짧게 발췌한 study용 GIF clip입니다.
  </figcaption>
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
  <figcaption class="text-center text-muted small mt-2">
    Source: <a href="https://youtu.be/P2LTAUO1TdA">3Blue1Brown Ch.13</a>. 같은 벡터가 좌표계에 따라 다른 숫자로 읽히는 것을 보여주는 보조 study용 GIF clip입니다.
  </figcaption>
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

## **14. 고유벡터와 고유값**

3Blue1Brown 14강은 eigenvector를 선형변환 이후에도 같은 직선 위에 남는 특수한 방향으로 설명합니다.

<div class="ratio ratio-16x9 my-3">
  <iframe src="https://www.youtube-nocookie.com/embed/PFDu9oVAE-g" title="3Blue1Brown Chapter 14 - Eigenvectors and eigenvalues" loading="lazy" allowfullscreen></iframe>
</div>

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch14-eigenvectors.gif" alt="3Blue1Brown Ch.14 eigenvectors and eigenvalues visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
  <figcaption class="text-center text-muted small mt-2">
    Source: <a href="https://youtu.be/PFDu9oVAE-g">3Blue1Brown Ch.14</a>. 원본 영상에서 짧게 발췌한 study용 GIF clip입니다.
  </figcaption>
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
  <figcaption class="text-center text-muted small mt-2">
    Source: <a href="https://youtu.be/PFDu9oVAE-g">3Blue1Brown Ch.14</a>. 선형변환 뒤에도 방향이 유지되는 eigenvector를 보여주는 보조 study용 GIF clip입니다.
  </figcaption>
</figure>

그 방향이 eigenvector이고, 그 방향으로 얼마나 늘거나 줄었는지를 나타내는 값이 eigenvalue입니다.

즉 고유벡터는 선형변환이 공간을 움직일 때 변환의 핵심 방향을 알려줍니다.

### **14.1 고유값의 의미**

$\lambda = 2$이면 그 방향으로 2배 늘어납니다.

$\lambda = 0.5$이면 그 방향으로 절반으로 줄어듭니다.

$\lambda = -1$이면 같은 직선 위에서 방향이 반대로 뒤집힙니다.

$\lambda = 0$이면 그 방향이 0으로 눌립니다.

그래서 eigenvalue는 각 eigenvector 방향에서 변환이 얼마나 강하게 작용하는지 알려줍니다.

### **14.2 왜 중요한가**

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

<div class="ratio ratio-16x9 my-3">
  <iframe src="https://www.youtube-nocookie.com/embed/e50Bj7jn9IQ" title="3Blue1Brown Chapter 15 - A quick trick for computing eigenvalues" loading="lazy" allowfullscreen></iframe>
</div>

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch15-eigenvalue-trick.gif" alt="3Blue1Brown Ch.15 eigenvalue trick visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
  <figcaption class="text-center text-muted small mt-2">
    Source: <a href="https://youtu.be/e50Bj7jn9IQ">3Blue1Brown Ch.15</a>. 원본 영상에서 짧게 발췌한 study용 GIF clip입니다.
  </figcaption>
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

## **16. 추상 벡터공간**

3Blue1Brown 16강은 벡터공간을 2D/3D 화살표에서 벗어나 함수, 다항식, 신호 같은 대상으로 확장합니다.

<div class="ratio ratio-16x9 my-3">
  <iframe src="https://www.youtube-nocookie.com/embed/TgKwz5Ikpc8" title="3Blue1Brown Chapter 16 - Abstract vector spaces" loading="lazy" allowfullscreen></iframe>
</div>

<figure class="my-3">
  <img src="/assets/img/posts/math/linear-algebra-3b1b/original/3b1b-ch16-abstract-vector-spaces.gif" alt="3Blue1Brown Ch.16 abstract vector spaces visual clip" class="d-block mx-auto" loading="lazy" style="width: 100%; border-radius: 6px;">
  <figcaption class="text-center text-muted small mt-2">
    Source: <a href="https://youtu.be/TgKwz5Ikpc8">3Blue1Brown Ch.16</a>. 원본 영상에서 짧게 발췌한 study용 GIF clip입니다.
  </figcaption>
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
  <figcaption class="text-center text-muted small mt-2">
    Source: <a href="https://youtu.be/TgKwz5Ikpc8">3Blue1Brown Ch.16</a>. 다항식을 basis function의 선형결합으로 보는 보조 study용 GIF clip입니다.
  </figcaption>
</figure>

함수도 마찬가지입니다.

두 함수를 더할 수 있고, 스칼라를 곱할 수 있으며, 그 결과가 다시 같은 종류의 함수라면 함수들의 집합도 벡터공간이 될 수 있습니다.

이 추상화 덕분에 선형대수는 단순히 2D, 3D 화살표에만 머무르지 않습니다.

신호처리, 머신러닝, 최적화, 제어, SLAM에서도 같은 언어를 사용할 수 있습니다.

## **17. SLAM과 로봇공학에서 왜 중요한가**

내가 SLAM을 공부하는 입장에서 선형대수가 중요한 이유는 매우 직접적입니다.

SLAM은 결국 다음을 반복합니다.

```text
pose를 표현한다.
sensor measurement를 예측한다.
예측과 실제의 residual을 계산한다.
Jacobian으로 residual의 변화를 선형화한다.
linear system을 풀어 state update를 구한다.
좌표계를 바꾸며 map과 sensor frame을 연결한다.
```

여기서 거의 모든 단계가 선형대수입니다.

### **17.1 pose와 frame**

3D pose는 보통 회전 $R$과 이동 $\mathbf{t}$로 표현합니다.

$$
\mathbf{p}_{world}
=
R\mathbf{p}_{body} + \mathbf{t}
$$

여기서 $R$은 회전행렬이고, 회전행렬의 열벡터는 body frame의 basis가 world frame에서 어떻게 보이는지 나타냅니다.

즉 frame 변환은 basis 변환과 매우 가깝습니다.

### **17.2 Jacobian**

비선형 함수 $f(\mathbf{x})$를 현재 추정값 근처에서 선형화하면

$$
f(\mathbf{x} + \delta\mathbf{x})
\approx
f(\mathbf{x}) + J\delta\mathbf{x}
$$

가 됩니다.

여기서 $J$가 Jacobian입니다.

Jacobian은 작은 state 변화가 measurement나 residual을 어느 방향으로 얼마나 바꾸는지 나타내는 선형변환입니다.

즉 Jacobian도 숫자 표가 아니라, local하게 공간을 움직이는 변환입니다.

### **17.3 normal equation과 eigenvalue**

최소제곱 문제에서는 보통 다음 형태가 나옵니다.

$$
J^T J \delta\mathbf{x} = -J^T \mathbf{r}
$$

여기서 $J^TJ$는 Hessian approximation처럼 볼 수 있습니다.

이 행렬의 eigenvalue는 어떤 방향이 잘 관측되는지, 어떤 방향이 약하게 관측되는지와 연결됩니다.

eigenvalue가 매우 작으면 그 방향은 정보가 부족하거나 ill-conditioned일 수 있습니다.

SLAM에서 corridor, 평면 벽, 반복 구조물 같은 환경에서 특정 방향 drift가 커지는 이유도 이런 관측 가능성 문제와 연결됩니다.

### **17.4 covariance**

확률적 추정에서는 covariance matrix가 중요합니다.

covariance matrix의 eigenvector는 uncertainty의 주된 방향을, eigenvalue는 그 방향의 분산 크기를 나타냅니다.

그래서 uncertainty ellipsoid를 이해하는 것도 결국 eigenvector와 eigenvalue의 기하학적 해석입니다.

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
| Null space | 0으로 사라지는 입력 방향 | $\operatorname{Null}(A)$ | 잃어버린 정보, 관측 불가능 방향 |
| Dot product | projection과 방향 유사도 | $\mathbf{v}\cdot\mathbf{w}$ | gradient, residual, projection |
| Cross product | oriented area와 수직 방향 | $\mathbf{v}\times\mathbf{w}$ | normal vector, geometry |
| Change of basis | 같은 벡터를 다른 좌표계로 읽기 | $P^{-1}AP$ | frame 변환, diagonalization |
| Eigenvector | 변환 후에도 방향이 유지되는 벡터 | $A\mathbf{v}=\lambda\mathbf{v}$ | 주된 방향, 안정성, PCA |
| Eigenvalue | eigenvector 방향의 scale | $\lambda$ | conditioning, uncertainty, mode 분석 |
| Abstract vector space | 화살표 밖의 벡터 개념 | functions, polynomials | 신호, 이미지, 함수공간까지 확장 |

## **19. 공부 순서**

3Blue1Brown 시리즈를 볼 때는 단순히 공식을 외우기보다, 각 장이 끝날 때 다음 질문에 답할 수 있는지 확인하는 게 좋습니다.

```text
1. 벡터
   벡터를 화살표, 숫자 리스트, 추상 원소 관점에서 설명할 수 있는가?

2. 선형결합, span, basis
   어떤 벡터들이 공간 전체를 만들 수 있는지 판단할 수 있는가?

3. 행렬과 선형변환
   행렬의 각 열이 무엇을 의미하는지 설명할 수 있는가?

4. 행렬곱
   AB와 BA가 왜 일반적으로 다른지 공간 변환으로 설명할 수 있는가?

5. determinant
   determinant가 0이라는 말을 차원 collapse로 설명할 수 있는가?

6. inverse, column space, null space
   선형시스템의 해 존재성과 도달 가능한 공간을 연결할 수 있는가?

7. dot product, cross product
   내적과 외적을 길이, 면적, projection으로 해석할 수 있는가?

8. Cramer's rule
   해를 determinant 비율로 보는 기하학적 의미를 설명할 수 있는가?

9. change of basis
   벡터와 좌표 표현을 구분할 수 있는가?

10. eigenvector, eigenvalue
    변환의 핵심 방향과 scale을 설명할 수 있는가?

11. abstract vector space
    함수나 다항식도 벡터처럼 다룰 수 있는 이유를 설명할 수 있는가?
```

이 질문들에 답할 수 있으면, 선형대수는 공식 모음이 아니라 하나의 언어처럼 보이기 시작합니다.

## **20. 참고 링크**

이 글은 아래 자료들을 바탕으로 공부 내용을 정리한 것입니다.

- [3Blue1Brown 한국어 선형대수학의 본질 재생목록](https://www.youtube.com/playlist?list=PLOEOa0pDLTZaglBDKWxV4t80Y3Psk_Hg4)
- [3Blue1Brown Essence of Linear Algebra official playlist](https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab)
- [3Blue1Brown About / FAQ - material usage guidance](https://www.3blue1brown.com/about/)
- [3Blue1Brown - Vectors](https://youtu.be/fNk_zzaMoSs)
- [3Blue1Brown - Linear combinations, span, and basis vectors](https://www.3blue1brown.com/lessons/span/)
- [3Blue1Brown - Essence of linear algebra preview](https://www.3blue1brown.com/lessons/eola-preview/)
- [3Blue1Brown - Linear transformations and matrices](https://www.3blue1brown.com/lessons/linear-transformations/)
- [3Blue1Brown - Matrix multiplication as composition](https://www.3blue1brown.com/lessons/matrix-multiplication/)
- [3Blue1Brown - Three-dimensional linear transformations](https://www.3blue1brown.com/lessons/3d-transformations/)
- [3Blue1Brown - The determinant](https://www.3blue1brown.com/lessons/determinant/)
- [3Blue1Brown - Inverse matrices, column space, and null space](https://www.3blue1brown.com/lessons/inverse-matrices/)
- [3Blue1Brown - Nonsquare matrices as transformations between dimensions](https://www.3blue1brown.com/lessons/nonsquare-matrices/)
- [3Blue1Brown - Dot products and duality](https://www.3blue1brown.com/lessons/dot-products/)
- [3Blue1Brown - Cross products](https://www.3blue1brown.com/lessons/cross-products/)
- [3Blue1Brown - Cross products in the light of linear transformations](https://www.3blue1brown.com/lessons/cross-products-extended/)
- [3Blue1Brown - Cramer's rule, explained geometrically](https://www.3blue1brown.com/lessons/cramers-rule/)
- [3Blue1Brown - Change of basis](https://www.3blue1brown.com/lessons/change-of-basis/)
- [3Blue1Brown - Eigenvectors and eigenvalues](https://www.3blue1brown.com/lessons/eigenvalues/)
- [3Blue1Brown - A quick trick for computing eigenvalues](https://youtu.be/e50Bj7jn9IQ)
- [3Blue1Brown - Abstract vector spaces](https://www.3blue1brown.com/lessons/abstract-vector-spaces/)

원 영상과 공식 글은 시각화가 핵심입니다. 이 글은 그 자료들을 대체하려는 것이 아니라, 원본 영상과 함께 보면서 개념을 다시 잡기 위한 내 공부용 정리입니다.
