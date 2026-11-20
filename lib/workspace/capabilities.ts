export type WorkspaceCapabilities = { creator: boolean; merchant: boolean }

export function workspaceCapabilities(metadata: Record<string, unknown> | undefined, hasStore: boolean): WorkspaceCapabilities {
  return {
    creator: metadata?.creator_enabled === true,
    merchant: hasStore && metadata?.merchant_enabled !== false,
  }
}
