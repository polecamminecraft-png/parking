'use strict';

/* ============================================================
   UIController – menu, panel sklepu, wybór wież, panel edytora
   ============================================================ */

class UIController {
  constructor(game) {
    this.game = game;

    this.$ = id => document.getElementById(id);

    this.elMoney = this.$('stat-money');
    this.elLives = this.$('stat-lives');
    this.elWave = this.$('stat-wave');
    this.elScore = this.$('stat-score');
    this.elState = this.$('stat-state');

    this.elOverlay = this.$('overlay');
    this.elOverlayContent = this.$('overlay-content');

    this.elPlayPanel = this.$('play-panel');
    this.elEditorPanel = this.$('editor-panel');
    this.elShop = this.$('shop');
    this.elWaveBtn = this.$('btn-wave');
    this.elSelection = this.$('selection');

    this.elEditorStatus = this.$('editor-status');
    this.elEditorMapName = this.$('editor-mapname');
    this.elIOText = this.$('io-text');
    this.elIOMsg = this.$('io-msg');

    this.buildShop();
    this.bindPanels();
    this.refreshStats();   // inicjalizacja pasków i aktywnych przycisków prędkości

    // sklep skaluje się do wysokości mapy (canvas) + na zmianę okna
    requestAnimationFrame(() => this.fitLayout());
    window.addEventListener('resize', () => this.fitLayout());
  }

  /* ------------------------- SKLEP (WIEŻYCZKI) ------------------------- */

  buildShop() {
    this.elShop.innerHTML = '';
    TOWER_ORDER.forEach((id, i) => {
      const cfg = TOWER_TYPES[id];
      const card = document.createElement('button');
      card.className = 'tower-card';
      card.dataset.type = id;
      card.style.setProperty('--tc', cfg.color);
      card.innerHTML = `
        <div class="tc-top">
          <span class="tc-icon">${cfg.emoji}</span>
          <span class="tc-cost">💰 ${cfg.cost}</span>
        </div>
        <div class="tc-name">${cfg.name}</div>
        <div class="tc-desc">${cfg.desc}</div>
        <div class="tc-key">klawisz ${i + 1}</div>`;
      card.addEventListener('click', () => this.selectShop(id));
      this.elShop.appendChild(card);
    });
  }

  selectShop(typeId) {
    const g = this.game;
    if (g.state !== 'PLAYING') return;
    g.buildType = (g.buildType === typeId) ? null : typeId;
    g.selectedTower = null;
    this.refreshShop();
    this.refreshSelection();
  }

  refreshShop() {
    const g = this.game;
    this.elShop.querySelectorAll('.tower-card').forEach(card => {
      const id = card.dataset.type;
      card.classList.toggle('active', g.buildType === id);
      card.classList.toggle('poor', g.money < TOWER_TYPES[id].cost);
    });
  }

  /* --------------------- PANEL WYBRANEJ WIEŻYCZKI --------------------- */

  refreshSelection() {
    const g = this.game;
    const box = this.elSelection;

    if (g.state !== 'PLAYING' || !g.selectedTower) {
      box.classList.add('hidden');
      box.innerHTML = '';
      return;
    }

    const t = g.selectedTower;
    const info = t.upgradeCost;
    box.classList.remove('hidden');
    box.style.setProperty('--tc', t.cfg.color);

    const specRow = t.spec
      ? `<div class="stat-row"><span>Specjalizacja</span><b class="spec-badge">${t.spec} · ${t.specValue.name}</b></div>`
      : '';

    const extra = t.cfg.id === 'saper'
      ? `<div class="stat-row"><span>Promień eksplozji</span><b>${Math.round((t.cfg.splash.radius) * t.radiusMul)}</b></div>` : '';

    let actionHTML;
    if (info && info.kind === 'spec') {
      // etap specjalizacji – klikamy A lub B
      const can = g.money >= info.cost;
      const sA = t.cfg.spec.A, sB = t.cfg.spec.B;
      actionHTML = `
        <div class="spec-title">⚙ Wybierz specjalizację (${info.cost}💰)</div>
        <div class="spec-col">
          <button id="btn-spec-a" class="btn small spec-btn" ${can ? '' : 'disabled'}>
            <span class="spec-letter">A</span><span><b>${sA.name}</b><small>${sA.desc}</small></span>
          </button>
          <button id="btn-spec-b" class="btn small spec-btn" ${can ? '' : 'disabled'}>
            <span class="spec-letter">B</span><span><b>${sB.name}</b><small>${sB.desc}</small></span>
          </button>
        </div>
        <div class="btn-row">
          <button id="btn-sell" class="btn small danger">Sprzedaj (+${t.sellValue}💰)</button>
        </div>`;
    } else {
      const upCost = info ? info.cost : null;
      actionHTML = `
        <div class="btn-row">
          <button id="btn-upgrade" class="btn small" ${upCost === null || g.money < upCost ? 'disabled' : ''}>
            ${upCost === null ? 'MAX poziom' : `⬆ Ulepsz (${upCost}💰)`}
          </button>
          <button id="btn-sell" class="btn small danger">Sprzedaj (+${t.sellValue}💰)</button>
        </div>`;
    }

    box.innerHTML = `
      <h3>${t.cfg.emoji} ${t.cfg.name} <span class="lvl">poz. ${t.level}</span></h3>
      <div class="stat-row"><span>Obrażenia</span><b>${t.damage}</b></div>
      <div class="stat-row"><span>Zasięg</span><b>${Math.round(t.range)}</b></div>
      <div class="stat-row"><span>Czas ładowania</span><b>${t.cooldown.toFixed(2)}s</b></div>
      ${extra}
      ${specRow}
      <div class="stat-row"><span>Wydane</span><b>💰${t.invested}</b></div>
      ${actionHTML}`;

    const up = this.$('btn-upgrade');
    if (up) up.addEventListener('click', () => g.upgradeTower(t));
    const sell = this.$('btn-sell');
    if (sell) sell.addEventListener('click', () => g.sellTower(t));
    const specA = this.$('btn-spec-a');
    if (specA) specA.addEventListener('click', () => g.chooseSpec(t, 'A'));
    const specB = this.$('btn-spec-b');
    if (specB) specB.addEventListener('click', () => g.chooseSpec(t, 'B'));
  }

  /* ----------------------------- STATYSTYKI ----------------------------- */

  refreshStats() {
    const g = this.game;
    this.elMoney.textContent = g.money;
    this.elLives.textContent = g.lives;
    this.elScore.textContent = g.score;
    this.elWave.textContent = `${g.wave} / ∞`;

    const labels = {
      MENU: 'MENU', PLAYING: 'ROZGRYWKA', EDITOR: 'KREATOR MAP', GAME_OVER: 'KONIEC GRY'
    };
    this.elState.textContent = labels[g.state] || g.state;

    this.elWaveBtn.disabled = g.state !== 'PLAYING' || g.waveInProgress;
    this.elWaveBtn.textContent = g.waveInProgress
      ? `Fala ${g.wave} w toku…`
      : `▶ Start fali ${g.wave + 1} (Spacja)`;

    // podświetlenie aktywnej prędkości
    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.speed, 10) === g.speedIndex);
    });

    this.refreshShop();
    this.refreshSelection();
  }

  refreshAll() {
    const g = this.game;
    this.elPlayPanel.classList.toggle('hidden', g.state !== 'PLAYING');
    this.elEditorPanel.classList.toggle('hidden', g.state !== 'EDITOR');
    this.refreshStats();
    if (g.state === 'EDITOR') {
      this.refreshEditorTools();
      this.refreshEditorStatus();
    }
    // wysokość bocznego panelu = wysokość mapy (canvas)
    this.fitLayout();
  }

  /* dopasowuje boczne panele do rozmiaru mapy (bot canvas nie "pływa") */
  fitLayout() {
    const cw = this.game && this.game.canvas
      ? this.game.canvas.closest('#canvas-wrap')
      : document.getElementById('canvas-wrap');
    const aside = document.querySelector('aside');
    if (!cw || !aside) return;
    const h = cw.offsetHeight;
    if (h > 30) aside.style.height = `${h}px`;
  }

  /* ------------------------------ OVERLAY ------------------------------ */

  buildMenu() {
    const hasCustom = !!MapEditor.loadLocal();
    this.elOverlayContent.innerHTML = `
      <div class="menu-box">
        <h1>🚗 PARKING DEFENDER</h1>
        <p class="tagline">Broń parkingu przed najazdem pojazdów! Stawiaj wieżyczki i przetrwaj ${TOTAL_WAVES} fal.</p>
        <div class="menu-buttons">
          <button id="btn-play-default" class="btn big">▶ Graj – mapa domyślna</button>
          ${hasCustom ? '<button id="btn-play-custom" class="btn big">🗺 Graj – moja mapa</button>' : ''}
          <button id="btn-open-editor" class="btn big alt">🛠 Kreator map</button>
          <button id="btn-scores" class="btn big alt">🏆 Najlepsze wyniki</button>
        </div>
        <div class="howto">
          <b>Jak grać:</b> wybierz jedną z <b>7 wieżyczek</b> (klawisze 1–7), potem wolne
          miejsce na siatce. Kliknij postawioną wieżę, aby ją ulepszać.<br>
          Na 3. poziomie wybierz <b>specjalizację A lub B</b> – każda znacząco zmienia
          zachowanie wieży! Najlepsze wyniki każdej mapy zapiszesz w tabeli topów.<br>
          PPM / Esc – anuluj · Spacja – start fali.
        </div>
      </div>`;

    this.$('btn-play-default').addEventListener('click', () =>
      this.game.startGame(DEFAULT_MAP));
    const custom = this.$('btn-play-custom');
    if (custom) custom.addEventListener('click', () => {
      const m = MapEditor.loadLocal();
      this.game.startGame(m || DEFAULT_MAP);
    });
    this.$('btn-open-editor').addEventListener('click', () => {
      const m = MapEditor.loadLocal();
      this.game.openEditor(m || DEFAULT_MAP);
    });
    const scoresBtn = this.$('btn-scores');
    if (scoresBtn) scoresBtn.addEventListener('click', () => {
      this.showScoresOverlay(Highscores.maps()[0] || this.game.map.name);
    });
  }

  showOverlay(kind) {
    if (!kind) {
      this.elOverlay.classList.add('hidden');
      return;
    }
    this.elOverlay.classList.remove('hidden');
    const g = this.game;

    if (kind === 'gameover') {
      this.renderGameOver();
    }
  }

  /* ekran przegranej: nick + zapis wyniku + tabela */
  renderGameOver() {
    const g = this.game;
    const saved = !!g.lastScore;
    const list = saved ? g.lastScore.list : Highscores.get(g.map.name);
    const best = list.length ? list[0].score : 0;
    const recordBadge = saved && g.lastScore.isNewBest
      ? '<div class="record-badge">🏆 NOWY REKORD!</div>' : '';
    const scoreOk = g.pendingScore && g.pendingScore.score > 0;

    let scoreBox = '';
    if (!saved) {
      if (scoreOk) {
        scoreBox = `
          <div class="nick-form">
            <label for="nick-input">Twój nick:</label>
            <input id="nick-input" class="nick-input" maxlength="16"
              placeholder="np. Pan Parking" value="${Highscores.rememberedNick()}">
            <button id="btn-save-score" class="btn">💾 Zapisz wynik</button>
          </div>
          <div class="nick-hint">Zapiszesz swój wynik w tabeli topów tej mapy.</div>`;
      } else {
        scoreBox = `<div class="nick-hint">Brak punktów do zapisania – spróbuj ponownie!</div>`;
      }
    } else {
      scoreBox = `
        <div class="saved-nick">Zapisano wynik gracza <b>${g.lastScore.entry.nick}</b>
          ${g.lastScore.rank >= 0 ? `na pozycji <b>#${g.lastScore.rank + 1}</b>` : '(poza top 10)'}.</div>
        ${recordBadge}`;
    }

    this.elOverlayContent.innerHTML = `
      <div class="menu-box">
        <h1>💥 KONIEC GRY</h1>
        <p>Szlaban padł! Odparto <b>${g.wavesCleared}</b> fal.</p>
        <div class="score-big">
          ${g.score}
          <small>wynik (fale · pojazdy · budżet)</small>
        </div>
        ${scoreBox}
        ${this.scoreTableHTML(g.map.name, list, best, 5)}
        <div class="menu-buttons">
          <button id="btn-scores-2" class="btn big alt">🏆 Tabela wyników</button>
          <button id="btn-retry" class="btn big">🔄 Spróbuj ponownie</button>
          <button id="btn-menu" class="btn big alt">🏠 Menu główne</button>
        </div>
      </div>`;

    const saveBtn = this.$('btn-save-score');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const nick = this.$('nick-input').value;
        g.submitScore(nick);   // wywołuje ponownie renderGameOver()
      });
      this.$('nick-input').addEventListener('keydown', ev => {
        if (ev.key === 'Enter') saveBtn.click();
      });
    }
    this.$('btn-retry').addEventListener('click', () => g.startGame(g.map));
    this.$('btn-menu').addEventListener('click', () => g.backToMenu());
    const sc = this.$('btn-scores-2');
    if (sc) sc.addEventListener('click', () => this.showScoresOverlay(g.map.name));
  }

  /* ------------------- TABELA WYNIKÓW (WSPÓLNA) ------------------- */

  scoresTableHeader() {
    return `
      <table class="scores-table">
        <thead><tr>
          <th>#</th><th>Gracz</th><th>Wynik</th><th>Fala</th><th>💰</th><th>Data</th>
        </tr></thead><tbody>`;
  }

  /* lista wyników dla mapy – zwraca HTML tabeli (bez serc – po przegranej i tak 0) */
  scoreTableHTML(mapName, list, best, limit = 10) {
    const rows = (list || Highscores.get(mapName)).slice(0, limit);
    let html = `<h2 class="score-table-title">🏆 Top wyniki · <span>${mapName}</span></h2>
      <div class="score-best">Najlepszy wynik: <b>${best || Highscores.best(mapName)}</b></div>
      ${this.scoresTableHeader()}`;
    if (!rows.length) {
      html += `<tr><td colspan="6" class="empty-cell">Brak wyników dla tej mapy – zagraj pierwszy!</td></tr>`;
    } else {
      rows.forEach((x, i) => {
        html += `<tr${i === 0 ? ' class="first"' : ''}>
          <td>${i + 1}</td><td>${x.nick || '—'}</td><td><b>${x.score}</b></td>
          <td>${x.wave}</td><td>${x.money}</td><td>${x.date}</td>
        </tr>`;
      });
    }
    html += `</tbody></table>`;
    return html;
  }

  /* widok "Najlepsze wyniki" – przełączanie między mapami */
  showScoresOverlay(mapName) {
    const maps = Highscores.maps();
    const current = maps.includes(mapName) ? mapName : (maps[0] || mapName);
    const options = maps.map(n =>
      `<option value="${n.replace(/"/g, '&quot;')}" ${n === current ? 'selected' : ''}>${n}</option>`).join('');

    this.elOverlayContent.innerHTML = `
      <div class="menu-box">
        <h1>🏆 TABELA WYNIKÓW</h1>
        <p class="tagline">Najlepsze wyniki każdej mapy – 10 czołowych miejsc.</p>
        <label class="map-select">
          Mapa:
          <select id="scores-map">${options || '<option>Mapa domyślna</option>'}</select>
        </label>
        <div id="scores-table-box">${this.scoreTableHTML(current)}</div>
        <div class="menu-buttons">
          <button id="btn-back" class="btn big alt">🏠 Wróć do menu</button>
        </div>
      </div>`;

    const sel = this.$('scores-map');
    if (sel) sel.addEventListener('change', () => {
      const box = this.$('scores-table-box');
      box.innerHTML = this.scoreTableHTML(sel.value);
    });
    this.$('btn-back').addEventListener('click', () => this.backToMenuFromScores());
  }

  /* powrót z tabeli wyników (bez restartu gry w tle) */
  backToMenuFromScores() {
    if (this.game.state !== 'PLAYING') {
      this.game.backToMenu();
    }
  }

  /* ------------------------------ EDYTOR ------------------------------ */

  bindPanels() {
    const g = this.game;

    this.elWaveBtn.addEventListener('click', () => g.startWave());

    const menu1 = this.$('btn-menu-1');
    if (menu1) menu1.addEventListener('click', () => g.backToMenu());

    const scoresPlay = this.$('btn-scores-play');
    if (scoresPlay) scoresPlay.addEventListener('click', () =>
      this.showScoresOverlay(g.map.name));

    // narzędzia edytora
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => g.editor.setTool(btn.dataset.tool));
    });

    // przyciski prędkości (1x / 2x / 3x)
    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', () => g.setSpeed(parseInt(btn.dataset.speed, 10)));
    });

    this.$('btn-validate').addEventListener('click', () => g.editor.validate());

    this.$('btn-save').addEventListener('click', () => {
      const res = g.editor.saveLocal();
      this.setIOMsg(res.msg);
      this.refreshEditorStatus();
    });

    this.$('btn-export').addEventListener('click', () => {
      const json = g.editor.exportJSON();
      this.elIOText.value = json;
      this.setIOMsg('📤 Wyeksportowano JSON (skopiuj lub pobierz plik).');
    });

    this.$('btn-import').addEventListener('click', () => {
      const res = g.editor.importJSON(this.elIOText.value.trim());
      this.setIOMsg(res.msg);
    });

    this.$('btn-clear').addEventListener('click', () => {
      g.editor.clearMap();
      this.setIOMsg('🧹 Wyczyszczono mapę.');
    });

    this.$('btn-copy').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(this.elIOText.value);
        this.setIOMsg('📋 Skopiowano JSON do schowka.');
      } catch (e) {
        this.setIOMsg('❌ Nie udało się skopiować – zaznacz tekst ręcznie.');
      }
    });

    this.$('btn-play-map').addEventListener('click', () => {
      const res = g.editor.validate();
      if (!res.ok) { this.setIOMsg(res.msg); return; }
      const saved = g.editor.saveLocal();
      if (!saved.ok) { this.setIOMsg(saved.msg); return; }
      g.startGame({ name: g.map.name, cells: g.map.cells });
    });

    this.$('btn-editor-menu').addEventListener('click', () => g.backToMenu());
  }

  refreshEditorTools() {
    const tool = this.game.editor.tool;
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
  }

  refreshEditorStatus() {
    const ed = this.game.editor;
    this.elEditorStatus.textContent = ed.status;
    this.elEditorStatus.classList.toggle('ok', ed.valid);
    this.elEditorStatus.classList.toggle('bad', !ed.valid);
  }

  setEditorMapName(name) {
    this.elEditorMapName.textContent = name;
  }

  showIOText(text) {
    this.elIOText.value = text;
  }

  setIOMsg(msg) {
    this.elIOMsg.textContent = msg || '';
  }
}
