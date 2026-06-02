<template>
  <div>
    <div class="card">
      <h2>单词抽查</h2>
      <div style="margin-top:14px">
        <div class="slider-wrap" style="margin-bottom:12px">
          <span>数量:</span>
          <input id="quiz-count-slider" class="slider" type="range" v-model.number="count" :max="totalWords" min="0" style="flex:1" />
          <span class="slider-value" id="quiz-count-display">{{ count }}</span>
        </div>
        <button id="quiz-start" class="btn btn--primary" style="width:100%" @click="start" :disabled="count === 0">开始抽查</button>
      </div>
    </div>

    <div id="quiz-play-area" v-if="active" style="display:block" class="card">
      <div id="quiz-word">{{ words[currentIndex]?.word }}</div>
      <div class="word-phonetic" v-if="words[currentIndex]?.phonetic">{{ words[currentIndex].phonetic }}</div>
      <div class="progress" id="quiz-progress">进度: {{ currentIndex + 1 }} / {{ words.length }}</div>
      <input id="quiz-input" class="input" v-model="quizInput" placeholder="输入释义..." @keydown="onKeydown" />
      <div class="btn-group">
        <button id="quiz-submit" class="btn btn--primary" @click="submit">确认</button>
        <button id="quiz-forgot" class="btn btn--danger" @click="forgot">忘了</button>
      </div>
      <div id="quiz-feedback" v-html="feedback"></div>
    </div>

    <div id="quiz-result" v-if="result && !active" style="display:block">
      <div class="card">
        <div class="feedback" :class="wrongWords.length === 0 ? 'feedback--correct' : 'feedback--wrong'">
          抽查完成！正确率 {{ words.length - wrongWords.length }} / {{ words.length }}
        </div>
        <div v-if="wrongWords.length > 0" style="margin-top:16px">
          <h3>错词列表</h3>
          <button class="btn btn--primary" id="quiz-export-pdf" style="margin:8px 0" @click="exportWrongWordsPDF">导出PDF</button>
          <div class="table-wrap" style="margin-top:8px">
            <table class="table">
              <thead><tr>
                <th>单词</th><th>释义</th><th>你的回答</th>
              </tr></thead>
              <tbody>
                <tr v-for="(w, i) in wrongWords" :key="i">
                  <td style="font-weight:bold">{{ w.word }}</td>
                  <td>{{ w.definitions.join('；') }}</td>
                  <td style="color:var(--color-danger)">{{ w.answer }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getWords, markLearned } from '../api/words'
import { getErrors } from '../api/errors'
import { useModuleStore } from '../stores/modules'
import html2canvas from 'html2canvas'

const moduleStore = useModuleStore()

const totalWords = ref(0)
const count = ref(5)
const words = ref([])
const currentIndex = ref(0)
const active = ref(false)
const wrongWords = ref([])
const quizInput = ref('')
const feedback = ref('')
const result = ref(false)

function norm(s) {
  return s.replace(/^[，。！？、,.!?\s]+/, '').replace(/[，。！？、,.!?\s]+$/, '').trim()
}

function charOverlap(a, b) {
  const setA = new Set([...a])
  const setB = new Set([...b])
  let common = 0
  for (const c of setA) { if (setB.has(c)) common++ }
  return common / setA.size
}

function checkAnswer(input, definitions) {
  const userNorm = norm(input)
  if (!userNorm) return false
  for (const def of definitions) {
    const defNorm = norm(def)
    if (userNorm === defNorm) return true
    if (userNorm.includes(defNorm) || defNorm.includes(userNorm)) return true
    if (charOverlap(userNorm, defNorm) >= 0.5) return true
  }
  return false
}

async function fetchTotal() {
  await moduleStore.fetchUser()
  await moduleStore.fetchAll()
  totalWords.value = moduleStore.userModules.reduce((sum, um) => sum + (um.module?.words?.length || 0), 0)
  // Fallback: if no imported modules, estimate from all available modules
  if (totalWords.value === 0 && moduleStore.allModules.length > 0) {
    totalWords.value = moduleStore.allModules.length * 500
  }
  if (count.value > totalWords.value && totalWords.value > 0) {
    count.value = Math.min(5, totalWords.value)
  }
}

async function start() {
  if (count.value === 0) return

  const errorWords = await getErrors({ sort: 'error_count', order: 'desc' })
  const allWords = []
  // Use imported modules if available, otherwise fallback to all modules
  const sourceModules = moduleStore.userModules.length > 0
    ? moduleStore.userModules
    : moduleStore.allModules.filter(m => m.name !== 'modules').map(m => ({ module_id: m.id }))
  for (const um of sourceModules) {
    const res = await getWords({ module_id: um.module_id, count: 9999 })
    allWords.push(...res.data)
  }

  const picked = []
  const usedWords = new Set()

  for (const ew of errorWords.data) {
    if (picked.length >= count.value) break
    if (!usedWords.has(ew.word)) {
      picked.push({ id: ew.word_id || 0, word: ew.word, definitions: ew.definitions, module: ew.module })
      usedWords.add(ew.word)
    }
  }

  const remaining = allWords.filter(w => !usedWords.has(w.word))
  const shuffled = remaining.sort(() => Math.random() - 0.5)
  for (const w of shuffled) {
    if (picked.length >= count.value) break
    picked.push(w)
    usedWords.add(w.word)
  }

  words.value = picked.slice(0, count.value)
  currentIndex.value = 0
  wrongWords.value = []
  active.value = true
  result.value = false
  feedback.value = ''
}

async function submit() {
  if (!active.value) return
  const word = words.value[currentIndex.value]
  const isCorrect = checkAnswer(quizInput.value, word.definitions)

  if (isCorrect) {
    feedback.value = `<div class="feedback feedback--correct">正确！${word.word}: ${word.definitions.join('；')}</div>`
    await markLearned(word.id, 1)
  } else {
    feedback.value = `<div class="feedback feedback--wrong">错误！${word.word}: ${word.definitions.join('；')}</div>`
    await markLearned(word.id, 0)
    wrongWords.value.push({ word: word.word, definitions: word.definitions, answer: quizInput.value })
  }

  currentIndex.value++
  if (currentIndex.value >= words.value.length) {
    setTimeout(() => finish(), 1500)
  } else {
    setTimeout(() => {
      quizInput.value = ''
      feedback.value = ''
    }, 1500)
  }
}

async function forgot() {
  if (!active.value) return
  const word = words.value[currentIndex.value]
  feedback.value = `<div class="feedback feedback--wrong">${word.word}: ${word.definitions.join('；')}</div>`
  await markLearned(word.id, 0)
  wrongWords.value.push({ word: word.word, definitions: word.definitions, answer: '(忘了)' })
  currentIndex.value++
  if (currentIndex.value >= words.value.length) {
    setTimeout(() => finish(), 1500)
  } else {
    setTimeout(() => {
      quizInput.value = ''
      feedback.value = ''
    }, 1500)
  }
}

function onKeydown(e) {
  if (e.key === 'Enter' && active.value) submit()
}

function finish() {
  active.value = false
  result.value = true
  quizInput.value = ''
  feedback.value = ''
}

async function exportWrongWordsPDF() {
  if (wrongWords.value.length === 0) return

  const container = document.createElement('div')
  container.style.cssText = 'position:absolute;left:-9999px;top:0;width:600px;font-family:"Nunito Sans",sans-serif;font-size:12px;color:#333;background:#fff;padding:16px'

  const today = new Date()
  const pad = n => String(n).padStart(2, '0')
  const dateStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

  let html = '<h2 style="margin-bottom:12px">抽查错词</h2>'
  html += `<p style="margin-bottom:8px;color:#666">${dateStr}</p>`
  html += '<table style="width:100%;border-collapse:collapse;font-size:11px">'
  html += '<thead><tr style="background:#9B7ED8;color:#fff">'
  html += '<th style="padding:8px;border:1px solid #ddd">#</th>'
  html += '<th style="padding:8px;border:1px solid #ddd">单词</th>'
  html += '<th style="padding:8px;border:1px solid #ddd">释义</th>'
  html += '<th style="padding:8px;border:1px solid #ddd">你的回答</th>'
  html += '</tr></thead><tbody>'

  wrongWords.value.forEach((w, i) => {
    const bg = i % 2 === 0 ? '#fff' : '#f5f2fc'
    html += `<tr style="background:${bg}">`
    html += '<td style="padding:6px 8px;border:1px solid #ddd">' + (i + 1) + '</td>'
    html += '<td style="padding:6px 8px;border:1px solid #ddd;font-weight:bold">' + w.word + '</td>'
    html += '<td style="padding:6px 8px;border:1px solid #ddd">' + w.definitions.join('；') + '</td>'
    html += '<td style="padding:6px 8px;border:1px solid #ddd;color:#D04A5A">' + w.answer + '</td>'
    html += '</tr>'
  })

  html += '</tbody></table>'
  container.innerHTML = html
  document.body.appendChild(container)

  try {
    const canvas = await html2canvas(container, { scale: 2 })
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF('p', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 10
    const imgWidth = pageWidth - margin * 2
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    let heightLeft = imgHeight
    let position = margin
    const imgData = canvas.toDataURL('image/png')
    doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
    heightLeft -= (pageHeight - margin * 2)
    while (heightLeft > 0) {
      position = margin - (imgHeight - (pageHeight - margin * 2))
      doc.addPage()
      doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
      heightLeft -= (pageHeight - margin * 2)
    }
    doc.save('抽查错词_' + dateStr + '.pdf')
  } finally {
    document.body.removeChild(container)
  }
}

onMounted(fetchTotal)
</script>
