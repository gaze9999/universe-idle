<script setup lang="ts">
import { achievementIds } from '../../core/content';
import type { PanelProps } from '../model';
defineProps<PanelProps & { child: string; }>();
</script>
<template>
  <p class="list-summary">{{ t('achievementCount', { n: Object.keys(state.achievements).length, max: achievementIds.length }) }}</p>
  <p v-if="child === 'permanentBonuses' && !Object.keys(state.achievements).length">{{ t('noPermanentBonuses') }}</p>
  <div class="card-grid">
    <template v-for="id in achievementIds" :key="id">
      <section
        v-if="child !== 'permanentBonuses' || state.achievements[id] !== undefined"
        class="panel achievement"
        :class="{ earned: state.achievements[id] !== undefined }"
      >
        <div class="section-head">
          <h2>{{ t('achievement' + id) }}</h2>
          <span class="badge">{{ t(state.achievements[id] !== undefined ? 'earned' : 'unearned') }}</span>
        </div>
        <p v-if="child !== 'permanentBonuses'">{{ t('achievement' + id + 'Desc') }}</p>
        <p class="teal">{{ t('bonus' + id) }}</p>
        <template v-if="child !== 'permanentBonuses'">
          <template v-if="id === 'endurance'">
            <progress :value="Math.min(300, state.stats.severeSeconds)" :max="300" :aria-label="t('achievement' + id)" />
            <small>{{ Math.floor(Math.min(300, state.stats.severeSeconds)) }} / 300 {{ t('seconds') }}</small>
          </template>
          <small v-if="state.achievements[id] !== undefined">{{ state.achievements[id] === null ? t('earnedDateUnknown') : t('earnedAt', { time: new Date(state.achievements[id]!).toLocaleString() }) }}</small>
        </template>
      </section>
    </template>
  </div>
</template>
