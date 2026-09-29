import type {
  OneOfficeDiscussionExport,
  OneOfficeProjectTaskInventoryItem,
} from './types';
import type { OneOfficePageSnapshot } from './collector';
import { ONEOFFICE_ALLOWED_ORIGIN, parseOneOfficeSnapshot } from './collectionClient';

export interface OneOfficeFastPathPageProbeOptions {
  allowedOrigin: string;
  taskId: string;
}

export interface OneOfficeFastPathPageProbeResult {
  taskId: string;
  available: boolean;
  responseStatus: number;
  responseKind: 'html' | 'json' | 'unknown';
  bodyLength: number;
  rootCount: number;
  replyCount: number;
  hasLoadMore: boolean;
  snapshot: OneOfficePageSnapshot | null;
  error: string | null;
}

export interface OneOfficeFastPathProbeResult extends OneOfficeFastPathPageProbeResult {
  task: OneOfficeProjectTaskInventoryItem;
}

const chromeApi = typeof globalThis !== 'undefined' ? (globalThis as any).chrome : undefined;

export async function probeOneOfficeQuickViewFromPage(
  options: OneOfficeFastPathPageProbeOptions,
): Promise<OneOfficeFastPathPageProbeResult> {
  const baseResult = {
    taskId: options.taskId,
    available: false,
    responseStatus: 0,
    responseKind: 'unknown' as const,
    bodyLength: 0,
    rootCount: 0,
    replyCount: 0,
    hasLoadMore: false,
    snapshot: null,
    error: null,
  };

  if (window.location.origin !== options.allowedOrigin) {
    return { ...baseResult, error: 'The source tab is outside the approved 1Office origin.' };
  }

  try {
    const url = new URL('/apps/work-task-task/view', options.allowedOrigin);
    url.searchParams.set('ID', options.taskId);
    url.searchParams.set('_quickview', '1');

    const response = await fetch(url.href, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'text/html, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    const body = await response.text();
    const contentType = response.headers.get('content-type') ?? '';
    let responseKind: OneOfficeFastPathPageProbeResult['responseKind'] =
      contentType.includes('json') ? 'json' : contentType.includes('html') ? 'html' : 'unknown';
    let htmlCandidate = body;

    if (responseKind === 'json' || body.trimStart().startsWith('{')) {
      responseKind = 'json';
      try {
        const parsed = JSON.parse(body) as unknown;
        const pending: unknown[] = [parsed];

        while (pending.length > 0) {
          const value = pending.shift();
          if (typeof value === 'string' && value.includes('cards comments')) {
            htmlCandidate = value;
            break;
          }
          if (Array.isArray(value)) {
            pending.push(...value);
          } else if (value && typeof value === 'object') {
            pending.push(...Object.values(value as Record<string, unknown>));
          }
        }
      } catch {
        return {
          ...baseResult,
          responseStatus: response.status,
          responseKind,
          bodyLength: body.length,
          snapshot: null,
          error: 'The quickview response was not valid JSON or HTML.',
        };
      }
    }

    const parsedDocument = new DOMParser().parseFromString(htmlCandidate, 'text/html');
    const discussionRoot = parsedDocument.querySelector<HTMLElement>(
      `.cards.comments[comments-id="work-task-task@${options.taskId}"]`,
    );

    if (!response.ok || !discussionRoot) {
      return {
        ...baseResult,
        responseStatus: response.status,
        responseKind,
        bodyLength: body.length,
        snapshot: null,
        error: !response.ok
          ? `Quickview returned HTTP ${response.status}.`
          : 'Quickview did not contain the expected task discussion.',
      };
    }

    const uniqueCommentCount = (selector: string): number => {
      const ids = new Set<string>();
      let withoutId = 0;

      for (const comment of discussionRoot.querySelectorAll<HTMLElement>(selector)) {
        const idClass = Array.from(comment.classList).find((className) =>
          /^comment\d+$/.test(className),
        );
        if (idClass) {
          ids.add(idClass);
        } else {
          withoutId += 1;
        }
      }

      return ids.size + withoutId;
    };

    const hasLoadMore = Boolean(
      discussionRoot.querySelector(':scope > .prev .bt, :scope > .cards-body > .prev .bt'),
    );
    const discussionClone = discussionRoot.cloneNode(true) as HTMLElement;
    for (const removable of discussionClone.querySelectorAll(
      'form, button, input, textarea, [contenteditable="true"], .comment-menu, .comment-panel-reply, .comment-panel-react',
    )) {
      removable.remove();
    }

    const allowedFieldLabels = new Set(['ma cong viec', 'ten cong viec']);
    const normalizeLabel = (value: string): string =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/gi, (character) => (character === 'Đ' ? 'D' : 'd'))
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
    const detailFieldsHtml = Array.from(
      parsedDocument.querySelectorAll<HTMLElement>('.detail-field'),
    )
      .filter((field) => {
        const label = field.querySelector('.detail-field-label')?.textContent ?? '';
        return allowedFieldLabels.has(normalizeLabel(label));
      })
      .map((field) => field.outerHTML)
      .join('');
    const rootCount = uniqueCommentCount(':scope > .cards-body > .comment');
    const replyCount = uniqueCommentCount('.cards.sub-comments .comment');

    return {
      taskId: options.taskId,
      available: true,
      responseStatus: response.status,
      responseKind,
      bodyLength: body.length,
      rootCount,
      replyCount,
      hasLoadMore,
      snapshot: {
        capturedAt: new Date().toISOString(),
        complete: !hasLoadMore,
        detailFieldsHtml,
        discussionHtml: discussionClone.outerHTML,
        expectedRootCommentCount: hasLoadMore ? null : rootCount,
        loadMoreClicks: 0,
        sourceUrl: url.href,
        warnings: [],
      },
      error: null,
    };
  } catch (error) {
    return {
      ...baseResult,
      error: error instanceof Error ? error.message : 'Unknown quickview probe error.',
    };
  }
}

export async function probeOneOfficeProjectFastPath(
  tabId: number,
  tasks: OneOfficeProjectTaskInventoryItem[],
): Promise<OneOfficeFastPathProbeResult[]> {
  if (!chromeApi?.scripting?.executeScript) {
    throw new Error('Chrome scripting access is unavailable. Reload the extension and try again.');
  }

  const results: OneOfficeFastPathProbeResult[] = [];

  for (const task of tasks.slice(0, 3)) {
    try {
      const injectionResults = await chromeApi.scripting.executeScript({
        target: { tabId },
        func: probeOneOfficeQuickViewFromPage,
        args: [{ allowedOrigin: ONEOFFICE_ALLOWED_ORIGIN, taskId: task.internalId }],
      });
      const probe = injectionResults?.[0]?.result as
        | OneOfficeFastPathPageProbeResult
        | undefined;

      results.push({
        task,
        ...(probe ?? {
          taskId: task.internalId,
          available: false,
          responseStatus: 0,
          responseKind: 'unknown',
          bodyLength: 0,
          rootCount: 0,
          replyCount: 0,
          hasLoadMore: false,
          snapshot: null,
          error: 'The quickview probe returned no result.',
        }),
      });
    } catch (error) {
      results.push({
        task,
        taskId: task.internalId,
        available: false,
        responseStatus: 0,
        responseKind: 'unknown',
        bodyLength: 0,
        rootCount: 0,
        replyCount: 0,
        hasLoadMore: false,
        snapshot: null,
        error: error instanceof Error ? error.message : 'Unknown quickview probe error.',
      });
    }
  }

  return results;
}

export async function collectOneOfficeTaskFastPath(
  tabId: number,
  task: OneOfficeProjectTaskInventoryItem,
): Promise<OneOfficeDiscussionExport | null> {
  const [probe] = await probeOneOfficeProjectFastPath(tabId, [task]);

  if (!probe?.available || probe.hasLoadMore || !probe.snapshot) {
    return null;
  }

  const discussion = parseOneOfficeSnapshot(probe.snapshot);
  if (
    discussion.entity.internalId !== task.internalId ||
    discussion.collection.loadedRootCommentCount !== probe.rootCount ||
    discussion.collection.loadedReplyCount !== probe.replyCount
  ) {
    return null;
  }

  return discussion;
}
