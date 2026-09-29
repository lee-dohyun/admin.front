"use client";

import { useEffect, useState } from "react";
import { Button, Field, Input } from "@posselect/ui";
import {
  EMPTY_POLICY,
  KC_CERT_TYPES,
  SHIPPING_FEE_TYPES,
  TAX_TYPES,
  fromResponse,
  toRequest,
  validatePolicy,
  type PolicyForm,
  type PolicyResponse,
} from "@/lib/policy";

/**
 * 판매 정책 편집(admin.front#53) — 과세·배송/반품·KC 인증·판매 기간·1회 최대 구매 수량.
 * 관리자 등록(1P) 상품은 여기서만 정책을 넣을 수 있다(파트너 상품은 파트너 포털에서도).
 * 상품 기본 정보와 별도 리소스라 저장 버튼도 따로 둔다(VariantManager 와 같은 방식).
 * 배송비 정책을 "무료배송"으로 두면 상품의 무료배송 표시도 서버가 맞춘다.
 */
export default function PolicyEditor({ productId }: { productId: number }) {
  const [policy, setPolicy] = useState<PolicyForm>(EMPTY_POLICY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch(`/api/admin/products/${productId}/policy`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        setPolicy(fromResponse((await res.json()) as PolicyResponse));
      })
      .catch(() => setMessage({ kind: "error", text: "판매 정책을 불러오지 못했습니다." }))
      .finally(() => setLoaded(true));
  }, [productId]);

  const set = (key: keyof PolicyForm, value: string) => setPolicy((p) => ({ ...p, [key]: value }));

  const save = async () => {
    setMessage(null);
    const problem = validatePolicy(policy);
    if (problem) return setMessage({ kind: "error", text: problem });
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/products/${productId}/policy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toRequest(policy)),
      });
      if (!res.ok) {
        const text = (await res.text()).trim();
        return setMessage({ kind: "error", text: res.status === 400 && text ? text : "판매 정책 저장에 실패했습니다." });
      }
      setPolicy(fromResponse((await res.json()) as PolicyResponse));
      setMessage({ kind: "ok", text: "판매 정책을 저장했습니다." });
    } finally {
      setSaving(false);
    }
  };

  const text = (key: keyof PolicyForm, label: string, numeric = false) => (
    <Field label={label}>
      <Input inputMode={numeric ? "numeric" : undefined} value={policy[key]} onChange={(e) => set(key, e.target.value)} />
    </Field>
  );
  const select = (key: keyof PolicyForm, label: string, options: { value: string; label: string }[]) => (
    <Field label={label}>
      <select className="input" value={policy[key]} onChange={(e) => set(key, e.target.value)}>
        <option value="">선택 안 함</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
  const row = "flex gap-3 flex-wrap";
  const type = policy.shippingFeeType;

  return (
    <div className="mt-10 pt-6" style={{ borderTop: "1px solid var(--color-divider)" }}>
      <h2 className="text-xl font-bold mb-2">판매 정책</h2>
      <p className="text-sm text-muted mb-4">
        배송비·출고 소요일·반품/교환 배송비·반품지는 상품 상세의 &quot;배송·교환·반품 안내&quot;로 공개됩니다. 판매 기간·1회 최대
        구매 수량은 장바구니와 주문에서 실제로 적용됩니다.
      </p>
      {!loaded ? (
        <p className="text-sm text-muted">불러오는 중...</p>
      ) : (
        <div className="flex flex-col gap-3">
          {select("taxType", "과세 구분", TAX_TYPES)}
          <div className={row}>
            {select("shippingFeeType", "배송비", SHIPPING_FEE_TYPES)}
            {(type === "PAID" || type === "CONDITIONAL") && text("shippingFee", "배송비(원)", true)}
            {type === "CONDITIONAL" && text("freeShippingThreshold", "무료배송 기준 금액(원)", true)}
            {text("shippingLeadDays", "출고 소요일(영업일)", true)}
          </div>
          <div className={row}>
            {text("jejuExtraFee", "제주 추가 배송비(원)", true)}
            {text("islandExtraFee", "도서산간 추가 배송비(원)", true)}
          </div>
          <div className={row}>
            {text("returnShippingFee", "반품 배송비(편도, 원)", true)}
            {text("exchangeShippingFee", "교환 배송비(왕복, 원)", true)}
          </div>
          {text("returnAddress", "반품·교환 주소")}
          <div className={row}>
            {select("kcCertType", "KC 인증", KC_CERT_TYPES)}
            {policy.kcCertType && policy.kcCertType !== "NONE" && text("kcCertNumber", "KC 인증번호")}
          </div>
          <div className={row}>
            <Field label="판매 시작 (비우면 제한 없음)">
              <Input type="datetime-local" value={policy.saleStartAt} onChange={(e) => set("saleStartAt", e.target.value)} />
            </Field>
            <Field label="판매 종료 (비우면 제한 없음)">
              <Input type="datetime-local" value={policy.saleEndAt} onChange={(e) => set("saleEndAt", e.target.value)} />
            </Field>
            {text("maxPurchaseQuantity", "1회 최대 구매 수량", true)}
          </div>
          {message && (
            <p className="text-sm" style={{ color: message.kind === "error" ? "var(--color-danger)" : "var(--color-success)" }}>
              {message.text}
            </p>
          )}
          <div>
            <Button type="button" variant="primary" disabled={saving} onClick={save}>
              {saving ? "저장 중..." : "판매 정책 저장"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
