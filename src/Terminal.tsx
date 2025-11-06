import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import "xterm/css/xterm.css";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ServerProfile } from "./ProfileList";
import { Server } from "lucide-react";
import { useCommandInput } from "./hooks/useCommandInput";
import { AutocompleteDropdown, CommandSuggestion } from "./components/AutocompleteDropdown";
import { AutocompleteInline } from "./components/AutocompleteInline";

interface SshTerminalProps {
  profile: ServerProfile;
}

export const SshTerminal: React.FC<SshTerminalProps> = ({ profile }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const sessionIdRef = useRef<string | null>(null); // ← 새로 추가: effect 안에서 쓸용
  const [sessionId, setSessionId] = useState<string | null>(null); // 화면에 보여줄 용도만

  // Autocomplete dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [suggestions, setSuggestions] = useState<CommandSuggestion[]>([]);

  // Inline autocomplete state
  const [inlineSuggestion, setInlineSuggestion] = useState<string>('');

  // Refs for state access in event handlers
  const inlineSuggestionRef = useRef<string>('');
  const currentInputRef = useRef<string>('');
  const showDropdownRef = useRef<boolean>(false);
  const suggestionsRef = useRef<CommandSuggestion[]>([]);
  const selectedIndexRef = useRef<number>(0);

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

    console.log("[Terminal] handleAutocomplete called, sessionId:", currentSessionId, "currentCmd:", currentCmd);

    if (!currentSessionId) {
      console.log("[Terminal] No sessionId, returning");
      return;
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

  useEffect(() => {
    // 1) 터미널 1번만 만든다
    const term = new Terminal({
      fontSize: 14,
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

    // 3) DOM에 붙이기
    if (containerRef.current) {
      term.open(containerRef.current);
      // 초기 fit
      setTimeout(() => fitAddon.fit(), 0);
    }

    // 4) ResizeObserver로 창 크기 변화 감지
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
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

        const id = await invoke<string>("ssh_open_shell", {
          host: profile.host,
          port: profile.port,
          user: profile.user,
          password: profile.password,
        });

        // ref에도 저장, state에도 저장
        sessionIdRef.current = id;
        setSessionId(id);
        term.writeln(`✅ SSH connected (session: ${id})\r\n`);
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
      }

      // Shift+Space 감지
      if (event.key === ' ' && event.shiftKey && event.type === 'keydown') {
        console.log('[Terminal] Shift+Space pressed, triggering autocomplete');
        event.preventDefault();
        handleAutocomplete();
        return false; // 이벤트 전파 중단
      }

      // Esc 키로 드롭다운 닫기
      if (event.key === 'Escape' && isDropdownOpen && event.type === 'keydown') {
        event.preventDefault();
        setShowDropdown(false);
        return false;
      }

      // ↑/↓ 키로 드롭다운 네비게이션
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
            <div className="text-sm font-semibold text-gray-100">
              {profile.name}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400">
              <span>{profile.user}@{profile.host}</span>
              <span className="text-gray-600">•</span>
              <span>Port {profile.port}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Inline suggestion hint */}
          {inlineSuggestion && currentInput && !showDropdown && (
            <div className="flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1.5 ring-1 ring-blue-500/20">
              <span className="text-xs text-gray-400">Suggestion:</span>
              <code className="text-xs font-mono text-blue-400">{inlineSuggestion}</code>
              <span className="text-xs text-gray-500">→ to accept</span>
            </div>
          )}

          {sessionId && (
            <div className="flex items-center gap-2 rounded-full bg-green-500/10 px-3 py-1.5 ring-1 ring-green-500/20">
              <div className="h-2 w-2 animate-pulse rounded-full bg-green-500 shadow-lg shadow-green-500/50"></div>
              <span className="text-xs font-medium text-green-400">Connected</span>
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
            position={{ x: 20, y: 100 }}
          />
        )}
      </div>
    </div>
  );
};
