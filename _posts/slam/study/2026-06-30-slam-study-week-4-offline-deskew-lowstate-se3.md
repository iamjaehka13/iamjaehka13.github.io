---
title: "[SLAM Study 4주차] 실제 rosbag Offline Deskew: UNIST Livox와 Go2 연결"
date: 2026-06-30 15:27:00 +0900
last_modified_at: 2026-06-30 20:18:21 +0900
categories: [SLAM, Study]
tags: [slam, lidar-slam, lidar, deskew, offline-deskew, livox, mcap, imu, unitree-go2, lowstate, ros2]
description: SLAM 공부 4주차에 실제 rosbag에서 UNIST Livox gyro-integrated rotation deskew를 메인 시각화로 보고, Go2 LowState estimated SE(3) deskew를 연구 연결용 보조 근거로 정리한다.
image: /assets/img/posts/slam/study/week-4-offline-deskew/unist-livox-scan1896-gyro-deskew-comparison.png
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

처음에는 Go2 walking bag으로 LowState 기반 SE(3) deskew까지 연결했습니다. 연구 주제와는 잘 맞지만, 야외 scan이라 블로그 대표 그림으로는 구조가 선명하지 않았습니다.

그래서 새로 받은 UNIST Livox MCAP bag을 4주차 대표 시각화로 다시 돌렸습니다.

이번 글의 구성은 다음처럼 잡습니다.

```text
UNIST Livox:
  메인 시각화
  point time + gyro-integrated rotation-only deskew
  scan geometry가 실제로 크게 바뀌는 예제

Go2 May 7 bag:
  연구 연결용 보조 근거
  로봇개 walking scan에서 cm-scale correction
  LowState contact-kinematic estimated SE(3) pipeline
```

즉 주연은 UNIST Livox이고, Go2는 연구적 의미를 잡아주는 조연입니다.

이렇게 해야 그림은 보기 좋게 가져가면서도, 전체 연구 주제인 quadruped gait-induced LiDAR motion과의 연결을 잃지 않습니다.

## **1. 4주차의 중심 질문**

이번 주 질문은 다음입니다.

> 실제 rosbag에서 point time과 IMU를 이용해 한 scan을 deskew하면, point cloud geometry가 어떻게 달라지는가?

여기서 가장 중요한 구분은 `correction`과 `error`입니다.

```text
deskew correction:
raw point와 deskewed point가 얼마나 달라졌는가

deskew error:
deskewed point가 정답 clean/reference point와 얼마나 다른가
```

실제 rosbag에는 3주차 synthetic 실험처럼 정답 clean cloud가 없습니다.

따라서 이번 글의 p95 displacement는 정확도 개선량이 아닙니다.

정확한 표현은 다음입니다.

```text
p95 correction magnitude
deskew correction size
raw-to-deskewed displacement
```

틀린 표현은 다음입니다.

```text
p95 error
accuracy improved by 0.636 m
ground-truth deskew result
```

## **2. Deskew 기본식은 그대로**

4주차에서도 deskew 식은 같습니다.

$$
{}^{L(t_r)}\mathbf{p}_i =
\left({}^W T_L(t_r)\right)^{-1}
{}^W T_L(t_i)
{}^{L(t_i)}\mathbf{p}_i
$$

3주차와 다른 점은 ${}^W T_L(t_i)$를 synthetic trajectory에서 가져오지 않는다는 것입니다.

실제 rosbag에서는 trajectory를 다음 중 하나로 만들어야 합니다.

```text
IMU gyro integration
IMU orientation interpolation
constant-velocity model
LIO 내부 trajectory
external odometry
LowState 기반 proprioceptive trajectory
```

UNIST bag에는 pose, odometry, LowState가 없었습니다. 그래서 이번 대표 시각화는 full SE(3)가 아니라 gyro-integrated rotation-only deskew입니다.

Go2 bag은 `/lowstate`가 있어서 estimated translation을 넣은 SE(3) code path까지 연결했습니다. 하지만 그 translation은 ground truth가 아니라 contact-kinematic estimate입니다.

## **3. UNIST Livox MCAP 데이터**

대표 시각화에 사용한 bag은 다음입니다.

```text
/home/iamjaehka13/unist_rosbag/6_24_204_2_0-001.mcap
```

사용 topic은 다음입니다.

```text
LiDAR: /livox/lidar
IMU:   /livox/imu
```

LiDAR message type은 `livox_ros_driver2/msg/CustomMsg`입니다.

이 bag의 장점은 point time을 만들기 쉽다는 것입니다. Livox custom point에는 `offset_time`이 있고, message에는 `timebase`가 있습니다.

이번 데이터에서는 `offset_time` 단위가 nanoseconds였습니다.

따라서 point별 시각은 다음처럼 만듭니다.

$$
t_i =
\mathrm{timebase}
+
\mathrm{offset\_time}_i \times 10^{-9}
$$

이 구조 덕분에 각 point가 scan 안에서 언제 측정됐는지 직접 만들 수 있습니다.

## **4. IMU orientation 대신 gyro integration**

UNIST bag의 `/livox/imu`에는 orientation quaternion field가 있었습니다.

하지만 전체 IMU message를 확인했을 때 orientation quaternion은 identity였습니다.

```text
imu_orientation_all_identity: True
orientation_max_abs_xyz: 0.000e+00
orientation_max_abs_w_minus_1: 0.000e+00
```

따라서 orientation field를 그대로 쓰면 scan 내부 회전이 없는 것처럼 됩니다.

이번 구현에서는 `/livox/imu`의 `angular_velocity`를 scan window에서 적분해서 rotation trajectory를 만들었습니다.

```text
trajectory_source:
/livox/imu angular_velocity integrated within bag

deskew_type:
rotation_only_gyro_integrated
```

translation은 보정하지 않았습니다.

```text
translation_compensated: false
```

이 bag에는 pose/odometry topic이 없었기 때문입니다.

### **Gyro Integration이 실제로 하는 일**

IMU gyro는 angular velocity를 줍니다.

$$
\boldsymbol{\omega}(t)
=
\begin{bmatrix}
\omega_x(t) \\
\omega_y(t) \\
\omega_z(t)
\end{bmatrix}
$$

짧은 시간 $\Delta t$ 동안 회전은 작은 rotation vector로 근사할 수 있습니다.

$$
\Delta \boldsymbol{\theta}
\approx
\boldsymbol{\omega}(t)\Delta t
$$

이를 SO(3) exponential로 회전에 누적하면:

$$
R_{k+1}
=
R_k
\exp
\left(
[\boldsymbol{\omega}_k \Delta t]_\times
\right)
$$

입니다.

이번 UNIST deskew는 이 과정을 scan window 안에서 수행한 것입니다.

```text
/livox/imu angular_velocity
-> scan 시간 구간에서 적분
-> point time마다 orientation interpolation
-> rotation-only deskew
```

여기서 중요한 제한이 있습니다.

gyro integration은 orientation 변화량을 만들 수 있지만, translation은 만들지 못합니다.

또한 gyro bias가 있으면 시간이 길어질수록 orientation drift가 누적됩니다.

이번 scan은 약 `0.1 s`로 짧기 때문에 rotation-only 시각화에는 쓸 수 있지만, 이것을 긴 구간의 reference trajectory라고 부르면 안 됩니다.

### **Rotation-only Deskew의 한계**

rotation-only deskew는 다음을 가정하는 것과 비슷합니다.

```text
scan 동안 LiDAR 원점 translation은 무시할 수 있다.
하지만 LiDAR orientation 변화는 보정한다.
```

이 가정은 회전이 dominant한 장면에서는 꽤 큰 geometry 변화를 보여줄 수 있습니다.

하지만 실제 rigid body motion은 SE(3)입니다.

```text
pose(t) = rotation(t) + translation(t)
```

translation이 큰 구간에서는 rotation-only 결과가 오히려 일부 metric에서 애매하게 보일 수 있습니다.

그래서 UNIST 결과는 "rotation deskew가 point geometry를 크게 바꾼다"는 시각화에는 좋지만, full SE(3) deskew 검증으로 쓰면 안 됩니다.

## **5. 새 Livox MCAP explorer**

UNIST MCAP용으로 새 스크립트를 추가했습니다.

```text
study/livox_mcap_deskew_explorer.py
```

이 스크립트가 하는 일은 다음입니다.

```text
1. /livox/lidar CustomMsg를 읽는다.
2. timebase + offset_time으로 point time을 만든다.
3. /livox/imu angular_velocity를 읽는다.
4. scan window에서 gyro를 적분해 rotation trajectory를 만든다.
5. raw cloud와 gyro-deskewed cloud를 저장한다.
6. correction magnitude와 ground plane RMS를 계산한다.
7. 보기 좋은 후보 scan을 ranking한다.
```

이번 대표 후보는 rank 1입니다.

```text
study/results/offline_deskew/unist_livox/rank_01_scan_001896/
  comparison.png
  metrics.json
  raw_time_color.ply
  gyro_integrated_time_color.ply
  gyro_integrated_displacement_color.ply
```

## **6. UNIST 대표 결과**

대표 이미지는 `scan_id=1896`입니다.

![UNIST Livox scan 1896 raw and gyro-integrated deskew comparison](/assets/img/posts/slam/study/week-4-offline-deskew/unist-livox-scan1896-gyro-deskew-comparison.png){: .d-block .mx-auto }

그림은 다음을 보여줍니다.

```text
top-left: raw top-view
top-middle: gyro-deskewed top-view
top-right: raw cloud colored by deskew displacement
bottom-left: raw side-view
bottom-middle: gyro-deskewed side-view
bottom-right: raw front-view
```

UNIST 결과의 핵심 수치는 다음입니다.

| 항목 | 값 |
|---|---:|
| `scan_id` | 1896 |
| point count | 19624 |
| scan duration | 0.100312 s |
| IMU samples in scan | 20 |
| gyro-integrated rotation delta | 5.845298 deg |
| gyro p95 | 1.068314 rad/s |
| p95 correction | 0.636469 m |
| max correction | 1.109851 m |
| timestamp clip count | 0 |
| raw ground RMS | 0.246322 m |
| gyro-deskewed ground RMS | 0.245906 m |

이 scan은 블로그 대표 예제로 좋습니다.

이유는 세 가지입니다.

```text
1. point 수가 충분히 많다.
2. 구조물이 Go2 outdoor scan보다 훨씬 선명하다.
3. rotation-only deskew correction이 크게 보인다.
```

## **7. UNIST 결과 해석**

이번 UNIST scan은 약 `100 ms` 길이입니다.

그 scan 안에서 gyro-integrated rotation delta는 약 `5.85 deg`였습니다.

그래서 rotation-only deskew correction의 p95가 약 `0.636 m`까지 나왔습니다.

이 값은 꽤 큽니다. 하지만 다시 말하면 이것은 error가 아니라 correction magnitude입니다.

정확한 해석은 다음입니다.

```text
한 scan 안에서 rotation trajectory를 반영하면,
raw point 위치가 p95 기준 약 0.64 m 정도 이동한다.
```

틀린 해석은 다음입니다.

```text
deskew로 0.64 m 정확도가 좋아졌다.
```

ground RMS도 조심해서 봐야 합니다.

| Metric | Raw | Gyro-deskewed | Difference |
|---|---:|---:|---:|
| ground RMS | 0.246322 m | 0.245906 m | 0.000416 m lower |

수치상으로는 아주 조금 낮아졌지만, 차이는 약 `0.4 mm`입니다.

따라서 이번 결과를 정량 성능 개선으로 주장하면 안 됩니다.

이번 UNIST 결과의 역할은 이것입니다.

```text
실제 Livox scan에서 point time과 gyro integration만으로도
rotation deskew가 point geometry를 크게 바꾸는 것을 보여주는 시각화 예제
```

## **8. 왜 Go2 결과를 버리면 안 되는가**

UNIST 결과는 예쁘고 deskew 효과가 잘 보입니다.

하지만 이것만 쓰면 4주차 글은 일반 Livox deskew 예제가 됩니다.

내 연구 주제는 단순한 일반 LiDAR deskew가 아니라, 로봇개 보행에서 생기는 body motion이 LiDAR SLAM에 어떤 영향을 주는지 보는 것입니다.

그래서 Go2 결과는 조연으로 필요합니다.

Go2 결과의 역할은 다음입니다.

```text
1. 로봇개 walking scan에서도 cm-scale correction이 생긴다.
2. /lowstate를 이용해 estimated translation을 넣는 SE(3) code path를 열었다.
3. 따라서 이 연구가 quadruped gait-induced LiDAR motion 문제와 연결된다.
```

다만 Go2 결과를 메인 그림으로 쓰기에는 약했습니다.

```text
outdoor scan이라 구조가 덜 선명함
point 수가 UNIST scan보다 적음
SE(3) translation이 ground truth가 아니라 estimated term
```

따라서 역할 분리가 맞습니다.

```text
UNIST: 메인 시각화
Go2: 연구 연결
```

## **9. Go2 LowState SE(3) 보조 결과**

Go2 결과는 이전에 만든 다음 scan입니다.

```text
bag: may07_bag1_walk_clean
scan_id: 14327
segment: walk_like
```

새로 만든 스크립트는 다음입니다.

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

stance foot이 짧은 순간 world에서 고정되어 있다고 보고, FK + Jacobian + contact constraint로 body velocity를 추정했습니다.

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

이 식은 다음 contact constraint에서 나온 직관입니다.

stance foot이 순간적으로 world에서 고정되어 있다고 보면, foot의 world velocity는 0에 가깝습니다.

```text
stance foot world velocity ~= 0
```

base frame에서 foot 위치를 $\mathbf{p}_{BF}$라고 하면, foot velocity에는 세 항이 섞입니다.

```text
base translation velocity
base angular velocity 때문에 생기는 lever-arm velocity
joint motion 때문에 foot이 움직이는 velocity
```

이를 base frame에서 쓰면 대략:

$$
\mathbf{v}_{F}
\approx
\mathbf{v}_{B}
+
\boldsymbol{\omega}_{B}
\times
\mathbf{p}_{BF}
+
J(\mathbf{q})\dot{\mathbf{q}}
$$

stance foot이 고정되어 있으니 $\mathbf{v}_F \approx 0$으로 두고 정리하면:

$$
\mathbf{v}_B
\approx
-
\left(
J(\mathbf{q})\dot{\mathbf{q}}
+
\boldsymbol{\omega}_{B}
\times
\mathbf{p}_{BF}
\right)
$$

가 됩니다.

즉 이것은 "관절각으로 base pose를 직접 푼 것"이 아닙니다.

짧은 순간의 contact constraint를 이용해 body translation velocity를 추정한 것입니다.

그래서 이름도 `measured odometry`가 아니라 `contact-kinematic estimated translation`에 가깝습니다.

### **왜 Foot Slip이 핵심 리스크인가**

위 식은 stance foot이 world에서 고정되어 있다는 가정에 기대고 있습니다.

하지만 실제 보행에서는 다음 일이 생길 수 있습니다.

```text
foot slip
soft ground
contact timing error
foot force threshold error
URDF / joint calibration error
```

이 경우 $\mathbf{v}_F \approx 0$ 가정이 깨집니다.

그러면 추정된 $\mathbf{v}_B$도 bias를 갖습니다.

그래서 LowState SE(3) deskew는 연구적으로 흥미로운 proprioceptive path이지만, 외부 odometry나 SLAM trajectory와 비교하기 전까지는 reference trajectory가 아닙니다.

이 translation estimate를 기존 `offline_deskew_explorer.py`에 넣기 위해 다음 option도 추가했습니다.

```text
--scan-id
--timestamp-source
--trajectory-translation-kind estimated
```

Go2 결과의 주요 수치는 다음입니다.

| 항목 | 값 |
|---|---:|
| `scan_id` | 14327 |
| point count | 1397 |
| scan duration | 0.069274 s |
| IMU samples in scan | 17 |
| orientation delta | 3.203842 deg |
| LowState samples in scan window | 34 |
| LowState estimated translation delta | 0.015085 m |
| rotation-only p95 correction | 0.064710 m |
| LowState estimated SE(3) p95 correction | 0.072625 m |
| SE(3) vs rotation-only p95 difference | 0.015644 m |

이 결과에서 말할 수 있는 것은 다음입니다.

```text
Go2 walking scan에서도 rotation-only correction이 cm-scale로 생긴다.
LowState estimated translation을 넣으면 SE(3) correction이 조금 더 커진다.
translation term은 0이 아니다.
```

하지만 이렇게 쓰면 안 됩니다.

```text
LowState SE(3) deskew가 정답이다.
Go2 odometry가 검증됐다.
SLAM 성능이 좋아졌다는 증거다.
```

정확한 이름은 다음입니다.

```text
LowState contact-kinematic estimated-translation SE(3) deskew
```

짧게는 다음처럼 쓸 수 있습니다.

```text
LowState estimated SE(3) deskew
proprioceptive SE(3) deskew
```

## **10. Go2 시간축 문제**

Go2 결과에서 중요한 문제는 시간축이었습니다.

LiDAR cloud와 IMU는 header time을 씁니다.

하지만 `/lowstate`에는 header stamp가 없습니다. 그래서 LowState는 rosbag2 storage time으로 읽었습니다.

그대로 섞으면 두 trajectory가 서로 다른 시간축에 놓입니다.

이번 Go2 bag에서는 다음 offset을 적용했습니다.

```text
header_timestamp - bag_timestamp = -995.347479105 s
```

즉 LowState bag timestamp에 이 offset을 더해서 LiDAR header time 축에 맞췄습니다.

```text
lowstate_output_time =
lowstate_bag_timestamp + (-995.347479105)
```

이 alignment를 하지 않으면 LiDAR scan window와 LowState trajectory window가 서로 다른 구간을 가리키게 됩니다.

그 상태에서 SE(3) deskew를 하면 결과가 틀어질 수밖에 없습니다.

## **11. Claim Boundary**

이번 4주차 글의 claim은 다음 정도로 제한해야 합니다.

```text
UNIST Livox MCAP:
point time과 gyro integration으로 rotation-only deskew를 수행했고,
선택 scan에서 p95 0.636 m 수준의 correction이 생겼다.

Go2 May 7 walking scan:
rotation-only correction이 cm-scale로 생겼고,
LowState contact-kinematic odometry로 estimated translation SE(3) path를 열었다.
```

아직 말하면 안 되는 것은 다음입니다.

```text
ground-truth deskew를 했다.
reference trajectory를 얻었다.
SLAM 성능이 개선됐다.
Go2 LowState odometry가 외부 기준으로 검증됐다.
UNIST 결과로 로봇개 보행 claim을 증명했다.
```

UNIST는 시각화용 실제 Livox deskew 예제입니다.

Go2는 로봇개 연구 연결용 보조 근거입니다.

둘을 섞어서 하나의 강한 claim으로 만들면 안 됩니다.

## **12. 남은 리스크**

UNIST 쪽 리스크는 다음입니다.

| 리스크 | 의미 |
|---|---|
| no pose/odom | translation 포함 SE(3) deskew는 이 bag으로 불가 |
| gyro integration drift | 짧은 scan window에서는 쓸 수 있지만 reference trajectory는 아님 |
| orientation quaternion identity | IMU orientation field를 그대로 쓸 수 없음 |
| ground RMS 약함 | ground RMS 차이가 매우 작아서 성능 개선 claim으로 쓰기 어려움 |
| correction vs error | p95 displacement는 error가 아니라 correction magnitude |

Go2 쪽 리스크는 다음입니다.

| 리스크 | 의미 |
|---|---|
| foot slip | stance foot 고정 가정이 깨질 수 있음 |
| raw foot force 신뢰도 | Unitree foot force는 calibrated Newton이 아니라 raw contact proxy |
| base-to-LiDAR extrinsic | LowState trajectory 생성 summary에는 base-to-LiDAR translation이 ignored 된 가정이 있음 |
| external odometry 없음 | LowState estimate가 실제 body translation과 얼마나 맞는지 아직 검증하지 않음 |
| surface metric 약함 | outdoor scan에서는 plane metric이 품질 판단에 약할 수 있음 |

따라서 이번 결과는 구현과 시각화 단계입니다.

정량 연구 결과로 쓰려면 다음이 필요합니다.

```text
external odometry
SLAM trajectory 비교
반복 scan 통계
wall thickness / plane residual이 의미 있는 실내 구간
scan-to-map residual 또는 odometry drift와의 연결
```

## **13. 다음 단계**

다음 단계는 두 갈래입니다.

첫째, UNIST처럼 구조가 선명한 bag에서 surface consistency metric을 더 잘 잡습니다.

```text
wall thickness
plane residual
normal dispersion
scan-to-map residual
```

둘째, Go2 쪽에서는 LowState trajectory를 검증해야 합니다.

```text
LowState odometry vs external odometry
LowState odometry vs SLAM trajectory
LowState contact estimate vs foot slip condition
validated trajectory 기반 SE(3) deskew
```

이 두 가지가 연결되면 다음 claim으로 갈 수 있습니다.

```text
quadruped gait-induced body motion
-> scan 내부 LiDAR pose 변화
-> deskew correction / residual distortion
-> scan matching residual 증가
-> map blur 또는 odometry drift
```

## **14. 이번 주 정리**

4주차를 한 문장으로 정리하면 다음입니다.

> 실제 rosbag에서 point time과 IMU를 이용해 offline deskew를 수행했고, UNIST Livox는 시각화 예제로, Go2 LowState는 로봇개 연구 연결용 보조 근거로 정리했다.

이번 주 흐름은 다음입니다.

```text
3주차 synthetic deskew 수식 확인
-> UNIST Livox MCAP에서 point time 추출
-> /livox/imu gyro integration으로 rotation trajectory 생성
-> raw vs gyro-deskewed cloud 시각화
-> p95 correction은 error가 아니라 보정량으로 해석
-> Go2 walking scan의 cm-scale correction으로 연구 연결
-> LowState estimated SE(3)는 아직 reference/GT가 아님을 명확히 둠
```

결론은 보수적으로 잡습니다.

```text
UNIST는 메인 그림으로 좋다.
Go2는 연구 맥락상 필요하다.
둘을 섞어 강한 성능 claim으로 쓰면 안 된다.
```

이 구성이 4주차 블로그에는 가장 안전합니다.
