# 上線（オーバーライン）パターン「要画像確認」項目の裁定記録

- 対象ツリー: `~/workspace/dev/heat-collation3`（ブランチ `audit/integration-loop3`）
- 入力: `docs/audit-final/OVERLINE_SWEEP_20261109.md` の「要画像確認リスト」Y1–Y12（12項目・約70ユニット）
- 方法: 原典 *A Heat Transfer Textbook* 6th ed.（`~/workspace/research_notes/ahtt-reading/AHTTv600.pdf`）の該当ページを 200dpi でレンダリングし、記号の上線有無を目視で確定した。PDF テキスト層はマクロンを完全に脱落させるため、上線有無の判定はページ画像でのみ行った。ページ番号はすべて **PDF ページ**（書籍ページ = PDF − 14）。
- 規約: 走査記録 §6 の表記規約（マクロンは後置）に従う。本記録は監査のみで、製品コード・データは変更していない。コミットしない。

## 集計

| 項目 | 対象 | 判定 | 脱落ユニット数 |
|---|---|---|---|
| Y1 | §2.3 熱抵抗族（2-3-ja＋lesson[7]） | 脱落 | 45 |
| Y2 | §1.3 例題1.4・1.5（1-3-ja blocks 115/120/164） | 脱落 | 4 |
| Y3 | 式(4.27)（4-5-ja block 12＋lesson[18]） | 脱落 | 4 |
| Y4 | §5.4 線図・例題5.2（5-4-ja blocks 6/7/8/17/18） | 脱落 | 5 |
| Y5 | §7.3 Nu_D 相関族13式（7-3-ja） | 一部のみ脱落（式(7.31) のみ） | 1 |
| Y6 | 式(7.73) 族（7-6-ja＋lesson[41]） | 脱落 | 3 |
| Y7 | lesson[46] blocks 10/11（§8.4 水平面相関） | 脱落 | 5 |
| Y8 | §11.7 例題11.12＋同一節の連動確認（11-7-ja） | 脱落（一部非所見あり） | 23 |
| Y9 | lesson[2]（§1.3 教材） | 脱落 | 18 |
| Y10 | lesson[22] blocks 1/7（§5.4 教材） | 脱落 | 2 |
| Y11 | lesson[39] block 2（§7.4 NTU） | 一部のみ脱落（NTU の h のみ） | 1 |
| Y12 | 式(9.55)（9-9-ja block 3） | 脱落 | 3 |
| 計 | | | **114** |

未確定の項目はない（12項目すべて画像で判読し裁定した）。

---

## Y1 §2.3 の熱抵抗族

**原典の根拠（PDF 81–88、書籍67–74）**：§2.3 の対流係数は例外なく h̄ で印刷されている。全ページを読影して確認した（例：式(2.23) PDF 82、式(2.25) PDF 83、式(2.26) R_t,conv = 1/(h̄A) PDF 83、例題2.6「h̄ = 20 W/m²K」PDF 84、式(2.27) Bi = h̄r_crit/k PDF 84、例題2.7「h̄ = 13 W/m²K」PDF 87、1/R_t,equiv = A(h_rad + h̄) PDF 87–88）。図2.11 の図中ラベルも h̄（PDF 81）。

**修正ユニット（h → h̄）**：

- `data/sections/2-3-ja.json`（21出現・16ブロック）：
block 38.alt ×1（図2.11 の alt)、block 43.expression ×1、block 45.expression ×1、block 46.text ×2、block 52.expression ×1、block 56.expression ×1、block 58.text ×1、block 59.text ×1、block 62.expression ×1、block 64.expression ×2、block 66.expression ×1、block 67.text ×1、block 82.text ×2、block 84.text ×1、block 89.expression ×2＋.explanation ×1、block 97.text ×1。
- 発展教材 lesson[7]（`data/original-deep-lessons.json`、24出現）：
blocks[0].text ×2、blocks[3].text ×3、blocks[6].text ×4、blocks[7].heading ×1、blocks[7].text ×4、blocks[8].text ×1、blocks[9].text ×1、equations[3].expression ×1＋.meaning ×1、equations[4].expression ×2＋.meaning ×1、equations[5].expression ×1、equations[6].expression ×1、equations[8].meaning ×1。
教材の h_i/h_o は原典 §2.3 には直接の出現がなく教材独自の一般化だが、§2.3 の係数が例外なく面平均 h̄ である族判定、および lesson[20]（§5.2）で全出現を脱落とした先例に従う。

**非所見（原典も無印・別記号）**：h_rad（原典も無印）、h_c（別記号）、h_eff という記号自体（別記号。ただし block 97 の定義 h_eff = h + h_rad 中の対流 h は上記の脱落側）。

## Y2 §1.3 例題1.4・1.5

**原典の根拠**：
- PDF 38（書籍24）：例題1.4 の問題文自体が「The heat transfer coefficient **h̄** is 250 W/m²K」。
- PDF 39（書籍25）：解法の時定数 𝒯 = ρcV/(**h̄**A) = ρcD/(6**h̄**) = 1.116 s（3出現すべて h̄）。
- PDF 46（書籍32）：例題1.5 の収支 **h̄**A_tc(T_tc − T_air) = −Q_net。

**修正ユニット（h → h̄）**：`data/sections/1-3-ja.json`
- block 115.expression ×2（𝒯 = ρcV/(hA) の h、ρcD/(6h) の h）
- block 120.expression ×1（Bi ≡ hL/k。§1.3 の Bi 定義 Bi ≡ h̄L/k_b（PDF 36）および当該例題の係数 h̄ = 250 と同一）
- block 164.expression ×1（h·A_tc）

## Y3 式(4.27)

**原典の根拠（PDF 177、書籍163）**：式(4.27) は **Bi_fin = h̄(A/P)/k ≪ 1** とバー付きで印刷されている。同ページの定義文も「through a heat transfer coefficient, **h̄**」「through a heat transfer coefficient, **h̄_L**, which would generally differ from **h̄**」とすべて h̄。
信号の競合について：PDF 181 の一般散文には「h(A/P)/k」と無印で言い直す箇所があるが、これは散文中の総称言及であり、**式(4.27) そのものは バー付き**。アプリの block 12 は式そのものの引用なので脱落側に確定する。

**修正ユニット（h → h̄）**：
- `data/sections/4-5-ja.json` block 12.expression ×1、block 12.alt ×1（同じ式の読み上げ）
- lesson[18] blocks[2].text ×2（「Bi_fin=h(A/P)/k ≪ 1（式(4.27)）」の引用 ×1、「導出では側面のhが一様と仮定する」×1 — 原典の「h̄ … will be assumed uniform」の言い換え）

## Y4 §5.4 線図・例題5.2

**原典の根拠**：
- PDF 221（書籍207）：線図の基礎となる級数解で「setting **Bi = h̄L/k**」「Bi = **h̄**L/k by the transcendental equation」と定義。線図（図5.7–5.9）のパラメータ Bi はこの h̄ 基準。
- PDF 228（書籍214）：例題5.2 の問題文「and **h̄** is approximately 6 W/m²K as the result of natural convection」、解法「Bi = (**h̄**r_o/k) = 6(0.05)/0.603 = 0.498」。

**修正ユニット（h → h̄）**：`data/sections/5-4-ja.json`
- block 6.description ×1（図5.7「Bi = hL/k」）
- block 7.description ×1（図5.8「Bi = hr_o/k」）
- block 8.description ×1（図5.9「Bi = hr_o/k」）
- block 17.text ×1（例題5.2 問題文の h ≃ 6）
- block 18.text ×1（例題5.2 解法の Bi = hr_o/k）

## Y5 §7.3 の Nu_D 相関族13式

**原典の根拠**：§7.3 の表記は一様でないことを各ページで確認した。バー付きは式(7.31) のみで、他は原典も Nu_D 無印。

**脱落（1ユニット）**：
- `data/sections/7-3-ja.json` block 5.expression（式(7.31)）の分子 **NuD → Nū_D** ×1。原典（PDF 379、書籍365）：散文「correlation for **Nū_D**」＋式 **Nū_D/Nu_∞** = 1 + C/(L/D)^n。分母側の Nu_∞ は無印のまま。

**非所見（原典も Nu_D 無印、12件）**：
- block 17 式(7.35)（PDF 381）、block 19 式(7.37)（PDF 382）、block 20 式(7.39a)（PDF 382。注：原典で (7.39a) は Colburn の式、Dittus–Boelter は (7.39b)。走査記録のラベルと異なるが両式とも無印で判定には影響しない）、block 22 式(7.40)（PDF 382）、block 25 式(7.41) Gnielinski（PDF 383）、block 29 式(7.43a)・block 30 式(7.43b)（PDF 385）、block 39 式(7.49)（PDF 387。原典が「the local Nusselt number」と明示）、block 51 式(7.52)・block 52 式(7.53)・block 53 式(7.54)（PDF 391）、block 55 式(7.55)（PDF 392）。

## Y6 式(7.73) 族

**原典の根拠（PDF 409、書籍395）**：式(7.73a)–(7.73g) は fn(Re_D) の形で与えられ Nu 記号を含まない。唯一、式(7.73h) が **Nū_D = 0.027(S_T/S_L)^0.2 Re_D^0.8（Pr = 0.7）** と Nū_D を明示する。主式(7.72) の Nū_D は確定リストで別途収載済み（PDF 407）。

**修正ユニット（NuD → Nū_D、各 ×1、すべて式(7.73h) の言及箇所）**：
- `data/sections/7-6-ja.json` block 25.explanation（「NuD = 0.027(ST/SL)^0.2·ReD^0.8（Pr = 0.7、式(7.73h)）」）
- lesson[41] blocks[9].text（「Pr=0.7 では Nu_D=0.027 …（7.73h）を直接与える」）
- lesson[41] equations[9].expression（同内容）

注：block 25.expression の NuD は式(7.72) であり確定リスト収載済みのため Y6 には数えない。

## Y7 lesson[46] blocks 10/11（§8.4 水平面相関）

**原典の根拠**：
- PDF 449（書籍435）：式(8.35) **Nū_L** = 0.14 Ra_L^(1/3)((1 + 0.0107Pr)/(1 + 0.01Pr))。
- PDF 450（書籍436）：式(8.37a) Nū_L*、式(8.37b) Nū_corrected、散文でも h̄。
- PDF 451（書籍437）：式(8.38) **Nū_L** = 0.58 Ra_L^(1/5)（Fujii–Imura）、式(8.39) Nū_D、散文「in **Nū_L** = q_wL/(kΔT̄)」。

**修正ユニット**：lesson[46]（`data/original-deep-lessons.json`）
- blocks[10].text：Nu_L ×2（式(8.35) 本体「Nu_L=0.14Ra_L^(1/3)…」と「h=Nu_Lk/L」内の Nu_L）→ Nū_L；連動する h ×2（「h=Nu_Lk/L」の h は定義上 h̄、「このモデルのhの性質」の h も同一の平均係数）→ h̄
- blocks[11].text：Nu_L ×1（Fujii–Imura 形 ＝ 式(8.38)）→ Nū_L

## Y8 §11.7 例題

**原典の根拠**：§11.7 は内部でも表記が分かれる。
- PDF 677–678（書籍663–664）、例題11.12（コーヒーカップ）：相関式 **Nū_D**（式(8.37a) 由来）、「**Nū_D** = 22.7」、**Nū_{m,D}** = 21.5、**h̄ = kNū_D/D = (0.0273)(22.7)/0.09 = 6.89 W/m²K**、**ḡ_{m,H2O}** = 7.27×10⁻³、Q_nc = (πD²/4)**h̄**(T_s − T_e)、Q_evap 中の **ḡ_{m,H2O}** — すべて バー付き。
- PDF 680（書籍666）、湿球温度：**h̄**(T_e − T_wet-bulb)、式(11.72b) の **ḡ_{m,H2O}** と **h̄**、**h̄**D/k = C Re^a Pr^b、**ḡ_{m,i}**D/(ρ𝒟) = C Re^a Sc^b、**h̄**/(**ḡ_{m,i}** c_p) — すべて バー付き。
- PDF 681（書籍667）：式(11.73) **h̄**/**ḡ_{m,i}** c_p = Le^{1−b} と直後の散文「the ratio of **h̄** to **ḡ_{m,i}**」は バー付き。**ただし** Lewis 1922 への歴史的言及「The relationship between **h** and **g_{m,i}** was identified by Warren K. Lewis…」は原典も**無印**。
- PDF 683（書籍669）：式(11.76a) n_H2O,s h_fg + **h**(T_e − T_s) = h_cond(T_s − T_c) と式(11.76b) の g_{m,H2O} は原典も**無印**。h_cond は「The **local** film condensation heat transfer coefficient」と明記された別記号。

**修正ユニット（本体：例題11.12）**：`data/sections/11-7-ja.json` block 2.text
- h ×3 → h̄（訳注中の総称言及「以下の Nu、h、gm」×1、「h = kNuD/D = 6.89」の h ×1、Q_nc の h ×1）
- NuD ×3 → Nū_D（相関式、NuD = 22.7、kNuD/D 内）
- Num,D ×2 → Nū_{m,D}（Num,D = 21.5、g_m 定義式内）
- gm,H2O ×2 → ḡ_{m,H2O}（定義式、Q_evap 内）
- Nu ×1・gm ×1（訳注中の総称言及）→ それぞれ Nū_D/Nū_{m,D}・ḡ_m 側

**修正ユニット（連動確認：湿球温度の導出）**：
- block 4.text：h ×4 → h̄（収支「= h(Te − Twet-bulb)」、近似形「hD/k」、比「h/(gm,i·cp)」、式(11.73) の比への言及）、gm,i ×3 → ḡ_{m,i}（近似形、比、式(11.73) 言及）
- block 9.expression（式(11.72b)）：gm,H2O ×1 → ḡ_{m,H2O}、h ×1 → h̄
- block 10.expression（式(11.73)）：h ×1 → h̄、gm,i ×1 → ḡ_{m,i}

**非所見**：
- block 4.text の歴史的言及「h と gm,i の間の関係は … 1922年に … ルイスによって同定された」の h ×1・gm,i ×1（原典 PDF 681 も無印）
- block 18.expression（式(11.76a)）の h ×1（原典 PDF 683 も無印）
- block 11（式(11.74)）は係数 h を含まず対象外。h_fg・ĥ（エンタルピー）・h_cond は別記号で対象外。

## Y9 lesson[2]（§1.3 教材）

**原典の根拠**：§1.3 の係数は定義から h̄。式(1.19)–(1.23) と Bi ≡ **h̄**L/k_b は PDF 35–36 で全て h̄（節ファイル側は確定リスト収載済み）。ニュートンの冷却則も h̄A(T_s − T_∞)。例題1.4 の係数も h̄ = 250（PDF 38、Y2 参照）。教材の全出現がこの平均係数か、その式・例題の引用である。

**修正ユニット（h → h̄、計18）**：lesson[2]（`data/original-deep-lessons.json`）
- blocks[1].text ×2（冷却則 Q̇=hA(T_s−T_∞)、「hの単位」）
- blocks[4].text ×2（「対流熱伝達率hの次元」、「hとh_rを足せる」— h_r 自体は別記号で除外）
- blocks[6].text ×4（「−hA(T − T_∞) = ρcV dT/dt」（原典 (1.22)）、「𝒯 = ρcV/(hA) = mc/(hA)」（原典 (1.23)）×2、散文「表面積や h が小さいほど」×1）
- blocks[7].text ×3（「Bi ≡ hL/k_b」、「例題1.4の（h = 250 W/m²K）」、「Nu = hL/k_fluid」の対比文中の h）
- equations[1].expression ×1＋.meaning ×1
- equations[4].meaning ×1（「h が一定のとき」— 式(1.22) の解の条件）
- equations[5].expression ×2＋.meaning ×1（「1/(hA) は対流熱抵抗」）
- equations[6].expression ×1（Bi = hL/k_b）

## Y10 lesson[22] blocks 1/7

**原典の根拠**：Y4 と同一。線図の Bi は Bi = **h̄**L/k（PDF 221）。例題5.3 も問題文・解法とも h̄（PDF 229：「the boiling heat transfer coefficient, **h̄**」「We get **h̄** = 30,000 W/m²K」；PDF 230：「Bi = **h̄** radius/k = 1.09」）。

**修正ユニット（h → h̄）**：lesson[22]（`data/original-deep-lessons.json`）
- blocks[1].text ×1（「そのときBi=hL/k」）
- blocks[7].text ×1（「沸騰熱伝達率 h を … 測る場合」— 例題5.3 の係数）

（blocks[8] の Bi = hr/k は確定リスト収載済み。）

## Y11 lesson[39] block 2（§7.4）

**原典の根拠（PDF 394、書籍380）**：§7.4 は使い分けが明示的である。
- 微分収支 dQ = q_wP dx = **h**P(T_w − T_b)dx と積分形 (P/ṁc_p)∫₀ᴸ **h** dx の h は**無印**（断面ごとの局所係数）。
- 交換器としての係数は **h̄**：冒頭「whose overall heat transfer coefficient, U, is just **h̄**」、Q = **h̄**A(LMTD)、式(7.56) の分母 **h̄**、「We recognize in this the definition of **h̄** from eqn. (7.27)」、式(7.57) の **h̄**PL/(ṁc_p)。

**判定の内訳**：lesson[39] blocks[2].text（`data/original-deep-lessons.json`）
- **脱落 ×1**：「NTU=**h**A_s/C」の h → **h̄**。NTU の指数は式(7.57) の h̄A_s/(ṁc_p)（A_s = PL）そのもので、原典では h̄。
- **非所見 ×2**：「exp[−∫**h**P_h dx/C]」の積分内の h（原典の積分形も局所 h で無印）、「**h**と周長一定なら」の h（積分内の局所 h に対する仮定を述べる箇所で、原典の対応位置も無印。一定化の結果得られる平均は NTU 側の h̄ で表される）。

（blocks[1] の局所 h(x) は走査記録どおり非所見のまま。）

## Y12 式(9.55)

**原典の根拠（PDF 535、書籍521）**：式(9.55) Shekriladze–Gomelauri は **Nū_D** = 0.64{…}^{1/2}。直後の定義文「where u_∞ is the free stream velocity and **Nū_D** is based on the liquid conductivity」も、重力不関の極限 式(9.56) **Nū_D** → 0.64√(2Re_D) も、すべて バー付き。

**修正ユニット（NuD → Nū_D、計3）**：`data/sections/9-9-ja.json` block 3
-.expression ×1（式(9.55) 本体）
-.explanation ×2（「NuD は液体の熱伝導率に基づきます」、「NuD → 0.64√(2ReD)（式(9.56)）」）

---

## 範囲外観察（本裁定の対象外・未裁定として明記）

- `7-6-ja.json` block 9 の総称形「NuD = fn(ReD, Pr) の形の関係」と block 19 の例題内 NuD（NuD = 10.69 等）は、走査記録の確定リストにも Y リストにも含まれておらず、本裁定では判定していない（親側の判断材料として記録するに留める）。
- 走査記録 §7 の式(8.43b) 冪範囲の件は上線パターンとは別の所見であり、本裁定の対象外。
- §11.7 の block 12 の ΔT̄ は確定リスト収載済みで、本裁定の対象外。

## 実施メモ

- 読影した原典ページ（PDF）：38, 39, 46, 177, 221, 222, 228, 229, 230, 379・381–385・387・391・392（Y5 分は前工程で読影）, 393, 394, 408, 409, 449, 450, 451, 535, 677, 678, 679, 680, 681, 683, 81–88（Y1 分は前工程で全読影）。すべて 200dpi で判読できたため 400dpi への切り替えは不要だった。
- 本記録の作成にあたり製品コード・データへの変更は行っていない。
