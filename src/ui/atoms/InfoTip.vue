<script setup lang="ts">
import { nextTick, ref, useId } from 'vue';
import type { GameSymbol } from '../icons';
import GameIcon from './GameIcon.vue';
defineOptions({ inheritAttrs: false });
defineProps<{ text: string; icon?: GameSymbol; tooltip?: boolean; }>();
const id = useId();
const anchor = ref<HTMLElement>();
const bubble = ref<HTMLElement>();
const target = ref<string | HTMLElement>('body');
const visible = ref(false);
const position = ref({ left: '0px', top: '0px' });
async function show(): Promise<void> {
  target.value = anchor.value?.closest('dialog') ?? 'body';
  visible.value = true;
  await nextTick();
  if (!anchor.value || !bubble.value) return;
  const rect = anchor.value.getBoundingClientRect(), tip = bubble.value.getBoundingClientRect();
  position.value = { left: Math.max(12, Math.min(rect.left, innerWidth - tip.width - 12)) + 'px', top: (rect.bottom + tip.height + 12 < innerHeight ? rect.bottom + 6 : Math.max(12, rect.top - tip.height - 6)) + 'px' };
}
function focus(): void { if (anchor.value?.matches(':focus-visible')) void show(); }
function escape(event: KeyboardEvent): void {
  if (!visible.value) return;
  visible.value = false; event.preventDefault(); event.stopPropagation();
}
</script>
<template>
  <span v-if="icon || $slots.default" ref="anchor" v-bind="$attrs" class="info-symbol" role="img" :aria-label="text" :tabindex="tooltip ? 0 : undefined" :aria-describedby="tooltip && visible ? id : undefined" @pointerenter="tooltip && show()" @pointerleave="visible = false" @pointerdown="visible = false" @focus="tooltip && focus()" @blur="visible = false" @keydown.esc="escape">
    <slot><GameIcon v-if="icon" :icon="icon" /></slot>
  </span>
  <Teleport :to="target"><span v-if="tooltip && visible" :id="id" ref="bubble" role="tooltip" class="tooltip" :style="position">{{ text }}</span></Teleport>
</template>
