import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  collectOneOfficeProjectTaskDiscussions,
  type OneOfficeProjectBatchProgress,
} from '../oneoffice/projectBatchCollector';
import {
  createOneOfficeProjectXlsxFilename,
  downloadOneOfficeProjectXlsx,
} from '../oneoffice/export/projectXlsx';
import { getOneOfficeProjectBatchSession } from '../oneoffice/projectBatchSession';
import type {
  OneOfficeProjectBatchResult,
  OneOfficeProjectTaskCollectionResult,
  OneOfficeProjectTaskCollectionState,
  OneOfficeProjectTaskInventoryItem,
} from '../oneoffice/types';

interface TaskViewState {
  state: OneOfficeProjectTaskCollectionState;
  result: OneOfficeProjectTaskCollectionResult | null;
}

const stateLabel: Record<OneOfficeProjectTaskCollectionState, string> = {
  pending: 'Pending',
  collecting: 'Collecting',
  complete: 'Complete',
  incomplete: 'Incomplete',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

const stateColor: Record<OneOfficeProjectTaskCollectionState, string> = {
  pending: 'text-slate-500',
  collecting: 'text-cyan-300',
  complete: 'text-emerald-300',
  incomplete: 'text-amber-300',
  failed: 'text-red-300',
  cancelled: 'text-slate-400',
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unable to collect project discussions.';

export function ProjectReviewApp() {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [projectName, setProjectName] = useState('');
  const [inventoryTasks, setInventoryTasks] = useState<OneOfficeProjectTaskInventoryItem[]>([]);
  const [taskStates, setTaskStates] = useState<Record<string, TaskViewState>>({});
  const [progress, setProgress] = useState<OneOfficeProjectBatchProgress | null>(null);
  const [result, setResult] = useState<OneOfficeProjectBatchResult | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isConfirmingExport, setIsConfirmingExport] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [incompleteAcknowledged, setIncompleteAcknowledged] = useState(false);
  const [downloadFeedback, setDownloadFeedback] = useState('');
  const startedRef = useRef(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    void getOneOfficeProjectBatchSession()
      .then(async (session) => {
        if (!session) {
          throw new Error('No project collection session is available. Start it from the popup.');
        }

        setProjectName(session.inventory.project.name || `Project ${session.inventory.project.internalId}`);
        setInventoryTasks(session.inventory.tasks);
        setTaskStates(
          Object.fromEntries(
            session.inventory.tasks.map((task) => [
              task.internalId,
              { state: 'pending' as const, result: null },
            ]),
          ),
        );
        setIsLoading(false);

        const batchResult = await collectOneOfficeProjectTaskDiscussions(
          session.sourceTab.id,
          session.inventory,
          (nextProgress) => {
            setProgress(nextProgress);
            if (nextProgress.currentTask) {
              setTaskStates((current) => ({
                ...current,
                [nextProgress.currentTask!.internalId]: {
                  state: nextProgress.result?.state ?? 'collecting',
                  result: nextProgress.result,
                },
              }));
            }
          },
          () => cancelRef.current,
        );

        setResult(batchResult);
        setTaskStates(
          Object.fromEntries(
            batchResult.tasks.map((taskResult) => [
              taskResult.task.internalId,
              { state: taskResult.state, result: taskResult },
            ]),
          ),
        );

      })
      .catch((error) => {
        setErrorMessage(getErrorMessage(error));
        setIsLoading(false);
      });
  }, []);

  const taskRows = useMemo(() => Object.values(taskStates), [taskStates]);
  const successfulCount = taskRows.filter(
    (task) => task.state === 'complete' || task.state === 'incomplete',
  ).length;
  const failedCount = taskRows.filter((task) => task.state === 'failed').length;
  const rootCount = taskRows.reduce(
    (total, task) => total + (task.result?.discussion?.collection.loadedRootCommentCount ?? 0),
    0,
  );
  const replyCount = taskRows.reduce(
    (total, task) => total + (task.result?.discussion?.collection.loadedReplyCount ?? 0),
    0,
  );
  const isFinished = Boolean(result);
  const hasIncompleteTasks = Boolean(
    result?.tasks.some((task) => task.state !== 'complete'),
  );

  const handleDownload = async () => {
    if (!result || (hasIncompleteTasks && !incompleteAcknowledged)) {
      return;
    }

    setIsDownloading(true);
    setDownloadFeedback('');
    try {
      const filename = await downloadOneOfficeProjectXlsx(result);
      setDownloadFeedback(`Downloaded ${filename}`);
      setIsConfirmingExport(false);
    } catch (error) {
      setDownloadFeedback(`Download failed. ${getErrorMessage(error)}`);
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return <main className="mx-auto max-w-6xl p-8 text-sm text-slate-300">Preparing project collection...</main>;
  }

  if (errorMessage) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <section className="rounded-xl border border-red-900 bg-red-950/30 p-6">
          <h1 className="text-xl font-semibold text-red-100">Project collection unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-red-200">{errorMessage}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-6 sm:p-8">
      <header className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
              Project discussion collection
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-100">{projectName}</h1>
            <p className="mt-2 text-sm text-slate-400">
              {isFinished
                ? result?.cancelled
                  ? 'Collection cancelled.'
                  : 'Collection finished.'
                : `Processed ${progress?.completedCount ?? 0} of ${progress?.totalCount ?? taskRows.length} tasks.`}
            </p>
          </div>

          {!isFinished ? (
            <button
              className="rounded-md border border-red-800 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-950/40 disabled:opacity-50"
              disabled={isCancelling}
              onClick={() => {
                cancelRef.current = true;
                setIsCancelling(true);
              }}
              type="button"
            >
              {isCancelling ? 'Stopping after current group...' : 'Stop collection'}
            </button>
          ) : (
            <button
              className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
              onClick={() => {
                setIncompleteAcknowledged(false);
                setDownloadFeedback('');
                setIsConfirmingExport(true);
              }}
              type="button"
            >
              Export Excel
            </button>
          )}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <p className="text-2xl font-semibold text-slate-100">{progress?.completedCount ?? 0}/{taskRows.length}</p>
            <p className="mt-1 text-xs text-slate-500">Tasks processed</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <p className="text-2xl font-semibold text-emerald-300">{successfulCount}</p>
            <p className="mt-1 text-xs text-slate-500">Collected</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <p className="text-2xl font-semibold text-red-300">{failedCount}</p>
            <p className="mt-1 text-xs text-slate-500">Failed</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <p className="text-lg font-semibold text-slate-100">{rootCount} + {replyCount}</p>
            <p className="mt-1 text-xs text-slate-500">Root comments + replies</p>
          </div>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full bg-cyan-500 transition-all"
            style={{
              width: `${taskRows.length ? ((progress?.completedCount ?? 0) / taskRows.length) * 100 : 0}%`,
            }}
          />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Keep this page and the source project tab open. Tasks are collected in small groups; only discussions that need fallback may open in the source tab. Project-wide Excel export is not enabled in this validation phase.
        </p>
      </header>

      {downloadFeedback && (
        <p className="mt-4 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
          {downloadFeedback}
        </p>
      )}

      {result && result.warnings.length > 0 && (
        <section className="mt-5 rounded-xl border border-amber-800 bg-amber-950/30 p-5">
          <h2 className="text-sm font-semibold text-amber-200">Collection warnings</h2>
          <ul className="mt-3 space-y-2 text-sm text-amber-100">
            {result.warnings.map((warning) => (
              <li key={warning}>- {warning}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-5 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 p-5">
          <h2 className="text-lg font-semibold text-slate-100">Task collection status</h2>
          <p className="mt-1 text-xs text-slate-500">
            The detailed list is shown here instead of the extension popup.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
            <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">No.</th>
                <th className="px-4 py-3">Task code</th>
                <th className="px-4 py-3">Task name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Discussion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {Object.entries(taskStates).map(([taskId, taskView]) => {
                const sourceTask =
                  taskView.result?.task ??
                  inventoryTasks.find((item) => item.internalId === taskId) ??
                  null;
                const discussion = taskView.result?.discussion;

                return (
                  <tr key={taskId}>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-cyan-300">{sourceTask?.no ?? ''}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-300">{sourceTask?.code ?? ''}</td>
                    <td className="min-w-64 px-4 py-3 text-slate-200">{sourceTask?.name ?? `Task ${taskId}`}</td>
                    <td className={`whitespace-nowrap px-4 py-3 font-medium ${stateColor[taskView.state]}`}>
                      {stateLabel[taskView.state]}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {taskView.result?.error
                        ? taskView.result.error
                        : discussion
                          ? `${discussion.collection.loadedRootCommentCount} roots, ${discussion.collection.loadedReplyCount} replies`
                          : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {isConfirmingExport && result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <section
            aria-labelledby="confirm-project-export-title"
            aria-modal="true"
            className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
            role="dialog"
          >
            <h2
              className="text-lg font-semibold text-slate-100"
              id="confirm-project-export-title"
            >
              Confirm project Excel export
            </h2>
            <p className="mt-3 break-all text-sm leading-6 text-slate-300">
              {createOneOfficeProjectXlsxFilename(result)}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              The workbook contains Project, Tasks, Discussion, and Attachments sheets. It includes task No., task code, task name, comment hierarchy, authors, timestamps, mentions, and attachment metadata. Original attachment files are not included.
            </p>

            {hasIncompleteTasks && (
              <label className="mt-4 flex items-start gap-3 rounded-md border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-100">
                <input
                  checked={incompleteAcknowledged}
                  className="mt-1"
                  onChange={(event) => setIncompleteAcknowledged(event.target.checked)}
                  type="checkbox"
                />
                I understand that one or more tasks are incomplete, failed, or cancelled and still want to export the available data.
              </label>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
                disabled={isDownloading}
                onClick={() => setIsConfirmingExport(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isDownloading || (hasIncompleteTasks && !incompleteAcknowledged)}
                onClick={() => {
                  void handleDownload();
                }}
                type="button"
              >
                {isDownloading ? 'Preparing...' : 'Download Excel'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
