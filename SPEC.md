# AIT (AI Terminal) - 기술 스펙

## 터미널 에뮬레이션

**Terminal Type**: `xterm-256color` (ANSI 256 colors, UTF-8)

**Frontend**: xterm.js v5.3.0
- Font: Cascadia Code, Consolas, DejaVu Sans Mono
- 스크롤백 버퍼: 10,000줄
- 다크 테마, 커서 블링크

**Backend**: Rust ssh2 크레이트 (libssh2)
- Non-blocking SSH 세션
- 스마트 버퍼링 (100ms 배치 또는 4KB 임계값)
- PTY 크기 자동 동기화

**Features**: ANSI CSI 시퀀스, 커서 제어, 256 컬러, UTF-8 완전 지원

## 아키텍처

**통신**: Tauri v2 IPC
```
SSH 서버 → ssh2 (Rust) → 스마트 버퍼 → Tauri IPC → React → xterm.js
사용자 입력 → xterm.js → React → Tauri IPC → ssh2 → SSH 서버
```

**데이터 저장**: SQLite (bundled)
- `profiles`: SSH 접속 정보 (비밀번호 포함 - 평문 저장, Keychain 마이그레이션 예정)
- `history`: 명령어 히스토리
- `settings`: 설정값 (AI 서버, 폰트 크기 등)
- `macros`: 매크로 정의

## 주요 기능

### SSH 터미널
- 다중 탭 세션 (Ctrl+T/W)
- 복사/붙여넣기 (Ctrl+C/V)
- 프로필 관리 및 자동 로그인
- 명령어 히스토리 & 자동완성 (200+ 명령어 사전)
- 인라인 제안 (→ 키로 수락)
- 드롭다운 메뉴 (Shift+Space)

### AI 통합
- Ollama 로컬 LLM 지원
- 자연어 → 쉘 명령어 변환
- Ctrl+Space로 AI 패널 토글
- 컨텍스트 기반 명령어 추천

### 매크로 시스템
- Ctrl+0~9 단축키
- 프로필별/전역 매크로 지원

## 기술 스택

**Frontend**:
- React 19 + TypeScript 5.8
- Vite 7 + Tailwind CSS 3.4
- xterm.js 5.3

**Backend**:
- Tauri 2 + Rust 2021
- ssh2 0.9, rusqlite 0.37
- reqwest 0.12 (AI API)
- tokio 1.x (async runtime)

**개발 환경**: Ubuntu 24.04 WSL2
**타겟 플랫폼**: Linux, macOS, Windows
