/**
 * 회원 등급 관리(gateway#80) 순수 로직 — 단위 테스트 대상.
 *
 * 검증 규칙은 auth.api `AdminMemberGradeService` 와 같아야 한다(서버가 최종 판단 — 어긋나면 400/409).
 * 여기서 먼저 거르는 이유는 사용자가 어느 칸이 틀렸는지 화면 말로 알 수 있게 하기 위해서다.
 */
export type GradePolicy = {
  code: string;
  name: string;
  /** 퍼센트 값(5 = 5%) */
  discountRate: number;
  /** null 이면 정기 재산정 대상이 아니다(수동 조정으로만 부여된다) */
  minSpendAmount: number | null;
  sortOrder: number;
  /** 가입 시 부여되는 기본 등급. 화면에서 바꿀 수 없다 */
  isDefault: boolean;
};

export type GradePolicyForm = {
  code: string;
  name: string;
  discountRate: string;
  minSpendAmount: string;
  sortOrder: string;
};

export type GradeHistoryItem = { gradeCode: string; gradeName: string; reason: string | null; assignedAt: string };
export type MemberGradeDetail = {
  keycloakUserId: string;
  grade: { code: string; name: string; discountRate: number };
  history: GradeHistoryItem[];
};

/** auth.api 가 수동 조정 이력에 붙이는 접두어(`AdminMemberGradeService.MANUAL_REASON_PREFIX`). */
export const MANUAL_REASON_PREFIX = "수동 조정: ";
/** 이력 사유 컬럼이 100자라 접두어를 뺀 사유는 80자까지다(auth.api 와 같은 값). */
export const MAX_REASON_LENGTH = 80;

const CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,19}$/;
const DECIMAL_2 = /^\d+(\.\d{1,2})?$/;

export function toPolicyForm(policy: GradePolicy): GradePolicyForm {
  return {
    code: policy.code,
    name: policy.name,
    discountRate: String(policy.discountRate),
    minSpendAmount: policy.minSpendAmount === null ? "" : String(policy.minSpendAmount),
    sortOrder: String(policy.sortOrder),
  };
}

/** 등급 정책 입력 검증 — 문제가 있으면 사람이 읽을 문구, 통과면 null. */
export function validatePolicyForm(
  form: GradePolicyForm,
  opts: { creating: boolean; isDefault: boolean }
): string | null {
  if (opts.creating && !CODE_PATTERN.test(form.code.trim())) {
    return "등급 코드는 영문 대문자로 시작하는 대문자·숫자·밑줄 20자 이하로 입력해 주세요.";
  }
  const name = form.name.trim();
  if (!name || name.length > 50) return "등급 이름은 1~50자로 입력해 주세요.";

  const rate = form.discountRate.trim();
  if (!DECIMAL_2.test(rate) || Number(rate) > 100) {
    return "할인율은 0~100 사이 숫자로, 소수 둘째 자리까지 입력해 주세요.";
  }

  const amount = form.minSpendAmount.trim();
  if (amount && !DECIMAL_2.test(amount)) return "기준액은 0 이상의 숫자로 입력해 주세요.";
  // 기본 등급의 기준액이 0원이 아니면 정기 재산정이 그 미만 회원을 어느 등급에도 넣지 못한다.
  if (opts.isDefault && (!amount || Number(amount) !== 0)) return "기본 등급의 기준액은 0원이어야 합니다.";

  if (!/^\d+$/.test(form.sortOrder.trim())) return "정렬 순서는 0 이상의 정수로 입력해 주세요.";
  return null;
}

/** 수정(PUT) 본문. 생성(POST)은 여기에 code 를 더한다. */
export function toPolicyBody(form: GradePolicyForm) {
  const amount = form.minSpendAmount.trim();
  return {
    name: form.name.trim(),
    discountRate: Number(form.discountRate.trim()),
    minSpendAmount: amount ? Number(amount) : null,
    sortOrder: Number(form.sortOrder.trim()),
  };
}

/** 수동 조정 입력 검증 — 문제가 있으면 사람이 읽을 문구, 통과면 null. */
export function validateAdjust(currentCode: string, gradeCode: string, reason: string): string | null {
  if (!gradeCode) return "바꿀 등급을 선택해 주세요.";
  if (gradeCode === currentCode) return "지금 등급과 같습니다. 다른 등급을 선택해 주세요.";
  const trimmed = reason.trim();
  if (!trimmed) return "조정 사유를 입력해 주세요.";
  if (trimmed.length > MAX_REASON_LENGTH) return `조정 사유는 ${MAX_REASON_LENGTH}자 이하로 입력해 주세요.`;
  return null;
}

export function isManualAdjustment(reason: string | null | undefined): boolean {
  return !!reason && reason.startsWith(MANUAL_REASON_PREFIX);
}

/** auth.api 가 돌려주는 거부 사유 코드 → 화면 문구. 코드를 그대로 보여 주지 않는다. */
const ERROR_MESSAGES: Record<string, string> = {
  GRADE_CODE_CONFLICT: "같은 코드의 등급이 이미 있습니다.",
  THRESHOLD_CONFLICT: "기준액이 같은 다른 등급이 있습니다. 기준액을 다르게 입력해 주세요.",
  DEFAULT_GRADE_THRESHOLD_FIXED: "기본 등급의 기준액은 0원이어야 합니다.",
  DEFAULT_GRADE_UNDELETABLE: "기본 등급은 삭제할 수 없습니다.",
  GRADE_IN_USE: "이 등급인 회원이 있거나 등급 이력에 남아 있어 삭제할 수 없습니다.",
  GRADE_NOT_FOUND: "등급을 찾을 수 없습니다. 화면을 새로고침해 주세요.",
  MEMBER_NOT_FOUND: "등급 정보가 없는 계정입니다(가입이 끝나지 않은 계정).",
  REASON_REQUIRED: "조정 사유를 입력해 주세요.",
  REASON_TOO_LONG: `조정 사유는 ${MAX_REASON_LENGTH}자 이하로 입력해 주세요.`,
};

export function gradeErrorMessage(status: number, errorCode: string | undefined, fallback: string): string {
  if (status === 403) return "권한이 없습니다. MEMBER_MANAGER 또는 SYSTEM_ADMIN 역할이 필요합니다.";
  return (errorCode && ERROR_MESSAGES[errorCode]) || fallback;
}

/** 실패 응답에서 사유 코드를 꺼내 화면 문구로 바꾼다. 본문이 JSON 이 아니어도 던지지 않는다. */
export async function gradeErrorFromResponse(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return gradeErrorMessage(res.status, body?.error, fallback);
}

export function formatAmount(amount: number | null): string {
  return amount === null ? "-" : `${amount.toLocaleString("ko-KR")}원`;
}
