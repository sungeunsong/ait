import React, { useState } from "react";
import { X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    host: "",
    port: "22",
    user: "",
    password: "",
    profile_group: "Default",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await invoke("profile_create", {
        input: {
          name: formData.name,
          host: formData.host,
          port: parseInt(formData.port),
          user: formData.user,
          auth_type: "password",
          profile_group: formData.profile_group || null,
        },
      });

      // Reset form
      setFormData({
        name: "",
        host: "",
        port: "22",
        user: "",
        password: "",
        profile_group: "Default",
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-gray-800/50 bg-gradient-to-b from-gray-900 to-gray-950 p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-100">
              Add New Connection
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Configure your SSH server details
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 transition-colors focus:border-blue-500 focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              required
              placeholder="Production Server"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Host</label>
            <input
              type="text"
              value={formData.host}
              onChange={(e) =>
                setFormData({ ...formData, host: e.target.value })
              }
              className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 transition-colors focus:border-blue-500 focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              required
              placeholder="192.168.1.100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">Port</label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) =>
                  setFormData({ ...formData, port: e.target.value })
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 transition-colors focus:border-blue-500 focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                required
                min="1"
                max="65535"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">User</label>
              <input
                type="text"
                value={formData.user}
                onChange={(e) =>
                  setFormData({ ...formData, user: e.target.value })
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 transition-colors focus:border-blue-500 focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                required
                placeholder="root"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Password
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 transition-colors focus:border-blue-500 focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Optional - stored securely"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">Group</label>
            <input
              type="text"
              value={formData.profile_group}
              onChange={(e) =>
                setFormData({ ...formData, profile_group: e.target.value })
              }
              className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 transition-colors focus:border-blue-500 focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="Production, Development, etc."
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-900/20 px-4 py-3 text-sm text-red-300">
              <div className="font-medium">Error</div>
              <div className="mt-1 text-xs text-red-400">{error}</div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-700 bg-gray-800/50 px-5 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition-all hover:from-blue-500 hover:to-blue-400 hover:shadow-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create Connection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
