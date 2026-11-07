/**
 * 登录门禁。
 *
 * 个人后台只服务于本人，因此除登录页外的所有路由都要求已登录：
 * 未登录一律重定向到 /login，登录后回到原本要去的页面。
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // 登录页本身与分享落地页不需要登录
  if (to.path === '/login' || to.path.startsWith('/share/')) return;

  const auth = useAuth();
  const api = useApi();

  // 服务端渲染阶段凭 Cookie 判定；客户端水合后再读一次存储
  if (!auth.ready.value) {
    await auth.restore();
  }

  if (!auth.isLoggedIn.value) {
    return navigateTo({ path: '/login', query: to.fullPath !== '/' ? { next: to.fullPath } : {} });
  }
});
