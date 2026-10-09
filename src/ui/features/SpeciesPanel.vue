<script setup lang="ts">
import { species, spawnCosts } from '../../core/content';
import { has, populationCapacity, spawnReason } from '../../core/game';
import { speciesAptitude, speciesTraits } from '../../core/world';
import type { PanelProps } from '../model';
import CostLine from '../molecules/CostLine.vue';
defineProps<PanelProps>();
</script>
<template>
  <section v-if="has(state, 'habitat') && state.branch === 'base'" class="panel">
    <div class="section-head">
      <h2>{{ t('branchTitle') }}</h2>
      <small>{{ t('branchHelp') }}</small>
    </div>
    <div class="card-grid">
      <div v-for="id in (['forest', 'symbiosis'] as const)" :key="id" class="choice">
        <h3>{{ t(id) }}</h3>
        <p>{{ t(id + 'Desc') }}</p>
        <button class="primary" @click="send({ type: 'branch', id })">{{ t('choose') }}</button>
      </div>
    </div>
  </section>
  <div class="card-grid">
    <template v-for="sp in species" :key="sp">
      <section v-if="populationCapacity(state, sp) > 0" class="panel species-card">
        <div class="section-head">
          <h2>{{ t(sp === 'base' ? state.branch : sp) }}</h2>
          <span class="badge">{{ t('populationCount', { n: state.population[sp], max: populationCapacity(state, sp) }) }}</span>
        </div>
        <p>{{ t(sp === 'base' ? 'baseUpkeep' : 'mineralUpkeep') }}</p>
        <ul class="aptitudes">
          <template v-for="job in view.jobs" :key="job">
            <li v-if="speciesAptitude(state.world, state.branch, sp, job) > 0">{{ t('work' + job) }} <strong>{{ speciesAptitude(state.world, state.branch, sp, job).toFixed(2) }}x</strong></li>
          </template>
          <li>{{ t('magicAffinity') }} <strong>{{ speciesTraits(state.branch, sp).magic.toFixed(2) }}x</strong></li>
          <li>{{ t('vitalityAffinity') }} <strong>{{ speciesTraits(state.branch, sp).vitality.toFixed(2) }}x</strong></li>
        </ul>
        <div class="species-action">
          <CostLine :state="state" :cost="spawnCosts[sp]" :t="t" />
          <button class="primary" :disabled="!!spawnReason(state, sp)" @click="send({ type: 'spawn', sp })">{{ t(spawnReason(state, sp) ?? 'spawn') }}</button>
        </div>
      </section>
    </template>
  </div>
</template>
