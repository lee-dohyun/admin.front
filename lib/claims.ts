/** 고객 취소·반품 신청 검토(gateway#320) 화면의 표시 규칙. 금액은 order.api 가 확정한 값을 그대로 보여 준다. */

export type ClaimItem = { orderItemId: number; productName: string; quantity: number };

export type AdminClaim = {
  id: number;
  orderId: number;
  type: string;
  status: string;
  reasonType: string;
  reasonDetail: string | null;
  items: ClaimItem[];
  itemAmount: number | null;
  discountShare: number | null;
  shippingRefund: number | null;
  returnShippingFee: number | null;
  refundAmount: number | null;
  rejectReason: string | null;
  createdAt: string;
  decidedAt: string | null;
};

export const claimTypeLabel: Record<string, string> = { CANCEL: "취소", RETURN: "반품" };

export const claimReasonLabel: Record<string, string> = {
  CHANGE_OF_MIND: "단순 변심",
  DEFECTIVE: "상품 불량·파손",
  WRONG_ITEM: "오배송",
};

export const claimStatusTabs: { status: string; label: string }[] = [
  { status: "REQUESTED", label: "처리 대기" },
  { status: "COMPLETED", label: "완료" },
  { status: "REJECTED", label: "반려" },
];

/** 고객이 고른 사유와 다르게 승인할 때만 사유를 싣는다(같으면 빈 본문 — order.api 가 고객 사유를 쓴다). */
export function approveBody(customerReason: string, chosenReason: string): string {
  return chosenReason && chosenReason !== customerReason ? JSON.stringify({ reasonType: chosenReason }) : "{}";
}

/** 반려 사유는 고객에게 그대로 보인다 — 비우거나 300자를 넘기면 보내지 않는다. */
export function rejectReasonError(reason: string): string | null {
  const trimmed = reason.trim();
  if (!trimmed) return "반려 사유를 입력하세요. 고객 화면에 그대로 보입니다.";
  if (trimmed.length > 300) return "반려 사유는 300자 이내로 입력하세요.";
  return null;
}

/** order.api 는 시각을 UTC 로, 오프셋 없이 준다 — 오프셋이 없으면 UTC 로 읽는다. */
export function serverTime(s: string): Date {
  return new Date(/([zZ]|[+-]\d{2}:?\d{2})$/.test(s) ? s : `${s}Z`);
}
