import request from './request'

export const getModules = () => request.get('/modules')
export const getUserModules = () => request.get('/user/modules')
export const importModule = (moduleId) => request.post('/user/modules', { module_id: moduleId })
