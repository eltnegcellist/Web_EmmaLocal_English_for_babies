"""Prepare an isolated JVM test host using unchanged Android AI sources.
Usage: python3 scripts/prepare-ruri-android-host.py ../android
No Android repository files or SDK settings are changed.
"""
import pathlib, sys, shutil, json, hashlib
root = pathlib.Path(__file__).resolve().parents[1]
android = pathlib.Path(sys.argv[1]).resolve()
target = root / '.semantic-research/android-jvm'
main = target / 'src/main/kotlin/com/eltnegcellist/emma/ai'
test = target / 'src/test/kotlin/com/eltnegcellist/emma/ai'
main.mkdir(parents=True, exist_ok=True)
test.mkdir(parents=True, exist_ok=True)
hashes = {}
for p in (android / 'app/src/main/java/com/eltnegcellist/emma/ai').glob('*.kt'):
    if p.name in ['LiteEmmaClient.kt', 'RuriSemanticClassifier.kt', 'RuriSemanticModelStore.kt']: continue
    shutil.copy2(p, main / p.name)
    hashes[str(p.relative_to(android))] = hashlib.sha256(p.read_bytes()).hexdigest()
for p in (android / 'app/src/test/java/com/eltnegcellist/emma/ai').glob('*.kt'):
    shutil.copy2(p, test / p.name)
    hashes[str(p.relative_to(android))] = hashlib.sha256(p.read_bytes()).hexdigest()
p = android / 'app/src/main/java/com/eltnegcellist/emma/ai/RuriSemanticClassifier.kt'
source = p.read_text()
start = source.index('internal data class SemanticTopicPrediction(')
end = source.index('\n)', start) + 2
(main / 'SemanticTopicPrediction.kt').write_text('package com.eltnegcellist.emma.ai\n\n' + source[start:end] + '\n')
hashes[str(p.relative_to(android))] = hashlib.sha256(p.read_bytes()).hexdigest()
shutil.copy2(root / 'research/ruri-reevaluation-20261017/android-host/Main.kt', main / 'Main.kt')
(target / 'settings.gradle.kts').write_text('pluginManagement { repositories { mavenCentral(); gradlePluginPortal() } }\nrootProject.name = "RuriResearchHost"\n')
(target / 'build.gradle.kts').write_text('''plugins { kotlin("jvm") version "2.3.21"; application }
repositories { mavenCentral() }
kotlin { jvmToolchain(17) }
dependencies {
 implementation("com.microsoft.onnxruntime:onnxruntime:1.23.2")
 implementation("org.json:json:20240303")
 testImplementation("junit:junit:4.13.2")
}
application { mainClass.set("com.eltnegcellist.emma.ai.MainKt") }
tasks.test { testLogging { events("passed", "failed", "skipped") } }
''')
hash_output = pathlib.Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else root / 'research/ruri-reevaluation-20261017/android-source-hashes.json'
hash_output.parent.mkdir(parents=True, exist_ok=True)
hash_output.write_text(json.dumps(hashes, indent=2)+'\n')
print(target)
