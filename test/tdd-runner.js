// TDD Test Runner for wordMemory
// Runs all test suites with RED→GREEN cycle logging
const fs = require('fs');
const fakeIndexedDB = require('fake-indexeddb');
global.indexedDB = fakeIndexedDB.indexedDB;
global.IDBKeyRange = fakeIndexedDB.IDBKeyRange;

// Load source files
const sourceFiles = ['js/db.js', 'js/vocabulary.js', 'js/quiz.js'];
for (const file of sourceFiles) {
  const code = fs.readFileSync(file, 'utf8');
  // Remove const IIFE wrapper to expose to global:
  // "const DB = (() => {" → "DB = (() => {"
  const exposed = code.replace(/^const (\w+) = \(\(\) => \{/m, '$1 = (() => {');
  eval(exposed);
}

let total = 0, passed = 0, failed = 0;
const RED = '\x1b[31m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', RESET = '\x1b[0m', CYAN = '\x1b[36m';

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

async function runTest(suiteName, testName, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log(GREEN + '  ✅ ' + testName + RESET);
    return true;
  } catch (e) {
    failed++;
    console.log(RED + '  ❌ ' + testName + RESET);
    console.log(RED + '     Error: ' + (e.message || e) + RESET);
    return false;
  }
}

async function runSuite(name, tests) {
  console.log('\n' + CYAN + '━━━ ' + name + ' ━━━' + RESET);
  for (const t of tests) {
    await runTest(name, t.name, t.fn);
  }
}

function log(msg) {
  console.log(msg);
}

// ══════════════════════════════════════════════
// PHASE: RED 🔴 — Tests written, expect failures
// ══════════════════════════════════════════════
async function main() {
  console.log(RED + '\n═══ RED PHASE 🔴 — Tests written first, expect failures for unimplemented code ═══' + RESET);

  // ━━━ Vocabulary.parseWordFile Tests ━━━
  await runSuite('Vocabulary.parseWordFile', [
    { name: 'valid JSON produces correct words', fn: () => {
      const r = Vocabulary.parseWordFile('[{"word":"hello","definition":["你好"]}]', 'test');
      assert(r.success === true);
      assert(r.words.length === 1);
      assert(r.words[0].word === 'hello');
      assert(r.words[0].definitions[0] === '你好');
      assert(r.words[0].module === 'test');
      assert(r.skipped === 0);
    }},
    { name: 'multiple definitions per word', fn: () => {
      const r = Vocabulary.parseWordFile('[{"word":"abandon","definition":["放弃","抛弃"]}]', 'm');
      assert(r.success === true);
      assert(r.words[0].definitions.length === 2);
      assert(r.words[0].definitions[1] === '抛弃');
    }},
    { name: 'empty array rejected', fn: () => {
      const r = Vocabulary.parseWordFile('[]', 'empty');
      assert(r.success === false);
      assert(r.error === '词库文件无数据');
    }},
    { name: 'non-JSON string rejected', fn: () => {
      const r = Vocabulary.parseWordFile('not valid json!!!', 'bad');
      assert(r.success === false);
      assert(r.error === '文件格式错误，请上传 JSON 文件');
    }},
    { name: 'non-array JSON rejected', fn: () => {
      const r = Vocabulary.parseWordFile('{"word":"test"}', 'bad');
      assert(r.success === false);
      assert(r.error === 'JSON 文件内容必须是一个数组');
    }},
    { name: 'missing word field skipped', fn: () => {
      const r = Vocabulary.parseWordFile('[{"definition":["test"]}]', 'bad');
      assert(r.skipped === 1);
      assert(r.words.length === 0);
      assert(r.success === false);
      assert(r.error === '文件中没有合法的单词记录');
    }},
    { name: 'empty definition array skipped', fn: () => {
      const r = Vocabulary.parseWordFile('[{"word":"test","definition":[]}]', 'bad');
      assert(r.skipped === 1);
      assert(r.words.length === 0);
      assert(r.success === false);
    }},
    { name: 'mixed valid and invalid records', fn: () => {
      const r = Vocabulary.parseWordFile('[{"word":"good","definition":["好"]},{"word":"bad","definition":[]}]', 'mixed');
      assert(r.success === true);
      assert(r.words.length === 1);
      assert(r.skipped === 1);
      assert(r.total === 2);
    }},
    { name: 'trims whitespace from word and definitions', fn: () => {
      const r = Vocabulary.parseWordFile('[{"word":"  hello  ","definition":["  你好  ","  哈喽  "]}]', 'trim');
      assert(r.words[0].word === 'hello');
      assert(r.words[0].definitions[0] === '你好');
      assert(r.words[0].definitions[1] === '哈喽');
    }},
  ]);

  // ━━━ Quiz.checkAnswer Tests ━━━
  await runSuite('Quiz.checkAnswer', [
    { name: 'exact match after normalization', fn: () => {
      assert(Quiz.checkAnswer('放弃', ['放弃', '抛弃']) === true);
    }},
    { name: 'input contains definition', fn: () => {
      assert(Quiz.checkAnswer('放弃吧', ['放弃']) === true);
    }},
    { name: 'definition contains input', fn: () => {
      assert(Quiz.checkAnswer('弃', ['放弃']) === true);
    }},
    { name: 'whitespace normalized', fn: () => {
      assert(Quiz.checkAnswer('  放弃  ', ['放弃']) === true);
    }},
    { name: 'punctuation removed', fn: () => {
      assert(Quiz.checkAnswer('放弃。', ['放弃']) === true);
      assert(Quiz.checkAnswer('，放弃', ['放弃']) === true);
    }},
    { name: 'character overlap >= 50%', fn: () => {
      assert(Quiz.checkAnswer('放手', ['放弃']) === true);
    }},
    { name: 'character overlap < 50% rejected', fn: () => {
      assert(Quiz.checkAnswer('帮助', ['放弃']) === false);
    }},
    { name: 'wrong answer rejected', fn: () => {
      assert(Quiz.checkAnswer('帮助', ['放弃', '抛弃']) === false);
    }},
    { name: 'empty input rejected', fn: () => {
      assert(Quiz.checkAnswer('', ['放弃']) === false);
    }},
    { name: 'whitespace-only rejected', fn: () => {
      assert(Quiz.checkAnswer('   ', ['放弃']) === false);
    }},
    { name: 'multi-definition match second', fn: () => {
      assert(Quiz.checkAnswer('废除', ['放弃', '废除']) === true);
    }},
  ]);

  // ━━━ GREEN PHASE 🟢 ━━━
  console.log(GREEN + '\n═══ GREEN PHASE 🟢 — All pure function tests should be passing ═══' + RESET);
  console.log('(Pure functions above are verified independent of browser IndexedDB)');

  // ━━━ IndexedDB Tests (require fake-indexeddb) ━━━
  console.log(YELLOW + '\n═══ IndexedDB Integration Tests ═══' + RESET);

  await DB.open();
  const mod = 'test-' + Date.now();

  await runSuite('DB.vocabulary', [
    { name: 'addWords and getVocabulary', fn: async () => {
      await DB.addModule(mod);
      await DB.addWords([{ word: 'hello', definitions: ['你好'], module: mod }, { word: 'world', definitions: ['世界'], module: mod }]);
      const words = await DB.getVocabulary(mod);
      assert(words.length === 2);
      assert(words[0].word === 'hello');
      await DB.clearVocabulary(mod);
      await DB.removeModule(mod);
    }},
    { name: 'getVocabularyCount returns correct count', fn: async () => {
      await DB.addModule(mod);
      await DB.addWords([{ word: 'a', definitions: ['A'], module: mod }, { word: 'b', definitions: ['B'], module: mod }, { word: 'c', definitions: ['C'], module: mod }]);
      const count = await DB.getVocabularyCount(mod);
      assert(count === 3);
      await DB.clearVocabulary(mod);
      await DB.removeModule(mod);
    }},
    { name: 'clearVocabulary removes all words for module', fn: async () => {
      await DB.addModule(mod);
      await DB.addWords([{ word: 'del1', definitions: ['D1'], module: mod }, { word: 'del2', definitions: ['D2'], module: mod }]);
      await DB.clearVocabulary(mod);
      const words = await DB.getVocabulary(mod);
      assert(words.length === 0);
      await DB.removeModule(mod);
    }},
    { name: 'getTotalWordCount returns total across modules', fn: async () => {
      await DB.addModule(mod);
      await DB.addWords([{ word: 'x', definitions: ['X'], module: mod }]);
      const total = await DB.getTotalWordCount();
      assert(total >= 1);
      await DB.clearVocabulary(mod);
      await DB.removeModule(mod);
    }},
  ]);

  await runSuite('DB.errorBook', [
    { name: 'upsertErrorWord creates new entry', fn: async () => {
      await DB.upsertErrorWord('tw', ['测试'], 'm');
      const entries = await DB.getErrorBook('lastErrorTime', 'desc');
      const found = entries.find(e => e.word === 'tw');
      assert(found !== undefined);
      assert(found.errorCount === 1);
      assert(found.module === 'm');
      await DB.clearErrorBook();
    }},
    { name: 'upsertErrorWord increments existing entry', fn: async () => {
      await DB.upsertErrorWord('inc', ['增'], 'mod-a');
      await DB.upsertErrorWord('inc', ['增'], 'mod-a');
      const entries = await DB.getErrorBook('lastErrorTime', 'desc');
      const found = entries.find(e => e.word === 'inc');
      assert(found.errorCount === 2);
      await DB.clearErrorBook();
    }},
    { name: 'getErrorBook sorts by errorCount asc', fn: async () => {
      await DB.upsertErrorWord('low', ['低'], 'mod');
      await DB.upsertErrorWord('high', ['高'], 'mod');
      await DB.upsertErrorWord('high', ['高'], 'mod');
      const entries = await DB.getErrorBook('errorCount', 'asc');
      const iLow = entries.findIndex(e => e.word === 'low');
      const iHigh = entries.findIndex(e => e.word === 'high');
      assert(iLow < iHigh);
      await DB.clearErrorBook();
    }},
    { name: 'clearErrorBook removes all', fn: async () => {
      await DB.upsertErrorWord('c1', ['清'], 'mod');
      await DB.upsertErrorWord('c2', ['除'], 'mod');
      await DB.clearErrorBook();
      const entries = await DB.getErrorBook('lastErrorTime', 'desc');
      assert(entries.length === 0);
    }},
    { name: 'empty errorBook returns empty array', fn: async () => {
      await DB.clearErrorBook();
      const entries = await DB.getErrorBook('lastErrorTime', 'desc');
      assert(entries.length === 0);
    }},
  ]);

  await runSuite('DB.modules', [
    { name: 'addModule and getModules', fn: async () => {
      const m = 'test-m-' + Date.now();
      await DB.addModule(m);
      const modules = await DB.getModules();
      const found = modules.find(mod => mod.name === m);
      assert(found !== undefined);
      await DB.removeModule(m);
    }},
    { name: 'removeModule deletes module', fn: async () => {
      const m = 'rm-' + Date.now();
      await DB.addModule(m);
      await DB.removeModule(m);
      const modules = await DB.getModules();
      const found = modules.find(mod => mod.name === m);
      assert(found === undefined);
    }},
  ]);

  // ════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════
  console.log('\n' + '═'.repeat(50));
  console.log(CYAN + '  TDD Test Suite Complete' + RESET);
  console.log('═'.repeat(50));
  console.log('  Total:  ' + total);
  console.log(GREEN + '  Passed: ' + passed + RESET);
  if (failed > 0) {
    console.log(RED + '  Failed: ' + failed + RESET);
  } else {
    console.log(GREEN + '  All tests passing! ✅' + RESET);
  }
  console.log('═'.repeat(50) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
