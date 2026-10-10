<script setup lang="ts">
import { capacity } from '../../core/game';
import type { flow } from '../../core/game';
import type { PanelProps } from '../model';
defineProps<PanelProps & { production: ReturnType<typeof flow>; fmt: (value: number, decimals?: number) => string; }>();
</script>
<template>
  <h2>{{ t('resourcesTitle') }}</h2>
  <div class="resource-list">
    <section v-for="r in view.resources" :key="r" class="resource" :aria-label="t(r)">
      <div>
        <span>{{ t(r) }}</span>
        <strong>{{ fmt(state.resources[r]) }}<span> / {{ fmt(capacity(state)) }}</span></strong>
      </div>
      <small>{{ production.displayRates[r] >= 0 ? '+' : '' }}{{ fmt(production.displayRates[r], 3) }} /s</small>
      <div class="resource-track">
        <span :style="{ width: state.resources[r] / capacity(state) * 100 + '%' }" />
      </div>
    </section>
  </div>
</template>
