---
title: "[SLAM Study 4주차] 실제 rosbag Offline Deskew와 LowState SE(3) Trajectory"
date: 2026-06-30 15:27:00 +0900
categories: [SLAM, Study]
tags: [slam, lidar-slam, lidar, deskew, offline-deskew, se3, unitree-go2, lowstate, leg-odometry, ros2]
description: SLAM 공부 4주차에 실제 rosbag scan에서 rotation-only deskew와 LowState contact-kinematic estimated-translation SE(3) deskew를 비교한 결과를 정리한다.
image: /assets/img/posts/slam/study/week-4-offline-deskew/may07-bag1-scan14327-lowstate-se3-comparison.png
math: true
---

## **0. 이번 주에 잡아야 하는 것**

3주차에는 synthetic world에서 deskew 수식이 맞는지 확인했습니다.

```text
clean cloud 생성
-> synthetic re-skew
-> exact trajectory로 deskew
-> clean cloud 복원 확인
```

4주차는 실제 rosbag으로 넘어갑니다.

이번 주 목표는 SLAM 전체 성능을 평가하는 것이 아니라, 실제 scan 하나에서 deskew correction이 어느 정도 생기는지 보는 것입니다.

이번에 고른 후보는 다음입니다.

```text
bag: may07_bag1_walk_clean
scan_id: 14327
segment: walk_like
```

이 scan을 기준으로 먼저 rotation-only deskew를 보고, 그다음 LowState 기반 estimated translation을 넣은 SE(3) deskew까지 연결했습니다.

## **1. 4주차의 중심 질문**

이번 주 질문은 다음입니다.

> 실제 rosbag에서 한 scan 안의 LiDAR pose 변화는 point cloud에 어느 정도 deskew correction을 만드는가?

여기서 조심해야 할 점이 있습니다.

이번 결과는 `deskew error`가 아니라 `deskew correction`입니다.

```text
deskew correction:
raw point와 deskewed point가 얼마나 달라졌는가

deskew error:
deskewed point가 정답 clean/reference point와 얼마나 다른가
```

실제 rosbag에는 3주차 synthetic 실험처럼 정답 clean cloud가 없습니다. 따라서 이번 결과를 ground truth deskew 성능으로 해석하면 안 됩니다.

이번 주에는 다음 정도를 보는 것이 맞습니다.

```text
rotation-only correction 크기
estimated translation을 넣었을 때 SE(3) correction 변화
rotation-only와 SE(3) 결과의 차이
time alignment가 맞지 않으면 결과가 틀어지는 이유
```

## **2. Deskew 기본식은 그대로**

4주차에서도 deskew 식은 같습니다.

$$
{}^{L(t_r)}\mathbf{p}_i =
\left({}^W T_L(t_r)\right)^{-1}
{}^W T_L(t_i)
{}^{L(t_i)}\mathbf{p}_i
$$

3주차와 다른 점은 ${}^W T_L(t_i)$를 직접 만든 synthetic trajectory에서 가져오지 않는다는 것입니다.

실제 rosbag에서는 다음 중 하나로 trajectory를 만들어야 합니다.

```text
IMU orientation interpolation
constant-velocity model
LIO 내부 trajectory
external odometry
LowState 기반 proprioceptive trajectory
```

이번 4주차 구현에서는 먼저 IMU orientation으로 rotation-only deskew를 만들고, 그 위에 LowState contact-kinematic translation estimate를 붙여 SE(3) trajectory로 확장했습니다.

## **3. 새로 만든 LowState 기반 leg odometry**

이번에 새로 만든 스크립트는 다음입니다.

```text
study/go2_lowstate_leg_odometry.py
```

이 스크립트는 `/lowstate`에서 다음 정보를 읽습니다.

```text
관절각 q
관절속도 qdot
foot_force
IMU gyro
Go2 URDF
```

핵심은 역기구학만으로 base pose를 직접 뽑는 것이 아닙니다.

이번 구현은 stance foot이 짧은 순간 world에서 고정되어 있다고 보고, FK + Jacobian + contact constraint로 body velocity를 추정합니다.

사용한 식은 다음입니다.

$$
\mathbf{v}_B
\approx
-
\left(
J(\mathbf{q})\dot{\mathbf{q}}
+
\boldsymbol{\omega}_B \times \mathbf{p}_{BF}
\right)
$$

여기서 의미는 다음입니다.

| 항 | 의미 |
|---|---|
| $\mathbf{v}_B$ | base frame 기준 body velocity estimate |
| $J(\mathbf{q})\dot{\mathbf{q}}$ | joint motion으로 생기는 foot velocity |
| $\boldsymbol{\omega}_B$ | body angular velocity |
| $\mathbf{p}_{BF}$ | base frame에서 본 foot 위치 |
| $\boldsymbol{\omega}_B \times \mathbf{p}_{BF}$ | body rotation 때문에 foot 위치에 생기는 velocity term |

stance leg마다 body velocity 후보를 만들고, foot force로 contact leg를 고른 뒤 평균했습니다. 그 velocity를 scan 주변 window에서 적분해서 translation trajectory를 만들었습니다.

정확한 표현은 다음입니다.

```text
LowState contact-kinematic SE(3) deskew
estimated-translation SE(3) deskew
proprioceptive SE(3) deskew
```

아래 표현은 아직 쓰면 안 됩니다.

```text
reference SE(3) deskew
ground-truth deskew
measured odometry deskew
```

이 구분이 중요합니다. 이번 trajectory는 로봇 내부 proprioceptive signal로 만든 estimate이지, 외부 ground truth가 아닙니다.

## **4. Offline deskew explorer 확장**

기존 `study/offline_deskew_explorer.py`도 확장했습니다.

추가한 주요 option은 다음입니다.

```text
--scan-id
--timestamp-source
--trajectory-translation-kind estimated
```

이제 scan 후보를 자동 ranking으로만 고르지 않고, 특정 `scan_id`를 직접 지정할 수 있습니다.

그리고 LowState로 만든 trajectory CSV를 SE(3) deskew 입력으로 넣을 수 있습니다.

```text
trajectory_csv:
study/results/offline_deskew/lowstate_leg_odom/may07_bag1_scan14327_header_aligned_trajectory.csv

trajectory_translation_kind:
estimated
```

여기서 `estimated` label을 둔 이유는 명확합니다.

이 translation은 measured odometry가 아니라 LowState contact-kinematic estimate입니다.

## **5. 시간축 문제**

이번 구현에서 가장 중요한 문제는 시간축이었습니다.

LiDAR cloud와 IMU는 header time을 사용합니다.

하지만 `/lowstate`에는 header stamp가 없습니다. 그래서 LowState는 rosbag2 storage time으로 읽어야 했습니다.

그대로 섞으면 두 trajectory가 서로 다른 시간축에 놓입니다.

이번 bag에서는 다음 offset을 적용했습니다.

```text
header_timestamp - bag_timestamp = -995.347479105 s
```

즉 LowState bag timestamp에 이 offset을 더해서 LiDAR header time 축에 맞췄습니다.

```text
lowstate_output_time =
lowstate_bag_timestamp + (-995.347479105)
```

이 alignment를 하지 않으면 LiDAR scan window와 LowState trajectory window가 서로 다른 구간을 가리키게 됩니다. 그러면 SE(3) deskew 결과가 틀어질 수밖에 없습니다.

이번 결과 파일에도 이 가정이 기록되어 있습니다.

```text
lowstate_timestamp_source: rosbag2_storage_timestamp
trajectory_output_time_offset_s: -995.347479105
trajectory_output_timestamp_source: lowstate_bag_timestamp_plus_offset
lidar_imu_timestamp_source: header
```

## **6. 최종 결과 파일**

이번 결과는 다음 경로에 저장했습니다.

```text
study/results/offline_deskew/lowstate_leg_odom/
  may07_bag1_scan14327_header_aligned_trajectory.csv
  may07_bag1_scan14327_header_aligned_summary.json

study/results/offline_deskew/
  may07_bag1_scan14327_lowstate_leg_se3_header_aligned/
    summary.md
    summary.csv
    rank_01_scan_014327/
      comparison.png
      metrics.json
```

블로그에는 `comparison.png`를 같이 넣었습니다.

![scan 14327 raw, rotation-only, SE(3) deskew comparison](/assets/img/posts/slam/study/week-4-offline-deskew/may07-bag1-scan14327-lowstate-se3-comparison.png){: .d-block .mx-auto }

그림은 위에서부터 top-view, 아래에서 side-view입니다.

```text
left: raw cloud
middle: IMU orientation rotation-only deskew
right: LowState estimated-translation SE(3) deskew
```

## **7. 주요 수치**

이번 scan의 기본 정보는 다음입니다.

| 항목 | 값 |
|---|---:|
| `scan_id` | 14327 |
| point count | 1397 |
| scan duration | 0.069274 s |
| IMU samples in scan | 17 |
| orientation delta | 3.203842 deg |
| LowState samples in scan window | 34 |
| LowState estimated translation delta | 0.015085 m |
| dropped packet flag | false |

Deskew correction 관련 수치는 다음입니다.

| Method | p95 correction / difference |
|---|---:|
| constant-rotation correction | 0.041835 m |
| IMU orientation rotation-only correction | 0.064710 m |
| LowState estimated SE(3) correction | 0.072625 m |
| constant rotation vs IMU orientation difference | 0.025864 m |
| SE(3) vs rotation-only difference | 0.015644 m |

여기서 다시 강조해야 할 점이 있습니다.

```text
0.064710 m
0.072625 m
```

이 값들은 deskew error가 아니라 correction amount입니다.

즉 raw point가 deskew 과정에서 얼마나 움직였는지를 나타냅니다.

## **8. 해석**

이번 scan에서는 scan duration이 약 `69 ms`였습니다.

그 짧은 시간 동안 IMU orientation 기준 LiDAR rotation 변화는 약 `3.20 deg`였습니다.

rotation-only deskew만 해도 p95 correction이 약 `6.47 cm` 나왔습니다.

LowState contact-kinematic translation estimate를 추가하면 SE(3) p95 correction은 약 `7.26 cm`로 커졌습니다.

그리고 SE(3) 결과와 rotation-only 결과 사이의 p95 difference는 약 `1.56 cm`였습니다.

따라서 이번 결과에서 말할 수 있는 것은 다음 정도입니다.

```text
보행 중 body rotation + estimated translation
-> scan 내부 LiDAR pose 변화
-> point별 위치 correction 발생
-> rotation-only correction만으로도 cm-scale
-> estimated translation term도 0은 아님
```

다만 이렇게 쓰면 안 됩니다.

```text
LowState SE(3) deskew가 정답이다.
SLAM 성능이 좋아졌다는 증거다.
translation estimate가 정확히 측정됐다.
```

이번 결과는 4주차 블로그/스터디용 구현 결과로는 충분하지만, 연구 claim으로 세게 쓰려면 다음 검증이 필요합니다.

```text
LowState odometry vs external odometry
LowState odometry vs LIO/SLAM trajectory
surface consistency metric이 의미 있는 실내/평면 구간 검증
multiple scan / multiple gait segment 통계
```

## **9. Ground RMS는 약한 metric**

이번 결과에는 ground plane RMS도 계산되어 있습니다.

| Cloud | ground RMS |
|---|---:|
| raw | 0.067090 m |
| constant rotation | 0.067250 m |
| IMU orientation | 0.067826 m |
| SE(3) | 0.068209 m |

이 값만 보면 deskew가 좋아졌다고 말하기 어렵습니다.

오히려 이 scan에서는 ground RMS가 약간 커졌습니다.

하지만 outdoor scan의 ground plane RMS는 약한 metric입니다. point 분포, 지면 roughness, 선택된 ground candidate, fitting 방식에 영향을 많이 받습니다.

그래서 이번 주에는 ground RMS를 성능 결론으로 쓰지 않습니다.

현재 단계에서 더 적절한 해석은 다음입니다.

```text
deskew correction이 실제 scan에서 cm-scale로 발생한다.
rotation-only와 estimated SE(3)는 서로 다른 결과를 만든다.
translation estimate를 넣으면 p95 correction이 증가한다.
하지만 이것이 cloud 품질 개선이라는 증거는 아직 아니다.
```

## **10. 남은 리스크**

이번 결과는 아직 초기 study pass입니다.

남은 리스크는 다음입니다.

| 리스크 | 의미 |
|---|---|
| foot slip | stance foot이 world에서 고정되어 있다는 가정이 깨질 수 있음 |
| raw foot force 신뢰도 | Unitree foot force는 calibrated Newton이 아니라 raw contact proxy |
| base-to-LiDAR extrinsic | 이번 LowState trajectory 생성 summary에는 base-to-LiDAR translation이 ignored 된 가정이 있음 |
| IMU-to-LiDAR rotation | 첫 pass에서는 identity에 가깝게 가정한 부분이 있음 |
| external odometry 없음 | LowState estimate가 실제 body translation과 얼마나 맞는지 아직 검증하지 않음 |
| ground RMS 약함 | outdoor scan에서는 plane metric이 품질 판단에 약할 수 있음 |

따라서 이번 결과의 정확한 이름은 다음입니다.

```text
LowState contact-kinematic estimated-translation SE(3) deskew
```

짧게 쓰면 다음도 괜찮습니다.

```text
LowState estimated SE(3) deskew
proprioceptive SE(3) deskew
```

하지만 `reference`, `GT`, `measured odometry`라는 표현은 아직 피해야 합니다.

## **11. 다음 단계**

4주차에서 한 일은 실제 rosbag에 SE(3) deskew 입력을 넣는 길을 연 것입니다.

다음 단계는 두 가지입니다.

첫째, LowState leg odometry를 외부 기준과 비교해야 합니다.

```text
external odometry
SLAM trajectory
manual alignment된 map trajectory
가능하면 motion capture 또는 더 신뢰할 수 있는 reference
```

둘째, scan 하나가 아니라 여러 scan에서 같은 metric을 봐야 합니다.

```text
stand-like segment
walk-like segment
turning segment
fast body oscillation segment
```

그리고 correction amount가 아니라 surface consistency나 scan matching residual까지 연결해야 합니다.

```text
deskew correction
-> plane / wall residual
-> scan-to-map residual
-> odometry drift / map blur
```

이 연결이 되어야 연구 claim으로 넘어갈 수 있습니다.

## **12. 이번 주 정리**

4주차를 한 문장으로 정리하면 다음입니다.

> 실제 rosbag scan에서 rotation-only deskew를 LowState contact-kinematic estimated-translation SE(3) deskew까지 확장하고, cm-scale deskew correction을 확인했다.

이번 주 흐름은 다음입니다.

```text
3주차 synthetic deskew 수식 확인
-> 실제 rosbag scan 14327 선택
-> IMU orientation rotation-only deskew
-> LowState leg odometry로 translation estimate 생성
-> LowState storage time을 LiDAR header time으로 align
-> estimated SE(3) trajectory를 offline deskew에 입력
-> rotation-only와 SE(3) correction 비교
```

결론은 보수적으로 잡아야 합니다.

```text
translation term은 0이 아니다.
rotation-only와 SE(3)는 실제로 다른 correction을 만든다.
하지만 아직 reference/GT deskew는 아니다.
```

이번 단계는 4주차 스터디 결과로는 충분합니다. 연구 결과로 쓰기 위해서는 다음에 LowState odometry 자체를 외부 odometry나 SLAM trajectory와 비교해야 합니다.
