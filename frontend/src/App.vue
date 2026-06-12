<template>
  <div id="app">
    <nav class="tabs" v-if="isLoggedIn && !isAdminRoute">
      <button
        class="tab"
        :class="{ 'tab--active': $route.path === '/memory' }"
        @click="$router.push('/memory')"
      >单词记忆</button>
      <button
        class="tab"
        :class="{ 'tab--active': $route.path === '/quiz' }"
        @click="$router.push('/quiz')"
      >单词抽查</button>
      <button
        class="tab"
        :class="{ 'tab--active': $route.path === '/errorbook' }"
        @click="$router.push('/errorbook')"
      >生词本</button>
      <button class="tab" @click="$router.push('/settings')">设置</button>
    </nav>
    <AppLoading />
    <router-view />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from './stores/auth'
import AppLoading from './components/AppLoading.vue'

const route = useRoute()
const auth = useAuthStore()
const isLoggedIn = computed(() => auth.isLoggedIn)
const isAdminRoute = computed(() => route.path.startsWith('/admin'))
</script>
