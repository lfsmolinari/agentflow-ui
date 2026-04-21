import { useEffect, useRef, useState } from 'react';

interface ChatComposerProps {
  onSend: (text: string) => void;
  isStreaming: boolean;
}

export const ChatComposer = ({ onSend, isStreaming }: ChatComposerProps) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const isEmpty = value.trim() === '';
  const isDisabled = isStreaming || isEmpty;

  const submit = () => {
    if (isDisabled) return;
    onSend(value.trim());
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="w-full border-t border-border bg-panel px-6 py-4">
      <div>
        <div className={`flex flex-col rounded-panel border border-border bg-panelElevated p-3 ${isStreaming ? 'opacity-60' : ''}`}>
          <span className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-textMuted">
            Strategist
          </span>
          <div className="flex gap-3">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              rows={3}
              placeholder="Send a message…"
              className="flex-1 resize-none bg-transparent text-sm text-text placeholder-textMuted outline-none disabled:cursor-not-allowed"
            />
            <button
              type="button"
              onClick={submit}
              disabled={isDisabled}
              className="focus-ring self-end rounded-control bg-accent px-4 py-2 text-sm font-semibold text-accentFg disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
