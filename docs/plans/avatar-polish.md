# Avatar polish sprint — "finish the avatar first"

Ali's direction 2026-09-06 (after B5 merge, playground session): finish the avatar visuals
before starting Track A ingestion. Inputs: his three state complaints, his reference
screenshots (see memory/ledger: streamline ribbons, halo rings, sharper eyes, alive
background), and a first likeness photo.

Rules: one task = one branch = one PR, TDD for pure logic, visual verification via headed
Chrome screenshots on the RTX 5070, perf CI must stay green (15 % gate), rulings to
`docs/plans/phase-b5-ledger.md`.

## Tasks

- **T1 — state feedback fixes** (`b5-11-state-polish`): (a) DORMANT reads as a big shapeless
  blob with oversized particles → rework `nebula()` into a flattened spiral "sleeping galaxy"
  (disc + arms + thin halo) and add per-state `sizeScale` to `StateParams` (DORMANT ≈ 0.55);
  (b) eyes must read clearly → measure real eye/mouth anchors from `bust.glb` (one-time probe
  script), add socket darkening + subtle pupil glow gated by `shade`; (c) SPEAKING must move →
  jaw/mouth-region particles displace with speak energy (open/close oscillation), so the bust
  visibly talks.
- **T2 — streamline ribbons**: contour-line particle arrangement wrapping head/shoulders
  (topographic flow-lines instead of uniform dusting) — likely a second particle role or a
  banded emphasis pattern from spineT-like parameter along the bust surface.
- **T3 — halo rings**: 2–3 thin luminous rings behind the head (new small particle system or
  RING-shape reuse at low alpha), parallax with pointer.
- **T4 — alive background**: full-width mountain-range waves + occasional lightning "energy
  veins" (brighten a random streak of the waves system), replacing the corner-only waves.
- **T5 — assembly animation**: directional particle assembly (sweep in from left/right with
  staggered spring delays) for WAKING, matching the reference "ASSEMBLING…" feel.
- **T6 — likeness**: replace the generic MakeHuman bust with a mesh reconstructed from Ali's
  photos. All photo processing stays on this PC (`corpus/raw/likeness/` — gitignored, never
  uploaded, per docs/10). Needs: photos on disk from Ali (front + left + right ideally),
  local single/multi-image head reconstruction, re-export canonical `bust.glb`, re-measure
  ANCHORS + eye/mouth anchors, regenerate region bands.
- **T7 — Ali's approval pass**: playground session over the seven states with the new look;
  bake his slider values into `AVATAR_STATES`.

## Exit gate

Ali says the avatar matches his references (or names the remaining gaps as future work);
perf CI green at every step; 60 fps desktop / 30 fps phone unchanged.
