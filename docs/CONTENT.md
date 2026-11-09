# 初期コンテンツの出典と検証

初期マスターは18知識項目・24カード（文字23、画像1）。古代ギリシア・ヘレニズム・古代ローマを動作検証する少量データであり、大学受験文化史の全範囲を網羅していない。東進『スタンダード世界史探究』のページ内容は使用・推測していない。

2026-11-09 に下記の実在する公開ページの本文を閲覧し、問題で尋ねる著者・著作・業績の関係を確認した。説明と問題文は短い独自の日本語要約で、出典の本文を転載していない。`verification: verified` はこの事実確認を表し、教科書・専門家・入試問題との照合済みという意味ではない。

**全18項目の難易度は暫定分類。** 用語の細かさを基準とする初期の仮置きであり、教科書・用語集の掲載状況や大学別出題実績との照合は未実施。慶應義塾大学を含む大学別の出題頻度は提示していない。Lv.4のカードも問題文の複雑さで難化していない。

| 固定知識ID | 確認した内容 | 実際に閲覧した出典 |
| --- | --- | --- |
| gr-homer | ホメロスと『イリアス』『オデュッセイア』、成立上の留保 | [World History Encyclopedia: Homer](https://www.worldhistory.org/homer/) |
| gr-herodotus | ヘロドトスと『歴史』 | [Encyclopaedia Iranica](https://www.iranicaonline.org/articles/herodotus/)、[PBS: The Historians](https://www.pbs.org/empires/thegreeks/background/40b_p1.html) |
| gr-thucydides | トゥキディデスとペロポネソス戦争の歴史 | [Fordham University: Ancient History Sourcebook](https://sourcebooks.web.fordham.edu/ancient/eb11-thucydides.asp) |
| gr-socrates | 著作を残さず、プラトンの対話篇に登場 | [SEP: Socrates](https://plato.stanford.edu/entries/socrates/)、[SEP: Plato](https://plato.stanford.edu/entries/plato/) |
| gr-plato | イデア論、『国家』 | [SEP: Plato](https://plato.stanford.edu/entries/plato/) |
| gr-aristotle | プラトンとの関係、リュケイオン、多分野の研究 | [SEP: Aristotle](https://plato.stanford.edu/entries/aristotle/) |
| gr-parthenon | アテナへの奉献、外周のドーリア式列柱 | [World History Encyclopedia: Parthenon](https://www.worldhistory.org/parthenon/) |
| he-euclid | エウクレイデスと『原論』 | [University of St Andrews, MacTutor: Euclid](https://mathshistory.st-andrews.ac.uk/Biographies/Euclid/) |
| he-archimedes | アルキメデス、『浮体について』、静水力学 | [MacTutor: Archimedes](https://mathshistory.st-andrews.ac.uk/Biographies/Archimedes/) |
| he-aristarchus | アリスタルコスの太陽中心説と伝承経路 | [MacTutor: Aristarchus](https://mathshistory.st-andrews.ac.uk/Biographies/Aristarchus/) |
| he-eratosthenes | 太陽の高度差と地球周長の測定 | [MacTutor: Eratosthenes](https://mathshistory.st-andrews.ac.uk/Biographies/Eratosthenes/) |
| he-epicurus | 苦痛と心の動揺からの解放、快楽 | [SEP: Epicurus](https://plato.stanford.edu/entries/epicurus/) |
| he-zeno-citium | キティオンのゼノンとストア派創始 | [SEP: Stoicism](https://plato.stanford.edu/entries/stoicism/) |
| ro-virgil | ウェルギリウス、『アエネイス』『農耕詩』 | [World History Encyclopedia: Virgil](https://www.worldhistory.org/virgil/) |
| ro-cicero | キケロ、『義務について』『老年について』 | [SEP: Cicero](https://plato.stanford.edu/entries/cicero/) |
| ro-lucretius | ルクレティウス、エピクロス思想、『物の本性について』 | [SEP: Lucretius](https://plato.stanford.edu/entries/lucretius/) |
| ro-tacitus | タキトゥス、『ゲルマニア』『年代記』 | [World History Encyclopedia: Tacitus](https://www.worldhistory.org/tacitus/) |
| ro-pantheon | 現存建物の完成時期、コンクリートドーム | [World History Encyclopedia: Pantheon](https://www.worldhistory.org/Pantheon/) |

SEPは Stanford Encyclopedia of Philosophy。Fordhamのトゥキディデス資料は1911年版百科事典の再録であり、細かな年代論などは初期カードに採用していない。PBS資料には別の箇所に人名の誤植があるため、ヘロドトスの著者・著作関係はIranicaも併用した。

## 同梱画像

- ファイル：`public/images/parthenon.jpg`（原版JPEG、750 × 813、144,703 bytes、改変なし）
- 出典：[Wikimedia Commons: File:The Parthenon of Acropolis.jpg](https://commons.wikimedia.org/wiki/File:The_Parthenon_of_Acropolis.jpg)
- 著作者：Ktrepas。出典ページの「Source: Own work」「Author: Ktrepas」を確認。
- ライセンス：[CC0 1.0 Universal Public Domain Dedication](https://creativecommons.org/publicdomain/zero/1.0/)。出典ページの画像個別のライセンス表示を確認。Commonsページ一般のライセンスから推測していない。
- 原版URL：<https://upload.wikimedia.org/wikipedia/commons/b/bb/The_Parthenon_of_Acropolis.jpg>
- 取得・確認日：2026-11-09
- SHA-256：`ca64e9ee036188a7cad41d6bed701e2adc1376455ba602de9b6abed062ce46aa`
- 知識ID：`gr-parthenon`、画像ID：`img-parthenon-ktrepas`、画像カードID：`gr-parthenon-image`

画像はフロントエンドの静的ファイルとして同梱するため、外部画像ホストが停止しても配信できる。問題面に作品名を含むキャプションや出典タイトルを表示すると回答が漏れるため、UIでは解答後に表示する。画像読み込み失敗用の `fallbackPrompt` は文字情報だけで同じ答えに到達できる別表現になっている。

## 追加時の方針

- 知識項目とカードは別々の固定IDを保持する。同じ人物の別著作は別の明確な知識としてカードにできるが、同じ問いの言い換えだけで水増ししない。
- `relatedPeople` / `relatedWorks` は固定IDによる参照。未独立登録の著作名は説明・カードに収録し、存在しないIDは作らない。将来、著作を独立した知識項目として登録する場合も、既存の人物ID・カードIDは変更しない。
- 表記揺れは `aliases` に保持する。別人物のゼノンのような同名異人は出身地などを正式名称に含め、誤統合を避ける。
- 画像はファイルごとに著作者・出典ページ・ライセンス・ライセンスURLを確認し、実在しないURLや教材の無断コピーを登録しない。
- 教材写真や動画から追加する場合は、判読できない語や未確認の事実を推測せず、要確認として管理する。難易度の根拠が揃うまで暫定分類を維持する。
