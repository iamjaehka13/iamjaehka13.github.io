export const DAY = 86_400_000;
export const ACTIVE_WINDOW = 5 * 60_000;

export function koreanDate(now) {
  return new Date(now + 9 * 60 * 60_000).toISOString().slice(0, 10);
}

// Both Cloudflare's SQL storage and the test adapter use bound parameters.
export class VisitorStore {
  constructor(storage, now = Date.now()) {
    this.storage = storage;
    this.sql = storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS daily (day TEXT PRIMARY KEY, visitors INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS visits (
        day TEXT NOT NULL, visitor TEXT NOT NULL, last_seen INTEGER NOT NULL,
        PRIMARY KEY (day, visitor)
      );
      CREATE INDEX IF NOT EXISTS visits_last_seen ON visits(last_seen);
    `);
    this.sql.exec('INSERT OR IGNORE INTO metadata VALUES (?, ?)', 'startedOn', koreanDate(now));
  }

  record(visitor, now) {
    const day = koreanDate(now);
    this.storage.transactionSync(() => {
      const existing = this.sql.exec(
        'SELECT last_seen FROM visits WHERE day = ? AND visitor = ?', day, visitor
      ).toArray()[0];
      if (!existing) {
        this.sql.exec('INSERT INTO visits VALUES (?, ?, ?)', day, visitor, now);
        this.sql.exec(`INSERT INTO daily VALUES (?, 1)
          ON CONFLICT(day) DO UPDATE SET visitors = visitors + 1`, day);
      } else if (now - existing.last_seen >= 45_000) {
        this.sql.exec('UPDATE visits SET last_seen = ? WHERE day = ? AND visitor = ?', now, day, visitor);
      }
    });
  }

  prune(now) {
    // Keep today and yesterday for midnight-safe presence; keep only aggregate history thereafter.
    this.sql.exec('DELETE FROM visits WHERE day < ?', koreanDate(now - DAY));
  }

  snapshot(now) {
    const today = koreanDate(now);
    const startedOn = this.sql.exec('SELECT value FROM metadata WHERE key = ?', 'startedOn').one().value;
    const recent = new Map(this.sql.exec(
      'SELECT day, visitors FROM daily WHERE day >= ? ORDER BY day', koreanDate(now - 27 * DAY)
    ).toArray().map(row => [row.day, row.visitors]));
    const days = Array.from({ length: 28 }, (_, i) => {
      const date = koreanDate(now - (27 - i) * DAY);
      return { date, visitors: date < startedOn ? null : (recent.get(date) || 0) };
    });
    return {
      timezone: 'Asia/Seoul', startedOn, updatedAt: new Date(now).toISOString(),
      activeWindowMinutes: 5,
      active: this.sql.exec('SELECT COUNT(DISTINCT visitor) AS count FROM visits WHERE last_seen > ?', now - ACTIVE_WINDOW).one().count,
      today: recent.get(today) || 0,
      yesterday: days[26].visitors,
      days
    };
  }
}
