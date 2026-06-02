"""Export the FastAPI OpenAPI schema to ``shared/openapi.json``.

The Pydantic schemas in ``app/schemas/`` are the single source of truth for the
HTTP API contract. This script serializes that contract to the repo-level
``shared/`` folder, from which the frontend generates its TypeScript types
(``npm run gen:api``). Run it after any change to the schemas:

    python scripts/export_openapi.py

Output is written with sorted keys so diffs stay minimal and the CI drift guard
(``git diff --exit-code shared/openapi.json``) is stable.
"""

import json
import sys
from pathlib import Path

# Make ``app`` importable no matter the working directory.
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.main import app  # noqa: E402

OUTPUT = BACKEND_DIR.parent / "shared" / "openapi.json"


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    schema = app.openapi()
    with OUTPUT.open("w", encoding="utf-8") as fh:
        json.dump(schema, fh, indent=2, sort_keys=True, ensure_ascii=False)
        fh.write("\n")
    print(f"Wrote {OUTPUT.relative_to(BACKEND_DIR.parent)}")


if __name__ == "__main__":
    main()
