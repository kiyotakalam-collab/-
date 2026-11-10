# 地図マスター v1.13.0 — 初期実装とデータ登録仕様

## 実装範囲と進捗

添付の `history_map_28pages_for_codex.pdf` 全28ページを1920pxで目視確認した。指示書の別名 `world_history_maps_all_28.pdf` と実際の添付名を区別し、原PDFのSHA256を棚卸しに保存した。画像、PDF、教材からトレースした境界はリポジトリや配信物へ入れていない。

- `public/historical_map_inventory.json`：全28ページを確認、389の重複を除いた候補／527のページ別出現を選定。細かな全ラベルを転記した完全抽出ではない。全ページは `status:reviewed, extraction_status:partial`。読めない文字、操作部に隠れる箇所、印刷ページ番号不明は保留。
- 国家・王朝、都市、民族・勢力、移動・戦争、経路、出来事、領域の概況、凡例、不確かな点をページごとに保持。`pdf_page` は1始まり、`textbook_page` は実際に読めた場合のみ番号、不明はnull。本文中の資料参照番号からページ番号を補完しない。
- 抽出候補の史実・当時の所属はC（未検証）のまま。表示用データへのリンクは歴史的所属の証明を意味しない。
- 登録：12都市の座標がA、8政治主体・14時点の領域がB、通常演習12問。経路0、歴史イベントの独立登録0。
- Aの検証範囲は **Natural Earthの名称・所在国・現代都市中心座標**。古代城壁、古代港の正確な位置、当時の政権への所属を検証したものではない。メキシコシティ・西安も現代都市中心と明示し、古代都市の厳密な位置を問わない。
- 領域は作者が不完全性を明示するHistorical Basemapsから取得し、名称・大地域をPDFと照合した概略。境界の独立精査は未完了なので、通常演習に利用しない。領域の1時点を世紀全体へ拡張・補間しない。

初期実装は歴史地図全28枚の完全な再現・史実検証を完了したものではない。経路の描画形式、他の問題形式の受け皿はあるが、未収録の問題が出題できるかのように表示しない。慶應文学部の過去問別頻度は未確認。重要度は全件暫定であり、S判定を捏造していない。

## 出典と配布条件

- **Natural Earth**：Tom Patterson / Nathaniel Vaughn Kelso / contributors。`ne_10m_populated_places_simple.geojson` の名前と `adm0name` の両方で都市を確認し、同名のAlexandriaを区別。原 `ne_id`、名称、国を保存。`ne_110m_land.geojson` は現代の海岸線の概形。座標は経度・緯度順。両ファイルのSHA256を出典に保存。
- 利用条件：https://www.naturalearthdata.com/about/terms-of-use/ — Public domain、商用利用・改変・再配布可と確認。
- **Historical Basemaps**：André Ourednik et al. https://github.com/aourednik/historical-basemaps 。READMEはwork in progressと他資料による照合の必要を明示。GPL-3.0を確認。200・1400・1500・1600・1700年ファイルのNAMEで選択し、同じ政治主体の成分をMultiPolygonにまとめた。座標は編集せず、元属性とファイルSHA256を保存。
- 境界データのGPL全文・著作者・変更内容を `public/map-licenses/` に同梱。将来のアプリ配布でも、このデータのGPL条件・原データへのリンクを維持する。PDFそのものの再配布許諾を得たという意味ではない。
- Wikidata EntityDataの追加照合は取得拒否（HTTP 403）があったため採用していない。取得できなかった座標を推測して補っていない。

## JSON全体

`public/historical-maps.json` の構造：

```json
{
  "schemaVersion": 1,
  "version": 2,
  "updated_at": "2026-11-10T00:00:00.000Z",
  "sources": [],
  "features": [],
  "snapshots": [],
  "events": [],
  "questions": []
}
```

上は構造説明用の空例。実際の更新では既存の行を消さず、固定IDと履歴参照を保持する。配列の要素は `src/historical-maps.ts` の型・検証に従う。

### 出典 sources

`id,title,url,license,reference,checked_at`。URLはhttps。referenceには参照箇所、検証範囲、原データID、原ファイルSHA256等を記録。確認日時はUTC ISO。ライセンス名だけから史実・精度の正しさを保証しない。

### 地理項目 features

`id,entity_id,name_ja,aliases,type,region,historical_period,valid_from,valid_to,geometry,source_ids,source_pdf_page,confidence,verification_status,uncertainty_note,importance,importance_status,importance_evidence,historical_affiliations,version,updated_at`。

- `id`：英数・ハイフン等の固定ID。例 `mp-rome`（地点）、`mt-ottoman-1600`（領域時点）。`entity_id` は同一主体を束ねる。オスマン帝国1500/1600/1700年は同じ `polity-ottoman`。同名の別政権を名前だけで統合しない。
- `type`：city / site / territory / route。
- `geometry`：GeoJSON geometry（FeatureCollection全体ではない）。Point、Polygon、MultiPolygon、LineString、MultiLineString。経度±180、緯度±90。リングは閉じる。1形状30万点まで。Cのみgeometry:null可。
- `valid_from,valid_to`：歴史上の符号付き整数年。前1年=-1、後1年=1、0年なし。天文学的年番号と混同しない。未検証の開始・終期はnull。都市が古代から連続して同じ位置にあったという意味に使わない。現在の初期領域はfrom=toで時点限定。
- `source_pdf_page`：1〜28の配列。PDFと印刷ページを混同しない。外部資料由来の座標・境界をPDFから抽出したと書かない。
- `confidence,verification_status`：A/B/Cを一致させる。B/Cには不確実性の説明を必須とする。A/Bは出典とgeometry必須。Cは表示・出題しない。
- `importance`：S/A/B/C。`importance_status`：provisional/verified。大学別出題頻度の根拠がなければprovisionalとし、根拠にその制限を記録。
- `historical_affiliations`：未照合なら空配列。各登録は `{entity_id,name_ja,valid_from,valid_to,source_ids,verification_status,explanation}`。現代の国名をそのまま過去の所属にしない。
- `source_record` は任意。外部元データの属性・IDなどを保存できる。
- `deleted:true` は出題・表示停止。固定IDを再利用したり、履歴を消したりしない。

同一entity・種類・同一開始/終了時点の二重登録を拒否する。年代順が逆、0年、座標範囲外、参照切れも拒否。

### 時代 snapshots

`id,period_label,reference_year,source_pdf_page,feature_ids,description`。初期は28個。feature_idsに含まれ、年が有効期間内にあり、削除・Cでないgeometryだけを表示する。未登録の時代を勝手に補間しない。スライダーは登録スナップショットを選択する。reference_yearはアプリの選択用代表年であり、PDFにその特定年の地図が掲載されているという意味ではない。棚卸しのreference_year_basis、画面の代表年ラベル、各スナップショットの説明に明記する。

### 歴史事項 events

`id,name_ja,date_or_period,related_feature_ids,route_geometry,explanation,source_ids`。route_geometryはnullまたはLineString/MultiLineString。初期登録なし。将来の関連付け用構造で、現在は独立した歴史イベント演習・イベント一覧のUIは未実装。

### 問題 questions

`id,question_type,question_text,target_feature_ids,option_feature_ids,period,correct_answer,accepted_answers,explanation,difficulty,source_ids,verification_status,version,updated_at,deleted?`。

- 種類：location / territory / period / association / route。
- location/territory/routeは、選択肢のfeature IDを正答とする。2個以上の明示的な選択肢を登録し、正答はtargetにも含める。曖昧な選択肢を自動生成しない。地理の種類・年代が問いに適合し、誤答候補が誤答と確認できることを教材作成側が検証する。
- period/associationでは、選択肢を空にすると登録済みの解答・解説を表示し自己採点できる。初期問題は位置識別12問だけで、他形式の史実検証・実教材動作確認は未実施。
- 通常演習は問題とtarget/optionすべてA、geometryあり、出題停止でないものだけ。periodがあればtargetの開始・終了年が確認済みで、その期間内であることも照合。位置/領域/経路の形状が形式に適合し、選択式の正答が一意であることを確認する。同じ形状の選択肢は除外。B境界を正解に使わない。
- 歴史的な命題の正しさは形式検証だけでは保証できない。出典を読んで問い・正答・誤答候補の妥当性を確認する。

## 更新・履歴保護

起動時・オンライン復帰・手動確認で同じ公開先のJSON2本を取得し、両方の検証後に1トランザクションで保存。どちらかが取得・検証失敗したら保存済み教材を維持。演習中の同期は終了・離脱まで保留し、出題を突然差し替えない。

変更したカタログのversionを上げ、各変更行のversionとupdated_atも更新。棚卸し変更は棚卸し側のversionを上げる。同じバージョンの異なる内容、古い版、既存地理IDの別主体への再割当、既存問題IDの別正答への再利用、既存行の省略削除を拒否。更新後に `npm run validate:maps` を実行する。任意のファイルは `npm run validate:maps -- /tmp/catalog.json /tmp/inventory.json` で読み戻し検証可能。公開前にライセンス、出典、ページ対応、年代、重複、正答の一意性、A/B/Cを確認する。

教材JSON更新はアプリ本体のTypeScript変更不要。GitHub Pagesで新JSONを配信するための既存デプロイは必要。

専用DBは `world-history-map-master` v1、meta/events。既存の文化史・年号・曖昧用語DBには触れない。MapReviewは問題ID、回答ID、UTC日時、正誤、選択地理ID、セッション、任意の地域/年代/その他の混同を保持。閲覧や途中離脱は採点しない。同じ回答IDの二重採点を防ぐ。

復習は `mapProgress()` → 既存 `getProgress()` を再利用し、正答後1/3/7/14/30/60日・誤答後10分。累積誤答を正答でリセットしない。定着度と緊急度も既存の基準を使用。専用復習センターへ反映する。共通の弱点分析・復習カレンダーに地図を統合する処理は今回未実装。

バックアップformat=`world-history-map-master`, schemaVersion=1。教材・棚卸し・回答を含む。復元は追加統合、同じIDの同内容は重複させず、内容競合は全体を取り消す。他エリアのバックアップは受け付けない。地図が未存在だった旧アプリの他エリアDB・バックアップは変更していない。

## 残作業

全候補の独立史料照合、印刷ページ不明箇所・遮蔽箇所の確認、古代都市/港の精密座標と歴史的所属、Aとして使える国境・勢力圏、実際の経路、歴史イベントの関連表示、位置識別以外の実教材問題、慶應の過去問に基づく重要度、Android実機での確認は未完了。

## 検証結果

- `npm test`：173件成功（既存165件＋地図8件）。
- `npm run test:e2e`：55件成功（既存50件＋地図5件）。代表年ラベルの明記後も地図5件を再実行。
- `npm run build`、`npm run validate:maps`、`npm run validate:ambiguous` 成功。新しいライブラリは追加していない。既存のバンドルサイズ警告は継続。
- 紀元前/後・0年拒否・不正座標・閉じていない領域・参照切れ・同一地理主体の時点・A/B/Cの出題制限、履歴再読込、同期失敗、更新、競合時の取消、バックアップ重複防止を検証。
- 既存3領域それぞれに3誤答・2正答を用意し、地図で誤答→正答・復習後も同じイベントが残ることを確認。地図の累積誤答も1回のまま保持。
- 教材0件、完全オフライン再起動、年代比較、資料28ページ、ページ別候補数、360px/393px、画面再読込とブラウザバックを確認。
- [360px画面](../artifacts/maps-360.png) / [393px画面](../artifacts/maps-393.png)。Android実機は未検証。
