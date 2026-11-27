<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { NSelect } from 'naive-ui';
import { Panel, VueFlow, type NodeMouseEvent, type VueFlowInstance } from '@xyflow/vue';
import '@xyflow/vue/dist/style.css';
import type { Marriage, ParentLink, Person } from '../api/types';
import { toFlow, type FamilyEdge, type FlowNode } from '../lib/flow';
import { CARD_H, CARD_W, layout } from '../lib/layout';
import CanvasTools from './canvas-tools.vue';
import FamilyEdgePath from './family-edge.vue';
import FamilyUnit from './family-unit.vue';
import FoldNode from './fold-node.vue';

const props = defineProps<{
  persons: Person[];
  parents: ParentLink[];
  marriages: Marriage[];
  collapsed: number[];
  selectedId: number | null;
}>();

const emit = defineEmits<{ select: [id: number]; toggle: [id: number]; create: [] }>();

const flow = ref<VueFlowInstance<FlowNode, FamilyEdge> | null>(null);
const focusPersonId = ref<number | null>(null);
const pendingFit = ref(false);
const graph = computed(() =>
  toFlow(layout(props.persons, props.parents, props.marriages, new Set(props.collapsed)), props.persons, props.selectedId),
);

// 数据首次到达（含新建首个根人物后）时全图适配一次
watch(
  () => props.persons.length,
  (count, before) => {
    if (count > 0 && before === 0) pendingFit.value = true;
  },
  { immediate: true },
);

// 深链（/?person=id）或切换选中人物时居中到对应卡片
watch(
  () => props.selectedId,
  (id) => {
    if (id != null) focusPersonId.value = id;
  },
  { immediate: true },
);

// Vue Flow only re-reads a one-way nodes binding when the array length changes.
watch(
  graph,
  (value) => {
    flow.value?.setNodes(value.nodes);
    flow.value?.setEdges(value.edges);
    const focusId = focusPersonId.value;
    focusPersonId.value = null;
    void nextTick(() => {
      if (!flow.value) return;
      // 折叠/展开会让布局整体重排；把视口平滑居中到刚被点击的人物上，避免视野丢失。
      if (pendingFit.value) {
        pendingFit.value = false;
        void flow.value.fitView({ padding: 0.2, duration: 250 });
      }
      if (focusId == null) return;
      const node = value.nodes.find((item) => item.id === String(focusId));
      if (!node) return;
      const width = node.width ?? CARD_W;
      const height = node.height ?? CARD_H;
      const { zoom } = flow.value.getViewport();
      void flow.value.setCenter(node.position.x + width / 2, node.position.y + height / 2, { zoom, duration: 250 });
    });
  },
  { flush: 'post' },
);

function onNodeClick({ node }: NodeMouseEvent<FlowNode>) {
  if (node.type === 'fold') {
    focusPersonId.value = node.data.personId;
    emit('toggle', node.data.personId);
    return;
  }
  emit('select', node.data.person.id);
}

const searchOptions = computed(() =>
  props.persons
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
    .map((person) => ({ label: person.kinship ? `${person.name}（${person.kinship}）` : person.name, value: person.id })),
);
</script>

<template>
  <div class="tree-flow">
    <VueFlow
      ref="flow"
      :nodes="graph.nodes"
      :edges="graph.edges"
      :nodes-draggable="false"
      :nodes-connectable="false"
      :edges-reconnectable="false"
      :elements-selectable="false"
      :select-nodes-on-drag="false"
      :zoom-on-double-click="false"
      :elevate-nodes-on-select="false"
      :min-zoom="0.4"
      :max-zoom="1.8"
      :delete-key-code="null"
      :selection-key-code="null"
      :multi-selection-key-code="null"
      force-color-mode="light"
      @node-click="onNodeClick"
    >
      <template #node-person="nodeProps">
        <FamilyUnit v-bind="nodeProps" />
      </template>
      <template #node-fold="nodeProps">
        <FoldNode v-bind="nodeProps" />
      </template>
      <template #edge-family="edgeProps">
        <FamilyEdgePath v-bind="edgeProps" />
      </template>
      <Panel position="top-left">
        <CanvasTools @create="emit('create')" />
      </Panel>
      <Panel position="top-right">
        <n-select
          class="search"
          :value="null"
          :options="searchOptions"
          filterable
          size="small"
          placeholder="搜索姓名或称谓"
          @update:value="(id: number) => emit('select', id)"
        />
      </Panel>
      <p v-if="!persons.length" class="empty">还没有人物</p>
    </VueFlow>
  </div>
</template>

<style scoped>
.search {
  width: 14rem;
}
.empty {
  position: absolute;
  z-index: 4;
  top: 80px;
  left: 48px;
  margin: 0;
  color: #6d6256;
  pointer-events: none;
}
</style>
