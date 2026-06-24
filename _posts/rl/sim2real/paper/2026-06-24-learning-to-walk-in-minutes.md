---
title: "[Sim2Real Paper 8] Learning to Walk in Minutes"
date: 2026-06-24 17:36:00 +0900
categories: [RL, Sim2Real, Paper]
tags: [sim2real, isaac-gym, legged-gym, massively-parallel-rl, quadruped-locomotion]
description: Rudin et al.의 Learning to Walk in Minutes를 통해 Isaac Gym과 legged gym 계열의 massively parallel RL locomotion 학습 흐름을 정리한다.
---

## **0. 전체 그림: Sim2Real을 빠르게 반복하기**

지금까지 본 논문들은 주로 transfer의 내용을 다뤘습니다.

- Reality gap을 noise로 다루기
- visual domain randomization
- dynamics randomization
- actuator model과 latency
- learned actuator net
- proprioceptive rough terrain locomotion
- online adaptation

Rudin et al.의 **Learning to Walk in Minutes Using Massively Parallel Deep Reinforcement Learning**은 조금 다른 축을 봅니다.

> Legged locomotion policy를 얼마나 빠르게 학습하고 반복할 수 있는가?

이 논문은 Isaac Gym을 사용해 수천 개 robot을 single workstation GPU에서 병렬로 굴리고, ANYmal locomotion policy를 매우 짧은 시간 안에 학습합니다.

Isaac Gym / legged gym 계열을 이해할 때 기본으로 봐야 하는 논문입니다.

## **1. 논문이 다루는 문제**

Legged RL은 실험 iteration이 많습니다.

Reward를 바꾸고, observation을 바꾸고, randomization을 바꾸고, terrain curriculum을 바꾸면 policy behavior가 크게 달라집니다.

문제는 training이 오래 걸리면 iteration 자체가 느려진다는 점입니다.

기존 CPU 기반 simulator나 적은 병렬 환경에서는 하나의 policy를 학습하는 데 시간이 많이 걸립니다. 그러면 reward 설계나 randomization range를 실험하기 어렵습니다.

이 논문의 질문은 다음입니다.

> 수천 개 robot을 GPU에서 병렬로 시뮬레이션하면, real robot에 transfer 가능한 locomotion policy를 분 단위로 학습할 수 있을까?

## **2. 논문 정보**

| 항목 | 내용 |
|---|---|
| Title | Learning to Walk in Minutes Using Massively Parallel Deep Reinforcement Learning |
| Authors | Nikita Rudin, David Hoeller, Philipp Reist, Marco Hutter |
| Year | 2022 |
| Venue | Conference on Robot Learning |
| Robot | ANYmal |
| Simulator | Isaac Gym |
| Key idea | thousands of robots in parallel on GPU |
| Training result | flat terrain under 4 minutes, uneven terrain around 20 minutes |
| Code | legged_gym |
| Source | [arXiv](https://arxiv.org/abs/2109.11978), [PMLR PDF](https://proceedings.mlr.press/v164/rudin22a/rudin22a.pdf), [legged_gym](https://github.com/leggedrobotics/legged_gym) |

이 논문은 Go2나 Unitree 계열 RL을 공부할 때도 중요합니다.

많은 open-source quadruped locomotion environment가 이 legged gym 흐름의 영향을 받았기 때문입니다.

## **3. 핵심 아이디어: End-to-End GPU Pipeline**

Massively parallel RL에서 중요한 것은 단순히 environment 수를 늘리는 것이 아닙니다.

Simulation과 policy inference, rollout buffer, learning update가 GPU 안에서 효율적으로 돌아야 합니다.

논문은 Isaac Gym을 사용합니다. Isaac Gym은 physics simulation과 training을 GPU에서 처리하며, thousands of robots를 병렬로 시뮬레이션할 수 있습니다.

이 구조의 장점은 다음입니다.

| 요소 | 의미 |
|---|---|
| thousands of environments | 많은 experience를 빠르게 수집 |
| GPU simulation | CPU-GPU data transfer overhead 감소 |
| on-policy RL | PPO 같은 알고리즘을 대규모 batch로 사용 |
| fast iteration | reward/randomization/curriculum 실험 속도 증가 |

결과적으로 flat terrain policy는 4분 이내, uneven terrain policy는 약 20분 수준으로 학습됩니다.

## **4. Game-Inspired Curriculum**

Rough terrain 학습에서는 curriculum이 중요합니다.

논문은 game-inspired automatic curriculum을 제안합니다. Terrain에는 level이 있고, robot이 잘하면 더 어려운 level로 올라가고, 못하면 쉬운 level로 내려가는 방식입니다.

이 구조는 massively parallel regime과 잘 맞습니다.

수천 개 robot이 각각 다른 terrain level에서 동시에 학습하므로, 현재 policy가 어느 난이도에서 잘하고 못하는지 빠르게 알 수 있습니다.

| Curriculum 요소 | 역할 |
|---|---|
| terrain type | slope, stairs, rough terrain 등 |
| terrain level | 같은 type 안에서 난이도 |
| success/progress 기준 | robot을 더 어렵거나 쉬운 level로 이동 |
| parallel robots | 난이도 distribution을 동시에 탐색 |

이것은 Lee et al.의 adaptive terrain curriculum과 연결됩니다.

Rough terrain Sim2Real에서는 terrain을 무작정 어렵게 만드는 것이 아니라, policy가 학습할 수 있는 난이도를 계속 조절해야 합니다.

## **5. Sim2Real을 위한 구성 요소**

이 논문은 단순히 빠르게 simulation policy를 만드는 데서 끝나지 않습니다.

Real robot transfer를 위해 필요한 요소도 포함합니다.

논문과 legged_gym 계열에서 중요하게 보는 축은 다음과 같습니다.

| 요소 | Sim2Real 역할 |
|---|---|
| friction randomization | foot-ground contact 차이 대응 |
| mass randomization | robot model, payload 차이 대응 |
| observation noise | sensor/state estimator mismatch 대응 |
| random pushes | 외란 robustness |
| actuator network | ANYmal actuator dynamics 반영 |
| terrain curriculum | rough terrain robustness |

즉 이 논문은 "빠른 학습" 논문이지만, 그 빠른 학습이 real robot transfer까지 이어지는 구조를 보여줍니다.

## **6. 결과에서 중요한 부분**

논문은 ANYmal을 challenging terrain에서 걷도록 학습합니다.

핵심 결과는 training speed입니다.

- Flat terrain policy는 4분 이내에 학습됩니다.
- Uneven terrain policy는 약 20분 안에 학습됩니다.
- 이는 이전 방식보다 여러 order of magnitude 빠른 속도입니다.
- 학습한 policy는 real robot으로 transfer되어 approach를 검증합니다.

이 결과가 중요한 이유는 단순히 "빠르다"가 아닙니다.

Sim2Real에서 가장 비싼 것은 한 번의 training이 아니라 반복입니다. Reward, command distribution, randomization range, actuator model, terrain curriculum을 여러 번 바꿔야 합니다.

Training이 분 단위가 되면 실험 design 자체가 달라집니다.

## **7. Sim2Real 관점에서의 해석**

이 논문은 Sim2Real workflow를 바꿉니다.

이전에는 policy 하나를 학습하는 데 오래 걸리면, reward나 randomization을 신중하게 한 번에 맞추려고 합니다. 하지만 빠른 training이 가능하면 더 많은 ablation과 iteration을 할 수 있습니다.

Go2나 ANYmal 같은 robot에서 Sim2Real을 할 때 중요한 것은 다음입니다.

> 빠른 simulator는 좋은 policy 하나를 바로 주는 것이 아니라, 좋은 policy를 찾는 iteration loop를 빠르게 만든다.

즉 Isaac Gym / legged gym의 가치는 단순 speed가 아닙니다.

Reward hacking을 찾고, randomization range를 조정하고, observation set을 줄이고 늘리고, terrain curriculum을 바꾸는 실험을 빠르게 반복할 수 있다는 점이 중요합니다.

## **8. Go2 Sim2Real에서 가져갈 점**

Go2 locomotion을 Isaac Lab이나 legged gym 계열로 학습한다면 이 논문은 직접 연결됩니다.

가져갈 질문은 다음입니다.

1. Environment가 GPU pipeline을 깨지 않고 병렬로 잘 돌고 있는가?
2. Observation, reward, reset, command sampling이 수천 env에서 일관되게 정의되어 있는가?
3. Randomization이 real deployment condition을 덮고 있는가?
4. Terrain curriculum이 너무 쉽거나 어렵지 않은가?
5. Actuator model 또는 action delay가 real Go2와 맞는가?
6. Training speed만 보고 sim-only exploit을 놓치고 있지는 않은가?
7. 빠른 학습을 이용해 ablation을 충분히 했는가?

특히 Go2에서 reward를 바꾸거나 terrain을 추가할 때, 빠른 training은 큰 장점입니다.

하지만 빠르게 망가진 policy도 만들 수 있습니다. 그래서 speed는 검증을 대체하지 않습니다.

## **9. 이 논문의 한계**

이 논문을 읽을 때 주의할 점도 있습니다.

- 빠른 training은 좋은 reward와 observation design을 자동으로 보장하지 않습니다.
- Isaac Gym physics와 real robot 사이의 gap은 여전히 존재합니다.
- Contact-rich behavior에서는 simulator artifact를 policy가 이용할 수 있습니다.
- GPU 병렬 환경이 커질수록 memory와 implementation detail이 중요해집니다.
- Real deployment 검증 없이 simulation curve만 보면 위험합니다.

즉 이 논문은 Sim2Real 문제를 끝내는 논문이 아닙니다.

Sim2Real iteration을 훨씬 빠르게 만들어주는 infrastructure 논문에 가깝습니다.

## **10. 정리하며: 빠른 학습은 빠른 검증 루프를 만든다**

이번 글에서는 Rudin et al.의 **Learning to Walk in Minutes Using Massively Parallel Deep Reinforcement Learning**을 정리했습니다.

- Isaac Gym을 사용해 thousands of robots를 GPU에서 병렬로 시뮬레이션합니다.
- Flat terrain policy는 4분 이내, uneven terrain policy는 약 20분 수준으로 학습됩니다.
- Game-inspired curriculum은 rough terrain 학습에 적합합니다.
- legged_gym 계열은 actuator network, friction/mass randomization, observation noise, random pushes 등 Sim2Real 요소를 포함합니다.
- 핵심 가치는 빠른 policy 생성뿐 아니라 빠른 ablation과 iteration입니다.

8편의 핵심은 이렇게 정리할 수 있습니다.

> Sim2Real은 한 번에 맞히는 문제가 아니라, 빠르게 학습하고 빠르게 검증하며 gap을 줄이는 반복 과정이다.

여기까지 오면 Sim2Real paper 흐름은 하나로 이어집니다.

Reality gap을 이해하고, visual/dynamics randomization을 배우고, actuator와 latency를 다루고, rough terrain과 online adaptation을 보며, 마지막으로 Isaac Gym 계열의 빠른 반복 학습으로 연결됩니다.
