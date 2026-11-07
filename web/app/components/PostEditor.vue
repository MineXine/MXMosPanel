<script setup lang="ts">
import type { Attachment } from '~/types';
import { MDC_DEFAULTS, parseMdcOptions } from '@shared/mdc';

const props = defineProps<{
  modelValue: string;
  /** 草稿键，用于自动保存 */
  draftKey?: string;
  visibility?: 'public' | 'private';
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'update:visibility', value: 'public' | 'private'): void;
  (e: 'saved', info: { at: string; offline?: boolean }): void;
  (e: 'attachments', value: Attachment[]): void;
}>();

const auth = useAuth();
const api = useApi();
const router = useRouter();

const content = computed({
  get: () => props.modelValue,
  set: (v: string) => emit('update:modelValue', v),
});

const visibility = computed({
  get: () => props.visibility ?? 'public',
  set: (v: 'public' | 'private') => emit('update:visibility', v),
});

const preview = ref(false);
const saving = ref(false);
const savedAt = ref('');
const uploadInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const attachments = ref<Attachment[]>([]);
const errorMsg = ref('');

const showMdcPicker = ref(false);

/** 可插入的 MDC 组件及其默认选项 */
const MDC_COMPONENTS = [
  { name: 'alert', label: '提示框', snippet: '::alert{type="info" title="提示"}\n这里填写内容\n::' },
  { name: 'callout', label: '强调块', snippet: '::callout{type="info" icon="◐" title="标题"}\n这里填写内容\n::' },
  { name: 'badge', label: '徽章', snippet: '::badge{type="default" text="标签"}' },
  { name: 'card', label: '卡片', snippet: '::card{title="卡片标题" subtitle="副标题"}\n这里填写内容\n::' },
  { name: 'quote-card', label: '引用卡', snippet: '::quote-card{author="作者" source="出处"}\n引用内容\n::' },
  { name: 'todo', label: '待办', snippet: '::todo{checked=false text="待办事项"}' },
  { name: 'collapse', label: '折叠块', snippet: '::collapse{title="展开查看" open=false}\n折叠内容\n::' },
  { name: 'divider', label: '分割线', snippet: '::divider{color="gray" text="分隔"}' },
  { name: 'media', label: '媒体块', snippet: '::media{layout="default" caption="说明"}\n![alt](url)\n::' },
  { name: 'timeline-item', label: '时间线条目', snippet: '::timeline-item{time="2026-01-01" type="default" title="标题"}\n内容\n::' },
  { name: 'poll', label: '投票', snippet: '::poll{question="你的问题？" options="选项A, 选项B"}' },
];

const editorRef = ref<HTMLTextAreaElement | null>(null);

/**
 * 预览用的 MDC 组件选项。
 * 与服务端共用 shared/mdc.ts 的解析与默认配置，保证预览与发布后一致。
 */
const previewMdcOptions = computed(() => parseMdcOptions(content.value, MDC_DEFAULTS));

/* ------------------------------------------------------------------ *
 * 插入内容
 * ------------------------------------------------------------------ */

function insertAtCursor(text: string) {
  const el = editorRef.value;
  if (!el) {
    content.value += `\n${text}\n`;
    return;
  }
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const before = content.value.slice(0, start);
  const after = content.value.slice(end);
  content.value = `${before}${text}${after}`;
  showMdcPicker.value = false;

  nextTick(() => {
    el.focus();
    const pos = start + text.length;
    el.setSelectionRange(pos, pos);
  });
}

function insertSnippet(snippet: string) {
  insertAtCursor(`\n${snippet}\n`);
}

/* ------------------------------------------------------------------ *
 * 草稿自动保存（本地 + 服务端双保险）
 * ------------------------------------------------------------------ */

const LOCAL_KEY = computed(() => `shuoshuo.draft.${props.draftKey ?? 'new'}`);

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function saveLocalDraft() {
  if (import.meta.client) {
    try {
      localStorage.setItem(
        LOCAL_KEY.value,
        JSON.stringify({ content: content.value, visibility: visibility.value, attachments: attachments.value }),
      );
    } catch {
      /* 忽略 */
    }
  }
}

async function saveRemoteDraft() {
  if (!auth.isLoggedIn.value || !props.draftKey) return;
  saving.value = true;
  try {
    await api.saveDraft({
      key: props.draftKey,
      content: content.value,
      tags: [],
      attachments: attachments.value,
    });
    savedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    emit('saved', { at: savedAt.value });
  } catch (e) {
    // 服务端失败不阻塞编辑，仅提示本地已保存
    emit('saved', { at: savedAt.value, offline: true });
  } finally {
    saving.value = false;
  }
}

function scheduleSave() {
  saveLocalDraft();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveRemoteDraft, 1200);
}

/** 恢复本地草稿 */
function restoreLocalDraft() {
  if (import.meta.client && !content.value) {
    try {
      const raw = localStorage.getItem(LOCAL_KEY.value);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.content) {
          content.value = parsed.content;
          visibility.value = parsed.visibility ?? 'public';
          attachments.value = parsed.attachments ?? [];
          emit('attachments', attachments.value);
        }
      }
    } catch {
      /* 忽略 */
    }
  }
}

watch(content, scheduleSave);
watch(visibility, scheduleSave);

onMounted(restoreLocalDraft);
onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer);
  saveLocalDraft();
});

/* ------------------------------------------------------------------ *
 * 附件上传
 * ------------------------------------------------------------------ */

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (!files || files.length === 0) return;
  if (!auth.isLoggedIn.value) {
    errorMsg.value = '请先登录，然后再上传附件。';
    input.value = '';
    return;
  }

  uploading.value = true;
  errorMsg.value = '';

  const base = String(useRuntimeConfig().public.apiBase || '/api');
  const token = api.readToken() ?? '';

  for (const file of Array.from(files)) {
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${base}/media`, {
        method: 'POST',
        headers: token ? { authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? '上传失败');
      attachments.value.push(json.data.media);
      emit('attachments', attachments.value);
    } catch (err) {
      errorMsg.value = (err as Error).message;
    }
  }

  uploading.value = false;
  input.value = '';
  saveLocalDraft();
}

function removeAttachment(id: string) {
  attachments.value = attachments.value.filter((a) => a.id !== id);
  emit('attachments', attachments.value);
  saveLocalDraft();
}

/* ------------------------------------------------------------------ *
 * 工具栏
 * ------------------------------------------------------------------ */

function wrapSelection(before: string, after = before) {
  const el = editorRef.value;
  if (!el) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const selected = content.value.slice(start, end);
  content.value = `${content.value.slice(0, start)}${before}${selected}${after}${content.value.slice(end)}`;
  nextTick(() => {
    el.focus();
    el.setSelectionRange(start + before.length, end + before.length);
  });
}

const tools = [
  { icon: 'B', title: '加粗', action: () => wrapSelection('**') },
  { icon: 'I', title: '斜体', action: () => wrapSelection('*') },
  { icon: 'S', title: '删除线', action: () => wrapSelection('~~') },
  { icon: 'H', title: '标题', action: () => wrapSelection('## ', '') },
  { icon: '❝', title: '引用', action: () => wrapSelection('> ', '') },
  { icon: '•', title: '列表', action: () => wrapSelection('- ', '') },
  { icon: '↗', title: '链接', action: () => wrapSelection('[', '](url)') },
  { icon: '`', title: '行内代码', action: () => wrapSelection('`') },
  { icon: '```', title: '代码块', action: () => wrapSelection('```\n', '\n```') },
  { icon: '#', title: '标签', action: () => wrapSelection('#', '') },
];
</script>

<template>
  <div class="editor">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="tool-group">
        <button
          v-for="t in tools"
          :key="t.title"
          class="tool-btn"
          :title="t.title"
          :aria-label="t.title"
          type="button"
          @click="t.action"
        >
          <span aria-hidden="true">{{ t.icon }}</span>
        </button>
      </div>

      <div class="tool-group">
        <button
          class="tool-btn"
          :class="{ active: showMdcPicker }"
          title="插入组件"
          aria-label="插入组件"
          :aria-expanded="showMdcPicker"
          type="button"
          @click="showMdcPicker = !showMdcPicker"
        >
          <span aria-hidden="true">◫</span>
        </button>
        <button
          class="tool-btn"
          title="上传附件"
          aria-label="上传附件"
          type="button"
          @click="uploadInput?.click()"
        >
          <span aria-hidden="true">❏</span>
        </button>
        <button
          class="tool-btn"
          :title="preview ? '继续编辑' : '预览效果'"
          :aria-label="preview ? '继续编辑' : '预览效果'"
          type="button"
          @click="preview = !preview"
        >
          <span aria-hidden="true">{{ preview ? '✎' : '◉' }}</span>
        </button>
      </div>

      <!-- 可见性：标签描述开启后的状态 -->
      <div class="tool-group visibility-group" role="group" aria-label="可见性">
        <button
          class="vis-btn"
          :class="{ active: visibility === 'public' }"
          :aria-pressed="visibility === 'public'"
          type="button"
          @click="visibility = 'public'"
        >
          <span aria-hidden="true">◉</span> 公开可见
        </button>
        <button
          class="vis-btn"
          :class="{ active: visibility === 'private' }"
          :aria-pressed="visibility === 'private'"
          type="button"
          @click="visibility = 'private'"
        >
          <span aria-hidden="true">◑</span> 仅自己可见
        </button>
      </div>
    </div>

    <!-- 组件选择器 -->
    <Transition name="fade">
      <div v-if="showMdcPicker" class="mdc-picker">
        <div class="mdc-picker-head">
          <strong>插入组件</strong>
          <span>选项默认值可在服务端配置中调整</span>
        </div>
        <div class="mdc-picker-grid">
          <button
            v-for="c in MDC_COMPONENTS"
            :key="c.name"
            class="mdc-item"
            type="button"
            @click="insertSnippet(c.snippet)"
          >
            <span class="mdc-item-name">{{ c.name }}</span>
            <span class="mdc-item-label">{{ c.label }}</span>
          </button>
        </div>
      </div>
    </Transition>

    <!-- 编辑区 / 预览区 -->
    <div v-if="!preview" class="edit-area">
      <textarea
        ref="editorRef"
        v-model="content"
        class="editor-input"
        placeholder="写点什么…支持 Markdown 语法&#10;&#10;::alert{type=&quot;info&quot; title=&quot;提示&quot;}&#10;这里填写内容&#10;::"
        spellcheck="false"
        aria-label="正文内容"
      />
    </div>
    <div v-else class="preview-area">
      <MarkdownContent v-if="content" :content="content" :mdc-options="previewMdcOptions" />
      <p v-else class="empty">还没有正文可以预览</p>
    </div>

    <!-- 附件 -->
    <div v-if="attachments.length" class="attachment-list">
      <div v-for="att in attachments" :key="att.id" class="attachment-chip">
        <img v-if="att.kind === 'image'" :src="att.url" :alt="att.filename" />
        <span v-else aria-hidden="true">❏</span>
        <span class="att-name">{{ att.filename }}</span>
        <button
          class="att-remove"
          type="button"
          :aria-label="`移除附件 ${att.filename}`"
          @click="removeAttachment(att.id)"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
    </div>

    <input ref="uploadInput" type="file" hidden multiple accept="image/*,video/*,audio/*,.pdf" @change="onFileChange" />

    <!-- 状态栏 -->
    <div class="editor-status">
      <span class="status-left">
        <span v-if="saving" class="spinner" />
        <span v-else-if="savedAt" class="saved-hint">草稿已保存 {{ savedAt }}</span>
        <span v-else class="saved-hint muted">草稿会自动保存</span>
      </span>
      <span class="status-right">
        <span class="count-hint tabular">{{ content.length }} 字</span>
        <span v-if="uploading" class="spinner" />
      </span>
    </div>

    <p v-if="errorMsg" class="editor-error" role="alert">{{ errorMsg }}</p>
  </div>
</template>

<style scoped lang="scss">
.editor {
  background: var(--paper-raised);
  border: 1px solid var(--vellum);
  border-radius: var(--r-sheet);
  overflow: hidden;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
  padding: var(--gap-sm) var(--gap-md);
  border-bottom: 1px solid var(--vellum);
  background: var(--paper-inset);
  flex-wrap: wrap;
}

.tool-group {
  display: flex;
  gap: 2px;

  & + & {
    padding-left: var(--gap-md);
    border-left: 1px solid var(--vellum);
  }
}

.tool-btn {
  display: grid;
  place-items: center;
  min-width: 28px;
  height: 28px;
  padding: 0 var(--gap-sm);
  font-size: var(--fs-body-sm);
  font-weight: 600;
  color: var(--ink-soft);
  background: none;
  border: 0;
  border-radius: var(--r-control);
  cursor: pointer;
  transition: all var(--dur-press) var(--ease-out);

  &:hover {
    background: var(--paper-tint);
    color: var(--ink);
  }

  &.active {
    background: var(--seal-soft);
    color: var(--seal);
  }
}

.visibility-group {
  margin-left: auto;
  gap: var(--gap-xs);
}

.vis-btn {
  padding: var(--gap-xs) var(--gap-md);
  font-size: var(--fs-meta);
  font-weight: 500;
  color: var(--ink-soft);
  background: var(--paper-raised);
  border: 1px solid var(--vellum);
  border-radius: var(--r-pill);
  cursor: pointer;
  transition: all var(--dur-press) var(--ease-out);

  &:hover {
    border-color: var(--vellum-strong);
  }

  &.active {
    background: var(--seal);
    color: var(--seal-ink);
    border-color: transparent;
  }
}

.mdc-picker {
  padding: var(--gap-md);
  border-bottom: 1px solid var(--vellum);
  background: var(--paper-raised);

  .mdc-picker-head {
    display: flex;
    align-items: baseline;
    gap: var(--gap-sm);
    margin-bottom: var(--gap-sm);

    strong {
      font-size: var(--fs-body-sm);
    }

    span {
      font-size: var(--fs-meta);
      color: var(--ink-faint);
    }
  }

  .mdc-picker-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
    gap: var(--gap-sm);
  }

  .mdc-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    padding: var(--gap-sm) var(--gap-md);
    text-align: left;
    background: var(--paper-inset);
    border: 1px solid transparent;
    border-radius: var(--r-card);
    cursor: pointer;
    transition: all var(--dur-press) var(--ease-out);

    &:hover {
      background: var(--seal-soft);
      border-color: var(--seal);
    }

    .mdc-item-name {
      font-family: ui-monospace, monospace;
      font-size: var(--fs-meta);
      font-weight: 600;
      color: var(--seal);
    }

    .mdc-item-label {
      font-size: var(--fs-meta);
      color: var(--ink-soft);
    }
  }
}

.edit-area {
  min-height: 260px;
}

.editor-input {
  width: 100%;
  min-height: 260px;
  padding: var(--gap-lg);
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  font-size: var(--fs-body-sm);
  line-height: 1.75;
  color: var(--ink);
  background: transparent;
  border: 0;
  outline: none;
  resize: vertical;
}

.preview-area {
  min-height: 260px;
  padding: var(--gap-lg);
}

.attachment-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--gap-sm);
  padding: var(--gap-md);
  border-top: 1px solid var(--vellum);
}

.attachment-chip {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  padding: var(--gap-xs) var(--gap-sm);
  font-size: var(--fs-meta);
  background: var(--paper-inset);
  border: 1px solid var(--vellum);
  border-radius: var(--r-card);
  max-width: 220px;

  img {
    width: 28px;
    height: 28px;
    object-fit: cover;
    border-radius: var(--r-control);
  }

  .att-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .att-remove {
    border: 0;
    background: none;
    color: var(--ink-faint);
    cursor: pointer;
    font-size: 11px;
    padding: 2px;

    &:hover {
      color: var(--stamp-bad);
    }
  }
}

.editor-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--gap-sm) var(--gap-lg);
  font-size: var(--fs-meta);
  color: var(--ink-faint);
  border-top: 1px solid var(--vellum);
  background: var(--paper-inset);

  .status-left,
  .status-right {
    display: flex;
    align-items: center;
    gap: var(--gap-sm);
  }

  .saved-hint {
    color: var(--stamp-good);

    &.muted {
      color: var(--ink-faint);
    }
  }
}

.editor-error {
  margin: 0;
  padding: var(--gap-sm) var(--gap-lg);
  font-size: var(--fs-meta);
  color: var(--stamp-bad);
  border-top: 1px solid var(--vellum);
}
</style>
