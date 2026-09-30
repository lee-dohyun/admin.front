"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button, Field, Input, Tag } from "@posselect/ui";
import { REASON_CODES, SELLER_STATUS_LABEL, allowedActions, type SellerStatus } from "@/lib/sellers";

type Seller = {
  id: number;
  name: string;
  businessRegistrationNo: string;
  mailOrderSalesNo: string | null;
  representativeName: string;
  address: string;
  phone: string;
  email: string;
  status: SellerStatus;
  type: string;
  settlementBank: string | null;
  settlementAccount: string | null;
  shippingOriginAddress: string | null;
  returnAddress: string | null;
  shippingFeePolicy: string | null;
  csContact: string | null;
};
type Doc = { id: number; docType: string; fileKey: string; issuedAt: string | null; verifiedAt: string | null; rejectReason: string | null };
type History = { id: number; fromStatus: string | null; toStatus: string; reasonCode: string | null; reasonNote: string | null; changedBy: string; createdAt: string };
type Detail = { seller: Seller; documents: Doc[]; history: History[] };
type Account = { id: string; username: string; email: string | null; enabled: boolean };

const EDITABLE = [
  ["name", "상호", true],
  ["businessRegistrationNo", "사업자등록번호", true],
  ["mailOrderSalesNo", "통신판매업 신고번호", false],
  ["representativeName", "대표자", true],
  ["address", "사업장 주소", true],
  ["phone", "전화번호", true],
  ["email", "이메일 (파트너 로그인 아이디)", true],
  ["settlementBank", "정산 은행", false],
  ["settlementAccount", "정산 계좌", false],
  ["shippingOriginAddress", "출고지", false],
  ["returnAddress", "반품·교환지", false],
  ["shippingFeePolicy", "배송비 정책(메모)", false],
  ["csContact", "CS 연락처", false],
] as const;
type EditKey = (typeof EDITABLE)[number][0];

function label(status: string | null) {
  if (!status) return "-";
  return SELLER_STATUS_LABEL[status as SellerStatus]?.label ?? status;
}

async function errorText(res: Response, fallback: string): Promise<string> {
  const text = (await res.text()).trim();
  try {
    const json = JSON.parse(text);
    return json.error ?? fallback;
  } catch {
    return res.status === 409 && text && text.length <= 200 ? text : fallback;
  }
}

/**
 * 판매자 상세(admin.front#23) — 심사(상태 전이)·기본 정보/판매 설정·파트너 계정 발급·서류·이력을 한 화면에서.
 * "목록에서 하나 열고 → 판단하고 → 다음"이 끊기지 않게 서류와 이력을 같은 화면에 둔다(#23 설계 메모).
 */
type Loaded = { detail: Detail; form: Record<EditKey, string>; account: Account | null | undefined };

// setState 를 부르지 않는 순수 조회 — effect 에서 부르는 함수 안에 setState 가 있으면
// react-hooks/set-state-in-effect 에 걸린다(gateway#286). 결과 반영은 호출부의 .then 에서 한다.
async function fetchSeller(id: string | number): Promise<Loaded | null> {
  const res = await fetch(`/api/admin/sellers/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  const detail: Detail = await res.json();
  const form = Object.fromEntries(EDITABLE.map(([k]) => [k, detail.seller[k] ?? ""])) as Record<EditKey, string>;
  const a = await fetch(`/api/admin/sellers/${id}/account`, { cache: "no-store" });
  return { detail, form, account: a.ok ? (await a.json()).account : undefined };
}

export default function SellerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [form, setForm] = useState<Record<EditKey, string> | null>(null);
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [issued, setIssued] = useState<{ username: string; initialPassword: string } | null>(null);
  const [reasonCode, setReasonCode] = useState("");
  const [reasonNote, setReasonNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const apply = useCallback((l: Loaded | null) => {
    if (!l) return setMessage({ kind: "error", text: "판매자를 불러오지 못했습니다." });
    setDetail(l.detail);
    setForm(l.form);
    setAccount(l.account);
  }, []);

  // 상태 변경·저장 뒤 다시 읽을 때 쓴다(이벤트 핸들러에서만 호출).
  const load = useCallback(async () => apply(await fetchSeller(id)), [id, apply]);

  useEffect(() => {
    let stale = false;
    fetchSeller(id).then((l) => {
      if (!stale) apply(l);
    });
    return () => {
      stale = true;
    };
  }, [id, apply]);

  if (!detail || !form) {
    return <main className="max-w-3xl mx-auto p-6">{message ? <p role="alert">{message.text}</p> : <p>불러오는 중...</p>}</main>;
  }
  const { seller, documents, history } = detail;
  const actions = allowedActions(seller.status);
  const reason = REASON_CODES.find((r) => r.code === reasonCode);

  const transition = async (to: string, needsReason: boolean) => {
    setMessage(null);
    if (needsReason && !reasonCode) return setMessage({ kind: "error", text: "사유를 먼저 선택해 주세요." });
    if (!confirm(`${label(seller.status)} → ${label(to)} 로 바꿀까요?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/sellers/${id}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatus: to, reasonCode: needsReason ? reasonCode : null, reasonNote: needsReason ? reasonNote : null }),
      });
      if (!res.ok) return setMessage({ kind: "error", text: await errorText(res, "상태를 바꾸지 못했습니다.") });
      setReasonCode("");
      setReasonNote("");
      setMessage({ kind: "ok", text: `${label(to)}(으)로 바꿨습니다.` });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setMessage(null);
    const missing = EDITABLE.filter(([k, , req]) => req && !form[k].trim());
    if (missing.length) return setMessage({ kind: "error", text: `필수 항목을 입력해 주세요: ${missing.map(([, l]) => l).join(", ")}` });
    setBusy(true);
    try {
      const body = Object.fromEntries(EDITABLE.map(([k, , req]) => [k, req ? form[k].trim() : form[k].trim() || null]));
      const res = await fetch(`/api/admin/sellers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return setMessage({ kind: "error", text: "저장하지 못했습니다. 입력값을 확인해 주세요." });
      setMessage({ kind: "ok", text: "판매자 정보를 저장했습니다." });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    setMessage(null);
    if (!confirm("비밀번호를 새로 발급할까요? 기존 비밀번호로는 더 이상 로그인할 수 없습니다.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/sellers/${id}/account`, { method: "PUT" });
      if (!res.ok) return setMessage({ kind: "error", text: await errorText(res, "비밀번호를 재발급하지 못했습니다.") });
      const r = await res.json();
      setIssued({ username: r.account.username, initialPassword: r.initialPassword });
    } finally {
      setBusy(false);
    }
  };

  const issue = async () => {
    setMessage(null);
    if (!confirm(`${seller.email} 로 파트너 계정을 발급할까요? 초기 비밀번호는 이 화면에서 한 번만 보입니다.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/sellers/${id}/account`, { method: "POST" });
      if (!res.ok) return setMessage({ kind: "error", text: await errorText(res, "계정을 발급하지 못했습니다.") });
      const r = await res.json();
      setIssued({ username: r.account.username, initialPassword: r.initialPassword });
      setAccount(r.account);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto p-6 flex flex-col gap-8">
      <div>
        <Link href="/admin/sellers" className="text-sm">
          ← 판매자 목록
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-bold">{seller.name}</h1>
          <Tag variant={SELLER_STATUS_LABEL[seller.status]?.variant ?? "neutral"}>{label(seller.status)}</Tag>
          <span className="text-sm text-muted">{seller.type === "FIRST_PARTY" ? "자사" : "공급사"} · #{seller.id}</span>
        </div>
      </div>

      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} style={{ color: message.kind === "error" ? "var(--color-danger)" : "var(--color-success)" }}>
          {message.text}
        </p>
      )}

      {/* 1) 심사 — 상태 전이 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">심사</h2>
        {actions.length === 0 ? (
          <p className="text-sm text-muted">이 상태에서는 할 수 있는 조치가 없습니다.</p>
        ) : (
          <>
            {actions.some((a) => a.needsReason) && (
              <div className="flex flex-col gap-2">
                <Field label="사유 (반려·정지·해지 시 필수)">
                  <select className="input" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
                    <option value="">선택하세요</option>
                    {REASON_CODES.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </Field>
                {reason && (
                  <p className="text-sm p-2" style={{ background: "var(--color-neutral-100)" }}>
                    판매자에게 전달될 문구: {reason.message}
                  </p>
                )}
                <Field label="보충 설명 (선택)">
                  <Input value={reasonNote} maxLength={500} onChange={(e) => setReasonNote(e.target.value)} />
                </Field>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              {actions.map((a) => (
                <Button
                  key={a.to}
                  type="button"
                  variant={a.danger ? "secondary" : "primary"}
                  disabled={busy}
                  style={a.danger ? { color: "var(--color-danger)" } : undefined}
                  onClick={() => transition(a.to, a.needsReason)}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          </>
        )}
      </section>

      {/* 2) 파트너 계정 */}
      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">파트너 계정</h2>
        {account === undefined && <p className="text-sm text-muted">계정 정보를 확인하지 못했습니다.</p>}
        {account && (
          <p className="text-sm">
            발급됨: <b>{account.username}</b> {account.enabled ? "" : "(비활성)"} — partner.posselect.com 로그인 아이디
          </p>
        )}
        {account && account.username !== seller.email.trim().toLowerCase() && (
          <p className="text-sm" style={{ color: "var(--color-warning)" }}>
            판매자 이메일({seller.email})이 로그인 아이디와 다릅니다 — 이메일을 바꿔도 로그인 아이디는 자동으로 바뀌지 않습니다.
          </p>
        )}
        {account && (
          <div>
            <Button type="button" variant="secondary" disabled={busy} onClick={resetPassword}>
              비밀번호 재발급
            </Button>
          </div>
        )}
        {issued && (
          <div className="p-3 text-sm" style={{ background: "var(--color-warning-bg, var(--color-neutral-100))" }}>
            <p>
              아이디 <b>{issued.username}</b> / 초기 비밀번호 <b style={{ fontFamily: "monospace" }}>{issued.initialPassword}</b>
            </p>
            <p className="mt-1">이 비밀번호는 다시 볼 수 없습니다. 판매자에게 안전한 경로로 전달하세요.</p>
          </div>
        )}
        {account === null && seller.status === "ACTIVE" && (
          <div>
            <Button type="button" variant="primary" disabled={busy} onClick={issue}>
              파트너 계정 발급
            </Button>
          </div>
        )}
        {account === null && seller.status !== "ACTIVE" && (
          <p className="text-sm text-muted">운영 중(승인)이 되면 계정을 발급할 수 있습니다.</p>
        )}
      </section>

      {/* 3) 기본 정보 + 판매 설정 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">기본 정보 · 판매 설정</h2>
        {EDITABLE.map(([k, l, req]) => (
          <Field key={k} label={l} required={req}>
            <Input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </Field>
        ))}
        <div>
          <Button type="button" variant="primary" disabled={busy} onClick={save}>
            저장
          </Button>
        </div>
      </section>

      {/* 4) 서류 */}
      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">제출 서류</h2>
        {documents.length === 0 ? (
          <p className="text-sm text-muted">제출된 서류가 없습니다. (파트너 서류 업로드 경로는 아직 없다 — 후속 과제)</p>
        ) : (
          <ul className="text-sm">
            {documents.map((d) => (
              <li key={d.id}>
                {d.docType} · {d.fileKey} · 발급일 {d.issuedAt ?? "-"} · {d.verifiedAt ? "확인됨" : "미확인"}
                {d.rejectReason ? ` · 반려: ${d.rejectReason}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 5) 상태 이력 */}
      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">상태 이력</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted">아직 상태 변경 이력이 없습니다.</p>
        ) : (
          <ol className="text-sm flex flex-col gap-1">
            {history.map((h) => (
              <li key={h.id}>
                {new Date(h.createdAt).toLocaleString("ko-KR")} · {label(h.fromStatus)} → <b>{label(h.toStatus)}</b> · {h.changedBy}
                {h.reasonCode && ` · 사유: ${REASON_CODES.find((r) => r.code === h.reasonCode)?.label ?? h.reasonCode}`}
                {h.reasonNote && ` (${h.reasonNote})`}
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
