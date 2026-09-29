import writeExcelFile, {
  type CellObject,
  type Sheet,
  type SheetData,
} from 'write-excel-file/browser';
import type {
  OneOfficeAttachment,
  OneOfficeComment,
  OneOfficeDiscussionExport,
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

const sanitizeFilenamePart = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, (character) => (character === 'Đ' ? 'D' : 'd'))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

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

const countAttachments = (comments: OneOfficeComment[]): number =>
  comments.reduce((total, comment) => total + comment.attachments.length, 0);

const formatMentions = (comment: OneOfficeComment): string =>
  comment.mentions.map((mention) => mention.displayName).join(', ');

const formatAttachmentNames = (comment: OneOfficeComment): string =>
  comment.attachments.map((attachment) => attachment.name).join('\n');

const createEntitySheet = (result: OneOfficeDiscussionExport): SheetData => {
  const comments = [...result.comments].sort(
    (first, second) => first.sourceOrder - second.sourceOrder,
  );
  const rows: Array<[string, string | number | boolean]> = [
    ['Entity type', result.entity.type],
    ['Internal ID', result.entity.internalId],
    ['Business code', result.entity.code ?? ''],
    ['Name', result.entity.name],
    ['Source URL', result.entity.url],
    ['Captured at', result.capturedAt],
    ['Collection complete', result.collection.complete],
    ['Expected root comments', result.collection.expectedRootCommentCount ?? 'Unknown'],
    ['Loaded root comments', result.collection.loadedRootCommentCount],
    ['Loaded replies', result.collection.loadedReplyCount],
    ['Total discussion entries', comments.length],
    ['Attachments', countAttachments(comments)],
    ['Load-more actions', result.collection.loadMoreClicks],
    ['Warnings', result.collection.warnings.join('\n')],
  ];

  return [
    [headerCell('Field'), headerCell('Value')],
    ...rows.map(([label, value]) => [labelCell(label), dataCell(value)]),
  ];
};

const createDiscussionSheet = (result: OneOfficeDiscussionExport): SheetData => {
  const headers = [
    'Source order',
    'Entry type',
    'Comment ID',
    'Parent comment ID',
    'Root comment ID',
    'Depth',
    'Author',
    'Author ID',
    'Comment time',
    'Comment time ISO',
    'Comment content',
    'Mentions',
    'Attachment count',
    'Attachment names',
    'Entity type',
    'Task / Project ID',
    'Task / Project code',
    'Task / Project name',
  ];
  const comments = [...result.comments].sort(
    (first, second) => first.sourceOrder - second.sourceOrder,
  );

  return [
    headers.map(headerCell),
    ...comments.map((comment) => [
      dataCell(comment.sourceOrder + 1),
      dataCell(comment.parentId ? 'Reply' : 'Root comment'),
      textCell(comment.id),
      textCell(comment.parentId ?? ''),
      textCell(comment.rootId),
      dataCell(comment.depth),
      dataCell(comment.authorName),
      textCell(comment.authorId ?? ''),
      dataCell(comment.createdAtRaw),
      dataCell(comment.createdAtIso ?? ''),
      {
        ...dataCell(comment.contentText),
        indent: Math.min(comment.depth, 4),
      },
      dataCell(formatMentions(comment)),
      dataCell(comment.attachments.length),
      dataCell(formatAttachmentNames(comment)),
      dataCell(result.entity.type),
      textCell(result.entity.internalId),
      textCell(result.entity.code ?? ''),
      dataCell(result.entity.name),
    ]),
  ];
};

const createAttachmentRow = (
  result: OneOfficeDiscussionExport,
  comment: OneOfficeComment,
  attachment: OneOfficeAttachment,
) => [
  dataCell(result.entity.type),
  textCell(result.entity.internalId),
  textCell(result.entity.code ?? ''),
  dataCell(result.entity.name),
  textCell(comment.id),
  textCell(comment.parentId ?? ''),
  dataCell(comment.authorName),
  dataCell(comment.createdAtRaw),
  dataCell(attachment.index + 1),
  dataCell(attachment.name),
  dataCell(attachment.sizeText ?? ''),
  dataCell(attachment.originalDownloadAvailable),
  dataCell(attachment.thumbnailUrl ?? ''),
];

const createAttachmentsSheet = (result: OneOfficeDiscussionExport): SheetData => {
  const headers = [
    'Entity type',
    'Task / Project ID',
    'Task / Project code',
    'Task / Project name',
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
  const rows = [...result.comments]
    .sort((first, second) => first.sourceOrder - second.sourceOrder)
    .flatMap((comment) =>
      comment.attachments.map((attachment) =>
        createAttachmentRow(result, comment, attachment),
      ),
    );

  return [headers.map(headerCell), ...rows];
};

export function createOneOfficeXlsxFilename(result: OneOfficeDiscussionExport): string {
  const identity = sanitizeFilenamePart(
    result.entity.code || result.entity.name || result.entity.internalId,
  );
  const date = /^\d{4}-\d{2}-\d{2}/.exec(result.capturedAt)?.[0] ?? 'undated';

  return `tera-clip-oneoffice-${result.entity.type}-${identity || result.entity.internalId}-${date}.xlsx`;
}

export function buildOneOfficeWorkbook(result: OneOfficeDiscussionExport): Sheet<Blob>[] {
  return [
    {
      data: createEntitySheet(result),
      sheet: 'Entity',
      columns: [{ width: 28 }, { width: 80 }],
      stickyRowsCount: 1,
      showGridLines: false,
    },
    {
      data: createDiscussionSheet(result),
      sheet: 'Discussion',
      columns: [
        { width: 12 },
        { width: 16 },
        { width: 16 },
        { width: 20 },
        { width: 18 },
        { width: 8 },
        { width: 24 },
        { width: 14 },
        { width: 24 },
        { width: 28 },
        { width: 72 },
        { width: 30 },
        { width: 16 },
        { width: 40 },
        { width: 14 },
        { width: 20 },
        { width: 22 },
        { width: 34 },
      ],
      stickyRowsCount: 1,
      stickyColumnsCount: 2,
      orientation: 'landscape',
      showGridLines: false,
    },
    {
      data: createAttachmentsSheet(result),
      sheet: 'Attachments',
      columns: [
        { width: 14 },
        { width: 20 },
        { width: 22 },
        { width: 34 },
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
      showGridLines: false,
    },
  ];
}

export async function createOneOfficeXlsxBlob(
  result: OneOfficeDiscussionExport,
): Promise<Blob> {
  return writeExcelFile(buildOneOfficeWorkbook(result), {
    fontFamily: 'Arial',
    fontSize: 10,
  }).toBlob();
}

export async function downloadOneOfficeXlsx(
  result: OneOfficeDiscussionExport,
): Promise<string> {
  const filename = createOneOfficeXlsxFilename(result);
  await writeExcelFile(buildOneOfficeWorkbook(result), {
    fontFamily: 'Arial',
    fontSize: 10,
  }).toFile(filename);
  return filename;
}
