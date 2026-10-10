<script setup lang="ts">
import { species } from '../../core/content';
import { assigned, idle, slots } from '../../core/game';
import { speciesAptitude } from '../../core/world';
import type { PanelProps } from '../model';
const props = defineProps<PanelProps>();
const support = (sp: typeof species[number], job: typeof props.view.jobs[number]) => speciesAptitude(props.state.world, props.state.branch, sp, job);
const total = (job: typeof props.view.jobs[number]) => species.reduce((n, sp) => n + props.state.assignments[sp][job], 0);
</script>
<template>
  <h2>{{ t('planetSpecies') }}</h2>
  <template v-for="sp in species" :key="sp">
    <section v-if="state.population[sp] > 0" class="panel">
      <div class="section-head">
        <h2>{{ t(sp === 'base' ? state.branch : sp) }}</h2>
        <span class="worker-summary">{{ t('allocation', { used: assigned(state, sp), total: state.population[sp] }) }} / {{ t('idle') }} {{ idle(state, sp) }}</span>
      </div>
      <div class="work-list">
        <template v-for="job in view.jobs" :key="job">
          <div v-if="support(sp, job) > 0" class="work-row">
            <div>
              <strong>{{ t('work' + job) }}</strong>
              <small>{{ t('efficiency') }} {{ support(sp, job).toFixed(2) }}x <template v-if="Number.isFinite(slots(state, job))"> / {{ t('slots') }} {{ total(job) }}/{{ slots(state, job) }}</template></small>
            </div>
            <div class="stepper">
              <button :aria-label="t('removeWorker', { species: t(sp === 'base' ? state.branch : sp), job: t('work' + job) })" :disabled="!state.assignments[sp][job]" @click="send({ type: 'assign', sp, job, delta: -1 })">−</button>
              <strong>{{ state.assignments[sp][job] }}</strong>
              <button :aria-label="t('addWorker', { species: t(sp === 'base' ? state.branch : sp), job: t('work' + job) })" :disabled="!idle(state, sp) || total(job) >= slots(state, job)" @click="send({ type: 'assign', sp, job, delta: 1 })">+</button>
            </div>
          </div>
        </template>
      </div>
    </section>
  </template>
</template>
