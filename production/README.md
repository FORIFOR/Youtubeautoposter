# ポコの初回公開と次作検証

完了条件は、何本か実動画を公開し、公開後の反響を分析して、根拠のある変更を次の動画へ反映することです。2026年9月13日に初期3本と追加検証1本を一般公開し、初期値を記録しました。24時間・72時間の観測と実測に基づく修正はまだ完了していません。題材違いの形クイズは公開前レビュー中です。

ユーザーの確認後、[こぐまのポコのおはなし](https://www.youtube.com/channel/UCpaMwN2CdCok70qTw-EdonA)／`@poco_ohanashi_jp` を作成しました。紹介文とポコのプロフィール画像も公開済みです。[チャンネル記録](channel.json)、[プロフィール画像](assets/poco-channel-avatar.png)、[画像生成プロンプト](prompts/channel-avatar.json)を保存しています。画像は組み込みの image_gen で制作しました。

## 公開した動画

- [いろさがし](https://www.youtube.com/shorts/n-raC3DGh4I)
- [スカーフはどこ？](https://www.youtube.com/shorts/1vvhk6jtLzE)
- [あめのひのおと](https://www.youtube.com/shorts/yMyAsOK6doY)
- [いろあそび3問](https://www.youtube.com/shorts/DpgabSBgQgk)

4本とも子ども向け・日本語・教育カテゴリで公開し、字幕ファイルも追加しました。YouTubeの著作権チェック完了画面と、コンテンツ一覧の公開状態を確認済みです。[公開記録](publications.json)で完成ファイルのハッシュと動画IDを関連付けています。YouTube側の秒単位の公開日時は未取得のため、操作時刻と成功確認時刻の範囲を保存しています。

9月13日17時37分（日本時間）のStudio表示は3本とも視聴回数0でした。これは公開から数分の初期値です。[初期観測](observations/baseline-2026-09-13.json)に実際の出典と表示値を保存しています。視聴維持率などはまだデータがありません。

[観測手順](MONITORING.ja.md)に沿って、同じタスクで毎日18時（日本時間）に確認する定期実行を設定しました。主要な確認は9月14日と16日です。MacとCodexアプリが実行でき、YouTubeのログインが有効な必要があります。今回はStudio画面から記録し、API連携を必要とする管理画面のDBにはまだ取り込んでいません。

## 完成ファイル

| 動画 | 尺 | MP4 |
| --- | --- | --- |
| いろさがし | 30.3秒 | [poco-01-colors.mp4](renders/poco-01-colors/r1/poco-01-colors.mp4) |
| スカーフは どこ？ | 31.2秒 | [poco-02-scarf.mp4](renders/poco-02-scarf/r1/poco-02-scarf.mp4) |
| あめのひの おと | 34.3秒 | [poco-03-rain.mp4](renders/poco-03-rain/r1/poco-03-rain.mp4) |
| いろあそび3問 | 24.2秒 | [poco-04-color-game.mp4](renders/poco-04-color-game/r2/poco-04-color-game.mp4) |

1080×1920、30fps、H.264/AAC。日本語ナレーションと字幕、問いかけの待ち時間を含みます。絵本の場面にゆっくりズームする形式です。公開済み4本の品質監査は `analysis/video-quality-audit-2026-09-14.md` に記録しています。

## 次作のレビュー

形クイズ `poco-05-shape-game` は、冒頭から形の3択を表示し、約29秒で3問を出します。公開前の動画と技術レビューは `analysis/topic-validation-plan-2026-09-14.md` と `analysis/poco-05-shape-game-review-2026-09-14.json` に保存しています。公開済み4本の自然流入データが不足しているため、動画IDはまだありません。

各出力フォルダーにタイトル、説明、SRT字幕、音声、タイムライン、ハッシュ付き制作記録があります。投稿用の3本とタイトル・説明・字幕をまとめたファイルは [poco-pilot-01-upload.zip](renders/poco-pilot-01-upload.zip) です。大きな出力と音声ランタイムはGit管理外ですが、このワークスペースに保存しています。

## 制作方法と素材

- `episodes/*.json`：読み上げ、日本語字幕、場面指定、間、投稿用メタデータ。子ども向けとして制作しています。
- `assets/*.png`：組み込みの **image_gen** で生成した原寸画像。各画像は2×2の4場面です。
- [prompts/image-prompts.json](prompts/image-prompts.json)：使用した全プロンプト。画像生成CLIは使用していません。
- `scripts/produce_video.py`：VOICEVOXで音声合成し、FFmpegで場面の選択・字幕の合成・MP4化。Pillowは文字を置く透明画像だけに使用しています。
- [pilot.json](pilot.json)：実投稿と実測を含む進捗。架空の値で進捗を埋めません。
- [qa.json](qa.json)：今回の完成ファイルの確認記録。

音声は **VOICEVOX:四国めたん**。動画内と説明欄にクレジットを入れています。[VOICEVOX利用規約](https://voicevox.hiroshiba.jp/term/)と[四国めたん音声利用規約](https://zunko.jp/con_ongen_kiyaku.html)を確認して制作しました。

## このMacで再制作

現在のワークスペースには、Python環境と必要な音声ランタイムを準備済みです。

```sh
.venv-production/bin/python scripts/produce_video.py production/episodes/poco-01-colors.json production/episodes/poco-02-scarf.json production/episodes/poco-03-rain.json
```

同じ入力・画像・完成ファイルのハッシュが一致する場合は出力を再利用します。台本や画像を変えるときは、JSONの `revision` を増やして再実行します。レンダラーの処理自体を変更した場合も、既存出力を再利用しないようリビジョンを増やしてください。

新しいApple Silicon Macでは、FFmpeg、Python、日本語フォントに加え、次の環境を準備します。

```sh
python3 -m venv .venv-production
.venv-production/bin/pip install -r production/requirements-macos-arm64.txt
mkdir -p .tools/voicevox
curl -fL https://github.com/VOICEVOX/voicevox_core/releases/download/0.17.0/download-osx-arm64 -o .tools/voicevox/download-osx-arm64
```

ダウンローダーのSHA-256が `caf0f9381a6de4add44a70c1c1b2e5482d553348173d110e53b4940945d4bd9b` と一致することを確認し、実行します。表示される利用条件を確認してください。

```sh
chmod +x .tools/voicevox/download-osx-arm64
.tools/voicevox/download-osx-arm64 --only onnxruntime models dict --models-pattern 0.vvm --output .tools/voicevox/runtime
```

今回の実行環境はVOICEVOX Core 0.17.0、VOICEVOX ONNX Runtime 1.17.3、音声モデル0.16.4の `0.vvm`、Open JTalk辞書1.11.1です。ダウンローダーが後日に取得するモデル版は変わり得ます。LinuxやIntel Macへの移植はまだ確認していません。

## 公開後の一周

1. 投稿先を確定して3本を公開し、動画ID・公開日時・チャンネル・公開状態を実際に確認する。
2. 完成動画ハッシュと実動画IDを結び付けて、同じ経過時間の24時間・72時間の観測を残す。
3. 再生数・高評価・取得可能な視聴時間や視聴率を確認する。取得できない指標は欠測のまま残す。
4. 内容の違う3本だけで原因を断定せず、実測に基づく仮説を一つ選ぶ。例は冒頭の短縮、字幕量、問いかけ後の間など。
5. 選んだ変更、根拠の観測、期待する変化を記録して4本目を制作する。

現在の管理画面のA/B比較は各案4本を必要とします。今回の3本は探索として別に分析し、その判定条件を満たしたように表示しません。常時稼働のAPI収集サーバーは未設定です。今回の定期確認はこのMacとブラウザーを使います。
