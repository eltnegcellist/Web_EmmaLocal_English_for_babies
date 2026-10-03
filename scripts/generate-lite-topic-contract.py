#!/usr/bin/env python3
"""Generate bundled guides/fixtures from the shared contract; --check rejects stale output."""
import argparse
import hashlib
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / 'shared/lite-topic-contract.json'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def validate(data):
    require(data['schemaVersion'] == 1, 'Unsupported contract schema')
    require(type(data['rules']['contextFollowupTurns']) is int and data['rules']['contextFollowupTurns'] > 0,
            'Invalid context follow-up limit')
    topics = data['topics']
    scenes = [topic['scene'] for topic in topics]
    require(len(scenes) == len(set(scenes)) and 'generic' not in scenes, 'Duplicate/invalid topics')
    valid_scenes = set(scenes) | {'generic'}
    by_text = {}
    ids = set()
    for case in data['cases']:
        require(case['id'] not in ids, f"Duplicate case ID: {case['id']}")
        ids.add(case['id'])
        require(case['text'] and case['text'] not in by_text, f"Duplicate/empty case: {case['text']}")
        require(case['scene'] in valid_scenes and type(case['meaningful']) is bool, 'Invalid case')
        by_text[case['text']] = case
    for topic in topics:
        require(topic['title'] and topic['clues'] and topic['examples'], 'Incomplete guide topic')
        for text in topic['examples']:
            case = by_text.get(text)
            require(case is not None and case['scene'] == topic['scene'] and case['meaningful'],
                    f'Guide example lacks a matching accepted contract case: {text}')
    sequence_ids = set()
    for sequence in data['sequences']:
        require(sequence['id'] not in sequence_ids and sequence['steps'], 'Duplicate/empty sequence')
        sequence_ids.add(sequence['id'])
        for step in sequence['steps']:
            if step.get('reset') is True:
                require(set(step) == {'reset'}, 'Reset must not also contain a turn')
            else:
                require(step['text'] and step['scene'] in valid_scenes and type(step['meaningful']) is bool,
                        'Invalid sequence turn')
        if sequence['id'].endswith('-expiry'):
            turns = data['rules']['contextFollowupTurns']
            steps = sequence['steps']
            require(len(steps) == turns + 2 and steps[-1]['scene'] == 'generic'
                    and all(x['scene'] == steps[0]['scene'] for x in steps[1:-1]),
                    'Expiry fixture must test exactly the documented context limit')


def kt(value):
    return json.dumps(value, ensure_ascii=False).replace('$', '\\$')


def kt_list(values):
    return 'listOf(' + ', '.join(kt(value) for value in values) + ')'


def section_paragraphs(data, name, target):
    location = 'この端末のブラウザ内' if target == 'web' else 'この端末内'
    paragraphs = [p.format(processingLocation=location, **data['rules'])
                  for p in data['guide']['sections'][name]['paragraphs']]
    if name == 'context':
        paragraphs[1:1] = [s['description'] for s in data['sequences'] if 'description' in s]
    return paragraphs


def android_guide(data, digest):
    out = [f'// Generated from shared/lite-topic-contract.json (SHA-256 {digest}). Do not edit.',
           'package com.eltnegcellist.emma.ai', '', 'internal object LiteTopicGuide {',
           '    data class Topic(val scene: String, val title: String, val clues: String,',
           '                     val examples: List<String>, val note: String = "")',
           '    data class Section(val title: String, val paragraphs: List<String>)', '',
           '    const val INTRO = ' + kt(data['guide']['intro']['android']),
           '    const val TOPICS_INTRO = ' + kt(data['guide']['topicsIntro'].format(childcareTopicCount=len(data['topics']) - 1)), '']
    for name in ['logic', 'context', 'tips']:
        out += ['    val ' + name + ' = Section(',
                '        ' + kt(data['guide']['sections'][name]['title']) + ', listOf(']
        out += ['            ' + kt(p) + ',' for p in section_paragraphs(data, name, 'android')]
        out += ['        ),', '    )', '']
    out += ['    val topics = listOf(']
    for t in data['topics']:
        out += ['        Topic(' + ', '.join(kt(t[x]) for x in ['scene', 'title', 'clues']) + ',',
                '            ' + kt_list(t['examples']) + ', ' + kt(t['note']) + '),']
    out += ['    )', '}', '']
    return '\n'.join(out)


def android_fixtures(data, digest):
    out = [f'// Generated from shared/lite-topic-contract.json (SHA-256 {digest}). Do not edit.',
           'package com.eltnegcellist.emma.ai', '', 'internal object LiteTopicContractFixtures {',
           '    data class Case(val id: String, val text: String, val scene: String, val meaningful: Boolean)',
           '    data class Step(val text: String? = null, val scene: String? = null,',
           '                    val meaningful: Boolean = true, val reset: Boolean = false)',
           '    data class Sequence(val id: String, val steps: List<Step>)',
           f"    const val CONTEXT_FOLLOWUP_TURNS = {data['rules']['contextFollowupTurns']}",
           '    val cases = listOf(']
    for c in data['cases']:
        out += ['        Case(' + ', '.join(kt(c[x]) for x in ['id', 'text', 'scene']) + ', '
                + str(c['meaningful']).lower() + '),']
    out += ['    )', '    val sequences = listOf(']
    for sequence in data['sequences']:
        out += ['        Sequence(' + kt(sequence['id']) + ', listOf(']
        for step in sequence['steps']:
            out += ['            Step(reset = true),' if step.get('reset') else
                    '            Step(' + kt(step['text']) + ', ' + kt(step['scene']) + ', '
                    + str(step['meaningful']).lower() + '),']
        out += ['        )),']
    out += ['    )', '}', '']
    return '\n'.join(out)


def web_content(data, digest):
    esc = html.escape
    def section(name):
        title = esc(data['guide']['sections'][name]['title'])
        paragraphs = section_paragraphs(data, name, 'web')
        rows = '\n'.join('      <p>' + esc(p).replace('\n', '<br>') + '</p>' for p in paragraphs)
        return f'    <section class="card" id="{name}">\n      <h2>{title}</h2>\n{rows}\n    </section>'
    rows = []
    for topic in data['topics']:
        examples = ''.join(f'<span class="utterance" data-scene="{esc(topic["scene"])}">{esc(t)}</span>'
                           for t in topic['examples'])
        note = f'<small>{esc(topic["note"])}</small>' if topic['note'] else ''
        rows.append(f'          <tr><th scope="row">{esc(topic["title"])}</th><td>'
                    f'<span class="guide-words">{esc(topic["clues"])}</span>{examples}{note}</td></tr>')
    topics = '\n'.join(rows)
    intro = esc(data['guide']['intro']['web'])
    return f'''    <!-- Generated from shared/lite-topic-contract.json (SHA-256 {digest}). Do not edit. -->
    <header>
      <a href="./">← みつことばを開く</a>
      <h1>話題の判定方法・話題一覧</h1>
      <p>{intro}</p>
      <nav class="guide-nav" aria-label="このページの目次">
        <a href="#logic">判定の仕組み</a><a href="#topics">話題と呼びかけ例</a><a href="#context">話題の引き継ぎ</a><a href="#tips">拾われにくいとき</a>
      </nav>
    </header>
{section('logic')}
    <section class="card table-card" id="topics">
      <h2>話題と呼びかけ例</h2>
      <p>{esc(data['guide']['topicsIntro'].format(childcareTopicCount=len(data['topics']) - 1))}</p>
      <table>
        <caption class="small muted">話題ごとの拾いやすい言葉と、日本語の呼びかけ例</caption>
        <thead><tr><th scope="col">話題</th><th scope="col">手がかり・呼びかけ例</th></tr></thead>
        <tbody>
{topics}
        </tbody>
      </table>
    </section>
{section('context')}
{section('tips')}
    <footer><a href="#">ページの先頭へ</a><p class="small muted">みつことば Web</p></footer>'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', choices=['web', 'android'], required=True)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    raw = CONTRACT.read_bytes()
    data = json.loads(raw)
    validate(data)
    digest = hashlib.sha256(raw).hexdigest()
    if args.target == 'web':
        template = (ROOT / 'topic-guide.template.html').read_text()
        require(template.count('{{GUIDE_CONTENT}}') == 1, 'Guide template must have one content marker')
        files = {'topic-guide.html': template.replace('{{GUIDE_CONTENT}}', web_content(data, digest))}
    else:
        files = {'app/src/main/java/com/eltnegcellist/emma/ai/LiteTopicGuide.kt': android_guide(data, digest),
                 'app/src/test/java/com/eltnegcellist/emma/ai/LiteTopicContractFixtures.kt': android_fixtures(data, digest)}
    stale = []
    for name, content in files.items():
        path = ROOT / name
        if args.check:
            if not path.exists() or path.read_text() != content:
                stale.append(name)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
    require(not stale, 'Stale generated output: ' + ', '.join(stale) + '. Run this generator without --check.')
    print(f"Contract {data['revision']}: {len(data['cases'])} cases, {len(data['sequences'])} sequences, "
          f"{len(data['topics'])} topics; {args.target} {'checked' if args.check else 'generated'}")


if __name__ == '__main__':
    main()
