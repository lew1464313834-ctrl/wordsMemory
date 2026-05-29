import request from './request'

export const getWords = (params) => request.get('/words', { params })
export const markLearned = (wordId, status) => request.post(`/words/${wordId}/learned`, { status })
