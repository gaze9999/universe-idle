<script setup lang="ts">
import { achievementIds } from '../../core/content';
import { achievementProgress } from '../../core/game';
import type { PanelProps } from '../model';
import type { Language } from '../../i18n';
defineProps<PanelProps & { child: string; language: Language; }>();
</script>
<template>
  <p class="list-summary">{{ t('achievementCount', { n: Object.keys(state.achievements).length, max: achievementIds.length }) }}</p>
  <p v-if="child === 'permanentBonuses' && !Object.keys(state.achievements).length">{{ t('noPermanentBonuses') }}</p>
  <div class="card-grid">
    <template v-for="id in view.achievements" :key="id">
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
          <progress :value="achievementProgress(state, id)" :max="1" :aria-label="t('achievement' + id)" />
          <small>{{ Math.floor(achievementProgress(state, id) * 100) }}%</small>
          <small v-if="state.achievements[id] !== undefined">{{ state.achievements[id] === null ? t('earnedDateUnknown') : t('earnedAt', { time: new Date(state.achievements[id]!).toLocaleString(language) }) }}</small>
        </template>
      </section>
    </template>
  </div>
</template>
