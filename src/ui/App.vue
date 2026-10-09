<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import { faGear } from '@fortawesome/free-solid-svg-icons';
import type { Branch } from '../core/content';
import { resources } from '../core/content';
import { flow, has, reward } from '../core/game';
import type { Command } from '../core/game';
import { environment } from '../core/world';
import { translate } from '../i18n';
import type { GameSession } from '../session';
import { version } from '../../package.json';
import { childTabs, project } from './projection';
import type { Tab } from './projection';
import { formatNumber } from './model';
import { useSession } from './composables/useSession';
import GameIcon from './atoms/GameIcon.vue';
import TabBar from './molecules/TabBar.vue';
import ModalDialog from './molecules/ModalDialog.vue';
import GameLayout from './templates/GameLayout.vue';
import ResourcesPanel from './features/ResourcesPanel.vue';
import ConstructionPanel from './features/ConstructionPanel.vue';
import SettingsPanel from './features/SettingsPanel.vue';
import OverviewPanel from './features/OverviewPanel.vue';
import SpeciesPanel from './features/SpeciesPanel.vue';
import WorkersPanel from './features/WorkersPanel.vue';
import BuildingsPanel from './features/BuildingsPanel.vue';
import SciencePanel from './features/SciencePanel.vue';
import RecordsPanel from './features/RecordsPanel.vue';
import AchievementsPanel from './features/AchievementsPanel.vue';
import LegacyPanel from './features/LegacyPanel.vue';
const props = defineProps<{ session: GameSession; }>();
const snap = useSession(props.session);
const state = computed(() => snap.value.state);
const preferences = computed(() => snap.value.preferences);
const t = (key: string, values?: Record<string, string | number>) => translate(preferences.value.language, key, values);
const fmt = (value: number, decimals = 0) => formatNumber(preferences.value.language, value, decimals);
const production = computed(() => flow(state.value));
const view = computed(() => project(state.value, preferences.value.showCompleted));
const env = computed(() => environment(state.value.world));
const chosenTab = ref<Tab>('overview');
const children = ref<Partial<Record<Tab, string>>>({});
const tab = computed(() => view.value.tabs.includes(chosenTab.value) ? chosenTab.value : 'overview');
const child = computed(() => children.value[tab.value] ?? childTabs[tab.value][0]);
const settingsOpen = ref(false);
const confirm = ref<{ kind: 'reset' | 'abandon' | 'import'; start: Branch; text: string; } | null>(null);
const send = (cmd: Command): void => props.session.dispatch(cmd);
const panelProps = computed(() => ({ state: state.value, t, send, view: view.value }));
const featureProps = computed(() => ({
  ...panelProps.value,
  ...(['overview', 'science', 'records', 'achievements'].includes(tab.value) ? { child: child.value } : {}),
  ...(tab.value === 'buildings' ? { showCompleted: preferences.value.showCompleted } : {}),
}));
const featureEvents = computed(() => tab.value === 'buildings'
  ? { toggle: () => props.session.setPreferences({ showCompleted: !preferences.value.showCompleted }) }
  : tab.value === 'legacy' ? { confirm: requestConfirm } : {});
const pages = { overview: OverviewPanel, species: SpeciesPanel, workers: WorkersPanel, buildings: BuildingsPanel, science: SciencePanel, records: RecordsPanel, achievements: AchievementsPanel, legacy: LegacyPanel };
const planetName = computed(() => t('planetDesignation', { n: state.value.world.seed.toString(16).toUpperCase() }));
const disabled = computed(() => snap.value.readOnly || !snap.value.ready);
watchEffect(() => { document.documentElement.lang = preferences.value.language; if (chosenTab.value !== tab.value) chosenTab.value = tab.value; });
function changeTab(value: string): void { props.session.activate(); chosenTab.value = value as Tab; }
function changeChild(value: string): void { children.value = { ...children.value, [tab.value]: value }; }
function requestConfirm(kind: 'reset' | 'abandon' | 'import', startOrText?: Branch | string): void {
  confirm.value = { kind, start: kind === 'import' ? 'base' : (startOrText as Branch | undefined) ?? 'base', text: kind === 'import' ? startOrText ?? '' : '' };
}
function accept(): void {
  const current = confirm.value;
  if (!current) return;
  if (current.kind === 'import') void props.session.import(current.text);
  else send({ type: 'reset', start: current.start, abandon: current.kind === 'abandon' });
  confirm.value = null;
}
</script>
<template>
  <div class="app-shell">
    <header class="header">
      <div class="brand">
        <h1>Universe Idle</h1>
      </div>
      <div class="header-controls">
        <span class="version" :aria-label="t('version')">v{{ version }}</span>
        <button
          class="settings-button"
          :aria-label="t('settings')"
          aria-haspopup="dialog"
          :aria-expanded="settingsOpen"
          @click="session.activate(); settingsOpen = true"
        >
          <GameIcon :icon="faGear" />
        </button>
      </div>
    </header>
    <p v-if="!snap.ready" role="status">{{ t('loading') }}</p>
    <div v-if="snap.notice" class="notice" role="status">
      <div>
        <span v-if="snap.notice">{{ t(snap.notice === 'workers' ? 'workersError' : snap.notice === 'legacyPoints' ? 'legacyPointsError' : snap.notice) }}</span>
      </div>
      <button :aria-label="t('dismiss')" @click="session.dismissNotice()">×</button>
    </div>
    <section class="world-header" :aria-label="t('planetTitle')">
      <div class="settlement-status">
        <strong>{{ planetName }}</strong>
        <span :class="snap.readOnly || preferences.paused ? 'amber' : 'teal'">{{ t(snap.readOnly ? 'inactiveTab' : preferences.paused ? 'paused' : 'online') }}</span>
        <small>{{ t('calendarDay', { year: env.year, day: env.day }) }}</small>
      </div>
      <dl class="environment-strip">
        <div>
          <dt>{{ t('season') }}</dt>
          <dd>{{ t(env.season) }} / {{ t(env.daylight ? 'daylight' : 'night') }}</dd>
        </div>
        <div>
          <dt>{{ t('weather') }}</dt>
          <dd>{{ t(env.weather) }}</dd>
        </div>
        <div>
          <dt>{{ t('magicWind') }}</dt>
          <dd>{{ Math.round(env.magic * 100) }}%</dd>
        </div>
        <div>
          <dt>{{ t('vitalityField') }}</dt>
          <dd>{{ Math.round(env.vitality * 100) }}%</dd>
        </div>
      </dl>
      <div class="acceleration-time">
        <span>{{ t('accelerationRemaining', { n: Math.ceil(snap.timeBank.seconds / 60) }) }}</span>
      </div>
    </section>
    <GameLayout>
      <template #resources>
        <ResourcesPanel v-bind="panelProps" :production="production" :fmt="fmt" />
      </template>
      <template #navigation>
        <TabBar
          class="tabs"
          :items="view.tabs"
          :model-value="tab"
          label="Universe Idle"
          prefix="tab"
          controls="game-panel"
          :text="t"
          @update:model-value="changeTab"
        />
        <TabBar
          v-if="childTabs[tab].length > 1"
          class="subtabs"
          :items="childTabs[tab]"
          :model-value="child"
          :label="t('subtabs')"
          :prefix="'child-' + tab"
          controls="child-panel"
          :text="t"
          @update:model-value="changeChild"
        />
      </template>
      <div id="game-panel" role="tabpanel" :aria-labelledby="'tab-' + tab">
        <div
          id="child-panel"
          :role="childTabs[tab].length > 1 ? 'tabpanel' : undefined"
          :aria-labelledby="childTabs[tab].length > 1 ? 'child-' + tab + '-' + child : undefined"
        >
          <fieldset :disabled="disabled">
            <component :is="pages[tab]" :key="tab" v-bind="featureProps" v-on="featureEvents" />
          </fieldset>
        </div>
      </div>
      <template #queue>
        <ConstructionPanel v-bind="panelProps" :disabled="disabled" :paused="preferences.paused" :production="production" />
        <section v-if="resources.some(r => state.refund[r] > 0)" class="panel">
          <h2>{{ t('refundTitle') }}</h2>
          <p>{{ t('refundHelp') }}</p>
          <template v-for="r in resources" :key="r">
            <p v-if="state.refund[r] > 0">{{ t(r) }} {{ fmt(state.refund[r], 2) }}</p>
          </template>
          <button :disabled="disabled" @click="send({ type: 'claimRefund' })">{{ t('claim') }}</button>
        </section>
        <p v-if="has(state, 'workshop') && (!state.assignments.base.craft || production.plankProduction + 1e-8 < production.desiredPlanks)" class="amber">{{ t(!state.assignments.base.craft ? 'noCraftWorkers' : 'craftBlocked') }}</p>
      </template>
    </GameLayout>
    <ModalDialog
      v-if="settingsOpen"
      class="settings-dialog"
      :title="t('settings')"
      :close-label="t('dismiss')"
      title-id="settings-title"
      @close="settingsOpen = false"
    >
      <SettingsPanel :snap="snap" :session="session" :t="t" @confirm="requestConfirm" />
    </ModalDialog>
    <ModalDialog
      v-if="confirm"
      :title="t(confirm.kind === 'reset' ? 'resetConfirm' : confirm.kind === 'abandon' ? 'abandonConfirm' : 'importConfirm')"
      :close-label="t('dismiss')"
      title-id="confirm-title"
      @close="confirm = null"
    >
      <p>{{ confirm.kind === 'reset' ? t('availableReward') + ': ' + reward(state) + '. ' + t('resetHelp') : t(confirm.kind === 'abandon' ? 'abandonHelp' : 'importHelp') }}</p>
      <div class="button-row">
        <button @click="confirm = null">{{ t('dismiss') }}</button>
        <button class="primary" :disabled="disabled" @click="accept">{{ t('confirm') }}</button>
      </div>
    </ModalDialog>
  </div>
</template>
