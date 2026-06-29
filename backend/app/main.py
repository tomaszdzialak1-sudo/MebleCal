"""Meble CAD — backend (FastAPI).

Faza 1: szkielet + walidacja round-trip modelu (lustro Pydantic).
DXF (ezdxf), rozkrój itd. dochodzą w późniejszych fazach.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .models.schema import ValidateRequest

app = FastAPI(title="Meble CAD API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/project/validate")
def validate_project(req: ValidateRequest) -> dict:
    """Round-trip modelu = walidacja WYŁĄCZNIE STRUKTURY (Pydantic).

    Kontrakt: tu blokuje TYLKO realna niepoprawność struktury (FastAPI zwraca
    wtedy 422 automatycznie). Ostrzeżenia JAKOŚCI/technologiczne (Ø większe od
    grubości, otwór poza konturem, szczelina łącznika, gerunk) liczy front jako
    miękkie wskazówki i NIE wolno ich tu zamieniać na twardy błąd — projekt ma
    się dać zapisać i round-tripować mimo nich.
    """
    p = req.project
    return {
        "ok": True,
        "name": p.name,
        "panels": len(p.panels),
        "rooms": len(p.rooms),
        "materials": len(p.materials),
    }
