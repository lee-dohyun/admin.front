/** 관리자 주문 관리(gateway#329) 화면의 표시 규칙. 금액·상태는 order.api 가 확정한 값을 그대로 보여 준다. */
import { serverTime, type AdminClaim } from "./claims";


export type AdminOrder = {
  id: number;
  customerEmail: string | null;
  ordererName: string;
  ordererPhone: string;
  status: string;
  totalPrice: number;
  itemCount: number;
  createdAt: string;
};

export type AdminOrderPage = {
  content: AdminOrder[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type OrderFilter = {
  status: string;
  from: string;
  to: string;
  q: string;
  page: number;
};

export type Shipment = {
  carrier: string;
  trackingNumber: string;
  status: string;
  shippedAt: string | null;
  deliveredAt: string | null;
};

export type Refund = {
  amount: number;
  reason: string | null;
  status: string;
  refundedAt: string | null;
};

export type OrderDetail = {
  id: number;
  ordererName: string;
  ordererPhone: string;
  recipientName: string | null;
  recipientPhone: string | null;
  zipCode: string | null;
  address1: string | null;
  address2: string | null;
  shippingAddress: string;
  status: string;
  totalPrice: number;
  subtotalPrice: number;
  discountAmount: number;
  shippingFee: number;
  shipment: Shipment | null;
  gradeCode: string | null;
  items: { orderItemId: number | null; productName: string; price: number; quantity: number; claimedQuantity: number | null }[];
  createdAt: string;
  paidAt: string | null;
  claims: AdminClaim[];
  refund: Refund | null;
};

export const orderStatusLabel: Record<string, string> = {
  CREATED: "결제 대기",
  PAID: "결제 완료",
  PREPARING: "배송 준비",
  SHIPPED: "배송중",
  DELIVERED: "배송완료",
  CANCELLED: "주문취소",
  REFUNDED: "환불완료",
};

export const orderStatusVariant: Record<string, "warning" | "success" | "accent" | "neutral" | "danger"> = {
  CREATED: "warning",
  PAID: "success",
  PREPARING: "accent",
  SHIPPED: "accent",
  DELIVERED: "success",
  CANCELLED: "danger",
  REFUNDED: "danger",
};

/**
 * 목록 응답 → 페이지. order.api 가 페이지 객체로 바뀌기 전(배열)의 응답도 받는다 — 두 저장소가 따로 배포되는
 * 사이에 목록이 비지 않게 하려는 것뿐이고, order.api 배포 뒤에는 항상 페이지 객체다.
 */
export function toOrderPage(data: AdminOrderPage | AdminOrder[]): AdminOrderPage {
  if (Array.isArray(data)) {
    return { content: data, page: 0, size: data.length, totalElements: data.length, totalPages: 1 };
  }
  return data;
}

export const emptyFilter: OrderFilter = { status: "", from: "", to: "", q: "", page: 0 };

/** 화면 필터 → order.api 쿼리. 빈 조건은 싣지 않는다. 주소창에도 같은 쿼리를 쓴다(새로고침·뒤로 가기에서 유지). */
export function orderQuery(f: OrderFilter): string {
  const params = new URLSearchParams();
  if (f.status) params.set("status", f.status);
  if (f.from) params.set("from", f.from);
  if (f.to) params.set("to", f.to);
  if (f.q.trim()) params.set("q", f.q.trim());
  if (f.page > 0) params.set("page", String(f.page));
  return params.toString();
}

/** 주소창 쿼리 → 화면 필터. 모르는 상태값·음수 페이지는 버린다. */
export function parseOrderQuery(search: URLSearchParams): OrderFilter {
  const status = search.get("status") ?? "";
  const page = Number(search.get("page") ?? "0");
  return {
    status: status in orderStatusLabel ? status : "",
    from: search.get("from") ?? "",
    to: search.get("to") ?? "",
    q: search.get("q") ?? "",
    page: Number.isInteger(page) && page > 0 ? page : 0,
  };
}

/** 기간이 거꾸로면 order.api 는 빈 목록을 준다 — 조회 전에 알려 준다. */
export function filterError(f: OrderFilter): string | null {
  if (f.from && f.to && f.from > f.to) return "시작일이 종료일보다 늦습니다.";
  return null;
}

/** order.api refundOrder 와 같은 규칙 — 결제 이후이고 아직 취소·환불되지 않은 주문만 환불할 수 있다. */
export function canRefund(status: string): boolean {
  return status !== "CREATED" && status !== "CANCELLED" && status !== "REFUNDED";
}

/** 환불 사유는 환불 안내 메일로 고객에게 간다(refunds.reason VARCHAR(300)). */
export function refundReasonError(reason: string): string | null {
  const trimmed = reason.trim();
  if (!trimmed) return "환불 사유를 입력하세요. 고객에게 보내는 환불 안내 메일에 들어갑니다.";
  if (trimmed.length > 300) return "환불 사유는 300자 이내로 입력하세요.";
  return null;
}

/**
 * 이미 상품별 취소·반품으로 돌려준 금액을 뺀, 이번 전체 환불로 나갈 금액. order.api refundOrder 와 같은 계산이다
 * (실제 금액은 order.api 가 다시 계산해 응답으로 준다 — 이 값은 확인 창 안내용).
 */
export function remainingRefund(order: Pick<OrderDetail, "totalPrice" | "claims">): number {
  const refunded = order.claims.reduce((sum, c) => sum + (c.refundAmount ?? 0), 0);
  return Math.max(order.totalPrice - refunded, 0);
}

export type TimelineEvent = { at: Date; label: string };

/**
 * 진행 기록 — 주문·결제·출고·배송완료·환불·클레임 시각을 시간순으로 모은다.
 * order.api 에는 상태 변경 이력 테이블이 없다. 여기 보이는 건 각 행이 가진 시각뿐이고, 누가 바꿨는지는 남지 않는다
 * (감사 기록은 gateway#330).
 */
export function orderTimeline(order: OrderDetail): TimelineEvent[] {
  const events: TimelineEvent[] = [{ at: serverTime(order.createdAt), label: "주문 접수" }];
  if (order.paidAt) events.push({ at: serverTime(order.paidAt), label: "결제 완료" });
  if (order.shipment?.shippedAt) {
    events.push({
      at: serverTime(order.shipment.shippedAt),
      label: `출고 · ${order.shipment.carrier} ${order.shipment.trackingNumber}`,
    });
  }
  if (order.shipment?.deliveredAt) events.push({ at: serverTime(order.shipment.deliveredAt), label: "배송 완료" });
  for (const c of order.claims) {
    events.push({ at: serverTime(c.createdAt), label: `신청 #${c.id} 접수` });
    if (c.decidedAt) events.push({ at: serverTime(c.decidedAt), label: `신청 #${c.id} ${claimDecision(c.status)}` });
  }
  if (order.refund?.refundedAt) {
    events.push({ at: serverTime(order.refund.refundedAt), label: `전체 환불 ${won(order.refund.amount)}` });
  }
  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
}

function claimDecision(status: string): string {
  if (status === "REJECTED") return "반려";
  if (status === "APPROVED") return "승인";
  return "완료";
}

export function won(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}
