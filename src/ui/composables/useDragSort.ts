import { ref } from 'vue';
/** 清單只回報排序位置; 取消失效拖曳, 保留 Pointer 與 Alt+方向鍵操作 */
export function useDragSort<T>(items: () => readonly T[], move: (from: number, to: number) => void, disabled: () => boolean) {
  let drag: { from: number; to: number; pointer: number; items: T[]; list: Element } | null = null;
  const target = ref<number | null>(null);
  const cancel = (): void => { drag = null; target.value = null; };
  const bind = (index: number) => ({
    onPointerdown(e: PointerEvent): void {
      const button = e.currentTarget as HTMLButtonElement;
      const list = button.closest('[data-sort-list]');
      if (disabled() || e.button !== 0 || !e.isPrimary || !list) return;
      drag = { from: index, to: index, pointer: e.pointerId, items: [...items()], list };
      target.value = index; button.setPointerCapture(e.pointerId);
    },
    onPointermove(e: PointerEvent): void {
      if (!drag || drag.pointer !== e.pointerId) return;
      const row = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-sort-index]');
      const to = row && row.closest('[data-sort-list]') === drag.list ? Number(row.dataset.sortIndex) : drag.from;
      if (!Number.isInteger(to) || to < 0 || to >= items().length || to === drag.to) return;
      drag.to = to; target.value = to;
    },
    onPointerup(e: PointerEvent): void {
      const current = drag;
      if (!current || current.pointer !== e.pointerId) return;
      cancel();
      const list = items();
      if (!disabled() && current.from !== current.to && current.items.length === list.length && current.items.every((item, i) => list[i] === item)) move(current.from, current.to);
    },
    onPointercancel: cancel, onLostpointercapture: cancel,
    onKeydown(e: KeyboardEvent): void {
      if (e.key === 'Escape') { cancel(); return; }
      if (disabled() || !e.altKey || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      const to = index + (e.key === 'ArrowUp' ? -1 : 1);
      if (to >= 0 && to < items().length) move(index, to);
    },
  });
  return { target, bind };
}
