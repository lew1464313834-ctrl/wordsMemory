import { defineStore } from 'pinia'
import { getModules, getUserModules, importModule as apiImport } from '../api/modules'

export const useModuleStore = defineStore('modules', {
  state: () => ({
    allModules: [],
    userModules: [],
  }),
  actions: {
    async fetchAll() { const r = await getModules(); this.allModules = r.data },
    async fetchUser() { const r = await getUserModules(); this.userModules = r.data },
    async importModule(moduleId) { await apiImport(moduleId); await this.fetchUser() },
  },
})
