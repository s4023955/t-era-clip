import { beforeEach, describe, expect, it } from 'vitest';
import projectFixture from '../fixtures/oneoffice/project-discussion.html?raw';
import taskEmptyFixture from '../fixtures/oneoffice/task-empty.html?raw';
import taskPopulatedFixture from '../fixtures/oneoffice/task-populated.html?raw';
import {
  parseOneOfficeDiscussion,
  UnsupportedOneOfficePageError,
} from '../../src/oneoffice/parser';
import { parseOneOfficeTimestamp } from '../../src/oneoffice/timestamp';

const SOURCE_URL = 'https://office.example.test/apps/work-project-project/view?ID=500';
const CAPTURED_AT = '2026-09-28T04:00:00.000Z';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('parseOneOfficeDiscussion', () => {
  it('parses the sanitized project sample with 27 roots and 5 replies', () => {
    document.body.innerHTML = projectFixture;

    const result = parseOneOfficeDiscussion(document, {
      capturedAt: CAPTURED_AT,
      sourceUrl: SOURCE_URL,
    });

    expect(result.entity).toEqual({
      type: 'project',
      internalId: '500',
      code: 'DA-MAU',
      name: 'Dự án mẫu',
      url: SOURCE_URL,
    });
    expect(result.collection).toMatchObject({
      complete: true,
      loadedRootCommentCount: 27,
      loadedReplyCount: 5,
      expectedRootCommentCount: 27,
      warnings: [],
    });
    expect(result.comments).toHaveLength(32);
    expect(result.comments[0]).toMatchObject({
      id: '1001',
      parentId: null,
      rootId: '1001',
      depth: 0,
      sourceOrder: 0,
      authorId: '11',
      authorName: 'Người dùng A',
      createdAtRaw: '08:15:30 20/09/2026',
      createdAtIso: '2026-09-20T08:15:30+07:00',
      contentText: 'Dòng một\nDòng hai',
    });
    expect(result.comments[0].attachments).toEqual([
      {
        index: 0,
        name: 'Tài liệu mẫu.pdf',
        sizeText: '128 KB',
        thumbnailUrl: 'https://office.example.test/files/thumb-1.png',
        originalDownloadAvailable: true,
      },
    ]);
    expect(result.comments[1]).toMatchObject({
      id: '2001',
      parentId: '1001',
      rootId: '1001',
      depth: 1,
      sourceOrder: 1,
    });
    expect(result.comments[1].mentions).toEqual([
      { userId: '11', displayName: 'Người dùng A' },
    ]);
  });

  it('parses a populated task and preserves reply hierarchy and line breaks', () => {
    document.body.innerHTML = taskPopulatedFixture;

    const result = parseOneOfficeDiscussion(document, {
      capturedAt: CAPTURED_AT,
      sourceUrl: 'https://office.example.test/task/600',
    });

    expect(result.entity).toMatchObject({
      type: 'task',
      internalId: '600',
      code: 'CV-MAU-01',
      name: 'Công việc mẫu',
    });
    expect(result.collection.loadedRootCommentCount).toBe(1);
    expect(result.collection.loadedReplyCount).toBe(1);
    expect(result.comments[1]).toMatchObject({
      id: '3002',
      parentId: '3001',
      rootId: '3001',
      contentText: 'Người dùng E đã tiếp nhận\nHẹn ngày 30/09',
    });
  });

  it('returns a complete empty result for a task with no discussion', () => {
    document.body.innerHTML = taskEmptyFixture;

    const result = parseOneOfficeDiscussion(document, { capturedAt: CAPTURED_AT });

    expect(result.comments).toEqual([]);
    expect(result.collection).toMatchObject({
      complete: true,
      loadedRootCommentCount: 0,
      loadedReplyCount: 0,
      expectedRootCommentCount: 0,
      warnings: [],
    });
  });

  it('marks collection incomplete when older root comments remain', () => {
    const comments = Array.from(
      { length: 10 },
      (_, index) =>
        `<div class="comment comment${4000 + index}"><div class="comment-contents"><div class="comment-content"><div class="comment-head"><a class="userlink" href="?ID=1">User</a></div><div class="comment-post">Comment</div></div><div class="comment-panel"><div class="comment-panel-time"><span title="10:00:00 28/09/2026">now</span></div></div></div></div>`,
    ).join('');
    document.body.innerHTML = `
      <div class="cards comments" comments-id="work-project-project@700">
        <div class="prev"><a class="bt">Xem thêm 10/17 thảo luận cũ hơn</a></div>
        <div class="cards-body">${comments}</div>
      </div>`;

    const result = parseOneOfficeDiscussion(document, { capturedAt: CAPTURED_AT });

    expect(result.collection).toMatchObject({
      complete: false,
      loadedRootCommentCount: 10,
      expectedRootCommentCount: 27,
    });
  });

  it('rejects an unknown discussion identifier', () => {
    document.body.innerHTML =
      '<div class="cards comments" comments-id="unknown-module@1"><div class="cards-body"></div></div>';

    expect(() => parseOneOfficeDiscussion(document)).toThrow(UnsupportedOneOfficePageError);
  });

  it('deduplicates repeated DOM nodes by confirmed comment ID', () => {
    const comment = `
      <div class="comment comment7001">
        <div class="comment-contents">
          <div class="comment-content">
            <div class="comment-head"><a class="userlink" href="?ID=1">User</a></div>
            <div class="comment-post">Same comment</div>
          </div>
          <div class="comment-panel"><div class="comment-panel-time"><span title="10:00:00 28/09/2026">now</span></div></div>
        </div>
      </div>`;
    document.body.innerHTML = `
      <div class="cards comments" comments-id="work-project-project@900">
        <div class="cards-body">${comment}${comment}</div>
      </div>`;

    const result = parseOneOfficeDiscussion(document, { capturedAt: CAPTURED_AT });

    expect(result.comments).toHaveLength(1);
    expect(result.collection.loadedRootCommentCount).toBe(1);
    expect(result.collection.warnings).toContain(
      'Ignored 1 duplicate comment ID(s) found in the page DOM.',
    );
  });
});

describe('parseOneOfficeTimestamp', () => {
  it('parses the confirmed 1Office absolute timestamp format', () => {
    expect(parseOneOfficeTimestamp('10:00:15 28/09/2026')).toBe(
      '2026-09-28T10:00:15+07:00',
    );
  });

  it('rejects invalid calendar dates and time values', () => {
    expect(parseOneOfficeTimestamp('10:00:15 31/02/2026')).toBeNull();
    expect(parseOneOfficeTimestamp('24:00:00 28/09/2026')).toBeNull();
  });
});
