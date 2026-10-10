<script setup lang="ts">
import { starGodIds } from '../../core/content';
import type { StarGod } from '../../core/content';
import type { PanelProps } from '../model';
import ActionCard from '../molecules/ActionCard.vue';
import InfoTip from '../atoms/InfoTip.vue';
import StarGodIcon from '../atoms/StarGodIcon.vue';
defineProps<PanelProps>();
const emit = defineEmits<{ select: [id: StarGod]; }>();
</script>
<template>
  <section v-if="state.starGod" class="panel">
    <div class="section-head"><h2>{{ t('starGod' + state.starGod) }}</h2><InfoTip :text="t('starGodHelp')" /></div>
    <p class="teal">{{ t('starGod' + state.starGod + 'Desc') }}</p>
  </section>
  <template v-else>
    <div class="list-toolbar"><InfoTip :text="t('starGodHelp')" /></div>
    <div class="build-list">
      <ActionCard v-for="id in starGodIds" :key="id" :title="t('starGod' + id)" :description="t('starGod' + id + 'Desc')">
        <template #action><span class="deity-symbol"><StarGodIcon :id="id" /></span><button @click="emit('select', id)">{{ t('choose') }}</button></template>
      </ActionCard>
    </div>
  </template>
</template>
