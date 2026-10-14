import { describe, expect, it } from "vitest";
import { approvableReasons, approveBody, claimItemText, exchangeShipmentError, rejectReasonError, serverTime } from "./claims";

describe("approveBody", () => {
  it("고객 사유 그대로면 사유를 싣지 않는다", () => {
    expect(approveBody("CHANGE_OF_MIND", "CHANGE_OF_MIND")).toBe("{}");
  });
  it("바꾸면 바꾼 사유를 싣는다 — 하자로 바꾸면 반품 배송비를 빼지 않는다", () => {
    expect(approveBody("CHANGE_OF_MIND", "DEFECTIVE")).toBe('{"reasonType":"DEFECTIVE"}');
  });
});

describe("rejectReasonError", () => {
  it("비우면 거부", () => {
    expect(rejectReasonError("  ")).toBe("반려 사유를 입력하세요. 고객 화면에 그대로 보입니다.");
  });
  it("300자 초과면 거부", () => {
    expect(rejectReasonError("가".repeat(301))).toBe("반려 사유는 300자 이내로 입력하세요.");
  });
  it("정상", () => {
    expect(rejectReasonError("사용 흔적이 있습니다")).toBeNull();
  });
});

describe("serverTime", () => {
  it("오프셋 없는 시각은 UTC", () => {
    expect(serverTime("2026-10-14T03:00:00").toISOString()).toBe("2026-10-14T03:00:00.000Z");
  });
});

describe("교환 (gateway#320)", () => {
  it("교환은 판매자 사유로만 승인한다", () => {
    expect(approvableReasons("EXCHANGE")).toEqual(["DEFECTIVE", "WRONG_ITEM"]);
    expect(approvableReasons("RETURN")).toContain("CHANGE_OF_MIND");
  });
  it("교환 옵션을 함께 보여 준다", () => {
    expect(claimItemText({ orderItemId: 1, productName: "티셔츠", quantity: 1, exchangeOptionLabel: "블랙 / L" })).toBe("티셔츠 × 1 → 블랙 / L");
    expect(claimItemText({ orderItemId: 1, productName: "티셔츠", quantity: 2 })).toBe("티셔츠 × 2");
  });
  it("교환 운송장은 둘 다 필수", () => {
    expect(exchangeShipmentError("CJ대한통운", " ")).toBe("택배사와 운송장 번호를 입력하세요.");
    expect(exchangeShipmentError("CJ대한통운", "123")).toBeNull();
  });
});
