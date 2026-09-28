/**
 * 검수 큐(admin.front#47) 순수 로직 — 네트워크·Next 에 의존하지 않는다(단위 테스트 대상).
 * 상태 값은 product.api SubmissionStatus 와 같아야 한다.
 */
export const SUBMISSION_STATUSES = [
  "SUBMITTED",
  "VALIDATING",
  "NEEDS_FIX",
  "IN_REVIEW",
  "LIVE",
  "PAUSED",
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number] | "DRAFT";

export const STATUS_LABEL: Record<string, { label: string; variant: "accent" | "success" | "warning" | "danger" | "neutral" | "outline" }> = {
  DRAFT: { label: "미제출", variant: "outline" },
  SUBMITTED: { label: "제출됨", variant: "accent" },
  VALIDATING: { label: "자동 검사 중", variant: "accent" },
  NEEDS_FIX: { label: "보완 요청", variant: "danger" },
  IN_REVIEW: { label: "심사 대기", variant: "warning" },
  LIVE: { label: "승인", variant: "success" },
  PAUSED: { label: "중지", variant: "neutral" },
};

/**
 * 목록 필터 값 검증. product.api 는 모르는 값에 `SubmissionStatus.valueOf` 가 터져 500 을 낸다 —
 * 그 앞에서 허용 목록으로 거른다. 빈 값은 "전체".
 */
export function parseStatusFilter(raw: string | null): string | null | "invalid" {
  if (raw === null || raw === "" || raw === "ALL") return null;
  return (SUBMISSION_STATUSES as readonly string[]).includes(raw) ? raw : "invalid";
}

/** 심사 결정은 IN_REVIEW 에서만 가능하다(product.api 전이 규칙). 화면은 미리 막고 서버가 최종 판단(409). */
export function canDecide(status: string): boolean {
  return status === "IN_REVIEW";
}

export const REVIEW_NOTE_MAX = 500;

/**
 * 보완 요청 사유는 **필수**다 — 파트너는 이 문장만 보고 무엇을 고칠지 안다(partner.front 가 폼 위에 표시).
 * product.api 는 사유가 없으면 "심사자 보완 요청" 한 줄만 남기므로 여기서 막는다. 승인 메모는 선택.
 */
export function validateReviewNote(
  decision: "approve" | "request-fix",
  raw: unknown,
): { ok: true; note: string | null } | { ok: false; error: string } {
  const note = typeof raw === "string" ? raw.trim() : "";
  if (note.length > REVIEW_NOTE_MAX) return { ok: false, error: `사유는 ${REVIEW_NOTE_MAX}자 이하로 적어 주세요.` };
  if (decision === "request-fix" && !note) return { ok: false, error: "보완 요청 사유를 입력해 주세요." };
  return { ok: true, note: note || null };
}

export function isValidId(raw: string): boolean {
  return /^[1-9]\d{0,18}$/.test(raw);
}
