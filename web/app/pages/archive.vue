<script setup lang="ts">
import type { Post } from '~/types';

const api = useApi();
const auth = useAuth();
const router = useRouter();

const posts = ref<Post[]>([]);
const loading = ref(true);
const errorMsg = ref('');
const restoring = ref<string>('');

async function load() {
  if (!auth.isLoggedIn.value) {
    await router.push('/login');
    return;
  }
  loading.value = true;
  try {
    const res = await api.listPosts({ status: 'archived', pageSize: 50 });
    posts.value = res.items;
  } catch (e) {
    errorMsg.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

async function restore(post: Post) {
  restoring.value = post.id;
  try {
    await api.unarchivePost(post.id);
    posts.value = posts.value.filter((p) => p.id !== post.id);
  } catch (e) {
    errorMsg.value = (e as Error).message;
  } finally {
    restoring.value = '';
  }
}

onMounted(async () => {
  await auth.restore();
  await load();
});

useHead({ title: '封存库 · 说说后台' });
</script>

<template>
  <div class="list-page">
    <div class="page-title">
      <span class="meta-label">内容</span>
      <h1>封存库</h1>
    </div>
    <p class="page-hint">封存的记录不在默认列表中出现，随时可以恢复。</p>

    <div v-if="loading" class="loading-state">
      <span class="spinner" /> 加载中…
    </div>

    <div v-else-if="!posts.length" class="empty sheet">
      <span class="empty-mark" aria-hidden="true">▤</span>
      <p>封存库是空的。记录封存后会出现在这里。</p>
      <NuxtLink to="/" class="btn btn-sm">回到时间线</NuxtLink>
    </div>

    <TransitionGroup name="list" tag="div">
      <PostCard
        v-for="post in posts"
        :key="post.id"
        :post="post"
        @changed="
          (p) => {
            if (p.status === 'published') posts = posts.filter((x) => x.id !== p.id);
          }
        "
      />
    </TransitionGroup>

    <div v-if="posts.length" class="batch-actions">
      <button
        v-for="post in posts"
        :key="post.id"
        class="btn btn-sm"
        :disabled="restoring === post.id"
        @click="restore(post)"
      >
        <span v-if="restoring === post.id" class="spinner" />
        ↺ 恢复
      </button>
    </div>

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

.page-hint {
  margin: 0;
  font-size: var(--fs-meta);
  color: var(--ink-faint);
}

.batch-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--gap-sm);
  padding-top: var(--gap-md);
  border-top: 1px solid var(--vellum);
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
