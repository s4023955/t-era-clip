import type { OneOfficeDiscussionExport } from '../types';

const sanitizeFilenamePart = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, (character) => (character === 'Đ' ? 'D' : 'd'))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

export function createOneOfficeJsonFilename(result: OneOfficeDiscussionExport): string {
  const identity = sanitizeFilenamePart(
    result.entity.code || result.entity.name || result.entity.internalId,
  );
  const date = /^\d{4}-\d{2}-\d{2}/.exec(result.capturedAt)?.[0] ?? 'undated';

  return `tera-clip-oneoffice-${result.entity.type}-${identity || result.entity.internalId}-${date}.json`;
}

export function serializeOneOfficeJson(result: OneOfficeDiscussionExport): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}

export function downloadOneOfficeJson(result: OneOfficeDiscussionExport): string {
  const filename = createOneOfficeJsonFilename(result);
  const blob = new Blob([serializeOneOfficeJson(result)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}
