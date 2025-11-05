import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import "xterm/css/xterm.css";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ServerProfile } from "./ProfileList";
import { Server } from "lucide-react";

interface SshTerminalProps {
  profile: ServerProfile;
}

export const SshTerminal: React.FC<SshTerminalProps> = ({ profile }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const sessionIdRef = useRef<string | null>(null); // ← 새로 추가: effect 안에서 쓸용
  const [sessionId, setSessionId] = useState<string | null>(null); // 화면에 보여줄 용도만
  const currentInputRef = useRef<string>(""); // 현재 입력 중인 명령어 추적

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

    // 5) 입력 → Rust
    term.onData((data) => {
      const id = sessionIdRef.current;
      if (!id) return;

      // Enter 키 감지 (명령어 실행)
      if (data === '\r' || data === '\n') {
        const cmd = currentInputRef.current.trim();
        if (cmd.length > 0) {
          // 히스토리에 저장
          invoke("history_save", {
            input: {
              profile_id: profile.id,
              cmd: cmd,
              exit_code: null,
              duration_ms: null,
            }
          }).catch((err) => {
            console.error("[history_save error]", err);
          });
        }
        // 입력 버퍼 초기화
        currentInputRef.current = "";
      }
      // Backspace 처리
      else if (data === '\x7F' || data === '\b') {
        currentInputRef.current = currentInputRef.current.slice(0, -1);
      }
      // 일반 문자 입력
      else if (data >= ' ' && data <= '~') {
        currentInputRef.current += data;
      }

      // SSH PTY에서는 \r만 보내면 됨 (\r\n 보내면 프롬프트 중복)
      invoke("ssh_write", { id, data }).catch((err) => {
        console.error("[ssh_write error]", err);
      });
    });

    // 6) cleanup
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
        {sessionId && (
          <div className="flex items-center gap-2 rounded-full bg-green-500/10 px-3 py-1.5 ring-1 ring-green-500/20">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-500 shadow-lg shadow-green-500/50"></div>
            <span className="text-xs font-medium text-green-400">Connected</span>
          </div>
        )}
      </div>

      {/* Terminal Container */}
      <div
        ref={containerRef}
        className="h-full w-full flex-1"
        style={{ background: "#0a0a0a" }}
      />
    </div>
  );
};
