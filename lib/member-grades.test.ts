import { describe, expect, it } from "vitest";
import {
  MANUAL_REASON_PREFIX,
  MAX_REASON_LENGTH,
  formatAmount,
  gradeErrorMessage,
  isManualAdjustment,
  toPolicyBody,
  validateAdjust,
  validatePolicyForm,
} from "./member-grades";

const form = (over: Partial<Parameters<typeof validatePolicyForm>[0]> = {}) => ({
  code: "VVIP",
  name: "VVIP",
  discountRate: "15",
  minSpendAmount: "10000000",
  sortOrder: "5",
  ...over,
});

describe("validatePolicyForm — auth.api AdminMemberGradeService 의 검증과 같아야 한다", () => {
  it("정상 입력은 통과", () => {
    expect(validatePolicyForm(form(), { creating: true, isDefault: false })).toBeNull();
  });
  it("코드는 영문 대문자로 시작하는 대문자·숫자·밑줄 20자 이하 (생성 때만 검사)", () => {
    expect(validatePolicyForm(form({ code: "vip2" }), { creating: true, isDefault: false })).not.toBeNull();
    expect(validatePolicyForm(form({ code: "A".repeat(21) }), { creating: true, isDefault: false })).not.toBeNull();
    expect(validatePolicyForm(form({ code: "" }), { creating: false, isDefault: false })).toBeNull();
  });
  it("이름은 1~50자", () => {
    expect(validatePolicyForm(form({ name: " " }), { creating: true, isDefault: false })).not.toBeNull();
    expect(validatePolicyForm(form({ name: "가".repeat(51) }), { creating: true, isDefault: false })).not.toBeNull();
  });
  it("할인율은 0~100, 소수 둘째 자리까지", () => {
    for (const bad of ["", "-1", "100.01", "1.234", "abc"]) {
      expect(validatePolicyForm(form({ discountRate: bad }), { creating: true, isDefault: false })).not.toBeNull();
    }
    expect(validatePolicyForm(form({ discountRate: "2.5" }), { creating: true, isDefault: false })).toBeNull();
  });
  it("기준액은 비우거나 0 이상", () => {
    expect(validatePolicyForm(form({ minSpendAmount: "" }), { creating: true, isDefault: false })).toBeNull();
    expect(validatePolicyForm(form({ minSpendAmount: "-1" }), { creating: true, isDefault: false })).not.toBeNull();
  });
  it("기본 등급의 기준액은 0원만", () => {
    expect(validatePolicyForm(form({ minSpendAmount: "1000" }), { creating: false, isDefault: true })).not.toBeNull();
    expect(validatePolicyForm(form({ minSpendAmount: "" }), { creating: false, isDefault: true })).not.toBeNull();
    expect(validatePolicyForm(form({ minSpendAmount: "0" }), { creating: false, isDefault: true })).toBeNull();
  });
  it("정렬 순서는 0 이상의 정수", () => {
    expect(validatePolicyForm(form({ sortOrder: "1.5" }), { creating: true, isDefault: false })).not.toBeNull();
    expect(validatePolicyForm(form({ sortOrder: "-1" }), { creating: true, isDefault: false })).not.toBeNull();
  });
});

describe("toPolicyBody", () => {
  it("빈 기준액은 null(정기 재산정 대상 아님)로 보낸다", () => {
    expect(toPolicyBody(form({ minSpendAmount: " " }))).toEqual({
      name: "VVIP",
      discountRate: 15,
      minSpendAmount: null,
      sortOrder: 5,
    });
  });
  it("숫자로 바꿔 보낸다", () => {
    expect(toPolicyBody(form({ discountRate: "2.5", minSpendAmount: "300000" }))).toMatchObject({
      discountRate: 2.5,
      minSpendAmount: 300000,
    });
  });
});

describe("validateAdjust", () => {
  it("사유 필수", () => expect(validateAdjust("GENERAL", "VIP", "  ")).not.toBeNull());
  it(`사유는 ${MAX_REASON_LENGTH}자 이하`, () => {
    expect(validateAdjust("GENERAL", "VIP", "가".repeat(MAX_REASON_LENGTH + 1))).not.toBeNull();
    expect(validateAdjust("GENERAL", "VIP", "가".repeat(MAX_REASON_LENGTH))).toBeNull();
  });
  it("등급을 골라야 한다", () => expect(validateAdjust("GENERAL", "", "사유")).not.toBeNull());
  it("지금 등급과 같으면 막는다 — 서버도 아무것도 바꾸지 않는다", () => {
    expect(validateAdjust("VIP", "VIP", "사유")).not.toBeNull();
  });
});

describe("isManualAdjustment", () => {
  it("auth.api 가 남기는 접두어로 수동 조정을 알아본다", () => {
    expect(isManualAdjustment(`${MANUAL_REASON_PREFIX}CS 보상`)).toBe(true);
    expect(isManualAdjustment("6개월 구매확정액 0원 기준 재산정 (VIP -> GENERAL)")).toBe(false);
    expect(isManualAdjustment(null)).toBe(false);
  });
});

describe("gradeErrorMessage", () => {
  it("403 은 필요한 역할을 알려 준다", () => {
    expect(gradeErrorMessage(403, undefined, "실패")).toContain("MEMBER_MANAGER");
  });
  it("서버 사유 코드는 화면 문구로 바꾼다(코드를 그대로 보이지 않는다)", () => {
    const msg = gradeErrorMessage(409, "GRADE_IN_USE", "실패");
    expect(msg).not.toMatch(/GRADE_IN_USE/);
    expect(msg).toContain("삭제할 수 없습니다");
  });
  it("모르는 코드는 기본 문구", () => expect(gradeErrorMessage(500, "WHATEVER", "실패")).toBe("실패"));
});

describe("formatAmount", () => {
  it("천 단위 구분 + 원, 없으면 -", () => {
    expect(formatAmount(300000)).toBe("300,000원");
    expect(formatAmount(null)).toBe("-");
  });
});
