---
title: "[SLAM Study 2주차] LiDAR Timestamp와 측정 시간"
date: 2026-06-29 11:20:00 +0900
published: false
last_modified_at: 2026-06-30 20:18:21 +0900
categories: [SLAM, Study]
tags: [slam, lidar-slam, lidar, timestamp, pointcloud2, imu, deskew, ros2, robotics]
description: SLAM 공부 2주차에 LiDAR scan, packet, point별 timestamp, ring/channel, point ordering, LiDAR-IMU clock, jitter, packet loss, lidar_time_auditor 구현 흐름과 실제 rosbag audit 결과를 정리한다.
math: true
---

## **0. 이번 주에 잡아야 하는 것**

1주차에는 frame과 SE(3)를 공부했습니다. 핵심은 LiDAR pose를 다음처럼 계산하는 것이었습니다.

$$
{}^W T_L = {}^W T_B {}^B T_L
$$

2주차는 그 다음 단계입니다.

> 이 point는 정확히 언제 측정됐는가?

LiDAR SLAM에서 point cloud 하나를 한 순간의 사진처럼 보면 안 됩니다. LiDAR scan 하나는 일정 시간 동안 순차적으로 측정된 point들의 묶음입니다.

예를 들어 10 Hz LiDAR라면 scan 하나는 약 0.1초 동안 만들어집니다.

```text
scan start: 0.000 s
scan end:   0.100 s
```

이 0.1초 동안 로봇이 움직이면 scan 초반 point와 scan 후반 point는 서로 다른 LiDAR pose에서 측정됩니다. 그래서 point별 timestamp를 모르면 deskew도 정확히 할 수 없습니다.

이번 주 목표는 SLAM 알고리즘을 돌리는 것이 아니라, LiDAR measurement time을 감사하는 도구를 만드는 것입니다.

```text
PointCloud2
-> point time 확인
-> scan start/end 계산
-> IMU coverage 확인
-> jitter / packet loss / latency 의심 신호 확인
-> lidar_time_auditor 결과 저장
```

## **1. Scan은 순간 사진이 아니다**

LiDAR scan은 보통 한 주기 동안 모은 point들의 묶음입니다.

10 Hz LiDAR라면,

```text
1초에 10 scan
scan 하나의 길이 약 0.1초
```

입니다.

중요한 점은 다음입니다.

> PointCloud2 하나 안의 point들이 모두 같은 시간에 찍힌 것이 아니다.

예를 들어 같은 cloud 안에서도 point별 측정 시각은 다를 수 있습니다.

```text
point A: scan 시작 근처에서 측정
point B: scan 중간에서 측정
point C: scan 끝 근처에서 측정
```

로봇이 정지해 있으면 이 차이가 크게 문제 되지 않을 수 있습니다. LiDAR pose가 scan 동안 거의 변하지 않기 때문입니다.

하지만 Go2 같은 legged robot은 걷는 동안 base가 계속 흔들립니다. LiDAR가 base 위에 올라가 있으므로 scan 동안 LiDAR pose도 변합니다.

```text
t = 0 ms     LiDAR pose = T0
t = 50 ms    LiDAR pose = T1
t = 100 ms   LiDAR pose = T2
```

이걸 모두 같은 pose에서 찍힌 것처럼 처리하면 cloud가 휘어집니다. 이 motion distortion을 펴는 과정이 deskew입니다.

## **2. Packet과 PointCloud2**

LiDAR는 point를 한 번에 전부 보내지 않습니다. 센서 내부에서 측정한 데이터를 작은 묶음으로 나눠 보냅니다. 이 묶음을 packet이라고 보면 됩니다.

```text
LiDAR 측정
-> packet 1
-> packet 2
-> packet 3
-> ...
-> driver가 packet들을 모음
-> sensor_msgs/PointCloud2 publish
```

즉 packet 여러 개가 모여 PointCloud2 하나가 됩니다.

```text
raw packets
   ↓
driver
   ↓
sensor_msgs/PointCloud2
```

여기서 중요한 차이가 있습니다.

| 항목 | 의미 |
|---|---|
| `cloud.header.stamp` | PointCloud2 메시지 하나의 대표 timestamp |
| point별 `time` field | 각 point가 실제로 측정된 시각 또는 상대 시각 |

PointCloud2 header에는 timestamp가 하나만 있습니다. 하지만 cloud 안의 point들은 서로 다른 시간에 측정됐습니다.

그래서 2주차에서 가장 먼저 확인해야 하는 것은 다음입니다.

1. point별 time field가 있는가?
2. 그 time field는 절대시간인가, 상대시간인가?
3. 단위는 second, millisecond, microsecond, nanosecond 중 무엇인가?
4. `header.stamp`는 scan 시작, 중간, 끝, publish time 중 무엇인가?

## **3. Header Timestamp는 항상 Scan Start가 아니다**

ROS `sensor_msgs/PointCloud2`에는 보통 다음 header가 있습니다.

```text
cloud.header.stamp
cloud.header.frame_id
```

`header.stamp`는 cloud의 대표 timestamp입니다. 하지만 이 값이 항상 scan 시작 시각이라는 보장은 없습니다.

가능한 의미는 여러 가지입니다.

| 가능성 | 의미 |
|---|---|
| scan start | scan 시작 시각 |
| scan middle | scan 중간 시각 |
| scan end | scan 끝 시각 |
| ROS receive time | PC 또는 ROS node가 message를 받은 시각 |
| converted sensor time | driver가 sensor clock을 ROS time으로 변환한 값 |

예를 들어 scan duration이 0.1초이고 실제 scan 구간이 다음과 같다고 하겠습니다.

```text
scan_start = 10.000
scan_mid   = 10.050
scan_end   = 10.100
```

`header.stamp`가 scan start라면 point 상대시간을 바로 더할 수 있습니다.

```text
header_stamp = 10.000
point_relative_time = 0.025
point_abs_time = 10.025
```

반대로 `header.stamp`가 scan end라면 scan start를 먼저 복원해야 할 수 있습니다.

```text
scan_start = header_stamp - scan_duration
point_abs_time = scan_start + point_relative_time
```

즉 header 기준이 무엇인지 모르면 point의 절대 측정 시간이 틀어집니다.

## **4. Point Time 단위 확인**

point time field가 있어도 단위를 반드시 확인해야 합니다.

가능한 단위는 다음과 같습니다.

```text
seconds
milliseconds
microseconds
nanoseconds
```

예를 들어 scan duration이 0.1초 정도인 LiDAR에서 point time 최대값이 다음과 같다면,

```text
max point time = 0.099
```

초 단위일 가능성이 큽니다.

반대로,

```text
max point time = 99000
```

이면 microsecond일 수 있고,

```text
max point time = 99000000
```

이면 nanosecond일 수 있습니다.

단위를 잘못 해석하면 scan duration이 말도 안 되게 커지거나 작아집니다. 그러면 IMU margin, deskew, latency 판단이 모두 깨집니다.

```text
정상 scan duration: 0.1 s
잘못 해석한 duration: 100000 s
```

이런 상태에서는 어떤 SLAM 결과도 믿기 어렵습니다.

## **5. Ring, Channel, Point Ordering**

multi-channel LiDAR는 여러 개의 laser channel을 가집니다.

예를 들어 16채널 LiDAR라면 대략 다음처럼 생각할 수 있습니다.

```text
ring 0
ring 1
ring 2
...
ring 15
```

mechanical spinning LiDAR에서 `ring`은 보통 몇 번째 수직 laser layer인지 나타냅니다.

SLAM 시스템 중에는 point cloud를 range image처럼 정리할 때 ring 정보를 쓰는 경우가 있습니다.

```text
row    = ring
column = horizontal angle 또는 time order
```

그래서 일부 LIO 시스템은 point별 time뿐 아니라 ring 정보도 요구합니다.

센서나 driver에 따라 이름은 다를 수 있습니다.

```text
ring
channel
line
laser_id
scan_id
```

2주차에는 실제 PointCloud2 field list를 확인해야 합니다.

```text
x
y
z
intensity
time
ring
```

또는 센서에 따라 다음처럼 나올 수도 있습니다.

```text
x
y
z
intensity
timestamp
line
tag
```

## **6. Point Ordering을 시간순으로 믿으면 안 된다**

point ordering은 PointCloud2 안에서 point들이 저장된 배열 순서입니다.

```text
points[0]
points[1]
points[2]
...
```

여기서 가장 중요한 점은 다음입니다.

> `points[i]`가 `points[i+1]`보다 먼저 측정됐다고 보장되지 않는다.

가능한 ordering은 여러 가지입니다.

| Ordering | 의미 |
|---|---|
| time-major | 측정 시간순 |
| ring-major | ring별로 정렬 |
| azimuth-major | 수평각 기준 정렬 |
| packet receive order | packet 수신순 |
| driver internal order | driver 내부 buffer 처리 순서 |

시간순이라면 point time은 대체로 증가합니다.

```text
index: 0     1     2     3     4
time:  0.00  0.01  0.02  0.03  0.04
```

하지만 ring별 정렬이면 전체 배열 기준으로 time이 감소할 수 있습니다.

```text
index: 0     1     2     3     4     5
ring:  0     0     0     1     1     1
time:  0.00  0.10  0.20  0.01  0.11  0.21
```

여기서 index 2에서 3으로 갈 때 time이 줄어듭니다.

```text
0.01 < 0.20
```

이것은 꼭 센서 오류라는 뜻은 아닙니다. driver가 ring별로 재정렬했을 수 있습니다.

그래서 `timestamp_monotonicity` 검사는 이렇게 해석해야 합니다.

| 결과 | 해석 |
|---|---|
| monotonic true | point 배열이 시간순일 가능성이 높음 |
| monotonic false | point 배열이 시간순이 아닐 수 있음 |

중요한 결론은 이것입니다.

> deskew에서 point index를 시간으로 쓰면 위험하다. point별 time field를 직접 써야 한다.

나쁜 방식은 다음과 같습니다.

```python
for i, point in enumerate(points):
    t = scan_period * i / len(points)
    deskew(point, t)
```

좋은 방식은 다음입니다.

```python
for point in points:
    t = point.time
    pose = interpolate_imu_or_odom(t)
    deskew(point, pose)
```

point별 time field가 정확하다면 배열 순서가 시간순이 아니어도 괜찮습니다. 각 point의 실제 time을 직접 쓰면 됩니다.

## **7. 왜 Deskew가 필요한가**

deskew는 움직이면서 찍은 LiDAR scan을, 마치 한 순간에 찍은 scan처럼 펴주는 과정입니다.

LiDAR scan 하나는 여러 시간에 걸쳐 만들어집니다.

```text
scan 시작 point -> t = 0 ms
scan 중간 point -> t = 50 ms
scan 끝 point   -> t = 100 ms
```

로봇이 scan 동안 움직이면 각 point가 측정된 시각의 LiDAR pose가 다릅니다.

```text
t = 0 ms     LiDAR pose = T0
t = 50 ms    LiDAR pose = T1
t = 100 ms   LiDAR pose = T2
```

deskew는 각 point를 자기 측정 시각의 LiDAR pose에서 기준 시각의 LiDAR pose로 변환합니다.

```text
point_i의 측정 시간 t_i를 안다
-> 그때의 LiDAR pose T(t_i)를 구한다
-> 기준 시각 pose T_ref로 point_i를 변환한다
```

수식으로 쓰면 개념적으로 다음과 같습니다.

$$
{}^{L(t_r)}p_i =
\left({}^W T_{L(t_r)}\right)^{-1}
{}^W T_{L(t_i)}
{}^{L(t_i)}p_i
$$

deskew가 틀리면 cloud 자체가 휘어집니다. 그 결과 scan-to-map matching, camera projection, map sharpness가 모두 영향을 받을 수 있습니다.

```text
time 오류
-> deskew 오류
-> 3D point 위치 오류
-> matching / projection 오류
```

## **8. LiDAR Clock과 IMU Clock**

deskew에는 point time뿐 아니라 그 시각의 motion이 필요합니다. 보통 IMU 또는 odometry를 사용합니다.

문제는 LiDAR timestamp와 IMU timestamp가 같은 시간축에 있지 않을 수 있다는 점입니다.

가능한 경우는 다음과 같습니다.

| Case | 의미 | 위험 |
|---|---|---|
| 둘 다 ROS receive time | 같은 ROS clock일 수 있음 | 실제 측정 시각보다 늦을 수 있음 |
| LiDAR는 sensor clock, IMU는 ROS clock | 서로 직접 비교 불가 | clock 변환 필요 |
| 둘 다 hardware-sync clock | 가장 좋은 경우 | sync 설정 확인 필요 |
| driver가 sensor time을 ROS time으로 변환 | 현실적인 방식 | offset 추정 오류 가능 |
| 숫자는 비슷하지만 offset 존재 | 겉으로 정상처럼 보임 | deskew가 항상 몇 ms 틀어짐 |

핵심 질문은 단순히 단위가 초인지가 아닙니다.

> LiDAR time 10.050초와 IMU time 10.050초가 같은 실제 순간을 의미하는가?

예를 들어 실제로 LiDAR timestamp가 IMU보다 20 ms 늦게 붙는다면, deskew는 항상 20 ms 뒤의 IMU motion을 사용하게 됩니다.

```text
실제 사건 시각:  10.000
LiDAR timestamp: 10.020
IMU timestamp:   10.000
```

Go2처럼 body pitch/roll/yaw가 흔들리는 플랫폼에서는 수 ms offset도 결과에 영향을 줄 수 있습니다.

### **Clock Model로 보면 더 명확하다**

LiDAR timestamp와 IMU timestamp가 모두 초 단위 숫자로 보인다고 해서 같은 clock이라는 뜻은 아닙니다.

센서 time을 ROS time으로 옮기는 과정을 단순화하면 다음처럼 볼 수 있습니다.

$$
t_{\text{ros}}
=
a t_{\text{sensor}}
+
b
+
\epsilon(t)
$$

여기서 각 항의 의미는 다음입니다.

| 항 | 의미 |
|---|---|
| $a$ | clock scale 또는 drift. 이상적이면 1 |
| $b$ | clock offset |
| $\epsilon(t)$ | jitter, driver delay, scheduling noise |

2주차에서 가장 먼저 보는 것은 보통 offset $b$입니다.

하지만 긴 bag이나 hardware sync가 약한 시스템에서는 scale $a$도 문제가 될 수 있습니다.

```text
offset 문제:
  처음부터 끝까지 일정하게 20 ms 밀림

drift 문제:
  bag 초반에는 맞지만 시간이 갈수록 점점 벌어짐

jitter 문제:
  평균은 맞지만 scan마다 흔들림
```

deskew에서는 이 차이를 구분해야 합니다.

offset은 한 번 보정하면 줄일 수 있지만, jitter는 scan마다 남고, drift는 시간 구간별로 달라질 수 있습니다.

### **시간 오차가 공간 오차로 바뀌는 방식**

timestamp error가 왜 위험한지 수식으로 보면 더 직관적입니다.

point time이 $\delta t$만큼 틀렸다고 하겠습니다.

LiDAR가 선속도 $\mathbf{v}$와 각속도 $\boldsymbol{\omega}$로 움직이고 있다면, 1차 근사로 point 위치 오차는 다음처럼 볼 수 있습니다.

$$
\|\delta \mathbf{p}\|
\approx
\|\mathbf{v}\| |\delta t|
+
r \|\boldsymbol{\omega}\| |\delta t|
$$

여기서 $r$은 LiDAR에서 point까지의 거리입니다.

translation에 의한 오차는 속도와 시간 오차에 비례합니다.

rotation에 의한 오차는 여기에 range가 곱해집니다.

예를 들어 point가 10 m 앞에 있고, 각속도가 `100 deg/s`라고 하겠습니다.

```text
100 deg/s ~= 1.745 rad/s
delta_t = 0.005 s
r = 10 m
```

그러면 rotation time error만으로도 대략:

$$
10 \times 1.745 \times 0.005
\approx
0.087\ \mathrm{m}
$$

약 8.7 cm point 위치 오차가 생길 수 있습니다.

그래서 legged robot에서는 "몇 ms 정도는 괜찮겠지"라고 생각하면 위험합니다.

body pitch/roll/yaw가 빠르게 흔들릴수록, 그리고 멀리 있는 구조물을 볼수록 timestamp alignment가 더 중요해집니다.

## **9. IMU가 Scan을 덮는다는 뜻**

LiDAR scan 시간 구간이 다음과 같다고 하겠습니다.

```text
scan_start = minimum_point_time
scan_end   = maximum_point_time
```

deskew를 하려면 IMU data가 이 구간 전체를 덮어야 합니다.

```text
IMU earliest time <= scan_start
IMU latest time   >= scan_end
```

그래야 scan 내부 모든 point 시각에 대해 motion을 추정할 수 있습니다.

이를 margin으로 저장할 수 있습니다.

```text
imu_start_margin = scan_start - min_imu_time_in_buffer
imu_end_margin   = max_imu_time_in_buffer - scan_end
```

좋은 경우는 다음과 같습니다.

```text
LiDAR scan: 10.000 ~ 10.100
IMU buffer: 9.995  ~ 10.105

imu_start_margin = +0.005 s
imu_end_margin   = +0.005 s
```

해석은 다음입니다.

```text
scan 시작 전 5 ms부터 IMU가 있고,
scan 끝 후 5 ms까지 IMU가 있다.
```

반대로 `imu_end_margin`이 음수이면 scan 끝부분 point를 보정할 IMU가 부족합니다.

```text
LiDAR scan: 10.000 ~ 10.100
IMU buffer: 9.995  ~ 10.080

imu_start_margin = +0.005 s
imu_end_margin   = -0.020 s
```

이 경우 scan 끝 20 ms 구간은 IMU coverage가 부족합니다.

margin이 음수라고 해서 항상 IMU 센서가 나쁜 것은 아닙니다. 가능한 원인은 여러 가지입니다.

1. 실제로 IMU data가 부족함
2. IMU callback이 늦게 들어옴
3. LiDAR와 IMU timestamp 기준이 다름
4. clock offset이 있음
5. point time 단위를 잘못 해석함
6. scan start/end 계산이 틀림
7. queue size가 작아서 IMU가 drop됨
8. rosbag playback에서 topic sync가 꼬임

따라서 margin은 원인 확정이 아니라 timestamp/coverage 문제를 드러내는 진단 지표로 봐야 합니다.

### **Interpolation에 필요한 coverage**

IMU가 scan 구간 안에 sample을 가지고 있다는 것만으로 충분하지 않을 때가 많습니다.

point time $t_i$에서 angular velocity나 orientation을 interpolate하려면 보통 $t_i$의 앞뒤 sample이 필요합니다.

```text
imu[k].time <= t_i <= imu[k + 1].time
```

따라서 scan 시작과 끝에서 약간의 여유가 필요합니다.

```text
scan_start보다 조금 앞의 IMU sample
scan_end보다 조금 뒤의 IMU sample
```

이 여유가 없으면 extrapolation을 해야 합니다.

extrapolation은 interpolation보다 위험합니다.

```text
interpolation:
  이미 관측된 두 sample 사이를 채움

extrapolation:
  관측 범위 밖 motion을 예측함
```

짧은 extrapolation은 큰 문제가 아닐 수 있지만, foot impact나 빠른 body rotation이 있는 scan에서는 scan 끝 몇 ms도 무시하기 어렵습니다.

그래서 auditor에서 `imu_start_margin`, `imu_end_margin`을 따로 저장하는 것이 중요합니다.

## **10. Jitter, Packet Loss, Buffering Latency**

2주차에는 timestamp 품질도 봐야 합니다.

### **10.1 Timestamp Jitter**

10 Hz LiDAR라면 header stamp 간격은 대략 0.1초여야 합니다.

정상에 가까운 예시는 다음과 같습니다.

```text
scan 0: 10.000
scan 1: 10.100
scan 2: 10.200
scan 3: 10.300
```

jitter가 있으면 간격이 흔들립니다.

```text
scan 0: 10.000
scan 1: 10.098
scan 2: 10.204
scan 3: 10.301
```

그래서 scan 간격의 평균, 표준편차, min/max를 봐야 합니다.

### **10.2 Point Time Jitter**

scan 내부 point time도 확인해야 합니다.

```python
point_time_diff = time[i + 1] - time[i]
```

확인할 값은 다음입니다.

```text
min diff
max diff
negative diff count
large gap count
```

단, point ordering이 시간순이 아닐 수 있으므로 전체 배열 기준 diff만 보고 오류라고 단정하면 안 됩니다. ring별 또는 packet별 ordering일 수 있습니다.

### **10.3 Packet Loss**

packet loss는 LiDAR packet 일부가 누락되는 것입니다.

관찰 가능한 신호는 다음과 같습니다.

```text
point_count가 갑자기 작아짐
scan_duration이 비정상적으로 짧거나 김
point time 중간에 큰 gap이 생김
ring/channel 일부가 비어 있음
header stamp 간격이 튐
```

처음 구현에서는 단순한 `dropped_packet_flag`부터 만들어도 됩니다.

```text
point_count가 평소 평균보다 크게 낮으면 flag
point time gap이 비정상적으로 크면 flag
scan_duration이 기대값에서 크게 벗어나면 flag
```

### **10.4 Buffering Latency**

buffering latency는 실제 측정 시간과 ROS에서 message를 받은 시간 사이의 지연입니다.

```text
point 실제 측정: 10.000 ~ 10.100
cloud receive:    10.125
```

이 경우 약 25 ms 늦게 message가 도착한 것입니다.

이 자체가 항상 문제는 아닙니다. 하지만 `header.stamp`가 실제 측정 시각이 아니라 ROS receive time이라면 deskew에는 큰 문제가 됩니다.

구분해야 하는 시간은 세 가지입니다.

```text
sensor measurement time
cloud header timestamp
ROS receive time
```

## **11. lidar_time_auditor**

이번 주 구현 과제는 `lidar_time_auditor`입니다.

목표는 각 scan마다 timestamp 관련 정보를 CSV 또는 JSONL로 저장하는 것입니다.

저장할 field는 다음입니다.

| Field | 의미 |
|---|---|
| `scan_id` | scan index |
| `header_timestamp` | PointCloud2 header stamp |
| `minimum_point_time` | scan 내부 point time 최소값 |
| `maximum_point_time` | scan 내부 point time 최대값 |
| `scan_duration` | `maximum_point_time - minimum_point_time` |
| `point_count` | scan 안의 point 수 |
| `timestamp_monotonicity` | point array 기준 time이 증가하는지 |
| `negative_time_jump_count` | point time이 감소한 횟수 |
| `max_point_time_gap` | 인접 point time gap 최대값 |
| `imu_start_margin` | scan 시작 전 IMU coverage |
| `imu_end_margin` | scan 끝 후 IMU coverage |
| `dropped_packet_flag` | packet loss 의심 flag |

최소 구조는 다음과 같습니다.

```python
def audit_scan(scan_id, cloud, imu_times):
    point_times = extract_point_times(cloud)

    header_timestamp = stamp_to_sec(cloud.header.stamp)
    minimum_point_time = float(point_times.min())
    maximum_point_time = float(point_times.max())
    scan_duration = maximum_point_time - minimum_point_time

    diffs = np.diff(point_times)
    timestamp_monotonicity = bool(np.all(diffs >= 0.0))
    negative_time_jump_count = int(np.sum(diffs < 0.0))
    max_point_time_gap = float(np.max(np.abs(diffs))) if len(diffs) else 0.0

    imu_start_margin = minimum_point_time - float(np.min(imu_times))
    imu_end_margin = float(np.max(imu_times)) - maximum_point_time

    dropped_packet_flag = detect_dropped_packet(
        point_count=len(point_times),
        scan_duration=scan_duration,
        max_point_time_gap=max_point_time_gap,
    )

    return {
        "scan_id": scan_id,
        "header_timestamp": header_timestamp,
        "minimum_point_time": minimum_point_time,
        "maximum_point_time": maximum_point_time,
        "scan_duration": scan_duration,
        "point_count": len(point_times),
        "timestamp_monotonicity": timestamp_monotonicity,
        "negative_time_jump_count": negative_time_jump_count,
        "max_point_time_gap": max_point_time_gap,
        "imu_start_margin": imu_start_margin,
        "imu_end_margin": imu_end_margin,
        "dropped_packet_flag": dropped_packet_flag,
    }
```

실제 구현에서는 `extract_point_times()`가 가장 중요합니다. 센서마다 field 이름과 단위가 다르기 때문입니다.

```text
time
timestamp
offset_time
time_offset
t
```

이 이름들을 실제 PointCloud2 field list에서 확인해야 합니다.

## **12. 실험 프로토콜**

2주차 마지막에는 실제 데이터에서 point time과 IMU time이 정상인지 봐야 합니다.

실험은 복잡하게 시작하지 말고 네 가지면 충분합니다.

| 실험 | 목적 |
|---|---|
| robot static | timestamp 자체가 안정적인지 확인 |
| constant yaw rotation | 회전 중 scan duration, IMU coverage 확인 |
| slow straight motion | 직진 중 time/margin 안정성 확인 |
| fast body oscillation | vibration 상황에서 deskew 필요성 확인 |

각 실험에서 확인할 질문은 다음입니다.

1. raw point cloud에 point별 time이 존재하는가?
2. point time 단위는 무엇인가?
3. `header.stamp`는 scan 시작, 중간, 끝, receive time 중 무엇인가?
4. point array는 시간순인가?
5. time이 non-monotonic이면 ring별로는 monotonic한가?
6. LiDAR time과 IMU time이 같은 시간축인가?
7. IMU가 scan 시작부터 끝까지 덮는가?
8. packet loss 또는 큰 point time gap이 보이는가?
9. buffering latency가 일정한가?
10. raw cloud와 deskewed cloud가 둘 다 있다면 이미 driver가 deskew를 수행하는가?

## **13. 실제 rosbag audit 결과**

위 프로토콜을 실제 Unitree LiDAR rosbag에 적용해 봤습니다.

대상 topic은 다음처럼 잡았습니다.

```text
cloud_topic: /utlidar/cloud
imu_topic:   /utlidar/imu
point fields: x, y, z, intensity, ring, time
point time field: time
```

즉 이 데이터의 `PointCloud2`에는 point별 `time` field가 존재했습니다. 따라서 scan 내부의 최소/최대 point time으로 scan 측정 구간을 직접 계산할 수 있습니다.

이번에 확인한 bag은 두 개입니다.

| Bag | 구간 | Scan 수 | point 수 median | scan duration median | header interval median |
|---|---|---:|---:|---:|---:|
| `22_04_22_0.db3` | stand-like | 10550 | 1422 | 0.063838 s | 0.066969 s |
| `22_04_22_0.db3` | walk-like | 3897 | 1416 | 0.064105 s | 0.066975 s |
| `22_33_07_0.db3` | walk-like | 14015 | 1331 | 0.063841 s | 0.066986 s |

여기서 먼저 볼 점은 scan duration입니다. 이 rosbag에서는 한 scan이 약 `0.064 s` 동안 측정됐고, cloud header 간격은 약 `0.067 s`였습니다.

```text
scan duration ~= 64 ms
cloud interval ~= 67 ms
```

따라서 이 데이터는 10 Hz의 100 ms scan이라고 가정하면 안 됩니다. 실제 point time field에서 scan 길이를 직접 읽어야 합니다.

IMU coverage와 timestamp 품질은 다음처럼 나왔습니다.

| Bag | 구간 | monotonic ratio | dropped flag ratio | IMU start max | IMU end max | IMU samples median | max point time gap |
|---|---|---:|---:|---:|---:|---:|---:|
| `22_04_22_0.db3` | stand-like | 0.997 | 0.000095 | 0.007678 s | 0.005375 s | 16 | 0.010375 s |
| `22_04_22_0.db3` | walk-like | 0.997 | 0.000257 | 0.007144 s | 0.007091 s | 16 | 0.030729 s |
| `22_33_07_0.db3` | walk-like | 0.998 | 0.006208 | 0.007735 s | 0.005477 s | 16 | 0.031112 s |

이 결과에서 중요한 해석은 네 가지입니다.

첫째, point time은 거의 monotonic하지만 완전히 monotonic하지는 않았습니다.

```text
monotonic ratio ~= 0.997 ~ 0.998
```

그래서 point array index를 그대로 시간순이라고 믿으면 안 됩니다. deskew 구현에서는 point별 `time` 값을 기준으로 처리하거나, 최소한 ring/channel별 ordering을 따로 확인해야 합니다.

둘째, IMU는 scan 구간을 대체로 잘 덮고 있었습니다. scan마다 scan 내부 IMU sample median은 16개였고, scan 시작/끝에서 가장 가까운 IMU까지의 최대 margin도 약 5-8 ms 수준이었습니다.

```text
IMU samples in scan median ~= 16
IMU start/end max margin ~= 5-8 ms
```

이 정도면 deskew 단계에서 IMU interpolation을 시도할 수 있는 데이터 조건은 갖춰져 있다고 볼 수 있습니다. 다만 실제 deskew에서는 scan start보다 앞의 IMU와 scan end보다 뒤의 IMU가 모두 필요하므로, bag 시작과 끝부분은 별도로 잘라내는 편이 안전합니다.

셋째, walking 구간에서는 stand-like 구간보다 `max_point_time_gap`이 더 크게 관찰됐습니다.

```text
stand-like max point time gap: about 10 ms
walk-like max point time gap: about 31 ms
```

이 값은 point stream 내부에 시간 간격이 크게 벌어진 scan이 있다는 뜻입니다. 이것이 실제 packet loss인지, driver buffering인지, ring/channel ordering의 영향인지는 이 결과만으로 단정하면 안 됩니다.

넷째, `dropped_packet_flag`는 보수적인 study flag입니다.

```text
dropped_packet_flag == suspicious scan
dropped_packet_flag != packet loss proof
```

라고 해석하면 안 됩니다. 여기서는 point 수, scan duration, point time gap이 평소보다 이상한 scan을 표시한 것입니다. 특히 두 번째 walk-like bag에서는 flag ratio가 약 `0.62%`로 더 높았으므로, 해당 scan들을 따로 열어서 point count, ring 분포, time gap 위치를 확인해야 합니다.

이번 audit 결과를 2주차 관점에서 정리하면 다음입니다.

```text
1. /utlidar/cloud에는 point별 time field가 있다.
2. 실제 scan duration은 약 64 ms였다.
3. header interval은 약 67 ms였다.
4. point ordering은 거의 시간순이지만 완전히 믿을 수 없다.
5. IMU coverage는 deskew 실험을 시작할 수 있을 정도로 확보됐다.
6. walking 구간에는 더 큰 point time gap이 보인다.
7. dropped_packet_flag는 의심 신호이지 packet loss 확정 증거가 아니다.
```

따라서 다음 단계는 단순히 deskew를 적용하는 것이 아니라, flagged scan을 먼저 시각화하고 ring별 point time 분포를 확인하는 것입니다. 그래야 deskew가 실제 motion distortion을 줄이는지, 아니면 timestamp/order 문제를 더 크게 만드는지 분리해서 볼 수 있습니다.

## **14. 이번 주 정리**

2주차를 한 문장으로 정리하면 다음입니다.

> LiDAR point cloud는 한 순간의 사진이 아니라 시간 구간이고, deskew를 하려면 각 point의 실제 측정 시간을 알아야 한다.

이번 주에 이해한 흐름은 다음입니다.

```text
scan은 시간 구간이다
-> packet들이 모여 PointCloud2가 된다
-> header.stamp는 대표 timestamp일 뿐이다
-> point별 time field를 확인해야 한다
-> point ordering을 시간순으로 믿으면 안 된다
-> LiDAR clock과 IMU clock이 같은 시간축인지 확인해야 한다
-> IMU가 scan 전체를 덮는지 margin으로 확인한다
-> jitter, packet loss, buffering latency를 감사한다
-> lidar_time_auditor로 scan별 진단값을 저장한다
```

이 단계가 끝나야 3~4주차의 deskew를 안전하게 공부할 수 있습니다.

특히 legged robot에서는 LiDAR가 몸체 위에 있고, 보행 중 body motion이 계속 발생합니다. 따라서 point time이 틀리면 deskew가 틀리고, deskew가 틀리면 scan matching residual, map sharpness, odometry drift까지 영향을 받을 수 있습니다.

2주차의 결론은 단순합니다.

```text
point index를 시간으로 믿지 말고,
point.time과 IMU coverage를 직접 검증하자.
```
