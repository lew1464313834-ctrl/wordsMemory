<template>
  <div class="card">
    <h2>用户数据查看</h2>
    <p style="color:var(--color-text-secondary);margin-bottom:16px">用户ID: {{ $route.params.id }}</p>

    <div v-if="data">
      <h3>已导入词库</h3>
      <div v-if="data.modules && data.modules.length > 0">
        <ul>
          <li v-for="m in data.modules" :key="m.id">
            {{ m.module?.name || m.module_id }}
            <span style="color:var(--color-text-muted);font-size:0.85rem">导入于 {{ m.imported_at }}</span>
          </li>
        </ul>
      </div>
      <p v-else style="color:var(--color-text-muted)">暂无导入词库</p>

      <h3 style="margin-top:20px">学习进度</h3>
      <p>已掌握单词: {{ data.learned_count }}</p>
      <p>总学习单词: {{ data.total_learned }}</p>

      <h3 style="margin-top:20px">生词本</h3>
      <p>当前生词数: {{ data.error_count }}</p>
    </div>

    <div v-else style="text-align:center;padding:40px;color:var(--color-text-muted)">加载中...</div>

    <button class="btn" style="margin-top:20px" @click="$router.back()">返回</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import request from '../../api/request'

const route = useRoute()
const data = ref(null)

onMounted(async () => {
  const res = await request.get(`/admin/users/${route.params.id}/data`)
  data.value = res.data
})
</script>
