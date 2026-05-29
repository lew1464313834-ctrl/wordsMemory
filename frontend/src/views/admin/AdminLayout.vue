<template>
  <div>
    <header class="header"><h1 class="header__title">wordMemory 后台管理</h1></header>
    <nav class="tabs">
      <button class="tab" :class="{ 'tab--active': $route.path.startsWith('/admin/users') }" @click="$router.push('/admin/users')">用户管理</button>
      <button class="tab" :class="{ 'tab--active': $route.path.startsWith('/admin/modules') }" @click="$router.push('/admin/modules')">词库管理</button>
      <button class="tab" @click="logout">退出</button>
    </nav>
    <router-view />
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const auth = useAuthStore()

function logout() { auth.logout(); router.push('/login') }
</script>
