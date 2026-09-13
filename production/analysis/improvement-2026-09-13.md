# 初期分析と実施した改善

2026年9月13日。対象は「こぐまのポコのおはなし」の初回3本。ユーザーの「分析して見てもらえるようにしてください」を受け、公開設定の改善まで実施した。

## 現在の判断

20:04 JSTのYouTube Studioコンテンツ一覧で、3本とも公開中、表示視聴回数は0。20:02〜20:04の各動画のリーチとエンゲージメントには、流入データ不足・数値ダッシュ・維持率未到着の表示があった。スカーフのエンゲージメントは一度エラーになり、開き直すと他の2本と同じ未到着表示になった。

したがって、現時点では「表示されていない」「冒頭でスワイプされた」「途中で離脱された」のどれが原因かは判別できない。新規チャンネルで公開約2.5時間という短い観測であり、視聴者に受けなかったという結論にはしない。

制作物の監査では、対象者と遊びの内容をタイトルでさらに具体化できること、色探しの自己紹介を短縮できること、他の話への一覧がなかったことを確認した。これらを、効果未確認の改善仮説として実施・準備した。

## 一般公開へ反映した変更

| 動画 | 更新後タイトル | 意図 |
| --- | --- | --- |
| 色探し | あかいのはどっち？｜親子で色あそび・こぐまポコの絵本 #Shorts | 問いかけに加えて、親子で色を選ぶ遊びと分かるようにする |
| スカーフ | きいろいスカーフはどこ？｜親子でさがしもの・こぐまポコの絵本 #Shorts | 探す対象と参加する楽しさを明確にする |
| 雨の日 | あめはどんな音？｜親子で音あそび・こぐまポコの絵本 #Shorts | 雨の音をことばでまねする内容を伝える |

各説明の冒頭にも親子で楽しむ内容と参加方法を追加した。AI生成・オリジナル作品・VOICEVOXのクレジットを維持した。20:07〜20:08 JSTに保存し、3本すべてで保存完了、公開チャンネルで新タイトルを確認した。

[公開再生リスト「親子であそぶ こぐまポコの絵本」](https://www.youtube.com/playlist?list=PLfr9v9axUGaM)を作成し、公開の一覧ページで3本の収録を確認した。これにより、チャンネルの再生リストから他のお話を探せる。

検索需要の数値を調査した結果のキーワード選定ではない。内容に忠実な対象・遊びの明示である。タイトル・説明・再生リストを同時に変更しているため、どの要素が効果を生んだかを切り分ける試験でもない。

## 専用サムネイル（21時台に公開反映済み）

大きなキャラクターと短い問いかけで内容が分かる3枚を、組み込みの `image_gen` で生成した。生成後、実際の動画との対応、文字、りんごとバナナの色、スカーフの位置、雨の日の道具を目視確認した。元の生成画像も残している。

- [色探しサムネイル](/Users/shuhei/Projects/Youtubeautoposter/production/assets/thumbnails/poco-01-colors-v1.png)
- [スカーフのサムネイル](/Users/shuhei/Projects/Youtubeautoposter/production/assets/thumbnails/poco-02-scarf-v1.png)
- [雨の日のサムネイル](/Users/shuhei/Projects/Youtubeautoposter/production/assets/thumbnails/poco-03-rain-v1.png)
- [使用した生成指示・参照画像・保存先の全記録](/Users/shuhei/Projects/Youtubeautoposter/production/prompts/thumbnails-v1.json)

20時台の操作ではYouTubeの電話番号確認が必要だったが、ユーザーが確認を完了。9月13日21:35〜21:37 JSTに3枚すべてをアップロード・保存し、公開チャンネルの一覧で画像とタイトルの対応を目視確認した。[適用時刻と検証の記録](/Users/shuhei/Projects/Youtubeautoposter/production/changes/thumbnails-2026-09-13.json)を追加している。サムネイルの適用による反響の変化はまだ未評価。関連動画リンクは子ども向け動画で無効のため未設定。

## 冒頭を短くした実動画の試作

[27秒の色探し試作MP4](/Users/shuhei/Projects/Youtubeautoposter/production/renders/poco-01-colors/r2/poco-01-colors.mp4)を制作した。変更は自己紹介の1区間の省略だけ。最初の答えは10.733秒から7.467秒へ早まった。2秒の回答待ち、素材、画面構成、語り手は維持した。

1080×1920のH.264/AAC、27.021秒。全編のデコード、変更後の問いと答えの代表フレーム、音量（-18.16 LUFS、true peak -1.95 dBTP）を確認した。全編の音声を聴覚で聴き通した確認は未実施。視聴者維持率がまだないため、効果を検証する候補として保存し、未公開のままとしている。

## 次の観測と判断

9月14日18時と16日18時の観測を続ける。フィード表示、視聴を継続した割合、流入元、平均視聴時間、取得可能な維持率を別々に記録する。

- 表示機会が少ない場合：露出とデータ反映の問題を残し、台本の失敗とは判断しない。
- 表示されるが視聴につながらない場合：冒頭の絵や問いかけを優先して検討する。
- 視聴はされるが途中で離れる場合：該当箇所と台本を照合して、短縮版の採用などを決める。

小さな母数や別々の流入元を一括比較しない。時刻を揃えた指標にも、今回の設定変更前後の期間が混ざることを明示する。詳細データが不足する場合は7日後まで追加観測する。

YouTube公式は、ショートの視聴選択、平均視聴時間、平均再生率などを評価信号として説明し、タイトルと冒頭が内容への期待を伝えることを勧めている。この説明を今回の仮説と観測設計に使った。[ショートの発見](https://support.google.com/youtube/answer/11914225?co=YOUTUBE._YTVideoType%3Dshorts&hl=en-GB)、[内容の見せ方と冒頭](https://support.google.com/youtube/answer/16559650?hl=en)、[指標の定義](https://support.google.com/youtube/answer/12220281?co=GENIE.Platform%3DDesktop&hl=en)

根拠は [変更前の表示値](/Users/shuhei/Projects/Youtubeautoposter/production/observations/pre-packaging-2026-09-13.json)、[分析画面の実観測](/Users/shuhei/Projects/Youtubeautoposter/production/observations/analytics-audit-2026-09-13.json)、[設定変更の履歴](/Users/shuhei/Projects/Youtubeautoposter/production/changes/packaging-2026-09-13.json)、[試作の検証記録](/Users/shuhei/Projects/Youtubeautoposter/production/analysis/shorter-intro-prototype.json)に保存した。成果・分析・修正版までのプロジェクト全体は継続中。
