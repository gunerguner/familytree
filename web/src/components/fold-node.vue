<script setup lang="ts">
import { Handle, Position, type NodeProps } from '@xyflow/vue';
import type { FoldNode } from '../lib/flow';

defineProps<NodeProps<FoldNode>>();
</script>

<template>
  <Handle type="target" :position="Position.Top" />
  <button type="button" class="fold" :aria-label="data.collapsed ? '展开' : '收起'">
    {{ data.collapsed ? '+' : '−' }}
  </button>
</template>

<style scoped>
.fold {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--color-ink);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}
.fold::before {
  content: '';
  position: absolute;
  z-index: -1;
  top: 50%;
  left: 50%;
  box-sizing: border-box;
  width: 16px;
  height: 16px;
  border: 1px solid var(--color-line);
  border-radius: 50%;
  background: #fffdf8;
  transform: translate(-50%, -50%);
}
</style>
