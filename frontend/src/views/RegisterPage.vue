<template>
  <div class="app">
    <header class="header"><h1 class="header__title">wordMemory</h1></header>
    <div class="card" style="max-width:400px;margin:40px auto">
      <h2>注册</h2>
      <form @submit.prevent="handleRegister">
        <input v-model="username" class="input" placeholder="用户名" style="margin-bottom:12px" required />
        <input v-model="email" type="email" class="input" placeholder="邮箱" style="margin-bottom:12px" required />
        <input v-model="password" type="password" class="input" placeholder="密码" style="margin-bottom:12px" required />
        <div v-if="error" class="feedback feedback--wrong">{{ error }}</div>
        <button type="submit" class="btn btn--primary" style="width:100%;margin-top:12px">注册</button>
      </form>
      <p style="text-align:center;margin-top:16px">已有账号？<router-link to="/login">登录</router-link></p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const username = ref('')
const email = ref('')
const password = ref('')
const error = ref('')

async function handleRegister() {
  error.value = ''
  try {
    await auth.register({ username: username.value, email: email.value, password: password.value })
    router.push('/memory')
  } catch (e) {
    error.value = e.response?.data?.msg || '注册失败'
  }
}
</script>
