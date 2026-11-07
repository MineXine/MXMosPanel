<script setup lang="ts">
import type { DashboardStats } from '~/types';

const api = useApi();
const auth = useAuth();
const router = useRouter();

const stats = ref<DashboardStats | null>(null);
const device = ref<import('~/types').DeviceInfo | null>(null);
const displayName = ref('');
const bio = ref('');
const avatarColor = ref('#6366f1');
const saving = ref(false);
const showUa = ref(false);
const message = ref('');

/** 头像色板：与设计系统同源的暖色系，不引入彩虹色 */
const COLORS = [
  '#8c4a2e', // 朱砂
  '#a06a34', // 赭石
  '#6d513a', // 棕褐
  '#4a7c48', // 松绿
  '#2f6d8f', // 靛青
  '#55504a', // 陈墨
  '#8a837a', // 淡墨
  '#1f1d1a', // 浓墨
];

async function load() {
  if (!auth.isLoggedIn.value) {
    await router.push('/login');
    return;
  }
  try {
    const [s, d] = await Promise.all([api.stats(), api.device()]);
    stats.value = s.stats;
    device.value = d.device;
  } catch {
    /* 忽略 */
  }
}

async function save() {
  saving.value = true;
  message.value = '';
  try {
    await auth.updateProfile({
      displayName: displayName.value,
      bio: bio.value,
      avatarColor: avatarColor.value,
    });
    message.value = '✓ 资料已保存';
  } catch (e) {
    message.value = (e as Error).message;
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await auth.restore();
  if (auth.user.value) {
    displayName.value = auth.user.value.displayName;
    bio.value = auth.user.value.bio;
    avatarColor.value = auth.user.value.avatarColor;
  }
  await load();
});

useHead({ title: '账号设置 · 说说后台' });
</script>

<template>
  <div class="settings-page">
    <div class="page-title">
      <span class="meta-label">系统</span>
      <h1>账号设置</h1>
    </div>

    <!-- 数据条：一行一项，不做卡片网格 -->
    <dl class="stats-sheet sheet">
      <div class="stat-row">
        <dt>总记录</dt>
        <dd class="tabular">{{ stats?.total ?? 0 }}</dd>
      </div>
      <div class="stat-row">
        <dt>已发布</dt>
        <dd class="tabular">{{ stats?.published ?? 0 }}</dd>
      </div>
      <div class="stat-row">
        <dt>已封存</dt>
        <dd class="tabular">{{ stats?.archived ?? 0 }}</dd>
      </div>
      <div class="stat-row">
        <dt>私密</dt>
        <dd class="tabular">{{ stats?.privateCount ?? 0 }}</dd>
      </div>
      <div class="stat-row">
        <dt>获赞</dt>
        <dd class="tabular">{{ stats?.totalLikes ?? 0 }}</dd>
      </div>
      <div class="stat-row">
        <dt>被收藏</dt>
        <dd class="tabular">{{ stats?.totalFavorites ?? 0 }}</dd>
      </div>
      <div class="stat-row">
        <dt>带位置</dt>
        <dd class="tabular">{{ stats?.withLocation ?? 0 }}</dd>
      </div>
      <div class="stat-row">
        <dt>附件</dt>
        <dd class="tabular">{{ stats?.mediaCount ?? 0 }}</dd>
      </div>
    </dl>

    <div class="sheet profile-card">
      <h2>个人资料</h2>

      <div class="field">
        <label>昵称</label>
        <input v-model="displayName" class="input" placeholder="显示在记录上" />
      </div>

      <div class="field">
        <label>简介</label>
        <textarea v-model="bio" class="textarea" rows="3" placeholder="一句话介绍自己（可选）" />
      </div>

      <div class="field">
        <label>头像颜色</label>
        <div class="color-picker">
          <button
            v-for="c in COLORS"
            :key="c"
            class="color-dot"
            :class="{ active: avatarColor === c }"
            :style="{ background: c }"
            type="button"
            :aria-label="`选择头像颜色 ${c}`"
            :aria-pressed="avatarColor === c"
            @click="avatarColor = c"
          />
        </div>
      </div>

      <button class="btn btn-seal" :disabled="saving" @click="save">
        <span v-if="saving" class="spinner" />
        保存资料
      </button>

      <p v-if="message" class="save-msg">{{ message }}</p>
    </div>

    <div class="sheet device-card">
      <h2>当前设备</h2>
      <p class="section-note">记录发布这条内容时使用的设备。</p>
      <dl v-if="device" class="device-list">
        <div>
          <dt>浏览器</dt>
          <dd>{{ device.browser }} {{ device.browserVersion }}</dd>
        </div>
        <div>
          <dt>操作系统</dt>
          <dd>{{ device.os }} {{ device.osVersion }}</dd>
        </div>
        <div>
          <dt>设备类型</dt>
          <dd>{{ device.deviceType }}</dd>
        </div>
        <div>
          <dt>厂商</dt>
          <dd>{{ device.deviceVendor || '-' }}</dd>
        </div>
        <div v-if="showUa">
          <dt>UA</dt>
          <dd class="ua">{{ device.ua }}</dd>
        </div>
      </dl>

      <button class="btn btn-quiet btn-sm" @click="showUa = !showUa">
        {{ showUa ? '隐藏 UA' : '显示 UA' }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.settings-page {
  display: flex;
  flex-direction: column;
  gap: var(--gap-lg);

  h1 {
    margin: 0;
    font-size: var(--fs-h2);
  }
}

// 数据条：两列定义列表，比卡片网格安静
.stats-sheet {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0;
  overflow: hidden;
  padding: 0;
}

.stat-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--gap-md);
  padding: var(--gap-md) var(--gap-lg);
  border-right: 1px solid var(--vellum-soft);
  border-bottom: 1px solid var(--vellum-soft);

  dt {
    font-size: var(--fs-meta);
    color: var(--ink-faint);
  }

  dd {
    margin: 0;
    font-size: var(--fs-h4);
    font-weight: 600;
    color: var(--ink);
  }
}

.profile-card,
.device-card {
  padding: var(--gap-lg);
  display: flex;
  flex-direction: column;
  gap: var(--gap-md);

  h2 {
    margin: 0;
    font-size: var(--fs-body);
  }
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--gap-xs);

  label {
    font-size: var(--fs-meta);
    font-weight: 550;
    color: var(--ink-soft);
  }
}

.color-picker {
  display: flex;
  gap: var(--gap-sm);
  flex-wrap: wrap;
}

.color-dot {
  width: 28px;
  height: 28px;
  border: 2px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  transition: all var(--dur-press) var(--ease-out);

  &:hover {
    transform: scale(1.12);
  }

  &.active {
    border-color: var(--ink);
    transform: scale(1.12);
  }
}

.save-msg {
  margin: 0;
  font-size: var(--fs-meta);
  color: var(--stamp-good);
}

.section-note {
  margin: calc(var(--gap-sm) * -1) 0 0;
  font-size: var(--fs-meta);
  color: var(--ink-faint);
}

.device-list {
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
    width: 90px;
    flex-shrink: 0;
    color: var(--ink-faint);
  }

  dd {
    margin: 0;
    color: var(--ink-soft);
    word-break: break-all;
  }

  .ua {
    font-family: ui-monospace, monospace;
    font-size: var(--fs-meta);
  }
}
</style>
