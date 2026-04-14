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
});
