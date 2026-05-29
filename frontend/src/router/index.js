import { createRouter, createWebHistory } from 'vue-router'

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
  const token = localStorage.getItem('token')
  const user = JSON.parse(localStorage.getItem('user') || 'null')

  if (to.meta.auth && !token) return next('/login')
  if (to.meta.admin && (!token || user?.role !== 'admin')) return next('/login')
  if (to.meta.guest && token) return next('/memory')

  next()
})

export default router
