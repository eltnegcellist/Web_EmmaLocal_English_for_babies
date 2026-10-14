// Planned reusable primitives only; this script never generates image files or imports runtime UI.
export const VISUAL_PRIMITIVES=[
  {
    "id": "scene.bath",
    "kind": "illustration",
    "fileStatus": "not-created",
    "description": "Reusable illustration layer: bath"
  },
  {
    "id": "scene.milk",
    "kind": "illustration",
    "fileStatus": "not-created",
    "description": "Reusable illustration layer: milk"
  },
  {
    "id": "scene.care",
    "kind": "illustration",
    "fileStatus": "not-created",
    "description": "Reusable illustration layer: care"
  },
  {
    "id": "scene.hands",
    "kind": "illustration",
    "fileStatus": "not-created",
    "description": "Reusable illustration layer: hands"
  },
  {
    "id": "scene.feet",
    "kind": "illustration",
    "fileStatus": "not-created",
    "description": "Reusable illustration layer: feet"
  },
  {
    "id": "scene.book",
    "kind": "illustration",
    "fileStatus": "not-created",
    "description": "Reusable illustration layer: book"
  },
  {
    "id": "scene.toy",
    "kind": "illustration",
    "fileStatus": "not-created",
    "description": "Reusable illustration layer: toy"
  },
  {
    "id": "scene.outdoor",
    "kind": "illustration",
    "fileStatus": "not-created",
    "description": "Reusable illustration layer: outdoor"
  },
  {
    "id": "scene.weather",
    "kind": "illustration",
    "fileStatus": "not-created",
    "description": "Reusable illustration layer: weather"
  },
  {
    "id": "scene.meal",
    "kind": "illustration",
    "fileStatus": "not-created",
    "description": "Reusable illustration layer: meal"
  },
  {
    "id": "scene.tummy",
    "kind": "illustration",
    "fileStatus": "not-created",
    "description": "Reusable illustration layer: tummy"
  },
  {
    "id": "scene.music",
    "kind": "illustration",
    "fileStatus": "not-created",
    "description": "Reusable illustration layer: music"
  },
  {
    "id": "scene.sleep",
    "kind": "illustration",
    "fileStatus": "not-created",
    "description": "Reusable illustration layer: sleep"
  },
  {
    "id": "scene.family",
    "kind": "illustration",
    "fileStatus": "not-created",
    "description": "Reusable illustration layer: family"
  },
  {
    "id": "motion.sip",
    "kind": "animation",
    "fileStatus": "not-created",
    "description": "Small motion layer: sip"
  },
  {
    "id": "motion.water",
    "kind": "animation",
    "fileStatus": "not-created",
    "description": "Small motion layer: water"
  },
  {
    "id": "motion.hand",
    "kind": "animation",
    "fileStatus": "not-created",
    "description": "Small motion layer: hand"
  },
  {
    "id": "motion.kick",
    "kind": "animation",
    "fileStatus": "not-created",
    "description": "Small motion layer: kick"
  },
  {
    "id": "motion.page",
    "kind": "animation",
    "fileStatus": "not-created",
    "description": "Small motion layer: page"
  },
  {
    "id": "motion.change",
    "kind": "animation",
    "fileStatus": "not-created",
    "description": "Small motion layer: change"
  },
  {
    "id": "motion.hug",
    "kind": "animation",
    "fileStatus": "not-created",
    "description": "Small motion layer: hug"
  },
  {
    "id": "motion.peekaboo",
    "kind": "animation",
    "fileStatus": "not-created",
    "description": "Small motion layer: peekaboo"
  },
  {
    "id": "motion.spoon",
    "kind": "animation",
    "fileStatus": "not-created",
    "description": "Small motion layer: spoon"
  },
  {
    "id": "motion.notes",
    "kind": "animation",
    "fileStatus": "not-created",
    "description": "Small motion layer: notes"
  },
  {
    "id": "emma.neutral",
    "kind": "avatar-state",
    "fileStatus": "not-created",
    "description": "Emma expression/pose concept: neutral"
  },
  {
    "id": "emma.smile",
    "kind": "avatar-state",
    "fileStatus": "not-created",
    "description": "Emma expression/pose concept: smile"
  },
  {
    "id": "emma.calm",
    "kind": "avatar-state",
    "fileStatus": "not-created",
    "description": "Emma expression/pose concept: calm"
  },
  {
    "id": "emma.celebrate",
    "kind": "avatar-state",
    "fileStatus": "not-created",
    "description": "Emma expression/pose concept: celebrate"
  },
  {
    "id": "emma.listen",
    "kind": "avatar-state",
    "fileStatus": "not-created",
    "description": "Emma expression/pose concept: listen"
  },
  {
    "id": "emma.ask",
    "kind": "avatar-state",
    "fileStatus": "not-created",
    "description": "Emma expression/pose concept: ask"
  },
  {
    "id": "emma.invite",
    "kind": "avatar-state",
    "fileStatus": "not-created",
    "description": "Emma expression/pose concept: invite"
  }
];
export const CUE_TO_PRIMITIVES={
  "emma.neutral": [
    "emma.neutral"
  ],
  "subject.bath": [
    "scene.bath"
  ],
  "subject.book": [
    "scene.book"
  ],
  "subject.clothes": [
    "scene.care"
  ],
  "subject.diaper": [
    "scene.care"
  ],
  "subject.drink": [
    "scene.milk"
  ],
  "subject.feet": [
    "scene.feet"
  ],
  "subject.food": [
    "scene.meal"
  ],
  "subject.hands": [
    "scene.hands"
  ],
  "subject.milk": [
    "scene.milk"
  ],
  "subject.music": [
    "scene.music"
  ],
  "subject.outside": [
    "scene.outdoor"
  ],
  "subject.rain": [
    "scene.weather"
  ],
  "subject.sun": [
    "scene.weather"
  ],
  "subject.toy": [
    "scene.toy"
  ],
  "subject.tummy": [
    "scene.tummy"
  ],
  "action.burp": [
    "scene.tummy",
    "motion.change"
  ],
  "action.clap": [
    "scene.hands",
    "motion.hand"
  ],
  "action.count": [
    "scene.hands",
    "motion.hand"
  ],
  "action.dress": [
    "scene.care",
    "motion.change"
  ],
  "action.eat": [
    "scene.meal",
    "motion.spoon"
  ],
  "action.hug": [
    "scene.family",
    "motion.hug"
  ],
  "action.kick": [
    "scene.feet",
    "motion.kick"
  ],
  "action.open-close": [
    "scene.hands",
    "motion.hand"
  ],
  "action.peekaboo": [
    "scene.family",
    "motion.peekaboo"
  ],
  "action.read": [
    "scene.book",
    "motion.page"
  ],
  "action.sing": [
    "scene.music",
    "motion.notes"
  ],
  "action.sip": [
    "scene.milk",
    "motion.sip"
  ],
  "action.sit": [
    "scene.family"
  ],
  "action.sleep": [
    "scene.sleep",
    "emma.calm"
  ],
  "action.splash": [
    "scene.bath",
    "motion.water"
  ],
  "action.squeeze": [
    "scene.hands",
    "motion.hand"
  ],
  "action.tap": [
    "scene.hands",
    "motion.hand"
  ],
  "action.turn-page": [
    "scene.book",
    "motion.page"
  ],
  "action.wake": [
    "scene.sleep",
    "emma.smile"
  ],
  "action.wash": [
    "scene.bath",
    "motion.water"
  ],
  "action.wave": [
    "scene.hands",
    "motion.hand"
  ],
  "action.wiggle": [
    "scene.hands",
    "motion.hand"
  ],
  "action.wipe": [
    "scene.care",
    "motion.change"
  ],
  "observed.cry": [
    "emma.calm"
  ],
  "observed.smile": [
    "emma.smile"
  ],
  "observed.voice": [
    "emma.listen"
  ],
  "social.achievement": [
    "emma.celebrate"
  ],
  "social.affection": [
    "emma.smile"
  ],
  "social.care": [
    "emma.calm"
  ],
  "social.effort": [
    "emma.calm"
  ],
  "social.encouragement": [
    "emma.celebrate"
  ],
  "social.greeting": [
    "emma.smile"
  ],
  "social.praise": [
    "emma.celebrate"
  ],
  "social.reassurance": [
    "emma.calm"
  ],
  "attention.listen": [
    "emma.listen"
  ],
  "attention.look": [
    "emma.listen"
  ],
  "dialogue.finish": [
    "emma.celebrate"
  ],
  "dialogue.finish-check": [
    "emma.ask"
  ],
  "dialogue.inquiry": [
    "emma.ask"
  ],
  "dialogue.invitation": [
    "emma.invite"
  ],
  "dialogue.pause": [
    "emma.calm"
  ],
  "dialogue.repeat": [
    "emma.invite"
  ],
  "dialogue.start": [
    "emma.invite"
  ]
};
export const PRIORITY_PROTOTYPES=[
  {
    "order": 1,
    "cueId": "action.sip",
    "goal": "milk drinking: clear bottle and tiny sipping movement"
  },
  {
    "order": 2,
    "cueId": "action.splash",
    "goal": "bath splashes with gentle water arcs"
  },
  {
    "order": 3,
    "cueId": "action.clap",
    "goal": "clapping hands using reusable hand shapes"
  },
  {
    "order": 4,
    "cueId": "action.wave",
    "goal": "hello gesture using same hand-shape primitives"
  },
  {
    "order": 5,
    "cueId": "action.kick",
    "goal": "one gentle foot movement"
  },
  {
    "order": 6,
    "cueId": "action.turn-page",
    "goal": "turn a page of a single book"
  },
  {
    "order": 7,
    "cueId": "subject.rain",
    "goal": "simple rain and listening cue without hand tapping"
  },
  {
    "order": 8,
    "cueId": "action.sleep",
    "goal": "quiet bedtime expression without implying crying"
  },
  {
    "order": 9,
    "cueId": "observed.smile",
    "goal": "Emma smiles; do not infer unknown feelings"
  },
  {
    "order": 10,
    "cueId": "social.reassurance",
    "goal": "Emma reassurance; no crying baby depiction"
  },
  {
    "order": 11,
    "cueId": "social.praise",
    "goal": "Emma celebrates without changing observed baby action"
  },
  {
    "order": 12,
    "cueId": "dialogue.finish-check",
    "goal": "asking whether finished without checkmark or completed badge"
  }
];
export function buildVisualAssetPlan(registry){
 const listed=new Set(primitives.map(x=>x.id));
 for(const values of Object.values(explicit))for(const v of values)if(!listed.has(v))throw Error("Unregistered primitive "+v);
 const bindings=registry.cues.map(c=>{
  const prim=explicit[c.id];if(!prim)throw Error("Unmapped Visual Cue: "+c.id);
  return {cueId:c.id,primitives:prim,buildStatus:"planned"};
 });
 const active=new Set(bindings.flatMap(x=>x.primitives));
 const primaryKinds={illustration:primitives.filter(x=>x.kind==="illustration").length,animation:primitives.filter(x=>x.kind==="animation").length,"avatar-state":primitives.filter(x=>x.kind==="avatar-state").length};
 return {schemaVersion:1,status:"concept-plan-only-no-assets-created",countSummary:{cueIds:bindings.length,conceptualPrimitives:primitives.length,byType:primaryKinds,currentlyReferencedPrimitives:active.size},
 guidelines:[
 "A Cue ID is not one image. Assemble reused illustration, small motion and existing Emma expression layers.",
 "Never depict a baby crying merely because the Japanese source matched a cry Topic; prefer soothing Emma.",
 "Do not show an action as completed when English asks whether it is finished or whether it should start.",
 "Keep illustrations calm, high-contrast, large shapes; no flashing, intense spinning or rapid transitions.",
 "Baby/parent positions do not imply infants can stand or sit independently; use age-appropriate poses.",
 "The visual layer is optional; reduced-motion, offline loading errors and stop/retry fall back to static neutral Emma.",
 "No external images, network or cloud dependency is authorized by this plan; assets to be authored separately."
 ],primitives,bindings,firstPrototypes:protos};
}
if(process.argv[1]?.endsWith('build-visual-cue-assets.mjs')){
 const {readFileSync,writeFileSync}=await import('node:fs');
 const registry=JSON.parse(readFileSync(new URL('../shared/visual-cue-namespaces.json',import.meta.url),'utf8'));
 const plan=buildVisualAssetPlan(registry);
 const file=new URL('../shared/visual-cue-asset-plan.json',import.meta.url);
 const out=JSON.stringify(plan,null,2)+'\n';
 if(process.argv.includes('--check')){if(readFileSync(file,'utf8')!==out)throw Error('Visual Cue plan stale');}
 else writeFileSync(file,out);
 console.log(JSON.stringify(plan.countSummary));
}
