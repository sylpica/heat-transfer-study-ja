# ROUND6 MUSE MISC — 2026-11-10

## Scope

- Sections: §6.1, §6.3, §6.4, §11.8 of `data/sections/*-ja.json` (clone heat-collation3, branch `audit/integration-loop3`, head 9637c56).
- Candidates: 27 machine-extracted unbarred Nu/h occurrences from `docs/audit-final/work/round6-candidates-B.txt` (§6.1: 7, §6.3: 6, §6.4: 8, §11.8: 6).
- Question adjudicated per instance: does the printed original carry a combining macron (U+0304) on the symbol (mean quantity) that the app data lacks (FINDING), is the printed form also unbarred / the hit not the coefficient (NON-FINDING), or is a barred symbol in the data unbarred in print (OVER-APPLICATION finding).

## Method

- Original: *A Heat Transfer Textbook*, 6th ed., PDF `AHTTv600.pdf` (PDF page = book page + 14).
- Pages rendered at 200 dpi with pdftoppm into `/tmp/r6b/` and read as images. The macron question is settled ONLY from images; the PDF text layer loses macrons and was never used as authority for the bar.
- Severity precedent: dropped macron on a mean symbol = P3, unless the drop makes a displayed equation mathematically false or contradicts an adjacent correct display (then P2-candidate, flagged for the coordinator).

## Page spans

- §6.1: PDF 285–291 (book 271–277)
- §6.3: PDF 307–311 (book 293–297)
- §6.4: PDF 312–315 (book 298–301)
- §11.8: PDF 684–689 (book 670–675)

## Results

### §6.1 (PDF 285, 290, 291) — 7 candidates, 0 findings, 7 non-findings

| Candidate | Verdict | Evidence (image) |
|---|---|---|
| blk4 text [h]: 「h と h̄（平均値）を予測」 | NON-FINDING | PDF 285 (book 271): print reads "to predict *h* and *h̄*" — plain h unbarred, mean h̄ barred; data reproduces the pair exactly. |
| blk29 explanation [h]: eq. (6.5) 「この条件は h を定義する」 | NON-FINDING | PDF 290 (book 276): eq. (6.5) ≡ h(Tw − T∞) with h unbarred; following text "This condition *defines* h" also unbarred. Local definition; data matches. |
| blk31 expression [Nu]: 「hL/kf ≡ NuL」 (eq. 6.5a) | NON-FINDING | PDF 290: eq. (6.5a) prints hL/k_f ≡ Nu_L, no macron on Nu. Data matches. |
| blk31 explanation [Nu]: 「Nux ≡ hx/kf と置く」 | NON-FINDING | PDF 291 (book 277): print "we can put Nu_x ≡ hx/k_f" — both unbarred. Data matches. |
| blk32 text [Nu]: 「Nu の物理的意味」 | NON-FINDING | PDF 291: print "the physical significance of Nu is" — generic Nu unbarred. Data matches. |
| blk33 expression [Nu]: 「NuL = L/δ′t」 (eq. 6.6) | NON-FINDING | PDF 291: eq. (6.6) prints Nu_L = L/δ′_t, unbarred. Data matches. |
| blk36 text [h]: 「h の詳細な評価へ向かう」 | NON-FINDING | PDF 291: print "We now turn to the detailed evaluation of *h*" — unbarred. Data matches. |

Over-application check §6.1: the section's only barred symbol in data is h̄ in blk4; print (PDF 285) bars it. No over-application.

### §6.3 (PDF 307, 310, 311, 312) — 6 candidates, 0 findings, 6 non-findings

| Candidate | Verdict | Evidence (image) |
|---|---|---|
| blk2 text [h]: 「フーリエの法則を用いて h を計算できる」 | NON-FINDING | PDF 307 (book 293): print "and then calculate h, using Fourier's law" — h unbarred. Data matches. |
| blk3 expression [h]: eq. (6.35) 「h = q/(Tw − T∞) = …」 | NON-FINDING | PDF 307: boxed eq. (6.35) prints h unbarred. Data matches. |
| blk3 explanation [h]: 「壁面の温度勾配から h を求める式」 | NON-FINDING | Same eq. (6.35) on PDF 307; the gloss refers to that local h, unbarred in print. |
| blk19 text [h]: ν=α case, 「式(6.5)を用いて…h = [k/(T∞ − Tw)]·∂(T − Tw)/∂y|y=0 = …」 | NON-FINDING | PDF 311 (book 297): print gives the same display with h unbarred (local coefficient from (6.5)). Data matches. |
| blk20 expression [Nu]: eq. (6.43) 「hx/k = Nux = 0.33206·√Rex」 | NON-FINDING | PDF 311: eq. (6.43) prints Nu_x unbarred. Data matches. |
| blk22 text [Nu]: Example 6.4, integral 「(ΔT/L)∫₀^L (k/x)Nux dx」 | NON-FINDING | PDF 312 (book 298): print shows Nu_x unbarred inside the integral (and local h unbarred in (hΔT)), while the averaged q̄ IS barred in both print and data. Data matches print in every bar placement on this display. |

Over-application check §6.3: the section's only barred symbol in data is q̄ (×3, blk22); print (PDF 312) bars q̄ in exactly those spots ("the average heat flux, q̄", q̄ = 2(…)ΔT = 2q_{x=L}). No over-application.

### §6.4 (PDF 312, 313, 314, 315, 316) — 8 candidates, 0 findings, 8 non-findings

| Candidate | Verdict | Evidence (image) |
|---|---|---|
| blk2 text [h] #1: 「h の定義である式(6.35)」 | NON-FINDING | PDF 312 (book 298): print "the definition of h, eqn. (6.35)" — unbarred. Data matches. |
| blk2 text [h] #2: 「h = fn(ν, α, k, x, u∞)」 | NON-FINDING | PDF 312: the displayed h = fn(ν, α, k, x, u∞) is unbarred in print. Data matches. |
| blk2 text [h] #3: 「強制対流では h ≠ fn(ΔT)」 | NON-FINDING | PDF 312: print "that h ≠ fn(ΔT) during forced convection" — unbarred. Data matches. |
| blk3 text [Nu]: 「Π1 = hx/k ≡ Nux」 | NON-FINDING | PDF 312: print Π₁ = hx/k ≡ Nu_x, unbarred. Data matches. |
| blk3 text [h]: 「J と K は h と k の中では J/K としてのみ」 | NON-FINDING | PDF 312: print "J and K appear only together, as J/K, in h and k" — unbarred. Data matches. |
| blk4 expression [Nu]: eq. (6.44) 「Nux = fn(Rex, Pr)」 | NON-FINDING | PDF 313 (book 299): eq. (6.44) prints Nu_x unbarred. Data matches. |
| blk4 explanation [Nu]: 「Nux の Pr 依存性は現れていません」 | NON-FINDING | PDF 313: print "the Pr dependence of Nu_x is not displayed" — unbarred. Data matches. |
| blk24 explanation [h]: 「h を求める積分法の使用を大いに単純化」 | NON-FINDING | The gloss mirrors §6.4's closing sentence, printed at the top of PDF 316 (book 302): "The fact that φ is independent of x will greatly simplify the use of the integral method to find h." Verified at 400 dpi enlargement: the h is unbarred in print (the book's own sentence uses plain h here). Data matches. |

Over-application check §6.4: the data's barred symbols are C̄ (mean molecular speed) in blk10–14 (9 occurrences). PDF 314 (book 300) confirms print bars C̄ in every one of those spots: "proportional to ρC̄, where C̄, the mean molecular speed", eqs. (6.45a)–(6.45d). No over-application. (§6.4's other C̄ class — the W2C2-F09 zone — was campaign-fixed and is outside this candidate list.)

### §11.8 (PDF 686, 688, 689) — 6 candidates, 0 findings, 6 non-findings

All six candidates are occurrences inside blk20 (Example 11.15, seawater reverse-osmosis desalination).

| Candidate | Verdict | Evidence (image) |
|---|---|---|
| blk20 text [h] ×6: 「水流束15 L/m²·h」「35 L/m²·h」「15 L/m²·h では」「35 L/m²·h では」「15 L/m²·h で10.9%」「35 L/m²·h で27.5%」 | NON-FINDING (×6) | PDF 689 (book 675): every hit is the hour unit in the print's "15 L/m²h" / "35 L/m²h" water fluxes (and "3600 s/h" in the conversion) — not the heat transfer coefficient h, so no macron question arises. The example itself (begun PDF 688) contains no coefficient h at all. |

Over-application check §11.8: the data's barred symbols are m̄₂ in blk8/blk9 (eqs. 11.79a/11.79b, 3 occurrences). PDF 686 (book 672) confirms print bars them all: "calling the time-average mass fraction m̄₂", j₂ = −ρ(𝒟₁₂ + ε₂) ∂m̄₂/∂y, n_{2,s}(1 − m̄₂) = −ρ(𝒟₁₂ + ε₂) ∂m̄₂/∂y. The Part-1 restoration of these bars is in place and print-true. No over-application.

## Final tally

- Candidates adjudicated: **27 / 27** (§6.1: 7, §6.3: 6, §6.4: 8, §11.8: 6).
- FINDINGS: **0** (no dropped macrons, no over-applications in these four sections).
- NON-FINDINGS: **27** — every unbarred Nu/h candidate is unbarred in the printed original as well (local coefficients and definitions, dimensional-analysis groups, the local Nu_x inside the Example 6.4 average-flux integral, the book's own plain h in the "integral method to find h" sentence at the end of §6.4, and the hour unit in Example 11.15).
- Over-application spot checks (barred symbols present in the data of these sections): §6.1 h̄ (blk4), §6.3 q̄ (blk22), §6.4 C̄ (blk10–14, 9 occurrences), §11.8 m̄₂ (blk8–9, 3 occurrences) — all verified barred in print on the page images cited above. No over-application anywhere in scope.
- Closing statement: **no candidate remains unadjudicated.** Pages read as images: PDF 285, 290, 291, 307, 310, 311, 312, 313, 314, 315, 316 (the last one page beyond the §6.4 span, read because blk24's gloss mirrors the §6.4 closing sentence printed there; its key glyph additionally verified on a 400 dpi enlargement), 686, 688, 689.
