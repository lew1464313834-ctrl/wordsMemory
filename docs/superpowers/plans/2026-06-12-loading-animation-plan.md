# Loading Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a unified loading animation (semi-transparent overlay + rotating "WORDS" character ring) displayed during initial page load, route transitions (fullscreen), and API data requests (inline, 200ms delay).

**Architecture:** A single Pinia store (`loading.js`) manages visibility state and mode. A standalone Vue component (`AppLoading.vue`) renders the overlay and ring, reading from the store. Three triggers feed the store: router guards for navigation loading, and Axios interceptors for API request loading with concurrent request counting.

**Tech Stack:** Vue 3 (Composition API, `<script setup>`), Pinia, Vue Router, Axios, Vite

---

## File Structure

```
Create:
  frontend/src/stores/loading.js       — Pinia store: mode, visibility, delay timer
  frontend/src/components/AppLoading.vue  — Visual component: overlay + rotating ring

Modify:
  frontend/src/main.js              — No changes (Pinia already installed)
  frontend/src/App.vue              — Import <AppLoading /> into template
  frontend/src/router/index.js      — Add beforeEach/afterEach loading triggers
  frontend/src/api/request.js       — Add req/res interceptor with request counter
  frontend/src/assets/main.css      — Add loading overlay, ring, and transition styles
```

---

### Task 1: Create the Loading Store

**Files:**
- Create: `frontend/src/stores/loading.js`

- [ ] **Step 1: Write the loading store**

```js
import { defineStore } from 'pinia'

export const useLoadingStore = defineStore('loading', {
  state: () => ({
    mode: null,       // 'fullscreen' | 'inline' | null
    _visible: false,  // internal visibility flag
    delayTimer: null, // setTimeout id for delayed show
  }),

  getters: {
    isShowing: (state) => state._visible,
  },

  actions: {
    show(mode, { delay = 0 } = {}) {
      this.mode = mode
      if (delay > 0) {
        this.delayTimer = setTimeout(() => {
          this._visible = true
        }, delay)
      } else {
        this._visible = true
      }
    },

    hide() {
      if (this.delayTimer) {
        clearTimeout(this.delayTimer)
        this.delayTimer = null
      }
      this._visible = false
      this.mode = null
    },
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/stores/loading.js
git commit -m "feat: add loading store with fullscreen/inline modes and delayed display
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Add Loading CSS Styles

**Files:**
- Modify: `frontend/src/assets/main.css` (append at end of file)

- [ ] **Step 1: Append loading styles to main.css**

Append the following to `frontend/src/assets/main.css`:

```css
/* === Loading Overlay === */
.loading-overlay {
  position: fixed; inset: 0;
  z-index: 9999;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
}
.loading-overlay.fullscreen {
  background: rgba(243, 239, 255, 0.65);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.loading-overlay.inline {
  position: fixed; inset: auto;
  right: 24px; bottom: 24px;
  z-index: 9998;
  pointer-events: none;
}

/* === Rotating Ring === */
.loading-ring {
  position: relative;
  width: 160px; height: 160px;
  animation: rotate-ring 2.5s linear infinite;
}
.loading-overlay.inline .loading-ring {
  width: 80px; height: 80px;
}
@keyframes rotate-ring {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.loading-ring .char {
  position: absolute; top: 50%; left: 50%;
  font-family: 'Varela Round', sans-serif;
  font-weight: 600;
  color: var(--color-primary);
}
.loading-overlay.fullscreen .loading-ring .char {
  font-size: 22px;
}
.loading-overlay.inline .loading-ring .char {
  font-size: 14px;
}

/* === Loading Label === */
.loading-label {
  margin-top: 12px;
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  letter-spacing: 0.05em;
}

/* === Transition === */
.loading-fade-enter-active,
.loading-fade-leave-active { transition: opacity 0.3s ease; }
.loading-fade-enter-from,
.loading-fade-leave-to { opacity: 0; }
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/assets/main.css
git commit -m "feat: add loading overlay, rotating ring, and fade transition styles
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Create the AppLoading Component

**Files:**
- Create: `frontend/src/components/AppLoading.vue`

- [ ] **Step 1: Write the AppLoading component**

```vue
<template>
  <Transition name="loading-fade">
    <div v-if="store.isShowing" class="loading-overlay" :class="store.mode">
      <div class="loading-ring" ref="ringEl" />
      <p class="loading-label" v-if="store.mode === 'fullscreen'">正在加载...</p>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useLoadingStore } from '../stores/loading'

const store = useLoadingStore()
const ringEl = ref(null)
const chars = ['W', 'O', 'R', 'D', 'S']
let rafId = null
let ringAngle = 0

onMounted(() => {
  buildRing()
  startRotation()
})

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
})

function buildRing() {
  if (!ringEl.value) return
  ringEl.value.innerHTML = ''
  const radius = 75
  chars.forEach((ch, i) => {
    const span = document.createElement('span')
    span.className = 'char'
    span.textContent = ch
    const angle = (i / chars.length) * 2 * Math.PI - Math.PI / 2
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    span.style.transform = `translate(${x}px, ${y}px)`
    ringEl.value.appendChild(span)
  })
}

function startRotation() {
  function rotate() {
    ringAngle += 0.8
    if (ringEl.value) {
      ringEl.value.style.transform = `rotate(${ringAngle}deg)`
    }
    rafId = requestAnimationFrame(rotate)
  }
  rotate()
}
</script>
```

- [ ] **Step 2: Verify the component file exists**

```bash
ls -la frontend/src/components/AppLoading.vue
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AppLoading.vue
git commit -m "feat: add AppLoading component with rotating WORDS ring
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Integrate Loading into App.vue

**Files:**
- Modify: `frontend/src/App.vue`

- [ ] **Step 1: Update App.vue to include AppLoading**

Replace the entire content of `frontend/src/App.vue`:

```vue
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
    <router-view />
    <AppLoading />
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/App.vue
git commit -m "feat: integrate AppLoading component into App.vue
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Add Router-Based Loading Triggers

**Files:**
- Modify: `frontend/src/router/index.js`

- [ ] **Step 1: Update router to trigger loading store**

Replace the entire content of `frontend/src/router/index.js`:

```js
import { createRouter, createWebHistory } from 'vue-router'
import { useLoadingStore } from '@/stores/loading'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginPage.vue'),
    meta: { guest: true }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/RegisterPage.vue'),
    meta: { guest: true }
  },
  { path: '/', redirect: '/memory' },
  {
    path: '/memory',
    name: 'Memory',
    component: () => import('../views/MemoryPage.vue'),
    meta: { auth: true }
  },
  {
    path: '/quiz',
    name: 'Quiz',
    component: () => import('../views/QuizPage.vue'),
    meta: { auth: true }
  },
  {
    path: '/errorbook',
    name: 'ErrorBook',
    component: () => import('../views/ErrorBookPage.vue'),
    meta: { auth: true }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/SettingsPage.vue'),
    meta: { auth: true }
  },
  {
    path: '/admin/login',
    name: 'AdminLogin',
    component: () => import('../views/admin/AdminLoginPage.vue'),
    meta: { guest: true }
  },
  {
    path: '/admin',
    component: () => import('../views/admin/AdminLayout.vue'),
    meta: { admin: true },
    children: [
      { path: '', redirect: '/admin/users' },
      {
        path: 'users',
        name: 'AdminUsers',
        component: () => import('../views/admin/AdminUsers.vue')
      },
      {
        path: 'modules',
        name: 'AdminModules',
        component: () => import('../views/admin/AdminModules.vue')
      },
      {
        path: 'users/:id/data',
        name: 'AdminUserData',
        component: () => import('../views/admin/AdminUserData.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const loading = useLoadingStore()
  loading.show('fullscreen')

  const token = localStorage.getItem('token')
  const user = JSON.parse(localStorage.getItem('user') || 'null')

  if (to.meta.auth && !token) return next('/login')
  if (to.meta.admin && (!token || user?.role !== 'admin')) return next('/admin/login')
  if (to.meta.guest && token) return next(user?.role === 'admin' ? '/admin' : '/memory')

  next()
})

router.afterEach(() => {
  const loading = useLoadingStore()
  loading.hide()
})

export default router
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/router/index.js
git commit -m "feat: trigger fullscreen loading on route transitions
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Add API Request-Based Loading Triggers

**Files:**
- Modify: `frontend/src/api/request.js`

- [ ] **Step 1: Add concurrent request counter and loading interceptors**

Replace the entire content of `frontend/src/api/request.js`:

```js
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/request.js
git commit -m "feat: trigger inline loading on API requests with 200ms delay
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Write Store Tests

**Files:**
- Create: `frontend/src/__tests__/loading.test.js`

- [ ] **Step 1: Write the loading store unit tests**

```js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLoadingStore } from '../stores/loading'

describe('Loading store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  it('1. initial state: not visible, mode is null', () => {
    const store = useLoadingStore()
    expect(store.isShowing).toBe(false)
    expect(store.mode).toBeNull()
  })

  it('2. show("fullscreen") sets mode and visible immediately', () => {
    const store = useLoadingStore()
    store.show('fullscreen')
    expect(store.mode).toBe('fullscreen')
    expect(store.isShowing).toBe(true)
  })

  it('3. show("inline", { delay: 200 }) sets mode but not visible until delay', () => {
    const store = useLoadingStore()
    store.show('inline', { delay: 200 })
    expect(store.mode).toBe('inline')
    expect(store.isShowing).toBe(false)
  })

  it('4. show("inline", { delay: 200 }) becomes visible after delay', () => {
    const store = useLoadingStore()
    store.show('inline', { delay: 200 })
    vi.advanceTimersByTime(200)
    expect(store.isShowing).toBe(true)
  })

  it('5. hide() resets visible and mode', () => {
    const store = useLoadingStore()
    store.show('fullscreen')
    store.hide()
    expect(store.isShowing).toBe(false)
    expect(store.mode).toBeNull()
  })

  it('6. hide() cancels pending delay timer', () => {
    const store = useLoadingStore()
    store.show('inline', { delay: 200 })
    store.hide()
    vi.advanceTimersByTime(200)
    // Should still not be visible because hide() cleared the timer
    expect(store.isShowing).toBe(false)
  })

  it('7. show() without options defaults to immediate show', () => {
    const store = useLoadingStore()
    store.show('fullscreen')
    expect(store.isShowing).toBe(true)
  })

  it('8. hide() is idempotent — calling it twice does not throw', () => {
    const store = useLoadingStore()
    store.show('fullscreen')
    store.hide()
    expect(() => store.hide()).not.toThrow()
    expect(store.isShowing).toBe(false)
  })
})
```

- [ ] **Step 2: Install vitest and run the tests**

```bash
cd frontend && npm install --save-dev vitest && npx vitest run src/__tests__/loading.test.js
```

Expected: 8 tests pass.

- [ ] **Step 3: Run all existing tests to ensure no regressions**

```bash
cd frontend && npx vitest run
```

Expected: All test suites pass (8 new + existing tests).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/__tests__/loading.test.js frontend/package.json frontend/package-lock.json
git commit -m "test: add loading store unit tests (8 cases)
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Manual Verification

**Files:** None (verification only)

- [ ] **Step 1: Start the dev server**

```bash
cd frontend && npm run dev
```

Open browser to `http://localhost:9999`.

- [ ] **Step 2: Verify fullscreen loading on initial page load**

Expected: Fullscreen overlay with rotating "WORDS" ring + "正在加载..." text appears briefly on first load, then fades away.

- [ ] **Step 3: Verify fullscreen loading on route transition**

Click between navigation tabs (单词记忆 → 单词抽查 → 生词本 → 设置).

Expected: Fullscreen loading overlay appears during each route transition, then fades away when the new page renders.

- [ ] **Step 4: Verify inline loading on API requests**

Navigate to a page that makes API calls (e.g., Memory page). Watch the bottom-right corner.

Expected:
- No inline ring for requests that complete in <200ms
- Small rotating ring appears in bottom-right for requests taking >200ms
- Ring disappears when the request completes

- [ ] **Step 5: Verify fullscreen overlay blocks interaction**

During a route transition (while loading is visible), try clicking navigation tabs.

Expected: Clicks are blocked by the overlay.

- [ ] **Step 6: Verify inline mode does NOT block interaction**

During an API request showing the inline ring, click navigation tabs or interact with the page.

Expected: Page interaction works normally while the inline ring is visible.
