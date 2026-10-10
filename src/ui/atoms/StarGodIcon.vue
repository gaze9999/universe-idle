<script setup lang="ts">
import type { StarGod } from '../../core/content';
defineProps<{ id: StarGod; }>();
const symbols: Record<StarGod, string> = {
  grove: 'M12 3 20 13h-5l5 7H4l5-7H4Zm-1 17h2v3h-2Z',
  peak: 'M1 21 9 6l4 6 3-9 7 18Zm7-9-3 6h5Zm8-3-3 9h6Z',
  harvest: 'M11 4h2v19h-2ZM10 5 5 2v6l5 3Zm4 0 5-3v6l-5 3Zm-4 8-5-3v6l5 3Zm4 0 5-3v6l-5 3Z',
  foundation: 'M2 21V7h4v4h4V3h4v8h4V7h4v14Zm3-3h14v-4H5Z',
  craft: 'M3 4h18v4l-6 4v5l4 3v2H5v-2l4-3v-5L3 8Z',
  insight: 'M1 12 12 4l11 8-11 8Zm4 0 7 5 7-5-7-5Zm7-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  frontier: 'M11 1h2v9l9-5-6 8 6 8-9-4v6h-2v-6l-9 4 6-8-6-8 9 5Z',
  earth: 'M12 1 23 12 12 23 1 12Zm0 4L5 12l7 7 7-7Zm-5 6h10v2H7Z',
  forge: 'M4 20V9l5 3-1-9 8 7-2 3 6-4v11Zm3-3h10l-2-3-4 2-4-3Z',
  discovery: 'M12 1 15 8l8 4-8 3-3 8-3-8-8-3 8-4Zm0 6-2 5 2 5 2-5Z',
  harmony: 'M3 5h7v3H6v8h4v3H3Zm11 0h7v14h-7v-3h4V8h-4ZM8 11h8v2H8Z',
  creation: 'M12 1 17 6l-3 4 8 2-8 3 3 4-5 4-5-4 3-4-8-3 8-2-3-4Zm0 7-4 4 4 4 4-4Z',
};
</script>
<template><svg class="icon star-god-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path :d="symbols[id]" fill-rule="evenodd" /></svg></template>
