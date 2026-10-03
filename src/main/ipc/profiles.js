import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/ipc-channels.js';
import {
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  getActiveProfile,
  getActiveProfileId,
  setActiveProfileId,
  getProfilePrefs,
  setProfilePrefs,
  getDefaultPathsForProfile,
  AVATAR_COLORS,
} from '../database/profiles.js';
import { syncWatchersFromConfig } from '../library/watcher.js';

export function registerProfilesIpc() {
  ipcMain.handle(IpcChannels.PROFILES_LIST, () => ({
    profiles: listProfiles().map((p) => {
      const prefs = getProfilePrefs(p.id);
      return {
        ...p,
        setupCompleted: prefs.setupCompleted,
        initial: (p.name || '?').slice(0, 1).toUpperCase(),
      };
    }),
    activeProfileId: getActiveProfileId(),
    colors: AVATAR_COLORS,
  }));

  ipcMain.handle(IpcChannels.PROFILES_CREATE, (_e, payload) =>
    createProfile(payload || {}),
  );

  ipcMain.handle(IpcChannels.PROFILES_UPDATE, (_e, { id, patch }) =>
    updateProfile(id, patch || {}),
  );

  ipcMain.handle(IpcChannels.PROFILES_DELETE, (_e, id) => {
    const result = deleteProfile(id);
    try {
      syncWatchersFromConfig();
    } catch {
      // ignore
    }
    return result;
  });

  ipcMain.handle(IpcChannels.PROFILES_SET_ACTIVE, (_e, id) => {
    const result = setActiveProfileId(id);
    if (result.ok) {
      try {
        syncWatchersFromConfig();
      } catch {
        // ignore
      }
    }
    return result;
  });

  ipcMain.handle(IpcChannels.PROFILES_GET_ACTIVE, () => ({
    profile: getActiveProfile(),
    prefs: getProfilePrefs(),
  }));

  ipcMain.handle(IpcChannels.PROFILES_GET_PREFS, (_e, profileId) =>
    getProfilePrefs(profileId ?? null),
  );

  ipcMain.handle(IpcChannels.PROFILES_SET_PREFS, (_e, { patch, profileId }) => {
    const prefs = setProfilePrefs(patch || {}, profileId ?? null);
    try {
      syncWatchersFromConfig();
    } catch {
      // ignore
    }
    return prefs;
  });

  ipcMain.handle(IpcChannels.PROFILES_DEFAULT_PATHS, (_e, { profileId, name } = {}) => {
    const id = profileId ?? getActiveProfileId() ?? 0;
    return getDefaultPathsForProfile(id, name);
  });
}
