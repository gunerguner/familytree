<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NModal, useMessage } from 'naive-ui';
import PersonForm from './person-form.vue';
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

      <section v-if="detail.parents.length" class="kin-block">
        <h3>父母</h3>
        <div class="kin-list">
          <button
            v-for="person in detail.parents"
            :key="person.id + person.role"
            type="button"
            class="kin-link"
            :class="sexOf(person.id)"
            @click="openPerson(person.id)"
          >
            <span class="k-name serif">{{ person.name }}</span>
            <span v-if="isDeceased(person.id)" class="k-dot" title="已卒" />
            <span class="k-role">{{ ROLE_LABELS[person.role] }}</span>
          </button>
        </div>
      </section>
      <section v-if="detail.marriages.length" class="kin-block">
        <h3>配偶</h3>
        <div class="kin-list">
          <button
            v-for="person in detail.marriages"
            :key="person.personId"
            type="button"
            class="kin-link"
            :class="sexOf(person.personId)"
            @click="openPerson(person.personId)"
          >
            <span class="k-name serif">{{ person.name }}</span>
            <span v-if="isDeceased(person.personId)" class="k-dot" title="已卒" />
            <span class="k-role">{{ spouseLabel(person.personId) }}</span>
          </button>
        </div>
      </section>
      <section v-if="detail.children.length" class="kin-block">
        <h3>子女</h3>
        <div class="kin-list">
          <button
            v-for="person in detail.children"
            :key="person.id + person.role"
            type="button"
            class="kin-link"
            :class="sexOf(person.id)"
            @click="openPerson(person.id)"
          >
            <span class="k-name serif">{{ person.name }}</span>
            <span v-if="isDeceased(person.id)" class="k-dot" title="已卒" />
            <span class="k-role">{{ childLabel(person) }}</span>
          </button>
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
.block h3,
.kin-block h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 600;
  color: #6d6256;
  letter-spacing: 0.18em;
}
.block h3::before,
.kin-block h3::before {
  content: '';
  width: 3px;
  height: 12px;
  background: #cfc0ab;
}
.kin-block + .kin-block,
.kin-block,
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
.kin-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.kin-link {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 7px 12px;
  border: 1px solid #e4d8c8;
  border-left-width: 3px;
  border-radius: 2px;
  background: #fffdf8;
  color: #24302c;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.kin-link:hover {
  border-color: #c9bba8;
  box-shadow: 0 1px 3px rgba(36, 48, 44, 0.07);
}
.kin-link.male {
  border-left-color: #2f6b52;
}
.kin-link.female {
  border-left-color: #9c4036;
}
.k-name {
  font-size: 14px;
  line-height: 1.5;
}
.k-dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #1c1c1c;
}
.k-role {
  margin-left: auto;
  font-size: 12px;
  color: #8a7d6d;
}
.panel-foot {
  margin-top: 28px;
  padding-top: 14px;
  border-top: 1px dashed #e4d8c8;
}
</style>
