import type { OneOfficeDiscussionExport } from './types';
import { isOneOfficeDiscussionExport } from './validation';

const REVIEW_STORAGE_KEY = 'oneOfficeDiscussionReview';
const chromeApi = typeof globalThis !== 'undefined' ? (globalThis as any).chrome : undefined;

const getSessionStorage = () => {
  const storage = chromeApi?.storage?.session;
  if (!storage) {
    throw new Error('Chrome session storage is unavailable. Reload the extension and try again.');
  }
  return storage;
};

const getChromeLastError = (): string | undefined => chromeApi?.runtime?.lastError?.message;

export async function saveOneOfficeReview(
  result: OneOfficeDiscussionExport,
): Promise<void> {
  const storage = getSessionStorage();

  return new Promise((resolve, reject) => {
    storage.set({ [REVIEW_STORAGE_KEY]: result }, () => {
      const error = getChromeLastError();
      if (error) {
        reject(new Error(error));
        return;
      }
      resolve();
    });
  });
}

export async function getOneOfficeReview(): Promise<OneOfficeDiscussionExport | null> {
  const storage = getSessionStorage();

  return new Promise((resolve, reject) => {
    storage.get([REVIEW_STORAGE_KEY], (stored: Record<string, unknown>) => {
      const error = getChromeLastError();
      if (error) {
        reject(new Error(error));
        return;
      }

      const value = stored[REVIEW_STORAGE_KEY];
      if (value === undefined) {
        resolve(null);
        return;
      }

      if (!isOneOfficeDiscussionExport(value)) {
        reject(new Error('The temporary 1Office review data is invalid. Collect it again.'));
        return;
      }

      resolve(value);
    });
  });
}

export async function openOneOfficeReview(
  result: OneOfficeDiscussionExport,
): Promise<void> {
  if (!chromeApi?.tabs?.create || !chromeApi?.runtime?.getURL) {
    throw new Error('Chrome tab creation is unavailable.');
  }

  await saveOneOfficeReview(result);
  await chromeApi.tabs.create({ url: chromeApi.runtime.getURL('review.html') });
}
