<script setup lang="ts">
import { NButton } from 'naive-ui';
import { useVueFlow } from '@xyflow/vue';

const emit = defineEmits<{ create: [] }>();
const { zoomIn, zoomOut, fitView } = useVueFlow();

function zoom(direction: 'in' | 'out') {
  void (direction === 'in' ? zoomIn : zoomOut)({ duration: 0 });
}

function resetView() {
  void fitView({ padding: 0.2, duration: 250 });
}
</script>

<template>
  <div class="tools">
    <n-button size="small" @click="zoom('in')">放大</n-button>
    <n-button size="small" @click="zoom('out')">缩小</n-button>
    <n-button size="small" @click="resetView">回到全图</n-button>
    <n-button size="small" type="primary" @click="emit('create')">新建</n-button>
  </div>
</template>

<style scoped>
.tools {
  display: flex;
  gap: 8px;
  width: max-content;
}
</style>
