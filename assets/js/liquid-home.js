(() => {
  const interactionQuery = window.matchMedia(
    '(min-width: 850px) and (any-hover: hover) and (any-pointer: fine)'
  );
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!interactionQuery.matches || reducedMotionQuery.matches) {
    return;
  }

  const shapes = [
    [64, 36, 52, 48, 45, 58, 42, 55],
    [46, 54, 68, 32, 58, 38, 62, 42],
    [38, 62, 44, 56, 57, 35, 65, 43],
    [56, 44, 61, 39, 38, 66, 34, 62],
    [37, 63, 48, 52, 66, 34, 58, 42],
    [68, 32, 47, 53, 42, 62, 38, 58],
    [43, 57, 65, 35, 55, 41, 59, 45],
    [61, 39, 35, 65, 44, 67, 33, 56]
  ];

  const clamp = (value, minimum, maximum) =>
    Math.min(Math.max(value, minimum), maximum);

  const home = document.querySelector('.liquid-home');
  const grid = home?.querySelector('.liquid-folder-grid');
  const folders = Array.from(home?.querySelectorAll('.liquid-folder') ?? []);

  if (!home || !grid || folders.length < 2) {
    return;
  }

  const fullTurn = Math.PI * 2;
  const orbitStep = fullTurn / folders.length;
  const initialOrbitOffset = Math.PI - orbitStep / 2;
  const orbit = {
    rotation: 0,
    targetRotation: 0,
    velocity: 0,
    movingUntil: 0,
    snapTimer: null,
    frame: null
  };

  const isOrbitMoving = () =>
    orbit.frame !== null || window.performance.now() < orbit.movingUntil;

  const renderOrbit = () => {
    const bounds = grid.getBoundingClientRect();
    const radiusX = clamp(bounds.width * (bounds.width < 700 ? 0.43 : 0.39), 185, 560);
    const radiusY = clamp(bounds.height * 0.25, 122, 172);

    folders.forEach((folder, index) => {
      const angle = initialOrbitOffset + index * orbitStep + orbit.rotation;
      const depth = (1 - Math.cos(angle)) / 2;
      const x = Math.sin(angle) * radiusX;
      const y = -Math.cos(angle) * radiusY;
      const z = -260 + depth * 380;
      const scale = 0.62 + depth * 0.4;
      const opacity = 0.36 + depth * 0.64;
      const rotateY = -Math.sin(angle) * 30;

      folder.style.setProperty('--orbit-x', `${x.toFixed(3)}px`);
      folder.style.setProperty('--orbit-y', `${y.toFixed(3)}px`);
      folder.style.setProperty('--orbit-z', `${z.toFixed(3)}px`);
      folder.style.setProperty('--orbit-scale', scale.toFixed(4));
      folder.style.setProperty('--orbit-rotate-y', `${rotateY.toFixed(3)}deg`);
      folder.style.setProperty('--orbit-opacity', opacity.toFixed(4));
      folder.style.zIndex = `${Math.round(20 + depth * 80)}`;
      folder.style.pointerEvents = depth > 0.16 ? 'auto' : 'none';
      folder.dataset.orbitDepth = depth.toFixed(4);
    });
  };

  const animateOrbit = () => {
    const difference = orbit.targetRotation - orbit.rotation;
    orbit.velocity = (orbit.velocity + difference * 0.11) * 0.8;
    orbit.rotation += orbit.velocity;
    renderOrbit();

    const settled = Math.abs(difference) < 0.0004 && Math.abs(orbit.velocity) < 0.0004;

    if (settled) {
      orbit.rotation = orbit.targetRotation;
      orbit.velocity = 0;
      orbit.frame = null;
      orbit.movingUntil = window.performance.now() + 80;
      renderOrbit();
      return;
    }

    orbit.frame = window.requestAnimationFrame(animateOrbit);
  };

  const ensureOrbitAnimation = () => {
    if (orbit.frame === null) {
      orbit.frame = window.requestAnimationFrame(animateOrbit);
    }
  };

  const queueOrbitSnap = () => {
    window.clearTimeout(orbit.snapTimer);
    orbit.snapTimer = window.setTimeout(() => {
      orbit.targetRotation = Math.round(orbit.targetRotation / orbitStep) * orbitStep;
      orbit.movingUntil = window.performance.now() + 280;
      ensureOrbitAnimation();
    }, 140);
  };

  const rotateFocusedFolderToFront = (index) => {
    const baseAngle = initialOrbitOffset + index * orbitStep;
    const frontRotation = Math.PI - baseAngle;
    const nearestTurn =
      frontRotation + Math.round((orbit.rotation - frontRotation) / fullTurn) * fullTurn;

    orbit.targetRotation = nearestTurn;
    orbit.movingUntil = window.performance.now() + 320;
    ensureOrbitAnimation();
  };

  home.classList.add('is-orbit-ready');
  grid.tabIndex = 0;
  grid.setAttribute('aria-label', '마우스 휠 또는 방향키로 회전하는 분야별 글 폴더');
  grid.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown');
  renderOrbit();

  grid.addEventListener('wheel', (event) => {
    if (event.ctrlKey) {
      return;
    }

    event.preventDefault();

    let delta =
      Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;

    if (event.deltaMode === 1) {
      delta *= 16;
    } else if (event.deltaMode === 2) {
      delta *= window.innerHeight;
    }

    delta = clamp(delta, -180, 180);

    const direction = Math.sign(delta);
    const isDiscreteWheel = event.deltaMode !== 0 || Math.abs(delta) >= 40;

    if (isDiscreteWheel) {
      window.clearTimeout(orbit.snapTimer);
      orbit.targetRotation =
        Math.round(orbit.targetRotation / orbitStep) * orbitStep +
        direction * orbitStep;
      orbit.velocity += direction * 0.032;
    } else {
      orbit.targetRotation += delta * 0.006;
      orbit.velocity += delta * 0.00028;
      queueOrbitSnap();
    }

    orbit.movingUntil = window.performance.now() + 320;
    ensureOrbitAnimation();
  }, { passive: false });

  grid.addEventListener('keydown', (event) => {
    const direction =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;

    if (direction === 0) {
      return;
    }

    event.preventDefault();
    orbit.targetRotation += direction * orbitStep;
    orbit.movingUntil = window.performance.now() + 320;
    ensureOrbitAnimation();
  });

  window.addEventListener('resize', () => {
    orbit.movingUntil = window.performance.now() + 140;
    renderOrbit();
  }, { passive: true });

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

      if (isOrbitMoving()) {
        state.active = false;
        state.releasing = false;
        state.targetX = 0;
        state.targetY = 0;
        folder.classList.remove('is-liquid-active', 'is-liquid-releasing');
        ensureAnimation();
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
      if (
        isOrbitMoving() ||
        window.performance.now() < state.releaseLockUntil
      ) {
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
    folder.addEventListener('focus', () => rotateFocusedFolderToFront(index));
  });
})();
