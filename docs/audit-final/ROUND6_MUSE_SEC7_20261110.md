# ROUND 6 — Muse side audit: §§7.2/7.3 mean-symbol (overline) adjudication

- Date: 2026-11-10
- Auditor line: Muse (read-only adjudication; no data/test edits)
- Tree: clone `~/workspace/dev/heat-collation3`, branch `audit/integration-loop3` @ `9637c56`
- Scope: all 65 machine-extracted unbarred `Nu`/`h` candidates in `data/sections/7-2-ja.json` and `data/sections/7-3-ja.json` (candidate list: `docs/audit-final/work/round6-candidates-A.txt`)
- Original: *A Heat Transfer Textbook*, 6th ed., PDF `~/workspace/research_notes/ahtt-reading/AHTTv600.pdf` (PDF page = book page + 14)
- Page spans: §7.2 = PDF 366–377 (book 352–363); §7.3 = PDF 378–393 (book 364–379)
- Method: every candidate adjudicated against the 200 dpi page IMAGE (pdftoppm render). The PDF text layer is never used to settle the overline question. Verdicts: FINDING (printed macron dropped in data), NON-FINDING (printed form also unbarred / not the coefficient), OVER-APPLICATION (data barred, print unbarred). Dropped macrons on mean symbols are P3 by project precedent unless a displayed equation becomes mathematically false or contradicts an adjacent correct display (then flagged P2-candidate for the coordinator).

## Results (appended incrementally)

### §7.2 — first group (PDF 366–371)

- 7-2 blk17 text [h] 「境界層は変化を止めるため、h は一定になる」 — **NON-FINDING**. PDF 370 (book 356): "so *h* becomes constant" — printed h is unbarred; this is the (developed, x-invariant) local coefficient, not a length mean.

### §7.2 — developed-flow Nusselt numbers (PDF 373, book 359)

- 7-2 blk35 explanation [Nu] 「発達した流れに対する局所 NuD」 — **NON-FINDING**. Print: "so the **local** Nu_D for fully developed flow, based on h(x) = q_w/[T_w(x) − T_b(x)]" — explicitly local, unbarred.
- 7-2 blk36 expression [Nu] eq. (7.22) `NuD ≡ qw·D/[(Tw − Tb)k] = 48/11 = 4.364` — **NON-FINDING**. Print eq. (7.22): Nu_D unbarred (local value).
- 7-2 blk36 explanation [Nu] 「無次元群は NuD の1つだけ」 — **NON-FINDING**. Refers to the same local Nu_D of eq. (7.22); print prose introduces no barred symbol here.
- 7-2 blk36 explanation [h] 「有次元関数方程式は単に h = fn(D, k) です」 — **NON-FINDING**. Print (bottom of book 359): "the dimensional functional equation is merely h = fn(D, k)" — h unbarred.
- 7-2 blk36 explanation [h] 「強制対流では h は ΔT に依存しないはず」 — **NON-FINDING**. PDF 374 (book 360): "because *h* should be independent of ΔT in forced convection" — h unbarred (local coefficient).

### §7.2 — Example 7.1 and the isothermal pipe (PDF 374–375, book 360–361)

- 7-2 blk39 text [Nu] 「h = NuD·k/D = 4.364(0.6396)/0.001 = 2,791 W/m²·K」 — **NON-FINDING**. PDF 375: h = Nu_D·k/D with Nu_D unbarred (the developed local value from eq. (7.22)).
- 7-2 blk39 text [h] (both hits: 「その結果はかなり大きい：h = …」 and 「高い h は…」) — **NON-FINDING**. Print: "The result turns out to be rather large: h = …" and "The high h is a direct result of the small tube diameter" — h unbarred in both.
- 7-2 blk41 text [Nu] (both hits: 「NuD = 一定 を示した次元解析」 and 「NuD は依然として一定」) — **NON-FINDING**. PDF 375: "The dimensional analysis that showed Nu_D = constant … Thus, Nu_D should still be constant" — unbarred in both.
- 7-2 blk42 expression [Nu] eq. (7.23) `NuD = 3.657（Tw = 一定）` — **NON-FINDING**. Print eq. (7.23): Nu_D = 3.657 for T_w = constant — unbarred (developed local value).

### §7.2 — thermal entrance region, mean Nusselt number (PDF 376–377, book 362–363)

- 7-2 blk45 explanation [h] 「入口問題の次元解析は、h の局所値が … に依存することを示します」 — **NON-FINDING**. PDF 376: "Dimensional analysis of the entry problem shows that the **local value of h** depends on u_av, μ, ρ, D, c_p, k, and x" — h unbarred.
- 7-2 blk47 expression [Nu] eq. (7.25) `NuD = fn(ReD, Pr, x/D)` — **NON-FINDING**. Print eq. (7.25): Nu_D unbarred (local).
- 7-2 blk47 explanation [Nu] 「すでにおなじみの NuD、ReD、Pr に」 — **NON-FINDING**. Print: "add to the already familiar Nu_D, Re_D, and Pr" — unbarred.
- 7-2 blk48 explanation [Nu] (1st hit) 「図7.4は … NuD ≡ hD/k の値を示します」 — **NON-FINDING**. Print: "Figure 7.4 shows values of Nu_D ≡ hD/k" — both symbols unbarred (local definition).
- 7-2 blk48 explanation [Nu] (2nd hit) 「等温壁の場合に対する平均ヌセルト数 NuD バーも提示します」 — **FINDING (notation form), P3**. PDF 376: "The figure also presents an average Nusselt number, **Nū_D**, for the isothermal wall case" — print carries the macron on Nu_D; the data instead writes the katakana suffix 「NuD バー」. The mean IS denoted (no meaning is lost and nothing becomes mathematically false, hence P3, not P2), but the form deviates from print. Current form: `平均ヌセルト数 NuD バー`; printed form: Nū_D (Nu + U+0304).
- 7-2 blk49 expression [Nu] (1st hit, LHS) `NuD バー ≡ h̄D/k = …` — **FINDING (notation form), P3**. Print eq. (7.27): Nū_D ≡ h̄D/k = (D/k)(1/L ∫₀^L h dx) — macron on Nu_D. The data's own display uses a true macron on h̄ (`h̄D/k`) but the katakana 「バー」 on NuD, so the notation is also internally inconsistent within one display. Current form: `NuD バー ≡ h̄D/k`; printed form: Nū_D ≡ h̄D/k. PDF 376.
- 7-2 blk49 expression [Nu] (2nd hit, integrand) `(1/L)∫₀^L NuD dx` — **NON-FINDING**. Print eq. (7.27) integrand is the local Nu_D, unbarred.
- 7-2 blk49 expression [h] (integrand) `∫₀^L h dx` — **NON-FINDING**. Print eq. (7.27) integrand is the local h, unbarred.
- 7-2 blk49 explanation [h] 「h = q(x)/[Tw − Tb(x)] であるため、単に q や ΔT だけを平均することはできません」 — **NON-FINDING**. Print: "Here, since h = q(x)/[T_w − T_b(x)], we cannot simply average only q or ΔT" — h unbarred (local definition).
- 7-2 blk51 expression [Nu] eq. (7.28) `NuD = 3.657 + 0.2362·Gz^0.488·e^(−57.2/Gz) …` — **NON-FINDING**. Print eq. (7.28): local Nu_D, unbarred (PDF 376).
- 7-2 blk53 expression [Nu] eq. (7.29) `NuD バー = 3.657/tanh[2.264·Gz^(−1/3) + 1.7·Gz^(−2/3)] + 0.0499·Gz·tanh(Gz^(−1))` — **FINDING (notation form), P3**. Print eq. (7.29) (PDF 376): LHS is **Nū_D** with macron; data again uses 「NuD バー」. Same subcategory as blk48/blk49 above. Current form: `NuD バー = …`; printed form: Nū_D = ….
- 7-2 blk54 expression [Nu] eq. (7.30) `NuD = 4.364 + 0.263·Gz^0.506·e^(−41/Gz) …` — **NON-FINDING**. PDF 377 (book 363): eq. (7.30) is explicitly "for the **local** Nusselt number", Nu_D unbarred.
- 7-2 blk56 text [Nu] (Example 7.2) 「式(7.30)から NuD = 5.06 と計算できる」 — **NON-FINDING**. PDF 378 (book 364): "From eqn. (7.30), we compute Nu_D = 5.06" — unbarred (local value from eq. (7.30)).

### §7.3 — turbulent entry length (PDF 378–379, book 364–365)

- 7-3 blk2 text [Nu] 「管のこれらより下流の位置では、NuD が完全に発達した値の5%以内になる」 — **NON-FINDING**. PDF 378: "Positions farther down the pipe than these will have Nu_D within 5% of the fully developed values" — unbarred. (Table 7.1 caption, PDF 379, likewise prints Nu_D unbarred.)
- Over-application spot-check (not a candidate): eq. (7.31) and its intro prose (PDF 379) print **Nū_D** barred (Nū_D/Nu_∞ = 1 + C/(L/D)^n) — the data carries the macron there (it was restored by an earlier mop-up fix), and print confirms the bar belongs there and ONLY there among the §7.3 correlations on these pages. No over-application.
- Over-application spot-check (not a candidate): the Fig. 7.5 prose (PDF 380, book 366) prints Nū_D barred five times ("plotted on Nū_D vs. Re_D coordinates", "Nū_D ≃ 3.66", "Nū_D is not constant", "rate of rise of Nū_D", "Nū_D ≃ Re_D^0.8"), and Fig. 7.5's axis (PDF 381) prints "Nū_D = h̄D/k" — the data carries the bars in the Fig. 7.5 prose (restored by the earlier Part-3 fix FB4B-02). No over-application, no residual drop.

### §7.3 — Reynolds–Colburn analogy forms (PDF 380–381, book 366–367)

- 7-3 blk12 text [h] (1st hit, eq. (6.111) restated) `Stx = h/(ρcp u∞) = …` — **NON-FINDING**. Print eq. (6.111) (PDF 380): St_x = h/(ρc_p u_∞) — h unbarred (flat-plate local coefficient).
- 7-3 blk12 text [h] (2nd hit) 「管内流れについては、h は qw/(Tw − Tb) と定義され」 — **NON-FINDING**. Print: "For a pipe flow, *h* is defined as q_w/(T_w − T_b)" — h unbarred.
- 7-3 blk13 expression [h] eq. (7.32) `St = h/(ρcp·uav) = …` — **NON-FINDING**. Print eq. (7.32) (PDF 381): St = h/(ρc_p u_av) — h unbarred.

### §7.3 — power-law and modern correlations (PDF 381–383, book 367–369)

- 7-3 blk17 expression [Nu] `NuD = (f/8)·ReD·Pr/{1 + 12.7[Pr^(2/3) − 1]√(f/8)}` — **NON-FINDING**. Print eq. (7.35) (PDF 381): Nu_D = (f/8)Re_D Pr / [1 + 12.7(Pr^{2/3} − 1)√(f/8)] — unbarred.
- 7-3 blk19 expression [Nu] eq. (7.37) `NuD = ReD·Pr^(1/3)·(f/8)` — **NON-FINDING**. Print eq. (7.37) (PDF 382): Nu_D unbarred.
- 7-3 blk20 expression [Nu] eq. (7.39a) `NuD = 0.023·ReD^0.8·Pr^(1/3)` — **NON-FINDING**. Print eq. (7.39a) (PDF 382): unbarred.
- 7-3 blk20 explanation [Nu] (1st hit) eq. (7.39b) `NuD = 0.0243·ReD^0.8·Pr^0.4` — **NON-FINDING**. Print eq. (7.39b): unbarred.
- 7-3 blk20 explanation [Nu] (2nd hit) eq. (7.39c) `NuD = 0.0225·ReD^0.8·Pr^0.4` — **NON-FINDING**. Print eq. (7.39c): unbarred.
- 7-3 blk22 expression [Nu] eq. (7.40) `NuD = 0.023·ReD^0.8·Pr^(1/3)·(µb/µw)^0.14` — **NON-FINDING**. Print eq. (7.40) (PDF 382): unbarred.
- 7-3 blk25 expression [Nu] eq. (7.41) `NuD = (f/8)(ReD − 1000)Pr/{1 + 12.7√(f/8)[Pr^(2/3) − 1]}` — **NON-FINDING**. Print eq. (7.41) (PDF 383): Nu_D unbarred.

### §7.3 — Gnielinski power laws, property corrections, Example 7.3 (PDF 385, book 371)

- 7-3 blk29 expression [Nu] eq. (7.43a) `NuD = 0.0214(ReD^0.8 − 100)Pr^0.4` — **NON-FINDING**. Print eq. (7.43a): unbarred.
- 7-3 blk30 expression [Nu] eq. (7.43b) `NuD = 0.012(ReD^0.87 − 280)Pr^0.4` — **NON-FINDING**. Print eq. (7.43b): unbarred.
- 7-3 blk32 text [Nu] (hits 1–2, eq. (7.44)) `NuD = NuD|Tb × (µb/µw)^n` — **NON-FINDING**. Print eq. (7.44): Nu_D = Nu_D|_{T_b}(μ_b/μ_w)^n — both occurrences unbarred.
- 7-3 blk32 text [Nu] (hits 3–4, eq. (7.45)) `NuD = NuD|Tb × (Tb/Tw)^n` — **NON-FINDING**. Print eq. (7.45): both occurrences unbarred.
- 7-3 blk32 text [Nu] (hit 5) 「NuD の計算に式(7.42)を使った後、f も … 修正すべき」 — **NON-FINDING**. Print: "After eqn. (7.42) is used in calculating Nu_D, f should also be corrected" — unbarred.
- 7-3 blk33 text [h] (Example 7.3 statement) 「バルク温度が50°Cに達した場所での h と f を求めよ」 — **NON-FINDING**. Print: "Find *h* and *f* where the bulk temperature of the fluid has reached 50°C" — h unbarred (developed-flow coefficient at a station).

### §7.3 — Example 7.3 solution, rough-walled pipes (PDF 386–387, book 372–373)

- 7-3 blk34 text [Nu] (1st hit) 「式(7.41)により、NuD = {(0.0136/8)(4.12 × 10⁵ − 1000)(3.61)/[…]}×(1.75)^0.11 = 1,570」 — **NON-FINDING**. Print (PDF 386): Nu_D = 1,570 display — unbarred.
- 7-3 blk34 text [Nu] (2nd hit) and [h] 「すなわち h = NuD·k/D = 1570(0.642)/0.12 = 8,400 W/m²·K」 — **NON-FINDING** (both). Print: "or h = Nu_D k/D = 1570 (0.642/0.12) = 8,400 W/m²K" — both unbarred.
- 7-3 blk39 expression [Nu] eq. (7.49) `NuD = (f/8)·ReD·Pr/{1 + √(f/8)[4.5·Reε^0.2·Pr^0.5 − 8.48]}` — **NON-FINDING**. Print eq. (7.49) (PDF 387) is introduced as "the correlation for the **local** Nusselt number" — Nu_D unbarred.

### §7.3 — Example 7.4, liquid-metal introduction (PDF 388–389, book 374–375)

- 7-3 blk40 explanation [h] 「設計者は、h を高めて熱移動に必要な表面積を減らすため、管壁を意図的に粗くすることがあります」 — **NON-FINDING**. PDF 388: "designers sometimes deliberately roughen tube walls so as to raise *h*" — h unbarred.
- 7-3 blk42 text [Nu] (Example 7.4) 「式(7.49)により、NuD = {(0.02651/8)(4.123 × 10⁵)(3.61)}/{1 + √(0.02651/8)[4.5(71.2)^0.2(3.61)^0.5 − 8.48]} = 2,959」 — **NON-FINDING**. Print display (PDF 388): Nu_D unbarred.
- 7-3 blk42 text [h] (both hits: 「h = 2959(0.642)/0.12 = 15.8 kW/m²·K」 and 「壁の粗さは h の1.9倍の増加」) — **NON-FINDING**. Print: "so h = 2959 (0.642/0.12) = 15.8 kW/m²K" and "causes a factor of 1.9 increase in h" — unbarred in both.
- 7-3 blk46 text [Nu] (1st hit, eq. (7.51)) 「Pex = u∞x/α に対して Nux = fn(Pex)（式(7.51)）」 — **NON-FINDING**. Print eq. (7.51) (PDF 389): Nu_x = fn(Pe_x) — unbarred (flat-plate local value).
- 7-3 blk46 text [Nu] (2nd hit) 「管内の液体金属に対する NuD も、主にペクレ数 PeD = uav·D/α に依存すると予想されます」 — **NON-FINDING**. PDF 390 (book 376): "Thus, we expect Nu_D for liquid metals in pipes also to depend primarily on the Péclet number, Pe_D = u_av D/α" — unbarred.

### §7.3 — liquid-metal data and correlations (PDF 390–391, book 376–377)

- 7-3 blk48 text [Nu] (both hits: 「NuD の測定値を集めました」 and 「データは NuD 対 PeD 座標上でかなりよく相関」) — **NON-FINDING**. Print (PDF 390): "collected measured values of Nu_D for liquid metals flowing in pipes…" and "most of the data correlate fairly well on Nu_D vs. Pe_D coordinates" — unbarred in both.
- 7-3 blk48 text [h] 「不純物も、例えば … 酸化物堆積物を形成することで h の低い値をもたらし」 — **NON-FINDING**. Print: "Impurities can also lead to lower values of *h*, for example, by forming poorly conducting oxide deposits on the pipe wall" — h unbarred.
- 7-3 blk51 expression [Nu] eq. (7.52) `NuD = 0.625·PeD^0.4` — **NON-FINDING**. Print eq. (7.52) (PDF 391): unbarred.
- 7-3 blk52 expression [Nu] eq. (7.53) `NuD = C1 + C2·PeD^n` — **NON-FINDING**. Print eq. (7.53): unbarred.
- 7-3 blk53 expression [Nu] eq. (7.54) `NuD = 5.0 + 0.025·PeD^0.8` — **NON-FINDING**. Print eq. (7.54): unbarred.

### §7.3 — Skupinski correlation, Example 7.5 (PDF 392–393, book 378–379)

- 7-3 blk55 expression [Nu] eq. (7.55) `NuD = 4.82 + 0.0185·PeD^0.827` — **NON-FINDING**. Print eq. (7.55) (PDF 392): unbarred.
- 7-3 blk57 text [Nu] (Example 7.5) 「式(7.55)により、NuD = 4.82 + 0.0185(4470)^0.827 = 24.2 と計算されます」 — **NON-FINDING**. Print (PDF 393): "With eqn. (7.55), we compute Nu_D = 4.82 + 0.0185(4470)^0.827 = 24.2" — unbarred.
- 7-3 blk57 text [h] (all 3 hits: 「h = (24.2)(10.9)/(16.6 × 10⁻³) = 15.9 × 10³ W/m²·K」、「Tw = Tb + qw/h = 441.5 + …」、「実験値 … h = 11.1 × 10³ W/m²·K」) — **NON-FINDING**. Print (PDF 393): h unbarred in all three places.

## Final tally

- Candidates adjudicated: **65 / 65** (counted as individual symbol occurrences, matching the candidate file: §7.2 = 25, §7.3 = 40). Every candidate was decided from the page image; no candidate was adjudicated from text extraction alone.
- **Findings: 3** — all one subcategory, all P3, all in §7.2, all the same notation deviation: where print writes the length-mean Nusselt number with a combining macron (**Nū_D**), the data writes the katakana suffix 「**NuD バー**」 instead:
  1. `7-2-ja.json` blk48, field `explanation` — 「平均ヌセルト数 NuD バー」 (PDF 376; print "an average Nusselt number, Nū_D").
  2. `7-2-ja.json` blk49, field `expression`, eq. (7.27) LHS — 「NuD バー ≡ h̄D/k」 (PDF 376; print Nū_D ≡ h̄D/k). Note the same display uses a true U+0304 on h̄, so the Nu notation is internally inconsistent within the display.
  3. `7-2-ja.json` blk53, field `expression`, eq. (7.29) LHS — 「NuD バー = 3.657/tanh[…] + 0.0499·Gz·tanh(Gz^(−1))」 (PDF 376; print Nū_D).
  In all three the mean IS explicitly denoted by the word バー, so no meaning is lost, no displayed equation becomes mathematically false, and nothing contradicts an adjacent display; severity is therefore P3 (notation-form deviation from print), not a P2 candidate. The fix, if the coordinator adopts it, is per-instance: replace 「NuD バー」 with Nu + U+0304 at exactly these three places — NOT a blanket operation.
- **Non-findings: 62** — in every case the printed symbol is also unbarred: local/developed-flow coefficients (the book's convention throughout §§7.2–7.3 is that pipe correlations and developed values use plain Nu_D/h, with bars reserved for the entrance-length average of eq. (7.31), the Fig. 7.5 data, and the §7.2 mean definitions), local integrands inside eq. (7.27), or generic mentions.
- **Over-applications: 0.** Spot-checks where print DOES bar the mean — eq. (7.31) + intro prose (PDF 379), Fig. 7.5 prose ×5 and the Fig. 7.5 axis (PDF 380–381), eq. (7.27)'s h̄ — all carry correct macrons in the data already. (Figure-internal barred symbols in Figs. 7.4/7.5 live in alt/description text, which was covered by the earlier alt rechecks, not by this candidate list.)
- Closing statement: **No candidate remains unadjudicated.** All 65 occurrences in §§7.2/7.3 have a recorded verdict above.

