import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import "xterm/css/xterm.css";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ServerProfile } from "./ProfileList";
import { Server, Trash2 } from "lucide-react";
import { useCommandInput } from "./hooks/useCommandInput";
import { AutocompleteDropdown, CommandSuggestion } from "./components/AutocompleteDropdown";
import { InlineOverlay } from "./components/InlineOverlay";
import { AIPanel } from "./components/AIPanel";

interface SshTerminalProps {
  profile: ServerProfile;
}

export const SshTerminal: React.FC<SshTerminalProps> = ({ profile }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null); // ← 새로 추가: effect 안에서 쓸용
  const [sessionId, setSessionId] = useState<string | null>(null); // 화면에 보여줄 용도만
  const [fontSize, setFontSize] = useState<number>(16); // Default font size
  const [osInfo, setOsInfo] = useState<string>(''); // OS 정보

  // Autocomplete dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [suggestions, setSuggestions] = useState<CommandSuggestion[]>([]);
  const [dropdownPosition, setDropdownPosition] = useState({ x: 20, y: 100 });

  // Inline autocomplete state
  const [inlineSuggestion, setInlineSuggestion] = useState<string>('');

  // Cursor position state for inline overlay
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });

  // AI Panel state
  const [showAIPanel, setShowAIPanel] = useState(false);

  // Refs for state access in event handlers
  const inlineSuggestionRef = useRef<string>('');
  const currentInputRef = useRef<string>('');
  const showDropdownRef = useRef<boolean>(false);
  const suggestionsRef = useRef<CommandSuggestion[]>([]);
  const selectedIndexRef = useRef<number>(0);
  const showAIPanelRef = useRef<boolean>(false);

  // Sync refs with state
  useEffect(() => {
    inlineSuggestionRef.current = inlineSuggestion;
  }, [inlineSuggestion]);

  useEffect(() => {
    console.log("[Terminal] showDropdown changed to:", showDropdown);
    showDropdownRef.current = showDropdown;
  }, [showDropdown]);

  useEffect(() => {
    suggestionsRef.current = suggestions;
  }, [suggestions]);

  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  useEffect(() => {
    showAIPanelRef.current = showAIPanel;
  }, [showAIPanel]);

  // Load font size from settings on mount
  useEffect(() => {
    (async () => {
      try {
        const savedFontSize = await invoke<string | null>("settings_get", {
          key: "terminal_font_size",
        });
        if (savedFontSize) {
          const size = parseInt(savedFontSize, 10);
          if (size >= 8 && size <= 32) {
            setFontSize(size);
          }
        }
      } catch (error) {
        console.error("[Terminal] Failed to load font size:", error);
      }
    })();
  }, []);

  // Save font size when it changes
  useEffect(() => {
    if (fontSize !== 14) { // Only save if different from default
      invoke("settings_set", {
        key: "terminal_font_size",
        value: fontSize.toString(),
      }).catch((error) => {
        console.error("[Terminal] Failed to save font size:", error);
      });
    }
  }, [fontSize]);

  // useCommandInput 훅 사용 (터미널 준비 전에는 null)
  const { currentInput } = useCommandInput({
    terminal: termRef.current,
    enabled: true,
    onCommandExecuted: (command) => {
      // 히스토리에 저장
      invoke("history_save", {
        input: {
          profile_id: profile.id,
          cmd: command,
          exit_code: null,
          duration_ms: null,
        }
      }).catch((err) => {
        console.error("[history_save error]", err);
      });
    }
  });

  // Sync currentInput to ref
  useEffect(() => {
    currentInputRef.current = currentInput;
  }, [currentInput]);

  // Auto-fetch inline suggestion when typing
  useEffect(() => {
    if (currentInput && currentInput.length > 0 && sessionId && !showDropdown) {
      // Debounce to avoid too many requests
      const timer = setTimeout(async () => {
        try {
          const results = await invoke<CommandSuggestion[]>("history_suggestions", {
            profileId: profile.id,
            prefix: currentInput,
            limit: 1, // Only get the top suggestion for inline
          });

          if (results.length > 0) {
            setInlineSuggestion(results[0].cmd);
          } else {
            setInlineSuggestion('');
          }
        } catch (error) {
          console.error("[Terminal] Failed to fetch inline suggestion:", error);
        }
      }, 100); // 100ms debounce

      return () => clearTimeout(timer);
    } else {
      setInlineSuggestion('');
    }
  }, [currentInput, sessionId, showDropdown, profile.id]);

  // Handle autocomplete with Shift+Space
  const handleAutocomplete = async () => {
    const currentSessionId = sessionIdRef.current;
    const currentCmd = currentInputRef.current;
    const term = termRef.current;

    console.log("[Terminal] handleAutocomplete called, sessionId:", currentSessionId, "currentCmd:", currentCmd);

    if (!currentSessionId || !term) {
      console.log("[Terminal] No sessionId or terminal, returning");
      return;
    }

    // Calculate dropdown position based on terminal cursor
    const cursorY = term.buffer.active.cursorY;
    const lineHeight = term.options.fontSize ? term.options.fontSize * 1.2 : 17; // approximate line height
    const containerRect = containerRef.current?.getBoundingClientRect();

    if (containerRect) {
      // Position dropdown at cursor Y position (in pixels)
      const dropdownY = (cursorY + 1) * lineHeight; // +1 to show below current line
      const dropdownX = 20; // Fixed left margin

      console.log("[Terminal] Cursor position:", { cursorY, lineHeight, dropdownY });
      setDropdownPosition({ x: dropdownX, y: dropdownY });
    }

    const prefix = currentCmd.trim();
    console.log("[Terminal] Searching suggestions for:", prefix);

    try {
      const results = await invoke<CommandSuggestion[]>("history_suggestions", {
        profileId: profile.id,
        prefix: prefix || "",
        limit: 10,
      });

      console.log("[Terminal] Found suggestions:", results);
      console.log("[Terminal] Setting dropdown visible:", results.length > 0);
      setSuggestions(results);
      setSelectedIndex(0);
      setShowDropdown(results.length > 0);
    } catch (error) {
      console.error("[Terminal] Failed to search suggestions:", error);
    }
  };

  // Update terminal font size when fontSize changes
  useEffect(() => {
    const term = termRef.current;
    const fitAddon = fitAddonRef.current;
    if (!term || !fitAddon) return;

    // 폰트 크기 변경
    term.options.fontSize = fontSize;

    // 폰트 크기 변경 후 터미널 크기 재계산
    // 약간의 딜레이를 주어 폰트 렌더링이 완료되도록 함
    setTimeout(() => {
      fitAddon.fit();

      // 터미널 화면 전체 다시 그리기 (텍스트 겹침 방지)
      term.refresh(0, term.rows - 1);

      // 터미널을 맨 아래로 스크롤 (커서가 보이도록)
      term.scrollToBottom();

      // SSH 서버에도 PTY 크기 변경 알림
      const id = sessionIdRef.current;
      if (id && term.cols && term.rows) {
        invoke("ssh_resize", {
          id,
          cols: term.cols,
          rows: term.rows,
        }).catch((err) => {
          console.error("[ssh_resize error on font change]", err);
        });
      }
    }, 50);
  }, [fontSize]);

  useEffect(() => {
    // 1) 터미널 1번만 만든다
    const term = new Terminal({
      fontSize: fontSize,
      fontFamily: '"Cascadia Code", "Consolas", "DejaVu Sans Mono", "Courier New", monospace',
      cursorBlink: true,
      convertEol: true,
      theme: {
        background: "#1e1e1e",
        foreground: "#dcdcdc",
      },
    });
    termRef.current = term;

    // 2) FitAddon 추가
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;

    // 3) DOM에 붙이기
    if (containerRef.current) {
      term.open(containerRef.current);
      // 초기 fit
      setTimeout(() => fitAddon.fit(), 0);
    }

    // 4) ResizeObserver로 창 크기 변화 감지
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();

      // SSH 서버에도 PTY 크기 변경 알림
      const id = sessionIdRef.current;
      if (id && term.cols && term.rows) {
        invoke("ssh_resize", {
          id,
          cols: term.cols,
          rows: term.rows,
        }).catch((err) => {
          console.error("[ssh_resize error]", err);
        });
      }
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // 3) 이벤트 먼저 듣기 (Rust → 프론트)
    const unlistenPromise = listen<{ id: string; data: string }>(
      "ssh:data",
      (event) => {
        const payload = event.payload;
        // 세션 아이디가 정해져 있으면 필터
        if (sessionIdRef.current && payload.id !== sessionIdRef.current) return;
        term.write(payload.data ?? "");
      }
    );

    // 4) 실제 SSH 셸 열기
    (async () => {
      try {
        term.writeln("🔌 AIT SSH Terminal Ready\r\n");
        term.writeln(`🔌 Connecting to ${profile.user}@${profile.host}:${profile.port}...\r\n`);

        // Debug: Check if password exists
        console.log("[Terminal] Profile:", {
          name: profile.name,
          host: profile.host,
          hasPassword: !!profile.password,
          passwordLength: profile.password?.length || 0
        });

        if (!profile.password) {
          term.writeln(`❌ Error: Password not available for this profile\r\n`);
          term.writeln(`💡 Please edit the profile and add a password\r\n`);
          console.error("[Terminal] No password in profile:", profile);
          return;
        }

        term.writeln(`🔐 Authenticating...\r\n`);

        // 초기 fit 후 터미널 크기 확인
        fitAddon.fit();

        const id = await invoke<string>("ssh_open_shell", {
          host: profile.host,
          port: profile.port,
          user: profile.user,
          password: profile.password,
          cols: term.cols || 80,
          rows: term.rows || 24,
        });

        // ref에도 저장, state에도 저장
        sessionIdRef.current = id;
        setSessionId(id);
        term.writeln(`✅ SSH connected (session: ${id})\r\n`);

        // OS 정보 가져오기 (조용히, 터미널에 표시 안 됨)
        setTimeout(async () => {
          try {
            const output = await invoke<string>("ssh_exec", {
              id,
              command: "cat /etc/os-release 2>/dev/null || uname -s"
            });

            // PRETTY_NAME 또는 NAME 찾기
            const prettyMatch = output.match(/PRETTY_NAME="([^"]+)"/);
            const nameMatch = output.match(/NAME="([^"]+)"/);
            const versionMatch = output.match(/VERSION="([^"]+)"/);

            if (prettyMatch || nameMatch) {
              const osName = prettyMatch ? prettyMatch[1] : nameMatch![1];
              const osVersion = versionMatch ? ` ${versionMatch[1]}` : '';
              const detectedOS = `${osName}${osVersion}`;
              console.log('[Terminal] Detected OS:', detectedOS);
              setOsInfo(detectedOS);
            }
            // uname 결과 감지 (fallback)
            else {
              const unameMatch = output.match(/(Linux|Darwin|FreeBSD)/);
              if (unameMatch) {
                console.log('[Terminal] Detected OS (uname):', unameMatch[1]);
                setOsInfo(unameMatch[1]);
              }
            }
          } catch (err) {
            console.error('[Terminal] Failed to detect OS:', err);
          }
        }, 1000); // 연결 후 1초 대기
      } catch (e) {
        term.writeln(`\r\n❌ SSH connection failed: ${String(e)}\r\n`);
        console.error("[Terminal] Connection error:", e);
      }
    })();

    // 5) Shift+Space 키 이벤트 감지 (autocomplete 트리거)
    term.attachCustomKeyEventHandler((event) => {
      const currentInline = inlineSuggestionRef.current;
      const currentCmd = currentInputRef.current;
      const isDropdownOpen = showDropdownRef.current;
      const currentSuggestions = suggestionsRef.current;
      const currentIndex = selectedIndexRef.current;
      const isAIPanelOpen = showAIPanelRef.current;

      // Debug key presses
      if (event.type === 'keydown') {
        console.log('[Terminal] Key pressed:', {
          key: event.key,
          shiftKey: event.shiftKey,
          ctrlKey: event.ctrlKey,
          currentInline,
          currentCmd,
          isDropdownOpen
        });
      }

      // → (오른쪽 화살표) 키로 인라인 제안 수락
      // 단, 드롭다운이 열려있지 않고 인라인 제안이 있을 때만
      if (event.key === 'ArrowRight' && currentInline && !isDropdownOpen && event.type === 'keydown') {
        // 커서가 현재 입력의 끝에 있을 때만 동작
        const completionPart = currentInline.slice(currentCmd.length);
        if (completionPart) {
          console.log('[Terminal] Accepting inline suggestion:', currentInline);
          event.preventDefault();

          // 완성 부분을 터미널에 전송
          const id = sessionIdRef.current;
          if (id) {
            invoke("ssh_write", { id, data: completionPart }).catch((err) => {
              console.error("[ssh_write error]", err);
            });
          }

          setInlineSuggestion('');
          return false;
        }
        // 인라인 제안은 있지만 completionPart가 없으면 정상 전달
        return true;
      }

      // Shift+Space 감지
      if (event.key === ' ' && event.shiftKey && event.type === 'keydown') {
        console.log('[Terminal] Shift+Space pressed, triggering autocomplete');
        event.preventDefault();
        handleAutocomplete();
        return false; // 이벤트 전파 중단
      }

      // Ctrl+Space로 AI 패널 토글
      if (event.key === ' ' && event.ctrlKey && event.type === 'keydown') {
        event.preventDefault();
        setShowAIPanel((prev) => !prev);
        return false;
      }

      // Esc 키로 드롭다운 또는 AI 패널 닫기
      // 단, 드롭다운이나 AI 패널이 열려있을 때만 가로채기
      if (event.key === 'Escape' && event.type === 'keydown') {
        if (isDropdownOpen) {
          event.preventDefault();
          setShowDropdown(false);
          return false;
        }
        // AI 패널이 열려있을 때만 가로챔
        if (isAIPanelOpen) {
          event.preventDefault();
          setShowAIPanel(false);
          return false;
        }
        // 둘 다 열려있지 않으면 정상적으로 터미널로 전달 (vi/vim 등에서 사용)
        return true;
      }

      // ↑/↓ 키로 드롭다운 네비게이션 (드롭다운이 열려있을 때만)
      if (isDropdownOpen && event.type === 'keydown') {
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setSelectedIndex((prev) => Math.max(0, prev - 1));
          return false;
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setSelectedIndex((prev) => Math.min(currentSuggestions.length - 1, prev + 1));
          return false;
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          // 드롭다운이 열려있을 때는 좌우 방향키도 차단
          event.preventDefault();
          return false;
        }
        // Enter 키로 선택
        if (event.key === 'Enter') {
          event.preventDefault();
          const selected = currentSuggestions[currentIndex];
          if (selected) {
            console.log('[Terminal] Selected command:', selected.cmd);

            // 현재 입력된 부분을 지우고 선택한 명령어로 교체
            const currentCmd = currentInputRef.current;
            const id = sessionIdRef.current;

            if (id && currentCmd) {
              // 현재 입력 길이만큼 백스페이스 전송
              const backspaces = '\x7F'.repeat(currentCmd.length);
              invoke("ssh_write", { id, data: backspaces }).catch((err) => {
                console.error("[ssh_write error]", err);
              });

              // 선택한 명령어 전송
              setTimeout(() => {
                invoke("ssh_write", { id, data: selected.cmd }).catch((err) => {
                  console.error("[ssh_write error]", err);
                });
              }, 50); // 약간의 딜레이로 백스페이스가 먼저 처리되도록
            } else if (id) {
              // 현재 입력이 없으면 그냥 명령어 전송
              invoke("ssh_write", { id, data: selected.cmd }).catch((err) => {
                console.error("[ssh_write error]", err);
              });
            }

            setShowDropdown(false);
          }
          return false;
        }
      }

      return true; // 다른 키는 정상 처리
    });

    // Track cursor position for inline overlay
    term.onCursorMove(() => {
      // Get actual cursor element from xterm.js DOM
      const xtermScreen = containerRef.current?.querySelector('.xterm-screen');
      const cursorElement = containerRef.current?.querySelector('.xterm-cursor');

      if (cursorElement && xtermScreen) {
        const cursorRect = cursorElement.getBoundingClientRect();
        const screenRect = xtermScreen.getBoundingClientRect();

        // Calculate relative position to the terminal screen
        // Add cursor width to position the suggestion AFTER the cursor
        const relativeX = cursorRect.left - screenRect.left + cursorRect.width;
        const relativeY = cursorRect.top - screenRect.top;


        setCursorPosition({
          x: relativeX,
          y: relativeY,
        });
      }
    });

    // 6) 입력 → Rust
    term.onData((data) => {
      const id = sessionIdRef.current;
      if (!id) return;

      // SSH PTY에서는 \r만 보내면 됨 (\r\n 보내면 프롬프트 중복)
      invoke("ssh_write", { id, data }).catch((err) => {
        console.error("[ssh_write error]", err);
      });
    });

    // 7) cleanup
    return () => {
      resizeObserver.disconnect();
      unlistenPromise.then((un) => un());
      term.dispose();
      const id = sessionIdRef.current;
      if (id) {
        invoke("ssh_close", { id }).catch(() => {});
      }
    };
    // 👇 중요: deps를 비운다. 절대 [sessionId] 넣지 말기.
  }, []);

  return (
    <div className="flex h-full flex-col bg-gray-950">
      {/* Terminal Header */}
      <div className="flex items-center justify-between border-b border-gray-800/50 bg-gradient-to-r from-gray-900 to-gray-900/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/10 ring-1 ring-blue-500/20">
            <Server size={16} className="text-blue-400" />
          </div>
          <div>
            <div className="text-base font-semibold text-gray-100">
              {profile.name}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-400">
              <span>{profile.user}@{profile.host}</span>
              <span className="text-gray-600">•</span>
              <span>Port {profile.port}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Font size controls - 숨김 처리 */}
          {/* <div className="flex items-center gap-1 rounded-lg bg-gray-800/50 p-1 ring-1 ring-gray-700/50">
            <button
              onClick={() => setFontSize((prev) => Math.max(8, prev - 1))}
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-700/50 transition-colors"
              title="Decrease font size"
            >
              <ZoomOut size={14} className="text-gray-400" />
            </button>
            <span className="px-2 text-xs font-mono text-gray-400">{fontSize}px</span>
            <button
              onClick={() => setFontSize((prev) => Math.min(32, prev + 1))}
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-700/50 transition-colors"
              title="Increase font size"
            >
              <ZoomIn size={14} className="text-gray-400" />
            </button>
          </div> */}

          {/* Clear history button */}
          <button
            onClick={async () => {
              if (confirm(`Clear all command history for ${profile.name}?`)) {
                try {
                  const count = await invoke<number>("history_clear", {
                    profileId: profile.id,
                  });
                  alert(`Cleared ${count} history entries`);
                } catch (error) {
                  console.error("[Terminal] Failed to clear history:", error);
                  alert("Failed to clear history");
                }
              }
            }}
            className="flex h-8 items-center gap-2 rounded-lg bg-red-500/10 px-3 hover:bg-red-500/20 transition-colors ring-1 ring-red-500/20"
            title="Clear command history"
          >
            <Trash2 size={14} className="text-red-400" />
            <span className="text-sm text-red-400">Clear History</span>
          </button>

          {sessionId && (
            <div className="flex items-center gap-2 rounded-full bg-green-500/10 px-4 py-2 ring-1 ring-green-500/20">
              <div className="h-2 w-2 animate-pulse rounded-full bg-green-500 shadow-lg shadow-green-500/50"></div>
              <span className="text-sm font-medium text-green-400">Connected</span>
            </div>
          )}
        </div>
      </div>

      {/* Terminal Container */}
      <div
        ref={containerRef}
        className="h-full w-full flex-1 relative"
        style={{ background: "#0a0a0a" }}
      >
        {/* Inline Suggestion Overlay */}
        {inlineSuggestion && currentInput && !showDropdown && (
          <InlineOverlay
            suggestion={inlineSuggestion}
            currentInput={currentInput}
            cursorX={cursorPosition.x}
            cursorY={cursorPosition.y}
            fontSize={fontSize}
          />
        )}

        {/* Autocomplete Dropdown */}
        {showDropdown && (
          <AutocompleteDropdown
            suggestions={suggestions}
            selectedIndex={selectedIndex}
            onSelect={(suggestion) => {
              console.log('[Terminal] Selected:', suggestion.cmd);

              // 현재 입력된 부분을 지우고 선택한 명령어로 교체
              const currentCmd = currentInputRef.current;
              const id = sessionIdRef.current;

              if (id && currentCmd) {
                // 현재 입력 길이만큼 백스페이스 전송
                const backspaces = '\x7F'.repeat(currentCmd.length);
                invoke("ssh_write", { id, data: backspaces }).catch((err) => {
                  console.error("[ssh_write error]", err);
                });

                // 선택한 명령어 전송
                setTimeout(() => {
                  invoke("ssh_write", { id, data: suggestion.cmd }).catch((err) => {
                    console.error("[ssh_write error]", err);
                  });
                }, 50);
              } else if (id) {
                // 현재 입력이 없으면 그냥 명령어 전송
                invoke("ssh_write", { id, data: suggestion.cmd }).catch((err) => {
                  console.error("[ssh_write error]", err);
                });
              }

              setShowDropdown(false);
            }}
            onClose={() => setShowDropdown(false)}
            position={dropdownPosition}
          />
        )}

        {/* AI Panel */}
        <AIPanel
          isOpen={showAIPanel}
          onClose={() => setShowAIPanel(false)}
          onInsertCommand={(command) => {
            const id = sessionIdRef.current;
            if (id) {
              // 명령어를 터미널에 입력 (자동 실행 안 함)
              invoke("ssh_write", { id, data: command }).catch((err) => {
                console.error("[ssh_write error]", err);
              });
            }
          }}
          context={`
SSH Connection: ${profile.user}@${profile.host}:${profile.port}
Profile: ${profile.name}
${osInfo ? `Operating System: ${osInfo}` : ''}

Note: User is working in an SSH terminal session. Provide commands appropriate for this specific OS distribution.
`.trim()}
        />
      </div>
    </div>
  );
};
