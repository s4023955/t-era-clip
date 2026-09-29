import writeExcelFile, {
  type CellObject,
  type Sheet,
  type SheetData,
} from 'write-excel-file/browser';
import type {
  OneOfficeComment,
  OneOfficeProjectBatchResult,
  OneOfficeProjectTaskCollectionResult,
} from '../types';

const HEADER_STYLE: Omit<CellObject, 'value'> = {
  backgroundColor: '#0E7490',
  borderColor: '#155E75',
  borderStyle: 'thin',
  fontWeight: 'bold',
  textColor: '#FFFFFF',
  alignVertical: 'center',
  wrap: true,
};

const LABEL_STYLE: Omit<CellObject, 'value'> = {
  backgroundColor: '#E2E8F0',
  borderColor: '#CBD5E1',
  borderStyle: 'thin',
  fontWeight: 'bold',
  textColor: '#0F172A',
  alignVertical: 'top',
};

const DATA_STYLE: Omit<CellObject, 'value'> = {
  borderColor: '#CBD5E1',
  borderStyle: 'thin',
  alignVertical: 'top',
};

const headerCell = (value: string): CellObject => ({ value, ...HEADER_STYLE });
const labelCell = (value: string): CellObject => ({ value, ...LABEL_STYLE });
const dataCell = (value: string | number | boolean): CellObject => ({
  value,
  ...DATA_STYLE,
  wrap: typeof value === 'string',
});
const textCell = (value: string): CellObject => ({
  value,
  type: String,
  format: '@',
  ...DATA_STYLE,
  wrap: true,
});

const sanitizeFilenamePart = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, (character) => (character === 'Đ' ? 'D' : 'd'))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

const countAttachments = (result: OneOfficeProjectTaskCollectionResult): number =>
  result.discussion?.comments.reduce(
    (total, comment) => total + comment.attachments.length,
    0,
  ) ?? 0;

const collectedTasks = (result: OneOfficeProjectBatchResult) =>
  result.tasks.filter((task) => task.discussion !== null);

const createProjectSheet = (result: OneOfficeProjectBatchResult): SheetData => {
  const collected = collectedTasks(result);
  const rootCount = collected.reduce(
    (total, task) => total + (task.discussion?.collection.loadedRootCommentCount ?? 0),
    0,
  );
  const replyCount = collected.reduce(
    (total, task) => total + (task.discussion?.collection.loadedReplyCount ?? 0),
    0,
  );
  const attachmentCount = collected.reduce(
    (total, task) => total + countAttachments(task),
    0,
  );
  const rows: Array<[string, string | number | boolean]> = [
    ['Project ID', result.project.internalId],
    ['Project code', result.project.code ?? ''],
    ['Project name', result.project.name],
    ['Project URL', result.project.url],
    ['Collection started', result.startedAt],
    ['Collection completed', result.completedAt],
    ['Collection cancelled', result.cancelled],
    ['Inventory tasks', result.inventory.tasks.length],
    ['Collected tasks', collected.length],
    ['Failed tasks', result.tasks.filter((task) => task.state === 'failed').length],
    ['Incomplete tasks', result.tasks.filter((task) => task.state === 'incomplete').length],
    ['Cancelled tasks', result.tasks.filter((task) => task.state === 'cancelled').length],
    ['Root comments', rootCount],
    ['Replies', replyCount],
    ['Attachments', attachmentCount],
    [
      'Warnings',
      Array.from(
        new Set([
          ...result.inventory.collection.warnings,
          ...result.warnings,
          ...collected.flatMap((task) => task.discussion?.collection.warnings ?? []),
        ]),
      ).join('\n'),
    ],
  ];

  return [
    [headerCell('Field'), headerCell('Value')],
    ...rows.map(([label, value]) => [labelCell(label), dataCell(value)]),
  ];
};

const createTasksSheet = (result: OneOfficeProjectBatchResult): SheetData => {
  const headers = [
    'No.',
    'Depth',
    'Parent No.',
    'Parent task ID',
    'Task ID',
    'Task code',
    'Task name',
    'Collection status',
    'Root comments',
    'Replies',
    'Attachments',
    'Error',
  ];
  const rows = [...result.tasks]
    .sort((first, second) => first.task.sourceOrder - second.task.sourceOrder)
    .map((taskResult) => [
      textCell(taskResult.task.no),
      dataCell(taskResult.task.depth),
      textCell(taskResult.task.parentNo ?? ''),
      textCell(taskResult.task.parentInternalId ?? ''),
      textCell(taskResult.task.internalId),
      textCell(taskResult.task.code ?? ''),
      textCell(taskResult.task.name),
      dataCell(taskResult.state),
      dataCell(taskResult.discussion?.collection.loadedRootCommentCount ?? 0),
      dataCell(taskResult.discussion?.collection.loadedReplyCount ?? 0),
      dataCell(countAttachments(taskResult)),
      textCell(taskResult.error ?? ''),
    ]);

  return [headers.map(headerCell), ...rows];
};

const createDiscussionSheet = (result: OneOfficeProjectBatchResult): SheetData => {
  const headers = [
    'Row',
    'Project ID',
    'Project name',
    'No.',
    'Task ID',
    'Task code',
    'Task name',
    'Entry type',
    'Comment ID',
    'Parent comment ID',
    'Parent comment content',
    'Root comment ID',
    'Reply depth',
    'Author',
    'Author ID',
    'Comment time',
    'Comment time ISO',
    'Comment content',
    'Mentions',
    'Attachment count',
    'Attachment names',
  ];
  const rows: CellObject[][] = [];
  let rowNumber = 1;

  for (const taskResult of [...result.tasks].sort(
    (first, second) => first.task.sourceOrder - second.task.sourceOrder,
  )) {
    const discussion = taskResult.discussion;
    if (!discussion) {
      continue;
    }

    const comments = [...discussion.comments].sort(
      (first, second) => first.sourceOrder - second.sourceOrder,
    );
    const commentById = new Map(comments.map((comment) => [comment.id, comment]));

    for (const comment of comments) {
      const parent = comment.parentId ? commentById.get(comment.parentId) : null;
      rows.push([
        dataCell(rowNumber++),
        textCell(result.project.internalId),
        textCell(result.project.name),
        textCell(taskResult.task.no),
        textCell(taskResult.task.internalId),
        textCell(taskResult.task.code ?? ''),
        textCell(taskResult.task.name),
        dataCell(comment.parentId ? 'Reply' : 'Root comment'),
        textCell(comment.id),
        textCell(comment.parentId ?? ''),
        textCell(parent?.contentText ?? ''),
        textCell(comment.rootId),
        dataCell(comment.depth),
        textCell(comment.authorName),
        textCell(comment.authorId ?? ''),
        textCell(comment.createdAtRaw),
        textCell(comment.createdAtIso ?? ''),
        {
          ...textCell(comment.contentText),
          indent: Math.min(comment.depth, 4),
        },
        textCell(comment.mentions.map((mention) => mention.displayName).join(', ')),
        dataCell(comment.attachments.length),
        textCell(comment.attachments.map((attachment) => attachment.name).join('\n')),
      ]);
    }
  }

  return [headers.map(headerCell), ...rows];
};

const createAttachmentRow = (
  result: OneOfficeProjectBatchResult,
  taskResult: OneOfficeProjectTaskCollectionResult,
  comment: OneOfficeComment,
  attachmentIndex: number,
): CellObject[] => {
  const attachment = comment.attachments[attachmentIndex];

  return [
    textCell(result.project.internalId),
    textCell(result.project.name),
    textCell(taskResult.task.no),
    textCell(taskResult.task.internalId),
    textCell(taskResult.task.code ?? ''),
    textCell(taskResult.task.name),
    textCell(comment.id),
    textCell(comment.parentId ?? ''),
    textCell(comment.authorName),
    textCell(comment.createdAtRaw),
    dataCell(attachment.index + 1),
    textCell(attachment.name),
    textCell(attachment.sizeText ?? ''),
    dataCell(attachment.originalDownloadAvailable),
    textCell(attachment.thumbnailUrl ?? ''),
  ];
};

const createAttachmentsSheet = (result: OneOfficeProjectBatchResult): SheetData => {
  const headers = [
    'Project ID',
    'Project name',
    'No.',
    'Task ID',
    'Task code',
    'Task name',
    'Comment ID',
    'Parent comment ID',
    'Author',
    'Comment time',
    'Attachment index',
    'Attachment name',
    'Attachment size',
    'Original download available',
    'Thumbnail URL',
  ];
  const rows = [...result.tasks]
    .sort((first, second) => first.task.sourceOrder - second.task.sourceOrder)
    .flatMap((taskResult) =>
      (taskResult.discussion?.comments ?? []).flatMap((comment) =>
        comment.attachments.map((_, attachmentIndex) =>
          createAttachmentRow(result, taskResult, comment, attachmentIndex),
        ),
      ),
    );

  return [headers.map(headerCell), ...rows];
};

export function createOneOfficeProjectXlsxFilename(
  result: OneOfficeProjectBatchResult,
): string {
  const identity = sanitizeFilenamePart(
    result.project.code || result.project.name || result.project.internalId,
  );
  const date = /^\d{4}-\d{2}-\d{2}/.exec(result.completedAt)?.[0] ?? 'undated';

  return `tera-clip-oneoffice-project-${identity || result.project.internalId}-${date}.xlsx`;
}

export function buildOneOfficeProjectWorkbook(
  result: OneOfficeProjectBatchResult,
): Sheet<Blob>[] {
  return [
    {
      data: createProjectSheet(result),
      sheet: 'Project',
      columns: [{ width: 28 }, { width: 80 }],
      stickyRowsCount: 1,
      showGridLines: false,
    },
    {
      data: createTasksSheet(result),
      sheet: 'Tasks',
      columns: [
        { width: 14 },
        { width: 10 },
        { width: 16 },
        { width: 20 },
        { width: 18 },
        { width: 24 },
        { width: 38 },
        { width: 20 },
        { width: 16 },
        { width: 12 },
        { width: 14 },
        { width: 60 },
      ],
      stickyRowsCount: 1,
      stickyColumnsCount: 1,
      showGridLines: false,
    },
    {
      data: createDiscussionSheet(result),
      sheet: 'Discussion',
      columns: [
        { width: 10 },
        { width: 18 },
        { width: 30 },
        { width: 14 },
        { width: 18 },
        { width: 24 },
        { width: 38 },
        { width: 16 },
        { width: 16 },
        { width: 20 },
        { width: 60 },
        { width: 18 },
        { width: 12 },
        { width: 24 },
        { width: 14 },
        { width: 24 },
        { width: 28 },
        { width: 72 },
        { width: 32 },
        { width: 18 },
        { width: 44 },
      ],
      stickyRowsCount: 1,
      stickyColumnsCount: 4,
      orientation: 'landscape',
      showGridLines: false,
    },
    {
      data: createAttachmentsSheet(result),
      sheet: 'Attachments',
      columns: [
        { width: 18 },
        { width: 30 },
        { width: 14 },
        { width: 18 },
        { width: 24 },
        { width: 38 },
        { width: 16 },
        { width: 20 },
        { width: 24 },
        { width: 24 },
        { width: 18 },
        { width: 44 },
        { width: 18 },
        { width: 28 },
        { width: 60 },
      ],
      stickyRowsCount: 1,
      stickyColumnsCount: 3,
      showGridLines: false,
    },
  ];
}

export async function createOneOfficeProjectXlsxBlob(
  result: OneOfficeProjectBatchResult,
): Promise<Blob> {
  return writeExcelFile(buildOneOfficeProjectWorkbook(result), {
    fontFamily: 'Arial',
    fontSize: 10,
  }).toBlob();
}

export async function downloadOneOfficeProjectXlsx(
  result: OneOfficeProjectBatchResult,
): Promise<string> {
  const filename = createOneOfficeProjectXlsxFilename(result);
  await writeExcelFile(buildOneOfficeProjectWorkbook(result), {
    fontFamily: 'Arial',
    fontSize: 10,
  }).toFile(filename);
  return filename;
}
