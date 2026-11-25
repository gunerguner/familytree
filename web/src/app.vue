<script setup lang="ts">
import { NConfigProvider, NMessageProvider } from 'naive-ui';
import { RouterView } from 'vue-router';
import { themeOverrides } from './theme';
</script>

<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-message-provider>
      <router-view />
    </n-message-provider>
  </n-config-provider>
</template>
