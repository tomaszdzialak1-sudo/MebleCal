# Meble CAD

Webowa aplikacja do ręcznego, parametrycznego projektowania mebli płytowych.
Kontekst i model danych: `CLAUDE.md` oraz `model-danych-meble-cad-v1.md`.

## Struktura

```
frontend/   React 18 + Vite + TS + react-three-fiber + Zustand + Tailwind
backend/    FastAPI + Pydantic (lustro modelu) + ezdxf (DXF — później)
```

Model danych jest źródłem prawdy w `frontend/src/model/types.ts` i lustrzany
w `backend/app/models/schema.py` — przy zmianie trzymaj oba pliki zgodne.

## Uruchomienie

### Frontend
```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck (tsc) + build produkcyjny
```

### Backend (opcjonalny w Fazie 1 — do round-tripa modelu)
```bash
cd backend
python -m venv .venv
# Windows (bash):
source .venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --reload   # http://localhost:8000
```

Przycisk **„Sprawdź model”** w aplikacji wysyła bieżący projekt do
`POST /api/project/validate` i potwierdza, że lustro Pydantic go przyjmuje.

## Faza 1 (zaimplementowane)
- Struktura React + store (Zustand) + scena 3D (Z-up, 1 jednostka = 1 mm).
- Płyty jako bryły z konturu (prostokąty); zaznaczanie, edycja w inspektorze.
- Pomieszczenie (ściany / podłoga / sufit) z color pickerem.
- Zapis/odczyt całego projektu do/z JSON (eksport pliku) + autosave w localStorage.

Dalsze fazy: patrz `CLAUDE.md`.
