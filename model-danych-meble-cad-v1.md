# Model danych — Meble CAD (v1)

Fundament aplikacji. Wszystkie funkcje v1 (rozkrój, DXF, okucia Blum, kolizje,
dobór frontów, skosy, frez LED, łączniki) to operacje/widoki na poniższych
encjach. Zasada nadrzędna: **jeden czysty model parametryczny**, z którego
wszystko jest wyliczane. Jednostki: **milimetry**. Układ: prawoskrętny, Z w górę.

---

## 1. Materiał

```ts
interface Material {
  id: string;
  name: string;            // np. "U708 ST9 Szary"
  thickness: number;       // mm, np. 18
  hasGrain: boolean;       // czy ma kierunek usłojenia
  sheet: { w: number; h: number };  // wymiar arkusza, mm (np. 2800 x 2070)
  defaultBanding?: string; // domyślne obrzeże (typ/grubość)
  // cena / odpad → moduł wyceny (poza v1)
}
```

## 2. Płyta (formatka) — serce modelu

```ts
interface Panel {
  id: string;
  name: string;            // np. "bok lewy"
  materialId: string;
  thickness: number;       // zwykle z materiału; pole na nadpisanie

  // KSZTAŁT: kontur 2D w płaszczyźnie lica. Obsługuje prostokąt I trapez (skosy).
  contour: Vec2[];         // wielokąt, mm, kolejność CCW

  // POŁOŻENIE w 3D (montaż)
  transform: { position: Vec3; rotation: Vec3 };

  // KRAWĘDZIE: jedna pozycja na bok konturu
  edges: Edge[];

  // USŁOJENIE
  grain?: { direction: 0 | 90;     // wzdłuż / wszerz formatki
            groupId?: string };    // ciągłość usłojenia: wspólny pas (komplet frontów)

  // STRONA OBRÓBKI (lico bazowe) — do której odnoszą się operacje
  baseFace: 'front' | 'back';      // ratuje przed lustrem w DXF/CNC

  // OPERACJE: nawierty, frezy, wycięcia (model ujednolicony — p. niżej)
  operations: Operation[];
}

interface Edge {
  bandingType?: string;    // obrzeże per krawędź (brak = null)
  cutAngle: number;        // KĄT CIĘCIA przez grubość; 90 = proste, !=90 = ukos
}                          // wpięte od dnia 1 → ukosy bez refaktoru
```

**Skosy:** trapez = `contour` z jedną krawędzią pod kątem; prawdziwy ukos styku =
`edge.cutAngle != 90`. Renderer buduje bryłę z `contour` + grubości + `cutAngle`,
więc ukos jest widoczny w 3D od razu po ustawieniu kąta.

## 3. Operacja — ujednolicona (nawiert / frez / wycięcie)

```ts
type OperationType = 'hole' | 'groove' | 'cutout' | 'pocket';

interface Operation {
  id: string;
  type: OperationType;
  face: 'front' | 'back' | { edge: number };   // lico / spód / numer krawędzi
  source: 'manual' | { connector: string } | { hardware: string };
  dxfLayer: string;        // np. 'DRILL', 'GROOVE', 'CUTOUT'

  // parametry zależne od typu:
  hole?:   { x: number; y: number; diameter: number; depth: number; through?: boolean };
  groove?: { path: Vec2[]; width: number; depth: number };    // frez LED, nut na plecy
  cutout?: { path: Vec2[]; depth: number; through?: boolean }; // pod zawieszki, plecy
}
```

**Frez pod LED** = `type: 'groove'`. **Wycięcia** (plecy, pod zawieszki) =
`type: 'cutout'`. Operacje z `source` innym niż `manual` są **regenerowane** przy
edycji łącznika/okucia oraz zmianie kształtu/grubości płyty. Sam ruch/obrót
płyty nie zmienia lokalnych współrzędnych nawiertu. Przy automatycznej regeneracji
łącznika w rozjechanym układzie emiter nie może zostawić otworu na krawędzi:
cały okrąg nawiertu musi mieścić się w konturze płyty, a problem relacji zostaje
miękkim ostrzeżeniem walidacji.

## 4. Łącznik korpusu — „przepis na otwory"

```ts
type ConnectorType = 'dowel' | 'confirmat' | 'cam';

interface Connector {
  id: string;
  type: ConnectorType;
  panelA: string;  // płyta "licowa" (czoło B opiera się o lico A)
  panelB: string;  // płyta dochodząca czołem

  // POŁOŻENIE: względne do krawędzi (szablon się skaluje) + opcjonalny absolut
  placement: { fromEdge: number;   // numer krawędzi odniesienia
               offset: number;     // mm od krawędzi
               absolute?: Vec2 };  // nadpisanie ręczne (wyjątki)

  params?: Record<string, number>; // resztę liczy system → emituje Operation na obu płytach
}
```

Każdy łącznik po postawieniu generuje `Operation` na **obu** płytach, różne wg
typu (przykładowe Ø — do potwierdzenia z Twoją technologią):
- `dowel`: Ø8 w czole B + Ø8 w licu A
- `confirmat`: w płycie przelotowej Ø7 przelot + Ø10 pogłębienie; w czole drugiej Ø5 prowadzący
- `cam` (mimośród): Ø15 rozwierta w licu jednej + Ø8 trzpień w czole drugiej (+ kołek prowadzący)

## 5. Okucie — zawias Blum (v1)

```ts
interface Hardware {
  id: string;
  kind: 'hinge';   // później: 'drawer' (Tandem/Legrabox), 'lift' (Aventos)
  hinge?: Hinge;
}

interface Hinge {
  family: string;                            // "CLIP top BLUMOTION"
  openingAngle: number;                      // 110  → do kolizji łuku otwarcia
  overlayClass: 'full' | 'half' | 'inset';   // nakładany / półnakładany / wpuszczany

  cup: {
    diameter: 35;
    distanceTB: number;     // TB/B: od krawędzi drzwi do krawędzi otworu puszki; środek C = TB + Ø/2
    depth: number;          // z katalogu
    mounting: 'screw' | 'inserta' | 'expando';
    screwPattern: Vec2[];   // pozycje wkrętów puszki — z katalogu
  };

  plate: {                  // prowadnik (podstawa montażowa)
    distance: 0 | 3 | 6 | 9;
    type: string;           // CLIP / na wkręty / EXPANDO
    screwPattern: Vec2[];   // z katalogu
  };

  options: { blumotion: boolean; tipOn: boolean; servoDrive: boolean };

  doorPanel: string;
  sidePanel: string;
  placement: { fromEdge: number; offset: number }[];  // pozycje zawiasów na froncie
}
```

Zawias po postawieniu emituje: rozwiertę puszki Ø35 + wkręty na **froncie**, oraz
otwory prowadnika na **boku**. Nałożenie i szczelina liczone z
`overlayClass + distanceTB + grubość frontu` (relacja z tabeli F w katalogu).

**Katalog okuć / kreator:** jeden szablon zawiasu opisuje kompletne okucie, czyli
nawierty na **dwóch płytach**: front (puszka + mocowanie puszki) oraz bok
(prowadnik). Główna ścieżka dodawania nowych okuć to ręczny kreator z podglądem
2D i walidacją; import plików producenta może być później pomocnikiem, ale nie
źródłem prawdy dla ról nawiertów.

W kreatorze zawiasu wymiary są interpretowane tak: `B`/`TB` = od krawędzi
frontu do krawędzi puszki, środek puszki wynika z `B + Ø/2`; mocowanie puszki
ma `D` = od osi puszki do osi otworu mocowania oraz `C` = rozstaw mocowań;
prowadnik ma `P` = od przedniej krawędzi boku do osi prowadnika oraz `S` =
rozstaw otworów prowadnika. Rysunek techniczny pokazuje te same oznaczenia, ale
nie dodaje osobnego edytowalnego wymiaru środka puszki.

**Domyślny zawias na start (najpopularniejszy):**
`family: "CLIP top BLUMOTION"`, `openingAngle: 110`, `overlayClass: 'full'`,
`cup.mounting: 'screw'`, `plate.distance: 0`. Parametry Fazy 5 z instrukcji Blum:
puszka Ø35/głęb. 13, TB/B default 5 (C = 22,5), mocowanie puszki 45 oraz 9,5 od środka puszki w głąb frontu,
prowadnik system 32: 37/32/Ø5.

## 6. Szafka / szablon (parametryczny)

```ts
interface CabinetTemplate {
  id: string;
  name: string;
  params: Record<string, number>;   // width, height, depth, shelves, ...
  // generator na podstawie params produkuje panels[] + connectors[] + hardware[]
  // z pozycjami WZGLĘDNYMI → zmiana wymiaru przelicza wszystko.
  build: (params: Record<string, number>) => {
    panels: Panel[]; connectors: Connector[]; hardware: Hardware[];
  };
}
```

Zapisana „szafka" = definicja parametryczna (skaluje się). Konkretny projekt =
jej migawka w danym wymiarze.

## 7. Projekt (korzeń)

```ts
interface Project {
  id: string;
  units: 'mm';
  settings: {
    kerf: number;              // szerokość rzazu, mm
    bandingAllowance: number;  // naddatek na obrzeże
    defaultBaseFace: 'front' | 'back';
  };
  materials: Material[];
  furniture: (Panel | CabinetTemplate)[];  // moduły / szafki w projekcie
}
```

---

## Mapowanie na funkcje v1
- **Rozkrój** ← `Panel.contour` (prostokąt opisany + flaga cięcia kątowego) + `Material` + `grain` + `settings.kerf`. Optymalizacja **gilotynowa** (osobny moduł).
- **DXF** ← kontur na warstwie cięcia + `operations` na warstwach (DRILL/GROOVE/CUTOUT) + flagi `cutAngle` + `baseFace`.
- **Okucia Blum** ← `Hardware.hinge` → `Operation` na froncie i boku.
- **Kolizje** ← OBB (statyczne) + łuk otwarcia z `openingAngle` (ruch) — zbiór niezależnych reguł.
- **Dobór frontów** ← `overlayClass + distanceTB + grubość` → nałożenie / szczelina.
- **Skosy** ← `contour` (trapez) + `Edge.cutAngle`.
- **Frez LED** ← `Operation type 'groove'`.
- **Łączniki** ← `Connector` emituje `Operation` na obu płytach.
- **Szablony** ← `CabinetTemplate` z pozycjami względnymi.

## Poza zakresem v1 (model ma „dorastać", nie być przepisywany)
Wycena / cenniki, role i obieg klient→wycena→status, magazyn płyt i odpadów,
oznaczanie skaz, G-code i programy na piły, etykiety, aranżacja pomieszczeń.

## Do potwierdzenia
- Standardy konstrukcji: grubość korpusu (18?), plecy HDF (w nut czy nakładane?), domyślne łączenie korpusu, grubość/typ obrzeża, standardowe szczeliny między frontami.
- Dokładne liczby Blum dla CLIP top BLUMOTION 110° są przyjęte; kolejne warianty zawiasów dopisujemy z katalogu przy dodawaniu.
