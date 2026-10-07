'use strict';

/* ============================================================
   GameEngine – pętla requestAnimationFrame, stany gry,
   wejście, aktualizacja i renderowanie sceny
   ============================================================ */

class GameEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');

    this.state = 'MENU';   // MENU | PLAYING | EDITOR | GAME_OVER
    this.map = new GridSystem(DEFAULT_MAP);

    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.effects = [];
    this.floaters = [];

    this.money = START_MONEY;
    this.lives = START_LIVES;
    this.wave = 0;
    this.wavesCleared = 0;   // liczba w pełni odpartych fal
    this.kills = 0;          // zniszczone pojazdy
    this.lastScore = null;
    this.pendingScore = null;
    this.waveInProgress = false;

    this.buildType = null;      // wybrany typ wieżyczki do postawienia
    this.selectedTower = null;  // kliknięta wieżyczka
    this.hover = { c: -1, r: -1, inside: false, x: 0, y: 0 };

    this.pointerDown = false;
    this.flash = 0;             // czerwony błysk przy utracie życia
    this.lastTime = 0;
    this.renderT = 0;           // czas rzeczywisty (do animacji)

    // szybkość rozgrywki (1x / 2x / 3x)
    this.speeds = [1, 2, 3];
    this.speedIndex = 0;

    this.waveMgr = new WaveManager(this);
    this.editor = new MapEditor(this);
    this.ui = new UIController(this);
    this.ui.buildMenu();

    this.bindInput();
    requestAnimationFrame(t => this.loop(t));
  }

  /* ------------------------- STANY / PRZEJŚCIA ------------------------- */

  startGame(mapData) {
    this.map.load(mapData);
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.effects = [];
    this.floaters = [];
    this.money = START_MONEY;
    this.lives = START_LIVES;
    this.wave = 0;
    this.wavesCleared = 0;
    this.kills = 0;
    this.lastScore = null;
    this.pendingScore = null;
    this.waveInProgress = false;
    this.buildType = null;
    this.selectedTower = null;
    this.waveMgr.reset();
    this.state = 'PLAYING';
    this.ui.showOverlay(null);
    this.ui.refreshAll();
  }

  openEditor(mapData) {
    this.editor.loadInto(mapData);
    this.editor.setTool('path');
    this.state = 'EDITOR';
    this.ui.showOverlay(null);
    this.ui.refreshAll();
  }

  backToMenu() {
    this.state = 'MENU';
    this.waveMgr.reset();
    this.ui.buildMenu();
    this.ui.showOverlay('menu');
    this.ui.refreshAll();
  }

  gameOver() {
    this.pendingScore = {
      score: this.score,
      wave: this.wavesCleared,
      money: Math.max(0, this.money)
    };
    this.lastScore = null;
    this.state = 'GAME_OVER';
    this.waveMgr.reset();
    this.ui.showOverlay('gameover');
  }

  /* zapis wyniku do tabeli topów pod nickiem (po przegranej) */
  submitScore(nick) {
    if (!this.pendingScore || this.pendingScore.score <= 0) return null;
    this.lastScore = Highscores.submit(this.map.name, {
      nick,
      score: this.pendingScore.score,
      wave: this.pendingScore.wave,
      money: this.pendingScore.money
    });
    this.ui.renderGameOver();
    return this.lastScore;
  }

  /* wynik bieżącej rozgrywki (używany do tabeli wyników) */
  get score() {
    return this.wavesCleared * 100 + this.kills * 5 + Math.max(0, this.money);
  }

  /* --------------------------- LOGIKA GRY --------------------------- */

  spawnEnemy(type) {
    if (!this.map.path) return;
    const e = new Enemy(type, this.wave, this.map.path, {
      hpMul: WaveManager.hpMul(this.wave),
      speedMul: WaveManager.speedMul(this.wave)
    });
    this.enemies.push(e);
  }

  addMoney(n) {
    this.money += n;
    this.ui.refreshStats();
  }

  /* pojazd zniszczony: nagroda (+ bonus wieży typu Strażnik B), kill, efekty */
  onEnemyKilled(e) {
    let mul = 1;
    for (const t of this.towers) {
      if (t.killBountyMul > 1 && Math.hypot(t.x - e.x, t.y - e.y) <= t.range) {
        mul = Math.max(mul, t.killBountyMul);
      }
    }
    const bounty = Math.round(e.bounty * mul);
    this.addMoney(bounty);
    this.kills++;
    this.addFloater(e.x, e.y - 10, `+${bounty}💰`, '#facc15');
    this.spawnExplosion(e.x, e.y,
      e.cfg.boss ? 26 : 14,
      e.cfg.boss ? '#f97316' : '#facc15');
  }

  spendMoney(n) {
    if (this.money < n) return false;
    this.money -= n;
    this.ui.refreshStats();
    return true;
  }

  startWave() {
    if (this.state !== 'PLAYING' || this.waveInProgress) return;
    this.wave++;
    this.waveInProgress = true;
    this.waveMgr.startWave(this.wave);
    this.ui.refreshStats();
  }

  onWaveCleared() {
    this.waveInProgress = false;
    this.wavesCleared = this.wave;
    const bonus = 20 + this.wave * 5;
    this.addMoney(bonus);
    this.addFloater(CANVAS_W / 2, CANVAS_H / 2, `Fala ${this.wave} odparta! +${bonus}💰`, '#4ade80', 1.6);

    // po "podstawowych" falach mapy włączamy tryb nieskończony
    if (this.wave === TOTAL_WAVES) {
      this.addFloater(CANVAS_W / 2, CANVAS_H / 2 + 26,
        `🏆 Odparto ${TOTAL_WAVES} fal! Tryb nieskończony – trudność rośnie!`, '#facc15', 2.4);
    }
    this.ui.refreshStats();
  }

  enemyEscaped(e) {
    this.lives = Math.max(0, this.lives - e.lifeDamage);
    this.flash = 0.5;
    this.addFloater(this.map.path[this.map.path.length - 1].x,
      this.map.path[this.map.path.length - 1].y - 20,
      `-${e.lifeDamage} ❤️`, '#ef4444', 1.2);
    this.ui.refreshStats();
    if (this.lives <= 0) this.gameOver();
  }

  /* --------------------------- EFEKTY --------------------------- */

  addFloater(x, y, text, color, life = 1) {
    this.floaters.push({ x, y, text, color, life, maxLife: life });
  }

  spawnHit(x, y, color) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 90;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.25 + Math.random() * 0.2,
        maxLife: 0.45,
        size: 2 + Math.random() * 2,
        color
      });
    }
  }

  spawnExplosion(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 50 + Math.random() * 160;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8,
        size: 2 + Math.random() * 4,
        color: Math.random() < 0.5 ? color : '#f97316'
      });
    }
  }

  /* --------------------------- STAWIANIE WIEŻ --------------------------- */

  towerAt(c, r) {
    return this.towers.find(t => t.c === c && t.r === r) || null;
  }

  canPlace(c, r) {
    return this.map.canBuildAt(c, r) && !this.towerAt(c, r);
  }

  placeTower(typeId, c, r) {
    const cfg = TOWER_TYPES[typeId];
    if (!cfg || !this.canPlace(c, r)) return false;
    if (this.money < cfg.cost) {
      this.addFloater(c * TILE + TILE / 2, r * TILE, 'Za mało pieniędzy!', '#ef4444');
      return false;
    }
    this.money -= cfg.cost;
    const t = new Tower(typeId, c * TILE + TILE / 2, r * TILE + TILE / 2, c, r);
    this.towers.push(t);
    this.spawnExplosion(t.x, t.y, 8, cfg.color);
    this.ui.refreshStats();
    this.ui.refreshSelection();
    return true;
  }

  upgradeTower(t) {
    const info = t.upgradeCost;
    if (!info || info.kind === 'max') return;
    if (info.kind === 'spec') return;   // wybór specjalizacji robi się w panelu (A/B)
    if (this.money < info.cost) return;
    this.money -= info.cost;
    t.invested += info.cost;
    t.level++;
    this.spawnExplosion(t.x, t.y, 10, '#facc15');
    this.ui.refreshStats();
    this.ui.refreshSelection();
  }

  /* wybór specjalizacji A/B na 3. poziomie wieżyczki */
  chooseSpec(t, which) {
    if (!t || !t.needsSpec) return false;
    const spec = t.cfg.spec[which];
    if (!spec) return false;
    const cost = t.specCost;
    if (this.money < cost) {
      this.addFloater(t.x, t.y - 22, 'Za mało pieniędzy!', '#ef4444');
      return false;
    }
    this.money -= cost;
    t.invested += cost;
    t.spec = which;
    t.specValue = Object.assign({}, spec);
    t.level = 3;
    this.spawnExplosion(t.x, t.y, 14, '#a78bfa');
    this.ui.refreshStats();
    this.ui.refreshSelection();
    return true;
  }

  sellTower(t) {
    this.money += t.sellValue;
    this.towers = this.towers.filter(x => x !== t);
    this.selectedTower = null;
    this.spawnExplosion(t.x, t.y, 10, '#94a3b8');
    this.ui.refreshStats();
    this.ui.refreshSelection();
  }

  /* --------------------------- WEJŚCIE --------------------------- */

  pointerPos(ev) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (ev.clientX - rect.left) * (CANVAS_W / rect.width);
    const y = (ev.clientY - rect.top) * (CANVAS_H / rect.height);
    return { x, y };
  }

  bindInput() {
    const cv = this.canvas;

    cv.addEventListener('mousemove', ev => {
      const p = this.pointerPos(ev);
      this.hover.x = p.x;
      this.hover.y = p.y;
      const cell = this.map.cellAtPixel(p.x, p.y);
      this.hover.inside = !!cell;
      if (cell) { this.hover.c = cell.c; this.hover.r = cell.r; }

      if (this.state === 'EDITOR' && this.pointerDown && cell) {
        this.editor.paint(cell.c, cell.r, true);
      }
    });

    cv.addEventListener('mousedown', ev => {
      if (ev.button !== 0) return;
      this.pointerDown = true;
      const p = this.pointerPos(ev);
      const cell = this.map.cellAtPixel(p.x, p.y);
      if (!cell) return;

      if (this.state === 'EDITOR') {
        this.editor.paint(cell.c, cell.r, false);
        return;
      }

      if (this.state !== 'PLAYING') return;

      // 1. stawianie wieżyczki
      if (this.buildType) {
        if (this.placeTower(this.buildType, cell.c, cell.r)) {
          // trzymamy narzędzie, by stawiać kolejne (Shift = jednorazowo)
          if (!ev.shiftKey) {
            if (this.money < TOWER_TYPES[this.buildType].cost) this.buildType = null;
          } else {
            this.buildType = null;
          }
        }
        this.ui.refreshShop();
        return;
      }

      // 2. zaznaczenie wieżyczki
      const t = this.towerAt(cell.c, cell.r);
      this.selectedTower = t;
      this.ui.refreshSelection();
    });

    window.addEventListener('mouseup', () => {
      this.pointerDown = false;
      this.editor.endStroke();
    });

    cv.addEventListener('mouseleave', () => {
      this.hover.inside = false;
      this.pointerDown = false;
      this.editor.endStroke();
    });

    cv.addEventListener('contextmenu', ev => {
      ev.preventDefault();
      this.buildType = null;
      this.selectedTower = null;
      this.ui.refreshShop();
      this.ui.refreshSelection();
    });

    window.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') {
        this.buildType = null;
        this.selectedTower = null;
        this.ui.refreshShop();
        this.ui.refreshSelection();
      }
      if (this.state === 'PLAYING') {
        if (ev.key === ' ') { ev.preventDefault(); this.startWave(); }
        const idx = ['1', '2', '3', '4', '5', '6', '7'].indexOf(ev.key);
        if (idx >= 0 && idx < TOWER_ORDER.length) this.ui.selectShop(TOWER_ORDER[idx]);
        if (ev.key === 'f' || ev.key === 'F') this.cycleSpeed();
      }
      if (this.state === 'EDITOR') {
        const map = { p: 'path', s: 'start', e: 'end', o: 'obstacle', x: 'erase' };
        if (map[ev.key.toLowerCase()]) this.editor.setTool(map[ev.key.toLowerCase()]);
      }
    });
  }

  /* --------------------------- PĘTLA --------------------------- */

  get speed() {
    return this.speeds[this.speedIndex] || 1;
  }

  cycleSpeed() {
    this.speedIndex = (this.speedIndex + 1) % this.speeds.length;
    this.ui.refreshStats();
  }

  setSpeed(i) {
    this.speedIndex = ((i % this.speeds.length) + this.speeds.length) % this.speeds.length;
    this.ui.refreshStats();
  }

  loop(ts) {
    // czas rzeczywisty do animacji wizualnych (niezależny od prędkości gry)
    const raw = Math.min(0.05, (ts - this.lastTime) / 1000 || 0);
    this.lastTime = ts;
    this.renderT += raw;

    // dt*prędkość: wyższa prędkość = szybsza symulacja
    const dt = raw * this.speed;

    this.update(dt);
    this.render();

    requestAnimationFrame(t => this.loop(t));
  }

  update(dt) {
    // efekty wizualne zawsze
    if (this.flash > 0) this.flash -= dt;

    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);

    for (const f of this.floaters) {
      f.y -= 28 * dt;
      f.life -= dt;
    }
    this.floaters = this.floaters.filter(f => f.life > 0);

    for (const e of this.effects) e.life -= dt;
    this.effects = this.effects.filter(e => e.life > 0);

    if (this.state !== 'PLAYING') return;

    this.waveMgr.update(dt);

    for (const e of this.enemies) e.update(dt, this);

    // pojazdy dojechały do szlabanu
    for (const e of this.enemies) {
      if (e.escaped && !e.dead && !e.counted) {
        e.counted = true;
        this.enemyEscaped(e);
      }
    }

    for (const t of this.towers) t.update(dt, this);

    for (const pr of this.projectiles) pr.update(dt, this);
    this.projectiles = this.projectiles.filter(p => !p.dead);

    this.enemies = this.enemies.filter(e => !e.dead && !e.escaped);
  }

  /* --------------------------- RENDEROWANIE --------------------------- */

  render() {
    const ctx = this.ctx;
    this.map.draw(ctx);

    // zasięg zaznaczonej wieżyczki
    if (this.selectedTower && this.state === 'PLAYING') {
      this.selectedTower.drawRange(ctx, true);
    }

    for (const t of this.towers) t.render(ctx);
    for (const e of this.enemies) e.render(ctx);
    for (const p of this.projectiles) p.render(ctx);

    // stożek wody
    for (const e of this.effects) {
      if (e.type === 'cone') {
        const a = e.life / e.maxLife;
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.angle);
        ctx.globalAlpha = a * 0.45;
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, e.range, -e.half, e.half);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = a * 0.9;
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }

    // cząsteczki – tryb addytywny (świecące iskry)
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // pływające napisy
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floaters) {
      ctx.globalAlpha = clamp(f.life / f.maxLife, 0, 1);
      ctx.font = 'bold 15px sans-serif';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // podgląd stawiania wieżyczki
    if (this.state === 'PLAYING' && this.buildType && this.hover.inside) {
      const cfg = TOWER_TYPES[this.buildType];
      const c = this.hover.c, r = this.hover.r;
      const cx = c * TILE + TILE / 2, cy = r * TILE + TILE / 2;
      const ok = this.canPlace(c, r) && this.money >= cfg.cost;

      // zasięg (animowana, przerywana linia)
      const off = (performance.now() / 45) % 22;
      ctx.beginPath();
      ctx.arc(cx, cy, cfg.range, 0, Math.PI * 2);
      ctx.fillStyle = ok ? 'rgba(56,189,248,0.12)' : 'rgba(239,68,68,0.14)';
      ctx.fill();
      ctx.setLineDash([8, 14]);
      ctx.lineDashOffset = -off;
      ctx.strokeStyle = ok ? 'rgba(56,189,248,0.85)' : 'rgba(239,68,68,0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;

      ctx.globalAlpha = ok ? 0.95 : 0.55;
      ctx.fillStyle = ok ? 'rgba(34,197,94,0.22)' : 'rgba(239,68,68,0.22)';
      ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
      ctx.strokeStyle = ok ? '#22c55e' : '#ef4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(c * TILE + 2, r * TILE + 2, TILE - 4, TILE - 4);

      ctx.font = '28px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cfg.emoji, cx, cy);
      ctx.globalAlpha = 1;
    }

    // podświetlenie kafelka w edytorze
    if (this.state === 'EDITOR' && this.hover.inside) {
      const c = this.hover.c, r = this.hover.r;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.strokeRect(c * TILE + 1.5, r * TILE + 1.5, TILE - 3, TILE - 3);
    }

    // czerwony błysk przy utracie życia
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(239,68,68,${0.35 * (this.flash / 0.5)})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    // winieta – przyciemnienie krawędzi dla głębi
    const vg = ctx.createRadialGradient(
      CANVAS_W / 2, CANVAS_H / 2, CANVAS_H * 0.42,
      CANVAS_W / 2, CANVAS_H / 2, CANVAS_W * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.game = new GameEngine('game');
});
