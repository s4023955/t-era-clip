import { addItem } from '../shared/storage';
import type { TeraClipItem } from '../shared/types';

const MENU_ID = 'save-to-teraclip';
const MENU_TITLE = 'Save to T-eraClip';

const chromeApi = typeof globalThis !== 'undefined' ? (globalThis as any).chrome : undefined;

console.log('T-eraClip background worker loaded');

const getChromeLastError = (): string | undefined => chromeApi?.runtime?.lastError?.message;

const createId = (): string => {
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;

  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const createItemFromSelection = (selectedText: string, tab: any): TeraClipItem => {
  const now = new Date().toISOString();

  return {
    id: createId(),
    type: 'note',
    title: selectedText.slice(0, 80).trim(),
    originalText: selectedText,
    sourceUrl: tab?.url ?? '',
    sourceTitle: tab?.title ?? '',
    createdAt: now,
    updatedAt: now,
    status: 'inbox',
    priority: 'medium',
    owner: '',
    dueDate: '',
    category: '',
    tags: [],
    notes: ''
  };
};

const registerContextMenu = () => {
  if (!chromeApi?.contextMenus?.create) {
    console.error('T-eraClip context menu could not be created: chrome.contextMenus is not available.');
    return;
  }

  chromeApi.contextMenus.remove(MENU_ID, () => {
    getChromeLastError();

    chromeApi.contextMenus.create(
      {
        id: MENU_ID,
        title: MENU_TITLE,
        contexts: ['selection']
      },
      () => {
        const error = getChromeLastError();

        if (error) {
          console.error('T-eraClip context menu creation failed:', error);
          return;
        }

        console.log('T-eraClip context menu created.');
      }
    );
  });
};

const handleContextMenuClick = async (info: any, tab: any) => {
  if (info?.menuItemId !== MENU_ID) {
    return;
  }

  const selectedText = info?.selectionText?.trim() ?? '';

  if (!selectedText) {
    console.log('T-eraClip selected text missing; nothing was saved.');
    return;
  }

  try {
    const item = createItemFromSelection(selectedText, tab);
    await addItem(item);
    console.log('T-eraClip item saved successfully:', item.id);
  } catch (error) {
    console.error('T-eraClip storage error while saving selected text:', error);
  }
};

if (chromeApi?.runtime?.onInstalled?.addListener) {
  chromeApi.runtime.onInstalled.addListener(() => {
    console.log('T-eraClip installed or upgraded.');
    registerContextMenu();
  });
}

if (chromeApi?.runtime?.onStartup?.addListener) {
  chromeApi.runtime.onStartup.addListener(registerContextMenu);
}

if (chromeApi?.contextMenus?.onClicked?.addListener) {
  chromeApi.contextMenus.onClicked.addListener(handleContextMenuClick);
}
