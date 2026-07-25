---
layout: page
title: CV
icon: fas fa-id-card
order: 5
toc: false
permalink: /cv/
description: Jaeha Kang — quadruped robot learning, reinforcement learning, and sim-to-real deployment.
image:
  path: /assets/img/posts/unitree/sim2real/unitree-go2-part-5-sim2real-success/success-turn-preview.jpg
  alt: A learned locomotion policy running on a physical Unitree Go2
---

<div class="cv-page" lang="en">
  <section class="cv-intro" aria-labelledby="cv-name">
    <p class="cv-eyebrow">Quadruped Robotics · Reinforcement Learning · Sim-to-Real</p>
    <h2 id="cv-name">Jaeha Kang</h2>
    <p class="cv-lead">
      Undergraduate researcher in Mechanical, Robotics and Automotive Engineering,
      focused on learning-based locomotion and deploying policies on physical robots.
    </p>

    <ul class="cv-facts" aria-label="Profile details">
      <li>Konkuk University</li>
      <li>Gwangjin-gu, Seoul</li>
      <li>B.S. expected Feb. 2027</li>
    </ul>
    <p class="cv-print-contact cv-print-only">
      iamjaehka13@gmail.com · github.com/iamjaehka13 · iamjaehka13.blog
    </p>

    <div class="cv-actions cv-screen-only" aria-label="Contact and navigation">
      <a class="cv-button cv-button-primary" href="mailto:iamjaehka13@gmail.com">Email me</a>
      <a class="cv-button" href="https://github.com/iamjaehka13">GitHub</a>
      <a class="cv-button" href="#selected-projects">View projects</a>
      <button class="cv-button" type="button" onclick="window.print()">Print / Save PDF</button>
    </div>
  </section>

  <section class="cv-section" aria-labelledby="research-interests">
    <div class="cv-section-heading">
      <p class="cv-section-number">01</p>
      <h2 id="research-interests">Research Interests</h2>
    </div>
    <div class="cv-tags" aria-label="Research interests">
      <span>Legged Robot Learning</span>
      <span>Unsupervised Skill Discovery</span>
      <span>Sim-to-Real Reinforcement Learning</span>
      <span>Physical Human–Robot Interaction</span>
    </div>
    <p class="cv-section-copy">
      I am interested in reducing task-specific reward-design burden while learning
      diverse, reusable robot behaviors that can transfer from simulation to physical systems.
    </p>
  </section>

  <section class="cv-section" id="selected-projects" aria-labelledby="selected-projects-title">
    <div class="cv-section-heading">
      <p class="cv-section-number">02</p>
      <h2 id="selected-projects-title">Selected Projects</h2>
    </div>

    <article class="cv-project" aria-labelledby="go2-project-title">
      <header class="cv-project-header">
        <div>
          <p class="cv-project-meta">Independent Project · 2026</p>
          <h3 id="go2-project-title">Unitree Go2 Locomotion and Sim-to-Real Deployment</h3>
        </div>
        <span class="cv-project-index" aria-hidden="true">P01</span>
      </header>

      <div class="cv-project-body">
        <ul class="cv-project-points">
          <li>
            Trained and exported a PPO locomotion policy with a 47-dimensional actor
            observation and 12 joint-position targets.
          </li>
          <li>
            Implemented a 50 Hz low-level pipeline with Unitree SDK2 and CycloneDDS,
            aligning observation semantics, joint order, action scaling, and PD commands.
          </li>
          <li>
            Deployed the policy on a personally owned Unitree Go2 and built a ROS 2
            and Jetson-based pipeline for recording <code>/lowstate</code> and
            teleoperation commands during walking trials.
          </li>
        </ul>

        <p class="cv-stack">
          Python · PyTorch · Isaac Gym / Lab · RSL-RL · MuJoCo · ROS 2 · Unitree SDK2 · CycloneDDS
        </p>
      </div>

      <div class="cv-media-grid">
        <figure class="cv-media cv-media-feature">
          <img
            class="cv-animated-media"
            src="https://media.iamjaehka13.blog/assets/img/posts/unitree/sim2real/unitree-go2-part-5-sim2real-success/success-turn.gif"
            alt="Physical Unitree Go2 responding to directional commands with a learned locomotion policy"
            width="520"
            height="292"
            decoding="async"
          >
          <img
            class="cv-static-media"
            src="/assets/img/posts/unitree/sim2real/unitree-go2-part-5-sim2real-success/success-turn-preview.jpg"
            alt="Physical Unitree Go2 running a learned locomotion policy"
            width="854"
            height="480"
            decoding="async"
          >
          <figcaption>
            Physical deployment — stable response to directional commands.
          </figcaption>
        </figure>

        <figure class="cv-media cv-motion-only">
          <img
            class="cv-animated-media"
            src="/assets/img/posts/unitree/sim2real/unitree-go2-part-1-sim2real-story/322cbb7d-7937-8028-9067-d926b8217a1d.gif"
            alt="Many simulated Unitree Go2 robots training in parallel on mixed terrain"
            width="720"
            height="405"
            decoding="async"
          >
          <figcaption>
            Vectorized policy training across mixed terrain before deployment.
          </figcaption>
        </figure>

        <figure class="cv-media cv-media-wide">
          <img
            src="/assets/img/posts/unitree/sim2real/unitree-go2-part-0-unitree-ros2-architecture/part0.png"
            alt="Architecture diagram connecting the Unitree Go2, ROS 2, CycloneDDS, and a Jetson computer"
            width="1672"
            height="941"
            decoding="async"
          >
          <figcaption>
            Robot-side deployment and data-collection architecture.
          </figcaption>
        </figure>
      </div>

      <figure class="cv-print-media cv-print-only">
        <img
          src="/assets/img/posts/unitree/sim2real/unitree-go2-part-5-sim2real-success/success-turn-preview.jpg"
          alt="Physical Unitree Go2 running a learned locomotion policy"
          width="854"
          height="480"
          decoding="async"
        >
        <figcaption>
          Learned locomotion policy deployed on a physical Unitree Go2.<br>
          <a href="https://iamjaehka13.blog/posts/unitree-go2-part-5-sim2real-success/">Project notes</a>
          ·
          <a href="https://github.com/iamjaehka13/unitree_go2_deploy_baseline_fullcode_lab">Source code</a>
        </figcaption>
      </figure>

      <nav class="cv-project-links cv-screen-only" aria-label="Go2 project links">
        <a href="/posts/unitree-go2-part-5-sim2real-success/">Deployment case study</a>
        <a href="/posts/unitree-go2-part-0-unitree-ros2-architecture/">System architecture</a>
        <a href="https://github.com/iamjaehka13/unitree_go2_deploy_baseline_fullcode_lab">Source code</a>
        <a href="https://github.com/iamjaehka13/data_collecting">Data-collection code</a>
      </nav>
    </article>

    <article class="cv-project" aria-labelledby="thermal-project-title">
      <header class="cv-project-header">
        <div>
          <p class="cv-project-meta">Capstone Design Project · 2026–Present</p>
          <h3 id="thermal-project-title">Thermal-Aware Reinforcement Learning for Go2 Locomotion</h3>
        </div>
        <span class="cv-project-index" aria-hidden="true">P02</span>
      </header>

      <div class="cv-project-body">
        <ul class="cv-project-points">
          <li>
            Collected real Go2 telemetry and fitted a compact reported-temperature-rate
            proxy from estimated joint torque, velocity, battery current, and onboard temperature.
          </li>
          <li>
            Expanded the policy observation from 47 to 77 dimensions with thermal and
            actuator-load states, then compared a temperature-only objective with a reward
            that directly penalizes excessive torque and positive mechanical power.
          </li>
          <li>
            In a 480 s MuJoCo evaluation at a 1.5 m/s command, the thermal-torque policy
            reduced distance-normalized proxy thermal dose by 22.5% and hotspot dose by
            27.0% versus baseline; mean forward speed was 1.36 m/s versus 1.30 m/s.
          </li>
        </ul>

        <p class="cv-stack">
          Python · PyTorch · Isaac Gym · MuJoCo · ROS 2 · PPO · Reward Shaping
        </p>

        <p class="cv-scope-note">
          <strong>Scope:</strong> real Go2 logs were used to fit and validate an
          onboard-reported actuator-temperature proxy. The learned-policy comparisons
          below are MuJoCo evaluations; the thermal policy has not yet been deployed on hardware.
        </p>
      </div>

      <div class="cv-media-grid cv-thermal-media">
        <figure class="cv-media">
          <img
            src="/assets/img/posts/unitree/sim2real/unitree-go2-part-7-thermal-reward-model/real_log_spatial_thermal_imbalance.png"
            alt="Per-actuator reported-temperature rise measured from real Unitree Go2 logs"
            width="852"
            height="744"
            decoding="async"
          >
          <figcaption>
            Real Go2 telemetry used to examine actuator-level imbalance; these are
            onboard-reported temperatures, not direct winding-temperature measurements.
          </figcaption>
        </figure>

        <figure class="cv-media cv-screen-only">
          <video
            controls
            muted
            playsinline
            preload="metadata"
            poster="/assets/img/posts/unitree/sim2real/unitree-go2-part-8-thermal-policy-comparison/vx1p5_yaw10m_comparison_preview.jpg"
          >
            <source
              src="/assets/img/posts/unitree/sim2real/unitree-go2-part-8-thermal-policy-comparison/vx1p5_yaw10m_comparison.mp4"
              type="video/mp4"
            >
            Your browser does not support embedded video.
          </video>
          <figcaption>
            Short MuJoCo visualization of gait and yaw behavior, separate from the 480 s rollout.
          </figcaption>
        </figure>

        <figure class="cv-media cv-media-wide">
          <img
            src="/assets/img/posts/unitree/sim2real/unitree-go2-part-8-thermal-policy-comparison/vx15_paper_thermal_metrics.png"
            alt="480-second MuJoCo comparison at a 1.5 meter-per-second command, showing lower distance-normalized proxy thermal dose and hotspot dose for the thermal-torque policy than the baseline"
            width="1760"
            height="638"
            decoding="async"
          >
          <figcaption>
            Corrected reported-temperature-proxy metrics from the 480 s MuJoCo evaluation.
          </figcaption>
        </figure>
      </div>

      <figure class="cv-print-media cv-print-only">
        <img
          src="/assets/img/posts/unitree/sim2real/unitree-go2-part-8-thermal-policy-comparison/vx15_paper_thermal_metrics.png"
          alt="480-second MuJoCo comparison showing lower distance-normalized proxy thermal dose for the thermal-torque policy"
          width="1760"
          height="638"
          decoding="async"
        >
        <figcaption>
          Reported-temperature-proxy metrics from the 480 s MuJoCo evaluation.<br>
          <a href="https://iamjaehka13.blog/posts/unitree-go2-part-8-thermal-policy-comparison/">Evaluation notes</a>
        </figcaption>
      </figure>

      <nav class="cv-project-links cv-screen-only" aria-label="Thermal project links">
        <a href="/posts/unitree-go2-part-7-thermal-reward-model/">Model and reward design</a>
        <a href="/posts/unitree-go2-part-8-thermal-policy-comparison/">Policy comparison</a>
      </nav>
    </article>
  </section>

  <section class="cv-section" aria-labelledby="experience-recognition">
    <div class="cv-section-heading">
      <p class="cv-section-number">03</p>
      <h2 id="experience-recognition">Experience &amp; Recognition</h2>
    </div>

    <div class="cv-record-grid">
      <article class="cv-record">
        <p class="cv-record-type">Experience</p>
        <h3>KoreaExpert Inc.</h3>
        <p class="cv-record-subtitle">Data Annotation Intern · Jul.–Dec. 2023</p>
        <p>
          Annotated crack patterns in images of bridges, dams, retaining walls,
          tunnels, and subway infrastructure for the 2023 AI-Hub SOC Infrastructure
          Crack Pattern Image Dataset project. Produced polygon and polyline labels
          under the project guidelines.
        </p>
      </article>

      <article class="cv-record">
        <p class="cv-record-type">Award</p>
        <h3>2024 POSTECH × OIBC Challenge</h3>
        <p class="cv-record-subtitle">Participation Award · Nov. 2024</p>
        <p>
          Placed 12th on the online forecasting leaderboard as part of a team.
          Used XGBoost with separate weekday and weekend models, historical
          System Marginal Price, and solar and wind generation variables selected
          through correlation analysis.
        </p>
        <a class="cv-inline-link cv-screen-only" href="https://dataen.ai/challenge/history/2024">
          Challenge archive
        </a>
      </article>
    </div>
  </section>

  <section class="cv-section" aria-labelledby="education-skills">
    <div class="cv-section-heading">
      <p class="cv-section-number">04</p>
      <h2 id="education-skills">Education &amp; Skills</h2>
    </div>

    <div class="cv-record-grid">
      <article class="cv-record">
        <p class="cv-record-type">Education</p>
        <h3>Konkuk University</h3>
        <p class="cv-record-subtitle">Seoul, Republic of Korea · Mar. 2023–Feb. 2027 (Expected)</p>
        <p>B.S. Candidate in Mechanical, Robotics and Automotive Engineering</p>
      </article>

      <article class="cv-record">
        <p class="cv-record-type">Technical Skills</p>
        <dl class="cv-skills">
          <div>
            <dt>Programming</dt>
            <dd>Python, C++</dd>
          </div>
          <div>
            <dt>Robotics</dt>
            <dd>ROS 2, Unitree SDK2, CycloneDDS, rosbag2</dd>
          </div>
          <div>
            <dt>Learning &amp; Simulation</dt>
            <dd>PyTorch, Isaac Gym / Lab, MuJoCo, RSL-RL, PPO, SAC</dd>
          </div>
          <div>
            <dt>Tools</dt>
            <dd>Linux, Git, NumPy, SciPy</dd>
          </div>
        </dl>
      </article>
    </div>
  </section>

  <footer class="cv-contact">
    <p class="cv-eyebrow">Contact</p>
    <h2>Interested in robot learning that survives contact with the real world.</h2>
    <p>
      <a href="mailto:iamjaehka13@gmail.com">iamjaehka13@gmail.com</a>
      <span aria-hidden="true">·</span>
      <a href="https://github.com/iamjaehka13">github.com/iamjaehka13</a>
    </p>
  </footer>
</div>
