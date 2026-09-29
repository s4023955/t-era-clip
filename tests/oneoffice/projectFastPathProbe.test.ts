import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { probeOneOfficeQuickViewFromPage } from '../../src/oneoffice/projectFastPathProbe';

beforeEach(() => {
  window.history.replaceState({}, '', '/apps/work-project-project/view?ID=830');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('probeOneOfficeQuickViewFromPage', () => {
  it('counts a populated quickview discussion response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          `
            <div class="cards comments" comments-id="work-task-task@91637">
              <div class="cards-body">
                <div class="comment comment9398">
                  <div class="comment-contents">
                    <div class="cards sub-comments" comments-id="c9398">
                      <div class="cards-body">
                        <div class="comment comment9401"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `,
          { status: 200, headers: { 'content-type': 'text/html' } },
        ),
      ),
    );

    await expect(
      probeOneOfficeQuickViewFromPage({
        allowedOrigin: window.location.origin,
        taskId: '91637',
      }),
    ).resolves.toMatchObject({
      available: true,
      responseKind: 'html',
      rootCount: 1,
      replyCount: 1,
      hasLoadMore: false,
      snapshot: {
        complete: true,
        expectedRootCommentCount: 1,
        loadMoreClicks: 0,
      },
    });
  });

  it('marks a quickview with older comments for full-page fallback', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          `
            <div class="cards comments" comments-id="work-task-task@91637">
              <div class="prev"><button class="bt">Xem thêm 10/20 thảo luận cũ hơn</button></div>
              <div class="cards-body"><div class="comment comment9398"></div></div>
            </div>
          `,
          { status: 200, headers: { 'content-type': 'text/html' } },
        ),
      ),
    );

    await expect(
      probeOneOfficeQuickViewFromPage({
        allowedOrigin: window.location.origin,
        taskId: '91637',
      }),
    ).resolves.toMatchObject({
      available: true,
      rootCount: 1,
      hasLoadMore: true,
      snapshot: {
        complete: false,
        expectedRootCommentCount: null,
      },
    });
  });

  it('reports metadata-only JSON as unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ dialog: { dataUrl: 'apps/work-task-task/view?ID=91637' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    await expect(
      probeOneOfficeQuickViewFromPage({
        allowedOrigin: window.location.origin,
        taskId: '91637',
      }),
    ).resolves.toMatchObject({
      available: false,
      responseKind: 'json',
      error: 'Quickview did not contain the expected task discussion.',
    });
  });
});
