import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import {
  normalizeLocale,
  setLocale as setSharedLocale,
  t as translate,
} from '../../../shared/i18n.js';
import { useUiStore } from '../stores/ui';

/**
 * Composable i18n réactif — suit ui.language.
 */
export function useI18n() {
  const ui = useUiStore();
  const { language } = storeToRefs(ui);

  const locale = computed(() => normalizeLocale(language.value));

  /**
   * @param {string} key
   * @param {Record<string, string|number>|null} [params]
   */
  function t(key, params = null) {
    return translate(key, params, locale.value);
  }

  /**
   * @param {'fr'|'en'|string} next
   */
  async function setLanguage(next) {
    await ui.setLanguage(next);
  }

  return { t, locale, setLanguage };
}

/** Sync module partagé (hors Vue) — appelé par ui.setLanguage / loadConfig. */
export function syncSharedLocale(locale) {
  setSharedLocale(locale);
}
