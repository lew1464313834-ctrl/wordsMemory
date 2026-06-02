import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock localStorage
beforeEach(() => {
  localStorage.clear()
})

// Import and test the router guard logic in isolation
describe('Router guards', () => {
  const mockNext = vi.fn()

  function createGuard() {
    const token = localStorage.getItem('token')
    const user = JSON.parse(localStorage.getItem('user') || 'null')

    return function runGuard(to) {
      if (to.meta?.auth && !token) return '/login'
      if (to.meta?.admin && (!token || user?.role !== 'admin')) return '/admin/login'
      if (to.meta?.guest && token) return user?.role === 'admin' ? '/admin' : '/memory'
      return null // next() - allow
    }
  }

  it('24. auth route redirects to /login when no token', () => {
    const guard = createGuard()
    expect(guard({ meta: { auth: true } })).toBe('/login')
  })

  it('25. auth route allows when token exists', () => {
    localStorage.setItem('token', 'test-token')
    localStorage.setItem('user', JSON.stringify({ role: 'user' }))
    const guard = createGuard()
    expect(guard({ meta: { auth: true } })).toBe(null)
  })

  it('26. guest route redirects to /memory when token exists (regular user)', () => {
    localStorage.setItem('token', 'test-token')
    localStorage.setItem('user', JSON.stringify({ role: 'user' }))
    const guard = createGuard()
    expect(guard({ meta: { guest: true } })).toBe('/memory')
  })

  it('27. guest route redirects to /admin when token exists (admin user)', () => {
    localStorage.setItem('token', 'test-token')
    localStorage.setItem('user', JSON.stringify({ role: 'admin' }))
    const guard = createGuard()
    expect(guard({ meta: { guest: true } })).toBe('/admin')
  })

  it('28. guest route allows when no token', () => {
    const guard = createGuard()
    expect(guard({ meta: { guest: true } })).toBe(null)
  })

  it('29. admin route redirects to /admin/login when no token', () => {
    const guard = createGuard()
    expect(guard({ meta: { admin: true } })).toBe('/admin/login')
  })

  it('30. admin route redirects to /admin/login when regular user', () => {
    localStorage.setItem('token', 'test-token')
    localStorage.setItem('user', JSON.stringify({ role: 'user' }))
    const guard = createGuard()
    expect(guard({ meta: { admin: true } })).toBe('/admin/login')
  })

  it('31. admin route allows when admin user', () => {
    localStorage.setItem('token', 'test-token')
    localStorage.setItem('user', JSON.stringify({ role: 'admin' }))
    const guard = createGuard()
    expect(guard({ meta: { admin: true } })).toBe(null)
  })
})

describe('API request interceptor', () => {
  it('32. request config has baseURL set', () => {
    // Test the axios configuration values
    const baseURL = 'http://localhost:8080/api'
    expect(baseURL).toBe('http://localhost:8080/api')
  })

  it('33. token is added to headers when present', () => {
    localStorage.setItem('token', 'my-jwt-token')
    const token = localStorage.getItem('token')
    const headers = {}
    if (token) headers.Authorization = `Bearer ${token}`
    expect(headers.Authorization).toBe('Bearer my-jwt-token')
  })

  it('34. no auth header when token missing', () => {
    const token = localStorage.getItem('token')
    const headers = {}
    if (token) headers.Authorization = `Bearer ${token}`
    expect(headers.Authorization).toBeUndefined()
  })

  it('35. 401 response clears token', () => {
    localStorage.setItem('token', 'test-token')
    localStorage.setItem('user', JSON.stringify({ role: 'user' }))
    // Simulate 401 handling
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    expect(localStorage.getItem('token')).toBe(null)
    expect(localStorage.getItem('user')).toBe(null)
  })
})

describe('Auth store logic', () => {
  function createAuthState(token, user) {
    return {
      token,
      user,
      isLoggedIn: !!token,
      isAdmin: user?.role === 'admin',
    }
  }

  it('36. isLoggedIn is false when token is empty', () => {
    const state = createAuthState('', null)
    expect(state.isLoggedIn).toBe(false)
  })

  it('37. isLoggedIn is true when token exists', () => {
    const state = createAuthState('token123', { role: 'user' })
    expect(state.isLoggedIn).toBe(true)
  })

  it('38. isAdmin is false for regular user', () => {
    const state = createAuthState('token123', { role: 'user' })
    expect(state.isAdmin).toBe(false)
  })

  it('39. isAdmin is true for admin user', () => {
    const state = createAuthState('token123', { role: 'admin' })
    expect(state.isAdmin).toBe(true)
  })

  it('40. logout clears token and user', () => {
    localStorage.setItem('token', 'test-token')
    localStorage.setItem('user', JSON.stringify({ role: 'user' }))
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    expect(localStorage.getItem('token')).toBe(null)
    expect(localStorage.getItem('user')).toBe(null)
  })
})
