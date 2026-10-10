<script setup lang="ts">
import type { GameSymbol } from '../icons';
defineProps<{ icon: GameSymbol; }>();
</script>
<template>
  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path :d="icon.path" fill-rule="evenodd" />
  </svg>
</template>
