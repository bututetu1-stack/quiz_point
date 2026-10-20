# quiz_point — Claude 向けの作業ルール

クイズ大会・フリバ用のリアルタイム得点表。React（JSX）を esbuild で1ファイルにまとめ、Firebase Realtime Database で同期し、GitHub Pages（`main` の `docs/`）で配信している。
これまでの経緯・未解決の課題・ユーザーの好みは **`HANDOFF.md`** にある。新しいセッションでは最初に読むこと。

## コマンド

```bash
npm install
npm run build                      # app/ → docs/index.html（JS・CSS を埋め込んだ1ファイル）
npm test                           # ビルドしてから node --test（データ層・ルール・画面 jsdom）
npm run screenshot                 # screenshots/ に画面のスクリーンショット（メモリ DB。CHROME_PATH でブラウザ指定）
npm run audit                      # UI の自動チェック（はみ出し・コントラスト・押せる大きさ・名前のないボタン・一画面の人数）と点数。--shots <dir> で全画面を撮る
```

## 守ること

- **ソースは `app/`。`docs/index.html` はビルド成果物**。手で編集しない。変更したら必ず `npm run build` して `docs/index.html` も一緒にコミットする（Pages はこれを配信する）。
- 変更のたびに `app/version.js` の `BUILD` を上げる（v42 の次は v43）。ユーザーは Home 画面の下のこの表記で反映を確かめる。`test/ui.test.js` のバージョン確認も合わせて直す。
- 外部 CDN を読み込まない（過去に CDN が落ちて表示が壊れた）。ライブラリは npm で入れてバンドルする。
- Tailwind のクラス名は**文字列の形で書く**（`bg-${color}` のように組み立てると CSS に含まれない）。
- **色は意味の名前のクラスだけを使う**（`bg-card`・`text-ink`・`text-ink-2/3`・`border-line`・`bg-brand`・`text-on-brand`・`bg-ok`・`bg-ng`・`bg-info` と `*-soft`・`*-ink`。定義は `tailwind.config.cjs`、値は `app/styles.css` の CSS 変数）。`slate-500` のような生の色や `dark:` は使わない（大画面モードだけは常に暗いので例外）。明るい／暗いは `<html data-theme>` で変数が切り替わる。
- 確認・入力にブラウザの `window.confirm` / `prompt` を使わない。`useAsk()`（`app/ui/dialogs.jsx`）の `confirm` / `prompt` を使う（画面テストでは `answerAsk(h, 値)` で答える）。
- 整形は `.prettierrc`（幅 140・シングルクォート・末尾カンマ）。`npx prettier --write "app/**/*.{js,jsx}"`。
- 見た目を変えたら `npm run audit` を回し、はみ出し・低コントラスト・小さい押し先・名前のないボタンが 0 のままか確かめる。
- データの書き込みは `app/data/store.js` に集める。プレイヤー1人分は `players/{id}` の transaction、全員分は `players` の transaction。**手元のキャッシュで丸ごと `set` しない**（同時操作で更新が消える不具合の原因だった）。
- transaction の関数は、手元に値が無いと最初に `null` で呼ばれる。`null` のときは `null` を返してサーバの値で呼び直させる（`undefined` で中止すると、実在するのに「見つからない」扱いになる）。
- `timeline`・`roomIndex`・`log`・`presence` への読み書きは `soft()` で包み、失敗しても得点操作を止めない（Firebase のルールで拒否される可能性がある）。
- ルールの計算は `app/lib/rules.js` の純粋関数。ルールを足すときは `RULE_TYPES`・`applyAnswer`・`progressHint`・`ruleLabel` と `test/rules.test.js` を揃えて直す。
- jsdom の画面テストでは、クリックや入力の直後に同期で次の操作をすると React の状態が反映前のことがある。`waitFor` で画面の変化を待ってから次の操作をする。

## 進め方

- ユーザーとのやりとりは日本語。大きめの変更は計画を見せて承認をもらってから実装する。
- ブランチ → コミット → push → ドラフト PR → Ready → マージ、の流れ。これまでユーザーは「テストが通り、マージ可能（clean）なら Claude がマージしてよい」としてきた。
- PR 本文には変更点・検証結果・ユーザーにお願いすること（実機確認など）を書く。
- 実機（スマホ・PC）での確認はユーザーにお願いする。依頼するときは「Home 下の表記が vNN なら反映済み、違えばスーパーリロード」と添える。
