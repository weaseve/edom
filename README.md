# inara-edsm-viewer

ブラウザ（Vanilla JavaScript）で動作する、Inara のスクレイピング結果と EDSM API を組み合わせてスター・ポートのマーケット更新を一覧表示するテンプレートプロジェクトです。

## 構成
```
inara-edsm-viewer/
├── index.html         ← メインHTML（UIと構造）
├── style.css          ← スタイルシート（見た目）
├── script.js          ← ロジック（Inara取得＋EDSM API＋表示）
├── assets/            ← 任意の画像やアイコン（必要に応じて）
└── README.md          ← プロジェクト説明
```

## 使い方
1. このリポジトリをクローン/ダウンロードします。
2. `index.html` をブラウザで開いてください（ローカルで動作します）。

> 注意: Inara のページは同一生成元ポリシー (CORS) によって直接取得できない場合があります。テンプレートでは `https://corsproxy.io/?` を使った簡易プロキシ経由で取得するようになっています。GitHub Pages にデプロイする場合も同様に CORS を考慮してください。

## デプロイ（GitHub Pages）
1. GitHub に新しいリポジトリを作成します（例: `inara-edsm-viewer`）。
2. このファイル群を `main` ブランチへプッシュします。
3. リポジトリの Settings → Pages で `main` / `/ (root)` を選択すると公開されます。

## 拡張案
- 絞り込み／ソート機能の追加
- CSV 出力
- 複数 Power に対応

---

作成者: テンプレート（Copilot）
