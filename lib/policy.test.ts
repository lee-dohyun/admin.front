import { describe, expect, it } from "vitest";
import { EMPTY_POLICY, fromResponse, toRequest, validatePolicy, type PolicyForm } from "./policy";

const form = (patch: Partial<PolicyForm>): PolicyForm => ({ ...EMPTY_POLICY, ...patch });

describe("validatePolicy — 서버(ProductPolicyService)와 같은 모순 규칙", () => {
  it("빈 폼은 통과 — 임시저장은 빈 칸을 허용한다", () => expect(validatePolicy(EMPTY_POLICY)).toBeNull());
  it("유료인데 배송비 없음", () => expect(validatePolicy(form({ shippingFeeType: "PAID" }))).not.toBeNull());
  it("조건부인데 기준 금액 없음", () =>
    expect(validatePolicy(form({ shippingFeeType: "CONDITIONAL", shippingFee: "3000" }))).not.toBeNull());
  it("KC 대상인데 번호 없음", () => expect(validatePolicy(form({ kcCertType: "SAFETY_CERT" }))).not.toBeNull());
  it("판매 종료가 시작 이전", () =>
    expect(validatePolicy(form({ saleStartAt: "2026-10-02T00:00", saleEndAt: "2026-10-01T00:00" }))).not.toBeNull());
  it("음수 금액·0 수량 거부", () => {
    expect(validatePolicy(form({ returnShippingFee: "-1" }))).not.toBeNull();
    expect(validatePolicy(form({ maxPurchaseQuantity: "0" }))).not.toBeNull();
  });
  it("정상 조합 통과", () =>
    expect(
      validatePolicy(form({ taxType: "TAXABLE", shippingFeeType: "CONDITIONAL", shippingFee: "3000", freeShippingThreshold: "50000", kcCertType: "NONE" })),
    ).toBeNull());
});

describe("toRequest / fromResponse", () => {
  it("빈 칸은 null, 숫자·시각 변환", () => {
    const r = toRequest(form({ taxType: "TAXABLE", shippingFee: "3000", saleStartAt: "2026-10-01T09:00", returnAddress: "  " }));
    expect(r.taxType).toBe("TAXABLE");
    expect(r.shippingFee).toBe(3000);
    expect(r.saleStartAt).toBe("2026-10-01T09:00:00");
    expect(r.returnAddress).toBeNull();
    expect(r.maxPurchaseQuantity).toBeNull();
  });
  it("서버 응답을 폼으로 — null 은 빈 칸, 시각은 분까지", () => {
    const f = fromResponse({
      taxType: "TAX_FREE", kcCertType: null, kcCertNumber: null, shippingFeeType: "FREE", shippingFee: null,
      freeShippingThreshold: null, shippingLeadDays: 2, jejuExtraFee: null, islandExtraFee: null,
      returnShippingFee: 3000, exchangeShippingFee: 6000, returnAddress: "서울", saleStartAt: "2026-10-01T09:00:00",
      saleEndAt: null, maxPurchaseQuantity: 5,
    });
    expect(f.taxType).toBe("TAX_FREE");
    expect(f.shippingFee).toBe("");
    expect(f.shippingLeadDays).toBe("2");
    expect(f.saleStartAt).toBe("2026-10-01T09:00");
    expect(f.maxPurchaseQuantity).toBe("5");
  });
});
