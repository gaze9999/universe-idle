<script setup lang="ts">
import { resources } from '../../core/content';
import type { Cost } from '../../core/content';
import type { GameState } from '../../core/game';
import type { Tr } from '../model';
defineProps<{ cost: Cost; state: GameState; t: Tr; }>();
</script>
<template>
  <div class="cost">
    <template v-for="r in resources" :key="r">
      <span v-if="cost[r]" :class="state.resources[r] + 1e-8 < (cost[r] ?? 0) ? 'short' : 'enough'">{{ t(r) }} {{ cost[r] }}</span>
    </template>
  </div>
</template>
