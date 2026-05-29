const Memory = (() => {
  let words = [];
  let currentIndex = 0;
  let dunnoCount = 0;
  let active = false;
  let history = [];
  let quizPool = [];
  let quizPositions = [];
  let quizUsed = new Set();
  let inQuiz = false;
  let currentQuizWord = null;

  async function init() {
    await refreshModuleSelect();
    document.getElementById('memory-start').addEventListener('click', start);
    document.getElementById('memory-know').addEventListener('click', () => answer(false));
    document.getElementById('memory-dunno').addEventListener('click', () => answer(true));
    document.getElementById('memory-prev').addEventListener('click', goBack);
    document.getElementById('memory-next').addEventListener('click', nextWord);
    document.getElementById('memory-quiz-submit').addEventListener('click', submitQuiz);
    document.getElementById('memory-quiz-forgot').addEventListener('click', forgotQuiz);
    document.getElementById('memory-quiz-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && inQuiz) submitQuiz();
    });

    document.querySelectorAll('.memory-count').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.memory-count').forEach(b => b.classList.remove('btn--active'));
        btn.classList.add('btn--active');
        document.getElementById('memory-count-custom').value = '';
      });
    });
  }

  async function refreshModuleSelect() {
    const modules = await DB.getModules();
    const select = document.getElementById('memory-module');
    select.innerHTML = modules.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
    if (modules.length === 0) {
      select.innerHTML = '<option value="">请先上传词库</option>';
      document.getElementById('memory-start').disabled = true;
    } else {
      document.getElementById('memory-start').disabled = false;
    }
  }

  function getSelectedCount() {
    const custom = parseInt(document.getElementById('memory-count-custom').value, 10);
    if (!isNaN(custom) && custom > 0) return custom;
    const active = document.querySelector('.memory-count.btn--active');
    return active ? parseInt(active.dataset.count, 10) : 10;
  }

  async function start() {
    const moduleName = document.getElementById('memory-module').value;
    if (!moduleName) return;

    const allWords = await DB.getVocabulary(moduleName);
    if (allWords.length === 0) return;

    const count = Math.min(getSelectedCount(), allWords.length);
    const shuffled = allWords.sort(() => Math.random() - 0.5);
    words = shuffled.slice(0, count);
    currentIndex = 0;
    dunnoCount = 0;
    history = [];
    active = true;

    const quizCount = Math.ceil(count / 5);
    const errorWords = await DB.getErrorBook('errorCount', 'desc');
    const shuffledErrors = errorWords.sort(() => Math.random() - 0.5);
    quizPool = shuffledErrors.slice(0, quizCount).map(e => ({
      word: e.word,
      definitions: e.definitions,
      module: e.module || ''
    }));
    quizUsed = new Set();

    quizPositions = [];
    for (let i = 0; i < quizPool.length; i++) {
      quizPositions.push(Math.floor(Math.random() * count));
    }
    quizPositions.sort((a, b) => a - b);

    inQuiz = false;
    currentQuizWord = null;

    document.getElementById('memory-play-area').style.display = 'block';
    document.getElementById('memory-result').style.display = 'none';
    document.getElementById('memory-start').disabled = true;
    document.getElementById('memory-prev').disabled = true;
    document.getElementById('memory-next').style.display = 'none';
    document.getElementById('memory-quiz-area').style.display = 'none';
    document.getElementById('memory-regular-btns').style.display = '';
    showCurrentWord();
  }

  function showCurrentWord() {
    if (currentIndex >= words.length) {
      finish();
      return;
    }
    document.getElementById('memory-word').textContent = words[currentIndex].word;
    document.getElementById('memory-progress').textContent =
      `进度: ${currentIndex + 1} / ${words.length}`;
    document.getElementById('memory-definition').style.display = 'none';
    document.getElementById('memory-next').style.display = 'none';
    document.getElementById('memory-prev').disabled = history.length === 0;
    document.getElementById('memory-know').style.display = '';
    document.getElementById('memory-dunno').style.display = '';
  }

  async function answer(isDunno) {
    if (!active || inQuiz) return;

    history.push({ index: currentIndex, action: isDunno ? 'dunno' : 'know' });

    if (isDunno) {
      const w = words[currentIndex];
      document.getElementById('memory-definition').textContent =
        w.definitions.join('；');
      document.getElementById('memory-definition').style.display = 'block';
      document.getElementById('memory-next').style.display = 'inline-block';
      document.getElementById('memory-know').style.display = 'none';
      document.getElementById('memory-dunno').style.display = 'none';
      dunnoCount++;
      await DB.upsertErrorWord(w.word, w.definitions, w.module);
      addToQuizPool(w);
    } else {
      const w = words[currentIndex];
      document.getElementById('memory-definition').textContent =
        w.definitions.join('；');
      document.getElementById('memory-definition').style.display = 'block';
      document.getElementById('memory-know').style.display = 'none';
      document.getElementById('memory-dunno').style.display = 'none';
      document.getElementById('memory-prev').disabled = true;
      currentIndex++;
      setTimeout(() => {
        document.getElementById('memory-definition').style.display = 'none';
        document.getElementById('memory-know').style.display = '';
        document.getElementById('memory-dunno').style.display = '';
        maybeQuizOrAdvance();
      }, 2000);
    }
  }

  async function nextWord() {
    if (!active || inQuiz) return;
    document.getElementById('memory-definition').style.display = 'none';
    document.getElementById('memory-next').style.display = 'none';
    document.getElementById('memory-know').style.display = '';
    document.getElementById('memory-dunno').style.display = '';
    currentIndex++;
    maybeQuizOrAdvance();
  }

  function addToQuizPool(word) {
    quizPool.push(word);
    if (currentIndex < words.length - 1) {
      const pos = Math.floor(Math.random() * (words.length - currentIndex - 1)) + currentIndex + 1;
      quizPositions.push(pos);
      quizPositions.sort((a, b) => a - b);
    }
  }

  function maybeQuizOrAdvance() {
    if (currentIndex >= words.length) {
      finish();
      return;
    }
    if (quizPositions.length > 0 && currentIndex === quizPositions[0] && quizPool.length > 0) {
      quizPositions.shift();
      startQuiz();
    } else {
      showCurrentWord();
    }
  }

  function startQuiz() {
    const available = quizPool.filter(w => !quizUsed.has(w.word));
    if (available.length === 0) {
      showCurrentWord();
      return;
    }
    inQuiz = true;
    currentQuizWord = available[Math.floor(Math.random() * available.length)];
    quizUsed.add(currentQuizWord.word);

    document.getElementById('memory-word').textContent = currentQuizWord.word;
    document.getElementById('memory-quiz-area').style.display = 'block';
    document.getElementById('memory-regular-btns').style.display = 'none';
    document.getElementById('memory-definition').style.display = 'none';
    document.getElementById('memory-next').style.display = 'none';
    document.getElementById('memory-prev').disabled = true;
    document.getElementById('memory-quiz-input').value = '';
    document.getElementById('memory-quiz-feedback').innerHTML = '';
    document.getElementById('memory-quiz-input').focus();
  }

  async function submitQuiz() {
    if (!inQuiz) return;
    const input = document.getElementById('memory-quiz-input').value;
    const isCorrect = Quiz.checkAnswer(input, currentQuizWord.definitions);
    const fb = document.getElementById('memory-quiz-feedback');

    if (isCorrect) {
      fb.innerHTML = `<div class="feedback feedback--correct">正确！${currentQuizWord.word}: ${currentQuizWord.definitions.join('；')}</div>`;
    } else {
      fb.innerHTML = `<div class="feedback feedback--wrong">错误！${currentQuizWord.word}: ${currentQuizWord.definitions.join('；')}</div>`;
      await DB.upsertErrorWord(currentQuizWord.word, currentQuizWord.definitions, currentQuizWord.module || '');
    }

    setTimeout(() => exitQuiz(), 1500);
  }

  async function forgotQuiz() {
    if (!inQuiz) return;
    document.getElementById('memory-quiz-feedback').innerHTML =
      `<div class="feedback feedback--wrong">${currentQuizWord.word}: ${currentQuizWord.definitions.join('；')}</div>`;
    await DB.upsertErrorWord(currentQuizWord.word, currentQuizWord.definitions, currentQuizWord.module || '');

    setTimeout(() => exitQuiz(), 1500);
  }

  function exitQuiz() {
    document.getElementById('memory-quiz-area').style.display = 'none';
    document.getElementById('memory-regular-btns').style.display = '';
    document.getElementById('memory-quiz-feedback').innerHTML = '';
    inQuiz = false;
    currentQuizWord = null;
    showCurrentWord();
  }

  async function goBack() {
    if (inQuiz) {
      document.getElementById('memory-quiz-area').style.display = 'none';
      document.getElementById('memory-regular-btns').style.display = '';
      document.getElementById('memory-quiz-feedback').innerHTML = '';
      inQuiz = false;
      currentQuizWord = null;
      showCurrentWord();
      return;
    }
    if (history.length === 0) return;
    const last = history.pop();

    if (last.action === 'dunno') {
      dunnoCount--;
      await DB.decrementOrRemoveErrorWord(words[last.index].word);
    }

    currentIndex = last.index;
    showCurrentWord();
  }

  function finish() {
    active = false;
    inQuiz = false;
    currentQuizWord = null;
    quizPool = [];
    quizPositions = [];
    quizUsed = new Set();
    document.getElementById('memory-play-area').style.display = 'none';
    document.getElementById('memory-quiz-area').style.display = 'none';
    document.getElementById('memory-regular-btns').style.display = '';
    document.getElementById('memory-start').disabled = false;
    const result = document.getElementById('memory-result');
    result.style.display = 'block';
    result.innerHTML = `
      <div class="feedback feedback--correct">
        本轮完成！共 ${words.length} 个单词，不会 ${dunnoCount} 个
      </div>`;
  }

  return { init, refreshModuleSelect };
})();
