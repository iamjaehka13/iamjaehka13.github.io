(() => {
  const desktopQuery = window.matchMedia('(min-width: 850px)');
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!desktopQuery.matches) {
    return;
  }

  const home = document.querySelector('.solar-home');
  const system = home?.querySelector('.solar-system');
  const planets = Array.from(home?.querySelectorAll('.solar-planet') ?? []);
  const orbits = Array.from(home?.querySelectorAll('.solar-orbit') ?? []);

  if (!home || !system || planets.length === 0 || planets.length !== orbits.length) {
    return;
  }

  const clamp = (value, minimum, maximum) =>
    Math.min(Math.max(value, minimum), maximum);
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const autoOrbitRate = 0.000014;
  const planetCount = planets.length;
  const motion = {
    time: 0,
    targetTime: 0,
    velocity: 0,
    frame: null,
    lastFrameTime: null
  };

  const orbitRadii = (orbitIndex, bounds) => {
    const progress = planetCount === 1 ? 0 : (orbitIndex - 1) / (planetCount - 1);
    const easedProgress = Math.pow(progress, 0.9);
    const minimumRadiusX = clamp(bounds.width * 0.078, 76, 96);
    const maximumRadiusX = clamp(bounds.width * 0.4, 232, 520);
    const minimumRadiusY = clamp(bounds.height * 0.082, 44, 62);
    const maximumRadiusY = clamp(bounds.height * 0.355, 150, 270);

    return {
      x: minimumRadiusX + (maximumRadiusX - minimumRadiusX) * easedProgress,
      y: minimumRadiusY + (maximumRadiusY - minimumRadiusY) * easedProgress
    };
  };

  const renderSystem = () => {
    const bounds = system.getBoundingClientRect();

    planets.forEach((planet, index) => {
      const orbitIndex = Number.parseInt(planet.dataset.orbitIndex, 10);
      const startAngle = toRadians(Number.parseFloat(planet.dataset.startAngle));
      const orbitSpeed = Number.parseFloat(planet.dataset.orbitSpeed);
      const radii = orbitRadii(orbitIndex, bounds);
      const angle = startAngle + motion.time * orbitSpeed;
      const x = Math.cos(angle) * radii.x;
      const y = Math.sin(angle) * radii.y;
      const depth = (Math.sin(angle) + 1) / 2;
      const scale = 0.82 + depth * 0.2;
      const opacity = 0.58 + depth * 0.42;
      const orbit = orbits[index];

      orbit.style.setProperty('--orbit-width', `${(radii.x * 2).toFixed(3)}px`);
      orbit.style.setProperty('--orbit-height', `${(radii.y * 2).toFixed(3)}px`);

      planet.style.setProperty('--planet-x', `${x.toFixed(3)}px`);
      planet.style.setProperty('--planet-y', `${y.toFixed(3)}px`);
      planet.style.setProperty('--planet-scale', scale.toFixed(4));
      planet.style.setProperty('--planet-opacity', opacity.toFixed(4));
      planet.style.zIndex = `${Math.round(30 + depth * 60)}`;
      planet.style.pointerEvents = 'auto';
      planet.dataset.orbitDepth = depth.toFixed(4);
    });
  };

  const animateSystem = (frameTime) => {
    if (reducedMotionQuery.matches) {
      motion.time = motion.targetTime;
      motion.velocity = 0;
      motion.frame = null;
      motion.lastFrameTime = null;
      renderSystem();
      return;
    }

    const elapsed =
      motion.lastFrameTime === null
        ? 0
        : clamp(frameTime - motion.lastFrameTime, 0, 50);
    motion.lastFrameTime = frameTime;
    motion.targetTime += elapsed * autoOrbitRate;

    const difference = motion.targetTime - motion.time;
    motion.velocity = (motion.velocity + difference * 0.095) * 0.79;
    motion.time += motion.velocity;
    renderSystem();

    motion.frame = window.requestAnimationFrame(animateSystem);
  };

  const requestSystemAnimation = () => {
    if (reducedMotionQuery.matches) {
      motion.time = motion.targetTime;
      motion.velocity = 0;
      renderSystem();
      return;
    }

    if (motion.frame === null) {
      motion.lastFrameTime = null;
      motion.frame = window.requestAnimationFrame(animateSystem);
    }
  };

  const advanceSystem = (amount, impulse = 0) => {
    motion.targetTime += amount;
    motion.velocity += impulse;
    requestSystemAnimation();
  };

  const projectedPlanetAt = (clientX, clientY) =>
    planets
      .map((planet) => {
        const bounds = planet.getBoundingClientRect();
        const normalizedX =
          (clientX - (bounds.left + bounds.width / 2)) / (bounds.width / 2);
        const normalizedY =
          (clientY - (bounds.top + bounds.height / 2)) / (bounds.height / 2);

        return {
          planet,
          depth: Number.parseFloat(planet.dataset.orbitDepth) || 0,
          distance: Math.hypot(normalizedX, normalizedY)
        };
      })
      .filter(({ distance }) => distance <= 0.96)
      .sort(
        (left, right) =>
          right.depth - left.depth || left.distance - right.distance
      )[0]?.planet ?? null;

  home.classList.add('is-solar-ready');
  system.tabIndex = 0;
  system.setAttribute(
    'aria-description',
    '마우스 휠 또는 방향키로 공전시키는 분야별 태양계'
  );
  system.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown');
  renderSystem();
  requestSystemAnimation();

  let isForwardingProjectedClick = false;

  home.addEventListener('click', (event) => {
    if (isForwardingProjectedClick || event.button !== 0) {
      return;
    }

    const projectedPlanet = projectedPlanetAt(event.clientX, event.clientY);
    const directPlanet =
      event.target instanceof Element
        ? event.target.closest('.solar-planet')
        : null;

    if (!projectedPlanet || directPlanet === projectedPlanet) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    isForwardingProjectedClick = true;

    try {
      projectedPlanet.click();
    } finally {
      isForwardingProjectedClick = false;
    }
  });

  system.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey) {
        return;
      }

      event.preventDefault();

      let delta =
        Math.abs(event.deltaY) >= Math.abs(event.deltaX)
          ? event.deltaY
          : event.deltaX;

      if (event.deltaMode === 1) {
        delta *= 16;
      } else if (event.deltaMode === 2) {
        delta *= window.innerHeight;
      }

      delta = clamp(delta, -180, 180);

      if (Math.abs(delta) >= 40 || event.deltaMode !== 0) {
        const direction = Math.sign(delta);
        advanceSystem(direction * 0.18, direction * 0.012);
      } else {
        advanceSystem(delta * 0.0015, delta * 0.00008);
      }
    },
    { passive: false }
  );

  system.addEventListener('keydown', (event) => {
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
    advanceSystem(direction * 0.18, direction * 0.012);
  });

  system.addEventListener(
    'pointermove',
    (event) => {
      const bounds = system.getBoundingClientRect();
      const normalizedX = clamp(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -1,
        1
      );
      const normalizedY = clamp(
        ((event.clientY - bounds.top) / bounds.height) * 2 - 1,
        -1,
        1
      );

      home.style.setProperty('--sun-shift-x', `${(normalizedX * 5).toFixed(3)}px`);
      home.style.setProperty('--sun-shift-y', `${(normalizedY * 4).toFixed(3)}px`);
    },
    { passive: true }
  );

  planets.forEach((planet) => {
    const body = planet.querySelector('.solar-planet__body');

    const updateTilt = (event) => {
      if (!body) {
        return;
      }

      const bounds = body.getBoundingClientRect();
      const normalizedX = clamp(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -1,
        1
      );
      const normalizedY = clamp(
        ((event.clientY - bounds.top) / bounds.height) * 2 - 1,
        -1,
        1
      );

      planet.style.setProperty('--planet-tilt-x', `${(-normalizedY * 7).toFixed(3)}deg`);
      planet.style.setProperty('--planet-tilt-y', `${(normalizedX * 8).toFixed(3)}deg`);
      planet.style.setProperty('--surface-shift-x', `${(normalizedX * 6).toFixed(3)}px`);
      planet.style.setProperty('--surface-shift-y', `${(normalizedY * 5).toFixed(3)}px`);
    };

    const resetTilt = () => {
      planet.classList.remove('is-planet-active');
      planet.style.removeProperty('--planet-tilt-x');
      planet.style.removeProperty('--planet-tilt-y');
      planet.style.removeProperty('--surface-shift-x');
      planet.style.removeProperty('--surface-shift-y');
    };

    planet.addEventListener('pointerenter', (event) => {
      planet.classList.add('is-planet-active');
      updateTilt(event);
    });
    planet.addEventListener('pointermove', updateTilt, { passive: true });
    planet.addEventListener('pointerleave', resetTilt);
    planet.addEventListener('pointercancel', resetTilt);
    planet.addEventListener('blur', resetTilt);
  });

  window.addEventListener(
    'resize',
    () => {
      renderSystem();
    },
    { passive: true }
  );

  reducedMotionQuery.addEventListener('change', () => {
    if (reducedMotionQuery.matches && motion.frame !== null) {
      window.cancelAnimationFrame(motion.frame);
      motion.frame = null;
      motion.lastFrameTime = null;
      motion.time = motion.targetTime;
      motion.velocity = 0;
      renderSystem();
      return;
    }

    requestSystemAnimation();
  });
})();
