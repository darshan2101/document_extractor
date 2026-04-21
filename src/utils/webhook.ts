import { createHmac } from "node:crypto";

export const signPayload = (payload: string, secret: string): string =>
  `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;

export const deliverWebhook = async (
  url: string,
  body: unknown,
  secret: string
): Promise<void> => {
  const payload = JSON.stringify(body);
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (secret) {
    headers["X-SMDE-Signature"] = signPayload(payload, secret);
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: payload,
    signal: AbortSignal.timeout(10_000)
  });

  if (!response.ok) {
    throw new Error(`Webhook delivery failed: ${response.status} ${response.statusText}`);
  }
};
