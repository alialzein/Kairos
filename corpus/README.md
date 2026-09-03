# corpus/ — LOCAL ONLY

Everything here stays on Ali's PC (docs/10-security-privacy.md §1). Layout (docs/08-data-model.md §4):

    raw/<source_id>/...           untouched exports, audio
    derived/*.parquet|*.jsonl     scrubbed, labeled, derived datasets
    interviews/<session>/         audio.wav + transcript.json
    voice/<take>.wav              voice-clone material
    manifest.json                 sources, hashes, consent, scrub reports

Rules: gitignored except this file; CI fails if any other path under corpus/ is ever tracked;
the only artifact that may leave this folder is derived/exemplars.jsonl via the allowlisted uploader (Phase A2).
Encrypt at rest (BitLocker or an age-encrypted archive).
