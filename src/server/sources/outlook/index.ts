export {
  fetchOutlookSignalPack,
  type FetchOutlookSignalPackInput,
  type FetchOutlookSignalPackResult,
  type OutlookTokenStatus,
} from "./service";
export {
  loadOutlookConfig,
  OutlookConfigError,
  DEFAULT_SCOPES,
  type OutlookConfig,
} from "./config";
export {
  createFileTokenStore,
  TokenStoreError,
  type StoredToken,
  type TokenStore,
} from "./token-store";
export {
  createGraphClient,
  GraphAuthError,
  type GraphClient,
  type GraphMailMessage,
  type GraphCalendarEvent,
} from "./graph-client";
export {
  normalizeMailItem,
  normalizeCalendarItem,
  normalizeOutlookPayload,
  enrichMailSignalWithBodyPreview,
  cleanPreviewText,
  extractTopics,
  MAIL_BODY_PREVIEW_MAX_CHARS,
} from "./normalizer";
