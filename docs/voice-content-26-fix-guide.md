# 26件の実聴監査からの5音源修正（2026-10-18）

## 判定と作業範囲

ユーザーが実際に試聴した結果、26件中21件は正常、5件は不具合、未判定は0件でした。判定の個人情報を含まない要約は `research/voice-content-26-human-verdicts-20261018.json` にあります。**実聴判定の完了と、音源修正の完了は別です。現時点で5件とも修正・再聴未完了です。**

| No. | 期待英文 | 不具合／再聴ポイント |
| --- | --- | --- |
| 9 | Was that a coo? I heard you! Hello, baby! | coo は /kuː/（クー）。英字 C-O-O の読み上げは不合格 |
| 11 | Little sips, baby! Sip, sip, sip! High five! | sip が2回しか発音されない。3回にする |
| 14 | Sip, sip, sip! Nice little sips! No need to rush! | sip が2回しか発音されない。3回にする |
| 16 | Cuddle, cuddle, cuddle! My sweet baby! I love you! | cuddle が2回しか発音されない。3回にする |
| 17 | All done eating? Wipe, wipe, wipe? Let's have a look! | wipe が2回しか発音されない。3回にする |

## Mac / Codex で5候補を再生成する

既存のQwen3-TTS音声生成環境と reference voice、seed 1202、model revision を流用してください。英文の表記・Topic/Interaction判定・他の1,100音源・Runtime TTS/Kiki廃止方針は変えません。必要に応じて生成時の句切り方やプロンプトを実験し、採用候補の生成条件を記録します。

各候補について**耳で**必要な発音や3回の反復ができているか判断します。WhisperなどのASR転写だけで合格にしません。前後の語、余計な読み、声質、自然な間も確認します。

採用した5音源をAAC-LC / 24 kHz / M4Aにして、専用ディレクトリに次の名前で保存してください。

    9.m4a
    11.m4a
    14.m4a
    16.m4a
    17.m4a

## Web / Android の両方に安全に差し替える

2つのリポジトリをローカルに置き、FFmpeg（ffprobe）をインストールします。Web側から以下を実行してください。初回は**dry run**で書き込みはありません。

    node scripts/apply-reviewed-voice-replacements.mjs \
      --web-root /path/to/Web_EmmaLocal_English_for_babies \
      --android-root /path/to/Android_English_character_for_baby \
      --replacement-dir /path/to/approved-five

計画内容が意図通りなら、同じ引数に `--apply` を付けて実行します。スクリプトは5つの期待英文を既存manifestから正確に照合し、Web/Androidの古い音源が一致していること、候補がAAC-LC/24 kHzであることを確認してから、**5クリップのみ**を置換します。両manifestの `sha256`、`bytes`、`totalBytes` を同一内容に更新します。既存1105ファイルのうち1100ファイルは変更対象外です。

事前テスト:

    node scripts/test-apply-reviewed-voice-replacements.mjs

差し替え後のテスト:

    # Web
    npm run verify:voice
    node scripts/test-recorded-review-26.mjs
    node test-voice-review-gate.mjs

    # Android
    python3 scripts/verify-prerecorded-voice.py

変更を別PRでレビューし、Webのキャッシュ更新とAndroidのAPK同梱確認を行ってください。**最後にWebとAndroid両方でNo.9,11,14,16,17の修正版を再生し、5件が正常になったことを記録してください。** その時点まで `audioIssuesResolved: false` のままとします。

ASR・Ruri・Visual Cueの開発PRをこの音声修正に混ぜず、Kiki/runtime TTSを復活させないこと。
