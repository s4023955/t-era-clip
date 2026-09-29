import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearAllLocalData,
  DEFAULT_SETTINGS,
  getItems,
  getSettings,
  replaceLocalData,
  saveSettings
} from '../shared/storage';
import type {
  TeraClipItem,
  TeraClipItemType,
  TeraClipPriority,
  TeraClipReportLanguage,
  TeraClipSettings,
  TeraClipStatus
} from '../shared/types';

const APP_NAME = 'T-eraClip';
const APP_VERSION = '0.1.0';

const ITEM_TYPES: TeraClipItemType[] = ['task', 'checklist', 'followup', 'note', 'report_input'];
const ITEM_STATUSES: TeraClipStatus[] = ['inbox', 'todo', 'doing', 'waiting', 'done', 'archived'];
const ITEM_PRIORITIES: TeraClipPriority[] = ['low', 'medium', 'high', 'urgent'];

type BackupData = {
  app: typeof APP_NAME;
  version: typeof APP_VERSION;
  exportedAt: string;
  items: TeraClipItem[];
  settings: TeraClipSettings;
};

type Feedback = {
  kind: 'success' | 'error';
  message: string;
};

type ImportedBackup = {
  items: TeraClipItem[];
  settings: TeraClipSettings;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isOneOf = <T extends string>(value: unknown, allowedValues: readonly T[]): value is T =>
  typeof value === 'string' && allowedValues.includes(value as T);

const isTeraClipItem = (value: unknown): value is TeraClipItem => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isOneOf(value.type, ITEM_TYPES) &&
    isString(value.title) &&
    isString(value.originalText) &&
    isString(value.sourceUrl) &&
    isString(value.sourceTitle) &&
    isString(value.createdAt) &&
    isString(value.updatedAt) &&
    isOneOf(value.status, ITEM_STATUSES) &&
    isOneOf(value.priority, ITEM_PRIORITIES) &&
    isString(value.owner) &&
    isString(value.dueDate) &&
    isString(value.category) &&
    Array.isArray(value.tags) &&
    value.tags.every(isString) &&
    isString(value.notes)
  );
};

const isTeraClipSettings = (value: unknown): value is TeraClipSettings =>
  isRecord(value) && isOneOf(value.defaultReportLanguage, ['vi', 'en']);

const parseBackup = (value: unknown): ImportedBackup => {
  if (!isRecord(value)) {
    throw new Error('Bản sao lưu phải là một đối tượng JSON.');
  }

  if (!Array.isArray(value.items)) {
    throw new Error('Bản sao lưu phải có danh sách items.');
  }

  const invalidItemIndex = value.items.findIndex((item) => !isTeraClipItem(item));
  if (invalidItemIndex !== -1) {
    throw new Error(`Mục số ${invalidItemIndex + 1} thiếu trường bắt buộc hoặc có giá trị không hợp lệ.`);
  }

  let importedSettings: TeraClipSettings = { ...DEFAULT_SETTINGS };

  if (value.settings !== undefined) {
    if (!isTeraClipSettings(value.settings)) {
      throw new Error('Cài đặt trong bản sao lưu không hợp lệ.');
    }

    importedSettings = value.settings;
  }

  return {
    items: value.items,
    settings: importedSettings
  };
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định.';

function FeedbackMessage({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) {
    return null;
  }

  return (
    <p className={`mt-3 text-sm ${feedback.kind === 'error' ? 'text-red-300' : 'text-emerald-300'}`}>
      {feedback.message}
    </p>
  );
}

export function OptionsApp() {
  const [settings, setSettings] = useState<TeraClipSettings>({ ...DEFAULT_SETTINGS });
  const [itemCount, setItemCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState<Feedback | null>(null);
  const [exportFeedback, setExportFeedback] = useState<Feedback | null>(null);
  const [importFeedback, setImportFeedback] = useState<Feedback | null>(null);
  const [clearFeedback, setClearFeedback] = useState<Feedback | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadLocalData = useCallback(async () => {
    setIsLoading(true);

    try {
      const [storedItems, storedSettings] = await Promise.all([getItems(), getSettings()]);
      setItemCount(storedItems.length);
      setSettings(storedSettings);
    } catch (error) {
      setSettingsFeedback({
        kind: 'error',
        message: `Không thể tải dữ liệu cục bộ. ${getErrorMessage(error)}`
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLocalData();
  }, [loadLocalData]);

  const handleLanguageChange = async (language: TeraClipReportLanguage) => {
    const previousSettings = settings;
    const nextSettings = { defaultReportLanguage: language };

    setSettings(nextSettings);
    setSettingsFeedback(null);
    setIsSavingSettings(true);

    try {
      await saveSettings(nextSettings);
      setSettingsFeedback({ kind: 'success', message: 'Đã lưu ngôn ngữ báo cáo mặc định.' });
    } catch (error) {
      setSettings(previousSettings);
      setSettingsFeedback({
        kind: 'error',
        message: `Không thể lưu cài đặt. ${getErrorMessage(error)}`
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleExport = async () => {
    setExportFeedback(null);

    try {
      const [items, storedSettings] = await Promise.all([getItems(), getSettings()]);
      const backup: BackupData = {
        app: APP_NAME,
        version: APP_VERSION,
        exportedAt: new Date().toISOString(),
        items,
        settings: storedSettings
      };
      const date = new Date().toISOString().slice(0, 10);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const downloadUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');

      downloadLink.href = downloadUrl;
      downloadLink.download = `tera-clip-backup-${date}.json`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      URL.revokeObjectURL(downloadUrl);

      setExportFeedback({ kind: 'success', message: `Đã xuất ${items.length} nội dung cục bộ.` });
    } catch (error) {
      setExportFeedback({
        kind: 'error',
        message: `Không thể xuất dữ liệu cục bộ. ${getErrorMessage(error)}`
      });
    }
  };

  const handleImport = async (file: File) => {
    setImportFeedback(null);

    try {
      const parsedJson: unknown = JSON.parse(await file.text());
      const importedBackup = parseBackup(parsedJson);
      const confirmed = window.confirm(
        `Nhập ${importedBackup.items.length} nội dung? Thao tác này sẽ thay thế dữ liệu T-eraClip hiện có trên trình duyệt.`
      );

      if (!confirmed) {
        setImportFeedback({ kind: 'error', message: 'Đã hủy nhập. Dữ liệu cục bộ không thay đổi.' });
        return;
      }

      await replaceLocalData(importedBackup.items, importedBackup.settings);
      await loadLocalData();
      setImportFeedback({
        kind: 'success',
        message: `Đã nhập ${importedBackup.items.length} nội dung và thay thế dữ liệu cục bộ hiện có.`
      });
      setSettingsFeedback(null);
      setClearFeedback(null);
    } catch (error) {
      setImportFeedback({
        kind: 'error',
        message: `Nhập dữ liệu thất bại. Không có dữ liệu nào được thay đổi. ${getErrorMessage(error)}`
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClear = async () => {
    setClearFeedback(null);

    if (!window.confirm('Xóa toàn bộ nội dung và cài đặt T-eraClip cục bộ trên trình duyệt này?')) {
      setClearFeedback({ kind: 'error', message: 'Đã hủy xóa. Dữ liệu cục bộ không thay đổi.' });
      return;
    }

    try {
      await clearAllLocalData();
      setItemCount(0);
      setSettings({ ...DEFAULT_SETTINGS });
      setClearFeedback({ kind: 'success', message: 'Đã xóa toàn bộ dữ liệu T-eraClip cục bộ.' });
      setSettingsFeedback(null);
      setImportFeedback(null);
    } catch (error) {
      setClearFeedback({
        kind: 'error',
        message: `Không thể xóa dữ liệu cục bộ. ${getErrorMessage(error)}`
      });
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <header>
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-3xl font-semibold">Cài đặt T-eraClip</h1>
            <span className="text-sm text-slate-500">Phiên bản {APP_VERSION}</span>
          </div>
          <p className="mt-2 text-sm text-slate-400">Dữ liệu được lưu cục bộ trên trình duyệt này.</p>
        </header>

        <div className="mt-8 space-y-6">
          <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-lg font-medium">Cài đặt</h2>
            <label className="mt-4 block max-w-sm text-sm font-medium text-slate-300">
              Ngôn ngữ báo cáo mặc định
              <select
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition hover:border-slate-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isLoading || isSavingSettings}
                onChange={(event) => {
                  void handleLanguageChange(event.target.value as TeraClipReportLanguage);
                }}
                value={settings.defaultReportLanguage}
              >
                <option value="vi">Tiếng Việt</option>
                <option value="en">Tiếng Anh</option>
              </select>
            </label>
            <p className="mt-2 text-xs text-slate-500">
              Lựa chọn này được lưu cục bộ và dùng cho các báo cáo được tạo.
            </p>
            <FeedbackMessage feedback={settingsFeedback} />
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-lg font-medium">Xuất bản sao lưu</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Tải nội dung và cài đặt cục bộ dưới dạng file JSON có phiên bản.
            </p>
            <button
              className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
              onClick={() => {
                void handleExport();
              }}
              type="button"
            >
              Xuất JSON
            </button>
            <FeedbackMessage feedback={exportFeedback} />
          </section>

          <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-lg font-medium">Nhập bản sao lưu</h2>
            <p className="mt-2 text-sm font-medium text-amber-300">
              Dữ liệu nhập sẽ thay thế dữ liệu T-eraClip cục bộ hiện có.
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Chọn bản sao lưu JSON của T-eraClip. File sẽ được kiểm tra trước khi xác nhận và thay đổi dữ liệu.
            </p>
            <input
              accept=".json,application/json"
              className="mt-4 block w-full max-w-md text-sm text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-slate-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-100 hover:file:bg-slate-600"
              disabled={isLoading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleImport(file);
                }
              }}
              ref={fileInputRef}
              type="file"
            />
            <FeedbackMessage feedback={importFeedback} />
          </section>

          <section className="rounded-lg border border-red-950 bg-slate-900 p-5">
            <h2 className="text-lg font-medium">Xóa dữ liệu cục bộ</h2>
            <p className="mt-2 text-sm text-slate-400">
              Số nội dung hiện có: {isLoading ? 'Đang tải...' : itemCount}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              Thao tác này xóa toàn bộ nội dung và cài đặt đã lưu trên trình duyệt.
            </p>
            <button
              className="mt-4 rounded-md border border-red-800 bg-red-950/50 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-900/60 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
              onClick={() => {
                void handleClear();
              }}
              type="button"
            >
              Xóa toàn bộ dữ liệu cục bộ
            </button>
            <FeedbackMessage feedback={clearFeedback} />
          </section>
        </div>
      </div>
    </main>
  );
}
