import React from 'react';

export function PopupApp() {
  return (
    <div className="min-h-screen w-80 bg-slate-950 p-5 text-slate-100">
      <h1 className="text-2xl font-semibold">T-eraClip</h1>
      <p className="mt-2 text-sm text-slate-400">Clip anything. Turn it into action.</p>

      <div className="mt-6 rounded-md border border-slate-700 bg-slate-900 p-4">
        <p className="text-slate-200">Popup scaffold ready</p>
        <p className="mt-2 text-xs text-slate-500">
          This placeholder will become the item manager for v0.1.
        </p>
      </div>
    </div>
  );
}
