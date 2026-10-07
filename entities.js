'use strict';

/* ============================================================
   Encje: Enemy (pojazd), Tower (wieżyczka), Projectile (pocisk)
   ============================================================ */

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

/* ------------------------------- ENEMY ------------------------------- */
class Enemy {
  constructor(typeId, wave, pathPoints, opts) {
    const cfg = ENEMY_TYPES[typeId];
    this.cfg = cfg;
    this.type = typeId;
    this.wave = wave;

    this.maxHp = Math.round(cfg.hp * opts.hpMul);
    this.hp = this.maxHp;
    this.baseSpeed = cfg.speed * opts.speedMul;
    this.bounty = cfg.bounty + Math.floor(wave / 2);
    this.lifeDamage = cfg.lifeDamage;

    // ścieżka: dron leci na wprost START -> END
    this.points = cfg.straight
      ? [pathPoints[0], pathPoints[pathPoints.length - 1]]
      : pathPoints.slice();

    this.x = this.points[0].x;
    this.y = this.points[0].y;
    this.seg = 0;
    this.angle = 0;
    this.traveled = 0;

    this.slowAmt = 0;
    this.slowTimer = 0;
    this.hitFlash = 0;
    this.dead = false;
    this.escaped = false;
    this.size = cfg.size;

    // efekty specjalne (radar, strażak B)
    this.vulnPct = 0;      // dodatkowe obrażenia przyjmowane (0.4 = +40%)
    this.vulnTimer = 0;
    this.burnDps = 0;      // obrażenia w czasie
    this.burnTimer = 0;

    this.updateAngle();
  }

  get progress() { return this.traveled; }

  updateAngle() {
    const next = this.points[this.seg + 1];
    if (next) this.angle = Math.atan2(next.y - this.y, next.x - this.x);
  }

  applySlow(amount, duration) {
    const eff = amount * (1 - (this.cfg.slowResist || 0));
    if (eff <= 0) return;
    // bierzemy najsilniejsze spowolnienie
    if (eff >= this.slowAmt || this.slowTimer <= 0) {
      this.slowAmt = eff;
      this.slowTimer = duration;
    } else {
      this.slowTimer = Math.max(this.slowTimer, duration);
    }
  }

  /* radar: strefa podatności na obrażenia */
  setVuln(pct, dur) {
    if (pct <= 0) return;
    this.vulnPct = Math.max(this.vulnPct, pct);
    this.vulnTimer = Math.max(this.vulnTimer, dur);
  }

  /* strażak (spec B): piana gaśnicza – obrażenia w czasie */
  applyBurn(dps, dur) {
    if (dps <= 0) return;
    this.burnDps = Math.max(this.burnDps, dps);
    this.burnTimer = Math.max(this.burnTimer, dur);
  }

  /* dźwig: cofa pojazd wzdłuż ścieżki (do przodu liczone od startu) */
  pullBack(distance) {
    const target = Math.max(0, this.traveled - distance);
    let acc = 0;
    const pts = this.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      if (acc + segLen >= target) {
        const t = (target - acc) / segLen;
        this.x = a.x + (b.x - a.x) * t;
        this.y = a.y + (b.y - a.y) * t;
        this.seg = i;
        this.traveled = target;
        this.updateAngle();
        return;
      }
      acc += segLen;
    }
    const last = pts[pts.length - 1];
    this.x = last.x;
    this.y = last.y;
    this.traveled = target;
  }

  takeDamage(amount, game) {
    if (this.dead) return;
    this.hp -= amount * (1 + this.vulnPct);
    this.hitFlash = 0.12;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      if (game) game.onEnemyKilled(this);
    }
  }

  update(dt, game) {
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) { this.slowAmt = 0; this.slowTimer = 0; }
    }
    if (this.vulnTimer > 0) {
      this.vulnTimer -= dt;
      if (this.vulnTimer <= 0) { this.vulnPct = 0; this.vulnTimer = 0; }
    }
    if (this.burnTimer > 0) {
      this.burnTimer -= dt;
      this.takeDamage(this.burnDps * dt, game);
      if (this.dead) return;
      if (this.burnTimer <= 0) { this.burnDps = 0; this.burnTimer = 0; }
    }
    if (this.hitFlash > 0) this.hitFlash -= dt;

    const resist = this.cfg.slowResist || 0;
    const speed = this.baseSpeed * (1 - this.slowAmt * (1 - resist));
    let move = speed * dt;

    while (move > 0) {
      const target = this.points[this.seg + 1];
      if (!target) { this.escaped = true; break; }
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d <= move) {
        this.traveled += d;
        this.x = target.x;
        this.y = target.y;
        this.seg++;
        move -= d;
        this.updateAngle();
      } else {
        this.x += (dx / d) * move;
        this.y += (dy / d) * move;
        this.traveled += move;
        move = 0;
      }
    }
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // aureola bossa
    if (this.cfg.boss) {
      const pulse = 1 + Math.sin(performance.now() / 300) * 0.12;
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(0, 0, this.size * 1.5 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // cień
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, this.size * 0.35, this.size * 0.6, this.size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(this.angle);

    if (this.type === 'czolg') {
      this.renderTank(ctx);
    } else {
      ctx.font = `${this.size}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.cfg.emoji, 0, 0);
    }

    // podpalenie (piana gaśnicza)
    if (this.burnTimer > 0) {
      const flick = 0.3 + Math.sin(performance.now() / 60) * 0.15;
      ctx.globalAlpha = flick;
      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      ctx.arc(0, 0, this.size * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // błysk po trafieniu
    if (this.hitFlash > 0) {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, this.size * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // oznaczenie spowolnienia
    if (this.slowAmt > 0) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, 0, this.size * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // podatność (radar) – pulsująca czerwona obwódka
    if (this.vulnPct > 0) {
      const pulse = 1 + Math.sin(performance.now() / 150) * 0.15;
      ctx.strokeStyle = `rgba(239,68,68,${0.55 * pulse})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * (0.9 + pulse * 0.1), 0, Math.PI * 2);
      ctx.stroke();
    }

    // pasek HP
    const w = Math.max(26, this.size * 1.5);
    const h = 5;
    const x = this.x - w / 2;
    const y = this.y - this.size * 0.8 - 10;
    const pct = clamp(this.hp / this.maxHp, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#eab308' : '#ef4444';
    ctx.fillRect(x, y, w * pct, h);

    if (this.cfg.boss) {
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
    }
  }

  // niestandardowe rysowanie czołgu (brak emoji czołgu)
  renderTank(ctx) {
    const s = this.size;
    // gąsienice
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(-s * 0.8, -s * 0.55, s * 1.6, s * 0.35);
    ctx.fillRect(-s * 0.8, s * 0.2, s * 1.6, s * 0.35);
    // kadłub
    ctx.fillStyle = '#3f5c36';
    ctx.beginPath();
    ctx.roundRect(-s * 0.7, -s * 0.4, s * 1.4, s * 0.8, 6);
    ctx.fill();
    // wieża
    ctx.fillStyle = '#4d7142';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.34, 0, Math.PI * 2);
    ctx.fill();
    // lufa
    ctx.strokeStyle = '#2d4527';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(s * 1.1, 0);
    ctx.stroke();
  }
}

/* ------------------------------- TOWER ------------------------------- */
class Tower {
  constructor(typeId, cx, cy, c, r) {
    this.cfg = TOWER_TYPES[typeId];
    this.typeId = typeId;
    this.x = cx;
    this.y = cy;
    this.c = c;
    this.r = r;
    this.level = 1;
    this.invested = this.cfg.cost;
    this.cd = 0;
    this.angle = -Math.PI / 2;
    this.shotFlash = 0;
    this.kills = 0;

    // specjalizacja (wybór A/B na 3. poziomie)
    this.spec = null;
    this.specValue = {};
  }

  /* ---- statystyki zależne od poziomu i specjalizacji ---- */
  get range() {
    let r = this.cfg.range + (this.level - 1) * 18;
    if (this.specValue.rangeAdd) r += this.specValue.rangeAdd;
    return r;
  }
  get damage() {
    let d = Math.round(this.cfg.damage * Math.pow(1.6, this.level - 1));
    if (this.specValue.damageMul) d = Math.round(d * this.specValue.damageMul);
    return d;
  }
  get cooldown() {
    let c = this.cfg.cooldown * Math.pow(0.86, this.level - 1);
    if (this.specValue.cooldownMul) c *= this.specValue.cooldownMul;
    return c;
  }
  get sellValue() { return Math.floor(this.invested * 0.6); }

  get specCost() { return Math.round(this.cfg.cost * 1.1); }
  get needsSpec() { return this.level === 2 && !this.spec; }

  /* koszt następnego ulepszenia: {kind:'lvl'|'spec'|'max', cost} */
  get upgradeCost() {
    if (this.level >= MAX_LEVEL) return { kind: 'max', cost: null };
    if (this.needsSpec) return { kind: 'spec', cost: this.specCost };
    return { kind: 'lvl', cost: Math.round(this.cfg.cost * (0.65 + 0.4 * this.level)) };
  }

  /* bonusy specjalizacji */
  get slowAmount() {
    return (this.cfg.slow ? this.cfg.slow.amount : 0) + (this.specValue.slowAdd || 0);
  }
  get slowDuration() {
    return (this.cfg.slow ? this.cfg.slow.duration : 0) + (this.specValue.slowDurAdd || 0);
  }
  get killBountyMul() { return this.specValue.killBountyMul || 1; }
  get coneHalf() {
    return (this.cfg.cone ? this.cfg.cone.half : 0) + (this.specValue.coneHalfAdd || 0);
  }
  get burnDps() { return this.specValue.burnDps || 0; }
  get burnDur() { return this.specValue.burnDur || 0; }
  get radiusMul() { return this.specValue.radiusMul || 1; }

  /* celowanie: wybieramy pojazd najdalej przesunięty wzdłuż ścieżki */
  findTarget(enemies) {
    let best = null;
    for (const e of enemies) {
      if (e.dead || e.escaped) continue;
      if (dist(this, e) > this.range) continue;
      if (!best || e.progress > best.progress) best = e;
    }
    return best;
  }

  update(dt, game) {
    // radar nie strzela – trzyma strefę (aura)
    if (this.cfg.id === 'radar') {
      this.updateAura(dt, game);
      return;
    }
    if (this.shotFlash > 0) this.shotFlash -= dt;
    this.cd -= dt;
    if (this.cd > 0) return;

    const target = this.findTarget(game.enemies);
    if (!target) return;

    this.cd = this.cooldown;
    this.shotFlash = 0.12;
    this.angle = Math.atan2(target.y - this.y, target.x - this.x);

    if (this.cfg.id === 'fire') {
      this.fireCone(target, game);
    } else if (this.cfg.id === 'dzwig') {
      this.hookPull(target, game);
    } else {
      game.projectiles.push(new Projectile(this, target, game));
    }
  }

  /* Kontroler Ruchu: aura podnosząca obrażenia + spowolnienie w strefie */
  updateAura(dt, game) {
    this.cd -= dt;
    if (this.cd > 0) return;
    this.cd = 0.35;
    const vuln = this.specValue.vuln || this.cfg.vuln;
    const slow = this.specValue.weakSlow || this.cfg.slow;
    for (const e of game.enemies) {
      if (e.dead || e.escaped) continue;
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d > this.range) continue;
      e.setVuln(vuln, 0.4);
      if (slow > 0) e.applySlow(slow, 0.4);
    }
  }

  /* Dźwig: cofa pojazd(y) wzdłuż ścieżki */
  hookPull(target, game) {
    const pull = this.specValue.pull || this.cfg.pull;
    const victims = this.specValue.twin
      ? game.enemies
          .filter(e => !e.dead && !e.escaped && Math.hypot(e.x - this.x, e.y - this.y) <= this.range)
          .sort((a, b) => b.progress - a.progress)
          .slice(0, 2)
      : [target];

    for (const v of victims) {
      v.pullBack(pull);
      v.takeDamage(this.damage, game);
      game.spawnHit(v.x, v.y, this.cfg.color);
    }
    game.addFloater(this.x, this.y - 24, 'Hak!', '#fb923c', 0.8);
  }

  /* Strażak: stożek wody – obrażenia wszystkim w zasięgu i kącie */
  fireCone(target, game) {
    const half = this.coneHalf;
    const dmg = this.damage;

    game.effects.push({
      type: 'cone',
      x: this.x, y: this.y,
      angle: this.angle,
      range: this.range,
      half,
      life: 0.3, maxLife: 0.3
    });

    for (const e of game.enemies) {
      if (e.dead || e.escaped) continue;
      const d = dist(this, e);
      if (d > this.range) continue;
      const a = Math.atan2(e.y - this.y, e.x - this.x);
      let diff = Math.abs(a - this.angle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff <= half) {
        e.takeDamage(dmg, game);
        e.applySlow(0.25, 0.8);
        if (this.burnDps) e.applyBurn(this.burnDps, this.burnDur);
        game.spawnHit(e.x, e.y, '#7dd3fc');
      }
    }

    // cząsteczki wody
    for (let i = 0; i < 12; i++) {
      const a = this.angle + (Math.random() - 0.5) * half * 2;
      const sp = 90 + Math.random() * 130;
      game.particles.push({
        x: this.x + Math.cos(this.angle) * 14,
        y: this.y + Math.sin(this.angle) * 14,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.6,
        size: 2 + Math.random() * 3,
        color: '#7dd3fc'
      });
    }
  }

  render(ctx) {
    const cfg = this.cfg;

    // cień
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 4, 21, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // podstawa z obwódką
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = cfg.color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // świecenie przy wyższych poziomach
    if (this.level >= 3) {
      const glowColor = this.level >= MAX_LEVEL ? '#facc15' : '#38bdf8';
      const pulse = 0.10 + Math.sin(performance.now() / 400) * 0.05;
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 23, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.translate(this.x, this.y);

    if (cfg.id === 'radar') {
      // obracający się wachlarz + antena
      const ang = performance.now() / 900;
      ctx.rotate(ang);
      const grad = ctx.createRadialGradient(0, 0, 6, 0, 0, this.range * 0.55);
      grad.addColorStop(0, 'rgba(6,182,212,0.4)');
      grad.addColorStop(1, 'rgba(6,182,212,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, this.range * 0.55, -0.5, 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.rotate(-ang);
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.lineTo(0, -12);
      ctx.stroke();
      ctx.strokeStyle = '#0e7490';
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(-5, -18);
      ctx.lineTo(5, -18);
      ctx.lineTo(0, -12);
      ctx.stroke();
      ctx.lineCap = 'butt';
    } else if (cfg.id === 'dzwig') {
      // obrotowe ramię dźwigu
      ctx.rotate(this.angle);
      ctx.strokeStyle = '#fdba74';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(20, 0);
      ctx.stroke();
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(24, 9);
      ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.rotate(-this.angle);
    } else {
      // lufa / wyrzutnia
      ctx.rotate(this.angle);
      ctx.fillStyle = cfg.color;
      ctx.beginPath();
      ctx.roundRect(2, -4, 22, 8, 3);
      ctx.fill();
      if (this.shotFlash > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.arc(26, 0, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.rotate(-this.angle);
    }

    // emoji wieżyczki
    ctx.font = '24px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cfg.emoji, 0, -2);
    ctx.restore();

    // poziom (gwiazdki)
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★'.repeat(this.level), this.x, this.y + 30);

    // znacznik specjalizacji
    if (this.spec) {
      ctx.fillStyle = '#a78bfa';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(this.spec, this.x + 15, this.y + 21);
    }
  }

  drawRange(ctx, valid) {
    const off = (performance.now() / 45) % 22;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
    ctx.fillStyle = valid === false ? 'rgba(239,68,68,0.14)' : 'rgba(56,189,248,0.12)';
    ctx.fill();
    ctx.setLineDash([8, 14]);
    ctx.lineDashOffset = -off;
    ctx.strokeStyle = valid === false ? 'rgba(239,68,68,0.85)' : 'rgba(56,189,248,0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }
}

/* ----------------------------- PROJECTILE ----------------------------- */
class Projectile {
  constructor(tower, target, game) {
    this.cfg = tower.cfg;
    this.tower = tower;
    this.target = target;
    this.x = tower.x + Math.cos(tower.angle) * 20;
    this.y = tower.y + Math.sin(tower.angle) * 20;
    this.damage = tower.damage;
    this.level = tower.level;
    this.speed = tower.cfg.bulletSpeed || (tower.cfg.projectile === 'bullet' ? 620 : 420);
    this.dead = false;
    this.color = tower.cfg.color;
    this.kind = tower.cfg.projectile;
    this.trail = [];

    // bomba sapera: lot po łuku do zapamiętanego punktu + wybuch
    if (this.kind === 'bomb') {
      this.startX = this.x;
      this.startY = this.y;
      this.endX = target.x;
      this.endY = target.y;
      this.totalDist = Math.max(1, Math.hypot(this.endX - this.startX, this.endY - this.startY));
      this.t = 0;
      this.arcH = Math.min(80, this.totalDist * 0.35);
      this.splashRadius = tower.cfg.splash.radius * tower.radiusMul;
      this.specSlowPct = tower.specValue.slowPct || 0;
      this.specSlowDur = tower.specValue.slowDur || 0;
    }
  }

  update(dt, game) {
    this.trail.push({ x: this.x, y: this.y, life: 0.15 });
    if (this.trail.length > 8) this.trail.shift();
    this.trail.forEach(t => t.life -= dt);
    this.trail = this.trail.filter(t => t.life > 0);

    if (this.kind === 'bomb') {
      const dur = this.totalDist / this.speed;
      this.t += dt / dur;
      const tt = Math.min(1, this.t);
      this.x = lerp(this.startX, this.endX, tt);
      this.y = lerp(this.startY, this.endY, tt) - Math.sin(tt * Math.PI) * this.arcH;
      if (this.t >= 1) this.explode(game);
      return;
    }

    if (!this.target || this.target.dead || this.target.escaped) {
      this.dead = true;
      return;
    }
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const d = Math.hypot(dx, dy);
    const step = this.speed * dt;

    if (d <= step + this.target.size * 0.5) {
      this.hit(game);
      return;
    }
    this.x += (dx / d) * step;
    this.y += (dy / d) * step;
  }

  explode(game) {
    this.dead = true;
    const R = this.splashRadius;
    for (const e of game.enemies) {
      if (e.dead || e.escaped) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) <= R + e.size * 0.5) {
        e.takeDamage(this.damage, game);
        game.spawnHit(e.x, e.y, '#fbbf24');
        if (this.specSlowPct > 0) e.applySlow(this.specSlowPct, this.specSlowDur);
      }
    }
    game.spawnExplosion(this.x, this.y, 24, '#fbbf24');
    game.addFloater(this.x, this.y - 16, 'BUM!', '#fbbf24', 0.7);
  }

  hit(game) {
    this.dead = true;
    const e = this.target;
    if (e.dead || e.escaped) return;
    e.takeDamage(this.damage, game);
    game.spawnHit(e.x, e.y, this.color);

    if (this.kind === 'permit') {
      e.applySlow(this.tower.slowAmount, this.tower.slowDuration);
      game.addFloater(e.x, e.y - 16, 'mandat!', '#fbbf24', 0.7);
    }
  }

  render(ctx) {
    // ślad
    for (const t of this.trail) {
      ctx.globalAlpha = t.life / 0.15 * 0.5;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.kind === 'bullet') {
      ctx.fillStyle = '#dbeafe';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (this.kind === 'bomb') {
      // bomba z iskrzącym lontem
      const blink = Math.sin(performance.now() / 90) > 0;
      ctx.rotate(performance.now() / 400);
      ctx.fillStyle = '#1f2937';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = blink ? '#fbbf24' : '#b45309';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = blink ? '#fde68a' : '#92400e';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      // mandat – mała karteczka
      ctx.rotate(performance.now() / 200);
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(-6, -8, 12, 16);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-6, -8, 12, 16);
      ctx.strokeStyle = '#b45309';
      ctx.beginPath();
      ctx.moveTo(-3, -3); ctx.lineTo(3, -3);
      ctx.moveTo(-3, 1); ctx.lineTo(3, 1);
      ctx.moveTo(-3, 5); ctx.lineTo(1, 5);
      ctx.stroke();
    }
    ctx.restore();
  }
}