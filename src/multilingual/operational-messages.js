// UI messages only. Never run user transcripts or English voice-bank text
// through these mappings. Japanese source messages remain unchanged.
export const OPERATIONAL_MESSAGES = [
['確認','Confirmation','Bestätigung','Confirmation','확인','การยืนยัน'],
['続ける','Continue','Fortfahren','Continuer','계속','ดำเนินการต่อ'],
['グラデーション：ピーチ→ミント→そら→ラベンダー→ピーチの順に、顔と飾りの色が滑らかに変わり、60秒で一周します。','Gradient: the face and decorations cycle through peach, mint, sky and lavender every 60 seconds.','Farbverlauf: Gesicht und Verzierungen wechseln in 60 Sekunden durch Pfirsich, Minze, Himmelblau und Lavendel.','Dégradé : le visage et les décorations passent par pêche, menthe, bleu ciel et lavande en 60 secondes.','그라데이션: 얼굴과 장식이 60초마다 복숭아색, 민트, 하늘색, 라벤더색으로 바뀌어요.','ไล่สี: ใบหน้าและของตกแต่งจะวนผ่านสีพีช มินต์ ฟ้า และลาเวนเดอร์ทุก 60 วินาที'],
['グラデーション：赤→はちみつ→ブルー→ベリー→赤の順に、耳や飾りの色が滑らかに変わり、60秒で一周します。顔と体は白いままです。','Gradient: ears and decorations cycle through red, honey, blue and berry every 60 seconds. The face and body stay white.','Farbverlauf: Ohren und Verzierungen wechseln in 60 Sekunden durch Rot, Honig, Blau und Beere. Gesicht und Körper bleiben weiß.','Dégradé : les oreilles et les décorations passent par rouge, miel, bleu et baie en 60 secondes. Le visage et le corps restent blancs.','그라데이션: 귀와 장식이 60초마다 빨강, 꿀색, 파랑, 베리색으로 바뀌어요. 얼굴과 몸은 흰색을 유지해요.','ไล่สี: หูและของตกแต่งจะวนผ่านสีแดง น้ำผึ้ง ฟ้า และเบอร์รีทุก 60 วินาที ใบหน้าและลำตัวยังคงเป็นสีขาว'],
['グラデーション：赤→はちみつ→ブルー→ベリー→赤の順に、顔・体と飾りの色が滑らかに変わり、60秒で一周します。','Gradient: the face, body and decorations cycle through red, honey, blue and berry every 60 seconds.','Farbverlauf: Gesicht, Körper und Verzierungen wechseln in 60 Sekunden durch Rot, Honig, Blau und Beere.','Dégradé : le visage, le corps et les décorations passent par rouge, miel, bleu et baie en 60 secondes.','그라데이션: 얼굴, 몸과 장식이 60초마다 빨강, 꿀색, 파랑, 베리색으로 바뀌어요.','ไล่สี: ใบหน้า ลำตัว และของตกแต่งจะวนผ่านสีแดง น้ำผึ้ง ฟ้า และเบอร์รีทุก 60 วินาที'],
['声の判定を準備できなかったため、今回は従来方式で会話します。設定で判定方式を変更できます。','The speech detector could not be prepared, so this session will use volume-based detection. You can change the detection method in Settings.','Der Sprachdetektor konnte nicht vorbereitet werden. Diese Sitzung nutzt daher die Lautstärkeerkennung. Die Methode lässt sich in den Einstellungen ändern.','Le détecteur vocal n’a pas pu être préparé. Cette session utilisera donc la détection par volume. Vous pouvez changer de méthode dans les paramètres.','음성 감지기를 준비하지 못해 이번에는 음량 기반 감지를 사용해요. 설정에서 감지 방식을 바꿀 수 있어요.','เตรียมตัวตรวจจับเสียงพูดไม่สำเร็จ ครั้งนี้จึงใช้การตรวจจับตามระดับเสียง เปลี่ยนวิธีได้ในการตั้งค่า'],
['声の判定処理が中断しました。設定で従来方式に戻して再開してください。','Speech detection stopped. Select the standard detector in Settings, then restart.','Die Spracherkennung wurde unterbrochen. Wähle in den Einstellungen die herkömmliche Methode und starte erneut.','La détection vocale s’est arrêtée. Choisissez le détecteur classique dans les paramètres, puis redémarrez.','음성 감지가 중단됐어요. 설정에서 기본 감지 방식으로 바꾸고 다시 시작해 주세요.','การตรวจจับเสียงหยุดลง เลือกวิธีตรวจจับแบบเดิมในการตั้งค่าแล้วเริ่มใหม่'],
['マイク音声処理を開始できませんでした。「会話を始める」をもう一度押してください。','Microphone processing could not start. Tap Start talking again.','Die Mikrofonverarbeitung konnte nicht starten. Tippe erneut auf Gespräch starten.','Le traitement du micro n’a pas démarré. Appuyez à nouveau sur Commencer à parler.','마이크 처리를 시작하지 못했어요. 대화 시작을 다시 눌러 주세요.','เริ่มประมวลผลไมโครโฟนไม่สำเร็จ แตะเริ่มพูดคุยอีกครั้ง'],
['マイク音声処理の読み込みが完了しませんでした。ページを再読み込みして、もう一度お試しください。','Microphone processing did not load. Reload the page and try again.','Die Mikrofonverarbeitung wurde nicht geladen. Lade die Seite neu und versuche es erneut.','Le traitement du micro n’a pas été chargé. Rechargez la page et réessayez.','마이크 처리를 불러오지 못했어요. 페이지를 새로고침하고 다시 시도해 주세요.','โหลดการประมวลผลไมโครโฟนไม่สำเร็จ โหลดหน้าใหม่แล้วลองอีกครั้ง'],
['音声の準備または再生に失敗しました。','Audio could not be prepared or played. Please retry.','Audio konnte nicht vorbereitet oder abgespielt werden. Bitte erneut versuchen.','Impossible de préparer ou de lire l’audio. Réessayez.','음성을 준비하거나 재생하지 못했어요. 다시 시도해 주세요.','เตรียมหรือเล่นเสียงไม่สำเร็จ โปรดลองอีกครั้ง'],
['最新版の音声一覧を取得できません。通信を確認して再準備してください。','The latest audio list could not be downloaded. Check your connection and retry.','Die aktuelle Audioliste konnte nicht geladen werden. Prüfe die Verbindung und versuche es erneut.','Impossible de télécharger la liste audio à jour. Vérifiez la connexion et réessayez.','최신 음성 목록을 다운로드하지 못했어요. 연결을 확인하고 다시 시도해 주세요.','ดาวน์โหลดรายการเสียงล่าสุดไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง'],
['音声を取得できません。接続を確認して再試行してください。','Audio could not be downloaded. Check your connection and retry.','Audio konnte nicht geladen werden. Prüfe die Verbindung und versuche es erneut.','Impossible de télécharger l’audio. Vérifiez la connexion et réessayez.','음성을 다운로드하지 못했어요. 연결을 확인하고 다시 시도해 주세요.','ดาวน์โหลดเสียงไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง'],
['音声ファイルの検証に失敗しました。','The audio file could not be verified. Please prepare the audio again.','Die Audiodatei konnte nicht überprüft werden. Bereite die Audiodateien erneut vor.','Le fichier audio n’a pas pu être vérifié. Préparez à nouveau les fichiers audio.','음성 파일을 검증하지 못했어요. 음성을 다시 준비해 주세요.','ตรวจสอบไฟล์เสียงไม่สำเร็จ โปรดเตรียมเสียงใหม่'],
['この英文に対応する事前収録音源がありません。音声を再準備してください。','No recording is available for this phrase. Please prepare the audio again.','Für diesen Satz fehlt die Aufnahme. Bereite die Audiodateien erneut vor.','Aucun enregistrement pour cette phrase. Préparez à nouveau les fichiers audio.','이 문장의 녹음 음성이 없어요. 음성을 다시 준비해 주세요.','ไม่มีเสียงที่บันทึกสำหรับประโยคนี้ โปรดเตรียมเสียงใหม่'],
['処理中に不明なエラーが発生しました。','Something went wrong. Please retry.','Ein Fehler ist aufgetreten. Bitte erneut versuchen.','Une erreur est survenue. Réessayez.','오류가 발생했어요. 다시 시도해 주세요.','เกิดข้อผิดพลาด โปรดลองอีกครั้ง'],
['準備できませんでした：','Preparation failed: ','Vorbereitung fehlgeschlagen: ','Échec de la préparation : ','준비 실패: ','เตรียมไม่สำเร็จ: '],
['再生できませんでした：','Playback failed: ','Wiedergabe fehlgeschlagen: ','Échec de la lecture : ','재생 실패: ','เล่นเสียงไม่สำเร็จ: '],
['削除できませんでした：','Deletion failed: ','Löschen fehlgeschlagen: ','Échec de la suppression : ','삭제 실패: ','ลบไม่สำเร็จ: '],
['履歴を開けませんでした：','Could not open history: ','Verlauf konnte nicht geöffnet werden: ','Impossible d’ouvrir l’historique : ','기록을 열지 못했어요: ','เปิดประวัติไม่สำเร็จ: '],
['{time}の履歴を選択','Select entry at {time}','Eintrag um {time} auswählen','Sélectionner l’entrée de {time}','{time} 기록 선택','เลือกประวัติเวลา {time}'],
['Emmaの英語','Emma’s English','Emmas Englisch','L’anglais d’Emma','Emma의 영어','ภาษาอังกฤษของ Emma'],
['Emma（みつことば AI）','Emma (CooTrio AI)','Emma (CooTrio KI)','Emma (IA CooTrio)','Emma (CooTrio AI)','Emma (AI CooTrio)'],
['マイクの準備ができました','Microphone is ready','Mikrofon ist bereit','Le micro est prêt','마이크가 준비됐어요','ไมโครโฟนพร้อมแล้ว'],
['自動開始できませんでした','Could not start automatically','Automatischer Start fehlgeschlagen','Démarrage automatique impossible','자동으로 시작하지 못했어요','เริ่มอัตโนมัติไม่สำเร็จ'],
['話し終わりの判定を変更しました','Speech detection method changed','Methode zur Spracherkennung geändert','Méthode de détection vocale modifiée','음성 감지 방식을 바꿨어요','เปลี่ยนวิธีตรวจจับเสียงแล้ว'],
['続きも聞いています…','Still listening…','Ich höre weiter zu…','Je vous écoute toujours…','계속 듣고 있어요…','ยังฟังอยู่…'],
['返答の準備を中断し、続きのことばを聞いています。','Reply preparation paused to listen to the rest of your speech.','Die Antwort wird pausiert, um dir weiter zuzuhören.','Préparation de la réponse suspendue pour écouter la suite.','답변 준비를 멈추고 이어지는 말을 듣고 있어요.','หยุดเตรียมคำตอบเพื่อฟังสิ่งที่คุณพูดต่อ'],
['Emmaが今すぐ話します。','Emma will speak now.','Emma spricht jetzt.','Emma va parler maintenant.','Emma가 지금 말할 거예요.','Emma จะพูดตอนนี้'],
['Emmaが返事を考えます。','Emma is preparing a reply.','Emma bereitet eine Antwort vor.','Emma prépare une réponse.','Emma가 답변을 준비해요.','Emma กำลังเตรียมคำตอบ'],
['Emmaが赤ちゃんへ話しかけます。','Emma will talk to your baby.','Emma spricht mit deinem Baby.','Emma va parler à votre bébé.','Emma가 아기에게 말할 거예요.','Emma จะพูดกับลูกน้อย'],
['続きのことばがあれば、そのまま話してください。','Keep speaking if you have more to say.','Sprich weiter, wenn du noch etwas sagen möchtest.','Continuez si vous souhaitez ajouter quelque chose.','더 할 말이 있으면 계속 말해 주세요.','พูดต่อได้หากยังมีสิ่งที่อยากพูด'],
['英語の声を準備しています','Preparing English audio','Englische Audioausgabe wird vorbereitet','Préparation de l’audio en anglais','영어 음성을 준비하고 있어요','กำลังเตรียมเสียงภาษาอังกฤษ'],
['使い方を3ステップで確認します。','Learn how to use the app in three steps.','Lerne die App in drei Schritten kennen.','Découvrez l’application en trois étapes.','세 단계로 사용법을 알아봐요.','เรียนรู้วิธีใช้ในสามขั้นตอน'],
['履歴を保存できませんでした','Could not save history','Verlauf konnte nicht gespeichert werden','Impossible d’enregistrer l’historique','기록을 저장하지 못했어요','บันทึกประวัติไม่สำเร็จ'],
['履歴を保存できませんでした。端末の空き容量やブラウザ設定を確認してください。','History could not be saved. Check device storage and browser settings.','Der Verlauf konnte nicht gespeichert werden. Prüfe den freien Speicher und die Browser-Einstellungen.','Impossible d’enregistrer l’historique. Vérifiez l’espace libre et les paramètres du navigateur.','기록을 저장하지 못했어요. 저장 공간과 브라우저 설정을 확인해 주세요.','บันทึกประวัติไม่สำเร็จ ตรวจสอบพื้นที่ว่างและการตั้งค่าเบราว์เซอร์'],
['保存領域の保護と、Moonshineモデル本体の保存状態は別々に確認します。','Storage protection and downloaded model availability are checked separately.','Speicherschutz und gespeicherte Modelle werden getrennt geprüft.','La protection du stockage et la disponibilité des modèles sont vérifiées séparément.','저장 공간 보호와 다운로드한 모델 상태를 별도로 확인해요.','ตรวจสอบการป้องกันพื้นที่จัดเก็บและสถานะโมเดลที่ดาวน์โหลดแยกกัน'],
['みつことばを初期状態に戻します。\n\n赤ちゃんの設定、見た目、初回準備情報、保存音声とモデルのキャッシュを削除します。次回は音声とモデルの再取得が必要です。\n\n実行しますか？','Reset CooTrio?\n\nThis deletes settings, setup information, cached audio and models from this device. Audio and models must be downloaded again.\n\nContinue?','CooTrio zurücksetzen?\n\nEinstellungen, Einrichtungsdaten sowie gespeicherte Audiodateien und Modelle werden gelöscht. Audio und Modelle müssen erneut geladen werden.\n\nFortfahren?','Réinitialiser CooTrio ?\n\nLes réglages, les informations de configuration, les fichiers audio et les modèles en cache seront supprimés de cet appareil. Il faudra les télécharger à nouveau.\n\nContinuer ?','CooTrio를 초기화할까요?\n\n설정, 초기 준비 정보, 저장된 음성과 모델을 이 기기에서 삭제해요. 음성과 모델을 다시 다운로드해야 해요.\n\n계속할까요?','รีเซ็ตCooTrioหรือไม่?\n\nจะลบการตั้งค่า ข้อมูลการตั้งค่าเริ่มต้น เสียงและโมเดลที่เก็บไว้ในอุปกรณ์ ต้องดาวน์โหลดเสียงและโมเดลอีกครั้ง\n\nดำเนินการต่อหรือไม่?'],
];

// Equivalent recovery instructions for low-level failures. Original Japanese
// diagnostics are retained in logs; no raw worker ErrorEvent reaches the UI.
const equivalents = {
 'マイク音声処理を再開できませんでした。「会話を始める」をもう一度押してください。':'マイク音声処理を開始できませんでした。「会話を始める」をもう一度押してください。',
 'マイクの開始が完了しませんでした。サイト設定でマイクを許可し、Androidで他アプリのバブルやオーバーレイが表示されている場合は閉じてから、もう一度お試しください。':'マイクを開始できませんでした。サイト設定でマイクを許可してください。Androidで他アプリのバブルやオーバーレイが表示されている場合は、閉じてから「呼びかけを始める」をもう一度押してください。',
 'マイクの許可確認が完了しませんでした。サイト設定でマイクを許可し、Androidで他アプリのバブルやオーバーレイが表示されている場合は閉じてから、もう一度お試しください。':'マイクを開始できませんでした。サイト設定でマイクを許可してください。Androidで他アプリのバブルやオーバーレイが表示されている場合は、閉じてから「呼びかけを始める」をもう一度押してください。',
 '「呼びかけを始める」を押すと、マイクの許可を確認して呼びかけを始めます。':'「呼びかけを始める」を押すと、マイクを確認して呼びかけを始めます。',
 '「呼びかけを始める」を押すと、マイクを確認して呼びかけを始めます。':'Tap here to start',
 '「呼びかけを始める」を押して呼びかけを再開してください。':'Tap here to start',
 '「呼びかけを始める」を押して再開してください。':'Tap here to start',
 '下の大きな「呼びかけを始める」を押すと再開できます。':'Tap here to start',
 '大きな「呼びかけを始める」から会話を再開できます。':'Tap here to start',
 '「今すぐAIが返事する」を押すと返事します。':'今すぐAIが返事する',
 'AIの声がまだ準備されていません':'音声の準備または再生に失敗しました。',
 '声の判定モデルの準備が完了しませんでした。':'音声の準備または再生に失敗しました。',
 '声の判定処理を読み込めませんでした。':'音声の準備または再生に失敗しました。',
 '音声一覧を取得できません。':'最新版の音声一覧を取得できません。通信を確認して再準備してください。',
 '音声一覧の形式または固定seedが一致しません。':'音声ファイルの検証に失敗しました。',
 '音声一覧に不正な項目があります。':'音声ファイルの検証に失敗しました。',
 '英文の音声対応が重複しています。':'音声ファイルの検証に失敗しました。',
 '再生する英文がありません。':'音声の準備または再生に失敗しました。',
 'みつことばの準備が完了しませんでした。ページを再読み込みして、もう一度お試しください。':'マイク音声処理の読み込みが完了しませんでした。ページを再読み込みして、もう一度お試しください。',
 '処理中に問題が起きました':'処理中に不明なエラーが発生しました。',
};
export function appendOperationalMessages(catalog) {
  catalog.push(...OPERATIONAL_MESSAGES);
  const start=['Tap here to start','Tap Start talking to begin or resume.','Tippe auf Gespräch starten, um zu beginnen oder fortzufahren.','Appuyez sur Commencer à parler pour démarrer ou reprendre.','대화 시작을 눌러 시작하거나 다시 대화해 주세요.','แตะเริ่มพูดคุยเพื่อเริ่มหรือสนทนาต่อ'];
  for(const [source,initialTarget] of Object.entries(equivalents)) {
    let target=initialTarget;
    while(equivalents[target])target=equivalents[target];
    const row=target===start[0]?start:catalog.find(row=>row[0]===target);
    if(!row)throw Error('Missing operational message: '+target);
    catalog.push([source,...row.slice(1)]);
  }
}
