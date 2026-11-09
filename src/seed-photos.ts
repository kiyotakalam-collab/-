import type { Card, KnowledgeItem, Level, Source } from './types';

// The five photographs supplied by the user on 2026-11-09 are the source. Their
// printed text and photographs are not distributed with the public application.
export const photoUpdatedAt = '2026-11-09T08:22:15.000Z';
const source = (photo: number): Source => ({
  title: 'ユーザー提供：東進『スタンダード世界史探究』西洋文化史・テーマ史編',
  note: `2026-11-09 提供写真${photo}／5、該当項目を目視で確認。公開URLなし。教材本文・写真は転載せず、問題文は独自に作成。`,
});
const evidence = (level: Level) => `暫定分類：Lv.${level}。提供写真で掲載を確認したが、教科書・用語集全体の重要度および大学別出題頻度は未照合。`;

function entry(id: string, canonicalName: string, aliases: string[], kind: KnowledgeItem['kind'], era: string, field: string, level: Level, description: string, photo: number): KnowledgeItem {
  return {id, canonicalName, aliases, kind, era, field, level,
    region: era === '古代ローマ' ? 'ローマ' : era === 'ヘレニズム' ? '東地中海' : 'ギリシア',
    relatedPeople: [], relatedWorks: [], description, images: [], sources: [source(photo)],
    difficultyEvidence: evidence(level), verification: 'provisional', updatedAt: photoUpdatedAt, version: 1, deleted: false};
}
function question(id: string, knowledgeId: string, type: Card['type'], prompt: string, answer: string, explanation: string): Card {
  return {id, knowledgeId, type, question: prompt, answer, explanation, updatedAt: photoUpdatedAt, version: 1, deleted: false};
}

export const photoItems: KnowledgeItem[] = [
  entry('gr-zeus', 'ゼウス', ['Zeus'], 'concept', '古代ギリシア', '宗教', 1, 'ギリシア神話の主神。天と雷を司る。', 1),
  entry('gr-apollo', 'アポロン', ['アポローン', 'Apollo'], 'concept', '古代ギリシア', '宗教', 1, 'ギリシア神話の神。デルフォイの神託で知られる。', 1),
  entry('gr-aphrodite', 'アフロディテ', ['アプロディテ', 'Aphrodite'], 'concept', '古代ギリシア', '宗教', 2, 'ギリシア神話の愛と美の女神。', 1),
  entry('gr-athena', 'アテナ', ['アテーナー', 'Athena'], 'concept', '古代ギリシア', '宗教', 1, '知恵と戦いに関わる女神。アテネの守護神。', 1),
  entry('gr-hesiod', 'ヘシオドス', ['ヘーシオドス', 'Hesiod'], 'person', '古代ギリシア', '文学', 2, '古代ギリシアの詩人。『労働と日々』『神統記』が伝わる。', 1),
  entry('gr-sappho', 'サッフォー', ['サッポー', 'Sappho'], 'person', '古代ギリシア', '文学', 3, 'レスボス島出身の叙情詩人。', 1),
  entry('gr-pindar', 'ピンダロス', ['ピンダール', 'Pindar'], 'person', '古代ギリシア', '文学', 3, '競技の勝者をたたえる頌歌で知られる叙情詩人。', 1),
  entry('gr-aeschylus', 'アイスキュロス', ['Aeschylus'], 'person', '古代ギリシア', '文学', 2, '古代ギリシアの悲劇作家。『アガメムノン』などを著した。', 1),
  entry('gr-sophocles', 'ソフォクレス', ['Sophocles'], 'person', '古代ギリシア', '文学', 1, '古代ギリシアの悲劇作家。『オイディプス王』で知られる。', 1),
  entry('gr-euripides', 'エウリピデス', ['Euripides'], 'person', '古代ギリシア', '文学', 2, '古代ギリシアの悲劇作家。『メデイア』で知られる。', 1),
  entry('gr-aristophanes', 'アリストファネス', ['Aristophanes'], 'person', '古代ギリシア', '文学', 2, '古代ギリシアの喜劇作家。『女の平和』を著した。', 1),
  entry('gr-thales', 'タレス', ['Thales'], 'person', '古代ギリシア', '哲学・思想', 2, 'ミレトス出身の自然哲学者。万物の根源を水と考えた。', 2),
  entry('gr-pythagoras', 'ピタゴラス', ['Pythagoras'], 'person', '古代ギリシア', '哲学・思想', 2, 'サモス島出身。数に基づく世界理解で知られ、ピタゴラスの定理に名を残す。', 2),
  entry('gr-heraclitus', 'ヘラクレイトス', ['Heraclitus'], 'person', '古代ギリシア', '哲学・思想', 3, 'エフェソス出身の自然哲学者。「万物は流転する」という考えで知られる。', 2),
  entry('gr-democritus', 'デモクリトス', ['Democritus'], 'person', '古代ギリシア', '哲学・思想', 3, '原子論で知られる古代ギリシアの哲学者。', 2),
  entry('gr-protagoras', 'プロタゴラス', ['Protagoras'], 'person', '古代ギリシア', '哲学・思想', 3, 'ソフィストの一人。「万物の尺度は人間」と説いた。', 2),
  entry('gr-hippocrates', 'ヒッポクラテス', ['Hippocrates'], 'person', '古代ギリシア', '科学', 2, 'コス島出身。古代ギリシアの医学に関わる人物で「医学の父」と呼ばれる。', 3),
  entry('gr-phidias', 'フェイディアス', ['ペイディアス', 'Phidias'], 'person', '古代ギリシア', '美術', 3, 'パルテノン神殿の彫刻事業を監督した彫刻家。', 3),
  entry('gr-doric', 'ドーリア式', ['ドリス式', 'Doric order'], 'concept', '古代ギリシア', '建築', 1, '古代ギリシア建築の柱の様式の一つ。柱頭は比較的簡素。', 3),
  entry('gr-ionic', 'イオニア式', ['イオニア様式', 'Ionic order'], 'concept', '古代ギリシア', '建築', 2, '古代ギリシア建築の柱の様式の一つ。柱頭の渦巻装飾が特徴。', 3),
  entry('gr-corinthian', 'コリント式', ['コリント様式', 'Corinthian order'], 'concept', '古代ギリシア', '建築', 2, '古代ギリシア建築の柱の様式の一つ。柱頭に植物文様の装飾がある。', 3),
  entry('he-koine', 'コイネー', ['コイネー・ギリシア語', 'Koine'], 'concept', 'ヘレニズム', '言語', 2, 'ヘレニズム世界で広く用いられた共通ギリシア語。', 4),
  entry('he-cosmopolitanism', '世界市民主義', ['コスモポリタニズム', 'cosmopolitanism'], 'concept', 'ヘレニズム', '哲学・思想', 2, '都市国家の枠を越えた、世界の一員としての考え方。', 4),
  entry('he-stoicism', 'ストア派', ['ストア学派', 'Stoicism'], 'concept', 'ヘレニズム', '哲学・思想', 2, 'ゼノン（キティオン）が創始した哲学の一派。', 4),
  entry('he-epicureanism', 'エピクロス派', ['エピクロス学派', 'Epicureanism'], 'concept', 'ヘレニズム', '哲学・思想', 2, 'エピクロスに始まる哲学の一派。精神の平静を重視する。', 4),
  entry('he-mouseion', 'ムセイオン', ['ムーセイオン', 'Mouseion'], 'concept', 'ヘレニズム', '科学', 3, 'アレクサンドリアの学術研究施設。', 4),
  entry('he-venus-milo', 'ミロのヴィーナス', ['ミロのアフロディテ', 'Venus de Milo'], 'work', 'ヘレニズム', '美術', 2, 'ミロ島で発見された、アフロディテ像として知られる大理石彫刻。', 4),
  entry('he-laocoon', 'ラオコーン', ['ラオコーン群像', 'Laocoön'], 'work', 'ヘレニズム', '美術', 3, 'ラオコーンと息子たちを表した彫刻群。', 4),
  entry('he-samothrace-nike', 'サモトラケのニケ', ['サモトラケのニケ像', 'Winged Victory of Samothrace'], 'work', 'ヘレニズム', '美術', 3, 'サモトラケ島で発見された勝利の女神ニケの彫刻。', 4),
  entry('he-mithraism', 'ミトラ教', ['ミスラ教', 'Mithraism'], 'concept', 'ヘレニズム', '宗教', 3, 'イラン起源のミトラ神を中心とする密儀宗教。ローマ世界にも広まった。', 4),
  entry('ro-seneca', 'セネカ', ['Seneca'], 'person', '古代ローマ', '哲学・思想', 2, 'ローマのストア派哲学者。ネロの師としても知られる。', 5),
  entry('ro-epictetus', 'エピクテトス', ['Epictetus'], 'person', '古代ローマ', '哲学・思想', 3, 'ローマ時代のストア派哲学者。教えは『語録』などに伝わる。', 5),
  entry('ro-marcus-aurelius', 'マルクス・アウレリウス・アントニヌス', ['マルクス・アウレリウス', 'Marcus Aurelius'], 'person', '古代ローマ', '哲学・思想', 2, 'ローマ皇帝でストア派哲学者。ギリシア語で『自省録』を記した。', 5),
  entry('ro-horace', 'ホラティウス', ['ホラティウス', 'Horace'], 'person', '古代ローマ', '文学', 2, 'アウグストゥス時代の詩人。『歌集』で知られる。', 5),
  entry('ro-ovid', 'オウィディウス', ['オウィディウス', 'オヴィディウス', 'Ovid'], 'person', '古代ローマ', '文学', 2, 'ローマの詩人。『転身譜』で知られる。', 5),
];

export const photoCards: Card[] = [
  question('gr-zeus-chief', 'gr-zeus', 'context', 'ギリシア神話の主神は？', 'ゼウス', '天と雷を司る。'),
  question('gr-apollo-delphi', 'gr-apollo', 'context', 'デルフォイの神託で知られる神は？', 'アポロン', 'ギリシア神話の神。'),
  question('gr-aphrodite-love', 'gr-aphrodite', 'context', 'ギリシア神話の愛と美の女神は？', 'アフロディテ', 'ローマ神話のウェヌスに対応する。'),
  question('gr-athena-wisdom', 'gr-athena', 'context', 'アテネの守護神で、知恵に関わる女神は？', 'アテナ', 'パルテノン神殿はアテナに捧げられた。'),
  question('gr-homer-iliad-work', 'gr-homer', 'person-work', 'ホメロスの叙事詩で、トロイア戦争を題材とするものは？', 'イリアス', '『オデュッセイア』はオデュッセウスの帰郷を描く。'),
  question('gr-homer-odyssey-author', 'gr-homer', 'work-author', '『オデュッセイア』の作者とされる人物は？', 'ホメロス', '古代ギリシアの叙事詩人。'),
  question('gr-hesiod-works-days-author', 'gr-hesiod', 'work-author', '『労働と日々』の作者は？', 'ヘシオドス', '古代ギリシアの詩人。'),
  question('gr-hesiod-theogony-author', 'gr-hesiod', 'work-author', '『神統記』の作者は？', 'ヘシオドス', '神々の系譜を扱う叙事詩。'),
  question('gr-sappho-lesbos', 'gr-sappho', 'achievement-person', 'レスボス島出身の女性叙情詩人は？', 'サッフォー', '古代ギリシアの叙情詩人。'),
  question('gr-pindar-odes', 'gr-pindar', 'achievement-person', '競技の勝者をたたえる頌歌で知られる詩人は？', 'ピンダロス', '古代ギリシアの叙情詩人。'),
  question('gr-aeschylus-agamemnon-author', 'gr-aeschylus', 'work-author', '悲劇『アガメムノン』の作者は？', 'アイスキュロス', '古代ギリシアの三大悲劇作家の一人。'),
  question('gr-sophocles-oedipus-author', 'gr-sophocles', 'work-author', '悲劇『オイディプス王』の作者は？', 'ソフォクレス', '古代ギリシアの三大悲劇作家の一人。'),
  question('gr-sophocles-oedipus-work', 'gr-sophocles', 'person-work', 'ソフォクレスの代表的な悲劇は？', 'オイディプス王', '王の運命を描いた悲劇。'),
  question('gr-euripides-medea-author', 'gr-euripides', 'work-author', '悲劇『メデイア』の作者は？', 'エウリピデス', '古代ギリシアの三大悲劇作家の一人。'),
  question('gr-aristophanes-lysistrata-author', 'gr-aristophanes', 'work-author', '喜劇『女の平和』の作者は？', 'アリストファネス', 'ペロポネソス戦争を背景とする作品。'),
  question('gr-thales-water', 'gr-thales', 'theory-person', '万物の根源を水と考えた人物は？', 'タレス', 'ミレトス出身の自然哲学者。'),
  question('gr-pythagoras-number', 'gr-pythagoras', 'theory-person', '万物の根源を数に求めた人物は？', 'ピタゴラス', '数に基づく世界理解で知られる。'),
  question('gr-heraclitus-flux', 'gr-heraclitus', 'theory-person', '「万物は流転する」と考えた人物は？', 'ヘラクレイトス', 'エフェソス出身の自然哲学者。'),
  question('gr-democritus-atom', 'gr-democritus', 'theory-person', '原子論で知られる古代ギリシアの哲学者は？', 'デモクリトス', '自然を原子と空虚によって説明した。'),
  question('gr-protagoras-measure', 'gr-protagoras', 'theory-person', '「万物の尺度は人間」と説いたソフィストは？', 'プロタゴラス', '古代ギリシアのソフィスト。'),
  question('gr-socrates-ignorance', 'gr-socrates', 'theory-person', '「無知の知」で知られる人物は？', 'ソクラテス', '自分が知らないことを自覚する姿勢として説明される。'),
  question('gr-plato-academy', 'gr-plato', 'achievement-person', 'アカデメイアを開いた人物は？', 'プラトン', 'アテネに開いた学園。'),
  question('gr-hippocrates-medicine', 'gr-hippocrates', 'achievement-person', '「医学の父」と呼ばれる古代ギリシアの人物は？', 'ヒッポクラテス', 'コス島出身。'),
  question('gr-phidias-parthenon', 'gr-phidias', 'achievement-person', 'パルテノン神殿の彫刻事業を監督した人物は？', 'フェイディアス', '『アテナ女神像』などに関わった。'),
  question('gr-doric-capital', 'gr-doric', 'context', '柱頭の装飾が簡素なギリシア建築の様式は？', 'ドーリア式', 'パルテノン神殿の外周の列柱にも使われた。'),
  question('gr-ionic-capital', 'gr-ionic', 'context', '柱頭の渦巻装飾が特徴のギリシア建築の様式は？', 'イオニア式', 'ギリシア建築の柱の様式の一つ。'),
  question('gr-corinthian-capital', 'gr-corinthian', 'context', '柱頭に植物文様の装飾があるギリシア建築の様式は？', 'コリント式', 'ギリシア建築の柱の様式の一つ。'),
  question('he-koine-language', 'he-koine', 'context', 'ヘレニズム世界で広まった共通ギリシア語は？', 'コイネー', '地域を越えた交流に用いられた。'),
  question('he-cosmopolitanism-name', 'he-cosmopolitanism', 'context', '都市国家を越えて世界の一員と考える思想は？', '世界市民主義', 'コスモポリタニズムともいう。'),
  question('he-stoicism-zeno', 'he-stoicism', 'context', 'ゼノン（キティオン）が創始した学派は？', 'ストア派', '同名のエレアのゼノンと区別する。'),
  question('he-epicureanism-epicurus', 'he-epicureanism', 'context', 'エピクロスが創始した学派は？', 'エピクロス派', '精神の平静を重視する。'),
  question('he-mouseion-alexandria', 'he-mouseion', 'context', 'アレクサンドリアの学術研究施設は？', 'ムセイオン', 'ヘレニズム時代の研究拠点。'),
  question('he-euclid-elements-work', 'he-euclid', 'person-work', 'エウクレイデスの幾何学書は？', '原論', '『幾何学原本』とも呼ばれる。'),
  question('he-aristarchus-heliocentric-term', 'he-aristarchus', 'context', 'アリスタルコスが唱えた、太陽を中心に考える説は？', '太陽中心説', '地球の公転を考えた。'),
  question('he-venus-milo-name', 'he-venus-milo', 'context', 'ミロ島で発見されたアフロディテ像の通称は？', 'ミロのヴィーナス', '古代ギリシアの大理石彫刻。'),
  question('he-laocoon-name', 'he-laocoon', 'context', '父子が大蛇に襲われる姿を表した彫刻群は？', 'ラオコーン', 'ラオコーン群像とも呼ばれる。'),
  question('he-samothrace-nike-name', 'he-samothrace-nike', 'context', 'サモトラケ島で発見された勝利の女神の彫刻は？', 'サモトラケのニケ', 'ニケは勝利の女神。'),
  question('he-mithraism-name', 'he-mithraism', 'context', 'イラン起源でローマ世界にも広まった密儀宗教は？', 'ミトラ教', 'ミトラ神を中心とする。'),
  question('ro-seneca-nero', 'ro-seneca', 'achievement-person', 'ネロの師として知られるストア派哲学者は？', 'セネカ', 'ローマの哲学者。'),
  question('ro-epictetus-discourses', 'ro-epictetus', 'achievement-person', '『語録』に教えが伝わるストア派哲学者は？', 'エピクテトス', '弟子が教えを書き留めた。'),
  question('ro-marcus-meditations-author', 'ro-marcus-aurelius', 'work-author', '『自省録』を記したローマ皇帝は？', 'マルクス・アウレリウス・アントニヌス', 'ストア派哲学の影響を受けた。'),
  question('ro-marcus-meditations-work', 'ro-marcus-aurelius', 'person-work', 'マルクス・アウレリウス・アントニヌスの著作は？', '自省録', 'ギリシア語で記された。'),
  question('ro-horace-odes-author', 'ro-horace', 'work-author', '『歌集』の著者は？', 'ホラティウス', 'アウグストゥス時代の詩人。'),
  question('ro-ovid-metamorphoses-author', 'ro-ovid', 'work-author', '『転身譜』の著者は？', 'オウィディウス', '『変身物語』とも呼ばれる。'),
  question('ro-ovid-metamorphoses-work', 'ro-ovid', 'person-work', 'オウィディウスの代表的な長編詩は？', '転身譜', '『変身物語』とも呼ばれる。'),
];
