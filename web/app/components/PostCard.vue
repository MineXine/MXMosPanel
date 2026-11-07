<script setup lang="ts">
import type { Post } from '~/types';

const props = defineProps<{
  post: Post;
  /** 是否显示作者信息 */
  showAuthor?: boolean;
  /** 是否显示完整内容（列表视图下截断） */
  full?: boolean;
  /** 紧凑模式：用于管理列表，隐藏部分交互 */
  compact?: boolean;
}>();

const emit = defineEmits<{
  (e: 'changed', post: Post): void;
  (e: 'deleted', id: string): void;
}>();

const auth = useAuth();
const api = useApi();

const showShare = ref(false);
const shareLink = ref('');
const shareLoading = ref(false);
const copied = ref(false);
const menuOpen = ref(false);
const busy = ref(false);
const errorMsg = ref('');
const mounted = ref(false);

onMounted(() => {
  mounted.value = true;
});

const isOwner = computed(() => auth.user.value?.id === props.post.authorId);
const isPrivate = computed(() => props.post.visibility === 'private');
const isArchived = computed(() => props.post.status === 'archived');

const excerpt = computed(() => {
  const text = props.post.plainText || props.post.content;
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
});

const timeText = computed(() => {
  // 相对时间依赖当前时刻，SSR 与客户端水合时可能算出不同结果，
  // 因此水合完成前统一显示绝对日期，避免 hydration 不一致。
  if (!mounted.value) return absoluteTime.value;
  return formatRelative(props.post.createdAt);
});
const absoluteTime = computed(() => formatAbsolute(props.post.createdAt));

const deviceLabel = computed(() => {
  const d = props.post.device;
  if (!d) return '';
  const browser = d.browserVersion ? `${d.browser} ${d.browserVersion.split('.')[0]}` : d.browser;
  if (browser === 'Unknown' && d.os === 'Unknown') return '未知设备';
  return `${d.os} · ${browser}`;
});

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} 天前`;
  return formatAbsolute(iso);
}

function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function toggleLike() {
  if (!auth.isLoggedIn.value) return;
  busy.value = true;
  try {
    const res = await api.toggleLike(props.post.id);
    props.post.liked = res.liked;
    props.post.stats.likes = res.count;
    emit('changed', props.post);
  } catch (e) {
    errorMsg.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}

async function toggleFavorite() {
  if (!auth.isLoggedIn.value) return;
  busy.value = true;
  try {
    const res = await api.toggleFavorite(props.post.id);
    props.post.favorited = res.favorited;
    props.post.stats.favorites = res.count;
    emit('changed', props.post);
  } catch (e) {
    errorMsg.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}

async function createShare() {
  shareLoading.value = true;
  try {
    const res = await api.createShare(props.post.id);
    const origin = import.meta.client ? window.location.origin : '';
    shareLink.value = `${origin}/share/${res.share.token}`;
    props.post.stats.shares = props.post.stats.shares + 1;
  } catch (e) {
    errorMsg.value = (e as Error).message;
  } finally {
    shareLoading.value = false;
  }
}

async function copyShare() {
  if (!shareLink.value) return;
  try {
    await navigator.clipboard.writeText(shareLink.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1800);
  } catch {
    errorMsg.value = '复制失败，请手动选中链接复制。';
  }
}

async function toggleArchive() {
  busy.value = true;
  try {
    const res = isArchived.value
      ? await api.unarchivePost(props.post.id)
      : await api.archivePost(props.post.id);
    props.post.status = res.post.status;
    props.post.archivedAt = res.post.archivedAt;
    emit('changed', props.post);
  } catch (e) {
    errorMsg.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}

async function removePost() {
  if (!confirm('确定删除这条说说？此操作不可恢复。')) return;
  try {
    await api.deletePost(props.post.id);
    emit('deleted', props.post.id);
  } catch (e) {
    errorMsg.value = (e as Error).message;
  }
}
</script>

<template>
  <article class="leaf" :class="{ 'is-private': isPrivate, 'is-archived': isArchived }">
    <header class="leaf-head">
      <NuxtLink v-if="post.author && showAuthor !== false" to="/" class="leaf-author">
        <span class="leaf-avatar" :style="{ background: post.author.avatarColor }">
          {{ post.author.displayName.slice(0, 1) }}
        </span>
        <span class="leaf-author-meta">
          <strong>{{ post.author.displayName }}</strong>
          <time :title="absoluteTime">{{ timeText }}</time>
        </span>
      </NuxtLink>
      <span v-else class="leaf-author">
        <time class="leaf-time" :title="absoluteTime">{{ timeText }}</time>
      </span>

      <!-- 印记：可见性与状态 -->
      <div class="leaf-stamps">
        <span v-if="isPrivate" class="stamp stamp-private">私密</span>
        <span v-else class="stamp stamp-open">公开</span>
        <span v-if="isArchived" class="stamp stamp-archived">已封存</span>
      </div>

      <div class="leaf-menu">
        <button
          class="btn btn-quiet btn-icon btn-sm"
          aria-label="更多操作"
          @click="menuOpen = !menuOpen"
        >
          ⋯
        </button>
        <Transition name="fade">
          <div v-if="menuOpen" class="menu">
            <NuxtLink :to="`/post/${post.id}`" class="menu-item" @click="menuOpen = false">
              查看详情
            </NuxtLink>
            <NuxtLink :to="`/new?id=${post.id}`" class="menu-item" @click="menuOpen = false">
              编辑
            </NuxtLink>
            <button v-if="isOwner" class="menu-item" @click="toggleArchive(); menuOpen = false">
              {{ isArchived ? '恢复' : '封存' }}
            </button>
            <button v-if="isOwner" class="menu-item danger" @click="removePost(); menuOpen = false">
              删除
            </button>
          </div>
        </Transition>
      </div>
    </header>

    <!-- 正文 -->
    <div class="leaf-body">
      <MarkdownContent
        v-if="full || excerpt.length < 160"
        :content="post.content"
        :mdc-options="post.mdcOptions"
      />
      <template v-else>
        <MarkdownContent :content="post.content" class="clamp" />
        <NuxtLink :to="`/post/${post.id}`" class="leaf-more">展开全文 →</NuxtLink>
      </template>
    </div>

    <!-- 附件 -->
    <div v-if="post.attachments.length" class="leaf-media">
      <figure v-for="att in post.attachments" :key="att.id" class="leaf-media-item">
        <img v-if="att.kind === 'image'" :src="att.url" :alt="att.filename" loading="lazy" />
        <video v-else-if="att.kind === 'video'" :src="att.url" controls />
        <audio v-else-if="att.kind === 'audio'" :src="att.url" controls />
        <a v-else :href="att.url" target="_blank" rel="noopener">{{ att.filename }}</a>
      </figure>
    </div>

    <!-- 位置与标签 -->
    <div v-if="post.location || post.tags.length" class="leaf-meta">
      <NuxtLink v-if="post.location" to="/map" class="leaf-loc">
        <span aria-hidden="true">◈</span>
        <span>{{ post.location.label || `${post.location.lat.toFixed(4)}, ${post.location.lng.toFixed(4)}` }}</span>
      </NuxtLink>
      <span class="leaf-tags">
        <NuxtLink v-for="tag in post.tags" :key="tag" :to="`/tags?tag=${tag}`" class="leaf-tag">
          #{{ tag }}
        </NuxtLink>
      </span>
    </div>

    <div v-if="deviceLabel" class="leaf-device" :title="post.device?.ua">{{ deviceLabel }}</div>

    <!-- 操作条 -->
    <footer class="leaf-actions">
      <button
        class="act"
        :class="{ on: post.liked }"
        :disabled="busy"
        :aria-pressed="post.liked"
        aria-label="点赞"
        @click="toggleLike"
      >
        <span aria-hidden="true">{{ post.liked ? '♥' : '♡' }}</span>
        <span v-if="post.stats.likes" class="tabular">{{ post.stats.likes }}</span>
      </button>

      <button
        class="act"
        :class="{ on: post.favorited }"
        :disabled="busy"
        :aria-pressed="post.favorited"
        aria-label="收藏"
        @click="toggleFavorite"
      >
        <span aria-hidden="true">{{ post.favorited ? '✦' : '✧' }}</span>
        <span v-if="post.stats.favorites" class="tabular">{{ post.stats.favorites }}</span>
      </button>

      <button class="act" aria-label="生成分享链接" @click="showShare = !showShare">
        <span aria-hidden="true">↗</span>
        <span v-if="post.stats.shares" class="tabular">{{ post.stats.shares }}</span>
      </button>

      <NuxtLink v-if="!compact" :to="`/post/${post.id}`" class="act" aria-label="查看详情">
        <span aria-hidden="true">›</span>
      </NuxtLink>

      <button v-if="isOwner" class="act act-end" aria-label="封存或恢复" @click="toggleArchive">
        <span aria-hidden="true">{{ isArchived ? '↺' : '▤' }}</span>
        <span class="act-text">{{ isArchived ? '恢复' : '封存' }}</span>
      </button>
    </footer>

    <!-- 分享面板 -->
    <Transition name="fade">
      <div v-if="showShare" class="share">
        <div class="share-head">
          <strong>分享这条说说</strong>
          <button class="btn btn-quiet btn-icon btn-sm" aria-label="关闭" @click="showShare = false">
            ✕
          </button>
        </div>

        <div v-if="!shareLink" class="share-body">
          <p class="share-hint">生成一个公开访问链接，任何拿到链接的人都可以查看这条说说。</p>
          <button class="btn btn-seal btn-sm" :disabled="shareLoading" @click="createShare">
            <span v-if="shareLoading" class="spinner" />
            {{ shareLoading ? '生成中…' : '生成分享链接' }}
          </button>
        </div>

        <div v-else class="share-body">
          <div class="share-link">
            <input :value="shareLink" readonly class="input" @focus="($event.target as HTMLInputElement).select()" />
          </div>
          <div class="share-ops">
            <button class="btn btn-seal btn-sm" @click="copyShare">
              {{ copied ? '✓ 已复制' : '复制链接' }}
            </button>
            <button class="btn btn-sm" @click="shareLink = ''">重新生成</button>
            <a :href="shareLink" target="_blank" rel="noopener" class="btn btn-sm">打开</a>
          </div>
        </div>
      </div>
    </Transition>

    <p v-if="errorMsg" class="leaf-error">{{ errorMsg }}</p>
  </article>
</template>

<style scoped lang="scss">
/* 墨迹纸片：抬起的纸面 + 极轻的影 */
.leaf {
  position: relative;
  padding: var(--gap-lg) var(--gap-xl);
  margin-bottom: var(--gap-md);
  background: var(--paper-raised);
  border-radius: var(--r-card);
  box-shadow: var(--lift-card);
  transition: box-shadow var(--dur-pop) var(--ease-out);

  &:hover {
    box-shadow: var(--lift-pop);
  }

  // 私密：左缘一道靛青封边，而不是整块染色
  &.is-private {
    box-shadow:
      var(--lift-card),
      inset 3px 0 0 var(--stamp-info);
  }

  // 封存：褪色的纸，压低存在感
  &.is-archived {
    background: var(--paper);
    opacity: 0.72;
  }
}

.leaf-head {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
  margin-bottom: var(--gap-md);
}

.leaf-author {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  min-width: 0;
  color: inherit;
  text-decoration: none;

  &:hover {
    text-decoration: none;
  }

  .leaf-avatar {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    flex-shrink: 0;
    font-size: var(--fs-meta);
    font-weight: 600;
    color: var(--seal-ink);
    background: var(--seal);
    border-radius: 50%;
  }

  .leaf-author-meta {
    display: flex;
    align-items: baseline;
    gap: var(--gap-sm);
    min-width: 0;

    strong {
      font-size: var(--fs-body-sm);
      font-weight: 550;
    }

    time {
      font-size: var(--fs-meta);
      color: var(--ink-faint);
    }
  }

  .leaf-time {
    font-size: var(--fs-meta);
    color: var(--ink-faint);
  }
}

.leaf-stamps {
  display: flex;
  gap: var(--gap-xs);
  margin-left: auto;
}

.leaf-menu {
  position: relative;
}

.menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 10;
  min-width: 128px;
  padding: var(--gap-xs);
  background: var(--paper-high);
  border-radius: var(--r-card);
  box-shadow: var(--lift-pop);

  .menu-item {
    display: block;
    width: 100%;
    padding: var(--gap-sm) var(--gap-md);
    font-size: var(--fs-body-sm);
    text-align: left;
    color: var(--ink-soft);
    background: none;
    border: 0;
    border-radius: var(--r-control);
    cursor: pointer;
    text-decoration: none;

    &:hover {
      background: var(--paper-tint);
      color: var(--ink);
      text-decoration: none;
    }

    &.danger {
      color: var(--stamp-bad);

      &:hover {
        background: var(--stamp-bad-soft);
      }
    }
  }
}

.leaf-body {
  :deep(.clamp) {
    display: -webkit-box;
    -webkit-line-clamp: 6;
    line-clamp: 6;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}

.leaf-more {
  display: inline-block;
  margin-top: var(--gap-xs);
  font-size: var(--fs-body-sm);
  color: var(--seal);
}

.leaf-media {
  display: grid;
  gap: var(--gap-sm);
  margin-top: var(--gap-md);
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));

  .leaf-media-item {
    margin: 0;
    overflow: hidden;
    background: var(--paper-inset);
    border-radius: var(--r-control);

    img,
    video {
      width: 100%;
      max-height: 240px;
      object-fit: cover;
    }

    a {
      display: block;
      padding: var(--gap-md);
      font-size: var(--fs-body-sm);
    }
  }
}

.leaf-meta {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
  margin-top: var(--gap-md);
  flex-wrap: wrap;
}

.leaf-loc {
  display: inline-flex;
  align-items: center;
  gap: var(--gap-xs);
  font-size: var(--fs-meta);
  color: var(--stamp-info);
  text-decoration: none;

  &:hover {
    color: var(--stamp-info);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
}

.leaf-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--gap-sm);
}

.leaf-tag {
  font-size: var(--fs-meta);
  color: var(--ink-faint);
  text-decoration: none;

  &:hover {
    color: var(--seal);
    text-decoration: none;
  }
}

.leaf-device {
  margin-top: var(--gap-sm);
  font-size: var(--fs-caption);
  color: var(--ink-ghost);
  cursor: help;
}

.leaf-actions {
  display: flex;
  align-items: center;
  gap: var(--gap-xs);
  margin-top: var(--gap-md);
  padding-top: var(--gap-sm);
  border-top: 1px solid var(--vellum-soft);
}

.act {
  display: inline-flex;
  align-items: center;
  gap: var(--gap-xs);
  padding: var(--gap-xs) var(--gap-sm);
  min-height: 28px;
  font-size: var(--fs-body-sm);
  color: var(--ink-faint);
  background: none;
  border: 0;
  border-radius: var(--r-control);
  cursor: pointer;
  text-decoration: none;
  transition:
    background-color var(--dur-press) var(--ease-out),
    color var(--dur-press) var(--ease-out),
    transform var(--dur-press) var(--ease-out);

  &:hover:not(:disabled) {
    background: var(--paper-tint);
    color: var(--ink);
    text-decoration: none;
  }

  &:active:not(:disabled) {
    transform: scale(0.97);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.on {
    color: var(--seal);
  }

  .act-text {
    font-size: var(--fs-meta);
  }
}

.act-end {
  margin-left: auto;
}

.share {
  margin-top: var(--gap-md);
  padding: var(--gap-md);
  background: var(--paper-tint);
  border-radius: var(--r-control);
}

.share-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--gap-sm);
  font-size: var(--fs-body-sm);
}

.share-body {
  .share-hint {
    margin-bottom: var(--gap-sm);
    font-size: var(--fs-meta);
    color: var(--ink-faint);
  }

  .share-link {
    margin-bottom: var(--gap-sm);
  }

  .share-ops {
    display: flex;
    gap: var(--gap-sm);
    flex-wrap: wrap;
  }
}

.leaf-error {
  margin-top: var(--gap-sm);
  font-size: var(--fs-meta);
  color: var(--stamp-bad);
}
</style>
