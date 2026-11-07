# モデル↔問題番号対応表（§21マニュアル項目15のための棚卸し）

作成：2026-11-07（フェイリス側棚卸し作業）。対象ツリー：翻訳ブランチ `codex/quality-audit-local-pack` 先端 `68d2875`。
本書は棚卸しの記録であり、製品コード・問題データは変更していない。各マニュアルへの反映は統合フェーズで行う（末尾の申し送り参照）。

## 1. 問題バンクの棚卸し結果

### 所在と件数

- 問題バンクの正本は `data/questions.json`（配列）。**全 751 件**で、公表数 751 問と一致する。
- 内訳（`source.type`）：アプリ作成の補足問題（supplement）743 件、書籍由来（book）8 件。
- 他の問題ファイルはすべてバンクの部分集合（ID が全件バンク内に存在する）であり、二重に数えてはならない：

| ファイル | 件数 | うちバンク内 |
|---|---:|---:|
| data/original-section-questions.json | 76 | 76 |
| data/original-advanced-questions.json | 11 | 11 |
| data/applied-exercises-part1.json | 11 | 11 |
| data/applied-exercises-part2.json | 11 | 11 |
| data/deep-physics-practice.json | 20 | 20 |

### メタデータ構造（対応付けの根拠に使えるもの）

各問題は `id`、`prompt`、`choices`、`answer`、`explanation`、`field`、`difficulty`、`prerequisites`、`source` を持つ。**タグという独立フィールドは存在しない**。対応付けに使えるのは次の3点である。

1. **`source.guideId`**（補足問題743件全件に付与）：アプリの補助講座への帰属で、講座は教科書の章に対応する（`guide.mjs` の `bookChapter`）。章レベルの対応付けでは最も強い根拠になる。
2. **`field`**（分野ラベル、全 51 種）：粒度は歴史的に不均一（例：「非定常伝導」と「非定常熱伝導」、「放射」と「熱放射」が併存）。単独では根拠にせず、補助に使う。
3. **`prompt` の内容**：モデル固有の主題（境界条件・形状・相関式）は本文で確認する。

guideId 別の件数：

| guideId | 件数 |
|---|---:|
| chapter9-latent-boiling | 128 |
| chapter11-fick-mass | 93 |
| chapter6-flat-boundary | 77 |
| chapter5-semi-infinite | 68 |
| chapter8-buoyancy | 62 |
| chapter7-internal-flow | 60 |
| chapter10-view-factors | 53 |
| chapter2-cylindrical-conduction | 46 |
| chapter4-fin-design | 45 |
| chapter1-energy-balance | 43 |
| chapter3-effectiveness-ntu | 36 |
| (book) | 8 |
| sim-conduction | 5 |
| sim-convection | 5 |
| sim-radiation | 5 |
| sim-resistance | 5 |
| learn-dimensionless-transient | 3 |
| learn-lumped-cooling | 3 |
| learn-convection-dimensionless | 3 |
| learn-heat-exchanger | 3 |

（book 8件は guideId を持たず、`source.section` で章が分かる。本書の対象分野には沸騰（第9章）等の8件のみで、直接の対応はない。）

## 2. 対応付けの方針

- 根拠の優先順位は guideId（章）→ field → prompt 内容の順。本文まで確認し、モデルの主題（形状・境界条件・支配関係）と合うものだけを採る。キーワードの機械的一致だけでは採らない（実際に、本文が凝縮・物質移動など別主題のものは除外した）。
- 各問題は原則として **1 モデルにのみ主掲載**する。主題が重なるモデルには「相互参照」として記し、二重に数えない。
- 対応が見つからないモデルは無理に埋めず「対応なし」と正直に書く（第8節）。
- 章対応（`guide.mjs`／`data/book.json`）：非定常＝第5章、フィン＝第4章、定常伝導・熱抵抗＝第2章、強制対流＝第6章・第7章、自然対流＝第8章、放射＝第10章。

## 3. 非定常熱伝導（第5章）

### 3.1 矩形（平板・矩形2次元・集中系・半無限近似）— 主掲載 70 件

根拠：guideId = `chapter5-semi-infinite`（第5章補助）を中心に、field（非定常伝導／非定常熱伝導／非定常・平板伝導／熱伝導・非定常）と本文の形状・境界条件で選別した。矩形モデル群は平板の分布系解・一項近似・線図、矩形の積解と多次元、集中熱容量、半無限近似を一体として扱うため、本節にまとめる。

#### 平板の分布系・一項近似・線図（21 件）

- `supp-section-5-3` — 【第5.3節・独立学習ノート】対称な板の中心面では通常どの温度勾配が0になるか。
- `supp-section-5-5` — 【第5.5節・独立学習ノート】初期直後の温度分布に一項近似を無条件で使えるか。
- `supp-found-slab-biot-v1` — 両面が同条件の厚さ0.040 mの平板。半厚さL=0.020 m、h=50 W/(m²·K)、k=5 W/(m·K)のB
- `supp-found-slab-fourier-v1` — 平板半厚さL=0.020 m、α=1.0×10⁻⁶ m²/s、経過時間100 sのFoは？
- `supp-found-slab-solve-v1` — ある平板のBi=0.20、Fo=0.25だけが分かった。中心温度の数値を求めるには何が必要か？
- `supp-found-slab-symmetry-v1` — 初期温度・両面の境界が対称な平板で、中心x=0の温度勾配は？
- `supp-next-fourier-size-time-v1` — 同じ熱拡散率の平板で、代表長さを2倍、経過時間を4倍にした。Fo=αt/L²はどう変化するか。
- `supp-next-fourier-time-scale-v1` — 平板の半厚さL=0.020 m、熱拡散率α=1.0×10⁻⁶ m²/sとする。代表熱拡散時間L²/αは？
- `supp-next-dimensionless-centre-temperature-v1` — 非定常平板で初期一様温度100℃、周囲温度20℃、ある時刻の中心無次元超過温度θ_c=(T_c−T∞)/(T_i−T∞)
- `supp-transient-gap-one-term-eigen-root-v1` — 対称両面対流平板でλ_1=0.860333589、tanλ_1≈1.162339。固有値条件Bi=λ_1tanλ_1から
- `supp-transient-gap-one-term-mode-decay-v1` — Bi=1の平板の中心で、第二項/第一項の絶対値は|A₂/A₁|exp[−(λ₂²−λ₁²)Fo]。|A₂/A₁|=0.1
- `supp-transient-gap-one-term-average-factor-v1` — 対称平板一項近似で中心Θ_0=0.772956、sinλ_1/λ_1=0.881124を与える。平均Θ̄=Θ_0sinλ
- `supp-transient-gap-one-term-initial-overshoot-v1` — 初期一様冷却の一項式でA₁=1.119。式をt=0へ外挿した中心Θ_0>1について適切なのはどれか。
- `supp-transient-gap-one-term-fourier-range-v1` — Fo≳0.2を一項近似の目安として使った。誤差の判断として適切なのはどれか。
- `supp-transient-gap-one-term-small-bi-limit-v1` — 対称平板でBiが十分小さく、λ_1tanλ_1=Biの最小根も小さい。tanλ≈λを使った極限はどれか。
- `supp-transient-gap-chart-center-temperature-v1` — 初期100℃、周囲20℃。対応する有限体解から中心応答Θ_0=(T_0−T_∞)/(T_i−T_∞)=0.773を得た。
- `supp-transient-gap-chart-position-ratio-v1` — 有限体の線図で中心Θ_0=0.80、指定位置の比Θ/Θ_0=0.90を読み取った。指定位置のΘはどれか。
- `supp-transient-gap-chart-average-energy-v1` — 一定比熱の冷却で、有限体解の平均規格化温度Θ̄=0.68を得た。初期と周囲の温度差に相当する顕熱を基準にした放出割合はど
- `supp-transient-gap-chart-log-axis-v1` — 温度応答線図の横軸Foが対数目盛で、0.10と1.0のちょうど中間にある点を読む。Foはいくらか。
- `supp-transient-gap-chart-time-dependent-boundary-v1` — 初期一様・h一定・周囲一定の温度応答線図がある。実験では周囲温度が大きく時間変化した。どう扱うか。
- `supp-transient-gap-surface-vs-ambient-v1` — 有限のhを介して冷却する固体で、周囲流体温度T_∞を一定にした。表面温度T_sについて適切なのはどれか。

#### 矩形の積解（2方向の積、7 件）

- `supp-transient-gap-product-center-v1` — 分離可能な矩形の冷却で方向別の中心規格化応答X_0=0.80、Y_0=0.70。初期100℃、共通周囲20℃。Θ_cen
- `supp-transient-gap-product-average-heat-v1` — 分離可能な二方向冷却で方向別の平均応答X̄=0.80、Ȳ=0.70。平均Θ̄=X̄Ȳとすると、基準顕熱に対する放出割
- `supp-transient-gap-product-direction-fourier-v1` — 同じ固体・同じ時刻の矩形で半寸法a=2b。Fo_x=αt/a²、Fo_y=αt/b²ならFo_x/Fo_yはどれか。
- `supp-transient-gap-product-common-ambient-v1` — 標準的な一次元冷却応答の積で矩形の温度を求めたいが、x方向とy方向の周囲温度が異なる。どう扱うか。
- `supp-transient-gap-product-average-center-v1` — 分離可能な矩形冷却で、中心X_0Y_0と体積平均X̄Ȳが得られた。全体の顕熱評価に使う量はどれか。
- `supp-transient-gap-product-each-direction-validity-v1` — 二方向の一項積近似でFo_x=1.0、Fo_y=0.01。精度を判断する適切な方法はどれか。
- `supp-transient-gap-product-pde-check-v1` — X_t=αX_xx、Y_t=αY_yyを満たす関数でΘ=XYとする。二次元熱方程式を満たすことを示す正しい式はどれか。

#### 多次元伝導（9 件）

- `supp-section-5-7` — 【第5.7節・独立学習ノート】二次元伝導の熱流ベクトルはどの向きか。
- `supp-section-5-8` — 【第5.8節・独立学習ノート】三次元過渡解析に一次元定常抵抗だけを使えばよいか。
- `supp-transient-gap-multidim-steady-center-v1` — 正方形の定常二次元伝導で三辺20℃、一辺100℃、一定k・発熱なし。内部中心の規格化応答が対称性より1/4と分かる。中心
- `supp-transient-gap-multidim-grid-weights-v1` — 一定k・発熱なしの定常2D差分。Δx=2Δy、隣接温度E=100,W=20,N=20,S=20℃。T_P=[(T_E+T
- `supp-transient-gap-multidim-flux-components-v1` — 等方・一定k=2.0 W/(m·K)の2D温度場で、局所勾配∂T/∂x=+10、∂T/∂y=−20 K/m。Fourie
- `supp-transient-gap-multidim-superposition-v1` — 温度場の重ね合わせをそのまま使える基本条件として適切なのはどれか。
- `supp-transient-gap-multidim-corner-singularity-v1` — 一辺100℃、隣接辺20℃の理想矩形解で、内部温度は収束した。角付近の境界熱流について適切な判断はどれか。
- `supp-transient-gap-multidim-mesh-check-v1` — 数値の2D伝導温度図が滑らかに描けた。検証として優先すべき組合せはどれか。
- `supp-transient-gap-multidim-stationary-vs-1d-v1` — 定常二次元伝導の温度T(x,y)について適切なのはどれか。

#### 集中熱容量と無次元数の基礎（全非定常モデル共通、21 件）

- `supp-section-5-1` — 【第5.1節・独立学習ノート】同じFoならすべての物体が同じ温度分布になるか。
- `supp-section-5-2` — 【第5.2節・独立学習ノート】一定のhと周囲温度を仮定した集中熱容量法で、t=τに初期値の1/eとなる量はどれか。
- `supp-section-5-4` — 【第5.4節・独立学習ノート】Θ=(T−T_∞)/(T_i−T_∞)でT_i≠T_∞のとき、Θ=0ならTはどの温度に一致
- `supp-advanced-ch5-calc` — 集中熱容量近似が妥当でT₀=100 ℃、周囲T∞=20 ℃、時定数τ=100 sです。物体温度が40 ℃になる時刻は約何
- `supp-applied-5-1-v1` — 熱拡散率α=2.0×10⁻⁶ m²/s、代表長さL=0.010 m、経過時間50 sです。フーリエ数Fo=αt/L²はい
- `supp-existing-lumped-time-constant-v1` — 一様温度近似が妥当な固体でm=1.0 kg、c=500 J/(kg·K)、h=20 W/(m²·K)、対流面積A_s=0
- `supp-existing-lumped-heating-temperature-v1` — 集中熱容量モデルで初期20℃、一定周囲80℃、時定数100 s。t=100 s、exp(−1)=0.367879とすると
- `supp-existing-lumped-sensible-energy-v1` — 比熱一定500 J/(kg·K)、質量1.0 kgの物体が100℃から49.4℃へ冷却された。物体から放出した顕熱の正の
- `supp-existing-lumped-half-time-inverse-v1` — 集中熱容量モデルで周囲との温度差が半分になる時間t_1/2=120 s、mc=600 J/K、A_s=0.050 m²。
- `supp-existing-lumped-h-validity-tradeoff-v1` — 同じ固体・形状でhだけを2倍にすると、集中モデル上のτ=mc/(hA_s)とBi=h(V/A_s)/k_sはどう変わるか
- `supp-existing-lumped-variable-h-v1` — 内部一様温度は保てるがh=h(t)が時間で大きく変化する。周囲温度・熱容量・面積は一定、他の熱経路なし。一定τの単一指数
- `supp-existing-lumped-passive-range-v1` — 集中熱容量の冷却でh>0、mc>0、周囲温度一定、発熱・仕事・相変化なし。初期100℃、周囲20℃の計算でt>0に10℃
- `supp-expanded-bi-calc` — 集中熱容量近似を検討する固体で、V=0.002 m³、対流面積Aₛ=0.10 m²、h=40 W/(m²·K)、固体の熱
- `supp-expanded-fo-calc` — 固体の熱拡散率αₛ=1.0×10⁻⁵ m²/s、特性長さL𝚌=0.020 m、経過時間t=40 sのとき、Fo=αₛt
- `supp-expanded-alpha-calc` — 一定物性の固体で、熱伝導率kₛ=10 W/(m·K)、密度ρₛ=1000 kg/m³、比熱容量cₛ=2000 J/(kg
- `supp-expanded-tau-calc` — 集中熱容量モデルを適用できると仮定します。ρ=1000 kg/m³、V=0.001 m³、c=4000 J/(kg·K)
- `supp-expanded-lumped-temp` — 一定hの集中熱容量モデルが成立するとします。初期温度60 ℃、周囲温度20 ℃、時定数τ=2000 sです。t=τ後の温
- `supp-expanded-lumped-double-time` — 集中熱容量モデルで初期温度差θ₀=50 K、時定数τ=100 sとします。t=2τ後、周囲温度との差θは約何Kですか。e
- `supp-transient-gap-bi-fo-roles-v1` — BiとFoの役割として適切な説明はどれか。
- `supp-transient-gap-diffusion-scale-v1` — 固体のα=1.0×10⁻⁶ m²/s、代表長さL=0.010 m。内部拡散の時間尺度t_D=L²/αはどれか。
- `supp-transient-gap-conductivity-time-scales-v1` — 同じ形状・ρc_p・hの固体でkだけを2倍にした。内部拡散尺度L_c²/αと外部尺度ρc_pL_c/hの変化はどれか。

#### 半無限近似（矩形モデルの短時間・厚肉極限、12 件）

- `supp-chapter-ch5-penetration` — 半無限体の温度浸透尺度をδ=2√(αt)で定義します。熱拡散率α=1.0×10⁻⁶ m²/s、時間t=100 sならδは
- `supp-chapter-ch5-time` — 半無限体で一定物性と同じ境界条件の下、温度浸透尺度δ∝√tが成り立つとき、経過時間だけ4倍になればδは何倍ですか。
- `supp-chapter-ch5-surface` — 半無限体の一定表面温度解 T(x,t)=T_i+(T_s−T_i)erfc[x/(2√(αt))] において、表面x=0
- `supp-section-5-6` — 【第5.6節・独立学習ノート】時間を9倍にした場合、√(αt)の尺度は何倍か。
- `supp-applied-5-6-v1` — 初期100℃の半無限固体の表面を20℃に保ちます。x/(2√(αt))=1.0でerfc(1)≈0.1573なら、T=T
- `supp-deep-semi-similarity-v1` — 半無限固体でx=0.010 m、熱拡散率α=1.0×10⁻⁶ m²/s、時刻t=100 sとする。表面を一定温度に保つ解
- `supp-deep-semi-profile-v1` — 半無限固体の初期温度Ti=20.0 ℃、時刻0以降の一定表面温度Ts=80.0 ℃、α=1.0×10⁻⁶ m²/sとする
- `supp-deep-semi-surface-flux-v1` — 半無限固体のTi=20.0 ℃、指定表面温度Ts=80.0 ℃、k=2.0 W/(m·K)、α=1.0×10⁻⁶ m²/
- `supp-deep-semi-energy-integral-v1` — 同じ半無限固体（Ti=20 ℃、Ts=80 ℃、k=2 W/(m·K)、α=1.0×10⁻⁶ m²/s）の表面温度をt=
- `supp-existing-semi-initial-corner-v1` — 半無限固体で初期T(x,0)=T_i（x>0）、時刻0以降の表面T(0,t)=T_s（t>0）、T_s≠T_iという理想
- `supp-existing-semi-model-selection-v1` — 有限厚さの固体を半無限の一定表面温度解で近似したい。適用前の判断として適切なのはどれか。
- `supp-transient-gap-finite-early-boundary-v1` — 厚い固体の表面条件を急に変えた短時間を扱い、温度変化の深さが厚さより十分小さく裏面影響も小さい。候補となるモデルはどれか

### 3.2 円筒・球（半径方向）— 主掲載 3 件

根拠：本文が長い円柱の固有関数・根条件、球の集中近似と線図の定義を直接扱うもののみ。第5章グループ内でも円柱・球の分布系の数値問題はこの3件に限られ、**薄い**。

- `supp-transient-gap-one-term-cylinder-shape-v1` — 長い円柱の半径方向対流冷却で、固有関数と根条件の組合せはどれか。
- `supp-transient-gap-sphere-lumped-length-v1` — 半径R=0.030 mの球が全面で対流する。集中近似のL_c=V/A_s=R/3、h=10 W/(m²·K)、k=5.0
- `supp-transient-gap-chart-radius-definition-v1` — 球の温度応答線図に「Bi=hR/k、Fo=αt/R²」とある。集中近似で使ったL_c=R/3のBiをそのまま入れようとし

- 相互参照（主掲載は 3.4 多層）：定常の円筒壁抵抗は半径方向モデルの定常極限であり、次の3件も関連する：`supp-chapter-ch2-cylinder-resistance`、`supp-chapter-ch2-cylinder-watts`、`supp-roadmap-summary-cylinder-area-v1`。

### 3.3 三角形（2次元三角形要素）— 対応なし

- 全バンクを「三角」で検索しても該当は **0 件**。三角形要素・自由形状の2次元非定常を扱う問題はバンクに存在しない。
- 近接参照（主掲載は 3.1 矩形）：2次元伝導の考え方として `supp-transient-gap-product-center-v1`、`supp-transient-gap-multidim-flux-components-v1`、`supp-transient-gap-multidim-mesh-check-v1` が最も近いが、いずれも矩形前提であり、三角形モデルの関連問題として断定はしない。

### 3.4 多層（同心多層・複合壁・定常抵抗網）— 主掲載 31 件

根拠：guideId = `chapter2-cylindrical-conduction`（第2章：熱抵抗・総括熱伝達係数）と `sim-resistance` を中心に、直列抵抗網・界面温度・接触抵抗・円筒壁・総括熱伝達係数を本文で確認したもの。多層モデルの定常抵抗網（層別半セル抵抗＋接触抵抗の直列）と界面温度の扱いに直接対応する。なお「二層平板＋両側対流」の `supp-resistance-total` が最も直接の対応である。

- `supp-resistance-total` — 共通面積の二層平板と両側対流を直列に扱います。高温側の対流膜0.10 K/W、第1層0.20 K/W、第2層0.50 K
- `supp-resistance-flow` — 直列熱抵抗が合計R=0.85 K/Wで、高温側流体80 ℃、低温側流体20 ℃です。同じ面積を通る定常な熱移動率はいくら
- `supp-audit-resistance-layer-temp-drop` — 一次元定常の直列熱抵抗モデルで、すべての要素を同じ熱移動率80 Wが通ります。このうち一つの固体層の熱抵抗が0.50 K
- `supp-audit-resistance-overall-u` — 共通面積A=2.0 m²の直列熱抵抗モデルで、両側対流を含む全熱抵抗が R_total=0.25 K/W と求まりました
- `supp-audit-resistance-one-layer-doubled` — 一次元定常で、熱が『高温側の対流膜0.10 K/W → 第1固体層0.20 K/W → 第2固体層0.50 K/W → 
- `supp-chapter-ch2-cylinder-resistance` — 長さ1.0 m、内半径0.010 m、外半径0.020 m、熱伝導率2.0 W/(m·K)の円筒壁で、半径方向定常熱伝導
- `supp-chapter-ch2-cylinder-watts` — 円筒壁の熱抵抗が0.050 K/W、内外の表面温度差が10 Kのとき、壁を通る熱移動率の大きさは何Wですか。
- `supp-chapter-ch2-series` — 同じ熱が順に通過する定常系の熱抵抗が0.10、0.20、0.30 K/Wです。両端温度差が12 Kなら全熱移動率の大きさ
- `supp-section-2-3` — 【第2.3節・独立学習ノート】0.2 K/Wと0.3 K/Wを直列につないだ全抵抗は。
- `supp-section-2-4` — 【第2.4節・独立学習ノート】同じ熱交換器で内外のUの数値が異なっても、同じに保たれる量は何か。
- `supp-section-2-5` — 【第2.5節・独立学習ノート】同じQ̇で抵抗Rが2倍なら、その部分の温度降下は何倍か。
- `supp-advanced-ch2-calc` — 一次元定常の直列系で熱抵抗0.05、0.10、0.05 K/W、両端温度差30 Kです。熱移動率と中央の0.10 K/W
- `supp-applied-2-3-v1` — 定常直列系で三つの抵抗が0.02、0.03、0.05 K/W、両端温度差は25 Kです。中央の抵抗0.03 K/Wの温度
- `supp-found-resistor-series-v1` — 温度差60 Kの定常直列経路にR₁=0.10 K/W、R₂=0.20 K/Wがある。熱移動率の大きさは？
- `supp-found-resistor-parallel-v1` — 温度差60 Kで両端を共有する定常並列経路にR₁=0.10 K/W、R₂=0.20 K/Wがある。合計熱移動率の大きさは
- `supp-found-resistor-interface-temperature-v1` — 左100℃、右40℃の定常直列経路で、左から順にR₁=0.10 K/W、R₂=0.20 K/Wがある。二つの抵抗の間の温
- `supp-found-resistor-network-principle-v1` — 線形の定常熱抵抗ネットワークで、同じ両端温度を保ちながら既存の経路に新たな伝熱経路を並列追加した。どの説明が正しいか。
- `supp-next-three-series-v1` — 定常の熱移動経路に0.10、0.20、0.30 K/Wの3抵抗が直列接続されている。両端温度差が60 Kなら熱移動率は？
- `supp-next-parallel-extra-branch-v1` — 温度差60 Kの両端に、熱抵抗0.10 K/Wと0.20 K/Wの経路が並列にある。さらに0.30 K/Wの経路を並列追
- `supp-next-parallel-temperature-condition-v1` — 定常の二つの独立した熱抵抗が同じ高温節点・低温節点を共有して並列に接続される。各枝について何が共通か。
- `supp-batch2-plane-u-v1` — 内側h_i=100、外側h_o=25 W/(m²K)、壁厚L=0.020 m、壁k=2 W/(mK)の平板で総括Uは？
- `supp-batch2-wall-rpp-v1` — 壁厚0.020 m、熱伝導率k=2.0 W/(mK)の平板で、面積当たりの熱抵抗R″は？
- `supp-batch2-tube-ratio-v1` — 円筒内半径r_i=.010 m、外半径r_o=.012 mで同じ管長のU_i/U_oは？
- `supp-batch2-outer-base-u-v1` — 内側基準U_i=100 W/(m²K)、A_i=.50 m²、A_o=1.00 m²の装置でU_oはいくらか。
- `supp-batch2-fouling-loss-v1` — 全抵抗0.050 K/Wへ汚れ抵抗0.010 K/Wを追加した。温度差30 K固定ならQ̇は？
- `supp-batch2-g-times-dt-v1` — 全コンダクタンスUA=40 W/K、代表温度差15 Kの装置の熱移動率Q̇は？
- `supp-batch2-outer-h-decrease-v1` — 配管外側h_oだけが低下した。他の熱抵抗と温度差が不変なら全体のUAはどうなるか。
- `supp-roadmap-summary-contact-jump-v1` — 面積当たり接触抵抗r_c″=0.010 m²·K/W、面積A=0.20 m²、界面を通る一様なQ̇=50 W。接触部の温
- `supp-roadmap-summary-targeted-improvement-v1` — 直列経路の抵抗が0.10、0.30、0.10 K/W。温度差一定のまま中央の抵抗だけを半減するとQ̇_new/Q̇_ol
- `supp-roadmap-summary-temperature-drop-v1` — 同じ定常Q̇=100 Wが通る直列抵抗0.10、0.20、0.05 K/W。入口温度60℃なら、3抵抗を通過した出口温度
- `supp-roadmap-summary-cylinder-area-v1` — 長い円筒壁の内外で対流がある。半径方向一次元モデルで対流抵抗の面積を選ぶ方法はどれか。

- 注記：層ごとの蓄熱まで含む「非定常の多層」そのものの問題はバンクに無い。対応は定常抵抗網と界面温度が中心である。

## 4. フィン（第4章）

### 4.1 直線フィン（対流先端・断熱先端）— 主掲載 12 件

根拠：guideId = `chapter4-fin-design`（第4章補助：フィン効率）で、field（フィン／伝導・フィン設計／熱伝導・フィン）と本文を確認したもの。特に `supp-deep-fin-base-heat-v1` 以下の deep 系4件は、フェイリス側の対流先端・断熱先端モデルの検証正準ケース（k=200、h=25、P=0.04、A_c=1.0×10⁻⁴、L=0.10、ΔT=60）と同一条件であり、対応が特に強い。`supp-deep-fin-convective-tip-v1` は対流先端の境界そのものを扱う。

- `supp-chapter-ch4-fin-m` — 一定断面の直線フィンでh=20 W/(m²·K)、周長P=0.040 m、k=200 W/(m·K)、断面積A_c=0.
- `supp-chapter-ch4-fin-eta` — 先端断熱の一定断面直線フィンでmL=1とします。η_f=tanh(mL)/(mL)とtanh(1)≈0.7616からフィ
- `supp-chapter-ch4-fin-concept` — 同じ材料・断面・h・周囲温度・基部温度で、先端断熱の直線フィンの長さだけ増やしたとき、フィン効率η_fとフィンの総放熱量
- `supp-section-4-5` — 【第4.5節・独立学習ノート】フィン効率が下がっただけで、総放熱量も必ず下がると言えるか。
- `supp-advanced-ch4-calc` — 一定断面・先端断熱の直線フィンでmL=2.0です。tanh(2)≈0.9640としてη_f=tanh(mL)/(mL)を
- `supp-applied-4-5-v1` — 一定断面・断熱先端の直線フィンでmL=1.5、tanh(1.5)≈0.9051です。η_f=tanh(mL)/(mL)か
- `supp-deep-fin-base-heat-v1` — 断熱先端の一定断面フィンで、k=200 W/(m·K)、h=25 W/(m²·K)、P=0.040 m、Ac=1.0×1
- `supp-deep-fin-effectiveness-v1` — 断熱先端フィンの基部放熱量が5.166 W、h=25 W/(m²·K)、基部断面積Ac=1.0×10⁻⁴ m²、基部と流
- `supp-deep-fin-tip-temperature-v1` — 一定断面・先端断熱のフィンで基部温度Tb=80.0 ℃、周囲温度T∞=20.0 ℃、mL=0.70711、cosh(mL
- `supp-deep-fin-convective-tip-v1` — 直線フィンでk=200 W/(m·K)、Ac=1.0×10⁻⁴ m²、m=7.0711 m⁻¹、L=0.100 m、h=
- `supp-existing-fin-contact-loss-v1` — 基部温度一定の理想フィンを、実際は熱抵抗のある接触部を介して温度一定の壁へ取り付けた。壁温をそのままフィン基部温へ代入す
- `supp-existing-fin-lateral-uniformity-v1` — 長手方向一次元の一定断面フィンを使う。断面内の温度差を無視できるか判断する考え方として適切なのはどれか。

### 4.2 環状フィン — 対応なし

- 全バンクを「環状」「円形フィン」で検索しても **0 件**。環状（円環）フィンの η・ε を扱う問題は存在しない。
- 近接参照（主掲載は 4.1）：直線フィンの効率・有効度の基礎として `supp-chapter-ch4-fin-eta`、`supp-deep-fin-effectiveness-v1` が最も近い（環状フィンの大半径極限が直線フィンに帰着することの基礎）。

### 4.3 ヒートシンク — 対応なし（直接）

- 全バンクを「ヒートシンク」で検索しても **0 件**。複数フィン＋基部＋接触部を一体で扱う問題は存在しない。
- 近接参照：基部の接触抵抗については `supp-existing-fin-contact-loss-v1`（主掲載は 4.1）が最も近く、放熱の基礎は 4.1 の直線フィン一式である。ヒートシンク固有の問題として断定できるものはない。

### 4.4 風速→h推定 — 主掲載 9 件

根拠：風速→h モジュールは外部対流の相関式（平板平均 Nu、円柱横流れ Churchill–Bernstein 等）で h を推定する。対応は「相関式を使って流れ条件から h を得る」問題に絞り、guideId = `chapter7-internal-flow` 内の横流れ・相関適用系（field：強制対流）を本文で確認した。相関そのものの計算（平板 0.664 系など）は 5.4 平板境界層に主掲載し、ここでは相互参照とする。

- `supp-geometry-correlation-crossflow-reynolds-v1` — 単独円柱へ軸に垂直な主流U=5.0 m/sが当たる。外径D=0.020 m、ν=1.5×10⁻⁵ m²/s。Re_D=U
- `supp-geometry-correlation-crossflow-area-v1` — 長い等温円柱の外径0.020 m、長さ0.50 m。端面を除く側面の伝熱面積πDL_zはどれか。
- `supp-geometry-correlation-crossflow-heat-v1` — 単独等温円柱で平均Nu_D=42.739、k_f=0.026 W/(m·K)、D=0.020 m、L_z=0.50 m、
- `supp-geometry-correlation-crossflow-property-state-v1` — 表面60℃、主流20℃の横流れで、相関が膜温度評価を指定している。物性評価の基本として適切なのはどれか。
- `supp-geometry-correlation-crossflow-local-average-v1` — 単独円柱の周平均熱伝達率h̄について適切な説明はどれか。
- `supp-geometry-correlation-observed-h-v1` — 他経路を分離済みの対流熱100 W、適切な面積0.20 m²、平均温度差25 K。h_obs=Q̇_conv/(AΔT)
- `supp-geometry-correlation-power-law-sensitivity-v1` — 同じ物性・形状・適用範囲でNu∝Re^0.8が成立する。主流Uの小さい相対変化+5%に対するhの一次相対変化の目安はどれ
- `supp-geometry-correlation-single-point-selection-v1` — 一つの観測h=20に対し相関Aは18、Bは24を返した。選定について適切なのはどれか。
- `supp-geometry-correlation-correlation-complete-conditions-v1` — 相関式の適用を確認する際、必要な情報の組合せはどれか。

- 相互参照（主掲載は 5.4）：`supp-chapter-ch6-nuavg`、`supp-laminar-plate-average-h-v1`、`supp-section-6-9`。

## 5. 強制対流（第6章・第7章）

### 5.1 Graetz（平行平板チャネルの熱発達）— 直接対応なし

- 「Graetz／グレツ」を名指しする問題は **0 件**。平行平板チャネルの熱発達・バルク温度の指数減衰そのものを扱う問題はバンクに無い。
- 近接参照（いずれも他節に主掲載）：非円形ダクトの発達 Nu と境界条件の扱いとして `supp-geometry-correlation-square-h-v1`、`supp-geometry-correlation-duct-thermal-boundary-v1`、`supp-geometry-correlation-duct-dh-not-sufficient-v1`（正方形ダクトの発達層流 Nu_Dh=2.98、周方向境界条件と Nu、D_h だけでは Nu が決まらないこと）。入口・助走の考え方は 5.2 の助走区間4件も近い。

### 5.2 円管・一定壁温（CWT）— 主掲載 14 件＋助走区間 4 件

根拠：guideId = `chapter7-internal-flow`（第7章補助：管内流）で、一定壁温の発達 Nu_D=3.657（問題内では 3.66 と表記）、バルク温度の指数応答（式 (7.57) 型）、NTU の扱いを本文で確認したもの。

- `supp-chapter-ch7-nu-boundary` — 十分に速度・温度場が発達した円管内の層流、物性一定という条件で、壁面温度が一様な場合の代表的なNu_Dはどれですか。
- `supp-chapter-ch7-h` — 等温壁・十分発達した円管層流に対してNu_D=3.66、流体のk_f=0.60 W/(m·K)、円管直径D=0.020 
- `supp-section-7-2` — 【第7.2節・独立学習ノート】十分発達した円管層流で一定壁温と一定熱流束のNuが違うのはなぜか。
- `supp-section-7-4` — 【第7.4節・独立学習ノート】管内で流体温度が20 K上がったときQ̇を求めるために必要な流体情報は何か。
- `supp-applied-7-2-v1` — 円管内の十分発達した層流で壁温一定、Nu_D=3.66とします。流体熱伝導率0.60 W/(m·K)、内径D=0.015
- `supp-batch2-pipe-h-wall-temperature-v1` — 円管の流動・熱的に十分発達した層流、壁温一定、Nu_D=3.66、流体k_f=.60 W/(mK)、内径D=.020 m
- `supp-batch2-local-wall-flux-v1` — 十分発達した壁温一定の円管層流で局所h=109.8 W/(m²K)、局所壁面温度が流体混合平均温度より10 K高い。局所
- `supp-internal-flow-thermal-developed-v1` — 熱的に十分発達した加熱管で、流体混合平均温度T_bについて正しい説明はどれか。
- `supp-internal-flow-surface-ntu-v1` — 一定壁温の一流体加熱でh=50 W/(m²·K)、加熱周長0.20 m、長さ10 m、ṁc_p=100 W/K。NTU=
- `supp-internal-flow-surface-outlet-v1` — 一定壁80℃、流体入口20℃、NTU=1、exp(−1)=0.367879。T_out=T_s−(T_s−T_in)ex
- `supp-internal-flow-surface-energy-rate-v1` — 一流体の一定比熱加熱でC=ṁc_p=100 W/K、入口20℃、出口57.927℃。熱移動率の正の大きさはどれか。
- `supp-internal-flow-surface-inlet-overestimate-v1` — 一定壁温の加熱管で入口温度差だけを使いQ̇=hA_s(T_s−T_in)とした。流体が下流で温まる場合の扱いとして適切な
- `supp-internal-flow-surface-variable-h-integral-v1` — 一定壁温・一流体・一定Cの流路でh=h(x)、加熱周長P_hも既知。指数応答に使うNTUとして適切なのはどれか。
- `supp-internal-flow-surface-capacity-model-v1` — ε=1−exp(−NTU)という一流体・一定壁温の有効度式について適切なのはどれか。

#### 入口・助走区間（CWT／CHF／Graetz 共通、4 件）

- `supp-batch2-hydraulic-entry-length-v1` — 層流円管でRe_D=200、D=.020 mとする。L_h≈0.05 Re_D Dで見積もる水力学的助走長は？
- `supp-batch2-thermal-entry-length-v1` — Re_D=200、Pr=5、D=.020 mの層流円管で、L_t≈0.05 Re_D Pr Dの熱的助走長は？
- `supp-batch2-pipe-entry-judgment-v1` — 円管層流の熱的助走長が約1.0 mと推定され、入口から0.5 mの温度場を調べる。壁温一定の十分発達Nu_D=3.66に
- `supp-internal-flow-entrance-state-v1` — 管長L/D=20、Re=1000、Pr=10の層流円管。目安L_h/D≈0.05Re、L_t/D≈0.05RePrから、

### 5.3 円管・一定熱流束（CHF）— 主掲載 3 件（薄い）

注記：ここでの CHF は動的モデルの呼称「一定熱流束（constant heat flux）」を指し、第9章の沸騰の限界熱流束とは別である。根拠：発達 Nu_D=4.364（問題内では 4.36）と、熱流束一定でのバルク温度の線形変化を本文で確認したもの。

- `supp-advanced-ch7-calc` — 十分に速度・熱的に発達した円管層流の壁面熱流束が一様でNu_D=4.36、k_f=0.60 W/(m·K)、D=0.01
- `supp-batch2-constant-flux-pipe-h-v1` — 十分発達した定物性の円管層流で壁熱流束一定とし、Nu_D≈4.36、k_f=.60 W/(mK)、D=.020 mならh
- `supp-internal-flow-surface-flux-boundary-v1` — 一定比熱の流体へ一様な壁熱流束q_w″を与える定常流路で、加熱周長一定・熱漏れなし。T_b(x)の変化の基本形はどれか。

- 相互参照（主掲載は 5.2）：`supp-section-7-2`、`supp-internal-flow-thermal-developed-v1`（一定壁温と一定熱流束で Nu が違う理由、熱的に発達した条件でのバルク温度）。

### 5.4 平板境界層 — 主掲載 41 件

根拠：guideId = `chapter6-flat-boundary`（第6章補助：平板境界層）を中心に、field（境界層・外部対流／対流・境界層ほか）と本文で選別した。乱流の壁近傍の細部（壁単位・対数則の外挿など）と境界層積分法の細部は、動的モデルの対象（Blasius 受動温度場と相関式）から外れるため候補から外した。

#### 層流・Blasius・局所と平均（28 件）

- `supp-chapter-ch6-nuavg` — 等温平板上の層流近似で、平均ヌセルト数Nū_L≈0.664 Re_L^(1/2)Pr^(1/3)とします。Re_L=1
- `supp-chapter-ch6-have` — 平均Nū_L=66.4、平板長さL=0.50 m、流体熱伝導率k_f=0.025 W/(m·K)のとき平均熱伝達率h̄
- `supp-chapter-ch6-local` — 全長が層流で等温の理想的平板において、末端x=Lの局所熱伝達率h_Lと前縁から全長までの平均熱伝達率h̄の関係はどれです
- `supp-section-6-2` — 【第6.2節・独立学習ノート】一様な外部流速U>0と動粘度ν>0が一定の平板上で、前縁からの距離xを増やすとRe_x=U
- `supp-section-6-5` — 【第6.5節・独立学習ノート】同じRe_LとPrで等温・全域層流なら平均Nuは終端の局所Nuの何倍か。
- `supp-section-6-9` — 【第6.9節・独立学習ノート】平板全長の平均hはどのように求めるか。
- `supp-advanced-ch6-calc` — 全長層流の等温平板でRe_L=4.0×10⁴、Pr=1、流体熱伝導率k_f=0.030 W/(m·K)、L=1.0 mで
- `supp-applied-6-5-v1` — 等温平板上を層流が流れ、Re_L=10,000、Pr=1.0、流体の熱伝導率k_f=0.030 W/(m·K)、平板長さ
- `supp-found-re-flat-v1` — 主流速度U=2.0 m/s、長さL=0.50 m、流体動粘度ν=1.5×10⁻⁵ m²/s。Re_Lは？
- `supp-found-pr-fluid-v1` — 流体動粘度ν=1.5×10⁻⁵ m²/s、流体熱拡散率α_f=2.0×10⁻⁵ m²/s。Prは？
- `supp-found-nu-average-v1` — 平板上の平均h=20 W/(m²·K)、L=0.50 m、流体熱伝導率k_f=0.025 W/(m·K)。平均Nuは？
- `supp-found-nu-fluid-k-v1` — Nu=hL/k_fを評価するとき、k_fとして用いる物性は？
- `supp-next-nusselt-invert-h-v1` — 流体熱伝導率k_f=0.025 W/(m·K)、代表長さL=0.50 m、平均Nu=200。平均熱伝達率hは？
- `supp-next-local-versus-average-v1` — 平板上で局所熱伝達率h_xが流れ方向に変化する。終端x=Lの局所値h_Lと面平均h̄_Lを扱う際の正しい判断は？
- `supp-next-pr-layer-thickness-v1` — 同様の平板・流動条件で、流体のPrが十分大きくなった場合の温度境界層について一般的に適切な傾向は？
- `supp-laminar-velocity-thickness-v1` — 層流平板でx=0.50 m、Re_x=6.667×10⁴、√Re_x≈258.2。δ_99≈5x/√Re_xによる速度境
- `supp-laminar-wall-shear-v1` — 局所C_f,x=0.00257、ρ=1.2 kg/m³、U=2.0 m/s。τ_w=C_f,xρU²/2による壁面せん断
- `supp-laminar-average-drag-v1` — 層流平板の平均摩擦係数C̄_f=0.00514、ρ=1.2 kg/m³、U=2.0 m/s、片面積0.10 m²。摩擦抗
- `supp-laminar-blasius-boundary-v1` — 静止・不透過の平板で一様主流Uを持つBlasius解の条件はどれか。
- `supp-laminar-thickness-definition-v1` — δ_99を速度境界層厚さと呼ぶことの意味はどれか。
- `supp-laminar-energy-wall-gradient-v1` — 壁から流体への+yを正とする。流体k_f=0.025 W/(m·K)、壁面勾配(∂T/∂y)_w=−4000 K/m、T
- `supp-laminar-pr-thickness-scale-v1` — 適用可能な等温平板層流の概略尺度δ_t/δ∼Pr⁻¹/³でPr=8、速度層厚さの目安8.94 mm。比例係数を1とした温
- `supp-laminar-plate-average-h-v1` — 等温層流平板の平均Nū_L=144.414、流体k_f=0.026 W/(m·K)、長さL=0.30 m。h̄_L=N
- `supp-laminar-plate-total-heat-v1` — 一様温度差40 Kの等温板で平均h=12.5 W/(m²·K)、幅0.20 m、長さ0.30 m。片面全熱流Q̇=hWL
- `supp-laminar-plate-local-average-v1` — 等温・前縁から加熱・全域層流の平板で局所Nu係数0.332と平均係数0.664の関係はどれか。
- `supp-laminar-plate-flux-boundary-v1` — 等温平板用のNu_x=0.332 Re_x^(1/2)Pr^(1/3)を、表面熱流束一定の板へ使いたい。適切なのはどれか
- `supp-laminar-plate-unheated-start-v1` — 平板の前半が非加熱で後半だけ等温加熱される。前縁から同時に速度・温度境界層が発達する式を使う際に必要なのはどれか。
- `supp-laminar-plate-practical-scope-v1` — 層流等温平板相関の適用条件を評価する方法として適切なのはどれか。

#### 乱流・遷移・類推（13 件）

- `supp-section-6-6` — 【第6.6節・独立学習ノート】StをNu、Re、Prから求める式は何か。
- `supp-section-6-7` — 【第6.7節・独立学習ノート】乱流の熱輸送を記述するとき平均値だけで十分か。
- `supp-section-6-8` — 【第6.8節・独立学習ノート】乱流相関式でまず確認すべき二つの無次元数は何か。
- `supp-turbulence-colburn-predict-h-v1` — 類推成立を仮定してh=ρc_pU(C_f/2)Pr⁻²/³を使う。ρc_pU=6000 W/(m²·K)、C_f=0.0
- `supp-turbulence-analogy-scope-v1` — 摩擦と熱の類推について正確な説明はどれか。
- `supp-turbulence-reynolds-correlation-v1` — u=ū+u′、v=v̄+v′、変動平均0とする。平均積overbar(uv)は一般にどうなるか。
- `supp-turbulence-eddy-viscosity-meaning-v1` — 渦粘性ν_tについて適切な説明はどれか。
- `supp-turbulence-turbulent-local-average-v1` — 前縁から乱流とする同じ等温平板相関でh_x=Cx⁻¹/⁵。末端h_x(L)=32 W/(m²·K)なら、長さ平均h̄_L
- `supp-turbulence-turbulent-heat-rate-v1` — 平均Nū_L=1362.66、k_f=0.026 W/(m·K)、L=1.0 m、幅0.20 m、一定温度差40 K。
- `supp-turbulence-transition-location-v1` — 一定主流U=15 m/s、ν=1.5×10⁻⁵ m²/s、仮定した遷移Re_c=5.0×10⁵。x_c=Re_cν/Uは
- `supp-turbulence-transition-corrected-nu-v1` — 層流開始の等温板モデル（気体）で0.037 Re_L^0.8=2334.54、Pr^0.6=0.807344、補正C′=
- `supp-turbulence-transition-heat-rate-v1` — 遷移を含む平均Nū_L=1219.15、k_f=0.026 W/(m·K)、L=1.0 m、幅0.20 m、温度差40
- `supp-turbulent-local-powerlaw-v1` — 平板上の乱流境界層で、空気（気体）について Re_x=1.0×10⁶、Pr=0.71 の位置の局所 Nusselt 数 

## 6. 自然対流（第8章）

### 6.1 キャビティ（密閉容器内の自然対流）— 直接対応なし

- 「キャビティ」「閉空間」「密閉（容器）」で検索しても、密閉キャビティ内部の自然対流を扱う問題は **0 件**。バンクの自然対流問題は垂直平板・水平面・円柱・球の外部自然対流と膜状凝縮が中心である。
- 近接参照（主掲載は本節、12 件）：キャビティモデルの前提（Ra の定義と尺度、Boussinesq 近似）そのものに対応する基礎問題。いずれも外部自然対流の文脈で書かれており、キャビティ固有の問題として断定はしない。

- `supp-chapter-ch8-ra` — 自然対流のRa=gβ|ΔT|L³/(να)を使います。g=10 m/s²、β=0.003 K⁻¹、ΔT=10 K、L=0
- `supp-chapter-ch8-length` — 物性、重力、温度差が同一の自然対流で、Ra∝L³が成立するモデルです。代表長さLを2倍にするとRaは何倍になりますか。
- `supp-chapter-ch8-gr-pr` — 自然対流のグラスホフ数Gr=2.0×10⁶、プラントル数Pr=0.70のとき、Ra=GrPrはいくらですか。
- `supp-section-8-2` — 【第8.2節・独立学習ノート】自然対流のGrが温度差のほかに依存する主要な長さの因子は何か。
- `supp-section-8-3` — 【第8.3節・独立学習ノート】物性と温度差を固定しLを2倍にするとRaはいくつに比例して変わるか。
- `supp-advanced-ch8-calc` — 自然対流Ra=gβ|ΔT|L³/(να)で流体物性・重力一定です。代表長さLを2倍、温度差を2倍にするとRaは何倍になり
- `supp-applied-8-3-v1` — 自然対流でg=9.81 m/s²、体膨張係数β=0.003 K⁻¹、|ΔT|=10 K、代表長さL=0.20 m、ν=1
- `supp-natural-rayleigh-v1` — 仮想の一定物性流体でg=10 m/s²、β=0.0040 K⁻¹、|T_s−T∞|=10 K、L=0.10 m、ν=2.
- `supp-buoyancy-film-rayleigh-from-gr-v1` — 同じ定義のGr_L=3.16018×10⁸、Pr=0.727273。Ra_L=Gr_LPrはどれか。
- `supp-buoyancy-film-vertical-ra-v1` — 垂直面の自然対流でgβ|ΔT|L³=0.0809005 m⁴/s²、ν=1.6×10⁻⁵、α_f=2.2×10⁻⁵ m²
- `supp-buoyancy-film-boussinesq-check-v1` — 密度変化を浮力だけへ残す近似を使いたいが、|βΔT|が大きく物性も強く変化する。適切なのはどれか。
- `supp-buoyancy-film-zero-gravity-limit-v1` — 他の条件を固定し、浮力自然対流モデルでg→0の極限を考える。適切な解釈はどれか。

## 7. 放射（第10章）

### 7.1 放射ネットワーク（形態係数・射度・抵抗網）— 主掲載 21 件

根拠：guideId = `chapter10-view-factors`（第10章補助：形態係数と相反則）を中心に、形態係数（相反則・総和則・自己形態係数）、射度 J、表面抵抗・空間抵抗の節点モデルを本文で確認したもの。`supp-gray-two-surface-resistance-v1`（二面囲いの節点モデル）が最も直接の対応である。

- `supp-chapter-ch10-reciprocity` — 2面の形態係数がA₁F₁₂=A₂F₂₁を満たします。A₁=2.0 m²、A₂=4.0 m²、F₁₂=0.60ならF₂₁は
- `supp-chapter-ch10-enclosure` — 閉じた放射囲いで、面1から面2へのF₁₂=0.60、面1は凸面でF₁₁=0、囲いには面1・2・3のみがあるとします。F₁
- `supp-chapter-ch10-concept` — 閉じた凹面の形態係数Fᵢᵢについて、一般的に正しい説明はどれですか。
- `supp-section-10-3` — 【第10.3節・独立学習ノート】二面の面積が違う場合に常に成り立つ関係は何か。
- `supp-section-10-4` — 【第10.4節・独立学習ノート】Jが800、Gが600 W/m²なら面からの正味放射流束は。
- `supp-applied-10-3-v1` — 二つの表面で面積A₁=2 m²、A₂=6 m²、形態係数F₁₂=0.60です。相反則A₁F₁₂=A₂F₂₁からF₂₁はい
- `supp-applied-10-4-v1` — 不透明・灰色・拡散面で放射率ε=0.70、黒体放射出力E_b=1200 W/m²、入射G=400 W/m²です。J=εE
- `supp-batch2-view-reciprocity-v1` — 二面の面積A1=1.0 m²、A2=4.0 m²、形態係数F12=.80である。相反則よりF21は？
- `supp-batch2-blackbody-two-surfaces-v1` — 二つの黒体でA1=1 m²、F12=.80、T1=400K、T2=300K、σ=5.67×10⁻⁸。面1から面2への正味
- `supp-batch2-reverse-f12-v1` — 相反則A1F12=A2F21でA1=2 m²、A2=6 m²、F21=.25ならF12は？
- `supp-batch2-closed-view-sum-v1` — 閉じた三面囲いの凸面1でF11=0、F12=.25である。全ての到達面を含むときF13は？
- `supp-batch2-convex-self-factor-v1` — 拡散放射の形態係数で、凸面の自己形態係数Fiiについて正しい説明は？
- `supp-batch2-grey-surface-limit-v1` — 二つの面が黒体でなく灰色体で、反射があり得る。黒体間のQ̇=σA1F12(T1⁴−T2⁴)をそのまま使う判断は？
- `supp-deep-rad-radiosity-v1` — 不透明・拡散・灰色面（ε=0.80）が400 Kで、外部からの照射量G=459.300 W/m²を受ける。黒体発散度E_
- `supp-deep-rad-totalpower-v1` — 灰色面ε=0.80、面積A=0.50 m²、表面400 K、十分大きな黒体囲い300 Kで、形態係数1・放射率一定とする
- `supp-gray-parallel-flux-v1` — 互いだけを見込む大きな平行灰色面でT_1=400 K、T_2=300 K、ε_1=0.80、ε_2=0.60、σ=5.6
- `supp-gray-two-surface-resistance-v1` — 二面だけの閉じた拡散灰色囲いの節点モデルで、A_1=A_2=0.50 m²、F_12=F_21=0.50、残りは各面自身
- `supp-gray-one-shield-v1` — 大きな平行面の両側を一定温度T_hot>T_coldに保ち、全ての面の放射率を0.50とする。間に同面積・不透明・両面同
- `supp-gray-resistance-driving-potential-v1` — 射度を用いる放射抵抗ネットワークで、表面抵抗(1−ε)/(Aε)の単位はm⁻²である。抵抗の両端に対応する量として適切な
- `supp-gray-open-plates-environment-v1` — 有限な二枚の板を室内に置いた。板同士の形態係数F_12<1で、放射の一部は室内の他の面へ届く。二枚だけの閉囲いの直列式を
- `supp-radiation-net-incoming-sign-v1` — ある表面の射度がJ=500 W/m²、照射量がG=800 W/m²である。表面から外向きを正とし、q″=J−Gと定義する

### 7.2 長ダクト（2次元ダクトの形態係数）— 直接対応なし

- 「ダクト」の放射文脈、「交差弦（crossed-string）法」を扱う問題は **0 件**。長ダクト固有の形態係数問題はバンクに無い。
- 近接参照（主掲載は 7.1）：形態係数の基礎として `supp-chapter-ch10-reciprocity`、`supp-chapter-ch10-enclosure`、`supp-batch2-closed-view-sum-v1`、`supp-batch2-convex-self-factor-v1`。

### 7.3 表面交換（対流＋放射の表面境界）— 主掲載 12 件

根拠：灰色面と大きな黒体囲いの間の正味放射（表面交換の正準ケース）と、対流と放射を連成した表面収支を本文で確認したもの。`supp-next-combined-surface-loss-v1`（対流・放射の連成損失）が最も直接の対応である。guideId は `sim-radiation` と `chapter10-view-factors`、`chapter1-energy-balance` にまたがる。

- `supp-radiation-temperature` — 灰色面の熱放射モデル Q̇=εσA(Tₛ,K⁴−Tsur,K⁴) で、表面温度0 ℃を四乗の計算へ入れるとき、使う絶対温
- `supp-radiation-numeric` — 大きな黒い周囲を見込む灰色面の学習用モデルです。放射率ε=0.5、面積A=1 m²、表面300 K、周囲200 K、σ=
- `supp-audit-radiation-equal-temperatures` — 灰色面と大きな黒い周囲の間の正味熱放射 Q̇=εσA(Tₛ⁴−Tsur⁴) を考えます。表面と周囲がどちらも300 Kで
- `supp-audit-radiation-emissivity-scale` — 灰色面と黒い周囲の正味熱放射を Q̇=εσA(Tₛ⁴−Tsur⁴) で計算します。面積・表面温度400 K・周囲温度30
- `supp-audit-radiation-same-delta-different-level` — 面積と放射率が同じ灰色面・黒い周囲のモデルを比較します。条件Aは表面400 K・周囲300 K、条件Bは表面300 K・
- `supp-advanced-ch10-calc` — 広い黒体周囲300 Kへ向いた面積1 m²の灰色拡散面が400 K、放射率0.80とします。σ=5.67×10⁻⁸ W/
- `supp-deep-rad-netflux-v1` — 温度400 Kの灰色面（ε=0.8、面積に依存しない単位面積流束）が、300 Kの大きな黒体囲いを完全に見込む。σ=5.
- `supp-found-three-mode-radiation-v1` — 放射率0.80の小さな灰色面A=0.50 m²が320 K、十分大きな黒体囲いが300 Kである。σ=5.6703744
- `supp-next-combined-surface-loss-v1` — ある一様面A=0.50 m²が320 K、流体と十分大きな黒体囲いがともに300 Kである。h=10 W/(m²·K)、
- `supp-next-radiation-zero-emissivity-v1` — 灰色面と大きな黒体囲いの放射交換モデルQ̇=εσA(T_s⁴−T_sur⁴)で、放射率εを0に近づけると、このモデルの正
- `supp-roadmap-parallel-surface-v1` — 一様表面から同時に外へ出る対流熱流束200 W/m²、正味放射熱流束150 W/m²。面積0.40 m²、蓄熱なし。この
- `supp-solar-instant-storage-v1` — 一様温度の受光体で、ある瞬間の太陽吸収300 W、外向き対流220 W、外向き熱放射30 W、熱の取り出しなし。熱容量1

## 8. 対応なし・直接対応が薄いモデル（正直な一覧）

| モデル | 状況 | バンク側の事情 |
|---|---|---|
| 三角形（非定常） | 対応なし | 三角形要素・自由形状2Dの問題が0件 |
| 環状フィン | 対応なし | 環状・円形フィンの問題が0件 |
| ヒートシンク | 対応なし（直接） | 複数フィン＋基部の一体問題が0件 |
| Graetz チャネル | 直接対応なし | 熱発達・バルク温度減衰の問題が0件（ダクト発達Nuが近接） |
| 自然対流キャビティ | 直接対応なし | 密閉容器内の自然対流の問題が0件（Ra・Boussinesq基礎のみ近接） |
| 長ダクト放射 | 直接対応なし | 交差弦法・2Dダクト形態係数の問題が0件 |
| 円筒・球（非定常） | 薄い（主掲載3件） | 円柱・球の分布系の数値問題がほぼ無い |
| 円管・一定熱流束 | 薄い（主掲載3件） | 発達Nu 4.364 系の専用問題が少ない |
| 多層（非定常側） | 定常のみ | 層別蓄熱を含む非定常多層の問題が無い（定常抵抗網は31件） |

## 9. 申し送り：各マニュアルの項目15（関連問題）の埋め方

1. **主掲載があるモデル**（矩形、多層、直線フィン、風速h、円管CWT、平板境界層、放射ネットワーク、表面交換）：項目15には本書の主掲載 ID をそのまま使える。全件を載せると長いモデル（矩形 70 件、平板境界層 41 件）は、代表として基礎→応用の順に 8〜12 件を選び、残りは「問題バンクの第X章補助（guideId）から辿れる」と案内する形が適切である。ID はアプリ内検索・問題バンクでそのまま引ける。
2. **相互参照の扱い**：相互参照と明記した ID は、主掲載側のマニュアルを正とし、こちらでは「〜の節も参照」と短く触れるに留める（二重掲載で件数を水増ししない）。
3. **対応なしのモデル**（三角形、環状フィン、ヒートシンク、Graetz、キャビティ、長ダクト）：項目15は空欄や推測で埋めず、**「現行の問題バンク（751問）に対応する問題はない。最も近いのは〜（近接参照のID）である」**と明記するのが、未検証を未検証と書く本アプリの方針に合う。新規問題の追加は問題データ側の別作業（作成・検証・専門家確認の手続きが必要）であり、本棚卸しの範囲では行わない。
4. **薄いモデル**（円筒・球、円管CHF、多層の非定常側）：主掲載の全件を載せたうえで「専用問題は少なく、基礎は〜と共通」と注記する。
5. **半無限近似**は独立モデルではなく矩形モデルの短時間極限として扱われているため、項目15でも矩形マニュアル内の小節として載せる。
6. 本書の ID は全件、生成時点で `data/questions.json` の実在 ID と突合済みである（主掲載 232 件、重複なし）。問題バンクが改訂されたら、本書も再突合が必要である。

---
棚卸しの検証記録：問題総数 751 件＝公表 751 件と一致。主掲載 232 件は全件実在し、モデル間の重複はない（スクリプトで突合）。相互参照 ID も全件実在を確認した。
