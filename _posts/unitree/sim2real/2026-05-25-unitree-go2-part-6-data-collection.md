---
title: "[Unitree Go2 part 6] 논문을 위한 데이터 따기"
date: 2026-05-25 00:45:00 +0900
categories: [Unitree, Sim2Real]
tags: [unitree-go2, sim2real, reinforcement-learning, data-collection, baseline, hyperparameter-tuning, lowstate]
description: Unitree Go2 논문 실험을 위해 baseline 보행 policy 데이터를 수집하고, 하이퍼파라미터 튜닝을 위한 기준 지표를 정리한다.
image: /assets/img/posts/unitree/sim2real/unitree-go2-part-6-data-collection/data-collection-terminal.jpg
math: true
---

## **1. 다시 프로젝트 목표로 돌아가기**

Part 1에서 설명했던 것처럼, 이 프로젝트는 Unitree Go2를 구매한 뒤 실제 로봇에서 강화학습 기반 보행 policy를 deploy해보는 것을 목표로 시작했습니다.

장기적인 목표는 Go2의 `/lowstate`에서 제공되는 모터 온도, torque, joint state 정보를 활용해, **보행 중 특정 모터에 부담이 몰리지 않도록 스스로 상태를 관리하는 강화학습 모델**을 만드는 것입니다.

이전 글까지는 기본 보행 policy를 학습하고 실제 로봇에 올려보는 과정에 집중했습니다. Part 5에서는 Domain Randomization과 deploy 정합성을 맞춘 뒤, 실제 Go2가 안정적으로 걷는 것까지 확인했습니다.

이번 글은 그 다음 단계입니다. 이제부터는 "걸었다"에서 끝나는 것이 아니라, 논문에 넣을 수 있는 형태로 baseline 데이터를 모으고 있습니다.

## **2. 지금 하는 일: baseline 데이터 수집**

현재 목표는 논문의 baseline으로 사용할 데이터를 확보하는 것입니다.

아직 최종 모델을 주장하는 단계는 아닙니다. 먼저 기본 보행 policy가 실제 로봇에서 어떤 상태 분포를 만들고, 어떤 joint와 motor에 부담을 주는지 확인해야 합니다. 그래야 이후 하이퍼파라미터를 바꿨을 때 좋아진 것인지, 단순히 보기만 좋아진 것인지 비교할 수 있습니다.

현재 데이터 수집의 목적은 다음과 같습니다.

1. 기본 보행 policy의 real robot baseline 만들기
2. command에 따른 joint state, torque, motor temperature 변화 기록하기
3. 특정 다리나 특정 motor에 부담이 몰리는지 확인하기
4. 이후 reward weight, Domain Randomization range, PD gain을 튜닝할 때 비교 기준 만들기
5. 논문 실험에서 사용할 정량 지표를 정리하기

강화학습 policy는 영상만 보면 좋아 보일 수 있습니다. 하지만 논문에서는 영상보다 데이터가 중요합니다. 같은 보행이라도 torque가 과하게 튀거나, 특정 motor temperature가 계속 상승하거나, command tracking이 불안정하면 좋은 policy라고 말하기 어렵습니다.

## **3. 수집하려는 데이터**

이번 단계에서 가장 중요하게 보는 값은 `/lowstate`에서 나오는 real robot 상태입니다.

주요 수집 대상은 다음과 같습니다.

```text
joint position
joint velocity
estimated torque
motor temperature
imu
command
policy action
target joint position
timestamp
```

나중에는 이 값들을 이용해 다음 지표를 만들 계획입니다.

| 지표 | 의미 |
| --- | --- |
| command tracking error | 입력한 속도 command를 얼마나 잘 따라가는지 |
| joint tracking error | policy target과 실제 joint position 차이 |
| torque peak / RMS | 순간적인 부담과 평균 부담 |
| motor temperature trend | 특정 motor가 계속 뜨거워지는지 |
| left/right leg balance | 좌우 다리에 부담이 치우치는지 |
| rollout stability | 일정 시간 이상 넘어지지 않고 유지되는지 |

최종적으로 하고 싶은 것은 단순히 Go2를 걷게 만드는 것이 아닙니다. 로봇이 걷는 동안 자기 상태를 보고, 특정 motor에 부담이 몰리지 않도록 더 안전한 action을 선택하게 만드는 것입니다.

그러려면 먼저 현재 baseline이 어떤 부담 분포를 만드는지 알아야 합니다.

## **4. 실험 환경**

이번 데이터는 실내가 아니라 실제 노면에서 수집했습니다. Simulation이나 MuJoCo에서 보이는 motion만으로는 real contact, 노면 마찰, cable drag, sensor noise를 충분히 보기 어렵기 때문입니다.

![야외 데이터 수집 준비](/assets/img/posts/unitree/sim2real/unitree-go2-part-6-data-collection/outdoor-test-setup.jpg)

실험은 노트북에서 deploy script를 실행하고, keyboard teleop으로 command를 주는 방식으로 진행했습니다.

![데이터 수집용 deploy 실행](/assets/img/posts/unitree/sim2real/unitree-go2-part-6-data-collection/data-collection-terminal.jpg)

대략적인 실행 흐름은 다음과 같습니다.

```bash
conda activate unitree
unset CYCLONEDDS_URI
unset CYCLONEDDS_URI_OVERRIDE

python sim_to_real.py \
  --policy policies/seed1_model_10000.pt \
  --teleop keyboard
```

실험 중에는 로봇을 완전히 자유롭게 두지 않고, 케이블과 사람이 가까이 있는 상태에서 진행했습니다. 아직 논문용 데이터를 정리하는 초기 단계라, 과격한 command보다 안정적인 baseline rollout을 먼저 확보하는 쪽에 집중했습니다.

## **5. 첫 번째 baseline rollout**

아래는 현재 baseline policy를 실제 Go2에 올려 야외 노면에서 굴린 모습입니다.

[![](/assets/img/posts/unitree/sim2real/unitree-go2-part-6-data-collection/baseline-rollout.gif)](/assets/img/posts/unitree/sim2real/unitree-go2-part-6-data-collection/baseline-rollout.gif){: .popup .img-link .shimmer}

아직 논문에 넣을 최종 결과라기보다는, 데이터 수집용 baseline에 가깝습니다. 중요한 것은 "걷는다"가 아니라, 이 rollout에서 어떤 joint trajectory와 torque pattern이 나오는지입니다.

이전 시도에서는 command를 줘도 base만 기울거나, 발을 제대로 떼지 못하거나, 특정 다리에 torque가 몰리는 문제가 있었습니다. 지금은 최소한 baseline으로 삼을 수 있을 정도의 보행은 만들어졌기 때문에, 여기서부터 하이퍼파라미터 튜닝을 시작할 수 있습니다.

## **6. Teleop 중 데이터 확인**

데이터를 모을 때는 policy가 출력한 action뿐 아니라, 실제 robot state가 함께 저장되는지 확인해야 합니다.

[![](/assets/img/posts/unitree/sim2real/unitree-go2-part-6-data-collection/teleop-data-check.gif)](/assets/img/posts/unitree/sim2real/unitree-go2-part-6-data-collection/teleop-data-check.gif){: .popup .img-link .shimmer .d-block .mx-auto style="max-width: 420px;"}

특히 조심해야 하는 부분은 timestamp와 control frequency입니다. Policy는 일정한 주기로 action을 내보내고, robot은 `/lowstate`를 통해 현재 상태를 보내줍니다. 이 둘이 어긋나면 나중에 torque나 temperature를 action과 연결해서 해석하기 어려워집니다.

그래서 지금은 다음을 확인하고 있습니다.

1. `/lowstate` timestamp가 안정적으로 들어오는지
2. policy action과 target joint position이 같은 step 기준으로 저장되는지
3. command 변화 시점이 log에 남는지
4. episode 시작과 종료가 명확히 구분되는지
5. robot stop 또는 keyboard interrupt 시점이 기록되는지

데이터 수집은 생각보다 지저분합니다. 로봇이 잘 걸었는지보다, 나중에 다시 열어봤을 때 해석 가능한 로그인지가 더 중요합니다.

## **7. 야외 보행 데이터**

아래는 실제로 command를 주며 짧게 걸린 구간입니다.

[![](/assets/img/posts/unitree/sim2real/unitree-go2-part-6-data-collection/outdoor-walk.gif)](/assets/img/posts/unitree/sim2real/unitree-go2-part-6-data-collection/outdoor-walk.gif){: .popup .img-link .shimmer .d-block .mx-auto style="max-width: 420px;"}

이런 짧은 rollout을 여러 번 모아서 baseline distribution을 만들 예정입니다.

현재는 긴 시간 하나를 무리해서 찍기보다, 짧은 episode를 여러 개 모으는 쪽이 더 안전하다고 보고 있습니다. 실패하거나 멈춘 구간도 버리지 않고 따로 표시해두면, 이후 policy가 어떤 상황에서 불안정해지는지 분석할 수 있습니다.

## **8. 하이퍼파라미터 튜닝 방향**

이제부터 튜닝할 후보는 크게 네 가지입니다.

1. **Reward weight**
   - tracking reward
   - torque penalty
   - action smoothness
   - joint acceleration penalty
   - feet slip / feet air time 관련 항

2. **Domain Randomization**
   - friction range
   - motor strength range
   - action delay
   - sensor noise
   - base mass / center of mass variation

3. **PD gain**
   - deploy에서 사용할 Kp, Kd
   - simulation actuator model과 실제 tracking 차이

4. **Command curriculum**
   - 낮은 속도 command에서 안정적인지
   - yaw command를 섞었을 때 자세가 무너지지 않는지
   - 후진, 좌우 command까지 확장 가능한지

이 값들을 바꾸기 전에 baseline 데이터를 먼저 잡아야 합니다. 그래야 다음 모델이 좋아졌는지 판단할 수 있습니다.

예를 들어 reward를 바꾼 뒤 영상에서 gait가 더 자연스러워 보여도, torque RMS가 커지고 motor temperature가 빠르게 올라간다면 논문 목표와는 맞지 않을 수 있습니다.

## **9. 논문에서 보여주고 싶은 방향**

논문에서 보여주고 싶은 핵심은 다음과 같습니다.

> Go2의 real low-level state를 활용해, 보행 성능만이 아니라 motor 부담까지 고려하는 policy를 만들 수 있는가?

이를 위해 baseline은 반드시 필요합니다.

Baseline policy는 일반적인 velocity tracking을 목표로 합니다. 이후 모델은 여기에 motor state awareness를 추가하는 방향이 될 수 있습니다.

비교는 다음 형태가 될 것 같습니다.

| 모델 | 목표 |
| --- | --- |
| Baseline | command tracking 중심 보행 |
| Torque-aware policy | torque peak/RMS를 줄이는 보행 |
| Temperature-aware policy | 장시간 보행 중 motor temperature 상승을 완화하는 보행 |

아직은 첫 줄, 즉 baseline 데이터를 정리하는 단계입니다. 하지만 이 단계가 정리되어야 이후 실험이 논문 형태로 이어질 수 있습니다.

## **10. 다음 작업**

다음으로 할 일은 다음과 같습니다.

1. baseline rollout을 여러 episode로 수집하기
2. `/lowstate` log를 episode 단위로 정리하기
3. torque, joint state, motor temperature plot 만들기
4. command tracking error 계산하기
5. reward / DR / PD gain을 바꾼 모델과 baseline 비교하기

이번 글은 결과 정리라기보다, 논문 실험으로 넘어가기 위한 데이터 수집 시작 기록입니다.

이제부터는 "걸었다"보다 "어떤 상태로 걸었는가"를 봐야 합니다. 영상은 출발점이고, 진짜 비교는 log에서 시작됩니다.
