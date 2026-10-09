<script setup lang="ts">
import { computed, ref } from 'vue';
import { species } from '../../core/content';
import { assigned, idle, populationCapacity } from '../../core/game';
import { environment, nativeCivilization } from '../../core/world';
import { regionEnvironment, regionIds } from '../../core/regions';
import { duration } from '../../i18n';
import type { PanelProps } from '../model';
const props = defineProps<PanelProps & { child: string; }>();
const selectedRegion = ref<typeof regionIds[number]>('home');
const env = computed(() => selectedRegion.value === 'home' ? environment(props.state.world) : regionEnvironment(props.state.world, selectedRegion.value));
const civilization = computed(() => nativeCivilization(props.state.world));
</script>
<template>
  <section v-if="child !== 'environmentDetails'" class="panel" :aria-label="t('colonySummary')">
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
  <section v-else class="panel" :aria-label="t('planetTitle')">
    <label>{{ t('region') }}<select v-model="selectedRegion"><option v-for="id in regionIds" :key="id" :value="id">{{ t('region' + id) }}</option></select></label>
    <p>{{ t('regionHelp') }}</p>
    <dl class="summary-grid">
      <div>
        <dt>{{ t('universeTitle') }}</dt>
        <dd>{{ t('universe' + state.world.universe) }}</dd>
      </div>
      <div>
        <dt>{{ t('rotation') }}</dt>
        <dd>{{ duration(env.rotation) }}</dd>
      </div>
      <div>
        <dt>{{ t('orbit') }}</dt>
        <dd>{{ t('planetDays', { n: env.orbitDays }) }}</dd>
      </div>
      <div>
        <dt>{{ t('gravity') }}</dt>
        <dd>{{ env.gravity.toFixed(2) }} g</dd>
      </div>
      <div>
        <dt>{{ t('moisture') }}</dt>
        <dd>{{ Math.round(env.moisture * 100) }}%</dd>
      </div>
      <div>
        <dt>{{ t('weather') }}</dt>
        <dd>{{ t(env.weather) }}</dd>
      </div>
      <div>
        <dt>{{ t('season') }}</dt>
        <dd>{{ t(env.season) }} / {{ t(env.daylight ? 'daylight' : 'night') }}</dd>
      </div>
      <div>
        <dt>{{ t('vitalityField') }}</dt>
        <dd>{{ Math.round(env.vitality * 100) }}%</dd>
      </div>
      <div>
        <dt>{{ t('arcanePotential') }}</dt>
        <dd>{{ Math.round(env.arcane * 100) }}%</dd>
      </div>
      <div>
        <dt>{{ t('magicWindPulse') }}</dt>
        <dd>{{ Math.round(env.magicWind * 100) }}%</dd>
      </div>
    </dl>
    <h2>{{ t('outdoorModifiers') }}</h2>
    <dl class="summary-grid">
      <div v-for="job in (['wood', 'stone', 'food', 'build'] as const)" :key="job">
        <dt>{{ t('work' + job) }}</dt>
        <dd>{{ Math.round(env.factors[job] * env.weatherFactors[job] * 100) }}%</dd>
      </div>
    </dl>
    <small>{{ t('shelteredWork') }}</small>
    <h2 class="native-heading">{{ t('nativeCivilization') }}</h2>
    <dl class="summary-grid native-civilization">
      <div>
        <dt>{{ t('nativeIntelligence') }}</dt>
        <dd>{{ t('native' + civilization.species.archetype) }}</dd>
      </div>
      <div>
        <dt>{{ t('civilizationDevelopment') }}</dt>
        <dd>{{ t('development' + civilization.development) }}</dd>
      </div>
    </dl>
    <small>{{ t('nativeRelationHelp') }}</small>
  </section>
</template>
