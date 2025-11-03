프로젝트명

AIT (AI Terminal) — AI가 탑재된 차세대 SSH 터미널 클라이언트

# 🧩 AI SSH Terminal – MVP 1차 기능 명세서

## 1️⃣ 프로젝트 개요
**목표:**  
Tauri + Rust + React 기반의 경량 AI 통합 SSH 터미널.  
자연어 명령과 AI 보조를 통해 서버 접근과 명령 실행을 효율화하고,  
보안을 해치지 않으면서도 사용자 경험을 개선한다.

**핵심 가치:**  
- 빠르고 가벼운 로컬 클라이언트  
- 자동화보다는 **“도우미형 AI”** 지향  
- SSH 기반 서버 관리 편의성 강화  

## 2️⃣ 기술 스택
| 구분 | 기술 |
|------|------|
| 프레임워크 | **Tauri (Rust + React + TypeScript)** |
| UI 라이브러리 | React + xterm.js + Tailwind |
| 데이터베이스 | SQLite (로컬 파일형 DB) |
| AI 연동 | Ollama 로컬 모델 (예: Llama 3.1 8B) |
| 보안 저장 | OS Keychain (Tauri secure storage) |
| 통신 | Rust ssh2 크레이트 (SSH, SFTP 확장 고려) |

## 3️⃣ MVP 1차 기능 정의

### A. 터미널 / SSH 기본 기능
| 기능 | 설명 |
|------|------|
| SSH 접속 | 호스트, 포트, 사용자명, 비밀번호(또는 키) 입력 후 접속 가능 |
| 프로필 관리 | 접속 정보(`profiles`)를 SQLite에 저장 |
| 자동 로그인 | 비밀번호 입력 후 “자동 로그인 하시겠습니까?” → YES 시 Keychain 저장 |
| 다중 탭 | 여러 SSH 세션을 탭으로 동시에 유지 (`Ctrl+T`/`Ctrl+W`) |
| 터미널 인터페이스 | xterm.js 기반 ANSI 컬러, 복사/붙여넣기, 스크롤 |
| 접속 히스토리 | 접속 시각, 명령 실행 기록(`history`) 저장 |
| 세션 재연결 | 네트워크 끊김 감지 후 “재연결” 버튼 노출 |
| 프로필 목록 | 좌측 패널에 최근/자주 쓰는 서버 표시 |

### B. AI 통합 기능
| 기능 | 설명 |
|------|------|
| AI 질문 모드 | 단축키(`Ctrl+Space`)로 터미널 ↔ AI 입력창 전환 |
| 질문 응답 | Ollama 호출 → 결과를 우측 패널 또는 오버레이로 표시 |
| 명령 삽입 | 응답 내 코드/명령을 감지하여 “터미널에 붙여넣을까요?” 팝업 표시 |
| 안전 실행 | 자동 실행 없이, 사용자가 확인 후 Enter로 실행 |
| AI 프롬프트 문맥 | 현재 SSH 세션 OS정보(예: Ubuntu 22.04)를 AI에 전달 |

### C. 데이터 저장 및 설정
| 항목 | 설명 |
|------|------|
| SQLite 스키마 | `profiles`, `history`, `settings` (최소 3개) |
| 보안저장 | 비밀번호는 SQLite에 저장 금지 → Keychain 사용 |
| 설정 관리 | 폰트 크기, AI 모델/엔드포인트, 자동로그인 여부 저장 |
| 로그 관리 | 명령 로그는 월별 롤링 파일(`history-YYYYMM.ndjson`)로도 백업 가능 |

### D. 추천 기능 (MVP 1차에 포함)
| 기능 | 설명 |
|------|------|
| 서버별 빠른접속 리스트 | 좌측 패널에 프로필 목록 및 검색 가능 |
| 세션 재연결 | 접속 끊김 시 자동 감지 → “재연결” 버튼 노출 |
| 명령 실행 결과 복사 | 선택 영역 또는 최근 명령 결과 복사 버튼 제공 |
| AI 응답 복사 | AI 답변 영역 내 “복사” 버튼 추가 |

향후 단계 로드맵 요약
단계	목표
MVP 1차 (현재)	SSH + 자동로그인 + 탭 + AI 모드 + SQLite + 추천 D항목
MVP 1.5	명령 자동완성(Shift+Tab), 문맥 기반 추천, AI 선택 명령 실행
1.0 Final	멀티서버 명령, SFTP, 위험도 평가, RAG, LDAP/AD 연동

## 주요 단축키 (초기 제안)
| 조합 | 동작 |
|------|------|
| `Ctrl+Space` | 터미널 입력 ↔ AI 질문 모드 전환 |
| `Ctrl+Enter` | AI 응답을 터미널 입력줄에 붙여넣기 (확인 후) |
| `Shift+Tab` | 명령어 자동완성 후보 표시 (히스토리 기반) |
| `Ctrl+K` | 명령 팔레트 (서버/명령/AI 통합 검색, 향후 확장) |
| `Ctrl+T` / `Ctrl+W` | 새 탭 열기 / 탭 닫기 |

## SQLite 스키마 초안

```sql
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  name TEXT,
  host TEXT,
  port INTEGER,
  user TEXT,
  auth_type TEXT,     -- password / key
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE history (
  id TEXT PRIMARY KEY,
  profile_id TEXT,
  cmd TEXT,
  ts INTEGER,
  exit_code INTEGER,
  duration_ms INTEGER
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

## 6️⃣ 보안 및 정책
- 비밀번호, 키, 토큰은 SQLite에 저장하지 않는다.  
  → OS Keychain 또는 Tauri Secure Storage 사용  
- AI가 제안한 명령은 즉시 실행하지 않고 “확인 팝업”을 거친다.  
- AI 모드에서는 로컬 명령 실행 불가 (Ollama API만 호출).  
- 로그 및 히스토리는 로컬 파일로만 남는다. (외부 전송 없음)

## 7️⃣ 향후 단계 로드맵 요약
| 단계 | 목표 |
|------|------|
| MVP 1차 | SSH + 자동로그인 + 탭 + AI 모드 + SQLite + 추천 D항목 |
| MVP 1.5 | 명령 자동완성(Shift+Tab), 문맥 기반 추천, AI 선택 명령 실행 |
| 1.0 Final | 멀티서버 명령, SFTP, 위험도 평가, RAG, LDAP/AD 연동 |

⚙️ 개발 환경 (기본 설정)

OS: Ubuntu 24.04.3 (WSL)

IDE: VSCode (Remote SSH 연결)

Rust, Node.js, pnpm, Tauri CLI 설치 필요

🚀 실행 명령어
# 프로젝트 생성
pnpm create tauri-app@latest ait

# 개발 서버 실행
cd ait
pnpm tauri dev

📘 개발 원칙

Rust는 코어 기능 중심, React는 UI에 집중

코드 구조를 확장성 있게 유지 (후에 AI/클라우드 연동 용이)

---

## 🔄 현재 진행 상황 (2025-10-31)
### ✅ 완료된 작업
- **SSH 연결 기본 기능 구현** (`src-tauri/src/ssh.rs`)
- **Tauri v2 호환성 문제 해결**: `Emitter` trait import로 `emit_to` 메서드 사용
- **프론트엔드 구조 분석**: App.tsx → Terminal.tsx (xterm.js 기반)
- **Tailwind CSS + Lucide React 설정 완료**
- **서버 프로필 관리 시스템 설계**: MobaXterm 스타일 좌측 리스트 + 우측 터미널

### 🚧 다음 세션 작업 계획 (월요일)
1. **SQLite 데이터베이스 구현**
   ```bash
   cd src-tauri && cargo add rusqlite uuid serde serde_json
   ```
   - profiles, history, settings 테이블 생성
   - 데이터베이스 초기화 로직

2. **Tauri Commands 구현**
   - `profile_create`, `profile_list`, `profile_update`, `profile_delete`
   - SSH 연결을 프로필 기반으로 변경

3. **React UI 컴포넌트 개발**
   - 프로필 리스트 컴포넌트 (좌측 패널)
   - 프로필 추가/편집 모달
   - 기존 Terminal.tsx를 프로필 선택 기반으로 수정

4. **통합 테스트**
   - 프로필 생성 → 선택 → SSH 연결 플로우 검증

### 🎯 목표 UI 구조
```
┌─────────────────────────────────────────┐
│ [+] 서버 추가                            │
├─────────────────────────────────────────┤
│ 📁 Production                           │
│   🖥️  Web Server (192.168.1.10)       │
│   🖥️  DB Server (192.168.1.20)        │
│ 📁 Development                          │
│   🖥️  Dev Server (192.168.1.30)       │
└─────────────────────────────────────────┘
```