(() => {
  'use strict';
  const script = document.querySelector('script[data-visitors-endpoint]');
  if (!script) return;
  const endpoint = script.dataset.visitorsEndpoint.replace(/\/$/, '');
  const storageKey = 'jaehka13-public-visitor-v1';
  const number = new Intl.NumberFormat('ko-KR');
  const statuses = document.querySelectorAll('[data-visitor-status]');
  let busy = false;
  let lastAttempt = 0;
  let lastUpdate = null;

  function visitorId() {
    if (script.dataset.visitorsTrack !== 'true' ||
        !['iamjaehka13.blog', 'iamjaehka13.github.io'].includes(location.hostname) ||
        navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return null;
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (stored && /^[0-9a-f-]{36}$/i.test(stored.id) && stored.expires > Date.now()) return stored.id;
      const id = crypto.randomUUID();
      localStorage.setItem(storageKey, JSON.stringify({ id, expires: Date.now() + 30 * 86_400_000 }));
      return id;
    } catch { return null; } // Never count each page as a new person when storage is blocked.
  }

  function status(message) { statuses.forEach(node => { node.textContent = message; }); }

  function render(data) {
    for (const key of ['active', 'today', 'yesterday']) {
      if (data[key] !== null && (!Number.isSafeInteger(data[key]) || data[key] < 0)) throw new Error('Invalid counts');
    }
    if (!Array.isArray(data.days) || data.days.length !== 28) throw new Error('Invalid history');
    for (const day of data.days) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) ||
          (day.visitors !== null && (!Number.isSafeInteger(day.visitors) || day.visitors < 0))) throw new Error('Invalid history');
    }
    document.querySelectorAll('[data-visitor-value]').forEach(node => {
      const value = data[node.dataset.visitorValue];
      node.textContent = value === null ? '집계 전' : number.format(value);
      node.toggleAttribute('data-unavailable', value === null);
    });
    document.querySelectorAll('[data-visitor-yesterday-unit]').forEach(node => { node.hidden = data.yesterday === null; });
    document.querySelectorAll('[data-visitor-history]').forEach(body => {
      const fragment = document.createDocumentFragment();
      const max = Math.max(1, ...data.days.map(day => day.visitors || 0));
      [...data.days].reverse().forEach(day => {
        const row = document.createElement('tr');
        const date = document.createElement('th');
        date.scope = 'row'; date.textContent = day.date;
        const count = document.createElement('td');
        count.textContent = day.visitors === null ? '집계 전' : `${number.format(day.visitors)}명`;
        const comparison = document.createElement('td');
        const bar = document.createElement('span');
        bar.className = 'visitor-history__bar';
        bar.style.width = `${(day.visitors || 0) / max * 100}%`;
        bar.setAttribute('aria-hidden', 'true');
        comparison.append(bar); row.append(date, count, comparison); fragment.append(row);
      });
      body.replaceChildren(fragment);
    });
    lastUpdate = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(data.updatedAt));
    status(`한국 시간 ${lastUpdate} 갱신 · ${data.startedOn}부터 집계`);
  }

  async function refresh() {
    if (document.hidden || busy || Date.now() - lastAttempt < 30_000) return;
    busy = true; lastAttempt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const id = visitorId();
      const options = { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', signal: controller.signal };
      if (id) Object.assign(options, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitorId: id }) });
      const response = await fetch(`${endpoint}/${id ? 'visit' : 'stats'}`, options);
      if (!response.ok) throw new Error('Unavailable');
      render(await response.json());
    } catch {
      status(lastUpdate ? `갱신이 지연되고 있습니다 · 마지막 갱신 ${lastUpdate} (한국 시간)` : '방문자 수에 연결할 수 없습니다. 잠시 후 다시 확인해 주세요.');
      if (!lastUpdate) document.querySelectorAll('[data-visitor-history]').forEach(body => {
        body.replaceChildren();
        const row = document.createElement('tr');
        const cell = document.createElement('td'); cell.colSpan = 3;
        cell.textContent = '현재 통계를 불러올 수 없습니다.'; row.append(cell); body.append(row);
      });
    } finally { clearTimeout(timeout); busy = false; }
  }
  refresh();
  setInterval(refresh, 60_000);
  document.addEventListener('visibilitychange', refresh);
})();
