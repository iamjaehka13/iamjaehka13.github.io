---
title: "[SLAM Study 5주차] Fixed Map Registration과 Point-to-Plane Residual"
date: 2026-06-30 19:44:50 +0900
last_modified_at: 2026-06-30 19:44:50 +0900
categories: [SLAM, Study]
tags: [slam, lidar-slam, lidar, registration, scan-matching, point-to-plane, fixed-map, residual, inlier, deskew, ros2]
description: "SLAM 공부 5주차에 fixed map 기준 scan registration, point-to-plane residual, correspondence, inlier ratio, geometry degeneracy, UNIST fixed-map residual evaluator 결과를 정리한다."
image: /assets/img/posts/slam/study/week-5-fixed-map-registration/spatial_residual_3d.png
math: true
---

## **0. 이번 주에 잡아야 하는 것**

4주차에는 실제 rosbag에서 한 scan 내부의 LiDAR pose 변화가 point cloud geometry를 얼마나 바꾸는지 봤습니다.

5주차의 질문은 그 다음 단계입니다.

> 왜곡된 scan이 map에 붙을 때, registration residual과 inlier ratio가 어떻게 나빠지는가?

전체 연구 흐름으로 보면 이번 주 위치는 여기입니다.

```text
quadruped gait / body motion
-> LiDAR sensor motion
-> scan distortion or deskew error
-> registration residual 증가
-> inlier ratio 감소 또는 pose update 불안정
-> mapping / odometry 성능 저하
```

즉 5주차는 SLAM 전체를 새로 만드는 주가 아닙니다.

고정된 map에 현재 scan을 붙여 보고, scan distortion이 registration 품질 지표에 어떻게 나타나는지 측정하는 evaluator를 만드는 주입니다.

## **1. Registration은 무엇을 하는가**

LiDAR SLAM에서 registration은 현재 scan을 이전 scan 또는 map에 맞추는 과정입니다.

가장 단순하게 말하면 다음 문제입니다.

```text
현재 scan point들을 어떤 R, t로 움직이면
map의 표면에 가장 잘 붙는가?
```

여기서 $R$은 rotation, $t$는 translation입니다.

5주차에서는 full SLAM loop가 아니라 fixed map 기준의 scan-to-map registration 관점으로 봅니다.

```text
fixed map: 이미 만들어져 있다고 가정한 reference map
current scan: 평가할 LiDAR scan
initial pose: scan을 map에 올릴 때 쓰는 초기 pose
metric: residual, inlier ratio, robust cost
```

이렇게 하면 map이 계속 변하는 효과를 줄이고, scan 자체의 왜곡이 registration metric에 어떻게 드러나는지 보기 쉽습니다.

## **2. Point-to-Plane Residual**

이번 주 핵심 수식은 point-to-plane residual입니다.

현재 scan의 한 point를 $\mathbf{p}_i$라고 하겠습니다.

이 point를 현재 pose $(R, t)$로 map frame에 옮기면:

$$
R\mathbf{p}_i + t
$$

map에서 이 point와 대응되는 local plane의 대표점을 $\mathbf{q}_i$, normal vector를 $\mathbf{n}_i$라고 하면 point-to-plane residual은 다음입니다.

$$
r_i =
\mathbf{n}_i^T
\left(
R\mathbf{p}_i + t - \mathbf{q}_i
\right)
$$

의미는 간단합니다.

```text
scan point가 map의 local plane에서 normal 방향으로 얼마나 떨어져 있는가?
```

여기서 residual은 signed distance입니다.

하지만 metric으로 볼 때는 보통 절댓값을 봅니다.

```text
abs residual 작음:
  scan point가 map 표면에 잘 붙음

abs residual 큼:
  scan point가 map 표면에서 많이 벗어남
```

## **3. Correspondence와 Plane Fitting**

point-to-plane residual을 계산하려면 먼저 각 scan point에 대응되는 map surface를 찾아야 합니다.

이번 evaluator의 흐름은 다음과 같습니다.

```text
1. fixed map point cloud를 KD-tree로 만든다.
2. scan point를 initial pose로 map frame에 올린다.
3. 각 scan point 주변의 map nearest neighbor들을 찾는다.
4. neighbor point들로 local plane을 fitting한다.
5. plane normal n_i와 대표점 q_i를 얻는다.
6. point-to-plane residual r_i를 계산한다.
7. threshold로 inlier/outlier를 나눈다.
```

plane normal은 local map point들의 covariance를 보고 구할 수 있습니다.

작은 eigenvalue에 대응되는 eigenvector가 local plane의 normal 방향입니다.

이 부분이 중요한 이유는, residual이 단순히 두 point 사이의 거리만 보는 것이 아니기 때문입니다.

벽이나 바닥 같은 구조물에서는 point-to-plane residual이 point-to-point distance보다 registration 방향을 더 잘 설명합니다.

## **4. Inlier Ratio와 Residual Metric**

모든 correspondence를 다 믿으면 안 됩니다.

scan point가 map 범위 밖에 있거나, 잘못된 plane에 붙거나, residual이 너무 크면 outlier로 봐야 합니다.

이번 구현에서는 크게 두 threshold를 사용했습니다.

```text
nearest-neighbor threshold:
  fixed map에서 너무 멀리 떨어진 correspondence 제거

residual threshold:
  local plane에서 너무 멀리 떨어진 point 제거
```

inlier ratio는 다음입니다.

$$
\mathrm{inlier\ ratio}
=
\frac{\mathrm{inlier\ count}}
{\mathrm{correspondence\ count}}
$$

5주차에서 보는 주요 지표는 다음입니다.

```text
correspondence_count
inlier_count
inlier_ratio
residual_mean
residual_median
residual_p95
robust_cost
registration_failure
```

여기서 `residual_p95`는 특히 유용합니다.

평균은 일부 쉬운 point가 많으면 좋아 보일 수 있지만, p95는 scan에서 크게 어긋난 tail 쪽을 더 잘 보여줍니다.

## **5. 나빠지는 방식은 하나가 아니다**

이번 주에서 가장 조심해야 할 부분은 registration degradation을 한 가지 현상으로 뭉뚱그리지 않는 것입니다.

왜곡된 scan이 map에 잘 안 붙는 경우는 최소 세 가지로 나눠 볼 수 있습니다.

```text
A. wrong plane correspondence
   - nearest neighbor distance 증가
   - correspondence 자체가 바뀜
   - inlier ratio 감소
   - residual p95 증가

B. correct plane but point location error
   - 같은 벽 또는 같은 바닥에 대응됨
   - correspondence는 유지될 수 있음
   - residual mean / median / p95 증가
   - inlier ratio는 크게 안 떨어질 수도 있음

C. geometry degeneracy
   - residual은 낮아 보일 수 있음
   - inlier ratio도 괜찮아 보일 수 있음
   - 하지만 pose update가 특정 방향으로 불안정
   - Hessian condition 또는 initial pose sensitivity가 나빠짐
```

그래서 registration을 볼 때는 residual 하나만 보면 부족합니다.

residual, inlier ratio, nearest-neighbor distance, pose update 안정성을 같이 봐야 합니다.

## **6. 최소 구현 구조**

5주차 evaluator의 최소 코드는 다음 구조입니다.

```python
import numpy as np
from scipy.spatial import cKDTree


def transform_points(points, R, t):
    return (R @ points.T).T + t


def point_to_plane_residuals(scan_points_map, plane_points, plane_normals):
    diffs = scan_points_map - plane_points
    return np.sum(plane_normals * diffs, axis=1)


def compute_registration_metrics(
    residuals,
    nn_distances,
    residual_threshold=0.1,
    nn_threshold=0.5,
):
    valid_corr = nn_distances < nn_threshold
    inliers = valid_corr & (np.abs(residuals) < residual_threshold)

    correspondence_count = int(np.sum(valid_corr))
    inlier_count = int(np.sum(inliers))

    if correspondence_count == 0:
        inlier_ratio = 0.0
    else:
        inlier_ratio = inlier_count / correspondence_count

    return {
        "correspondence_count": correspondence_count,
        "inlier_count": inlier_count,
        "inlier_ratio": inlier_ratio,
        "residual_p95": float(np.percentile(np.abs(residuals[valid_corr]), 95)),
        "registration_failure": inlier_ratio < 0.5,
    }
```

이 코드는 pose optimization을 끝까지 구현한 ICP가 아닙니다.

우선 fixed pose에서 scan이 map에 얼마나 잘 붙는지 측정하는 residual evaluator입니다.

## **7. UNIST Fixed-Map Registration 구현**

이번 주에는 계획에서 끝내지 않고 UNIST 데이터로 최소 구현까지 만들었습니다.

구현 파일은 다음입니다.

```text
study/fixed_map_registration.py
```

입력은 다음입니다.

```text
fixed map:
/home/iamjaehka13/unist_rosbag/result/handcalib_6_24_0.mcap.ply

raw scan:
study/results/offline_deskew/unist_livox/rank_01_scan_001896/raw_time_color.ply

gyro-deskewed scan:
study/results/offline_deskew/unist_livox/rank_01_scan_001896/gyro_integrated_time_color.ply
```

출력은 다음 폴더에 저장했습니다.

```text
study/results/fixed_map_registration/unist_livox_scan1896/
```

중요한 제한도 분명히 해야 합니다.

```text
pose optimization: disabled
initial pose: identity
method: fixed map에 대한 point-to-plane residual evaluator
```

즉 이 결과는 full SLAM 결과가 아닙니다.

또한 map이 ground truth라는 뜻도 아닙니다.

다만 같은 fixed map 후보를 기준으로 raw scan, gyro-deskewed scan, synthetic distorted scan의 registration metric을 비교할 수 있습니다.

## **8. 대표 그림이 의미하는 것**

5주차 대표 그림은 `spatial_residual_3d.png`입니다.

![UNIST fixed map registration residual 3D view](/assets/img/posts/slam/study/week-5-fixed-map-registration/spatial_residual_3d.png){: .d-block .mx-auto }

이 그림은 세 개의 scan을 fixed map 위에 올려 놓고 비교한 것입니다.

```text
left:
  raw scan

middle:
  gyro-integrated deskewed scan

right:
  synthetic yaw strong 6 deg distortion scan
```

회색 점들은 fixed map입니다.

색이 입혀진 점들은 평가 대상 scan point입니다.

색은 point-to-plane residual의 절댓값을 의미합니다.

```text
어두운 색:
  fixed map의 local plane에 비교적 잘 붙은 point

밝은 노란색:
  fixed map의 local plane에서 많이 벗어난 point
```

따라서 이 그림은 "deskew가 예쁘게 됐다"를 직접 증명하는 그림이 아닙니다.

정확히는 다음을 보여주는 그림입니다.

> 같은 fixed map 기준으로 볼 때, 각 scan point가 local plane에서 얼마나 떨어져 있는가?

그래서 5주차 글에서는 이 그림을 registration residual 분포를 보는 진단 그림으로 해석해야 합니다.

## **9. 주요 수치**

이번 evaluator에서 나온 핵심 수치는 다음입니다.

| method | correspondence | inlier ratio | residual median m | residual p95 m | robust cost |
| --- | ---: | ---: | ---: | ---: | ---: |
| raw | 7552 | 0.676642 | 0.139484 | 0.323333 | 159.419073 |
| gyro_deskewed | 7512 | 0.668530 | 0.144108 | 0.320903 | 163.167669 |
| synthetic_yaw_weak_1deg | 7553 | 0.672580 | 0.139471 | 0.324349 | 159.586067 |
| synthetic_yaw_medium_3deg | 7513 | 0.670571 | 0.140490 | 0.323749 | 159.274829 |
| synthetic_yaw_strong_6deg | 7458 | 0.658219 | 0.146841 | 0.329254 | 162.083715 |

시각적으로 보면 다음과 같습니다.

![UNIST fixed map registration residual p95](/assets/img/posts/slam/study/week-5-fixed-map-registration/residual_p95_bar.png){: .d-block .mx-auto }

![UNIST fixed map registration inlier ratio](/assets/img/posts/slam/study/week-5-fixed-map-registration/inlier_ratio_bar.png){: .d-block .mx-auto }

가장 중요한 비교는 raw와 synthetic strong입니다.

```text
raw:
  residual p95 = 0.323333 m
  inlier ratio = 0.676642

synthetic_yaw_strong_6deg:
  residual p95 = 0.329254 m
  inlier ratio = 0.658219
```

strong synthetic yaw distortion은 raw보다 residual p95가 커지고, inlier ratio가 낮아졌습니다.

즉 controlled distortion이 fixed-map registration metric을 악화시키는 방향은 확인됐습니다.

## **10. 조심해야 하는 해석**

이번 결과에서 가장 조심할 점은 다음입니다.

```text
residual p95 = SLAM error가 아님
inlier ratio = 최종 localization 성능이 아님
UNIST fixed map = ground truth map이 아님
gyro_deskewed 결과 = 항상 raw보다 좋아야 하는 reference가 아님
```

특히 gyro-deskewed scan은 raw보다 p95 residual은 약간 작지만, inlier ratio와 robust cost는 더 좋아졌다고 말하기 어렵습니다.

따라서 이번 결과를 이렇게 쓰면 안 됩니다.

```text
gyro deskew가 registration 성능을 검증했다
deskew로 SLAM 정확도가 개선됐다
fixed map residual이 ground-truth error다
```

안전한 표현은 다음입니다.

```text
UNIST fixed map 후보를 기준으로 scan-to-map residual evaluator를 만들었고,
strong synthetic yaw distortion에서 raw보다 p95 residual 증가와 inlier ratio 감소가 관찰됐다.
```

또 하나 중요한 점은 synthetic distortion sweep이 완전히 단조적이지 않았다는 것입니다.

weak, medium, strong 순서로 residual p95와 robust cost가 항상 증가하지는 않았습니다.

그래서 "distortion이 강해질수록 모든 metric이 단조적으로 나빠졌다"라고 쓰면 안 됩니다.

현재 말할 수 있는 결론은 더 제한적입니다.

```text
strong synthetic distortion은 raw 대비 fixed-map residual/inlier metric을 악화시키는 사례를 만들었다.
```

## **11. 5주차 결과물**

이번 주 결과물은 다음입니다.

```text
study/fixed_map_registration.py

study/results/fixed_map_registration/unist_livox_scan1896/
  registration_metrics.csv
  summary.md
  spatial_residual_3d.png
  spatial_inlier_3d.png
  residual_p95_bar.png
  inlier_ratio_bar.png
  residual_histogram.png
  *_residual_color.ply
  *_inlier_color.ply
```

이번 구현의 역할은 명확합니다.

```text
input:
  fixed map + scan

output:
  point-to-plane residual
  inlier ratio
  robust cost
  residual-colored visualization
```

아직 하지 않은 것은 다음입니다.

```text
Gauss-Newton pose update
multi-iteration ICP
external odometry validation
true ground-truth map comparison
SLAM trajectory drift comparison
```

## **12. 다음 단계**

다음 주에 더 강한 결과로 가려면 fixed-pose residual evaluator에서 pose optimization으로 넘어가야 합니다.

우선순위는 다음입니다.

```text
1. point-to-plane Jacobian 구현
2. Gauss-Newton pose update 추가
3. initial pose perturbation sweep
4. Hessian condition으로 geometry degeneracy 확인
5. raw / deskewed / synthetic distortion의 convergence 비교
6. 가능하면 외부 odometry 또는 SLAM 결과와 비교
```

이렇게 해야 registration metric 변화가 단순 residual 진단을 넘어서 실제 pose estimation 안정성까지 이어지는지 볼 수 있습니다.

## **13. 이번 주 요약**

5주차는 다음 한 문장으로 정리됩니다.

> deskew된 scan 또는 왜곡된 scan이 fixed map의 local plane에 얼마나 잘 붙는지를 point-to-plane residual과 inlier ratio로 측정하는 주였다.

핵심은 residual이 커졌다는 사실만 보는 게 아닙니다.

왜 커졌는지, correspondence가 깨진 것인지, 같은 plane 위에서 point 위치만 흔들린 것인지, 아니면 geometry가 애초에 pose update를 잘 구속하지 못하는 것인지 구분하는 것이 중요합니다.

이번 UNIST 결과는 그 분석으로 가기 위한 첫 evaluator입니다.

아직 연구 claim으로 세게 쓰면 안 되지만, 4주차 deskew 시각화에서 5주차 registration degradation 분석으로 넘어가는 연결고리로는 충분합니다.
