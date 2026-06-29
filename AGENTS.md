# AGENTS.md — Meble CAD (kontekst projektu)

Ten plik to **stały kontekst dla Codex**. Czytaj go na początku każdej sesji
i trzymaj się go jako źródła prawdy. Szczegółowy model danych jest w
`model-danych-meble-cad-v1.md` (też w tym repo) — czytaj oba pliki.

## Co budujemy
Webowa aplikacja do **ręcznego, parametrycznego projektowania mebli płytowych** —
w praktyce tańsza, webowa wersja Pro100 / Palette CAD skrojona pod konkretne
potrzeby stolarskie. v1 to **rdzeń projektowy** (nie cała szerokość tych
programów): ręczne projektowanie + rozkrój + DXF + okucia Blum + kolizje + dobór
frontów. Reszta dokładana warstwami później, bez przebudowy.

## Stack
**Frontend:** React 18 + Vite + TypeScript, react-three-fiber + @react-three/drei
(3D), Zustand (stan), Tailwind CSS (UI), axios.
**Backend:** FastAPI + Pydantic (walidacja), ezdxf (eksport DXF), Python 3.10+.

## Zasady pracy (pilnuj przez cały czas)
- **Najpierw plan, kod po akceptacji.** Przy większych zmianach pokaż plan/strukturę i czekaj na „ok".
- **Jednostki: milimetry.** Wszędzie.
- **Typy modelu = jedno źródło prawdy.** Lustrzane po obu stronach: TypeScript (front) ↔ Pydantic (backend). Nie pozwól im się rozjechać.
- **Czysty podział warstw:** typy modelu / store (Zustand) / scena 3D / panele UI / backend — osobno.
- **Płyta to nie „szer × wys".** Płyta = kontur 2D (prostokąt LUB trapez) + grubość + `cutAngle` per krawędź (domyślnie 90°, ≠90° = ukos) + operacje + lico bazowe + obrzeże per krawędź.
- **Operacje ujednolicone** (nawiert / frez / wycięcie). Operacje z `source = connector` lub `hardware` są **regenerowane** przy edycji łącznika/okucia i zmianie kształtu/grubości płyty; sam ruch/obrót płyty nie przesuwa nawiertu w jej lokalnym układzie.
- **Pozycje łączników i okuć: względne do krawędzi** (żeby szablony skalowały się do nowych wymiarów), z opcją absolutnego nadpisania dla wyjątków.

## Model danych (skrót — pełny w `model-danych-meble-cad-v1.md`)
- **Material** — nazwa, grubość, kierunek usłojenia, wymiar arkusza.
- **Panel (płyta)** — kontur 2D, grubość, transform 3D, krawędzie (obrzeże + `cutAngle`), usłojenie (+ grupa ciągłości), lico bazowe, operacje.
- **Operation** — `hole` / `groove` (frez LED) / `cutout` (plecy, zawieszki) / `pocket` (frez nieprzelotowy); pozycja, wymiary, strona, `source`, warstwa DXF.
- **Connector (łącznik korpusu)** — `dowel` / `confirmat` / `cam`; łączy dwie płyty, emituje otwory na **obu** (różne wg typu).
- **Hardware → Hinge (zawias Blum)** — rodzina, kąt otwarcia, klasa nałożenia, puszka (Ø35, TB, głębokość, wzór wkrętów), prowadnik, opcje; emituje rozwiertę puszki na froncie + otwory prowadnika na boku.
- **CabinetTemplate** — parametryczny szablon szafki (pozycje względne) — faza późniejsza (Faza 9).
- **Project** — korzeń: ustawienia (kerf, naddatki, lico bazowe), `materials[]`, oraz **płaskie tablice** `panels[]` / `connectors[]` / `hardware[]` / `rooms[]`. Grupowanie w „meble" przez opcjonalne `groupId` na encjach; pełne szablony (CabinetTemplate) dochodzą później bez przebudowy.
- **Room (pomieszczenie)** — lekki, czysto wizualny obiekt (bez wierceń/rozkroju): `id`, `name`, ściany/podłoga/sufit z kolorem.

**Domyślny zawias na start:** CLIP top BLUMOTION, 110°, nakładany (pełne
nałożenie), puszka na wkręty, podstawa 0 mm. Przyjęte z instrukcji Blum:
puszka Ø35/głęb. 13, TB/B domyślnie 5 (środek C = TB + Ø/2 = 22,5),
mocowanie puszki 45 oraz 9,5 od środka puszki w głąb frontu, prowadnik system 32: 37/32/Ø5.

```ts
interface Room {
  id: string;
  name: string;
  walls:   { id: string; size: Vec2; transform: { position: Vec3; rotation: Vec3 }; color: string }[];
  floor:   { size: Vec2; color: string };
  ceiling: { size: Vec2; color: string };
}
```

## Decyzje przyjęte (v1) — zatwierdzone
- **Vec2/Vec3 = krotki** `[x,y]` / `[x,y,z]` (naturalne dla r3f, zero konwersji).
- **Kąty: stopnie** wszędzie (`cutAngle`, `rotation`, `openingAngle`). Konwersja na radiany dopiero na granicy renderera.
- **Struktura Project: płaska** (`panels/connectors/hardware/rooms`) + `groupId` (grupowanie później).
- **`Operation.type`** zawiera `pocket` (frez nieprzelotowy).
- **`id`** generowane przez `nanoid`.
- **Skala sceny:** 1 jednostka = 1 mm; świat **Z-up** (`camera.up = (0,0,1)`).
- **Materiał korpusu domyślnie 18 mm.**
- **Pydantic = lustro od dnia 1** (`backend/app/models/schema.py`, `extra='forbid'` łapie rozjazd).
- **Przeciąganie markerów myszką** (operacje/łączniki/okucia) — **jeden wspólny system** drag + raycasting + snapping, dopiero **po Fazie 5**. Do tego czasu edycja tylko przez pola liczbowe w Inspektorze.
- **Stan widoku ≠ model.** `store/viewStore.ts` (Zustand, **bez** autosave/serializacji) trzyma rzeczy czysto wizualne: widoczność pomieszczenia, krycie ścian, włącznik magnesu. Nigdy nie wsiąka do `Project`/JSON/eksportu.
- **Snapping płyt („magnes")** — pomoc przy ustawianiu w styk: dociąganie world-AABB płyt przy przeciąganiu gizmem (`model/snapping.ts`, próg ~18 mm, styk/licowanie per oś), feedback = linia styku, Alt/Ctrl = chwilowo wyłącz. To NIE kolizje (przenikanie/zakaz wyjścia poza pokój = Faza 7, reguły).
- **Złącza gerunkowe** (łącznik na krawędzi `cutAngle≠90`) — **nieobsługiwane w v1**; tylko ostrzeżenie (`isMiterEdge` w validate + ConnectorEditor).
- **`deriveConnectorAnchor` jest SPRAWDZONY i POPRAWNY** (sanity + porównanie z THREE Δ≈1e‑14, też lico 'back' z obrotem). Objawy „duża szczelina / dziwne xA" biorą się ze **złej krawędzi styku** (`fromEdge`) albo **zamienionych ról A=lico/B=czoło**, NIE z błędu transformacji/odwrotności. **Nie wracać do tego jako do buga** — najpierw 🎯 dobór krawędzi / zamiana A↔B / 🐞 log.
- **Walidacja: jakość ≠ struktura.** Ostrzeżenia JAKOŚCI/technologiczne (Ø > grubość, otwór poza konturem, szczelina łącznika, gerunk) są **miękkie** — liczy je front (`model/validate.ts → collectWarnings`) i **NIGDY nie blokują** zapisu/eksportu/round-tripa. Zapis (autosave/JSON) jest czysto frontowy i bezwarunkowy. Round-trip `/project/validate` sprawdza **wyłącznie strukturę** (Pydantic → 422 tylko przy realnej niepoprawności). Nie zamieniać ostrzeżeń jakości na twardy błąd po żadnej stronie.

## Układ współrzędnych płyty (pełny opis: komentarz nagłówka w `types.ts`)
- Patrząc na **lico 'front'**: X→prawo, Y→góra, Z→na patrzącego. `(0,0)` = lewy-dolny róg konturu.
- Bryła: kontur w płaszczyźnie Z=0 (lico 'front'); materiał ku −Z → slab Z ∈ [−grubość, 0].
- Współrzędne **wszystkich** operacji (też `face:'back'`) są w tym samym przednim układzie — model nie trzyma lustra.
- `edges[n]` = bok konturu `contour[n] → contour[(n+1)%len]` (prostokąt: 0=dół,1=prawo,2=góra,3=lewo).
- `baseFace` = które fizyczne lico jest stroną odniesienia obróbki (eksporter wie, gdzie odbić X) — nie zmienia zapisu współrzędnych.

## Zapis/odczyt (persystencja)
- Cały `Project` ↔ JSON. Plik opakowany w kopertę `{ schemaVersion, savedAt, project }` (miejsce na migracje).
- **Eksport/Import** pliku `.meblecad.json` + **autosave** w `localStorage` (debounce). `serialization.ts`.

## Fazy implementacji
1. **Basics** ✅ ZROBIONE — struktura React + Zustand store + scena 3D (proste prostokąty) + proste **Room** (ściany/podłoga/sufit z color pickerem). + zapis/odczyt JSON (eksport/import + autosave localStorage) + udokumentowany układ współrzędnych.
2. **Panels** — edytor płyt, transformacje, kontury (prostokąty + trapezy), `cutAngle` per krawędź, obrzeże per krawędź, lico bazowe.
3. **Operations** ✅ ZROBIONE — nawierty, frezy (w tym pod LED), wycięcia (plecy, zawieszki), kieszenie: UI (Inspector + OperationEditor) + store + markery 3D (OperationMarks). Przy zmianie lica pozycja otworu jest przeliczana na kontekst (płaszczyzna ↔ czoło). **Reguła lico vs operacja:** `groove`/`cutout`/`pocket` tylko na licach front/back; `hole` na licu (x,y na licu) **lub** na krawędzi `face:{edge}` (x wzdłuż krawędzi, y przez grubość). UI ukrywa krawędź dla frezu/wycięcia/kieszeni; „Sprawdź model" ostrzega o starych błędnych danych (op płaska na krawędzi) i o otworze na krawędzi z Ø > grubość.
4. **Connectors** ✅ ZAMKNIĘTA i PRZETESTOWANA (`npm run test:cam` przechodzi) — łączniki (dowel, confirmat, cam); jedno postawienie → operacje na OBU płytach. `model/connectors.ts`: kotwica liczona z pozycji względnej krawędzi panelB **wspólną** `edgeAnchorLocal` (ta sama konwencja co ręczne otwory w czole, też przy cutAngle≠90), lico A + (xA,yA) wyprowadzane z 3D (`model/transform.ts` = lustro `THREE.Euler('XYZ')`). Operacje z deterministycznym id `${cid}:A|B:i` (podmiana w miejscu), regenerowane przy edycji łącznika i zmianie kształtu/grubości dotykanej płyty; **ruch/obrót płyty nie regeneruje lokalnych nawiertów** — nawiert zostaje w płycie, a walidacja ostrzega o rozjechanej relacji. Średnice/głęb. = defaulty, `params` nadpisuje. UI: sekcja „Łączniki" w Sidebarze + `ConnectorEditor`. Sanity (DEV, **3 testy**): łącznik = ręczny otwór na ukosie; styk na licu 'back' z obrotem A (xA,yA,gap — zweryfikowane Δ≈1e‑14 vs THREE; odwrotność transformu i obsługa 'back' są poprawne); **cam klucz→otwór** (puszka/trzpień/dojście — `sanityCamParamMapping`). **Uwaga konwencja:** `placement.fromEdge` to **krawędź styku panelu B**, a role A=lico/B=czoło mają znaczenie — zły wybór krawędzi/ról daje dużą „szczelinę" (to nie błąd derive). Narzędzia w edytorze: `pickContactEdge` (🎯 dobór krawędzi min‑gap) + `debugConnectorAnchor` (🐞 log: worldPoint, Rᵀ A, surowy xA,yA,zA, lico).
   **Poprawki Fazy 4 (zestaw 2):** (1) `cam` = mimośród GENERYCZNY (Minifix/Rastex), **3 nawierty**: trzpień Ø8 w licu A (`A:0`), puszka Ø15 na licu B (`B:0`, strona = `camFace`, odsunięcie = `camEdgeDistance`), **otwór dojściowy Ø8 w czole B (`B:1`, głębokość = `crossDepth`)** — NIE z katalogu Blum (Blum = tylko zawiasy/prowadnice/podnośniki). (2) `Connector.camFace?: 'front'|'back'` (lustro Pydantic) — strona puszki na panelu B; brak = auto (=front). (3) `addConnector` domyślnie woła `pickContactEdge` (krawędź+offset z 3D); brak styku → ostrzeżenie (gap), zostaje ręcznie. (4) etykiety front/back + numery krawędzi 0–3 na zaznaczonej płycie (`scene/PanelLabels.tsx`, toggle 🏷 w toolbarze, stan w viewStore). (5) auto‑unikalne nazwy płyt (`uniqueName` → „… (2)"); krótki sufiks `id` w drzewie i dropdownach łącznika.
   **Poprawki Fazy 4 (zestaw 3 — domknięcie cam):** (6) **AUTO‑role z 3D:** `detectRoles` (porównanie obu orientacji, mniejsza szczelina = czoło↔lico) wybiera płytę z LICEM (→ trzpień = panel A) i z CZOŁEM (→ puszka+dojście = panel B); `addConnector` przypisuje wg tego, ręczne dropdowny A/B usunięte. (7) przycisk **„Zamień strony"** (`swapConnectorSides`) — odwrotny montaż, zamienia A↔B i dobiera krawędź na nowo; `validate` ostrzega o niejednoznacznych rolach dla dowel/confirmat, a dla `cam` nie zgłasza fałszywego ostrzeżenia przy styku symetrycznym (mimośród ma fallback ról). (8) `camEdgeDistance` = odsadzenie puszki od czoła B w głąb lica, default 34; niezależny od `camDepth`. (9) **CAM_PARAMS** = jedno źródło prawdy klucz→etykieta→default, wspólne dla emitera i `ConnectorEditor` (etykieta nie odklei się od otworu). (10) markery łącznika w 3D mają **kolory+podpisy ról** (puszka=czerw./trzpień=nieb./dojście=ziel., podpis pod 🏷) — `OperationMarks.CONNECTOR_ROLE` lustrem emitera. Dowód: `cam-emit-test.ts` (puszka/trzpień/dojście + `camFace` + `camEdgeDistance`).
   **Korekta cam (2026-06-14):** w mimośrodzie używamy słowa **puszka**, nie „mufa". Aktualna, sprawdzona konwencja: `panelA` = płyta z **licem styku** i **trzpieniem** (`A:0`, na licu A); `panelB` = płyta dochodząca **czołem** i zawierająca **puszkę Ø15** (`B:0`, na licu B, odsunięcie `camEdgeDistance`) oraz **otwór dojściowy** (`B:1`, w czole B). `camFace` wybiera stronę puszki na panelu B (`front/back`, brak = auto z geometrii przez `autoCamFace`, czyli strona bliższa płycie z trzpieniem/środkowi układu). Przy niejednoznacznym styku `resolveConnectorRoles('cam', first, second)` traktuje płytę, z której użytkownik dodaje łącznik, jako czoło/puszkę, więc nie trzeba od razu klikać „Zamień strony"; miękka walidacja nie zgłasza wtedy ostrzeżenia o symetrii dla `cam`. Gdy płyty zostaną rozsunięte po dodaniu łącznika, surowy punkt styku może wypaść poza obrys, ale emitowany nawiert jest trzymany w swojej płycie: **cały okrąg** musi mieścić się w konturze (odsadzenie ≥ promień + zapas, dla trzpienia co najmniej oś grubości płyty dochodzącej), a `validate` ostrzega „punkt styku wypada poza obrysem". Import/regeneracja układu z rozsuniętym łącznikiem dobiera stronę z aktualnej geometrii; przypadek `Nowy_projekt.meblecad (11).json` daje trzpień na `back`, `y=9.0`, bez wystawania poza formatkę. Standardowe defaulty cam: puszka Ø15 głęb. 13, `camEdgeDistance` 34, trzpień Ø8 głęb. 12, dojście Ø8 głęb. 34. `detectRoles` nadal wykrywa lico↔czoło z 3D, ale dla cam lico oznacza płytę z trzpieniem, a czoło oznacza płytę z puszką/dojściem. Test `cam-emit-test.ts` sprawdza mapowanie `puszka/trzpień/dojście`, `camFace`, `autoCamFace`, `camEdgeDistance`, fallback ról, brak fałszywego ostrzeżenia walidacji, przypadek rozsuniętych płyt bez uciekania nawiertu poza obrys oraz regresję z importem rozsuniętego układu.
5. **Hardware** ✅ ZAKODOWANE i PRZETESTOWANE (`npm run test:hinge` przechodzi) — zawiasy Blum CLIP top BLUMOTION (110°, nakładany, puszka na wkręty, prowadnik 0 mm). `model/blum-catalog.ts` (dane: tabela szczeliny **F** TB3–7 × front 16–26 mm dokładnie z katalogu; 28/30 mm = ostrzeżenie „próba montażu", bez liczby; wzór nałożenia **FA = 11 − MD + TB**; **TB/B = od krawędzi drzwi do krawędzi otworu puszki, środek C = TB + Ø/2**; puszka Ø35/głęb. 13; mocowanie screw=2×Ø3,5 na rozstawie 45 i odsunięciu 9,5 od środka puszki w głąb frontu, inserta/expando=2×Ø8 na tym samym wzorze; prowadnik system 32 = 37 mm od przedniej krawędzi boku, rozstaw 32, Ø5, rysowany na wewnętrznym licu boku; regulacje: wysokość ±2, głębokość +3/−2, bok ±2; rozkład 2/3/4/5 wg wysokości — orientacyjny). `model/hinges.ts`: `emitHingeOps` → puszka+wkręty na froncie (lico 'back') + prowadnik na boku; geometria boku **wyprowadzana z 3D od krawędzi zawiasowej frontu** (bez `sideEdge`, nie od środka puszki); deterministyczne id `${id}:cup|cupscrew|plate:k[:i]`, `source:{hardware:id}`, regenerowane jak łączniki i przy wczytaniu projektu/autosave. `computeFrontSize` = tylko podpowiedź + przycisk „Zastosuj do frontu" (bez cichego nadpisania). UI: sekcja „Okucia" + `HingeEditor` pokazuje rodzinę/kąt/klasę/montaż i wyliczenie C, Sidebar zostaje krótki (`Zawias: front→bok`), a wybór typu zawiasu jest przy dodawaniu w Inspektorze. Lustro Pydantic `Hinge` ma komentarz TB/B zgodny z TS. Sanity (DEV) i `hinge-emit-test.ts`: puszka C=22,5 przy TB5, mocowanie 45/C+9,5, INSERTA/EXPANDO Ø8, prowadnik 37/32/Ø5 na wewnętrznym licu, `axisWorld`.
   **OŚ OBROTU ZAWIASU (udokumentowana, NIE implementowana — pod Fazę 7):** oś = pionowa linia wzdłuż **zawiasowej krawędzi frontu** (`front.contour[fromEdge]→[fromEdge+1]`), zwracana w świecie jako `HingeAnchor.axisWorld` (dwa końce na licu 'front', Z=0). Rzeczywisty czop CLIP top leży przy przedniej krawędzi boku, przesunięty do wnętrza o offset pochodny od **TB/FA** — dokładny offset doliczy Faza 7 (łuk otwarcia/animacja), nie trzeba go rekonstruować.
   **Kreator okuć (2026-06-23):** pliki FMC/DXF nie są głównym źródłem prawdy dla okucia. Główna ścieżka to ręczny kreator szablonu bez presetu startowego (`HardwareCatalogImporter.tsx` jako kreator): użytkownik wpisuje dane frontu i boku, widzi podgląd 2D dwóch płyt, a zapis tworzy jeden kompletny `HardwareEntry` zawiasu. `model/hardware-template.ts` waliduje i buduje szablon: puszka + mocowania puszki na froncie oraz dwa otwory prowadnika na boku (`inward`, `along=±spacing/2`). Wbudowany katalog ma jeden kompletny wpis `blum-clip-top-blumotion-110`, nie osobne wpisy „puszka" i „prowadnik". FMC zostaje tylko jako narzędzie pomocnicze na później; DXF z dostarczonych plików zawiera `3DSOLID`, więc na teraz traktować go jako potencjalny model/grafikę, nie źródło nawiertów. Dowód: `npm run test:hardware-template`, `npm run test:hinge`, `npm run test:fmc`.
   **Podgląd techniczny kreatora:** `ui/HingeTechnicalPreview.tsx` pokazuje fragment frontu i boku skierowane do siebie, zawias/prowadnik oraz stale widoczne linie wymiarowe. Oznaczenia formularza: `B` = krawędź frontu → krawędź puszki, `D` = oś puszki → oś mocowania, `C` = rozstaw mocowania, `P` = krawędź boku → oś prowadnika, `S` = rozstaw prowadnika. Nie ma edytowalnego `A`/środka puszki, bo wynika z `B + Ø/2`; nie dodawać osobnej legendy literowej na rysunku.
6. **Rozkrój** — lista formatek + optymalizacja **gilotynowa** układania na arkuszach (kerf, kierunek usłojenia, naddatek na obrzeże). Osobna funkcja, NIE to samo co DXF.
7. **Kolizje** — statyczne (OBB, nakładanie płyt) + ruch (łuk otwarcia frontu wg `openingAngle`, wysuw szuflady). Zbuduj jako zbiór **niezależnych reguł** (każda: model → lista naruszeń).
8. **Export** — FastAPI + ezdxf → DXF: kontur na warstwie cięcia + operacje na warstwach (DRILL/GROOVE/CUTOUT) + flagi `cutAngle` + lico bazowe.
9. **(później) Szablony** — `CabinetTemplate` z pozycjami względnymi.

## Poza zakresem v1 (model ma do tego dorastać, nie być przepisywany)
Wycena/cenniki, role i obieg klient→wycena→status, magazyn płyt i odpadów,
oznaczanie skaz, G-code i programy na piły panelowe, etykiety, pełna aranżacja
wnętrz (tekstury, gotowe meble).

## Struktura repo (Faza 1)
```
frontend/src/
  model/      types.ts (ŹRÓDŁO PRAWDY) · defaults.ts · factories.ts · serialization.ts
  store/      projectStore.ts (Zustand + autosave)
  scene/      SceneCanvas.tsx · PanelMesh.tsx · RoomMesh.tsx
  ui/         Toolbar · Sidebar · Inspector · widgets/
  api/        client.ts (axios → /api)
backend/app/  main.py (FastAPI) · models/schema.py (lustro Pydantic)
```
Uruchomienie: `README.md`.

## Do potwierdzenia (na bieżąco)
- Grubość korpusu: **18 mm — przyjęte.** Reszta standardów do Fazy 2: plecy HDF (w nut czy nakładane), domyślne łączenie korpusu, grubość/typ obrzeża, standardowe szczeliny między frontami.
- Dokładne liczby Blum dla CLIP top BLUMOTION 110° — przyjęte dla Fazy 5; kolejne warianty zawiasów dopisujemy z katalogu przy dodawaniu.
