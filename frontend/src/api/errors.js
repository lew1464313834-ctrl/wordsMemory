import request from './request'

export const getErrors = (params) => request.get('/errors', { params })
export const clearErrors = () => request.delete('/errors')
