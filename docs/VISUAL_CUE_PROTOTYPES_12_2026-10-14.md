# Visual Cue — 12パターンの画像・アニメーション試作

- 独立プレビュー: visual-cue-prototypes.html
- **12パターン**: 新しいSVG 8点、既存Emma顔SVGを再利用した演出4点
- 914件の英文リスト、ASR、TTS、Ruri、通常アプリ画面は変更なし
- 質問を実行済みと断定しない。安心表現で泣く赤ちゃんを勝手に描かない
- 動きは小さなCSSアニメーション。停止・再開可能。OSのprefers-reduced-motionで初期停止
- 同梱ローカル素材のみ。外部画像サービス不要
- 画像の完成や全58Cueへの対応を主張しない。ユーザー評価と制作工程は残る

## 12種の対応

| Cue | 画像・演出 |
| --- | --- |
| action.sip | 哺乳瓶と小さなひと口（SVG） |
| action.splash | おふろの水しぶき（SVG） |
| action.clap | 両手の拍手（SVG） |
| action.wave | 振る手（SVG） |
| action.kick | 足を動かす（SVG） |
| action.turn-page | 本のページ（SVG） |
| subject.rain | 窓と雨粒（SVG） |
| action.sleep | 月・星・枕（SVG） |
| observed.smile | Emma＋ハート |
| social.reassurance | Emma＋安心のハート |
| social.praise | Emma＋星 |
| dialogue.finish-check | Emma＋？（完了マークなし） |

## 自動検査

- node scripts/test-visual-cue-prototypes.mjs : 12カードのmanifestと8 SVGのXML、安全性、リンク、既存Emmaを検証
- node scripts/browser-visual-cue-prototypes.mjs : ブラウザー実機相当でデスクトップ／390pxスマホ、読み込み、動きの切替、reduced motion、画面キャプチャーを検証
- GitHub ActionsのWeb CIにスクリーンショットをアップロード

**まだ通常のWeb・Androidアプリの返信表示には接続していない。** 試作採用判断後にphraseIdとsentenceIndexに合わせて描画・音声同期する。
