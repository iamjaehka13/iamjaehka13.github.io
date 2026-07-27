---
title: "8. Maximum a Posteriori Policy Optimisation (MPO)"
date: 2026-07-28 00:46:00 +0900
last_modified_at: 2026-07-28 00:51:00 +0900
categories: [RL, Study]
tags: [reinforcement-learning, mpo, policy-optimisation, rl-as-inference, expectation-maximization, off-policy, trust-region]
description: Bayesian inference와 EM 관점에서 MPO의 E-step, M-step, KL trust region, off-policy 학습 구조를 정리한다.
image:
  path: /assets/img/posts/rl/maximum-a-posteriori-policy-optimisation/00-mpo-overview.jpg
  alt: EM 기반 E-step과 M-step으로 구성된 MPO 정책 최적화 개요
math: true
---

6편의 Policy Gradient에서는 서로 다른 두 흐름을 봤다.

- PPO와 TRPO: 새 정책이 너무 멀리 움직이지 않도록 제한하는 안정적인 on-policy update
- DDPG: replay buffer를 재사용하는 sample-efficient off-policy actor-critic

여기에는 자주 마주치는 trade-off가 있다.

> 안정적인 정책 업데이트와 높은 데이터 효율을 함께 가져갈 수 없을까?

MPO(Maximum a Posteriori Policy Optimisation)는 이 문제를 **확률적 추론과 EM(Expectation-Maximization)** 의 언어로 다시 푼다. 좋은 행동에 가중치를 주는 비모수 분포를 먼저 만들고, 그 분포를 현재 policy가 따라가도록 supervised learning처럼 fitting하는 구조.

![MPO의 문제의식과 EM 기반 정책 최적화](/assets/img/posts/rl/maximum-a-posteriori-policy-optimisation/00-mpo-overview.jpg)

*On-policy의 안정성과 off-policy의 데이터 효율을 결합하려는 MPO의 출발점. 직접 정리한 `OhDRL.pdf` 슬라이드.*

## **1. MPO를 보기 전에 필요한 확률 개념**

MPO라는 이름의 MAP(Maximum a Posteriori)를 이해하려면 MLE, MAP, Bayesian inference의 관계부터 짚어야 한다.

### **1.1 Bayes' rule**

관측 데이터 $X$와 파라미터 $\theta$가 있을 때:

$$
p(\theta\mid X)
=
\frac{p(X\mid\theta)p(\theta)}{p(X)}
$$

- $p(\theta)$: 데이터를 보기 전의 prior
- $p(X\mid\theta)$: 해당 파라미터가 데이터를 만들 likelihood
- $p(\theta\mid X)$: 데이터를 본 뒤의 posterior
- $p(X)$: 가능한 모든 $\theta$를 고려한 evidence

### **1.2 MLE와 MAP**

MLE는 likelihood를 가장 크게 만드는 파라미터를 찾는다.

$$
\theta_{\text{MLE}}
=
\arg\max_\theta p(X\mid\theta)
$$

MAP는 prior까지 포함한 posterior를 최대화한다.

$$
\theta_{\text{MAP}}
=
\arg\max_\theta p(\theta\mid X)
=
\arg\max_\theta
\left[
\log p(X\mid\theta)
+
\log p(\theta)
\right]
$$

$p(X)$는 $\theta$와 무관하므로 최적화에서 빠진다. prior가 현재 정책에서 너무 멀어지지 않게 하는 regularizer처럼 작동할 수 있다는 점이 MPO와 연결된다.

## **2. 직접 계산하기 어려운 posterior와 ELBO**

Bayesian inference에서 evidence:

$$
p(X)
=
\int p(X,Z)\,dZ
$$

latent variable $Z$가 복잡하면 이 적분과 posterior $p(Z\mid X)$를 직접 계산하기 어렵다. 그래서 다루기 쉬운 분포 $q(Z)$를 도입한다.

다음 항등식이 출발점.

$$
\log p(X)
=
\mathcal{L}(q,\theta)
+
D_{\mathrm{KL}}
\left(
q(Z)\,\Vert\,p(Z\mid X,\theta)
\right)
$$

KL divergence는 항상 0 이상이므로:

$$
\log p(X)
\ge
\mathcal{L}(q,\theta)
$$

여기서 $\mathcal{L}$이 ELBO(Evidence Lower Bound).

$$
\mathcal{L}(q,\theta)
=
\mathbb{E}_{q(Z)}
\left[
\log p(X,Z\mid\theta)
-
\log q(Z)
\right]
$$

원래 evidence를 바로 최적화하는 대신, 계산 가능한 lower bound를 끌어올리는 우회로다.

## **3. EM: 추론과 파라미터 학습을 번갈아 수행**

EM 알고리즘은 $q$와 $\theta$를 한 번에 최적화하지 않는다.

![Expectation-Maximization의 E-step과 M-step](/assets/img/posts/rl/maximum-a-posteriori-policy-optimisation/01-em-algorithm.jpg)

*latent variable posterior 추정과 model parameter fitting을 번갈아 수행하는 EM. 직접 정리한 `OhDRL.pdf` 슬라이드.*

### **E-step**

현재 파라미터 $\theta_i$를 고정하고 posterior를 잘 근사하는 $q$를 찾는다.

$$
q_{i+1}
=
\arg\max_q \mathcal{L}(q,\theta_i)
$$

### **M-step**

방금 구한 $q_{i+1}$을 고정하고 model parameter를 업데이트한다.

$$
\theta_{i+1}
=
\arg\max_\theta \mathcal{L}(q_{i+1},\theta)
$$

직관적으로는:

1. 현재 모델로 숨어 있는 변수의 분포를 추정
2. 그 추정값을 정답처럼 보고 모델을 다시 fitting
3. 두 단계를 반복

MPO는 이 구조를 policy improvement에 옮긴다.

## **4. Reinforcement Learning as Inference**

일반적인 강화학습 질문:

> 미래 reward를 크게 만드는 action은 무엇인가?

추론 관점에서는 가상의 optimality variable $O$를 만든다. $O=1$은 “이 trajectory가 바람직한 결과를 냈다”는 사건.

trajectory $\tau$의 prior:

$$
p_\pi(\tau)
=
p(s_0)
\prod_{t\ge0}
p(s_{t+1}\mid s_t,a_t)
\pi(a_t\mid s_t)
$$

높은 reward의 trajectory일수록 optimality likelihood가 커지게 둔다.

$$
p(O=1\mid\tau)
\propto
\exp
\left(
\frac{1}{\alpha}
\sum_t r_t
\right)
$$

그러면 posterior:

$$
p_\pi(\tau\mid O=1)
\propto
p_\pi(\tau)
p(O=1\mid\tau)
$$

높은 reward를 얻은 trajectory가 posterior에서 큰 확률을 갖는다.

![Optimal control을 posterior inference로 바꾸는 관점](/assets/img/posts/rl/maximum-a-posteriori-policy-optimisation/02-rl-as-inference.jpg)

*보상을 likelihood로 바꾸고, 성공했다는 조건 아래 action posterior를 추론하는 RL-as-inference 관점. 직접 정리한 `OhDRL.pdf` 슬라이드.*

질문의 방향이 뒤집힌다.

> 성공했다고 가정할 때, 어떤 action이 실행됐을 가능성이 높은가?

MPO의 E-step은 이 “좋은 action의 posterior”에 해당하는 분포를 찾고, M-step은 parametric policy가 그 분포를 모방하도록 만든다.

## **5. MPO 전체 구조**

MPO에는 세 개의 대상이 등장한다.

- $\pi_{\theta_i}(a\mid s)$: 현재 parametric policy
- $Q_i(s,a)$: off-policy critic이 추정한 action value
- $q(a\mid s)$: E-step에서 만드는 non-parametric improved action distribution

한 iteration을 요약하면:

1. replay buffer로 critic $Q_i$ 업데이트
2. 현재 policy에서 여러 action을 샘플링
3. Q값이 높은 action에 더 큰 weight를 주어 $q$ 구성
4. policy $\pi_\theta$가 $q$를 따라가도록 weighted maximum likelihood
5. KL constraint로 E-step과 M-step의 이동량 제한

Actor가 Q의 gradient를 직접 따라가는 DDPG/SAC와 달리, MPO는 중간에 **improved action distribution $q$**를 명시적으로 둔다.

## **6. E-step: 좋은 action의 분포 만들기**

현재 policy $\pi_{\theta_i}$에서 너무 멀어지지 않으면서 Q값이 큰 action을 선호하는 분포 $q$를 찾는다.

$$
\max_q
\mathbb{E}_{s\sim\mu_q}
\left[
\mathbb{E}_{a\sim q(\cdot\mid s)}
[Q_i(s,a)]
\right]
$$

제약:

$$
\mathbb{E}_{s\sim\mu_q}
\left[
D_{\mathrm{KL}}
\left(
q(a\mid s)
\Vert
\pi_{\theta_i}(a\mid s)
\right)
\right]
\le \epsilon
$$

정규화 조건 $\int q(a\mid s)da=1$까지 포함해 Lagrangian을 풀면:

$$
q_i(a\mid s)
=
\frac{
\pi_{\theta_i}(a\mid s)
\exp\left(Q_i(s,a)/\eta\right)
}{
\int
\pi_{\theta_i}(a'\mid s)
\exp\left(Q_i(s,a')/\eta\right)
da'
}
$$

또는 비례식으로:

$$
q_i(a\mid s)
\propto
\pi_{\theta_i}(a\mid s)
\exp\left(Q_i(s,a)/\eta\right)
$$

![MPO E-step과 non-parametric action distribution](/assets/img/posts/rl/maximum-a-posteriori-policy-optimisation/03-mpo-e-step.jpg)

*현재 policy의 action sample을 Q값으로 재가중하는 E-step. 직접 정리한 `OhDRL.pdf` 슬라이드.*

### **6.1 $\eta$의 의미**

$\eta$는 temperature이면서 KL constraint의 dual variable.

- $\eta$가 큼: Q 차이가 완만하게 반영됨, 현재 policy와 가까운 $q$
- $\eta$가 작음: Q가 가장 큰 action에 weight 집중

실제 continuous action 구현에서는 적분을 직접 계산하지 않는다. 상태마다 현재 policy에서 $N$개의 action을 샘플링하고:

$$
w_{ij}
=
\frac{
\exp(Q_i(s_j,a_{ij})/\eta)
}{
\sum_{k=1}^{N}
\exp(Q_i(s_j,a_{kj})/\eta)
}
$$

softmax weight로 $q$를 근사한다.

```text
states        : [B, state_dim]
sampled_action: [B, N, action_dim]
q_values      : [B, N]
weights       : [B, N]
```

여기까지는 policy parameter를 직접 바꾸지 않는다. **어떤 action들을 얼마나 모방할지 정한 단계**다.

## **7. M-step: q를 parametric policy로 fitting**

E-step의 $q_i$는 sampled action과 weight로만 표현된 non-parametric distribution이다. 그대로는 새 상태에서 action을 생성할 수 없다. M-step에서 parametric policy $\pi_\theta$로 옮긴다.

$$
\max_\theta
\mathbb{E}_{s\sim\mu_q}
\left[
\mathbb{E}_{a\sim q_i(\cdot\mid s)}
[\log \pi_\theta(a\mid s)]
\right]
$$

sample 기반 loss:

$$
\mathcal{L}_{\text{MPO}}(\theta)
=
-
\frac{1}{B}
\sum_{j=1}^{B}
\sum_{i=1}^{N}
w_{ij}
\log\pi_\theta(a_{ij}\mid s_j)
$$

Q값이 큰 action은 높은 weight. policy는 그 action의 likelihood를 높인다. 형태만 보면 weighted behavior cloning과 유사하다.

하지만 policy를 한 번에 $q$까지 완전히 끌고 가면 critic error나 우연히 큰 Q값을 과신할 수 있다. 그래서 이전 policy와의 KL constraint 추가.

$$
\mathbb{E}_{s}
\left[
D_{\mathrm{KL}}
\left(
\pi_{\theta_i}(\cdot\mid s)
\Vert
\pi_{\theta}(\cdot\mid s)
\right)
\right]
\le\epsilon_\pi
$$

![MPO M-step과 KL trust region](/assets/img/posts/rl/maximum-a-posteriori-policy-optimisation/04-mpo-m-step.jpg)

*재가중된 action을 policy에 fitting하되 이전 policy와의 KL로 update를 제한하는 M-step. 직접 정리한 `OhDRL.pdf` 슬라이드.*

### **7.1 E-step과 M-step의 KL은 역할이 다르다**

두 단계 모두 KL을 쓰지만 비교 대상이 다르다.

| 단계 | KL constraint | 막으려는 문제 |
| --- | --- | --- |
| E-step | $D_{\mathrm{KL}}(q\Vert\pi_i)$ | $q$가 현재 policy의 support 밖으로 과도하게 이동 |
| M-step | $D_{\mathrm{KL}}(\pi_i\Vert\pi_\theta)$ | parametric policy가 한 번에 너무 크게 변경 |

E-step은 믿을 수 있는 action sample 안에서 개선 방향을 만들고, M-step은 그 방향을 제한된 크기로 policy에 반영한다.

### **7.2 Gaussian policy의 mean과 covariance**

continuous control에서는 보통 Gaussian policy:

$$
\pi_\theta(a\mid s)
=
\mathcal{N}
\left(
\mu_\theta(s),
\Sigma_\theta(s)
\right)
$$

MPO 계열 구현은 mean과 covariance에 별도의 KL budget을 둘 수 있다.

- mean: 어느 행동 쪽으로 이동할지
- covariance: 탐색 범위를 얼마나 넓힐지

둘을 한 constraint로 묶으면 mean 개선 때문에 variance까지 급격히 줄어드는 문제가 생길 수 있다. decoupled constraint는 이 두 변화를 따로 제어하는 장치.

## **8. Critic은 어떻게 학습하는가**

MPO의 policy improvement가 EM 형태라고 해서 value learning까지 on-policy인 것은 아니다. replay buffer의 transition으로 off-policy critic을 업데이트한다.

$$
Q^\pi(s_t,a_t)
=
\mathbb{E}
\left[
r_t
+
\gamma Q^\pi(s_{t+1},a_{t+1})
\right]
$$

원 논문의 구현은 multi-step off-policy evaluation을 위해 Retrace 계열 target을 사용한다. behavior policy와 target policy가 다른 영향을 importance ratio로 보정하면서, ratio를 잘라 분산 폭증을 막는 방식.

개념적으로 기억할 부분:

- replay buffer 재사용: 높은 sample efficiency
- critic: 현재 policy의 Q 추정
- E-step: critic을 이용해 action sample 재가중
- M-step: 재가중된 action에 policy fitting

critic이 틀리면 E-step의 weight도 틀린다. MPO의 trust region은 이 오차를 없애는 장치가 아니라, **오차를 한 번에 크게 추종하지 않게 만드는 안전장치**에 가깝다.

## **9. MPO, PPO, SAC의 차이**

모두 continuous control에 쓸 수 있지만 policy update를 만드는 방식이 다르다.

| 구분 | PPO | SAC | MPO |
| --- | --- | --- | --- |
| 데이터 | on-policy rollout | off-policy replay | off-policy replay |
| policy improvement | clipped probability ratio | $Q+\alpha\mathcal{H}$를 직접 최적화 | $Q$로 $q$를 만든 뒤 policy fitting |
| 안정화 핵심 | clipping 또는 KL monitoring | entropy, twin critic, target network | E/M-step의 KL trust region |
| 탐색 | stochastic policy | maximum-entropy objective | Gaussian policy와 covariance constraint |
| actor update 형태 | policy gradient | reparameterized policy gradient | weighted maximum likelihood |
| 샘플 재사용 | 제한적 | 높음 | 높음 |

### **9.1 PPO와 비교**

PPO는 rollout을 모은 현재 policy 근처에서 여러 epoch update하고 데이터를 버린다. 구현이 단순하고 대규모 병렬 simulation에 잘 맞지만, 실제 환경처럼 transition이 비싸면 sample reuse가 제한적.

MPO는 replay buffer를 사용하면서도 policy update에 명시적인 KL budget을 둔다. “off-policy니까 무조건 불안정하다”와 “on-policy만 안정적이다” 사이의 다른 설계.

### **9.2 SAC와 비교**

SAC는 actor가 critic과 entropy term을 직접 최적화한다.

$$
\max_\pi
\mathbb{E}
\left[
Q(s,a)
+
\alpha\mathcal{H}
\left(
\pi(\cdot\mid s)
\right)
\right]
$$

MPO는 Q값을 actor loss에 바로 넣기보다 action sample의 weight로 변환한다.

```text
SAC: action -> Q gradient -> actor parameter
MPO: action samples -> Q-based weights -> weighted policy fitting
```

SAC의 $\alpha$는 reward와 entropy의 trade-off. MPO의 $\eta$는 E-step에서 Q 기반 재가중이 현재 policy로부터 얼마나 멀어질지 조절하는 dual temperature. 비슷해 보이지만 나온 제약과 역할이 다르다.

## **10. MPO algorithm을 코드 관점에서 읽기**

![MPO 전체 알고리즘](/assets/img/posts/rl/maximum-a-posteriori-policy-optimisation/05-mpo-algorithm.jpg)

*off-policy critic, E-step, M-step을 합친 MPO 학습 순서. 직접 정리한 `OhDRL.pdf` 슬라이드.*

간략한 pseudocode:

```python
for each update:
    batch = replay_buffer.sample(batch_size)

    # 1. Off-policy policy evaluation
    critic_loss = compute_retrace_or_td_loss(batch)
    update_critic(critic_loss)

    # 2. E-step: current policy에서 여러 action 샘플
    actions = policy.sample(batch.states, num_action_samples)

    with torch.no_grad():
        q_values = critic(batch.states, actions)
        eta = solve_dual_temperature(q_values, epsilon_e)
        weights = softmax(q_values / eta, dim="action_samples")

    # 3. M-step: weighted maximum likelihood
    log_prob = policy.log_prob(batch.states, actions)
    weighted_log_likelihood = (weights * log_prob).sum()

    # 4. old policy와의 KL constraint
    kl_mean, kl_cov = gaussian_kl(old_policy, policy, batch.states)
    actor_loss = mpo_lagrangian(
        weighted_log_likelihood,
        kl_mean,
        kl_cov,
    )
    update_policy(actor_loss)
```

구현에서 볼 checkpoint:

1. E-step weight를 만들 때 critic으로 gradient가 새지 않는가?
2. action sample dimension과 batch dimension이 섞이지 않았는가?
3. softmax가 action sample 축에 적용됐는가?
4. old policy가 update 중 고정돼 있는가?
5. mean과 covariance KL budget이 별도로 관리되는가?
6. dual variable $\eta$와 KL multiplier가 양수가 되도록 parameterized됐는가?

## **11. 로봇 제어에서 보는 장점과 한계**

MPO가 continuous control과 잘 맞는 이유:

- Gaussian policy로 연속 action 표현
- replay buffer를 통한 transition 재사용
- E-step의 non-parametric improvement
- M-step의 supervised fitting
- KL budget으로 update 크기 제한

실제 로봇 데이터가 비싼 상황에서는 sample reuse가 특히 매력적이다. 그러나 “MPO라서 실제 로봇에 안전하다”는 결론은 성립하지 않는다.

남는 문제:

- critic overestimation
- replay data와 현재 policy 사이의 distribution shift
- KL budget, action sample 수, dual optimization 민감도
- actuator limit과 safety constraint는 알고리즘 밖에서 별도 처리
- simulation에서 찾은 high-Q action이 실제 dynamics에서는 유효하지 않을 가능성

MPO의 trust region은 policy distribution의 변화량을 제한할 뿐, torque나 velocity의 물리적 안전을 직접 보장하지 않는다.

## **12. 이번 글의 핵심**

MPO를 단순히 “PPO보다 sample-efficient한 알고리즘”으로만 보면 구조가 잘 안 보인다.

핵심은 policy improvement를 두 단계로 분해한 데 있다.

> E-step: 현재 policy가 낼 수 있는 action 중 어떤 것을 더 믿을지 결정
>
> M-step: 그 weighted action distribution을 parametric policy로 fitting

그 사이를 잇는 것이 off-policy critic과 KL trust region.

6편의 PPO가 **policy ratio를 clip해 업데이트 폭을 제한**했다면, MPO는 **추론으로 개선 분포를 만든 뒤 제한된 supervised fitting**을 수행한다. 같은 “안정적인 policy improvement” 문제를 서로 다른 언어로 푼 셈이다.

## **참고 자료**

- Abbas Abdolmaleki et al., [Maximum a Posteriori Policy Optimisation](https://arxiv.org/abs/1806.06920), ICLR 2018.
- Abbas Abdolmaleki et al., [Relative Entropy Regularized Policy Iteration](https://arxiv.org/abs/1812.02256), 2018.
