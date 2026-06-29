/**
 * ============================================================================
 *  Meble CAD — model danych (ŹRÓDŁO PRAWDY)
 * ============================================================================
 *  Ten plik jest lustrem `backend/app/models/schema.py` (Pydantic).
 *  Każda zmiana TUTAJ musi mieć odbicie TAM — nie pozwól im się rozjechać.
 *
 *  Jednostki: MILIMETRY wszędzie.
 *  Kąty: STOPNIE wszędzie (cutAngle, rotation, openingAngle). Konwersja na
 *        radiany następuje dopiero na granicy renderera (scena 3D).
 *
 * ----------------------------------------------------------------------------
 *  UKŁAD WSPÓŁRZĘDNYCH (ustalony w Fazie 1 — Faza 2+ się do tego odnosi)
 * ----------------------------------------------------------------------------
 *  ŚWIAT (montaż): prawoskrętny, Z w GÓRĘ. position/rotation płyty są w tym
 *  układzie. rotation = Euler XYZ w stopniach.
 *
 *  PŁYTA — lokalny układ ramki płyty (do niego odnoszą się kontur i operacje):
 *
 *    Patrzymy na LICO PRZEDNIE ('front') płyty od zewnątrz:
 *      • X → w prawo
 *      • Y → w górę
 *      • Z → w stronę patrzącego (wychodzi z lica 'front')
 *    Ramka jest prawoskrętna (X w prawo, Y w górę, Z na nas).
 *
 *    PUNKT (0,0): lewy-dolny róg konturu. Dla prostokąta W×H:
 *      contour = [[0,0], [W,0], [W,H], [0,H]]   // CCW (przeciwnie do zegara)
 *
 *    BRYŁA: kontur leży w płaszczyźnie Z=0 (= lico 'front'); materiał wychodzi
 *    w stronę −Z. Czyli slab zajmuje Z ∈ [−thickness, 0]:
 *      • lico 'front' (bazowe odniesienie rysunku) → płaszczyzna Z = 0
 *      • lico 'back'                              → płaszczyzna Z = −thickness
 *
 *  OPERACJE (otwory/frezy/wycięcia):
 *    Dla `face` 'front'/'back': WSZYSTKIE współrzędne (x,y) operacji są podane w
 *    TYM SAMYM, przednim układzie konturu (model NIE przechowuje lustra). `depth`
 *    mierzymy w głąb materiału (front → ku −Z, back → ku +Z).
 *
 *    Dla `face: { edge: n }` (obróbka w CZOLE krawędzi n) — konwencja Fazy 3:
 *      • x = odległość WZDŁUŻ krawędzi od jej początku contour[n] (ku contour[n+1]),
 *      • y = położenie PRZEZ GRUBOŚĆ, mierzone od lica bazowego 'front' (z = −y;
 *            0 = przy licu 'front', thickness = przy licu 'back').
 *      • Przy cutAngle≠90 `y` mierzymy WZDŁUŻ lica 'front' (oś Z), NIE po ściętej
 *        powierzchni — punkt kotwiczenia leży na linii krawędzi z=0 przesuniętej
 *        w głąb o y. Oś otworu w czole biegnie wzdłuż normalnej krawędzi do środka.
 *    (Pełny edytor operacji w czole — Faza 4 z łącznikami; tu wybór + marker.)
 *
 *  KRAWĘDZIE: `edges[n]` opisuje bok konturu między contour[n] a
 *    contour[(n+1) % len]. Dla standardowego prostokąta:
 *      edge 0 = dół, edge 1 = prawo, edge 2 = góra, edge 3 = lewo.
 *    `face: { edge: n }` w operacji = obróbka na tej krawędzi (czole).
 *
 *  baseFace ('front' | 'back') — KTÓRE fizyczne lico jest stroną odniesienia
 *    obróbki (kładzione na stół CNC / strona "0" w DXF). NIE zmienia zapisu
 *    współrzędnych — mówi eksporterowi, dla której strony trzeba odbić X w lustrze
 *    przy generowaniu programu per-strona, żeby szablon zapisany raz nie został
 *    przypadkiem zlustrzany. Domyślnie z `project.settings.defaultBaseFace`.
 *
 *  cutAngle (Faza 2 — KONWENCJA DOMKNIĘTA): kąt między płaszczyzną boku
 *    (cięcia) a LICEM BAZOWYM 'front' (płaszczyzna Z=0).
 *      • 90°  = bok prostopadły do lic (brak ukosu),
 *      • <90° = lico 'back' cofa się DO WEWNĄTRZ (front szerszy),
 *      • >90° = lico 'back' wychodzi NA ZEWNĄTRZ (front węższy).
 *    Obrys bazowy (kontur na Z=0) NIE zmienia się — ukos żyje w grubości.
 *    Poziome cofnięcie krawędzi na licu 'back': Δ = thickness / tan(cutAngle).
 *    Bryłę liczy `model/geometry.ts` (backContour/slabPositions). Wartości
 *    rozsądne: ~30–150° (skrajne kąty mogą wywrócić kontur 'back').
 * ============================================================================
 */

export type Vec2 = [number, number]
export type Vec3 = [number, number, number]

// --- 1. Materiał ------------------------------------------------------------
export interface Material {
  id: string
  name: string // np. "U708 ST9 Szary"
  thickness: number // mm, np. 18
  hasGrain: boolean // czy ma kierunek usłojenia
  sheet: { w: number; h: number } // wymiar arkusza, mm (np. 2800 x 2070)
  defaultBanding?: string // domyślne obrzeże (typ/grubość)
}

// --- 2. Płyta (formatka) ----------------------------------------------------
export interface Edge {
  bandingType?: string // obrzeże per krawędź (brak = undefined)
  cutAngle: number // kąt cięcia przez grubość; 90 = proste, !=90 = ukos (stopnie)
}

export interface Panel {
  id: string
  name: string // np. "bok lewy"
  materialId: string
  thickness: number // zwykle z materiału; pole na nadpisanie

  contour: Vec2[] // kontur 2D w płaszczyźnie lica 'front', CCW, (0,0) = lewy-dół
  transform: { position: Vec3; rotation: Vec3 } // świat, Z-up; rotation w stopniach

  edges: Edge[] // jedna pozycja na bok konturu (edges[n] = bok contour[n]→[n+1])

  grain?: {
    direction: 0 | 90 // wzdłuż / wszerz formatki
    groupId?: string // ciągłość usłojenia: wspólny pas (komplet frontów)
  }

  baseFace: 'front' | 'back' // strona odniesienia obróbki (p. nagłówek pliku)

  operations: Operation[]

  groupId?: string   // przynależność do "mebla" (grupowanie — wejdzie z szablonami)
  roomId: string     // id pomieszczenia, w którym płyta się znajduje
  cabinetId?: string // Faza 7.3b: ustawione tylko na płytach pochodnych szafki; NIE jest w JSON
}

// --- 3. Operacja — ujednolicona (nawiert / frez / wycięcie / kieszeń) --------
export type OperationType = 'hole' | 'groove' | 'cutout' | 'pocket'

export type OperationFace = 'front' | 'back' | { edge: number }
export type OperationSource = 'manual' | { connector: string } | { hardware: string }

export interface HoleParams {
  x: number
  y: number
  diameter: number
  depth: number
  through?: boolean
}
export interface GrooveParams {
  path: Vec2[]
  width: number
  depth: number
} // frez LED, nut na plecy
export interface CutoutParams {
  path: Vec2[]
  depth: number
  through?: boolean
} // plecy, pod zawieszki
export interface PocketParams {
  path: Vec2[]
  depth: number
} // frez nieprzelotowy / kieszeń

export interface Operation {
  id: string
  type: OperationType
  face: OperationFace // lico / spód / numer krawędzi
  source: OperationSource // 'manual' lub regenerowane z łącznika/okucia
  dxfLayer: string // np. 'DRILL', 'GROOVE', 'CUTOUT'

  hole?: HoleParams
  groove?: GrooveParams
  cutout?: CutoutParams
  pocket?: PocketParams
}

// --- 4. Łącznik korpusu -----------------------------------------------------
export type ConnectorType = 'dowel' | 'confirmat' | 'cam'

export interface Connector {
  id: string
  type: ConnectorType
  panelA: string // płyta "licowa" (czoło B opiera się o lico A)
  panelB: string // płyta dochodząca czołem

  placement: {
    fromEdge: number // numer krawędzi odniesienia
    offset: number // mm od krawędzi
    absolute?: Vec2 // nadpisanie ręczne (wyjątki)
  }

  // Strona, z której wiercona jest puszka mimośrodu (cam) na płycie B. Brak = auto z geometrii.
  // Mimośród to GENERYCZNE okucie — wymiary to defaulty (params), NIE z katalogu Blum.
  camFace?: 'front' | 'back'

  params?: Record<string, number> // resztę liczy system → Operation na obu płytach
  groupId?: string
}

// --- 5. Okucie — zawias Blum (v1) -------------------------------------------
export interface Hinge {
  family: string // "CLIP top BLUMOTION"
  openingAngle: number // 110 → do kolizji łuku otwarcia (stopnie)
  overlayClass: 'full' | 'half' | 'inset' // nakładany / półnakładany / wpuszczany

  cup: {
    diameter: number // 35
    distanceTB: number // TB/B: od krawędzi drzwi do krawędzi otworu puszki; środek = TB + Ø/2
    depth: number // z katalogu
    mounting: 'screw' | 'inserta' | 'expando'
    screwPattern: Vec2[] // pozycje wkrętów puszki — z katalogu
  }

  plate: {
    distance: 0 | 3 | 6 | 9
    type: string // CLIP / na wkręty / EXPANDO
    screwPattern: Vec2[] // z katalogu
  }

  options: { blumotion: boolean; tipOn: boolean; servoDrive: boolean }

  doorPanel: string // id płyty frontu
  sidePanel: string // id płyty boku
  placement: { fromEdge: number; offset: number }[] // pozycje zawiasów na froncie
  hingeId?: string // id wpisu w hardware-catalog; brak = fallback na stałe blum-catalog
}

export interface Hardware {
  id: string
  kind: 'hinge' // później: 'drawer' (Tandem/Legrabox), 'lift' (Aventos)
  hinge?: Hinge
  groupId?: string
}

// --- 6. Pomieszczenie (lekki, czysto wizualny) ------------------------------
export interface RoomWall {
  id: string
  size: Vec2 // [długość, wysokość]
  transform: { position: Vec3; rotation: Vec3 } // świat, Z-up; rotation w stopniach
  color: string
}

export interface Room {
  id: string
  name: string
  walls: RoomWall[]
  floor: { size: Vec2; color: string } // płaszczyzna XY na z=0, środek w (0,0)
  ceiling: { size: Vec2; color: string } // na z = wysokość pomieszczenia
}

// --- 7. Szablon szafki (Faza 9 — tu tylko typ danych) -----------------------
export interface CabinetTemplate {
  id: string
  name: string
  params: Record<string, number> // width, height, depth, shelves, ...
  // generator build(params) → { panels, connectors, hardware } — Faza 9
}

// --- 7b. Szafka parametryczna (Faza 7.3b) -----------------------------------
export type CabinetType = 'standing' | 'wall' | 'base'

export interface Cabinet {
  id: string
  name: string
  type: CabinetType
  params: {
    W: number      // szerokość zewnętrzna mm
    H: number      // wysokość zewnętrzna mm
    D: number      // głębokość zewnętrzna mm
    T: number      // grubość płyty mm
    backT: number  // grubość pleców HDF mm
    doors: 0 | 1 | 2
    shelves: number
    plinth?: number // tylko 'base' — wysokość cokołu mm
  }
  materialId: string
  roomId: string
  position: Vec3   // lewy-przedni-dolny róg w układzie świata
}

// --- 8. Projekt (korzeń) ----------------------------------------------------
export interface ProjectSettings {
  kerf: number // szerokość rzazu, mm
  bandingAllowance: number // naddatek na obrzeże, mm
  defaultBaseFace: 'front' | 'back'
  bandingThickness: number // grubość okleiny per krawędź (mm); odejmowana od formatu przy rozkroju
}

export interface Project {
  id: string
  name: string
  units: 'mm'
  settings: ProjectSettings
  materials: Material[]
  // Tryb ręczny v1: płaskie tablice. Grupowanie w "meble" przez groupId,
  // pełne szablony (CabinetTemplate) dochodzą w Fazie 9 bez przebudowy.
  panels: Panel[]
  connectors: Connector[]
  hardware: Hardware[]
  rooms: Room[]
  // Faza 7.3b: szafki parametryczne. Wygenerowane płyty/łączniki/okucia NIE
  // trafiają do tablic powyżej — są pochodną cabinets[] w store.
  cabinets: Cabinet[]
}

// --- Selekcja (stan UI, nie część zapisywanego modelu) ----------------------
export type Selection =
  | { type: 'panel' | 'room' | 'connector' | 'hardware' | 'cabinet'; id: string }
  | null
