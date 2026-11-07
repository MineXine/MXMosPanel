import type { User } from '~/types';

export function useAuth() {
  const user = useState<User | null>('auth.user', () => null);
  const ready = useState<boolean>('auth.ready', () => false);
  const api = useApi();

  const isLoggedIn = computed(() => user.value !== null);

  /**
   * 恢复登录态。
   *
   * 服务端渲染阶段凭 Cookie 判定（api.readToken 会读取请求头中的 cookie），
   * 客户端额外读取 localStorage，保证水合后与 SSR 结果一致。
   */
  async function restore(): Promise<void> {
    if (ready.value) return;

    if (!api.readToken()) {
      user.value = null;
      ready.value = true;
      return;
    }

    try {
      const res = await api.me();
      user.value = res.user;
    } catch {
      // token 失效或账号已不存在，清掉登录态
      api.writeToken(null);
      user.value = null;
    } finally {
      ready.value = true;
    }
  }

  async function login(username: string, password: string): Promise<void> {
    const res = await api.login(username, password);
    api.writeToken(res.token);
    user.value = res.user;
    ready.value = true;
  }

  async function register(username: string, password: string, displayName?: string): Promise<void> {
    const res = await api.register(username, password, displayName);
    api.writeToken(res.token);
    user.value = res.user;
    ready.value = true;
  }

  function logout(): void {
    api.writeToken(null);
    user.value = null;
    ready.value = true;
  }

  async function updateProfile(
    patch: Partial<Pick<User, 'displayName' | 'bio' | 'avatarColor'>>,
  ): Promise<void> {
    const res = await api.updateProfile(patch);
    user.value = res.user;
  }

  return { user, ready, isLoggedIn, restore, login, register, logout, updateProfile };
}
