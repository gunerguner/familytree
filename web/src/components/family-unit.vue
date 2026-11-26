<script setup lang="ts">
import { Handle, Position, type NodeProps } from '@xyflow/vue';
import type { PersonNode } from '../lib/flow';

defineProps<NodeProps<PersonNode>>();
</script>

<template>
  <div
    class="tree-card"
    :class="[data.person.sex, { selected: data.selected }]"
    :style="{ width: '100%', height: '100%' }"
  >
    <Handle type="target" :position="Position.Top" />
    <Handle type="source" :position="Position.Bottom" />
    <button type="button" class="hit" :title="data.person.name">
      <span class="name">{{ data.person.name }}</span>
      <span v-if="data.person.deceased" class="deceased" title="已卒" />
    </button>
  </div>
</template>

<style scoped>
.hit {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0 10px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: center;
  cursor: pointer;
}
</style>
