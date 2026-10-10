<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { close as faXmark } from '../icons';
import GameIcon from '../atoms/GameIcon.vue';
defineProps<{ title: string; closeLabel: string; titleId: string; }>();
const emit = defineEmits<{ close: []; }>();
const dialog = ref<HTMLDialogElement>();
let opener: HTMLElement | null = null;
onMounted(() => { opener = document.activeElement instanceof HTMLElement ? document.activeElement : null; dialog.value?.showModal(); });
onBeforeUnmount(() => { dialog.value?.close(); if (opener?.isConnected) opener.focus(); });
function backdrop(event: MouseEvent): void {
  if (event.target !== dialog.value) return;
  const box = dialog.value.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) emit('close');
}
</script>
<template>
  <dialog ref="dialog" :aria-labelledby="titleId" @cancel.prevent="emit('close')" @click="backdrop">
    <div class="section-head dialog-titlebar">
      <h2 :id="titleId">{{ title }}</h2>
      <button class="icon-button" :aria-label="closeLabel" @click="emit('close')">
        <GameIcon :icon="faXmark" />
      </button>
    </div>
    <slot />
  </dialog>
</template>
