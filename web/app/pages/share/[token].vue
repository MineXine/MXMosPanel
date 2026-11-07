<script setup lang="ts">
import type { Post, ShareLink } from '~/types';

const api = useApi();
const route = useRoute();

const post = ref<Post | null>(null);
const share = ref<ShareLink | null>(null);
const loading = ref(true);
const errorMsg = ref('');

const token = computed(() => route.params.token as string);

async function load() {
  loading.value = true;
  try {
    const res = await api.getSharedPost(token.value);
    post.value = res.post;
    share.value = res.share;
  } catch (e) {
    errorMsg.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);

useHead({ title: '分享的说说' });
</script>

<template>
  <div class="share-page">
    <div class="share-banner">
      <span class="banner-icon">↗</span>
      <div>
        <strong>你正在查看一条分享的说说</strong>
        <small v-if="share?.expiresAt">
          有效期至 {{ new Date(share.expiresAt).toLocaleString('zh-CN') }}
        </small>
        <small v-else>此链接长期有效</small>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <span class="spinner" /> 加载中…
    </div>

    <div v-else-if="errorMsg" class="empty sheet">
      <span class="empty-mark" aria-hidden="true">◑</span>
      <p>{{ errorMsg }}</p>
      <NuxtLink to="/" class="btn btn-sm">回到首页</NuxtLink>
    </div>

    <template v-else-if="post">
      <PostCard :post="post" full />
    </template>
  </div>
</template>

<style scoped lang="scss">
.share-page {
  display: flex;
  flex-direction: column;
  gap: var(--gap-md);
}

.share-banner {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
  padding: var(--gap-md) var(--gap-lg);
  background: var(--seal-soft);
  border: 1px solid var(--seal);
  border-radius: var(--r-card);

  .banner-icon {
    font-size: 20px;
  }

  div {
    display: flex;
    flex-direction: column;
    line-height: 1.4;
  }

  strong {
    font-size: var(--fs-body-sm);
  }

  small {
    font-size: var(--fs-meta);
    color: var(--ink-soft);
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
</style>
