const GENERIC_ERROR_DETAIL = "An unexpected server error occurred.";

export function getSafeErrorDetail(error: unknown, productionDetail = GENERIC_ERROR_DETAIL): string {
  if (process.env.NODE_ENV !== "production") {
    return error instanceof Error ? error.message : "Unknown error";
  }

  return productionDetail;
}

export function getSafeProviderDetail(detail: string, productionDetail: string): string | null {
  if (process.env.NODE_ENV !== "production") {
    return detail || productionDetail;
  }

  return productionDetail;
}
