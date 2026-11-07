<script setup lang="ts">
const theme = useTheme();
const auth = useAuth();

// 提前应用主题，避免首屏闪烁
if (import.meta.client) {
  theme.init();
}
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
