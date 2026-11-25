<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NCard, NForm, NFormItem, NInput } from 'naive-ui';
import { ApiError } from '../api/client';
import { useSessionStore } from '../stores/session';

const router = useRouter();
const session = useSessionStore();
const username = ref('');
const password = ref('');
const error = ref('');
const pending = ref(false);

async function submit() {
  error.value = '';
  pending.value = true;
  try {
    await session.login(username.value, password.value);
    await router.replace('/');
  } catch (caught) {
    error.value = caught instanceof ApiError ? caught.message : '网络中断，请再试一次';
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <main class="login">
    <n-card class="sheet">
      <h1 class="serif">族谱</h1>
      <p class="hint">家族内部使用</p>
      <n-form @submit.prevent="submit">
        <n-form-item label="用户名" :feedback="error" :validation-status="error ? 'error' : undefined">
          <n-input v-model:value="username" autocomplete="username" />
        </n-form-item>
        <n-form-item label="密码">
          <n-input v-model:value="password" type="password" show-password-on="click" autocomplete="current-password" />
        </n-form-item>
        <n-button type="primary" attr-type="submit" block :disabled="pending" :loading="pending">
          {{ pending ? '正在进入' : '进入' }}
        </n-button>
      </n-form>
    </n-card>
  </main>
</template>

<style scoped>
.login {
  min-height: 100%;
  display: grid;
  place-items: center;
  padding: 32px 16px;
}
.sheet {
  width: min(22rem, 100%);
}
h1 {
  margin: 0;
  font-size: 32px;
  font-weight: 500;
  letter-spacing: 0.12em;
}
.hint {
  margin: 8px 0 24px;
  color: #6d6256;
}
</style>
