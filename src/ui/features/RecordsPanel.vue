<script setup lang="ts">
import { computed, ref } from 'vue';
import { has } from '../../core/game';
import { duration } from '../../i18n';
import type { PanelProps } from '../model';
import { recordCategories, recordCategory } from '../projection';
import type { RecordCategory } from '../projection';
const props = defineProps<PanelProps & { child: string; }>();
const milestones = ['habitat', 'lumberyard', 'warehouse', 'laboratory', 'crafting', 'workshop', 'planning', 'monument'];
const next = computed(() => milestones.find(id => !has(props.state, id)));
const category = ref<RecordCategory>('all');
const entries = computed(() => props.state.log.filter(entry => entry.key !== 'starved' && (category.value === 'all' || recordCategory(entry.key) === category.value)).reverse());
</script>
<template>
  <section v-if="child === 'journalTab'" class="panel journal" :aria-label="t('journal')">
    <div class="section-head"><h2>{{ t('journal') }}</h2><select v-model="category" :aria-label="t('recordFilter')"><option v-for="id in recordCategories" :key="id" :value="id">{{ t('record' + id) }}</option></select></div>
    <ol>
      <li v-for="(entry, i) in entries" :key="`${i}-${entry.at}`">
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
