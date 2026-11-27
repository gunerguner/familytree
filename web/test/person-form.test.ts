// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PersonForm from '../src/components/person-form.vue';
import type { PersonDraft } from '../src/api/types';

vi.mock('naive-ui', () => ({
  NButton: { inheritAttrs: false, template: '<button><slot /></button>' },
  NForm: { inheritAttrs: false, template: '<form><slot /></form>' },
  NFormItem: { inheritAttrs: false, template: '<div><slot /></div>' },
  NInput: { inheritAttrs: false, template: '<input />' },
  NInputNumber: { inheritAttrs: false, template: '<input />' },
  NSelect: { inheritAttrs: false, template: '<select />' },
  useMessage: () => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn() }),
}));

const savedDetail = { id: 9, name: '测试娃', sex: 'male' as const };

beforeEach(() => {
  setActivePinia(createPinia());
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function submit(wrapper: ReturnType<typeof mount>) {
  await (wrapper.vm as unknown as { submit: () => Promise<void> }).submit();
  await flushPromises();
}

describe('person form', () => {
  it('blocks submission without a name', async () => {
    const savePerson = vi.fn();
    const wrapper = mount(PersonForm, { props: { detail: null } });
    const tree = (await import('../src/stores/tree')).useTreeStore();
    tree.savePerson = savePerson;
    await submit(wrapper);
    expect(savePerson).not.toHaveBeenCalled();
  });

  it('creates a person and emits saved', async () => {
    const savePerson = vi.fn().mockResolvedValue({ detail: savedDetail, refreshed: true });
    const wrapper = mount(PersonForm, { props: { detail: null } });
    const tree = (await import('../src/stores/tree')).useTreeStore();
    tree.savePerson = savePerson;
    const inner = (wrapper.vm.$ as unknown as { setupState: Record<string, unknown> }).setupState;
    (inner.form as { name: string; sex: string }).name = '测试娃';
    (inner.form as { name: string; sex: string }).sex = 'male';
    await submit(wrapper);
    expect(savePerson).toHaveBeenCalledOnce();
    const [input, id] = savePerson.mock.calls[0] as [Record<string, unknown>, number | undefined];
    expect(input.name).toBe('测试娃');
    expect(input.sex).toBe('male');
    expect(id).toBeUndefined();
    expect(wrapper.emitted('saved')?.[0]).toEqual([9]);
  });

  it('prefills a draft parent relation and creates without an id', async () => {
    const savePerson = vi.fn().mockResolvedValue({ detail: savedDetail, refreshed: true });
    const wrapper = mount(PersonForm, { props: { detail: null } });
    const tree = (await import('../src/stores/tree')).useTreeStore();
    tree.savePerson = savePerson;
    const draft: PersonDraft = {
      name: '',
      parents: [{ id: 5, name: '父亲', role: 'father', sortOrder: 0 }],
      marriages: [],
    };
    await wrapper.setProps({ detail: draft });
    const inner = (wrapper.vm.$ as unknown as { setupState: Record<string, unknown> }).setupState;
    (inner.form as { name: string; sex: string }).name = '测试娃';
    (inner.form as { name: string; sex: string }).sex = 'female';
    await submit(wrapper);
    expect(savePerson).toHaveBeenCalledOnce();
    const [input, id] = savePerson.mock.calls[0] as [Record<string, unknown>, number | undefined];
    expect(id).toBeUndefined();
    expect(input.parents).toEqual([{ personId: 5, role: 'father', sortOrder: 0 }]);
    expect(input.marriages).toEqual([]);
  });
});
