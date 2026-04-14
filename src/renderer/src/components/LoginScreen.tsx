import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import { normalizeEnterpriseHost } from '@shared/enterprise-host';
import type { StartupState } from '@shared/startup-state';

export interface LoginScreenProps {
  state: StartupState;
  loginOutput: string;
  onLogin: () => Promise<void>;
  onEnterpriseLogin: (host: string) => Promise<void>;
  onRetry: () => Promise<void>;
}

export const LoginScreen = ({ state, loginOutput, onLogin, onEnterpriseLogin, onRetry }: LoginScreenProps) => {
  const [enterpriseOpen, setEnterpriseOpen] = useState(false);
  const [host, setHost] = useState('');
  const [hostError, setHostError] = useState<string | null>(null);

  const isBusy = state.kind === 'authenticating';

  const deviceCode = loginOutput.match(/([A-Z0-9]{4}-[A-Z0-9]{4})/)?.[1] ?? null;
  const openUrl = loginOutput.match(/https:\/\/\S+/)?.[0] ?? null;
  const safeOpenUrl = openUrl?.startsWith('https://github.com/') ? openUrl : null;

  const submitEnterprise = async () => {
    const normalized = normalizeEnterpriseHost(host);
    if (!normalized.ok) {
      setHostError(normalized.error ?? 'Invalid GitHub Enterprise hostname.');
      return;
    }

    setHostError(null);
    setEnterpriseOpen(false);
    await onEnterpriseLogin(normalized.host!);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 py-10">
      <div className="w-full max-w-xl rounded-panel border border-border bg-panel px-8 py-12 shadow-shell">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-panelElevated text-lg font-semibold">
          AF
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-text">
          {state.kind === 'error' ? 'Unable to continue' : 'Sign in to continue'}
        </h1>
        <p className="mt-4 text-base leading-7 text-textSecondary">
          {state.kind === 'error'
            ? state.description
            : 'Authentication is handled through Copilot CLI. Standard GitHub is the default path, with a secondary flow for GitHub Enterprise Cloud.'}
        </p>
        <div className="mt-8 flex flex-col gap-3">
          {isBusy && deviceCode && (
            <div className="mt-6 rounded-panel border border-border bg-panelElevated px-6 py-5">
              <p className="text-sm text-textSecondary">Enter this code on GitHub to complete sign-in:</p>
              <p className="mt-2 text-3xl font-bold tracking-widest text-text">{deviceCode}</p>
              {safeOpenUrl && (
                <p className="mt-2 text-sm text-textMuted">
                  Open: <span className="font-mono text-accent">{safeOpenUrl}</span>
                </p>
              )}
            </div>
          )}
          {isBusy && !deviceCode && loginOutput && (
            <p className="mt-4 text-sm text-textMuted whitespace-pre-wrap">{loginOutput}</p>
          )}
          <button
            type="button"
            onClick={() => {
              void onLogin();
            }}
            disabled={isBusy}
            className="focus-ring rounded-control bg-accent px-5 py-3 text-sm font-semibold text-accentFg disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? 'Authenticating…' : 'Continue with GitHub'}
          </button>
          <Dialog.Root open={enterpriseOpen} onOpenChange={setEnterpriseOpen}>
            <Dialog.Trigger asChild>
              <button
                type="button"
                disabled={isBusy}
                className="focus-ring rounded-control border border-border px-5 py-3 text-sm font-medium text-textSecondary disabled:cursor-not-allowed disabled:opacity-60"
              >
                GitHub Enterprise
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 bg-black/45" />
              <Dialog.Content className="fixed left-1/2 top-1/2 w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-modal border border-border bg-panel px-6 py-6 shadow-modal focus:outline-none">
                <Dialog.Title className="text-lg font-semibold text-text">Enter enterprise host</Dialog.Title>
                <Dialog.Description className="mt-2 text-sm leading-6 text-textSecondary">
                  Enter the hostname only, for example <span className="font-medium">github.example.com</span>.
                </Dialog.Description>
                <input
                  value={host}
                  onChange={(event) => {
                    setHost(event.target.value);
                    if (hostError) {
                      setHostError(null);
                    }
                  }}
                  placeholder="github.example.com"
                  className="focus-ring mt-5 w-full rounded-control border border-border bg-panelElevated px-4 py-3 text-sm text-text placeholder:text-textMuted"
                />
                {hostError ? <p className="mt-2 text-sm text-danger">{hostError}</p> : null}
                <div className="mt-6 flex items-center justify-end gap-3">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="focus-ring rounded-control border border-border px-4 py-2 text-sm font-medium text-textSecondary"
                    >
                      Cancel
                    </button>
                  </Dialog.Close>
                  <button
                    type="button"
                    onClick={() => {
                      void submitEnterprise();
                    }}
                    className="focus-ring rounded-control bg-accent px-4 py-2 text-sm font-semibold text-accentFg"
                  >
                    Continue
                  </button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          {state.retryable ? (
            <button
              type="button"
              onClick={() => {
                void onRetry();
              }}
              className="focus-ring self-start text-sm font-medium text-textSecondary underline underline-offset-4"
            >
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
