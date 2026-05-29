import type { TeraClipItem } from './types';

export function generateDailyReport(items: TeraClipItem[]): string {
  if (items.length === 0) {
    return 'No captured items are available for the daily report.';
  }

  return [`Daily report summary (${new Date().toLocaleDateString()}):`, ...items.map((item) => `- [${item.type}] ${item.title}`)].join('\n');
}

export function generateFollowUpList(items: TeraClipItem[]): string {
  const followups = items.filter((item) => item.type === 'followup');
  if (followups.length === 0) {
    return 'No follow-up items available.';
  }

  return ['Follow-up list:', ...followups.map((item) => `- ${item.title} (${item.sourceTitle})`)].join('\n');
}

export function generateWaitingList(items: TeraClipItem[]): string {
  const waiting = items.filter((item) => item.status === 'waiting');
  if (waiting.length === 0) {
    return 'No waiting items found.';
  }

  return ['Waiting list:', ...waiting.map((item) => `- ${item.title} — ${item.owner || 'unassigned'}`)].join('\n');
}

export function generateCompletedList(items: TeraClipItem[]): string {
  const completed = items.filter((item) => item.status === 'done');
  if (completed.length === 0) {
    return 'No completed items found.';
  }

  return ['Completed items:', ...completed.map((item) => `- ${item.title} (completed)`)].join('\n');
}
