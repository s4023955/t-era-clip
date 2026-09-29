import type {
  OneOfficeProjectInventory,
  OneOfficeProjectTaskInventoryItem,
} from './types';

export interface OneOfficeProjectInventoryApiOptions {
  allowedOrigin: string;
  sourceUrl?: string;
}

interface GanttTask {
  ID?: unknown;
  parent_id?: unknown;
  phase_id?: unknown;
  title?: unknown;
  code?: unknown;
}

interface GanttPhase {
  phase_db_id?: unknown;
}

interface GanttStructureResponse {
  tasks?: unknown;
  phases?: unknown;
  groupType?: unknown;
}

interface GanttEnrichmentResponse {
  enriched?: unknown;
}

export async function collectOneOfficeProjectInventoryFromApi(
  options: OneOfficeProjectInventoryApiOptions,
): Promise<OneOfficeProjectInventory> {
  const enrichmentBatchSize = 50;
  const enrichmentConcurrency = 4;
  const sourceUrl = options.sourceUrl ?? window.location.href;
  const parsedUrl = new URL(sourceUrl);

  if (parsedUrl.origin !== options.allowedOrigin) {
    throw new Error('This tab is not on the approved 1Office origin.');
  }

  if (parsedUrl.pathname !== '/apps/work-project-project/view') {
    throw new Error('Open a 1Office project before checking its task inventory.');
  }

  const projectInternalId = parsedUrl.searchParams.get('ID')?.trim() ?? '';
  if (!/^\d+$/.test(projectInternalId)) {
    throw new Error('The project ID could not be read from the current page.');
  }

  const normalizeText = (value: unknown): string =>
    (typeof value === 'string' || typeof value === 'number' ? String(value) : '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const readExpectedTaskCount = (): number | null => {
    const normalizeLabel = (value: string): string =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/gi, (character) => (character === 'Đ' ? 'D' : 'd'))
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

    for (const element of document.querySelectorAll<HTMLElement>('a, div, span')) {
      const ownText = normalizeText(
        Array.from(element.childNodes)
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent ?? '')
          .join(' '),
      );
      const match = /^cong viec\s*\(\s*(\d+)\s*\)$/i.exec(normalizeLabel(ownText));
      if (match) {
        return Number(match[1]);
      }
    }

    return null;
  };

  const fetchJson = async (url: string, init?: RequestInit): Promise<unknown> => {
    const response = await fetch(url, {
      credentials: 'include',
      ...init,
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(`1Office returned HTTP ${response.status} while loading project tasks.`);
    }

    return response.json();
  };

  const ganttUrl = new URL('/apps/work-project-project/gantt', parsedUrl.origin);
  ganttUrl.searchParams.set('project_id', projectInternalId);
  const structureUrl = new URL(ganttUrl.href);
  structureUrl.searchParams.set('structure', '1');
  structureUrl.searchParams.set('group_type', 'phase');

  const rawStructure = (await fetchJson(structureUrl.href)) as GanttStructureResponse;
  if (!Array.isArray(rawStructure.tasks) || !Array.isArray(rawStructure.phases)) {
    throw new Error('The 1Office Gantt response did not contain a project task structure.');
  }

  const warnings: string[] = [];
  const seenTaskIds = new Set<string>();
  const rawTasks = (rawStructure.tasks as GanttTask[]).flatMap((task, sourceIndex) => {
    const internalId = normalizeText(task.ID);
    if (!/^\d+$/.test(internalId)) {
      warnings.push('Ignored a Gantt task because its internal ID was missing or invalid.');
      return [];
    }
    if (seenTaskIds.has(internalId)) {
      warnings.push(`Ignored duplicate Gantt task ID ${internalId}.`);
      return [];
    }
    seenTaskIds.add(internalId);

    const normalizedParentId = normalizeText(task.parent_id);
    const normalizedPhaseId = normalizeText(task.phase_id);
    const parentInternalId = normalizedParentId && normalizedParentId !== '0'
      ? normalizedParentId
      : null;
    const phaseId = normalizedPhaseId && normalizedPhaseId !== '0' ? normalizedPhaseId : null;
    return [{
      sourceIndex,
      internalId,
      parentInternalId,
      phaseId,
      name: normalizeText(task.title),
      code: normalizeText(task.code) || null,
    }];
  });

  if (rawTasks.length === 0) {
    throw new Error('No project tasks were found in the 1Office Gantt response.');
  }

  const enrichmentByTaskId = new Map<string, Record<string, unknown>>();
  const batches: string[][] = [];
  for (let index = 0; index < rawTasks.length; index += enrichmentBatchSize) {
    batches.push(rawTasks.slice(index, index + enrichmentBatchSize).map((task) => task.internalId));
  }

  const loadEnrichmentBatch = async (ids: string[]): Promise<void> => {
    const body = new URLSearchParams({
      mode: 'enrich',
      project_id: projectInternalId,
      ids: JSON.stringify(ids),
    });
    const rawEnrichment = (await fetchJson(ganttUrl.href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: body.toString(),
    })) as GanttEnrichmentResponse;
    const enriched = rawEnrichment.enriched;
    if (!enriched || typeof enriched !== 'object' || Array.isArray(enriched)) {
      throw new Error('The 1Office Gantt enrichment response was invalid.');
    }

    for (const id of ids) {
      const record = (enriched as Record<string, unknown>)[id];
      if (record && typeof record === 'object' && !Array.isArray(record)) {
        enrichmentByTaskId.set(id, record as Record<string, unknown>);
      }
    }
  };

  try {
    for (let index = 0; index < batches.length; index += enrichmentConcurrency) {
      await Promise.all(batches.slice(index, index + enrichmentConcurrency).map(loadEnrichmentBatch));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown enrichment error.';
    warnings.push(`Could not load all task No. values. ${message}`);
  }

  if (enrichmentByTaskId.size < rawTasks.length) {
    warnings.push(
      `Loaded detailed task fields for ${enrichmentByTaskId.size} of ${rawTasks.length} tasks.`,
    );
  }

  const tasksById = new Map(rawTasks.map((task) => [task.internalId, task]));
  const childrenByParentId = new Map<string, typeof rawTasks>();
  const roots: typeof rawTasks = [];

  for (const task of rawTasks) {
    if (task.parentInternalId && tasksById.has(task.parentInternalId)) {
      const siblings = childrenByParentId.get(task.parentInternalId) ?? [];
      siblings.push(task);
      childrenByParentId.set(task.parentInternalId, siblings);
    } else {
      if (task.parentInternalId) {
        warnings.push(`Task ${task.internalId} references missing parent ${task.parentInternalId}.`);
      }
      roots.push(task);
    }
  }

  const phaseIds = (rawStructure.phases as GanttPhase[])
    .map((phase) => normalizeText(phase.phase_db_id))
    .filter(Boolean);
  const rootsByPhase = new Map<string, typeof rawTasks>();
  const otherRoots: typeof rawTasks = [];
  for (const root of roots) {
    if (root.phaseId && phaseIds.includes(root.phaseId)) {
      const phaseRoots = rootsByPhase.get(root.phaseId) ?? [];
      phaseRoots.push(root);
      rootsByPhase.set(root.phaseId, phaseRoots);
    } else {
      otherRoots.push(root);
    }
  }

  const outlineByTaskId = new Map<string, string>();
  const orderedTaskIds: string[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visitTask = (task: (typeof rawTasks)[number], outline: string): void => {
    if (visiting.has(task.internalId)) {
      warnings.push(`Task hierarchy cycle detected at task ${task.internalId}.`);
      return;
    }
    if (visited.has(task.internalId)) {
      return;
    }

    visiting.add(task.internalId);
    visited.add(task.internalId);
    outlineByTaskId.set(task.internalId, outline);
    orderedTaskIds.push(task.internalId);
    const children = childrenByParentId.get(task.internalId) ?? [];
    children.forEach((child, index) => visitTask(child, `${outline}.${index + 1}`));
    visiting.delete(task.internalId);
  };

  phaseIds.forEach((phaseId, phaseIndex) => {
    const phaseRoots = rootsByPhase.get(phaseId) ?? [];
    phaseRoots.forEach((root, rootIndex) => visitTask(root, `${phaseIndex + 1}.${rootIndex + 1}`));
  });
  if (otherRoots.length > 0) {
    const otherGroupIndex = phaseIds.length + 1;
    otherRoots.forEach((root, rootIndex) =>
      visitTask(root, `${otherGroupIndex}.${rootIndex + 1}`),
    );
  }
  for (const task of rawTasks) {
    if (!visited.has(task.internalId)) {
      warnings.push(`Task ${task.internalId} could not be placed in the project hierarchy.`);
      visitTask(task, String(orderedTaskIds.length + 1));
    }
  }

  const readCustomNo = (taskId: string): string => {
    const enrichment = enrichmentByTaskId.get(taskId);
    const fields = enrichment?.fields;
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      return '';
    }
    const customNo = normalizeText((fields as Record<string, unknown>).cf19);
    return customNo === '…' || customNo === '-' ? '' : customNo;
  };

  const chosenNoByTaskId = new Map(
    rawTasks.map((task) => [
      task.internalId,
      readCustomNo(task.internalId) || outlineByTaskId.get(task.internalId) || '',
    ]),
  );
  const tasks: OneOfficeProjectTaskInventoryItem[] = orderedTaskIds.map((taskId, sourceOrder) => {
    const task = tasksById.get(taskId)!;
    const taskNo = chosenNoByTaskId.get(taskId) ?? '';
    const parentNo = task.parentInternalId
      ? chosenNoByTaskId.get(task.parentInternalId) ?? null
      : null;

    return {
      sourceOrder,
      internalId: task.internalId,
      no: taskNo,
      code: task.code,
      name: task.name,
      url: `${parsedUrl.origin}/apps/work-task-task/view?ID=${encodeURIComponent(task.internalId)}`,
      depth: (outlineByTaskId.get(task.internalId) ?? taskNo).split('.').filter(Boolean).length,
      parentNo,
      parentInternalId: task.parentInternalId,
    };
  });

  const expectedTaskCount = readExpectedTaskCount();
  if (expectedTaskCount !== null && tasks.length !== expectedTaskCount) {
    warnings.push(`Loaded ${tasks.length} of ${expectedTaskCount} expected project tasks.`);
  }
  const duplicateNoCount = tasks.length - new Set(tasks.map((task) => task.no)).size;
  if (duplicateNoCount > 0) {
    warnings.push(`${duplicateNoCount} duplicate task No. value(s) were found.`);
  }

  const projectName = normalizeText(
    document.querySelector<HTMLElement>('#header-title')?.textContent,
  );
  const complete =
    warnings.length === 0 &&
    enrichmentByTaskId.size === rawTasks.length &&
    (expectedTaskCount === null || tasks.length === expectedTaskCount);

  return {
    schemaVersion: 1,
    source: '1office-project-api',
    capturedAt: new Date().toISOString(),
    project: {
      type: 'project',
      internalId: projectInternalId,
      code: null,
      name: projectName,
      url: parsedUrl.href,
    },
    collection: {
      complete,
      expectedTaskCount,
      loadedTaskCount: tasks.length,
      warnings: Array.from(new Set(warnings)),
    },
    tasks,
  };
}
