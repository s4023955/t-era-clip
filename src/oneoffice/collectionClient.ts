import {
  collectOneOfficeDiscussionFromPage,
  ONEOFFICE_PROGRESS_MESSAGE,
  type OneOfficeCollectionProgress,
  type OneOfficePageSnapshot,
} from './collector';
import { parseOneOfficeDiscussion } from './parser';
import { collectOneOfficeProjectInventoryFromPage } from './projectInventory';
import { collectOneOfficeProjectInventoryFromApi } from './projectInventoryApi';
import type {
  OneOfficeDiscussionExport,
  OneOfficeProjectInventory,
} from './types';

export const ONEOFFICE_ALLOWED_ORIGIN = 'https://office.meygroup.vn';

export interface ActiveTab {
  id: number;
  title: string;
  url: string;
}

type ProgressListener = (progress: OneOfficeCollectionProgress) => void;

const chromeApi = typeof globalThis !== 'undefined' ? (globalThis as any).chrome : undefined;

export function isSupportedOneOfficeUrl(url: string): boolean {
  try {
    return new URL(url).origin === ONEOFFICE_ALLOWED_ORIGIN;
  } catch {
    return false;
  }
}

export function isOneOfficeProjectPageUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return (
      parsedUrl.origin === ONEOFFICE_ALLOWED_ORIGIN &&
      parsedUrl.pathname === '/apps/work-project-project/view' &&
      /^\d+$/.test(parsedUrl.searchParams.get('ID') ?? '')
    );
  } catch {
    return false;
  }
}

export async function getActiveTab(): Promise<ActiveTab | null> {
  if (!chromeApi?.tabs?.query) {
    throw new Error('Chrome tab access is unavailable.');
  }

  const tabs = await chromeApi.tabs.query({ active: true, currentWindow: true });
  const tab = tabs?.[0];

  if (typeof tab?.id !== 'number') {
    return null;
  }

  return {
    id: tab.id,
    title: typeof tab.title === 'string' ? tab.title : '',
    url: typeof tab.url === 'string' ? tab.url : '',
  };
}

export async function collectOneOfficeDiscussion(
  tabId: number,
): Promise<OneOfficeDiscussionExport> {
  if (!chromeApi?.scripting?.executeScript) {
    throw new Error('Chrome scripting access is unavailable. Reload the extension and try again.');
  }

  const injectionResults = await chromeApi.scripting.executeScript({
    target: { tabId },
    func: collectOneOfficeDiscussionFromPage,
    args: [
      {
        allowedOrigin: ONEOFFICE_ALLOWED_ORIGIN,
        maxLoadMoreClicks: 100,
        noProgressTimeoutMs: 5000,
        progressMessageType: ONEOFFICE_PROGRESS_MESSAGE,
        settleTimeMs: 750,
      },
    ],
  });
  const snapshot = injectionResults?.[0]?.result as OneOfficePageSnapshot | undefined;

  if (!snapshot?.discussionHtml) {
    throw new Error('The 1Office collector returned no discussion data.');
  }

  return parseOneOfficeSnapshot(snapshot);
}

export async function collectOneOfficeProjectInventory(
  tabId: number,
): Promise<OneOfficeProjectInventory> {
  if (!chromeApi?.scripting?.executeScript) {
    throw new Error('Chrome scripting access is unavailable. Reload the extension and try again.');
  }

  let apiError: unknown;
  try {
    const apiResults = await chromeApi.scripting.executeScript({
      target: { tabId },
      func: collectOneOfficeProjectInventoryFromApi,
      args: [{ allowedOrigin: ONEOFFICE_ALLOWED_ORIGIN }],
    });
    const apiInventory = apiResults?.[0]?.result as OneOfficeProjectInventory | undefined;
    if (apiInventory?.tasks) {
      return apiInventory;
    }
  } catch (error) {
    apiError = error;
  }

  const domResults = await chromeApi.scripting.executeScript({
    target: { tabId },
    func: collectOneOfficeProjectInventoryFromPage,
    args: [{ allowedOrigin: ONEOFFICE_ALLOWED_ORIGIN }],
  });
  const inventory = domResults?.[0]?.result as OneOfficeProjectInventory | undefined;

  if (!inventory?.tasks) {
    throw new Error('The 1Office project inventory collector returned no task data.');
  }

  if (!inventory.collection.complete) {
    const reason = apiError instanceof Error ? ` ${apiError.message}` : '';
    throw new Error(
      `1Office only exposed a partial project task table and the full Gantt inventory could not be loaded.${reason}`,
    );
  }

  return inventory;
}

export function parseOneOfficeSnapshot(
  snapshot: OneOfficePageSnapshot,
): OneOfficeDiscussionExport {
  const parsedDocument = new DOMParser().parseFromString(
    `<main>${snapshot.detailFieldsHtml}${snapshot.discussionHtml}</main>`,
    'text/html',
  );
  const parsed = parseOneOfficeDiscussion(parsedDocument, {
    capturedAt: snapshot.capturedAt,
    loadMoreClicks: snapshot.loadMoreClicks,
    sourceUrl: snapshot.sourceUrl,
  });
  const warnings = Array.from(
    new Set([...snapshot.warnings, ...parsed.collection.warnings]),
  );

  return {
    ...parsed,
    collection: {
      ...parsed.collection,
      complete: snapshot.complete && parsed.collection.complete,
      expectedRootCommentCount:
        snapshot.expectedRootCommentCount ?? parsed.collection.expectedRootCommentCount,
      warnings,
    },
  };
}

export function subscribeToOneOfficeProgress(listener: ProgressListener): () => void {
  if (!chromeApi?.runtime?.onMessage?.addListener) {
    return () => undefined;
  }

  const messageListener = (message: unknown) => {
    const candidate = message as {
      type?: string;
      progress?: OneOfficeCollectionProgress;
    };

    if (candidate.type === ONEOFFICE_PROGRESS_MESSAGE && candidate.progress) {
      listener(candidate.progress);
    }
  };

  chromeApi.runtime.onMessage.addListener(messageListener);
  return () => chromeApi.runtime.onMessage.removeListener(messageListener);
}
