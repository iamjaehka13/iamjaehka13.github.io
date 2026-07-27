---
title: "[SLAM Study 6주차] LIO 내부 데이터 흐름 추적"
date: 2026-07-08 16:04:24 +0900
published: false
last_modified_at: 2026-07-10 15:47:18 +0900
categories: [SLAM, Study]
tags: [slam, lidar-slam, lio, lidar-inertial-odometry, imu, deskew, fast-lio, lio-sam, loam, state-estimation, residual, mapping, ros2]
description: "SLAM 공부 6주차에 LIO 내부에서 IMU propagation, scan pose prediction, deskew, point-to-map residual, state update, map insertion, odometry output이 어떻게 연결되는지 정리한다."
image: /assets/img/posts/slam/study/week-6-lio-data-flow/full_bag_trace_overview.png
math: true
---

## **0. 이번 주에 잡아야 하는 것**

6주차는 LIO를 수식으로 새로 구현하는 주가 아닙니다.

이미 있는 LIO 코드 안에서 데이터가 어떻게 흘러가는지 추적하는 주입니다.

지금까지의 흐름은 다음이었습니다.

```text
1주차:
  frame과 SE(3)

2주차:
  LiDAR point timestamp

3~4주차:
  deskew와 실제 rosbag correction

5주차:
  point-to-plane residual과 fixed-map registration
```

6주차는 이 개념들을 실제 LIO 시스템 안에서 연결합니다.

```text
IMU propagation
-> scan pose prediction
-> deskew
-> point-to-map residual
-> state update
-> map insertion
-> odometry output
```

내 연구 질문은 다음 경로를 보는 것입니다.

```text
quadruped gait / body motion
-> LiDAR sensor motion
-> scan distortion or deskew error
-> registration degradation
-> map blur
-> odometry drift
```

따라서 6주차의 목표는 이 경로가 LIO 코드 안에서 어디에 있는지 찾는 것입니다.

이번 주가 끝나면 다음을 설명할 수 있어야 합니다.

```text
IMU 하나가 들어오면 LIO 내부에서 어떻게 pose prediction에 쓰이는가?

LiDAR point 하나가 들어오면
timestamp -> deskew -> correspondence -> residual -> update -> map insertion
순서로 어떻게 흘러가는가?

한 scan에서 prediction pose와 update pose는 어떻게 다른가?

어디에 logging을 추가해야
deskew, residual, inlier, pose update를 뽑을 수 있는가?
```

한 줄로 말하면:

> 6주차는 LIO 내부 데이터 흐름 추적 주간이다.

## **1. LIO를 큰 그림으로 보기**

LIO는 LiDAR-Inertial Odometry입니다.

말 그대로 LiDAR와 IMU를 같이 사용해서 로봇의 pose를 추정합니다.

IMU와 LiDAR는 역할이 다릅니다.

IMU는 빠릅니다.

```text
IMU:
  200 Hz, 400 Hz, 500 Hz 등

LiDAR:
  10 Hz, 20 Hz 등
```

IMU는 scan 사이사이의 빠른 움직임을 예측합니다.

```text
gyro:
  rotation prediction

accelerometer:
  velocity / position prediction
```

하지만 IMU만 적분하면 bias 때문에 drift가 누적됩니다.

LiDAR는 느리지만 주변 geometry를 봅니다.

LiDAR scan을 map에 맞추면 pose correction을 할 수 있습니다.

```text
scan point
-> map point / plane correspondence
-> residual 계산
-> pose 보정
```

즉 LiDAR는 IMU propagation의 drift를 geometry로 보정합니다.

LIO 전체 흐름은 다음처럼 볼 수 있습니다.

```text
1. IMU propagation
   이전 pose에서 현재 scan 시각까지 pose를 예측한다.

2. LiDAR deskew
   IMU로 예측한 scan 내부 pose trajectory를 이용해 point 왜곡을 보정한다.

3. LiDAR update
   deskew된 point를 map에 맞추고 residual로 state를 correction한다.

4. Map update
   보정된 pose 기준으로 point를 local map에 넣는다.
```

## **2. 6주차에서 봐야 하는 State**

LIO가 추정하는 state는 보통 다음 항목을 포함합니다.

```text
position p
rotation R
velocity v
gyro bias b_g
accelerometer bias b_a
gravity g
LiDAR-IMU extrinsic, 시스템에 따라 포함
covariance, filter 계열에서 중요
```

처음에는 이렇게 이해하면 됩니다.

| State | 의미 |
|---|---|
| $R, p$ | 현재 로봇 pose |
| $v$ | 현재 속도 |
| $b_g$ | gyro bias |
| $b_a$ | accelerometer bias |
| $g$ | gravity 방향과 크기 |
| covariance | 현재 state uncertainty |

6주차에서 state propagation 수식을 모두 외우는 것이 목적은 아닙니다.

핵심은 다음 구조입니다.

```text
IMU:
  state를 예측한다.

LiDAR residual:
  예측된 state를 보정한다.
```

## **3. IMU Measurement Model**

IMU에는 크게 두 값이 있습니다.

```text
gyro:
  angular velocity 측정

accelerometer:
  acceleration 측정
```

gyro raw measurement는 다음처럼 생각할 수 있습니다.

$$
\boldsymbol{\omega}_m
=
\boldsymbol{\omega}
+
\mathbf{b}_g
+
\mathbf{n}_g
$$

여기서:

| 항 | 의미 |
|---|---|
| $\boldsymbol{\omega}_m$ | gyro raw angular velocity |
| $\boldsymbol{\omega}$ | 실제 angular velocity |
| $\mathbf{b}_g$ | gyro bias |
| $\mathbf{n}_g$ | gyro noise |

LIO는 실제 각속도를 쓰고 싶습니다.

그래서 bias를 빼서 사용합니다.

$$
\boldsymbol{\omega}
\approx
\boldsymbol{\omega}_m
-
\mathbf{b}_g
$$

코드 흐름은 보통 다음입니다.

```text
raw gyro
-> bias compensation
-> rotation propagation
```

accelerometer도 비슷합니다.

$$
\mathbf{a}_m
=
\mathbf{a}
+
\mathbf{b}_a
+
\mathbf{n}_a
$$

여기서:

| 항 | 의미 |
|---|---|
| $\mathbf{a}_m$ | accelerometer raw measurement |
| $\mathbf{a}$ | 실제 acceleration 관련 값 |
| $\mathbf{b}_a$ | accelerometer bias |
| $\mathbf{n}_a$ | accelerometer noise |

accelerometer는 gyro보다 더 헷갈립니다.

gravity와 frame 변환이 같이 들어가기 때문입니다.

처음에는 이렇게만 잡으면 됩니다.

```text
accelerometer raw
-> accelerometer bias 제거
-> gravity 처리
-> velocity / position propagation
```

## **4. Gravity와 Bias가 왜 중요한가**

IMU accelerometer는 단순히 로봇이 움직이는 가속도만 보는 것이 아닙니다.

로봇이 가만히 있어도 gravity 때문에 값이 나옵니다.

gravity를 제대로 처리하지 못하면, 로봇이 가만히 있는데도 계속 가속한다고 착각할 수 있습니다.

그래서 IMU propagation에서 gravity는 position과 velocity 예측에 직접 들어갑니다.

bias도 중요합니다.

예를 들어 gyro가 실제로는 회전이 없는데도 계속 다음 값을 낸다고 하겠습니다.

```text
gyro bias = 0.01 rad/s
```

이 작은 값도 계속 적분되면 orientation drift가 됩니다.

accelerometer bias는 velocity와 position drift로 이어집니다.

```text
gyro bias
-> orientation drift

accelerometer bias
-> velocity drift
-> position drift
```

그래서 LIO state에는 보통 gyro bias와 accelerometer bias가 들어갑니다.

LiDAR update는 pose뿐만 아니라 bias 추정에도 영향을 줄 수 있습니다.

이 점이 LiDAR와 IMU를 단순히 따로 처리하는 방식과 LIO가 다른 부분입니다.

## **5. IMU Propagation**

IMU propagation은 IMU data를 적분해서 pose를 예측하는 과정입니다.

단순화하면 다음입니다.

```text
gyro를 적분해서 orientation 예측
accelerometer를 적분해서 velocity / position 예측
```

코드 흐름은 보통 다음과 같습니다.

```text
raw IMU
-> gyro bias 제거
-> acc bias 제거
-> gravity 고려
-> dt 간격으로 적분
-> pose / velocity prediction
-> covariance 증가
```

IMU propagation은 6주차에서 특히 중요합니다.

두 곳에 쓰이기 때문입니다.

```text
1. scan의 initial pose 제공
2. scan 내부 deskew trajectory 제공
```

즉 IMU prediction이 틀리면 다음 일이 이어집니다.

```text
initial pose가 틀어짐
deskew trajectory가 틀어짐
LiDAR residual이 증가함
update가 불안정해짐
```

그래서 LIO 코드를 볼 때 IMU sample 경로를 point 경로와 별도로 추적해야 합니다.

## **6. LiDAR Measurement Update**

LiDAR update는 5주차 registration과 연결됩니다.

5주차에서 본 point-to-plane residual은 다음이었습니다.

$$
r_i
=
\mathbf{n}_i^T
\left(
R\mathbf{p}_i
+
\mathbf{t}
-
\mathbf{q}_i
\right)
$$

이 residual이 LIO update에 들어갑니다.

흐름은 다음입니다.

```text
deskew된 point
-> map correspondence 찾기
-> point-to-plane residual 계산
-> residual을 줄이는 방향으로 state update
```

LiDAR update의 목적은 다음입니다.

```text
IMU propagation으로 예측한 pose를
map geometry에 맞게 보정하는 것
```

그래서 6주차 logging에서는 prediction pose와 update pose를 분리해서 봐야 합니다.

```text
pose_before_lidar_update:
  IMU propagation으로 예측한 pose

pose_after_lidar_update:
  LiDAR residual로 보정된 pose

pose_update_norm:
  LiDAR가 IMU prediction을 얼마나 밀었는가
```

## **7. Loosely Coupled와 Tightly Coupled**

LIO 구조를 볼 때 자주 나오는 구분이 있습니다.

```text
loosely coupled
tightly coupled
```

논문마다 용어가 조금 다를 수 있습니다.

그래서 이번 글에서는 구현 기준으로 정리합니다.

```text
LiDAR scan matching 결과 pose가 measurement로 들어가면:
  loosely coupled 쪽

LiDAR point/feature residual이 state update 안에 직접 들어가면:
  tightly coupled 쪽
```

### **Loosely Coupled**

loosely coupled는 LiDAR odometry 결과를 하나의 measurement처럼 사용합니다.

```text
LiDAR scan matching
-> LiDAR odometry pose 추정
-> pose measurement로 IMU filter와 fusion
```

쉽게 말하면 LiDAR가 먼저 pose를 만들고, 그 pose를 IMU 쪽과 나중에 합칩니다.

대표적으로 다음 구조가 여기에 가깝습니다.

```text
LOAM + IMU 보조:
  LiDAR odometry가 중심
  IMU는 deskew, motion prior, initial guess 보조

LeGO-LOAM + IMU:
  LiDAR feature extraction / matching이 중심
  IMU는 point cloud distortion correction이나 orientation prior로 사용

LiDAR odometry pose + EKF fusion:
  LiDAR odometry pose를 measurement z_lidar로 사용
  point residual 자체는 EKF에 직접 들어가지 않음
```

이런 구조의 장점은 모듈이 비교적 분리되어 있다는 점입니다.

코드 추적 포인트도 명확합니다.

```text
LiDAR odometry output pose가 어디서 만들어지는가?
그 pose가 IMU filter 또는 fusion node에 어디서 들어가는가?
```

### **Tightly Coupled**

tightly coupled는 LiDAR residual 또는 factor가 state update에 직접 들어갑니다.

```text
raw point / feature point
-> map correspondence
-> residual
-> pose, velocity, bias state update
```

FAST-LIO와 FAST-LIO2는 filter 기반 tightly coupled 예시로 이해하면 됩니다.

특히 FAST-LIO2는 feature extraction 없이 raw point를 map에 직접 등록하는 방향이라, point-to-map residual 경로를 추적하기 좋습니다.

```text
raw LiDAR point
-> point timestamp
-> deskew
-> map correspondence
-> point-to-map residual
-> iterated Kalman filter update
-> state 보정
-> map insertion
```

LIO-SAM은 factor graph 기반 tightly coupled 예시로 볼 수 있습니다.

구조는 FAST-LIO2와 다릅니다.

```text
FAST-LIO2:
  point-to-map residual이 iterated Kalman filter update에 직접 들어감

LIO-SAM:
  IMU preintegration factor와 LiDAR odometry factor가 graph 안에 들어감
```

정리하면 다음입니다.

| 구분 | Loosely coupled | Tightly coupled |
|---|---|---|
| LiDAR가 만드는 것 | pose measurement | residual 또는 factor |
| IMU 역할 | deskew, initial guess, motion prior, EKF prediction | propagation + state/bias와 함께 update |
| 결합 강도 | 약함 | 강함 |
| 예시 | LOAM+IMU 보조, LeGO-LOAM+IMU, LiDAR odom pose + EKF | FAST-LIO, FAST-LIO2, LIO-SAM |
| 코드 추적 포인트 | LiDAR pose output이 어디서 fusion되는가 | residual/factor가 어디서 state update에 들어가는가 |

내 연구에서는 FAST-LIO2 계열이 특히 보기 좋습니다.

보고 싶은 값들이 내부 경로에 직접 있기 때문입니다.

```text
point timestamp
deskewed point
map correspondence
residual
inlier / effective feature
state update
map insertion
processing time
```

## **8. Filter와 Smoothing / Factor Graph**

또 하나의 구분은 filter와 smoothing입니다.

filter는 현재 state를 순차적으로 업데이트합니다.

```text
current state
+ new IMU
+ new LiDAR scan
-> current state update
```

이전 모든 state를 계속 다시 최적화하지는 않습니다.

장점은 빠르고 online 처리에 적합하다는 점입니다.

smoothing 또는 factor graph는 여러 시점의 state를 그래프로 묶어서 최적화합니다.

```text
pose_0, pose_1, pose_2, ...
IMU factor
LiDAR factor
loop closure factor
```

여러 state를 함께 조정할 수 있으므로, 과거 pose까지 다시 보정할 수 있습니다.

6주차에서 필요한 구분은 이 정도입니다.

```text
filter:
  현재 state 중심으로 빠르게 update

smoothing / factor graph:
  여러 시점의 pose를 묶어서 최적화
```

## **9. Local Map Update와 Loop Closure**

LiDAR update가 끝나면 보정된 pose가 나옵니다.

그다음 deskewed point를 map frame으로 변환해서 local map에 넣습니다.

```text
deskewed point
-> updated pose로 world/map frame 변환
-> local map insertion
```

local map은 다음 scan의 correspondence 검색에 사용됩니다.

즉 map update는 다음 scan residual에 직접 영향을 줍니다.

```text
이번 scan pose가 틀어짐
-> map insertion이 틀어짐
-> 다음 scan correspondence가 틀어짐
-> residual / update가 다시 흔들림
```

그래서 logging할 때는 map insertion 전후도 봐야 합니다.

loop closure는 이미 지나갔던 장소를 다시 인식해서 누적 drift를 고치는 backend 기능입니다.

하지만 6주차에서 보고 싶은 것은 frontend의 scan-level 동작입니다.

그래서 odometry를 재현할 때 loop closure가 있으면 꺼두는 편이 해석이 쉽습니다.

```text
loop closure가 켜져 있으면:
  frontend에서 생긴 drift가 나중에 backend에서 수정됨
  원인 분석이 흐려질 수 있음
```

## **10. Point 하나의 경로**

6주차 첫 번째 추적 대상은 point 하나입니다.

흐름은 다음입니다.

```text
raw point
-> point timestamp
-> deskew
-> map correspondence
-> residual
-> state update
-> map insertion
```

각 단계에서 확인할 값은 다음입니다.

| 단계 | 확인할 것 |
|---|---|
| raw point | `x, y, z`, intensity, timestamp/offset_time, ring/line |
| point timestamp | 절대시간인지 scan-start offset인지, 단위가 무엇인지 |
| deskew | deskew 전 point, deskew 후 point, correction norm, 사용 trajectory |
| correspondence | nearest distance, local plane normal, correspondence 유무 |
| residual | residual value, inlier/outlier, threshold 통과 여부 |
| state update | update 전 pose, update 후 pose, update magnitude |
| map insertion | 삽입 point, voxel filter, map size 변화 |

여기서 중요한 연결은 다음입니다.

```text
2주차:
  point timestamp가 살아 있어야 한다.

3~4주차:
  timestamp와 trajectory로 deskew한다.

5주차:
  deskewed point가 map plane에 얼마나 잘 붙는지 residual로 본다.

6주차:
  이 residual이 state update와 map insertion까지 어떻게 이어지는지 본다.
```

## **11. IMU Sample 하나의 경로**

두 번째 추적 대상은 IMU sample 하나입니다.

흐름은 다음입니다.

```text
raw IMU
-> bias compensation
-> propagation
-> scan pose trajectory
-> deskew / initial pose
-> LiDAR update
```

각 단계에서 확인할 값은 다음입니다.

| 단계 | 확인할 것 |
|---|---|
| raw IMU | timestamp, gyro, accelerometer, frame convention |
| bias compensation | 현재 $b_g$, 현재 $b_a$, compensation 전후 값 |
| propagation | `dt`, propagation 전 state, propagation 후 state, predicted pose |
| scan pose trajectory | scan start pose, point time pose, scan end pose |
| deskew / initial pose | point별 pose 제공, LiDAR update 초기값 제공 |
| LiDAR update | prediction pose, updated pose, update magnitude |

IMU propagation은 두 가지 역할을 동시에 합니다.

```text
deskew:
  point별 t_i의 pose를 제공한다.

initial pose:
  LiDAR scan-to-map update의 초기값을 제공한다.
```

따라서 IMU propagation이 틀어지면 deskew와 registration이 동시에 영향을 받습니다.

## **12. Logging 추가 위치**

6주차에서 코드를 깊게 고치는 것이 목적은 아닙니다.

필요한 값을 최소한으로 찍어야 합니다.

### **Deskew 전후 Point**

```text
raw_point_x, raw_point_y, raw_point_z
deskewed_point_x, deskewed_point_y, deskewed_point_z
point_time
deskew_correction_norm
```

주의할 점:

```text
deskew correction norm은 deskew error가 아니다.
```

### **Scan Initial Pose**

```text
scan_id
prediction_position
prediction_orientation
```

이 값은 IMU propagation으로 LiDAR update 전에 예측한 scan pose입니다.

### **LiDAR Update 전후 Pose**

```text
pose_before_lidar_update
pose_after_lidar_update
pose_update_translation_norm
pose_update_rotation_deg
```

이 값은 LiDAR residual이 IMU prediction을 얼마나 고쳤는지 보여줍니다.

update가 크면 다음 가능성이 있습니다.

```text
IMU prediction이 불안정했음
deskew trajectory가 틀어졌음
registration residual이 컸음
scan matching이 강하게 pose를 밀었음
```

### **Residual / Inlier**

```text
residual_mean
residual_median
residual_p95
inlier_count
outlier_count
inlier_ratio
```

5주차 metric과 직접 연결됩니다.

### **State Uncertainty 또는 Update Magnitude**

filter 계열에서는 covariance가 state uncertainty를 나타냅니다.

가능하면 다음을 저장합니다.

```text
position covariance
rotation covariance
velocity covariance
bias covariance
```

저장이 어렵다면 최소한 update magnitude를 저장합니다.

```text
pose_update_norm
```

### **Processing Time**

```text
deskew_time_ms
correspondence_time_ms
update_time_ms
map_insertion_time_ms
total_scan_processing_time_ms
```

이 값은 실시간 처리 여유와 병목을 볼 때 필요합니다.

## **13. 저장할 CSV 구조**

처음에는 scan 단위 CSV면 충분합니다.

```text
scan_id
timestamp
point_count
deskew_correction_mean
deskew_correction_p95
residual_mean
residual_median
residual_p95
inlier_count
inlier_ratio
pose_update_translation_norm
pose_update_rotation_deg
processing_time_ms
map_size
registration_failure
```

point 단위 logging은 너무 많을 수 있습니다.

처음에는 다음 중 하나가 낫습니다.

```text
scan당 100개 point sampling
residual 큰 point 상위 100개만 저장
```

이렇게 해야 bag 하나를 돌렸을 때 log가 감당 가능한 크기로 남습니다.

## **14. 코드 추적 키워드와 노트 템플릿**

코드에서 point 경로를 찾을 때 검색할 키워드는 다음입니다.

```text
deskew
undistort
point time
offset_time
timestamp
nearest
kdtree
residual
plane
normal
update
map insert
```

IMU 경로를 찾을 때는 다음을 봅니다.

```text
imu
gyro
acc
bias
gravity
propagate
predict
covariance
undistort
deskew
```

노트는 다음 형식으로 남기면 됩니다.

```text
[Point path]

1. raw point 입력:
   파일/함수:
   확인한 변수:

2. point timestamp:
   파일/함수:
   변수 이름:
   단위:
   scan 시작 기준인지 절대시간인지:

3. deskew:
   파일/함수:
   입력:
   출력:
   사용 trajectory:

4. map correspondence:
   파일/함수:
   nearest search 구조:
   threshold:

5. residual:
   파일/함수:
   residual 식:
   inlier 기준:

6. state update:
   파일/함수:
   update 전 pose:
   update 후 pose:
   update magnitude:

7. map insertion:
   파일/함수:
   voxel/filter:
   map size:
```

IMU는 다음 형식으로 남깁니다.

```text
[IMU path]

1. raw IMU 입력:
   파일/함수:
   timestamp:

2. bias compensation:
   gyro bias 변수:
   acc bias 변수:

3. propagation:
   파일/함수:
   dt:
   updated state:

4. scan pose trajectory:
   생성 위치:
   deskew와 연결되는 위치:

5. LiDAR update:
   prediction pose:
   updated pose:
```

## **15. 7일 공부 순서**

6주차는 구현보다 코드 독해와 logging 설계가 중요합니다.

| Day | 주제 | 해야 할 것 |
|---|---|---|
| 1 | LIO 전체 그림 | IMU input부터 odometry output까지 큰 flow 그리기 |
| 2 | IMU model / propagation | gyro, acc, bias, gravity, propagation 흐름 정리 |
| 3 | LiDAR measurement update | deskewed point, correspondence, residual, state update 연결 |
| 4 | 구조 개념 | loosely/tightly, filter/factor graph, map update, loop closure 구분 |
| 5 | point 경로 찾기 | raw point -> timestamp -> deskew -> residual -> map insertion 위치 찾기 |
| 6 | IMU 경로 찾기 | raw IMU -> bias compensation -> propagation -> deskew trajectory 위치 찾기 |
| 7 | logging 추가 | 짧은 bag 실행, residual/inlier/update magnitude 저장 |

7일차 출력은 다음이면 충분합니다.

```text
lio_trace_log.csv
scan_update_summary.csv
odometry.txt 또는 TUM format trajectory
```

## **16. 6주차 통과 기준**

이번 주가 끝나고 아래를 할 수 있으면 됩니다.

```text
1. LIO에서 IMU propagation이 하는 일을 설명할 수 있다.
2. gyro bias와 accelerometer bias가 왜 필요한지 설명할 수 있다.
3. gravity가 propagation에 왜 들어가는지 설명할 수 있다.
4. LiDAR measurement update가 point-to-map residual로 state를 보정한다는 것을 설명할 수 있다.
5. loosely coupled와 tightly coupled의 차이를 설명할 수 있다.
6. filter와 factor graph의 차이를 설명할 수 있다.
7. local map update가 다음 scan registration에 영향을 준다는 것을 설명할 수 있다.
8. point 하나의 코드 경로를 찾았다.
9. IMU sample 하나의 코드 경로를 찾았다.
10. deskew 함수 위치를 찾았다.
11. map residual 계산 위치를 찾았다.
12. LiDAR update 전후 pose를 logging했다.
13. loop closure 영향을 제거한 odometry 결과를 하나 재현했다.
```

## **17. 추가 실험: FAST-LIO2로 UNIST Bag Trace**

위에서 정리한 logging 위치를 실제 FAST-LIO2 ROS2 코드에 붙여 봤습니다.

사용한 데이터는 4~5주차에서 계속 사용한 UNIST Livox bag입니다.

```text
bag:
  /home/iamjaehka13/unist_rosbag/6_24_204_2_0-001.mcap

LiDAR:
  /livox/lidar
  livox_ros_driver2/msg/CustomMsg

IMU:
  /livox/imu
  sensor_msgs/msg/Imu

replay duration:
  192.36 s full bag

logged update rows:
  1920
```

이번 trace에서 저장한 값은 다음입니다.

```text
scan_count
lidar_beg_time
lidar_end_time
raw_point_count
undistorted_point_count
downsampled_point_count
map_point_count
effective_feature_count
residual_mean_m
residual_p95_m
pose_before_lidar_update
pose_after_lidar_update
pose_update_translation_norm_m
pose_update_rotation_deg
processing_total_ms
```

대표 그림은 scan 단위로 pose update, residual, processing time을 함께 본 것입니다.

![FAST-LIO2 UNIST full-bag scan-level trace overview](/assets/img/posts/slam/study/week-6-lio-data-flow/full_bag_trace_overview.png){: .d-block .mx-auto }

이 그림에서 중요한 점은 `pose update norm`이 LiDAR update가 IMU prediction을 얼마나 보정했는지를 보여준다는 것입니다.

```text
pose_before_lidar_update:
  IMU propagation 이후, LiDAR residual update 직전 state

pose_after_lidar_update:
  point-to-map residual로 iterated Kalman update가 끝난 뒤 state
```

처음에는 20초 smoke run으로 실행 여부만 확인했습니다.

블로그용 시각화는 너무 짧은 구간보다 full bag이 맞기 때문에, 이후 전체 bag을 다시 replay했습니다.

full bag trace의 요약은 다음입니다.

| metric | median | max |
|---|---:|---:|
| pose update translation | 0.003400 m | 0.012996 m |
| pose update rotation | 0.142695 deg | 0.722269 deg |
| residual mean | 0.019931 m | 0.036172 m |
| residual p95 | 0.065171 m | 0.152885 m |
| effective feature count | 601.5 | 1086 |
| processing time | 3.943529 ms | 6.753265 ms |

전체 odometry trace의 span은 다음 정도였습니다.

```text
duration:
  191.90 s logged trace

path length:
  102.09 m

trajectory span:
  x: 14.99 m
  y: 10.85 m
  z: 2.93 m
```

다음 그림은 residual tail과 update magnitude를 직접 비교한 것입니다.

![FAST-LIO2 UNIST full-bag residual update scatter](/assets/img/posts/slam/study/week-6-lio-data-flow/full_bag_update_residual_scatter.png){: .d-block .mx-auto }

이 그림은 residual이 커졌을 때 update도 항상 같이 커진다고 단순하게 말하기 어렵다는 점을 보여줍니다.

즉 residual, effective feature count, map geometry, initial prediction이 같이 작용합니다. 그래서 이후 실험에서는 residual 하나만 보지 말고 pose update norm과 feature count도 같이 봐야 합니다.

마지막으로 FAST-LIO2가 낸 odometry trace를 residual p95 색으로 칠했습니다.

![FAST-LIO2 UNIST full-bag odometry trace colored by residual p95](/assets/img/posts/slam/study/week-6-lio-data-flow/full_bag_odometry_trace.png){: .d-block .mx-auto }

정적 그림만으로는 흐름이 잘 안 보이기 때문에, full bag 기준 animation 후보도 같이 만들었습니다.

GIF로도 뽑았지만 본문에는 용량이 작은 animated WebP를 넣었습니다.

후보 판단은 다음처럼 했습니다.

| animation candidate | 판단 |
|---|---|
| full-bag registered cloud orbit | 제일 보기 좋음. FAST-LIO2가 publish한 registered cloud와 path를 같이 보여줌 |
| full-bag trajectory build-up | full trace 흐름을 가장 안전하게 보여줌 |
| 70-100s local map build | 자동 점수 기준 1등 구간. local scan 누적 흐름을 보기 좋게 보여줌 |
| fixed-map residual orbit | 5주차 evaluator 시각화라 예쁘지만 FAST-LIO2 output은 아님 |
| FAST-LIO2 pipeline loop | 개념 설명용으로 좋지만 실제 3D 결과물은 아님 |

제일 괜찮은 것은 아래 full-bag registered cloud orbit입니다.

이 animation은 `/cloud_registered`와 `/Odometry`를 직접 수집해서 만들었습니다.

즉, FAST-LIO2가 full bag replay 중 publish한 registered cloud와 path를 같이 보여주는 그림입니다.

```text
registered cloud:
  /cloud_registered

path:
  /Odometry

collector output:
  odom: 1920
  cloud snapshots: 960
  sampled cloud points: 937609
```

![FAST-LIO2 full-bag registered cloud orbit animation](/assets/img/posts/slam/study/week-6-lio-data-flow/full_bag_registered_cloud_orbit.webp){: .d-block .mx-auto }

다음은 full bag 전체 trajectory를 시간에 따라 누적한 animation입니다.

이 그림은 path가 시간에 따라 어떻게 쌓이는지 보기 좋습니다. residual p95를 같이 붙였기 때문에, 단순 경로 그림보다 LIO 내부 update trace와 연결해서 볼 수 있습니다.

![FAST-LIO2 full-bag trajectory build-up animation](/assets/img/posts/slam/study/week-6-lio-data-flow/full_bag_trajectory_build_up.webp){: .d-block .mx-auto }

마지막으로, full bag에서 30초 window를 sliding하면서 보기 좋은 구간을 자동으로 골랐습니다.

선정 점수는 path length, x/y/z span, residual p95 range, pose update 크기를 섞어서 계산했습니다.

상위 구간은 다음이었습니다.

| rank | window | path length | span x/y/z | residual p95 range |
|---:|---|---:|---:|---:|
| 1 | 70-100 s | 18.98 m | 9.96 / 9.36 / 1.74 m | 0.0178 m |
| 2 | 110-140 s | 17.97 m | 12.15 / 5.45 / 2.57 m | 0.0160 m |
| 3 | 75-105 s | 18.70 m | 10.82 / 7.74 / 1.67 m | 0.0212 m |

아래는 1등 구간인 70-100초 local map build animation입니다.

![FAST-LIO2 full-bag best 70-100s local map build animation](/assets/img/posts/slam/study/week-6-lio-data-flow/full_bag_segment_070_100_map_build.webp){: .d-block .mx-auto }

이 trajectory 그림은 보기에는 odometry 결과처럼 보이지만, 아직 평가 결과로 쓰면 안 됩니다.

이유는 다음입니다.

```text
LiDAR-IMU extrinsic:
  아직 UNIST bag에 맞게 정확히 calibration한 값이 아님

MCAP replay:
  rosbag2 MCAP plugin이 없어 Python helper로 /livox/lidar, /livox/imu를 publish함

ground truth:
  trajectory ground truth와 비교하지 않음
```

따라서 이번 추가 실험의 안전한 결론은 다음입니다.

```text
FAST-LIO2 ROS2를 UNIST Livox bag으로 실행했고,
scan별 LiDAR update 전후 pose, point-to-map residual,
effective feature count, processing time을 CSV로 기록했다.
```

아직 이렇게 쓰면 안 됩니다.

```text
FAST-LIO2가 이 bag에서 정확한 trajectory를 냈다.
FAST-LIO2가 deskew 문제를 해결했다.
odometry drift가 줄었다.
```

이번 결과의 의미는 성능 검증이 아니라, 6주차 목표였던 LIO 내부 변수 추적을 실제 코드에서 시작했다는 것입니다.

## **18. Claim Boundary**

6주차 글에서 조심할 점은 명확합니다.

이번 주는 특정 LIO 알고리즘의 성능을 검증한 것이 아닙니다.

또 새로운 odometry 결과를 만든 것도 아닙니다.

정확한 표현은 다음입니다.

```text
LIO 내부에서 IMU propagation, deskew, point-to-map residual,
state update, map insertion이 어디에서 연결되는지 추적하는 준비 단계
```

틀린 표현은 다음입니다.

```text
LIO 성능을 개선했다.
FAST-LIO2가 Go2 보행 문제를 해결한다.
deskew가 odometry drift를 줄였다는 것을 검증했다.
```

아직은 그런 claim을 할 단계가 아닙니다.

이번 추가 실험에서는 실제 FAST-LIO2 코드에 logging을 넣고, 같은 bag에서 scan별 residual, pose update, map insertion 관련 값을 뽑았습니다.

다만 아직 calibration sensitivity, time offset sweep, ground-truth trajectory 비교는 하지 않았습니다.

## **19. 이번 주 정리**

6주차를 한 문장으로 정리하면 다음입니다.

> LIO 안에서 IMU가 pose를 예측하고, LiDAR point residual이 그 pose를 보정하며, 보정된 point가 map에 들어가는 전체 경로를 추적하는 주다.

이번 주의 핵심은 알고리즘 이름을 외우는 것이 아닙니다.

코드에서 다음 질문에 답할 수 있어야 합니다.

```text
point timestamp는 어디에서 읽히는가?
deskew는 어디에서 수행되는가?
map correspondence는 어디에서 만들어지는가?
residual은 어디에서 계산되는가?
LiDAR update 전후 pose는 어디에서 바뀌는가?
보정된 point는 언제 map에 들어가는가?
```

이 질문에 답할 수 있어야 7주차부터 실제 LIO logging과 실험으로 넘어갈 수 있습니다.

내 연구 관점에서는 이 연결이 중요합니다.

```text
보행으로 생긴 LiDAR motion
-> deskew correction / deskew error
-> point-to-map residual 변화
-> state update magnitude 변화
-> map insertion 품질 변화
-> odometry drift 또는 map blur
```

6주차는 이 경로를 실제 LIO 내부 변수로 확인하기 위한 준비 단계입니다.
