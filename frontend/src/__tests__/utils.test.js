import { describe, it, expect } from 'vitest'

// Replicate utility functions for unit testing
function norm(s) {
  return s.replace(/^[，。！？、,.!?\s]+/, '').replace(/[，。！？、,.!?\s]+$/, '').trim()
}

function charOverlap(a, b) {
  const setA = new Set([...a])
  const setB = new Set([...b])
  let common = 0
  for (const c of setA) { if (setB.has(c)) common++ }
  return common / setA.size
}

function checkAnswer(input, definitions) {
  const userNorm = norm(input)
  if (!userNorm) return false
  for (const def of definitions) {
    const defNorm = norm(def)
    if (userNorm === defNorm) return true
    if (userNorm.includes(defNorm) || defNorm.includes(userNorm)) return true
    if (charOverlap(userNorm, defNorm) >= 0.5) return true
  }
  return false
}

describe('norm()', () => {
  it('1. trims whitespace', () => { expect(norm('  hello  ')).toBe('hello') })
  it('2. removes leading punctuation', () => { expect(norm('，你好')).toBe('你好') })
  it('3. removes trailing punctuation', () => { expect(norm('你好。')).toBe('你好') })
  it('4. removes leading and trailing punctuation', () => { expect(norm('。测试，')).toBe('测试') })
  it('5. handles empty string', () => { expect(norm('')).toBe('') })
  it('6. handles only punctuation', () => { expect(norm('，。！？')).toBe('') })
  it('7. preserves inner punctuation', () => { expect(norm('a,b')).toBe('a,b') })
})

describe('charOverlap()', () => {
  it('8. returns 1 for identical strings', () => { expect(charOverlap('abc', 'abc')).toBe(1) })
  it('9. returns 0 for completely different strings', () => { expect(charOverlap('abc', 'xyz')).toBe(0) })
  it('10. returns 0.5 for half overlap', () => { expect(charOverlap('ab', 'bc')).toBe(0.5) })
  it('11. handles single character', () => { expect(charOverlap('a', 'a')).toBe(1) })
  it('12. handles Chinese characters', () => { expect(charOverlap('你好', '好的')).toBe(0.5) })
})

describe('checkAnswer()', () => {
  it('13. exact match returns true', () => {
    expect(checkAnswer('hello', ['hello', 'world'])).toBe(true)
  })
  it('14. no match returns false', () => {
    expect(checkAnswer('xyz', ['hello', 'world'])).toBe(false)
  })
  it('15. substring match returns true', () => {
    expect(checkAnswer('hello', ['hello world'])).toBe(true)
  })
  it('16. user input contains definition returns true', () => {
    expect(checkAnswer('hello world foo', ['hello world'])).toBe(true)
  })
  it('17. empty input returns false', () => {
    expect(checkAnswer('', ['hello'])).toBe(false)
  })
  it('18. whitespace-only input returns false', () => {
    expect(checkAnswer('   ', ['hello'])).toBe(false)
  })
  it('19. character overlap >= 50% returns true (Chinese)', () => {
    expect(checkAnswer('放弃', ['抛弃'])).toBe(true)
  })
  it('20. ignores leading/trailing punctuation in input', () => {
    expect(checkAnswer('，hello。', ['hello'])).toBe(true)
  })
  it('21. ignores punctuation around definition', () => {
    expect(checkAnswer('hello', ['。hello，'])).toBe(true)
  })
  it('22. handles multiple definitions, matches second', () => {
    expect(checkAnswer('world', ['hello', 'world'])).toBe(true)
  })
  it('23. handles multiple definitions, no match', () => {
    expect(checkAnswer('xyz', ['hello', 'world'])).toBe(false)
  })
})
