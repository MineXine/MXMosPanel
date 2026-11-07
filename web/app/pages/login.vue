<script setup lang="ts">
const auth = useAuth();
const router = useRouter();
const route = useRoute();
const theme = useTheme();

const mode = ref<'login' | 'register'>('login');
const username = ref('');
const password = ref('');
const displayName = ref('');
const loading = ref(false);
const errorMsg = ref('');

const nextPath = computed(() => (route.query.next as string) || '/');

async function submit() {
  errorMsg.value = '';

  if (!username.value.trim()) {
    errorMsg.value = '请填写账号';
    return;
  }
  if (!password.value) {
    errorMsg.value = '请填写密码';
    return;
  }
  if (mode.value === 'register' && password.value.length < 6) {
    errorMsg.value = '密码至少 6 位';
    return;
  }

  loading.value = true;
  try {
    if (mode.value === 'login') {
      await auth.login(username.value.trim(), password.value);
    } else {
      await auth.register(
        username.value.trim(),
        password.value,
        displayName.value.trim() || undefined,
      );
    }
    await router.push(nextPath.value);
  } catch (e) {
    // 错误就地显示在操作发生处
    errorMsg.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

function switchMode() {
  mode.value = mode.value === 'login' ? 'register' : 'login';
  errorMsg.value = '';
}

onMounted(async () => {
  theme.init();
  await auth.restore();
  // 已登录直接进入后台
  if (auth.isLoggedIn.value) await router.replace(nextPath.value);
});

useHead({ title: '登录 · 说说后台' });

// 登录页使用独立外壳，不显示后台侧栏与工具条
definePageMeta({ layout: 'bare' });
</script>

<template>
  <div class="gate">
    <div class="gate-card">
      <!-- 印记：识别这是「自己的」系统 -->
      <div class="gate-mark" aria-hidden="true">说</div>

      <div class="gate-head">
        <h1>{{ mode === 'login' ? '回到你的手账' : '开一本新的手账' }}</h1>
        <p class="gate-sub">
          {{
            mode === 'login'
              ? '个人说说后台，只有你能进来。'
              : '创建账号，开始记录你的第一条说说。'
          }}
        </p>
      </div>

      <form class="gate-form" @submit.prevent="submit">
        <div v-if="mode === 'register'" class="field">
          <label for="nick">昵称</label>
          <input
            id="nick"
            v-model="displayName"
            class="input"
            autocomplete="nickname"
            placeholder="显示名称（可选）"
          />
        </div>

        <div class="field">
          <label for="acct">账号</label>
          <input
            id="acct"
            v-model="username"
            class="input"
            autocomplete="username"
            placeholder="用户名"
            required
          />
        </div>

        <div class="field">
          <label for="pwd">密码</label>
          <input
            id="pwd"
            v-model="password"
            class="input"
            type="password"
            :autocomplete="mode === 'login' ? 'current-password' : 'new-password'"
            placeholder="••••••"
            required
          />
        </div>

        <p v-if="errorMsg" class="notice notice-error" role="alert">{{ errorMsg }}</p>

        <button class="btn btn-seal gate-submit" type="submit" :disabled="loading">
          <span v-if="loading" class="spinner" />
          {{ loading ? '处理中…' : mode === 'login' ? '进入后台' : '创建并进入' }}
        </button>
      </form>

      <button class="gate-switch" type="button" @click="switchMode">
        {{ mode === 'login' ? '还没有账号？创建一个' : '已有账号？直接登录' }}
      </button>
    </div>

    <p class="gate-foot">个人手账 · 说点什么就好</p>
  </div>
</template>

<style scoped lang="scss">
.gate {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--gap-lg);
  min-height: 100dvh;
  padding: var(--gap-xl);
  // 纸面上一层极淡的印泥晕，暗示唯一强调色
  background:
    radial-gradient(ellipse 70% 50% at 50% 0%, var(--seal-soft), transparent 70%),
    var(--paper);
}

.gate-card {
  width: 100%;
  max-width: 348px;
  padding: var(--gap-2xl);
  background: var(--paper-raised);
  border-radius: var(--r-sheet);
  box-shadow: var(--lift-pop);
}

.gate-mark {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  margin-bottom: var(--gap-lg);
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
  color: var(--seal-ink);
  background: var(--seal);
  border-radius: var(--r-control);
}

.gate-head {
  margin-bottom: var(--gap-xl);

  h1 {
    margin-bottom: var(--gap-xs);
    font-size: var(--fs-h2);
  }

  .gate-sub {
    font-size: var(--fs-body-sm);
    color: var(--ink-faint);
  }
}

.gate-form {
  display: flex;
  flex-direction: column;
  gap: var(--gap-lg);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--gap-xs);

  label {
    font-size: var(--fs-meta);
    font-weight: 500;
    color: var(--ink-soft);
  }
}

.gate-submit {
  height: 38px;
  margin-top: var(--gap-xs);
}

.gate-switch {
  width: 100%;
  margin-top: var(--gap-lg);
  padding: var(--gap-sm);
  font-size: var(--fs-meta);
  color: var(--ink-faint);
  background: none;
  border: 0;
  cursor: pointer;
  transition: color var(--dur-press) var(--ease-out);

  &:hover {
    color: var(--seal);
  }
}

.gate-foot {
  font-size: var(--fs-caption);
  color: var(--ink-ghost);
  letter-spacing: 0.06em;
}
</style>
