<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NDrawer, NDrawerContent, NLayoutHeader, NButton, useMessage } from 'naive-ui';
import PersonPanel from '../components/person-panel.vue';
import TreeCanvas from '../components/tree-canvas.vue';
import { ApiError } from '../api/client';
import { COLORS } from '../lib/tokens';
import { useSessionStore } from '../stores/session';
import { useTreeStore } from '../stores/tree';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const tree = useTreeStore();
const message = useMessage();
const editing = ref(false);
const loadFailed = ref(false);

const personId = computed(() => {
  const raw = Array.isArray(route.query.person) ? route.query.person[0] : route.query.person;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
});
const creating = computed(() => {
  const raw = Array.isArray(route.query.create) ? route.query.create[0] : route.query.create;
  return raw === '1';
});
const showPanel = computed(() => creating.value || personId.value != null);

watch(
  () => [personId.value, creating.value] as const,
  async ([id, create]) => {
    editing.value = false;
    if (create || id == null) {
      tree.detail = null;
      return;
    }
    try {
      await tree.openPerson(id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        message.error('找不到这个人');
        await router.replace({ path: '/' });
      } else if (error instanceof ApiError) {
        message.error(error.message);
      } else {
        message.error('网络中断，请再试一次');
      }
    }
  },
  { immediate: true },
);

async function loadTree() {
  loadFailed.value = false;
  try {
    await tree.loadTree();
  } catch {
    loadFailed.value = true;
  }
}

async function logout() {
  await session.logout();
  await router.replace('/login');
}

function select(id: number) {
  void router.replace({ path: '/', query: { person: String(id) } });
}

function createPerson() {
  void router.replace({ path: '/', query: { create: '1' } });
}

function closePanel() {
  editing.value = false;
  void router.replace({ path: '/' });
}

async function saved(id: number) {
  editing.value = false;
  await router.replace({ path: '/', query: { person: String(id) } });
}

onMounted(() => {
  void loadTree();
});
</script>

<template>
  <div class="page">
    <n-layout-header bordered class="bar">
      <strong class="serif brand">族谱</strong>
      <div class="account">
        <span>{{ session.username }}</span>
        <n-button quaternary @click="logout">退出</n-button>
      </div>
    </n-layout-header>
    <div class="body">
      <div v-if="loadFailed" class="load-error">
        <span>族谱加载失败，请检查网络后重试</span>
        <n-button size="small" @click="loadTree">重试</n-button>
      </div>
      <tree-canvas
        :persons="tree.persons"
        :parents="tree.parents"
        :marriages="tree.marriages"
        :collapsed="tree.collapsed"
        :selected-id="creating ? null : personId"
        @select="select"
        @toggle="tree.toggle"
        @create="createPerson"
      />
      <n-drawer
        :show="showPanel"
        placement="right"
        :width="'min(24rem, calc(100vw - 3rem))'"
        show-mask="transparent"
        :content-style="{ background: COLORS.paper }"
        @update:show="(show) => { if (!show) closePanel(); }"
      >
        <n-drawer-content :body-content-style="{ padding: '20px 22px 32px' }">
          <person-panel
            :detail="tree.detail"
            :creating="creating"
            :editing="editing"
            @edit="editing = true"
            @close="closePanel"
            @cancel-edit="editing = false"
            @saved="saved"
          />
        </n-drawer-content>
      </n-drawer>
    </div>
  </div>
</template>

<style scoped>
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 20px;
  background: var(--color-paper);
}
.load-error {
  position: absolute;
  z-index: 4;
  top: 80px;
  left: 48px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--color-accent);
}
.brand {
  font-size: 20px;
  font-weight: 500;
  letter-spacing: 0.14em;
}
.account {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #5c6b64;
}
.body {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
}
</style>
