import { defineStore } from 'pinia';

/** @typedef {'success' | 'info' | 'error'} ToastType */

let nextId = 1;

/** @type {Map<number, ReturnType<typeof setTimeout>>} */
const timers = new Map();

/**
 * Toasts UI globaux (hors HUD progression lecteur).
 * API :
 *   useToastStore().success('Livre importé')
 *   useToastStore().info('Scan terminé')
 *   useToastStore().error('Échec import')
 *   useToastStore().show('…', { type: 'info', duration: 2500 })
 */
export const useToastStore = defineStore('toast', {
  state: () => ({
    /** @type {Array<{ id: number, type: ToastType, message: string }>} */
    items: [],
  }),
  actions: {
    /**
     * @param {string} message
     * @param {{ type?: ToastType, duration?: number }} [opts]
     * @returns {number} toast id
     */
    show(message, opts = {}) {
      const text = String(message || '').trim();
      if (!text) return 0;

      /** @type {ToastType} */
      const type = opts.type === 'success' || opts.type === 'error' ? opts.type : 'info';
      const duration =
        typeof opts.duration === 'number' && opts.duration > 0
          ? opts.duration
          : type === 'error'
            ? 3200
            : 2400;

      const id = nextId++;
      // Un toast à la fois : remplace le précédent (anti-clutter manette).
      this.clearTimers();
      this.items = [{ id, type, message: text }];

      const timer = setTimeout(() => {
        timers.delete(id);
        this.dismiss(id);
      }, duration);
      timers.set(id, timer);
      return id;
    },
    /** @param {string} message @param {{ duration?: number }} [opts] */
    success(message, opts = {}) {
      return this.show(message, { ...opts, type: 'success' });
    },
    /** @param {string} message @param {{ duration?: number }} [opts] */
    info(message, opts = {}) {
      return this.show(message, { ...opts, type: 'info' });
    },
    /** @param {string} message @param {{ duration?: number }} [opts] */
    error(message, opts = {}) {
      return this.show(message, { ...opts, type: 'error' });
    },
    /** @param {number} id */
    dismiss(id) {
      const timer = timers.get(id);
      if (timer) {
        clearTimeout(timer);
        timers.delete(id);
      }
      this.items = this.items.filter((t) => t.id !== id);
    },
    clear() {
      this.clearTimers();
      this.items = [];
    },
    clearTimers() {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    },
  },
});
