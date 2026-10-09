<script setup lang="ts">
import { faPause, faPlay, faXmark } from '@fortawesome/free-solid-svg-icons';
import { count, queueCapacity, taskDef } from '../../core/game';
import type { flow } from '../../core/game';
import { duration } from '../../i18n';
import { useDragSort } from '../composables/useDragSort';
import GameIcon from '../atoms/GameIcon.vue';
import type { PanelProps } from '../model';
const props = defineProps<PanelProps & { disabled: boolean; paused: boolean; production: ReturnType<typeof flow>; }>();
const { target, bind } = useDragSort(() => props.state.queue, (from, to) => props.send({ type: 'reorderQueued', from, to }), () => props.disabled);
const time = (work: number) => duration(props.production.constructionSpeed ? work / props.production.constructionSpeed : Infinity);
const definition = (index: number) => { const id = props.state.queue[index]; return taskDef(id, count(props.state, id) + (props.state.task?.id === id ? 1 : 0) + props.state.queue.slice(0, index).filter(b => b === id).length); };
</script>
<template>
  <section class="panel construction-panel">
    <div class="section-head">
      <h2>{{ t('buildQueue') }}</h2>
      <div class="button-row">
        <span class="badge" :title="t('queueCapacityHelp')">{{ state.queue.length + (state.task ? 1 : 0) }} / {{ queueCapacity(state) }}</span>
        <button
          v-if="state.queue.length"
          class="queue-control"
          :disabled="disabled"
          :title="t(state.queuePaused ? 'resumeQueue' : 'pauseQueue')"
          :aria-label="t(state.queuePaused ? 'resumeQueue' : 'pauseQueue')"
          :aria-pressed="state.queuePaused"
          @click="send({ type: 'pauseQueue' })"
        >
          <GameIcon :icon="state.queuePaused ? faPlay : faPause" />
        </button>
      </div>
    </div>
    <span id="queue-drag-help" class="sr-only">{{ t('queueDragHelp') }}</span>
    <p v-if="!state.task && !state.queue.length">{{ t('noTask') }}</p>
    <ol class="queue-list" data-sort-list>
      <li
        v-if="state.task"
        class="active-construction"
        :title="t(state.task.paused || paused ? 'paused' : !production.buildSpeed ? 'noBuilders' : 'activeBuild')"
      >
        <div class="queue-row">
          <div class="queue-project">
            <strong>{{ t(state.task.id) }}</strong>
            <time :title="t('queueTimeHelp')">{{ time(state.task.work - state.task.progress) }}</time>
          </div>
          <div class="queue-actions">
            <button
              class="queue-control"
              :disabled="disabled"
              :title="t(state.task.paused ? 'resume' : 'pause')"
              :aria-label="t(state.task.paused ? 'resume' : 'pause')"
              :aria-pressed="state.task.paused"
              @click="send({ type: 'pauseBuild' })"
            >
              <GameIcon :icon="state.task.paused ? faPlay : faPause" />
            </button>
            <button
              class="queue-control danger"
              :disabled="disabled"
              :title="t('cancel')"
              :aria-label="t('cancel')"
              @click="send({ type: 'cancelBuild' })"
            >
              <GameIcon :icon="faXmark" />
            </button>
          </div>
        </div>
        <progress :value="state.task.progress" :max="state.task.work" :aria-label="t('progress')" />
      </li>
      <li v-for="(id, index) in state.queue" :key="index" :data-sort-index="index" :class="{ 'drop-target': target === index }">
        <div class="queue-row">
          <button
            class="queue-project queue-drag"
            :disabled="disabled"
            :aria-label="t('queueDrag', { item: t(id) })"
            aria-describedby="queue-drag-help"
            aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
            v-bind="bind(index)"
          >
            <strong>{{ t(id) }}</strong>
            <time :title="t('queueTimeHelp')">{{ time(definition(index).work) }}</time>
          </button>
          <div class="queue-actions">
            <button
              class="queue-control danger"
              :disabled="disabled"
              :aria-label="t('queueRemove', { item: t(id) })"
              :title="t('queueRemove', { item: t(id) })"
              @click="send({ type: 'removeQueued', index })"
            >
              <GameIcon :icon="faXmark" />
            </button>
          </div>
        </div>
      </li>
    </ol>
  </section>
</template>
