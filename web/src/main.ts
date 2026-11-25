import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './app.vue';
import { setUnauthorizedHandler } from './api/client';
import { router } from './router';
import { useSessionStore } from './stores/session';
import { themeOverrides } from './theme';
import './styles/main.css';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);
app.provide('themeOverrides', themeOverrides);
setUnauthorizedHandler(() => {
  useSessionStore().clear();
  if (router.currentRoute.value.path !== '/login') void router.replace('/login');
});
app.mount('#app');
