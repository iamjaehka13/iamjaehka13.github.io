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
    [56, 44, 49, 51, 43, 52, 48, 57]
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
      frame: null
    };

    const setRadius = (x, y, velocityX, velocityY) => {
      const waveX = x * 7 + velocityX * 5;
      const waveY = y * 7 + velocityY * 5;
      const radii = [
        clamp(base[0] + waveX - waveY * 0.35, 34, 66),
        clamp(base[1] - waveX + waveY * 0.2, 34, 66),
        clamp(base[2] - waveX * 0.45 + waveY, 34, 66),
        clamp(base[3] + waveX * 0.55 - waveY, 34, 66),
        clamp(base[4] - waveY + waveX * 0.3, 34, 66),
        clamp(base[5] + waveY - waveX * 0.25, 34, 66),
        clamp(base[6] + waveX + waveY * 0.35, 34, 66),
        clamp(base[7] - waveX - waveY * 0.3, 34, 66)
      ];

      folder.style.borderRadius =
        `${radii[0]}% ${radii[1]}% ${radii[2]}% ${radii[3]}% / ` +
        `${radii[4]}% ${radii[5]}% ${radii[6]}% ${radii[7]}%`;
    };

    const render = () => {
      const spring = state.active ? 0.13 : 0.09;
      const damping = state.active ? 0.72 : 0.78;

      state.velocityX =
        (state.velocityX + (state.targetX - state.x) * spring) * damping;
      state.velocityY =
        (state.velocityY + (state.targetY - state.y) * spring) * damping;
      state.x += state.velocityX;
      state.y += state.velocityY;

      const motion = Math.abs(state.velocityX) + Math.abs(state.velocityY);
      const horizontalStretch = 1 + Math.abs(state.x) * 0.025 + motion * 0.015;
      const verticalStretch = 1 + Math.abs(state.y) * 0.025 + motion * 0.015;

      folder.style.setProperty('--pull-x', `${state.x * 9}px`);
      folder.style.setProperty('--pull-y', `${state.y * 7}px`);
      folder.style.setProperty('--liquid-rotate', `${state.x * 2.6}deg`);
      folder.style.setProperty('--liquid-scale-x', horizontalStretch.toFixed(4));
      folder.style.setProperty('--liquid-scale-y', verticalStretch.toFixed(4));
      folder.style.setProperty('--shine-x', `${clamp(25 + state.x * 17, 11, 43)}%`);
      folder.style.setProperty('--shine-y', `${clamp(16 + state.y * 13, 7, 34)}%`);
      folder.style.setProperty('--rim-x', `${clamp(55 + state.x * 13, 39, 70)}%`);
      folder.style.setProperty('--rim-y', `${clamp(69 + state.y * 9, 57, 80)}%`);
      folder.style.setProperty('--shine-rotate', `${-18 + state.x * 9}deg`);
      folder.style.setProperty('--content-x', `${state.x * -2.2}px`);
      folder.style.setProperty('--content-y', `${state.y * -1.6}px`);
      setRadius(state.x, state.y, state.velocityX, state.velocityY);

      const settled =
        Math.abs(state.targetX - state.x) < 0.002 &&
        Math.abs(state.targetY - state.y) < 0.002 &&
        Math.abs(state.velocityX) < 0.002 &&
        Math.abs(state.velocityY) < 0.002;

      if (settled) {
        state.frame = null;

        if (state.active) {
          return;
        }

        state.x = 0;
        state.y = 0;
        state.velocityX = 0;
        state.velocityY = 0;
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
      const bounds = folder.getBoundingClientRect();
      state.targetX = clamp(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -1, 1);
      state.targetY = clamp(((event.clientY - bounds.top) / bounds.height) * 2 - 1, -1, 1);
      ensureAnimation();
    };

    const release = () => {
      state.active = false;
      state.targetX = 0;
      state.targetY = 0;
      folder.classList.remove('is-liquid-active');
      ensureAnimation();
    };

    folder.addEventListener('pointerenter', (event) => {
      state.active = true;
      folder.classList.add('is-liquid-active');
      updateTarget(event);
    });
    folder.addEventListener('pointermove', updateTarget, { passive: true });
    folder.addEventListener('pointerleave', release);
    folder.addEventListener('pointercancel', release);
    folder.addEventListener('blur', release);
  });
})();
