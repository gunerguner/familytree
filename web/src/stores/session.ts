import { defineStore } from 'pinia';
import { api } from '../api/client';

export const useSessionStore = defineStore('session', {
  state: () => ({
    status: 'unknown' as 'unknown' | 'guest' | 'user',
    username: '',
  }),
  actions: {
    async bootstrap() {
      try {
        const data = await api<{ username: string }>('/api/session');
        this.status = 'user';
        this.username = data.username;
      } catch {
        this.status = 'guest';
        this.username = '';
      }
    },
    async login(username: string, password: string) {
      await api('/api/session', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      this.status = 'user';
      this.username = username;
    },
    async logout() {
      await api('/api/session', { method: 'DELETE' });
      this.status = 'guest';
      this.username = '';
    },
    clear() {
      this.status = 'guest';
      this.username = '';
    },
  },
});
