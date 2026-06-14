import axios from 'axios'
import { useLoadingStore } from '@/stores/loading'

const request = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

let activeRequests = 0

function decrementRequests() {
  activeRequests--
  if (activeRequests <= 0) {
    activeRequests = 0
    const loading = useLoadingStore()
    loading.hide()
  }
}

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  activeRequests++
  const loading = useLoadingStore()
  loading.show('inline', { delay: 200 })
  return config
})

request.interceptors.response.use(
  (res) => {
    decrementRequests()
    // Treat API business errors (code !== 0) as rejected promises
    // so callers can catch them uniformly via e.response.data.msg
    if (res.data.code !== 0) {
      return Promise.reject({ response: { data: { msg: res.data.msg || '请求失败' } } })
    }
    return res.data
  },
  (err) => {
    decrementRequests()
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default request
