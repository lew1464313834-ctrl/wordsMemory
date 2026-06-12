# Design Spec: Unified Page Loading Animation

Date: 2026-06-12 | Status: Approved

## Overview

Add a unified loading animation to the WordMemory SPA. The animation consists of a semi-transparent overlay with a rotating "WORDS" character ring, displayed during initial page load, route transitions, and API data requests.

## Behavior

### Trigger Scenarios

| Scenario | Mode | Delay | Blocks interaction? |
|---|---|---|---|
| Initial page load | `fullscreen` | None (immediate) | Yes |
| Route transition | `fullscreen` | None (immediate) | Yes |
| API data request | `inline` | 200ms | No |

### Mode Details

**Fullscreen mode:**
- Semi-transparent overlay covers entire viewport
- Centered rotating "WORDS" ring + "正在加载..." text
- Blocks all user interaction (pointer-events captured by overlay)
- Used for: initial load, route transitions

**Inline mode:**
- Small rotating ring fixed to bottom-right corner (margin: 24px)
- No overlay, no interaction blocking
- Only shown if API request takes > 200ms
- Used for: API data requests during normal browsing

### State Flow

```
trigger → store.show(mode) → [delay timer if applicable] → set visible=true
                                                               ↓
                                                        <Transition> fades in
                                                               ↓
load completes → store.hide() → set visible=false → <Transition> fades out
```

Disabling all loading before hide() finishes is a no-op — hide() resets state regardless of pending triggers.

## Architecture

```
loadingStore (Pinia)
├── mode: 'fullscreen' | 'inline' | null
├── _visible: boolean
├── delayTimer: number | null
├── show(mode, opts?) → sets mode, optionally delays visibility
├── hide()           → clears timer, sets visible=false
└── isShowing        → computed getter (visible, for template use)

Triggers:
├── router.beforeEach  → store.show('fullscreen')
├── router.afterEach   → store.hide()
├── request.js (req interceptor) → store.show('inline', {delay: 200})
└── request.js (res/err interceptor) → store.hide()
```

## Files

### New Files

| File | Purpose |
|---|---|
| `frontend/src/stores/loading.js` | Pinia store managing loading state and mode logic |
| `frontend/src/components/AppLoading.vue` | Vue component rendering overlay + rotating ring |

### Modified Files

| File | Changes |
|---|---|
| `frontend/src/App.vue` | Import and render `<AppLoading />` + import loading store |
| `frontend/src/router/index.js` | Add `beforeEach`/`afterEach` guards to trigger loading |
| `frontend/src/api/request.js` | Add req/res interceptor handlers for inline loading |
| `frontend/src/assets/main.css` | Add `@keyframes rotate-ring`, overlay, ring component styles |

## Component: AppLoading.vue

```
Props: none (reads from loadingStore directly)
Template structure:
  <Transition name="loading-fade">
    <div v-if="store.isShowing" class="loading-overlay" :class="store.mode">
      <div class="loading-ring">
        <span v-for="(ch, i) in chars" :key="i"
              :style="charStyle(i)">W O R D S 拆分为 chars</span>
        <!-- 5 spans positioned on a circle via JS computed style -->
      </div>
      <p class="loading-label" v-if="store.mode === 'fullscreen'">正在加载...</p>
    </div>
  </Transition>
```

## Styles (main.css)

### Overlay

```css
.loading-overlay {
  position: fixed; inset: 0;
  z-index: 9999;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  transition: opacity 0.3s ease;
}
.loading-overlay.fullscreen {
  background: rgba(243, 239, 255, 0.65); /* --color-bg-start */
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.loading-overlay.inline {
  position: fixed; inset: auto;
  right: 24px; bottom: 24px;
  z-index: 9998;
  pointer-events: none;
}
```

### Ring Animation

```css
.loading-ring {
  position: relative;
  width: 160px; height: 160px; /* fullscreen */
  animation: rotate-ring 2.5s linear infinite;
}
.loading-overlay.inline .loading-ring {
  width: 80px; height: 80px; /* smaller for inline */
}
@keyframes rotate-ring {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.loading-ring .char {
  position: absolute; top: 50%; left: 50%;
  font-family: 'Varela Round', sans-serif;
  font-weight: 600;
  color: #9B7ED8; /* --color-primary */
}
/* fullscreen: 22px, inline: 14px */
```

### Transition

```css
.loading-fade-enter-active,
.loading-fade-leave-active { transition: opacity 0.3s ease; }
.loading-fade-enter-from,
.loading-fade-leave-to { opacity: 0; }
```

## Store: loading.js

```js
// Key logic:
show(mode, { delay = 0 } = {}) {
  this.mode = mode
  if (delay > 0) {
    this.delayTimer = setTimeout(() => { this._visible = true }, delay)
  } else {
    this._visible = true
  }
}
hide() {
  clearTimeout(this.delayTimer)
  this.delayTimer = null
  this._visible = false
  this.mode = null
}
isShowing: (state) => state._visible
```

## Router Changes

```js
// router/index.js — add after createRouter:
import { useLoadingStore } from '@/stores/loading'

router.beforeEach((to, from, next) => {
  const loading = useLoadingStore()
  loading.show('fullscreen')
  // ... existing auth guards ...
  next()
})

router.afterEach(() => {
  const loading = useLoadingStore()
  loading.hide()
})
```

Note: `afterEach` is called after the route component is resolved (lazy import complete), so the loading animation hides once the new page is ready to render.

## API Interceptor Changes

```js
// request.js — req interceptor:
let activeRequests = 0
instance.interceptors.request.use(config => {
  activeRequests++
  const loading = useLoadingStore()
  loading.show('inline', { delay: 200 })
  return config
})

// res/err interceptor:
function decrementRequests() {
  activeRequests--
  if (activeRequests <= 0) {
    activeRequests = 0
    const loading = useLoadingStore()
    loading.hide()
  }
}
instance.interceptors.response.use(
  res => { decrementRequests(); /* existing logic */ return res },
  err => { decrementRequests(); /* existing logic */ return Promise.reject(err) }
)
```

A counter tracks concurrent requests — loading hides only when all outstanding requests complete, preventing flicker from overlapping API calls.

## Design Constraints

- Must use existing CSS custom properties (`--color-primary`, `--color-bg-start`, `--color-text-secondary`)
- Must use `'Varela Round'` font (already loaded) for ring characters
- Ring text: 5 letters **W-O-R-D-S**, distributed evenly on a circle
- Fullscreen overlay must respect glassmorphism aesthetic (blur + semi-transparent)
- Component must be a single file: `AppLoading.vue`

## Testing

- Verify loading overlay appears on initial load
- Verify overlay appears on route transitions (click between Memory/Quiz/ErrorBook/Settings)
- Verify inline ring appears in bottom-right for slow API calls (>200ms)
- Verify no inline ring appears for fast API calls (<200ms)
- Verify loading hides after route transition completes
- Verify loading hides after all concurrent API requests finish
- Verify overlay blocks interaction in fullscreen mode
- Verify inline mode does not block interaction
