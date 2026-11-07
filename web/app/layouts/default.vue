<script setup lang="ts">
import type { DeviceInfo } from '~/types';

const theme = useTheme();
const auth = useAuth();
const api = useApi();

const router = useRouter();
const route = useRoute();

const keyword = ref('');
const deviceInfo = ref<DeviceInfo | null>(null);
const mobileNavOpen = ref(false);
const showThemePanel = ref(false);
const showUserPanel = ref(false);

/** 后台导航：按「管理动作」分组，而非按社交功能罗列 */
const NAV_GROUPS = [
  {
    label: '总览',
    items: [{ to: '/', icon: '◲', label: '概览' }],
  },
  {
    label: '内容',
    items: [
      { to: '/posts', icon: '≡', label: '记录管理' },
      { to: '/new', icon: '✎', label: '写一条' },
      { to: '/archive', icon: '▤', label: '封存库' },
      { to: '/favorites', icon: '✦', label: '书签' },
    ],
  },
  {
    label: '梳理',
    items: [
      { to: '/search', icon: '⌕', label: '检索' },
      { to: '/tags', icon: '#', label: '标签体系' },
      { to: '/calendar', icon: '▦', label: '日历' },
      { to: '/map', icon: '◈', label: '足迹' },
      { to: '/views', icon: '◐', label: '视图' },
    ],
  },
];

const allItems = computed(() => NAV_GROUPS.flatMap((g) => g.items));

const isActive = (to: string) =>
  to === '/' ? route.path === '/' : route.path === to || route.path.startsWith(`${to}/`);

async function doSearch() {
  const q = keyword.value.trim();
  if (!q) return;
  await router.push({ path: '/search', query: { q } });
}

function toggleThemePanel() {
  showThemePanel.value = !showThemePanel.value;
  showUserPanel.value = false;
}

async function logout() {
  auth.logout();
  showUserPanel.value = false;
  await router.push('/login');
}

onMounted(async () => {
  theme.init();
  await auth.restore();
  if (auth.isLoggedIn.value) {
    try {
      const res = await api.device();
      deviceInfo.value = res.device;
    } catch {
      /* 忽略 */
    }
  }
});
</script>

<template>
  <div class="shell">
    <!-- 侧栏：与画布同底色，仅用一道描图纸分隔 -->
    <aside class="rail">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">说</span>
        <div class="brand-text">
          <strong>说说后台</strong>
          <small>私人手账</small>
        </div>
      </div>

      <nav class="rail-nav" aria-label="主导航">
        <div v-for="group in NAV_GROUPS" :key="group.label" class="nav-group">
          <span class="nav-group-label">{{ group.label }}</span>
          <NuxtLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            class="nav-item"
            :class="{ on: isActive(item.to) }"
          >
            <span class="nav-icon" aria-hidden="true">{{ item.icon }}</span>
            <span class="nav-text">{{ item.label }}</span>
          </NuxtLink>
        </div>
      </nav>

      <div class="rail-foot">
        <button class="btn btn-seal btn-block" @click="router.push('/new')">
          <span aria-hidden="true">✎</span> 写一条
        </button>

        <div class="who" @click="showUserPanel = !showUserPanel">
          <template v-if="auth.user.value">
            <span class="who-avatar" :style="{ background: auth.user.value.avatarColor }">
              {{ auth.user.value.displayName.slice(0, 1) }}
            </span>
            <span class="who-meta">
              <strong>{{ auth.user.value.displayName }}</strong>
              <small>@{{ auth.user.value.username }}</small>
            </span>
          </template>
          <template v-else>
            <span class="who-avatar">?</span>
            <span class="who-meta">
              <strong>未登录</strong>
              <small>点击登录</small>
            </span>
          </template>
        </div>

        <Transition name="fade">
          <div v-if="showUserPanel" class="pop pop-who">
            <template v-if="auth.user.value">
              <button class="pop-item" @click="router.push('/settings'); showUserPanel = false">
                ⚙ 账号设置
              </button>
              <button class="pop-item danger" @click="logout">⏻ 退出登录</button>
            </template>
            <template v-else>
              <button class="pop-item" @click="router.push('/login'); showUserPanel = false">
                ⌸ 登录
              </button>
            </template>
          </div>
        </Transition>
      </div>
    </aside>

    <div class="stage">
      <!-- 顶栏：管理工具条 -->
      <header class="bar">
        <button
          class="btn btn-quiet btn-icon nav-toggle"
          aria-label="打开导航"
          @click="mobileNavOpen = !mobileNavOpen"
        >
          ☰
        </button>

        <form class="bar-search" role="search" @submit.prevent="doSearch">
          <span class="bar-search-icon" aria-hidden="true">⌕</span>
          <input
            v-model="keyword"
            class="bar-search-input"
            type="search"
            placeholder="检索正文与标签…"
            aria-label="检索正文与标签"
          />
        </form>

        <div class="bar-tools">
          <span class="bar-path">{{ route.meta.title || '概览' }}</span>
          <button
            class="btn btn-quiet btn-icon"
            aria-label="外观设置"
            title="外观"
            @click="toggleThemePanel"
          >
            ◐
          </button>
        </div>

        <Transition name="fade">
          <div v-if="showThemePanel" class="pop pop-theme">
            <span class="meta-label pop-title">外观</span>

            <div class="theme-block">
              <span class="theme-label">明暗</span>
              <div class="theme-row">
                <button
                  v-for="s in THEME_SCHEMES"
                  :key="s.value"
                  class="theme-pick"
                  :class="{ on: theme.state.value.scheme === s.value }"
                  @click="theme.setScheme(s.value)"
                >
                  {{ s.label }}
                </button>
              </div>
            </div>

            <div class="theme-block">
              <span class="theme-label">印泥色</span>
              <div class="theme-row">
                <button
                  v-for="a in THEME_ACCENTS"
                  :key="a.value"
                  class="seal-swatch"
                  :class="{ on: theme.state.value.accent === a.value }"
                  :style="{ background: a.swatch }"
                  :title="a.label"
                  :aria-label="`强调色 ${a.label}`"
                  @click="theme.setAccent(a.value)"
                />
              </div>
            </div>

            <div v-if="deviceInfo" class="device">
              <span aria-hidden="true">◐</span>
              <span>{{ deviceInfo.browser }} {{ deviceInfo.browserVersion }}</span>
            </div>
          </div>
        </Transition>
      </header>

      <main class="stage-body">
        <NuxtPage />
      </main>
    </div>

    <!-- 移动端导航 -->
    <Transition name="fade">
      <div v-if="mobileNavOpen" class="nav-mask" @click="mobileNavOpen = false" />
    </Transition>
    <nav class="tabbar" :class="{ open: mobileNavOpen }" aria-label="移动端导航">
      <NuxtLink
        v-for="item in allItems"
        :key="item.to"
        :to="item.to"
        class="tab"
        :class="{ on: isActive(item.to) }"
        @click="mobileNavOpen = false"
      >
        <span aria-hidden="true">{{ item.icon }}</span>
        <small>{{ item.label }}</small>
      </NuxtLink>
    </nav>
  </div>
</template>

<style scoped lang="scss">
.shell {
  display: flex;
  min-height: 100dvh;
}

/* ---------------- 侧栏 ---------------- */
.rail {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  width: var(--rail-w);
  padding: var(--gap-lg) var(--gap-md);
  // 与画布同底色：不同底色会把空间割裂成「侧栏世界」和「内容世界」
  background: var(--paper);
  border-right: 1px solid var(--vellum);
}

.brand {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
  padding: 0 var(--gap-sm) var(--gap-xl);

  .brand-mark {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 600;
    color: var(--seal-ink);
    background: var(--seal);
    border-radius: var(--r-control);
  }

  .brand-text {
    display: flex;
    flex-direction: column;
    line-height: 1.3;

    strong {
      font-family: var(--font-display);
      font-size: var(--fs-h4);
      font-weight: 600;
    }

    small {
      font-size: var(--fs-caption);
      color: var(--ink-faint);
      letter-spacing: 0.06em;
    }
  }
}

.rail-nav {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--gap-lg);
}

.nav-group {
  display: flex;
  flex-direction: column;
  gap: 1px;

  .nav-group-label {
    padding: 0 var(--gap-sm) var(--gap-sm);
    font-size: var(--fs-caption);
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--ink-ghost);
  }
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
  padding: var(--gap-sm) var(--gap-sm);
  font-size: var(--fs-body-sm);
  font-weight: 450;
  color: var(--ink-soft);
  border-radius: var(--r-control);
  text-decoration: none;
  transition:
    background-color var(--dur-press) var(--ease-out),
    color var(--dur-press) var(--ease-out);

  &:hover {
    background: var(--paper-tint);
    color: var(--ink);
    text-decoration: none;
  }

  &.on {
    background: var(--seal-soft);
    color: var(--seal);
    font-weight: 550;
  }

  .nav-icon {
    width: 16px;
    font-size: 13px;
    text-align: center;
    opacity: 0.85;
  }

  .nav-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.rail-foot {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--gap-md);
  padding-top: var(--gap-lg);
  border-top: 1px solid var(--vellum);
}

.btn-block {
  width: 100%;
  height: 36px;
}

.who {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
  padding: var(--gap-sm);
  cursor: pointer;
  border-radius: var(--r-control);
  transition: background-color var(--dur-press) var(--ease-out);

  &:hover {
    background: var(--paper-tint);
  }

  .who-avatar {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    font-size: var(--fs-meta);
    font-weight: 600;
    color: var(--seal-ink);
    background: var(--seal);
    border-radius: 50%;
  }

  .who-meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.35;

    strong {
      font-size: var(--fs-body-sm);
      font-weight: 550;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    small {
      font-size: var(--fs-caption);
      color: var(--ink-faint);
    }
  }
}

/* ---------------- 顶栏 ---------------- */
.stage {
  flex: 1;
  margin-left: var(--rail-w);
  min-width: 0;
}

.bar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: var(--gap-md);
  height: var(--bar-h);
  padding: 0 var(--gap-xl);
  background: color-mix(in srgb, var(--paper) 88%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--vellum);
}

.bar-search {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  width: 100%;
  max-width: 320px;
  height: 30px;
  padding: 0 var(--gap-md);
  background: var(--paper-inset);
  border: 1px solid var(--vellum-soft);
  border-radius: var(--r-control);
  transition:
    border-color var(--dur-press) var(--ease-out),
    box-shadow var(--dur-press) var(--ease-out);

  &:focus-within {
    border-color: var(--seal);
    box-shadow: 0 0 0 3px var(--seal-soft);
  }

  .bar-search-icon {
    font-size: 13px;
    color: var(--ink-faint);
  }

  .bar-search-input {
    flex: 1;
    min-width: 0;
    font-size: var(--fs-body-sm);
    background: transparent;
    border: 0;
    outline: none;

    &::-webkit-search-cancel-button {
      display: none;
    }
  }
}

.bar-tools {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
  margin-left: auto;
}

.bar-path {
  font-size: var(--fs-meta);
  color: var(--ink-faint);
  letter-spacing: 0.04em;
}

.nav-toggle {
  display: none;
}

.stage-body {
  padding: var(--gap-xl) var(--gap-xl) var(--gap-3xl);
  max-width: calc(var(--measure) + var(--gap-xl) * 2);
  margin: 0 auto;
}

/* ---------------- 弹层 ---------------- */
.pop {
  position: absolute;
  top: calc(var(--bar-h) - 6px);
  right: var(--gap-xl);
  z-index: 40;
  min-width: 208px;
  padding: var(--gap-md);
  background: var(--paper-high);
  border-radius: var(--r-card);
  box-shadow: var(--lift-pop);

  .pop-title {
    display: block;
    padding-bottom: var(--gap-sm);
    margin-bottom: var(--gap-md);
    border-bottom: 1px solid var(--vellum);
  }

  .pop-item {
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
    transition: background-color var(--dur-press) var(--ease-out);

    &:hover {
      background: var(--paper-tint);
      color: var(--ink);
    }

    &.danger {
      color: var(--stamp-bad);

      &:hover {
        background: var(--stamp-bad-soft);
      }
    }
  }
}

.pop-who {
  top: auto;
  bottom: 68px;
  left: var(--gap-md);
  right: var(--gap-md);
  min-width: 0;
}

.theme-block {
  margin-bottom: var(--gap-lg);

  .theme-label {
    display: block;
    margin-bottom: var(--gap-sm);
    font-size: var(--fs-caption);
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--ink-faint);
  }
}

.theme-row {
  display: flex;
  gap: var(--gap-xs);
  flex-wrap: wrap;
}

.theme-pick {
  flex: 1;
  padding: var(--gap-sm) var(--gap-xs);
  font-size: var(--fs-meta);
  color: var(--ink-soft);
  background: var(--paper-tint);
  border: 1px solid transparent;
  border-radius: var(--r-control);
  cursor: pointer;
  transition: all var(--dur-press) var(--ease-out);

  &:hover {
    border-color: var(--vellum-strong);
  }

  &.on {
    background: var(--seal-soft);
    color: var(--seal);
    border-color: var(--seal);
    font-weight: 550;
  }
}

.seal-swatch {
  width: 22px;
  height: 22px;
  border: 2px solid transparent;
  border-radius: 50%;
  cursor: pointer;
  transition:
    transform var(--dur-press) var(--ease-out),
    border-color var(--dur-press) var(--ease-out);

  &:hover {
    transform: scale(1.14);
  }

  &.on {
    border-color: var(--ink);
    transform: scale(1.14);
  }
}

.device {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  padding-top: var(--gap-md);
  border-top: 1px solid var(--vellum);
  font-size: var(--fs-caption);
  color: var(--ink-faint);
}

/* ---------------- 移动端 ---------------- */
.tabbar {
  display: none;
}

.nav-mask {
  display: none;
}

@media (max-width: 900px) {
  .rail {
    transform: translateX(-100%);
    transition: transform var(--dur-panel) var(--ease-out);
  }

  .stage {
    margin-left: 0;
    padding-bottom: 60px;
  }

  .nav-toggle {
    display: inline-flex;
  }

  .bar {
    padding: 0 var(--gap-md);
  }

  .bar-path {
    display: none;
  }

  .stage-body {
    padding: var(--gap-lg) var(--gap-md) var(--gap-2xl);
  }

  .tabbar {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 50;
    display: flex;
    justify-content: space-around;
    padding: var(--gap-xs) 0;
    background: color-mix(in srgb, var(--paper) 92%, transparent);
    backdrop-filter: blur(10px);
    border-top: 1px solid var(--vellum);
  }

  .tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: var(--gap-xs) var(--gap-sm);
    font-size: 15px;
    color: var(--ink-faint);
    text-decoration: none;

    small {
      font-size: 10px;
    }

    &.on {
      color: var(--seal);
    }
  }
}
</style>
