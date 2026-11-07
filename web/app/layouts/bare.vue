<script setup lang="ts">
/** 登录页使用的极简外壳：只有内容区，没有侧栏与工具条。 */
</script>

<template>
  <div class="bare">
    <slot />
  </div>
</template>

<style scoped>
.bare {
  min-height: 100dvh;
}
</style>
