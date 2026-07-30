(() => {
  const interactionQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!interactionQuery.matches || reducedMotionQuery.matches) {
    return;
  }

  const shapes = [
    [52, 48, 45, 55, 44, 48, 52, 56],
    [58, 42, 52, 48, 46, 59, 41, 54],
    [44, 56, 48, 52, 55, 43, 57, 45],
    [51, 49, 58, 42, 44, 57, 43, 56],
    [47, 53, 42, 58, 59, 43, 57, 41],
    [56, 44, 49, 51, 43, 52, 48, 57],
    [43, 57, 53, 47, 56, 47, 53, 44],
    [55, 45, 43, 57, 48, 58, 42, 52]
  ];

  const clamp = (value, minimum, maximum) =>
    Math.min(Math.max(value, minimum), maximum);

  const folders = document.querySelectorAll('.liquid-folder');

  folders.forEach((folder, index) => {
    const base = shapes[index % shapes.length];
    const state = {
      x: 0,
      y: 0,
      velocityX: 0,
      velocityY: 0,
      targetX: 0,
      targetY: 0,
      active: false,
      releasing: false,
      releaseLockUntil: 0,
      releaseTimer: null,
      frame: null
    };

    const setRadius = (x, y, velocityX, velocityY) => {
      const waveX = x * 8.5 + velocityX * 11;
      const waveY = y * 8.5 + velocityY * 11;
      const radii = [
        clamp(base[0] + waveX - waveY * 0.35, 30, 70),
        clamp(base[1] - waveX + waveY * 0.2, 30, 70),
        clamp(base[2] - waveX * 0.45 + waveY, 30, 70),
        clamp(base[3] + waveX * 0.55 - waveY, 30, 70),
        clamp(base[4] - waveY + waveX * 0.3, 30, 70),
        clamp(base[5] + waveY - waveX * 0.25, 30, 70),
        clamp(base[6] + waveX + waveY * 0.35, 30, 70),
        clamp(base[7] - waveX - waveY * 0.3, 30, 70)
      ];

      folder.style.borderRadius =
        `${radii[0]}% ${radii[1]}% ${radii[2]}% ${radii[3]}% / ` +
        `${radii[4]}% ${radii[5]}% ${radii[6]}% ${radii[7]}%`;
    };

    const render = () => {
      const spring = state.active ? 0.105 : state.releasing ? 0.12 : 0.095;
      const damping = state.active ? 0.79 : state.releasing ? 0.865 : 0.82;

      state.velocityX =
        (state.velocityX + (state.targetX - state.x) * spring) * damping;
      state.velocityY =
        (state.velocityY + (state.targetY - state.y) * spring) * damping;
      state.x += state.velocityX;
      state.y += state.velocityY;

      const horizontalStretch =
        1 +
        Math.abs(state.x) * 0.034 +
        Math.abs(state.velocityX) * 0.2 -
        Math.abs(state.y) * 0.012;
      const verticalStretch =
        1 +
        Math.abs(state.y) * 0.034 +
        Math.abs(state.velocityY) * 0.2 -
        Math.abs(state.x) * 0.012;

      folder.style.setProperty('--pull-x', `${state.x * 11.5}px`);
      folder.style.setProperty('--pull-y', `${state.y * 9.5}px`);
      folder.style.setProperty('--liquid-rotate', `${state.x * 3.4}deg`);
      folder.style.setProperty('--liquid-scale-x', horizontalStretch.toFixed(4));
      folder.style.setProperty('--liquid-scale-y', verticalStretch.toFixed(4));
      folder.style.setProperty('--shine-x', `${clamp(25 + state.x * 19, 9, 46)}%`);
      folder.style.setProperty('--shine-y', `${clamp(16 + state.y * 15, 6, 37)}%`);
      folder.style.setProperty('--rim-x', `${clamp(55 + state.x * 15, 36, 73)}%`);
      folder.style.setProperty('--rim-y', `${clamp(69 + state.y * 11, 54, 82)}%`);
      folder.style.setProperty('--shine-rotate', `${-18 + state.x * 12}deg`);
      folder.style.setProperty('--content-x', `${state.x * -2.8}px`);
      folder.style.setProperty('--content-y', `${state.y * -2.2}px`);
      folder.style.setProperty('--lens-x', `${state.x * -3.6}px`);
      folder.style.setProperty('--lens-y', `${state.y * -3}px`);
      setRadius(state.x, state.y, state.velocityX, state.velocityY);

      const settled =
        Math.abs(state.targetX - state.x) < 0.0015 &&
        Math.abs(state.targetY - state.y) < 0.0015 &&
        Math.abs(state.velocityX) < 0.0015 &&
        Math.abs(state.velocityY) < 0.0015;

      if (settled) {
        state.frame = null;

        if (state.active) {
          return;
        }

        state.x = 0;
        state.y = 0;
        state.velocityX = 0;
        state.velocityY = 0;
        state.releasing = false;
        folder.classList.remove('is-liquid-releasing');
        folder.style.removeProperty('border-radius');
        folder.style.removeProperty('--pull-x');
        folder.style.removeProperty('--pull-y');
        folder.style.removeProperty('--liquid-rotate');
        folder.style.removeProperty('--liquid-scale-x');
        folder.style.removeProperty('--liquid-scale-y');
        folder.style.removeProperty('--shine-x');
        folder.style.removeProperty('--shine-y');
        folder.style.removeProperty('--rim-x');
        folder.style.removeProperty('--rim-y');
        folder.style.removeProperty('--shine-rotate');
        folder.style.removeProperty('--content-x');
        folder.style.removeProperty('--content-y');
        folder.style.removeProperty('--lens-x');
        folder.style.removeProperty('--lens-y');
        return;
      }

      state.frame = window.requestAnimationFrame(render);
    };

    const ensureAnimation = () => {
      if (state.frame === null) {
        state.frame = window.requestAnimationFrame(render);
      }
    };

    const updateTarget = (event) => {
      if (!state.active) {
        return;
      }

      const bounds = folder.getBoundingClientRect();
      state.targetX = clamp(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -1, 1);
      state.targetY = clamp(((event.clientY - bounds.top) / bounds.height) * 2 - 1, -1, 1);
      ensureAnimation();
    };

    const createSplash = (event, directionX, directionY) => {
      if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
        return;
      }

      const particleCount = 2;

      for (let particleIndex = 0; particleIndex < particleCount; particleIndex += 1) {
        const particle = document.createElement('span');
        const spread = particleIndex === 0 ? -0.24 : 0.22;
        const distance = particleIndex === 0 ? 42 : 28;
        const perpendicularX = -directionY * spread;
        const perpendicularY = directionX * spread;

        particle.className = 'liquid-splash-particle';
        particle.setAttribute('aria-hidden', 'true');
        particle.style.left = `${event.clientX}px`;
        particle.style.top = `${event.clientY}px`;
        particle.style.setProperty('--splash-size', `${particleIndex === 0 ? 14 : 9}px`);
        particle.style.setProperty(
          '--splash-dx',
          `${(directionX + perpendicularX) * distance}px`
        );
        particle.style.setProperty(
          '--splash-dy',
          `${(directionY + perpendicularY) * distance + 7}px`
        );
        particle.style.setProperty(
          '--splash-mid-dx',
          `${(directionX + perpendicularX) * distance * 0.78}px`
        );
        particle.style.setProperty(
          '--splash-mid-dy',
          `${((directionY + perpendicularY) * distance + 7) * 0.78}px`
        );
        particle.style.setProperty('--splash-spin', `${particleIndex === 0 ? 115 : -90}deg`);
        particle.style.setProperty(
          '--splash-mid-spin',
          `${particleIndex === 0 ? 90 : -70}deg`
        );
        particle.style.setProperty('--splash-delay', `${particleIndex * 35}ms`);
        document.body.appendChild(particle);

        particle.addEventListener('animationend', () => particle.remove(), { once: true });
        window.setTimeout(() => particle.remove(), 900);
      }
    };

    const release = (event) => {
      if (!state.active) {
        return;
      }

      const bounds = folder.getBoundingClientRect();
      const rawX = Number.isFinite(event.clientX)
        ? ((event.clientX - bounds.left) / bounds.width) * 2 - 1
        : state.targetX;
      const rawY = Number.isFinite(event.clientY)
        ? ((event.clientY - bounds.top) / bounds.height) * 2 - 1
        : state.targetY;
      const magnitude = Math.hypot(rawX, rawY) || 1;
      const directionX = rawX / magnitude;
      const directionY = rawY / magnitude;

      state.active = false;
      state.releasing = true;
      state.releaseLockUntil = window.performance.now() + 360;
      state.targetX = 0;
      state.targetY = 0;
      state.velocityX += directionX * 0.42;
      state.velocityY += directionY * 0.42;
      folder.classList.remove('is-liquid-active');
      folder.classList.add('is-liquid-releasing');
      createSplash(event, directionX, directionY);

      window.clearTimeout(state.releaseTimer);
      state.releaseTimer = window.setTimeout(() => {
        state.releasing = false;
        folder.classList.remove('is-liquid-releasing');
        ensureAnimation();
      }, 900);
      ensureAnimation();
    };

    const activate = (event) => {
      if (window.performance.now() < state.releaseLockUntil) {
        return;
      }

      window.clearTimeout(state.releaseTimer);
      state.active = true;
      state.releasing = false;
      folder.classList.remove('is-liquid-releasing');
      folder.classList.add('is-liquid-active');
      updateTarget(event);
    };

    folder.addEventListener('pointerenter', activate);
    folder.addEventListener('pointermove', (event) => {
      if (!state.active) {
        activate(event);
        return;
      }

      updateTarget(event);
    }, { passive: true });
    folder.addEventListener('pointerleave', release);
    folder.addEventListener('pointercancel', release);
    folder.addEventListener('blur', release);
  });
})();
