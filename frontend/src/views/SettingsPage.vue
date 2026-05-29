<template>
  <div class="card" style="max-width:400px;margin:20px auto">
    <h2>修改密码</h2>
    <form @submit.prevent="handleChange">
      <input v-model="oldPass" type="password" class="input" placeholder="原密码" style="margin-bottom:12px" required />
      <input v-model="newPass" type="password" class="input" placeholder="新密码" style="margin-bottom:12px" required />
      <div v-if="msg" class="feedback" :class="msgType === 'ok' ? 'feedback--correct' : 'feedback--wrong'">{{ msg }}</div>
      <button type="submit" class="btn btn--primary" style="width:100%;margin-top:12px">修改</button>
    </form>
    <button class="btn btn--danger" style="width:100%;margin-top:24px" @click="logout">退出登录</button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()
const oldPass = ref('')
const newPass = ref('')
const msg = ref('')
const msgType = ref('')

async function handleChange() {
  try {
    await auth.changePassword({ old_password: oldPass.value, new_password: newPass.value })
    msg.value = '密码修改成功'
    msgType.value = 'ok'
  } catch (e) { msg.value = e.response?.data?.msg || '修改失败'; msgType.value = 'err' }
}

function logout() { auth.logout(); router.push('/login') }
</script>
