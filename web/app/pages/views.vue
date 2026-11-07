<script setup lang="ts">
import type { Post, SavedView, ViewFilters } from '~/types';
import { resolveIcon } from '~/utils/icons';

const api = useApi();
const auth = useAuth();

const views = ref<SavedView[]>([]);
const posts = ref<Post[]>([]);
const activeView = ref<SavedView | null>(null);
const loading = ref(true);
const errorMsg = ref('');

const showCreate = ref(false);
const newName = ref('');
const newIcon = ref('◲');
const newDescription = ref('');
const newFilters = ref<ViewFilters>({
  visibility: 'all',
  status: 'published',
  sort: 'latest',
  hasLocation: false,
});
const creating = ref(false);

const ICONS = ['◲', '▦', '◈', '✦', '◑', '◉', '▤', '❏', '◐', '≡'];

async function loadViews() {
  loading.value = true;
  try {
    const res = await api.listViews();
    views.value = res.views;
    if (!activeView.value && res.views.length > 0) {
      await selectView(res.views[0]);
    }
  } catch (e) {
    errorMsg.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

async function selectView(view: SavedView) {
  activeView.value = view;
  try {
    const res = await api.viewPosts(view.id, 1, 50);
    posts.value = res.items;
  } catch (e) {
    errorMsg.value = (e as Error).message;
  }
}

async function createView() {
  if (!newName.value.trim()) {
    errorMsg.value = '请输入视图名称';
    return;
  }
  creating.value = true;
  try {
    const res = await api.createView({
      name: newName.value.trim(),
      icon: newIcon.value,
      description: newDescription.value.trim(),
      filters: newFilters.value,
    });
    views.value.push(res.view);
    showCreate.value = false;
    newName.value = '';
    newDescription.value = '';
    await selectView(res.view);
  } catch (e) {
    errorMsg.value = (e as Error).message;
  } finally {
    creating.value = false;
  }
}

async function removeView(view: SavedView) {
  if (!confirm(`确定删除视图「${view.name}」？`)) return;
  try {
    await api.deleteView(view.id);
    views.value = views.value.filter((v) => v.id !== view.id);
    if (activeView.value?.id === view.id) {
      activeView.value = null;
      posts.value = [];
      if (views.value.length) await selectView(views.value[0]);
    }
  } catch (e) {
    errorMsg.value = (e as Error).message;
  }
}

onMounted(async () => {
  await auth.restore();
  await loadViews();
});

useHead({ title: '视图 · 说说后台' });
</script>

<template>
  <div class="views-page">
    <div class="page-head">
      <div class="head-title">
        <span class="meta-label">梳理</span>
        <h1>视图</h1>
      </div>
      <button class="btn btn-seal btn-sm" @click="showCreate = !showCreate">＋ 新建视图</button>
    </div>

    <!-- 创建视图 -->
    <Transition name="fade">
      <div v-if="showCreate" class="sheet create-form">
        <h3>新建视图</h3>

        <div class="form-row">
          <input v-model="newName" class="input" placeholder="视图名称，如「旅行足迹」" />
          <select v-model="newIcon" class="select select-icon">
            <option v-for="i in ICONS" :key="i" :value="i">{{ i }}</option>
          </select>
        </div>

        <input v-model="newDescription" class="input" placeholder="描述（可选）" />

        <div class="form-grid">
          <div class="form-field">
            <label>可见性</label>
            <select v-model="newFilters.visibility" class="select">
              <option value="all">全部可见</option>
              <option value="public">◉ 公开</option>
              <option value="private">◑ 私密</option>
            </select>
          </div>

          <div class="form-field">
            <label>状态</label>
            <select v-model="newFilters.status" class="select">
              <option value="published">已发布</option>
              <option value="archived">已封存</option>
            </select>
          </div>

          <div class="form-field">
            <label>排序</label>
            <select v-model="newFilters.sort" class="select">
              <option value="latest">最新优先</option>
              <option value="oldest">最早优先</option>
              <option value="popular">最热门</option>
              <option value="liked">最多收藏</option>
            </select>
          </div>

          <div class="form-field">
            <label>位置</label>
            <select v-model="newFilters.hasLocation" class="select">
              <option :value="false">不限</option>
              <option :value="true">仅带位置的</option>
            </select>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn btn-quiet btn-sm" @click="showCreate = false">取消</button>
          <button class="btn btn-seal btn-sm" :disabled="creating" @click="createView">
            <span v-if="creating" class="spinner" />
            创建视图
          </button>
        </div>
      </div>
    </Transition>

    <!-- 视图列表 -->
    <div v-if="loading" class="loading-state">
      <span class="spinner" /> 加载中…
    </div>

    <div v-else class="views-grid">
      <button
        v-for="v in views"
        :key="v.id"
        class="view-card"
        :class="{ active: activeView?.id === v.id }"
        @click="selectView(v)"
      >
        <span class="vc-icon">{{ resolveIcon(v.icon) }}</span>
        <span class="vc-body">
          <strong>{{ v.name }}</strong>
          <small>{{ v.description || '—' }}</small>
        </span>
        <span
          class="vc-del"
          title="删除视图"
          @click.stop="removeView(v)"
        >✕</span>
      </button>
    </div>

    <!-- 视图内容 -->
    <div v-if="activeView" class="view-content">
      <div class="section-head">
        <h2>{{ resolveIcon(activeView.icon) }} {{ activeView.name }}</h2>
        <span>{{ posts.length }} 条说说</span>
      </div>
      <PostCard v-for="post in posts" :key="post.id" :post="post" />
      <div v-if="!posts.length" class="empty">
        <p>该视图下暂无记录</p>
      </div>
    </div>

    <p v-if="errorMsg" class="error-box">{{ errorMsg }}</p>
  </div>
</template>

<style scoped lang="scss">
.views-page {
  display: flex;
  flex-direction: column;
  gap: var(--gap-lg);
}

.page-head {
  display: flex;
  align-items: center;
  gap: var(--gap-md);

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

  .btn {
    margin-left: auto;
  }
}

.create-form {
  padding: var(--gap-lg);
  display: flex;
  flex-direction: column;
  gap: var(--gap-md);

  h3 {
    margin: 0;
    font-size: var(--fs-body);
  }

  .form-row {
    display: flex;
    gap: var(--gap-sm);

    .input {
      flex: 1;
    }
  }

  .select-icon {
    width: 90px;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--gap-md);
  }

  .form-field {
    display: flex;
    flex-direction: column;
    gap: var(--gap-xs);

    label {
      font-size: var(--fs-meta);
      color: var(--ink-faint);
    }
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--gap-sm);
  }
}

.views-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--gap-md);
}

.view-card {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
  padding: var(--gap-md);
  text-align: left;
  background: var(--paper-raised);
  border: 1px solid var(--vellum);
  border-radius: var(--r-sheet);
  cursor: pointer;
  transition: all var(--dur-press) var(--ease-out);

  &:hover {
    border-color: var(--seal);
    transform: translateY(-2px);
    box-shadow: var(--lift-pop);
  }

  &.active {
    background: var(--seal-soft);
    border-color: var(--seal);
  }

  .vc-icon {
    font-size: 20px;
    width: 32px;
    text-align: center;
    flex-shrink: 0;
  }

  .vc-body {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.4;

    strong {
      font-size: var(--fs-body-sm);
    }

    small {
      font-size: var(--fs-meta);
      color: var(--ink-faint);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .vc-del {
    margin-left: auto;
    padding: 2px 5px;
    font-size: 11px;
    color: var(--ink-faint);
    border-radius: var(--r-control);
    opacity: 0;

    &:hover {
      color: var(--stamp-bad);
      background: var(--stamp-bad-soft);
    }
  }

  &:hover .vc-del {
    opacity: 1;
  }
}

.section-head {
  display: flex;
  align-items: baseline;
  gap: var(--gap-sm);
  margin-bottom: var(--gap-md);

  h2 {
    margin: 0;
    font-size: var(--fs-h3);
  }

  span {
    font-size: var(--fs-meta);
    color: var(--ink-faint);
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

.error-box {
  padding: var(--gap-md);
  font-size: var(--fs-body-sm);
  color: var(--stamp-bad);
  background: var(--stamp-bad-soft);
  border-radius: var(--r-card);
}
</style>
