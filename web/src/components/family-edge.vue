<script setup lang="ts">
import { computed } from 'vue';
import { BaseEdge, type EdgeProps } from '@xyflow/vue';
import type { FamilyEdge } from '../lib/flow';

const props = defineProps<EdgeProps<FamilyEdge>>();
const path = computed(() => props.data?.d ?? '');
</script>

<template>
  <BaseEdge v-if="path" :id="id" :path="path" :interaction-width="0" :style="style" />
</template>
