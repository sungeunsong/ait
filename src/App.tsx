import { useState } from "react";
import { ProfileList, ServerProfile } from "./ProfileList";
import { SshTerminal } from "./Terminal";

function App() {
  const [selectedProfile, setSelectedProfile] = useState<ServerProfile | null>(
    null
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-950">
      {/* Left Panel - Profile List */}
      <ProfileList
        onSelectProfile={setSelectedProfile}
        selectedProfileId={selectedProfile?.id || null}
      />

      {/* Right Panel - Terminal */}
      <div className="flex flex-1 flex-col bg-gradient-to-br from-gray-950 via-gray-950 to-gray-900">
        {selectedProfile ? (
          <SshTerminal
            key={selectedProfile.id}
            profile={selectedProfile}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600/10 to-blue-500/5 ring-1 ring-blue-500/20">
                <svg
                  className="h-10 w-10 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M5 12h14M12 5l7 7-7 7"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-200">
                Welcome to AIT Terminal
              </h3>
              <p className="mt-2 text-sm text-gray-400">
                Select a connection from the sidebar to get started
              </p>
              <p className="mt-1 text-xs text-gray-500">
                or create a new one with the + button
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
