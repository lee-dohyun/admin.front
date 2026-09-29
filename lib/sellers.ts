/**
 * 판매자 입점 관리(admin.front#23) 순수 로직 — 단위 테스트 대상.
 * 상태·전이는 product.api SellerService.VALID_TRANSITIONS 와 같아야 한다(서버가 최종 판단 — 어긋나면 409).
 * 용어: 도메인은 SELLER, staff 역할 PARTNER 는 "입점 담당 직원"(gateway Wiki Glossary §8-1).
 */
export const SELLER_STATUSES = ["DRAFT", "SUBMITTED", "IN_REVIEW", "ACTIVE", "SUSPENDED", "TERMINATED", "REJECTED"] as const;
export type SellerStatus = (typeof SELLER_STATUSES)[number];

type TagVariant = "accent" | "success" | "warning" | "danger" | "neutral" | "outline";

export const SELLER_STATUS_LABEL: Record<SellerStatus, { label: string; variant: TagVariant }> = {
  DRAFT: { label: "작성 중", variant: "outline" },
  SUBMITTED: { label: "심사 요청", variant: "accent" },
  IN_REVIEW: { label: "심사 중", variant: "warning" },
  ACTIVE: { label: "운영 중", variant: "success" },
  SUSPENDED: { label: "정지", variant: "danger" },
  TERMINATED: { label: "해지", variant: "neutral" },
  REJECTED: { label: "반려", variant: "danger" },
};

/** 상태별로 누를 수 있는 버튼. 전이 대상과 라벨 — 서버 VALID_TRANSITIONS 와 1:1. */
export const SELLER_ACTIONS: Record<SellerStatus, { to: SellerStatus; label: string; needsReason: boolean; danger?: boolean }[]> = {
  DRAFT: [{ to: "SUBMITTED", label: "심사 요청", needsReason: false }],
  SUBMITTED: [{ to: "IN_REVIEW", label: "심사 시작", needsReason: false }],
  IN_REVIEW: [
    { to: "ACTIVE", label: "승인", needsReason: false },
    { to: "REJECTED", label: "반려", needsReason: true, danger: true },
  ],
  REJECTED: [{ to: "SUBMITTED", label: "보완 후 재심사 요청", needsReason: false }],
  ACTIVE: [{ to: "SUSPENDED", label: "판매 정지", needsReason: true, danger: true }],
  SUSPENDED: [
    { to: "ACTIVE", label: "정지 해제", needsReason: false },
    { to: "TERMINATED", label: "계약 해지", needsReason: true, danger: true },
  ],
  TERMINATED: [],
};

/**
 * 반려·정지 사유 코드. 입점 반려 사유는 정형화돼 있다(리서치 2026-08-21: 상호·주소 불일치 / 인증 누락 /
 * 서류 발급일 초과 / 채널명 불일치). 코드로 남겨야 나중에 통계·자동 검사로 쓸 수 있다.
 * message 는 판매자에게 전달될 문구 미리보기다 — 사유를 고르는 순간 보여 준다(#23 설계 메모).
 */
export const REASON_CODES: { code: string; label: string; message: string }[] = [
  { code: "BIZ_INFO_MISMATCH", label: "상호·주소 불일치", message: "사업자등록증의 상호 또는 주소가 입력하신 정보와 다릅니다. 등록증과 같게 수정해 주세요." },
  { code: "DOCUMENT_MISSING", label: "필수 서류 누락", message: "입점 심사에 필요한 서류가 제출되지 않았습니다. 누락된 서류를 제출해 주세요." },
  { code: "DOCUMENT_EXPIRED", label: "서류 발급일 초과", message: "제출하신 서류의 발급일이 오래되었습니다. 최근 3개월 이내 발급본으로 다시 제출해 주세요." },
  { code: "MAIL_ORDER_NO_INVALID", label: "통신판매업 신고 확인 불가", message: "통신판매업 신고번호를 확인할 수 없습니다. 신고증과 같은 번호로 입력해 주세요." },
  { code: "POLICY_VIOLATION", label: "운영 정책 위반", message: "판매 운영 정책 위반으로 조치되었습니다. 상세 사유는 담당자 메모를 확인해 주세요." },
  { code: "OTHER", label: "기타", message: "담당자 메모를 확인해 주세요." },
];

export function allowedActions(status: string): { to: SellerStatus; label: string; needsReason: boolean; danger?: boolean }[] {
  return (SELLER_ACTIONS as Record<string, (typeof SELLER_ACTIONS)[SellerStatus]>)[status] ?? [];
}

/** 전이 요청 검증 — 허용 목록에 없거나, 사유가 필요한데 코드가 없으면 사람이 읽을 사유. 통과면 null. */
export function validateTransition(from: string, to: string, reasonCode: string | null | undefined): string | null {
  const action = allowedActions(from).find((a) => a.to === to);
  if (!action) return `현재 상태(${from})에서 ${to}(으)로 바꿀 수 없습니다.`;
  if (action.needsReason && !REASON_CODES.some((r) => r.code === reasonCode)) return "사유를 선택해 주세요.";
  return null;
}

/** 목록 필터 값 검증. product.api 는 모르는 값에 SellerStatus.valueOf 가 터져 500 — 앞에서 거른다. */
export function parseSellerStatusFilter(raw: string | null): SellerStatus | null | "invalid" {
  if (raw === null || raw === "" || raw === "ALL") return null;
  return (SELLER_STATUSES as readonly string[]).includes(raw) ? (raw as SellerStatus) : "invalid";
}

/**
 * 파트너 초기 비밀번호 — partner realm 정책(길이 10 이상)을 넉넉히 넘기는 18자.
 * 헷갈리는 글자(0/O, 1/l/I)는 뺀다: 담당자가 판매자에게 전달해야 하는 값이다.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
// 256 을 알파벳 길이로 나눈 나머지만큼의 상위 바이트는 버린다(rejection sampling) — 앞쪽 글자 편중 제거.
const LIMIT = 256 - (256 % ALPHABET.length);
export function generateInitialPassword(random: (n: number) => Uint8Array, length = 18): string {
  let out = "";
  while (out.length < length) {
    for (const b of random(length * 2)) {
      if (b < LIMIT && out.length < length) out += ALPHABET[b % ALPHABET.length];
    }
  }
  return out;
}

/**
 * 경로의 판매자 id 검증. 검증 없이 URL 에 끼우면 `..%2Fproducts%2F5` 같은 값이 staff 토큰을 다른
 * product.api 경로로 보낸다 — 판매자 메뉴 권한이 경계 역할을 못 한다(리뷰 지적). 양의 정수만 허용.
 */
export function parseSellerId(raw: string): number | null {
  return /^[1-9]\d{0,17}$/.test(raw) ? Number(raw) : null;
}
