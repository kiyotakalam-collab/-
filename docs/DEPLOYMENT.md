# 公開・Android導入・PR

## GitHub Pages

接続先は [`kiyotakalam-collab/-`](https://github.com/kiyotakalam-collab/-) です。2026年11月9日にPrivate・書き込み可能・Pages未設定を確認しました。この連携ではPages設定APIの読み取りが403となるため、管理者が [Settings → Pages](https://github.com/kiyotakalam-collab/-/settings/pages) でSourceを **GitHub Actions** に設定してください。アップグレード表示が出る場合は、現在のプランでPrivateリポジトリのPagesを利用できません。リポジトリの公開範囲や契約プランは変更していません。

このプロジェクトは静的ファイルだけで動作し、`npm run build` の出力先は `dist/` です。Viteの `base: './'` と相対Manifest・Service Workerにより、GitHub Pagesのリポジトリ配下のURLにも配置できます。認証情報や独自バックエンドは必要ありません。

2026年11月9日に確認したGitHub公式資料では、GitHub FreeのPagesは公開リポジトリで利用できます。PrivateリポジトリからのPages公開はGitHub Pro・Team・Enterpriseの対応プランが必要です。**ソースがPrivateであることと、公開サイトの閲覧制限は別です。** Pagesサイト自体をPrivate公開するアクセス制御は、対応するGitHub Enterprise Cloud組織のプロジェクトサイトが対象です。[Pagesのプラン条件](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)、[サイトの閲覧制御](https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site)。

手順：

1. GitHubに対象リポジトリを用意します。教材写真、秘密鍵、バックアップした個人の履歴をコミットしません。
2. ソースをpushし、リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にします。
3. `.github/workflows/pages.yml` がmainへのpushで `npm ci`、単体テスト、型確認・ビルド、Chromiumのブラウザテストを実行します。成功時に `dist/` をPagesへデプロイします。PRではチェックだけを実行します。
4. リポジトリのEnvironment・Actions・Pages権限に組織の制限がある場合は管理者の設定を確認します。ワークフローは `pages: write` と `id-token: write` をデプロイジョブだけに付与しています。
5. Actionsのdeploymentが返した実際のURLを開き、HTTPS、Manifest、Service Worker、アイコン、ページ再読み込みを確認します。
6. 初回訪問中にService Workerの準備を待ち、一度再読み込みした後、ネットワークを切って起動・回答保存・画像表示を確認します。

main以外を既定ブランチにする場合はワークフローの対象ブランチも合わせます。別の静的ホスティングでも `dist/` をHTTPSで配信すれば利用できます。ファイルを `file://` で直接開く方法はService Workerの検証に使えません。

## Android Chromeで追加

1. 公開されたHTTPSのURLをAndroidのChromeで開きます。
2. アプリ内の追加操作が利用できる場合はそれを使うか、Chromeのメニューから「アプリをインストール」または「ホーム画面に追加」を選びます。表示はChromeのバージョン・端末の状態により異なります。
3. ホーム画面のアイコンから起動して学習します。
4. 機内モードで再度起動し、回答を保存します。通信を戻して再同期し、回答履歴が残ることを確認します。

Manifestには相対 `id`・`start_url`・`scope`、standalone表示、192/512pxとmaskableアイコンを用意しています。Service Worker登録は本番ビルドのみです。実際のインストール可能判定とAndroid端末の挙動は、公開環境で確認して初めて検証済みとします。

## 更新とデータ移行

新しいビルドではアプリのキャッシュが更新されます。新しいService Workerは待機し、学習中に自動でページを置き換えません。画面の更新操作を行う前に、現在の回答の保存完了を待ちます。Service WorkerはIndexedDBの学習履歴を削除しません。

用語の変更はSheetsから同期します。IDを保って行versionとカタログversionを上げます。アプリ自体の更新に合わせて初期データが変更されても、履歴はカードIDで対応付けます。

現在はIndexedDB `cultural-history-master` のversion 2です。`meta` ストアが `catalog`・`settings` を持ち、`events` ストアは履歴IDをキーにします。version 1からの移行は履歴を残し、`cardId`・`reviewedAt` のインデックスを追加します。

データ構造を変える場合は、IndexedDBのバージョンを増やし、`onupgradeneeded` に既存ストアを残す移行処理を追加します。未知のバックアップ形式は推測して読み込まず拒否します。移行試験と古いバックアップの復元試験を実施し、利用者にも更新前のJSONバックアップを勧めます。

**ドメイン・公開元・ブラウザ・端末の変更ではJSONを使って移行します。** ブラウザのサイトデータ削除で履歴が消えた場合は、保存済みバックアップを復元します。アプリ更新とブラウザデータ削除は別の操作です。

## リポジトリ接続と手動PR

この作業ではGitHub連携のAPIから、既存のmainを基点にしたブランチとPRを作成します。手元のGitを使う場合の一般的な手順は以下です。`<...>` は実際の値へ置き換え、設定済みのremoteやコミットは再作成しません。

```sh
git remote add origin <実際のGitHubリポジトリURL>
git switch -c feat/cultural-history-pwa
git add .
git commit -m "Build cultural history study PWA"
git push -u origin feat/cultural-history-pwa
gh pr create --base main --head feat/cultural-history-pwa --title "文化史学習PWAの基盤を追加" --body-file docs/PR_DESCRIPTION.md
```

既にコミット・ブランチがある場合は、その状態に合わせて不要な操作を省きます。新規リポジトリでbaseとなるmainがない場合は、先にGitHub側でmainを用意するか初期コミットをpushしてから、変更ブランチのPRを作成します。PRの記述には、実施した試験と未接続のSheets・未検証のAndroid実機を明記します。
