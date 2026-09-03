# Secrets runbook (sops + age)

Rules (docs/10 §4): no secrets in git or docs; `.env` and `apps/web/.env.local` are gitignored;
`.env.example` lists every variable; rotate on any suspected leak.

## One-time setup (Ali's PC)
1. `scoop install sops age` (see docs/plans/phase-0.md P4).
2. `age-keygen -o $HOME/.config/sops/age/keys.txt` → note the `public key: age1…` line.
3. Create `.sops.yaml` at the repo root:

       creation_rules:
         - path_regex: secrets\.enc\.yaml$
           age: age1<your-public-key>

## Editing the encrypted env
- `sops secrets.enc.yaml` (creates or opens it decrypted in $EDITOR; saved encrypted).
- Keys mirror `.env.example`; values are real.

## Materialising `.env` on a machine (VPS or PC)
- Put the age private key at `~/.config/sops/age/keys.txt` on that machine (never in git).
- `sops -d --output-type dotenv secrets.enc.yaml > .env` then `chmod 600 .env`.

## Rotation
1. Rotate the value at the vendor. 2. `sops secrets.enc.yaml` and update. 3. Re-materialise `.env` on VPS/PC. 4. `docker compose up -d`.
