"use client";

import { useEffect, useState } from "react";
import { Table, Tag } from "@posselect/ui";
import {
  approveBody,
  claimReasonLabel,
  claimStatusTabs,
  claimTypeLabel,
  rejectReasonError,
  serverTime,
  type AdminClaim,
} from "@/lib/claims";

const won = (n: number | null) => (n === null ? "-" : `${n.toLocaleString()}원`);

/** 처리된 신청의 결과 칸 — 완료면 환불 내역, 반려면 사유. */
function DecidedResult({ claim: c }: { claim: AdminClaim }) {
  if (c.status === "REJECTED") return <div>반려: {c.rejectReason}</div>;
  return (
    <div>
      환불 {won(c.refundAmount)}
      <div className="text-muted">
        상품 {won(c.itemAmount)} · 할인 몫 -{won(c.discountShare)} · 배송비 {won(c.shippingRefund)} · 반품 배송비 -{won(c.returnShippingFee)}
      </div>
    </div>
  );
}

/**
 * 고객 취소·반품 신청 검토(gateway#320). 처리 대기는 반품뿐이다 — 출고 전 취소는 고객이 신청하는 즉시 끝난다.
 * 승인하면 order.api 가 환불과 재고 복원까지 끝내고, 반려하면 그 수량을 고객이 다시 신청할 수 있게 돌려놓는다.
 */
export default function AdminClaimsPage() {
  const [status, setStatus] = useState("REQUESTED");
  const [claims, setClaims] = useState<AdminClaim[]>([]);
  const [reasonChoice, setReasonChoice] = useState<Record<number, string>>({});
  const [rejectReason, setRejectReason] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = (s: string) => {
    fetch(`/api/admin/orders/claims?status=${s}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then(setClaims)
      .catch(() => {
        setClaims([]);
        setError("신청 목록을 불러오지 못했습니다.");
      });
  };

  useEffect(() => load(status), [status]);

  const decide = async (claim: AdminClaim, action: "approve" | "reject") => {
    let body: string;
    if (action === "approve") {
      const chosen = reasonChoice[claim.id] ?? claim.reasonType;
      if (!window.confirm(`신청 #${claim.id}을(를) 승인할까요? 바로 환불됩니다.`)) return;
      body = approveBody(claim.reasonType, chosen);
    } else {
      const reason = rejectReason[claim.id] ?? "";
      const invalid = rejectReasonError(reason);
      if (invalid) {
        setError(invalid);
        return;
      }
      body = JSON.stringify({ reason: reason.trim() });
    }
    setBusy(claim.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/claims/${claim.id}/${action}`, { method: "POST", body });
      if (!res.ok) {
        const text = (await res.text()).trim();
        setError(text && !text.startsWith("{") ? text : `처리하지 못했습니다 (${res.status}).`);
        return;
      }
      load(status);
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="max-w-6xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">취소·반품 신청</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {claimStatusTabs.map((t) => (
          <button
            key={t.status}
            className={t.status === status ? "btn btn-primary" : "btn btn-ghost"}
            aria-pressed={t.status === status}
            onClick={() => setStatus(t.status)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {error && <p style={{ color: "var(--color-danger)" }}>{error}</p>}
      {claims.length === 0 ? (
        <p className="text-muted">신청이 없습니다.</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>신청</th>
              <th>주문</th>
              <th>유형·사유</th>
              <th>상품</th>
              <th>신청일</th>
              <th>{status === "REQUESTED" ? "처리" : "결과"}</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id}>
                <td>#{c.id}</td>
                <td>#{c.orderId}</td>
                <td>
                  <Tag variant="neutral">{claimTypeLabel[c.type] ?? c.type}</Tag>{" "}
                  {c.type === "RETURN" && (claimReasonLabel[c.reasonType] ?? c.reasonType)}
                  {c.reasonDetail && <div className="text-muted">{c.reasonDetail}</div>}
                </td>
                <td>{c.items.map((i) => `${i.productName} × ${i.quantity}`).join(", ")}</td>
                <td>{serverTime(c.createdAt).toLocaleString()}</td>
                <td>
                  {c.status === "REQUESTED" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <label>
                        승인 사유{" "}
                        <select
                          aria-label={`신청 ${c.id} 승인 사유`}
                          value={reasonChoice[c.id] ?? c.reasonType}
                          onChange={(e) => setReasonChoice({ ...reasonChoice, [c.id]: e.target.value })}
                        >
                          {Object.entries(claimReasonLabel).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </label>
                      <button className="btn btn-primary" disabled={busy === c.id} onClick={() => decide(c, "approve")}>
                        승인(환불)
                      </button>
                      <input
                        className="input"
                        aria-label={`신청 ${c.id} 반려 사유`}
                        placeholder="반려 사유(고객에게 보임)"
                        maxLength={300}
                        value={rejectReason[c.id] ?? ""}
                        onChange={(e) => setRejectReason({ ...rejectReason, [c.id]: e.target.value })}
                      />
                      <button className="btn btn-secondary" disabled={busy === c.id} onClick={() => decide(c, "reject")}>
                        반려
                      </button>
                    </div>
                  ) : (
                    <DecidedResult claim={c} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </main>
  );
}
