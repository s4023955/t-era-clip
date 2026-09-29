import React, { useEffect, useMemo, useState } from 'react';
import {
  createOneOfficeJsonFilename,
  downloadOneOfficeJson,
} from '../oneoffice/export/json';
import {
  createOneOfficeXlsxFilename,
  downloadOneOfficeXlsx,
} from '../oneoffice/export/xlsx';
import { getOneOfficeReview } from '../oneoffice/reviewSession';
import type { OneOfficeComment, OneOfficeDiscussionExport } from '../oneoffice/types';

const DUPLICATE_DIAGNOSTIC_PATTERN = /^Ignored \d+ duplicate comment ID\(s\)/;
type ExportFormat = 'json' | 'xlsx';

const formatTimestamp = (comment: OneOfficeComment): string => {
  if (!comment.createdAtIso) {
    return comment.createdAtRaw || 'Unknown time';
  }

  const parsed = new Date(comment.createdAtIso);
  if (Number.isNaN(parsed.getTime())) {
    return comment.createdAtRaw;
  }

  return parsed.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unable to load the temporary review data.';

export function ReviewApp() {
  const [result, setResult] = useState<OneOfficeDiscussionExport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');
  const [isDownloading, setIsDownloading] = useState(false);
  const [incompleteAcknowledged, setIncompleteAcknowledged] = useState(false);
  const [downloadFeedback, setDownloadFeedback] = useState('');

  useEffect(() => {
    void getOneOfficeReview()
      .then((reviewResult) => {
        if (!reviewResult) {
          setErrorMessage('No temporary 1Office review is available. Collect the discussion again.');
          return;
        }
        setResult(reviewResult);
      })
      .catch((error) => setErrorMessage(getErrorMessage(error)))
      .finally(() => setIsLoading(false));
  }, []);

  const comments = useMemo(
    () => [...(result?.comments ?? [])].sort((first, second) => first.sourceOrder - second.sourceOrder),
    [result],
  );
  const attachmentCount = useMemo(
    () => comments.reduce((total, comment) => total + comment.attachments.length, 0),
    [comments],
  );
  const actionableWarnings =
    result?.collection.warnings.filter(
      (warning) => !DUPLICATE_DIAGNOSTIC_PATTERN.test(warning),
    ) ?? [];
  const diagnostics =
    result?.collection.warnings.filter((warning) => DUPLICATE_DIAGNOSTIC_PATTERN.test(warning)) ?? [];

  const openExportConfirmation = (format: ExportFormat) => {
    setExportFormat(format);
    setIncompleteAcknowledged(false);
    setDownloadFeedback('');
    setIsConfirming(true);
  };

  const handleDownload = async () => {
    if (!result || (!result.collection.complete && !incompleteAcknowledged)) {
      return;
    }

    setIsDownloading(true);
    try {
      const filename =
        exportFormat === 'xlsx'
          ? await downloadOneOfficeXlsx(result)
          : downloadOneOfficeJson(result);
      setDownloadFeedback(`Downloaded ${filename}`);
      setIsConfirming(false);
    } catch (error) {
      setDownloadFeedback(`Download failed. ${getErrorMessage(error)}`);
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return <main className="mx-auto max-w-5xl p-8 text-sm text-slate-300">Loading preview...</main>;
  }

  if (errorMessage || !result) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <section className="rounded-xl border border-red-900 bg-red-950/30 p-6">
          <h1 className="text-xl font-semibold text-red-100">Preview unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-red-200">{errorMessage}</p>
        </section>
      </main>
    );
  }

  const filename =
    exportFormat === 'xlsx'
      ? createOneOfficeXlsxFilename(result)
      : createOneOfficeJsonFilename(result);
  const rootCount = result.collection.loadedRootCommentCount;
  const replyCount = result.collection.loadedReplyCount;

  return (
    <main className="mx-auto max-w-5xl p-6 sm:p-8">
      <header className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
              1Office discussion preview
            </p>
            <h1 className="mt-2 break-words text-2xl font-semibold text-slate-100">
              {result.entity.name || `${result.entity.type} ${result.entity.internalId}`}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {result.entity.code ? `${result.entity.code} · ` : ''}
              {result.entity.type === 'project' ? 'Project' : 'Task'}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
              onClick={() => openExportConfirmation('xlsx')}
              type="button"
            >
              Export Excel
            </button>
            <button
              className="rounded-md border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
              onClick={() => openExportConfirmation('json')}
              type="button"
            >
              Export JSON
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <p className="text-2xl font-semibold text-slate-100">{rootCount}</p>
            <p className="mt-1 text-xs text-slate-500">Root comments</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <p className="text-2xl font-semibold text-slate-100">{replyCount}</p>
            <p className="mt-1 text-xs text-slate-500">Replies</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <p className="text-2xl font-semibold text-slate-100">{attachmentCount}</p>
            <p className="mt-1 text-xs text-slate-500">Attachments</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <p
              className={`text-sm font-semibold ${
                result.collection.complete ? 'text-emerald-300' : 'text-amber-300'
              }`}
            >
              {result.collection.complete ? 'Complete' : 'Incomplete'}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {result.collection.loadMoreClicks} load-more actions
            </p>
          </div>
        </div>

        <dl className="mt-6 grid gap-3 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Captured</dt>
            <dd className="mt-1 text-slate-300">{new Date(result.capturedAt).toLocaleString()}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-slate-500">Source</dt>
            <dd className="mt-1 truncate text-slate-300" title={result.entity.url}>
              {result.entity.url}
            </dd>
          </div>
        </dl>
      </header>

      {actionableWarnings.length > 0 && (
        <section className="mt-5 rounded-xl border border-amber-800 bg-amber-950/30 p-5">
          <h2 className="text-sm font-semibold text-amber-200">Review warnings</h2>
          <ul className="mt-3 space-y-2 text-sm text-amber-100">
            {actionableWarnings.map((warning) => (
              <li key={warning}>- {warning}</li>
            ))}
          </ul>
        </section>
      )}

      {diagnostics.length > 0 && (
        <details className="mt-5 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <summary className="cursor-pointer text-sm font-medium text-slate-300">
            Collection diagnostics ({diagnostics.length})
          </summary>
          <ul className="mt-3 space-y-2 text-xs text-slate-500">
            {diagnostics.map((diagnostic) => (
              <li key={diagnostic}>- {diagnostic}</li>
            ))}
          </ul>
        </details>
      )}

      <section className="mt-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Discussion</h2>
            <p className="mt-1 text-xs text-slate-500">Source order is preserved.</p>
          </div>
          <p className="text-xs text-slate-500">{comments.length} total entries</p>
        </div>

        {comments.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
            <p className="text-sm text-slate-300">This task has no discussion.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {comments.map((comment) => (
              <article
                className="rounded-xl border border-slate-800 bg-slate-900 p-4"
                key={comment.id}
                style={{ marginLeft: `${Math.min(comment.depth, 4) * 24}px` }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-cyan-200">
                      {comment.authorName || 'Unknown author'}
                    </p>
                    {comment.depth > 0 && (
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                        Reply to {comment.parentId}
                      </span>
                    )}
                  </div>
                  <time className="text-xs text-slate-500">{formatTimestamp(comment)}</time>
                </div>

                {comment.contentText ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">
                    {comment.contentText}
                  </p>
                ) : (
                  <p className="mt-3 text-sm italic text-slate-500">No text content</p>
                )}

                {comment.attachments.length > 0 && (
                  <div className="mt-3 border-t border-slate-800 pt-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      Attachments
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-slate-300">
                      {comment.attachments.map((attachment) => (
                        <li key={`${comment.id}-${attachment.index}`}>
                          {attachment.name || 'Unnamed attachment'}
                          {attachment.sizeText ? ` (${attachment.sizeText})` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {isConfirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <section
            aria-labelledby="confirm-export-title"
            aria-modal="true"
            className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
            role="dialog"
          >
            <h2 className="text-lg font-semibold text-slate-100" id="confirm-export-title">
              Confirm {exportFormat === 'xlsx' ? 'Excel' : 'JSON'} export
            </h2>
            <p className="mt-3 break-all text-sm leading-6 text-slate-300">{filename}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {exportFormat === 'xlsx'
                ? 'The workbook contains Entity, Discussion, and Attachments sheets. It includes discussion text, hierarchy, timestamps, mentions, and attachment metadata. Original attachment files are not included.'
                : 'The JSON contains discussion text, authors, timestamps, mentions, attachment metadata, hierarchy, source URL, and collection diagnostics. Original attachment files are not included.'}
            </p>

            {!result.collection.complete && (
              <label className="mt-4 flex items-start gap-3 rounded-md border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-100">
                <input
                  checked={incompleteAcknowledged}
                  className="mt-1"
                  onChange={(event) => setIncompleteAcknowledged(event.target.checked)}
                  type="checkbox"
                />
                I understand that this collection is incomplete and still want to export it.
              </label>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
                disabled={isDownloading}
                onClick={() => setIsConfirming(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  isDownloading || (!result.collection.complete && !incompleteAcknowledged)
                }
                onClick={() => {
                  void handleDownload();
                }}
                type="button"
              >
                {isDownloading
                  ? 'Preparing...'
                  : `Download ${exportFormat === 'xlsx' ? 'Excel' : 'JSON'}`}
              </button>
            </div>
          </section>
        </div>
      )}

      {downloadFeedback && (
        <p className="fixed bottom-5 right-5 rounded-md border border-emerald-800 bg-emerald-950 px-4 py-3 text-sm text-emerald-200 shadow-xl">
          {downloadFeedback}
        </p>
      )}

    </main>
  );
}
