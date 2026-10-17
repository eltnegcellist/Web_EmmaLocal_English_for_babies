# 組込み画像生成の記録

使用手段: 組込み `image_gen`。全呼び出し `transparent_background: true`。以下は採用した原画の生成指示。入力は絵柄参照であり、既存商品の複製ではありません。生成先からリポジトリの`sources/generated/`へPNGをコピーしました。アニメーションは保存原画からPillowで再現でき、画像生成APIの呼び出しは不要です。

共通参照パスは `reference/artwork/approved/milk_bottle.webp`。例外は各項目に記載。モデルのバックエンド名はツールから通知されていないため断定しません。

## toy.png

出力ID `exec-eb074b8b-6289-48d7-b065-284ed742a59b`。

> Use case illustration-story. The input is STYLE REFERENCE ONLY. Generate one different object: a colorful simple baby rattle with a coral circular ring and yellow handle. Match the input's flat softly painted felt-paper children's picture-book illustration, medium simplification, matte fuzzy grain and clear rounded silhouette, low depth, not a 3D stuffed toy or macro photo, no visible stitches or fibers. Object centered within 75% of square canvas, generous transparent margins. Genuine transparent RGBA background, no text no extra objects no baby no motion marks. Original artwork scene.toy.

初回 `exec-3dca5eaa-684d-4541-8889-a2fd2912c214` は写実的な縫いぐるみ質感になったため使用せず、承認済みイラストを参照して上記を再生成。

## outdoor.png

出力ID `exec-0bf6d611-dd14-4adf-b55b-65a459a09d88`。

> Use case illustration-story. Input STYLE REFERENCE ONLY. Generate ONE outdoor object illustration: a small leafy green tree growing from a tiny oval patch of green grass, warm brown trunk clearly visible, round irregular green canopy. Original Japanese early-learning picture-book style, same flat softly painted felt-paper texture and moderate simplification as reference, matte grain, no 3D realism or stitching. No sun cloud or other separate objects. Center within 75% square composition on genuine transparent RGBA background. Clear silhouette at 220px. No text no baby no people no face no logo no frame. Asset scene.outdoor.

## sun.png

出力ID `exec-6fb26cc2-f4c2-417f-8a48-d5ce486fe688`。

> Use case illustration-story. STYLE REFERENCE input only. Generate one simple bright yellow sun with an orange circular center and eight rounded broad yellow rays. Flat softly painted felt-paper children's picture book like the reference, subtle matte grain, clear silhouette, moderate simplification, no realistic fabric stitches, no face no text no clouds no scenery no glow. Center within 70 percent of square canvas. Genuine transparent RGBA background with generous margins. Original asset scene.weather variant sun, clearly distinguishable from rain.

## music.png

出力ID `exec-6a7217f5-2855-430a-925b-16879c95bf9d`。

> Use case illustration-story. Input style reference only. One original small yellow and coral tambourine, tilted slightly, broad circular cream drum skin and four clearly visible blue rounded metal jingles around coral rim. Three isolated musical note glyph shapes FLOAT ABOVE with large transparent gaps between them and instrument, notes turquoise coral yellow, no other decoration. Flat softly painted felt-paper picture-book illustration exactly like reference texture, not photoreal or stitched. Instrument in lower half; three notes in upper half, each isolated for animation extraction. Transparent RGBA background, no text labels no frame no people. Square, generous margins, legible 220px. Asset scene.music and motion.notes parts.

## bath.png

出力ID `exec-974b82d7-b50f-4dd6-b10b-dde924927fd6`。

> Use case illustration-story. Input STYLE REFERENCE ONLY. Single original children's picture-book BATH illustration: a rounded turquoise oval baby bathtub with broad white rim, visible pale blue water surface, two short stable feet. No baby, people, duck, face, bubbles, shower head or droplets. Only the bathtub full of still water; clear recognizable physical tub with depth. Same flat softly painted felt-paper matte grain style as reference, low depth moderate simplification, no photo fabric stitches. Three-quarter front view, centered within 75% of square composition. Genuine transparent RGBA background, no text labels no frame no ground shadow. Separate shower variant will be animated later. Asset scene.bath.

## hand-wave.png

出力ID `exec-b6b3e0e8-ad8d-433c-94fc-fc4c48c1c84c`。参照: `reference/artwork/approved/clapping_hands.webp`。

> Use case illustration-story. Reference image sets STYLE and hand simplification only. Generate ONE single isolated open RIGHT HAND with a short blue sleeve cuff at wrist, palm facing viewer, fingers pointing up, thumb on left. Exactly five digits: four rounded separated fingers and one side thumb, natural proportions, connected palm and wrist, no joints cut apart. Warm peach color, same flat softly painted paper/felt matte grain as reference, no realistic skin lines. No other hand, no motion rays, no stars, no text no person face body. Genuine transparent background. Entire hand within central 70% of square, plenty of margin. This is a rigging sprite for waving, wrist stays attached to cuff. Original asset motion.hand.wave.

## hand-clap.png

出力ID `exec-8ffd65d1-f09c-4886-9eaf-8bf869da93cf`。参照: `reference/artwork/approved/clapping_hands.webp`。

> Use case illustration-story. Input style reference ONLY. Generate ONE isolated RIGHT hand in clean SIDE PROFILE, fingers together straight pointing upward, palm surface faces toward the RIGHT edge, thumb visible near near side of palm. Simplified natural hand, four fingers layered in side view and one thumb, no extra digits. Wrist has a short blue sleeve cuff, all connected, no cut off joint. Warm peach, flat softly painted felt-paper picture book as reference, matte grain, rounded clear edges. This sprite will be mirrored to create TWO clapping hands with palms touching, so palm edge is nearly vertical on RIGHT side. No second hand, no motion marks no stars no text no baby face body. Genuine transparent RGBA, central 70% square canvas.

## foot.png

出力ID `exec-d256b50b-97b9-4ffc-b2fc-42a992e5af8e`。参照: `reference/artwork/approved/kicking_feet.webp`。

> Use case illustration-story. Style reference only. ONE single isolated small FOOT seen from sole, toes pointing upward and heel downward; short blue trouser cuff connected behind the ankle/heel, a clean natural attachment. Exactly FIVE rounded toes: one large big toe on left and four progressively smaller toes on right. Soft peach color, simple clear natural proportions, no wrinkles, no realism, same flat softly painted paper-felt picture-book style as reference. No second foot, no motion rays, no hands, no baby face or torso or whole person. Genuine transparent RGBA background. Foot and cuff in central 70% square with ample margin. Original rigging sprite motion.kick, no text.

## meal-layers.png

出力ID `exec-251616eb-ce3c-41a7-9147-996fab7d34a6`。参照: `reference/artwork/approved-style/meal_porridge.webp`。

> Use case illustration-story. Input reference sets exact style/colors. Make a LAYER KIT for this ONE meal cue. On the LEFT half of a wide transparent canvas: complete blue bowl filled with white/cream rice porridge, no spoon in bowl, continuous intact creamy surface. On RIGHT half: one orange-handled spoon carrying a rounded scoop of the same white/cream porridge, handle diagonal upward right; spoon fully intact. Bowl and spoon must be entirely separated by a large transparent gap so they can be cut into animation layers. Same flat softly painted felt-paper picture-book style and moderate simplification as reference, no photo fabric stitches. No green food, no decoration no text labels no baby no hand no shadow no frame. Genuine transparent RGBA. Both objects fully within margins. The spoon will scoop from the bowl; proportions consistent with reference.

## diaper.png

最終出力ID `exec-86799215-711d-4c35-8588-8e9173ac5599`。初回参照: `reference/artwork/candidates/diaper.webp`。初回出力 `exec-327a6e3c-3d0f-4708-ac2f-55bed63a1dec` は留め具が画像端に達したため使用せず、同出力を編集対象として再生成。

初回指示:

> Use case illustration-story. Input style reference only. ONE original unfolded clean baby DIAPER front view, broad cream white padded center with light blue edge, two distinct bright BLUE fastening tabs extended sideways at upper left and upper right. Tabs are attached by narrow roots at the top corners, separated from lower body by transparent gaps. Simple diaper silhouette with two leg openings below, NO teddy face, NO prints, NO baby/person/hands. Flat softly painted paper-felt picture-book style as reference, matte grain, rounded edges, not photo, no stitching. Entire object central 70% square, genuine transparent RGBA background, no shadows text marks or frame. The blue tabs will hinge inward to close diaper, body must remain intact. Original motion.change diaper layer kit.

修正指示:

> Edit this diaper artwork. Keep identical colors, silhouette, tabs, flat painted paper texture. Fix ONLY framing: redraw or extend the outer rounded ends of BOTH blue tabs fully intact, then scale entire diaper down so its TOTAL WIDTH INCLUDING TABS is only 65% of canvas width, centered, at least 17% genuinely transparent margin on left and right, 15% top and bottom. No part may touch any image boundary. All tabs need rounded complete edges. Genuine transparent RGBA. No added objects, text, shadows or background. This will be an animation layer kit.

## cloth.png

出力ID `exec-07cb1ea1-46d7-401e-ad9a-5aa2fe3d49c2`。

> Use case illustration-story. Input STYLE REFERENCE ONLY. ONE square soft yellow handkerchief, front view, broad continuous opaque surface with softly rounded corners and subtle cloth folds only near edges, clear flat silhouette. Softly painted felt-paper children's picture book texture like reference, not real fabric photo, no stitch details or holes. Cloth is for hide-and-reveal peekaboo animation and should cover a toy completely. No face, hands, toy, people, text, logo, pattern or decoration. Genuine transparent RGBA background, square handkerchief centered in 65% of square canvas, all corners fully visible, generous margins.

## 追加制作（第2回）

組込み `image_gen` で次の4原画を追加しました。すべて `transparent_background: true`。**実際に使用した全文指示と出力IDは [sources/additional-prompts.json](sources/additional-prompts.json)** に保存しています。

- `hand-rig-v2.png`：掌と袖口、4本の指、親指の6部品。参照は `sources/generated/hand-wave.png`（絵柄参照）。
- `squeeze-block-v2.png`：握る・タップする対象の柔らかいブロック。参照は `sources/generated/toy.png`（絵柄参照）。握る動画は遮蔽と持ち方が未確定のため試作。
- `clothes-zipper-v2.png`：ファスナーを開いた前開き服。参照は `reference/artwork/candidates/clothes.webp`（絵柄参照）。
- `diaper-body-v2.png`：留め具を除いた完全なおむつ本体。`sources/generated/diaper.png` を事前に表示・確認して編集対象に指定。本体の再生成で色マスクによる欠けを回避。

透明画素のRGBには背景らしい色が残る場合があるため、見た目の検査はアルファを実合成した明暗背景で行っています。指の関節の隙間は生成後の部品配置で検出し、関節部を重ねて修正しました。画像生成の呼び出しを再現スクリプトに隠していません。
