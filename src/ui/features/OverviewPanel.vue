<script setup lang="ts">
import { species } from '../../core/content';
import { assigned, idle, populationCapacity } from '../../core/game';
import type { PanelProps } from '../model';
defineProps<PanelProps>();
</script>
<template>
  <section class="panel" :aria-label="t('colonySummary')">
    <div class="section-head"><h2>{{ t('planetSpecies') }}</h2><span>{{ t('populationCount', { n: state.population.base + state.population.mineral, max: populationCapacity(state, 'base') + populationCapacity(state, 'mineral') }) }}</span></div>
    <ul class="population-chart">
      <template v-for="sp in species" :key="sp">
        <li v-if="populationCapacity(state, sp) > 0">
          <div>
            <strong>{{ t(sp === 'base' ? state.branch : sp) }}</strong>
            <span>{{ t('populationCount', { n: state.population[sp], max: populationCapacity(state, sp) }) }}</span>
          </div>
          <div
            class="population-track"
            role="meter"
            :aria-label="t(sp === 'base' ? state.branch : sp)"
            :aria-valuenow="state.population[sp]"
            :aria-valuemin="0"
            :aria-valuemax="populationCapacity(state, sp)"
          >
            <span :style="{ width: state.population[sp] / populationCapacity(state, sp) * 100 + '%' }" />
          </div>
          <small>{{ t('allocation', { used: assigned(state, sp), total: state.population[sp] }) }} / {{ t('idle') }} {{ idle(state, sp) }}</small>
        </li>
      </template>
    </ul>
  </section>
</template>
