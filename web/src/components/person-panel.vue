<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NModal, useMessage } from 'naive-ui';
import PersonForm from './person-form.vue';
import KinList from './kin-list.vue';
import { ApiError } from '../api/client';
import { ROLE_LABELS, SEX_LABELS, type ParentRole, type PersonDetail } from '../api/types';
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

const fields = [
  ['称谓', 'kinship'],
  ['原名', 'formerName'],
  ['小名', 'nickname'],
  ['出生', 'birthText'],
  ['卒于', 'deathText'],
  ['记述', 'narrative'],
] as const;

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

function openPerson(id: number) {
  void router.replace({ path: '/', query: { person: String(id) } });
}
</script>

<template>
  <div class="panel">
    <header class="panel-head">
      <div class="title-wrap">
        <h2 class="serif">
          {{ creating ? '新建人物' : detail?.name }}
          <span v-if="detail && !creating && !editing" class="sex" :class="detail.sex">{{ SEX_LABELS[detail.sex] }}</span>
          <span v-if="detail && !creating && !editing && detail.deceased" class="deceased-tag" title="已卒">卒</span>
        </h2>
      </div>
      <div class="head-actions">
        <template v-if="creating || editing">
          <n-button size="small" type="primary" :loading="saving" :disabled="saving" @click="save">保存</n-button>
          <n-button size="small" quaternary @click="creating ? emit('close') : emit('cancelEdit')">取消</n-button>
        </template>
        <template v-else>
          <n-button v-if="detail" size="small" @click="emit('edit')">修改</n-button>
          <n-button size="small" quaternary @click="emit('close')">关闭</n-button>
        </template>
      </div>
    </header>

    <person-form
      v-if="creating || editing"
      ref="formRef"
      :detail="creating ? null : detail"
      @saved="emit('saved', $event)"
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
  border-bottom: 1px solid #e4d8c8;
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
  color: #3d6b58;
}
.sex.female {
  color: #9c4036;
}
.deceased-tag {
  color: #8a7d6d;
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
.panel-foot {
  margin-top: 28px;
  padding-top: 14px;
  border-top: 1px dashed #e4d8c8;
}
</style>
