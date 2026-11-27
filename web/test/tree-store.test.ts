import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useTreeStore } from '../src/stores/tree';
import type { PersonInput } from '../src/api/types';

const person = {
  id: 7,
  name: '新娃',
  sex: 'male',
  kinship: null,
  formerName: null,
  nickname: null,
  birthText: null,
  deathText: null,
  narrative: null,
  birthYear: null,
  deceased: false,
  age: null,
};

const input: PersonInput = {
  name: '新娃',
  sex: 'male',
  kinship: null,
  formerName: null,
  nickname: null,
  birthText: null,
  deathText: null,
  narrative: null,
  parents: [],
  marriages: [],
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('tree store', () => {
  it('loads tree data into state', async () => {
    setActivePinia(createPinia());
    const store = useTreeStore();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(200, { persons: [person], parents: [], marriages: [] })),
    );
    await store.loadTree();
    expect(store.persons).toEqual([person]);
  });

  it('keeps the save successful when the tree refresh fails', async () => {
    setActivePinia(createPinia());
    const store = useTreeStore();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_path: string, init?: RequestInit) => {
        if ((init?.method ?? 'GET').toUpperCase() === 'POST') return jsonResponse(201, person);
        return new Response('oops', { status: 500 });
      }),
    );
    const result = await store.savePerson(input);
    expect(result.detail.id).toBe(7);
    expect(result.refreshed).toBe(false);
    expect(store.detail?.id).toBe(7);
  });

  it('refreshes the tree after saving when the reload succeeds', async () => {
    setActivePinia(createPinia());
    const store = useTreeStore();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_path: string, init?: RequestInit) => {
        if ((init?.method ?? 'GET').toUpperCase() === 'POST') return jsonResponse(201, person);
        return jsonResponse(200, { persons: [person], parents: [], marriages: [] });
      }),
    );
    const result = await store.savePerson(input);
    expect(result.refreshed).toBe(true);
    expect(store.persons.some((item) => item.id === 7)).toBe(true);
  });

  it('propagates a failed save so the form can show the error', async () => {
    setActivePinia(createPinia());
    const store = useTreeStore();
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(400, { error: '不行', fields: { name: '必填' } })));
    await expect(store.savePerson(input)).rejects.toMatchObject({ status: 400, fields: { name: '必填' } });
    expect(store.detail).toBeNull();
  });
});
