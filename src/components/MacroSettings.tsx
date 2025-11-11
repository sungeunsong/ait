import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X, Save, Globe, User } from "lucide-react";

interface MacroSettingsProps {
  profileId: string | null; // null = global
  profileName?: string;
  onClose: () => void;
}

export const MacroSettings: React.FC<MacroSettingsProps> = ({
  profileId,
  profileName,
  onClose,
}) => {
  const [macros, setMacros] = useState<Record<string, string>>({});
  const [isGlobal, setIsGlobal] = useState(!profileId);
  const [isSaving, setIsSaving] = useState(false);

  // Load macros on mount
  useEffect(() => {
    loadMacros();
  }, [profileId, isGlobal]);

  const loadMacros = async () => {
    try {
      const currentProfileId = isGlobal ? null : profileId;
      const data = await invoke<Record<string, string>>("macros_get", {
        profileId: currentProfileId,
      });
      setMacros(data);
    } catch (error) {
      console.error("[MacroSettings] Failed to load macros:", error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const currentProfileId = isGlobal ? null : profileId;

      // Save each macro
      for (let i = 1; i <= 10; i++) {
        const key = i.toString();
        const command = macros[key] || "";
        await invoke("macros_set", {
          profileId: currentProfileId,
          macroKey: key,
          command,
        });
      }

      console.log("[MacroSettings] Macros saved successfully");
      onClose();
    } catch (error) {
      console.error("[MacroSettings] Failed to save macros:", error);
      alert(`Failed to save macros: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (key: string, value: string) => {
    setMacros((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-100">
            Macro Settings
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Global/Profile Toggle */}
        {profileId && (
          <div className="mb-4 flex items-center gap-4">
            <button
              onClick={() => setIsGlobal(true)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                isGlobal
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              <Globe size={16} />
              Global (All Servers)
            </button>
            <button
              onClick={() => setIsGlobal(false)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                !isGlobal
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              <User size={16} />
              {profileName || "Current Server"}
            </button>
          </div>
        )}

        {/* Macro Inputs */}
        <div className="mb-6 max-h-[500px] space-y-3 overflow-y-auto pr-2">
          {Array.from({ length: 10 }, (_, i) => {
            const key = (i + 1).toString();
            const displayKey = i === 9 ? "0" : key; // 10번 매크로는 Ctrl+0
            return (
              <div key={key} className="flex items-center gap-3">
                <label className="flex w-20 items-center gap-2 text-sm font-medium text-gray-300">
                  <kbd className="rounded bg-gray-800 px-2 py-1 text-xs">
                    Ctrl+{displayKey}
                  </kbd>
                </label>
                <input
                  type="text"
                  value={macros[key] || ""}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  placeholder="Enter command..."
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-700 pt-4">
          <p className="text-xs text-gray-500">
            Press Ctrl+1~0 in terminal to execute macros
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              <Save size={16} />
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
