# 文化史 v1.8.0 実装・検証報告

## 実装

- 識別演習：既存教材の3〜5組を対応させる。全回答後の採点だけを専用履歴に保存し、変更・途中離脱・関連図の閲覧では記録しない。二重採点はUIとDBの両方で防止。混同回数は通常カードの誤答と独立。
- 今日のおすすめ：期限到来10・直近の苦手6・未学習4を目標に不足分を補充。最大20枚でID重複なし。同じ日のプランを保存し、通常演習で解いた推薦カードもユニーク数で完了扱い。混同履歴の加点は上限付き。通常の出題・採点・画像表示を再利用。
- 関連図：検索した項目から1ホップ、操作時だけ2ホップ。12ノードから最大20ノードまで展開。方向・説明・出典付きの図と一覧、詳細、既存問題・比較演習への導線を用意。
- 文化史の下部メニューは5項目を維持。新画面はホームと用語詳細から入り、ブラウザバック・再読み込みに対応する。

## 関係データ

`public/culture-relations.json`は教材カタログと独立したv1。関係68件・比較セット13組（各3対応）。全て既存の固定ID・説明・問題文・出典と照合し、各関係のsources.noteに根拠の知識ID／カードIDを記録。全件provisionalとして表示する。元の出典はユーザー提供の『スタンダード世界史探究』西洋／東洋文化史など、既存教材に記録された資料。

中国の著者・作品・儒学思想、イスラームの文学・建築・暦、ギリシア哲学、欧州の哲学・美術・建築を収録。欧州文学・科学者の著作／学説、イスラーム学術著作の多くは独立した知識IDがないため未収録。同時代という理由で影響関係や師弟関係を推測していない。

## データ保護

統合教材は公開v20・有効771項目／912カード。既存seed・catalog-delta.json・カードID・知識IDを変更していない。年号のコード・JSON・DBも変更していない。

文化史DB `cultural-history-master` をv2→v3へ移行し、`meta`・`events`を保持して`comparisonEvents`を追加。日次プランと関係キャッシュはmetaに別キーで保存する。通常のReviewEventを書き換えない。旧バックアップschema1を受け入れ、新schema2には通常履歴・比較履歴・関係キャッシュを含める。復元は追加統合し、同じIDの内容競合では全トランザクションを取り消す。関係IDの意味・参照先を入れ替える更新は拒否する。

関係取得の失敗・不正ファイルでは保存済みキャッシュを保持する。オフラインは保存済み教材／関係で学習可能。演習中は同期を保留し、学習セットを途中で差し替えない。

## 検証

`npm ci`成功、`npm test`13ファイル125件成功、`npm run build`成功。既存の出題方向切替と同一解答の分散を取り込んで回帰試験を維持した。外部ライブラリ追加なし。既存教材同梱による500KB超チャンク警告は継続（gzip約119KB）。

Playwrightは34シナリオ。ローカルで33件一括成功後、通信失敗の試験1件で模擬503がService Workerの保存対象にも適用される問題を修正し、該当試験を成功確認した。最終の一括結果はPRのGitHub Actions Checksを正本とする。試験の削除・無効化や公開ゲートの緩和はしていない。

重要シナリオ：旧DB v2で3誤答・2正答の5イベント→移行→比較演習→日次演習→関連図→ブラウザプロファイル終了／再起動→同期→schema2書き出し→別DB復元。元の5ID・誤答3・正答2を保持し、新規比較履歴を別に保存、年号DBのスナップショットも不変。旧schema1・再復元・競合時ロールバックも検証した。

Android相当360／393pxとデスクトップ、キーボード、0件・通信失敗・オフライン・PWA更新をブラウザ試験で検証する。実Android端末固有のインストール・保存許可／容量・ファイル操作は未検証。教材の史実は既存出典との照合であり、専門家による全件レビューではない。

スクリーンショット：[今日のおすすめ](../artifacts/features-daily-mobile.png)・[識別演習](../artifacts/comparison-mobile.png)・[関連図](../artifacts/graph-mobile.png)。

## 変更ファイル

- 既存：README.md、package.json、package-lock.json、src/main.ts、src/core.ts、src/db.ts、src/types.ts。
- 新規データ：public/culture-relations.json。
- 新規ロジック：src/culture-feature-types.ts、culture-relations.ts、culture-compare.ts、culture-daily.ts、culture-graph.ts。
- 新規UI：src/culture-compare-ui.ts、culture-graph-ui.ts、culture-features.css。
- 新規テスト：tests/culture-relations.test.ts、culture-compare.test.ts、culture-daily.test.ts、culture-graph.test.ts、feature-db.test.ts、culture-feature-fixtures.ts、culture-features.e2e.ts。
- 本報告と上記3スクリーンショット。
