import { useState, useEffect } from "react";
import { ProfileList, ServerProfile } from "./ProfileList";
import { SshTerminal } from "./Terminal";
import { X } from "lucide-react";

interface Tab {
  id: string;
  profile: ServerProfile;
  title: string;
}

function App() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  // 프로필 선택 (단일 클릭)
  const handleSelectProfile = (profileId: string) => {
    setSelectedProfileId(profileId);
  };

  // 프로필 연결 (더블 클릭 시 새 탭 추가)
  const handleConnectProfile = (profile: ServerProfile) => {
    const newTab: Tab = {
      id: `tab-${Date.now()}-${Math.random()}`,
      profile,
      title: profile.name,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setSelectedProfileId(profile.id);
  };

  // 탭 닫기
  const handleCloseTab = (tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTabs((prev) => {
      const filtered = prev.filter((t) => t.id !== tabId);
      // 마지막 탭을 닫으면 activeTabId를 null로
      if (filtered.length === 0) {
        setActiveTabId(null);
      } else if (activeTabId === tabId) {
        // 현재 활성 탭을 닫으면 이전 탭으로 이동
        const closedIndex = prev.findIndex((t) => t.id === tabId);
        const newActiveIndex = closedIndex > 0 ? closedIndex - 1 : 0;
        setActiveTabId(filtered[newActiveIndex]?.id || null);
      }
      return filtered;
    });
  };

  // 키보드 단축키 처리
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+W: 현재 탭 닫기
      if (e.ctrlKey && e.key === "w") {
        e.preventDefault();
        if (activeTabId) {
          handleCloseTab(activeTabId);
        }
      }
      // Ctrl+Tab: 다음 탭으로 이동
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        if (tabs.length > 0) {
          const currentIndex = tabs.findIndex((t) => t.id === activeTabId);
          const nextIndex = (currentIndex + 1) % tabs.length;
          setActiveTabId(tabs[nextIndex].id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tabs, activeTabId]);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-950">
      {/* Left Panel - Profile List */}
      <ProfileList
        onSelectProfile={handleSelectProfile}
        onConnectProfile={handleConnectProfile}
        selectedProfileId={selectedProfileId}
      />

      {/* Right Panel - Tabs + Terminal */}
      <div className="flex flex-1 flex-col bg-gradient-to-br from-gray-950 via-gray-950 to-gray-900">
        {/* Tab Bar */}
        {tabs.length > 0 && (
          <div className="flex items-center gap-1 border-b border-gray-800/50 bg-gray-900/80 px-2 py-2 backdrop-blur">
            {/* Tab List */}
            <div className="flex flex-1 gap-1 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={`group relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    activeTabId === tab.id
                      ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/20"
                      : "bg-gray-800/50 text-gray-300 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  <span className="max-w-[150px] truncate">{tab.title}</span>
                  <button
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className={`rounded p-0.5 transition-colors ${
                      activeTabId === tab.id
                        ? "hover:bg-white/20"
                        : "hover:bg-gray-700"
                    }`}
                  >
                    <X size={14} />
                  </button>
                </button>
              ))}
            </div>

            {/* Hint */}
            <div className="ml-2 text-xs text-gray-500">
              <kbd className="rounded bg-gray-800 px-1.5 py-0.5">Ctrl+W</kbd> to close •{" "}
              <kbd className="rounded bg-gray-800 px-1.5 py-0.5">Ctrl+Tab</kbd> to switch
            </div>
          </div>
        )}

        {/* Terminal Area */}
        <div className="relative flex-1">
          {/* 모든 탭을 렌더링하되, CSS로 숨김 처리 */}
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`absolute inset-0 ${
                activeTabId === tab.id ? "block" : "hidden"
              }`}
            >
              <SshTerminal profile={tab.profile} />
            </div>
          ))}

          {/* 탭이 없을 때 웰컴 화면 */}
          {tabs.length === 0 && (
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
    </div>
  );
}

export default App;
