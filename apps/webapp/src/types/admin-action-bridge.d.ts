type AdminActionBridge = {
  normalizeActionRequestId: (value: unknown) => string;
  createActionRequestId: (prefix?: string) => string;
  resolveActionRequestId: (explicitActionRequestId?: unknown, pendingActionRequestId?: unknown, prefix?: string) => string;
  isRetriableAdminFetchError: (err: unknown) => boolean;
};

declare global {
  interface Window {
    __AKR_ADMIN_ACTION__?: AdminActionBridge;
  }
}

export {};
