<script setup lang="ts">
import type { CalendarCell, Post } from '~/types';

const api = useApi();
const auth = useAuth();

const year = ref(new Date().getFullYear());
const month = ref(new Date().getMonth() + 1);
const cells = ref<CalendarCell[]>([]);
const selectedDate = ref<string>('');
const dayPosts = ref<Post[]>([]);
const loading = ref(false);

const monthLabel = computed(() => `${year.value} 年 ${month.value} 月`);

const weekdays = ['一', '二', '三', '四', '五', '六', '日'];

/** 生成日历网格（含前后补齐的空位） */
const grid = computed(() => {
  const first = new Date(Date.UTC(year.value, month.value - 1, 1));
  const daysInMonth = new Date(Date.UTC(year.value, month.value, 0)).getUTCDate();
  // 周一为一周起点
  const offset = (first.getUTCDay() + 6) % 7;
  const countMap = new Map(cells.value.map((c) => [c.date, c.count]));

  const items: Array<{ date: string; day: number; count: number; inMonth: boolean }> = [];

  for (let i = 0; i < offset; i++) {
    const d = new Date(Date.UTC(year.value, month.value - 1, 1 - (offset - i)));
    items.push({ date: iso(d), day: d.getUTCDate(), count: 0, inMonth: false });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = iso(new Date(Date.UTC(year.value, month.value - 1, d)));
    items.push({ date, day: d, count: countMap.get(date) ?? 0, inMonth: true });
  }

  while (items.length % 7 !== 0) {
    const last = items[items.length - 1];
    const next = new Date(new Date(`${last.date}T00:00:00Z`).getTime() + 86400_000);
    items.push({ date: iso(next), day: next.getUTCDate(), count: 0, inMonth: false });
  }

  return items;
});

/** 把 YYYY-MM-DD 显示成「11 月 6 日 周五」 */
function formatDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${week}`;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function prevMonth() {
  if (month.value === 1) {
    month.value = 12;
    year.value -= 1;
  } else month.value -= 1;
  load();
}

function nextMonth() {
  if (month.value === 12) {
    month.value = 1;
    year.value += 1;
  } else month.value += 1;
  load();
}

function thisMonth() {
  const now = new Date();
  year.value = now.getFullYear();
  month.value = now.getMonth() + 1;
  load();
}

async function load() {
  loading.value = true;
  try {
    const res = await api.calendarBuckets(year.value, month.value);
    cells.value = res.cells;
  } finally {
    loading.value = false;
  }
}

async function selectDate(date: string) {
  selectedDate.value = date;
  try {
    const res = await api.listPosts({
      from: `${date}T00:00:00.000Z`,
      to: `${date}T23:59:59.999Z`,
      pageSize: 50,
    });
    dayPosts.value = res.items;
  } catch {
    dayPosts.value = [];
  }
}

onMounted(async () => {
  await auth.restore();
  await load();
});

useHead({ title: '日历 · 说说后台' });
</script>

<template>
  <div class="calendar-page">
    <header class="page-head">
      <div class="head-title">
        <span class="meta-label">梳理</span>
        <h1>日历</h1>
      </div>
      <div class="month-nav">
        <button class="btn btn-quiet btn-icon btn-sm" aria-label="上个月" @click="prevMonth">‹</button>
        <span class="month-label tabular">{{ monthLabel }}</span>
        <button class="btn btn-quiet btn-icon btn-sm" aria-label="下个月" @click="nextMonth">›</button>
        <button class="btn btn-sm" @click="thisMonth">回到本月</button>
      </div>
    </header>

    <div class="cal-split">
      <!-- 月历 -->
      <section class="calendar sheet">
        <div class="weekday-row">
          <span v-for="w in weekdays" :key="w" class="weekday">{{ w }}</span>
        </div>

        <div v-if="loading" class="calendar-loading">
          <span class="spinner" />
        </div>

        <div v-else class="day-grid">
          <button
            v-for="cell in grid"
            :key="cell.date"
            class="day-cell"
            :class="{
              'in-month': cell.inMonth,
              'has-post': cell.count > 0,
              selected: selectedDate === cell.date,
              today: cell.date === iso(new Date()),
            }"
            :aria-label="`${cell.date}${cell.count ? `，${cell.count} 条记录` : '，无记录'}`"
            @click="selectDate(cell.date)"
          >
            <span class="day-num">{{ cell.day }}</span>
            <span v-if="cell.count > 0" class="day-dot" aria-hidden="true" />
          </button>
        </div>

        <p class="cal-legend">
          <span class="legend-item"><span class="legend-dot" /> 有记录</span>
          <span class="legend-item"><span class="legend-ring" /> 今天</span>
        </p>
      </section>

      <!-- 当日记录 -->
      <section class="day-panel">
        <template v-if="selectedDate">
          <div class="detail-head">
            <div>
              <span class="meta-label">当日</span>
              <h2>{{ formatDay(selectedDate) }}</h2>
            </div>
            <span class="tabular detail-count">{{ dayPosts.length }} 条</span>
          </div>

          <PostCard v-for="post in dayPosts" :key="post.id" :post="post" :show-author="false" />

          <div v-if="!dayPosts.length" class="empty sheet">
            <p>这一天还没有记录。</p>
            <NuxtLink to="/new" class="btn btn-seal btn-sm empty-action">写一条</NuxtLink>
          </div>
        </template>

        <div v-else class="empty sheet">
          <span class="empty-mark" aria-hidden="true">▦</span>
          <p>选择左侧的日期，查看那天的记录。</p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.calendar-page {
  display: flex;
  flex-direction: column;
  gap: var(--gap-lg);
}

.page-head {
  display: flex;
  align-items: center;
  gap: var(--gap-md);
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
}

.month-nav {
  display: flex;
  align-items: center;
  gap: var(--gap-sm);
  margin-left: auto;

  .month-label {
    min-width: 110px;
    font-size: var(--fs-body-sm);
    font-weight: 600;
    text-align: center;
  }
}

.cal-split {
  display: grid;
  grid-template-columns: 380px minmax(0, 1fr);
  gap: var(--gap-xl);
  align-items: start;
}

.calendar {
  padding: var(--gap-md);
  overflow: hidden;
}

.weekday-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: var(--gap-sm);

  .weekday {
    padding: var(--gap-xs);
    font-size: var(--fs-caption);
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--ink-faint);
    text-align: center;
  }
}

.calendar-loading {
  display: grid;
  place-items: center;
  padding: var(--gap-3xl);
}

.day-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.day-cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  aspect-ratio: 1;
  min-height: 44px;
  padding: 2px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--r-control);
  cursor: pointer;
  transition:
    background-color var(--dur-press) var(--ease-out),
    border-color var(--dur-press) var(--ease-out),
    transform var(--dur-press) var(--ease-out);

  &:hover {
    border-color: var(--vellum-strong);
  }

  &:active {
    transform: scale(0.97);
  }

  // 本月的格子略微提亮，其余淡出
  &.in-month {
    background: var(--paper-raised);
  }

  &.selected {
    background: var(--seal-soft);
    border-color: var(--seal);
  }

  // 今天：一圈细环，不靠颜色区分
  &.today .day-num {
    color: var(--seal);
    font-weight: 600;
  }

  .day-num {
    font-size: var(--fs-body-sm);
    color: var(--ink-soft);
    font-variant-numeric: tabular-nums;
  }

  // 有记录：一枚墨点
  .day-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--seal);
  }

  &.selected .day-num {
    color: var(--seal);
  }
}

.cal-legend {
  display: flex;
  gap: var(--gap-lg);
  margin: var(--gap-md) 0 0;
  padding-top: var(--gap-md);
  border-top: 1px solid var(--vellum-soft);
  font-size: var(--fs-caption);
  color: var(--ink-faint);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: var(--gap-xs);

  .legend-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--seal);
  }

  .legend-ring {
    width: 10px;
    height: 10px;
    border: 1px solid var(--seal);
    border-radius: 50%;
  }
}

/* ---------------- 当日面板 ---------------- */
.day-panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--gap-md);
}

.detail-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--gap-md);
  padding-bottom: var(--gap-sm);
  border-bottom: 1px solid var(--vellum);

  .meta-label {
    display: block;
    margin-bottom: 2px;
  }

  h2 {
    margin: 0;
    font-size: var(--fs-h3);
  }

  .detail-count {
    font-size: var(--fs-meta);
    color: var(--ink-faint);
  }
}

.empty.sheet {
  padding: var(--gap-3xl) var(--gap-xl);
}

@media (max-width: 640px) {
  .day-cell {
    min-height: 34px;
    font-size: var(--fs-meta);
  }
}
</style>
