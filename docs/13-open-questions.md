# 13 — Open questions for Ali

Tagged with the phase they block. The agent asks **only** the questions blocking the phase it is about to start, using `/grill-me` with a recommended answer per question.

## Q1 — Persona name — **RESOLVED: Kairos** (ADR-0012)

Chosen from: Astra, Kairos, Elara, Sirius, Aether, Orion, Kael. Wake phrase "Hey Kairos" (كايروس). Phase 0 task 0.11 sets `TWIN_NAME = "Kairos"`.

## Q2 — GPU **[blocks Phase A4]**

Which GPU and VRAM is in your PC? ≥ 12 GB → train 7–8B QLoRA locally. 8 GB → train on a rented GPU (a few dollars per run), serve locally at 4-bit. Recommendation: tell the agent the exact card; it writes the ADR.

## Q3 — Chat exports **[blocks nothing; improves A1/A4]**

You did not select WhatsApp/Telegram. Casual chats are the best *style* corpus. Are you willing to export selected WhatsApp chats (e.g. with 3–5 close contacts, with their informal consent)? Recommendation: yes, at least a few; they materially improve lexical fidelity in Arabic.

## Q4 — Reasoner provider order **[blocks Phase A2, task A2.5 — ADR-0003]**

Primary + fallback frontier LLMs for the Brain (e.g. Claude latest as primary, OpenAI as fallback, or the reverse). Recommendation: primary = whichever API you already have credits/keys for and that handles Arabic well in your own tests; fallback = the other. The provider layer is abstracted; switching is config.

## Q5 — Arabic script vs Arabizi **[blocks Phase A2]**

When you write Arabic casually, is it Arabic script or Latin letters (Arabizi, "kifak")? Both? The Twin should mirror what you actually do. Recommendation: whatever your exports show; the labeler will report the ratio and you confirm.

## Q6 — Light theme for the Avatar **[blocks Phase B5, task B5.7]**

Dark background is the reference. For the light theme: (a) keep the Avatar dark inside a framed panel, (b) invert the palette on a light field, (c) light theme only for dashboard pages, Avatar always dark. Recommendation: (c) — particle bloom on white looks weak.

## Q7 — Where interview audio lives **[blocks Phase A1, task A1.7]**

PC only (default) or also Supabase Storage (convenient, encrypted, but off-machine)? Recommendation: PC only.

## Q8 — Guest disclosure wording and who gets invites **[blocks Phase A8]**

## Q9 — Porcupine Arabic availability **[agent verifies at A6.4; decision only if unavailable]**

If no Arabic model: use the English phrase and test detection with your accent; if detection < 90%, consider openWakeWord with a custom-trained model from your recordings.

## Q10 — VPS provider/region — **RESOLVED: Hetzner Cloud, Falkenstein** (ADR-0013)

Chosen 2026-09-03 from Hetzner (Falkenstein/Helsinki) and DigitalOcean (Frankfurt); CX32-class ~4 vCPU / 8 GB / 80 GB. Latency Lebanon ↔ Frankfurt ≈ 60–90 ms. Deploy steps: `docs/plans/phase-0.md` Task 16.
