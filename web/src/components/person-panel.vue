<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NModal, useMessage } from 'naive-ui';
import PersonForm from './person-form.vue';
import { ApiError } from '../api/client';
import { ROLE_LABELS, SEX_LABELS, type PersonDetail } from '../api/types';
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

function openPerson(id: number) {
  void router.replace({ path: '/', query: { person: String(id) } });
}
</script>

<template>
  <div class="panel">
    <header class="panel-head">
      <h2 class="serif">
        {{ creating ? '新建人物' : detail?.name }}
        <span v-if="detail && !creating && !editing" class="sex" :class="detail.sex">{{ SEX_LABELS[detail.sex] }}</span>
      </h2>
      <div class="head-actions">
        <n-button v-if="detail && !editing && !creating" size="small" @click="emit('edit')">修改</n-button>
        <n-button size="small" quaternary @click="emit('close')">关闭</n-button>
      </div>
    </header>

    <person-form
      v-if="creating || editing"
      :detail="creating ? null : detail"
      @cancel="creating ? emit('close') : emit('cancelEdit')"
      @saved="emit('saved', $event)"
    />

    <template v-else-if="detail">
      <dl class="field-list">
        <dt>性别</dt>
        <dd>{{ SEX_LABELS[detail.sex] }}</dd>
        <template v-for="[label, key] in fields" :key="key">
          <dt>{{ label }}</dt>
          <dd>{{ text(key) }}</dd>
        </template>
        <template v-if="detail.age != null">
          <dt>年龄</dt>
          <dd>{{ detail.age }}岁</dd>
        </template>
      </dl>

      <section v-if="detail.parents.length" class="kin-block">
        <h3>父母</h3>
        <n-button v-for="person in detail.parents" :key="person.id + person.role" text @click="openPerson(person.id)">
          {{ person.name }} · {{ ROLE_LABELS[person.role] }}
        </n-button>
      </section>
      <section v-if="detail.marriages.length" class="kin-block">
        <h3>配偶</h3>
        <n-button v-for="person in detail.marriages" :key="person.personId" text @click="openPerson(person.personId)">
          {{ person.name }}<template v-if="person.label"> · {{ person.label }}</template>
        </n-button>
      </section>
      <section v-if="detail.children.length" class="kin-block">
        <h3>子女</h3>
        <n-button v-for="person in detail.children" :key="person.id + person.role" text @click="openPerson(person.id)">
          {{ person.name }} · {{ ROLE_LABELS[person.role] }}
        </n-button>
      </section>

      <n-button class="danger" text type="error" @click="confirmDelete = true">删除</n-button>
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
  margin-bottom: 16px;
}
h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 500;
}
.sex {
  margin-left: 8px;
  font-size: 14px;
  letter-spacing: 0;
}
.sex.male {
  color: #3d6b58;
}
.sex.female {
  color: #9c4036;
}
.head-actions {
  display: flex;
  gap: 4px;
}
.kin-block :deep(.n-button) {
  display: flex;
  margin: 2px 0;
}
.danger {
  margin-top: 24px;
}
</style>
