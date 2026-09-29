import { beforeEach, describe, expect, it } from 'vitest';
import inventoryFixture from '../fixtures/oneoffice/project-task-inventory.html?raw';
import { collectOneOfficeProjectInventoryFromPage } from '../../src/oneoffice/projectInventory';

const sourceUrl = `${window.location.origin}/apps/work-project-project/view?ID=830&name=visual-work&tab=work`;

beforeEach(() => {
  document.body.innerHTML = inventoryFixture;
});

describe('collectOneOfficeProjectInventoryFromPage', () => {
  it('collects task identity and preserves a six-level No. hierarchy as text', () => {
    const inventory = collectOneOfficeProjectInventoryFromPage({
      allowedOrigin: window.location.origin,
      sourceUrl,
    });

    expect(inventory.project).toMatchObject({
      type: 'project',
      internalId: '830',
      name: 'Sample Project',
    });
    expect(inventory.collection).toMatchObject({
      complete: true,
      expectedTaskCount: 7,
      loadedTaskCount: 7,
      warnings: [],
    });
    expect(inventory.tasks.map((task) => task.no)).toEqual([
      '1',
      '1.1',
      '1.1.1',
      '1.1.1.1',
      '1.1.1.1.1',
      '1.1.1.1.1.1',
      '1.10',
    ]);
    expect(inventory.tasks[5]).toMatchObject({
      code: 'PRJ.01.01.01.01.01.01',
      name: 'Level 6',
      depth: 6,
      parentNo: '1.1.1.1.1',
      parentInternalId: '1005',
    });
    expect(inventory.tasks[6]).toMatchObject({
      no: '1.10',
      depth: 2,
      parentNo: '1',
      parentInternalId: '1001',
    });
  });

  it('reports incomplete inventory when a task No. is missing', () => {
    const lastOrderCell = document.querySelector<HTMLElement>(
      '.gantt-body-row:last-child > .gantt-col:last-child',
    );
    if (lastOrderCell) {
      lastOrderCell.textContent = '';
    }

    const inventory = collectOneOfficeProjectInventoryFromPage({
      allowedOrigin: window.location.origin,
      sourceUrl,
    });

    expect(inventory.collection.complete).toBe(false);
    expect(inventory.collection.warnings).toContain('1 task(s) did not expose a No. value.');
  });

  it('keeps visible tasks when the project counter is stale', () => {
    const taskTab = document.querySelector<HTMLAnchorElement>(
      'a[href*="/apps/work-project-project/view"]',
    );
    if (taskTab) {
      taskTab.textContent = 'Công việc (6)';
    }

    const inventory = collectOneOfficeProjectInventoryFromPage({
      allowedOrigin: window.location.origin,
      sourceUrl,
    });

    expect(inventory.collection.complete).toBe(true);
    expect(inventory.collection.loadedTaskCount).toBe(7);
    expect(inventory.collection.warnings).toContain(
      'Found 7 visible tasks while the project counter shows 6.',
    );
  });

  it('reports incomplete inventory when fewer tasks are visible than expected', () => {
    const taskTab = document.querySelector<HTMLAnchorElement>(
      'a[href*="/apps/work-project-project/view"]',
    );
    if (taskTab) {
      taskTab.textContent = 'Công việc (8)';
    }

    const inventory = collectOneOfficeProjectInventoryFromPage({
      allowedOrigin: window.location.origin,
      sourceUrl,
    });

    expect(inventory.collection.complete).toBe(false);
    expect(inventory.collection.warnings).toContain('Found 7 of 8 expected project tasks.');
  });

  it('rejects non-project pages', () => {
    expect(() =>
      collectOneOfficeProjectInventoryFromPage({
        allowedOrigin: window.location.origin,
        sourceUrl: `${window.location.origin}/apps/work-task-task/quickview?ID=1001`,
      }),
    ).toThrow('Open a 1Office project');
  });
});
