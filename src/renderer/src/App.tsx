import { useCallback, useEffect, useMemo, useState } from 'react';
import type { StartupState } from '@shared/startup-state';
import { startupState } from '@shared/startup-state';
import { readSystemTheme } from './lib/theme';
import type { Theme } from './lib/theme';
import { AuthenticatedShell } from './components/AuthenticatedShell';
import { CheckingScreen } from './components/CheckingScreen';
import { InstallGate } from './components/InstallGate';
import { LoginScreen } from './components/LoginScreen';

const App = () => {
  const [state, setState] = useState<StartupState>(startupState('checking'));
  const [loginOutput, setLoginOutput] = useState<string>('');
  const [theme, setTheme] = useState<Theme>(() => readSystemTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (event: MediaQueryListEvent) => {
      setTheme(event.matches ? 'dark' : 'light');
    };

    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  const refreshState = useCallback(async () => {
    setState(startupState('checking'));
    const next = await window.agentflow.getStartupState();
    setState(next);
  }, []);

  useEffect(() => {
    void refreshState();
  }, []);

  const onLogout = useCallback(async () => {
    setState(startupState('checking'));
    const next = await window.agentflow.logout();
    setState(next);
  }, []);

  const content = useMemo(() => {
    if (state.kind === 'checking') {
      return <CheckingScreen />;
    }

    if (state.kind === 'copilot_missing') {
      return <InstallGate onOpenInstall={window.agentflow.openCopilotInstallInstructions} />;
    }

    if (state.kind === 'authenticated') {
      return <AuthenticatedShell onLogout={onLogout} />;
    }

    return (
      <LoginScreen
        state={state}
        loginOutput={loginOutput}
        onLogin={async () => {
          setLoginOutput('');
          setState(startupState('authenticating'));
          const unlisten = window.agentflow.onLoginOutput((chunk) => {
            setLoginOutput(prev => prev + chunk);
          });
          try {
            const result = await window.agentflow.loginWithGitHub();
            setState(result.state);
          } finally {
            unlisten();
            setLoginOutput('');
          }
        }}
        onEnterpriseLogin={async (host) => {
          setLoginOutput('');
          setState(startupState('authenticating'));
          const unlisten = window.agentflow.onLoginOutput((chunk) => {
            setLoginOutput(prev => prev + chunk);
          });
          try {
            const result = await window.agentflow.loginWithGitHubEnterprise(host);
            setState(result.state);
          } finally {
            unlisten();
            setLoginOutput('');
          }
        }}
        onRetry={refreshState}
      />
    );
  }, [state, loginOutput, refreshState, onLogout]);

  return content;
};

export default App;
