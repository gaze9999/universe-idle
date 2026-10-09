<script setup lang="ts">
import { computed } from 'vue';
import { researchDefs } from '../../core/content';
import { researchReason } from '../../core/game';
import type { PanelProps } from '../model';
import ActionCard from '../molecules/ActionCard.vue';
import CostLine from '../molecules/CostLine.vue';
const props = defineProps<PanelProps & { child: string; }>();
const visible = computed(() => props.view.research.filter(id => props.state.research.includes(id) === (props.child === 'completedResearch')));
</script>
<template>
  <p v-if="!visible.length">{{ t(child === 'completedResearch' ? 'noCompletedResearch' : 'noAvailableResearch') }}</p>
  <div class="build-list">
    <ActionCard v-for="id in visible" :key="id" :title="t(id)" :description="t(id + 'Desc')">
      <CostLine v-if="!state.research.includes(id)" :cost="{ knowledge: researchDefs[id].cost }" :state="state" :t="t" />
      <template #action>
        <button v-if="!state.research.includes(id)" class="primary" :disabled="!!researchReason(state, id)" @click="send({ type: 'research', id })">{{ t(researchReason(state, id) ?? 'purchase') }}</button>
      </template>
    </ActionCard>
  </div>
</template>
