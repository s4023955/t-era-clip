import type { TeraClipItem } from './types';

const OPEN_STATUSES = new Set(['todo', 'doing', 'waiting']);
const ACTION_STATUSES = new Set(['inbox', 'todo', 'doing', 'waiting']);

const formatGeneratedAt = (): string => new Date().toLocaleString();

const addOptionalLine = (lines: string[], label: string, value: string) => {
  const trimmedValue = value.trim();

  if (trimmedValue) {
    lines.push(`  ${label}: ${trimmedValue}`);
  }
};

const formatVendorItem = (item: TeraClipItem): string => {
  const lines = [`- ${item.title || 'Untitled item'} (priority: ${item.priority})`];

  addOptionalLine(lines, 'Notes', item.notes);
  addOptionalLine(lines, 'Due', item.dueDate);
  addOptionalLine(lines, 'Source', item.sourceUrl);

  return lines.join('\n');
};

const formatInternalItem = (item: TeraClipItem): string => {
  const lines = [`- ${item.title || 'Untitled item'} (status: ${item.status}, priority: ${item.priority})`];

  addOptionalLine(lines, 'Owner', item.owner);
  addOptionalLine(lines, 'Notes', item.notes);

  return lines.join('\n');
};

const formatActionItem = (item: TeraClipItem): string => {
  const lines = [`- [${item.status}] ${item.title || 'Untitled item'} (priority: ${item.priority})`];

  addOptionalLine(lines, 'Owner', item.owner);
  addOptionalLine(lines, 'Due', item.dueDate);
  addOptionalLine(lines, 'Notes', item.notes);

  return lines.join('\n');
};

export function generateVendorFollowUpTemplate(items: TeraClipItem[]): string {
  const followUpItems = items.filter(
    (item) => item.status !== 'archived' && OPEN_STATUSES.has(item.status)
  );
  const lines = [
    'Vendor follow-up',
    `Generated: ${formatGeneratedAt()}`,
    `Item count: ${followUpItems.length}`,
    '',
    'Hello,',
    '',
    'I am following up on the items below:'
  ];

  if (followUpItems.length === 0) {
    lines.push('', 'There are no open vendor follow-up items at this time.');
  } else {
    lines.push('', ...followUpItems.map(formatVendorItem));
  }

  lines.push('', 'Please share any available updates. Thank you.');
  return lines.join('\n');
}

export function generateInternalFollowUpTemplate(items: TeraClipItem[]): string {
  const followUpItems = items.filter(
    (item) => item.status !== 'archived' && OPEN_STATUSES.has(item.status)
  );
  const lines = [
    'Internal follow-up',
    `Generated: ${formatGeneratedAt()}`,
    `Item count: ${followUpItems.length}`,
    '',
    'Team,',
    '',
    'Please review the following open items:'
  ];

  if (followUpItems.length === 0) {
    lines.push('', 'There are no internal follow-up items at this time.');
  } else {
    lines.push('', ...followUpItems.map(formatInternalItem));
  }

  return lines.join('\n');
}

export function generateLeadershipSummaryTemplate(items: TeraClipItem[]): string {
  const activeItems = items.filter((item) => item.status !== 'archived');
  const groups = [
    {
      label: 'Completed',
      items: activeItems.filter((item) => item.status === 'done')
    },
    {
      label: 'In progress',
      items: activeItems.filter((item) => item.status === 'doing' || item.status === 'todo')
    },
    {
      label: 'Waiting / blocked',
      items: activeItems.filter((item) => item.status === 'waiting')
    },
    {
      label: 'Inbox / unclassified',
      items: activeItems.filter((item) => item.status === 'inbox')
    }
  ];
  const lines = [
    'Leadership summary',
    `Generated: ${formatGeneratedAt()}`,
    `Total items: ${activeItems.length}`,
    ''
  ];

  if (activeItems.length === 0) {
    lines.push('No non-archived items are available for this summary.');
    return lines.join('\n');
  }

  groups.forEach((group, index) => {
    lines.push(`${group.label}: ${group.items.length}`);

    if (group.items.length === 0) {
      lines.push('- None');
    } else {
      lines.push(
        ...group.items.map(
          (item) => `- ${item.title || 'Untitled item'} (priority: ${item.priority})`
        )
      );
    }

    if (index < groups.length - 1) {
      lines.push('');
    }
  });

  return lines.join('\n');
}

export function generateMeetingActionListTemplate(items: TeraClipItem[]): string {
  const actionItems = items.filter(
    (item) => item.status !== 'archived' && item.status !== 'done' && ACTION_STATUSES.has(item.status)
  );
  const lines = [
    'Meeting action list',
    `Generated: ${formatGeneratedAt()}`,
    `Item count: ${actionItems.length}`,
    ''
  ];

  if (actionItems.length === 0) {
    lines.push('There are no open meeting action items at this time.');
    return lines.join('\n');
  }

  lines.push(actionItems.map(formatActionItem).join('\n\n'));
  return lines.join('\n');
}
