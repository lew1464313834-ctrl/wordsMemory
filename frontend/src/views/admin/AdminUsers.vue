<template>
  <div class="card">
    <h2>用户管理</h2>
    <div style="margin:14px 0;display:flex;gap:10px">
      <input v-model="keyword" class="input" placeholder="搜索用户名或邮箱..." style="flex:1" @keydown.enter="search" />
      <button class="btn btn--primary" @click="search">搜索</button>
    </div>

    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>用户名</th>
            <th>邮箱</th>
            <th>角色</th>
            <th>状态</th>
            <th>注册时间</th>
            <th>最后登录</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>{{ user.id }}</td>
            <td>
              <a href="javascript:void(0)" @click="$router.push(`/admin/users/${user.id}/data`)" style="color:var(--color-primary)">{{ user.username }}</a>
            </td>
            <td>{{ user.email }}</td>
            <td>{{ user.role === 'admin' ? '管理员' : '用户' }}</td>
            <td>
              <span :style="{ color: user.status === 1 ? 'var(--color-success)' : 'var(--color-danger)' }">
                {{ user.status === 1 ? '正常' : '禁用' }}
              </span>
            </td>
            <td>{{ user.created_at }}</td>
            <td>{{ user.last_login_at ? user.last_login_at.substring(0, 16) : '从未登录' }}</td>
            <td>
              <div class="btn-group">
                <button v-if="user.id !== 1" class="btn" @click="toggleStatus(user)">
                  {{ user.status === 1 ? '禁用' : '启用' }}
                </button>
                <button v-if="user.id !== 1" class="btn btn--danger" @click="del(user)">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div style="margin-top:12px;text-align:center;color:var(--color-text-secondary)">
      {{ page }} / {{ Math.ceil(total / 20) || 1 }}
      <button class="btn" style="margin-left:8px" :disabled="page <= 1" @click="page--; fetchData()">上一页</button>
      <button class="btn" :disabled="page >= Math.ceil(total / 20)" @click="page++; fetchData()">下一页</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import request from '../../api/request'

const users = ref([])
const page = ref(1)
const total = ref(0)
const keyword = ref('')

async function fetchData() {
  const res = await request.get('/admin/users', { params: { page: page.value, keyword: keyword.value } })
  users.value = res.data.list
  total.value = res.data.total
}

function search() { page.value = 1; fetchData() }

async function toggleStatus(user) {
  const newStatus = user.status === 1 ? 0 : 1
  await request.put(`/admin/users/${user.id}`, { status: newStatus })
  fetchData()
}

async function del(user) {
  if (confirm(`确认删除用户 "${user.username}"？此操作不可恢复。`)) {
    await request.delete(`/admin/users/${user.id}`)
    fetchData()
  }
}

onMounted(fetchData)
</script>
