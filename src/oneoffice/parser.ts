import { ONEOFFICE_SELECTORS as SELECTORS } from './selectors';
import { parseOneOfficeTimestamp } from './timestamp';
import type {
  OneOfficeAttachment,
  OneOfficeComment,
  OneOfficeDiscussionExport,
  OneOfficeEntityContext,
  OneOfficeEntityType,
  OneOfficeMention,
  ParseOneOfficeDiscussionOptions,
} from './types';

const ENTITY_PATTERN = /^(work-project-project|work-task-task)@(\d+)$/;
const COMMENT_ID_PATTERN = /^comment(\d+)$/;
const USER_ID_PATTERN = /[?&]ID=(\d+)/i;
const BLOCK_ELEMENTS = new Set([
  'ADDRESS',
  'ARTICLE',
  'BLOCKQUOTE',
  'DIV',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'P',
  'PRE',
]);

export class UnsupportedOneOfficePageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedOneOfficePageError';
  }
}

export function parseOneOfficeDiscussion(
  documentRoot: ParentNode,
  options: ParseOneOfficeDiscussionOptions = {},
): OneOfficeDiscussionExport {
  const warnings: string[] = [];
  const discussionRoot = findDiscussionRoot(documentRoot);
  const entity = parseEntity(documentRoot, discussionRoot, options.sourceUrl, warnings);
  const comments: OneOfficeComment[] = [];
  const seenCommentIds = new Set<string>();
  const duplicateCommentIds = new Set<string>();
  let sourceOrder = 0;

  for (const rootNode of directElements(discussionRoot, SELECTORS.rootComments)) {
    parseCommentTree(
      rootNode,
      null,
      null,
      0,
      comments,
      warnings,
      options,
      seenCommentIds,
      duplicateCommentIds,
      () => sourceOrder++,
    );
  }

  if (duplicateCommentIds.size > 0) {
    warnings.push(
      `Ignored ${duplicateCommentIds.size} duplicate comment ID(s) found in the page DOM.`,
    );
  }

  const loadMore = discussionRoot.querySelector<HTMLElement>(SELECTORS.loadMore);
  const rootCount = comments.filter((comment) => comment.depth === 0).length;
  const replyCount = comments.length - rootCount;

  return {
    schemaVersion: 1,
    source: '1office-dom',
    capturedAt: normalizeCapturedAt(options.capturedAt),
    entity,
    collection: {
      complete: !loadMore,
      loadMoreClicks: options.loadMoreClicks ?? 0,
      loadedRootCommentCount: rootCount,
      loadedReplyCount: replyCount,
      expectedRootCommentCount: loadMore
        ? parseExpectedRootCount(loadMore.textContent ?? '', rootCount)
        : rootCount,
      warnings,
    },
    comments,
  };
}

function findDiscussionRoot(documentRoot: ParentNode): HTMLElement {
  const candidates = Array.from(
    documentRoot.querySelectorAll<HTMLElement>(SELECTORS.discussionRoot),
  ).filter((candidate) => !isExplicitlyHidden(candidate));

  if (candidates.length === 0) {
    throw new UnsupportedOneOfficePageError(
      'No visible 1Office discussion container was found.',
    );
  }

  const activeCandidate = candidates.find((candidate) => candidate.closest('.active'));
  return activeCandidate ?? candidates[0];
}

function isExplicitlyHidden(element: HTMLElement): boolean {
  let current: HTMLElement | null = element;

  while (current) {
    if (
      current.hidden ||
      current.classList.contains('hidden') ||
      current.style.display === 'none' ||
      current.getAttribute('aria-hidden') === 'true'
    ) {
      return true;
    }

    current = current.parentElement;
  }

  return false;
}

function parseEntity(
  documentRoot: ParentNode,
  discussionRoot: HTMLElement,
  sourceUrl: string | undefined,
  warnings: string[],
): OneOfficeEntityContext {
  const commentsId = discussionRoot.getAttribute('comments-id') ?? '';
  const match = ENTITY_PATTERN.exec(commentsId);

  if (!match) {
    throw new UnsupportedOneOfficePageError(
      `Unsupported 1Office discussion identifier: ${commentsId || '(missing)'}.`,
    );
  }

  const type: OneOfficeEntityType = match[1] === 'work-task-task' ? 'task' : 'project';
  const fields = readDetailFields(documentRoot);
  const code = readFirstField(fields, type === 'task' ? ['ma cong viec'] : ['ma du an']);
  const name = readFirstField(
    fields,
    type === 'task' ? ['ten cong viec'] : ['ten du an'],
  );

  if (!name) {
    warnings.push(`The ${type} name was not found in the captured DOM.`);
  }

  if (!code) {
    warnings.push(`The ${type} code was not found in the captured DOM.`);
  }

  return {
    type,
    internalId: match[2],
    code,
    name: name ?? '',
    url: sourceUrl ?? ownerDocumentUrl(documentRoot),
  };
}

function readDetailFields(documentRoot: ParentNode): Map<string, string> {
  const fields = new Map<string, string>();

  for (const field of documentRoot.querySelectorAll<HTMLElement>(SELECTORS.field)) {
    const label = field.querySelector(SELECTORS.fieldLabel)?.textContent;
    const value = field.querySelector(SELECTORS.fieldContent)?.textContent;

    if (label && value) {
      fields.set(normalizeLabel(label), normalizeInlineText(value));
    }
  }

  return fields;
}

function readFirstField(fields: Map<string, string>, labels: string[]): string | null {
  for (const label of labels) {
    const value = fields.get(label);
    if (value) {
      return value;
    }
  }

  return null;
}

function normalizeLabel(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, (character) => (character === 'Đ' ? 'D' : 'd'))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCommentTree(
  commentNode: HTMLElement,
  parentId: string | null,
  rootId: string | null,
  depth: number,
  output: OneOfficeComment[],
  warnings: string[],
  options: ParseOneOfficeDiscussionOptions,
  seenCommentIds: Set<string>,
  duplicateCommentIds: Set<string>,
  nextSourceOrder: () => number,
): void {
  const id = readCommentId(commentNode);
  if (!id) {
    warnings.push('Skipped a comment without a confirmed numeric comment class.');
    return;
  }

  const resolvedRootId = rootId ?? id;
  const isDuplicate = seenCommentIds.has(id);

  if (isDuplicate) {
    duplicateCommentIds.add(id);
  } else {
    seenCommentIds.add(id);
    const timestampElement = commentNode.querySelector<HTMLElement>(SELECTORS.timestamp);
    const createdAtRaw = timestampElement?.getAttribute('title')?.trim() ?? '';
    const createdAtIso = parseOneOfficeTimestamp(
      createdAtRaw,
      options.timeZoneOffset ?? '+07:00',
    );

    if (!createdAtIso) {
      warnings.push(`Comment ${id} has an invalid or missing absolute timestamp.`);
    }

    const authorElement = commentNode.querySelector<HTMLAnchorElement>(SELECTORS.author);
    const contentElement = commentNode.querySelector<HTMLElement>(SELECTORS.commentContent);

    if (!authorElement) {
      warnings.push(`Comment ${id} has no confirmed author element.`);
    }

    if (!contentElement) {
      warnings.push(`Comment ${id} has no confirmed content element.`);
    }

    output.push({
      id,
      parentId,
      rootId: resolvedRootId,
      depth,
      sourceOrder: nextSourceOrder(),
      authorId: readUserId(authorElement, commentNode),
      authorName: normalizeInlineText(authorElement?.textContent ?? ''),
      createdAtRaw,
      createdAtIso,
      contentText: contentElement ? readCommentText(contentElement) : '',
      mentions: contentElement ? readMentions(contentElement) : [],
      attachments: contentElement ? readAttachments(contentElement, options.sourceUrl) : [],
    });
  }

  const nestedContainer = commentNode.querySelector<HTMLElement>(SELECTORS.nestedComments);
  if (!nestedContainer) {
    return;
  }

  const parentReference = nestedContainer.getAttribute('comments-id');
  if (parentReference && parentReference !== `c${id}`) {
    warnings.push(
      `Comment ${id} has a mismatched reply container identifier: ${parentReference}.`,
    );
  }

  for (const childNode of directElements(nestedContainer, SELECTORS.rootComments)) {
    parseCommentTree(
      childNode,
      id,
      resolvedRootId,
      depth + 1,
      output,
      warnings,
      options,
      seenCommentIds,
      duplicateCommentIds,
      nextSourceOrder,
    );
  }
}

function directElements(root: ParentNode, selector: string): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(selector));
}

function readCommentId(commentNode: HTMLElement): string | null {
  for (const className of commentNode.classList) {
    const match = COMMENT_ID_PATTERN.exec(className);
    if (match) {
      return match[1];
    }
  }

  return null;
}

function readUserId(
  authorElement: HTMLAnchorElement | null,
  commentNode: HTMLElement,
): string | null {
  const hrefMatch = USER_ID_PATTERN.exec(authorElement?.getAttribute('href') ?? '');
  if (hrefMatch) {
    return hrefMatch[1];
  }

  return commentNode.querySelector<HTMLElement>(SELECTORS.authorAvatar)?.getAttribute('uid') ?? null;
}

function readCommentText(contentElement: HTMLElement): string {
  const clone = contentElement.cloneNode(true) as HTMLElement;
  for (const attachmentContainer of clone.querySelectorAll('.comment-files')) {
    attachmentContainer.remove();
  }

  return extractStructuredText(clone);
}

function readMentions(contentElement: HTMLElement): OneOfficeMention[] {
  const mentions = new Map<string, OneOfficeMention>();

  for (const mentionElement of contentElement.querySelectorAll<HTMLAnchorElement>(SELECTORS.mention)) {
    const displayName = normalizeInlineText(mentionElement.textContent ?? '');
    if (!displayName) {
      continue;
    }

    const userId = USER_ID_PATTERN.exec(mentionElement.getAttribute('href') ?? '')?.[1] ?? null;
    const key = `${userId ?? ''}:${displayName}`;
    mentions.set(key, { userId, displayName });
  }

  return Array.from(mentions.values());
}

function readAttachments(
  contentElement: HTMLElement,
  sourceUrl: string | undefined,
): OneOfficeAttachment[] {
  return Array.from(contentElement.querySelectorAll<HTMLElement>(SELECTORS.attachment)).map(
    (attachmentElement, index) => {
      const description = attachmentElement.querySelector<HTMLElement>(
        SELECTORS.attachmentDescription,
      );
      const lines = description
        ? extractStructuredText(description).split('\n').filter(Boolean)
        : [];
      const sizeText = lines.length > 1 ? lines[lines.length - 1] : null;
      const name = lines.length > 1 ? lines.slice(0, -1).join(' ') : lines[0] ?? '';
      const thumbnail = attachmentElement.querySelector<HTMLImageElement>(
        SELECTORS.attachmentThumbnail,
      );

      return {
        index,
        name,
        sizeText,
        thumbnailUrl: resolveUrl(thumbnail?.getAttribute('src') ?? null, sourceUrl),
        originalDownloadAvailable: Boolean(
          attachmentElement.matches('.quickview') ||
          attachmentElement.querySelector('[rel="download"], [title="Tải xuống"]'),
        ),
      };
    },
  );
}

function extractStructuredText(root: HTMLElement): string {
  let output = '';

  function visit(node: Node): void {
    if (node.nodeType === 3) {
      output += node.textContent ?? '';
      return;
    }

    if (node.nodeType !== 1) {
      return;
    }

    const element = node as Element;

    if (element.tagName === 'BR') {
      output += '\n';
      return;
    }

    const isBlock = BLOCK_ELEMENTS.has(element.tagName);
    if (isBlock && output && !output.endsWith('\n')) {
      output += '\n';
    }

    for (const child of element.childNodes) {
      visit(child);
    }

    if (isBlock && !output.endsWith('\n')) {
      output += '\n';
    }
  }

  for (const child of root.childNodes) {
    visit(child);
  }

  return output
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[\t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeInlineText(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseExpectedRootCount(label: string, loadedRootCount: number): number | null {
  const match = /xem\s+them\s+\d+\s*\/\s*(\d+)/i.exec(normalizeLabel(label));
  return match ? loadedRootCount + Number(match[1]) : null;
}

function normalizeCapturedAt(value: Date | string | undefined): string {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('capturedAt must be a valid date.');
  }

  return date.toISOString();
}

function ownerDocumentUrl(documentRoot: ParentNode): string {
  const document =
    documentRoot.nodeType === 9
      ? (documentRoot as Document)
      : documentRoot.ownerDocument;
  return document?.location?.href === 'about:blank' ? '' : document?.location?.href ?? '';
}

function resolveUrl(value: string | null, baseUrl: string | undefined): string | null {
  if (!value) {
    return null;
  }

  if (!baseUrl) {
    return value;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}
