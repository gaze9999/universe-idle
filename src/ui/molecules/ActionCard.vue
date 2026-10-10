<script setup lang="ts">
defineProps<{ title: string; description?: string; badge?: string; badgeLabel?: string; done?: boolean; }>();
</script>
<template>
  <section class="panel action-card" :class="{ done }">
    <div class="section-head">
      <h2>{{ title }}</h2>
      <span v-if="badge" class="badge" :aria-label="badgeLabel">{{ badge }}</span>
    </div>
    <p v-if="description">{{ description }}</p>
    <div class="action-details">
      <slot />
    </div>
    <slot name="action" />
  </section>
</template>
