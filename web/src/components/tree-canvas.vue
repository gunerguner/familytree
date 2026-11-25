<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { NButton } from 'naive-ui';
import FamilyUnit from './family-unit.vue';
import { layout } from '../lib/layout';
import type { Marriage, ParentLink, Person } from '../api/types';

const props = defineProps<{
  persons: Person[];
  parents: ParentLink[];
  marriages: Marriage[];
  collapsed: number[];
  selectedId: number | null;
}>();

const emit = defineEmits<{ select: [id: number]; toggle: [id: number]; create: [] }>();

const viewport = ref<HTMLElement | null>(null);
const scale = ref(1);
const translate = reactive({ x: 0, y: 0 });
let dragging = false;
let lastX = 0;
let lastY = 0;

const result = computed(() =>
  layout(props.persons, props.parents, props.marriages, new Set(props.collapsed)),
);
const people = computed(() => new Map(props.persons.map((person) => [person.id, person])));

function zoomBy(factor: number) {
  scale.value = Math.min(1.8, Math.max(0.4, scale.value * factor));
}

function resetView() {
  scale.value = 1;
  translate.x = 0;
  translate.y = 0;
  if (viewport.value) {
    viewport.value.scrollLeft = 0;
    viewport.value.scrollTop = 0;
  }
}

function onWheel(event: WheelEvent) {
  const element = viewport.value;
  if (!element) return;
  const rect = element.getBoundingClientRect();
  const px = event.clientX - rect.left;
  const py = event.clientY - rect.top;
  const next = Math.min(1.8, Math.max(0.4, scale.value * (event.deltaY < 0 ? 1.08 : 0.92)));
  const worldX = (px - translate.x) / scale.value;
  const worldY = (py - translate.y) / scale.value;
  translate.x = px - worldX * next;
  translate.y = py - worldY * next;
  scale.value = next;
}

function onPointerDown(event: PointerEvent) {
  if ((event.target as HTMLElement).closest('.tree-card, .tools')) return;
  dragging = true;
  lastX = event.clientX;
  lastY = event.clientY;
  viewport.value?.setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent) {
  if (!dragging) return;
  translate.x += event.clientX - lastX;
  translate.y += event.clientY - lastY;
  lastX = event.clientX;
  lastY = event.clientY;
}

function onPointerUp() {
  dragging = false;
}
</script>

<template>
  <div
    ref="viewport"
    class="viewport"
    @wheel.prevent="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div class="tools">
      <n-button size="small" @click="zoomBy(1.12)">放大</n-button>
      <n-button size="small" @click="zoomBy(0.9)">缩小</n-button>
      <n-button size="small" @click="resetView">回到全图</n-button>
      <n-button size="small" type="primary" @click="emit('create')">新建</n-button>
    </div>
    <p v-if="!persons.length" class="empty">还没有人物</p>
    <div
      class="canvas"
      :style="{
        width: `${result.width}px`,
        height: `${result.height}px`,
        transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
      }"
    >
      <svg :width="result.width" :height="result.height">
        <path v-for="(line, index) in result.lines" :key="index" :d="line" fill="none" stroke="#c8bbaa" stroke-width="1" />
      </svg>
      <family-unit
        v-for="card in result.cards"
        :key="`${card.id}-${card.side}`"
        class="canvas-card"
        :style="{ left: `${card.x}px`, top: `${card.y}px` }"
        :card="card"
        :person="people.get(card.id)!"
        :selected="card.id === selectedId"
        @select="emit('select', card.id)"
        @toggle="emit('toggle', card.id)"
      />
    </div>
  </div>
</template>

<style scoped>
.tools {
  position: sticky;
  top: 16px;
  left: 16px;
  z-index: 2;
  display: flex;
  gap: 8px;
  width: max-content;
  margin: 16px;
}
.empty {
  margin: 80px 48px;
  color: #6d6256;
}
</style>
