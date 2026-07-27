---
title: "[SLAM Study 1주차] 좌표계와 SE(3)"
date: 2026-06-25 22:00:00 +0900
published: false
last_modified_at: 2026-06-30 20:18:21 +0900
categories: [SLAM, Study]
tags: [slam, lidar-slam, se3, so3, coordinate-frame, transform, lidar, imu, robotics]
description: SLAM 공부 1주차에 좌표계 frame, transform composition, relative pose, rotation log, interpolation, frame_motion_analyzer 구현 흐름을 정리한다.
math: true
---

## **0. 이번 주에 잡아야 하는 것**

SLAM을 공부할 때 처음부터 scan matching, factor graph, loop closure로 들어가면 금방 헷갈립니다. 그 전에 반드시 잡아야 하는 것이 있습니다.

> 이 값은 어느 frame 기준인가?

LiDAR point, IMU measurement, robot pose, map point는 모두 좌표로 표현됩니다. 하지만 좌표값만 보면 안 됩니다. 같은 물리적 점도 world 기준인지, robot base 기준인지, LiDAR 기준인지에 따라 숫자가 달라집니다.

이번 1주차의 목표는 SLAM 알고리즘을 구현하는 것이 아니라, 다음 계산을 정확히 이해하고 코드로 확인하는 것입니다.

$$
{}^W T_L = {}^W T_B {}^B T_L
$$

그리고 scan 내부의 어느 시점 $t_i$에서 LiDAR가 기준 시점 $t_r$ 대비 얼마나 움직였는지 계산합니다.

$$
\Delta T_i =
{}^W T_L(t_r)^{-1}
{}^W T_L(t_i)
$$

여기서 뽑고 싶은 것은 scan 내부 translation, rotation, roll/pitch/yaw 변화, 그리고 최대 pose deviation입니다.

## **1. Frame이란 무엇인가**

frame은 위치와 방향을 표현하기 위한 기준 좌표계입니다.

예를 들어 같은 컵도 방 기준으로 보면 $(5, 2, 1)$일 수 있고, 책상 기준으로 보면 $(1, 0, 1)$일 수 있습니다. 컵은 하나지만 기준 좌표계가 다르기 때문에 좌표값이 달라집니다.

로봇에서도 똑같습니다.

| Frame | 의미 |
|---|---|
| $W$ | world 또는 map frame. 움직이지 않는 지도 기준 |
| $B$ | robot base frame. 로봇 몸통에 붙어 같이 움직이는 기준 |
| $I$ | IMU frame. IMU 센서에 붙은 기준 |
| $L$ | LiDAR frame. LiDAR 센서에 붙은 기준 |

이번 주에는 특히 $W$, $B$, $L$을 정확히 구분해야 합니다.

LiDAR가 base 위에 고정되어 있다는 말은 다음 뜻입니다.

> $B$ 기준으로 본 $L$의 위치와 방향은 고정되어 있다.

하지만 world에서 본 LiDAR pose는 로봇이 움직이면 계속 바뀝니다.

즉,

$$
{}^B T_L = \text{constant}
$$

이지만,

$$
{}^W T_L(t)
$$

는 시간에 따라 변합니다.

## **2. Pose와 Transform Matrix**

pose는 위치와 방향을 합친 값입니다.

3D에서 pose는 보통 4x4 homogeneous transform으로 표현합니다.

$$
T =
\begin{bmatrix}
R & t \\
0 & 1
\end{bmatrix}
$$

여기서 $R$은 3x3 rotation matrix이고, $t$는 3D translation vector입니다.

예를 들어 base pose가 world 기준으로 $x=2$, $y=1$, $z=0.4$에 있고 회전이 없다면,

$$
{}^W T_B =
\begin{bmatrix}
1 & 0 & 0 & 2 \\
0 & 1 & 0 & 1 \\
0 & 0 & 1 & 0.4 \\
0 & 0 & 0 & 1
\end{bmatrix}
$$

입니다.

LiDAR가 base 기준으로 앞쪽 0.3m, 위쪽 0.2m에 있고 회전이 없다면,

$$
{}^B T_L =
\begin{bmatrix}
1 & 0 & 0 & 0.3 \\
0 & 1 & 0 & 0 \\
0 & 0 & 1 & 0.2 \\
0 & 0 & 0 & 1
\end{bmatrix}
$$

입니다.

이때 world에서 본 LiDAR pose는 두 transform을 곱해서 얻습니다.

$$
{}^W T_L = {}^W T_B {}^B T_L
$$

회전이 없으면 단순히 위치를 더하는 것처럼 보입니다.

```text
base in W  = (2.0, 1.0, 0.4)
lidar in B = (0.3, 0.0, 0.2)
lidar in W = (2.3, 1.0, 0.6)
```

하지만 base가 회전하면 LiDAR offset도 base 회전에 의해 같이 회전합니다. 그래서 실제 계산에서는 항상 transform matrix 곱을 사용해야 합니다.

### **Notation을 먼저 고정하기**

SLAM에서 가장 많이 틀리는 부분은 transform 자체보다 notation입니다.

이 글에서는 다음 convention을 씁니다.

$$
{}^A T_B
$$

는 `B frame에서 표현된 좌표를 A frame 좌표로 바꾸는 transform`입니다.

즉 point $\mathbf{p}$가 $B$ frame 좌표로 주어졌다면:

$$
{}^A \mathbf{p}
=
{}^A T_B
{}^B \mathbf{p}
$$

입니다.

그래서 ${}^W T_L$은 다음 두 의미를 동시에 가집니다.

```text
1. LiDAR frame의 원점과 축이 world에서 어디 있는가?
2. LiDAR frame 좌표로 표현된 point를 world frame 좌표로 어떻게 바꾸는가?
```

이 둘이 같은 행렬로 표현되기 때문에 헷갈립니다.

첫 번째는 pose 해석이고, 두 번째는 coordinate transform 해석입니다.

코드에서는 보통 두 번째 해석이 더 중요합니다.

```python
p_W = T_WL @ p_L
```

즉 `T_WL`은 `LiDAR point를 world로 보낸다`고 읽으면 실수를 줄일 수 있습니다.

### **Active Transform과 Passive Transform**

조금 더 깊게 들어가면 transform에는 두 가지 해석이 있습니다.

```text
active transform:
  물체 또는 point 자체를 움직인다.

passive transform:
  같은 물리적 point를 다른 frame 좌표로 다시 표현한다.
```

SLAM에서 frame 변환은 대부분 passive 해석입니다.

world에 고정된 벽 point가 실제로 움직이는 것이 아니라, 그 point를 LiDAR frame에서 볼지 world frame에서 볼지 좌표 표현만 바꾸는 것입니다.

하지만 수식 모양은 active transform처럼 보일 수 있습니다.

그래서 안전한 기준은 다음입니다.

```text
이 행렬은 point를 실제로 움직이는가?
아니면 같은 point의 좌표 표현을 바꾸는가?
```

deskew를 공부할 때도 이 구분이 중요합니다.

deskew는 벽을 움직이는 것이 아니라, 서로 다른 시점의 LiDAR frame에서 측정된 point들을 같은 기준 frame으로 다시 표현하는 과정입니다.

## **3. Transform Composition**

가장 중요한 식은 이것입니다.

$$
{}^W T_L = {}^W T_B {}^B T_L
$$

이 식의 의미는 다음과 같습니다.

1. $ {}^B T_L $: base 기준으로 본 LiDAR pose
2. $ {}^W T_B $: world 기준으로 본 base pose
3. $ {}^W T_L $: world 기준으로 본 LiDAR pose

즉 LiDAR pose는 base pose와 LiDAR extrinsic을 합성해서 구합니다.

코드로는 다음 형태입니다.

```python
T_WL = T_WB @ T_BL
```

여기서 순서가 중요합니다.

```python
T_WB @ T_BL  # 맞음
T_BL @ T_WB  # 일반적으로 틀림
```

transform 곱셈은 교환법칙이 성립하지 않습니다.

## **4. Inverse와 Relative Pose**

scan 안에서 LiDAR가 얼마나 움직였는지 보려면 절대 pose 두 개를 비교해야 합니다.

기준 시점의 LiDAR pose를 $T_{\text{ref}}$, 현재 시점의 LiDAR pose를 $T_i$라고 하면 상대 pose는 다음과 같습니다.

$$
T_{\text{rel}, i} = T_{\text{ref}}^{-1} T_i
$$

이 값의 의미는 다음입니다.

> 기준 LiDAR frame에서 봤을 때, 현재 LiDAR frame이 어디에 있고 얼마나 회전했는가?

rigid transform inverse는 다음처럼 계산됩니다.

$$
T =
\begin{bmatrix}
R & t \\
0 & 1
\end{bmatrix}
$$

이면,

$$
T^{-1} =
\begin{bmatrix}
R^T & -R^T t \\
0 & 1
\end{bmatrix}
$$

입니다.

코드로는 다음처럼 쓸 수 있습니다.

```python
def inverse_transform(T):
    R = T[:3, :3]
    t = T[:3, 3]

    T_inv = np.eye(4)
    T_inv[:3, :3] = R.T
    T_inv[:3, 3] = -R.T @ t
    return T_inv


def relative_transform(T_ref, T_i):
    return inverse_transform(T_ref) @ T_i
```

## **5. Rotation Log**

상대 transform은 다음처럼 생겼습니다.

$$
T_{\text{rel}} =
\begin{bmatrix}
R_{\text{rel}} & t_{\text{rel}} \\
0 & 1
\end{bmatrix}
$$

여기서 $t_{\text{rel}}$은 기준 frame에서 본 현재 LiDAR 원점의 상대 위치입니다.

회전은 $R_{\text{rel}}$에 들어 있습니다. 회전 크기를 안정적으로 보려면 Euler angle 단순 차이보다 rotation log를 쓰는 것이 좋습니다.

SO(3) log는 rotation matrix를 rotation vector로 바꾸는 연산입니다.

$$
\phi = \log(R_{\text{rel}})
$$

rotation vector $\phi$는 3차원 벡터입니다.

- 방향: 회전축
- 크기: 회전각

예를 들어 yaw 10도 회전은 대략 다음 rotation vector로 표현됩니다.

$$
\phi =
\begin{bmatrix}
0 \\
0 \\
0.1745
\end{bmatrix}
$$

여기서 $0.1745$ rad는 약 10도입니다.

코드로는 SciPy의 `Rotation.as_rotvec()`를 사용할 수 있습니다.

```python
from scipy.spatial.transform import Rotation

rotation = Rotation.from_matrix(R_rel)
rotvec = rotation.as_rotvec()
rotation_angle_deg = np.rad2deg(np.linalg.norm(rotvec))
relative_rpy_deg = rotation.as_euler("xyz", degrees=True)
```

여기서 `rotation_angle_deg`가 scan 내부 회전 크기를 나타내는 핵심 값입니다.

## **6. SE(3) Log에서 헷갈린 부분**

이번 주에 헷갈리기 쉬운 부분은 $t_{\text{rel}}$과 SE(3) log의 translation 성분 $\rho$입니다.

상대 pose는 다음처럼 생겼습니다.

$$
T_{\text{rel}} =
\begin{bmatrix}
R_{\text{rel}} & t_{\text{rel}} \\
0 & 1
\end{bmatrix}
$$

여기서 $t_{\text{rel}}$은 상대 pose 행렬 안에 들어 있는 최종 상대 위치입니다.

반면 SE(3) log는 pose 전체를 6차원 motion vector로 바꿉니다.

$$
\xi = \log(T_{\text{rel}})
$$

그리고 보통 다음처럼 씁니다.

$$
\xi =
\begin{bmatrix}
\rho \\
\phi
\end{bmatrix}
$$

여기서 $\phi$는 rotation log이고, $\rho$는 SE(3) log의 translation 성분입니다.

중요한 점은 다음입니다.

> $t_{\text{rel}}$과 $\rho$는 항상 같은 값이 아니다.

회전이 없으면 둘은 같습니다. 하지만 translation과 rotation이 동시에 있으면 SE(3) exponential 관계에서 다음처럼 회전 보정이 들어갑니다.

$$
t = V(\phi)\rho
$$

따라서,

$$
\rho = V(\phi)^{-1}t
$$

입니다.

처음 `frame_motion_analyzer`를 만들 때는 엄밀한 SE(3) log까지 구현하지 않아도 됩니다. 연구에서 먼저 보고 싶은 것은 LiDAR가 scan 안에서 실제로 얼마나 흔들렸는지입니다.

그래서 1주차에는 다음 값을 기본 feature로 저장하면 됩니다.

```text
t_rel
translation_norm_m
rotvec
rotation_angle_deg
relative_roll_deg
relative_pitch_deg
relative_yaw_deg
```

그리고 `[t_rel, rotvec]`를 붙인 값은 직관적인 6D 요약이지, 엄밀한 `se3_xi`라고 부르면 안 됩니다.

```python
motion_summary_6d = np.concatenate([t_rel, rotvec])
```

이 이름 구분이 중요합니다.

| 이름 | 의미 |
|---|---|
| `t_rel` | 상대 transform 행렬 안의 translation |
| `rotvec` | $R_{\text{rel}}$의 SO(3) log |
| `motion_summary_6d` | `[t_rel, rotvec]`를 붙인 직관적 요약 |
| `se3_xi` | 엄밀한 SE(3) log, `[rho, rotvec]` |

### **Adjoint는 왜 나중에 필요해지는가**

1주차 구현에서는 adjoint까지 없어도 됩니다.

하지만 SLAM 최적화, IMU preintegration, scan matching Jacobian으로 가면 adjoint가 계속 나옵니다.

직관적으로 adjoint는 `twist나 작은 pose perturbation을 다른 frame으로 옮기는 연산`입니다.

예를 들어 작은 motion vector를 다음 순서로 쓴다고 하겠습니다.

$$
\xi =
\begin{bmatrix}
\rho \\
\phi
\end{bmatrix}
$$

여기서 $\rho$는 translation 성분, $\phi$는 rotation 성분입니다.

transform이 다음과 같을 때:

$$
T =
\begin{bmatrix}
R & t \\
0 & 1
\end{bmatrix}
$$

이 convention에서 adjoint는 보통 다음 형태로 씁니다.

$$
\mathrm{Ad}_T =
\begin{bmatrix}
R & [t]_\times R \\
0 & R
\end{bmatrix}
$$

여기서 $[t]_\times$는 cross product matrix입니다.

이 식의 의미는 다음입니다.

```text
local frame에서 본 작은 motion을
다른 frame 기준의 작은 motion으로 바꿀 때
rotation뿐 아니라 lever arm t도 영향을 준다.
```

LiDAR가 base 원점에서 떨어져 있으면 base가 회전할 때 LiDAR 원점도 같이 움직입니다.

이 효과가 바로 adjoint와 lever arm 개념으로 이어집니다.

그래서 1주차의 핵심은 단순히 $T$를 곱하는 데서 끝나지 않습니다.

나중에 Jacobian을 만들 때는 `이 perturbation이 어느 frame 기준인가`까지 반드시 따라가야 합니다.

### **Left Perturbation과 Right Perturbation**

SLAM 최적화에서는 pose를 조금 고칠 때 보통 exponential map을 씁니다.

그런데 작은 update를 왼쪽에 붙이는지, 오른쪽에 붙이는지에 따라 의미가 달라집니다.

```text
left perturbation:
  T_new = exp(delta_xi) T

right perturbation:
  T_new = T exp(delta_xi)
```

left perturbation은 update를 world 또는 reference frame 쪽에서 거는 해석에 가깝고, right perturbation은 body/local frame 쪽에서 거는 해석에 가깝습니다.

처음 공부할 때는 이 차이를 깊게 구현하지 않아도 됩니다.

하지만 5주차의 point-to-plane Jacobian이나 ICP pose update로 가면 이 차이가 실제 부호와 Jacobian 형태를 바꿉니다.

따라서 지금은 다음 정도만 기억하면 충분합니다.

```text
SE(3) pose update는 그냥 벡터 덧셈이 아니다.
exp(delta_xi)를 어느 쪽에 곱하는지까지 convention이다.
```

## **7. Scan 내부 Pose Interpolation**

scan 하나는 순간적으로 찍힌 것이 아닙니다. LiDAR가 scan을 만드는 동안 로봇은 계속 움직입니다.

따라서 point 또는 sample 시점 $t_i$의 pose가 필요합니다. 하지만 pose가 모든 시점에 직접 저장되어 있지 않을 수 있습니다. 이때 scan 시작 pose와 끝 pose 사이를 보간합니다.

시간 비율은 다음처럼 계산합니다.

$$
\alpha =
\frac{t_i - t_{\text{start}}}
{t_{\text{end}} - t_{\text{start}}}
$$

translation은 선형 보간합니다.

$$
p(\alpha) = (1-\alpha)p_0 + \alpha p_1
$$

rotation은 행렬 원소를 직접 선형 보간하면 안 됩니다. 회전은 SO(3) 위에 있기 때문에 log/exp 방식으로 보간합니다.

$$
R(\alpha) =
R_0
\exp
\left(
\alpha
\log(R_0^T R_1)
\right)
$$

코드로는 다음 형태입니다.

```python
def interpolate_transform(T0, T1, alpha):
    p0 = T0[:3, 3]
    p1 = T1[:3, 3]
    p_interp = (1.0 - alpha) * p0 + alpha * p1

    R0 = Rotation.from_matrix(T0[:3, :3])
    R1 = Rotation.from_matrix(T1[:3, :3])

    R_rel = R0.inv() * R1
    rotvec_rel = R_rel.as_rotvec()
    R_interp = R0 * Rotation.from_rotvec(alpha * rotvec_rel)

    T_interp = np.eye(4)
    T_interp[:3, :3] = R_interp.as_matrix()
    T_interp[:3, 3] = p_interp
    return T_interp
```

## **8. frame_motion_analyzer 계산 흐름**

1주차 구현 과제는 `frame_motion_analyzer`입니다.

입력은 다음입니다.

- scan 시작 base pose $ {}^W T_B(t_{\text{start}}) $
- scan 끝 base pose $ {}^W T_B(t_{\text{end}}) $
- LiDAR extrinsic $ {}^B T_L $
- scan 시작/끝 시간
- scan 내부 sample time들

계산 흐름은 다음입니다.

$$
{}^W T_B(t_i)
\rightarrow
{}^W T_L(t_i)
\rightarrow
T_{\text{rel}, i}
\rightarrow
\text{motion features}
$$

조금 더 풀면,

$$
{}^W T_L(t_i) = {}^W T_B(t_i){}^B T_L
$$

이고,

$$
T_{\text{rel}, i}
=
{}^W T_L(t_{\text{ref}})^{-1}
{}^W T_L(t_i)
$$

입니다.

각 sample에서 뽑을 값은 다음입니다.

| Output | 의미 |
|---|---|
| `t_rel_x_m`, `t_rel_y_m`, `t_rel_z_m` | 기준 LiDAR frame에서 본 상대 위치 |
| `translation_norm_m` | 기준 시점 대비 LiDAR 원점 이동량 |
| `rotvec_x_rad`, `rotvec_y_rad`, `rotvec_z_rad` | 상대 회전의 rotation log |
| `rotation_angle_deg` | 상대 회전 크기 |
| `relative_roll_deg` | 해석용 roll 변화 |
| `relative_pitch_deg` | 해석용 pitch 변화 |
| `relative_yaw_deg` | 해석용 yaw 변화 |

scan 하나를 요약할 때는 다음을 저장하면 됩니다.

```text
max_translation_deviation_m
max_rotation_deviation_deg
max_abs_relative_roll_deg
max_abs_relative_pitch_deg
max_abs_relative_yaw_deg
```

이 값들이 나중에 gait-induced LiDAR motion이 scan matching residual이나 Hessian conditioning에 어떤 영향을 주는지 볼 때 기본 feature가 됩니다.

## **9. 최소 코드 구조**

이번 주의 코드는 복잡할 필요가 없습니다. 핵심 함수는 다음 정도면 충분합니다.

```python
import numpy as np
from scipy.spatial.transform import Rotation


def make_transform(position, rpy_deg):
    T = np.eye(4)
    T[:3, :3] = Rotation.from_euler(
        "xyz",
        rpy_deg,
        degrees=True,
    ).as_matrix()
    T[:3, 3] = np.asarray(position, dtype=float)
    return T


def inverse_transform(T):
    R = T[:3, :3]
    t = T[:3, 3]

    T_inv = np.eye(4)
    T_inv[:3, :3] = R.T
    T_inv[:3, 3] = -R.T @ t
    return T_inv


def relative_transform(T_ref, T_i):
    return inverse_transform(T_ref) @ T_i


def describe_relative_motion(T_rel):
    t_rel = T_rel[:3, 3]
    R_rel = T_rel[:3, :3]

    rotation = Rotation.from_matrix(R_rel)
    rotvec = rotation.as_rotvec()
    rpy_deg = rotation.as_euler("xyz", degrees=True)

    return {
        "t_rel": t_rel,
        "translation_norm_m": np.linalg.norm(t_rel),
        "rotvec_rad": rotvec,
        "rotation_angle_deg": np.rad2deg(np.linalg.norm(rotvec)),
        "relative_rpy_deg": rpy_deg,
        "motion_summary_6d": np.concatenate([t_rel, rotvec]),
    }
```

중요한 것은 함수 이름과 출력 이름을 정확히 붙이는 것입니다. 특히 `motion_summary_6d`를 `se3_xi`라고 부르지 않는 것이 좋습니다.

## **10. Synthetic Test**

7일차에는 새 이론을 넣기보다 synthetic test로 검증해야 합니다.

최소한 다음 case들을 확인합니다.

| Case | 예상 결과 |
|---|---|
| base가 x 방향 1m 이동 | translation 약 1m, rotation 약 0도 |
| base yaw 10도, LiDAR offset 없음 | translation 약 0m, rotation 약 10도 |
| base yaw 10도, LiDAR가 앞쪽 0.3m에 있음 | translation 발생, rotation 약 10도 |
| base pitch 10도, LiDAR가 앞쪽/위쪽에 있음 | translation 발생, rotation 약 10도 |
| scan 중간 z 방향 3cm 진동 | start-end 차이는 0일 수 있지만 max deviation은 3cm |

여기서 중요한 case는 세 번째와 네 번째입니다.

base가 제자리에서 회전하더라도 LiDAR가 base 원점에서 떨어져 있으면 LiDAR 원점은 world에서 움직입니다. 그래서 base motion과 LiDAR motion은 항상 같지 않습니다.

이게 $ {}^W T_L = {}^W T_B {}^B T_L $을 직접 계산해야 하는 이유입니다.

## **11. 이번 주 정리**

1주차를 한 문장으로 정리하면 다음입니다.

> SLAM에서 pose를 다루기 전에, 모든 값이 어느 frame 기준인지 먼저 확인해야 한다.

이번 주에 이해한 흐름은 다음입니다.

```text
frame 구분
-> pose를 4x4 transform으로 표현
-> T_WL = T_WB @ T_BL 계산
-> T_rel = inv(T_ref) @ T_i 계산
-> rotation log로 상대 회전 크기 계산
-> scan 내부 pose interpolation
-> frame_motion_analyzer로 motion feature 추출
```

이 단계가 끝나야 다음 주제인 LiDAR timestamp와 deskew로 넘어갈 수 있습니다.

특히 legged robot에서는 LiDAR가 base 위에 달려 있고, base가 보행 중 계속 흔들립니다. 따라서 scan 하나 안에서도 LiDAR pose는 고정되어 있지 않습니다.

나중에 보고 싶은 질문은 다음입니다.

> 보행 중 LiDAR가 scan 내부에서 얼마나 흔들렸고, 그 흔들림이 scan matching residual과 conditioning에 어떤 영향을 주는가?

1주차의 `frame_motion_analyzer`는 이 질문으로 가기 위한 첫 번째 도구입니다.
