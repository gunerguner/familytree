import { createRouter, createWebHistory } from 'vue-router';
import { useSessionStore } from './stores/session';
import LoginView from './views/login-view.vue';
import TreeView from './views/tree-view.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView },
    { path: '/', component: TreeView },
  ],
});

router.beforeEach(async (to) => {
  const session = useSessionStore();
  if (session.status === 'unknown') await session.bootstrap();
  if (to.path === '/login' && session.status === 'user') return { path: '/', query: to.query };
  if (to.path !== '/login' && session.status !== 'user') return '/login';
  return true;
});
