import { DurableObject } from 'cloudflare:workers';
import { VisitorStore } from './store.mjs';

export class BlogVisitors extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.store = new VisitorStore(ctx.storage);
    this.lastPruned = 0;
  }

  async stats(visitor = null) {
    const now = Date.now();
    if (now - this.lastPruned > 3_600_000) {
      this.store.prune(now);
      this.lastPruned = now;
    }
    if (visitor) this.store.record(visitor, now);
    // An alarm removes old identifiers even when no one returns to the blog.
    if (!(await this.ctx.storage.getAlarm())) {
      await this.ctx.storage.setAlarm(now + 3_600_000);
    }
    return this.store.snapshot(now);
  }

  async alarm() {
    this.store.prune(Date.now());
    const remaining = this.ctx.storage.sql.exec('SELECT COUNT(*) AS count FROM visits').one().count;
    if (remaining) await this.ctx.storage.setAlarm(Date.now() + 3_600_000);
  }
}

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function readVisit(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  let size = 0;
  const chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 256) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const body = JSON.parse(new TextDecoder().decode(bytes));
    return typeof body?.visitorId === 'string' && idPattern.test(body.visitorId) ? body.visitorId.toLowerCase() : null;
  } catch { return null; }
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    const origin = request.headers.get('Origin');
    const allowed = env.ALLOWED_ORIGINS.split(',').includes(origin);
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff'
    };
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (request.method === 'OPTIONS' && path === '/visit' && allowed) {
      return new Response(null, { status: 204, headers: {
        ...headers, 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin',
        'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      } });
    }
    if (request.method === 'GET' && path === '/stats') {
      try { return json(await env.VISITORS.getByName('blog').stats()); }
      catch { return json({ error: 'Temporarily unavailable' }, 503); }
    }
    if (request.method !== 'POST' || path !== '/visit') return json({ error: 'Not found' }, 404);
    if (!allowed) return json({ error: 'Origin not allowed' }, 403);
    // This limits accidental loops and casual abuse; a public counter is not fraud-proof.
    if (env.VISIT_LIMITER) {
      const { success } = await env.VISIT_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' });
      if (!success) return json({ error: 'Too many requests' }, 429);
    }
    const visitorId = await readVisit(request);
    if (!visitorId) return json({ error: 'Invalid visit' }, 400);
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(visitorId));
    const visitor = Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('');
    try {
      return json(await env.VISITORS.getByName('blog').stats(visitor));
    } catch {
      return json({ error: 'Temporarily unavailable' }, 503);
    }
  }
};
