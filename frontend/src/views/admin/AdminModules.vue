<template>
  <div class="card">
    <h2>词库管理</h2>
    <div style="margin:14px 0;display:flex;gap:10px">
      <input v-model="newModuleName" class="input" placeholder="新词库名称" style="flex:1" @keydown.enter="createModule" />
      <button class="btn btn--primary" @click="createModule">创建词库</button>
    </div>

    <div v-for="mod in modules" :key="mod.id" style="margin-bottom:16px;border:1px solid var(--color-glass-border);border-radius:var(--radius);padding:16px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <strong>{{ mod.name }}</strong>
        <span style="color:var(--color-text-secondary);font-size:0.85rem">{{ mod.words_count || 0 }} 个单词</span>
      </div>
      <div class="btn-group" style="margin:8px 0">
        <button class="btn" @click="toggleExpand(mod.id)">
          {{ expanded === mod.id ? '收起单词' : '查看单词' }}
        </button>
        <button class="btn" @click="renameModule(mod)">重命名</button>
        <button class="btn btn--danger" @click="deleteModule(mod)">删除词库</button>
      </div>

      <div v-if="expanded === mod.id">
        <div style="margin:8px 0;display:flex;gap:8px">
          <input v-model="newWord.word" class="input" placeholder="英文单词" style="flex:1" />
          <input v-model="newWord.definitions" class="input" placeholder="释义（分号分隔）" style="flex:1" />
          <button class="btn btn--primary" @click="addWord(mod.id)">添加</button>
        </div>

        <div class="table-wrap" style="margin-top:8px">
          <table class="table">
            <thead><tr><th>单词</th><th>释义</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="w in wordsList[mod.id] || []" :key="w.id">
                <td>{{ w.word }}</td>
                <td>{{ Array.isArray(w.definitions) ? w.definitions.join('；') : w.definitions }}</td>
                <td><button class="btn btn--danger" @click="deleteWord(mod.id, w.id)">删除</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import request from '../../api/request'

const modules = ref([])
const expanded = ref(null)
const wordsList = reactive({})
const newModuleName = ref('')
const newWord = reactive({ word: '', definitions: '' })

async function fetchModules() {
  const res = await request.get('/admin/modules')
  modules.value = res.data
}

async function createModule() {
  if (!newModuleName.value) return
  await request.post('/admin/modules', { name: newModuleName.value })
  newModuleName.value = ''
  fetchModules()
}

async function renameModule(mod) {
  const name = prompt('新名称:', mod.name)
  if (name) {
    await request.put(`/admin/modules/${mod.id}`, { name })
    fetchModules()
  }
}

async function deleteModule(mod) {
  if (confirm(`确认删除词库 "${mod.name}" 及其所有单词？`)) {
    await request.delete(`/admin/modules/${mod.id}`)
    expanded.value = null
    fetchModules()
  }
}

async function toggleExpand(modId) {
  if (expanded.value === modId) {
    expanded.value = null
    return
  }
  expanded.value = modId
  const res = await request.get(`/admin/modules/${modId}/words`)
  wordsList[modId] = res.data.map(w => ({
    ...w,
    definitions: typeof w.definitions === 'string' ? JSON.parse(w.definitions) : w.definitions
  }))
}

async function addWord(modId) {
  if (!newWord.word || !newWord.definitions) return
  const defs = newWord.definitions.split(/[；;]/).map(s => s.trim()).filter(Boolean)
  await request.post(`/admin/modules/${modId}/words`, { word: newWord.word, definitions: defs })
  newWord.word = ''
  newWord.definitions = ''
  const res2 = await request.get(`/admin/modules/${modId}/words`)
  wordsList[modId] = res2.data.map(w => ({
    ...w,
    definitions: typeof w.definitions === 'string' ? JSON.parse(w.definitions) : w.definitions
  }))
  fetchModules()
}

async function deleteWord(modId, wordId) {
  if (confirm('确认删除该单词？')) {
    await request.delete(`/admin/words/${wordId}`)
    const res = await request.get(`/admin/modules/${modId}/words`)
    wordsList[modId] = res.data.map(w => ({
      ...w,
      definitions: typeof w.definitions === 'string' ? JSON.parse(w.definitions) : w.definitions
    }))
    fetchModules()
  }
}

onMounted(fetchModules)
</script>
