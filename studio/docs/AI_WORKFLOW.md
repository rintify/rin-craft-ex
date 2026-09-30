# AIによる制作と検証

FOLDはブラウザ内で動作する静的エディタです。外部AIサービスやAPIキーは内蔵せず、操作APIとファイル仕様を公開しています。対応するAIはWebMCPで直接操作でき、それ以外はJSONファイルやCLIで同じモデルを生成・検査できます。

## 再現可能な生成

`studio/`で実行します。

```sh
npm ci
npm run example:gundam
npm run craft -- inspect ../outputs/gundam-head/model.fold.json
npm run craft -- export ../outputs/gundam-head/model.fold.json ../outputs/my-export
npm run dev
```

生成コードは`examples/gundam-head.ts`。寸法、部品の配置、切り開き線を保存しているため、手順を会話履歴に頼らず再実行できます。エディタの「メニュー → サンプル・その他 → サンプル：ガンダム頭部」から最新版を読み込めます。読み込みも1回のUndoで戻せます。

`export`は編集可能な`model.fold.json`、形状のみのOBJ、各ページのSVG、印刷用HTML、同梱ZIP、検査結果`inspection.json`、PDF生成にも使う`net.json`を書き出します。検査にエラーがある場合は正常終了せず、印刷物を書き出しません。警告は実際の部品を確認して判断してください。

## WebMCP

ページが公開するツールを列挙してから呼び出します。登録名の実行時サフィックスはブラウザが付けるため固定しないでください。

| ツール                 | 用途                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `get_craft_project`    | 完全なプロジェクトJSON、寸法、部品ごとのページ、展開検査、Undo状態を取得              |
| `load_craft_project`   | `{project: ...}`で全体を読み込む。`{example: "gundam-head"}`も可。1操作としてUndo可能 |
| `apply_craft_edit`     | 名前付きの一括編集。途中で不正な操作があれば何も適用しない                            |
| `add_craft_shapes`     | 基本形状1〜8個を1回の操作として追加                                                   |
| `undo_redo_craft_edit` | `{direction: "undo"}`または`"redo"`                                                   |

編集後は検査結果を確認し、画面でも正面・側面・展開図を確認してください。エラーがゼロでも、薄い部品、接着順序、部品同士の干渉は別途確認が必要です。

## ファイル仕様

機械向け仕様は`public/project.schema.json`と`public/edit.schema.json`。元定義は`src/core/schema.ts`で、`npm run schema`により生成します。構文以外の座標、面、容量、微小辺の整合性は`validateProject`が検査します。

- 単位はmm。Xが左右、Yが上、+Zが正面。回転は度数。頂点はオブジェクトのローカル座標です。
- 面は外向きの頂点順序で指定します。凸で平面の多角形、または三角形を使用してください。
- 閉じた部品では各辺を逆方向に2つの面が共有します。接する位置が同じでも頂点番号が異なると開いた辺になります。
- `seams`は`"objectId:小さい頂点番号-大きい頂点番号"`。自動展開に任せ、切り開く位置が不都合な箇所だけ調整します。
- `meshBuilder.prism`で閉じた柱体、`mirrored`で左右部品を作れます。
- 面は無色。素材・テクスチャー・のりしろ・接着番号のデータは不要です。
- `settings.microEdgeLength`の初期値は1mm。実寸で短辺が2本以上ある三角形は拒否されます。短辺が1本の三角形が連続する曲面では、内部線を省いて接続を優先します。
- 40オブジェクト、合計1,200面、各4,000頂点、読み込み5MBまで。

一括編集の例:

```json
{
  "label": "あごの位置と印刷倍率を調整",
  "operations": [
    { "type": "transform", "id": "P03", "position": [0, 1, 0] },
    { "type": "settings", "settings": { "scale": 90 } }
  ]
}
```

`put`で任意メッシュをIDにより追加・置換、`remove`で削除、`transform`で位置・回転・倍率、`settings`で用紙設定、`rename`でプロジェクト名、`seams`で切り開き線を設定できます。メッシュ置換時はその部品の古い切り開き線を消すので、必要なら後続の`seams`操作で再指定してください。

編集JSONは画面の「ファイルを開く」でも適用できます。CLIは入力を上書きせず別の出力先を指定します。

```sh
npm run craft -- apply source.fold.json changes.edit.json result.fold.json
```

## 印刷と検証

- ブラウザの「展開図の保存 → PDFを作成」で全ページを実寸PDFにし、生成されたリンクから保存します。印刷ダイアログは自動で開きません。PDFを印刷するときは「実際のサイズ / 100%」、適切な用紙サイズを選び、20mmの確認線を定規で測ってください。
- `scripts/print_pdf.py`はエディタと共通のSVGページから実寸PDFを生成します。Pythonの`reportlab`と日本語TrueTypeフォントが必要です。第1引数は出力データのフォルダ、第2引数はPDF、第3引数はフォントです。
- 自動検査: 辺の向き、開いた辺、面の重複・欠落、紙面の境界、分割目印の対、辺長の保存。
- 大きな1面も実寸を維持して分割されます。`net.json`の`islands`が論理上の部品、`sheets`がクリップ済みページです。面積・辺長の検査は`islands`で行い、ページ上の重複は紙の重ね部分として扱います。

## ガンダムサンプル

無色の14部品・92面。目も独立した立体で作成しています。合計寸法130×126×72mm、A4で3枚です。`inspection.json`で各部品が載るページを参照できます。展開図画面の「部品へ移動」でも該当ページを開けます。

形状参考: [GUNDAM.INFO / RX-78-2 Ver.2.0](https://en.gundam-official.com/feature/rg/rx-78-2_ver2/)。非公式のファン制作で、公式の形状データや展開図を流用していません。
