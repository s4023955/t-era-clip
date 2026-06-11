import type { TeraClipItem, TeraClipSettings } from './types';

const ITEMS_STORAGE_KEY = 'teraClipItems';
const SETTINGS_STORAGE_KEY = 'teraClipSettings';

const ITEM_TYPES = ['task', 'checklist', 'followup', 'note', 'report_input'] as const;
const ITEM_STATUSES = ['inbox', 'todo', 'doing', 'waiting', 'done', 'archived'] as const;
const ITEM_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export const DEFAULT_SETTINGS: TeraClipSettings = {
  defaultReportLanguage: 'vi'
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isOneOf = <T extends string>(value: unknown, allowedValues: readonly T[]): value is T =>
  typeof value === 'string' && allowedValues.includes(value as T);

const isValidTeraClipItem = (value: unknown): value is TeraClipItem => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isOneOf(value.type, ITEM_TYPES) &&
    isString(value.title) &&
    isString(value.originalText) &&
    isString(value.sourceUrl) &&
    isString(value.sourceTitle) &&
    isString(value.createdAt) &&
    isString(value.updatedAt) &&
    isOneOf(value.status, ITEM_STATUSES) &&
    isOneOf(value.priority, ITEM_PRIORITIES) &&
    isString(value.owner) &&
    isString(value.dueDate) &&
    isString(value.category) &&
    Array.isArray(value.tags) &&
    value.tags.every(isString) &&
    isString(value.notes)
  );
};

const sanitizeStoredItems = (value: unknown): TeraClipItem[] => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    console.warn('T-eraClip ignored stored items because the value is not an array.');
    return [];
  }

  const validItems = value.filter(isValidTeraClipItem);
  const invalidItemCount = value.length - validItems.length;

  if (invalidItemCount > 0) {
    console.warn(`T-eraClip ignored ${invalidItemCount} invalid stored item(s).`);
  }

  return validItems;
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

      resolve(sanitizeStoredItems(result[ITEMS_STORAGE_KEY]));
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
