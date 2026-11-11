# 通史誤答マスター：Google Sheets → ChatGPT → 問題配信

## 実際に動く連携と制限

マスターはユーザー指定の非公開Google Sheets「世界史・通史誤答マスター」の `Sheet1`。ChatGPTの認証済みGoogle Sheets編集機能で登録・読み戻しし、確認した問題だけを `public/chronology-errors.json` へ配信する。文化史で運用中のGitHubミラー方式を使用する。ユーザーによるJSONのダウンロード・インポートは不要。

英単語アプリの公開CSV／Apps Script方式も、問題フィードは認証なしで読み取れる方式だった。今回はシートの共有権限やウェブ公開設定を変更せず、問題データだけを公開GitHub JSONとして配信する。Googleトークン・編集鍵・端末の成績はアプリに渡さない。問題自体も非公開にしたい場合、この方式は使えないため、認証付きバックエンドが別途必要。

**シートのみの直接編集が無人でGitHubへ反映される仕組みではない。** ChatGPTがシート登録・読み戻しとGitHub配信の両方を行う。ユーザーは用語をチャットに列挙するか「通史シートを反映」と依頼する。常駐ジョブ・Apps Scriptのデプロイは設定していない。利用可能な連携にはSheetsの編集権限とGitHubのブランチ作成・PR権限が必要。将来、シートの任意の編集を直接配信するには、ユーザーによるApps Scriptの実行権限承認・ウェブアプリ配信設定、またはGoogle OAuth付きバックエンドの認可が必要になる。

## 登録仕様

列順：`id, term, question, answer, explanation, region, era, source, source_detail, cause, active, updated_at`。

- `id`：`chron-` + 英数字の固定スラッグ。既存問題の文章修正で変更しない。
- `term`：ユーザーが指定した用語。問いは1つの知識を確認できる日本語にする。
- `question, answer, region, era` は必須。説明は不明なら空欄。
- `source, source_detail, cause` はユーザー指定がない限り空欄。史実確認に使った資料を、ユーザーの誤答した問題集として記録しない。
- `cause` は空欄または A/B/C/D/E（既存の失点原因分類）。配信JSONでは出典・原因を空欄にして、個人的な出典・原因を公開しない。
- `active` はSheetsの真偽値。FALSEは出題停止。行そのものを削除しても端末の問題や履歴は削除されない。
- `updated_at` はUTCのISO形式、例 `2026-11-11T09:50:20.600Z`。
- 追加前に固定IDと問い・答えを照合し、既存行なら同じIDで修正。再実行で同じ18行を追加しない。

書き込み前に対象範囲の値・式・検証を読む。新規行は追記し、書き込み後に同じ範囲を読み戻して件数・固定ID・値を照合する。公開JSONは読み戻した行から生成する。

```json
{"schemaVersion":1,"version":1,"problems":[]}
```

`problems` の各要素は12列と同名のキーを持ち、`active` のみboolean、他はstring。更新ごとに全体 `version` を増やす。日時も更新する。同じ版の内容変更・古い版・不正ID・重複ID・不正行はファイル全体を拒否する。アプリのバージョンとは別管理。

アプリは起動・オンライン復帰・フォーカス復帰・「今すぐ同期」でmainのraw JSONを取得する。最初のネットワーク取得に失敗し、保存済み教材がない場合のみ同梱の配信JSONを試す。不正JSONではフォールバックせず、既存データを保持する。取得はcookieや認証情報なし、15秒の上限付き。同期成功日時・有効件数・保存件数・失敗状態を表示する。

## 履歴の互換性

既存の通史専用localStorageキー `world-history-chronology-errors-v1` を維持。文化史・年号・曖昧用語・地図のIndexedDBにはアクセスしない。既存の手動登録も残す。通常の文化史等のDBを新設・移行・初期化しない。

同期が更新するのは問題本文などのマスター列だけ。`correctCount, wrongCount, stage, lastReviewedAt, nextReviewAt, createdAt, updatedAt` は端末で保持する。シート登録だけで誤答回数を加算しない。初回配信問題の正誤回数は0、復習予定は未設定。全件再テストから演習し、採点後に既存の間隔反復で復習予定を作る。

新しい任意項目は `term, active, masterUpdatedAt` とコレクションの `sync`。旧v1バックアップも読み込める。バックアップは引き続き通史専用JSONで、同じIDを再復元しても複製しない。累積正誤回数は少なくならないよう統合する。既存形式は累積カウンター方式なので、別端末で独立して回答したカウンターをイベント単位に合算する仕様ではない。

## 初回18項目の史実確認（2026-11-11）

以下は教材内容の確認資料であり、シートの `source`（ユーザーが誤答した問題集）とは別。

| 項目 | 確認資料・注意 |
|---|---|
| ガズナ朝最盛期の君主 | [Encyclopaedia Iranica](https://www.iranicaonline.org/articles/mahmud-b-sebuktegin/)：マフムードとインド遠征 |
| ネロの哲学の師 | [Internet Encyclopedia of Philosophy](https://iep.utm.edu/seneca/)：セネカの家庭教師就任 |
| 西ゴート王国の首都 | [スペイン国立考古学博物館](https://www.man.es/man/en/dam/jcr%3A37a9f0eb-5987-4b2a-9e1d-0cfb4c9028c3/man-guidebook-late-antiquity.pdf)：6〜8世紀のトレド。初期トゥールーズとは区別 |
| セビリャ | [スペイン文化省PARES](https://pares.cultura.gob.es/ParesBusquedas20/catalogo/description/1681656/imprimir)：通商院と1717年のカディス移転 |
| サンサルバドル島 | [フロリダ自然史博物館](https://www.floridamuseum.ufl.edu/caribarch/education/columbus/)・[WHOI](https://www2.whoi.edu/staff/prichardson/wp-content/uploads/sites/75/2018/11/Richardson-Goldsmith-1987-Oceanus-Columbus.pdf)：命名を出題。現代の島との比定は断定しない |
| ヒジャーズ王国 | [1914-1918-online](https://encyclopedia.1914-1918-online.net/article/husayn-ibn-ali-king-of-hejaz/?format=pdf)：フサインの王国と1925年の征服 |
| ポグロム | [米国ホロコースト記念博物館](https://encyclopedia.ushmm.org/content/en/article/pogroms)：反ユダヤ暴力、ロシア帝国1881年以降 |
| エジプト＝イギリス同盟条約 | [英国議会Hansard](https://api.parliament.uk/historic-hansard/lords/1936/nov/25/anglo-egyptian-treaty)：1936年の条約と駐留 |
| アーヘンの和約 | [Getty](https://www.getty.edu/cona/CONAIconographyRecord.aspx?iconid=901000108)・[Britannica旧版](https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Aix-la-Chapelle%2C_Congresses_of)：1748年を明記し1668年と区別 |
| プロンビエールの密約 | [フランス国防省](https://www.cheminsdememoire.gouv.fr/fr/lettres-de-cavour-la-suite-de-lentrevue-de-plombieres)：1858年、カヴールとナポレオン3世 |
| アルバニア独立 | [アルバニア国立歴史博物館](https://www.mhk.gov.al/en/?elemenfolio=pavijoni-i-pavaresise-2)：1912年宣言／1913年承認 |
| ヴォルガ川 | [NASA](https://science.nasa.gov/earth/earth-observatory/volga-delta-and-the-caspian-sea-2129/)：カスピ海への流入 |
| デリー＝スルタン朝の順番 | [Archnet](https://www.archnet.org/collections/2375)：5王朝の順序。細かな在位年表は出題しない |
| ニコポリスの戦い | [Medievalists掲載研究紹介](https://www.medievalists.net/2017/05/lack-western-european-military-response-ottoman-invasions-eastern-europe-nicopolis-1396-mohacs-1526/)：1396年、バヤジット1世 |
| ウルグ＝ベク | [ユトレヒト大学](https://webspace.science.uu.nl/~gent0113/ulughbeg/ulughbeg_observatory.htm)：ティムール朝、サマルカンド天文台 |
| セリム1世 | [Ottoman–Mamluk War](https://en.wikipedia.org/wiki/Ottoman%E2%80%93Mamluk_War_%281516%E2%80%931517%29)：1517年のマムルーク朝征服。カリフ権譲渡説は出題しない |
| アスワン＝ハイダム | [エクセター大学一次資料](https://humanities-collections.exeter.ac.uk/dame/s/en/item/15521)・[EBSCO](https://www.ebsco.com/research-starters/history/dedication-egypts-aswan-high-dam)：ソ連援助、1970年完成／1971年開所を区別 |
| アウスグライヒ | [Austria-Forum](https://austria-forum.org/af/AEIOU/Ausgleich%2C_%C3%B6sterreichisch-ungarischer/Ausgleich%2C_%C3%B6sterreichisch-ungarischer_english)：1867年の二重帝国成立 |

## 検証記録

- 2026-11-11：指定シートの空状態を確認し、ヘッダー＋18行を追記。A1:L19を読み戻し、18固定ID・全値・出典等の空欄の一致を確認。
- 単体テスト188件、ビルド、曖昧用語／地図データ検証が成功。
- 全ブラウザテスト63件が成功。追加の通史4件は360px／393pxの全18問出題、再同期、異常JSON拒否、復帰、バックアップ、PWAオフラインを検証。
- 初期の並行テスト実行は共有サーバー・出力先が競合したため中止し、単一の全体実行で再検証。テストの削除・無効化は行っていない。
- Android実機での操作、シートだけを編集した場合の無人同期、Google OAuth付き非公開配信は未検証／未設定。
