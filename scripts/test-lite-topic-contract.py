#!/usr/bin/env python3
"""Verify generation is reproducible and rejects stale help or conflicting guide examples."""
import copy
import json
from pathlib import Path
import runpy
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
GENERATOR = ROOT / 'scripts/generate-lite-topic-contract.py'
DATA = json.loads((ROOT / 'shared/lite-topic-contract.json').read_text())
VALIDATE = runpy.run_path(str(GENERATOR))['validate']


class ContractGenerationTest(unittest.TestCase):
    def test_conflicting_published_example_is_rejected(self):
        changed = copy.deepcopy(DATA)
        changed['topics'][0]['examples'][0] = '説明だけに追加した未検証の例'
        with self.assertRaisesRegex(ValueError, 'Guide example'):
            VALIDATE(changed)

    def test_documented_expiry_must_match_sequence_length(self):
        changed = copy.deepcopy(DATA)
        changed['rules']['contextFollowupTurns'] += 1
        with self.assertRaisesRegex(ValueError, 'Expiry fixture'):
            VALIDATE(changed)

    def test_generated_output_is_reproducible_and_manual_edits_fail(self):
        for target, output in [
            ('web', 'topic-guide.html'),
            ('android', 'app/src/main/java/com/eltnegcellist/emma/ai/LiteTopicGuide.kt'),
            ('android', 'app/src/test/java/com/eltnegcellist/emma/ai/LiteTopicContractFixtures.kt'),
        ]:
            with self.subTest(target=target, output=output), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                (root / 'scripts').mkdir()
                (root / 'shared').mkdir()
                shutil.copy2(GENERATOR, root / 'scripts')
                shutil.copy2(ROOT / 'shared/lite-topic-contract.json', root / 'shared')
                if target == 'web':
                    # The contract generates semantic content independently from page layout.
                    (root / 'topic-guide.template.html').write_text('{{GUIDE_CONTENT}}\n')
                command = [sys.executable, str(root / 'scripts/generate-lite-topic-contract.py'), '--target', target]
                subprocess.run(command, check=True, capture_output=True)
                subprocess.run(command + ['--check'], check=True, capture_output=True)
                path = root / output
                path.write_text(path.read_text() + '\nManual edit\n')
                result = subprocess.run(command + ['--check'], capture_output=True, text=True)
                self.assertNotEqual(0, result.returncode)
                self.assertIn('Stale generated output', result.stderr)


if __name__ == '__main__':
    unittest.main()
