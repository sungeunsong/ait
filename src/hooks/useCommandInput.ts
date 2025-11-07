import { useEffect, useRef, useState } from 'react';
import type { Terminal } from 'xterm';

export interface UseCommandInputOptions {
  terminal: Terminal | null;
  enabled?: boolean;
  onCommandExecuted?: (command: string) => void;
}

export interface CommandInputState {
  currentInput: string;
  cursorPosition: number;
}

/**
 * Hook to track command input in real-time from xterm.js terminal
 * Monitors user typing and provides current command line content
 */
export function useCommandInput({ terminal, enabled = true, onCommandExecuted }: UseCommandInputOptions) {
  const [currentInput, setCurrentInput] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputBufferRef = useRef('');

  useEffect(() => {
    if (!terminal || !enabled) return;

    const handleData = (data: string) => {
      const charCode = data.charCodeAt(0);

      // Handle Enter key (ASCII 13 or \r)
      if (charCode === 13) {
        const command = inputBufferRef.current.trim();
        console.log('[useCommandInput] Enter pressed, command:', command);

        // Call callback if provided
        if (command && onCommandExecuted) {
          onCommandExecuted(command);
        }

        inputBufferRef.current = '';
        setCurrentInput('');
        setCursorPosition(0);
        return;
      }

      // Handle Backspace (ASCII 127 or 8)
      if (charCode === 127 || charCode === 8) {
        if (inputBufferRef.current.length > 0) {
          inputBufferRef.current = inputBufferRef.current.slice(0, -1);
          setCurrentInput(inputBufferRef.current);
          setCursorPosition(inputBufferRef.current.length);
          console.log('[useCommandInput] Backspace, current:', inputBufferRef.current);
        }
        return;
      }

      // Handle Ctrl+C (ASCII 3)
      if (charCode === 3) {
        console.log('[useCommandInput] Ctrl+C pressed, clearing input');
        inputBufferRef.current = '';
        setCurrentInput('');
        setCursorPosition(0);
        return;
      }

      // Handle Ctrl+U (clear line, ASCII 21)
      if (charCode === 21) {
        console.log('[useCommandInput] Ctrl+U pressed, clearing line');
        inputBufferRef.current = '';
        setCurrentInput('');
        setCursorPosition(0);
        return;
      }

      // Handle Tab key (ASCII 9) - clear input to avoid suggestion overlap after server autocomplete
      if (charCode === 9) {
        console.log('[useCommandInput] Tab pressed, clearing input for server autocomplete');
        inputBufferRef.current = '';
        setCurrentInput('');
        setCursorPosition(0);
        return;
      }

      // Handle printable characters (ASCII 32-126)
      if (charCode >= 32 && charCode <= 126) {
        inputBufferRef.current += data;
        setCurrentInput(inputBufferRef.current);
        setCursorPosition(inputBufferRef.current.length);
        console.log('[useCommandInput] Input:', inputBufferRef.current);
      }

      // Ignore other control characters (arrows, escape sequences, etc.)
      // These are handled by the server-side shell
    };

    const disposable = terminal.onData(handleData);

    return () => {
      disposable.dispose();
    };
  }, [terminal, enabled, onCommandExecuted]);

  return {
    currentInput,
    cursorPosition,
    clearInput: () => {
      inputBufferRef.current = '';
      setCurrentInput('');
      setCursorPosition(0);
    }
  };
}
