import type {
  Attachment,
  CalendarCell,
  DashboardStats,
  Draft,
  MapPoint,
  MediaAsset,
  Paged,
  Post,
  SavedView,
  ShareLink,
  TagInfo,
  User,
} from '~/types';

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

export interface CreatePostPayload {
  content: string;
  visibility?: 'public' | 'private';
  tags?: string[];
  location?: Post['location'];
  attachments?: Attachment[];
}

export interface UpdatePostPayload {
  content?: string;
  visibility?: 'public' | 'private';
  tags?: string[];
  location?: Post['location'];
  attachments?: Attachment[];
}

export interface ListPostsParams {
  page?: number;
  pageSize?: number;
  visibility?: 'public' | 'private' | 'all';
  status?: 'published' | 'archived';
  keyword?: string;
  tags?: string[];
  from?: string;
  to?: string;
  hasLocation?: boolean;
  sort?: 'latest' | 'oldest' | 'popular' | 'liked';
  authorId?: string;
  liked?: boolean;
  favorited?: boolean;
}

export interface AuthResult {
  token: string;
  user: User;
}

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

const TOKEN_KEY = 'shuoshuo.token';

export function getToken(): string | null {
  if (import.meta.server) return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  if (import.meta.server) return;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* 隐私模式下 localStorage 不可用 */
  }
}
function buildQuery(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      usp.set(k, v.join(','));
    } else {
      usp.set(k, String(v));
    }
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

export function createApiClient() {
  const config = useRuntimeConfig();
  const base = String(config.public.apiBase || '/api');

  /**
   * 令牌来源：优先 Cookie（服务端可读，SSR 能带上登录态），
   * 其次 localStorage（客户端兜底）。
   */
  const tokenCookie = useCookie<string | null>('shuoshuo.token', {
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  function readToken(): string | null {
    if (import.meta.server) return tokenCookie.value ?? null;
    return getToken() ?? tokenCookie.value ?? null;
  }

  function writeToken(token: string | null): void {
    tokenCookie.value = token;
    setToken(token);
  }

  async function request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      query?: Record<string, unknown>;
      auth?: boolean;
    } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers['content-type'] = 'application/json';

    const token = readToken();
    if (token && options.auth !== false) headers.authorization = `Bearer ${token}`;

    // SSR 场景：转发客户端的 Cookie，保证服务端渲染时登录态与客户端一致
    if (import.meta.server) {
      const cookie = useRequestHeaders(['cookie']);
      if (cookie.cookie) headers.cookie = cookie.cookie;
    }

    const url = `${base}${path}${options.query ? buildQuery(options.query) : ''}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch {
      throw new ApiClientError(0, 'NETWORK_ERROR', '无法连接服务器，请检查后端是否已启动');
    }

    const json = (await res.json().catch(() => ({}))) as ApiResult<T>;

    if (!res.ok || json.ok === false) {
      throw new ApiClientError(
        res.status,
        json.error?.code ?? 'UNKNOWN',
        json.error?.message ?? `请求失败（${res.status}）`,
        json.error?.details,
      );
    }

    return json.data as T;
  }

  return {
    request,
    readToken,
    writeToken,

    // ---- 认证 ----
    register: (username: string, password: string, displayName?: string) =>
      request<AuthResult>('/auth/register', {
        method: 'POST',
        body: { username, password, displayName },
        auth: false,
      }),
    login: (username: string, password: string) =>
      request<AuthResult>('/auth/login', {
        method: 'POST',
        body: { username, password },
        auth: false,
      }),
    me: () => request<{ user: User }>('/auth/me'),
    updateProfile: (patch: Partial<Pick<User, 'displayName' | 'bio' | 'avatarColor'>>) =>
      request<{ user: User }>('/auth/me', { method: 'PATCH', body: patch }),
    listUsers: () => request<{ users: User[] }>('/auth/users', { auth: false }),

    // ---- 说说 ----
    listPosts: (params: ListPostsParams) =>
      request<Paged<Post>>('/posts', {
        query: {
          page: params.page,
          pageSize: params.pageSize,
          visibility: params.visibility,
          status: params.status,
          keyword: params.keyword,
          tags: params.tags,
          from: params.from,
          to: params.to,
          hasLocation: params.hasLocation,
          sort: params.sort,
          authorId: params.authorId,
          liked: params.liked,
          favorited: params.favorited,
        },
      }),
    getPost: (id: string) => request<{ post: Post }>(`/posts/${id}`),
    createPost: (payload: CreatePostPayload) =>
      request<{ post: Post }>('/posts', { method: 'POST', body: payload }),
    updatePost: (id: string, payload: UpdatePostPayload) =>
      request<{ post: Post }>(`/posts/${id}`, { method: 'PATCH', body: payload }),
    deletePost: (id: string) =>
      request<{ deleted: boolean }>(`/posts/${id}`, { method: 'DELETE' }),
    archivePost: (id: string) =>
      request<{ post: Post }>(`/posts/${id}/archive`, { method: 'POST' }),
    unarchivePost: (id: string) =>
      request<{ post: Post }>(`/posts/${id}/unarchive`, { method: 'POST' }),

    // ---- 互动 ----
    toggleLike: (id: string) =>
      request<{ liked: boolean; count: number }>(`/posts/${id}/like`, { method: 'POST' }),
    toggleFavorite: (id: string) =>
      request<{ favorited: boolean; count: number }>(`/posts/${id}/favorite`, { method: 'POST' }),
    listLikers: (id: string) => request<{ users: User[] }>(`/posts/${id}/likes`),

    // ---- 分享 ----
    createShare: (id: string, expiresInDays?: number) =>
      request<{ share: ShareLink }>(`/posts/${id}/share`, {
        method: 'POST',
        body: { expiresInDays },
      }),
    listShares: (id: string) => request<{ shares: ShareLink[] }>(`/posts/${id}/shares`),
    myShares: () => request<{ shares: ShareLink[] }>('/share'),
    revokeShare: (postId: string, shareId: string) =>
      request<{ deleted: boolean }>(`/posts/${postId}/shares/${shareId}`, { method: 'DELETE' }),
    getSharedPost: (token: string) =>
      request<{ post: Post; share: ShareLink }>(`/share/${token}`, { auth: false }),

    // ---- 组织与检索 ----
    listTags: () => request<{ tags: TagInfo[] }>('/posts/tags/list'),
    calendarBuckets: (year: number, month: number, extra?: Record<string, unknown>) =>
      request<{ cells: CalendarCell[] }>('/posts/calendar/buckets', {
        query: { year, month, ...extra },
      }),
    mapPoints: (extra?: Record<string, unknown>) =>
      request<{ points: MapPoint[] }>('/posts/map/points', { query: extra }),

    // ---- 视图 ----
    listViews: () => request<{ views: SavedView[] }>('/views'),
    createView: (payload: {
      name: string;
      icon?: string;
      description?: string;
      filters?: SavedView['filters'];
    }) => request<{ view: SavedView }>('/views', { method: 'POST', body: payload }),
    updateView: (id: string, payload: Partial<SavedView>) =>
      request<{ view: SavedView }>(`/views/${id}`, { method: 'PATCH', body: payload }),
    deleteView: (id: string) => request<{ deleted: boolean }>(`/views/${id}`, { method: 'DELETE' }),
    viewPosts: (id: string, page = 1, pageSize = 20) =>
      request<Paged<Post> & { view: SavedView }>(`/views/${id}/posts`, {
        query: { page, pageSize },
      }),

    // ---- 草稿 ----
    listDrafts: () => request<{ drafts: Draft[] }>('/drafts'),
    saveDraft: (payload: { key: string; content: string; tags?: string[]; attachments?: Attachment[] }) =>
      request<{ draft: Draft }>('/drafts', { method: 'PUT', body: payload }),
    getDraft: (key: string) => request<{ draft: Draft | null }>(`/drafts/${key}`),
    deleteDraft: (key: string) => request<{ deleted: boolean }>(`/drafts/${key}`, { method: 'DELETE' }),

    // ---- 媒体 ----
    listMedia: () => request<{ medias: MediaAsset[] }>('/media'),
    deleteMedia: (id: string) => request<{ deleted: boolean }>(`/media/${id}`, { method: 'DELETE' }),

    // ---- 统计 ----
    stats: () => request<{ stats: DashboardStats }>('/stats'),
    device: () =>
      request<{ device: Post['device'] }>('/stats/device'),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** Nuxt 自动导入入口 */
export function useApi(): ApiClient {
  return createApiClient();
}
