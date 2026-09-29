import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectOneOfficeProjectInventoryFromApi } from '../../src/oneoffice/projectInventoryApi';

const sourceUrl = `${window.location.origin}/apps/work-project-project/view?ID=248&name=visual-work&tab=work`;

const jsonResponse = (data: unknown): Response =>
  ({
    ok: true,
    status: 200,
    json: async () => data,
  }) as Response;

beforeEach(() => {
  document.body.innerHTML = `
    <h1 id="header-title">Large Project</h1>
    <a href="/apps/work-project-project/view?ID=248">Công việc (414)</a>
  `;
  vi.restoreAllMocks();
});

describe('collectOneOfficeProjectInventoryFromApi', () => {
  it('loads 414 virtualized tasks and enriches them in batches of at most 50', async () => {
    const tasks = Array.from({ length: 414 }, (_, index) => {
      const id = index + 1;
      return {
        ID: id,
        parent_id: id >= 2 && id <= 6 ? id - 1 : null,
        phase_id: 407,
        title: `Task ${String(id).padStart(3, '0')}`,
        code: `TASK.${id}`,
      };
    });
    const requestedBatches: string[][] = [];
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method !== 'POST') {
        return jsonResponse({
          tasks,
          phases: [{ phase_db_id: 407 }],
          groupType: 'phase',
        });
      }

      const body = new URLSearchParams(String(init.body));
      const ids = JSON.parse(body.get('ids') ?? '[]') as string[];
      requestedBatches.push(ids);
      return jsonResponse({
        enriched: Object.fromEntries(ids.map((id) => [id, { fields: { cf19: '' } }])),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const inventory = await collectOneOfficeProjectInventoryFromApi({
      allowedOrigin: window.location.origin,
      sourceUrl,
    });

    expect(inventory.source).toBe('1office-project-api');
    expect(inventory.collection).toMatchObject({
      complete: true,
      expectedTaskCount: 414,
      loadedTaskCount: 414,
      warnings: [],
    });
    expect(inventory.tasks).toHaveLength(414);
    expect(requestedBatches).toHaveLength(9);
    expect(requestedBatches.every((batch) => batch.length <= 50)).toBe(true);
    expect(requestedBatches.flat()).toHaveLength(414);
    expect(inventory.tasks.slice(0, 6).map((task) => task.no)).toEqual([
      '1.1',
      '1.1.1',
      '1.1.1.1',
      '1.1.1.1.1',
      '1.1.1.1.1.1',
      '1.1.1.1.1.1.1',
    ]);
    expect(inventory.tasks[5]).toMatchObject({
      internalId: '6',
      parentInternalId: '5',
      parentNo: '1.1.1.1.1.1',
    });
  });

  it('uses the enriched No. value and falls back to the generated outline when blank', async () => {
    document.querySelector('a')!.textContent = 'Công việc (2)';
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method !== 'POST') {
        return jsonResponse({
          tasks: [
            { ID: 100, parent_id: null, phase_id: 407, title: 'Parent', code: 'P' },
            { ID: 101, parent_id: 100, phase_id: 407, title: 'Child', code: 'C' },
          ],
          phases: [{ phase_db_id: 407 }],
        });
      }

      return jsonResponse({
        enriched: {
          100: { fields: { cf19: '1.10' } },
          101: { fields: { cf19: '' } },
        },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const inventory = await collectOneOfficeProjectInventoryFromApi({
      allowedOrigin: window.location.origin,
      sourceUrl,
    });

    expect(inventory.collection.complete).toBe(true);
    expect(inventory.tasks[0]).toMatchObject({ no: '1.10', parentNo: null });
    expect(inventory.tasks[1]).toMatchObject({
      no: '1.1.1',
      parentNo: '1.10',
      parentInternalId: '100',
    });
  });

  it('marks the inventory incomplete when detailed fields are missing', async () => {
    document.querySelector('a')!.textContent = 'Công việc (1)';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) =>
        init?.method === 'POST'
          ? jsonResponse({ enriched: {} })
          : jsonResponse({
              tasks: [{ ID: 100, parent_id: null, phase_id: 407, title: 'Parent' }],
              phases: [{ phase_db_id: 407 }],
            }),
      ),
    );

    const inventory = await collectOneOfficeProjectInventoryFromApi({
      allowedOrigin: window.location.origin,
      sourceUrl,
    });

    expect(inventory.collection.complete).toBe(false);
    expect(inventory.collection.warnings).toContain(
      'Loaded detailed task fields for 0 of 1 tasks.',
    );
  });
});
