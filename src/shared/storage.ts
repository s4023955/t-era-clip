import type { TeraClipItem, TeraClipSettings } from './types';

const ITEMS_STORAGE_KEY = 'teraClipItems';
const SETTINGS_STORAGE_KEY = 'teraClipSettings';

export const DEFAULT_SETTINGS: TeraClipSettings = {
  defaultReportLanguage: 'vi'
};

const getStorage = () => {
  const chromeApi = typeof globalThis !== 'undefined' ? (globalThis as any).chrome : undefined;
  const storage = chromeApi?.storage?.local;

  if (!storage) {
    throw new Error('chrome.storage.local is not available in this environment.');
  }

  return storage;
};

const getChromeLastError = (): string | undefined => {
  const chromeApi = typeof globalThis !== 'undefined' ? (globalThis as any).chrome : undefined;
  return chromeApi?.runtime?.lastError?.message;
};

export async function getItems(): Promise<TeraClipItem[]> {
  const storage = getStorage();

  return new Promise((resolve, reject) => {
    storage.get([ITEMS_STORAGE_KEY], (result: any) => {
      const error = getChromeLastError();
      if (error) {
        reject(new Error(error));
        return;
      }

      resolve(result[ITEMS_STORAGE_KEY] ?? []);
    });
  });
}

export async function saveItems(items: TeraClipItem[]): Promise<void> {
  const storage = getStorage();

  return new Promise((resolve, reject) => {
    storage.set({ [ITEMS_STORAGE_KEY]: items }, () => {
      const error = getChromeLastError();
      if (error) {
        reject(new Error(error));
        return;
      }
      resolve();
    });
  });
}

export async function addItem(item: TeraClipItem): Promise<void> {
  const items = await getItems();
  await saveItems([...items, item]);
}

export async function updateItem(item: TeraClipItem): Promise<void> {
  const items = await getItems();
  const nextItems = items.map((existing) => (existing.id === item.id ? item : existing));
  await saveItems(nextItems);
}

export async function clearItems(): Promise<void> {
  const storage = getStorage();

  return new Promise((resolve, reject) => {
    storage.remove([ITEMS_STORAGE_KEY], () => {
      const error = getChromeLastError();
      if (error) {
        reject(new Error(error));
        return;
      }
      resolve();
    });
  });
}

export async function getSettings(): Promise<TeraClipSettings> {
  const storage = getStorage();

  return new Promise((resolve, reject) => {
    storage.get([SETTINGS_STORAGE_KEY], (result: any) => {
      const error = getChromeLastError();
      if (error) {
        reject(new Error(error));
        return;
      }

      const storedSettings = result[SETTINGS_STORAGE_KEY];
      const defaultReportLanguage =
        storedSettings?.defaultReportLanguage === 'en' || storedSettings?.defaultReportLanguage === 'vi'
          ? storedSettings.defaultReportLanguage
          : DEFAULT_SETTINGS.defaultReportLanguage;

      resolve({ defaultReportLanguage });
    });
  });
}

export async function saveSettings(settings: TeraClipSettings): Promise<void> {
  const storage = getStorage();

  return new Promise((resolve, reject) => {
    storage.set({ [SETTINGS_STORAGE_KEY]: settings }, () => {
      const error = getChromeLastError();
      if (error) {
        reject(new Error(error));
        return;
      }
      resolve();
    });
  });
}

export async function replaceLocalData(
  items: TeraClipItem[],
  settings: TeraClipSettings
): Promise<void> {
  const storage = getStorage();

  return new Promise((resolve, reject) => {
    storage.set(
      {
        [ITEMS_STORAGE_KEY]: items,
        [SETTINGS_STORAGE_KEY]: settings
      },
      () => {
        const error = getChromeLastError();
        if (error) {
          reject(new Error(error));
          return;
        }
        resolve();
      }
    );
  });
}

export async function clearAllLocalData(): Promise<void> {
  const storage = getStorage();

  return new Promise((resolve, reject) => {
    storage.remove([ITEMS_STORAGE_KEY, SETTINGS_STORAGE_KEY], () => {
      const error = getChromeLastError();
      if (error) {
        reject(new Error(error));
        return;
      }
      resolve();
    });
  });
}
