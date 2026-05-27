---
title: "[Unitree Go2 part 6] 논문을 위한 데이터 따기"
date: 2026-05-15 00:45:00 +0900
last_modified_at: 2026-05-25 01:36:41 +0900
categories: [Unitree, Sim2Real]
tags: [unitree-go2, sim2real, reinforcement-learning, data-collection, baseline, thermal-aware-control, lowstate]
description: Unitree Go2 논문 실험을 위해 baseline 보행 policy의 reported actuator temperature, 전류, torque, joint state 데이터를 수집하고 thermal-aware regulator 비교 기준을 정리한다.
image: /assets/img/posts/unitree/sim2real/unitree-go2-part-6-data-collection/data-collection-terminal.jpg
math: true
---

## **1. 다시 프로젝트 목표로 돌아가기**

Part 1에서 설명했던 것처럼, 이 프로젝트는 Unitree Go2를 구매한 뒤 실제 로봇에서 강화학습 기반 보행 policy를 deploy해보는 것을 목표로 시작했습니다.

하지만 지금 논문에서 주장하고 싶은 것은 단순히 "로봇개가 걷는다"가 아닙니다.

> 실로봇 장시간 보행에서는 nominal RL baseline이 command tracking은 잘해도, 특정 actuator에 열이 불균일하게 쌓여 thermal bottleneck이 생길 수 있다. 따라서 per-actuator reported temperature와 current/load 정보를 보는 runtime regulator가 필요하고, 이를 사용하면 비슷한 walking task를 유지하면서 peak reported temperature와 temperature rise를 줄이고 더 오래 안전하게 걸을 수 있다.

여기서 temperature는 실제 winding temperature를 직접 측정한 값이라고 단정하지 않고, **onboard reported actuator temperature**로 표현하는 편이 안전합니다. 핵심은 평균 온도나 배터리 전류만 보는 것이 아니라, 어느 actuator가 hotspot으로 보고되는지 보는 것입니다. 한 actuator만 빠르게 뜨거워져도 전체 보행 시간은 그 actuator에 의해 제한될 수 있습니다.

이전 글까지는 기본 보행 policy를 학습하고 실제 로봇에 올려보는 과정에 집중했습니다. Part 5에서는 Domain Randomization과 deploy 정합성을 맞춘 뒤, 실제 Go2가 안정적으로 걷는 것까지 확인했습니다.

이번 글은 그 다음 단계입니다. 이제부터는 "걸었다"에서 끝나는 것이 아니라, baseline policy가 실제 로봇에서 **얼마나 전류를 먹고, 어느 actuator의 reported temperature가 얼마나 빨리 올라가는지**를 논문에 넣을 수 있는 형태로 모으는 단계입니다.

## **2. 지금 하는 일: baseline 데이터 수집**

현재 목표는 논문의 baseline으로 사용할 데이터를 확보하는 것입니다.

아직 proposed controller를 주장하는 단계는 아닙니다. 먼저 nominal walking policy가 실제 로봇에서 어떤 열/전류 기준선을 만드는지 확인해야 합니다. 그래야 이후 thermal-aware regulator를 붙였을 때 좋아진 것인지, 단순히 느리게 걸어서 덜 뜨거워진 것인지 구분할 수 있습니다.

현재 데이터 수집의 목적은 다음과 같습니다.

1. nominal baseline policy의 real robot reported thermal/current 기준선 만들기
2. 같은 command profile에서 12 actuator reported temperature, battery current, pack voltage, `tau_est`, `dq` 기록하기
3. 평균 온도가 아니라 per-actuator hotspot이 어디서 생기는지 확인하기
4. proposed thermal-aware regulator와 공정하게 비교할 control group 만들기
5. "그냥 느리게 걸어서 덜 뜨거운 것"이라는 반박을 막기 위한 speed-scaled baseline 준비하기

강화학습 policy는 영상만 보면 좋아 보일 수 있습니다. 하지만 논문에서는 영상보다 데이터가 중요합니다. 같은 보행이라도 torque가 과하게 튀거나, 특정 actuator의 reported temperature가 계속 상승하거나, battery current가 높게 유지되면 long-duration deployment 관점에서는 좋은 policy라고 말하기 어렵습니다.

그래서 baseline 데이터는 우리 thermal regulation이 실제로 baseline보다 낫다는 것을 보이기 위한 control group입니다. 온도만 보는 것이 아니라, **비슷한 속도와 거리에서 더 덜 뜨거워졌는가**를 증명하려는 용도입니다.

## **3. 수집하려는 데이터**

이번 단계에서 가장 중요하게 보는 값은 `/lowstate`에서 나오는 real robot 상태입니다. 다만 여기서 구분해야 할 점이 있습니다. `/lowstate` logger가 CSV로 직접 저장하는 값과, 나중에 정확한 분석을 위해 deploy script나 다른 topic에서 추가로 저장해야 하는 값이 다릅니다.

현재 `/lowstate` logger에서 직접 저장하는 값은 다음과 같습니다.

```text
joint position
joint velocity
estimated torque
reported actuator temperature
battery current
pack voltage
pack power
BMS state
fan state
timestamp / tick
```

반면 아래 값들은 `/lowstate` CSV만으로는 자동 저장된다고 보면 안 됩니다. 나중에 action과 thermal response를 정확히 연결하려면 `/cmd_vel`, `/lowcmd`, deploy-side log, 또는 별도 state estimation log를 함께 저장해야 합니다.

```text
command
policy action
target joint position
imu
base pose / velocity
```

특히 `imu`는 LowState message에는 포함되어 있지만, 현재 CSV field에 직접 들어가 있는 값은 아니므로 logger를 확장해야 합니다. `policy action`도 debug print만으로는 분석에 충분하지 않고, step index와 함께 파일로 남겨야 합니다.

나중에는 이 값들을 이용해 다음 지표를 만들 계획입니다. 단, 일부 지표는 `/lowstate`만으로 바로 계산할 수 없습니다.

| 지표 | 필요한 로그 | 의미 |
| --- | --- | --- |
| reported actuator temperature trend | `/lowstate` | 특정 actuator가 계속 뜨겁게 보고되는지 |
| max reported actuator temperature | `/lowstate` | 가장 뜨겁게 보고된 actuator의 절대 온도 |
| hottest actuator temp rise | `/lowstate` | 가장 뜨거운 actuator의 reported temperature 상승량 |
| torque peak / RMS | `/lowstate` | 순간적인 부담과 평균 부담 |
| current / pack power | `/lowstate` | 배터리 전류와 pack power |
| joint tracking error | `/lowstate` + `/lowcmd` 또는 deploy log | target joint position과 실제 joint position 차이 |
| command tracking error | command log + odom/mocap/VO/state topic | 입력 속도 command를 얼마나 잘 따라가는지 |
| distance / energy per meter | position estimate + current/power log | 비슷한 거리에서 에너지와 열 부담 비교 |
| runtime until thermal stop | `/lowstate` + trial metadata | thermal limit 또는 stop 조건 전까지의 보행 시간 |

최종적으로 하고 싶은 것은 단순히 Go2를 걷게 만드는 것이 아닙니다. 로봇이 걷는 동안 자기 상태를 보고, 특정 actuator에 부담이 몰리지 않도록 runtime에서 command scale이나 intervention을 조절하게 만드는 것입니다.

그러려면 먼저 현재 baseline이 어떤 부담 분포를 만드는지 알아야 합니다.

## **4. 실험 환경**

이번 데이터는 실내가 아니라 실제 노면에서 수집했습니다. Simulation이나 MuJoCo에서 보이는 motion만으로는 real contact, 노면 마찰, cable drag, sensor noise를 충분히 보기 어렵기 때문입니다.

![야외 데이터 수집 준비](/assets/img/posts/unitree/sim2real/unitree-go2-part-6-data-collection/outdoor-test-setup.jpg)

실험은 노트북에서 deploy script를 실행하고, keyboard teleop으로 command를 주는 방식으로 진행했습니다.

![데이터 수집용 deploy 실행](/assets/img/posts/unitree/sim2real/unitree-go2-part-6-data-collection/data-collection-terminal.jpg)

대략적인 실행 흐름은 다음과 같습니다.

```bash
conda run -n unitree-rl --no-capture-output python sim_to_real.py enp6s0 \
  --load-run Apr28_23-30-29_deploy_fg010_yawdirect_mirror_actsym020_nobi_seed004 \
  --checkpoint 5000 \
  --stand-phase-lock \
  --teleop keyboard
```

실험 중에는 로봇을 완전히 자유롭게 두지 않고, 케이블과 사람이 가까이 있는 상태에서 진행했습니다. 아직 논문용 데이터를 정리하는 초기 단계라, 과격한 command보다 안정적인 baseline rollout을 먼저 확보하는 쪽에 집중했습니다.

## **5. 첫 번째 baseline rollout**

아래는 현재 baseline policy를 실제 Go2에 올려 야외 노면에서 굴린 모습입니다.

[![](/assets/img/posts/unitree/sim2real/unitree-go2-part-6-data-collection/baseline-rollout.gif)](/assets/img/posts/unitree/sim2real/unitree-go2-part-6-data-collection/baseline-rollout.gif){: .popup .img-link .shimmer}

아직 논문에 넣을 최종 결과라기보다는, 데이터 수집용 baseline에 가깝습니다. 중요한 것은 "걷는다"가 아니라, 이 rollout에서 어떤 joint trajectory, torque pattern, reported actuator temperature trend가 나오는지입니다.

이전 시도에서는 command를 줘도 base만 기울거나, 발을 제대로 떼지 못하거나, 특정 다리에 torque가 몰리는 문제가 있었습니다. 지금은 최소한 baseline으로 삼을 수 있을 정도의 보행은 만들어졌기 때문에, 여기서부터 하이퍼파라미터 튜닝을 시작할 수 있습니다.

## **6. Teleop 중 데이터 확인**

데이터를 모을 때는 policy가 출력한 action뿐 아니라, 실제 robot state가 함께 저장되는지 확인해야 합니다.

[![](/assets/img/posts/unitree/sim2real/unitree-go2-part-6-data-collection/teleop-data-check.gif)](/assets/img/posts/unitree/sim2real/unitree-go2-part-6-data-collection/teleop-data-check.gif){: .popup .img-link .shimmer .d-block .mx-auto style="max-width: 420px;"}

특히 조심해야 하는 부분은 timestamp와 control frequency입니다. Policy는 일정한 주기로 action을 내보내고, robot은 `/lowstate`를 통해 현재 상태를 보내줍니다. 이 둘이 어긋나면 나중에 torque나 reported actuator temperature를 action과 연결해서 해석하기 어려워집니다.

그래서 지금은 다음을 확인하고 있습니다.

1. `/lowstate` timestamp와 tick이 안정적으로 들어오는지
2. q, dq, `tau_est`, reported actuator temperature, battery voltage/current, BMS, fan state가 빠지지 않는지
3. command 변화 시점이 별도 log에 남는지
4. policy action과 target joint position을 deploy-side log 또는 `/lowcmd` bag으로 남길 수 있는지
5. episode 시작, 종료, stop, keyboard interrupt 시점이 trial metadata로 구분되는지

데이터 수집은 생각보다 지저분합니다. 로봇이 잘 걸었는지보다, 나중에 다시 열어봤을 때 해석 가능한 로그인지가 더 중요합니다.

## **7. 야외 보행 데이터**

아래는 실제로 command를 주며 짧게 걸린 구간입니다.

[![](/assets/img/posts/unitree/sim2real/unitree-go2-part-6-data-collection/outdoor-walk.gif)](/assets/img/posts/unitree/sim2real/unitree-go2-part-6-data-collection/outdoor-walk.gif){: .popup .img-link .shimmer .d-block .mx-auto style="max-width: 420px;"}

이런 짧은 rollout은 baseline distribution을 만들기 위한 첫 단계이자, logger format과 deploy 안정성을 확인하는 용도입니다.

현재는 긴 시간 하나를 무리해서 찍기보다, 짧은 episode를 여러 개 모으는 쪽이 더 안전하다고 보고 있습니다. 실패하거나 멈춘 구간도 버리지 않고 따로 표시해두면, 이후 policy가 어떤 상황에서 불안정해지는지 분석할 수 있습니다.

다만 thermal claim을 위해서는 짧은 episode만으로는 부족합니다. Reported actuator temperature의 상승과 하강은 느린 현상이므로, 최종 비교에는 같은 command profile로 진행한 **matched long-duration walking trial**이 필요합니다. 또한 cooling 구간도 motors-off passive cooling이라고 단정하지 않고, 현재 구조에 맞게 **zero-command stand-hold cooling** 또는 **motors-on stand-hold**로 구분해서 기록해야 합니다.

## **8. 비교해야 할 baseline들**

이 논문에서 조심해야 할 반박은 분명합니다.

> 그냥 느리게 걸어서 덜 뜨거워진 것 아닌가?

이 반박을 막으려면 proposed controller만 보여주면 안 됩니다. 최소한 다음 baseline들이 필요합니다.

| 조건 | 역할 |
| --- | --- |
| Nominal baseline | 일반 velocity tracking policy의 열/전류 기준선 |
| Speed-scaled baseline | 단순히 command를 줄였을 때의 thermal tradeoff |
| Current-only monitor | 전류 또는 부하만 보고 조절했을 때의 기준 |
| Proposed thermal-aware regulator | per-actuator reported temperature와 current/load를 함께 보는 방법 |

비교는 같은 command profile, 비슷한 SOC, 비슷한 초기 reported actuator temperature 조건에서 해야 합니다. 그래야 결과가 공정합니다.

특히 speed-scaled baseline은 중요합니다. Proposed가 peak reported temperature를 낮췄더라도 tracking이 크게 무너지거나 이동 거리가 줄어들었다면 좋은 결과라고 보기 어렵습니다. 반대로 단순히 속도를 줄인 baseline보다 비슷한 tracking을 유지하면서 hottest actuator temperature rise를 더 낮춘다면, per-actuator thermal state를 보는 runtime regulator가 실제 정보를 제공했다는 주장이 강해집니다.

## **9. 하이퍼파라미터와 regulator 튜닝 방향**

현재 수집 중인 baseline 데이터는 두 가지 튜닝에 쓰입니다. 다만 여기서도 development data와 final evaluation data를 분리해야 합니다. Baseline log를 보면서 reward, PD gain, regulator threshold를 계속 바꾸면 그 데이터는 개발용 데이터가 됩니다. 논문에 넣을 최종 비교는 baseline과 regulator를 freeze한 뒤, 새로 matched trial을 따는 편이 깔끔합니다.

첫 번째는 기존 locomotion policy 쪽 튜닝입니다.

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

두 번째는 thermal-aware runtime regulator 쪽 튜닝입니다.

1. **Temperature threshold**
   - intervention을 시작할 reported actuator temperature
   - hottest actuator 기준으로 볼지, temperature rise 기준으로 볼지

2. **Current/load score**
   - battery current
   - per-joint `tau_est`
   - $\tau \cdot \dot{q}$ 형태의 mechanical power proxy

3. **Command scaling**
   - 전체 속도 command를 줄이는 방식
   - 특정 gait phase나 방향 command에 더 민감하게 반응하는 방식

4. **Recovery logic**
   - zero-command stand-hold cooling 구간을 어떻게 정의할지
   - reported temperature가 내려가면 원래 command로 얼마나 빠르게 복귀할지

이 값들을 바꾸기 전에 baseline 데이터를 먼저 잡아야 합니다. 그래야 다음 모델이 좋아졌는지 판단할 수 있습니다.

예를 들어 reward를 바꾼 뒤 영상에서 gait가 더 자연스러워 보여도, torque RMS가 커지고 reported actuator temperature가 빠르게 올라간다면 논문 목표와는 맞지 않을 수 있습니다. 반대로 tracking이 조금 손해를 보더라도 hottest actuator의 reported temperature rise를 크게 낮추고 runtime을 늘린다면, long-duration deployment 관점에서는 의미 있는 tradeoff가 될 수 있습니다.

## **10. 논문에서 보여주고 싶은 방향**

논문에서 보여주고 싶은 핵심은 다음 한 문장에 가깝습니다.

> Per-actuator reported temperature and current-derived load provide actionable information for long-duration quadruped deployment, enabling a lightweight runtime regulator to reduce actuator thermal risk while preserving the nominal locomotion task.

한국어로 쓰면 다음과 같습니다.

> 실로봇 보행에서 열 문제는 평균 전류 문제가 아니라 모터별 hotspot 문제이고, 이를 관측해서 runtime에 제어 입력을 조절하면 baseline보다 더 열적으로 안전하게 오래 걸을 수 있다.

이 주장을 위해서는 다음 네 가지를 보여줘야 합니다.

1. Nominal baseline이 장시간 보행 중 특정 actuator hotspot을 만든다.
2. 평균 reported temperature나 전체 전류만 보면 per-actuator hotspot을 놓칠 수 있다.
3. Per-actuator reported temperature와 current/load를 보는 runtime regulator가 thermal risk를 줄인다.
4. 그 결과가 단순한 감속 효과가 아니라, speed-scaled baseline보다 나은 tracking/thermal tradeoff를 만든다.

그래서 baseline policy는 일반적인 velocity tracking을 목표로 하고, proposed controller는 policy 자체를 처음부터 다시 학습시키기보다 그 위에서 command scale 또는 intervention을 조절하는 runtime layer로 시작합니다.

## **11. 다음 작업**

다음으로 할 일은 다음과 같습니다.

1. baseline rollout을 여러 episode로 수집하기
2. `/lowstate` log를 episode 단위로 정리하기
3. 12 reported actuator temperature, battery current, pack voltage, `tau_est`, `dq` plot 만들기
4. command, policy action, target joint position, `/lowcmd` 또는 deploy-side log 저장 추가하기
5. odom, mocap, visual odometry, Unitree state topic 중 하나로 base velocity/position 기록하기
6. max reported actuator temperature, hottest actuator temp rise, pack energy, runtime 계산하기
7. speed-scaled baseline과 current-only monitor 추가하기
8. freeze된 baseline과 freeze된 proposed regulator로 matched long-duration trial 수행하기

이번 글은 결과 정리라기보다, 논문 실험으로 넘어가기 위한 데이터 수집 시작 기록입니다.

이제부터는 "걸었다"보다 "어떤 상태로 걸었는가"를 봐야 합니다. 영상은 출발점이고, 진짜 비교는 log에서 시작됩니다.
