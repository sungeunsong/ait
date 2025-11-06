import React, { useEffect, useRef } from 'react';
import { Clock, TrendingUp } from 'lucide-react';

export interface CommandSuggestion {
  cmd: string;
  frequency: number;
  last_used: number;
}

export interface AutocompleteDropdownProps {
  suggestions: CommandSuggestion[];
  selectedIndex: number;
  onSelect: (suggestion: CommandSuggestion) => void;
  onClose: () => void;
  position?: { x: number; y: number };
}

/**
 * Dropdown component for command autocomplete suggestions
 * Displays commands with frequency and last used time
 * Supports keyboard navigation (↑/↓/Enter/Esc)
 */
export const AutocompleteDropdown: React.FC<AutocompleteDropdownProps> = ({
  suggestions,
  selectedIndex,
  onSelect,
  onClose,
  position = { x: 0, y: 0 }
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Format timestamp to relative time
  const formatLastUsed = (timestamp: number): string => {
    const now = Date.now() / 1000;
    const diff = now - timestamp;

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  // Auto-scroll selected item into view
  useEffect(() => {
    if (dropdownRef.current) {
      const selectedElement = dropdownRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [selectedIndex]);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute z-50 mt-1 max-h-64 w-96 overflow-y-auto rounded-lg border border-gray-700/50 bg-gray-900/95 shadow-2xl backdrop-blur-sm"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {/* Header */}
      <div className="sticky top-0 border-b border-gray-700/30 bg-gray-800/50 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
          <TrendingUp size={12} />
          <span>Command History ({suggestions.length})</span>
          <span className="ml-auto text-gray-500">↑↓ navigate • Enter select • Esc close</span>
        </div>
      </div>

      {/* Suggestions List */}
      <div className="py-1">
        {suggestions.map((suggestion, index) => (
          <button
            key={`${suggestion.cmd}-${index}`}
            data-index={index}
            onClick={() => onSelect(suggestion)}
            className={`
              flex w-full items-center justify-between px-3 py-2 text-left transition-colors
              ${
                index === selectedIndex
                  ? 'bg-blue-600/20 text-blue-300'
                  : 'text-gray-300 hover:bg-gray-800/50'
              }
            `}
          >
            {/* Command Text */}
            <div className="flex-1 truncate">
              <code className="text-sm font-mono">{suggestion.cmd}</code>
            </div>

            {/* Metadata */}
            <div className="ml-4 flex items-center gap-3 text-xs text-gray-500">
              {/* Frequency */}
              {suggestion.frequency > 1 && (
                <div className="flex items-center gap-1">
                  <TrendingUp size={10} />
                  <span>{suggestion.frequency}×</span>
                </div>
              )}

              {/* Last Used */}
              <div className="flex items-center gap-1">
                <Clock size={10} />
                <span>{formatLastUsed(suggestion.last_used)}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Footer hint */}
      {suggestions.length > 5 && (
        <div className="sticky bottom-0 border-t border-gray-700/30 bg-gray-800/50 px-3 py-1.5 text-center text-xs text-gray-500 backdrop-blur">
          Scroll for more commands
        </div>
      )}
    </div>
  );
};
