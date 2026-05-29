<template>
  <div>
    <div class="card">
      <h2>生词本</h2>
      <div class="btn-group" style="margin-bottom:14px">
        <button id="errorbook-clear" class="btn btn--danger" @click="handleClear">清空生词本</button>
        <button id="errorbook-export" class="btn btn--primary" @click="exportPDF" :disabled="data.length === 0">导出PDF</button>
      </div>
    </div>

    <div class="empty" v-if="data.length === 0" id="errorbook-empty">暂无生词</div>

    <div class="table-wrap" v-else>
      <table class="table" id="errorbook-table">
        <thead>
          <tr>
            <th>#</th>
            <th data-sort="word" @click="toggleSort('word')">单词 <span class="table__sort-icon">{{ sortIcon('word') }}</span></th>
            <th data-sort="definitions" @click="toggleSort('definitions')">释义 <span class="table__sort-icon">{{ sortIcon('definitions') }}</span></th>
            <th data-sort="module_id" @click="toggleSort('module_id')">来源模块 <span class="table__sort-icon">{{ sortIcon('module_id') }}</span></th>
            <th data-sort="error_count" @click="toggleSort('error_count')">错误次数 <span class="table__sort-icon">{{ sortIcon('error_count') }}</span></th>
            <th data-sort="last_error_time" @click="toggleSort('last_error_time')">最后错误时间 <span class="table__sort-icon">{{ sortIcon('last_error_time') }}</span></th>
          </tr>
        </thead>
        <tbody id="errorbook-tbody">
          <tr v-for="(item, i) in data" :key="i">
            <td>{{ i + 1 }}</td>
            <td>{{ item.word }}</td>
            <td>{{ item.definitions.join('；') }}</td>
            <td>{{ item.module || '-' }}</td>
            <td>
              <span v-if="item.error_count <= 3" class="error-dots">{{ '●'.repeat(item.error_count) }}</span>
              <span v-else class="error-number">{{ item.error_count }}</span>
            </td>
            <td>{{ formatTime(item.last_error_time) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getErrors, clearErrors } from '../api/errors'
import html2canvas from 'html2canvas'

const data = ref([])
const sortBy = ref('last_error_time')
const order = ref('desc')

async function fetchData() {
  const res = await getErrors({ sort: sortBy.value, order: order.value })
  data.value = res.data
}

function toggleSort(col) {
  if (sortBy.value === col) {
    order.value = order.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = col
    order.value = 'desc'
  }
  fetchData()
}

function sortIcon(col) {
  if (sortBy.value === col) return order.value === 'asc' ? '▲' : '▼'
  return ''
}

function formatTime(ts) {
  const d = new Date(ts)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function handleClear() {
  if (confirm('确认清空所有生词？')) {
    await clearErrors()
    await fetchData()
  }
}

async function exportPDF() {
  if (data.value.length === 0) return

  const container = document.createElement('div')
  container.style.cssText = 'position:absolute;left:-9999px;top:0;width:700px;font-family:"Nunito Sans",sans-serif;font-size:12px;color:#333;background:#fff;padding:16px'

  const today = new Date()
  const pad = n => String(n).padStart(2, '0')
  const dateStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

  let html = '<h2 style="margin-bottom:12px">生词本</h2>'
  html += '<table style="width:100%;border-collapse:collapse;font-size:11px">'
  html += '<thead><tr style="background:#9B7ED8;color:#fff">'
  html += '<th style="padding:8px;border:1px solid #ddd">#</th>'
  html += '<th style="padding:8px;border:1px solid #ddd">单词</th>'
  html += '<th style="padding:8px;border:1px solid #ddd">释义</th>'
  html += '<th style="padding:8px;border:1px solid #ddd">来源模块</th>'
  html += '<th style="padding:8px;border:1px solid #ddd">错误次数</th>'
  html += '<th style="padding:8px;border:1px solid #ddd">最后错误时间</th>'
  html += '</tr></thead><tbody>'

  data.value.forEach((item, i) => {
    const bg = i % 2 === 0 ? '#fff' : '#f5f2fc'
    html += `<tr style="background:${bg}">`
    html += '<td style="padding:6px 8px;border:1px solid #ddd">' + (i + 1) + '</td>'
    html += '<td style="padding:6px 8px;border:1px solid #ddd;font-weight:bold">' + item.word + '</td>'
    html += '<td style="padding:6px 8px;border:1px solid #ddd">' + item.definitions.join('；') + '</td>'
    html += '<td style="padding:6px 8px;border:1px solid #ddd">' + (item.module || '-') + '</td>'
    html += '<td style="padding:6px 8px;border:1px solid #ddd;text-align:center">' + item.error_count + '</td>'
    html += '<td style="padding:6px 8px;border:1px solid #ddd">' + formatTime(item.last_error_time) + '</td>'
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
    doc.save('生词本_' + dateStr + '.pdf')
  } finally {
    document.body.removeChild(container)
  }
}

onMounted(fetchData)
</script>
