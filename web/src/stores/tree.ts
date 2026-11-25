import { defineStore } from 'pinia';
import { api } from '../api/client';
import type { Marriage, ParentLink, Person, PersonDetail, PersonInput, TreeData } from '../api/types';

const COLLAPSE_KEY = 'familytree.collapsed';

function readCollapsed(): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((item) => Number.isInteger(item)) : [];
  } catch {
    return [];
  }
}

export const useTreeStore = defineStore('tree', {
  state: () => ({
    persons: [] as Person[],
    parents: [] as ParentLink[],
    marriages: [] as Marriage[],
    detail: null as PersonDetail | null,
    collapsed: readCollapsed(),
  }),
  actions: {
    async loadTree() {
      const data = await api<TreeData>('/api/tree');
      this.persons = data.persons;
      this.parents = data.parents;
      this.marriages = data.marriages;
    },
    toggle(id: number) {
      this.collapsed = this.collapsed.includes(id)
        ? this.collapsed.filter((item) => item !== id)
        : [...this.collapsed, id];
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(this.collapsed));
    },
    async openPerson(id: number) {
      this.detail = await api<PersonDetail>(`/api/persons/${id}`);
    },
    async savePerson(input: PersonInput, id?: number) {
      const detail = await api<PersonDetail>(id ? `/api/persons/${id}` : '/api/persons', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(input),
      });
      this.detail = detail;
      await this.loadTree();
      return detail;
    },
    async removePerson(id: number) {
      await api(`/api/persons/${id}`, { method: 'DELETE' });
      this.detail = null;
      await this.loadTree();
    },
  },
});
