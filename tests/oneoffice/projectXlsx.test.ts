import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import {
  buildOneOfficeProjectWorkbook,
  createOneOfficeProjectXlsxBlob,
  createOneOfficeProjectXlsxFilename,
} from '../../src/oneoffice/export/projectXlsx';
import type { OneOfficeProjectBatchResult } from '../../src/oneoffice/types';

const result: OneOfficeProjectBatchResult = {
  schemaVersion: 1,
  source: '1office-project-batch-dom',
  startedAt: '2026-09-28T08:00:00.000Z',
  completedAt: '2026-09-28T08:00:03.000Z',
  cancelled: false,
  project: {
    type: 'project',
    internalId: '830',
    code: 'TEST',
    name: 'TeraClip Parser Test',
    url: 'https://office.meygroup.vn/apps/work-project-project/view?ID=830',
  },
  inventory: {
    schemaVersion: 1,
    source: '1office-project-dom',
    capturedAt: '2026-09-28T08:00:00.000Z',
    project: {
      type: 'project',
      internalId: '830',
      code: 'TEST',
      name: 'TeraClip Parser Test',
      url: 'https://office.meygroup.vn/apps/work-project-project/view?ID=830',
    },
    collection: {
      complete: true,
      expectedTaskCount: 1,
      loadedTaskCount: 1,
      warnings: [],
    },
    tasks: [
      {
        sourceOrder: 0,
        internalId: '91637',
        no: '1.10',
        code: 'TEST.TDT.01',
        name: 'TEST_SUB',
        url: 'https://office.meygroup.vn/apps/work-task-task/quickview?ID=91637',
        depth: 2,
        parentNo: '1',
        parentInternalId: '91634',
      },
    ],
  },
  tasks: [
    {
      task: {
        sourceOrder: 0,
        internalId: '91637',
        no: '1.10',
        code: 'TEST.TDT.01',
        name: 'TEST_SUB',
        url: 'https://office.meygroup.vn/apps/work-task-task/quickview?ID=91637',
        depth: 2,
        parentNo: '1',
        parentInternalId: '91634',
      },
      state: 'complete',
      error: null,
      discussion: {
        schemaVersion: 1,
        source: '1office-comment-api',
        capturedAt: '2026-09-28T08:00:01.000Z',
        entity: {
          type: 'task',
          internalId: '91637',
          code: 'TEST.TDT.01',
          name: 'TEST_SUB',
          url: 'https://office.meygroup.vn/apps/work-task-task/view?ID=91637',
        },
        collection: {
          complete: true,
          loadMoreClicks: 0,
          loadedRootCommentCount: 1,
          loadedReplyCount: 1,
          expectedRootCommentCount: 1,
          warnings: [],
        },
        comments: [
          {
            id: '9398',
            parentId: null,
            rootId: '9398',
            depth: 0,
            sourceOrder: 0,
            authorId: '988',
            authorName: 'Nguyễn Anh Tuân',
            createdAtRaw: '10:00:15 28/09/2026',
            createdAtIso: '2026-09-28T10:00:15+07:00',
            contentText: '=Nội dung comment cha',
            mentions: [{ userId: null, displayName: 'Nguyễn Văn Nam' }],
            attachments: [
              {
                index: 0,
                name: 'Hồ sơ.pdf',
                sizeText: '345.67 KB',
                thumbnailUrl: 'https://office.meygroup.vn/files/hoso.png',
                originalDownloadAvailable: true,
              },
            ],
          },
          {
            id: '9401',
            parentId: '9398',
            rootId: '9398',
            depth: 1,
            sourceOrder: 1,
            authorId: '989',
            authorName: 'Nguyễn Văn Nam',
            createdAtRaw: '10:00:26 28/09/2026',
            createdAtIso: '2026-09-28T10:00:26+07:00',
            contentText: 'Đồng ý',
            mentions: [],
            attachments: [],
          },
        ],
      },
    },
  ],
  warnings: [],
};

const readCellValue = (cell: unknown): unknown =>
  cell && typeof cell === 'object' && 'value' in cell
    ? (cell as { value?: unknown }).value
    : cell;

const readBlobAsArrayBuffer = (blob: Blob): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read XLSX blob.'));
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(blob);
  });

describe('project-wide XLSX export', () => {
  it('builds project, task, discussion, and attachment sheets', () => {
    const workbook = buildOneOfficeProjectWorkbook(result);

    expect(workbook.map((sheet) => sheet.sheet)).toEqual([
      'Project',
      'Tasks',
      'Discussion',
      'Attachments',
    ]);
    expect(workbook[1].data[1].map(readCellValue)).toMatchObject({
      0: '1.10',
      4: '91637',
      5: 'TEST.TDT.01',
      6: 'TEST_SUB',
    });
    expect(workbook[2].data[0].map(readCellValue)).toContain('Parent comment content');
    expect(workbook[2].data[2].map(readCellValue)).toMatchObject({
      3: '1.10',
      7: 'Reply',
      9: '9398',
      10: '=Nội dung comment cha',
      17: 'Đồng ý',
    });
    expect(workbook[3].data[1].map(readCellValue)).toMatchObject({
      2: '1.10',
      4: 'TEST.TDT.01',
      11: 'Hồ sơ.pdf',
      12: '345.67 KB',
    });
  });

  it('creates a stable filename and a valid XLSX without formulas from comment text', async () => {
    expect(createOneOfficeProjectXlsxFilename(result)).toBe(
      'tera-clip-oneoffice-project-test-2026-09-28.xlsx',
    );

    const blob = await createOneOfficeProjectXlsxBlob(result);
    const files = unzipSync(new Uint8Array(await readBlobAsArrayBuffer(blob)));
    const workbookXml = strFromU8(files['xl/workbook.xml']);
    const discussionXml = strFromU8(files['xl/worksheets/sheet3.xml']);
    const sharedStringsXml = strFromU8(files['xl/sharedStrings.xml']);

    expect(workbookXml).toContain('name="Project"');
    expect(workbookXml).toContain('name="Tasks"');
    expect(workbookXml).toContain('name="Discussion"');
    expect(workbookXml).toContain('name="Attachments"');
    expect(discussionXml).not.toContain('<f>');
    expect(sharedStringsXml).toContain('Nội dung comment cha');
  });
});
