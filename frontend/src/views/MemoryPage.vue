<template>
  <div>
    <div class="card">
      <h2>单词记忆</h2>
      <div style="margin-top:14px">
        <select v-model="selectedModule" class="select" id="memory-module" style="width:100%;margin-bottom:12px">
          <option value="">请选择词库</option>
          <option v-for="m in availableModules" :key="m.id" :value="m.id">
            {{ m.name }}{{ m.learned_count > 0 ? ` — ${m.learned_count}/${m.words_count}` : '' }}
          </option>
        </select>

        <div v-if="selectedModule && currentProgress" class="memory-progress-card">
          <div class="memory-progress-text">已学 {{ currentProgress.learned }} / {{ currentProgress.total }}</div>
          <div class="memory-progress-bar">
            <div class="memory-progress-fill" :style="{ width: currentProgress.percent + '%' }"></div>
          </div>
          <div class="memory-progress-pct">{{ currentProgress.percent }}%</div>
        </div>

        <div class="btn-group" style="margin-bottom:12px">
          <button class="btn memory-count" :class="{ 'btn--active': selectedCount === 10 }" @click="setCount(10)">10</button>
          <button class="btn memory-count" :class="{ 'btn--active': selectedCount === 20 }" @click="setCount(20)">20</button>
          <button class="btn memory-count" :class="{ 'btn--active': selectedCount === 50 }" @click="setCount(50)">50</button>
          <input v-model.number="customCount" id="memory-count-custom" class="input" style="width:80px" type="number" placeholder="自定义" @input="onCustomCount" />
        </div>

        <button id="memory-start" class="btn btn--primary" style="width:100%" @click="start" :disabled="!selectedModule">开始记忆</button>
      </div>

    </div>

    <div id="memory-play-area" v-if="active" style="display:block" class="card">
      <div id="memory-word">{{ currentWord?.word }}</div>
      <div class="word-phonetic" v-if="currentWord?.phonetic">{{ currentWord.phonetic }}</div>
      <div class="progress" id="memory-progress">进度: {{ currentIndex + 1 }} / {{ words.length }}</div>

      <div id="memory-definition" v-show="showDefinition" style="display:none">
        {{ currentWord?.definitions?.join('；') }}
      </div>

      <div id="memory-regular-btns" v-show="!inQuiz && !showDefinition">
        <div class="btn-group">
          <button id="memory-know" class="btn btn--success" @click="answer(false)">会</button>
          <button id="memory-dunno" class="btn btn--danger" @click="answer(true)">不会</button>
        </div>
        <button id="memory-prev" class="btn" style="margin-top:8px" @click="goBack" :disabled="history.length === 0 && !inQuiz">返回上一词</button>
      </div>

      <button id="memory-next" v-show="showDefinition && dunnoPending" class="btn btn--primary" @click="nextWord">下一个</button>

      <div id="memory-quiz-area" v-show="inQuiz" style="display:none">
        <input id="memory-quiz-input" class="input" v-model="quizInput" placeholder="输入释义..." @keydown="onQuizKeydown" />
        <div class="btn-group">
          <button id="memory-quiz-submit" class="btn btn--primary" @click="submitQuiz">确认</button>
          <button id="memory-quiz-forgot" class="btn btn--danger" @click="forgotQuiz">忘了</button>
        </div>
        <div id="memory-quiz-feedback" v-html="quizFeedback"></div>
      </div>
    </div>

    <div id="memory-result" v-if="result" class="card" style="display:block">
      <div class="feedback feedback--correct">
        本轮完成！共 {{ words.length }} 个单词，不会 {{ dunnoCount }} 个
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getWords, markLearned } from '../api/words'
import { getErrors } from '../api/errors'
import { useModuleStore } from '../stores/modules'

const moduleStore = useModuleStore()

const selectedModule = ref('')
const selectedCount = ref(10)
const customCount = ref(null)
const words = ref([])
const currentIndex = ref(0)
const dunnoCount = ref(0)
const active = ref(false)
const history = ref([])
const showDefinition = ref(false)
const dunnoPending = ref(false)
const inQuiz = ref(false)
const quizInput = ref('')
const quizFeedback = ref('')
const result = ref(false)

let quizPool = []
let quizPositions = []
let quizUsed = new Set()
let currentQuizWord = null
let knowTimeout = null

const availableModules = computed(() => {
  return moduleStore.allModules
    .filter(m => m.name !== 'modules')
    .map(m => ({ id: m.id, name: m.name, learned_count: m.learned_count, words_count: m.words_count }))
})

const currentProgress = computed(() => {
  const m = availableModules.value.find(m => m.id == selectedModule.value)
  if (!m || !m.words_count) return null
  return {
    learned: m.learned_count || 0,
    total: m.words_count,
    percent: Math.round((m.learned_count || 0) / m.words_count * 100)
  }
})

const currentWord = computed(() => words.value[currentIndex.value])

function setCount(n) {
  selectedCount.value = n
  customCount.value = null
}

function onCustomCount() {
  if (customCount.value && customCount.value > 0) selectedCount.value = customCount.value
}

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

async function start() {
  if (!selectedModule.value) return

  const res = await getWords({ module_id: selectedModule.value, count: selectedCount.value })
  if (res.data.length === 0) return

  words.value = res.data
  currentIndex.value = 0
  dunnoCount.value = 0
  history.value = []
  active.value = true
  showDefinition.value = false
  dunnoPending.value = false
  result.value = false

  const quizCount = Math.ceil(selectedCount.value / 5)
  const errRes = await getErrors({ sort: 'error_count', order: 'desc' })
  const shuffled = (errRes.data || []).sort(() => Math.random() - 0.5)
  quizPool = shuffled.slice(0, quizCount).map(e => ({
    id: e.word_id,
    word: e.word,
    definitions: e.definitions,
    module: e.module || '',
  }))
  quizUsed = new Set()

  quizPositions = []
  for (let i = 0; i < quizPool.length; i++) {
    quizPositions.push(Math.floor(Math.random() * words.value.length))
  }
  quizPositions.sort((a, b) => a - b)

  inQuiz.value = false
  currentQuizWord = null
  quizFeedback.value = ''
  showCurrentWord()
}

function showCurrentWord() {
  if (currentIndex.value >= words.value.length) {
    finish()
    return
  }
  showDefinition.value = false
  dunnoPending.value = false
}

async function answer(isDunno) {
  if (!active.value || inQuiz.value) return
  if (knowTimeout) clearTimeout(knowTimeout)

  history.value.push({ index: currentIndex.value, action: isDunno ? 'dunno' : 'know' })
  showDefinition.value = true

  if (isDunno) {
    dunnoPending.value = true
    dunnoCount.value++
    const w = words.value[currentIndex.value]
    await markLearned(w.id, 0)
    addToQuizPool({ id: w.id, word: w.word, definitions: w.definitions, module: '' })
  } else {
    dunnoPending.value = false
    const w = words.value[currentIndex.value]
    await markLearned(w.id, 1)
    knowTimeout = setTimeout(() => {
      showDefinition.value = false
      currentIndex.value++
      maybeQuizOrAdvance()
    }, 2000)
  }
}

async function nextWord() {
  if (!active.value || inQuiz.value) return
  dunnoPending.value = false
  showDefinition.value = false
  currentIndex.value++
  maybeQuizOrAdvance()
}

function addToQuizPool(word) {
  quizPool.push(word)
  if (currentIndex.value < words.value.length - 1) {
    const pos = Math.floor(Math.random() * (words.value.length - currentIndex.value - 1)) + currentIndex.value + 1
    quizPositions.push(pos)
    quizPositions.sort((a, b) => a - b)
  }
}

function maybeQuizOrAdvance() {
  if (currentIndex.value >= words.value.length) {
    finish()
    return
  }
  if (quizPositions.length > 0 && currentIndex.value === quizPositions[0] && quizPool.length > 0) {
    quizPositions.shift()
    startQuiz()
  } else {
    showCurrentWord()
  }
}

function startQuiz() {
  const available = quizPool.filter(w => !quizUsed.has(w.word))
  if (available.length === 0) {
    showCurrentWord()
    return
  }
  inQuiz.value = true
  currentQuizWord = available[Math.floor(Math.random() * available.length)]
  quizUsed.add(currentQuizWord.word)
  quizInput.value = ''
  quizFeedback.value = ''
}

async function submitQuiz() {
  if (!inQuiz.value) return
  const isCorrect = checkAnswer(quizInput.value, currentQuizWord.definitions)
  if (isCorrect) {
    quizFeedback.value = `<div class="feedback feedback--correct">正确！${currentQuizWord.word}: ${currentQuizWord.definitions.join('；')}</div>`
  } else {
    quizFeedback.value = `<div class="feedback feedback--wrong">错误！${currentQuizWord.word}: ${currentQuizWord.definitions.join('；')}</div>`
    await markLearned(currentQuizWord.id, 0)
  }
  setTimeout(() => exitQuiz(), 1500)
}

async function forgotQuiz() {
  if (!inQuiz.value) return
  quizFeedback.value = `<div class="feedback feedback--wrong">${currentQuizWord.word}: ${currentQuizWord.definitions.join('；')}</div>`
  await markLearned(currentQuizWord.id, 0)
  setTimeout(() => exitQuiz(), 1500)
}

function exitQuiz() {
  inQuiz.value = false
  currentQuizWord = null
  quizFeedback.value = ''
  showCurrentWord()
}

function onQuizKeydown(e) {
  if (e.key === 'Enter' && inQuiz.value) submitQuiz()
}

async function goBack() {
  if (inQuiz.value) {
    inQuiz.value = false
    currentQuizWord = null
    quizFeedback.value = ''
    showCurrentWord()
    return
  }
  if (history.value.length === 0) return
  if (knowTimeout) clearTimeout(knowTimeout)
  const last = history.value.pop()
  if (last.action === 'dunno') {
    dunnoCount.value--
  }
  currentIndex.value = last.index
  showDefinition.value = false
  dunnoPending.value = false
  showCurrentWord()
}

function finish() {
  active.value = false
  inQuiz.value = false
  currentQuizWord = null
  quizPool = []
  quizPositions = []
  quizUsed = new Set()
  showDefinition.value = false
  dunnoPending.value = false
  result.value = true
  if (knowTimeout) clearTimeout(knowTimeout)
}

onMounted(async () => {
  await moduleStore.fetchAll()
})
</script>
