/**
 * 판매 정책 폼(product.api#79) 순수 로직 — 단위 테스트 대상.
 * partner.front/lib/policy.ts 와 같은 파일이다(admin.front#53). 규칙을 바꾸면 두 곳을 같이 고칠 것 —
 * 서버(ProductPolicyService)가 최종 판단하므로 어긋나도 잘못 저장되지는 않지만 안내 문구가 달라진다.
 * 용어·값은 gateway Wiki Glossary §8-2. 모순 검사는 product.api ProductPolicyService 와 같은 규칙으로
 * 미리 알려 줄 뿐이고, 최종 판단은 서버(400)다. "필수 항목이 비었는가"는 검수가 본다(임시저장은 빈 칸 허용).
 */
export type PolicyResponse = {
  taxType: string | null;
  kcCertType: string | null;
  kcCertNumber: string | null;
  shippingFeeType: string | null;
  shippingFee: number | null;
  freeShippingThreshold: number | null;
  shippingLeadDays: number | null;
  jejuExtraFee: number | null;
  islandExtraFee: number | null;
  returnShippingFee: number | null;
  exchangeShippingFee: number | null;
  returnAddress: string | null;
  saleStartAt: string | null;
  saleEndAt: string | null;
  maxPurchaseQuantity: number | null;
};

/** 폼 상태는 전부 문자열(입력칸 그대로). */
export type PolicyForm = { [K in keyof PolicyResponse]: string };

export const POLICY_FIELDS = [
  "taxType", "kcCertType", "kcCertNumber", "shippingFeeType", "shippingFee", "freeShippingThreshold",
  "shippingLeadDays", "jejuExtraFee", "islandExtraFee", "returnShippingFee", "exchangeShippingFee",
  "returnAddress", "saleStartAt", "saleEndAt", "maxPurchaseQuantity",
] as const satisfies readonly (keyof PolicyResponse)[];

export const EMPTY_POLICY: PolicyForm = Object.fromEntries(POLICY_FIELDS.map((k) => [k, ""])) as PolicyForm;

export const TAX_TYPES = [
  { value: "TAXABLE", label: "과세" },
  { value: "TAX_FREE", label: "면세" },
  { value: "ZERO_RATED", label: "영세" },
];
export const SHIPPING_FEE_TYPES = [
  { value: "FREE", label: "무료배송" },
  { value: "CONDITIONAL", label: "조건부 무료배송" },
  { value: "PAID", label: "유료배송" },
];
export const KC_CERT_TYPES = [
  { value: "NONE", label: "인증 대상 아님" },
  { value: "SAFETY_CERT", label: "안전인증" },
  { value: "SAFETY_CONFIRM", label: "안전확인" },
  { value: "SUPPLIER_CONFORMITY", label: "공급자적합성확인" },
];

/** 서버 LocalDateTime("2026-10-01T09:00:00") ↔ datetime-local 입력("2026-10-01T09:00"). */
function toInputDateTime(v: string | null): string {
  return v ? v.slice(0, 16) : "";
}
function toServerDateTime(v: string): string | null {
  return v ? `${v.slice(0, 16)}:00` : null;
}

export function fromResponse(r: PolicyResponse): PolicyForm {
  const form = { ...EMPTY_POLICY };
  for (const k of POLICY_FIELDS) {
    const v = r[k];
    form[k] = v == null ? "" : String(v);
  }
  form.saleStartAt = toInputDateTime(r.saleStartAt);
  form.saleEndAt = toInputDateTime(r.saleEndAt);
  return form;
}

const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));
const str = (v: string): string | null => (v.trim() === "" ? null : v.trim());

/** 서버 요청 본문. 빈 칸은 null(전체 교체 — 비움). */
export function toRequest(f: PolicyForm) {
  return {
    taxType: str(f.taxType),
    kcCertType: str(f.kcCertType),
    kcCertNumber: str(f.kcCertNumber),
    shippingFeeType: str(f.shippingFeeType),
    shippingFee: num(f.shippingFee),
    freeShippingThreshold: num(f.freeShippingThreshold),
    shippingLeadDays: num(f.shippingLeadDays),
    jejuExtraFee: num(f.jejuExtraFee),
    islandExtraFee: num(f.islandExtraFee),
    returnShippingFee: num(f.returnShippingFee),
    exchangeShippingFee: num(f.exchangeShippingFee),
    returnAddress: str(f.returnAddress),
    saleStartAt: toServerDateTime(f.saleStartAt),
    saleEndAt: toServerDateTime(f.saleEndAt),
    maxPurchaseQuantity: num(f.maxPurchaseQuantity),
  };
}

const MONEY_FIELDS = ["shippingFee", "freeShippingThreshold", "jejuExtraFee", "islandExtraFee", "returnShippingFee", "exchangeShippingFee"] as const;

function isNonNegative(v: string): boolean {
  const n = Number(v);
  return !Number.isNaN(n) && n >= 0;
}

/** 숫자 형식 오류. 없으면 null. */
function validateNumbers(f: PolicyForm): string | null {
  if (MONEY_FIELDS.some((k) => f[k].trim() !== "" && !isNonNegative(f[k]))) {
    return "금액은 비우거나 0 이상 숫자로 입력해 주세요.";
  }
  if (f.shippingLeadDays.trim() !== "" && !/^\d+$/.test(f.shippingLeadDays.trim())) return "출고 소요일은 0 이상 정수로 입력해 주세요.";
  if (f.maxPurchaseQuantity.trim() !== "" && !/^[1-9]\d*$/.test(f.maxPurchaseQuantity.trim())) {
    return "최대 구매 수량은 비우거나 1 이상 정수로 입력해 주세요.";
  }
  return null;
}

/** 입력 모순·형식 오류. 없으면 null. */
export function validatePolicy(f: PolicyForm): string | null {
  const numberProblem = validateNumbers(f);
  if (numberProblem) return numberProblem;
  if (f.shippingFeeType === "PAID" && f.shippingFee.trim() === "") return "유료배송은 배송비를 입력해야 합니다.";
  if (f.shippingFeeType === "CONDITIONAL" && (f.shippingFee.trim() === "" || f.freeShippingThreshold.trim() === "")) {
    return "조건부 무료배송은 배송비와 무료배송 기준 금액을 입력해야 합니다.";
  }
  if (f.kcCertType && f.kcCertType !== "NONE" && f.kcCertNumber.trim() === "") return "KC 인증 대상이면 인증번호를 입력해야 합니다.";
  if (f.saleStartAt && f.saleEndAt && f.saleStartAt >= f.saleEndAt) return "판매 종료 시각은 시작 시각보다 뒤여야 합니다.";
  return null;
}
