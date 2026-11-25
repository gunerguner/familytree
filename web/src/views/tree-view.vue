<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NCard, NDrawer, NLayoutHeader, NButton, useMessage } from 'naive-ui';
import PersonPanel from '../components/person-panel.vue';
import TreeCanvas from '../components/tree-canvas.vue';
import { ApiError } from '../api/client';
import { useSessionStore } from '../stores/session';
import { useTreeStore } from '../stores/tree';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const tree = useTreeStore();
const message = useMessage();
const editing = ref(false);
const narrow = ref(false);

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
      }
    }
  },
  { immediate: true },
);

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

let media: MediaQueryList | null = null;
function applyMedia() {
  narrow.value = media?.matches ?? false;
}

onMounted(() => {
  void tree.loadTree();
  media = window.matchMedia('(max-width: 767px)');
  applyMedia();
  media.addEventListener('change', applyMedia);
});

onUnmounted(() => media?.removeEventListener('change', applyMedia));
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
      <n-card v-if="showPanel && !narrow" class="side" content-style="overflow: auto">
        <person-panel
          :detail="tree.detail"
          :creating="creating"
          :editing="editing"
          @edit="editing = true"
          @close="closePanel"
          @cancel-edit="editing = false"
          @saved="saved"
        />
      </n-card>
      <n-drawer v-if="narrow" :show="showPanel" placement="bottom" :height="'86vh'" @update:show="(show) => !show && closePanel()">
        <person-panel
          :detail="tree.detail"
          :creating="creating"
          :editing="editing"
          @edit="editing = true"
          @close="closePanel"
          @cancel-edit="editing = false"
          @saved="saved"
        />
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
  background: #fffcf7;
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
  flex: 1;
  min-height: 0;
  display: flex;
}
.side {
  width: 24rem;
  flex: none;
  border-radius: 0;
  border-top: 0;
  border-right: 0;
  border-bottom: 0;
  overflow: auto;
}
</style>
