import type { TeraClipItem } from './types';

const STORAGE_KEY = 'teraClipItems';

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
    storage.get([STORAGE_KEY], (result: any) => {
      const error = getChromeLastError();
      if (error) {
        reject(new Error(error));
        return;
      }

      resolve(result[STORAGE_KEY] ?? []);
    });
  });
}

export async function saveItems(items: TeraClipItem[]): Promise<void> {
  const storage = getStorage();

  return new Promise((resolve, reject) => {
    storage.set({ [STORAGE_KEY]: items }, () => {
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
    storage.remove([STORAGE_KEY], () => {
      const error = getChromeLastError();
      if (error) {
        reject(new Error(error));
        return;
      }
      resolve();
    });
  });
}
