# Guardian Mascot — Raster Asset Brief

**Generated:** 2026-08-25 · **Source:** Adapted from [s1dashu/ip-as-logo-skill](https://github.com/s1dashu/ip-as-logo-skill) (MIT)

This brief follows the ip-as-logo skill's generation workflow and constraint
skeleton, adapted for the Guardian mascot system documented in
`docs/design-language.md` §9. Use it with any compatible top-tier image model.

---

## 1. Three directions (propose before generation)

Each direction ties the Guardian to a different brand promise:

**A. The Rounded Guardian** — *the app's shield, personified* — blunt rounded shield silhouette with a belly coin, big wide-set eyes, one gold accent. Direct evolution of the SVG mascot; all 8 surfaces stay recognizable.

**B. The Coinling** — *the coin woke up* — a round character that IS the Coin primitive brought to life, carrying a tiny shield as a secondary mark. Maximum motif coherence ("coins decide" → the mascot is a coin).

**C. Familiar animal** — *savings instinct personified* — e.g. a squirrel with a shield-coin, or an elephant with patience in its eyes. Familiar animal + defining feature (the coin). Highest emotional upside; biggest brand shift.

---

## 2. Direction A — full generation prompt (Rounded Guardian)

> Create one complete full-bleed 1:1 square image.
>
> **Background:** fill the entire square with solid deep slate navy (`#0f172a`).
> Keep this background visible in every open area and in the corners not
> occupied by the character. The character must emerge from the **lower-right**.
>
> **Subject:** place one extremely simplified, cute, endearing shield-shaped
> IP character on the background. The character is a rounded shield — domed top,
> softly bulging cheeks, a rounded U-shaped bottom. No sharp points, no angular
> tips. Thick, rounded, weighty contours throughout.
>
> **Complexity:** use only 4–7 large basic shapes and at most two broad internal
> color regions. Use two simple round eyes and one tiny mouth (small smile).
> Remove every nonessential line, outline, texture, and decoration. The character
> should be recognizable at 32×32.
>
> **Color:** use exactly three semantic colors in the complete image: (1) a blue
> body with a barely-there vertical gradient from lighter blue on top to darker
> blue on bottom, (2) a dark navy face for the eyes and mouth, and (3) a single
> gold coin detail on the character's belly (flat gold disc with a thin lighter
> gold inner ring). Choose the blue and navy independently from the navy
> background. Keep the gold accent subtle — one small detail, not a loud element.
>
> **Composition:** keep the character upright and emerging from the lower-right,
> filling about 85–95% of the square so it remains visually dominant. Cropping
> at the bottom and right sides is welcome when it strengthens the emergence.
> Preserve both eyes symmetrically. Never center or bottom-center the character.
>
> **Style:** simplification, cuteness, and lovable baby-like appeal are the
> strongest qualities. Large soft forms, compact proportions (big head, slightly
> stubby body), thick rounded contours. Ultra-clean graphic treatment. Add an
> extremely subtle, almost imperceptible sense of depth through the gradient on
> the body.
>
> **Finish:** show only the character on the full-canvas background, with clean
> surfaces and normal square outer corners.
>
> **Constraints:** Use no text or watermark. Add no borders, frames, cards, or
> presentation masks. Include one character only, with no extra subjects or
> scenery. Use no fragile lines, sharp tips, unnecessary outlines, tiny details,
> or decorative marks. Add no photorealistic material, dramatic bevel, glossy
> hotspot, deep occlusion, or external cast shadow. Keep the background solid
> and uniform, with no texture, vignette, or lighting variation.

**Generate six independent candidates:**
- A1, B1, C1 — lower-left emergence
- A2, B2, C2 — lower-right emergence

---

## 3. Direction B — prompt (The Coinling)

> Create one complete full-bleed 1:1 square image.
>
> **Background:** fill the entire square with solid deep navy (`#0c1222`).
> Keep the background visible in every open area and in the corners not
> occupied by the character. The character must emerge from the **lower-left**.
>
> **Subject:** place one extremely simplified, cute, endearing coin-shaped
> IP character on the background. The character is a perfect circle (a coin)
> with a domed top, big round eyes, and a small smile. On its belly is a
> tiny rounded shield — this shield is a secondary mark, small compared to
> the coin character. Thick, rounded contours throughout. No sharp points.
>
> **Complexity:** use only 4–7 large basic shapes and at most two broad
> internal color regions. Two simple round eyes, one tiny mouth. The shield
> on the belly is a single simple shape. Recognizable at 32×32.
>
> **Color:** exactly three semantic colors: (1) gold body for the coin
> (subtle gradient lighter on top, darker on bottom), (2) dark navy for the
> face, and (3) a small teal shield accent on the belly. Choose both subject
> colors independently from the background.
>
> **Composition:** character upright, emerging from lower-left, filling 85–95%.
> Never center.
>
> **Style:** simplification, cuteness, baby-like appeal, large soft forms,
> thick rounded contours, ultra-clean graphic treatment, barely-there depth.
>
> **Finish:** one character, full-canvas background, clean surfaces, square
> outer corners.
>
> **Constraints:** No text, watermark, borders, frames, extra subjects, fragile
> lines, sharp tips, outlines, photorealistic material, glossy hotspot, or
> strong 3D rendering. Background solid and uniform.

**Generate six independent candidates:**
- A1, B1, C1 — lower-left
- A2, B2, C2 — lower-right

---

## 4. Direction C — prompt (Familiar Animal)

> Create one complete full-bleed 1:1 square image.
>
> **Background:** fill the entire square with solid muted sage green (`#365314`).
> Keep the background visible in every open area and in the corners not
> occupied by the character. The character must emerge from the **lower-right**.
>
> **Subject:** place one extremely simplified, cute, endearing squirrel
> IP character on the background. The squirrel sits upright in compact
> proportions — large head, soft cheeks, big wide-set round eyes, small
> smile. On its belly it carries a tiny rounded shield, held close like a
> coin purse. The shield is a secondary mark. Thick, rounded contours.
> No sharp points or needle-thin tails.
>
> **Complexity:** 4–7 large basic shapes, two broad internal color regions
> (squirrel body colors + shield accent). Two simple round eyes, one tiny
> mouth. Recognizable at 32×32.
>
> **Color:** exactly three semantic colors: (1) warm amber-brown body (soft
> gradient lighter on top, darker below), (2) cream/light face region for
> eyes and mouth, and (3) a small teal shield accent held on the belly.
> Choose both subject colors independently from the sage background.
>
> **Composition:** upright, lower-right emergence, 85–95% fill. Never center.
> Preserve both eyes symmetrically.
>
> **Style:** simplification, cuteness, baby-like appeal, large soft forms,
> thick rounded contours, ultra-clean graphic, barely-there depth.
>
> **Finish:** one character, full-canvas background, clean surfaces, square
> outer corners.
>
> **Constraints:** No text, watermark, borders, frames, extra subjects,
> fragile lines, sharp tips, photorealistic material, glossy hotspot, or
> strong 3D. Background solid and uniform.

**Generate six independent candidates:**
- A1, C1, D1 — lower-left
- A2, C2, D2 — lower-right

---

## 5. Model recommendations

| Priority | Model | Notes |
|---|---|---|
| 1 | GPT Image 2 | Best instruction-following; recommended default |
| 2 | Nano Banana Pro (Gemini Image Pro) | Strong; acceptable alternative |
| 3 | Nano Banana 2 (Gemini Image Flash) | Good for batch; slightly lower quality |
| 4 | Seedance 5.0 Pro | Works well; verify color accuracy |

Do not fall back to SVG or older models without explicit user consent.

---

## 6. Asset output

Generate each candidate as a **separate full-resolution 1:1 square asset**,
never as a contact sheet or grid. Save to `public/assets/mascot/` with
label names (A1.png, A2.png, B1.png, etc.).

**Target dimensions:** 1536×1536 (accept native 1254×1254 when the model
limits output). Do not resample to force a specific number.

---

## 7. What to do after generation

1. Pick the best 2–3 candidates from the six.
2. Replace the SVG `GuardianMascot.tsx` with the best raster (or keep SVG
   and use the raster only for icon/OG assets — the SVG provides mood
   animation and reduced-motion support that raster cannot).
3. Update `icon.png` (512×512), `embed-image.png` (1200×630 OG), and
   `splash.png` with the chosen directions.
4. Run a visual regression test across the 8 surfaces that use the mascot:
   ProtectionTab, FloatingControls, GuardianStreakWidget, AIChat,
   AgentTierStatus, GuardianUpdates, WelcomeScreen.

---

*License: This brief is adapted from s1dashu/ip-as-logo-skill (MIT). The
prompt skeletons follow the skill's constraints.*