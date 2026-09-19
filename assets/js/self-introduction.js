(() => {
  const slides = [...document.querySelectorAll('.slide')];
  const picker = document.getElementById('section-select');
  const previous = document.getElementById('previous');
  const next = document.getElementById('next');
  const fullscreen = document.getElementById('fullscreen');
  const labels = [...picker.options].map(option => option.textContent.split(' · ')[1]);
  let index = 0;

  function showSlide(target, focus = false) {
    index = Math.max(0, Math.min(slides.length - 1, target));
    slides.forEach((slide, position) => {
      slide.hidden = position !== index;
      if (position !== index) slide.querySelectorAll('video').forEach(video => video.pause());
    });
    const motion = slides[index].querySelector('[data-motion]');
    if (motion && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const animated = new Image();
      animated.onload = () => { motion.src = animated.src; };
      animated.src = motion.dataset.motion;
      motion.removeAttribute('data-motion');
    }
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      slides[index].querySelectorAll('video[data-autoplay]').forEach(video => {
        const play = () => {
          const start = Number(video.dataset.start || 0);
          if (Number.isFinite(start) && start > 0 && video.currentTime < start) video.currentTime = start;
          video.play().catch(() => {});
        };
        if (video.readyState >= 1) play();
        else video.addEventListener('loadedmetadata', play, { once: true });
      });
    }
    picker.value = String(index);
    previous.disabled = index === 0;
    next.disabled = index === slides.length - 1;
    document.getElementById('slide-count').textContent = `${String(index + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    document.getElementById('deck-progress').style.width = `${(index + 1) / slides.length * 100}%`;
    document.getElementById('deck-label').textContent = labels[index];
    window.history.replaceState(null, '', `#${index + 1}`);
    window.scrollTo(0, 0);
    if (focus) slides[index].querySelector('h1, h2').focus({ preventScroll: true });
  }

  function readHash() {
    const value = Number(window.location.hash.slice(1));
    showSlide(Number.isInteger(value) && value > 0 ? value - 1 : 0);
  }

  previous.addEventListener('click', () => showSlide(index - 1, true));
  next.addEventListener('click', () => showSlide(index + 1, true));
  picker.addEventListener('change', () => showSlide(Number(picker.value), true));
  window.addEventListener('hashchange', readHash);
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest('select, input, textarea, button, a, video')) return;
    const direction = { ArrowRight: 1, PageDown: 1, ArrowLeft: -1, PageUp: -1 }[event.key];
    if (direction) { event.preventDefault(); showSlide(index + direction, true); }
    if (event.key === 'Home') { event.preventDefault(); showSlide(0, true); }
    if (event.key === 'End') { event.preventDefault(); showSlide(slides.length - 1, true); }
  });

  if (!document.documentElement.requestFullscreen) fullscreen.hidden = true;
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      fullscreen.title = '브라우저에서 전체 화면을 사용할 수 없습니다';
    }
  });
  document.addEventListener('fullscreenchange', () => {
    const active = Boolean(document.fullscreenElement);
    document.body.classList.toggle('fullscreen-active', active);
    fullscreen.setAttribute('aria-pressed', String(active));
    fullscreen.setAttribute('aria-label', active ? '전체 화면 종료' : '전체 화면');
    fullscreen.title = active ? '전체 화면 종료' : '전체 화면';
    fullscreen.querySelector('i').className = `fas fa-${active ? 'compress' : 'expand'}`;
  });
  document.getElementById('print').addEventListener('click', () => window.print());
  document.body.classList.add('deck-ready');
  document.querySelector('.deck-controls').hidden = false;
  readHash();
})();
