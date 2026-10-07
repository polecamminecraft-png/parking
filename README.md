# 🚗 Parking Defender – Tower Defense

Obrona wielkiego parkingu przed pojazdami próbującymi wjechać na zakazany teren
i zniszczyć szlaban końcowy. Gra w całości w czystym JavaScript + Canvas
(bez zewnętrznych assetów – grafika to emoji + kształty wektorowe).

## Uruchomienie
Wszystko jest statyczne – wystarczy otworzyć **`index.html`** w przeglądarce
(podwójne kliknięcie w plik lub serwujesz lokalnie, np. `python -m http.server`).

## Sterowanie (rozgrywka)
- **Lewy klik** – wybór wieżyczki w sklepie, potem klikaj wolne pola (parking) by budować.
- **Kliknij zbudowaną wieżę** – panel ulepszania (⬆) i sprzedaży (sprzedaj).
- **1–7** – szybki wybór jednej z 7 wieżyczek. **Spacja** – start fali. **F** – prędkość gry (1x/2x/3x).
- **PPM lub Esc** – anuluj wybór / stawianie.
- **⏩ Prędkość** w panelu gry – przyśpieszenie symulacji (1x, 2x, 3x), także klawisz **F**.
- **🏆 Top wyniki** – tabela najlepszych wyników (top 10) dla aktualnej mapy.

## Wieżyczki i specjalizacje
Na **3. poziomie** (po 2. ulepszeniu) wieża pyta o **specjalizację A lub B** – wybór trwale
zmienia jej zachowanie. 7 typów wieży:

| Wieża | Koszt | Rola | Specjalizacja A | Specjalizacja B |
|---|---|---|---|---|
| 👮 Strażnik | 60 | mandaty = spowolnienie | silniejsze/dłuższe spowolnienie | +40% nagrody za pojazdy w zasięgu |
| 🚓 Policjant | 120 | szybkie strzały | szybkostrzelność +40% | obrażenia +70% |
| 🚒 Strażak | 200 | stożek wody (AOE) | szerszy stożek i większy dmg | piana: obrażenia w czasie |
| 💣 Saper | 160 | bomba po łuku z eksplozją | promień wybuchu +40% | eksplozja spowalnia 40% / 2 s |
| 🎯 Snajper | 240 | ogromny zasięg, potężny strzał | zasięg +60 | dmg +60% (wolniejszy strzał) |
| 🏗️ Dźwig | 210 | cofa pojazdy wzdłuż trasy | cofnięcie 90 px | hak podwójny (2 pojazdy) |
| 🛰️ Kontroler Ruchu | 150 | aura: +40% obrażeń w strefie | podatność +60% | dodatkowe spowolnienie 25% |

Wszystkie wieże ulepszają się: obrażenia ×1.6 / poziom, zasięg +18 / poziom,
cooldown ×0.86 / poziom, do **poziomu 4**.

## Tryb nieskończony i wyniki
- Nie ma limitu fal: po 15 "podstawowych" falach komunikat odblokowuje **tryb nieskończony** i trudność rośnie dalej (HP, liczebność, prędkości) aż do przegranej.
- **Wynik = (odparte fale × 100) + (zniszczone pojazdy × 5) + budżet** (serca nie wliczają się do wyniku).
- Po przegranej wpisujesz **nick** i zapisujesz wynik do tabeli topów **danej mapy** (`localStorage`, top 10, rekord oznaczony 🏆, nick jest zapamiętywany).
- Tabelę otwierasz z menu głównego, przycisku "🏆 Top wyniki" w panelu gry oraz po przegranej.

## Sterowanie (kreator map)
- Narzędzia: **P** droga, **S** START, **E** END, **O** przeszkoda, **X** gumka.
- Przeciągaj myszą aby malować po siatce.
- **Sprawdź** – walidacja (START i END muszą istnieć + ciągła ścieżka → BFS).
- **Zapisz** – mapa ląduje w `localStorage` i od razu jest grywalna.
- **Eksport / Import JSON** – kopiuj/wklejaj kody map.
- **Graj tą mapą** – uruchamia rozgrywkę na aktualnym rysunku.

## Zawartość
| Moduł | Rola |
|---|---|
| `GameEngine` | pętla `requestAnimationFrame`, stany MENU / PLAYING / EDITOR / GAME_OVER, prędkość 1x/2x/3x |
| `GridSystem` | siatka 16×12, typy kafelków, BFS pathfinding, animowane renderowanie drogi |
| `Tower` + konfiguracje | 7 typów wieży (Strażnik, Policjant, Strażak, Saper, Snajper, Dźwig, Kontroler Ruchu); poziomy 1–4 + specjalizacja A/B |
| `Enemy` | pojazdy Lvl 1–10, pasek HP, spowolnienia, podatność (radar), obrażenia w czasie (piana), dron leci na wprost |
| `Projectile` | pociski, mandaty, bomba sapera (lot po łuku + eksplozja) |
| `WaveManager` | fale 1–15 = "podstawowe", potem **tryb nieskończony** (trudność rośnie bez końca) |
| `Highscores` | tabela najlepszych wyników per mapa (top 10, localStorage) |
| `MapEditor` | pędzle, walidacja ścieżki, JSON import/export, localStorage |
| `UIController` | menu, sklep, panel wieży (specjalizacje), narzędzia edytora |

## Mapa domyślna
Trudna **serpentyna** 49 pól (START → 5 zakrętów → END) z **35 przeszkodami**
którzy tworzą wąskie gardła. Ścieżka jest walidowana algorytmem BFS, a własne mapy
możesz budować w kreatorze.

## Przeciwnicy (progresja)
| Lvl | Pojazd | Cechy |
|---|---|---|
| 1 | 🛴 Hulajnoga | bardzo szybka, mało HP |
| 2 | 🚲 Rower | średnia prędkość, mało HP |
| 3 | 🛵 Skuter | szybki, średnie HP |
| 4 | 🏍️ Motor | bardzo szybki, średnie HP |
| 5 | 🚗 Samochód | zrównoważony |
| 6 | 🚐 Bus | wolny, dużo HP, większe żniwa |
| 7 | 🚚 Ciężarówka | bardzo wolna, bardzo dużo HP |
| 8 | 🪖 Czołg (boss) | odporny na spowolnienia, 5 ❤️ za przelot |
| 9 | 🚊 Pociąg (boss) | gigantyczne HP |
| 10 | ✈️ Samolot (boss) | leci na wprost do celu, ignoruje zakręty |

## Pliki
```
index.html        – interfejs, style, layout
js/config.js      – stałe, wieże, pojazdy, mapa domyślna
js/grid.js        – GridSystem (siatka + pathfinding)
js/entities.js    – Enemy, Tower, Projectile
js/waves.js       – WaveManager
js/editor.js      – MapEditor
js/ui.js          – UIController
js/engine.js      – GameEngine (pętla + wejście)
```