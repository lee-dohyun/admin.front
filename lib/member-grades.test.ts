import { describe, expect, it } from "vitest";
import {
  MANUAL_REASON_PREFIX,
  MAX_REASON_LENGTH,
  formatAmount,
  gradeErrorMessage,
  isManualAdjustment,
  toPolicyBody,
  lockText,
  toAdjustBody,
  todayInKst,
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

const unlocked = { code: "GENERAL", lock: { locked: false, until: null } };
const adjust = (over: Partial<Parameters<typeof validateAdjust>[1]> = {}) => ({
  gradeCode: "VIP",
  reason: "사유",
  lockedUntil: "",
  ...over,
});
const TODAY = "2026-10-02";

describe("validateAdjust", () => {
  it("정상 입력은 통과 — 유지 기한은 비워도 된다(해제할 때까지 고정)", () => {
    expect(validateAdjust(unlocked, adjust(), TODAY)).toBeNull();
    expect(validateAdjust(unlocked, adjust({ lockedUntil: "2026-12-31" }), TODAY)).toBeNull();
  });
  it("사유 필수", () => expect(validateAdjust(unlocked, adjust({ reason: "  " }), TODAY)).not.toBeNull());
  it(`사유는 ${MAX_REASON_LENGTH}자 이하`, () => {
    expect(validateAdjust(unlocked, adjust({ reason: "가".repeat(MAX_REASON_LENGTH + 1) }), TODAY)).not.toBeNull();
    expect(validateAdjust(unlocked, adjust({ reason: "가".repeat(MAX_REASON_LENGTH) }), TODAY)).toBeNull();
  });
  it("등급을 골라야 한다", () => expect(validateAdjust(unlocked, adjust({ gradeCode: "" }), TODAY)).not.toBeNull());
  it("유지 기한은 오늘부터 — 오늘은 되고 어제는 안 된다(서버 LOCK_UNTIL_IN_PAST 와 같은 규칙)", () => {
    expect(validateAdjust(unlocked, adjust({ lockedUntil: TODAY }), TODAY)).toBeNull();
    expect(validateAdjust(unlocked, adjust({ lockedUntil: "2026-10-01" }), TODAY)).not.toBeNull();
    expect(validateAdjust(unlocked, adjust({ lockedUntil: "10/31" }), TODAY)).not.toBeNull();
  });
  it("지금 등급 그대로여도 고정 상태가 달라지면 된다 — 기한만 바꾸는 조정", () => {
    const vipUntilNov = { code: "VIP", lock: { locked: true, until: "2026-11-30" } };
    expect(validateAdjust(vipUntilNov, adjust({ lockedUntil: "2026-12-31" }), TODAY)).toBeNull();
    expect(validateAdjust(vipUntilNov, adjust({ lockedUntil: "" }), TODAY)).toBeNull();
    // 고정되지 않은 현재 등급을 그대로 고정하는 것도 된다(구매로 얻은 등급을 유지시키는 경우).
    expect(validateAdjust({ code: "VIP", lock: { locked: false, until: null } }, adjust(), TODAY)).toBeNull();
  });
  it("등급도 고정 상태도 같으면 막는다 — 서버도 아무것도 바꾸지 않는다", () => {
    const vipUntilNov = { code: "VIP", lock: { locked: true, until: "2026-11-30" } };
    expect(validateAdjust(vipUntilNov, adjust({ lockedUntil: "2026-11-30" }), TODAY)).not.toBeNull();
    const vipForever = { code: "VIP", lock: { locked: true, until: null } };
    expect(validateAdjust(vipForever, adjust({ lockedUntil: "" }), TODAY)).not.toBeNull();
  });
});

describe("toAdjustBody", () => {
  it("사유는 다듬고, 비운 유지 기한은 null 로 보낸다(서버가 '해제할 때까지'로 읽는다)", () => {
    expect(toAdjustBody(adjust({ reason: "  CS 보상 " }))).toEqual({ gradeCode: "VIP", reason: "CS 보상", lockedUntil: null });
    expect(toAdjustBody(adjust({ lockedUntil: "2026-12-31" })).lockedUntil).toBe("2026-12-31");
  });
});

describe("lockText", () => {
  it("고정 상태를 화면 말로 바꾼다", () => {
    expect(lockText({ locked: true, until: "2026-12-31" })).toBe("고정됨 — 2026-12-31까지 유지");
    expect(lockText({ locked: true, until: null })).toBe("고정됨 — 해제할 때까지 유지");
    expect(lockText({ locked: false, until: null })).toBe("고정 아님 — 매월 1일 정기 재산정 대상");
  });
});

describe("todayInKst", () => {
  it("유지 기한의 '오늘'은 KST 날짜다 — UTC 로는 아직 전날인 새벽에도 KST 날짜를 준다", () => {
    expect(todayInKst(new Date("2026-10-01T15:30:00Z"))).toBe("2026-10-02");
    expect(todayInKst(new Date("2026-10-02T14:59:59Z"))).toBe("2026-10-02");
    expect(todayInKst(new Date("2026-10-02T15:00:00Z"))).toBe("2026-10-03");
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
  it("지난 유지 기한 거부는 화면 문구로 바꾼다", () => {
    expect(gradeErrorMessage(400, "LOCK_UNTIL_IN_PAST", "실패")).toContain("유지 기한");
  });
});

describe("formatAmount", () => {
  it("천 단위 구분 + 원, 없으면 -", () => {
    expect(formatAmount(300000)).toBe("300,000원");
    expect(formatAmount(null)).toBe("-");
  });
});
