"""Research-only MAP softmax head update. Requires numpy; no sklearn or GPU.

Run reevaluate-ruri-thresholds.mjs first to compute actual ONNX embeddings.
Only head-training.json train/development labels participate in fitting/selection.
Weights remain under research/, never in semantic-assets/.
"""
import json
import pathlib
import hashlib
import sys
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
DIR = ROOT / 'research/ruri-reevaluation-20261017'
ASSET = ROOT / 'semantic-assets/ruri70-int8-bd500193'
load = lambda p: json.loads(p.read_text())
dataset = load(DIR / 'head-training.json')['cases']
cache = load(ROOT / '.semantic-research/reevaluation-cache.json')
legacy = load(ROOT / 'research/interaction-ruri-qa-probes-20261013.json')['cases']
evaluation = load(DIR / 'evaluation.json')['cases']
assert not {x['text'] for x in dataset} & {x['text'] for x in legacy + evaluation}
assert not {x['family'] for x in dataset if x['split'] == 'train'} & {x['family'] for x in dataset if x['split'] == 'development'}
assert not {x['family'] for x in dataset} & {x['family'] for x in evaluation}
config = load(ASSET / 'heads-config.json')
classes = {'topic': config['heads']['topic']['classes'], 'interaction': ['affection', 'praise', 'achievement', 'effort', 'encouragement', 'invitation', 'start', 'finish', 'finish_check', 'care', 'inquiry', 'reassurance', 'repeat', 'pause', 'none']}
splits = {s: [x for x in dataset if x['split'] == s] for s in ['train', 'development']}
X = {s: np.array([cache['embeddings'][x['text']]['embedding'] + [1.] for x in xs], dtype=np.float64) for s, xs in splits.items()}

def probabilities(x, w):
    z = x @ w.T
    z -= z.max(axis=1, keepdims=True)
    p = np.exp(z)
    return p / p.sum(axis=1, keepdims=True)

def measure(x, w, y):
    p = probabilities(x, w)
    return {'raw_exact': int((p.argmax(axis=1) == y).sum()), 'n': len(y), 'cross_entropy': float(-np.log(p[np.arange(len(y)), y]).mean())}

report = dict(status='RESEARCH_ONLY_UNAPPROVED_SYNTHETIC_HEADS',
    method='Full-batch softmax cross-entropy plus lambda/2 * ||W-W_original||^2; fixed encoder; 800 steps, lr=4; float64 optimizer, float32 saved heads.',
    selection='Per-axis lowest development cross entropy, no evaluation/legacy67 selection; ties prefer stronger prior. Development construction families are disjoint.',
    grid=[.01, .001, .0001], steps=800, learning_rate=4.,
    train_count=len(splits['train']), development_count=len(splits['development']),
    numpy=np.__version__, python=sys.version.split()[0], embedding_cache_key=cache['key'],
    human_adjudicated_training=0, limitations='Tiny unapproved synthetic corpus, partial coverage, no original 477-item training corpus in repository. This is a feasibility/failure experiment, not a deployment recommendation.', heads={})
for axis, labels in classes.items():
    fallback = 'generic' if axis == 'topic' else 'none'
    Y = {s: np.array([labels.index(x['expected_' + axis] or fallback) for x in xs]) for s, xs in splits.items()}
    original = np.fromfile(ASSET / ('head-' + axis + '.f32'), dtype='<f4').astype(np.float64).reshape(len(labels), 385)
    results = []
    for lam in report['grid']:
        w = original.copy()
        for _ in range(report['steps']):
            error = probabilities(X['train'], w)
            error[np.arange(len(Y['train'])), Y['train']] -= 1.
            gradient = error.T @ X['train'] / len(Y['train']) + lam * (w - original)
            w -= report['learning_rate'] * gradient
        # Evaluate exactly the FP32 coefficients the JS runtime will consume.
        w = w.astype('<f4').astype(np.float64)
        results.append((measure(X['development'], w, Y['development'])['cross_entropy'], lam, w))
    best = min(results, key=lambda r: (r[0], -r[1]))
    filename = 'experimental-head-' + axis + '.f32'
    best[2].astype('<f4').tofile(DIR / filename)
    report['heads'][axis] = dict(classes=labels, selected_lambda=best[1], filename=filename,
        sha256=hashlib.sha256((DIR / filename).read_bytes()).hexdigest(),
        original={s: measure(X[s], original, Y[s]) for s in splits},
        grid=[dict(prior_lambda=lam, train=measure(X['train'], w, Y['train']), development=measure(X['development'], w, Y['development'])) for _, lam, w in results],
        train_class_support={c: int((Y['train'] == i).sum()) for i, c in enumerate(labels)},
        development_class_support={c: int((Y['development'] == i).sum()) for i, c in enumerate(labels)})
(DIR / 'head-training-result.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(report, ensure_ascii=False, indent=2))
