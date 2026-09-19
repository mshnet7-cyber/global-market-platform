export type IntegrationState = "live" | "integration_ready" | "not_configured" | "error";

export type ProviderCapability =
  | "ocr"
  | "ai_copilot"
  | "whatsapp"
  | "payments"
  | "e_invoicing"
  | "developer_api";

export type ProviderStatus = {
  capability: ProviderCapability;
  state: IntegrationState;
  provider: string | null;
  reason?: string;
};
