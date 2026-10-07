'use strict';

/* ============================================================
   Highscores – tabela najlepszych wyników (localStorage)
   Wyniki przechowywane osobno dla każdej mapy (po nazwie),
   z nickiem gracza.
   ============================================================ */

const SCORES_KEY = 'parkingDefender.scores';
const NICK_KEY = 'parkingDefender.nick';   // zapamiętany nick gracza

const Highscores = {
  MAX_ENTRIES: 10,

  load() {
    try {
      return JSON.parse(localStorage.getItem(SCORES_KEY)) || {};
    } catch (e) {
      return {};
    }
  },

  save(data) {
    try {
      localStorage.setItem(SCORES_KEY, JSON.stringify(data));
    } catch (e) { /* brak miejsca – ignorujemy */ }
  },

  /* odczyt / zapis pamiętanego nicku */
  rememberedNick() {
    try { return localStorage.getItem(NICK_KEY) || ''; } catch (e) { return ''; }
  },

  rememberNick(nick) {
    try { localStorage.setItem(NICK_KEY, nick); } catch (e) { /* ignoruj */ }
  },

  /* sanitizacja nicku (trim, max 16 znaków) */
  cleanNick(nick) {
    const n = String(nick || '').trim().replace(/\s+/g, ' ').slice(0, 16);
    return n || 'Anonim';
  },

  /* najlepsze wyniki dla mapy (posortowane malejąco, max 10) */
  get(mapName) {
    const data = this.load();
    const list = data[mapName] || [];
    return list.slice().sort((a, b) => b.score - a.score).slice(0, this.MAX_ENTRIES);
  },

  /* najlepszy wynik danej mapy (0, gdy brak) */
  best(mapName) {
    const list = this.get(mapName);
    return list.length ? list[0].score : 0;
  },

  /* listy map, które mają jakiekolwiek wyniki */
  maps() {
    const data = this.load();
    return Object.keys(data).filter(name => (data[name] || []).length > 0);
  },

  /* zapis nowego wyniku pod nickiem; zwraca { entry, rank, isNewBest, list } */
  submit(mapName, entry) {
    const data = this.load();
    const prevBest = (data[mapName] || []).reduce((m, x) => Math.max(m, x.score), 0);

    const rec = {
      nick: this.cleanNick(entry.nick),
      score: Math.max(0, Math.round(entry.score || 0)),
      wave: Math.max(0, Math.round(entry.wave || 0)),
      money: Math.max(0, Math.round(entry.money || 0)),
      date: new Date().toLocaleDateString('pl-PL')
    };
    this.rememberNick(rec.nick);

    const list = data[mapName] || [];
    list.push(rec);
    list.sort((a, b) => b.score - a.score);
    const rank = list.indexOf(rec);
    if (list.length > this.MAX_ENTRIES) list.splice(this.MAX_ENTRIES);

    data[mapName] = list;
    this.save(data);

    const isNewBest = rec.score >= prevBest && rec.score > 0;
    const kept = list.indexOf(rec);

    return {
      entry: rec,
      rank: kept,                       // -1 = nie zmieścił się w top10
      list: list.slice().sort((a, b) => b.score - a.score),
      isNewBest
    };
  }
};