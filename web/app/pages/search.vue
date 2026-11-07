<script setup lang="ts">
import type { Post } from '~/types';

const api = useApi();
const auth = useAuth();
const route = useRoute();
const router = useRouter();

const keyword = ref((route.query.q as string) || '');
const input = ref(keyword.value);
const posts = ref<Post[]>([]);
const loading = ref(false);
const searched = ref(false);
const total = ref(0);
const errorMsg = ref('');

const suggestions = ref<{ name: string; count: number }[]>([]);

async function doSearch() {
  const q = input.value.trim();
  if (!q) {
    posts.value = [];
    searched.value = false;
    keyword.value = '';
    return;
  }
  loading.value = true;
  errorMsg.value = '';
  searched.value = true;
  keyword.value = q;
  try {
    const res = await api.listPosts({ keyword: q, pageSize: 50 });
    posts.value = res.items;
    total.value = res.total;
    await router.replace({ query: { q } });
  } catch (e) {
    errorMsg.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

async function loadSuggestions() {
  try {
    const res = await api.listTags();
    suggestions.value = res.tags.slice(0, 12);
  } catch {
    /* 忽略 */
  }
}

onMounted(async () => {
  await auth.restore();
  await loadSuggestions();
  if (keyword.value) await doSearch();
});

useHead({ title: '检索 · 说说后台' });
</script>

<template>
  <div class="search-page">
    <div class="page-title">
      <span class="meta-label">梳理</span>
      <h1>检索</h1>
    </div>

    <form class="search-form" @submit.prevent="doSearch">
      <input
        v-model="input"
        class="input search-input"
        type="search"
        placeholder="输入关键词，支持中英文…"
        autofocus
      />
      <button class="btn btn-seal" type="submit" :disabled="loading">
        <span v-if="loading" class="spinner" />
        搜索
      </button>
    </form>

    <div v-if="suggestions.length && !searched" class="suggestions">
      <span class="sug-label">常用标签</span>
      <button
        v-for="s in suggestions"
        :key="s.name"
        class="chip"
        @click="input = s.name; doSearch()"
      >
        #{{ s.name }}
      </button>
    </div>

    <div v-if="searched && !loading" class="result-head">
      找到 <strong>{{ total }}</strong> 条与「{{ keyword }}」相关的说说
    </div>

    <div v-if="loading" class="loading-state">
      <span class="spinner" /> 搜索中…
    </div>

    <div v-else-if="searched && posts.length === 0" class="empty sheet">
      <span class="empty-mark" aria-hidden="true">⌕</span>
      <p>没有找到匹配的记录，换个关键词试试。</p>
    </div>

    <TransitionGroup name="list" tag="div">
      <PostCard v-for="post in posts" :key="post.id" :post="post" />
    </TransitionGroup>

    <p v-if="errorMsg" class="error-box">{{ errorMsg }}</p>
  </div>
</template>

<style scoped lang="scss">
.search-page {
  display: flex;
  flex-direction: column;
  gap: var(--gap-md);

  h1 {
    margin: 0;
    font-size: var(--fs-h2);
  }
}

.search-form {
  display: flex;
  gap: var(--gap-sm);

  .search-input {
    flex: 1;
    height: 40px;
  }
}

.suggestions {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  flex-wrap: wrap;

  .sug-label {
    font-size: var(--fs-meta);
    color: var(--ink-faint);
  }
}

.result-head {
  font-size: var(--fs-body-sm);
  color: var(--ink-soft);
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
}

.error-box {
  padding: var(--gap-md);
  font-size: var(--fs-body-sm);
  color: var(--stamp-bad);
  background: var(--stamp-bad-soft);
  border-radius: var(--r-card);
}
</style>
