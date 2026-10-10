<script setup lang="ts">
import { ref } from 'vue';
import { bolt as faBolt, signal as faWifi } from '../icons';
import type { GameSession, Snapshot } from '../../session';
import type { Language } from '../../i18n';
import type { Appearance, Theme } from '../../platform/save';
import type { Tr } from '../model';
import TabBar from '../molecules/TabBar.vue';
import InfoTip from '../atoms/InfoTip.vue';
const props = defineProps<{ snap: Snapshot; session: GameSession; t: Tr; }>();
const emit = defineEmits<{ confirm: [kind: 'import' | 'abandon', text?: string]; }>();
const tab = ref('gameSettings');
const importText = ref('');
async function download(raw = false, beforeUpgrade = false): Promise<void> {
  try {
    const text = beforeUpgrade ? props.session.preUpgradeSave() : raw ? props.session.rawSave() : await props.session.export();
    const url = URL.createObjectURL(new Blob([text], { type: text.startsWith('UI3.') ? 'text/plain' : 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = beforeUpgrade ? 'universe-idle-before-upgrade.json' : raw ? 'universe-idle-original.json' : `universe-idle-save.${text.startsWith('UI3.') ? 'txt' : 'json'}`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch { /* Session 負責呈現存檔錯誤 */ }
}
function file(event: Event): void { const input = (event.target as HTMLInputElement).files?.[0]; if (input && input.size <= 100000) void input.text().then(text => { importText.value = text; }); }
</script>
<template>
  <TabBar
    v-model="tab"
    class="subtabs settings-tabs"
    :items="['gameSettings', 'saveTitle']"
    :label="t('settings')"
    prefix="settings-tab"
    controls="settings-panel"
    :text="t"
  />
  <div id="settings-panel" role="tabpanel" :aria-labelledby="'settings-tab-' + tab">
    <fieldset :disabled="snap.readOnly || !snap.ready">
      <section v-if="tab === 'gameSettings'" class="panel">
        <label>{{ t('theme') }}<select :value="snap.preferences.theme ?? 'sand'" @change="session.setPreferences({ theme: ($event.target as HTMLSelectElement).value as Theme })"><option value="sand">{{ t('themeSand') }}</option><option value="wbui">{{ t('themeWorkbench') }}</option></select></label>
        <label>{{ t('appearance') }}<select :value="snap.preferences.appearance ?? 'system'" @change="session.setPreferences({ appearance: ($event.target as HTMLSelectElement).value as Appearance })"><option value="system">{{ t('systemAppearance') }}</option><option value="light">{{ t('lightAppearance') }}</option><option value="dark">{{ t('darkAppearance') }}</option></select></label>
        <div class="button-row">
          <label>{{ t('language') }}<select :value="snap.preferences.language" @change="session.setPreferences({ language: ($event.target as HTMLSelectElement).value as Language })"><option value="zh-TW">繁體中文</option><option value="en">English</option><option value="ja">日本語</option></select></label>
          <button class="secondary" @click="session.setPreferences({ paused: !snap.preferences.paused })">{{ t(snap.preferences.paused ? 'resume' : 'pause') }}</button>
          <InfoTip :text="t('bankHelp')" :icon="faBolt" tooltip />
          <InfoTip :text="t('offlineHelp')" :icon="faWifi" tooltip />
        </div>
      </section>
      <section v-if="tab === 'saveTitle'" class="panel">
        <InfoTip :text="t('savingHelp')" />
        <p class="teal">{{ snap.savedAt ? t('saved') + ' ' + new Date(snap.savedAt).toLocaleTimeString(snap.preferences.language) : t('notSaved') }}</p>
        <div class="button-row">
          <button @click="session.save()">{{ t('save') }}</button>
          <button @click="download()">{{ t('export') }}</button>
          <button @click="download(true)">{{ t('exportRaw') }}</button>
          <button :disabled="!session.preUpgradeSave()" @click="download(false, true)">{{ t('exportBeforeUpgrade') }}</button>
          <button @click="session.recoverBackup()">{{ t('recoverBackup') }}</button>
        </div>
        <hr />
        <h2>{{ t('import') }}</h2>
        <p>{{ t('importHelp') }}</p>
        <label>{{ t('jsonLabel') }}<textarea v-model="importText" maxlength="100000" rows="5" /></label>
        <input type="file" accept="text/plain,application/json,.txt,.json" :aria-label="t('import')" @change="file" />
        <button class="primary" :disabled="!importText.trim()" @click="emit('confirm', 'import', importText)">{{ t('importConfirm') }}</button>
      </section>
      <section v-if="tab === 'gameSettings'" class="panel">
        <h2>{{ t('newSettlement') }}</h2>
        <p>{{ t('abandonHelp') }}</p>
        <button class="danger" @click="emit('confirm', 'abandon')">{{ t('abandon') }}</button>
      </section>
    </fieldset>
  </div>
</template>
