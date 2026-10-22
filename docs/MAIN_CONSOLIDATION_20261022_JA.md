# main統合・ブランチ整理記録（2026-10-22）

## 現在の本体

開発とリリースの基準は `main`。今回、6言語対応も含めて統合する方針とした。多言語の古い試験ブランチを本体の代わりに使わない。

- 日本語・英語・独語・仏語・韓国語・タイ語のUI、自動言語選択と手動選択の保存。
- 日本語はMoonshine / Ruri、他言語はWhisper Small q8 / E5の端末内WASM。英語UIの発話言語判定はPR #131の会話単位キャッシュを維持。
- 採用済みビジュアルキューを既定ON。録音音声との連動、再生後の保持、次の発話での切替、独立した設定とその保存を維持。
- Qwen3 seed1202の録音英語1105本、914英文セットの対応、SHA-256検証、部分ダウンロード復旧を維持。古いKitten / Supertonic / Web Speech案へ戻さない。
- PR #136の録音英語1文による会話再開の挨拶を維持。旧試験版の日本語挨拶は採用しない。
- PR #137の言語設定を設定画面の最下部に置く実装を維持。会話画面の言語選択と、別の説明言語セレクターは撤去済み。

## 今回回収した漏れ

PR #132の言語変更直後のruntime表示修正がmainへ未反映だった。新言語のモデル準備が終わる前に表示を更新し、未確定のスレッド数は表示しない。6言語の実際の変更コールバックを非同期準備の途中で検証する回帰テストを取り込んだ。

PR #133の配置修正は、調査中に新しい本番用PR #137としてmainへ入った。調査開始時の `813c41fb` を上書きせず、`e2130ac9` も統合に取り込んだ。旧ブランチと新ブランチの言語UIの差分はコメントと整形だけで、後発の本番版を維持した。旧「中文」「非表示」設定の残存と「準備する」による自動選択の解除を回帰テストで確認した。

設定画面のbuild表示が `loading…` のまま更新されない問題も修正した。統合版は `20261022-consolidated-main-v1`。app・言語UI module・Service Worker登録URLとshell cacheを更新し、最新を確認できるようにした。

READMEに残っていた「本番でKitten合成」「未収録文をKikiで合成」という旧説明は、実際の録音専用経路に修正した。

## 統合の判断方法

139本のremote branchと132件のPRを照合。更新日時やahead件数だけでは判断しない。squash済みのブランチは、コミットSHAがmainと異なっていても対応PRのマージ先・マージコミットを確認した。マージ後に枝先が進んだ多言語枝は別途比較し、旧再開挨拶が後発PR #136で置き換えられていることを確認した。

PR #134はPR #135の最新イラスト対応統合版に置換済み。PR #124の古い英語固定経路は、後発PR #131の言語判定方針を戻してしまうため採用しない。古い顔差替え案・一時的な英文生成コード・過去の音声エンジン案も最終版には戻さない。

PR #71 / #75の研究成果は保管する。特に否定判定ヘッドは独立難問評価68.6%で、研究内でも本番に採用しないと結論されている。現行の採用済みInteractionヘッドを維持する。

PR #64の別リポジトリAndroid hostを参照する追加CI案は未統合のまま保存する。現行のWeb実推論baselineはpages.ymlで維持される。未採用研究や追加CI案を「本番機能の修正漏れ」として混ぜない。

## ブランチの整理と復元

`main` と公開用 `chore/trigger-pages` を残す。旧作業・試験137本は、全て下表のSHAを指す `archive/20261022/<元ブランチ名>` タグをremoteへ保存してから整理する。削除時は取得時のSHAをleaseに指定し、作業中に変化したブランチを削除しない。

`chore/trigger-pages` は余分なテスト枝ではなく、main CIが成功したSHAを公開するための運用ブランチ。アプリの開発基準には使わない。

調査開始時のmainは `archive/20261022/main-at-start`、PR #137後の統合前mainは `archive/20261022/main-before-consolidation` で復元できる。今回の作業枝も `archive/20261022/integrate/latest-main-20261022` に保管する。

例：`git fetch origin --tags` の後に `git switch -c recover-multilingual archive/20261022/feat/multilingual-20261019` で過去の実装を別枝に復元できる。mainを過去のタグへ直接戻す運用はしない。

元ブランチ名・完全なSHA・対応PR・判断理由・保存タグは [branch-audit-20261022.json](branch-audit-20261022.json) に記録した。

## 検証

- 統合前・統合後の `npm test` 成功。914英文セット・1105録音ファイル・1093現行Web発話の対応と音源整合性を検証。
- 共有話題契約244ケース・24会話系列、22話題110フレーズ、SileroとSemantic固定アセットの検証成功。
- 発話割込み、ASR keyterm、音源審査ページの回帰テスト成功。
- 実Chromiumで6言語それぞれの初回画面・自動選択・設定最下部の配置・旧設定の扱い・イラストON/OFF保存・戻る・横はみ出し無しを確認。
- 実録音AACのダウンロードとキャッシュ、採用済み顔あり抱っこアニメーションとの連動・再生完了を確認。設定画面のbuild表示も検証。
- 採用素材、音源、英文、ビジュアルキュー制御、録音専用worker、Whisper worker、Interaction実装はPR #137後のmainと同一であることを差分確認。
- `pages.yml` に再開挨拶テストと6言語本体ブラウザ検証を追加。スクリーンショットと結果JSONをCI artifactへ保存する。

ブラウザ確認ではマイク・大容量ASRモデルを使っていない。Android / iPhone実機での認識精度、遅延、全ての冷キャッシュ再取得の評価ではない。音声・イラストの採用内容自体は変えていない。

## 全ブランチの判断一覧

| 元ブランチ | 取得時SHA | 判断 | 対応PR |
| --- | --- | --- | --- |
| `chore/default-supertonic-f3` | `6fb9801e3d` | 対応PRマージ済み | #15 |
| `chore/gpl-free-web-audit` | `99497a91f8` | 対応PRマージ済み | #52 |
| `chore/remove-tts-name-placeholders-20261014` | `4c087ba7be` | 対応PRマージ済み | #93 |
| `chore/trigger-pages` | `813c41fb93` | 公開ソース | #1 |
| `chore/web-standalone-no-android-promo-20261013` | `d85c064194` | 対応PRマージ済み | #81 |
| `codex/adopt-qwen3-voice1202` | `9a2f1a49b0` | 対応PRマージ済み | #97 |
| `codex/auto-start-after-setup-only` | `884239bdaf` | 対応PRマージ済み | #45 |
| `codex/auto-start-every-open` | `0f9c799609` | 対応PRマージ済み | #46 |
| `codex/settings-scroll-and-deploy-fix` | `b4454af99a` | 対応PRマージ済み | #48 |
| `codex/settings-vertical-scroll-only` | `5ef7c03fde` | 対応PRマージ済み | #47 |
| `codex/silero-vad-settings` | `b22971da3f` | mainの祖先 | #69 |
| `codex/visual-cue-complete-assets` | `51345cbd37` | mainの祖先 | #107 |
| `codex/voice-progressive-prefetch-20261020` | `010a20e202` | 対応PRマージ済み | #127 |
| `codex/web-lite-asr-rescue` | `259c401a77` | 対応PRマージ済み | #43 |
| `codex/web-milk-rescue-auto-start` | `206193b126` | 対応PRマージ済み | #44 |
| `deploy/pages-bootstrap` | `890f06108b` | 後発実装で置換済み | #2 |
| `diag/whisper-stage-latency-20261020` | `f0236535a0` | 対応PRマージ済み | #128 |
| `docs/android-companion-v1.9.21` | `443e997a20` | 対応PRマージ済み | #54 |
| `docs/android-companion-v1.9.22` | `4b6dcbac09` | 対応PRマージ済み | #55 |
| `docs/android-companion-v1.9.23` | `d0796c4cb5` | 対応PRマージ済み | #56 |
| `docs/semantic-parity-complete` | `c3dbb3291f` | mainの祖先 | #68 |
| `docs/web-lite-positioning` | `9868c2e3fd` | 対応PRマージ済み | #34 |
| `docs/web-readme-license-sync-2026-10-02` | `d1af8dec6d` | 対応PRマージ済み | #53 |
| `english/rhythm-first-20261014-105sets` | `405d49ae9f` | 対応PRマージ済み | #91 |
| `experiment/non-gpl-phonemizer` | `e68a228332` | 対応PRマージ済み | #49 |
| `experiment/semantic-lite-web-test` | `ea7c40c724` | mainの祖先 |  |
| `feat/compact-history-replay-bulk-delete-20261012` | `bd9363c071` | 対応PRマージ済み | #74 |
| `feat/diverse-ruri-replies-20261013` | `79eed46aba` | 対応PRマージ済み | #80 |
| `feat/infant-english-naturalness-review-20261013` | `fa297e4eba` | 対応PRマージ済み | #82 |
| `feat/interaction-default-on-20261013` | `a112cee80e` | mainの祖先 | #76 |
| `feat/interruptible-web-listening` | `81e3fd8abe` | 対応PRマージ済み | #70 |
| `feat/japanese-restart-greeting-20261020` | `f95873397a` | 後発実装で置換済み | #126 |
| `feat/kitten-kiki-voice` | `c0722ae473` | 対応PRマージ済み | #32 |
| `feat/lite-meaningful-phrase-variety-20261012` | `6fb80782ae` | mainの祖先 | #72 |
| `feat/low-frequency-paired-baby-name-20261013` | `2fc690fdec` | 対応PRマージ済み | #88 |
| `feat/main-recorded-restart-greeting-20261022` | `a7003a4fbc` | 対応PRマージ済み | #136 |
| `feat/moonshine-small-streaming-ja` | `f911df3eb1` | 対応PRマージ済み | #30 |
| `feat/moonshine-tiny-kitten-nano` | `1677f70248` | 対応PRマージ済み | #31 |
| `feat/multilingual-20261019` | `f95873397a` | 後発実装で置換済み | #116 |
| `feat/ruri-pairs-routing-diagnostics-20261013` | `32e097a0fe` | 対応PRマージ済み | #79 |
| `feat/whisper-small-wasm-multithread-sticky-language-20261020` | `5557cf0d28` | 対応PRマージ済み | #131 |
| `feature/android-parity-v02` | `ff191f9ad1` | 対応PRマージ済み | #4 |
| `feature/emma-first-compact-reply-ui` | `78cb5034db` | 後発実装で置換済み | #105 |
| `feature/emma-first-main-final-20261017` | `ac76ec20aa` | 対応PRマージ済み | #108 |
| `feature/interaction-default-on-20261013` | `5ce24e6350` | 後発実装で置換済み | #77 |
| `feature/interaction-phase-a-gemma-handoff-20261012` | `9be0c2209b` | 研究として保存 | #71 |
| `feature/interaction-prd-web-integration-20261012` | `cd2704a033` | mainの祖先 | #73 |
| `feature/kitten-nano-speed-compare` | `3c01e57338` | 対応PRマージ済み | #18 |
| `feature/kitten-tts-experiment` | `78399e2ad7` | 対応PRマージ済み | #13 |
| `feature/native-local-asr-first` | `1776f5d357` | 対応PRマージ済み | #26 |
| `feature/play-lite-vocabulary-110` | `4ab27f2b7b` | mainの祖先 | #58 |
| `feature/play-sentence-count` | `e643471196` | mainの祖先 | #59 |
| `feature/resumable-background-model-downloads` | `ceb73b851a` | 対応PRマージ済み | #51 |
| `feature/ruri-polarity-experiment-20261013` | `4293aa2fac` | 研究として保存 | #75 |
| `feature/shared-play-history` | `da6cbeffa3` | mainの祖先 | #57 |
| `feature/tts-comparison-lab` | `17ba0cf44a` | 対応PRマージ済み | #14 |
| `feature/visual-cue-12-prototypes-20261014` | `f2824e1708` | 対応PRマージ済み | #96 |
| `feature/visual-cue-914-corpus-20261014` | `08bf2a1cbf` | 対応PRマージ済み | #94 |
| `feature/visual-cue-artwork-handoff-20261017` | `4e3c216bbc` | 対応PRマージ済み | #106 |
| `feature/visual-cue-main-face-replacement-20261016` | `238d6eaa8f` | 後発実装で置換済み | #102 |
| `feature/visual-cue-semantic-audit-20261014` | `3ed9062992` | 対応PRマージ済み | #95 |
| `feature/visual-cue-semireal-motion-20261015` | `b288e6bcd6` | 対応PRマージ済み | #99 |
| `fix/asr-init-stall` | `592e2df90c` | 対応PRマージ済み | #28 |
| `fix/avatar-color-full-link` | `00e341a2f9` | 対応PRマージ済み | #5 |
| `fix/browser-locale-auto-select-20261020` | `12430c040c` | 対応PRマージ済み | #118 |
| `fix/cache-bust-kitten-worker` | `72505da29c` | 対応PRマージ済み | #36 |
| `fix/e5-panel-two-heads-20261020` | `5c2e3e472d` | mainの祖先 | #123 |
| `fix/english-bypass-whisper-language-detect-20261020` | `900f06b157` | 後発実装で置換済み | #124 |
| `fix/force-service-worker-refresh` | `afcf9bff55` | 対応PRマージ済み | #41 |
| `fix/full-modal-overflow` | `a63f9fad8e` | 対応PRマージ済み | #12 |
| `fix/full-modal-position` | `c0cc96c976` | 対応PRマージ済み | #11 |
| `fix/infant-english-phrases-and-v1944-20261013` | `3fc946af21` | 対応PRマージ済み | #83 |
| `fix/infant-phrases-v1944-20261013` | `7f0d64e6c5` | 後発実装で置換済み | #84 |
| `fix/interaction-always-on-english-review-20261014` | `6a22720e5f` | 対応PRマージ済み | #90 |
| `fix/interaction-toggle-developer-settings-20261013` | `5d2c18100b` | 対応PRマージ済み | #78 |
| `fix/kitten-fp32-stable-nano` | `d0140cffdf` | 対応PRマージ済み | #40 |
| `fix/kitten-module-cdn` | `5326e62ce2` | 対応PRマージ済み | #35 |
| `fix/kitten-progress-diagnostics` | `5455b0adc6` | 対応PRマージ済み | #39 |
| `fix/kitten-supported-nano-model` | `886d808e2c` | 対応PRマージ済み | #37 |
| `fix/kitten-wasm-direct-loader` | `d9fa4b14c6` | 対応PRマージ済み | #23 |
| `fix/kitten-wasm-fair-compare` | `e38f767ab8` | 対応PRマージ済み | #20 |
| `fix/kitten-wasm-module-url` | `1b29b9614b` | 対応PRマージ済み | #22 |
| `fix/language-settings-bottom-20261021` | `3044525f9a` | 後発実装で置換済み | #133 |
| `fix/localize-voice-progress-about-page-20261020` | `213f9fd44e` | 対応PRマージ済み | #119 |
| `fix/localized-reply-context-hints-20261020` | `f2a498e841` | 対応PRマージ済み | #125 |
| `fix/main-language-controls-location-20261022` | `a3c45f8425` | 対応PRマージ済み | #137 |
| `fix/mic-start-after-isolation-reload` | `a28004f8a7` | mainの祖先 | #62 |
| `fix/moonshine-japanese-decoding` | `ce824851b8` | 対応PRマージ済み | #113 |
| `fix/moonshine-official-worker-host` | `ff5dd223ce` | 対応PRマージ済み | #42 |
| `fix/multilingual-cache-onboarding-brand-20261019` | `b1d4c35ef4` | 対応PRマージ済み | #117 |
| `fix/parent-button-and-sentence-gap` | `c9c59d63e6` | 対応PRマージ済み | #7 |
| `fix/preauthored-baby-name-templates-20261014` | `8b2c046eb7` | 対応PRマージ済み | #89 |
| `fix/private-session-asr-integrated-20261020` | `338445564e` | 後発実装で置換済み |  |
| `fix/private-session-asr-language-switch-i18n-20261020` | `338445564e` | 対応PRマージ済み | #122 |
| `fix/recorded-audio-download-retry-and-recovery-20261021` | `4a342db3e7` | 後発実装で置換済み | #134 |
| `fix/recorded-audio-recovery-integrated-20261021` | `8c976fba7c` | 対応PRマージ済み | #135 |
| `fix/recorded-english-resume-greetings-20261020` | `8da928c387` | 後発実装で置換済み | #130 |
| `fix/recorded-only-ruri-asr-audit-20261015` | `a2d29fb2a2` | 対応PRマージ済み | #100 |
| `fix/runtime-language-switch-20261021` | `2dbcd445ff` | 今回取り込み | #132 |
| `fix/serialized-model-initialization` | `a77a8f7ea8` | 対応PRマージ済み | #27 |
| `fix/settings-flow-mobile-full` | `39858d0177` | 対応PRマージ済み | #10 |
| `fix/setup-revision-after-model-change` | `4d13066e7a` | 対応PRマージ済み | #33 |
| `fix/tighter-kokoro-gap-and-chan` | `a6a1ea5d9b` | 対応PRマージ済み | #8 |
| `fix/topic-context-one-followup-20261010` | `6007685cd7` | 対応PRマージ済み | #67 |
| `fix/topic-context-two-followups-20261010` | `eaa3d1ec3f` | 対応PRマージ済み | #65 |
| `fix/tutorial-intro-auto-advance-20261020` | `ee386e420c` | 後発実装で置換済み | #120 |
| `fix/tutorial-intro-auto-advance-rebased-20261020` | `2faea61d4d` | 対応PRマージ済み | #121 |
| `fix/ui-language-audit-20261020` | `f447b7143f` | mainの祖先 | #129 |
| `fix/vendor-kitten-browser-runtime` | `3a0903d1f6` | 対応PRマージ済み | #38 |
| `fix/voice-human-audit-five-20261018` | `1dbe634675` | mainの祖先 | #114 |
| `fix/voice-preview-hana` | `ab9e39d1f9` | 対応PRマージ済み | #17 |
| `fix/web-callout-copy-after-banner-removal-20261013` | `7cc7b55d40` | 対応PRマージ済み | #87 |
| `fix/web-public-callout-copy-20261013` | `48ace7d9b0` | 後発実装で置換済み | #86 |
| `fix/web-subpage-back-navigation` | `1619f5c308` | mainの祖先 | #61 |
| `icon/baby-abc-20260930` | `cd49ddbf6b` | 対応PRマージ済み | #50 |
| `issue101-human-review-gate-20261016` | `eb8c907f9f` | 対応PRマージ済み | #103 |
| `local-asr-native-first` | `3ab4019750` | 後発実装で置換済み |  |
| `local-asr-native-first-final` | `ae4c2244ac` | 後発実装で置換済み |  |
| `main` | `e2130ac9c5` | 本体 | #21, #3 |
| `native-local-asr` | `fab7b2bc50` | 後発実装で置換済み |  |
| `native-local-asr-v2` | `93b2c6696f` | 後発実装で置換済み | #19 |
| `perf/kokoro-streaming-playback` | `7cec9aa299` | 対応PRマージ済み | #9 |
| `refactor/minimal-supertonic-f3-ui` | `e484f5c673` | 対応PRマージ済み | #25 |
| `refactor/remove-kitten-comparison` | `e0552e253b` | 対応PRマージ済み | #24 |
| `refactor/supertonic-wasm-only` | `98d1965b92` | 対応PRマージ済み | #16 |
| `refactor/whisper-only-asr` | `3da6bdced2` | 対応PRマージ済み | #29 |
| `remove-unused-baby-gender-setting-20261014` | `f3d32d6af3` | 対応PRマージ済み | #98 |
| `research/issue101-human-semantic-review-20261017` | `0edc520442` | 対応PRマージ済み | #110 |
| `research/ruri-generic-rescue-sweep-20261014` | `3fc5dc52d7` | 対応PRマージ済み | #92 |
| `research/ruri-threshold-reevaluation-20261017` | `f0baff50c1` | 対応PRマージ済み | #109 |
| `stable/2026-09-25` | `0b9db12d96` | mainの祖先 |  |
| `sync/android-lite-bank-20260922` | `ced7d9b645` | 対応PRマージ済み | #6 |
| `sync/android-play-ui-20261005` | `c937438da3` | mainの祖先 | #60 |
| `temp/gemma-canonical-generation-20260922` | `327d4f50fa` | 後発実装で置換済み |  |
| `test/semantic-runtime-parity` | `fe8e93f8ad` | mainの祖先 | #63 |
| `test/semantic-runtime-parity-trigger` | `5a17de0d58` | 追加CI案を保存 | #64 |
| `tmp/gemma-canonical-20260922` | `48e75f3e3b` | 後発実装で置換済み |  |
| `ui/remove-persistent-privacy-banner-20261013` | `333ae4d76c` | 対応PRマージ済み | #85 |
| `visual-cue-extensible-foundation` | `9dd626b17b` | 後発実装で置換済み | #66 |
