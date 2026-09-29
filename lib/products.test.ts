import { describe, expect, it } from "vitest";
import { PRODUCT_STATUSES, PRODUCT_STATUS_LABEL, parseProductStatusFilter } from "./products";

describe("parseProductStatusFilter", () => {
  it("빈 값과 ALL 은 전체(null)", () => {
    expect(parseProductStatusFilter(null)).toBeNull();
    expect(parseProductStatusFilter("")).toBeNull();
    expect(parseProductStatusFilter("ALL")).toBeNull();
  });

  it("알려진 상태는 그대로", () => {
    expect(parseProductStatusFilter("DRAFT")).toBe("DRAFT");
    expect(parseProductStatusFilter("LIVE")).toBe("LIVE");
  });

  it("모르는 값은 invalid — product.api 로 넘기면 500 이 난다", () => {
    expect(parseProductStatusFilter("live")).toBe("invalid");
    expect(parseProductStatusFilter("IN_REVIEW")).toBe("invalid");
  });
});

describe("PRODUCT_STATUS_LABEL", () => {
  it("모든 상태에 라벨이 있다", () => {
    for (const s of PRODUCT_STATUSES) expect(PRODUCT_STATUS_LABEL[s].label).toBeTruthy();
  });
});
