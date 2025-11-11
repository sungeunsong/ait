import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, Send, Copy, Terminal as TerminalIcon, Settings } from 'lucide-react';

interface AIResponse {
  response: string;
  model: string;
}

interface AIPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertCommand: (command: string) => void;
  context?: string;
  sessionId: string | null;
  osInfo: string;
  onOsInfoUpdate: (osInfo: string) => void;
}

export const AIPanel: React.FC<AIPanelProps> = ({
  isOpen,
  onClose,
  onInsertCommand,
  context,
  sessionId,
  osInfo,
  onOsInfoUpdate,
}) => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [extractedCommands, setExtractedCommands] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // AI 설정
  const [serverUrl, setServerUrl] = useState('http://192.168.136.8:11434');
  const [model, setModel] = useState('gpt-oss:20b');
  const [showSettings, setShowSettings] = useState(false);

  // 설정 로드 및 OS 정보 가져오기
  useEffect(() => {
    if (isOpen) {
      // AI 설정 로드
      Promise.all([
        invoke<string | null>('settings_get', { key: 'ai_server_url' }),
        invoke<string | null>('settings_get', { key: 'ai_model' }),
      ]).then(([savedUrl, savedModel]) => {
        if (savedUrl) setServerUrl(savedUrl);
        if (savedModel) setModel(savedModel);
      }).catch(console.error);

      // OS 정보가 없으면 가져오기
      if (!osInfo && sessionId) {
        console.log('[AIPanel] Fetching OS info...');
        invoke<string>('ssh_exec', {
          id: sessionId,
          command: 'cat /etc/os-release 2>/dev/null || uname -s'
        }).then((output) => {
          // PRETTY_NAME 또는 NAME 찾기
          const prettyMatch = output.match(/PRETTY_NAME="([^"]+)"/);
          const nameMatch = output.match(/NAME="([^"]+)"/);
          const versionMatch = output.match(/VERSION="([^"]+)"/);

          if (prettyMatch || nameMatch) {
            const osName = prettyMatch ? prettyMatch[1] : nameMatch![1];
            const osVersion = versionMatch ? ` ${versionMatch[1]}` : '';
            const detectedOS = `${osName}${osVersion}`;
            console.log('[AIPanel] Detected OS:', detectedOS);
            onOsInfoUpdate(detectedOS);
          } else {
            // uname 결과 감지 (fallback)
            const unameMatch = output.match(/(Linux|Darwin|FreeBSD)/);
            if (unameMatch) {
              console.log('[AIPanel] Detected OS (uname):', unameMatch[1]);
              onOsInfoUpdate(unameMatch[1]);
            }
          }
        }).catch((err) => {
          console.error('[AIPanel] Failed to detect OS:', err);
        });
      }
    }
  }, [isOpen, osInfo, sessionId, onOsInfoUpdate]);

  // 설정 저장
  const saveSettings = async () => {
    try {
      await invoke('settings_set', { key: 'ai_server_url', value: serverUrl });
      await invoke('settings_set', { key: 'ai_model', value: model });
      setShowSettings(false);
    } catch (err) {
      console.error('설정 저장 실패:', err);
    }
  };

  // ESC 키로 패널 닫기
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    // 패널이 열릴 때 이벤트 리스너 추가 (캡처 단계에서)
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose]);

  const handleAsk = async () => {
    if (!question.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const result = await invoke<AIResponse>('ai_ask', {
        prompt: question,
        context: context || null,
        serverUrl: serverUrl,
        model: model,
      });

      setResponse(result);

      // 명령어 추출
      const commands = await invoke<string[]>('ai_extract_commands', {
        response: result.response,
      });
      setExtractedCommands(commands);
    } catch (err) {
      console.error('AI 요청 실패:', err);
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // 패널이 열릴 때 textarea에 포커스
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 한글 입력 중에는 Enter 키를 무시
    if (isComposing) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg shadow-xl w-[800px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">AI Assistant</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-gray-400 hover:text-white transition-colors"
              title="설정"
            >
              <Settings size={20} />
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              title="닫기"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Settings Panel */}
          {showSettings && (
            <div className="bg-gray-800 border border-gray-700 rounded p-4 space-y-4">
              <h3 className="text-base font-semibold text-white">AI 설정</h3>

              <div className="space-y-2">
                <label className="text-sm text-gray-300">Ollama 서버 URL:</label>
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://192.168.136.8:11434"
                  className="w-full bg-gray-900 text-white border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-300">모델:</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="gpt-oss:20b"
                  className="w-full bg-gray-900 text-white border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={saveSettings}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm transition-colors"
                >
                  저장
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {/* Question Input */}
          <div className="space-y-2">
            <label className="text-sm text-gray-300">질문을 입력하세요:</label>
            <textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder="예: 현재 디렉토리의 모든 파일을 크기순으로 정렬하는 방법은?"
              className="w-full bg-gray-800 text-white border border-gray-700 rounded px-3 py-2 min-h-[80px] resize-none focus:outline-none focus:border-blue-500"
              disabled={loading}
              lang="ko"
            />
            <div className="text-xs text-gray-500">
              Enter: 전송 | Shift+Enter: 줄바꿈
            </div>
          </div>

          {/* Ask Button */}
          <button
            onClick={handleAsk}
            disabled={loading || !question.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded flex items-center justify-center gap-2 transition-colors"
          >
            <Send size={16} />
            {loading ? '처리 중...' : 'AI에게 질문하기'}
          </button>

          {/* Error Message */}
          {error && (
            <div className="bg-red-900 bg-opacity-30 border border-red-700 text-red-300 px-4 py-3 rounded">
              <strong>오류:</strong> {error}
            </div>
          )}

          {/* Response */}
          {response && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-300">AI 응답:</h3>
                <button
                  onClick={() => copyToClipboard(response.response)}
                  className="text-gray-400 hover:text-white transition-colors"
                  title="응답 복사"
                >
                  <Copy size={16} />
                </button>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded p-4 text-gray-200 whitespace-pre-wrap font-mono text-sm max-h-[300px] overflow-y-auto">
                {response.response}
              </div>
              <div className="text-xs text-gray-500">
                모델: {response.model}
              </div>
            </div>
          )}

          {/* Extracted Commands */}
          {extractedCommands.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-300">
                추출된 명령어:
              </h3>
              {extractedCommands.map((cmd, index) => (
                <div
                  key={index}
                  className="bg-gray-800 border border-gray-700 rounded p-3 flex items-start justify-between gap-3"
                >
                  <code className="text-green-400 text-sm flex-1 font-mono whitespace-pre-wrap">
                    {cmd}
                  </code>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(cmd)}
                      className="text-gray-400 hover:text-white transition-colors"
                      title="복사"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      onClick={() => {
                        onInsertCommand(cmd);
                        onClose();
                      }}
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                      title="터미널에 삽입"
                    >
                      <TerminalIcon size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 text-xs text-gray-500">
          Ctrl+Space: AI 패널 토글 | Esc: 닫기
        </div>
      </div>
    </div>
  );
};
