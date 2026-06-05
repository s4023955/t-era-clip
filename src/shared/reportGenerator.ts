import type { TeraClipItem } from './types';

const FOLLOW_UP_STATUSES = new Set(['todo', 'doing', 'waiting']);

const formatGeneratedAt = (): string => new Date().toLocaleString();

const formatItemLine = (item: TeraClipItem): string => {
  const details = [`status: ${item.status}`, `priority: ${item.priority}`];
  const lines = [`- ${item.title || 'Untitled item'} (${details.join(', ')})`];

  if (item.notes.trim()) {
    lines.push(`  Notes: ${item.notes.trim()}`);
  }

  if (item.sourceUrl.trim()) {
    lines.push(`  Source: ${item.sourceUrl.trim()}`);
  }

  return lines.join('\n');
};

const buildReport = (title: string, items: TeraClipItem[], emptyMessage: string): string => {
  const lines = [title, `Generated: ${formatGeneratedAt()}`, `Item count: ${items.length}`, ''];

  if (items.length === 0) {
    lines.push(emptyMessage);
    return lines.join('\n');
  }

  lines.push(...items.map(formatItemLine));
  return lines.join('\n\n');
};

export function generateDailyReport(items: TeraClipItem[]): string {
  const reportItems = items.filter((item) => item.status !== 'archived');

  return buildReport('Daily report', reportItems, 'No non-archived items are available for this daily report.');
}

export function generateFollowUpList(items: TeraClipItem[]): string {
  const followups = items.filter(
    (item) => item.status !== 'archived' && (FOLLOW_UP_STATUSES.has(item.status) || item.type === 'followup')
  );

  return buildReport('Follow-up list', followups, 'No active follow-up items are available.');
}

export function generateWaitingList(items: TeraClipItem[]): string {
  const waiting = items.filter((item) => item.status === 'waiting');

  return buildReport('Waiting list', waiting, 'No waiting items found.');
}

export function generateCompletedList(items: TeraClipItem[]): string {
  const completed = items.filter((item) => item.status === 'done');

  return buildReport('Completed list', completed, 'No completed items found.');
}
