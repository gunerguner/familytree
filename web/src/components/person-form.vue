<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { NButton, NForm, NFormItem, NInput, NInputNumber, NSelect, useMessage } from 'naive-ui';
import { ApiError } from '../api/client';
import { PERSON_FIELDS } from '../lib/person-fields';
import { ROLE_LABELS, SEX_LABELS, type ParentRole, type Person, type PersonDraft, type PersonInput, type Sex } from '../api/types';
import { useTreeStore } from '../stores/tree';

const props = defineProps<{
  detail: PersonDraft | null;
}>();

const emit = defineEmits<{ saved: [id: number] }>();
const tree = useTreeStore();
const message = useMessage();
const pending = ref(false);
const nameError = ref('');
const sexError = ref('');
const fieldErrors = ref<Record<string, string>>({});

const sexes = (Object.keys(SEX_LABELS) as Sex[]).map((value) => ({
  label: SEX_LABELS[value],
  value,
}));

const roles = (Object.keys(ROLE_LABELS) as ParentRole[]).map((value) => ({
  label: ROLE_LABELS[value],
  value,
}));

const form = reactive({
  name: '',
  sex: null as Sex | null,
  kinship: '',
  formerName: '',
  nickname: '',
  birthText: '',
  deathText: '',
  narrative: '',
  parents: [] as { personId: number | null; role: ParentRole; sortOrder: number }[],
  marriages: [] as { personId: number | null; label: string; sortOrder: number }[],
});

watch(
  () => props.detail,
  (detail) => {
    form.name = detail?.name ?? '';
    form.sex = detail?.sex ?? null;
    form.kinship = detail?.kinship ?? '';
    form.formerName = detail?.formerName ?? '';
    form.nickname = detail?.nickname ?? '';
    form.birthText = detail?.birthText ?? '';
    form.deathText = detail?.deathText ?? '';
    form.narrative = detail?.narrative ?? '';
    form.parents = (detail?.parents ?? []).map((item) => ({
      personId: item.id,
      role: item.role,
      sortOrder: item.sortOrder,
    }));
    form.marriages = (detail?.marriages ?? []).map((item) => ({
      personId: item.personId,
      label: item.label ?? '',
      sortOrder: item.sortOrder,
    }));
    nameError.value = '';
    sexError.value = '';
    fieldErrors.value = {};
  },
  { immediate: true },
);

const selfId = computed(() => props.detail?.id ?? null);

function options(selected: number | null, rows: { personId: number | null }[]) {
  const taken = new Set(rows.map((row) => row.personId).filter((id) => id != null && id !== selected));
  return tree.persons
    .filter((person) => person.id !== selfId.value && !taken.has(person.id))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
    .map((person: Person) => ({ label: person.name, value: person.id }));
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function submit() {
  nameError.value = '';
  sexError.value = '';
  fieldErrors.value = {};
  if (!form.name.trim()) {
    nameError.value = '请填写姓名';
    return;
  }
  if (!form.sex) {
    sexError.value = '请选择性别';
    return;
  }
  if (form.parents.some((row) => row.personId == null) || form.marriages.some((row) => row.personId == null)) {
    message.error('请把空着的父母或配偶选完整，或删掉那一行');
    return;
  }
  const input: PersonInput = {
    name: form.name.trim(),
    sex: form.sex,
    kinship: emptyToNull(form.kinship),
    formerName: emptyToNull(form.formerName),
    nickname: emptyToNull(form.nickname),
    birthText: emptyToNull(form.birthText),
    deathText: emptyToNull(form.deathText),
    narrative: emptyToNull(form.narrative),
    parents: form.parents.map((row) => ({
      personId: row.personId!,
      role: row.role,
      sortOrder: row.sortOrder ?? 0,
    })),
    marriages: form.marriages.map((row) => ({
      personId: row.personId!,
      label: emptyToNull(row.label),
      sortOrder: row.sortOrder ?? 0,
    })),
  };
  pending.value = true;
  try {
    const { detail: saved, refreshed } = await tree.savePerson(input, props.detail?.id);
    if (refreshed) {
      message.success('已保存');
    } else {
      message.warning('已保存，但列表刷新失败');
    }
    emit('saved', saved.id);
  } catch (error) {
    if (error instanceof ApiError) {
      fieldErrors.value = error.fields ?? {};
      message.error(error.message);
    } else {
      message.error('网络中断，请再试一次');
    }
  } finally {
    pending.value = false;
  }
}

defineExpose({ submit });
</script>

<template>
  <n-form @submit.prevent="submit">
    <n-form-item label="姓名" :validation-status="nameError || fieldErrors.name ? 'error' : undefined" :feedback="nameError || fieldErrors.name">
      <n-input v-model:value="form.name" />
    </n-form-item>
    <n-form-item label="性别" :validation-status="sexError || fieldErrors.sex ? 'error' : undefined" :feedback="sexError || fieldErrors.sex">
      <n-select v-model:value="form.sex" :options="sexes" />
    </n-form-item>
    <n-form-item v-for="field in PERSON_FIELDS" :key="field.key" :label="field.label">
      <n-input
        v-if="field.textarea"
        v-model:value="form[field.key]"
        type="textarea"
        :autosize="{ minRows: 4, maxRows: 10 }"
      />
      <n-input v-else v-model:value="form[field.key]" :placeholder="field.placeholder" />
    </n-form-item>

    <section class="block">
      <div v-for="(row, index) in form.parents" :key="index" class="row">
        <n-select v-model:value="row.personId" filterable placeholder="选择人物" :options="options(row.personId, form.parents)" />
        <n-select v-model:value="row.role" :options="roles" />
        <n-input-number v-model:value="row.sortOrder" />
        <n-button text type="error" @click="form.parents.splice(index, 1)">移除</n-button>
      </div>
      <n-button text @click="form.parents.push({ personId: null, role: 'father', sortOrder: form.parents.length })">添加父母</n-button>
    </section>

    <section class="block">
      <div v-for="(row, index) in form.marriages" :key="index" class="row">
        <n-select v-model:value="row.personId" filterable placeholder="选择人物" :options="options(row.personId, form.marriages)" />
        <n-input v-model:value="row.label" placeholder="妻子、续弦、丈夫" />
        <n-input-number v-model:value="row.sortOrder" />
        <n-button text type="error" @click="form.marriages.splice(index, 1)">移除</n-button>
      </div>
      <n-button text @click="form.marriages.push({ personId: null, label: '', sortOrder: form.marriages.length })">添加配偶</n-button>
    </section>
  </n-form>
</template>

<style scoped>
.block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  margin: 8px 0 16px;
}
.row {
  display: grid;
  grid-template-columns: 1fr 7rem 6rem auto;
  gap: 8px;
  width: 100%;
}
</style>
