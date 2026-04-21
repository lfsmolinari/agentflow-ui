import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, Session, Workspace } from '../../../shared/workspace-types';

export type WorkspaceViewState =
  | { kind: 'no_workspace' }
  | { kind: 'workspace_selected'; workspace: Workspace; sessions: Session[] | null; sessionError: boolean; startingChat: boolean }
  | { kind: 'active_session'; workspace: Workspace; session: Session; sessions: Session[]; messages: ChatMessage[]; streamingChunk: string; streaming: boolean };

export function useWorkspaceState() {
  const [viewState, setViewState] = useState<WorkspaceViewState>({ kind: 'no_workspace' });
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const generationRef = useRef(0);

  const selectWorkspace = async (workspace: Workspace) => {
    const gen = ++generationRef.current;
    setViewState({ kind: 'workspace_selected', workspace, sessions: null, sessionError: false, startingChat: false });
    try {
      const sessions = await window.agentflow.listSessions(workspace.path);
      if (generationRef.current !== gen) return;
      setViewState({ kind: 'workspace_selected', workspace, sessions, sessionError: false, startingChat: false });
    } catch {
      if (generationRef.current !== gen) return;
      setViewState({ kind: 'workspace_selected', workspace, sessions: [], sessionError: true, startingChat: false });
    }
  };

  useEffect(() => {
    window.agentflow.listWorkspaces().then(list => {
      setWorkspaces(list);
      if (list.length > 0) {
        void selectWorkspace(list[0]);
      }
    }).catch(() => {});
  }, []);

  const addWorkspace = async () => {
    const newList = await window.agentflow.addWorkspace();
    setWorkspaces(newList);
    if (newList.length > 0) {
      const added = newList[newList.length - 1];
      await selectWorkspace(added);
    }
  };

  const startNewChat = async () => {
    if (viewState.kind === 'no_workspace') return;
    const workspace = viewState.workspace;
    const currentSessions =
      viewState.kind === 'workspace_selected'
        ? (viewState.sessions ?? [])
        : viewState.kind === 'active_session'
        ? viewState.sessions
        : [];
    const gen = ++generationRef.current;

    // Show loading state; preserve existing sessions list if available
    setViewState(prev => {
      if (prev.kind === 'workspace_selected') {
        return { ...prev, startingChat: true };
      }
      if (prev.kind === 'active_session') {
        return { kind: 'workspace_selected', workspace: prev.workspace, sessions: prev.sessions, sessionError: false, startingChat: true };
      }
      return prev;
    });

    try {
      const result = await window.agentflow.startNewSession(workspace.path);
      if (generationRef.current !== gen) return;
      if ('error' in result) {
        console.error('[startNewChat] session error:', result.error);
        const sessions = await window.agentflow.listSessions(workspace.path).catch(() => [] as Session[]);
        if (generationRef.current === gen) {
          setViewState({ kind: 'workspace_selected', workspace, sessions, sessionError: false, startingChat: false });
        }
        return;
      }
      // Optimistically prepend the new session; don't wait on SDK write-behind
      const optimisticSessions = [result.session, ...currentSessions];
      setViewState({ kind: 'active_session', workspace, session: result.session, sessions: optimisticSessions, messages: [], streamingChunk: '', streaming: false });

      // Background reconciliation: refresh only if the count changed
      window.agentflow.listSessions(workspace.path).then(refreshed => {
        if (generationRef.current !== gen) return;
        setViewState(prev => {
          if (prev.kind !== 'active_session') return prev;
          if (refreshed.length !== prev.sessions.length) {
            return { ...prev, sessions: refreshed };
          }
          return prev;
        });
      }).catch(() => {});
    } catch (err) {
      console.error('[startNewChat] unexpected error:', err);
      if (generationRef.current !== gen) return;
      setViewState({ kind: 'workspace_selected', workspace, sessions: null, sessionError: false, startingChat: false });
    }
  };

  const openSession = async (session: Session) => {
    if (viewState.kind === 'no_workspace') return;
    const workspace = 'workspace' in viewState ? viewState.workspace : null;
    if (!workspace) return;
    const existingSessions =
      viewState.kind === 'workspace_selected'
        ? (viewState.sessions ?? [])
        : viewState.kind === 'active_session'
        ? viewState.sessions
        : [];
    const gen = ++generationRef.current;
    try {
      const messages = await window.agentflow.openSession(session.id);
      if (generationRef.current !== gen) return;
      setViewState({ kind: 'active_session', workspace, session, sessions: existingSessions, messages, streamingChunk: '', streaming: false });
    } catch {
      // surface error in future iteration
    }
  };

  const sendMessage = async (text: string) => {
    if (viewState.kind !== 'active_session') return;
    const { session } = viewState;

    setViewState(prev =>
      prev.kind === 'active_session'
        ? { ...prev, messages: [...prev.messages, { role: 'user', content: text }], streaming: true, streamingChunk: '' }
        : prev
    );

    const unlisten = window.agentflow.onChatOutput((chunk) => {
      setViewState(prev =>
        prev.kind === 'active_session'
          ? { ...prev, streamingChunk: prev.streamingChunk + chunk }
          : prev
      );
    });

    try {
      const result = await window.agentflow.sendMessage(session.id, text);
      if (result && 'error' in result) {
        setViewState(prev =>
          prev.kind === 'active_session'
            ? { ...prev, streaming: false, streamingChunk: '', messages: [...prev.messages, { role: 'assistant' as const, content: `Error: ${result.error}` }] }
            : prev
        );
      } else {
        setViewState(prev => {
          if (prev.kind !== 'active_session') return prev;
          const finalMessages = prev.streamingChunk
            ? [...prev.messages, { role: 'assistant' as const, content: prev.streamingChunk }]
            : prev.messages;
          return { ...prev, messages: finalMessages, streamingChunk: '', streaming: false };
        });
      }
    } catch {
      setViewState(prev =>
        prev.kind === 'active_session'
          ? { ...prev, streaming: false, streamingChunk: '' }
          : prev
      );
    } finally {
      unlisten();
    }
  };

  return { viewState, workspaces, selectWorkspace, addWorkspace, startNewChat, openSession, sendMessage };
}
