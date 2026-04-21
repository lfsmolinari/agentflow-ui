import { useEffect, useRef } from 'react';
import type { ChatMessage as ChatMessageType } from '../../../shared/workspace-types';
import { ChatMessage } from './ChatMessage';

interface ChatTranscriptProps {
  messages: ChatMessageType[];
  streamingChunk?: string;
  isStreaming?: boolean;
}

export const ChatTranscript = ({ messages, streamingChunk, isStreaming = false }: ChatTranscriptProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingChunk, isStreaming]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="flex flex-col gap-4">
        {messages.map((message, index) => (
          <ChatMessage key={index} message={message} />
        ))}
        {streamingChunk !== undefined && streamingChunk !== '' && (
          <ChatMessage
            message={{ role: 'assistant', content: streamingChunk }}
            isStreaming={true}
          />
        )}
        {isStreaming && (!streamingChunk || streamingChunk === '') && (
          <div className="flex items-center gap-2 self-start text-textMuted text-sm">
            <span className="animate-pulse">●</span>
            <span className="animate-pulse" style={{ animationDelay: '0.15s' }}>●</span>
            <span className="animate-pulse" style={{ animationDelay: '0.3s' }}>●</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
