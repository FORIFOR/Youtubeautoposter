# 現状監査レポート

監査対象：`Youtubeautoposter` リポジトリ／Growth Studio／関連する「こぐまのポコのおはなし」発信活動  
集計用 `project_id`：`poco-pilot-01`（既存 `production/pilot.json` の固定ID）  
監査実施：2026年9月14日 23:52（日本時間）  
調査範囲：ローカルリポジトリ、設定・運用資料、Sites公開ページ、YouTube公開チャンネル・再生リスト・Studio、note公開プロフィール・記事。  
判定語：確認済み＝実画面または実ファイルで確認、資料記載のみ＝資料にあるが現在画面で未再確認、未確認＝存在・値を確認できない、取得不可＝対象はあるが値を取得できない、未設定＝設定が存在しない、該当なし＝対象外。

## 1. 現状の要約

このプロジェクトで現在、一般公開を実画面で確認できる発信先は、YouTubeチャンネル [こぐまのポコのおはなし](https://www.youtube.com/channel/UCpaMwN2CdCok70qTw-EdonA)（`@poco_ohanashi_jp`）です。チャンネルには日本語のShortsが5本あり、2026年9月14日23:52 JSTの公開チャンネル画面では5本すべてが「0回視聴」と表示されました。4本を収録した公開再生リスト [親子であそぶ こぐまポコの絵本](https://www.youtube.com/playlist?list=PLfr9v9axUGaM) も確認でき、再生リスト自体は「公開」ですが、形クイズの5本目は収録されていません。

発信アカウントはYouTubeのプロジェクト専用チャンネルと、noteの `forifori` アカウントです。YouTubeの5本はYouTube Studioから手動で投稿した記録があり、APIコードは読み取り用です。X、Instagram、TikTok、Threads、GitHubの発信アカウントは確認できません。Growth Studioの公開URL [youtube-growth-studio.forifor.chatgpt.site](https://youtube-growth-studio.forifor.chatgpt.site/) は存在し、Sitesの現行アクセス設定は `custom` です。このアカウントでは閲覧できますが、誰でも閲覧できる公開設定とは確認できません。

Growth Studioは初期表示が架空データのデモです。実データへ切り替えた現在の画面では「YouTube接続を設定すると計測を始められます」「公開動画の統計 未設定」「チャンネルの詳細分析 未設定」「収集履歴はまだありません」「登録した動画 0本」と表示されました。したがって、実動画5本の成果がGrowth Studioへ接続・蓄積されている状態ではありません。ローカルにも `.env` がなく、ローカルD1の実データテーブルは空でした。

noteの [foriforiプロフィール](https://note.com/forifor) は表示でき、フォロワーは0人でした。記事URL [準備いらずの色あそび。親子で指さす3つの問いかけ](https://note.com/forifor/n/n7798c51bdbed) は存在し、YouTube動画2本と再生リストへリンクしていますが、現在の画面には「**あなただけに表示されています**」と表示されます。資料には公開済みと記録されていますが、一般公開済みとは扱いません。記事画面では4スキが表示されましたが、記事が自分だけ表示の状態であるため、外部読者の成果には算入しません。

確認できた外部成果は、YouTubeの公開動画5本と各動画の公開ページ表示「0回視聴」、noteアカウントのフォロワー0人、note記事画面のスキ表示（新規タブでは4、別タブでは2）、広告費0円です。スキ表示はタブ間で差があったため外部成果には算入しません。YouTube Studioでは表示回数、視聴を選んだ割合、エンゲージビュー、平均視聴時間、維持率がまだ取得できず、視聴者に表示されなかったことと視聴されなかったことを分離できません。登録者、サイト訪問、リンククリック、GitHubスター、ダウンロード、利用者、問い合わせ、売上、制作費は確認できません。

## 2. プロジェクト基本情報

| 項目 | 現在確認できる状態 | 目指している状態 | 根拠 | 確認日時 |
| --- | --- | --- | --- | --- |
| 集計用の固定識別子：project_id | `poco-pilot-01` | 6プロジェクト横断で同じIDを使う | `production/pilot.json` | 2026-09-14 23:52 JST |
| 現在の正式な公開名称 | 発信名は「こぐまのポコのおはなし」、管理製品名は「Growth Studio」／Sitesメタデータは「YouTube Growth Studio」 | 発信と管理基盤の名称・役割を統一して説明 | YouTubeチャンネル、公開Sites、`package.json` | 2026-09-14 23:52 JST |
| 旧名称、別名 | `Growth Studio`、`YouTube Growth Studio`、リポジトリ名 `Youtubeautoposter` | 旧Launchloomには依存しない新規プロジェクト | `README.md`、`package.json` | 2026-09-14 23:52 JST |
| リポジトリ名とURL | `Youtubeautoposter`。Git remote未設定のため、GitHub等のURLは未確認 | Git管理された共有リポジトリを持つ | `git remote -v` が空、ローカルパス `/Users/shuhei/Projects/Youtubeautoposter` | 2026-09-14 23:52 JST |
| 製品を一文で説明 | 日本語YouTube動画を公開後に計測・比較し、次作の改善へつなげる管理ワークスペース | 実動画の計測結果を自動収集し、根拠付きで次の制作へ反映 | `README.md`、公開Sites | 2026-09-14 23:52 JST |
| 主な想定利用者 | 日本語の親子向けShortsを制作・運用する本人 | 同様の動画運用者が自分のチャンネルを接続して使う | `README.md`、`production/channel.json` | 2026-09-14 23:52 JST |
| 現在、利用者に最も取ってほしい行動 | 発信側：YouTube動画を視聴。運用側：Growth StudioでYouTubeを接続し、動画を登録 | 視聴、継続視聴、計測、次作の改善 | YouTubeチャンネル説明、公開SitesのCTA | 2026-09-14 23:52 JST |
| 実際に利用できる状態 | YouTubeチャンネル・5本の動画は視聴可能。Growth Studioはこのアカウントで閲覧でき、デモは利用可能。実データ接続・計測は未設定。note記事は自分だけ表示 | 実データの接続、動画登録、15分〜7日計測、比較・下書き生成 | 公開画面、Growth Studio接続設定、`.env`不在 | 2026-09-14 23:52 JST |

## 3. アカウント台帳

| project_id | 媒体 | アカウント表示名 | ハンドルまたは取得可能なアカウントID | プロフィールURL | 種別：個人共用／組織共用／プロジェクト専用 | 共用している他のプロジェクト | 用途 | 運用担当：本人／担当者／AI・自動化ツール／不明 | 投稿方法：手動／公式API／予約投稿ツール／その他 | 使用しているツール・実行場所 | 接続状態 | 公開済み投稿の有無 | 最終投稿日時 | 確認状態 | 根拠 | 確認日時 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| poco-pilot-01 | YouTube | こぐまのポコのおはなし | `@poco_ohanashi_jp` / `UCpaMwN2CdCok70qTw-EdonA` | https://www.youtube.com/channel/UCpaMwN2CdCok70qTw-EdonA | プロジェクト専用 | 未確認 | 親子向け日本語Shortsの公開 | 本人（Studio操作を確認） | 手動（YouTube Studio） | YouTube Studio／Codexブラウザ | Studioログイン・公開確認済み。Growth StudioのAPI接続は未設定 | あり（5本） | 2026-09-14 15:25:44 JST | 確認済み | 公開チャンネル、Studio、`production/publications.json` | 2026-09-14 23:52 JST |
| poco-pilot-01 | note | forifori | `forifor` | https://note.com/forifor | 個人共用／プロジェクト専用性未確認 | 未確認 | 親向け遊び方記事からYouTubeへ誘導 | 本人 | 手動（note編集画面） | note.com／editor.note.com | ログイン状態は確認。記事画面は「あなたにだけ表示されています」 | あり（1記事。ただし一般公開未確認） | 2026-09-14 13:32 JST | アカウント・記事は確認済み、一般公開は未確認 | noteプロフィール・記事実画面、`production/distribution/free-distribution.json` | 2026-09-14 23:52 JST |
| poco-pilot-01 | Instagram | —（アカウント未確認） | — | — | 不明 | 未確認 | 候補調査・投稿原稿の準備のみ | 不明 | その他（原稿のみ） | `production/distribution/free-social-posts.ja.md` | 未確認 | なしを確認できる公開投稿なし | — | 未確認 | `production/distribution/route-comparison-2026-09-14.md` | 2026-09-14 23:52 JST |
| poco-pilot-01 | X | —（アカウント未確認） | — | — | 不明 | 未確認 | 候補調査・投稿原稿の準備のみ | 不明 | その他（原稿のみ） | `production/distribution/free-social-posts.ja.md` | 未確認 | なしを確認できる公開投稿なし | — | 未確認 | 同上 | 2026-09-14 23:52 JST |
| poco-pilot-01 | Threads | —（アカウント未確認） | — | — | 不明 | 未確認 | 次候補の調査のみ | 不明 | その他（候補） | `production/distribution/route-comparison-2026-09-14.md` | 未確認 | なしを確認できる公開投稿なし | — | 未確認 | 同上 | 2026-09-14 23:52 JST |
| poco-pilot-01 | TikTok | —（アカウント未確認） | — | — | 不明 | 未確認 | 推薦導線の候補調査のみ | 不明 | その他（候補） | `production/distribution/free-discovery-plan.ja.md` | 未確認 | なしを確認できる公開投稿なし | — | 未確認 | 同上 | 2026-09-14 23:52 JST |
| poco-pilot-01 | GitHub | —（アカウント未確認） | — | — | 不明 | 未確認 | リポジトリ共有先 | 不明 | — | ローカルGitのみ | 未設定（remoteなし） | なしを確認 | — | 未確認 | `git remote -v`、ローカルパス | 2026-09-14 23:52 JST |

## 4. ホームページ・公開先台帳

| project_id | 公開先の種類 | 名称 | 正確なURL | 公開状態 | アクセスできるか | ページが伝えている価値 | 主要CTAの文言 | CTAの遷移先 | 利用開始までの手順 | 確認できたリンク切れや導線の問題 | 計測ツール | 計測の状態：コードのみ／設定済み／受信確認済み／未確認 | 確認状態 | 根拠 | 確認日時 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| poco-pilot-01 | 製品サイト | Growth Studio | https://youtube-growth-studio.forifor.chatgpt.site/ | Sites稼働中。ただしアクセス設定は`custom` | このアカウントでは可。一般公開は未確認 | YouTube動画を公開・計測・比較し、次作を改善する | 実データ／デモ／自分の動画で始める／接続設定 | 同ページ内の表示切替・タブ・接続設定 | 実データを選択→YouTube接続→計画作成→動画登録→計測 | 初期表示がデモ。実データは接続未設定で0本。一般公開URLとしての匿名アクセス未確認 | ページ内で外部計測ツールは確認できず | 未確認 | 公開URL・Sites状態は確認済み、実データ運用は未設定 | 公開ページAX、Sites `get_site`（access_mode=custom）、`.openai/hosting.json` | 2026-09-14 23:52 JST |
| poco-pilot-01 | 製品利用画面（実データ） | Growth Studio／実データ | https://youtube-growth-studio.forifor.chatgpt.site/ | 画面表示可能 | このアカウントでは可 | 自分のYouTube計測を始める | 接続設定 | 接続設定タブ | Google Cloud API設定→環境変数→読み取り認可→動画登録 | YouTube公開動画の統計・詳細分析がともに「未設定」。収集履歴なし、登録動画0本 | YouTube Data API／Analytics API（画面説明） | 未設定 | 実画面で確認済み | 接続設定タブの「未設定」「収集履歴はまだありません」表示 | 2026-09-14 23:52 JST |
| poco-pilot-01 | YouTubeチャンネル | こぐまのポコのおはなし | https://www.youtube.com/channel/UCpaMwN2CdCok70qTw-EdonA | 公開 | 可 | 親子で指さし・色さがし・音あそびの日本語Shorts | プロフィールリンク「まずは24秒の色あそび」「ほかのあそびも見る」 | v4 Shorts／再生リスト | URLを開いて視聴 | 登録者数は公開画面で取得できず。5本すべて0回視聴表示 | YouTube Studio／Analytics（アプリAPI未接続） | 未確認 | 実画面で確認済み | 公開チャンネルAX、`production/channel.json` | 2026-09-14 23:52 JST |
| poco-pilot-01 | YouTube再生リスト | 親子であそぶ こぐまポコの絵本 | https://www.youtube.com/playlist?list=PLfr9v9axUGaM | 公開、4本、0回視聴表示 | 可 | 色あそび・さがしもの・雨の日の音あそびをまとめる | すべて再生 | v4 Shorts | URLを開いて視聴 | 最新の形クイズv5は未収録 | YouTube表示のみ | 未確認 | 実画面で確認済み | 再生リストAX | 2026-09-14 23:52 JST |
| poco-pilot-01 | YouTube Shorts | あかいのはどっち？｜親子で色あそび・こぐまポコの絵本 #Shorts | https://www.youtube.com/shorts/n-raC3DGh4I | 公開、0回視聴表示 | 可 | 赤いものを探す親子参加 | 視聴 | — | URLを開いて視聴 | Studioの視聴選択・維持率は未取得 | YouTube Studio | 未確認 | 公開画面で確認済み | チャンネル公開一覧、`production/publications.json` | 2026-09-14 23:52 JST |
| poco-pilot-01 | YouTube Shorts | きいろいスカーフはどこ？｜親子でさがしもの・こぐまポコの絵本 #Shorts | https://www.youtube.com/shorts/1vvhk6jtLzE | 公開、0回視聴表示 | 可 | 黄色いスカーフを探す親子参加 | 視聴 | — | URLを開いて視聴 | Studioの視聴選択・維持率は未取得 | YouTube Studio | 未確認 | 公開画面で確認済み | 同上 | 2026-09-14 23:52 JST |
| poco-pilot-01 | YouTube Shorts | あめはどんな音？｜親子で音あそび・こぐまポコの絵本 #Shorts | https://www.youtube.com/shorts/yMyAsOK6doY | 公開、0回視聴表示 | 可 | 雨音をまねする親子参加 | 視聴 | — | URLを開いて視聴 | Studioの視聴選択・維持率は未取得 | YouTube Studio | 未確認 | 公開画面で確認済み | 同上 | 2026-09-14 23:52 JST |
| poco-pilot-01 | YouTube Shorts | あか・きいろ・あお、どっち？｜親子でいろあそび3問・こぐまポコ #Shorts | https://www.youtube.com/shorts/DpgabSBgQgk | 公開、0回視聴表示 | 可 | 3問の色クイズで親子を参加させる | 視聴 | — | URLを開いて視聴 | 再生リストには収録済み | YouTube Studio | 未確認 | 公開画面で確認済み | 同上 | 2026-09-14 23:52 JST |
| poco-pilot-01 | YouTube Shorts | まる・さんかく・しかく、どれかな？｜親子でかたちクイズ・こぐまポコ #Shorts | https://www.youtube.com/shorts/YoSuV1PQjTs | 公開、0回視聴表示 | 可 | 色から形へ題材を広げた親子クイズ | 視聴 | — | — | 再生リストには未収録 | YouTube Studio | 未確認 | 公開画面で確認済み | 同上、`shape-game-publication-2026-09-14T153037+0900.json` | 2026-09-14 23:52 JST |
| poco-pilot-01 | noteプロフィール | forifori | https://note.com/forifor | プロフィール表示可。一般公開の匿名アクセスは未確認 | ログインセッションで可 | 記事一覧とクリエイター情報 | 記事を読む | 記事URL | URLを開く | フォロワー0、記事1件。記事の公開範囲は記事画面で要確認 | note内蔵表示 | 未確認 | プロフィール実画面で確認済み | noteプロフィールAX | 2026-09-14 23:52 JST |
| poco-pilot-01 | note記事 | 準備いらずの色あそび。親子で指さす3つの問いかけ | https://note.com/forifor/n/n7798c51bdbed | URL存在。現在「あなたにだけ表示されています」 | ログインセッションで可。一般読者の可否は未確認 | 道具なしの色あそびを説明し、YouTube v4・v3・再生リストへ誘導 | 埋め込み動画・関連記事を読む | YouTube v4、v3、再生リスト | 記事を開く | 一般公開済みと記録した資料と、現在の自分だけ表示という画面が矛盾 | note表示（PV等は未取得） | 未確認 | 記事存在・内容は確認済み、一般公開は未確認 | note記事AX、`production/distribution/free-distribution.json` | 2026-09-14 23:52 JST |
| poco-pilot-01 | 管理画面 | YouTube Studio | https://studio.youtube.com/channel/UCpaMwN2CdCok70qTw-EdonA/videos/short | 非公開管理画面 | ログインセッションで可 | 公開、字幕、Analytics、プロモーションの管理 | 動画・アナリティクス・字幕 | 各動画の管理画面 | Googleアカウントでログイン | 外部閲覧者向けではない。Analyticsの交通データ不足が継続 | YouTube Analytics | 未確認 | Studio実画面で確認済み | Studioの動画・Analytics画面 | 2026-09-14 23:52 JST |
| poco-pilot-01 | GitHub公開リポジトリ | — | — | URL未設定 | 不可 | — | — | — | Git remoteを設定する必要 | 公開リポジトリなし。ローカルGitのみ | — | 未設定 | 未確認 | `git remote -v` が空 | 2026-09-14 23:52 JST |
| poco-pilot-01 | アプリストア／パッケージ配布 | — | — | 確認できず | 未確認 | — | — | — | 配布先の設定が必要 | npm公開、ダウンロード、アプリストアを確認できず | — | 未確認 | 未確認 | リポジトリ内公開先一覧・設定 | 2026-09-14 23:52 JST |
| poco-pilot-01 | 料金／購入ページ | — | — | 確認できず | 未確認 | — | — | — | — | 料金・決済ページなし | — | 未確認 | 未確認 | 公開Sites・リポジトリ検索 | 2026-09-14 23:52 JST |
| poco-pilot-01 | 問い合わせ先 | noteクリエイターへのお問い合わせ | https://note.com/forifor/message | noteフッターにリンク | リンク表示可（送信は未実施） | クリエイターへの連絡 | クリエイターへのお問い合わせ | noteメッセージ画面 | ログインしてリンクを開く | 製品サイトからの導線ではなく、送信可否・返信は未検証 | note内蔵 | 未確認 | リンク存在を確認 | note記事フッター | 2026-09-14 23:52 JST |

## 5. 発信履歴・運用状況

### 発信履歴（2026年9月13日〜14日。プロジェクト公開開始以降）

| project_id | 媒体 | 発信アカウント | 投稿IDまたは投稿URL | 公開日時 | 活動の種類 | 内容の要約 | 形式：文章／画像／操作デモ／動画／記事など | 使用言語 | 訴求している価値 | 読者に求める行動 | 誘導先URL | UTMなど追跡情報の有無 | 状態：公開済み／予約済み／下書き／公開失敗 | 取得できた反応数値 | 数値の取得日時 | 根拠 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| poco-pilot-01 | YouTube | こぐまのポコのおはなし | https://www.youtube.com/shorts/n-raC3DGh4I | 2026-09-13 17:27:27〜17:28:17 JST（公開窓） | 動画投稿 | 赤いものを探す | 動画 | 日本語 | 親子で色を指さす | 視聴 | — | なし | 公開済み | 公開ページ0回視聴。Analyticsはダッシュ／交通データ不足 | 2026-09-14 23:52 JST | チャンネル公開一覧、`publications.json`、Studio |
| poco-pilot-01 | YouTube | こぐまのポコのおはなし | https://www.youtube.com/shorts/1vvhk6jtLzE | 2026-09-13 17:31:43〜17:32:24 JST（公開窓） | 動画投稿 | 黄色いスカーフを探す | 動画 | 日本語 | 親子でさがしもの | 視聴 | — | なし | 公開済み | 公開ページ0回視聴。Analyticsはダッシュ／交通データ不足 | 2026-09-14 23:52 JST | 同上 |
| poco-pilot-01 | YouTube | こぐまのポコのおはなし | https://www.youtube.com/shorts/yMyAsOK6doY | 2026-09-13 17:35:17〜17:36:04 JST（公開窓） | 動画投稿 | 雨音をまねする | 動画 | 日本語 | 親子で音あそび | 視聴 | — | なし | 公開済み | 公開ページ0回視聴。Analyticsはダッシュ／交通データ不足 | 2026-09-14 23:52 JST | 同上 |
| poco-pilot-01 | YouTube | こぐまのポコのおはなし | https://www.youtube.com/shorts/DpgabSBgQgk | 2026-09-14 00:51:05〜00:51:32 JST（公開窓） | 動画投稿・追加検証 | 3色の親子参加クイズ | 動画 | 日本語 | すぐ参加できる3問の色遊び | 視聴 | https://www.youtube.com/playlist?list=PLfr9v9axUGaM | なし | 公開済み | 公開ページ0回視聴 | 2026-09-14 23:52 JST | チャンネル公開一覧、`color-game-publication-2026-09-14.json` |
| poco-pilot-01 | YouTube | こぐまのポコのおはなし | https://www.youtube.com/shorts/YoSuV1PQjTs | 2026-09-14 15:25:44 JST | 動画投稿・題材検証 | まる・さんかく・しかくのクイズ | 動画 | 日本語 | 色から形へ題材を拡張 | 視聴 | — | なし | 公開済み | 公開ページ0回視聴 | 2026-09-14 23:52 JST | チャンネル公開一覧、`shape-game-publication-2026-09-14T153037+0900.json` |
| poco-pilot-01 | YouTube | こぐまのポコのおはなし | https://www.youtube.com/channel/UCpaMwN2CdCok70qTw-EdonA | 2026-09-14 02:22:56〜02:30:45 JST | プロフィール／導線設定 | 説明文、ホームタブ、v4リンク、再生リスト、紹介動画枠 | プロフィール設定 | 日本語 | 最初に見る動画と再生リストを案内 | v4 Shorts／再生リスト | なし | 公開済み設定 | 新規視聴者増加の実績は未確認 | 2026-09-14 23:52 JST | `production/changes/channel-distribution-2026-09-14.json`、チャンネル実画面 |
| poco-pilot-01 | note | forifori | https://note.com/forifor/n/n7798c51bdbed | 2026-09-14 13:32 JST（note表示） | 記事投稿 | 道具なしの色あそびとYouTube v4・v3・再生リストの紹介 | 記事・埋め込み | 日本語 | 親子の遊び方を説明して動画へ誘導 | YouTube v4、v3、再生リスト | なし | 公開状態未確認（自分だけ表示） | 記事画面のスキ表示は新規タブ4、別タブ2。外部PV・YouTube流入は未取得 | 2026-09-14 23:52 JST | note記事実画面、`free-distribution.json`（資料上は公開済みと記載） |

### 運用状況

- 実際の発信頻度は、YouTube 5本（9月13日3本、9月14日2本）とnote記事1件（ただし現在の公開範囲は未確認）です。X、Instagram、TikTok、Threads、GitHubへの公開投稿は確認できません。
- 発信テーマは、色さがし2系統、さがしもの、音あそび、形クイズです。製品紹介ではなく、親子が画面に答える短い教育・遊び動画が中心です。note記事だけが遊び方の説明と動画への導線を持ちます。
- YouTubeチャンネル説明、紹介動画枠、再生リスト、プロフィールリンクは実画面で確認できました。再生リストは4本で、形クイズは未収録です。
- YouTubeの子ども向け設定によりコメントは無効です。返信・コメント交流の実施は確認できません。note記事にも外部読者との返信実績は確認できません。
- 定期実行は日本時間1時・16時・18時のHeartbeatが設定され、公開後の観測期限を確認します。これはYouTube投稿の自動化ではなく、ブラウザーで観測するタスクです。
- Growth StudioのREADMEは公式APIによる読み取り・定期収集を説明していますが、実際の公開Sitesでは接続未設定、ローカル `.env` も不在、ローカルD1の実データも0件です。YouTubeの投稿自体はAPIではなくStudio手動操作でした。
- 直近の成功はYouTube 5本の公開、チャンネル導線設定、動画字幕・公開状態の確認です。未接続・未取得はGrowth Studioの実データ計測、YouTube Analyticsの有効値、noteの一般公開とPVです。
- 調査期間は公開開始の2026年9月13日から監査時点の9月14日23:52 JST。投稿・公開先は確認できた範囲を全件確認しました。SNS候補はアカウントURLがなく、存在を推測していません。

## 6. 成果の実測値

「公開できたもの」と「外部成果」を分けています。空欄は数値を取得できなかった項目です。YouTubeの0回は公開ページに明示された0で、Analyticsのダッシュとは別に記録しています。

| project_id | 対象種別：アカウント／投稿／サイト／リポジトリ／製品 | 対象IDまたはURL | 指標名 | 値 | 単位 | 対象期間の開始 | 対象期間の終了 | 数値の取得日時 | データ取得元 | 確認状態 | 補足 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| poco-pilot-01 | アカウント | https://www.youtube.com/channel/UCpaMwN2CdCok70qTw-EdonA | 公開済み動画数 | 5 | 本 | 2026-09-13 | 2026-09-14 23:52 JST | 2026-09-14 23:52 JST | YouTube公開チャンネル | 確認済み | 5本すべて公開一覧に表示 |
| poco-pilot-01 | 投稿 | https://www.youtube.com/shorts/n-raC3DGh4I | 累積視聴回数（公開ページ表示） | 0 | 回 | 公開時刻 | 2026-09-14 23:52 JST | 2026-09-14 23:52 JST | YouTube公開チャンネル | 確認済み | 自分で再生していない。外部視聴者のみの値かは除外不能 |
| poco-pilot-01 | 投稿 | https://www.youtube.com/shorts/1vvhk6jtLzE | 累積視聴回数（公開ページ表示） | 0 | 回 | 公開時刻 | 2026-09-14 23:52 JST | 2026-09-14 23:52 JST | YouTube公開チャンネル | 確認済み | 同上 |
| poco-pilot-01 | 投稿 | https://www.youtube.com/shorts/yMyAsOK6doY | 累積視聴回数（公開ページ表示） | 0 | 回 | 公開時刻 | 2026-09-14 23:52 JST | 2026-09-14 23:52 JST | YouTube公開チャンネル | 確認済み | 同上 |
| poco-pilot-01 | 投稿 | https://www.youtube.com/shorts/DpgabSBgQgk | 累積視聴回数（公開ページ表示） | 0 | 回 | 2026-09-14 00:51 JST | 2026-09-14 23:52 JST | 2026-09-14 23:52 JST | YouTube公開チャンネル | 確認済み | 同上 |
| poco-pilot-01 | 投稿 | https://www.youtube.com/shorts/YoSuV1PQjTs | 累積視聴回数（公開ページ表示） | 0 | 回 | 2026-09-14 15:25 JST | 2026-09-14 23:52 JST | 2026-09-14 23:52 JST | YouTube公開チャンネル | 確認済み | 同上 |
| poco-pilot-01 | アカウント | https://www.youtube.com/@poco_ohanashi_jp | 登録者数 |  | 人 | 2026-09-14 | 2026-09-14 23:52 JST | 2026-09-14 23:52 JST | YouTube公開チャンネル | 未取得 | 公開画面に数値が表示されず、0とはしていない |
| poco-pilot-01 | 投稿 | https://www.youtube.com/shorts/n-raC3DGh4I | Shown in feed |  | 回 | 2026-09-13 | 2026-09-14 23:52 JST | 2026-09-14 23:52 JST | YouTube Studio Analytics | 取得不可 | 「レポート表示に必要なトラフィック データが不足しています」 |
| poco-pilot-01 | 投稿 | https://www.youtube.com/shorts/1vvhk6jtLzE | Shown in feed |  | 回 | 2026-09-13 | 2026-09-14 23:52 JST | 2026-09-14 23:52 JST | YouTube Studio Analytics | 取得不可 | 同上 |
| poco-pilot-01 | 投稿 | https://www.youtube.com/shorts/yMyAsOK6doY | Shown in feed |  | 回 | 2026-09-13 | 2026-09-14 23:52 JST | 2026-09-14 23:52 JST | YouTube Studio Analytics | 取得不可 | 同上 |
| poco-pilot-01 | 投稿 | https://www.youtube.com/channel/UCpaMwN2CdCok70qTw-EdonA | 再生リスト数 | 1 | 件 | 2026-09-14 | 2026-09-14 23:52 JST | 2026-09-14 23:52 JST | YouTube公開チャンネル・再生リスト | 確認済み | 4本収録、公開 |
| poco-pilot-01 | 投稿 | https://www.youtube.com/playlist?list=PLfr9v9axUGaM | 再生リスト視聴回数 | 0 | 回 | 公開時刻 | 2026-09-14 23:52 JST | 2026-09-14 23:52 JST | YouTube再生リスト | 確認済み | 画面表示の0。動画視聴数と同一指標ではない |
| poco-pilot-01 | アカウント | https://note.com/forifor | フォロワー数 | 0 | 人 | 2026-09-14 | 2026-09-14 23:52 JST | 2026-09-14 23:52 JST | noteプロフィール | 確認済み | アカウント全体の値。過去増減は未取得 |
| poco-pilot-01 | アカウント | https://note.com/forifor | フォロー数 | 1 | 人 | 2026-09-14 | 2026-09-14 23:52 JST | 2026-09-14 23:52 JST | noteプロフィール | 確認済み | 成果ではなくアカウント状態 |
| poco-pilot-01 | 投稿 | https://note.com/forifor/n/n7798c51bdbed | 記事画面のスキ数 | 4（別タブでは2） | スキ | 2026-09-14 13:32 JST | 2026-09-14 23:52 JST | 2026-09-14 23:52 JST | note記事画面 | 取得値に表示差あり（外部成果には未算入） | 記事画面は「あなたにだけ表示」。一般読者の反応とは確認できない |
| poco-pilot-01 | 投稿 | https://note.com/forifor/n/n7798c51bdbed | 記事PV／表示数 |  | 回 | 2026-09-14 13:32 JST | 2026-09-14 23:52 JST | 2026-09-14 23:52 JST | note | 未取得 | PVとスキを推測で置き換えていない |
| poco-pilot-01 | サイト | https://youtube-growth-studio.forifor.chatgpt.site/ | Sites本番URL | 確認 | — | 2026-09-14 | 2026-09-14 23:52 JST | 2026-09-14 23:52 JST | Sites get_site／公開ページ | 確認済み | access_modeはcustom、一般公開とは確認できない |
| poco-pilot-01 | 製品 | https://youtube-growth-studio.forifor.chatgpt.site/ | 実データ登録動画数 | 0 | 本 | 2026-09-14 | 2026-09-14 23:52 JST | 2026-09-14 23:52 JST | Growth Studio実データ画面 | 確認済み | 現在のアカウント範囲。実動画5本の登録結果ではない |
| poco-pilot-01 | 製品 | https://youtube-growth-studio.forifor.chatgpt.site/ | 収集履歴 | 0 | 件 | 2026-09-14 | 2026-09-14 23:52 JST | 2026-09-14 23:52 JST | Growth Studio接続設定画面 | 確認済み | 「収集履歴はまだありません」 |
| poco-pilot-01 | 製品 | https://youtube-growth-studio.forifor.chatgpt.site/ | YouTube Data API接続 | 未設定 | — | 2026-09-14 | 2026-09-14 23:52 JST | 2026-09-14 23:52 JST | Growth Studio接続設定画面、`.env`不在 | 確認済み | 接続コードの存在と接続済みは別状態 |
| poco-pilot-01 | 製品 | https://youtube-growth-studio.forifor.chatgpt.site/ | YouTube Analytics API接続 | 未設定 | — | 2026-09-14 | 2026-09-14 23:52 JST | 2026-09-14 23:52 JST | 同上 | 確認済み | 同上 |
| poco-pilot-01 | 製品 | https://youtube-growth-studio.forifor.chatgpt.site/ | デモ登録動画数 | 8 | 本 | デモ表示 | デモ表示 | 2026-09-14 23:52 JST | Growth Studioデモ画面 | 確認済み（成果から除外） | 架空の8本。実績ではない |
| poco-pilot-01 | リポジトリ | ローカル `/Users/shuhei/Projects/Youtubeautoposter` | GitHubスター |  | 個 | 2026-09-14 | 2026-09-14 23:52 JST | 2026-09-14 23:52 JST | git remote／ローカル確認 | 未確認 | remoteがなく、公開リポジトリURLを確認できない |
| poco-pilot-01 | 製品 | https://youtube-growth-studio.forifor.chatgpt.site/ | ダウンロード／登録／アクティブ利用者 |  | 件／人 | 2026-09-14 | 2026-09-14 23:52 JST | 2026-09-14 23:52 JST | 公開Sites・リポジトリ | 未確認 | 公開ダウンロードや登録導線を確認できない |
| poco-pilot-01 | 製品 | https://youtube-growth-studio.forifor.chatgpt.site/ | 問い合わせ／商談／有料利用者／売上 |  | 件／人／円 | 2026-09-14 | 2026-09-14 23:52 JST | 2026-09-14 23:52 JST | 公開ページ・資料 | 未確認 | 問い合わせ送信・決済は実行していない |
| poco-pilot-01 | 製品 | — | 広告費 | 0 | 円 | 2026-09-13 | 2026-09-14 23:52 JST | 2026-09-14 23:52 JST | `production/distribution/promotion-pilot-01.json`、広告未配信記録 | 確認済み | 広告キャンペーンは作成・開始していない |
| poco-pilot-01 | 製品 | — | 制作費・ツール費 |  | 円 | 2026-09-13 | 2026-09-14 23:52 JST | 2026-09-14 23:52 JST | 経費記録なし | 未確認 | 無料／有料を推測しない |

数値の制限：YouTubeの公開ページは監査時の累積表示値であり、昨日までの直近7日・30日の増減履歴ではありません。YouTube Analyticsは有効な交通データがなく、noteは記事PVを取得していません。自分によるページ閲覧を除外した外部ユーザー数は取得できません。Growth Studioのデモ値は架空データとして成果に含めていません。

## 7. 発信から成果までの導線

| 段階 | 存在するか | 利用可能か | 計測されているか | 実測値 | 状態の判定 | 根拠 |
| --- | --- | --- | --- | --- | --- | --- |
| YouTubeアカウント | あり | 公開チャンネルを閲覧可能 | チャンネル登録者・外部流入は未取得 | 動画5本、各0回視聴表示 | 公開している | YouTubeチャンネル実画面 |
| YouTube投稿 | あり | 5本を視聴可能 | Studioの表示・視聴選択・維持率は欠測 | 5本公開、各0回視聴表示 | 発信しているが、視聴の質は計測できていない | チャンネル実画面、Studio Analytics |
| YouTube内導線 | あり | プロフィールリンク・再生リストを閲覧可能 | クリック元・後続視聴は未計測 | 再生リスト1件、4本収録、0回視聴表示 | 導線はあるが効果未確認 | チャンネル・再生リスト実画面 |
| noteアカウント | あり | プロフィールをログインセッションで閲覧可能 | フォロワー0、過去増減・PV未取得 | 0フォロワー、1フォロー | アカウントはあるが到達規模は小さい | noteプロフィール |
| note記事 | URL・本文あり | 現在の画面では本人のみ表示 | PV・外部流入未計測 | 画面上4スキ | 公開範囲が未確認で、一般読者への導線とは断定不可 | note記事の「あなたにだけ表示されています」表示 |
| note→YouTube | 埋め込み・リンクあり | ログインセッションではリンク可能 | UTM・記事からのYouTube流入未計測 | — | 誘導先は存在するが成果不明 | note記事実画面 |
| Growth Studioサイト | あり | このアカウントでは閲覧可能 | 外部訪問・CTAクリック未確認 | — | Siteはあるが一般公開・利用状況不明 | Sites get_site、公開ページ |
| Growth Studio→YouTube接続 | 画面・コードあり | 現在は未設定 | 受信確認なし | 登録動画0、収集履歴0 | 利用開始前で導線が停止 | 実データ画面、`.env`不在 |
| Growth Studio→比較・下書き | デモではあり | 実データでは比較計画・動画0本 | 実データ計測なし | デモ8本は架空値 | 実データの利用・継続は未確認 | 公開Sitesデモ／実データ画面 |
| GitHub→利用 | URL・アカウント未確認 | 利用不可 | 計測なし | — | 公開していない／公開先未設定 | `git remote -v` |

## 8. 未確認事項と取得方法

| 未確認事項 | 現在の理由 | 最小限の取得方法 | 今回実施しなかった理由 |
| --- | --- | --- | --- |
| note記事の一般公開可否 | ログイン中の画面に「あなたにだけ表示されています」と表示 | ログアウト済みの別ブラウザーまたはシークレット相当で記事URLを開き、同じ表示を確認 | 新規ログイン・設定変更を避け、読み取り監査に限定したため |
| YouTube登録者数 | 公開チャンネル画面に数値が表示されなかった | YouTube Studioのチャンネル分析で現在値を確認 | Studioの必要画面を開く追加操作は今回の範囲外 |
| ShortsのShown in feed／視聴選択率／維持率 | Studioが交通データ不足・処理中を表示 | 公開後72時間・7日後の観測窓で各動画のAnalyticsを再確認 | 欠測を0に置き換えない方針のため待機 |
| YouTube Analytics APIの受信 | Growth Studio画面・`.env`とも未設定 | APIキー・OAuthを読み取り専用で設定し、対象チャンネルで認可して収集を1回実行 | 認証・設定変更は今回禁止されているため |
| Growth Studioの匿名公開可否 | Sites access_modeがcustom | 未ログイン・別アカウントで公開URLを開く | アクセス権を変更せず、現在の設定を確認するだけにしたため |
| Sitesの訪問者・CTAクリック | 外部計測ツールが見えず、管理画面にも値なし | Sites側の受信ログまたはアクセス解析を確認 | 計測設定変更を行わない方針のため |
| noteのPV・流入元 | 記事画面でPVが表示されず、ダッシュボード未確認 | noteの本人ダッシュボードで表示数・PV・流入元を確認 | 追加の編集・公開操作を避けたため |
| Instagram／X／Threads／TikTokアカウント | アカウントURL・投稿実績なし | 本人が使うアカウントURLを提示し、各公開プロフィールを確認 | 存在を推測しない方針のため |
| GitHub公開リポジトリ | Git remoteなし | リポジトリURLまたはremoteを確認 | remote設定は変更しない方針のため |
| ダウンロード、登録、利用者、問い合わせ、売上、制作費 | 公開ページと資料に実測値なし | 各サービスの管理画面、請求・問い合わせ記録を照合 | 外部サービスへの登録・送信・課金確認を行わないため |

## 9. 優先して解消すべき問題、最大3件

1. **note記事の公開範囲を確定する。** 資料は公開済みですが、現在の実画面は「あなたにだけ表示されています」。一般読者の導線として扱う前に、ログアウト状態でURLを確認する必要があります。
2. **Growth Studioの実データ接続状態を確定する。** 公開Sitesと読み取りAPIコードは存在しますが、現在の接続画面はData API・Analytics APIとも未設定、登録動画0、収集履歴なしです。コードの存在を運用接続済みと扱えません。
3. **YouTubeの視聴実績と流入を取得できる状態にする。** 5本は公開されていますが、公開一覧の0回以外に表示機会・視聴選択・維持率が取得できません。現時点で内容の良し悪しやSNS施策の効果を判断できません。72時間・7日後のStudio観測、または読み取り専用API接続が必要です。

## 調査で作成したファイル

- [accounts.csv](accounts.csv)
- [assets.csv](assets.csv)
- [activities.csv](activities.csv)
- [metrics.csv](metrics.csv)
- [最新YouTube 24時間観測](production/observations/analytics-24h-initial3-2026-09-14T180334+0900.json)
- [Growth Studioの運用監視資料](production/MONITORING.ja.md)
