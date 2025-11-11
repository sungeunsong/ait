import React, { useState, useEffect } from "react";
import { Server, Plus, FolderOpen, ChevronRight, Trash2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { ProfileModal } from "./ProfileModal";

export interface ServerProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  password?: string; // Database fallback when keyring unavailable
  profile_group?: string;
  auth_type?: string;
  created_at?: number;
  updated_at?: number;
}

interface ProfileListProps {
  onSelectProfile: (profile: ServerProfile) => void;
  selectedProfileId: string | null;
}

export const ProfileList: React.FC<ProfileListProps> = ({
  onSelectProfile,
  selectedProfileId,
}) => {
  const [profiles, setProfiles] = useState<ServerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load profiles from database
  const loadProfiles = async () => {
    try {
      setIsLoading(true);
      const profileList = await invoke<ServerProfile[]>("profile_list");
      setProfiles(profileList);
    } catch (error) {
      console.error("Failed to load profiles:", error);
      // If no profiles exist, create a default one
      if (String(error).includes("no such table")) {
        console.log("Creating default profile...");
        await createDefaultProfile();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Create a default profile
  const createDefaultProfile = async () => {
    try {
      await invoke("profile_create", {
        input: {
          name: "Test Server",
          host: "192.168.136.146",
          port: 22,
          user: "root",
          auth_type: "password",
          profile_group: "Default",
        },
      });
      await loadProfiles();
    } catch (error) {
      console.error("Failed to create default profile:", error);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["Production", "Development"])
  );

  const toggleGroup = (group: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(group)) {
      newExpanded.delete(group);
    } else {
      newExpanded.add(group);
    }
    setExpandedGroups(newExpanded);
  };

  const groupedProfiles = profiles.reduce((acc, profile) => {
    const group = profile.profile_group || "Ungrouped";
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(profile);
    return acc;
  }, {} as Record<string, ServerProfile[]>);

  const handleDeleteProfile = async (profileId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (confirm("Are you sure you want to delete this profile?")) {
      try {
        await invoke("profile_delete", { id: profileId });
        await loadProfiles();
      } catch (error) {
        console.error("Failed to delete profile:", error);
        alert("Failed to delete profile: " + String(error));
      }
    }
  };

  return (
    <div className="flex h-full w-72 flex-col border-r border-gray-800/50 bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800/50 bg-gray-900/80 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/10">
            <Server size={16} className="text-blue-500" />
          </div>
          <h2 className="text-sm font-semibold text-gray-100">Connections</h2>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 hover:shadow-blue-500/30"
          title="Add Server"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Profile List */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-blue-500"></div>
              <p className="text-sm text-gray-400">Loading connections...</p>
            </div>
          </div>
        ) : profiles.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <div className="text-center">
              <Server size={32} className="mx-auto mb-3 text-gray-600" />
              <p className="text-sm font-medium text-gray-400">No connections yet</p>
              <p className="mt-1 text-xs text-gray-500">Click the + button to add a server</p>
            </div>
          </div>
        ) : (
          Object.entries(groupedProfiles).map(([group, groupProfiles]) => (
          <div key={group} className="mb-2">
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(group)}
              className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium uppercase tracking-wider text-gray-400 transition-colors hover:bg-gray-800/50 hover:text-gray-300"
            >
              <ChevronRight
                size={12}
                className={`transition-transform duration-200 ${
                  expandedGroups.has(group) ? "rotate-90" : ""
                }`}
              />
              <FolderOpen size={12} className="text-blue-400" />
              <span className="flex-1 text-left">{group}</span>
              <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                {groupProfiles.length}
              </span>
            </button>

            {/* Group Items */}
            {expandedGroups.has(group) && (
              <div className="ml-2 mt-1.5 space-y-1">
                {groupProfiles.map((profile) => (
                  <div
                    key={profile.id}
                    className={`group relative flex items-center overflow-hidden rounded-lg border transition-all duration-200 ${
                      selectedProfileId === profile.id
                        ? "border-blue-500 bg-gradient-to-r from-blue-600 to-blue-500 shadow-lg shadow-blue-600/20"
                        : "border-gray-800/50 bg-gray-800/30 hover:border-gray-700 hover:bg-gray-800/50 hover:shadow-md"
                    }`}
                  >
                    <button
                      onClick={() => onSelectProfile(profile)}
                      className="flex flex-1 items-center gap-3 px-3 py-2.5 text-left"
                    >
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                        selectedProfileId === profile.id
                          ? "bg-white/20"
                          : "bg-gray-700/50"
                      }`}>
                        <Server size={16} className={
                          selectedProfileId === profile.id
                            ? "text-white"
                            : "text-blue-400"
                        } />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className={`truncate text-sm font-medium ${
                          selectedProfileId === profile.id
                            ? "text-white"
                            : "text-gray-100"
                        }`}>
                          {profile.name}
                        </div>
                        <div className={`mt-0.5 truncate text-xs ${
                          selectedProfileId === profile.id
                            ? "text-blue-100"
                            : "text-gray-400"
                        }`}>
                          {profile.user}@{profile.host}
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={(e) => handleDeleteProfile(profile.id, e)}
                      className="mr-2 rounded-md p-1.5 text-gray-400 opacity-0 transition-all hover:bg-red-500 hover:text-white group-hover:opacity-100"
                      title="Delete profile"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )))
        }
      </div>

      {/* Footer */}
      <div className="border-t border-gray-800/50 bg-gray-900/50 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">
            {profiles.length} connection{profiles.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
            <span className="text-gray-500">Ready</span>
          </div>
        </div>
      </div>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadProfiles}
      />
    </div>
  );
};
