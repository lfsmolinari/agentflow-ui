import type { ChatMessage as ChatMessageType } from '../../../shared/workspace-types';

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

export const ChatMessage = ({ message, isStreaming = false }: ChatMessageProps) => {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end self-end" data-role="user">
        <div className="max-w-[70%] rounded-2xl rounded-tr-sm bg-accent px-4 py-2.5 text-sm text-accentFg">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start self-start" data-role="assistant">
      <div className="max-w-[80%] px-1 py-2 text-sm text-text">
        <p className="whitespace-pre-wrap leading-relaxed">
          {message.content}
          {isStreaming && (
            <span
              aria-hidden="true"
              className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-accent align-middle"
            />
          )}
        </p>
      </div>
    </div>
  );
};
