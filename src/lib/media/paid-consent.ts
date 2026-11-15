export type PaidConsentInput = {
  authorizePaid: unknown;
  acceptedQuoteUsd: unknown;
  quoteUsd: number;
  status: string;
  generationStatus: string;
};

export type PaidConsentDecision =
  | { allowPaid: false; error?: string }
  | { allowPaid: true };

const PRICE_TOLERANCE = 0.0005;

export function paidConsentDecision(input: PaidConsentInput): PaidConsentDecision {
  if (input.authorizePaid !== true) return { allowPaid: false };
  if (input.status !== "confirmed") {
    return { allowPaid: false, error: "Confirm the brief and concept before generating. No paid call was made." };
  }
  if (input.generationStatus === "generating") {
    return { allowPaid: false, error: "Generation is already running. No duplicate paid call was made." };
  }
  if (typeof input.acceptedQuoteUsd !== "number" || !Number.isFinite(input.acceptedQuoteUsd)) {
    return {
      allowPaid: false,
      error: "Paid generation requires the price shown in the app. No paid call was made.",
    };
  }
  if (Math.abs(input.acceptedQuoteUsd - input.quoteUsd) > PRICE_TOLERANCE) {
    return {
      allowPaid: false,
      error: "That price does not match the current estimate. Review it and confirm again. No paid call was made.",
    };
  }
  return { allowPaid: true };
}

export function chatCannotAuthorizePaid(args?: unknown): { ok: false; error: string } {
  void args;
  return {
    ok: false,
    error: "Review the campaign and media quote, then confirm generation in the app. Chat cannot authorize paid media.",
  };
}
