const Quiz = (() => {
  let words = [];
  let currentIndex = 0;
  let correctCount = 0;
  let active = false;
let wrongWords = [];

  function normalize(str) {
    return str.replace(/^[，。！？、,.!?\s]+/, '').replace(/[，。！？、,.!?\s]+$/, '').trim();
  }

  function charOverlap(a, b) {
    const setA = new Set([...a]);
    const setB = new Set([...b]);
    let common = 0;
    for (const c of setA) {
      if (setB.has(c)) common++;
    }
    return common / setA.size;
  }

  function checkAnswer(input, definitions) {
    const userNorm = normalize(input);
    if (!userNorm) return false;

    for (const def of definitions) {
      const defNorm = normalize(def);
      if (userNorm === defNorm) return true;
      if (userNorm.includes(defNorm) || defNorm.includes(userNorm)) return true;
      if (charOverlap(userNorm, defNorm) >= 0.5) return true;
    }
    return false;
  }

  async function init() {
    document.getElementById('quiz-start').addEventListener('click', start);
    document.getElementById('quiz-submit').addEventListener('click', submit);
    document.getElementById('quiz-forgot').addEventListener('click', forgot);

    const slider = document.getElementById('quiz-count-slider');
    const display = document.getElementById('quiz-count-display');
    slider.addEventListener('input', () => {
      display.textContent = slider.value;
      document.getElementById('quiz-start').disabled = parseInt(slider.value) === 0;
    });

    document.getElementById('quiz-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && active) submit();
    });
  }

  async function refreshState() {
    const total = await DB.getTotalWordCount();
    document.getElementById('quiz-total-words').textContent = total;
    const slider = document.getElementById('quiz-count-slider');
    slider.max = total;
    if (parseInt(slider.value) > total || parseInt(slider.value) === 0 && total > 0) {
      slider.value = total > 0 ? Math.min(5, total) : 0;
    }
    document.getElementById('quiz-start').disabled = total === 0 || parseInt(slider.value) === 0;
    document.getElementById('quiz-count-display').textContent = slider.value;
  }

  async function start() {
    const count = parseInt(document.getElementById('quiz-count-slider').value);
    if (count === 0) return;

    await DB.open();
    const errorWords = await DB.getErrorBook('errorCount', 'desc');
    const allWords = await DB.getAllWords();

    const picked = [];
    const usedWords = new Set();

    for (const ew of errorWords) {
      if (picked.length >= count) break;
      if (!usedWords.has(ew.word)) {
        picked.push(ew);
        usedWords.add(ew.word);
      }
    }

    const remaining = allWords.filter(w => !usedWords.has(w.word));
    const shuffled = remaining.sort(() => Math.random() - 0.5);
    for (const w of shuffled) {
      if (picked.length >= count) break;
      picked.push(w);
    }

    words = picked.slice(0, count);
    currentIndex = 0;
    correctCount = 0;
    wrongWords = [];
    active = true;

    document.getElementById('quiz-play-area').style.display = 'block';
    document.getElementById('quiz-result').style.display = 'none';
    document.getElementById('quiz-start').disabled = true;
    showCurrentWord();
  }

  function showCurrentWord() {
    if (currentIndex >= words.length) { finish(); return; }
    document.getElementById('quiz-word').textContent = words[currentIndex].word;
    document.getElementById('quiz-progress').textContent =
      `进度: ${currentIndex + 1} / ${words.length}`;
    document.getElementById('quiz-input').value = '';
    document.getElementById('quiz-feedback').innerHTML = '';
    document.getElementById('quiz-input').focus();
  }

  async function submit() {
    if (!active) return;
    const input = document.getElementById('quiz-input').value;
    const word = words[currentIndex];
    const isCorrect = checkAnswer(input, word.definitions);
    const fb = document.getElementById('quiz-feedback');

    if (isCorrect) {
      correctCount++;
      fb.innerHTML = `<div class="feedback feedback--correct">正确！${word.word}: ${word.definitions.join('；')}</div>`;
    } else {
      fb.innerHTML = `<div class="feedback feedback--wrong">错误！${word.word}: ${word.definitions.join('；')}</div>`;
      await DB.upsertErrorWord(word.word, word.definitions, word.module || '');
      wrongWords.push({ word: word.word, definitions: word.definitions, answer: input });
    }

    currentIndex++;
    setTimeout(() => showCurrentWord(), 1500);
  }

  async function forgot() {
    if (!active) return;
    const word = words[currentIndex];
    document.getElementById('quiz-feedback').innerHTML =
      `<div class="feedback feedback--wrong">${word.word}: ${word.definitions.join('；')}</div>`;
    await DB.upsertErrorWord(word.word, word.definitions, word.module || '');
    wrongWords.push({ word: word.word, definitions: word.definitions, answer: '(忘了)' });
    currentIndex++;
    setTimeout(() => showCurrentWord(), 1500);
  }

  function finish() {
    active = false;
    document.getElementById('quiz-play-area').style.display = 'none';
    document.getElementById('quiz-start').disabled = false;
    refreshState();
    const result = document.getElementById('quiz-result');
    result.style.display = 'block';

    const wrongCount = wrongWords.length;
    const total = words.length;
    const correct = total - wrongCount;

    let html = '<div class="feedback ' + (wrongCount === 0 ? 'feedback--correct' : 'feedback--wrong') + '">抽查完成！正确率 ' + correct + ' / ' + total + '</div>';

    if (wrongCount > 0) {
      html += '<div style="margin-top:16px"><h3>错词列表</h3>';
      html += '<button class="btn btn--primary" id="quiz-export-pdf" style="margin:8px 0">导出PDF</button>';
      html += '<div class="table-wrap" style="margin-top:8px"><table class="table"><thead><tr>';
      html += '<th>单词</th><th>释义</th><th>你的回答</th>';
      html += '</tr></thead><tbody>';
      wrongWords.forEach(function(w) {
        html += '<tr><td style="font-weight:bold">' + w.word + '</td>';
        html += '<td>' + w.definitions.join('；') + '</td>';
        html += '<td style="color:var(--color-danger)">' + w.answer + '</td></tr>';
      });
      html += '</tbody></table></div></div>';
    }

    result.innerHTML = html;

    if (wrongCount > 0) {
      document.getElementById('quiz-export-pdf').addEventListener('click', exportWrongWordsPDF);
    }
  }

  async function exportWrongWordsPDF() {
    if (wrongWords.length === 0) return;

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '600px';
    container.style.fontFamily = '"Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    container.style.fontSize = '12px';
    container.style.color = '#333';
    container.style.background = '#fff';
    container.style.padding = '16px';

    const today = new Date();
    const pad = n => String(n).padStart(2, '0');
    const dateStr = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());

    let html = '<h2 style="margin-bottom:12px">抽查错词</h2>';
    html += '<p style="margin-bottom:8px;color:#666">' + dateStr + '</p>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:11px">';
    html += '<thead><tr style="background:#9B7ED8;color:#fff">';
    html += '<th style="padding:8px;border:1px solid #ddd">#</th>';
    html += '<th style="padding:8px;border:1px solid #ddd">单词</th>';
    html += '<th style="padding:8px;border:1px solid #ddd">释义</th>';
    html += '<th style="padding:8px;border:1px solid #ddd">你的回答</th>';
    html += '</tr></thead><tbody>';

    wrongWords.forEach(function(w, i) {
      var bg = i % 2 === 0 ? '#fff' : '#f5f2fc';
      html += '<tr style="background:' + bg + '">';
      html += '<td style="padding:6px 8px;border:1px solid #ddd">' + (i + 1) + '</td>';
      html += '<td style="padding:6px 8px;border:1px solid #ddd;font-weight:bold">' + w.word + '</td>';
      html += '<td style="padding:6px 8px;border:1px solid #ddd">' + w.definitions.join('；') + '</td>';
      html += '<td style="padding:6px 8px;border:1px solid #ddd;color:#D04A5A">' + w.answer + '</td>';
      html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, { scale: 2 });
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('p', 'mm', 'a4');

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;
      const imgData = canvas.toDataURL('image/png');

      doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);

      while (heightLeft > 0) {
        position = margin - (imgHeight - (pageHeight - margin * 2));
        doc.addPage();
        doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - margin * 2);
      }

      doc.save('抽查错词_' + dateStr + '.pdf');
    } finally {
      document.body.removeChild(container);
    }
  }

  return { init, refreshState, checkAnswer };
})();
