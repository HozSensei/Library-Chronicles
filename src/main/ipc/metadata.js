import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/ipc-channels.js';
import {
  detectMetadata,
  searchMetadata,
  setApiKey,
  hasApiKey,
  listProviders,
} from '../metadata/provider.js';
import { setConfig } from '../config.js';

export function registerMetadataIpc() {
  ipcMain.handle(IpcChannels.METADATA_DETECT, async (_e, filePath) =>
    detectMetadata(filePath),
  );

  ipcMain.handle(IpcChannels.METADATA_SEARCH, async (_e, { query, provider }) => ({
    results: await searchMetadata(query, { provider }),
    providers: listProviders(),
  }));

  ipcMain.handle(IpcChannels.METADATA_SET_API_KEY, async (_e, { provider, key }) => {
    const result = setApiKey(provider, key);
    if (provider) setConfig({ metadataProvider: key ? provider : 'stub' });
    return result;
  });

  ipcMain.handle(IpcChannels.METADATA_HAS_API_KEY, async (_e, provider) => ({
    provider,
    hasKey: hasApiKey(provider),
    providers: listProviders(),
  }));
}
