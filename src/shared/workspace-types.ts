export interface Workspace {
  path: string;
  name: string;
}

export interface Session {
  id: string;
  title: string;
  workspacePath: string;
  createdAt?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
