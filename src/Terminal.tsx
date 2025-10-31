import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export const SshTerminal: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const sessionIdRef = useRef<string | null>(null); // ← 새로 추가: effect 안에서 쓸용
  const [sessionId, setSessionId] = useState<string | null>(null); // 화면에 보여줄 용도만

  useEffect(() => {
    // 1) 터미널 1번만 만든다
    const term = new Terminal({
      fontSize: 14,
      rows: 24,
      cursorBlink: true,
      convertEol: true,
      theme: {
        background: "#1e1e1e",
        foreground: "#dcdcdc",
      },
    });
    termRef.current = term;

    // 2) DOM에 붙이기
    if (containerRef.current) {
      term.open(containerRef.current);
      // DOM 붙은 다음에 쓰기
      requestAnimationFrame(() => {
        term.write("🔌 AIT SSH Terminal Ready\r\n");
        term.write("세션을 여는 중...\r\n");
      });
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
        const id = await invoke<string>("ssh_open_shell", {
          host: "192.168.136.146",
          port: 22,
          user: "root",
          password: "ehfpal!!",
        });
        // ref에도 저장, state에도 저장
        sessionIdRef.current = id;
        setSessionId(id);
        term.writeln(`✅ SSH connected (session: ${id})`);
      } catch (e) {
        term.writeln(`❌ SSH connection failed: ${String(e)}\r\n`);
        console.error(e);
      }
    })();

    // 5) 입력 → Rust
    term.onData((data) => {
      const id = sessionIdRef.current;
      if (!id) return;
      const toSend = data === "\r" ? "\r\n" : data;
      invoke("ssh_write", { id, data: toSend }).catch((err) => {
        console.error("[ssh_write error]", err);
      });
    });

    // 6) cleanup
    return () => {
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
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", background: "#1e1e1e" }}
    />
  );
};
