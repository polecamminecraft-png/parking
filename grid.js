'use strict';

/* ============================================================
   GridSystem – siatka kafelków, BFS pathfinding, renderowanie
   ============================================================ */

class GridSystem {
  constructor(mapData) {
    this.load(mapData);
  }

  load(mapData) {
    this.name = mapData.name || 'Mapa';
    this.cells = mapData.cells.map(row => row.slice());
    this.path = this.findPath();       // punkty (px) waypoints
    this.pathCells = new Set();        // kafelki należące do ścieżki (do rysowania)
    this.computePathCells();
  }

  inBounds(c, r) {
    return c >= 0 && c < COLS && r >= 0 && r < ROWS;
  }

  get(c, r) {
    return this.inBounds(c, r) ? this.cells[r][c] : -1;
  }

  set(c, r, type) {
    if (this.inBounds(c, r)) this.cells[r][c] = type;
  }

  findCell(type) {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (this.cells[r][c] === type) return { c, r };
    return null;
  }

  countCell(type) {
    let n = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (this.cells[r][c] === type) n++;
    return n;
  }

  // kafelki, po których mogą jeździć pojazdy
  static isWalkable(t) {
    return t === T.PATH || t === T.START || t === T.END;
  }

  /* --- BFS od START do END po kafelkach drogowych --- */
  findPath() {
    const start = this.findCell(T.START);
    const end = this.findCell(T.END);
    if (!start || !end) return null;

    const key = (c, r) => r * COLS + c;
    const prev = new Map();
    const queue = [start];
    const visited = new Set([key(start.c, start.r)]);
    let found = false;

    while (queue.length) {
      const cur = queue.shift();
      if (cur.c === end.c && cur.r === end.r) { found = true; break; }
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dc, dr] of dirs) {
        const nc = cur.c + dc, nr = cur.r + dr;
        if (!this.inBounds(nc, nr)) continue;
        if (visited.has(key(nc, nr))) continue;
        if (!GridSystem.isWalkable(this.cells[nr][nc])) continue;
        visited.add(key(nc, nr));
        prev.set(key(nc, nr), cur);
        queue.push({ c: nc, r: nr });
      }
    }

    if (!found) return null;

    // odtworzenie ścieżki (komórki)
    const cellsArr = [];
    let cur = end;
    while (cur) {
      cellsArr.unshift(cur);
      cur = prev.get(key(cur.c, cur.r));
    }

    // sprowadzenie do środków kafelków + usunięcie kolinearnych punktów
    const pts = cellsArr.map(cell => ({
      x: cell.c * TILE + TILE / 2,
      y: cell.r * TILE + TILE / 2
    }));

    const compressed = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = compressed[compressed.length - 1];
      const b = pts[i];
      const c = pts[i + 1];
      const colinear =
        (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
      if (!colinear) compressed.push(b);
    }
    compressed.push(pts[pts.length - 1]);
    return compressed;
  }

  computePathCells() {
    this.pathCells.clear();
    if (!this.path) return;
    // zbierz wszystkie komórki między waypointami
    for (let i = 0; i < this.path.length - 1; i++) {
      const a = this.path[i], b = this.path[i + 1];
      const ac = Math.floor(a.x / TILE), ar = Math.floor(a.y / TILE);
      const bc = Math.floor(b.x / TILE), br = Math.floor(b.y / TILE);
      const dc = Math.sign(bc - ac), dr = Math.sign(br - ar);
      let c = ac, r = ar;
      this.pathCells.add(r * COLS + c);
      while (c !== bc || r !== br) {
        c += dc; r += dr;
        this.pathCells.add(r * COLS + c);
      }
    }
  }

  /* --- Walidacja: START i END istnieją + ciągła ścieżka --- */
  validate() {
    const starts = this.countCell(T.START);
    const ends = this.countCell(T.END);
    if (starts === 0) return { ok: false, msg: '❌ Brak pola START (wjazd).' };
    if (starts > 1) return { ok: false, msg: '❌ Może być tylko jedno pole START.' };
    if (ends === 0) return { ok: false, msg: '❌ Brak pola END (szlaban).' };
    if (ends > 1) return { ok: false, msg: '❌ Może być tylko jedno pole END.' };
    this.path = this.findPath();
    this.computePathCells();
    if (!this.path) return { ok: false, msg: '❌ Brak ciągłej ścieżki od START do END.' };
    return { ok: true, msg: '✅ Ścieżka od START do END istnieje – mapa gotowa!' };
  }

  /* --- Konwersja pikseli -> kafelek --- */
  cellAtPixel(px, py) {
    const c = Math.floor(px / TILE);
    const r = Math.floor(py / TILE);
    return this.inBounds(c, r) ? { c, r } : null;
  }

  canBuildAt(c, r) {
    return this.get(c, r) === T.EMPTY;
  }

  /* --- RENDEROWANIE --- */
  draw(ctx) {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    /* tła kafelków */
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = this.cells[r][c];
        const x = c * TILE, y = r * TILE;

        if (t === T.EMPTY) {
          // parking: lekkie szachownicowe przyciemnienie
          ctx.fillStyle = (c + r) % 2 === 0 ? '#3d4757' : '#394254';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = 'rgba(255,255,255,0.14)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 8]);
          ctx.strokeRect(x + 6, y + 6, TILE - 12, TILE - 12);
          ctx.setLineDash([]);
        } else if (t === T.PATH || t === T.START || t === T.END) {
          // asfalt
          ctx.fillStyle = '#20242f';
          ctx.fillRect(x, y, TILE, TILE);
          // bevel krawędzi drogi
          ctx.fillStyle = 'rgba(148,163,184,0.07)';
          ctx.fillRect(x, y + TILE - 2, TILE, 2);
          ctx.fillRect(x + TILE - 2, y, 2, TILE);
        } else if (t === T.OBSTACLE) {
          // ziemia pod przeszkodą
          ctx.fillStyle = '#394047';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(x, y + TILE - 4, TILE, 4);
        }
      }
    }

    /* animowana linia środkowa wzdłuż całej trasy */
    if (this.path && this.path.length > 1) {
      const off = (performance.now() / 38) % 18;
      ctx.strokeStyle = 'rgba(227,182,40,0.55)';
      ctx.lineWidth = 3;
      ctx.setLineDash([9, 9]);
      ctx.lineDashOffset = -off;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      const p0 = this.path[0];
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < this.path.length; i++) ctx.lineTo(this.path[i].x, this.path[i].y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
    }

    /* START / END / przeszkody */
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = this.cells[r][c];
        const x = c * TILE, y = r * TILE;
        const cx = x + TILE / 2, cy = y + TILE / 2;

        if (t === T.START) {
          // wjazd – zielona strefa z animowanymi strzałkami
          const grad = ctx.createLinearGradient(x, y, x, y + TILE);
          grad.addColorStop(0, '#14532d');
          grad.addColorStop(1, '#166534');
          ctx.fillStyle = grad;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = 'rgba(74,222,128,0.7)';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 6]);
          ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
          ctx.setLineDash([]);
          // pulsujące strzałki w dół
          const sh = performance.now() / 260;
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.font = 'bold 13px sans-serif';
          const drawArrow = yy => {
            ctx.beginPath();
            ctx.moveTo(cx, yy + 8);
            ctx.lineTo(cx - 7, yy - 4);
            ctx.lineTo(cx + 7, yy - 4);
            ctx.closePath();
            ctx.fill();
          };
          drawArrow(cy - 8 + (sh % TILE));
          drawArrow(cy - 8 + (sh % TILE) - TILE);
          ctx.font = '20px serif';
          ctx.fillStyle = '#bbf7d0';
          ctx.fillText('⬇️', cx, cy + 3);
        } else if (t === T.END) {
          // szlaban – strefa red/white stripes
          const grad = ctx.createLinearGradient(x, y, x, y + TILE);
          grad.addColorStop(0, '#7f1d1d');
          grad.addColorStop(1, '#991b1b');
          ctx.fillStyle = grad;
          ctx.fillRect(x, y, TILE, TILE);
          // pasy szlabanu (ukośne)
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, TILE, TILE);
          ctx.clip();
          ctx.strokeStyle = '#fecaca';
          ctx.lineWidth = 6;
          for (let d = -TILE; d < TILE * 2; d += 16) {
            ctx.beginPath();
            ctx.moveTo(x + d, y + TILE);
            ctx.lineTo(x + d + TILE, y);
            ctx.stroke();
          }
          ctx.restore();
          ctx.strokeStyle = 'rgba(254,202,202,0.8)';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 6]);
          ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
          ctx.setLineDash([]);
          ctx.font = '18px serif';
          ctx.fillText('🚧', cx, cy);
        } else if (t === T.OBSTACLE) {
          // cień przeszkody
          ctx.save();
          ctx.translate(cx, cy + 4);
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = '#000';
          ctx.beginPath();
          ctx.ellipse(0, 0, 15, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          const emoji = ['🌳', '🌲', '🪨', '🧱'][(c * 31 + r * 17) % 4];
          ctx.font = '28px serif';
          ctx.fillText(emoji, cx, cy - 2);
        }
      }
    }

    /* delikatna siatka */
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * TILE, 0);
      ctx.lineTo(c * TILE, CANVAS_H);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * TILE);
      ctx.lineTo(CANVAS_W, r * TILE);
      ctx.stroke();
    }
  }
}
