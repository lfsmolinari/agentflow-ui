import { describe, expect, it } from 'vitest';
import { startupState } from '@shared/startup-state';

describe('startupState', () => {
  it('returns the authenticated default state', () => {
    const state = startupState('authenticated');

    expect(state.kind).toBe('authenticated');
    expect(state.title).toBe('Ready');
  });

  it('allows overrides for description and retryable', () => {
    const state = startupState('error', {
      description: 'Custom message.',
      retryable: false
    });

    expect(state.description).toBe('Custom message.');
    expect(state.retryable).toBe(false);
  });

  it('returns checking state with non-empty kind, title, and description', () => {
    const state = startupState('checking');
    expect(state.kind).toBe('checking');
    expect(state.title).toBeTruthy();
    expect(state.description).toBeTruthy();
  });

  it('returns copilot_missing state with non-empty kind, title, and description', () => {
    const state = startupState('copilot_missing');
    expect(state.kind).toBe('copilot_missing');
    expect(state.title).toBeTruthy();
    expect(state.description).toBeTruthy();
  });

  it('returns unauthenticated state with non-empty kind, title, and description', () => {
    const state = startupState('unauthenticated');
    expect(state.kind).toBe('unauthenticated');
    expect(state.title).toBeTruthy();
    expect(state.description).toBeTruthy();
  });

  it('returns authenticating state with non-empty kind, title, and description', () => {
    const state = startupState('authenticating');
    expect(state.kind).toBe('authenticating');
    expect(state.title).toBeTruthy();
    expect(state.description).toBeTruthy();
  });
});
