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
