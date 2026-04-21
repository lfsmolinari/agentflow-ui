# SDK Auth & Event Type Findings (T11)

## CopilotClientOptions — auth fields

```typescript
export interface CopilotClientOptions {
    /**
     * GitHub token to use for authentication.
     * When provided, the token is passed to the CLI server via environment variable.
     * This takes priority over other authentication methods.
     */
    githubToken?: string;
    
    /**
     * Whether to use the logged-in user for authentication.
     * When true, the CLI server will attempt to use stored OAuth tokens or gh CLI auth.
     * When false, only explicit tokens (githubToken or environment variables) are used.
     * @default true (but defaults to false when githubToken is provided)
     */
    useLoggedInUser?: boolean;
    
    // ... other options
}
```

**Key behaviors:**
- `githubToken` takes priority over all other auth methods
- When `githubToken` is provided, `useLoggedInUser` defaults to `false`
- When `useLoggedInUser` is `true`, the CLI server attempts to use:
  1. Stored OAuth tokens
  2. `gh` CLI authentication

## OAuth / device flow

**No OAuth or device flow API exists in the SDK.**

The SDK does not expose methods for:
- Initiating OAuth flows
- Device code exchange
- Token refresh
- Any authentication lifecycle management

The only authentication-related API surface is:

```typescript
class CopilotClient {
    /**
     * Get current authentication status
     */
    getAuthStatus(): Promise<GetAuthStatusResponse>;
}

interface GetAuthStatusResponse {
    /** Whether the user is authenticated */
    isAuthenticated: boolean;
    /** Authentication type */
    authType?: "user" | "env" | "gh-cli" | "hmac" | "api-key" | "token";
    /** GitHub host URL */
    host?: string;
    /** User login name */
    login?: string;
    /** Human-readable status message */
    statusMessage?: string;
}
```

This is a **read-only** status check. It does not initiate authentication.

## Token lifecycle

**How to supply a token:**

Pass `githubToken` to the `CopilotClient` constructor:

```typescript
const client = new CopilotClient({
    githubToken: 'gho_...',
    useLoggedInUser: false  // optional, defaults to false when token provided
});
```

The SDK internally passes this token to the CLI server via environment variable.

**Refresh mechanism:**

- **None.** The SDK does not refresh tokens.
- To update the token, the app must create a new `CopilotClient` instance with the new token.
- The old client should be stopped (`await client.stop()`) before creating a new one.

**Expiry handling:**

- The SDK does not track token expiry.
- When a token expires, API calls will fail with authentication errors.
- The app is responsible for detecting expiry (via error responses) and re-authenticating.

## Logout / revocation

**No logout or revocation API in the SDK.**

The SDK does not provide methods to:
- Revoke OAuth tokens
- Clear stored credentials
- Log out

**To "log out" from the app:**

1. Stop the client: `await client.stop()`
2. Clear the token from your app's storage
3. (Optional) If using GitHub's OAuth, call `DELETE https://api.github.com/applications/{client_id}/token` to revoke the token server-side (this is outside the SDK)

**Important:** Stopping the client only releases resources. It does **not** revoke tokens or clear credentials stored by the CLI server (e.g., from `gh` CLI auth or `useLoggedInUser: true`).

## SessionEvent field names (for T14)

### user.message

```typescript
{
    type: "user.message";
    data: {
        /**
         * The user's message text as displayed in the timeline
         */
        content: string;
        
        /**
         * Transformed version of the message sent to the model, with XML wrapping, 
         * timestamps, and other augmentations for prompt caching
         */
        transformedContent?: string;
        
        attachments?: Array<...>;
        source?: string;
        agentMode?: "interactive" | "plan" | "autopilot" | "shell";
        interactionId?: string;
    };
}
```

**Key field:** `data.content`

### assistant.message

```typescript
{
    type: "assistant.message";
    data: {
        /**
         * Unique identifier for this assistant message
         */
        messageId: string;
        
        /**
         * The assistant's text response content
         */
        content: string;
        
        toolRequests?: Array<...>;
        reasoningOpaque?: string;
        reasoningText?: string;
        encryptedContent?: string;
        phase?: string;
        outputTokens?: number;
        interactionId?: string;
        requestId?: string;
        parentToolCallId?: string;
    };
}
```

**Key field:** `data.content`

### assistant.message_delta

```typescript
{
    ephemeral: true;
    type: "assistant.message_delta";
    data: {
        /**
         * Message ID this delta belongs to, matching the corresponding assistant.message event
         */
        messageId: string;
        
        /**
         * Incremental text chunk to append to the message content
         */
        deltaContent: string;
        
        parentToolCallId?: string;
    };
}
```

**Key field:** `data.deltaContent`

**Important notes:**
- `assistant.message_delta` events are ephemeral (not persisted)
- Each delta references a parent `messageId` from a prior `assistant.message` event
- To build the full message during streaming, accumulate `deltaContent` values

### Other event metadata (all types)

All session events share this base structure:

```typescript
{
    id: string;                // UUID v4
    timestamp: string;         // ISO 8601
    parentId: string | null;   // linked chain
    ephemeral?: boolean;       // true = not persisted
    type: string;
    data: { ... };
}
```

## Recommendation for T12

**Use explicit token-based authentication:**

1. **Do not rely on `useLoggedInUser`** for the web app. It depends on CLI-stored credentials (OAuth tokens or `gh` CLI), which are inappropriate for a browser context.

2. **Pass `githubToken` explicitly** to `CopilotClient`:
   ```typescript
   const client = new CopilotClient({
       githubToken: token,
       useLoggedInUser: false
   });
   ```

3. **Handle token refresh externally:**
   - The SDK does not refresh tokens
   - The app must detect expired tokens (via error responses or proactive expiry checks)
   - When a token expires, stop the old client and create a new one with a fresh token

4. **For logout:**
   - Call `await client.stop()` to release resources
   - Clear the token from app storage
   - (Optional) Revoke the token server-side via GitHub API

5. **For T14 (empty bubbles fix):**
   - Use `event.data.content` for `user.message` and `assistant.message`
   - Use `event.data.deltaContent` for `assistant.message_delta`
   - The current bug likely stems from using the wrong field name (e.g., `event.content` instead of `event.data.content`)
