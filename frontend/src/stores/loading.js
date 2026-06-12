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
