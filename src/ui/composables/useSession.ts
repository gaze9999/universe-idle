import { onScopeDispose, shallowRef } from 'vue';
import type { GameSession } from '../../session';
/** Session 是唯一狀態擁有者; 大型快照不建立深層 Proxy */
export function useSession(session: GameSession) {
  const snapshot = shallowRef(session.getSnapshot());
  const unsubscribe = session.subscribe(() => { snapshot.value = session.getSnapshot(); });
  onScopeDispose(unsubscribe);
  return snapshot;
}
