export type TeraClipItemType =
  | 'task'
  | 'checklist'
  | 'followup'
  | 'note'
  | 'report_input';

export type TeraClipStatus =
  | 'inbox'
  | 'todo'
  | 'doing'
  | 'waiting'
  | 'done'
  | 'archived';

export type TeraClipPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TeraClipReportLanguage = 'vi' | 'en';

export interface TeraClipSettings {
  defaultReportLanguage: TeraClipReportLanguage;
}

export interface TeraClipItem {
  id: string;
  type: TeraClipItemType;
  title: string;
  originalText: string;
  sourceUrl: string;
  sourceTitle: string;
  createdAt: string;
  updatedAt: string;
  status: TeraClipStatus;
  priority: TeraClipPriority;
  owner: string;
  dueDate: string;
  category: string;
  tags: string[];
  notes: string;
}
