<script setup lang="ts">
import type { Post } from '~/types';
import { renderMarkdown } from '~/utils/markdown';

const props = defineProps<{
  content: string;
  mdcOptions?: Post['mdcOptions'];
}>();

const html = computed(() =>
  renderMarkdown(props.content ?? '', { mdcOptions: props.mdcOptions ?? [] }),
);
</script>

<template>
  <div class="md-content" v-html="html" />
</template>

<style scoped lang="scss">
.md-content {
  font-size: var(--fs-body);
  line-height: 1.75;
  word-break: break-word;

  :deep(> *:first-child) {
    margin-top: 0;
  }
  :deep(> *:last-child) {
    margin-bottom: 0;
  }

  :deep(p) {
    margin: 0 0 var(--gap-md);
  }

  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4) {
    margin: var(--gap-xl) 0 var(--gap-sm);
  }

  :deep(h1) {
    font-size: var(--fs-h2);
  }
  :deep(h2) {
    font-size: var(--fs-h3);
  }
  :deep(h3) {
    font-size: var(--fs-body);
  }

  :deep(ul),
  :deep(ol) {
    margin: 0 0 var(--gap-md);
    padding-left: var(--gap-xl);
  }

  :deep(li) {
    margin-bottom: var(--gap-xs);
  }

  :deep(blockquote) {
    margin: var(--gap-md) 0;
    padding: var(--gap-sm) var(--gap-lg);
    color: var(--ink-soft);
    background: var(--paper-inset);
    border-left: 3px solid var(--seal);
    border-radius: 0 var(--r-control) var(--r-control) 0;

    :deep(p:last-child) {
      margin-bottom: 0;
    }
  }

  :deep(hr) {
    margin: var(--gap-xl) 0;
  }

  :deep(a) {
    color: var(--seal);
  }

  :deep(img) {
    margin: var(--gap-md) 0;
    border-radius: var(--r-card);
    border: 1px solid var(--vellum);
  }

  :deep(mark) {
    padding: 0 3px;
    color: var(--ink);
    background: var(--stamp-warn-soft);
    border-radius: 3px;
  }

  :deep(code) {
    font-size: 0.86em;
    padding: 0.15em 0.4em;
    background: var(--paper-inset);
    border-radius: var(--r-control);
  }

  :deep(pre) {
    margin: var(--gap-md) 0;
    padding: var(--gap-md) var(--gap-lg);
    overflow-x: auto;
    background: var(--paper-inset);
    border: 1px solid var(--vellum);
    border-radius: var(--r-card);

    code {
      padding: 0;
      background: none;
      font-size: var(--fs-body-sm);
      line-height: 1.6;
    }
  }

  :deep(table) {
    width: 100%;
    margin: var(--gap-md) 0;
    border-collapse: collapse;
    font-size: var(--fs-body-sm);

    th,
    td {
      padding: var(--gap-sm) var(--gap-md);
      border: 1px solid var(--vellum);
      text-align: left;
    }

    th {
      font-weight: 600;
      background: var(--paper-inset);
    }
  }

  :deep(.md-tag) {
    color: var(--seal);
    font-weight: 500;
  }

  :deep(.md-task) {
    list-style: none;
    margin-left: calc(var(--gap-xl) * -1);
    display: flex;
    align-items: flex-start;
    gap: var(--gap-sm);
  }

  :deep(.md-checkbox) {
    display: inline-grid;
    place-items: center;
    width: 16px;
    height: 16px;
    margin-top: 4px;
    flex-shrink: 0;
    font-size: 11px;
    color: var(--seal-ink);
    background: var(--paper-inset);
    border: 1px solid var(--vellum-strong);
    border-radius: 4px;

    &.checked {
      background: var(--seal);
      border-color: var(--seal);
    }
  }

  /* ---------- MDC 组件 ---------- */
  :deep(.mdc-alert) {
    display: flex;
    gap: var(--gap-md);
    margin: var(--gap-md) 0;
    padding: var(--gap-md) var(--gap-lg);
    border: 1px solid var(--vellum);
    border-left-width: 3px;
    border-radius: var(--r-card);
    background: var(--paper-inset);

    .mdc-alert-icon {
      font-size: 16px;
      line-height: 1.5;
    }

    .mdc-alert-title {
      display: block;
      margin-bottom: 2px;
    }
  }

  :deep(.mdc-alert-info) {
    border-left-color: var(--stamp-info);
    background: var(--stamp-info-soft);
  }
  :deep(.mdc-alert-success) {
    border-left-color: var(--stamp-good);
    background: var(--stamp-good-soft);
  }
  :deep(.mdc-alert-warning) {
    border-left-color: var(--stamp-warn);
    background: var(--stamp-warn-soft);
  }
  :deep(.mdc-alert-error),
  :deep(.mdc-alert-danger) {
    border-left-color: var(--stamp-bad);
    background: var(--stamp-bad-soft);
  }

  :deep(.mdc-callout) {
    display: flex;
    gap: var(--gap-md);
    margin: var(--gap-md) 0;
    padding: var(--gap-md) var(--gap-lg);
    background: var(--seal-soft);
    border-radius: var(--r-card);

    .mdc-callout-icon {
      font-size: 18px;
    }

    .mdc-callout-title {
      font-weight: 600;
      margin-bottom: 2px;
    }
  }

  :deep(.mdc-badge) {
    display: inline-block;
    padding: 2px var(--gap-sm);
    margin: 2px;
    font-size: var(--fs-meta);
    font-weight: 600;
    border-radius: var(--r-pill);
    background: var(--paper-inset);
    color: var(--ink-soft);
  }

  :deep(.mdc-badge-success) {
    background: var(--stamp-good-soft);
    color: var(--stamp-good);
  }
  :deep(.mdc-badge-warning) {
    background: var(--stamp-warn-soft);
    color: var(--stamp-warn);
  }
  :deep(.mdc-badge-error) {
    background: var(--stamp-bad-soft);
    color: var(--stamp-bad);
  }
  :deep(.mdc-badge-info) {
    background: var(--stamp-info-soft);
    color: var(--stamp-info);
  }

  :deep(.mdc-card) {
    margin: var(--gap-md) 0;
    padding: var(--gap-lg);
    border: 1px solid var(--vellum);
    border-radius: var(--r-sheet);
    background: var(--paper-raised);

    .mdc-card-title {
      font-weight: 650;
      margin-bottom: 2px;
    }

    .mdc-card-subtitle {
      font-size: var(--fs-body-sm);
      color: var(--ink-faint);
      margin-bottom: var(--gap-sm);
    }
  }

  :deep(.mdc-quote-card) {
    margin: var(--gap-md) 0;
    padding: var(--gap-lg);
    border-left: 3px solid var(--seal);
    background: var(--seal-soft);
    border-radius: 0 var(--r-card) var(--r-card) 0;

    footer {
      margin-top: var(--gap-sm);
      font-size: var(--fs-body-sm);
      color: var(--ink-faint);
    }
  }

  :deep(.mdc-todo) {
    display: flex;
    align-items: center;
    gap: var(--gap-sm);
    margin: var(--gap-sm) 0;
  }

  :deep(.mdc-collapse) {
    margin: var(--gap-md) 0;
    border: 1px solid var(--vellum);
    border-radius: var(--r-card);

    summary {
      padding: var(--gap-sm) var(--gap-md);
      cursor: pointer;
      font-weight: 550;
      font-size: var(--fs-body-sm);
      user-select: none;

      &:hover {
        background: var(--paper-tint);
      }
    }

    .mdc-collapse-body {
      padding: var(--gap-md);
      border-top: 1px solid var(--vellum);
    }
  }

  :deep(.mdc-divider) {
    display: flex;
    align-items: center;
    gap: var(--gap-md);
    margin: var(--gap-xl) 0;
    border-top: 1px solid var(--vellum);

    span {
      font-size: var(--fs-meta);
      color: var(--ink-faint);
    }
  }

  :deep(.mdc-media) {
    margin: var(--gap-md) 0;

    figcaption {
      margin-top: var(--gap-sm);
      font-size: var(--fs-meta);
      color: var(--ink-faint);
      text-align: center;
    }
  }

  :deep(.mdc-timeline-item) {
    display: flex;
    gap: var(--gap-md);
    margin: var(--gap-md) 0;

    .mdc-timeline-dot {
      width: 10px;
      height: 10px;
      margin-top: 7px;
      flex-shrink: 0;
      background: var(--seal);
      border-radius: 50%;
    }

    .mdc-timeline-body {
      flex: 1;
    }

    .mdc-timeline-time {
      display: block;
      font-size: var(--fs-meta);
      color: var(--ink-faint);
    }
  }

  :deep(.mdc-poll) {
    margin: var(--gap-md) 0;
    padding: var(--gap-lg);
    border: 1px solid var(--vellum);
    border-radius: var(--r-sheet);

    .mdc-poll-question {
      font-weight: 600;
      margin-bottom: var(--gap-sm);
    }

    .mdc-poll-options {
      margin: 0;
      padding-left: var(--gap-xl);
    }
  }
}
</style>
