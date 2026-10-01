import assert from 'node:assert/strict';
import { LiteResponseEngine } from './src/lite-response-engine.js';

// Text fixtures, including simulated ASR errors; these are not an ASR accuracy benchmark.
export const topicCases = [
  ['こんにちは そろそろ寝ましょうね', 'sleep'],
  ['そろそろねましょうね', 'sleep'],
  ['もう寝ちゃったね', 'sleep'],
  ['ねむくなってきましたね', 'sleep'],
  ['そろそろ寝ませんか', 'sleep'],
  ['お昼寝の時間ですよ', 'sleep'],
  ['こんにちは、おふろに入りましょう', 'bath'],
  ['からだを洗いましょうね', 'bath'],
  ['おふらに入ろうね', 'bath'],
  ['ミルクを飲みましょうね', 'milk'],
  ['みるこを飲もうね', 'milk'],
  ['みりく飲もうか', 'milk'],
  ['ぼにゅうにしようね', 'milk'],
  ['ほにゅうびんだよ', 'milk'],
  ['そろそろ起きましょうね', 'wake'],
  ['おきましょうね', 'wake'],
  ['目を覚ましたね', 'wake'],
  ['おむつを取り替えましょう', 'diaper'],
  ['おむちをかえようね', 'diaper'],
  ['おしっこが出ましたね', 'diaper'],
  ['きがえましょうね', 'clothes'],
  ['洋服を着ましょうね', 'clothes'],
  ['ぱじゃまに着替えよう', 'clothes'],
  ['だっこしましょうね', 'hug'],
  ['だつこしようか', 'hug'],
  ['ぎゅっと抱きしめよう', 'hug'],
  ['おててをにぎってるね', 'hands'],
  ['てをにぎりましょうね', 'hands'],
  ['ゆびをつかんだね', 'hands'],
  ['あんよがばたばたしてるね', 'feet'],
  ['あしを動かしてるね', 'feet'],
  ['足を蹴っているね', 'feet'],
  ['かわいいえがおですね', 'smile'],
  ['にこにこしていますね', 'smile'],
  ['わらってるね', 'smile'],
  ['ないちゃったね', 'cry'],
  ['ぐずぐずしてるね', 'cry'],
  ['泣いていますね', 'cry'],
  ['ないてるね', 'cry'],
  ['こえを出しているね', 'voice'],
  ['おしゃべりしていますね', 'voice'],
  ['なんごが出たね', 'voice'],
  ['げっぷが出ましたね', 'tummy'],
  ['げつぷが出たね', 'tummy'],
  ['おなかいっぱいですね', 'tummy'],
  ['いっしょに遊びましょうね', 'play'],
  ['あそびましょうね', 'play'],
  ['おもちょで遊ぼうね', 'play'],
  ['さんぽに行きましょうね', 'outside'],
  ['べびーかーでお出かけしよう', 'outside'],
  ['こうえんに行こうね', 'outside'],
  ['あめが降っていますね', 'rain'],
  ['あまおとが聞こえるね', 'rain'],
  ['はれてきましたね', 'sun'],
  ['たいようが出ているね', 'sun'],
  ['ぽかぽかしていますね', 'sun'],
  ['ごはんを食べましょうね', 'food'],
  ['たべましょうね', 'food'],
  ['りにゅうしょくだよ', 'food'],
  ['おなかがすいたね', 'food'],
  ['えほんを読みましょうね', 'book'],
  ['えほうを読もうね', 'book'],
  ['ほんをよみましょうね', 'book'],
  ['うたを歌いましょうね', 'music'],
  ['おんがき聞こうね', 'music'],
  ['踊りましょうね', 'music'],
];

const negatives = [
  'こんにちは、今日もよろしくね', '今日は会社で会議だったよ',
  '今日はゆっくりしようね', 'かわいいね', 'いい感じですね',
  'そろそろ帰りましょうね', 'お手紙を書きましょう', '手続きをしましょう',
  '手伝いましょうね', '足りないですね', '明日の予定を決めましょう',
  '風呂敷を包みましょう', 'ふろしきを包もうね', '歌舞伎を見よう',
  'かぶきを見よう', '声優さんの話だよ', 'せいゆうさんの話だよ',
  '寝返りしましたね', 'ねがえりしたね', '本当にそうですね',
  '飴を買いましょう', '紙を重ねるよ', 'みるこさんに会ったよ',
  '紙を重ねましょう', 'かさねておきましょう', '真似ましょう', '友達をたずねましょう',
];

let hits = 0;
const misses = [];
for (const [text, scene] of topicCases) {
  const out = new LiteResponseEngine().respond(text);
  if (out.scene === scene) hits++;
  else misses.push(`${text}: ${out.scene}, expected ${scene}`);
}
console.log(`Topic fixtures: ${hits}/${topicCases.length}`);
for (const text of negatives) {
  const out = new LiteResponseEngine().respond(text);
  if (out.scene !== 'generic') misses.push(`${text}: ${out.scene}, expected generic`);
}
console.log(`Unrelated/ambiguous fixtures: ${negatives.length}`);
assert.equal(misses.length, 0, misses.join('\n'));

const engine = new LiteResponseEngine();
assert.equal(engine.respond('ミルク飲もうね').scene, 'milk');
assert.equal(engine.respond('こんにちは そろそろ寝ましょうね').scene, 'sleep');
assert.equal(engine.respond('気持ちいいですね').scene, 'sleep');
assert.equal(engine.respond('えほうを読もうね').scene, 'book');
for (let i = 0; i < 6; i++) assert.equal(engine.respond('いい感じですね').scene, 'book');
assert.equal(engine.respond('いい感じですね').scene, 'generic');
console.log('Topic switch and six-turn expiry OK');
