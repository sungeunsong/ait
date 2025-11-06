import React from 'react';

export interface AutocompleteInlineProps {
  suggestion: string;
  currentInput: string;
  position?: { x: number; y: number };
}

/**
 * Inline autocomplete suggestion component
 * Displays grey text overlay showing the completion part
 * Example: User types "ls" -> shows "ls -la" with "-la" in grey
 */
export const AutocompleteInline: React.FC<AutocompleteInlineProps> = ({
  suggestion,
  currentInput,
  position = { x: 0, y: 0 }
}) => {
  // Calculate the completion part (what user hasn't typed yet)
  const completionPart = suggestion.startsWith(currentInput)
    ? suggestion.slice(currentInput.length)
    : '';

  if (!completionPart) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute z-40 font-mono text-sm"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        color: '#6b7280', // gray-500
        whiteSpace: 'pre',
      }}
    >
      <span className="invisible">{currentInput}</span>
      <span className="text-gray-500/50">{completionPart}</span>
    </div>
  );
};
