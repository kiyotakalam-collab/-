import type {Card, KnowledgeItem, Level, Source} from './types';

// User-supplied photographs 6–10, received 2026-11-09. Only independently
// worded prompts are shipped; the photographed textbook pages stay private.
export const secondPhotoUpdatedAt = '2026-11-09T08:34:38.000Z';
const source = (photo: number): Source => ({
  title: 'ユーザー提供：東進『スタンダード世界史探究』西洋文化史・テーマ史編',
  note: `2026-11-09 提供写真${photo}／10、該当箇所を目視で確認。公開URLなし。教材の文章・写真は転載していない。`,
});
function item(id: string, canonicalName: string, aliases: string[], kind: KnowledgeItem['kind'], era: string, field: string, level: Level, description: string, photo: number): KnowledgeItem {
  return {id, canonicalName, aliases, kind, era, field, level, region: era === '古代ローマ' ? 'ローマ' : 'ヨーロッパ',
    relatedPeople: [], relatedWorks: [], description, images: [], sources: [source(photo)],
    difficultyEvidence: `暫定分類：Lv.${level}。提供写真の掲載は確認したが、教科書・用語集での重要度や大学別出題頻度は未照合。`,
    verification: 'provisional', updatedAt: secondPhotoUpdatedAt, version: 1, deleted: false};
}
function card(id: string, knowledgeId: string, type: Card['type'], question: string, answer: string, explanation: string): Card {
  return {id, knowledgeId, type, question, answer, explanation, updatedAt: secondPhotoUpdatedAt, version: 1, deleted: false};
}

export const secondPhotoItems: KnowledgeItem[] = [
  item('ro-polybius', 'ポリビオス', ['ポリュビオス', 'Polybius'], 'person', '古代ローマ', '歴史学', 3, 'ギリシア出身の歴史家。ローマの地中海世界での興隆を『歴史』に記した。', 6),
  item('ro-caesar', 'カエサル', ['ガイウス・ユリウス・カエサル', 'Julius Caesar'], 'person', '古代ローマ', '歴史学', 1, 'ローマ共和政末期の政治家。『ガリア戦記』を記した。', 6),
  item('ro-livy', 'リウィウス', ['リーウィウス', 'Livy'], 'person', '古代ローマ', '歴史学', 2, 'ローマの歴史家。『ローマ建国史』を記した。', 6),
  item('ro-plutarch', 'プルタルコス', ['プルターク', 'Plutarch'], 'person', '古代ローマ', '歴史学', 2, 'ギリシア出身の著述家。『対比列伝』でギリシアとローマの人物を対比した。', 6),
  item('ro-strabo', 'ストラボン', ['ストラボ', 'Strabo'], 'person', '古代ローマ', '地理学', 3, '小アジア出身の地理学者。『地理誌』を著した。', 6),
  item('ro-pliny-elder', 'プリニウス', ['大プリニウス', 'Pliny the Elder'], 'person', '古代ローマ', '科学', 2, 'ローマの著述家。博物学を集成した『博物誌』で知られる。', 6),
  item('ro-ptolemy', 'プトレマイオス', ['クラウディオス・プトレマイオス', 'Ptolemy'], 'person', '古代ローマ', '科学', 2, 'ローマ帝政期の天文学者。『天文学大全』を著した。', 6),
  item('ro-galen', 'ガレノス', ['ガレヌス', 'Galen'], 'person', '古代ローマ', '科学', 2, 'ローマ帝政期の医学者。マルクス・アウレリウス帝の侍医を務めた。', 6),
  item('ro-twelve-tables', '十二表法', ['十二表の法', 'Law of the Twelve Tables'], 'concept', '古代ローマ', '法律', 1, '共和政ローマ初期に成文化された法。', 6),
  item('ro-law-of-nations', '万民法', ['ius gentium'], 'concept', '古代ローマ', '法律', 2, 'ローマ帝国の発展とともに、市民以外を含む人々にも関わる法。', 6),
  item('ro-corpus-juris', 'ローマ法大全', ['ユスティニアヌス法典', 'Corpus Juris Civilis'], 'work', '古代ローマ', '法律', 2, '東ローマ皇帝ユスティニアヌスの命で編纂された法集成。', 6),
  item('ro-colosseum', 'コロッセウム', ['コロセウム', 'Colosseum'], 'building', '古代ローマ', '建築', 1, 'ローマにある円形闘技場。', 7),
  item('ro-forum', 'フォロ＝ロマーノ', ['フォロ・ロマーノ', 'フォルム・ロマヌム', 'Roman Forum'], 'building', '古代ローマ', '建築', 2, '古代ローマの政治や市民生活の中心となった広場。', 7),
  item('ro-pont-du-gard', 'ガール水道橋', ['ポン・デュ・ガール', 'Pont du Gard'], 'building', '古代ローマ', '建築', 2, '現在のフランス南部に残る古代ローマの水道橋。', 7),
  item('ro-appian-way', 'アッピア街道', ['アピア街道', 'Appian Way'], 'building', '古代ローマ', '建築', 2, '古代ローマの代表的な道路。', 7),
  item('ro-triumphal-arch', '凱旋門', ['古代ローマの凱旋門', 'triumphal arch'], 'concept', '古代ローマ', '建築', 2, '軍事的勝利などを記念して造られた門形の建造物。', 7),
  item('me-carolingian-renaissance', 'カロリング＝ルネサンス', ['カロリング・ルネサンス', 'Carolingian Renaissance'], 'concept', '中世ヨーロッパ', '文化運動', 2, 'カール大帝の保護のもとで進んだ古代ラテン文化の復興運動。', 8),
  item('me-alcuin', 'アルクイン', ['アルクイヌス', 'Alcuin'], 'person', '中世ヨーロッパ', '教育', 3, 'イギリス出身の学者。カール大帝に招かれ、学芸の振興に携わった。', 8),
  item('me-twelfth-renaissance', '12世紀ルネサンス', ['十二世紀ルネサンス', 'Twelfth-Century Renaissance'], 'concept', '中世ヨーロッパ', '文化運動', 3, '12世紀の西欧で、古典文献の翻訳や学問の発展が進んだ文化的動き。', 8),
  item('me-scholasticism', 'スコラ学', ['スコラ哲学', 'Scholasticism'], 'concept', '中世ヨーロッパ', '哲学・思想', 2, '中世西欧の学校や大学で発達した、信仰と理性の関係を論じる学問。', 9),
  item('me-anselm', 'アンセルムス', ['アンセルム', 'Anselm of Canterbury'], 'person', '中世ヨーロッパ', '哲学・思想', 3, 'カンタベリ大司教。スコラ学の初期に影響した。', 9),
  item('me-abelard', 'アベラール', ['ピエール・アベラール', 'Peter Abelard'], 'person', '中世ヨーロッパ', '哲学・思想', 3, '中世フランスの哲学者・神学者。普遍論争に関わった。', 9),
  item('me-aquinas', 'トマス＝アクィナス', ['トマス・アクィナス', 'Thomas Aquinas'], 'person', '中世ヨーロッパ', '哲学・思想', 2, '中世の神学者。『神学大全』でアリストテレス哲学とキリスト教神学を結び付けた。', 9),
  item('me-ockham', 'ウィリアム＝オブ＝オッカム', ['オッカム', 'William of Ockham'], 'person', '中世ヨーロッパ', '哲学・思想', 3, '中世イングランドの哲学者・神学者。後期スコラ学の唯名論で知られる。', 9),
  item('me-roger-bacon', 'ロジャー＝ベーコン', ['ロジャー・ベーコン', 'Roger Bacon'], 'person', '中世ヨーロッパ', '科学', 3, '中世イングランドの学者。経験・観察を重視した。', 9),
  item('me-bologna-university', 'ボローニャ大学', ['University of Bologna'], 'building', '中世ヨーロッパ', '教育', 2, '北イタリアに成立し、法学で知られた中世大学。', 10),
  item('me-paris-university', 'パリ大学', ['University of Paris'], 'building', '中世ヨーロッパ', '教育', 2, '神学で知られた中世大学。', 10),
  item('me-oxford-university', 'オクスフォード大学', ['オックスフォード大学', 'University of Oxford'], 'building', '中世ヨーロッパ', '教育', 2, 'イングランドに成立した中世大学。', 10),
  item('me-cambridge-university', 'ケンブリッジ大学', ['University of Cambridge'], 'building', '中世ヨーロッパ', '教育', 3, 'イングランドに成立した中世大学。', 10),
  item('me-salerno-university', 'サレルノ大学', ['University of Salerno'], 'building', '中世ヨーロッパ', '教育', 3, '南イタリアに成立し、医学で知られた中世の学問拠点。', 10),
];

export const secondPhotoCards: Card[] = [
  card('ro-polybius-histories-author', 'ro-polybius', 'work-author', 'ローマの興隆を記したポリビオスの著作は？', '歴史', 'ヘロドトスの同名の著作と区別する。'),
  card('ro-polybius-histories-person', 'ro-polybius', 'achievement-person', '共和政ローマの興隆を『歴史』に記したギリシア人は？', 'ポリビオス', 'ギリシア出身の歴史家。'),
  card('ro-caesar-gallic-author', 'ro-caesar', 'work-author', '『ガリア戦記』の著者は？', 'カエサル', 'ローマ共和政末期の政治家。'),
  card('ro-caesar-gallic-work', 'ro-caesar', 'person-work', 'カエサルがガリア遠征を記した著作は？', 'ガリア戦記', 'ラテン語で記された。'),
  card('ro-livy-history-author', 'ro-livy', 'work-author', '『ローマ建国史』の著者は？', 'リウィウス', 'ローマの建国からの歴史を叙述した。'),
  card('ro-plutarch-lives-author', 'ro-plutarch', 'work-author', '『対比列伝』の著者は？', 'プルタルコス', '『英雄伝』とも呼ばれる。'),
  card('ro-strabo-geography-author', 'ro-strabo', 'work-author', '『地理誌』の著者は？', 'ストラボン', '小アジア出身の地理学者。'),
  card('ro-pliny-natural-history-author', 'ro-pliny-elder', 'work-author', '『博物誌』の著者は？', 'プリニウス', '大プリニウスの著作。'),
  card('ro-ptolemy-almagest-author', 'ro-ptolemy', 'work-author', '『天文学大全』の著者は？', 'プトレマイオス', '『アルマゲスト』とも呼ばれる。'),
  card('ro-galen-emperor', 'ro-galen', 'achievement-person', 'マルクス・アウレリウス帝の侍医を務めた医学者は？', 'ガレノス', '古代ローマの医学者。'),
  card('ro-twelve-tables-law', 'ro-twelve-tables', 'context', '共和政ローマ初期に成文化された法は？', '十二表法', '古代ローマ法の基礎の一つ。'),
  card('ro-law-of-nations-name', 'ro-law-of-nations', 'context', 'ローマ市民以外にも関わるようになった法は？', '万民法', 'ローマ市民に限る市民法と区別する。'),
  card('ro-corpus-juris-justinian', 'ro-corpus-juris', 'context', 'ユスティニアヌス帝の命で編纂された法集成は？', 'ローマ法大全', '東ローマ帝国で編纂された。'),
  card('ro-colosseum-amphitheatre', 'ro-colosseum', 'context', 'ローマの代表的な円形闘技場は？', 'コロッセウム', '剣闘士の試合などが行われた。'),
  card('ro-forum-square', 'ro-forum', 'context', '古代ローマの政治や市民生活の中心となった広場は？', 'フォロ＝ロマーノ', '現在も遺跡が残る。'),
  card('ro-pont-du-gard-aqueduct', 'ro-pont-du-gard', 'context', '南フランスに残る古代ローマの水道橋は？', 'ガール水道橋', 'ローマの土木建築の例。'),
  card('ro-appian-way-road', 'ro-appian-way', 'context', '古代ローマの代表的な街道は？', 'アッピア街道', 'ローマから南へ延びる道路。'),
  card('ro-triumphal-arch-name', 'ro-triumphal-arch', 'context', '古代ローマで勝利を記念して造られた門形の建造物は？', '凱旋門', '軍事的勝利などを顕彰した。'),
  card('me-carolingian-renaissance-name', 'me-carolingian-renaissance', 'context', 'カール大帝が保護した古代ラテン文化の復興運動は？', 'カロリング＝ルネサンス', '中世初期の学芸復興。'),
  card('me-alcuin-charlemagne', 'me-alcuin', 'achievement-person', 'カール大帝に招かれ学芸を振興したイギリス出身の学者は？', 'アルクイン', 'カロリング＝ルネサンスに関わった。'),
  card('me-twelfth-renaissance-name', 'me-twelfth-renaissance', 'context', '古典文献の翻訳などが進んだ中世西欧の文化的動きを何という？', '12世紀ルネサンス', '12世紀に広がった学問の発展。'),
  card('me-scholasticism-name', 'me-scholasticism', 'context', '中世西欧で信仰と理性の関係を論じた学問は？', 'スコラ学', '学校や大学で発達した。'),
  card('me-anselm-canterbury', 'me-anselm', 'achievement-person', 'スコラ学初期のカンタベリ大司教は？', 'アンセルムス', '信仰と理性の関係を論じた。'),
  card('me-abelard-universals', 'me-abelard', 'achievement-person', '普遍論争に関わった中世フランスの哲学者は？', 'アベラール', '中世の神学者でもある。'),
  card('me-aquinas-summa-author', 'me-aquinas', 'work-author', '『神学大全』の著者は？', 'トマス＝アクィナス', 'アリストテレス哲学とキリスト教神学を結び付けた。'),
  card('me-aquinas-summa-work', 'me-aquinas', 'person-work', 'トマス＝アクィナスの主著は？', '神学大全', '中世スコラ学の代表的著作。'),
  card('me-ockham-nominalism', 'me-ockham', 'theory-person', '後期スコラ学の唯名論で知られる人物は？', 'ウィリアム＝オブ＝オッカム', '中世イングランドの学者。'),
  card('me-roger-bacon-experience', 'me-roger-bacon', 'achievement-person', '中世に経験・観察を重視したイギリスの学者は？', 'ロジャー＝ベーコン', '自然研究の方法を論じた。'),
  card('me-bologna-law', 'me-bologna-university', 'context', '中世イタリアで法学の中心となった大学は？', 'ボローニャ大学', '北イタリアの大学。'),
  card('me-paris-theology', 'me-paris-university', 'context', '中世ヨーロッパで神学の中心となった大学は？', 'パリ大学', 'スコラ学の発展にも関わる。'),
  card('me-oxford-england', 'me-oxford-university', 'context', 'イングランドで成立した、現在も続く中世の大学は？', 'オクスフォード大学', '中世の学問拠点。'),
  card('me-cambridge-oxford', 'me-cambridge-university', 'context', 'オクスフォード大学から分かれて成立した大学は？', 'ケンブリッジ大学', 'イングランドの大学。'),
  card('me-salerno-medicine', 'me-salerno-university', 'context', '中世南イタリアで医学の中心となった大学は？', 'サレルノ大学', '医学教育で知られる。'),
];
