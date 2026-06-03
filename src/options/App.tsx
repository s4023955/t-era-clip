import React from 'react';

export function OptionsApp() {
  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <h1 className="text-3xl font-semibold">T-eraClip Options</h1>
      <p className="mt-2 text-sm text-slate-400">Configure local settings for the extension.</p>

      <div className="mt-6 space-y-4 rounded-md border border-slate-700 bg-slate-900 p-5">
        <div>
          <h2 className="text-lg font-medium text-slate-100">Default report language</h2>
          <p className="mt-1 text-sm text-slate-500">Placeholder for language and formatting settings.</p>
        </div>

        <div>
          <h2 className="text-lg font-medium text-slate-100">Export / import / clear data</h2>
          <p className="mt-1 text-sm text-slate-500">Placeholder for local export, import, and data reset features.</p>
        </div>
      </div>
    </div>
  );
}
