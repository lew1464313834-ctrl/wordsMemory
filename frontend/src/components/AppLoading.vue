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
