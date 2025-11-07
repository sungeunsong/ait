import React from 'react';

interface InlineOverlayProps {
  suggestion: string;
  currentInput: string;
  cursorX: number; // Now in pixels
  cursorY: number; // Now in pixels
  fontSize: number;
}

export const InlineOverlay: React.FC<InlineOverlayProps> = ({
  suggestion,
  currentInput,
  cursorX,
  cursorY,
  fontSize,
}) => {
  // Extract only the completion part (not already typed)
  const completionText = suggestion.slice(currentInput.length);

  if (!completionText) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute z-10"
      style={{
        left: `${cursorX}px`,
        top: `${cursorY}px`,
        fontFamily: 'monospace',
        fontSize: `${fontSize}px`,
        lineHeight: `${fontSize * 1.2}px`,
        color: '#666666', // Gray color for subtle suggestion
        whiteSpace: 'pre',
      }}
    >
      {completionText}
    </div>
  );
};
