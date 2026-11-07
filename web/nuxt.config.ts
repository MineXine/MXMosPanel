import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  ssr: true,

  srcDir: 'app/',
  alias: {
    '@shared': new URL('../shared', import.meta.url).pathname.replace(/\\/g, '/'),
  },

  css: ['~/assets/styles/main.scss'],

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:4000/api',
    },
  },

  app: {
    head: {
      title: '说说 · 快速记录每一个瞬间',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: '轻量、快速、私密的说说系统' },
      ],
      htmlAttrs: { lang: 'zh-CN' },
      // 在样式生效前同步主题，避免深色模式下的白屏闪烁
      script: [
        {
          innerHTML: `(function(){try{var s=JSON.parse(localStorage.getItem('shuoshuo.theme')||'{}');var sc=s.scheme||'auto';var r=sc==='auto'?(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):sc;var e=document.documentElement;e.setAttribute('data-accent',s.accent||'cinnabar');e.setAttribute('data-scheme',r);e.style.colorScheme=r;}catch(_){}})();`,
          tagPosition: 'head',
        },
      ],
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,
    tsConfig: {
      compilerOptions: {
        // 数组索引访问在解析器代码中大量使用，关闭以避免噪声告警
        noUncheckedIndexedAccess: false,
      },
    },
  },

  nitro: {
    devProxy: {
      '/api': {
        target: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:4000/api',
        changeOrigin: true,
      },
    },
  },

  vite: {
    server: {
      // 允许引用 web 目录之外的 shared/
      fs: { allow: ['..'] },
      watch: {
        // shared/ 位于 web 目录之外，Windows 下监听跨目录会抛 EPERM，
        // 这里排除掉；该目录为纯类型/常量声明，不需要热更新。
        ignored: ['**/node_modules/**', '**/.git/**', '**/../shared/**'],
      },
    },
  },
});
