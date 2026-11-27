<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NModal, useMessage } from 'naive-ui';
import PersonForm from './person-form.vue';
import KinList from './kin-list.vue';
import { ApiError } from '../api/client';
import { PERSON_FIELDS } from '../lib/person-fields';
import {
  ROLE_LABELS,
  SEX_LABELS,
  type ParentRole,
  type PersonDetail,
  type PersonDraft,
  type PersonInput,
} from '../api/types';
import { useTreeStore } from '../stores/tree';

const props = defineProps<{
  detail: PersonDetail | null;
  creating: boolean;
  editing: boolean;
}>();

const emit = defineEmits<{ edit: []; close: []; cancelEdit: []; saved: [id: number] }>();
const tree = useTreeStore();
const router = useRouter();
const message = useMessage();
const confirmDelete = ref(false);
const removing = ref(false);
const formRef = ref<InstanceType<typeof PersonForm> | null>(null);
const saving = ref(false);

type DraftKind = 'child' | 'spouse' | 'parent';
const DRAFT_TITLES: Record<DraftKind, string> = { child: '添加子女', spouse: '添加配偶', parent: '添加父母' };
const draft = ref<DraftKind | null>(null);

// 在面板里直接添加亲属：预填与当前人物的关系，保存走 POST /api/persons；「添加父母」在保存后再补挂关系
const draftDetail = computed<PersonDraft | null>(() => {
  const self = props.detail;
  if (!draft.value || !self) return null;
  if (draft.value === 'child') {
    return {
      name: '',
      parents: [{ id: self.id, name: self.name, role: self.sex === 'female' ? 'mother' : 'father', sortOrder: 0 }],
      marriages: [],
    };
  }
  if (draft.value === 'spouse') {
    return { name: '', marriages: [{ personId: self.id, name: self.name, label: null, sortOrder: 0 }] };
  }
  return { name: '' };
});

const fields = PERSON_FIELDS.map(({ key, label }) => [label, key] as const);

function text(key: (typeof fields)[number][1]) {
  return props.detail?.[key] ?? '';
}
const visibleFields = computed(() =>
  fields.filter(([, key]) => text(key) !== ''),
);

function personOf(id: number) {
  return tree.persons.find((person) => person.id === id) ?? null;
}

function sexOf(id: number) {
  return personOf(id)?.sex ?? null;
}

function isDeceased(id: number) {
  return personOf(id)?.deceased ?? false;
}

function childLabel(person: { id: number; role: ParentRole }) {
  const female = sexOf(person.id) === 'female';
  if (person.role.startsWith('step')) return female ? '继女' : '继子';
  if (person.role.startsWith('adoptive')) return female ? '养女' : '养子';
  return female ? '女儿' : '儿子';
}

function spouseLabel(id: number) {
  const sex = sexOf(id);
  return sex === 'female' ? '妻子' : sex === 'male' ? '丈夫' : '配偶';
}

const parentItems = computed(() =>
  (props.detail?.parents ?? []).map((person) => ({
    key: `${person.id}:${person.role}`,
    id: person.id,
    name: person.name,
    sex: sexOf(person.id),
    deceased: isDeceased(person.id),
    label: ROLE_LABELS[person.role],
  })),
);
const spouseItems = computed(() =>
  (props.detail?.marriages ?? []).map((person) => ({
    key: String(person.personId),
    id: person.personId,
    name: person.name,
    sex: sexOf(person.personId),
    deceased: isDeceased(person.personId),
    label: spouseLabel(person.personId),
  })),
);
const childItems = computed(() =>
  (props.detail?.children ?? []).map((person) => ({
    key: `${person.id}:${person.role}`,
    id: person.id,
    name: person.name,
    sex: sexOf(person.id),
    deceased: isDeceased(person.id),
    label: childLabel(person),
  })),
);

async function remove() {
  if (!props.detail) return;
  removing.value = true;
  try {
    await tree.removePerson(props.detail.id);
    confirmDelete.value = false;
    message.success('已删除');
    await router.replace({ path: '/' });
    emit('close');
  } catch (error) {
    message.error(error instanceof ApiError ? error.message : '网络中断，请再试一次');
  } finally {
    removing.value = false;
  }
}

async function save() {
  if (!formRef.value || saving.value) return;
  saving.value = true;
  try {
    await formRef.value.submit();
  } finally {
    saving.value = false;
  }
}

async function onFormSaved(id: number) {
  if (draft.value === 'parent' && props.detail) {
    const original = props.detail;
    const role: ParentRole = original.sex === 'female' ? 'mother' : 'father';
    const input: PersonInput = {
      name: original.name,
      sex: original.sex,
      kinship: original.kinship,
      formerName: original.formerName,
      nickname: original.nickname,
      birthText: original.birthText,
      deathText: original.deathText,
      narrative: original.narrative,
      parents: [
        ...original.parents.map((item) => ({ personId: item.id, role: item.role, sortOrder: item.sortOrder })),
        { personId: id, role, sortOrder: original.parents.length },
      ],
      marriages: original.marriages.map((item) => ({
        personId: item.personId,
        label: item.label,
        sortOrder: item.sortOrder,
      })),
    };
    draft.value = null;
    try {
      const { detail: updated } = await tree.savePerson(input, original.id);
      message.success('已保存');
      emit('saved', updated.id);
    } catch (error) {
      message.error(error instanceof ApiError ? error.message : '网络中断，请再试一次');
      emit('saved', id);
    }
    return;
  }
  draft.value = null;
  emit('saved', id);
}

function cancel() {
  if (props.editing) emit('cancelEdit');
  else draft.value = null;
}

function openPerson(id: number) {
  void router.replace({ path: '/', query: { person: String(id) } });
}
</script>

<template>
  <div class="panel">
    <header class="panel-head">
      <div class="title-wrap">
        <h2 class="serif">
          {{ creating ? '新建人物' : draft ? DRAFT_TITLES[draft] : detail?.name }}
          <span v-if="detail && !creating && !draft && !editing" class="sex" :class="detail.sex">{{ SEX_LABELS[detail.sex] }}</span>
          <span v-if="detail && !creating && !draft && !editing && detail.deceased" class="deceased-tag" title="已卒">卒</span>
        </h2>
      </div>
      <div class="head-actions">
        <template v-if="creating || editing || draft">
          <n-button size="small" type="primary" :loading="saving" :disabled="saving" @click="save">保存</n-button>
          <n-button size="small" quaternary @click="creating ? emit('close') : cancel()">取消</n-button>
        </template>
        <template v-else>
          <n-button v-if="detail" size="small" @click="emit('edit')">修改</n-button>
          <n-button size="small" quaternary @click="emit('close')">关闭</n-button>
        </template>
      </div>
    </header>

    <person-form
      v-if="creating || editing || draft"
      ref="formRef"
      :detail="creating ? null : draft ? draftDetail : detail"
      @saved="onFormSaved"
    />

    <template v-else-if="detail">
      <section class="block">
        <h3>基本信息</h3>
        <dl class="field-list">
          <template v-for="[label, key] in visibleFields" :key="key">
            <dt>{{ label }}</dt>
            <dd>{{ text(key) }}</dd>
          </template>
          <template v-if="detail.age != null">
            <dt>年龄</dt>
            <dd>{{ detail.age }}岁</dd>
          </template>
        </dl>
        <p v-if="!visibleFields.length && detail.age == null" class="empty">暂无记述</p>
      </section>

      <kin-list v-if="parentItems.length" title="父母" :items="parentItems" @select="openPerson" />
      <kin-list v-if="spouseItems.length" title="配偶" :items="spouseItems" @select="openPerson" />
      <kin-list v-if="childItems.length" title="子女" :items="childItems" @select="openPerson" />

      <section class="block">
        <h3>添加亲属</h3>
        <div class="quick-add">
          <n-button size="small" @click="draft = 'child'">添加子女</n-button>
          <n-button size="small" @click="draft = 'spouse'">添加配偶</n-button>
          <n-button size="small" @click="draft = 'parent'">添加父母</n-button>
        </div>
      </section>

      <footer class="panel-foot">
        <n-button text type="error" @click="confirmDelete = true">删除人物</n-button>
      </footer>
    </template>

    <n-modal v-model:show="confirmDelete" preset="dialog" title="删除这个人" positive-text="删除" negative-text="取消" :positive-button-props="{ type: 'error', loading: removing }" @positive-click="remove">
      会去掉此人与父母、配偶、子女的关系。子女仍保留；若不再有父母，会在同一张图上成为新的根。
    </n-modal>
  </div>
</template>

<style scoped>
.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-border);
}
h2 {
  display: flex;
  align-items: center;
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.3;
}
.sex,
.deceased-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  margin-left: 8px;
  padding: 2px 7px;
  border: 1px solid currentColor;
  border-radius: 2px;
  font-family: "Avenir Next", "PingFang SC", "Noto Sans SC", sans-serif;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
}
.sex.male {
  color: var(--color-ink);
}
.sex.female {
  color: var(--color-accent);
}
.deceased-tag {
  color: var(--color-muted);
}
.head-actions {
  display: flex;
  flex: none;
  gap: 4px;
  padding-top: 2px;
}
.block h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 600;
  color: #6d6256;
  letter-spacing: 0.18em;
}
.block h3::before {
  content: '';
  width: 3px;
  height: 12px;
  background: #cfc0ab;
}
.block {
  margin-top: 20px;
}
.field-list {
  display: grid;
  grid-template-columns: 4.5rem 1fr;
  gap: 10px 12px;
  margin: 0;
}
.field-list dt {
  padding-top: 2px;
  font-size: 13px;
  color: #6d6256;
  letter-spacing: 0.08em;
}
.field-list dd {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
}
.empty {
  margin: 0;
  font-size: 13px;
  color: #a39a8b;
}
.quick-add {
  display: flex;
  gap: 8px;
}
.panel-foot {
  margin-top: 28px;
  padding-top: 14px;
  border-top: 1px dashed var(--color-border);
}
</style>
