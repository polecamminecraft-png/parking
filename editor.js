'use strict';

/* ============================================================
   MapEditor – pędzle, walidacja ścieżki, zapis/odczyt JSON
   ============================================================ */

class MapEditor {
  constructor(game) {
    this.game = game;
    this.tool = 'path';   // path | start | end | obstacle | erase
    this.status = 'Wybierz narzędzie i rysuj po siatce (przeciągnij myszą).';
    this.valid = false;
    this.lastCell = null;
  }

  setTool(tool) {
    this.tool = tool;
    this.lastCell = null;
    this.game.ui.refreshEditorTools();
  }

  /* Jedno malowanie (wywoływane przy kliknięciu / przeciąganiu) */
  paint(c, r, isDrag) {
    const map = this.game.map;
    if (!map.inBounds(c, r)) return;
    const key = r * COLS + c;
    if (isDrag && this.lastCell === key) return;
    this.lastCell = key;

    const cur = map.get(c, r);

    switch (this.tool) {
      case 'path':
        if (cur !== T.EMPTY && cur !== T.OBSTACLE && GridSystem.isWalkable(cur)) return;
        map.set(c, r, T.PATH);
        break;

      case 'start': {
        if (cur === T.START) return;
        const old = map.findCell(T.START);
        if (old) map.set(old.c, old.r, T.EMPTY);
        map.set(c, r, T.START);
        break;
      }

      case 'end': {
        if (cur === T.END) return;
        const old = map.findCell(T.END);
        if (old) map.set(old.c, old.r, T.EMPTY);
        map.set(c, r, T.END);
        break;
      }

      case 'obstacle':
        if (GridSystem.isWalkable(cur)) return;   // nie zastępujemy drogi
        map.set(c, r, T.OBSTACLE);
        break;

      case 'erase':
        map.set(c, r, T.EMPTY);
        break;
    }

    this.validate();
  }

  endStroke() {
    this.lastCell = null;
  }

  validate() {
    const res = this.game.map.validate();
    this.valid = res.ok;
    this.status = res.msg;
    this.game.ui.refreshEditorStatus();
    return res;
  }

  /* ---------------------- JSON / localStorage ---------------------- */

  toJSON() {
    const m = this.game.map;
    return JSON.stringify({
      name: m.name || 'Moja mapa',
      cols: COLS,
      rows: ROWS,
      cells: m.cells
    }, null, 2);
  }

  exportJSON() {
    const json = this.toJSON();
    this.game.ui.showIOText(json);
    // pobranie pliku
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'moja-mapa.json';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { /*Import do textarea działa mimo to */ }
    return json;
  }

  importJSON(text) {
    try {
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.cells)) throw new Error('Brak pola "cells"');
      if (data.cells.length !== ROWS || data.cells[0].length !== COLS) {
        throw new Error(`Mapa musi mieć wymiary ${COLS}x${ROWS}`);
      }
      // sanityzacja wartości
      const cells = data.cells.map(row =>
        row.map(v => Object.values(T).includes(v) ? v : T.EMPTY));

      this.game.map.load({ name: data.name || 'Importowana mapa', cells });
      this.validate();
      this.game.ui.setEditorMapName(this.game.map.name);
      return { ok: true, msg: '✅ Mapa zaimportowana.' };
    } catch (e) {
      return { ok: false, msg: '❌ Błąd importu: ' + e.message };
    }
  }

  saveLocal() {
    const res = this.validate();
    if (!res.ok) return res;
    try {
      localStorage.setItem(SAVE_KEY, this.toJSON());
      return { ok: true, msg: '💾 Zapisano do localStorage – mapa jest grywalna!' };
    } catch (e) {
      return { ok: false, msg: '❌ Nie udało się zapisać: ' + e.message };
    }
  }

  static loadLocal() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.cells)) return null;
      if (data.cells.length !== ROWS || data.cells[0].length !== COLS) return null;
      return { name: data.name || 'Moja mapa', cells: data.cells };
    } catch (e) {
      return null;
    }
  }

  clearMap() {
    this.game.map.load({
      name: 'Nowa mapa',
      cells: Array.from({ length: ROWS }, () => Array(COLS).fill(T.EMPTY))
    });
    this.validate();
    this.game.ui.setEditorMapName('Nowa mapa');
  }

  loadInto(mapData) {
    this.game.map.load(mapData);
    this.validate();
    this.game.ui.setEditorMapName(this.game.map.name);
  }
}
