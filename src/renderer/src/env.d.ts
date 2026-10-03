/// <reference types="vite/client" />

interface VdrApi {
  getConfig: () => Promise<Record<string, unknown>>;
  setConfig: (patch: Record<string, unknown>) => Promise<Record<string, unknown>>;
  getDefaultPaths: () => Promise<{ libraryRoot: string; importRoot: string; covers: string }>;
  pickDirectory: (opts?: { title?: string }) => Promise<string | null>;
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
  watch: {
    status: () => Promise<{
      library: { root: string | null; active: boolean };
      import: { root: string | null; active: boolean };
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
