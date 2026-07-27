---
title: "[SLAM Study 3주차] Synthetic Deskew와 Scan Distortion"
date: 2026-06-29 14:35:00 +0900
published: false
last_modified_at: 2026-06-30 20:18:21 +0900
categories: [SLAM, Study]
tags: [slam, lidar-slam, lidar, deskew, scan-distortion, pointcloud, se3, synthetic, robotics]
description: SLAM 공부 3주차에 LiDAR scan distortion, deskew 기본식, synthetic re-skew, exact deskew, constant-velocity deskew, deskew error 해석을 정리한다.
math: true
---

## **0. 이번 주에 잡아야 하는 것**

1주차에는 frame과 SE(3)를 정리했습니다.

2주차에는 LiDAR scan 안의 point별 timestamp와 IMU coverage를 확인했습니다.

3주차부터는 deskew입니다. 다만 바로 실제 rosbag에 들어가면 변수가 너무 많습니다.

```text
point time이 맞는가?
trajectory 추정이 맞는가?
extrinsic이 맞는가?
IMU-LiDAR time offset은 없는가?
driver가 이미 deskew를 했는가?
```

이런 질문이 한 번에 섞이면 deskew 수식 자체가 맞는지 확인하기 어렵습니다.

그래서 3주차는 실제 데이터보다 synthetic 데이터에 집중합니다.

```text
clean cloud 생성
-> 내가 만든 trajectory로 일부러 skew
-> exact trajectory로 deskew
-> clean cloud가 복원되는지 확인
```

즉 이번 주 목표는 SLAM 전체 시스템을 구현하는 것이 아닙니다.

> LiDAR scan distortion과 deskew error를 synthetic world에서 해부하는 것

입니다.

4주차에는 실제 rosbag에서 offline deskewer로 넘어가면 됩니다. 3주차는 그 전에 수식 방향, frame 정의, error 해석을 확실히 잡는 주입니다.

## **1. 3주차의 중심 질문**

이번 주 질문은 하나입니다.

> 한 scan 안에서 LiDAR가 움직였을 때, 각 point를 기준 시점 LiDAR frame으로 어떻게 옮기는가?

수식은 다음입니다.

$$
{}^{L(t_r)}\mathbf{p}_i =
\left({}^W T_L(t_r)\right)^{-1}
{}^W T_L(t_i)
{}^{L(t_i)}\mathbf{p}_i
$$

처음 보면 복잡해 보이지만, 오른쪽부터 읽으면 됩니다.

| 항 | 의미 |
|---|---|
| $t_i$ | point $i$가 실제로 측정된 시각 |
| $t_r$ | deskew 기준 시각 |
| $L(t_i)$ | point $i$가 찍힌 순간의 LiDAR frame |
| $L(t_r)$ | 기준 시점의 LiDAR frame |
| ${}^W T_L(t)$ | 시각 $t$에서 LiDAR frame의 점을 world frame으로 보내는 transform |

말로 풀면 세 단계입니다.

```text
point i는 L(t_i) frame에서 측정됐다.
-> T_WL(t_i)로 world frame에 올린다.
-> inverse(T_WL(t_r))로 기준 시점 L(t_r) frame에 가져온다.
```

결국 deskew는 각 point를 측정 시점 LiDAR frame에서 기준 시점 LiDAR frame으로 재표현하는 과정입니다.

### **수식 방향 sanity check**

deskew 수식에서 가장 흔한 실수는 inverse 방향을 반대로 쓰는 것입니다.

아래 식을 오른쪽부터 읽으면 방향이 명확해집니다.

$$
{}^{L(t_r)}\mathbf{p}_i =
\left({}^W T_L(t_r)\right)^{-1}
{}^W T_L(t_i)
{}^{L(t_i)}\mathbf{p}_i
$$

```text
1. p_i는 처음에 L(t_i) frame 좌표다.
2. T_WL(t_i)를 곱하면 world 좌표가 된다.
3. inverse(T_WL(t_r))를 곱하면 기준 LiDAR frame L(t_r) 좌표가 된다.
```

즉 중간에 반드시 world frame을 한 번 거칩니다.

sanity check는 다음처럼 할 수 있습니다.

```text
t_i == t_r이면:
  inverse(T_WL(t_r)) @ T_WL(t_i) = I
  deskewed point == raw point
```

이 조건이 깨지면 transform 방향이나 reference time이 틀렸을 가능성이 큽니다.

또 하나의 sanity check는 static trajectory입니다.

```text
T_WL(t_i)가 scan 전체에서 모두 같다면:
  모든 point의 deskew transform은 identity
  correction amount는 0에 가까워야 함
```

synthetic 실험에서는 이 두 case를 먼저 통과해야 합니다.

## **2. Deskew가 필요한 이유**

LiDAR scan 하나는 한 순간에 찍힌 사진이 아닙니다.

예를 들어 scan duration이 `0.1 s`라면 point들은 다음처럼 서로 다른 시각에 측정됩니다.

```text
point 0      -> t = 0.000 s 근처
point middle -> t = 0.050 s 근처
point last   -> t = 0.100 s 근처
```

로봇이 정지해 있으면 이 차이가 크게 보이지 않을 수 있습니다. 하지만 로봇개가 걷는 동안에는 body가 계속 흔들리고, base 위에 붙은 LiDAR pose도 scan 안에서 바뀝니다.

```text
scan start LiDAR pose  !=  scan middle LiDAR pose  !=  scan end LiDAR pose
```

그런데 raw cloud를 하나의 rigid cloud처럼 처리하면 모든 point가 같은 시점에서 찍힌 것처럼 취급합니다.

그 결과는 다음처럼 나타날 수 있습니다.

```text
벽이 두꺼워짐
평면이 휘어짐
기둥이나 코너가 번짐
scan matching residual 증가
map blur 증가
odometry drift 증가
```

이것이 scan distortion입니다.

Deskew는 이 distortion을 줄이기 위해 point들을 하나의 기준 시점으로 정렬합니다.

## **3. Deskew는 물체를 움직이는 것이 아니다**

여기서 중요한 점이 있습니다.

Deskew는 환경 물체가 움직였다고 가정하는 과정이 아닙니다.

정적 환경에서는 벽, 바닥, 기둥은 world frame에서 고정되어 있습니다. 움직인 것은 LiDAR입니다.

```text
world 기준:
벽은 고정
LiDAR는 scan 동안 움직임

LiDAR 기준:
각 point가 서로 다른 LiDAR pose에서 측정됨
```

따라서 deskew는 물체를 임의로 펴는 것이 아니라, 서로 다른 LiDAR pose에서 측정된 point들을 같은 기준 LiDAR frame으로 다시 표현하는 것입니다.

## **4. 기준 시점 $t_r$**

Deskew 기준 시점 $t_r$은 보통 다음 중 하나로 잡습니다.

| 기준 | 설명 |
|---|---|
| scan start | scan 시작 frame으로 모든 point를 모음 |
| scan middle | scan 중앙 frame으로 모음 |
| scan end | scan 끝 frame으로 모든 point를 모음 |

처음 공부할 때는 scan start가 가장 쉽습니다.

```text
t_r = t_start
```

중요한 것은 기준 시점을 일관되게 쓰는 것입니다.

같은 raw cloud라도 scan start 기준 deskew와 scan end 기준 deskew는 좌표값이 다릅니다. 둘 다 틀린 것이 아니라, 같은 point cloud를 서로 다른 LiDAR frame에서 표현한 것입니다.

## **5. No Deskew**

`no deskew`는 아무것도 하지 않는 baseline입니다.

$$
\mathbf{p}_i^{no\ deskew} =
\mathbf{p}_i^{raw}
$$

이 방식은 사실상 다음을 가정합니다.

```text
scan 안의 모든 point가 같은 시점에 찍혔다.
LiDAR는 scan 동안 움직이지 않았다.
```

motion이 거의 없으면 이 가정도 큰 문제가 아닐 수 있습니다. 하지만 scan duration 동안 LiDAR pose가 많이 변하면 raw cloud는 왜곡됩니다.

3주차 synthetic 실험에서는 `no deskew`를 반드시 남겨야 합니다. 그래야 deskew를 했을 때 무엇이 좋아졌는지 비교할 수 있습니다.

## **6. Exact Deskew**

`exact deskew`는 각 point time $t_i$에서의 진짜 LiDAR pose를 정확히 알고 있다고 가정합니다.

$$
{}^{L(t_r)}\mathbf{p}_i^{deskewed} =
\left({}^W T_L(t_r)\right)^{-1}
{}^W T_L(t_i)
{}^{L(t_i)}\mathbf{p}_i^{raw}
$$

실제 로봇 데이터에서는 진짜 trajectory를 모릅니다. IMU, odometry, LIO, scan matching 등으로 추정할 뿐입니다.

하지만 synthetic 실험에서는 다릅니다.

```text
내가 trajectory를 직접 만든다.
-> 각 point의 진짜 T_WL(t_i)를 알고 있다.
-> exact deskew를 검증할 수 있다.
```

그래서 3주차 목표는 단순합니다.

```text
내가 일부러 point cloud를 왜곡시킨다.
그 왜곡에 사용한 exact trajectory로 deskew한다.
원래 clean cloud가 복원되는지 확인한다.
```

이 단계가 안 맞으면 대부분 이론 문제가 아니라 구현 문제입니다.

```text
T_WL / T_LW 혼동
inverse 방향 오류
row vector / column vector 혼동
t_ref 설정 오류
point time 순서 오류
```

## **7. Synthetic Re-skew**

3주차의 핵심 구현은 `synthetic re-skew`입니다.

Deskew가 raw point를 기준 시점 frame으로 모으는 과정이라면, re-skew는 그 반대입니다.

```text
Deskew:
raw/skewed point
-> 기준 시점 LiDAR frame으로 복원

Re-skew:
clean point
-> 일부러 각 point time의 LiDAR frame으로 흩뿌림
```

처음에 기준 시점 $L(t_r)$에서 본 clean point가 있다고 하겠습니다.

$$
{}^{L(t_r)}\mathbf{p}_i^{clean}
$$

이 point를 world frame으로 보내면 다음입니다.

$$
{}^W\mathbf{p}_i =
{}^W T_L(t_r)
{}^{L(t_r)}\mathbf{p}_i^{clean}
$$

이제 이 world point를 $t_i$ 시점의 LiDAR가 봤다고 가정합니다.

$$
{}^{L(t_i)}\mathbf{p}_i^{raw} =
\left({}^W T_L(t_i)\right)^{-1}
{}^W\mathbf{p}_i
$$

정리하면 synthetic re-skew는 다음입니다.

$$
{}^{L(t_i)}\mathbf{p}_i^{raw} =
\left({}^W T_L(t_i)\right)^{-1}
{}^W T_L(t_r)
{}^{L(t_r)}\mathbf{p}_i^{clean}
$$

그리고 여기에 exact deskew를 적용하면 이론상 다시 clean point가 나와야 합니다.

$$
{}^{L(t_r)}\mathbf{p}_i^{deskewed}
\approx
{}^{L(t_r)}\mathbf{p}_i^{clean}
$$

이것이 3주차 synthetic 실험의 1차 통과 기준입니다.

## **8. 최소 Synthetic World**

처음부터 복잡한 실내 구조를 만들 필요는 없습니다.

가장 쉬운 것은 평면 벽입니다.

```text
x = 5 m
y = -2 m ~ 2 m
z = -1 m ~ 1 m
```

즉 LiDAR 앞 5m에 정적인 벽 하나가 있다고 둡니다.

```python
import numpy as np


def make_wall_cloud(
    x=5.0,
    y_range=(-2.0, 2.0),
    z_range=(-1.0, 1.0),
    ny=100,
    nz=50,
):
    ys = np.linspace(y_range[0], y_range[1], ny)
    zs = np.linspace(z_range[0], z_range[1], nz)

    points = []
    for y in ys:
        for z in zs:
            points.append([x, y, z])

    return np.asarray(points, dtype=float)
```

이 cloud는 기준 시점 $L(t_r)$에서 본 clean cloud입니다.

```text
clean_cloud = reference LiDAR frame에서 본 정적인 벽
```

평면 벽이 잘 되면 그다음에는 corridor를 만들면 됩니다.

```text
front wall
left wall
right wall
floor
```

하지만 처음 검증은 벽 하나로 충분합니다. 벽 하나는 residual도 단순하게 계산할 수 있습니다.

## **9. Point Time Model**

각 point에는 측정 시각 $t_i$가 있어야 합니다.

synthetic에서는 직접 만듭니다.

```python
def make_point_times(num_points, t_start=0.0, t_end=0.1):
    return np.linspace(t_start, t_end, num_points)
```

이렇게 하면 point index와 time의 관계는 다음처럼 됩니다.

```text
point 0     -> scan start
point N / 2 -> scan middle
point N - 1 -> scan end
```

실제 LiDAR에서는 point order가 항상 시간순이라는 보장이 없습니다. 2주차 audit에서도 point time은 거의 monotonic했지만 완전히 monotonic하지는 않았습니다.

하지만 3주차 synthetic 실험에서는 먼저 단순한 시간 모델로 시작합니다.

```text
point_i <-> t_i
```

이 대응이 있어야 deskew를 할 수 있습니다.

## **10. Trajectory Model**

이제 scan 동안 LiDAR가 어떻게 움직였는지 trajectory를 만듭니다.

처음에는 base frame, IMU frame, extrinsic을 모두 넣지 말고 바로 LiDAR pose를 만듭니다.

```text
trajectory_fn(t) -> T_WL(t)
```

즉 시간 $t$를 넣으면 그 시각의 LiDAR pose ${}^W T_L(t)$를 반환하는 함수입니다.

3주차에서는 motion을 하나씩만 넣는 것이 좋습니다.

| Motion | 의미 |
|---|---|
| constant translation | scan 동안 일정한 방향으로 이동 |
| yaw oscillation | 좌우 방향 회전 흔들림 |
| pitch oscillation | 위아래 회전 흔들림 |
| vertical oscillation | z 방향 상하 흔들림 |
| touchdown impulse | 짧은 순간 큰 pose 변화 |

예를 들어 constant translation은 다음처럼 둘 수 있습니다.

```text
scan duration = 0.1 s
end translation = 0.1 m
x(t) = 0.1 * alpha
alpha = (t - t_start) / (t_end - t_start)
```

pitch oscillation은 다음처럼 둘 수 있습니다.

```text
pitch(t) = A sin(2 pi f t)
A = 5 deg
f = 10 Hz
```

vertical oscillation은 다음처럼 둘 수 있습니다.

```text
z(t) = A sin(2 pi f t)
A = 0.03 m
```

legged robot에서는 pitch/roll oscillation, vertical vibration, foot-contact impact가 중요합니다. 일반 차량처럼 부드러운 constant velocity motion이라고 가정하기 어렵기 때문입니다.

## **11. Transform Helper**

처음 구현은 4x4 homogeneous transform으로 충분합니다.

$$
T =
\begin{bmatrix}
R & t \\
0 & 1
\end{bmatrix}
$$

point는 homogeneous coordinate로 바꿔서 곱합니다.

```python
def apply_transform(T, points):
    ones = np.ones((points.shape[0], 1))
    points_h = np.hstack([points, ones])
    transformed_h = (T @ points_h.T).T
    return transformed_h[:, :3]
```

inverse는 처음에는 `np.linalg.inv()`를 써도 됩니다.

```python
def inverse_transform(T):
    return np.linalg.inv(T)
```

나중에 최적화하거나 수치 안정성을 더 신경 쓸 때는 $R^T$와 $-R^T t$를 직접 써도 됩니다.

$$
T^{-1} =
\begin{bmatrix}
R^T & -R^T t \\
0 & 1
\end{bmatrix}
$$

3주차에서는 빠르게 검증하는 것이 더 중요합니다.

여기서도 1주차의 convention을 그대로 씁니다.

```text
T_WL:
  LiDAR frame 좌표를 world frame 좌표로 보낸다.

inverse(T_WL):
  world frame 좌표를 LiDAR frame 좌표로 가져온다.
```

synthetic re-skew와 deskew는 서로 반대 과정입니다.

따라서 두 함수를 나란히 놓고 보면 transform 방향이 검증됩니다.

```text
re-skew:
  L(t_ref) -> W -> L(t_i)

deskew:
  L(t_i) -> W -> L(t_ref)
```

이 대칭성이 깨지면 exact deskew가 clean cloud를 복원하지 못합니다.

## **12. Synthetic Re-skew 구현**

clean point는 기준 시점 $L(t_r)$ frame에 있습니다.

synthetic re-skew의 순서는 다음입니다.

```text
1. p_clean_i를 T_WL(t_r)로 world frame에 보낸다.
2. world point를 inverse(T_WL(t_i))로 L(t_i) frame에 가져온다.
3. 그 결과가 raw/skewed point다.
```

코드 구조는 다음처럼 잡을 수 있습니다.

```python
def synthetic_reskew(clean_points, point_times, trajectory_fn, t_ref):
    T_ref = trajectory_fn(t_ref)

    raw_points = []
    for p_clean, t_i in zip(clean_points, point_times):
        T_i = trajectory_fn(t_i)

        # clean point: L(t_ref) frame
        p_world = apply_transform(T_ref, p_clean.reshape(1, 3))[0]

        # raw point: L(t_i) frame
        p_raw = apply_transform(
            inverse_transform(T_i),
            p_world.reshape(1, 3),
        )[0]

        raw_points.append(p_raw)

    return np.asarray(raw_points)
```

여기서 가장 흔한 실수는 transform 방향을 반대로 쓰는 것입니다.

```text
T_WL(t): LiDAR frame -> World frame
T_WL(t)^-1: World frame -> LiDAR frame
```

이 둘을 반드시 구분해야 합니다.

## **13. Exact Deskew 구현**

exact deskew는 re-skew의 반대입니다.

raw point는 $L(t_i)$ frame에 있습니다.

```text
1. p_raw_i를 T_WL(t_i)로 world frame에 보낸다.
2. world point를 inverse(T_WL(t_r))로 기준 LiDAR frame에 가져온다.
3. 그 결과가 deskewed point다.
```

코드 구조는 다음입니다.

```python
def exact_deskew(raw_points, point_times, trajectory_fn, t_ref):
    T_ref = trajectory_fn(t_ref)
    T_ref_inv = inverse_transform(T_ref)

    deskewed_points = []
    for p_raw, t_i in zip(raw_points, point_times):
        T_i = trajectory_fn(t_i)

        # raw point: L(t_i) frame
        p_world = apply_transform(T_i, p_raw.reshape(1, 3))[0]

        # reference LiDAR frame: L(t_ref)
        p_ref = apply_transform(
            T_ref_inv,
            p_world.reshape(1, 3),
        )[0]

        deskewed_points.append(p_ref)

    return np.asarray(deskewed_points)
```

이론상 다음이 성립해야 합니다.

```text
exact_deskew(synthetic_reskew(clean_cloud)) ~= clean_cloud
```

numerical precision 수준의 오차만 남아야 합니다.

## **14. Error Metric**

3주차에서 가장 먼저 볼 metric은 point-level error입니다.

$$
e_i =
\left\|
\mathbf{p}_i^{deskewed}
-
\mathbf{p}_i^{clean}
\right\|_2
$$

전체 요약은 평균, 중앙값, 95 percentile, 최댓값 정도면 충분합니다.

```python
def point_error(a, b):
    errors = np.linalg.norm(a - b, axis=1)
    return {
        "mean_error": float(np.mean(errors)),
        "median_error": float(np.median(errors)),
        "p95_error": float(np.percentile(errors, 95)),
        "max_error": float(np.max(errors)),
    }
```

exact deskew가 맞다면 `deskewed_cloud`와 `clean_cloud`의 error는 거의 0에 가까워야 합니다.

반대로 `raw_skewed_cloud`와 `clean_cloud`는 motion이 클수록 차이가 보여야 합니다.

## **15. Correction Amount와 Deskew Error**

3주차에서 반드시 구분해야 하는 것이 있습니다.

```text
deskew correction amount
deskew error
```

deskew correction amount는 deskew가 point를 얼마나 움직였는지입니다.

$$
c_i =
\left\|
\mathbf{p}_i^{deskewed}
-
\mathbf{p}_i^{raw}
\right\|_2
$$

하지만 이것은 error가 아닙니다.

deskew error는 정답과 비교해야 정의됩니다.

synthetic에서는 clean cloud가 정답입니다.

$$
e_i =
\left\|
\mathbf{p}_i^{deskewed}
-
\mathbf{p}_i^{clean}
\right\|_2
$$

중요한 해석은 다음입니다.

```text
보정량이 크다 != deskew error가 크다
보정량이 작다 != deskew error가 작다
```

LiDAR가 크게 움직였어도 trajectory를 정확히 알면 exact deskew는 잘 복원됩니다.

반대로 LiDAR motion이 작아도 point time, trajectory, extrinsic, interpolation model이 틀리면 deskew error가 남습니다.

## **16. Constant-velocity Deskew**

exact deskew 다음에는 constant-velocity deskew를 비교합니다.

constant-velocity deskew는 scan 시작 pose와 끝 pose만 알고 있다고 가정합니다.

$$
T_{start} = T(t_{start})
$$

$$
T_{end} = T(t_{end})
$$

중간 pose는 interpolation으로 만듭니다.

$$
\alpha_i =
\frac{t_i - t_{start}}{t_{end} - t_{start}}
$$

$$
\hat{T}(t_i) =
\mathrm{Interp}(T_{start}, T_{end}, \alpha_i)
$$

그리고 $\hat{T}(t_i)$로 deskew합니다.

이 방식은 scan 내부 motion이 부드럽고 거의 등속이면 잘 맞습니다.

하지만 legged robot에서는 다음 motion이 들어올 수 있습니다.

```text
pitch oscillation
roll oscillation
vertical vibration
foot-contact impact
짧은 impulse motion
고주파 angular velocity
```

이런 motion은 constant velocity가 아닙니다.

그러면 실제 pose와 interpolation pose가 달라집니다.

$$
{}^W T_L(t_i)
\neq
{}^W \hat{T}_L(t_i)
$$

그 결과 deskew를 했는데도 residual distortion이 남을 수 있습니다.

3주차 synthetic 실험에서 constant-velocity deskew를 넣는 이유가 이것입니다.

> sensor motion이 크다는 것보다 더 중요한 것은, deskew model이 그 motion을 제대로 설명할 수 있느냐이다.

## **17. Motion Case별 예상**

3주차에서는 motion을 하나씩 넣고 결과를 봅니다.

| Case | 예상 distortion | Deskew 해석 |
|---|---|---|
| constant translation | 벽이 이동 방향으로 늘어지거나 밀림 | constant-velocity deskew도 잘 맞아야 함 |
| yaw oscillation | 벽이 좌우로 휘어 보임 | 주파수와 scan duration에 따라 CV deskew 오차가 남을 수 있음 |
| pitch oscillation | 벽이 위아래 또는 깊이 방향으로 휘어 보임 | LiDAR lever arm이 있으면 translation 효과도 생김 |
| vertical oscillation | z 방향으로 cloud가 두꺼워질 수 있음 | sinusoidal motion이면 CV deskew에 오차가 남을 수 있음 |
| touchdown impulse | 특정 scan 구간이 꺾이거나 찢어져 보일 수 있음 | exact deskew만 복원되고 CV deskew는 틀릴 수 있음 |

각 case는 같은 순서로 반복하면 됩니다.

```text
1. clean cloud 생성
2. point time 생성
3. trajectory 생성
4. synthetic re-skew
5. no deskew cloud 저장
6. exact deskew
7. constant-velocity deskew
8. clean과 error 비교
```

이렇게 해야 motion 종류별로 어떤 distortion이 생기고, 어떤 deskew model이 실패하는지 분리해서 볼 수 있습니다.

## **18. Rotation Distortion이 위험한 이유**

translation distortion과 rotation distortion은 scale이 다릅니다.

LiDAR가 scan 동안 10cm 이동했다면 distortion scale도 대략 cm에서 10cm 수준입니다.

하지만 rotation은 range와 함께 커집니다.

근사적으로 다음처럼 볼 수 있습니다.

$$
\|\delta \mathbf{p}\| \approx r |\delta \theta|
$$

여기서 $r$은 point까지의 거리이고, $\delta \theta$는 angular error입니다.

예를 들어 pitch error가 $1^\circ$라고 하겠습니다.

$$
1^\circ \approx 0.0175\ \mathrm{rad}
$$

벽이 10m 앞에 있으면 다음입니다.

$$
10 \times 0.0175 = 0.175\ \mathrm{m}
$$

즉 pitch 오차 1도만 있어도 10m 거리에서는 약 17.5cm 정도의 point 위치 오차가 생길 수 있습니다.

| Range | Angular error | Approx point error |
|---:|---:|---:|
| 5 m | 1 deg | 8.7 cm |
| 10 m | 1 deg | 17.5 cm |
| 10 m | 3 deg | 52.4 cm |
| 20 m | 1 deg | 34.9 cm |

그래서 legged robot에서 pitch/roll oscillation은 중요합니다.

수직으로 몇 cm 흔들리는 것도 중요하지만, 몇 도의 pitch/roll 흔들림은 먼 벽에서 훨씬 크게 보일 수 있습니다.

## **19. Deskew Error Source**

실제 데이터에서 deskew가 틀어지는 원인은 하나가 아닙니다.

3주차 synthetic 실험에서는 일부러 원인을 하나씩 고립해서 봐야 합니다.

| Error source | 의미 |
|---|---|
| point time error | point별 $t_i$가 틀림 |
| trajectory error | ${}^W T_L(t_i)$ 추정이 틀림 |
| interpolation error | 중간 pose를 만드는 model이 실제 motion을 못 따라감 |
| extrinsic error | base-IMU-LiDAR transform이 틀림 |
| IMU-LiDAR time offset | IMU와 LiDAR clock이 어긋남 |
| scan pattern mismatch | point ordering이나 ring/channel model을 잘못 가정 |
| dynamic object | 환경이 정적이라는 가정이 깨짐 |

3주차에서는 먼저 trajectory model mismatch를 봅니다.

```text
exact trajectory로 만든 raw cloud
-> exact trajectory로 deskew하면 복원
-> constant-velocity trajectory로 deskew하면 motion에 따라 오차 발생
```

이 구조가 이해되면 4주차 실제 rosbag 분석에서 훨씬 덜 헷갈립니다.

### **Synthetic Ablation을 왜 하는가**

synthetic의 장점은 하나씩 망가뜨릴 수 있다는 점입니다.

실제 rosbag에서 deskew 결과가 나쁘면 원인이 한 번에 섞입니다.

```text
point time이 틀렸나?
IMU integration이 틀렸나?
extrinsic이 틀렸나?
scan 자체가 dynamic object를 본 건가?
```

synthetic에서는 이 중 하나만 켤 수 있습니다.

예를 들어 time offset만 보고 싶으면, raw cloud는 exact trajectory로 만들고 deskew할 때만 point time에 offset을 더합니다.

```text
raw 생성:
  T_WL(t_i)

deskew:
  T_WL(t_i + delta_t)
```

그러면 deskew error는 거의 time offset 하나에서 옵니다.

trajectory model mismatch도 같은 방식으로 볼 수 있습니다.

```text
raw 생성:
  sinusoidal pitch trajectory

deskew:
  start/end pose만 쓰는 constant-velocity trajectory
```

이 실험에서 error가 커지면 "constant velocity model이 고주파 motion을 못 따라간다"는 해석이 가능합니다.

extrinsic error도 분리할 수 있습니다.

```text
raw 생성:
  true T_BL

deskew:
  T_BL에 2 cm translation error 또는 1 deg rotation error 추가
```

이렇게 해야 4주차 실제 데이터에서 결과가 애매할 때도 어떤 원인을 의심해야 하는지 감이 생깁니다.

### **Aliasing 관점**

scan 안의 motion을 point time으로 샘플링한다고 보면, 고주파 motion에는 aliasing 문제가 생길 수 있습니다.

예를 들어 foot impact처럼 짧은 순간 큰 angular velocity가 생겼는데 IMU sample rate나 interpolation이 충분하지 않으면, 실제 peak motion을 놓칠 수 있습니다.

```text
실제 motion:
  scan 중간에 짧은 pitch impulse

deskew model:
  시작/끝 pose만 보고 부드러운 motion으로 보간
```

이 경우 시작 pose와 끝 pose가 거의 같아도 scan 중간 point는 크게 틀어질 수 있습니다.

그래서 3주차 synthetic case에 `touchdown impulse`가 들어갑니다.

이 case는 legged robot에서 특히 중요합니다.

## **20. Scan Matching Residual과 연결**

deskew error는 point-level error에서 끝나지 않습니다.

평면 벽을 예로 들면 clean cloud는 다음 평면 위에 있어야 합니다.

```text
x = 5
```

raw 또는 잘못 deskew된 point의 평면 residual은 다음처럼 볼 수 있습니다.

$$
r_i = |x_i - 5|
$$

일반 평면이면 다음입니다.

$$
r_i = |\mathbf{n}^T \mathbf{p}_i + d|
$$

여기서 $\mathbf{n}$은 plane normal이고, $d$는 plane offset입니다.

이 residual이 커지면 scan-to-map matching이 어려워집니다.

```text
deskew error 증가
-> plane residual 증가
-> scan matching cost 증가
-> pose estimation 불안정
-> map blur / odometry drift
```

3주차 synthetic 실험에서 point-level error와 plane residual을 같이 보는 이유가 여기에 있습니다.

## **21. 7일 공부 순서**

3주차는 구현 60%, 이론 40% 정도로 잡는 것이 좋습니다.

| Day | 주제 | 해야 할 것 |
|---|---|---|
| 1 | Deskew 수식과 frame 방향 | $T_{WL}(t_i)$를 왜 먼저 곱하는지 설명 |
| 2 | LiDAR scan temporal model | `point_times = linspace(t_start, t_end, N)` 생성 |
| 3 | Motion distortion model | motion별 예상 distortion을 먼저 적기 |
| 4 | Synthetic re-skew | clean wall을 raw skewed wall로 왜곡 |
| 5 | Exact deskew | raw skewed wall을 clean wall로 복원 |
| 6 | Constant-velocity deskew | start/end pose interpolation으로 deskew |
| 7 | Error 분석 | point error, plane residual, correction amount 정리 |

각 날의 핵심 질문은 다음입니다.

```text
Day 1: point가 움직인 것인가, LiDAR frame이 움직인 것인가?
Day 2: point_i와 t_i가 어떻게 대응되는가?
Day 3: 이 motion은 cloud를 어떤 방향으로 망가뜨릴 것인가?
Day 4: re-skew 수식의 transform 방향이 맞는가?
Day 5: exact deskew가 clean cloud를 복원하는가?
Day 6: constant velocity 가정은 언제 깨지는가?
Day 7: point-level error가 scan matching residual로 어떻게 이어지는가?
```

## **22. 최종 산출물**

이번 주가 끝나면 아래 파일들이 있으면 됩니다.

```text
synthetic_deskew.py
clean_cloud.npy
raw_skewed_cloud.npy
exact_deskewed_cloud.npy
constant_velocity_deskewed_cloud.npy
deskew_error_summary.csv
```

plot은 case별로 세 개면 충분합니다.

```text
clean vs raw_skewed
clean vs exact_deskewed
clean vs constant_velocity_deskewed
```

summary CSV column은 다음 정도로 잡습니다.

| Column | 의미 |
|---|---|
| `case_name` | motion case 이름 |
| `motion_type` | translation, yaw, pitch, vertical, impulse 등 |
| `motion_amplitude` | motion 크기 |
| `motion_frequency` | oscillation frequency |
| `method` | no deskew, exact, constant velocity |
| `mean_error` | point error 평균 |
| `median_error` | point error 중앙값 |
| `p95_error` | point error 95 percentile |
| `max_error` | point error 최댓값 |
| `plane_residual_mean` | plane residual 평균 |
| `plane_residual_p95` | plane residual 95 percentile |

## **23. 3주차 통과 기준**

이번 주가 끝나고 아래를 설명할 수 있어야 합니다.

1. LiDAR scan이 한 순간의 rigid cloud가 아닌 이유
2. point마다 $t_i$가 필요한 이유
3. ${}^W T_L(t_i)$와 $\left({}^W T_L(t_r)\right)^{-1}$의 의미
4. synthetic re-skew와 deskew의 관계
5. exact trajectory로 deskew하면 clean cloud가 복원되는 이유
6. constant-velocity deskew의 가정
7. sinusoidal 또는 impulse motion에서 constant-velocity deskew가 틀리는 이유
8. translation distortion과 rotation distortion의 차이
9. range가 멀수록 angular error가 커지는 이유
10. deskew correction amount와 deskew error의 차이
11. point-level error가 scan matching residual, map blur, odometry drift로 이어지는 경로

## **24. 실제 rosbag 전에 synthetic world를 쓰는 이유**

> Deskew 수식을 외우는 것이 아니라, scan distortion이 왜 생기고 deskew model의 가정이 언제 깨지는지 synthetic 실험으로 확인하는 주.

Clean cloud에 알고 있는 trajectory로 distortion을 넣고 exact trajectory로 되돌리면, frame 방향과 timestamp 처리가 맞는지 reference 없이 추측할 필요가 없습니다. Constant-velocity 결과와 비교하면 trajectory model이 틀릴 때 남는 deskew error도 별도로 볼 수 있습니다.

Legged robot의 motion은 constant velocity로 충분히 설명되지 않을 수 있습니다.

```text
pitch / roll oscillation
vertical vibration
foot-contact impact
high-frequency body motion
```

이런 motion이 scan 내부에서 생기면 constant-velocity deskew가 실제 LiDAR trajectory를 충분히 설명하지 못할 수 있습니다.

```text
실제 rosbag으로 가기 전에,
synthetic world에서 re-skew와 exact deskew가 맞는지 먼저 확인하자.
```

이 synthetic sanity check를 통과한 뒤 4주차 실제 데이터에서 trajectory source와 sensor time 문제를 따로 다룹니다.
