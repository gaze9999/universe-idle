<script setup lang="ts">defineProps<{ planet: boolean; }>();</script>
<template>
  <div class="game-layout" :class="{ 'global-layout': !planet }">
    <aside v-if="planet" class="resource-sidebar">
      <slot name="resources" />
    </aside>
    <div class="game-content">
      <slot name="navigation" />
      <div class="workspace">
        <main>
          <slot />
        </main>
        <aside class="queue-sidebar">
          <slot name="queue" />
        </aside>
      </div>
    </div>
  </div>
</template>
