<script setup lang="ts">
import type { faGear } from '@fortawesome/free-solid-svg-icons';
import { computed } from 'vue';
const props = defineProps<{ icon: typeof faGear; }>();
const paths = computed(() => Array.isArray(props.icon.icon[4]) ? props.icon.icon[4] : [props.icon.icon[4]]);
</script>
<template>
  <svg class="icon" :viewBox="`0 0 ${icon.icon[0]} ${icon.icon[1]}`" aria-hidden="true" focusable="false">
    <path v-for="(d, i) in paths" :key="i" :d="d" />
  </svg>
</template>
