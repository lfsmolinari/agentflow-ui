import type { ChatMessage } from '../../../shared/workspace-types';
import { ChatComposer } from './ChatComposer';
import { ChatTranscript } from './ChatTranscript';

interface ChatViewProps {
  messages: ChatMessage[];
  streamingChunk: string;
  isStreaming: boolean;
  onSend: (text: string) => void;
}

export function ChatView({ messages, streamingChunk, isStreaming, onSend }: ChatViewProps) {
  return (
    <div className="flex flex-col h-full w-full">
      <ChatTranscript
        messages={messages}
        streamingChunk={streamingChunk || undefined}
        isStreaming={isStreaming}
      />
      <div className="shrink-0">
        <ChatComposer
          onSend={onSend}
          isStreaming={isStreaming}
        />
      </div>
    </div>
  );
}
