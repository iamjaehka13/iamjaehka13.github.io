(() => {
  const interactionQuery = window.matchMedia(
    '(min-width: 850px) and (any-hover: hover) and (any-pointer: fine)'
  );
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!interactionQuery.matches || reducedMotionQuery.matches) {
    return;
  }

  const circleRadii = [50, 50, 50, 50, 50, 50, 50, 50];

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
      releaseHoldUntil: 0,
      releaseTimer: null,
      recoilTimer: null,
      baseRadii: [...circleRadii],
      frame: null
    };

    const readComputedRadii = () => {
      const values = getComputedStyle(folder).borderRadius.match(
        /-?\d+(?:\.\d+)?%/g
      );

      if (!values || values.length < circleRadii.length) {
        return [...circleRadii];
      }

      return values
        .slice(0, circleRadii.length)
        .map((value) => Number.parseFloat(value));
    };

    const setRadius = (x, y, velocityX, velocityY) => {
      const base = state.baseRadii;
      const waveX = x * 11 + velocityX * 18;
      const waveY = y * 11 + velocityY * 18;
      const radii = [
        clamp(base[0] + waveX * 0.35 - waveY * 0.25, 34, 66),
        clamp(base[1] - waveX * 0.85 - waveY * 0.25, 34, 66),
        clamp(base[2] - waveX * 0.85 + waveY * 0.25, 34, 66),
        clamp(base[3] + waveX * 0.35 + waveY * 0.25, 34, 66),
        clamp(base[4] + waveY * 0.35 - waveX * 0.15, 34, 66),
        clamp(base[5] + waveY * 0.35 + waveX * 0.15, 34, 66),
        clamp(base[6] - waveY * 0.85 + waveX * 0.15, 34, 66),
        clamp(base[7] - waveY * 0.85 - waveX * 0.15, 34, 66)
      ];

      folder.style.borderRadius =
        `${radii[0]}% ${radii[1]}% ${radii[2]}% ${radii[3]}% / ` +
        `${radii[4]}% ${radii[5]}% ${radii[6]}% ${radii[7]}%`;
    };

    const render = () => {
      const holdingRelease =
        state.releasing && window.performance.now() < state.releaseHoldUntil;
      const spring = state.active
        ? 0.135
        : holdingRelease
          ? 0.09
          : state.releasing
            ? 0.15
            : 0.095;
      const damping = state.active
        ? 0.76
        : holdingRelease
          ? 0.88
          : state.releasing
            ? 0.84
            : 0.82;

      state.velocityX =
        (state.velocityX + (state.targetX - state.x) * spring) * damping;
      state.velocityY =
        (state.velocityY + (state.targetY - state.y) * spring) * damping;
      state.x += state.velocityX;
      state.y += state.velocityY;

      const horizontalStretch =
        clamp(
          1 +
            Math.abs(state.x) * 0.095 +
            Math.abs(state.velocityX) * 0.24 -
            Math.abs(state.y) * 0.028,
          0.91,
          1.22
        );
      const verticalStretch =
        clamp(
          1 +
            Math.abs(state.y) * 0.095 +
            Math.abs(state.velocityY) * 0.24 -
            Math.abs(state.x) * 0.028,
          0.91,
          1.22
        );

      folder.style.setProperty('--pull-x', `${state.x * 20}px`);
      folder.style.setProperty('--pull-y', `${state.y * 18}px`);
      folder.style.setProperty(
        '--liquid-rotate',
        `${state.x * 2.6 - state.x * state.y * 1.2}deg`
      );
      folder.style.setProperty('--liquid-scale-x', horizontalStretch.toFixed(4));
      folder.style.setProperty('--liquid-scale-y', verticalStretch.toFixed(4));
      folder.style.setProperty(
        '--shine-x',
        `${clamp(25 + state.x * 24, 6, 52)}%`
      );
      folder.style.setProperty(
        '--shine-y',
        `${clamp(16 + state.y * 21, 4, 43)}%`
      );
      folder.style.setProperty(
        '--rim-x',
        `${clamp(55 + state.x * 20, 30, 78)}%`
      );
      folder.style.setProperty(
        '--rim-y',
        `${clamp(69 + state.y * 17, 48, 86)}%`
      );
      folder.style.setProperty('--shine-rotate', `${-18 + state.x * 16}deg`);
      folder.style.setProperty('--content-x', `${state.x * -5.5}px`);
      folder.style.setProperty('--content-y', `${state.y * -4.5}px`);
      folder.style.setProperty('--lens-x', `${state.x * -6.5}px`);
      folder.style.setProperty('--lens-y', `${state.y * -5.5}px`);
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
        state.releaseHoldUntil = 0;
        state.baseRadii = [...circleRadii];
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
      const normalizedX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      const normalizedY = ((event.clientY - bounds.top) / bounds.height) * 2 - 1;
      const distance = Math.hypot(normalizedX, normalizedY);
      const edgeGrip =
        0.28 + clamp((distance - 0.15) / 0.85, 0, 1) * 0.87;

      state.targetX = clamp(normalizedX * edgeGrip, -1.25, 1.25);
      state.targetY = clamp(normalizedY * edgeGrip, -1.25, 1.25);
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
        window.clearTimeout(state.recoilTimer);
        state.active = false;
        state.releasing = false;
        state.releaseHoldUntil = 0;
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
      state.releaseLockUntil = window.performance.now() + 520;
      state.releaseHoldUntil = window.performance.now() + 115;
      state.targetX = directionX * 1.18;
      state.targetY = directionY * 1.18;
      state.velocityX += directionX * 0.22;
      state.velocityY += directionY * 0.22;
      folder.classList.remove('is-liquid-active');
      folder.classList.add('is-liquid-releasing');
      createSplash(event, directionX, directionY);

      window.clearTimeout(state.recoilTimer);
      state.recoilTimer = window.setTimeout(() => {
        state.targetX = 0;
        state.targetY = 0;
        ensureAnimation();
      }, 115);

      window.clearTimeout(state.releaseTimer);
      state.releaseTimer = window.setTimeout(() => {
        state.releasing = false;
        folder.classList.remove('is-liquid-releasing');
        ensureAnimation();
      }, 1100);
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
      window.clearTimeout(state.recoilTimer);
      state.baseRadii = readComputedRadii();
      state.active = true;
      state.releasing = false;
      state.releaseHoldUntil = 0;
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
