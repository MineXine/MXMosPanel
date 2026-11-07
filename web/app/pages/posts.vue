<script setup lang="ts">
import type { Post, SavedView, TagInfo } from '~/types';

const api = useApi();
const auth = useAuth();
const route = useRoute();
const router = useRouter();

const posts = ref<Post[]>([]);
const tags = ref<TagInfo[]>([]);
const views = ref<SavedView[]>([]);

const page = ref(1);
const pageSize = 20;
const total = ref(0);
const hasMore = ref(false);
const loading = ref(false);
const errorMsg = ref('');

// 筛选
const keyword = ref('');
const activeTag = ref<string>('');
const sort = ref<'latest' | 'oldest' | 'popular' | 'liked'>('latest');
const visibility = ref<'all' | 'public' | 'private'>('all');
const status = ref<'published' | 'archived'>('published');
const activeViewId = ref('');

const showFilters = ref(false);

const isEmpty = computed(() => !loading.value && posts.value.length === 0);

function buildParams() {
  return {
    page: page.value,
    pageSize,
    visibility: visibility.value,
    status: status.value,
    keyword: keyword.value || undefined,
    tags: activeTag.value ? [activeTag.value] : undefined,
    sort: sort.value,
  };
}

async function loadPosts(reset = true) {
  loading.value = true;
  errorMsg.value = '';
  try {
    if (reset) page.value = 1;

    if (activeViewId.value) {
      const res = await api.viewPosts(activeViewId.value, page.value, pageSize);
      posts.value = reset ? res.items : [...posts.value, ...res.items];
      total.value = res.total;
      hasMore.value = res.hasMore;
    } else {
      const res = await api.listPosts(buildParams());
      posts.value = reset ? res.items : [...posts.value, ...res.items];
      total.value = res.total;
      hasMore.value = res.hasMore;
    }
  } catch (e) {
    errorMsg.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

async function loadSidebar() {
  try {
    const [tagRes, viewRes] = await Promise.all([api.listTags(), api.listViews()]);
    tags.value = tagRes.tags;
    views.value = viewRes.views;
  } catch {
    /* 侧栏失败不阻塞主流程 */
  }
}

/**
 * 首屏数据由 useAsyncData 预取。
 *
 * 数据必须经由 useAsyncData 的 data ref 返回：
 * 直接给外部 ref 赋值会在客户端水合时被重置，导致 SSR 与客户端渲染不一致。
 */
const { data: recordsData, pending: initialLoading } = await useAsyncData(
  'records-initial',
  async () => {
    try {
      const res = await api.listPosts(buildParams());
      return { items: res.items, total: res.total, hasMore: res.hasMore };
    } catch {
      return { items: [], total: 0, hasMore: false };
    }
  },
  { server: true, default: () => ({ items: [], total: 0, hasMore: false }) },
);

// 首屏数据同步一次即可；后续由 loadPosts 直接维护列表状态
const syncedInitial = ref(false);
watchEffect(() => {
  if (syncedInitial.value || !recordsData.value) return;
  posts.value = recordsData.value.items;
  total.value = recordsData.value.total;
  hasMore.value = recordsData.value.hasMore;
  syncedInitial.value = true;
});

function applyView(view: SavedView) {
  if (activeViewId.value === view.id) {
    activeViewId.value = '';
    visibility.value = 'all';
    status.value = 'published';
    sort.value = 'latest';
    activeTag.value = '';
    keyword.value = '';
  } else {
    activeViewId.value = view.id;
    const f = view.filters ?? {};
    visibility.value = (f.visibility as 'all' | 'public' | 'private') ?? 'all';
    status.value = (f.status as 'published' | 'archived') ?? 'published';
    sort.value = (f.sort as typeof sort.value) ?? 'latest';
    activeTag.value = f.tags?.[0] ?? '';
    keyword.value = f.keyword ?? '';
  }
  loadPosts();
}

function selectTag(tag: string) {
  activeTag.value = activeTag.value === tag ? '' : tag;
  activeViewId.value = '';
  loadPosts();
}

function changeSort(v: typeof sort.value) {
  sort.value = v;
  activeViewId.value = '';
  loadPosts();
}

function loadMore() {
  page.value += 1;
  loadPosts(false);
}

function onPostChanged(updated: Post) {
  const idx = posts.value.findIndex((p) => p.id === updated.id);
  if (idx >= 0) posts.value[idx] = updated;
}

function onDeleted(id: string) {
  posts.value = posts.value.filter((p) => p.id !== id);
  total.value = Math.max(0, total.value - 1);
}

onMounted(async () => {
  await auth.restore();
  await loadSidebar();
});

watch(
  () => route.query,
  (q) => {
    if (typeof q.tag === 'string' && q.tag !== activeTag.value) {
      activeTag.value = q.tag;
      loadPosts();
    }
  },
);

useHead({ title: '记录管理 · 说说后台' });
</script>

<template>
  <div class="records">
    <header class="page-head">
      <div>
        <span class="meta-label">内容</span>
        <h1>记录管理</h1>
      </div>
      <NuxtLink to="/new" class="btn btn-seal">✎ 写一条</NuxtLink>
    </header>

    <!-- 视图快捷条 -->
    <div v-if="views.length" class="viewbar">
      <button
        v-for="v in views"
        :key="v.id"
        class="viewchip"
        :class="{ on: activeViewId === v.id }"
        :title="v.description"
        @click="applyView(v)"
      >
        {{ v.name }}
      </button>
    </div>

    <!-- 筛选工具条 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <label class="sr-only" for="vis">可见性</label>
        <select id="vis" v-model="visibility" class="select select-sm" :disabled="!!activeViewId" @change="loadPosts()">
          <option value="all">全部可见</option>
          <option value="public">公开</option>
          <option value="private">私密</option>
        </select>

        <label class="sr-only" for="sort">排序</label>
        <select id="sort" v-model="sort" class="select select-sm" :disabled="!!activeViewId" @change="changeSort(sort)">
          <option value="latest">最新优先</option>
          <option value="oldest">最早优先</option>
          <option value="popular">最热门</option>
          <option value="liked">最多收藏</option>
        </select>

        <button
          class="chip"
          :class="{ 'chip-on': status === 'archived' }"
          @click="status = status === 'archived' ? 'published' : 'archived'; activeViewId = ''; loadPosts()"
        >
          ▤ 已封存
        </button>

        <button class="btn btn-quiet btn-sm" @click="showFilters = !showFilters">⚙ 筛选</button>
      </div>

      <span class="toolbar-count tabular">{{ total }} 条</span>
    </div>

    <Transition name="fade">
      <div v-if="showFilters" class="filters">
        <div class="filter-field">
          <label for="kw">关键词</label>
          <input
            id="kw"
            v-model="keyword"
            class="input input-sm"
            placeholder="搜索正文、标签…"
            @keyup.enter="loadPosts()"
          />
        </div>
        <div class="filter-field">
          <label for="tg">标签</label>
          <select id="tg" v-model="activeTag" class="select select-sm" @change="loadPosts()">
            <option value="">全部标签</option>
            <option v-for="t in tags" :key="t.name" :value="t.name">
              #{{ t.name }} ({{ t.count }})
            </option>
          </select>
        </div>
        <button class="btn btn-seal btn-sm" @click="loadPosts()">应用</button>
      </div>
    </Transition>

    <!-- 标签条 -->
    <div v-if="tags.length" class="tagbar">
      <button
        v-for="t in tags.slice(0, 12)"
        :key="t.name"
        class="chip"
        :class="{ 'chip-on': activeTag === t.name }"
        @click="selectTag(t.name)"
      >
        #{{ t.name }}
        <span class="chip-num tabular">{{ t.count }}</span>
      </button>
    </div>

    <!-- 列表 -->
    <div v-if="initialLoading" class="stack">
      <div v-for="i in 3" :key="i" class="skeleton skeleton-row" />
    </div>

    <div v-else-if="isEmpty" class="empty sheet">
      <span class="empty-mark" aria-hidden="true">≡</span>
      <p v-if="activeViewId || keyword || activeTag">没有符合条件的记录</p>
      <p v-else>这里还没有记录</p>
      <NuxtLink to="/new" class="btn btn-seal btn-sm empty-action">写一条</NuxtLink>
    </div>

    <TransitionGroup name="rise" tag="div">
      <PostCard
        v-for="post in posts"
        :key="post.id"
        :post="post"
        :show-author="false"
        @changed="onPostChanged"
        @deleted="onDeleted"
      />
    </TransitionGroup>

    <p v-if="errorMsg" class="notice notice-error">{{ errorMsg }}</p>

    <div v-if="hasMore" class="load-more">
      <button class="btn" :disabled="loading" @click="loadMore">
        <span v-if="loading" class="spinner" />
        加载更多（{{ posts.length }} / {{ total }}）
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.records {
  display: flex;
  flex-direction: column;
  gap: var(--gap-md);
}

.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--gap-lg);
  margin-bottom: var(--gap-xs);

  h1 {
    margin-top: var(--gap-xs);
    font-size: var(--fs-h1);
  }
}

.viewbar {
  display: flex;
  gap: var(--gap-xs);
  overflow-x: auto;
  padding-bottom: var(--gap-xs);
}

.viewchip {
  padding: var(--gap-xs) var(--gap-md);
  font-size: var(--fs-meta);
  font-weight: 500;
  color: var(--ink-soft);
  background: var(--paper-raised);
  border: 1px solid var(--vellum);
  border-radius: var(--r-pill);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all var(--dur-press) var(--ease-out);

  &:hover {
    border-color: var(--vellum-strong);
    color: var(--ink);
  }

  &.on {
    background: var(--seal);
    color: var(--seal-ink);
    border-color: transparent;
    font-weight: 550;
  }
}

.toolbar {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
  flex-wrap: wrap;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  flex-wrap: wrap;
}

.toolbar-count {
  margin-left: auto;
  font-size: var(--fs-meta);
  color: var(--ink-faint);
}

.select-sm {
  width: auto;
  height: 28px;
  padding: 0 var(--gap-lg) 0 var(--gap-sm);
  font-size: var(--fs-meta);
}

.input-sm {
  height: 28px;
  font-size: var(--fs-meta);
}

.filters {
  display: flex;
  align-items: flex-end;
  gap: var(--gap-md);
  padding: var(--gap-lg);
  background: var(--paper-raised);
  border-radius: var(--r-card);
  box-shadow: var(--lift-card);
  flex-wrap: wrap;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: var(--gap-xs);

  label {
    font-size: var(--fs-caption);
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--ink-faint);
  }

  .input,
  .select {
    min-width: 180px;
  }
}

.tagbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--gap-sm);

  .chip-num {
    font-size: 10px;
    opacity: 0.65;
  }
}

.stack {
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
}

.skeleton-row {
  height: 96px;
}

.empty.sheet {
  padding: var(--gap-3xl) var(--gap-xl);
}

.load-more {
  display: flex;
  justify-content: center;
  padding: var(--gap-lg) 0;
}

/* 屏幕阅读器专用文本 */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
