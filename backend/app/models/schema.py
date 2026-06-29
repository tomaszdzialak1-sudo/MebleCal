"""
Model danych — LUSTRO `frontend/src/model/types.ts` (Pydantic v2).

Każda zmiana w types.ts musi mieć odbicie tutaj. Nazwy pól celowo w camelCase
(jak w TS), żeby JSON round-tripował 1:1 bez aliasów. `extra='forbid'` celowo —
łapie rozjechanie modelu (nadmiarowe pole z frontu = błąd walidacji).

Jednostki: mm. Kąty: stopnie.
"""
from __future__ import annotations

from typing import Literal, Optional, Union

from pydantic import BaseModel, ConfigDict

Vec2 = tuple[float, float]
Vec3 = tuple[float, float, float]


class Base(BaseModel):
    model_config = ConfigDict(extra="forbid")


# --- 1. Materiał ------------------------------------------------------------
class Sheet(Base):
    w: float
    h: float


class Material(Base):
    id: str
    name: str
    thickness: float
    hasGrain: bool
    sheet: Sheet
    defaultBanding: Optional[str] = None


# --- 2. Płyta ---------------------------------------------------------------
class Edge(Base):
    bandingType: Optional[str] = None
    cutAngle: float


class Transform(Base):
    position: Vec3
    rotation: Vec3


class Grain(Base):
    direction: Literal[0, 90]
    groupId: Optional[str] = None


# --- 3. Operacja ------------------------------------------------------------
class EdgeRef(Base):
    edge: int


class ConnectorRef(Base):
    connector: str


class HardwareRef(Base):
    hardware: str


class HoleParams(Base):
    x: float
    y: float
    diameter: float
    depth: float
    through: Optional[bool] = None


class GrooveParams(Base):
    path: list[Vec2]
    width: float
    depth: float


class CutoutParams(Base):
    path: list[Vec2]
    depth: float
    through: Optional[bool] = None


class PocketParams(Base):
    path: list[Vec2]
    depth: float


class Operation(Base):
    id: str
    type: Literal["hole", "groove", "cutout", "pocket"]
    face: Union[Literal["front", "back"], EdgeRef]
    source: Union[Literal["manual"], ConnectorRef, HardwareRef]
    dxfLayer: str
    hole: Optional[HoleParams] = None
    groove: Optional[GrooveParams] = None
    cutout: Optional[CutoutParams] = None
    pocket: Optional[PocketParams] = None


class Panel(Base):
    id: str
    name: str
    materialId: str
    thickness: float
    contour: list[Vec2]
    transform: Transform
    edges: list[Edge]
    grain: Optional[Grain] = None
    baseFace: Literal["front", "back"]
    operations: list[Operation]
    groupId: Optional[str] = None
    roomId: str = ""
    cabinetId: Optional[str] = None  # Faza 7.3b: ustawione na płytach pochodnych szafki


# --- 4. Łącznik -------------------------------------------------------------
class ConnectorPlacement(Base):
    fromEdge: int
    offset: float
    absolute: Optional[Vec2] = None


class Connector(Base):
    id: str
    type: Literal["dowel", "confirmat", "cam"]
    panelA: str
    panelB: str
    placement: ConnectorPlacement
    # strona puszki mimośrodu (cam) na płycie B; brak = auto z geometrii
    camFace: Optional[Literal["front", "back"]] = None
    params: Optional[dict[str, float]] = None
    groupId: Optional[str] = None


# --- 5. Okucie (zawias) -----------------------------------------------------
class Cup(Base):
    diameter: float
    # TB/B: od krawędzi drzwi do krawędzi otworu puszki; środek = TB + Ø/2
    distanceTB: float
    depth: float
    mounting: Literal["screw", "inserta", "expando"]
    screwPattern: list[Vec2]


class Plate(Base):
    distance: Literal[0, 3, 6, 9]
    type: str
    screwPattern: list[Vec2]


class HingeOptions(Base):
    blumotion: bool
    tipOn: bool
    servoDrive: bool


class HingePlacement(Base):
    fromEdge: int
    offset: float


class Hinge(Base):
    family: str
    openingAngle: float
    overlayClass: Literal["full", "half", "inset"]
    cup: Cup
    plate: Plate
    options: HingeOptions
    doorPanel: str
    sidePanel: str
    placement: list[HingePlacement]
    hingeId: Optional[str] = None  # id wpisu w katalogu; brak = fallback na stałe


class Hardware(Base):
    id: str
    kind: Literal["hinge"]
    hinge: Optional[Hinge] = None
    groupId: Optional[str] = None


# --- 6. Pomieszczenie -------------------------------------------------------
class RoomWall(Base):
    id: str
    size: Vec2
    transform: Transform
    color: str


class RoomSurface(Base):
    size: Vec2
    color: str


class Room(Base):
    id: str
    name: str
    walls: list[RoomWall]
    floor: RoomSurface
    ceiling: RoomSurface


# --- 7. Szafka parametryczna (Faza 7.3b) ------------------------------------
class CabinetParams(Base):
    W: float
    H: float
    D: float
    T: float
    backT: float
    doors: Literal[0, 1, 2]
    shelves: int
    plinth: Optional[float] = None


class Cabinet(Base):
    id: str
    name: str
    type: Literal["standing", "wall", "base"]
    params: CabinetParams
    materialId: str
    roomId: str
    position: Vec3


# --- 8. Projekt -------------------------------------------------------------
class ProjectSettings(Base):
    kerf: float
    bandingAllowance: float
    defaultBaseFace: Literal["front", "back"]
    bandingThickness: float = 1.0  # grubość okleiny per krawędź; default dla starych plików bez tego pola


class Project(Base):
    id: str
    name: str
    units: Literal["mm"]
    settings: ProjectSettings
    materials: list[Material]
    panels: list[Panel]
    connectors: list[Connector]
    hardware: list[Hardware]
    rooms: list[Room]
    cabinets: list[Cabinet] = []  # Faza 7.3b; stare pliki bez tego pola → pusta lista


class ValidateRequest(Base):
    project: Project
