import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { VisitorStore, DAY, koreanDate } from './store.mjs';

function storeAt(now) {
  const db = new DatabaseSync(':memory:');
  const storage = {
    sql: { exec(query, ...params) {
      if (query.includes('CREATE TABLE')) { db.exec(query); return; }
      const statement = db.prepare(query);
      const rows = query.startsWith('SELECT') ? statement.all(...params) : (statement.run(...params), []);
      return { toArray: () => rows, one: () => { assert.equal(rows.length, 1); return rows[0]; } };
    } },
    transactionSync(callback) {
      db.exec('BEGIN');
      try { const value = callback(); db.exec('COMMIT'); return value; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    }
  };
  return { store: new VisitorStore(storage, now), db };
}

test('reloads and multiple tabs count one visitor, separate browsers count separately', () => {
  const now = Date.parse('2026-10-20T02:00:00Z');
  const { store, db } = storeAt(now);
  for (let i = 0; i < 20; i++) store.record('browser-a', now + i * 1000);
  store.record('browser-b', now);
  const stats = store.snapshot(now + 20_000);
  assert.equal(stats.today, 2);
  assert.equal(stats.active, 2);
  assert.equal(stats.yesterday, null);
  assert.equal(stats.days.length, 28);
  assert.ok(stats.days.slice(0, -1).every(day => day.visitors === null));
  db.close();
});

test('Korean midnight starts a new day without duplicating realtime users', () => {
  const now = Date.parse('2026-10-20T14:59:00Z');
  const { store, db } = storeAt(now);
  store.record('browser-a', now);
  store.record('browser-a', now + 120_000);
  assert.equal(koreanDate(now + 120_000), '2026-10-21');
  const stats = store.snapshot(now + 120_000);
  assert.equal(stats.today, 1);
  assert.equal(stats.yesterday, 1);
  assert.equal(stats.active, 1);
  db.close();
});

test('presence expires after five minutes and heartbeat renews it', () => {
  const now = Date.parse('2026-10-20T02:00:00Z');
  const { store, db } = storeAt(now);
  store.record('browser-a', now);
  assert.equal(store.snapshot(now + 300_000).active, 0);
  store.record('browser-a', now + 300_001);
  assert.equal(store.snapshot(now + 300_002).active, 1);
  assert.equal(store.snapshot(now + 300_002).today, 1);
  db.close();
});

test('expired identifiers disappear but aggregates survive and missing days are zero', () => {
  const now = Date.parse('2026-10-20T02:00:00Z');
  const { store, db } = storeAt(now);
  store.record('browser-a', now);
  store.prune(now + 2 * DAY);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM visits').get().n, 0);
  const stats = store.snapshot(now + 2 * DAY);
  assert.equal(stats.days[25].visitors, 1);
  assert.equal(stats.yesterday, 0);
  assert.equal(stats.today, 0);
  db.close();
});
