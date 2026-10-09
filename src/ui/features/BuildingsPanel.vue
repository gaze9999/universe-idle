<script setup lang="ts">
import { buildingLimitReached, count, ordered, queueReason, taskDef } from '../../core/game';
import { structures } from '../../core/content';
import type { PanelProps } from '../model';
import ActionCard from '../molecules/ActionCard.vue';
import CostLine from '../molecules/CostLine.vue';
const props = defineProps<PanelProps & { showCompleted: boolean; }>();
const emit = defineEmits<{ toggle: []; }>();
const definition = (id: typeof props.view.tasks[number]) => taskDef(id, structures[id].limit === 1 ? 0 : ordered(props.state, id));
const countLabel = (id: typeof props.view.tasks[number]) => props.t('buildingCount', { n: count(props.state, id) }) + (structures[id].limit === 1 ? ', ' + props.t('uniqueBuilding') : '');
function actionHint(id: typeof props.view.tasks[number]): string {
  const reason = queueReason(props.state, id);
  return props.t(reason === 'completed' && !buildingLimitReached(props.state, id) ? 'buildingQueued' : reason ?? 'build');
}
</script>
<template>
  <div class="list-toolbar">
    <label><input type="checkbox" :checked="showCompleted" @change="emit('toggle')" />{{ t('showCompleted') }}</label>
  </div>
  <p v-if="!view.tasks.length">{{ t('noAvailableBuildings') }}</p>
  <div class="build-list">
    <ActionCard
      v-for="id in view.tasks"
      :key="id"
      :title="t(id)"
      :description="t(id + 'Desc')"
      :done="buildingLimitReached(state, id)"
      :badge="String(count(state, id))"
      :badge-label="countLabel(id)"
    >
      <template v-if="!buildingLimitReached(state, id)">
        <CostLine :cost="definition(id).cost" :state="state" :t="t" />
        <small>{{ definition(id).work }} {{ t('workUnit') }}<template v-if="ordered(state, id) > count(state, id)"> / {{ t('plannedCount', { n: ordered(state, id) - count(state, id) }) }}</template></small>
      </template>
      <template #action>
        <button v-if="!buildingLimitReached(state, id)" :class="queueReason(state, id) ? 'secondary' : 'primary'" :disabled="!!queueReason(state, id)" :title="actionHint(id)" :aria-label="t('build') + ' ' + t(id) + ', ' + actionHint(id)" @click="send({ type: 'build', id })">{{ t('build') }}</button>
      </template>
    </ActionCard>
  </div>
</template>
