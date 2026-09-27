/**
 * ModelSettingsModal — Ask Guardian's BYO Gemini key sheet. The key is
 * stored locally only (see useUserGeminiKey in ai-chat-helpers).
 */
import React, { useEffect, useState } from "react";

export function ModelSettingsModal({ onClose, userGeminiKey, onSaveKey }: {
  onClose: () => void;
  userGeminiKey: string;
  onSaveKey: (k: string) => void;
}) {
  const [draft, setDraft] = useState(userGeminiKey);
  const [saved, setSaved] = useState(false);
  // Escape-to-close: focus-trap mirrors the pattern in GuardianPermissionModal
  // so keyboard users land on the first input and can dismiss without a mouse.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-settings-title"
        aria-describedby="model-settings-desc"
        className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-5 mb-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 id="model-settings-title" className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-tight">AI Model Settings</h3>
            <p id="model-settings-desc" className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Default: Gemini (shared key). Add your own for higher limits.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Default model info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 mb-4 border border-blue-100 dark:border-blue-800/30">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black text-blue-700 dark:text-blue-300">✦ Default: Gemini Flash</span>
            <span className="text-[10px] bg-blue-100 dark:bg-blue-800/40 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-bold">ACTIVE</span>
          </div>
          <p className="text-[11px] text-blue-600 dark:text-blue-400">Powered by Google Gemini 3.1 Flash · No setup needed · Shared rate limits apply</p>
        </div>

        {/* User's own Gemini key */}
        <div className="mb-4">
          <label className="block text-[11px] font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
            Your Gemini API Key <span className="text-gray-400 font-normal normal-case">(optional — removes rate limits)</span>
          </label>
          <input
            type="password"
            value={draft}
            onChange={e => { setDraft(e.target.value); setSaved(false); }}
            placeholder="AIza..."
            className="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-400 font-mono"
          />
          <p className="text-[10px] text-gray-400 mt-1">
            Stored locally only · Never sent to our servers ·{" "}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">Get a free key →</a>
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => { onSaveKey(draft); setSaved(true); }}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider py-2.5 rounded-xl transition-colors"
          >
            {saved ? "✓ Saved!" : "Save Key"}
          </button>
          {draft && (
            <button
              onClick={() => { setDraft(""); onSaveKey(""); setSaved(false); }}
              className="px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-xl transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
