# ChatGPT用：世界史・曖昧用語マスター教材登録仕様（schemaVersion 1）

## 運用と担当

編集対象は **`public/ambiguous-terms.json` だけ**。本番初期値は用語・グループ・問題とも0件。別チャットの案やこの文書の架空例を、そのまま本番へ登録しない。

ChatGPTが用語選定、事実・出典の確認、重複照合、比較値・問題・正答・解説・誤答根拠を作る。アプリは登録された内容を表示・採点する。問題や歴史的関係は自動生成しない。大学別の出題頻度など未確認の根拠を作らない。

GitHubへの反映には接続先リポジトリのContents書き込み権限が必要。追加・更新するJSONを作成し、下記検証・読み戻しを行ってPR経由でmainに反映する。外部サービスの認証情報や秘密鍵は不要。Google Sheetsからの自動転送は本機能には含まれない。

アプリは起動時・オンライン復帰時・設定の手動同期で以下を読む。JSONだけの変更で教材を追加でき、利用者のアプリ操作・ソース変更は不要。

`https://raw.githubusercontent.com/kiyotakalam-collab/-/main/public/ambiguous-terms.json`

演習中の同期は終了・離脱まで保留。不正なJSON・通信失敗では保存済み教材を保持する。学習履歴はこの公開JSONに書かず、端末の専用DBにだけ保存する。

## 全体と共通フィールド

ルート：`schemaVersion:1`、`version`（正の整数）、`updatedAt`（UTC ISO文字列）、`terms:[]`、`groups:[]`、`cards:[]`。

各行にも `id`、`version`、`updatedAt`、`deleted`、`verification`、`sources` が必須。

- 日時例：`2026-11-10T00:00:00.000Z`。ミリ秒とZを含むUTC形式。
- 固定ID：英数字から始まり、英数字・`_ . : -`のみ、最大160文字。推奨は用語`at-...`、グループ`ag-...`、問題`ac-...`。全種類を通して重複させない。表示名や配列の順番からIDを作り直さない。
- `verification`：`verified`（確認済み）、`provisional`（暫定）、`needs-review`（要確認）。識別問題と誤答選択肢の根拠は`verified`必須。
- `sources`：`[{"title":"資料名","url":"https://...","note":"確認箇所"}]`。titleは必須、urlとnoteは任意。公開する行には最低1出典。URLは実在するHTTP(S)のみ。出典・ページ・確認実績を捏造しない。
- `deleted:true` は出題停止。行を削除・省略しただけでは端末の既存行は消えない。履歴は停止後も保持する。
- 1ファイルの用語・グループは各10,000件まで、問題30,000件まで。1グループは2〜100用語。一般の文字列は6,000文字以内。

## 用語 `terms`

`name`：正式名称。`aliases:[]`：別表記。`date`：登録精度の年号・期間・年代文字列（不明なら空文字）。`region`、`era`、`field`、`description`、`relatedEvents:[]`（説明用の出来事名リスト）。

分野名は自由入力（条約、戦争、事件、改革、人物、王朝、制度、宗教、文化など）。年代を数値へ推測変換しない。

重複照合では正式名・別表記をNFKC正規化し、空白等を除き、同じ年代・地域の同名用語を検出する。完全に同一の用語には既存IDを再利用する。同名だが年代・地域が違う別の用語は登録できるが、ChatGPT側でも文脈・出典を確認する。

## 混同グループ `groups`

- `name`、`termIds:[]`：既存の用語IDを2件以上。1用語を複数グループで使うときも、termsの行は増やさず同じIDを参照する。
- `causes:[]`：次の完全一致文字列から1つ以上。「名称類似」「同一戦争・同一事件」「同一国家」「年代近接」「同一地域」「内容・役割類似」「因果関係・前後関係」「その他」。
- `registrationReason`：登録理由。空文字も可。「間違えた」「曖昧だった」と記入しても回答履歴には変換されない。
- `essentialPoint`：最重要識別ポイント。`orderingNotes`：必要な前後関係の説明（なければ空文字）。`description`：説明。
- `comparison:[]`：可変の比較行。各行 `{key,label,values}`。keyはグループ内一意、valuesは用語ID→登録値。項目はグループごとに自由（当事国、背景、結果など）。欠落・空値は「未登録」と表示し、補完しない。グループ外のIDは不可。
- `relationships:[]`：確認済みの方向を明示した `{fromId,toId,type,description,sources,verification}`。typeは`before`（前後関係）、`causes`（原因・結果）、`related`（関連）。両端はグループ内の異なるID。年代順と因果関係を混同せず、根拠がなければ空配列にする。アプリは登録方向の矢印だけを表示する。

グループ内の用語が出題停止になると、そのグループと問題は表示対象から外れる。停止する際は、必要に応じてグループ・カードにも明示的にdeletedを設定する。

## 問題 `cards`

共通：`kind`、`groupId`、`termIds`、`prompt`、`answer`、`explanation`、`optionTermIds:[]`、`optionLabels:{}`、`correctTermId`、`distractors:[]`。

全ての問題は1つのグループに所属する。termIdsと選択肢は同じグループ内の用語ID。問題文・正答・解説は日本語で、1つの明確な問いにする。グループ・形式・問題文が同じ重複問題は拒否する。

|kind|termIds|採点・追加条件|
|---|---|---|
|`recall`|1用語|解答表示後の○×自己採点。optionTermIdsとdistractorsは空配列、correctTermIdはnull。|
|`identify`|正答1用語|2〜4個の明示的なoptionTermIdsから選択。correctTermIdはtermIds[0]と一致し、選択肢に含む。問題の検証状態はverified。|
|`compare`|2用語以上|事前登録した比較問題の解答を表示して○×自己採点。選択肢は空配列、correctTermIdはnull。|

識別問題では正答以外の **全選択肢** に `distractors:[{termId,explanation,sources,verification:"verified"}]` を設定し、その条件で誤答になる理由と根拠を確認する。多義的な設問や、別の選択肢も正解になる問題は登録しない。2用語しかない場合は2択にする。アプリは他グループや未検証の用語で水増ししない。

optionLabelsは任意（省略時は空オブジェクト）。選択肢の表示名だけを明示的に変えたい場合、`{"用語ID":"表示ラベル"}` とする。通常は正式名称を表示し、年号・地域等のヒントを自動追加しない。同名選択肢は識別可能なラベルを明示するか、比較演習へ変更する。ラベルにも正しい根拠を用いる。

## 完全な架空サンプル（本番へコピー禁止）

次のJSONは構造検証用で、実際の歴史知識ではない。空で公開済みの教材に、この例を登録しない。

```json
{
  "schemaVersion": 1,
  "version": 2,
  "updatedAt": "2026-11-10T00:00:00.000Z",
  "terms": [
    {
      "id": "at-sample-a", "version": 1, "updatedAt": "2026-11-10T00:00:00.000Z", "deleted": false,
      "verification": "verified", "sources": [{"title": "架空テスト専用資料"}],
      "name": "架空用語A", "aliases": ["架空別名A"], "date": "9000", "region": "架空地域", "era": "架空時代", "field": "架空分野",
      "description": "テスト専用の架空用語。", "relatedEvents": []
    },
    {
      "id": "at-sample-b", "version": 1, "updatedAt": "2026-11-10T00:00:00.000Z", "deleted": false,
      "verification": "verified", "sources": [{"title": "架空テスト専用資料"}],
      "name": "架空用語B", "aliases": [], "date": "9001", "region": "架空地域", "era": "架空時代", "field": "架空分野",
      "description": "もう1つのテスト専用用語。", "relatedEvents": []
    }
  ],
  "groups": [
    {
      "id": "ag-sample", "version": 1, "updatedAt": "2026-11-10T00:00:00.000Z", "deleted": false,
      "verification": "verified", "sources": [{"title": "架空テスト専用資料"}],
      "name": "架空用語の区別", "termIds": ["at-sample-a", "at-sample-b"], "causes": ["名称類似"],
      "registrationReason": "架空の登録理由。演習結果ではない。", "essentialPoint": "架空の条件Xの違い。", "orderingNotes": "", "description": "構造検証専用の比較。",
      "comparison": [{"key": "condition", "label": "架空の条件X", "values": {"at-sample-a": "一致", "at-sample-b": "不一致"}}],
      "relationships": []
    }
  ],
  "cards": [
    {
      "id": "ac-sample-recall", "version": 1, "updatedAt": "2026-11-10T00:00:00.000Z", "deleted": false,
      "verification": "verified", "sources": [{"title": "架空テスト専用資料"}],
      "kind": "recall", "groupId": "ag-sample", "termIds": ["at-sample-a"],
      "prompt": "架空の条件Xを満たす用語は？", "answer": "架空用語A", "explanation": "架空資料で確認する条件。",
      "optionTermIds": [], "optionLabels": {}, "correctTermId": null, "distractors": []
    },
    {
      "id": "ac-sample-identify", "version": 1, "updatedAt": "2026-11-10T00:00:00.000Z", "deleted": false,
      "verification": "verified", "sources": [{"title": "架空テスト専用資料"}],
      "kind": "identify", "groupId": "ag-sample", "termIds": ["at-sample-a"],
      "prompt": "架空の条件Xに一致するものを選べ。", "answer": "架空用語A", "explanation": "架空用語Aだけが条件Xに一致する。",
      "optionTermIds": ["at-sample-a", "at-sample-b"], "optionLabels": {}, "correctTermId": "at-sample-a",
      "distractors": [{"termId": "at-sample-b", "explanation": "架空用語Bは条件Xに一致しない。", "sources": [{"title": "架空テスト専用資料"}], "verification": "verified"}]
    },
    {
      "id": "ac-sample-compare", "version": 1, "updatedAt": "2026-11-10T00:00:00.000Z", "deleted": false,
      "verification": "verified", "sources": [{"title": "架空テスト専用資料"}],
      "kind": "compare", "groupId": "ag-sample", "termIds": ["at-sample-a", "at-sample-b"],
      "prompt": "架空用語AとBの条件Xの違いは？", "answer": "Aは一致し、Bは一致しない。", "explanation": "事前登録の比較値を確認する。",
      "optionTermIds": [], "optionLabels": {}, "correctTermId": null, "distractors": []
    }
  ]
}
```

## 追加・更新・停止とバージョン

1. 現在のmainのJSONを取得する。正式名・別表記・年代・地域と出典を照合し、既存用語なら同じIDを使う。
2. 完全な公開スナップショットとして追記・修正する。ルートversionを現在値より1以上増やしupdatedAtを更新する。新しい行はversion 1。既存の行を変えたら、その行のversionも増やしてupdatedAtを更新する。
3. 同じ教材versionで違う内容、同じ行versionで違う内容、行versionの巻き戻しは拒否される。古い教材全体は既存データを巻き戻さない。
4. 用語の説明・出典、グループの比較項目、問題の表記や解説は固定IDを保って修正できる。**問題のkind・groupId・termIds（順番を含む）・correctTermId・選択肢のID集合は変更しない。** 別の知識を問う場合や選択肢を増減する場合は新しい問題IDを作り、古い問題をdeleted:trueにする。旧履歴を正しく解釈するための制約。
5. 停止する行は削除せずdeleted:trueにする。参照先の用語・グループの行もファイル内に残す。グループのメンバーを外す場合、その用語を参照する問題も停止または新IDで置き換える。

## 読み戻し・公開前チェック

Node.js 24で、リポジトリの依存関係をインストール済みなら以下で検証できる。

```sh
npm run validate:ambiguous
# 追加前のJSONとの更新互換性も確認する場合
npm run validate:ambiguous -- public/ambiguous-terms.json /tmp/previous-ambiguous.json
npm test -- tests/ambiguous.test.ts
npm run build
```

固定ID重複、表記揺れによる重複候補、参照切れ、グループ外の選択肢、未検証の誤答根拠、比較項目の不正なキーなどは検証エラーになる。整合性検証は史実の正しさを保証しない。ChatGPTは出典の内容、問いの一意性、比較値、関係の方向を別に確認する。

公開前に、架空データ・未指定の約35グループを混入させていないこと、既存教材やID・学習履歴を変更していないことを確認する。PRのCI成功後にmainへ反映する。

反映後はraw URLのJSONを読み戻し、version・用語数・グループ数・問題数と固定IDを照合する。保存した読み戻しJSONも `npm run validate:ambiguous -- /tmp/readback.json` で検証できる。アプリの設定「曖昧用語教材を確認」を実行し、件数・一覧・比較表・各形式の出題対象数を確認する。再同期しても履歴が増えないこと、既存回答の累積誤答が残ることを確認する。教材に対応問題がなければ、その演習は0件のままになる。

## 保存・復習・定着度

専用DB：`world-history-ambiguous-terms` v1、meta/events。専用バックアップformat：`world-history-ambiguous-terms`、schemaVersion 1。復元はIDで追加統合し、内容競合では全体を取り消す。文化史・年号のJSONバックアップは受け付けない。

正答後の間隔は1・3・7・14・30・60日、誤答後は10分。回答ID・問題ID・グループID・用語ID・形式・選択・正誤・UTC日時・セッションIDを実際の採点時だけ保存する。累積正誤・連続正答・次回期限は履歴から算出する。復習期限・直近の誤答・連続正答を優先し、累積誤答は上限付きの補助加点。

問題単位の定着度：未回答は未学習。期限到来、直近誤答、直近3回で2回以上誤答、または30日以上未回答かつ連続正答3未満は要復習。残りで連続正答3以上・直近3回正答・最終回答から30日未満なら安定、それ以外は定着途中。

用語の単独定着度はrecallだけ、グループの識別定着度はidentify/compareだけを集計する。対象問題なし・全問未学習なら未学習。1問でも要復習なら要復習。全ての対象問題が安定の場合だけ安定、それ以外は定着途中。単独用語の正答で比較問題の誤答を打ち消さない。

将来の統合カレンダー用に `ambiguousSchedule(catalog, events)` は問題ID・グループID・用語ID・形式・nextReviewAtを返す。今回、既存カレンダーの集計は変更しない。
