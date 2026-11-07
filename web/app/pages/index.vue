<script setup lang="ts">
import type { DashboardStats, Post, TagInfo } from '~/types';

const api = useApi();
const auth = useAuth();

const stats = ref<DashboardStats | null>(null);
const recent = ref<Post[]>([]);
const tags = ref<TagInfo[]>([]);
const errorMsg = ref('');

/**
 * 首屏数据由 useAsyncData 预取，SSR 直接输出完整概览。
 *
 * 注意：数据必须通过 useAsyncData 的 data ref 返回，
 * 手动赋值给外部 ref 会在客户端水合时被重置，造成 hydration 不一致。
 */
const { data: dashData, pending: loading } = await useAsyncData(
  'dashboard',
  async () => {
    try {
      const [s, list, t] = await Promise.all([
        api.stats(),
        api.listPosts({ pageSize: 5, sort: 'latest' }),
        api.listTags(),
      ]);
      return {
        stats: s.stats,
        recent: list.items,
        tags: t.tags.slice(0, 8),
      };
    } catch (e) {
      errorMsg.value = (e as Error).message;
      return { stats: null, recent: [], tags: [] };
    }
  },
  {
    server: true,
    default: () => ({ stats: null, recent: [], tags: [] }),
  },
);

watchEffect(() => {
  if (!dashData.value) return;
  stats.value = dashData.value.stats;
  recent.value = dashData.value.recent;
  tags.value = dashData.value.tags;
});

/** 最近一次记录距今：水合完成前不计算，避免 SSR 与客户端结果不一致 */
const lastActive = computed(() => {
  if (!mounted.value || !recent.value.length) return '—';
  const diff = Date.now() - new Date(recent.value[0].createdAt).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return '不到 1 小时前';
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
});

const mounted = ref(false);

onMounted(async () => {
  mounted.value = true;
  await auth.restore();
});

useHead({ title: '概览 · 说说后台' });
</script>

<template>
  <div class="dash">
    <header class="dash-head">
      <div>
        <span class="meta-label">总览</span>
        <h1>你的手账</h1>
      </div>
      <NuxtLink to="/new" class="btn btn-seal">✎ 写一条</NuxtLink>
    </header>

    <!-- 焦点区：总数是这一屏唯一的大数字 -->
    <section class="hero">
      <div class="hero-main">
        <span class="meta-label">累计记录</span>
        <div class="hero-figure tabular">
          <span v-if="loading" class="skeleton hero-skeleton" />
          <template v-else>{{ stats?.total ?? 0 }}</template>
        </div>
        <p class="hero-note">
          {{ stats?.published ?? 0 }} 条已发布 ·
          {{ stats?.archived ?? 0 }} 条已封存 ·
          {{ stats?.privateCount ?? 0 }} 条私密
        </p>
      </div>

      <dl class="hero-stats">
        <div class="hs">
          <dt class="meta-label">获赞</dt>
          <dd class="tabular">{{ stats?.totalLikes ?? 0 }}</dd>
        </div>
        <div class="hs">
          <dt class="meta-label">收藏</dt>
          <dd class="tabular">{{ stats?.totalFavorites ?? 0 }}</dd>
        </div>
        <div class="hs">
          <dt class="meta-label">带位置</dt>
          <dd class="tabular">{{ stats?.withLocation ?? 0 }}</dd>
        </div>
        <div class="hs">
          <dt class="meta-label">标签</dt>
          <dd class="tabular">{{ stats?.tagCount ?? 0 }}</dd>
        </div>
      </dl>
    </section>

    <p v-if="errorMsg" class="notice notice-error">{{ errorMsg }}</p>

    <div class="dash-cols">
      <!-- 最近记录 -->
      <section class="col">
        <div class="col-head">
          <h2>最近记录</h2>
          <NuxtLink to="/posts" class="col-more">全部记录 →</NuxtLink>
        </div>

        <div v-if="loading" class="stack">
          <div v-for="i in 3" :key="i" class="skeleton skeleton-row" />
        </div>

        <div v-else-if="!recent.length" class="empty">
          <span class="empty-mark" aria-hidden="true">✎</span>
          <p>还没有记录。写下第一条，它会出现在这里。</p>
          <NuxtLink to="/new" class="btn btn-seal btn-sm empty-action">写一条</NuxtLink>
        </div>

        <ul v-else class="recent">
          <li v-for="p in recent" :key="p.id" class="recent-item">
            <NuxtLink :to="`/post/${p.id}`" class="recent-link">
              <span class="recent-text">{{ p.plainText || '（无正文）' }}</span>
              <span class="recent-meta">
                <span class="stamp" :class="p.visibility === 'private' ? 'stamp-private' : 'stamp-open'">
                  {{ p.visibility === 'private' ? '私密' : '公开' }}
                </span>
                <time>{{ new Date(p.createdAt).toLocaleDateString('zh-CN') }}</time>
                <span v-if="p.tags.length" class="recent-tags">{{ p.tags.map((t) => `#${t}`).join(' ') }}</span>
              </span>
            </NuxtLink>
          </li>
        </ul>
      </section>

      <!-- 侧栏：标签与快捷入口 -->
      <aside class="col col-side">
        <div>
          <div class="col-head">
            <h2>常用标签</h2>
            <NuxtLink to="/tags" class="col-more">管理 →</NuxtLink>
          </div>

          <div v-if="!tags.length && !loading" class="empty">
            <p class="empty-action">还没有标签</p>
          </div>

          <div v-else class="taglist">
            <NuxtLink
              v-for="t in tags"
              :key="t.name"
              :to="`/tags?tag=${t.name}`"
              class="tagrow"
            >
              <span class="tagrow-name">#{{ t.name }}</span>
              <span class="tagrow-count tabular">{{ t.count }}</span>
            </NuxtLink>
          </div>
        </div>

        <div class="quick">
          <span class="meta-label">快捷入口</span>
          <NuxtLink to="/calendar" class="quick-item">▦ 日历<span>按日期回看</span></NuxtLink>
          <NuxtLink to="/map" class="quick-item">◈ 足迹<span>带位置的记录</span></NuxtLink>
          <NuxtLink to="/archive" class="quick-item">▤ 封存库<span>封存的记录</span></NuxtLink>
          <NuxtLink to="/search" class="quick-item">⌕ 检索<span>全文查找</span></NuxtLink>
        </div>

        <p class="side-note">
          上次记录：<span class="tabular">{{ lastActive }}</span>
        </p>
      </aside>
    </div>
  </div>
</template>

<style scoped lang="scss">
.dash {
  display: flex;
  flex-direction: column;
  gap: var(--gap-xl);
}

.dash-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--gap-lg);

  h1 {
    margin-top: var(--gap-xs);
    font-size: var(--fs-h1);
  }
}

/* ---------------- 焦点区 ---------------- */
.hero {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: var(--gap-2xl);
  padding: var(--gap-xl) var(--gap-2xl);
  background: var(--paper-raised);
  border-radius: var(--r-card);
  box-shadow: var(--lift-card);
  flex-wrap: wrap;
}

.hero-main {
  // 焦点：数字是这一屏唯一的大字，靠留白与对比赢
  .hero-figure {
    margin: var(--gap-sm) 0 var(--gap-xs);
    font-family: var(--font-display);
    font-size: 56px;
    font-weight: 600;
    line-height: 1;
    color: var(--seal);
    letter-spacing: -0.03em;
  }

  .hero-skeleton {
    display: inline-block;
    width: 120px;
    height: 56px;
  }

  .hero-note {
    font-size: var(--fs-meta);
    color: var(--ink-faint);
  }
}

.hero-stats {
  display: flex;
  gap: var(--gap-xl);
  margin: 0;
  align-items: flex-end;

  .hs {
    dt {
      margin-bottom: var(--gap-xs);
    }

    dd {
      margin: 0;
      font-size: var(--fs-h3);
      font-weight: 600;
      line-height: 1;
      color: var(--ink);
    }
  }
}

/* ---------------- 双栏 ---------------- */
.dash-cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 268px;
  gap: var(--gap-xl);
  align-items: start;
}

.col {
  min-width: 0;
}

.col-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--gap-md);
  margin-bottom: var(--gap-md);
  padding-bottom: var(--gap-sm);
  border-bottom: 1px solid var(--vellum);

  h2 {
    font-size: var(--fs-h4);
  }

  .col-more {
    font-size: var(--fs-meta);
    color: var(--ink-faint);
    text-decoration: none;

    &:hover {
      color: var(--seal);
      text-decoration: none;
    }
  }
}

.stack {
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);
}

.skeleton-row {
  height: 56px;
}

/* ---------------- 最近记录 ---------------- */
.recent {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.recent-item {
  border-bottom: 1px solid var(--vellum-soft);

  &:last-child {
    border-bottom: 0;
  }
}

.recent-link {
  display: flex;
  flex-direction: column;
  gap: var(--gap-xs);
  padding: var(--gap-md) var(--gap-sm);
  margin: 0 calc(var(--gap-sm) * -1);
  border-radius: var(--r-control);
  text-decoration: none;
  transition: background-color var(--dur-press) var(--ease-out);

  &:hover {
    background: var(--paper-tint);
    text-decoration: none;
  }
}

.recent-text {
  font-size: var(--fs-body);
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-meta {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  font-size: var(--fs-meta);
  color: var(--ink-faint);
  flex-wrap: wrap;
}

.recent-tags {
  color: var(--ink-ghost);
}

/* ---------------- 侧栏 ---------------- */
.col-side {
  display: flex;
  flex-direction: column;
  gap: var(--gap-xl);
}

.taglist {
  display: flex;
  flex-direction: column;
}

.tagrow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap-sm);
  padding: var(--gap-sm) var(--gap-sm);
  margin: 0 calc(var(--gap-sm) * -1);
  border-radius: var(--r-control);
  font-size: var(--fs-body-sm);
  color: var(--ink-soft);
  text-decoration: none;
  transition:
    background-color var(--dur-press) var(--ease-out),
    color var(--dur-press) var(--ease-out);

  &:hover {
    background: var(--paper-tint);
    color: var(--ink);
    text-decoration: none;
  }

  .tagrow-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tagrow-count {
    font-size: var(--fs-meta);
    color: var(--ink-ghost);
  }
}

.quick {
  display: flex;
  flex-direction: column;
  gap: 2px;

  .meta-label {
    margin-bottom: var(--gap-sm);
  }
}

.quick-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap-sm);
  padding: var(--gap-sm) var(--gap-sm);
  margin: 0 calc(var(--gap-sm) * -1);
  border-radius: var(--r-control);
  font-size: var(--fs-body-sm);
  color: var(--ink-soft);
  text-decoration: none;
  transition:
    background-color var(--dur-press) var(--ease-out),
    color var(--dur-press) var(--ease-out);

  &:hover {
    background: var(--paper-tint);
    color: var(--ink);
    text-decoration: none;
  }

  span {
    font-size: var(--fs-caption);
    color: var(--ink-ghost);
  }
}

.side-note {
  font-size: var(--fs-caption);
  color: var(--ink-ghost);
  padding-top: var(--gap-md);
  border-top: 1px solid var(--vellum-soft);
}

@media (max-width: 1000px) {
  .dash-cols {
    grid-template-columns: minmax(0, 1fr);
  }

  .hero-stats {
    gap: var(--gap-lg);
    flex-wrap: wrap;
  }
}
</style>
