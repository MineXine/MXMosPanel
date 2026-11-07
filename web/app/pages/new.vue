<script setup lang="ts">
import type { Attachment, GeoPoint } from '~/types';

const api = useApi();
const auth = useAuth();
const router = useRouter();

const content = ref('');
const visibility = ref<'public' | 'private'>('public');
const attachments = ref<Attachment[]>([]);
const location = ref<GeoPoint | null>(null);
const submitting = ref(false);
const errorMsg = ref('');
const showLocation = ref(false);
const latInput = ref('');
const lngInput = ref('');
const labelInput = ref('');

const route = useRoute();
const editingId = computed(() => (route.params.id as string) || null);
const draftKey = computed(() => (editingId.value ? `edit-${editingId.value}` : 'new-post'));

onMounted(async () => {
  await auth.restore();
  if (!auth.isLoggedIn.value) {
    await router.push('/login');
    return;
  }
  // 编辑模式：载入原内容
  if (editingId.value) {
    try {
      const res = await api.getPost(editingId.value);
      content.value = res.post.content;
      visibility.value = res.post.visibility;
      attachments.value = res.post.attachments;
      location.value = res.post.location;
    } catch (e) {
      errorMsg.value = (e as Error).message;
    }
  }
});

function applyLocation() {
  const lat = Number(latInput.value);
  const lng = Number(lngInput.value);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    errorMsg.value = '请填写有效的经纬度，例如 30.2469。';
    return;
  }
  location.value = { lat, lng, label: labelInput.value || undefined };
  showLocation.value = false;
}

function useCurrentPosition() {
  if (!navigator.geolocation) {
    errorMsg.value = '当前浏览器不支持定位';
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      latInput.value = pos.coords.latitude.toFixed(6);
      lngInput.value = pos.coords.longitude.toFixed(6);
      location.value = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        label: '当前位置',
      };
      showLocation.value = false;
    },
    () => {
      errorMsg.value = '无法获取当前位置，请手动填写经纬度。';
    },
  );
}

async function submit() {
  if (!content.value.trim()) {
    errorMsg.value = '正文不能为空，写点什么再保存。';
    return;
  }
  submitting.value = true;
  errorMsg.value = '';
  try {
    const payload = {
      content: content.value,
      visibility: visibility.value,
      location: location.value ?? undefined,
      attachments: attachments.value,
    };

    if (editingId.value) {
      await api.updatePost(editingId.value, payload);
      await router.push(`/post/${editingId.value}`);
    } else {
      const res = await api.createPost(payload);
      // 发布成功后清理草稿
      await api.deleteDraft(draftKey.value).catch(() => undefined);
      if (import.meta.client) localStorage.removeItem(`shuoshuo.draft.${draftKey.value}`);
      await router.push(`/post/${res.post.id}`);
    }
  } catch (e) {
    errorMsg.value = (e as Error).message;
  } finally {
    submitting.value = false;
  }
}

useHead({ title: (editingId.value ? '编辑记录' : '写一条') + ' · 说说后台' });
</script>

<template>
  <div class="compose-page">
    <div class="page-head">
      <button class="btn btn-quiet btn-sm" @click="router.back()">← 返回</button>
      <div class="head-title">
        <span class="meta-label">内容</span>
        <h1>{{ editingId ? '编辑记录' : '写一条' }}</h1>
      </div>
    </div>

    <PostEditor
      v-model="content"
      v-model:visibility="visibility"
      :draft-key="draftKey"
      @attachments="attachments = $event"
    />

    <!-- 位置 -->
    <div class="location-block sheet">
      <button class="location-toggle" @click="showLocation = !showLocation">
        <span>◈</span>
        <span v-if="location" class="loc-text">
          {{ location.label || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` }}
        </span>
        <span v-else class="loc-text muted">添加位置（可选）</span>
        <span class="toggle-arrow">{{ showLocation ? '▲' : '▼' }}</span>
      </button>

      <Transition name="fade">
        <div v-if="showLocation" class="location-form">
          <div class="loc-row">
            <input v-model="latInput" class="input" placeholder="纬度 lat，如 30.2469" />
            <input v-model="lngInput" class="input" placeholder="经度 lng，如 120.1461" />
          </div>
          <div class="loc-row">
            <input v-model="labelInput" class="input" placeholder="位置名称（可选）" />
            <button class="btn btn-sm" @click="useCurrentPosition">◎ 定位</button>
            <button class="btn btn-seal btn-sm" @click="applyLocation">确定</button>
            <button
              class="btn btn-quiet btn-sm"
              @click="location = null; showLocation = false"
            >
              清除
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <p v-if="errorMsg" class="error-box">{{ errorMsg }}</p>

    <div class="submit-bar">
      <NuxtLink to="/" class="btn btn-quiet">取消</NuxtLink>
      <button class="btn btn-seal" :disabled="submitting || !content.trim()" @click="submit">
        <span v-if="submitting" class="spinner" />
        {{ submitting ? '保存中…' : editingId ? '保存修改' : '保存记录' }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.compose-page {
  display: flex;
  flex-direction: column;
  gap: var(--gap-md);
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
}

.location-block {
  overflow: hidden;
}

.location-toggle {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  width: 100%;
  padding: var(--gap-md) var(--gap-lg);
  font-size: var(--fs-body-sm);
  color: var(--ink-soft);
  background: none;
  border: 0;
  cursor: pointer;
  text-align: left;

  &:hover {
    background: var(--paper-tint);
  }

  .loc-text {
    &.muted {
      color: var(--ink-faint);
    }
  }

  .toggle-arrow {
    margin-left: auto;
    font-size: 10px;
    opacity: 0.5;
  }
}

.location-form {
  padding: var(--gap-md) var(--gap-lg) var(--gap-lg);
  border-top: 1px solid var(--vellum);
  display: flex;
  flex-direction: column;
  gap: var(--gap-sm);

  .loc-row {
    display: flex;
    gap: var(--gap-sm);
    flex-wrap: wrap;
  }

  .input {
    flex: 1;
    min-width: 150px;
  }
}

.error-box {
  padding: var(--gap-md);
  font-size: var(--fs-body-sm);
  color: var(--stamp-bad);
  background: var(--stamp-bad-soft);
  border-radius: var(--r-card);
}

.submit-bar {
  display: flex;
  justify-content: flex-end;
  gap: var(--gap-sm);
  padding-bottom: var(--gap-lg);
}
</style>
