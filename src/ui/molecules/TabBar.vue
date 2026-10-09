<script setup lang="ts">
const props = defineProps<{ items: readonly string[]; modelValue: string; label: string; prefix: string; controls: string; text: (id: string) => string; }>();
const emit = defineEmits<{ 'update:modelValue': [value: string]; }>();
function key(event: KeyboardEvent, index: number): void {
  const next = event.key === 'ArrowRight' ? (index + 1) % props.items.length : event.key === 'ArrowLeft' ? (index + props.items.length - 1) % props.items.length : event.key === 'Home' ? 0 : event.key === 'End' ? props.items.length - 1 : -1;
  if (next < 0) return;
  event.preventDefault(); emit('update:modelValue', props.items[next]);
  const buttons = (event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLButtonElement>('button');
  buttons?.[next]?.focus();
}
</script>
<template>
  <nav role="tablist" :aria-label="label">
    <button v-for="(id, index) in items" :id="`${prefix}-${id}`" :key="id" role="tab" :aria-controls="controls" :aria-selected="modelValue === id" :tabindex="modelValue === id ? 0 : -1" :class="{ active: modelValue === id }" @click="emit('update:modelValue', id)" @keydown="key($event, index)">{{ text(id) }}</button>
  </nav>
</template>
