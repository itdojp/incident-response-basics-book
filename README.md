# インシデント対応 基礎：切り分け・状況共有・復旧・ポストモーテムの型

## 概要

トラブルシューティングからインシデント運用、連絡/復旧判断、ポストモーテムまでの基本フレームを扱う。

## オンライン版（公開URL）

- GitHub Pages: `https://itdojp.github.io/incident-response-basics-book/`（想定）
- 入口: `docs/index.md`

## 開発（ローカル）

### 前提

- Node.js（`npm`）
- （推奨）Podman または Docker（Ruby が無い環境でも `npm start` / `npm run build` を実行可能）
- Ruby + Bundler（導入済みの場合はそれを利用）

### 手順

```bash
npm install

# Ruby/Bundler が無い場合は Podman/Docker を利用します（初回は image pull + bundle install が走ります）

# プレビュー
npm start

# ビルド
npm run build

# テスト（markdown lint / link check）
npm test
```

## ライセンス

本書は **CC BY-NC-SA 4.0** で提供します。詳細は `LICENSE.md` を参照してください。
