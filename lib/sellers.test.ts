import { describe, expect, it } from "vitest";
import {
  REASON_CODES,
  SELLER_ACTIONS,
  SELLER_STATUSES,
  allowedActions,
  generateInitialPassword,
  parseSellerId,
  parseSellerStatusFilter,
  validateTransition,
} from "./sellers";

describe("전이 규칙 — product.api SellerService.VALID_TRANSITIONS 와 같아야 한다", () => {
  const server: Record<string, string[]> = {
    DRAFT: ["SUBMITTED"],
    SUBMITTED: ["IN_REVIEW"],
    IN_REVIEW: ["ACTIVE", "REJECTED"],
    REJECTED: ["SUBMITTED"],
    ACTIVE: ["SUSPENDED"],
    SUSPENDED: ["ACTIVE", "TERMINATED"],
    TERMINATED: [],
  };
  it.each(SELLER_STATUSES)("%s", (s) => {
    expect(SELLER_ACTIONS[s].map((a) => a.to).sort()).toEqual([...server[s]].sort());
  });
});

describe("validateTransition", () => {
  it("허용된 전이는 통과", () => expect(validateTransition("IN_REVIEW", "ACTIVE", null)).toBeNull());
  it("허용되지 않은 전이 거부", () => expect(validateTransition("DRAFT", "ACTIVE", null)).not.toBeNull());
  it("반려·정지·해지는 사유 코드 필수", () => {
    expect(validateTransition("IN_REVIEW", "REJECTED", null)).not.toBeNull();
    expect(validateTransition("IN_REVIEW", "REJECTED", "NOPE")).not.toBeNull();
    expect(validateTransition("IN_REVIEW", "REJECTED", REASON_CODES[0].code)).toBeNull();
    expect(validateTransition("ACTIVE", "SUSPENDED", null)).not.toBeNull();
  });
  it("모르는 상태에서는 아무 버튼도 없다", () => expect(allowedActions("WHATEVER")).toEqual([]));
});

describe("parseSellerStatusFilter", () => {
  it("빈 값·ALL 은 전체, 모르는 값은 invalid", () => {
    expect(parseSellerStatusFilter(null)).toBeNull();
    expect(parseSellerStatusFilter("ALL")).toBeNull();
    expect(parseSellerStatusFilter("IN_REVIEW")).toBe("IN_REVIEW");
    expect(parseSellerStatusFilter("in_review")).toBe("invalid");
  });
});

describe("generateInitialPassword", () => {
  it("18자, 헷갈리는 글자 없음, 정책(10자 이상) 충족", () => {
    const pw = generateInitialPassword((n) => Uint8Array.from({ length: n }, (_, i) => i * 37));
    expect(pw).toHaveLength(18);
    expect(pw).not.toMatch(/[0O1lI]/);
  });
});

describe("parseSellerId", () => {
  it("양의 정수만", () => {
    expect(parseSellerId("12")).toBe(12);
    expect(parseSellerId("0")).toBeNull();
    expect(parseSellerId("..%2Fproducts%2F5")).toBeNull();
    expect(parseSellerId("../products/5")).toBeNull();
    expect(parseSellerId("1a")).toBeNull();
  });
});

describe("generateInitialPassword rejection sampling", () => {
  it("버린 바이트가 있어도 길이를 채운다", () => {
    let call = 0;
    const pw = generateInitialPassword((n) => Uint8Array.from({ length: n }, (_, i) => (call++ % 2 === 0 ? 255 : i)));
    expect(pw).toHaveLength(18);
  });
});
