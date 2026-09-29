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
import { TadtLogo } from '../shared/TadtLogo';

interface TaskViewState {
  state: OneOfficeProjectTaskCollectionState;
  result: OneOfficeProjectTaskCollectionResult | null;
}

const stateLabel: Record<OneOfficeProjectTaskCollectionState, string> = {
  pending: 'Chờ xử lý',
  collecting: 'Đang thu thập',
  complete: 'Hoàn thành',
  incomplete: 'Chưa đầy đủ',
  failed: 'Thất bại',
  cancelled: 'Đã hủy',
};

const stateColor: Record<OneOfficeProjectTaskCollectionState, string> = {
  pending: 'text-slate-500',
  collecting: 'text-blue-700',
  complete: 'text-emerald-700',
  incomplete: 'text-amber-700',
  failed: 'text-red-700',
  cancelled: 'text-slate-500',
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Không thể thu thập thảo luận của dự án.';

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
          throw new Error('Không có phiên thu thập dự án. Hãy bắt đầu lại từ cửa sổ T-eraClip.');
        }

        setProjectName(session.inventory.project.name || `Dự án ${session.inventory.project.internalId}`);
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
      setDownloadFeedback(`Đã tải xuống ${filename}`);
      setIsConfirmingExport(false);
    } catch (error) {
      setDownloadFeedback(`Tải xuống thất bại. ${getErrorMessage(error)}`);
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return <main className="mx-auto max-w-6xl p-8 text-sm text-slate-600">Đang chuẩn bị thu thập dữ liệu dự án...</main>;
  }

  if (errorMessage) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-800">Không thể thu thập dữ liệu dự án</h1>
          <p className="mt-3 text-sm leading-6 text-red-700">{errorMessage}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl p-6 sm:p-8">
      <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-indigo-800 to-violet-700 p-6 text-white shadow-xl shadow-blue-900/15">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <TadtLogo className="h-14 w-24 rounded-lg bg-white object-contain p-1" />
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
              Thu thập thảo luận toàn dự án
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white">{projectName}</h1>
            <p className="mt-2 text-sm text-blue-100">
              {isFinished
                ? result?.cancelled
                  ? 'Đã dừng thu thập.'
                  : 'Đã hoàn tất thu thập.'
                : `Đã xử lý ${progress?.completedCount ?? 0}/${progress?.totalCount ?? taskRows.length} công việc.`}
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
              {isCancelling ? 'Đang dừng sau nhóm hiện tại...' : 'Dừng thu thập'}
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
              Xuất Excel
            </button>
          )}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-2xl font-semibold text-white">{progress?.completedCount ?? 0}/{taskRows.length}</p>
            <p className="mt-1 text-xs text-blue-100">Công việc đã xử lý</p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-2xl font-semibold text-emerald-200">{successfulCount}</p>
            <p className="mt-1 text-xs text-blue-100">Thu thập thành công</p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-2xl font-semibold text-red-200">{failedCount}</p>
            <p className="mt-1 text-xs text-blue-100">Thất bại</p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-lg font-semibold text-white">{rootCount} + {replyCount}</p>
            <p className="mt-1 text-xs text-blue-100">Bình luận gốc + phản hồi</p>
          </div>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full bg-cyan-300 transition-all"
            style={{
              width: `${taskRows.length ? ((progress?.completedCount ?? 0) / taskRows.length) * 100 : 0}%`,
            }}
          />
        </div>
        <p className="mt-3 text-xs leading-5 text-blue-100">
          Giữ trang này và tab dự án nguồn luôn mở. Hệ thống xử lý theo nhóm nhỏ; chỉ các thảo luận cần phương án dự phòng mới được mở trên tab nguồn.
        </p>
      </header>

      {downloadFeedback && (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {downloadFeedback}
        </p>
      )}

      {result && result.warnings.length > 0 && (
        <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-800">Cảnh báo khi thu thập</h2>
          <ul className="mt-3 space-y-2 text-sm text-amber-700">
            {result.warnings.map((warning) => (
              <li key={warning}>- {warning}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-900">Trạng thái thu thập theo công việc</h2>
          <p className="mt-1 text-xs text-slate-500">
            Danh sách chi tiết được hiển thị tại đây để dễ theo dõi dự án có nhiều công việc.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">No.</th>
                <th className="px-4 py-3">Mã công việc</th>
                <th className="px-4 py-3">Tên công việc</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Thảo luận</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(taskStates).map(([taskId, taskView]) => {
                const sourceTask =
                  taskView.result?.task ??
                  inventoryTasks.find((item) => item.internalId === taskId) ??
                  null;
                const discussion = taskView.result?.discussion;

                return (
                  <tr key={taskId}>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-blue-700">{sourceTask?.no ?? ''}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{sourceTask?.code ?? ''}</td>
                    <td className="min-w-64 px-4 py-3 text-slate-800">{sourceTask?.name ?? `Công việc ${taskId}`}</td>
                    <td className={`whitespace-nowrap px-4 py-3 font-medium ${stateColor[taskView.state]}`}>
                      {stateLabel[taskView.state]}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {taskView.result?.error
                        ? taskView.result.error
                        : discussion
                          ? `${discussion.collection.loadedRootCommentCount} bình luận, ${discussion.collection.loadedReplyCount} phản hồi`
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <section
            aria-labelledby="confirm-project-export-title"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            role="dialog"
          >
            <h2
              className="text-lg font-semibold text-slate-900"
              id="confirm-project-export-title"
            >
              Xác nhận xuất Excel toàn dự án
            </h2>
            <p className="mt-3 break-all text-sm leading-6 text-slate-700">
              {createOneOfficeProjectXlsxFilename(result)}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              File gồm các sheet Dự án, Công việc, Thảo luận và Tệp đính kèm. Dữ liệu gồm No., mã và tên công việc, cấu trúc phản hồi, tác giả, thời gian, người được nhắc đến và thông tin tệp. File đính kèm gốc chưa được tải kèm.
            </p>

            {hasIncompleteTasks && (
              <label className="mt-4 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <input
                  checked={incompleteAcknowledged}
                  className="mt-1"
                  onChange={(event) => setIncompleteAcknowledged(event.target.checked)}
                  type="checkbox"
                />
                Tôi hiểu rằng một số công việc chưa đầy đủ, thất bại hoặc đã bị hủy và vẫn muốn xuất phần dữ liệu hiện có.
              </label>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                disabled={isDownloading}
                onClick={() => setIsConfirmingExport(false)}
                type="button"
              >
                Hủy
              </button>
              <button
                className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isDownloading || (hasIncompleteTasks && !incompleteAcknowledged)}
                onClick={() => {
                  void handleDownload();
                }}
                type="button"
              >
                {isDownloading ? 'Đang chuẩn bị...' : 'Tải file Excel'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
