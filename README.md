# Elite Dengerous Oldest Market (EDOM)

**Elite Dengerous Oldest Market（略称: EDOM）** は、Inara のページから星系リストを取得し、EDSM の各星系マーケットの最終更新日時を取得して、更新日時が古い順に一覧表示するシンプルなフロントエンドツールです。

**公開ページ:** https://weaseve.github.io/edom/

## 概要
- テキストフィールドに **Inara の URL** を入力（パターンマッチで受け付けます）
- そのページから **星系のリスト** を取得
- 各星系について **EDSM API** からマーケットの最終更新日時を取得
- **最終更新日時が古い順**（最も古いものが上）で表形式で表示します

## ファイル構成
```
edom/
├── index.html     ← メイン HTML（UI と構造）
├── style.css      ← スタイルシート
├── script.js      ← ロジック（Inara 取得 + EDSM API 取得 + 表示）
├── assets/        ← 画像やアイコン
└── README.md      ← この説明
```

## 使い方
1. このリポジトリをクローンまたはダウンロードしてください。
2. `index.html` をブラウザで開くとローカルで動作します。

> 注意: Inara のページは同一生成元ポリシー (CORS) によって直接取得できない場合があります。テンプレートでは `https://corsproxy.io/?` 等の簡易プロキシを使って取得する仕組みになっています。公開（GitHub Pages 等）する場合も CORS の扱いにご注意ください。

## デプロイ（GitHub Pages）
1. リポジトリを GitHub にプッシュします（例: ブランチ `main`）。
2. リポジトリの Settings → Pages で `main` / `/ (root)` を選択して公開してください。

---

作成者: weaseve
