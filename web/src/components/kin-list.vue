<script setup lang="ts">
import type { Sex } from '../api/types';

interface KinItem {
  key: string;
  id: number;
  name: string;
  sex: Sex | null;
  deceased: boolean;
  label: string;
}

defineProps<{
  title: string;
  items: KinItem[];
}>();

const emit = defineEmits<{ select: [id: number] }>();
</script>

<template>
  <section class="kin-block">
    <h3>{{ title }}</h3>
    <div class="kin-list">
      <button
        v-for="item in items"
        :key="item.key"
        type="button"
        class="kin-link"
        :class="item.sex"
        @click="emit('select', item.id)"
      >
        <span class="k-name serif">{{ item.name }}</span>
        <span v-if="item.deceased" class="k-dot" title="已卒" />
        <span class="k-role">{{ item.label }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.kin-block {
  margin-top: 20px;
}
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
.kin-block h3::before {
  content: '';
  width: 3px;
  height: 12px;
  background: #cfc0ab;
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
  border: 1px solid var(--color-border);
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
  border-left-color: var(--color-accent);
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
  color: var(--color-muted);
}
</style>
