import { ipcMain, shell } from 'electron';
import { IpcChannels } from '../../shared/ipc-channels.js';
import {
  detectMetadata,
  searchMetadata,
  setApiKey,
  hasApiKey,
  listProviders,
  setMetadataProvider,
  getActiveProviderId,
  getProvider,
} from '../metadata/provider.js';

const ALLOWED_HELP_HOSTS = new Set([
  'comicvine.gamespot.com',
  'console.cloud.google.com',
  'developers.google.com',
  'openlibrary.org',
  'docs.anilist.co',
  'api.mangadex.org',
  'anilist.co',
]);

export function registerMetadataIpc() {
  ipcMain.handle(IpcChannels.METADATA_DETECT, async (_e, filePath) =>
    detectMetadata(filePath),
  );

  ipcMain.handle(IpcChannels.METADATA_SEARCH, async (_e, { query, provider } = {}) => {
    const payload = await searchMetadata(query, { provider });
    // Compat : searchMetadata renvoie désormais { results, provider, warning }
    const results = Array.isArray(payload) ? payload : payload.results || [];
    const warning = Array.isArray(payload) ? null : payload.warning || null;
    const usedProvider = Array.isArray(payload)
      ? getActiveProviderId()
      : payload.provider || getActiveProviderId();
    return {
      results,
      warning,
      providers: listProviders(),
      activeProvider: usedProvider,
    };
  });

  ipcMain.handle(IpcChannels.METADATA_LIST_PROVIDERS, async () => ({
    providers: listProviders(),
    activeProvider: getActiveProviderId(),
  }));

  ipcMain.handle(IpcChannels.METADATA_SET_PROVIDER, async (_e, provider) =>
    setMetadataProvider(provider),
  );

  ipcMain.handle(IpcChannels.METADATA_SET_API_KEY, async (_e, { provider, key }) => {
    const result = setApiKey(provider, key);
    return { ...result, providers: listProviders(), activeProvider: getActiveProviderId() };
  });

  ipcMain.handle(IpcChannels.METADATA_HAS_API_KEY, async (_e, provider) => ({
    provider,
    hasKey: hasApiKey(provider),
    providers: listProviders(),
    activeProvider: getActiveProviderId(),
  }));

  ipcMain.handle(IpcChannels.METADATA_OPEN_HELP, async (_e, { provider, url } = {}) => {
    let target = url;
    if (!target && provider) {
      target = getProvider(provider)?.helpUrl;
    }
    if (!target) return { ok: false, error: 'URL manquante' };

    let parsed;
    try {
      parsed = new URL(String(target));
    } catch {
      return { ok: false, error: 'URL invalide' };
    }
    if (parsed.protocol !== 'https:' || !ALLOWED_HELP_HOSTS.has(parsed.hostname)) {
      return { ok: false, error: 'Hôte non autorisé' };
    }

    await shell.openExternal(parsed.toString());
    return { ok: true, url: parsed.toString() };
  });
}
