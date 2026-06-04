import React, { useCallback, useEffect, useState } from 'react';
import { getItems, updateItem } from '../shared/storage';
import type { TeraClipItem, TeraClipPriority, TeraClipStatus } from '../shared/types';

const STATUS_OPTIONS: TeraClipStatus[] = ['inbox', 'todo', 'doing', 'waiting', 'done', 'archived'];
const PRIORITY_OPTIONS: TeraClipPriority[] = ['low', 'medium', 'high', 'urgent'];

type ItemDraft = {
  title: string;
  notes: string;
};

type ItemDrafts = Record<string, ItemDraft>;

const sortNewestFirst = (items: TeraClipItem[]): TeraClipItem[] =>
  [...items].sort((first, second) => {
    const firstTime = new Date(first.createdAt).getTime();
    const secondTime = new Date(second.createdAt).getTime();

    return secondTime - firstTime;
  });

const formatCreatedAt = (createdAt: string): string => {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return createdAt || 'Unknown date';
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unable to load captured items.';
};

export function PopupApp() {
  const [items, setItems] = useState<TeraClipItem[]>([]);
  const [itemDrafts, setItemDrafts] = useState<ItemDrafts>({});
  const [isLoading, setIsLoading] = useState(true);
  const [updatingItemIds, setUpdatingItemIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState('');
  const [updateErrorMessage, setUpdateErrorMessage] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    setUpdateErrorMessage('');
    setValidationErrors({});

    try {
      const storedItems = await getItems();
      const sortedItems = sortNewestFirst(storedItems);
      setItems(sortedItems);
      setItemDrafts(
        sortedItems.reduce<ItemDrafts>((drafts, item) => {
          drafts[item.id] = {
            title: item.title,
            notes: item.notes
          };
          return drafts;
        }, {})
      );
    } catch (error) {
      setItems([]);
      setItemDrafts({});
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveItem = async (updatedItem: TeraClipItem, errorContext: string): Promise<boolean> => {
    setUpdateErrorMessage('');
    setUpdatingItemIds((currentIds) => new Set(currentIds).add(updatedItem.id));

    try {
      await updateItem(updatedItem);
      setItems((currentItems) =>
        sortNewestFirst(
          currentItems.map((currentItem) => (currentItem.id === updatedItem.id ? updatedItem : currentItem))
        )
      );
      return true;
    } catch (error) {
      setUpdateErrorMessage(`Could not update ${errorContext}. ${getErrorMessage(error)}`);
      return false;
    } finally {
      setUpdatingItemIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(updatedItem.id);
        return nextIds;
      });
    }
  };

  const handleStatusChange = async (item: TeraClipItem, status: TeraClipStatus) => {
    if (item.status === status) {
      return;
    }

    await saveItem(
      {
        ...item,
        status,
        updatedAt: new Date().toISOString()
      },
      'item status'
    );
  };

  const handlePriorityChange = async (item: TeraClipItem, priority: TeraClipPriority) => {
    if (item.priority === priority) {
      return;
    }

    await saveItem(
      {
        ...item,
        priority,
        updatedAt: new Date().toISOString()
      },
      'item priority'
    );
  };

  const handleTitleSave = async (item: TeraClipItem, title: string) => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setValidationErrors((currentErrors) => ({
        ...currentErrors,
        [item.id]: 'Title cannot be empty.'
      }));
      return;
    }

    setValidationErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors[item.id];
      return nextErrors;
    });

    if (item.title === trimmedTitle) {
      setItemDrafts((currentDrafts) => ({
        ...currentDrafts,
        [item.id]: {
          title: item.title,
          notes: currentDrafts[item.id]?.notes ?? item.notes
        }
      }));
      return;
    }

    const wasSaved = await saveItem(
      {
        ...item,
        title: trimmedTitle,
        updatedAt: new Date().toISOString()
      },
      'item title'
    );

    if (wasSaved) {
      setItemDrafts((currentDrafts) => ({
        ...currentDrafts,
        [item.id]: {
          title: trimmedTitle,
          notes: currentDrafts[item.id]?.notes ?? item.notes
        }
      }));
    }
  };

  const handleNotesSave = async (item: TeraClipItem, notes: string) => {
    if (item.notes === notes) {
      return;
    }

    const wasSaved = await saveItem(
      {
        ...item,
        notes,
        updatedAt: new Date().toISOString()
      },
      'item notes'
    );

    if (wasSaved) {
      setItemDrafts((currentDrafts) => ({
        ...currentDrafts,
        [item.id]: {
          title: currentDrafts[item.id]?.title ?? item.title,
          notes
        }
      }));
    }
  };

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  return (
    <div className="h-[520px] w-96 overflow-hidden bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">T-eraClip</h1>
            <p className="mt-1 text-sm text-slate-400">Clip anything. Turn it into action.</p>
          </div>

          <button
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
            onClick={() => {
              void loadItems();
            }}
            type="button"
          >
            Refresh
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          {items.length} {items.length === 1 ? 'captured item' : 'captured items'}
        </p>
      </div>

      <div className="h-[404px] overflow-y-auto p-4">
        {isLoading ? (
          <div className="rounded-md border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
            Loading captured items...
          </div>
        ) : errorMessage ? (
          <div className="rounded-md border border-red-900 bg-red-950/40 p-4">
            <p className="text-sm font-medium text-red-100">Could not load captured items.</p>
            <p className="mt-2 text-xs text-red-200">{errorMessage}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-md border border-slate-800 bg-slate-900 p-4">
            <p className="text-sm font-medium text-slate-100">No captured items yet.</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Select text on any webpage, right-click, and choose Save to T-eraClip.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {updateErrorMessage && (
              <div className="rounded-md border border-red-900 bg-red-950/40 p-3 text-xs text-red-100">
                {updateErrorMessage}
              </div>
            )}

            {items.map((item) => {
              const draft = itemDrafts[item.id] ?? {
                title: item.title,
                notes: item.notes
              };
              const isUpdating = updatingItemIds.has(item.id);
              const isTitleDirty = draft.title !== item.title;
              const isNotesDirty = draft.notes !== item.notes;

              return (
                <article className="rounded-md border border-slate-800 bg-slate-900 p-4" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <label className="min-w-0 flex-1 text-[11px] font-medium text-slate-400">
                      Title
                      <div className="mt-1 flex gap-2">
                        <input
                          className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm font-semibold leading-5 text-slate-100 outline-none transition placeholder:text-slate-600 hover:border-slate-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isUpdating}
                          onChange={(event) => {
                            setItemDrafts((currentDrafts) => ({
                              ...currentDrafts,
                              [item.id]: {
                                title: event.target.value,
                                notes: currentDrafts[item.id]?.notes ?? item.notes
                              }
                            }));
                          }}
                          value={draft.title}
                        />
                        <button
                          className="rounded-md border border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isUpdating || !isTitleDirty}
                          onClick={() => {
                            void handleTitleSave(item, draft.title);
                          }}
                          type="button"
                        >
                          Save
                        </button>
                      </div>
                    </label>
                    <time className="shrink-0 pt-5 text-[11px] text-slate-500">{formatCreatedAt(item.createdAt)}</time>
                  </div>

                  {validationErrors[item.id] && (
                    <p className="mt-2 text-[11px] font-medium text-red-200">{validationErrors[item.id]}</p>
                  )}

                  <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-300">{item.originalText}</p>

                  {(item.sourceTitle || item.sourceUrl) && (
                    <div className="mt-3 border-t border-slate-800 pt-3">
                      {item.sourceTitle && <p className="truncate text-xs text-slate-400">{item.sourceTitle}</p>}
                      {item.sourceUrl && <p className="mt-1 truncate text-[11px] text-slate-500">{item.sourceUrl}</p>}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                      Status
                      <select
                        className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-medium capitalize text-slate-100 outline-none transition hover:border-slate-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isUpdating}
                        onChange={(event) => {
                          void handleStatusChange(item, event.target.value as TeraClipStatus);
                        }}
                        value={item.status}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                      Priority
                      <select
                        className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-medium capitalize text-slate-100 outline-none transition hover:border-slate-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isUpdating}
                        onChange={(event) => {
                          void handlePriorityChange(item, event.target.value as TeraClipPriority);
                        }}
                        value={item.priority}
                      >
                        {PRIORITY_OPTIONS.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="mt-3 block text-[11px] font-medium text-slate-400">
                    Notes
                    <textarea
                      className="mt-1 h-16 w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs leading-5 text-slate-100 outline-none transition placeholder:text-slate-600 hover:border-slate-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isUpdating}
                      onChange={(event) => {
                        setItemDrafts((currentDrafts) => ({
                          ...currentDrafts,
                          [item.id]: {
                            title: currentDrafts[item.id]?.title ?? item.title,
                            notes: event.target.value
                          }
                        }));
                      }}
                      placeholder="Add notes..."
                      value={draft.notes}
                    />
                  </label>

                  <div className="mt-2 flex justify-end">
                    <button
                      className="rounded-md border border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isUpdating || !isNotesDirty}
                      onClick={() => {
                        void handleNotesSave(item, draft.notes);
                      }}
                      type="button"
                    >
                      Save notes
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
