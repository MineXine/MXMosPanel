<script setup lang="ts">
import type { NuxtError } from '#app';

const props = defineProps<{ error: NuxtError }>();

const auth = useAuth();

async function goHome() {
  await auth.restore();
  await navigateTo('/');
}
</script>

<template>
  <div class="error-page">
    <div class="error-code">{{ props.error.statusCode || 500 }}</div>
    <h1>{{ props.error.statusCode === 404 ? '页面不存在' : '出错了' }}</h1>
    <p class="error-msg">{{ props.error.message || '发生了未知错误' }}</p>
    <button class="btn btn-seal" @click="goHome">回到首页</button>
  </div>
</template>

<style scoped lang="scss">
.error-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--gap-md);
  min-height: 100vh;
  padding: var(--gap-xl);
  text-align: center;
  background: var(--paper);
}

.error-code {
  font-size: 72px;
  font-weight: 800;
  line-height: 1;
  color: var(--seal);
  opacity: 0.25;
}

h1 {
  margin: 0;
  font-size: var(--fs-h2);
}

.error-msg {
  margin: 0;
  font-size: var(--fs-body-sm);
  color: var(--ink-faint);
}
</style>
