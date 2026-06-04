import React, { useCallback, useEffect, useState } from 'react';
import { getItems } from '../shared/storage';
import type { TeraClipItem } from '../shared/types';

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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const storedItems = await getItems();
      setItems(sortNewestFirst(storedItems));
    } catch (error) {
      setItems([]);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

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
            {items.map((item) => (
              <article className="rounded-md border border-slate-800 bg-slate-900 p-4" key={item.id}>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 flex-1 text-sm font-semibold leading-5 text-slate-100">{item.title}</h2>
                  <time className="shrink-0 text-[11px] text-slate-500">{formatCreatedAt(item.createdAt)}</time>
                </div>

                <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-300">{item.originalText}</p>

                {(item.sourceTitle || item.sourceUrl) && (
                  <div className="mt-3 border-t border-slate-800 pt-3">
                    {item.sourceTitle && <p className="truncate text-xs text-slate-400">{item.sourceTitle}</p>}
                    {item.sourceUrl && <p className="mt-1 truncate text-[11px] text-slate-500">{item.sourceUrl}</p>}
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  <span className="rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium capitalize text-slate-300">
                    {item.status}
                  </span>
                  <span className="rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium capitalize text-slate-300">
                    {item.priority}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
