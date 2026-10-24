import { describe, expect, it } from "vitest";
import {
  type OrderDetail,
  canRefund,
  emptyFilter,
  filterError,
  orderQuery,
  orderTimeline,
  parseOrderQuery,
  refundReasonError,
  remainingRefund,
  toOrderPage,
} from "./orders";

describe("orderQuery / parseOrderQuery", () => {
  it("빈 조건은 싣지 않는다", () => {
    expect(orderQuery(emptyFilter)).toBe("");
  });
  it("검색어는 앞뒤 공백을 빼고, 첫 페이지는 싣지 않는다", () => {
    expect(orderQuery({ status: "PAID", from: "2026-10-01", to: "2026-10-24", q: " 김철수 ", page: 0 })).toBe(
      "status=PAID&from=2026-10-01&to=2026-10-24&q=%EA%B9%80%EC%B2%A0%EC%88%98",
    );
    expect(orderQuery({ ...emptyFilter, page: 2 })).toBe("page=2");
  });
  it("주소창 → 필터 왕복", () => {
    const f = { status: "SHIPPED", from: "2026-10-01", to: "", q: "010-1234", page: 3 };
    expect(parseOrderQuery(new URLSearchParams(orderQuery(f)))).toEqual(f);
  });
  it("모르는 상태값·음수·소수 페이지는 버린다", () => {
    expect(parseOrderQuery(new URLSearchParams("status=HACKED&page=-1"))).toEqual(emptyFilter);
    expect(parseOrderQuery(new URLSearchParams("page=1.5")).page).toBe(0);
  });
});

describe("filterError", () => {
  it("시작일이 종료일보다 늦으면 거부", () => {
    expect(filterError({ ...emptyFilter, from: "2026-10-24", to: "2026-10-01" })).toBe("시작일이 종료일보다 늦습니다.");
  });
  it("같은 날·한쪽만은 통과", () => {
    expect(filterError({ ...emptyFilter, from: "2026-10-24", to: "2026-10-24" })).toBeNull();
    expect(filterError({ ...emptyFilter, from: "2026-10-24" })).toBeNull();
  });
});

describe("toOrderPage", () => {
  it("배열(이전 응답)도 한 페이지로 받는다", () => {
    expect(toOrderPage([])).toEqual({ content: [], page: 0, size: 0, totalElements: 0, totalPages: 1 });
  });
  it("페이지 객체는 그대로", () => {
    const page = { content: [], page: 1, size: 20, totalElements: 25, totalPages: 2 };
    expect(toOrderPage(page)).toBe(page);
  });
});

describe("canRefund", () => {
  it("결제 전·취소·환불 완료는 막는다 — order.api refundOrder 와 같은 규칙", () => {
    expect(["CREATED", "CANCELLED", "REFUNDED"].map(canRefund)).toEqual([false, false, false]);
    expect(["PAID", "SHIPPED", "DELIVERED"].map(canRefund)).toEqual([true, true, true]);
  });
});

describe("refundReasonError", () => {
  it("비우면 거부", () => {
    expect(refundReasonError(" ")).toBe("환불 사유를 입력하세요. 고객에게 보내는 환불 안내 메일에 들어갑니다.");
  });
  it("300자 초과면 거부", () => {
    expect(refundReasonError("가".repeat(301))).toBe("환불 사유는 300자 이내로 입력하세요.");
  });
  it("정상", () => {
    expect(refundReasonError("품절로 전체 환불")).toBeNull();
  });
});

const baseOrder: OrderDetail = {
  id: 7,
  ordererName: "김철수",
  ordererPhone: "010-1234-5678",
  recipientName: null,
  recipientPhone: null,
  zipCode: null,
  address1: null,
  address2: null,
  shippingAddress: "서울",
  status: "PAID",
  totalPrice: 49000,
  subtotalPrice: 50000,
  discountAmount: 1000,
  shippingFee: 0,
  shipment: null,
  gradeCode: null,
  items: [],
  createdAt: "2026-10-24T01:00:00",
  paidAt: "2026-10-24T01:01:00",
  claims: [],
  refund: null,
};

describe("remainingRefund", () => {
  it("상품별로 이미 돌려준 금액을 뺀다", () => {
    const claim = { refundAmount: 19600 } as OrderDetail["claims"][number];
    expect(remainingRefund({ ...baseOrder, claims: [claim, { ...claim, refundAmount: null }] })).toBe(29400);
  });
  it("음수가 되지 않는다", () => {
    const claim = { refundAmount: 60000 } as OrderDetail["claims"][number];
    expect(remainingRefund({ ...baseOrder, claims: [claim] })).toBe(0);
  });
});

describe("orderTimeline", () => {
  it("시각순으로 모은다 — 서버 시각은 UTC", () => {
    const events = orderTimeline({
      ...baseOrder,
      status: "REFUNDED",
      shipment: {
        carrier: "CJ대한통운",
        trackingNumber: "123",
        status: "SHIPPED",
        shippedAt: "2026-10-24T03:00:00",
        deliveredAt: null,
      },
      refund: { amount: 49000, reason: "요청", status: "COMPLETED", refundedAt: "2026-10-24T02:00:00" },
    });
    expect(events.map((e) => e.label)).toEqual(["주문 접수", "결제 완료", "전체 환불 49,000원", "출고 · CJ대한통운 123"]);
    expect(events[0].at.toISOString()).toBe("2026-10-24T01:00:00.000Z");
  });
  it("신청 접수·결정을 함께 넣는다", () => {
    const claim = {
      id: 3,
      status: "REJECTED",
      createdAt: "2026-10-24T05:00:00",
      decidedAt: "2026-10-24T06:00:00",
    } as OrderDetail["claims"][number];
    expect(orderTimeline({ ...baseOrder, claims: [claim] }).map((e) => e.label)).toEqual([
      "주문 접수",
      "결제 완료",
      "신청 #3 접수",
      "신청 #3 반려",
    ]);
  });
});
