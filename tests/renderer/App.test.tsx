import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@renderer/App';
import { startupState } from '@shared/startup-state';

declare global {
  interface Window {
    agentflow: {
      getStartupState: () => Promise<ReturnType<typeof startupState>>;
      refreshAuthState: () => Promise<ReturnType<typeof startupState>>;
      openCopilotInstallInstructions: () => Promise<void>;
      loginWithGitHub: () => Promise<{ state: ReturnType<typeof startupState> }>;
      loginWithGitHubEnterprise: (host: string) => Promise<{ state: ReturnType<typeof startupState> }>;
      onLoginOutput: (callback: (chunk: string) => void) => () => void;
    };
  }
}

describe('App', () => {
  beforeEach(() => {
    window.agentflow = {
      getStartupState: async () => startupState('copilot_missing'),
      refreshAuthState: async () => startupState('unauthenticated'),
      openCopilotInstallInstructions: async () => undefined,
      loginWithGitHub: async () => ({ state: startupState('authenticated') }),
      loginWithGitHubEnterprise: async () => ({ state: startupState('authenticated') }),
      onLoginOutput: () => () => undefined
    };
  });

  it('renders the install gate when Copilot CLI is missing', async () => {
    render(<App />);

    expect(await screen.findByText('Copilot CLI required')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Install Copilot CLI' })).toBeInTheDocument();
  });

  it('renders the authenticated shell after login succeeds', async () => {
    window.agentflow.getStartupState = async () => startupState('unauthenticated');

    render(<App />);

    const loginButton = await screen.findByRole('button', { name: 'Continue with GitHub' });
    await userEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Start a new project' })).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'Workspaces' })).toBeInTheDocument();
    expect(screen.getByText('Your workspace list will appear here once you open your first project.')).toBeInTheDocument();
    expect(screen.getByText(/Open a folder to begin using AgentFlow UI\./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start a new project' })).toBeDisabled();
    expect(screen.getByText('Workspace selection starts in Milestone 2.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText('Type your message...')).not.toBeInTheDocument();
  });

  it('submits enterprise host through the modal flow', async () => {
    let submittedHost: string | null = null;
    window.agentflow.getStartupState = async () => startupState('unauthenticated');
    window.agentflow.loginWithGitHubEnterprise = async (host) => {
      submittedHost = host;
      return { state: startupState('authenticated') };
    };

    render(<App />);

    const enterpriseButton = await screen.findByRole('button', { name: 'GitHub Enterprise' });
    await userEvent.click(enterpriseButton);

    const hostInput = await screen.findByPlaceholderText('github.example.com');
    await userEvent.type(hostInput, 'github.example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(submittedHost).toBe('github.example.com');
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Start a new project' })).toBeInTheDocument();
    });
  });

  it('keeps enterprise modal open with inline validation for a backend-rejected host shape', async () => {
    let enterpriseCalled = false;
    window.agentflow.getStartupState = async () => startupState('unauthenticated');
    window.agentflow.loginWithGitHubEnterprise = async () => {
      enterpriseCalled = true;
      return { state: startupState('authenticated') };
    };

    render(<App />);

    const enterpriseButton = await screen.findByRole('button', { name: 'GitHub Enterprise' });
    await userEvent.click(enterpriseButton);

    const hostInput = await screen.findByPlaceholderText('github.example.com');
    await userEvent.type(hostInput, 'github.example.com:8443');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      screen.getByText('Hostname may contain only letters, numbers, dots, dashes, and underscores.')
    ).toBeInTheDocument();
    expect(screen.getByText('Enter enterprise host')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Unable to continue' })).not.toBeInTheDocument();
    expect(enterpriseCalled).toBe(false);
  });

  it('shows a restart-after-installation instruction in the install gate', async () => {
    render(<App />);

    expect(
      await screen.findByText('Restart AgentFlow UI after installation to continue.')
    ).toBeInTheDocument();
  });

  it('calls openCopilotInstallInstructions exactly once when the install button is clicked', async () => {
    const openSpy = vi.fn().mockResolvedValue(undefined);
    window.agentflow.openCopilotInstallInstructions = openSpy;

    render(<App />);

    const installButton = await screen.findByRole('button', { name: 'Install Copilot CLI' });
    await userEvent.click(installButton);

    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it('renders an error heading when getStartupState returns error state', async () => {
    window.agentflow.getStartupState = async () => startupState('error');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Unable to continue' })).toBeInTheDocument();
  });

  it('renders error heading when login fails and keeps the user on the login screen', async () => {
    window.agentflow.getStartupState = async () => startupState('unauthenticated');
    window.agentflow.loginWithGitHub = async () => ({ state: startupState('error') });

    render(<App />);

    const loginButton = await screen.findByRole('button', { name: 'Continue with GitHub' });
    await userEvent.click(loginButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Unable to continue' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Start a new project' })).not.toBeInTheDocument();
  });

  it('does not render the main shell elements in the install gate', async () => {
    render(<App />);

    await screen.findByText('Copilot CLI required');

    expect(screen.queryByRole('heading', { name: 'Workspaces' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
