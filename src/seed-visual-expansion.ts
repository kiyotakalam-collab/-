import type { Card, ImageAsset, KnowledgeItem, Level } from './types';

/** 作品・建築・彫刻の出典は各画像のWikimedia Commons個別ファイルページで確認。
 * 文化史難易度は2026年度の各校過去問を横断集計できていないため、用語の一般性に基づく暫定的な調整。
 * 本ファイルは元のカードID・学習履歴を変更せず追加する差分のみを保持する。
 */
export const expansionUpdatedAt = "2026-11-09T10:11:32.471Z";
export const visualImagePatches: Record<string, ImageAsset[]> = {
  "rn-leonardo": [
    {
      "id": "verified-img-1",
      "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Mona_Lisa.jpg?width=960",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Mona_Lisa.jpg",
      "author": "原作品作者：レオナルド＝ダ＝ヴィンチ。画像：原作品の忠実な複製",
      "license": "Public Domain Mark 1.0",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "caption": "モナ＝リザ。ルーヴル美術館所蔵。元画像：Musée du Louvre。出典・画像ライセンス：Wikimedia Commons。"
    },
    {
      "id": "verified-img-2",
      "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Last_Supper_by_Leonardo_da_Vinci.jpg?width=960",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Last_Supper_by_Leonardo_da_Vinci.jpg",
      "author": "原作品作者：レオナルド＝ダ＝ヴィンチ。画像：原作品の忠実な複製",
      "license": "Public Domain Mark 1.0",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "caption": "最後の晩餐。サンタ＝マリア＝デッレ＝グラツィエ修道院の壁画。複製写真：Paris Orlando。出典・画像ライセンス：Wikimedia Commons。"
    }
  ],
  "rn-michelangelo": [
    {
      "id": "verified-img-3",
      "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Last_Judgement_by_Michelangelo.jpg?width=960",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Last_Judgement_by_Michelangelo.jpg",
      "author": "原作品作者：ミケランジェロ。画像：原作品の忠実な複製",
      "license": "Public Domain Mark 1.0",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "caption": "最後の審判。システィナ礼拝堂祭壇壁面の壁画。出典・画像ライセンス：Wikimedia Commons。"
    },
    {
      "id": "verified-img-4",
      "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Sistine_Chapel_ceiling%2C_Creation_of_Adam.jpg?width=960",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Sistine_Chapel_ceiling%2C_Creation_of_Adam.jpg",
      "author": "原作品作者：ミケランジェロ。画像：原作品の忠実な複製",
      "license": "Public Domain Mark 1.0",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "caption": "アダムの創造。システィナ礼拝堂天井画の一部。出典・画像ライセンス：Wikimedia Commons。"
    }
  ],
  "rn-botticelli": [
    {
      "id": "verified-img-5",
      "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Botticelli-primavera.jpg?width=960",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Botticelli-primavera.jpg",
      "author": "原作品作者：ボッティチェリ。画像：原作品の忠実な複製",
      "license": "Public Domain Mark 1.0",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "caption": "春（プリマヴェーラ）。ウフィツィ美術館所蔵。出典・画像ライセンス：Wikimedia Commons。"
    }
  ],
  "nr-jan-van-eyck": [
    {
      "id": "verified-img-6",
      "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Van_Eyck_-_Arnolfini_Portrait.jpg?width=960",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Van_Eyck_-_Arnolfini_Portrait.jpg",
      "author": "原作品作者：ヤン＝ファン＝エイク。画像：原作品の忠実な複製",
      "license": "Public Domain Mark 1.0",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "caption": "アルノルフィーニ夫妻像。ロンドン・ナショナル・ギャラリー所蔵。出典・画像ライセンス：Wikimedia Commons。"
    }
  ],
  "nr-holbein": [
    {
      "id": "verified-img-7",
      "url": "https://commons.wikimedia.org/wiki/Special:FilePath/HOLBEIN-Hans-the-Younger-The-Ambassadors.jpg?width=960",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:HOLBEIN-Hans-the-Younger-The-Ambassadors.jpg",
      "author": "原作品作者：ハンス＝ホルバイン（子）。画像：原作品の忠実な複製",
      "license": "Public Domain Mark 1.0",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "caption": "大使たち。ロンドン・ナショナル・ギャラリー所蔵。出典・画像ライセンス：Wikimedia Commons。"
    }
  ],
  "ar-rubens": [
    {
      "id": "verified-img-8",
      "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Peter_Paul_Rubens_-_The_Descent_from_the_Cross_(Antwerp_Cathedral).jpg?width=960",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Peter_Paul_Rubens_-_The_Descent_from_the_Cross_(Antwerp_Cathedral).jpg",
      "author": "原作品作者：ルーベンス。画像：原作品の忠実な複製",
      "license": "Public Domain Mark 1.0",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "caption": "キリスト降架（アントウェルペン大聖堂）。アントウェルペン大聖堂の『キリスト降架』三連祭壇画の中央部分。別の同名作と区別。出典・画像ライセンス：Wikimedia Commons。"
    }
  ],
  "ar-vandyck": [
    {
      "id": "verified-img-9",
      "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Anthony_van_Dyck_-_Charles_I_at_the_Hunt.jpg?width=960",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Anthony_van_Dyck_-_Charles_I_at_the_Hunt.jpg",
      "author": "原作品作者：ファン＝ダイク。画像：原作品の忠実な複製",
      "license": "Public Domain Mark 1.0",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "caption": "狩猟姿のチャールズ1世。ルーヴル美術館所蔵、所蔵品番号INV 1236。出典・画像ライセンス：Wikimedia Commons。"
    }
  ],
  "ar-velazquez": [
    {
      "id": "verified-img-10",
      "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Diego_Vel%C3%A1zquez_-_Las_Meninas.jpg?width=960",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Diego_Vel%C3%A1zquez_-_Las_Meninas.jpg",
      "author": "原作品作者：ベラスケス。画像：原作品の忠実な複製",
      "license": "Public Domain Mark 1.0",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "caption": "ラス＝メニーナス（女官たち）。プラド美術館所蔵。出典・画像ライセンス：Wikimedia Commons。"
    }
  ],
  "ar-murillo": [
    {
      "id": "verified-img-11",
      "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Bartolom%C3%A9_Esteban_Perez_Murillo_-_The_Young_Beggar.jpg?width=960",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Bartolom%C3%A9_Esteban_Perez_Murillo_-_The_Young_Beggar.jpg",
      "author": "原作品作者：ムリーリョ。画像：原作品の忠実な複製",
      "license": "Public Domain Mark 1.0",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "caption": "乞食の少年。ルーヴル美術館所蔵。出典・画像ライセンス：Wikimedia Commons。"
    }
  ],
  "a-david": [
    {
      "id": "verified-img-12",
      "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Jacques-Louis_David%2C_The_Coronation_of_Napoleon.jpg?width=960",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Jacques-Louis_David%2C_The_Coronation_of_Napoleon.jpg",
      "author": "原作品作者：ダヴィド。画像：原作品の忠実な複製",
      "license": "Public Domain Mark 1.0",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "caption": "ナポレオン1世の戴冠式。ルーヴル美術館所蔵の原作。出典・画像ライセンス：Wikimedia Commons。"
    }
  ],
  "a-courbet": [
    {
      "id": "verified-img-13",
      "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Gustave_Courbet_-_The_Stonebreakers_-_WGA05457.jpg?width=960",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Gustave_Courbet_-_The_Stonebreakers_-_WGA05457.jpg",
      "author": "原作品作者：クールベ。画像：原作品の忠実な複製",
      "license": "Public Domain Mark 1.0",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "caption": "石割り。1849年頃の作品。1945年のドレスデン爆撃で失われた原画の複製画像。出典・画像ライセンス：Wikimedia Commons。"
    }
  ],
  "a-manet": [
    {
      "id": "verified-img-14",
      "url": "https://commons.wikimedia.org/wiki/Special:FilePath/%C3%89douard_Manet_-_The_Luncheon_on_the_Grass.jpeg?width=960",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:%C3%89douard_Manet_-_The_Luncheon_on_the_Grass.jpeg",
      "author": "原作品作者：マネ。画像：原作品の忠実な複製",
      "license": "Public Domain Mark 1.0",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "caption": "草上の昼食。オルセー美術館所蔵。出典・画像ライセンス：Wikimedia Commons。"
    }
  ],
  "a-renoir": [
    {
      "id": "verified-img-15",
      "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Pierre-Auguste_Renoir_-_Bal_du_moulin_de_la_Galette.jpeg?width=960",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Pierre-Auguste_Renoir_-_Bal_du_moulin_de_la_Galette.jpeg",
      "author": "原作品作者：ルノワール。画像：原作品の忠実な複製",
      "license": "Public Domain Mark 1.0",
      "licenseUrl": "https://creativecommons.org/publicdomain/mark/1.0/",
      "caption": "ムーラン＝ド＝ラ＝ギャレット。オルセー美術館所蔵、1876年の絵画。出典・画像ライセンス：Wikimedia Commons。"
    }
  ],
  "ro-colosseum": [
    {
      "id": "verified-img-16",
      "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Photo_of_The_Colosseum_in_Rome%2C_Italy.jpg?width=960",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Photo_of_The_Colosseum_in_Rome%2C_Italy.jpg",
      "author": "撮影：Minimum-herb",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
      "caption": "コロッセウム。撮影：Minimum-herb。ローマのフラウィウス円形闘技場。出典・画像ライセンス：Wikimedia Commons。"
    }
  ],
  "ro-pantheon": [
    {
      "id": "verified-img-17",
      "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Pantheon_(Rome)_interior.jpg?width=960",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Pantheon_(Rome)_interior.jpg",
      "author": "撮影：Uhooep",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
      "caption": "パンテオン。撮影：Uhooep。古代ローマのパンテオン内陣。パルテノン神殿と異なる。出典・画像ライセンス：Wikimedia Commons。"
    }
  ],
  "md-notredame": [
    {
      "id": "verified-img-18",
      "url": "https://commons.wikimedia.org/wiki/Special:FilePath/West_facade_of_Notre-Dame_de_Paris.jpg?width=960",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:West_facade_of_Notre-Dame_de_Paris.jpg",
      "author": "撮影：Yair Haklai",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
      "caption": "ノートルダム大聖堂（パリ）。撮影：Yair Haklai。パリのシテ島のゴシック大聖堂の西正面。出典・画像ライセンス：Wikimedia Commons。"
    }
  ],
  "md-chartres": [
    {
      "id": "verified-img-19",
      "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Chartres_cath%C3%A9drale_facade.jpg?width=960",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Chartres_cath%C3%A9drale_facade.jpg",
      "author": "撮影：Cdiguet",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
      "caption": "シャルトル大聖堂。撮影：Cdiguet。フランス・シャルトルの大聖堂西正面。出典・画像ライセンス：Wikimedia Commons。"
    }
  ],
  "rn-brunelleschi": [
    {
      "id": "verified-img-20",
      "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Brunelleschi's_Dome%2C_Florence_Cathedral.jpg?width=960",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Brunelleschi's_Dome%2C_Florence_Cathedral.jpg",
      "author": "撮影：Thomas Roessler",
      "license": "CC BY-SA 3.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/",
      "caption": "フィレンツェ大聖堂のドーム。撮影：Thomas Roessler。フィレンツェ大聖堂の大ドーム。出典・画像ライセンス：Wikimedia Commons。"
    }
  ],
  "ar-versailles": [
    {
      "id": "verified-img-21",
      "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Front_of_the_Palace_of_Versailles.jpg?width=960",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Front_of_the_Palace_of_Versailles.jpg",
      "author": "撮影：DiscoA340",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
      "caption": "ヴェルサイユ宮殿。撮影：DiscoA340。建造物・写真利用条件：Wikimedia Commons。"
    }
  ],
  "he-venus-milo": [
    {
      "id": "verified-img-22",
      "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Venus_de_Milo-Louvre.jpg?width=960",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Venus_de_Milo-Louvre.jpg",
      "author": "撮影：Yair Haklai",
      "license": "Public domain (dedicated by photographer)",
      "licenseUrl": "https://commons.wikimedia.org/wiki/File:Venus_de_Milo-Louvre.jpg",
      "caption": "ミロのヴィーナス。撮影：Yair Haklai。ルーヴル美術館所蔵。出典・画像ライセンス：Wikimedia Commons。"
    }
  ],
  "he-laocoon": [
    {
      "id": "verified-img-23",
      "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Laokoon_in_Vatican.jpg?width=960",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Laokoon_in_Vatican.jpg",
      "author": "撮影：Vitold Muratov",
      "license": "CC BY-SA 4.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
      "caption": "ラオコーン群像。撮影：Vitold Muratov。ヴァチカン美術館の彫刻。出典・画像ライセンス：Wikimedia Commons。"
    }
  ],
  "he-samothrace-nike": [
    {
      "id": "verified-img-24",
      "url": "https://commons.wikimedia.org/wiki/Special:FilePath/Victoire_de_Samothrace_-_Mus%C3%A9e_du_Louvre.jpg?width=960",
      "sourceUrl": "https://commons.wikimedia.org/wiki/File:Victoire_de_Samothrace_-_Mus%C3%A9e_du_Louvre.jpg",
      "author": "撮影：Shonagon",
      "license": "CC0 1.0",
      "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
      "caption": "サモトラケのニケ。撮影：Shonagon。ルーヴル美術館所蔵、CC0指定。出典・画像ライセンス：Wikimedia Commons。"
    }
  ]
};
export const visualCards: Card[] = [
  {
    "id": "visual-verified-img-1-work",
    "knowledgeId": "rn-leonardo",
    "type": "image",
    "question": "画像の絵画の作品名は？",
    "answer": "モナ＝リザ",
    "explanation": "モナ＝リザ。ルーヴル美術館所蔵。元画像：Musée du Louvre。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-1",
    "fallbackPrompt": "レオナルド＝ダ＝ヴィンチが描いた、ルーヴル美術館所蔵の有名な女性肖像画は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-1-author",
    "knowledgeId": "rn-leonardo",
    "type": "image",
    "question": "画像の絵画の作者は？",
    "answer": "レオナルド＝ダ＝ヴィンチ",
    "explanation": "モナ＝リザ。ルーヴル美術館所蔵。元画像：Musée du Louvre。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-1",
    "fallbackPrompt": "「モナ＝リザ」の作者は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-2-work",
    "knowledgeId": "rn-leonardo",
    "type": "image",
    "question": "画像の絵画の作品名は？",
    "answer": "最後の晩餐",
    "explanation": "最後の晩餐。サンタ＝マリア＝デッレ＝グラツィエ修道院の壁画。複製写真：Paris Orlando。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-2",
    "fallbackPrompt": "レオナルド＝ダ＝ヴィンチがミラノの修道院の食堂に描いた壁画は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-2-author",
    "knowledgeId": "rn-leonardo",
    "type": "image",
    "question": "画像の絵画の作者は？",
    "answer": "レオナルド＝ダ＝ヴィンチ",
    "explanation": "最後の晩餐。サンタ＝マリア＝デッレ＝グラツィエ修道院の壁画。複製写真：Paris Orlando。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-2",
    "fallbackPrompt": "「最後の晩餐」の作者は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-3-work",
    "knowledgeId": "rn-michelangelo",
    "type": "image",
    "question": "画像の絵画の作品名は？",
    "answer": "最後の審判",
    "explanation": "最後の審判。システィナ礼拝堂祭壇壁面の壁画。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-3",
    "fallbackPrompt": "ミケランジェロがシスティナ礼拝堂の祭壇壁面に描いた大作は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-3-author",
    "knowledgeId": "rn-michelangelo",
    "type": "image",
    "question": "画像の絵画の作者は？",
    "answer": "ミケランジェロ",
    "explanation": "最後の審判。システィナ礼拝堂祭壇壁面の壁画。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-3",
    "fallbackPrompt": "「最後の審判」の作者は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-4-work",
    "knowledgeId": "rn-michelangelo",
    "type": "image",
    "question": "画像の絵画の作品名は？",
    "answer": "アダムの創造",
    "explanation": "アダムの創造。システィナ礼拝堂天井画の一部。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-4",
    "fallbackPrompt": "ミケランジェロの天井画で神と最初の人間の指先が接近する場面の題名は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-4-author",
    "knowledgeId": "rn-michelangelo",
    "type": "image",
    "question": "画像の絵画の作者は？",
    "answer": "ミケランジェロ",
    "explanation": "アダムの創造。システィナ礼拝堂天井画の一部。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-4",
    "fallbackPrompt": "「アダムの創造」の作者は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-5-work",
    "knowledgeId": "rn-botticelli",
    "type": "image",
    "question": "画像の絵画の作品名は？",
    "answer": "春（プリマヴェーラ）",
    "explanation": "春（プリマヴェーラ）。ウフィツィ美術館所蔵。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-5",
    "fallbackPrompt": "ボッティチェリが描いた、ヴィーナスと春の神々を配したウフィツィ美術館の作品は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-5-author",
    "knowledgeId": "rn-botticelli",
    "type": "image",
    "question": "画像の絵画の作者は？",
    "answer": "ボッティチェリ",
    "explanation": "春（プリマヴェーラ）。ウフィツィ美術館所蔵。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-5",
    "fallbackPrompt": "「春（プリマヴェーラ）」の作者は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-6-work",
    "knowledgeId": "nr-jan-van-eyck",
    "type": "image",
    "question": "画像の絵画の作品名は？",
    "answer": "アルノルフィーニ夫妻像",
    "explanation": "アルノルフィーニ夫妻像。ロンドン・ナショナル・ギャラリー所蔵。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-6",
    "fallbackPrompt": "ファン＝エイクが1434年に鏡のある室内で男女を描いた絵は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-6-author",
    "knowledgeId": "nr-jan-van-eyck",
    "type": "image",
    "question": "画像の絵画の作者は？",
    "answer": "ヤン＝ファン＝エイク",
    "explanation": "アルノルフィーニ夫妻像。ロンドン・ナショナル・ギャラリー所蔵。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-6",
    "fallbackPrompt": "「アルノルフィーニ夫妻像」の作者は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-7-work",
    "knowledgeId": "nr-holbein",
    "type": "image",
    "question": "画像の絵画の作品名は？",
    "answer": "大使たち",
    "explanation": "大使たち。ロンドン・ナショナル・ギャラリー所蔵。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-7",
    "fallbackPrompt": "ホルバインが1533年に2人の人物と歪んだ骸骨を描いた絵は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-7-author",
    "knowledgeId": "nr-holbein",
    "type": "image",
    "question": "画像の絵画の作者は？",
    "answer": "ハンス＝ホルバイン（子）",
    "explanation": "大使たち。ロンドン・ナショナル・ギャラリー所蔵。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-7",
    "fallbackPrompt": "「大使たち」の作者は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-8-work",
    "knowledgeId": "ar-rubens",
    "type": "image",
    "question": "画像の絵画の作品名は？",
    "answer": "キリスト降架（アントウェルペン大聖堂）",
    "explanation": "キリスト降架（アントウェルペン大聖堂）。アントウェルペン大聖堂の『キリスト降架』三連祭壇画の中央部分。別の同名作と区別。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-8",
    "fallbackPrompt": "ルーベンスがアントウェルペンの大聖堂の祭壇に描いたキリストを十字架から降ろす場面は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-8-author",
    "knowledgeId": "ar-rubens",
    "type": "image",
    "question": "画像の絵画の作者は？",
    "answer": "ルーベンス",
    "explanation": "キリスト降架（アントウェルペン大聖堂）。アントウェルペン大聖堂の『キリスト降架』三連祭壇画の中央部分。別の同名作と区別。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-8",
    "fallbackPrompt": "「キリスト降架（アントウェルペン大聖堂）」の作者は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-9-work",
    "knowledgeId": "ar-vandyck",
    "type": "image",
    "question": "画像の絵画の作品名は？",
    "answer": "狩猟姿のチャールズ1世",
    "explanation": "狩猟姿のチャールズ1世。ルーヴル美術館所蔵、所蔵品番号INV 1236。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-9",
    "fallbackPrompt": "ファン＝ダイクが狩りをするイングランド王を描いた肖像画は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-9-author",
    "knowledgeId": "ar-vandyck",
    "type": "image",
    "question": "画像の絵画の作者は？",
    "answer": "ファン＝ダイク",
    "explanation": "狩猟姿のチャールズ1世。ルーヴル美術館所蔵、所蔵品番号INV 1236。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-9",
    "fallbackPrompt": "「狩猟姿のチャールズ1世」の作者は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-10-work",
    "knowledgeId": "ar-velazquez",
    "type": "image",
    "question": "画像の絵画の作品名は？",
    "answer": "ラス＝メニーナス（女官たち）",
    "explanation": "ラス＝メニーナス（女官たち）。プラド美術館所蔵。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-10",
    "fallbackPrompt": "ベラスケスがスペイン王宮の王女や侍女を描いた代表作は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-10-author",
    "knowledgeId": "ar-velazquez",
    "type": "image",
    "question": "画像の絵画の作者は？",
    "answer": "ベラスケス",
    "explanation": "ラス＝メニーナス（女官たち）。プラド美術館所蔵。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-10",
    "fallbackPrompt": "「ラス＝メニーナス（女官たち）」の作者は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-11-work",
    "knowledgeId": "ar-murillo",
    "type": "image",
    "question": "画像の絵画の作品名は？",
    "answer": "乞食の少年",
    "explanation": "乞食の少年。ルーヴル美術館所蔵。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-11",
    "fallbackPrompt": "ムリーリョが街角の貧しい少年を描いた風俗画は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-11-author",
    "knowledgeId": "ar-murillo",
    "type": "image",
    "question": "画像の絵画の作者は？",
    "answer": "ムリーリョ",
    "explanation": "乞食の少年。ルーヴル美術館所蔵。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-11",
    "fallbackPrompt": "「乞食の少年」の作者は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-12-work",
    "knowledgeId": "a-david",
    "type": "image",
    "question": "画像の絵画の作品名は？",
    "answer": "ナポレオン1世の戴冠式",
    "explanation": "ナポレオン1世の戴冠式。ルーヴル美術館所蔵の原作。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-12",
    "fallbackPrompt": "ダヴィドがナポレオン1世と皇妃の儀式を描いた大作の題名は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-12-author",
    "knowledgeId": "a-david",
    "type": "image",
    "question": "画像の絵画の作者は？",
    "answer": "ダヴィド",
    "explanation": "ナポレオン1世の戴冠式。ルーヴル美術館所蔵の原作。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-12",
    "fallbackPrompt": "「ナポレオン1世の戴冠式」の作者は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-13-work",
    "knowledgeId": "a-courbet",
    "type": "image",
    "question": "画像の絵画の作品名は？",
    "answer": "石割り",
    "explanation": "石割り。1849年頃の作品。1945年のドレスデン爆撃で失われた原画の複製画像。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-13",
    "fallbackPrompt": "クールベが道路工事をする労働者の姿を描いた作品は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-13-author",
    "knowledgeId": "a-courbet",
    "type": "image",
    "question": "画像の絵画の作者は？",
    "answer": "クールベ",
    "explanation": "石割り。1849年頃の作品。1945年のドレスデン爆撃で失われた原画の複製画像。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-13",
    "fallbackPrompt": "「石割り」の作者は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-14-work",
    "knowledgeId": "a-manet",
    "type": "image",
    "question": "画像の絵画の作品名は？",
    "answer": "草上の昼食",
    "explanation": "草上の昼食。オルセー美術館所蔵。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-14",
    "fallbackPrompt": "マネが森の草地で過ごす男女を描いた1863年の作品は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-14-author",
    "knowledgeId": "a-manet",
    "type": "image",
    "question": "画像の絵画の作者は？",
    "answer": "マネ",
    "explanation": "草上の昼食。オルセー美術館所蔵。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-14",
    "fallbackPrompt": "「草上の昼食」の作者は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-15-work",
    "knowledgeId": "a-renoir",
    "type": "image",
    "question": "画像の絵画の作品名は？",
    "answer": "ムーラン＝ド＝ラ＝ギャレット",
    "explanation": "ムーラン＝ド＝ラ＝ギャレット。オルセー美術館所蔵、1876年の絵画。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-15",
    "fallbackPrompt": "ルノワールがモンマルトルの屋外ダンス場のにぎわいを描いた絵は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-15-author",
    "knowledgeId": "a-renoir",
    "type": "image",
    "question": "画像の絵画の作者は？",
    "answer": "ルノワール",
    "explanation": "ムーラン＝ド＝ラ＝ギャレット。オルセー美術館所蔵、1876年の絵画。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-15",
    "fallbackPrompt": "「ムーラン＝ド＝ラ＝ギャレット」の作者は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-16-identify",
    "knowledgeId": "ro-colosseum",
    "type": "image",
    "question": "画像の建築物の名称は？",
    "answer": "コロッセウム",
    "explanation": "コロッセウム。撮影：Minimum-herb。ローマのフラウィウス円形闘技場。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-16",
    "fallbackPrompt": "ローマの剣闘士競技などに用いられた巨大な円形闘技場は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-17-identify",
    "knowledgeId": "ro-pantheon",
    "type": "image",
    "question": "画像の建築物の名称は？",
    "answer": "パンテオン",
    "explanation": "パンテオン。撮影：Uhooep。古代ローマのパンテオン内陣。パルテノン神殿と異なる。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-17",
    "fallbackPrompt": "ローマに現存する巨大なドームと円形の天窓を持つ神殿は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-18-identify",
    "knowledgeId": "md-notredame",
    "type": "image",
    "question": "画像の建築物の名称は？",
    "answer": "ノートルダム大聖堂（パリ）",
    "explanation": "ノートルダム大聖堂（パリ）。撮影：Yair Haklai。パリのシテ島のゴシック大聖堂の西正面。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-18",
    "fallbackPrompt": "パリのシテ島にある代表的なゴシック大聖堂は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-18-style",
    "knowledgeId": "md-notredame",
    "type": "image",
    "question": "画像の大聖堂に代表される建築様式は？",
    "answer": "ゴシック様式",
    "explanation": "ノートルダム大聖堂（パリ）。撮影：Yair Haklai。パリのシテ島のゴシック大聖堂の西正面。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-18",
    "fallbackPrompt": "ノートルダム大聖堂（パリ）を代表とする中世の建築様式は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-19-identify",
    "knowledgeId": "md-chartres",
    "type": "image",
    "question": "画像の建築物の名称は？",
    "answer": "シャルトル大聖堂",
    "explanation": "シャルトル大聖堂。撮影：Cdiguet。フランス・シャルトルの大聖堂西正面。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-19",
    "fallbackPrompt": "ステンドグラスで有名なフランスのゴシック大聖堂は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-19-style",
    "knowledgeId": "md-chartres",
    "type": "image",
    "question": "画像の大聖堂に代表される建築様式は？",
    "answer": "ゴシック様式",
    "explanation": "シャルトル大聖堂。撮影：Cdiguet。フランス・シャルトルの大聖堂西正面。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-19",
    "fallbackPrompt": "シャルトル大聖堂を代表とする中世の建築様式は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-20-identify",
    "knowledgeId": "rn-brunelleschi",
    "type": "image",
    "question": "画像の建築物の名称は？",
    "answer": "フィレンツェ大聖堂のドーム",
    "explanation": "フィレンツェ大聖堂のドーム。撮影：Thomas Roessler。フィレンツェ大聖堂の大ドーム。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-20",
    "fallbackPrompt": "ブルネレスキが設計したフィレンツェの大聖堂の特徴的な建築部分は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-20-architect",
    "knowledgeId": "rn-brunelleschi",
    "type": "image",
    "question": "画像の大ドームを設計した建築家は？",
    "answer": "ブルネレスキ",
    "explanation": "フィレンツェ大聖堂のドーム。撮影：Thomas Roessler。フィレンツェ大聖堂の大ドーム。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-20",
    "fallbackPrompt": "フィレンツェ大聖堂の大ドームを設計した人物は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-21-identify",
    "knowledgeId": "ar-versailles",
    "type": "image",
    "question": "画像の建築物の名称は？",
    "answer": "ヴェルサイユ宮殿",
    "explanation": "ヴェルサイユ宮殿。ヴェルサイユ宮殿の外観、公開者によるパブリックドメイン宣言。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-21",
    "fallbackPrompt": "ルイ14世の王権を象徴したパリ郊外の壮麗な宮殿は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-22-identify",
    "knowledgeId": "he-venus-milo",
    "type": "image",
    "question": "画像の彫刻の名称は？",
    "answer": "ミロのヴィーナス",
    "explanation": "ミロのヴィーナス。撮影：Yair Haklai。ルーヴル美術館所蔵。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-22",
    "fallbackPrompt": "ミロ島で発見された、腕を欠く女性の大理石像は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-23-identify",
    "knowledgeId": "he-laocoon",
    "type": "image",
    "question": "画像の彫刻の名称は？",
    "answer": "ラオコーン群像",
    "explanation": "ラオコーン群像。撮影：Vitold Muratov。ヴァチカン美術館の彫刻。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-23",
    "fallbackPrompt": "蛇に巻かれた神官と息子たちを表す古代彫刻群は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-verified-img-24-identify",
    "knowledgeId": "he-samothrace-nike",
    "type": "image",
    "question": "画像の彫刻の名称は？",
    "answer": "サモトラケのニケ",
    "explanation": "サモトラケのニケ。撮影：Shonagon。ルーヴル美術館所蔵、CC0指定。画像の特定・撮影条件・出典は項目内の画像リンクを参照。",
    "imageId": "verified-img-24",
    "fallbackPrompt": "サモトラケ島で発見された翼を持つ勝利の女神の大理石像は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-img-venus-botticelli-commons-author",
    "knowledgeId": "rn-botticelli",
    "type": "image",
    "question": "画像の作品の作者は？",
    "answer": "ボッティチェリ",
    "explanation": "『ヴィーナスの誕生』の制作者。画像・ライセンスは既存データの出典欄を参照。",
    "imageId": "img-venus-botticelli-commons",
    "fallbackPrompt": "『ヴィーナスの誕生』を制作した人物は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-img-school-athens-commons-author",
    "knowledgeId": "rn-raphael",
    "type": "image",
    "question": "画像の作品の作者は？",
    "answer": "ラファエロ",
    "explanation": "『アテネの学堂』の制作者。画像・ライセンスは既存データの出典欄を参照。",
    "imageId": "img-school-athens-commons",
    "fallbackPrompt": "『アテネの学堂』を制作した人物は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-img-nr-bruegel-author",
    "knowledgeId": "nr-bruegel",
    "type": "image",
    "question": "画像の作品の作者は？",
    "answer": "ピーテル＝ブリューゲル（父）",
    "explanation": "『農民の踊り』の制作者。画像・ライセンスは既存データの出典欄を参照。",
    "imageId": "img-nr-bruegel",
    "fallbackPrompt": "『農民の踊り』を制作した人物は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-img-nr-durer-author",
    "knowledgeId": "nr-durer",
    "type": "image",
    "question": "画像の作品の作者は？",
    "answer": "デューラー",
    "explanation": "『四人の使徒』の制作者。画像・ライセンスは既存データの出典欄を参照。",
    "imageId": "img-nr-durer",
    "fallbackPrompt": "『四人の使徒』を制作した人物は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-img-ar-rembrandt-author",
    "knowledgeId": "ar-rembrandt",
    "type": "image",
    "question": "画像の作品の作者は？",
    "answer": "レンブラント",
    "explanation": "『夜警』の制作者。画像・ライセンスは既存データの出典欄を参照。",
    "imageId": "img-ar-rembrandt",
    "fallbackPrompt": "『夜警』を制作した人物は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-img-ar-vermeer-author",
    "knowledgeId": "ar-vermeer",
    "type": "image",
    "question": "画像の作品の作者は？",
    "answer": "フェルメール",
    "explanation": "『真珠の耳飾りの少女』の制作者。画像・ライセンスは既存データの出典欄を参照。",
    "imageId": "img-ar-vermeer",
    "fallbackPrompt": "『真珠の耳飾りの少女』を制作した人物は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-img-ar-watteau-author",
    "knowledgeId": "ar-watteau",
    "type": "image",
    "question": "画像の作品の作者は？",
    "answer": "ヴァトー",
    "explanation": "『シテール島への船出』の制作者。画像・ライセンスは既存データの出典欄を参照。",
    "imageId": "img-ar-watteau",
    "fallbackPrompt": "『シテール島への船出』を制作した人物は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-img-a-delacroix-author",
    "knowledgeId": "a-delacroix",
    "type": "image",
    "question": "画像の作品の作者は？",
    "answer": "ドラクロワ",
    "explanation": "『民衆を導く自由の女神』の制作者。画像・ライセンスは既存データの出典欄を参照。",
    "imageId": "img-a-delacroix",
    "fallbackPrompt": "『民衆を導く自由の女神』を制作した人物は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-img-a-goya-author",
    "knowledgeId": "a-goya",
    "type": "image",
    "question": "画像の作品の作者は？",
    "answer": "ゴヤ",
    "explanation": "『1808年5月3日』の制作者。画像・ライセンスは既存データの出典欄を参照。",
    "imageId": "img-a-goya",
    "fallbackPrompt": "『1808年5月3日』を制作した人物は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-img-a-millet-author",
    "knowledgeId": "a-millet",
    "type": "image",
    "question": "画像の作品の作者は？",
    "answer": "ミレー",
    "explanation": "『落穂拾い』の制作者。画像・ライセンスは既存データの出典欄を参照。",
    "imageId": "img-a-millet",
    "fallbackPrompt": "『落穂拾い』を制作した人物は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-img-a-monet-author",
    "knowledgeId": "a-monet",
    "type": "image",
    "question": "画像の作品の作者は？",
    "answer": "モネ",
    "explanation": "『印象・日の出』の制作者。画像・ライセンスは既存データの出典欄を参照。",
    "imageId": "img-a-monet",
    "fallbackPrompt": "『印象・日の出』を制作した人物は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-img-a-cezanne-author",
    "knowledgeId": "a-cezanne",
    "type": "image",
    "question": "画像の作品の作者は？",
    "answer": "セザンヌ",
    "explanation": "『サン＝ヴィクトワール山』の制作者。画像・ライセンスは既存データの出典欄を参照。",
    "imageId": "img-a-cezanne",
    "fallbackPrompt": "『サン＝ヴィクトワール山』を制作した人物は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-img-a-vangogh-author",
    "knowledgeId": "a-vangogh",
    "type": "image",
    "question": "画像の作品の作者は？",
    "answer": "ゴッホ",
    "explanation": "『ひまわり』の制作者。画像・ライセンスは既存データの出典欄を参照。",
    "imageId": "img-a-vangogh",
    "fallbackPrompt": "『ひまわり』を制作した人物は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  },
  {
    "id": "visual-img-a-rodin-author",
    "knowledgeId": "a-rodin",
    "type": "image",
    "question": "画像の彫刻を制作した人物は？",
    "answer": "ロダン",
    "explanation": "『考える人』の制作者。画像・ライセンスは既存データの出典欄を参照。",
    "imageId": "img-a-rodin",
    "fallbackPrompt": "『考える人』を制作した人物は？",
    "updatedAt": "2026-11-09T10:11:32.471Z",
    "version": 1,
    "deleted": false
  }
];
export const difficultyPatches: Record<string, {level: Level; why: string}> = {
  "gr-thucydides": {
    "level": 2,
    "why": "古典古代の代表的な歴史家。史書・著者対応は難関向けの細部専用ではない。"
  },
  "he-venus-milo": {
    "level": 1,
    "why": "ヘレニズム彫刻の代表作品で画像識別の基本。"
  },
  "he-samothrace-nike": {
    "level": 2,
    "why": "ヘレニズム彫刻の代表作品。識別対象は標準的な文化史項目。"
  },
  "ro-suetonius": {
    "level": 4,
    "why": "ローマ皇帝伝の著者という限定的な知識。文化史の細部用語。"
  },
  "ro-strabo": {
    "level": 4,
    "why": "地理誌の著者としての古典地理学者は細部用語。"
  },
  "md-worms": {
    "level": 4,
    "why": "ロマネスク建築の個別事例として比較的細部。"
  },
  "md-toledo-translations": {
    "level": 4,
    "why": "トレドでの翻訳活動に関する都市と文化の組合せは周辺的。"
  },
  "md-amiens": {
    "level": 3,
    "why": "ゴシック大聖堂の具体例。主要様式の名称より細部。"
  },
  "md-ockham": {
    "level": 3,
    "why": "普遍論争の後期学者名。"
  },
  "md-roger-bacon": {
    "level": 3,
    "why": "スコラ学後期の個別人物。"
  },
  "rn-cosimo-medici": {
    "level": 3,
    "why": "メディチ家の個人別識別。"
  },
  "rn-bramante": {
    "level": 3,
    "why": "サン＝ピエトロ大聖堂計画の関係者としての個人識別。"
  },
  "nr-holbein": {
    "level": 3,
    "why": "北方ルネサンスの画家名・作品対応。"
  },
  "nr-jan-van-eyck": {
    "level": 2,
    "why": "フランドルの油彩画家として重要。"
  },
  "po-bossuet": {
    "level": 3,
    "why": "王権神授説の主唱者のうち特定の聖職者名。"
  },
  "po-dalembert": {
    "level": 3,
    "why": "百科全書の共同編集者という細部。"
  },
  "lt-thackeray": {
    "level": 4,
    "why": "19世紀英小説『虚栄の市』の作者は細部用語。"
  },
  "lt-strindberg": {
    "level": 4,
    "why": "『令嬢ジュリー』の劇作家は細部用語。"
  },
  "ar-murillo": {
    "level": 4,
    "why": "スペイン・バロック絵画の周辺的画家名。"
  },
  "ar-rubens": {
    "level": 2,
    "why": "バロック絵画を代表する画家。"
  },
  "a-siqueiros": {
    "level": 4,
    "why": "メキシコ壁画運動の個別画家名。"
  },
  "mu-schoenberg": {
    "level": 3,
    "why": "20世紀音楽の十二音技法に対応する人物名。"
  },
  "ph-herbert-spencer": {
    "level": 3,
    "why": "実証主義から社会進化論への周辺人物。"
  },
  "ec-list": {
    "level": 3,
    "why": "歴史学派経済学・保護貿易論の個別人物。"
  },
  "ss-savigny": {
    "level": 4,
    "why": "歴史法学派の代表者の個人名は細部用語。"
  },
  "ss-said": {
    "level": 4,
    "why": "ポストコロニアル批評の代表者と書名の対応。"
  },
  "so-fourier": {
    "level": 3,
    "why": "初期社会主義の人物と共同体構想。"
  },
  "s-mayer": {
    "level": 4,
    "why": "エネルギー保存則発見史の個別人物。"
  },
  "x-peary": {
    "level": 4,
    "why": "北極点到達主張の真偽を含めた細部知識。"
  },
  "md-chartres": {
    "level": 2,
    "why": "ゴシック建築の代表的具体例。"
  },
  "ar-versailles": {
    "level": 1,
    "why": "絶対王政・バロックの基礎的建築例。"
  },
  "ar-watteau": {
    "level": 2,
    "why": "ロココの代表画家。"
  },
  "ro-polybius": {
    "level": 3,
    "why": "ローマ帝国台頭の史書著者。"
  },
  "ro-livy": {
    "level": 2,
    "why": "ローマ建国史を著した歴史家は標準私大文化史の細部。"
  },
  "rn-leonardo": {
    "level": 1,
    "why": "ルネサンス美術の代表。"
  },
  "rn-michelangelo": {
    "level": 1,
    "why": "ルネサンス美術の代表。"
  },
  "rn-botticelli": {
    "level": 2,
    "why": "ルネサンス絵画の代表作品・作者。"
  },
  "a-renoir": {
    "level": 2,
    "why": "印象派の代表画家。"
  },
  "a-david": {
    "level": 2,
    "why": "新古典主義・ナポレオンの肖像画。"
  },
  "nr-francis-i": {
    "level": 2,
    "why": "フランスのルネサンス保護者として比較的基本。"
  },
  "rn-bruno": {
    "level": 4,
    "why": "16世紀の宇宙観をめぐる哲学史の周辺人物。"
  },
  "md-cambridge": {
    "level": 3,
    "why": "中世大学史の個別大学。"
  },
  "md-salerno": {
    "level": 3,
    "why": "中世大学史における医学専門教育機関。"
  },
  "ss-spengler": {
    "level": 3,
    "why": "『西洋の没落』の作者と歴史哲学。"
  },
  "lt-rimbaud": {
    "level": 3,
    "why": "象徴主義の詩人。"
  },
  "nr-rabelais": {
    "level": 3,
    "why": "フランス人文主義の個別作家と長編作品の対応。"
  },
  "en-chinoiserie": {
    "level": 3,
    "why": "欧州の中国趣味という装飾用語。汎用的基礎知識より細部。"
  },
  "en-academie-francaise": {
    "level": 3,
    "why": "特定の学術団体と成立年の対応。"
  },
  "po-bodin": {
    "level": 3,
    "why": "近世主権論の『国家論』という特定思想家・著作対応。"
  },
  "lt-wordsworth": {
    "level": 3,
    "why": "イギリス・ロマン派の個別詩人と共同詩集。"
  },
  "lt-whitman": {
    "level": 3,
    "why": "アメリカ詩の個別人物と詩集。"
  },
  "lt-rolland": {
    "level": 3,
    "why": "20世紀フランス文学の長編小説と作者。"
  },
  "lt-orwell": {
    "level": 3,
    "why": "スペイン内戦に関する特定著作と作者。"
  },
  "ar-sanssouci": {
    "level": 3,
    "why": "ロココ建築の個別宮殿と建設した君主の対応。"
  },
  "mu-debussy": {
    "level": 3,
    "why": "19〜20世紀の印象主義音楽における個別作曲家。"
  },
  "ph-js-mill": {
    "level": 3,
    "why": "功利主義の質的区別と思想家の対応。"
  },
  "ss-ranke": {
    "level": 3,
    "why": "19世紀ドイツ史学・史料批判の学者名。"
  },
  "so-proudhon": {
    "level": 3,
    "why": "初期無政府主義の特定著作と人物。"
  },
  "so-bakunin": {
    "level": 3,
    "why": "第一インターナショナル内の思想対立に関わる人物名。"
  },
  "sc-huygens": {
    "level": 3,
    "why": "振り子時計・光の波動説の個別科学者。"
  },
  "s-pierre-curie": {
    "level": 3,
    "why": "キュリー夫妻を分離して人物と業績を問う細部。"
  },
  "s-liebig": {
    "level": 3,
    "why": "有機化学・農芸化学の特定学者名。"
  },
  "s-daimler": {
    "level": 3,
    "why": "自動車史の個別技術者の識別。"
  },
  "s-diesel": {
    "level": 3,
    "why": "内燃機関史の個別技術者の識別。"
  },
  "s-heisenberg": {
    "level": 3,
    "why": "量子力学史の不確定性原理の特定人物。"
  },
  "x-tasman": {
    "level": 3,
    "why": "17世紀オセアニア探検の個別航海者。"
  },
  "x-scott": {
    "level": 3,
    "why": "南極点到達競争の探検家の識別。"
  },
  "md-nibelungen": {
    "level": 3,
    "why": "中世ドイツの特定英雄叙事詩。"
  },
  "ro-plutarch": {
    "level": 3,
    "why": "帝政ローマ期のギリシア語の人物伝著者。"
  },
  "md-anselm": {
    "level": 3,
    "why": "中世スコラ学の実在論側の人物名と神の証明。"
  },
  "en-coffeehouse": {
    "level": 3,
    "why": "17〜18世紀イギリスの社交史の具体的施設区分。"
  }
};

export function applyVisualPatches(items: KnowledgeItem[]): KnowledgeItem[] {
  return items.map(item => {
    const images = visualImagePatches[item.id] ?? [];
    const difficulty = difficultyPatches[item.id];
    // Earlier thumbnail URLs contained fixed hashes that can become stale.
    // Link those verified Commons files by their canonical file names instead.
    const existingImages = item.images.map(asset => {
      const prefix = 'https://commons.wikimedia.org/wiki/File:';
      if (!asset.url.startsWith('https://upload.wikimedia.org/') || !asset.sourceUrl.startsWith(prefix)) return asset;
      return {...asset, url: 'https://commons.wikimedia.org/wiki/Special:FilePath/' + asset.sourceUrl.slice(prefix.length) + '?width=960'};
    });
    const legacyImageChanged = existingImages.some((asset, index) => asset !== item.images[index]);
    if (!images.length && !legacyImageChanged && (!difficulty || difficulty.level === item.level)) return item;
    const officialRecords: Record<string, {title:string;url:string}[]> = {
      'rn-leonardo': [{title:'ルーヴル美術館：モナ＝リザ',url:'https://collections.louvre.fr/en/ark:/53355/cl010062370'}],
      'rn-michelangelo': [{title:'ヴァチカン美術館：最後の審判',url:'https://www.museivaticani.va/content/museivaticani/en/collezioni/musei/cappella-sistina/giudizio-universale.html'}],
      'rn-botticelli': [{title:'ウフィツィ美術館：春（プリマヴェーラ）',url:'https://www.uffizi.it/en/artworks/botticelli-spring'}],
    };
    const updatedSources = images.map(asset => ({title: 'Wikimedia Commons：' + asset.caption.split('。')[0], url: asset.sourceUrl, note: '画像の作品名・作者または建築物、原資料とライセンスをファイルページで確認。'}));
    return {...item,
      images: [...existingImages, ...images], sources: [...item.sources, ...updatedSources, ...(officialRecords[item.id] ?? [])],
      ...(difficulty && difficulty.level !== item.level ? {level: difficulty.level} : {}),
      difficultyEvidence: difficulty ? '暫定Lv.' + difficulty.level + '：' + difficulty.why + ' 2026年度大学別過去問での網羅的照合は未了。' : item.difficultyEvidence,
      version: item.version + 1, updatedAt: expansionUpdatedAt,
    };
  });
}
