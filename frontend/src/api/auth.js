import request from './request'

export const login = (data) => request.post('/login', data)
export const register = (data) => request.post('/register', data)
export const changePassword = (data) => request.post('/change-password', data)
export const adminLogin = (data) => request.post('/admin/login', data)
