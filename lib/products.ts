/**
 * 관리자 상품 목록(admin.front#50) 순수 로직 — 네트워크·Next 에 의존하지 않는다(단위 테스트 대상).
 * 상태 값은 product.api ProductStatus 와 같아야 한다.
 */
export const PRODUCT_STATUSES = ["DRAFT", "LIVE", "PAUSED", "ARCHIVED"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_STATUS_LABEL: Record<
  ProductStatus,
  { label: string; variant: "accent" | "success" | "warning" | "danger" | "neutral" | "outline" }
> = {
  DRAFT: { label: "미공개", variant: "outline" },
  LIVE: { label: "판매 중", variant: "success" },
  PAUSED: { label: "판매 중지", variant: "warning" },
  ARCHIVED: { label: "보관", variant: "neutral" },
};

/**
 * 목록 필터 값 검증. product.api 는 모르는 값에 `ProductStatus.valueOf` 가 터져 500 을 낸다 —
 * 그 앞에서 허용 목록으로 거른다. 빈 값·"ALL" 은 전체(null).
 */
export function parseProductStatusFilter(raw: string | null): ProductStatus | null | "invalid" {
  if (raw === null || raw === "" || raw === "ALL") return null;
  return (PRODUCT_STATUSES as readonly string[]).includes(raw) ? (raw as ProductStatus) : "invalid";
}
