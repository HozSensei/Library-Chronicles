/// <reference types="vite/client" />

interface VdrApi {
  getConfig: () => Promise<Record<string, unknown>>;
  setConfig: (patch: Record<string, unknown>) => Promise<Record<string, unknown>>;
  library: {
    selectRoot: () => Promise<string | null>;
    scan: () => Promise<unknown>;
    list: () => Promise<unknown[]>;
    getCover: (bookId: number) => Promise<string | null>;
  };
  reader: {
    open: (filePath: string) => Promise<{
      title: string;
      format: string;
      pageCount: number;
      filePath: string;
    }>;
    getPage: (index: number) => Promise<{ index: number; mime: string; data: string | null }>;
    close: () => Promise<{ ok: boolean }>;
  };
  progress: {
    save: (payload: unknown) => Promise<unknown>;
    load: (filePath: string) => Promise<unknown>;
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
