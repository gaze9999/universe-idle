<script setup lang="ts">
import { ref, watchEffect } from 'vue';
import { branches } from '../../core/content';
import type { Branch } from '../../core/content';
import { reward } from '../../core/game';
import type { PanelProps } from '../model';
import ActionCard from '../molecules/ActionCard.vue';
const props = defineProps<PanelProps>();
const emit = defineEmits<{ confirm: [kind: 'reset' | 'abandon', start: Branch]; }>();
const start = ref<Branch>('base');
watchEffect(() => { if (start.value !== 'base' && (!props.state.legacy.startChoice || !props.state.legacy.discovered.includes(start.value))) start.value = 'base'; });
const cost = (id: 'startChoice' | 'templates' | 'tools') => id === 'tools' ? 20 * 2 ** props.state.legacy.tools : 10;
</script>
<template>
  <section class="panel">
    <div class="legacy-stats">
      <div>{{ t('legacyPoints') }}<strong>{{ state.legacy.points }}</strong></div>
      <div>{{ t('availableReward') }}<strong>{{ reward(state) }}</strong></div>
      <div>{{ t('resetCount') }}<strong>{{ state.legacy.resets }}</strong></div>
    </div>
    <label v-if="state.legacy.startChoice">{{ t('newForm') }}<select v-model="start"><template v-for="id in branches" :key="id"><option v-if="id === 'base' || state.legacy.discovered.includes(id)" :value="id">{{ t(id) }}</option></template></select></label>
    <div class="button-row">
      <button class="primary" :disabled="!reward(state)" @click="emit('confirm', 'reset', start)">{{ t('reset') }}</button>
      <button class="danger" @click="emit('confirm', 'abandon', start)">{{ t('abandon') }}</button>
    </div>
  </section>
  <div class="build-list">
    <template v-for="id in (['startChoice', 'templates', 'tools'] as const)" :key="id">
      <ActionCard
        v-if="id === 'tools' || !state.legacy[id]"
        :title="t(id)"
        :description="t(id + 'Desc')"
        :badge="id === 'tools' ? t('level', { n: state.legacy.tools }) : undefined"
      >
        <p v-if="id !== 'tools' || state.legacy.tools < 5" class="cost">{{ cost(id) }} {{ t('legacyPoints') }}</p>
        <template #action>
          <button v-if="id !== 'tools' || state.legacy.tools < 5" :disabled="state.legacy.points < cost(id)" @click="send({ type: 'meta', id })">{{ t('buy') }}</button>
        </template>
      </ActionCard>
    </template>
  </div>
  <section v-if="state.legacy.templates" class="panel">
    <h2>{{ t('templates') }}</h2>
    <div class="button-row">
      <button @click="send({ type: 'saveTemplate' })">{{ t('saveTemplate') }}</button>
      <button :disabled="!state.template" @click="send({ type: 'applyTemplate' })">{{ t('applyTemplate') }}</button>
    </div>
  </section>
</template>
