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
  AVATAR_COLORS,
} from '../database/profiles.js';
import { setConfig } from '../config.js';

export function registerProfilesIpc() {
  ipcMain.handle(IpcChannels.PROFILES_LIST, () => ({
    profiles: listProfiles(),
    activeProfileId: getActiveProfileId(),
    colors: AVATAR_COLORS,
  }));

  ipcMain.handle(IpcChannels.PROFILES_CREATE, (_e, payload) =>
    createProfile(payload || {}),
  );

  ipcMain.handle(IpcChannels.PROFILES_UPDATE, (_e, { id, patch }) =>
    updateProfile(id, patch || {}),
  );

  ipcMain.handle(IpcChannels.PROFILES_DELETE, (_e, id) => deleteProfile(id));

  ipcMain.handle(IpcChannels.PROFILES_SET_ACTIVE, (_e, id) => {
    const result = setActiveProfileId(id);
    if (result.ok) setConfig({ profileSelected: true });
    return result;
  });

  ipcMain.handle(IpcChannels.PROFILES_GET_ACTIVE, () => ({
    profile: getActiveProfile(),
    prefs: getProfilePrefs(),
  }));

  ipcMain.handle(IpcChannels.PROFILES_GET_PREFS, (_e, profileId) =>
    getProfilePrefs(profileId ?? null),
  );

  ipcMain.handle(IpcChannels.PROFILES_SET_PREFS, (_e, { patch, profileId }) =>
    setProfilePrefs(patch || {}, profileId ?? null),
  );
}
