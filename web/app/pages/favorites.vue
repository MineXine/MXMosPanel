<script setup lang="ts">
import type { Post } from '~/types';

const api = useApi();
const auth = useAuth();
const router = useRouter();

const posts = ref<Post[]>([]);
const loading = ref(true);
const errorMsg = ref('');

async function load() {
  if (!auth.isLoggedIn.value) {
    await router.push('/login');
    return;
  }
  loading.value = true;
  try {
    const res = await api.listPosts({ favorited: true, pageSize: 50 });
    posts.value = res.items;
  } catch (e) {
    errorMsg.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  await auth.restore();
  await load();
});

useHead({ title: '书签 · 说说后台' });
</script>

<template>
  <div class="list-page">
    <div class="page-title">
      <span class="meta-label">内容</span>
      <h1>书签</h1>
    </div>

    <div v-if="loading" class="loading-state">
      <span class="spinner" /> 加载中…
    </div>

    <div v-else-if="!posts.length" class="empty sheet">
      <span class="empty-mark" aria-hidden="true">✦</span>
      <p>还没有加书签的记录。在记录上点击书签图标即可收藏。</p>
      <NuxtLink to="/" class="btn btn-sm">去逛逛</NuxtLink>
    </div>

    <TransitionGroup name="list" tag="div">
      <PostCard v-for="post in posts" :key="post.id" :post="post" />
    </TransitionGroup>

    <p v-if="errorMsg" class="error-box">{{ errorMsg }}</p>
  </div>
</template>

<style scoped lang="scss">
.list-page {
  display: flex;
  flex-direction: column;
  gap: var(--gap-md);

  h1 {
    margin: 0;
    font-size: var(--fs-h2);
  }
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--gap-sm);
  padding: var(--gap-3xl);
  color: var(--ink-faint);
  font-size: var(--fs-body-sm);
}

.empty.sheet {
  padding: var(--gap-3xl) var(--gap-lg);
  text-align: center;

  .btn {
    margin-top: var(--gap-md);
  }
}

.error-box {
  padding: var(--gap-md);
  font-size: var(--fs-body-sm);
  color: var(--stamp-bad);
  background: var(--stamp-bad-soft);
  border-radius: var(--r-card);
}
</style>
