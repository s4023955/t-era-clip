import React, { useCallback, useEffect, useState } from 'react';
import {
  collectOneOfficeDiscussion,
  collectOneOfficeProjectInventory,
  getActiveTab,
  isOneOfficeProjectPageUrl,
  isSupportedOneOfficeUrl,
  subscribeToOneOfficeProgress,
  type ActiveTab
} from '../oneoffice/collectionClient';
import type { OneOfficeCollectionProgress } from '../oneoffice/collector';
import { openOneOfficeReview } from '../oneoffice/reviewSession';
import { openOneOfficeProjectBatchReview } from '../oneoffice/projectBatchSession';
import type {
  OneOfficeDiscussionExport,
  OneOfficeProjectInventory
} from '../oneoffice/types';
import {
  generateCompletedList,
  generateDailyReport,
  generateFollowUpList,
  generateWaitingList
} from '../shared/reportGenerator';
import { getItems, updateItem } from '../shared/storage';
import {
  generateInternalFollowUpTemplate,
  generateLeadershipSummaryTemplate,
  generateMeetingActionListTemplate,
  generateVendorFollowUpTemplate
} from '../shared/templateGenerator';
import type { TeraClipItem, TeraClipPriority, TeraClipStatus } from '../shared/types';

const STATUS_OPTIONS: TeraClipStatus[] = ['inbox', 'todo', 'doing', 'waiting', 'done', 'archived'];
const PRIORITY_OPTIONS: TeraClipPriority[] = ['low', 'medium', 'high', 'urgent'];

type StatusFilter = TeraClipStatus | 'all';
type PriorityFilter = TeraClipPriority | 'all';
type ReportType = 'daily' | 'followup' | 'waiting' | 'completed';
type TemplateType = 'vendor' | 'internal' | 'leadership' | 'meeting';

type ItemDraft = {
  title: string;
  notes: string;
};

type ItemDrafts = Record<string, ItemDraft>;

const REPORT_OPTIONS: { label: string; value: ReportType }[] = [
  { label: 'Daily report', value: 'daily' },
  { label: 'Follow-up list', value: 'followup' },
  { label: 'Waiting list', value: 'waiting' },
  { label: 'Completed list', value: 'completed' }
];

const TEMPLATE_OPTIONS: { label: string; value: TemplateType }[] = [
  { label: 'Vendor follow-up', value: 'vendor' },
  { label: 'Internal follow-up', value: 'internal' },
  { label: 'Leadership summary', value: 'leadership' },
  { label: 'Meeting action list', value: 'meeting' }
];

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

const getOneOfficeErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unable to collect the 1Office discussion.';
};

const generateReportText = (reportType: ReportType, items: TeraClipItem[]): string => {
  switch (reportType) {
    case 'followup':
      return generateFollowUpList(items);
    case 'waiting':
      return generateWaitingList(items);
    case 'completed':
      return generateCompletedList(items);
    case 'daily':
    default:
      return generateDailyReport(items);
  }
};

const generateTemplateText = (templateType: TemplateType, items: TeraClipItem[]): string => {
  switch (templateType) {
    case 'internal':
      return generateInternalFollowUpTemplate(items);
    case 'leadership':
      return generateLeadershipSummaryTemplate(items);
    case 'meeting':
      return generateMeetingActionListTemplate(items);
    case 'vendor':
    default:
      return generateVendorFollowUpTemplate(items);
  }
};

export function PopupApp() {
  const [items, setItems] = useState<TeraClipItem[]>([]);
  const [itemDrafts, setItemDrafts] = useState<ItemDrafts>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [reportText, setReportText] = useState('');
  const [reportFeedback, setReportFeedback] = useState('');
  const [templateType, setTemplateType] = useState<TemplateType>('vendor');
  const [templateText, setTemplateText] = useState('');
  const [templateFeedback, setTemplateFeedback] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [updatingItemIds, setUpdatingItemIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState('');
  const [updateErrorMessage, setUpdateErrorMessage] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [oneOfficeTab, setOneOfficeTab] = useState<ActiveTab | null>(null);
  const [isCollectingOneOffice, setIsCollectingOneOffice] = useState(false);
  const [oneOfficeProgress, setOneOfficeProgress] = useState<OneOfficeCollectionProgress | null>(
    null
  );
  const [oneOfficeResult, setOneOfficeResult] = useState<OneOfficeDiscussionExport | null>(null);
  const [oneOfficeError, setOneOfficeError] = useState('');
  const [isOpeningOneOfficeReview, setIsOpeningOneOfficeReview] = useState(false);
  const [isCollectingProjectInventory, setIsCollectingProjectInventory] = useState(false);
  const [projectInventory, setProjectInventory] = useState<OneOfficeProjectInventory | null>(null);
  const [isOpeningProjectReview, setIsOpeningProjectReview] = useState(false);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    setUpdateErrorMessage('');
    setValidationErrors({});
    setReportFeedback('');
    setTemplateFeedback('');

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

  const handleGenerateReport = () => {
    setReportText(generateReportText(reportType, items));
    setReportFeedback('');
  };

  const handleCopyReport = async () => {
    if (!reportText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(reportText);
      setReportFeedback('Copied to clipboard.');
    } catch (error) {
      setReportFeedback(`Could not copy report. ${getErrorMessage(error)}`);
    }
  };

  const handleGenerateTemplate = () => {
    setTemplateText(generateTemplateText(templateType, items));
    setTemplateFeedback('');
  };

  const handleCopyTemplate = async () => {
    if (!templateText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(templateText);
      setTemplateFeedback('Copied to clipboard.');
    } catch (error) {
      setTemplateFeedback(`Could not copy template. ${getErrorMessage(error)}`);
    }
  };

  const handleCollectOneOffice = async () => {
    if (!oneOfficeTab || isCollectingOneOffice) {
      return;
    }

    setIsCollectingOneOffice(true);
    setOneOfficeProgress(null);
    setOneOfficeResult(null);
    setOneOfficeError('');

    try {
      const result = await collectOneOfficeDiscussion(oneOfficeTab.id);
      setOneOfficeResult(result);
    } catch (error) {
      setOneOfficeError(getOneOfficeErrorMessage(error));
    } finally {
      setIsCollectingOneOffice(false);
    }
  };

  const handleOpenOneOfficeReview = async () => {
    if (!oneOfficeResult || isOpeningOneOfficeReview) {
      return;
    }

    setIsOpeningOneOfficeReview(true);
    setOneOfficeError('');

    try {
      await openOneOfficeReview(oneOfficeResult);
    } catch (error) {
      setOneOfficeError(getOneOfficeErrorMessage(error));
      setIsOpeningOneOfficeReview(false);
    }
  };

  const handleCollectProjectInventory = async () => {
    if (!oneOfficeTab || isCollectingProjectInventory) {
      return;
    }

    setIsCollectingProjectInventory(true);
    setProjectInventory(null);
    setOneOfficeError('');

    try {
      const inventory = await collectOneOfficeProjectInventory(oneOfficeTab.id);
      setProjectInventory(inventory);
    } catch (error) {
      setOneOfficeError(getOneOfficeErrorMessage(error));
    } finally {
      setIsCollectingProjectInventory(false);
    }
  };

  const handleOpenProjectReview = async () => {
    if (!oneOfficeTab || !projectInventory || isOpeningProjectReview) {
      return;
    }

    setIsOpeningProjectReview(true);
    setOneOfficeError('');

    try {
      await openOneOfficeProjectBatchReview(oneOfficeTab, projectInventory);
    } catch (error) {
      setOneOfficeError(getOneOfficeErrorMessage(error));
      setIsOpeningProjectReview(false);
    }
  };

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    let isCurrent = true;

    void getActiveTab()
      .then((tab) => {
        if (isCurrent && tab && isSupportedOneOfficeUrl(tab.url)) {
          setOneOfficeTab(tab);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setOneOfficeTab(null);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(
    () => subscribeToOneOfficeProgress((progress) => setOneOfficeProgress(progress)),
    []
  );

  const isFiltering = statusFilter !== 'all' || priorityFilter !== 'all';
  const filteredItems = items.filter((item) => {
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;

    return matchesStatus && matchesPriority;
  });
  const itemCountLabel = isFiltering
    ? `${filteredItems.length} of ${items.length} ${items.length === 1 ? 'item' : 'items'}`
    : `${items.length} ${items.length === 1 ? 'captured item' : 'captured items'}`;
  const oneOfficeAttachmentCount =
    oneOfficeResult?.comments.reduce((count, comment) => count + comment.attachments.length, 0) ?? 0;
  const oneOfficeRootCount = oneOfficeResult?.collection.loadedRootCommentCount ?? 0;
  const oneOfficeReplyCount = oneOfficeResult?.collection.loadedReplyCount ?? 0;
  const visibleOneOfficeWarnings =
    oneOfficeResult?.collection.warnings.filter(
      (warning) => !/^Ignored \d+ duplicate comment ID\(s\)/.test(warning)
    ) ?? [];
  const isOneOfficeProjectPage = oneOfficeTab
    ? isOneOfficeProjectPageUrl(oneOfficeTab.url)
    : false;
  const inventoryMaxDepth = projectInventory
    ? Math.max(...projectInventory.tasks.map((task) => task.depth), 0)
    : 0;

  return (
    <div className="flex h-[520px] w-96 flex-col overflow-hidden bg-slate-950 text-slate-100">
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

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
            Status
            <select
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-medium capitalize text-slate-100 outline-none transition hover:border-slate-500 focus:border-blue-500"
              onChange={(event) => {
                setStatusFilter(event.target.value as StatusFilter);
              }}
              value={statusFilter}
            >
              <option value="all">All</option>
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
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] font-medium capitalize text-slate-100 outline-none transition hover:border-slate-500 focus:border-blue-500"
              onChange={(event) => {
                setPriorityFilter(event.target.value as PriorityFilter);
              }}
              value={priorityFilter}
            >
              <option value="all">All</option>
              {PRIORITY_OPTIONS.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>

          {isFiltering && (
            <button
              className="rounded-md border border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
              onClick={() => {
                setStatusFilter('all');
                setPriorityFilter('all');
              }}
              type="button"
            >
              Clear filters
            </button>
          )}
        </div>

        <p className="mt-2 text-xs text-slate-500">{itemCountLabel}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {oneOfficeTab && (
          <section className="mb-4 rounded-md border border-cyan-900 bg-cyan-950/30 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-cyan-100">1Office discussion</h2>
                <p className="mt-1 truncate text-[11px] text-cyan-200/70" title={oneOfficeTab.title}>
                  {oneOfficeResult?.entity.name || oneOfficeTab.title || 'Current 1Office page'}
                </p>
              </div>

              <button
                className="shrink-0 rounded-md border border-cyan-700 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:border-cyan-500 hover:bg-cyan-900/50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isCollectingOneOffice}
                onClick={() => {
                  void handleCollectOneOffice();
                }}
                type="button"
              >
                {isCollectingOneOffice ? 'Collecting...' : 'Collect discussion'}
              </button>
            </div>

            {isOneOfficeProjectPage && (
              <div className="mt-3 border-t border-cyan-900/80 pt-3">
                <button
                  className="w-full rounded-md border border-cyan-700 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-500 hover:bg-cyan-900/40 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isCollectingProjectInventory || isCollectingOneOffice}
                  onClick={() => {
                    void handleCollectProjectInventory();
                  }}
                  type="button"
                >
                  {isCollectingProjectInventory ? 'Checking project tasks...' : 'Check project tasks'}
                </button>
                <p className="mt-1.5 text-[10px] leading-4 text-cyan-200/60">
                  Inventory validation only. Open the project&apos;s Công việc tab first.
                </p>
              </div>
            )}

            {isCollectingOneOffice && (
              <p className="mt-3 text-xs text-cyan-100">
                Loaded {oneOfficeProgress?.loadedRootCommentCount ?? 0}
                {oneOfficeProgress?.expectedRootCommentCount
                  ? `/${oneOfficeProgress.expectedRootCommentCount}`
                  : ''}{' '}
                root comments
                {oneOfficeProgress ? `, ${oneOfficeProgress.loadMoreClicks} load-more clicks` : ''}.
              </p>
            )}

            {oneOfficeError && (
              <div className="mt-3 rounded-md border border-red-900 bg-red-950/40 p-3 text-xs text-red-100">
                {oneOfficeError}
              </div>
            )}

            {oneOfficeResult && (
              <div className="mt-3 rounded-md border border-cyan-900 bg-slate-950/50 p-3">
                <p className="text-xs font-medium text-cyan-100">
                  {oneOfficeRootCount} root {oneOfficeRootCount === 1 ? 'comment' : 'comments'},{' '}
                  {oneOfficeReplyCount} {oneOfficeReplyCount === 1 ? 'reply' : 'replies'},{' '}
                  {oneOfficeAttachmentCount}{' '}
                  {oneOfficeAttachmentCount === 1 ? 'attachment' : 'attachments'}
                </p>
                <p
                  className={`mt-1 text-[11px] ${
                    oneOfficeResult.collection.complete ? 'text-emerald-300' : 'text-amber-300'
                  }`}
                >
                  {oneOfficeResult.collection.complete
                    ? 'Collection complete.'
                    : 'Collection incomplete. Review warnings before export.'}
                </p>
                {visibleOneOfficeWarnings.length > 0 && (
                  <ul className="mt-2 space-y-1 text-[11px] leading-4 text-amber-200">
                    {visibleOneOfficeWarnings.map((warning) => (
                      <li key={warning}>- {warning}</li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-[11px] text-slate-500">
                  Temporary validation only. Nothing was saved or downloaded.
                </p>
                <button
                  className="mt-3 w-full rounded-md border border-cyan-700 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-500 hover:bg-cyan-900/40 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isOpeningOneOfficeReview}
                  onClick={() => {
                    void handleOpenOneOfficeReview();
                  }}
                  type="button"
                >
                  {isOpeningOneOfficeReview ? 'Opening preview...' : 'Review and export JSON'}
                </button>
              </div>
            )}

            {projectInventory && (
              <div className="mt-3 rounded-md border border-cyan-900 bg-slate-950/50 p-3">
                <p className="text-xs font-medium text-cyan-100">
                  {projectInventory.collection.loadedTaskCount} project tasks, {inventoryMaxDepth}{' '}
                  {inventoryMaxDepth === 1 ? 'level' : 'levels'}
                </p>
                <p
                  className={`mt-1 text-[11px] ${
                    projectInventory.collection.complete ? 'text-emerald-300' : 'text-amber-300'
                  }`}
                >
                  {projectInventory.collection.complete
                    ? 'Task inventory complete.'
                    : 'Task inventory needs review.'}
                </p>

                {projectInventory.collection.warnings.length > 0 && (
                  <ul className="mt-2 space-y-1 text-[11px] leading-4 text-amber-200">
                    {projectInventory.collection.warnings.map((warning) => (
                      <li key={warning}>- {warning}</li>
                    ))}
                  </ul>
                )}

                <button
                  className="mt-3 w-full rounded-md bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isOpeningProjectReview || !projectInventory.collection.complete}
                  onClick={() => {
                    void handleOpenProjectReview();
                  }}
                  type="button"
                >
                  {isOpeningProjectReview
                    ? 'Opening project collection...'
                    : 'Collect all task discussions'}
                </button>
                <p className="mt-2 text-[10px] text-slate-500">
                  Progress and task details will open in a separate full-page view.
                </p>
              </div>
            )}
          </section>
        )}

        <section className="mb-4 rounded-md border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Reports</h2>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">
                Reports use all saved items, not just filtered results.
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 text-[11px] font-medium text-slate-400">
              Report type
              <select
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs font-medium text-slate-100 outline-none transition hover:border-slate-500 focus:border-blue-500"
                onChange={(event) => {
                  setReportType(event.target.value as ReportType);
                  setReportFeedback('');
                }}
                value={reportType}
              >
                {REPORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
              onClick={handleGenerateReport}
              type="button"
            >
              Generate
            </button>
          </div>

          {reportText && (
            <>
              <textarea
                className="mt-3 h-32 w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs leading-5 text-slate-100 outline-none"
                readOnly
                value={reportText}
              />

              <div className="mt-2 flex items-center justify-between gap-3">
                <p
                  className={`min-h-4 text-[11px] ${
                    reportFeedback.startsWith('Could not') ? 'text-red-200' : 'text-emerald-300'
                  }`}
                >
                  {reportFeedback}
                </p>
                <button
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!reportText}
                  onClick={() => {
                    void handleCopyReport();
                  }}
                  type="button"
                >
                  Copy
                </button>
              </div>
            </>
          )}
        </section>

        <section className="mb-4 rounded-md border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-sm font-semibold text-slate-100">Templates</h2>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">
            Templates use all saved items, not just filtered results.
          </p>

          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 text-[11px] font-medium text-slate-400">
              Template type
              <select
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs font-medium text-slate-100 outline-none transition hover:border-slate-500 focus:border-blue-500"
                onChange={(event) => {
                  setTemplateType(event.target.value as TemplateType);
                  setTemplateFeedback('');
                }}
                value={templateType}
              >
                {TEMPLATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
              onClick={handleGenerateTemplate}
              type="button"
            >
              Generate
            </button>
          </div>

          {templateText && (
            <>
              <textarea
                className="mt-3 h-32 w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs leading-5 text-slate-100 outline-none"
                readOnly
                value={templateText}
              />

              <div className="mt-2 flex items-center justify-between gap-3">
                <p
                  className={`min-h-4 text-[11px] ${
                    templateFeedback.startsWith('Could not') ? 'text-red-200' : 'text-emerald-300'
                  }`}
                >
                  {templateFeedback}
                </p>
                <button
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!templateText}
                  onClick={() => {
                    void handleCopyTemplate();
                  }}
                  type="button"
                >
                  Copy
                </button>
              </div>
            </>
          )}
        </section>

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
        ) : filteredItems.length === 0 ? (
          <div className="rounded-md border border-slate-800 bg-slate-900 p-4">
            <p className="text-sm font-medium text-slate-100">No items match the selected filters.</p>
            <p className="mt-2 text-xs leading-5 text-slate-400">Clear filters to show all captured items.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {updateErrorMessage && (
              <div className="rounded-md border border-red-900 bg-red-950/40 p-3 text-xs text-red-100">
                {updateErrorMessage}
              </div>
            )}

            {filteredItems.map((item) => {
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
