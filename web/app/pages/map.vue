<script setup lang="ts">
import type { MapPoint } from '~/types';

const api = useApi();
const auth = useAuth();

const points = ref<MapPoint[]>([]);
const loading = ref(true);
const errorMsg = ref('');
const selected = ref<MapPoint | null>(null);

/** 视图变换：缩放与平移 */
const zoom = ref(1);
const center = ref({ lng: 104, lat: 35 }); // 中国中心附近

const VIEW_W = 1000;
const VIEW_H = 620;

/** Web 墨卡托（简化）投影：经纬度 -> 画布坐标 */
function project(lng: number, lat: number): { x: number; y: number } {
  const scale = 1 / Math.cos((center.value.lat * Math.PI) / 180);
  const x = (lng - center.value.lng) * scale * 12 + VIEW_W / 2;
  const y = (center.value.lat - lat) * 12 + VIEW_H / 2;
  return { x, y };
}

const projected = computed(() =>
  points.value.map((p) => {
    const { x, y } = project(p.lng, p.lat);
    return { ...p, x: x * zoom.value, y: y * zoom.value };
  }),
);

/** 简易海岸线轮廓（用于提供地理参照，非精确地图数据） */
const LANDMASSES: Array<Array<[number, number]>> = [
  // 中国大陆轮廓（粗略）
  [
    [73.5, 39], [80, 42], [87, 49], [95, 44], [105, 42], [112, 45], [120, 42],
    [125, 40], [122, 35], [121, 30], [117, 24], [110, 20], [105, 21], [100, 22],
    [97, 24], [92, 27], [85, 28], [80, 30], [76, 35], [73.5, 39],
  ],
  // 日本
  [
    [130, 31], [132, 34], [136, 35], [140, 38], [142, 42], [145, 44], [141, 45],
    [139, 42], [136, 37], [132, 34], [130, 31],
  ],
  // 东南亚
  [
    [95, 5], [105, -2], [115, -4], [120, 1], [118, 8], [110, 12], [103, 8], [98, 8], [95, 5],
  ],
  // 印度
  [
    [68, 24], [72, 20], [75, 12], [78, 8], [82, 17], [87, 21], [92, 21], [89, 25], [80, 28], [72, 28], [68, 24],
  ],
];

const landPaths = computed(() =>
  LANDMASSES.map((poly) => {
    const pts = poly.map(([lng, lat]) => {
      const { x, y } = project(lng, lat);
      return `${(x * zoom.value).toFixed(1)},${(y * zoom.value).toFixed(1)}`;
    });
    return `M ${pts.join(' L ')} Z`;
  }),
);

/** 网格经纬线 */
const gridLines = computed(() => {
  const lines: Array<{ d: string; label?: string }> = [];
  for (let lng = -180; lng <= 180; lng += 30) {
    const p1 = project(lng, -85);
    const p2 = project(lng, 85);
    lines.push({
      d: `M ${(p1.x * zoom.value).toFixed(1)},${(p1.y * zoom.value).toFixed(1)} L ${(p2.x * zoom.value).toFixed(1)},${(p2.y * zoom.value).toFixed(1)}`,
      label: `${lng}°`,
    });
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const p1 = project(-180, lat);
    const p2 = project(180, lat);
    lines.push({
      d: `M ${(p1.x * zoom.value).toFixed(1)},${(p1.y * zoom.value).toFixed(1)} L ${(p2.x * zoom.value).toFixed(1)},${(p2.y * zoom.value).toFixed(1)}`,
      label: `${lat}°`,
    });
  }
  return lines;
});

async function load() {
  loading.value = true;
  try {
    const res = await api.mapPoints();
    points.value = res.points;
    if (res.points.length > 0) {
      center.value = {
        lng: res.points.reduce((s, p) => s + p.lng, 0) / res.points.length,
        lat: res.points.reduce((s, p) => s + p.lat, 0) / res.points.length,
      };
    }
  } catch (e) {
    errorMsg.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

function zoomIn() {
  zoom.value = Math.min(6, zoom.value * 1.3);
}
function zoomOut() {
  zoom.value = Math.max(0.6, zoom.value / 1.3);
}
function reset() {
  zoom.value = 1;
  center.value = { lng: 104, lat: 35 };
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  if (e.deltaY < 0) zoomIn();
  else zoomOut();
}

onMounted(async () => {
  await auth.restore();
  await load();
});

useHead({ title: '足迹 · 说说后台' });
</script>

<template>
  <div class="map-page">
    <header class="page-head">
      <div class="head-title">
        <span class="meta-label">梳理</span>
        <h1>足迹</h1>
      </div>
      <span class="point-count tabular">{{ points.length }} 个位置</span>
    </header>

    <div class="map-split">
      <!-- 地图 -->
      <section class="map-shell sheet">
        <svg
          class="map-svg"
          :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
          preserveAspectRatio="xMidYMid slice"
          role="img"
          aria-label="记录位置的分布图"
          @wheel="onWheel"
        >
          <!-- 纸面底色 -->
          <rect width="100%" height="100%" fill="var(--paper-inset)" />

          <!-- 经纬网格 -->
          <g class="grid">
            <path v-for="(l, i) in gridLines" :key="i" :d="l.d" />
          </g>

          <!-- 陆地轮廓 -->
          <g class="land">
            <path v-for="(d, i) in landPaths" :key="i" :d="d" />
          </g>

          <!-- 位置标记 -->
          <g class="markers">
            <g
              v-for="p in projected"
              :key="p.id"
              class="marker"
              :class="{ selected: selected?.id === p.id }"
              :transform="`translate(${p.x}, ${p.y})`"
              @click="selected = p"
            >
              <circle class="marker-halo" r="12" />
              <circle class="marker-dot" r="4.5" />
              <text class="marker-label" y="-14">{{ p.label || p.title.slice(0, 12) }}</text>
            </g>
          </g>
        </svg>

        <div class="map-controls">
          <button class="btn btn-icon" title="放大" aria-label="放大" @click="zoomIn">＋</button>
          <button class="btn btn-icon" title="缩小" aria-label="缩小" @click="zoomOut">－</button>
          <button class="btn btn-icon" title="重置视图" aria-label="重置视图" @click="reset">⟳</button>
        </div>

        <div v-if="loading" class="map-loading">
          <span class="spinner" />
        </div>

        <div v-if="!loading && !points.length" class="map-empty">
          <span class="empty-mark" aria-hidden="true">◈</span>
          <p>还没有带位置的记录</p>
          <p class="hint">写记录时添加位置，这里就会出现足迹。</p>
        </div>
      </section>

      <!-- 位置档案 -->
      <aside class="point-panel sheet">
        <div class="sheet-head">
          <span class="meta-label">位置档案</span>
          <span class="tabular sheet-count">{{ points.length }}</span>
        </div>

        <div v-if="!points.length && !loading" class="empty">
          <p>还没有位置记录</p>
        </div>

        <ul v-else class="point-list">
          <li v-for="p in points" :key="p.id">
            <button
              class="point-item"
              :class="{ active: selected?.id === p.id }"
              @click="selected = p"
            >
              <span class="pt-label">{{ p.label || '未命名位置' }}</span>
              <span class="pt-coord tabular">{{ p.lat.toFixed(4) }}, {{ p.lng.toFixed(4) }}</span>
              <time class="pt-date">{{ new Date(p.createdAt).toLocaleDateString('zh-CN') }}</time>
            </button>
          </li>
        </ul>
      </aside>
    </div>

    <!-- 选中详情 -->
    <Transition name="fade">
      <div v-if="selected" class="sheet point-detail">
        <div class="detail-head">
          <strong>{{ selected.label || '未命名位置' }}</strong>
          <button class="btn btn-quiet btn-icon btn-sm" aria-label="关闭详情" @click="selected = null">
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <p class="detail-excerpt">{{ selected.excerpt || selected.title }}</p>
        <div class="detail-foot">
          <span class="detail-coord tabular">{{ selected.lat.toFixed(6) }}, {{ selected.lng.toFixed(6) }}</span>
          <span class="detail-tags">
            <span v-for="t in selected.tags" :key="t" class="leaf-tag">#{{ t }}</span>
          </span>
        </div>
      </div>
    </Transition>

    <p v-if="errorMsg" class="notice notice-error">{{ errorMsg }}</p>
  </div>
</template>

<style scoped lang="scss">
.map-page {
  display: flex;
  flex-direction: column;
  gap: var(--gap-lg);
}

.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--gap-lg);
  flex-wrap: wrap;

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

  .point-count {
    font-size: var(--fs-meta);
    color: var(--ink-faint);
  }
}

.map-shell {
  position: relative;
  height: 460px;
  overflow: hidden;
  padding: 0;
}

.map-svg {
  width: 100%;
  height: 100%;
  cursor: grab;

  .grid path {
    stroke: var(--vellum);
    stroke-width: 0.5;
    fill: none;
    opacity: 0.6;
  }

  .land path {
    // 陆地是「压上去的纸」，比底色更实一点
    fill: var(--paper-tint);
    stroke: var(--vellum-strong);
    stroke-width: 1;
  }

  .marker {
    cursor: pointer;

    .marker-halo {
      fill: var(--seal);
      opacity: 0.2;
    }

    .marker-dot {
      fill: var(--seal);
      stroke: var(--paper-raised);
      stroke-width: 2;
    }

    .marker-label {
      font-size: 11px;
      font-weight: 600;
      fill: var(--ink-soft);
      text-anchor: middle;
      opacity: 0;
      transition: opacity var(--dur-press) var(--ease-out);
      pointer-events: none;
    }

    &:hover .marker-label,
    &.selected .marker-label {
      opacity: 1;
    }

    &.selected .marker-dot {
      fill: var(--stamp-bad);
    }
  }
}

.map-controls {
  position: absolute;
  top: var(--gap-md);
  right: var(--gap-md);
  display: flex;
  flex-direction: column;
  gap: var(--gap-xs);

  .btn {
    background: var(--paper-raised);
    border: 1px solid var(--vellum);
    box-shadow: var(--lift-card);
  }
}

.map-loading,
.map-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--gap-sm);
  color: var(--ink-faint);
  font-size: var(--fs-body-sm);
  pointer-events: none;

  .empty-mark {
    font-size: 34px;
    opacity: 0.5;
  }

  .hint {
    font-size: var(--fs-meta);
    opacity: 0.8;
  }
}

/* ---------------- 双栏 ---------------- */
.map-split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 288px;
  gap: var(--gap-xl);
  align-items: start;
}

/* ---------------- 位置档案 ---------------- */
.point-panel {
  overflow: hidden;
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--gap-md) var(--gap-lg);
  border-bottom: 1px solid var(--vellum);

  .sheet-count {
    font-size: var(--fs-meta);
    color: var(--ink-ghost);
  }
}

.point-list {
  list-style: none;
  margin: 0;
  padding: var(--gap-xs);
  max-height: 460px;
  overflow-y: auto;
}

.point-item {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  width: 100%;
  padding: var(--gap-sm) var(--gap-md);
  font-size: var(--fs-body-sm);
  text-align: left;
  color: var(--ink-soft);
  background: none;
  border: 0;
  border-radius: var(--r-control);
  cursor: pointer;
  transition:
    background-color var(--dur-press) var(--ease-out),
    color var(--dur-press) var(--ease-out);

  &:hover {
    background: var(--paper-tint);
    color: var(--ink);
  }

  &.active {
    background: var(--seal-soft);
    color: var(--seal);
  }

  .pt-label {
    flex: 1;
    min-width: 0;
    font-weight: 550;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pt-coord {
    font-family: var(--font-mono);
    font-size: var(--fs-caption);
    color: var(--ink-ghost);
  }

  .pt-date {
    font-size: var(--fs-caption);
    color: var(--ink-ghost);
  }
}

.point-detail {
  padding: var(--gap-lg);

  .detail-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--gap-sm);
  }

  .detail-excerpt {
    margin-bottom: var(--gap-sm);
    font-size: var(--fs-body-sm);
    color: var(--ink-soft);
  }

  .detail-foot {
    display: flex;
    align-items: center;
    gap: var(--gap-md);
    flex-wrap: wrap;
    font-size: var(--fs-meta);
    color: var(--ink-faint);
  }
}

.error-box {
  padding: var(--gap-md);
  font-size: var(--fs-body-sm);
  color: var(--stamp-bad);
  background: var(--stamp-bad-soft);
  border-radius: var(--r-card);
}
</style>
