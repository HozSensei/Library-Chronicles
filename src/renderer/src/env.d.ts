/// <reference types="vite/client" />

interface VdrApi {
  getConfig: () => Promise<Record<string, unknown>>;
  setConfig: (patch: Record<string, unknown>) => Promise<Record<string, unknown>>;
  getDefaultPaths: () => Promise<{ libraryRoot: string; importRoot: string; covers: string }>;
  pickDirectory: (opts?: { title?: string }) => Promise<string | null>;
  setSessionMode: (
    mode: 'ui' | 'reader',
    opts?: { force?: boolean },
  ) => Promise<{ mode: string; orientation: string }>;
  onOrientationChanged: (
    handler: (payload: { orientation: string }) => void,
  ) => () => void;
  library: {
    selectRoot: () => Promise<string | null>;
    selectImport: () => Promise<string | null>;
    scan: () => Promise<unknown>;
    list: () => Promise<unknown[]>;
    getCover: (bookId: number) => Promise<string | null>;
    updateBook: (id: number, patch: Record<string, unknown>) => Promise<unknown>;
    continue: () => Promise<unknown>;
    recent: (limit?: number) => Promise<unknown[]>;
    lastAccessed: (excludeId?: number | null) => Promise<unknown>;
    series: () => Promise<{ groups: unknown[]; singles: unknown[] }>;
    nextUnread: (payload: {
      seriesId: string;
      afterVolume?: number | null;
      afterBookId?: number | null;
    }) => Promise<unknown>;
  };
  import: {
    scan: (importRoot?: string) => Promise<unknown>;
    commit: (payload: unknown) => Promise<unknown>;
    previewCover: (filePath: string) => Promise<{ mime: string; data: string } | null>;
  };
  metadata: {
    detect: (filePath: string) => Promise<unknown>;
    search: (
      query: string,
      provider?: string,
    ) => Promise<{ results: unknown[]; providers?: unknown[]; activeProvider?: string }>;
    listProviders: () => Promise<{
      providers: Array<{
        id: string;
        label: string;
        requiresApiKey: boolean;
        freeLabel: string;
        helpText?: string | null;
        helpUrl?: string | null;
        helpLinkLabel?: string | null;
        hasKey?: boolean;
      }>;
      activeProvider: string;
    }>;
    setProvider: (provider: string) => Promise<{ ok: boolean; provider?: unknown }>;
    setApiKey: (provider: string, key: string) => Promise<unknown>;
    hasApiKey: (provider: string) => Promise<{ hasKey: boolean; providers?: unknown[] }>;
    openHelp: (payload: { provider?: string; url?: string }) => Promise<{ ok: boolean }>;
  };
  reader: {
    open: (filePath: string) => Promise<{
      title: string;
      format: string;
      pageCount: number;
      filePath: string;
      chapters?: unknown[];
      bookId?: number | null;
      resumePage?: number;
    }>;
    getPage: (index: number) => Promise<{ index: number; mime: string; data: string | null }>;
    getChapters: () => Promise<unknown[]>;
    close: () => Promise<{ ok: boolean }>;
  };
  progress: {
    save: (payload: unknown) => Promise<unknown>;
    load: (filePath: string) => Promise<unknown>;
  };
  profiles: {
    list: () => Promise<{
      profiles: Array<{ id: number; name: string; color: string }>;
      activeProfileId: number | null;
      colors: string[];
    }>;
    create: (payload?: { name?: string; color?: string }) => Promise<unknown>;
    update: (id: number, patch: Record<string, unknown>) => Promise<unknown>;
    delete: (id: number) => Promise<{ ok: boolean; error?: string }>;
    setActive: (id: number) => Promise<{ ok: boolean; profile?: unknown }>;
    getActive: () => Promise<{ profile: unknown; prefs: Record<string, unknown> }>;
    getPrefs: (profileId?: number | null) => Promise<Record<string, unknown>>;
    setPrefs: (
      patch: Record<string, unknown>,
      profileId?: number | null,
    ) => Promise<Record<string, unknown>>;
    defaultPaths: (payload?: {
      profileId?: number;
      name?: string;
    }) => Promise<{ libraryRoot: string; importRoot: string; covers: string }>;
  };
  bookmarks: {
    list: (bookId: number, profileId?: number) => Promise<unknown[]>;
    listAll: (profileId?: number) => Promise<unknown[]>;
    add: (payload: {
      bookId: number;
      page: number;
      label?: string | null;
    }) => Promise<unknown>;
    remove: (id: number) => Promise<{ ok: boolean }>;
    removeAt: (bookId: number, page: number) => Promise<{ ok: boolean }>;
  };
  watch: {
    status: () => Promise<{
      library: {
        root: string | null;
        active: boolean;
        mode?: string;
        watchErrors?: number;
        trackedFiles?: number;
      };
      import: {
        root: string | null;
        active: boolean;
        mode?: string;
        watchErrors?: number;
        trackedFiles?: number;
      };
      debounceMs?: number;
      stabilityMs?: number;
      pollIntervalMs?: number;
    }>;
    onLibraryChanged: (handler: (payload: unknown) => void) => () => void;
    onImportChanged: (handler: (payload: unknown) => void) => () => void;
  };
}

interface Window {
  vdr: VdrApi;
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
