/**
 * Inline Writing Assistant
 * Provides AI-powered writing help in any text field
 */

import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Sparkles, Check, X, Loader2 } from 'lucide-react';
import { MessageType } from '@/types/messages';

interface InlineAssistantProps {
  selectedText: string;
  targetElement: HTMLElement;
  position: { x: number; y: number };
  onClose: () => void;
  onReplace: (newText: string) => void;
}

const InlineAssistant: React.FC<InlineAssistantProps> = ({
  selectedText,
  position,
  onClose,
  onReplace,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const actions = [
    { id: 'improve', label: 'Improve', instruction: 'Improve this text while keeping the same meaning' },
    { id: 'professional', label: 'Professional', instruction: 'Rewrite this text in a professional tone' },
    { id: 'casual', label: 'Casual', instruction: 'Rewrite this text in a casual, friendly tone' },
    { id: 'shorter', label: 'Shorter', instruction: 'Make this text more concise and shorter' },
    { id: 'longer', label: 'Longer', instruction: 'Expand this text with more detail' },
    { id: 'fix', label: 'Fix Grammar', instruction: 'Fix any grammar, spelling, or punctuation errors in this text' },
  ];

  const handleAction = async (action: typeof actions[0]) => {
    setActiveAction(action.id);
    setIsLoading(true);
    setResult(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.IMPROVE_TEXT,
        payload: {
          text: selectedText,
          instruction: action.instruction,
        },
      });

      if (response.success) {
        setResult(response.data);
      } else {
        setResult('Error: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      setResult('Error: Failed to connect to Intella');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = () => {
    if (result) {
      onReplace(result);
    }
    onClose();
  };

  return (
    <div
      style={{
        ...styles.container,
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerTitle}>
          <Sparkles size={16} color="#6366f1" />
          <span style={styles.title}>Intella</span>
        </div>
        <button onClick={onClose} style={styles.closeButton}>
          <X size={16} />
        </button>
      </div>

      {/* Actions */}
      {!result && !isLoading && (
        <div style={styles.actions}>
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => handleAction(action)}
              style={{
                ...styles.actionButton,
                ...(activeAction === action.id ? styles.actionButtonActive : {}),
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={styles.loading}>
          <Loader2 size={20} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
          <span>Improving text...</span>
        </div>
      )}

      {/* Result */}
      {result && !isLoading && (
        <div style={styles.result}>
          <div style={styles.resultText}>{result}</div>
          <div style={styles.resultActions}>
            <button onClick={handleAccept} style={styles.acceptButton}>
              <Check size={16} />
              Accept
            </button>
            <button onClick={onClose} style={styles.cancelButton}>
              <X size={16} />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Original text preview */}
      {!result && (
        <div style={styles.originalText}>
          <div style={styles.originalLabel}>Original:</div>
          <div style={styles.originalContent}>
            {selectedText.length > 100 ? selectedText.slice(0, 100) + '...' : selectedText}
          </div>
        </div>
      )}
    </div>
  );
};

// Inline styles (required for content script isolation)
const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    minWidth: '320px',
    maxWidth: '450px',
    background: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.15)',
    zIndex: 2147483646,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    color: '#ffffff',
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  title: {
    fontSize: '14px',
    fontWeight: '600',
  },
  closeButton: {
    background: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
  },
  actions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
    padding: '12px',
  },
  actionButton: {
    padding: '10px 16px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    color: '#1e293b',
    transition: 'all 0.2s',
  },
  actionButtonActive: {
    background: '#e0e7ff',
    borderColor: '#6366f1',
    color: '#6366f1',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '24px',
    color: '#64748b',
    fontSize: '14px',
  },
  result: {
    padding: '12px',
  },
  resultText: {
    padding: '12px',
    background: '#f8fafc',
    borderRadius: '8px',
    fontSize: '14px',
    lineHeight: '1.6',
    color: '#1e293b',
    marginBottom: '12px',
    maxHeight: '200px',
    overflow: 'auto',
  },
  resultActions: {
    display: 'flex',
    gap: '8px',
  },
  acceptButton: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 16px',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  cancelButton: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 16px',
    background: '#f8fafc',
    color: '#64748b',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  originalText: {
    padding: '12px',
    borderTop: '1px solid #e2e8f0',
    background: '#fafafa',
  },
  originalLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '6px',
  },
  originalContent: {
    fontSize: '13px',
    color: '#475569',
    lineHeight: '1.5',
  },
};

// Export for use in content script
export default InlineAssistant;

// Helper class to manage inline assistant instances
export class InlineAssistantManager {
  private currentRoot: HTMLElement | null = null;
  private currentReactRoot: ReactDOM.Root | null = null;
  private targetElement: HTMLElement | null = null;

  constructor() {
    this.setupListeners();
  }

  private setupListeners() {
    // Listen for text selection
    document.addEventListener('mouseup', (e) => {
      setTimeout(() => this.handleTextSelection(e), 100);
    });

    // Listen for keyboard selection
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Meta') {
        setTimeout(() => this.handleTextSelection(e), 100);
      }
    });

    // Close on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    });
  }

  private handleTextSelection(e: MouseEvent | KeyboardEvent) {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();

    // Only show assistant if text is selected and it's in an editable field
    if (!selectedText || selectedText.length < 3) {
      return;
    }

    const target = e.target as HTMLElement;
    const isEditable =
      target.isContentEditable ||
      target.tagName === 'TEXTAREA' ||
      (target.tagName === 'INPUT' && ['text', 'email', 'search', 'url'].includes((target as HTMLInputElement).type));

    if (!isEditable) {
      return;
    }

    // Calculate position
    const range = selection?.getRangeAt(0);
    const rect = range?.getBoundingClientRect();

    if (!rect) return;

    // Position below selection, or above if not enough space
    let x = rect.left + window.scrollX;
    let y = rect.bottom + window.scrollY + 8;

    // Adjust if too close to bottom
    if (y + 300 > window.innerHeight + window.scrollY) {
      y = rect.top + window.scrollY - 308;
    }

    // Adjust if too close to right
    if (x + 450 > window.innerWidth) {
      x = window.innerWidth - 450 - 20;
    }

    this.targetElement = target;
    this.show(selectedText, target, { x, y });
  }

  private show(selectedText: string, targetElement: HTMLElement, position: { x: number; y: number }) {
    // Close existing instance
    this.close();

    // Create container
    this.currentRoot = document.createElement('div');
    this.currentRoot.id = 'intella-inline-assistant-root';
    document.body.appendChild(this.currentRoot);

    // Render component
    this.currentReactRoot = ReactDOM.createRoot(this.currentRoot);
    this.currentReactRoot.render(
      <InlineAssistant
        selectedText={selectedText}
        targetElement={targetElement}
        position={position}
        onClose={() => this.close()}
        onReplace={(newText) => this.replaceText(newText)}
      />
    );
  }

  private replaceText(newText: string) {
    if (!this.targetElement) return;

    const target = this.targetElement as HTMLInputElement | HTMLTextAreaElement;

    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
      // For input/textarea elements
      const start = target.selectionStart || 0;
      const end = target.selectionEnd || 0;
      const text = target.value;

      target.value = text.slice(0, start) + newText + text.slice(end);

      // Set cursor position after replaced text
      const newCursorPos = start + newText.length;
      target.setSelectionRange(newCursorPos, newCursorPos);

      // Trigger input event
      target.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (target.isContentEditable) {
      // For contentEditable elements
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(newText));
        
        // Move cursor to end of inserted text
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);

        // Trigger input event
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }

  close() {
    if (this.currentReactRoot) {
      this.currentReactRoot.unmount();
      this.currentReactRoot = null;
    }

    if (this.currentRoot) {
      this.currentRoot.remove();
      this.currentRoot = null;
    }

    this.targetElement = null;
  }
}

