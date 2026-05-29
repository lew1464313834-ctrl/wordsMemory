import { defineStore } from 'pinia'
import { login as apiLogin, register as apiRegister, changePassword as apiChangePwd, adminLogin as apiAdminLogin } from '../api/auth'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    token: localStorage.getItem('token') || '',
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
    isAdmin: (state) => state.user?.role === 'admin',
  },
  actions: {
    async login(data) {
      const res = await apiLogin(data)
      this.token = res.data.token
      this.user = res.data.user
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      return res
    },
    async register(data) {
      const res = await apiRegister(data)
      this.token = res.data.token
      this.user = res.data.user
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      return res
    },
    async adminLogin(data) {
      const res = await apiAdminLogin(data)
      this.token = res.data.token
      this.user = res.data.user
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      return res
    },
    async changePassword(data) {
      await apiChangePwd(data)
    },
    logout() {
      this.token = ''
      this.user = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    },
  },
})
