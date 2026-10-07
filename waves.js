'use strict';

/* ============================================================
   WaveManager – generowanie i spawnowanie fal pojazdów
   ============================================================ */

class WaveManager {
  constructor(game) {
    this.game = game;
    this.queue = [];        // [{type, time}] – czasy względne do startu fali
    this.elapsed = 0;
    this.running = false;
  }

  get active() {
    return this.running && (this.queue.length > 0 || this.game.enemies.length > 0);
  }

  /* Skalowanie trudności */
  static hpMul(n) { return 1 + (n - 1) * 0.11; }
  static speedMul(n) { return 1 + Math.min(0.35, (n - 1) * 0.02); }

  /* Budowa składu fali numer n */
  static buildWave(n) {
    const groups = [];

    // pojazdy "masowe" – najlepiej odblokowane do tej pory
    const fodder = ENEMY_ORDER.filter(k =>
      !ENEMY_TYPES[k].boss && ENEMY_TYPES[k].unlock <= n);
    const pickCount = Math.min(fodder.length, 2 + Math.floor(n / 5));
    const picked = fodder.slice(-pickCount);

    picked.forEach((k, i) => {
      const count = Math.max(4, Math.round(4 + n * 1.0) - i * 3);
      const gap = Math.max(0.4, 0.95 - n * 0.02);
      groups.push({ type: k, count, gap });
    });

    // bossowie – po odblokowaniu, potem co kilka fal
    ENEMY_ORDER.filter(k =>
      ENEMY_TYPES[k].boss && ENEMY_TYPES[k].unlock <= n).forEach(k => {
        const cfg = ENEMY_TYPES[k];
        const extra = Math.floor((n - cfg.unlock) / 4);
        groups.push({ type: k, count: 1 + extra, gap: 2.5 });
      });

    return groups;
  }

  startWave(n) {
    this.queue = [];
    let t = 0.5;
    for (const g of WaveManager.buildWave(n)) {
      for (let i = 0; i < g.count; i++) {
        this.queue.push({ type: g.type, time: t });
        t += g.gap;
      }
      t += 1.2; // przerwa między grupami
    }
    this.elapsed = 0;
    this.running = true;
  }

  update(dt) {
    if (!this.running) return;
    this.elapsed += dt;

    while (this.queue.length && this.queue[0].time <= this.elapsed) {
      const item = this.queue.shift();
      this.game.spawnEnemy(item.type);
    }

    if (this.queue.length === 0 && this.game.enemies.length === 0) {
      this.running = false;
      this.game.onWaveCleared();
    }
  }

  reset() {
    this.queue = [];
    this.running = false;
    this.elapsed = 0;
  }
}
