# 原稿から完成MP4・承認後アップロードまで

## 実装している経路

`/workflow` で元の下書きを作成 → `/production` で原稿・根拠の外部送信と費用を許可 → OpenAI Responses APIで完成原稿と場面JSONを生成 → 人が台本を確認/編集 → 画像・音声の外部生成費用を許可 → 生成PNG/WAVと字幕をFFmpegでMP4へ合成 → 認証付きプレビューで映像・音声を確認 → 投稿先/公開範囲/タイトル/説明/権利/対象年齢を確認 → 承認 → 別の送信操作 → YouTube resumable upload → APIで公開状態を照合 → 一般公開・処理完了後、既存の計測処理へ登録。

制作対象は1〜6場面、90秒以内の縦型ショート、1080×1920、H.264/AAC、48MiB以下。生成画像・音声・字幕を合成する方式であり、動画生成モデルによる動的な演技・撮影ではない。画像と声の完全な一貫性、事実の正しさ、生成品質や再生数の向上は保証しない。

## 初回セットアップ（ローカル）

Node.js 22.13以上、Python 3.12以上、FFmpeg/ffprobeと日本語フォントが必要。対応ワーカーOSはLinux/macOS（fcntl使用）。WindowsはWSL等を使用する。

```sh
npm ci
python3 -m venv .venv-production
.venv-production/bin/python -m pip install -r workers/production/requirements.txt
# Linux example: sudo apt-get install ffmpeg fonts-noto-cjk
# macOS: FFmpegをインストールし、必要ならPRODUCTION_FONTを設定する。
npm run build
npm run db:migrate
npm run dev
```

`.openai/hosting.json` にD1 `DB` とR2 `PRODUCTION_ASSETS` を設定済み。ローカルではMiniflareの保存領域を使用する。新規SQL `drizzle/0002_production_bridge.sql` を適用すること。既存0000/0001も必要。リモートへの自動適用・デプロイはしない。

サーバーの秘密設定はローカルでは `.dev.vars`、リモートではホスティング側のsecretへ設定する。ワーカー側は `.env` または環境変数を使用する。両ファイルはGitに入れない。

| 設定 | アプリ | ワーカー |
|---|---|---|
| `PRODUCTION_ENABLED=true` | 必須。既定false | 不要 |
| `PRODUCTION_UPLOAD_ENABLED=false` | 送信の全体停止。開始時はfalse | 不要 |
| `PRODUCTION_OWNER_ID` | `/workflow` の利用者ID。ローカルは `local_seedy` | 不要 |
| `PRODUCTION_WORKER_TOKEN` | 32文字以上のランダムsecret | 同じ値 |
| `PRODUCTION_DAILY_JOB_LIMIT=3` | 新規制作要求のUTC日次上限、1〜20 | 不要 |
| `PRODUCTION_APP_URL` | 不要 | `http://127.0.0.1:5173` またはHTTPSのアプリorigin |
| `OPENAI_API_KEY` | 不要 | 必須 |
| `PRODUCTION_TEXT_MODEL` | 不要 | ResponsesのJSON Schemaに対応する利用可能なモデル |
| `PRODUCTION_IMAGE_MODEL` | 不要 | Images APIのPNG/base64出力・1024×1536に対応するGPT Image系モデル |
| `PRODUCTION_TTS_MODEL`, `PRODUCTION_TTS_VOICE` | 不要 | WAV出力に対応する音声モデル・組み込み声 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | 既存読み取り設定 | アップロードOAuthクライアント |
| `GOOGLE_UPLOAD_REFRESH_TOKEN` | 不要 | 下記の別認可で取得 |

サーバーとワーカーでキーを共用する必要はない。モデル名は推測で自動選択せず、利用契約で使用できるものを指定する。API予算の金額上限はプロバイダー側で設定する。日次ジョブ上限は金額の保証ではない。1ジョブは台本1要求、最大6画像・6音声で、失敗済みの要求も消費済みとして扱う。

```sh
# .envにPRODUCTION_PYTHON=.venv-production/bin/pythonとモデル等を設定してから起動
npm run production:worker -- --once  # 1件だけ処理。無ければ終了
npm run production:worker           # 単一プロセスで継続。終了はCtrl+C
```

最初はアップロードを停止したまま、台本生成と完成動画確認までを試す。アプリが起動していない/認証できない場合は実行しない。UIはワーカーの応答時刻と設定状況を示すが、設定済みを実API接続成功と扱わない。

## アップロードの別認可

```sh
npm run youtube:authorize-upload
```

読み取り用 `GOOGLE_REFRESH_TOKEN` は上書きせず、`GOOGLE_UPLOAD_REFRESH_TOKEN` を保存する。スコープは `youtube.upload` と `youtube.readonly`。チャンネルIDが既存設定と違う場合は保存しない。トークンはブラウザーやGitへ出さない。

準備後、アプリ側の `PRODUCTION_UPLOAD_ENABLED=true` を設定する。それだけでは送信しない。完成動画の人による承認と、明示的なアップロード操作が必要。

YouTube APIプロジェクトの審査・制限等で非公開になる場合がある。画面はAPIが返した実際の公開範囲・処理状況を表示し、一般公開と誤表示しない。「送信結果を照合」を押して再確認する。YouTube Studioから公開範囲を変更した場合も同じボタンで照合できる。非公開/処理中は計測に登録しない。

## 承認と中断時の扱い

承認は完成MP4のSHA-256、場面JSON、元の台本版、投稿先、タイトル、説明、公開範囲、子ども向け指定・合成コンテンツ申告に紐付く。24時間で失効し、元の台本や条件が変わった場合も送信不可。台本の確認は完成MP4の公開承認ではない。説明欄へAI生成音声の開示文を必ず付与する。

画像・音声の要求は送信前にローカルのreceiptを永続化する。失敗や応答消失を無条件で再送しない。動画アップロードもセッションURLを永続化し、再開は同じセッションの受信済みバイトを確認して行う。アップロードIDが保存済みなら動画を新規作成せず、そのIDを照合する。

`.production-worker/` は永続ディスクへ保存し、外部に公開しない。アップロードのセッションURLは秘密情報。1ワーカー/1永続ディレクトリを基本とする。ディスクが失われた、初期化応答が不明、セッションが無効の場合は安全側で停止する。自動で新しい投稿を作らない。YouTube Studioで結果を確認する。承認切れの不明アップロードを、そのまま再送する回避経路は設けていない。

取り消しは進行中の外部要求を巻き戻せない。送信済み/送信が不明な動画をアプリ上で「未送信」に戻して消さない。送信中の全体停止は次のチャンク前の再検証で止めるが、既に送ったデータや既に公開された動画を撤回するものではない。

## ホスティング

HTTPワーカー経路は独立したBearer認証で特定の利用者のジョブのみ扱う。任意の利用者ID、外部生成URL、公開コードは受け付けない。ブラウザーの閲覧・承認は従来の本人認証と同一オリジン制限を使う。**本人限定Sitesの前段アクセス制御がワーカーを拒否する環境では、このHTTP経路だけ追加しても接続できない。** アプリの既存認証を解除したり、利用者ヘッダーを公開インターネットから信頼する構成にしてはならない。まずローカルで利用するか、承認されたサービスアクセス経路をホスティング側で用意する。リモートD1/R2、サービスアクセス、secret、常時プロセスの設定は導入作業である。

制作プロファイル（画像モデル・声・合成方式）が違う動画は同一A/B群に混ぜない。声を変えたのに冒頭だけを変えた比較だと扱うことを防ぐ。

## 検証方法

```sh
npm test
npm run typecheck
npm run build
.venv-production/bin/python -m pip install pytest
.venv-production/bin/python -m pytest tests/production -q
```

テストは外部生成/YouTube通信をMockTransportで置換する。FFmpegの回帰テストは合成PNG/WAVから実際のH.264/AAC MP4を書き出して確認する。実生成・課金・実公開を行ったという意味ではない。

公式仕様: OpenAI Responses structured outputs / Images / Audio speech、YouTube Data API resumable upload / videos.insertを使用。将来の変更時は固定エンドポイント・認可・フィールドを再検証する。
