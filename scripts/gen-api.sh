#!/usr/bin/env bash
# Regenerates packages/shared/src/generated/brain.{openapi.json,d.ts} from the brain FastAPI app.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/packages/shared/src/generated"
mkdir -p "$OUT"
(
  cd "$ROOT/services/brain"
  SUPABASE_JWT_SECRET="codegen-only-secret-with-32-characters!" \
  uv run python -c 'import json, sys
from brain.main import create_app
with open(sys.argv[1], "w", encoding="utf-8", newline="\n") as f:
    f.write(json.dumps(create_app().openapi(), indent=2) + "\n")' "$OUT/brain.openapi.json"
)
(cd "$ROOT" && pnpm exec openapi-typescript "$OUT/brain.openapi.json" -o "$OUT/brain.d.ts")
echo "wrote $OUT/brain.openapi.json and brain.d.ts"
