<script setup lang="ts">
import type { Post, TagInfo } from '~/types';

const api = useApi();
const auth = useAuth();
const route = useRoute();

const tags = ref<TagInfo[]>([]);
const posts = ref<Post[]>([]);
const activeTag = ref((route.query.tag as string) || '');
const loading = ref(true);
const errorMsg = ref('');

const totalTagged = computed(() => tags.value.reduce((s, t) => s + t.count, 0));

async function loadTags() {
  loading.value = true;
  try {
    const res = await api.listTags();
    tags.value = res.tags;
  } catch (e) {
    errorMsg.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

async function loadPosts() {
  if (!activeTag.value) {
    posts.value = [];
    return;
  }
  try {
    const res = await api.listPosts({ tags: [activeTag.value], pageSize: 50 });
    posts.value = res.items;
  } catch (e) {
    errorMsg.value = (e as Error).message;
  }
}

function select(tag: string) {
  activeTag.value = activeTag.value === tag ? '' : tag;
  loadPosts();
  navigateTo({ query: activeTag.value ? { tag: activeTag.value } : {} }, { replace: true });
}

onMounted(async () => {
  await auth.restore();
  await loadTags();
  await loadPosts();
});

useHead({ title: '标签体系 · 说说后台' });
</script>

<template>
  <div class="tags-page">
    <header class="page-head">
      <div class="head-title">
        <span class="meta-label">梳理</span>
        <h1>标签体系</h1>
      </div>
      <p class="head-note tabular">
        {{ tags.length }} 个标签 · 共 {{ totalTagged }} 次标注
      </p>
    </header>

    <div v-if="loading" class="stack">
      <div v-for="i in 4" :key="i" class="skeleton skeleton-row" />
    </div>

    <div v-else-if="!tags.length" class="empty sheet">
      <span class="empty-mark" aria-hidden="true">#</span>
      <p>还没有标签。在正文里写 #标签，保存后会自动归入这里。</p>
    </div>

    <div v-else class="split">
      <!-- 标签清单 -->
      <section class="taglist-sheet sheet">
        <div class="sheet-head">
          <span class="meta-label">全部标签</span>
          <span class="tabular sheet-count">{{ tags.length }}</span>
        </div>

        <ul class="taglist">
          <li v-for="t in tags" :key="t.name">
            <button
              class="tagrow"
              :class="{ on: activeTag === t.name }"
              @click="select(t.name)"
            >
              <span class="tagrow-name">#{{ t.name }}</span>
              <span class="tagrow-count tabular">{{ t.count }}</span>
              <time class="tagrow-date">{{ new Date(t.lastUsedAt).toLocaleDateString('zh-CN') }}</time>
            </button>
          </li>
        </ul>
      </section>

      <!-- 选中标签的记录 -->
      <section class="tag-detail">
        <template v-if="activeTag">
          <div class="detail-head">
            <div>
              <span class="meta-label">标签</span>
              <h2>#{{ activeTag }}</h2>
            </div>
            <span class="tabular detail-count">{{ posts.length }} 条记录</span>
          </div>

          <PostCard v-for="post in posts" :key="post.id" :post="post" :show-author="false" />

          <div v-if="!posts.length" class="empty sheet">
            <p>这个标签下还没有记录。</p>
            <NuxtLink to="/new" class="btn btn-seal btn-sm empty-action">写一条</NuxtLink>
          </div>
        </template>

        <div v-else class="empty sheet">
          <span class="empty-mark" aria-hidden="true">#</span>
          <p>从左侧选择一个标签，查看它下面的记录。</p>
        </div>
      </section>
    </div>

    <p v-if="errorMsg" class="notice notice-error">{{ errorMsg }}</p>
  </div>
</template>

<style scoped lang="scss">
.tags-page {
  display: flex;
  flex-direction: column;
  gap: var(--gap-lg);
}

.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--gap-lg);
  flex-wrap: wrap;

  .head-title {
    .meta-label {
      display: block;
      margin-bottom: 2px;
    }

    h1 {
      margin: 0;
      font-size: var(--fs-h2);
    }
  }

  .head-note {
    margin: 0;
    font-size: var(--fs-meta);
    color: var(--ink-faint);
  }
}

.stack {
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
}

.skeleton-row {
  height: 48px;
}

.split {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: var(--gap-xl);
  align-items: start;
}

/* ---------------- 标签清单 ---------------- */
.taglist-sheet {
  overflow: hidden;
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--gap-md) var(--gap-lg);
  border-bottom: 1px solid var(--vellum);

  .sheet-count {
    font-size: var(--fs-meta);
    color: var(--ink-ghost);
  }
}

.taglist {
  list-style: none;
  margin: 0;
  padding: var(--gap-xs);
  max-height: 62vh;
  overflow-y: auto;
}

.tagrow {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  width: 100%;
  padding: var(--gap-sm) var(--gap-md);
  font-size: var(--fs-body-sm);
  text-align: left;
  color: var(--ink-soft);
  background: none;
  border: 0;
  border-radius: var(--r-control);
  cursor: pointer;
  transition:
    background-color var(--dur-press) var(--ease-out),
    color var(--dur-press) var(--ease-out);

  &:hover {
    background: var(--paper-tint);
    color: var(--ink);
  }

  &.on {
    background: var(--seal-soft);
    color: var(--seal);
    font-weight: 550;
  }

  .tagrow-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tagrow-count {
    font-size: var(--fs-meta);
    color: var(--ink-ghost);
  }

  .tagrow-date {
    font-size: var(--fs-caption);
    color: var(--ink-ghost);
    min-width: 52px;
    text-align: right;
  }
}

/* ---------------- 详情 ---------------- */
.tag-detail {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--gap-md);
}

.detail-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--gap-md);
  padding-bottom: var(--gap-sm);
  border-bottom: 1px solid var(--vellum);

  .meta-label {
    display: block;
    margin-bottom: 2px;
  }

  h2 {
    margin: 0;
    font-size: var(--fs-h3);
  }

  .detail-count {
    font-size: var(--fs-meta);
    color: var(--ink-faint);
  }
}

.empty.sheet {
  padding: var(--gap-3xl) var(--gap-xl);
}

@media (max-width: 900px) {
  .split {
    grid-template-columns: minmax(0, 1fr);
  }

  .taglist {
    max-height: 240px;
  }
}
</style>
