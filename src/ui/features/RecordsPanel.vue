<script setup lang="ts">
import { computed } from 'vue';
import { has } from '../../core/game';
import { duration } from '../../i18n';
import type { PanelProps } from '../model';
const props = defineProps<PanelProps & { child: string; }>();
const milestones = ['habitat', 'lumberyard', 'warehouse', 'laboratory', 'crafting', 'workshop', 'planning', 'monument'];
const next = computed(() => milestones.find(id => !has(props.state, id)));
</script>
<template>
  <section v-if="child === 'journalTab'" class="panel journal" :aria-label="t('journal')">
    <ol>
      <li v-for="(entry, i) in [...state.log].reverse()" :key="`${state.log.length - i}-${entry.at}`">
        <time>{{ duration(entry.at) }}</time>
        <span>{{ t(entry.key, { item: entry.item ? t(entry.item) : '' }) }}</span>
      </li>
    </ol>
  </section>
  <section v-else class="panel" :aria-label="t('progress')">
    <ol class="milestones">
      <template v-for="id in milestones" :key="id">
        <li v-if="has(state, id) || id === next" :class="{ reached: has(state, id) }"><span>{{ has(state, id) ? '✓' : '○' }}</span>{{ t(id) }}</li>
      </template>
    </ol>
  </section>
</template>
