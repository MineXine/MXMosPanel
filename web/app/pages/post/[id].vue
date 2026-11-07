<script setup lang="ts">
import type { Post, User } from '~/types';

const api = useApi();
const auth = useAuth();
const route = useRoute();
const router = useRouter();

const post = ref<Post | null>(null);
const likers = ref<User[]>([]);
const loading = ref(true);
const errorMsg = ref('');

const postId = computed(() => route.params.id as string);

async function load() {
  loading.value = true;
  try {
    const res = await api.getPost(postId.value);
    post.value = res.post;
    try {
      const l = await api.listLikers(postId.value);
      likers.value = l.users;
    } catch {
      /* 点赞列表失败不阻塞 */
    }
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

useHead({ title: (post.value?.plainText?.slice(0, 30) || '记录详情') + ' · 说说后台' });
</script>

<template>
  <div class="detail-page">
    <header class="detail-head">
      <button class="btn btn-quiet btn-sm" @click="router.back()">← 返回</button>
    </header>

    <div v-if="loading" class="loading-state">
      <span class="spinner" /> 加载中…
    </div>

    <div v-else-if="errorMsg" class="empty sheet">
      <span class="empty-mark" aria-hidden="true">✕</span>
      <p>{{ errorMsg }}</p>
      <NuxtLink to="/" class="btn btn-seal btn-sm empty-action">回到概览</NuxtLink>
    </div>

    <template v-else-if="post">
      <PostCard :post="post" full />

      <!-- 点赞用户 -->
      <div v-if="likers.length" class="sheet likers">
        <h3>被点赞的人（{{ likers.length }}）</h3>
        <div class="liker-list">
          <span v-for="u in likers" :key="u.id" class="liker" :title="u.displayName">
            {{ u.displayName.slice(0, 1) }}
          </span>
        </div>
      </div>

      <!-- 元信息 -->
      <div class="sheet meta-card">
        <h3>记录信息</h3>
        <dl class="meta-list">
          <div>
            <dt>发布时间</dt>
            <dd>{{ new Date(post.createdAt).toLocaleString('zh-CN') }}</dd>
          </div>
          <div v-if="post.updatedAt !== post.createdAt">
            <dt>最后编辑</dt>
            <dd>{{ new Date(post.updatedAt).toLocaleString('zh-CN') }}</dd>
          </div>
          <div>
            <dt>可见性</dt>
            <dd>{{ post.visibility === 'private' ? '◑ 私密' : '◉ 公开' }}</dd>
          </div>
          <div>
            <dt>状态</dt>
            <dd>{{ post.status === 'archived' ? '▤ 已封存' : '◉ 已发布' }}</dd>
          </div>
          <div v-if="post.device">
            <dt>发布设备</dt>
            <dd>
              {{ post.device.browser }} {{ post.device.browserVersion }} ·
              {{ post.device.os }} {{ post.device.osVersion }} ·
              {{ post.device.deviceType }}
            </dd>
          </div>
          <div v-if="post.location">
            <dt>位置</dt>
            <dd>
              {{ post.location.label || '-' }}
              （{{ post.location.lat.toFixed(4) }}, {{ post.location.lng.toFixed(4) }}）
            </dd>
          </div>
          <div>
            <dt>互动</dt>
            <dd>
              ♥ {{ post.stats.likes }} · ✦ {{ post.stats.favorites }} · ↗
              {{ post.stats.shares }}
            </dd>
          </div>
          <div v-if="post.mdcOptions.length">
            <dt>组件选项</dt>
            <dd>
              <span v-for="m in post.mdcOptions" :key="m.name" class="mdc-chip">
                ::{{ m.name }}
                <em>{{ Object.entries(m.props).map(([k, v]) => `${k}=${v}`).join(' ') }}</em>
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <div v-if="post.authorId === auth.user.value?.id" class="owner-actions">
        <NuxtLink :to="`/new?id=${post.id}`" class="btn btn-seal">编辑这条记录</NuxtLink>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.detail-page {
  display: flex;
  flex-direction: column;
  gap: var(--gap-md);
}

.back-btn {
  align-self: flex-start;
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

.likers,
.meta-card {
  padding: var(--gap-lg);

  h3 {
    margin-bottom: var(--gap-md);
    font-size: var(--fs-body-sm);
    color: var(--ink-soft);
  }
}

.liker-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--gap-xs);
}

.liker {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  font-size: var(--fs-meta);
  font-weight: 600;
  color: var(--seal-ink);
  background: var(--seal);
  border-radius: 50%;
}

.meta-list {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);

  > div {
    display: flex;
    gap: var(--gap-md);
    font-size: var(--fs-body-sm);
  }

  dt {
    flex-shrink: 0;
    width: 80px;
    color: var(--ink-faint);
  }

  dd {
    margin: 0;
    color: var(--ink-soft);
    word-break: break-word;
  }
}

.mdc-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--gap-xs);
  margin: 2px;
  padding: 2px var(--gap-sm);
  font-family: ui-monospace, monospace;
  font-size: var(--fs-meta);
  color: var(--seal);
  background: var(--seal-soft);
  border-radius: var(--r-control);

  em {
    font-style: normal;
    color: var(--ink-faint);
  }
}

.owner-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
