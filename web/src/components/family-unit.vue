<script setup lang="ts">
import type { LayoutCard } from '../lib/layout';
import type { Person } from '../api/types';
import { secondLine } from '../lib/layout';

defineProps<{
  card: LayoutCard;
  person: Person;
  selected: boolean;
}>();

defineEmits<{ select: []; toggle: [] }>();

const lineOf = (person: Person) => secondLine(person);
</script>

<template>
  <div
    class="tree-card"
    :class="{ selected }"
    :style="{ width: `${card.width}px`, minHeight: `${card.height}px` }"
    @pointerdown.stop
  >
    <button type="button" class="hit" @click="$emit('select')">
      <span class="name">{{ person.name }}</span>
      <span v-if="lineOf(person)" class="meta">{{ lineOf(person) }}</span>
    </button>
    <button v-if="card.hasChildren" type="button" class="fold" @click="$emit('toggle')">
      {{ card.collapsed ? '展开' : '收起' }}
    </button>
  </div>
</template>

<style scoped>
.hit {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
</style>
