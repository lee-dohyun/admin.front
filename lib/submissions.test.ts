import { describe, expect, it } from "vitest";
import { canDecide, isValidId, parseStatusFilter, validateReviewNote, REVIEW_NOTE_MAX } from "./submissions";

describe("parseStatusFilter", () => {
  it("빈 값·ALL 은 전체", () => {
    expect(parseStatusFilter(null)).toBeNull();
    expect(parseStatusFilter("")).toBeNull();
    expect(parseStatusFilter("ALL")).toBeNull();
  });
  it("알려진 상태만 통과 — product.api valueOf 500 을 앞에서 막는다", () => {
    expect(parseStatusFilter("IN_REVIEW")).toBe("IN_REVIEW");
    expect(parseStatusFilter("in_review")).toBe("invalid");
    expect(parseStatusFilter("IN_REVIEW&x=1")).toBe("invalid");
  });
});

describe("validateReviewNote", () => {
  it("보완 요청은 사유 필수", () => {
    expect(validateReviewNote("request-fix", "  ")).toMatchObject({ ok: false });
    expect(validateReviewNote("request-fix", undefined)).toMatchObject({ ok: false });
    expect(validateReviewNote("request-fix", " 성분표 이미지 필요 ")).toEqual({ ok: true, note: "성분표 이미지 필요" });
  });
  it("승인 메모는 선택", () => {
    expect(validateReviewNote("approve", "")).toEqual({ ok: true, note: null });
  });
  it("길이 상한", () => {
    expect(validateReviewNote("approve", "x".repeat(REVIEW_NOTE_MAX + 1))).toMatchObject({ ok: false });
  });
});

describe("canDecide / isValidId", () => {
  it("심사 결정은 IN_REVIEW 에서만", () => {
    expect(canDecide("IN_REVIEW")).toBe(true);
    expect(canDecide("NEEDS_FIX")).toBe(false);
    expect(canDecide("LIVE")).toBe(false);
  });
  it("id 형식", () => {
    expect(isValidId("12")).toBe(true);
    expect(isValidId("0")).toBe(false);
    expect(isValidId("1/../x")).toBe(false);
  });
});
