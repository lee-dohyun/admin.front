"use client";

import { useEffect, useState } from "react";
import { Field, Input, Tag } from "@posselect/ui";
import {
  type GradePolicy,
  type MemberGradeDetail,
  MAX_REASON_LENGTH,
  gradeErrorFromResponse,
  isManualAdjustment,
  lockPeriodText,
  lockText,
  toAdjustBody,
  todayInKst,
  validateAdjust,
} from "@/lib/member-grades";

type Loaded = { detail: MemberGradeDetail; policies: GradePolicy[] };
type AdjustResult = { changed: boolean; member: MemberGradeDetail };

// setState 를 부르지 않는 순수 조회(react-hooks/set-state-in-effect, gateway#286).
async function fetchGrade(keycloakUserId: string): Promise<Loaded | { error: string }> {
  const [detailRes, policiesRes] = await Promise.all([
    fetch(`/api/admin/members/${encodeURIComponent(keycloakUserId)}/grade`, { cache: "no-store" }),
    fetch("/api/admin/member-grades", { cache: "no-store" }),
  ]);
  if (!detailRes.ok) return { error: await gradeErrorFromResponse(detailRes, "회원 등급을 불러오지 못했습니다.") };
  if (!policiesRes.ok) return { error: await gradeErrorFromResponse(policiesRes, "등급 목록을 불러오지 못했습니다.") };
  return { detail: await detailRes.json(), policies: (await policiesRes.json()).items };
}

/**
 * 회원 등급 조회·수동 조정 대화상자(gateway#80).
 *
 * 수동 조정한 등급은 고정된다(auth.api#49) — 매월 1일 정기 재산정이 유지 기한까지(비우면 고정을 해제할
 * 때까지) 이 회원을 건너뛴다. 고정이 생기기 전에는 재산정이 수동 조정을 그대로 덮어써 CS 보상 등급이
 * 최대 한 달만 유지됐다. 지금 고정인지와, 고정을 푸는 버튼을 현재 등급 바로 아래에 둔다.
 *
 * @param onChanged 등급이 실제로 바뀌었을 때 호출 — 목록의 등급 표시를 다시 읽게 한다
 */
export function GradeAdjustDialog({
  member,
  onClose,
  onChanged,
}: {
  member: { keycloakUserId: string; email: string | null };
  onClose: () => void;
  onChanged: () => void;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [gradeCode, setGradeCode] = useState("");
  const [reason, setReason] = useState("");
  const [lockedUntil, setLockedUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let stale = false;
    fetchGrade(member.keycloakUserId).then((result) => {
      if (stale) return;
      if ("error" in result) return setMessage({ kind: "error", text: result.error });
      setLoaded(result);
    });
    return () => {
      stale = true;
    };
  }, [member.keycloakUserId]);

  const gradeUrl = `/api/admin/members/${encodeURIComponent(member.keycloakUserId)}/grade`;

  const submit = async () => {
    if (!loaded) return;
    setMessage(null);
    const input = { gradeCode, reason, lockedUntil };
    const problem = validateAdjust(
      { code: loaded.detail.grade.code, lock: loaded.detail.lock },
      input,
      todayInKst()
    );
    if (problem) return setMessage({ kind: "error", text: problem });
    setBusy(true);
    try {
      const res = await fetch(gradeUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toAdjustBody(input)),
      });
      if (!res.ok) {
        return setMessage({ kind: "error", text: await gradeErrorFromResponse(res, "등급을 바꾸지 못했습니다.") });
      }
      const result: AdjustResult = await res.json();
      setLoaded({ ...loaded, detail: result.member });
      setGradeCode("");
      setReason("");
      setLockedUntil("");
      setMessage({
        kind: "ok",
        text: result.changed
          ? `${result.member.grade.name} 등급으로 고정했습니다. (${lockPeriodText(result.member.lock.until)} 유지)`
          : `이미 ${result.member.grade.name} 등급이고 유지 기한도 같습니다. 바뀐 것이 없습니다.`,
      });
      if (result.changed) onChanged();
    } finally {
      setBusy(false);
    }
  };

  const releaseLock = async () => {
    if (!loaded) return;
    if (!window.confirm("등급 고정을 해제할까요? 등급은 그대로 두고, 다음 정기 재산정(매월 1일)부터 다시 계산됩니다.")) return;
    setMessage(null);
    setBusy(true);
    try {
      const res = await fetch(`${gradeUrl}/lock`, { method: "DELETE" });
      if (!res.ok) {
        return setMessage({ kind: "error", text: await gradeErrorFromResponse(res, "고정을 해제하지 못했습니다.") });
      }
      const result: AdjustResult = await res.json();
      setLoaded({ ...loaded, detail: result.member });
      setMessage({
        kind: "ok",
        text: result.changed
          ? "고정을 해제했습니다. 다음 정기 재산정(매월 1일)부터 다시 계산됩니다."
          : "이미 고정이 아닙니다. 바뀐 것이 없습니다.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={() => !busy && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-surface)",
          color: "var(--color-text)",
          borderRadius: 8,
          padding: 24,
          maxWidth: 560,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>회원 등급</h2>
        <p style={{ marginBottom: 12, fontSize: 14 }}>
          <strong>{member.email ?? member.keycloakUserId}</strong>
          {loaded && (
            <>
              {" "}
              — 현재 등급 <strong>{loaded.detail.grade.name}</strong> (할인율 {loaded.detail.grade.discountRate}%)
            </>
          )}
        </p>
        {loaded && (
          <p style={{ marginBottom: 12, fontSize: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Tag variant={loaded.detail.lock.locked ? "warning" : "neutral"}>{lockText(loaded.detail.lock)}</Tag>
            {loaded.detail.lock.locked && (
              <button className="btn btn-secondary" disabled={busy} onClick={releaseLock}>
                고정 해제
              </button>
            )}
          </p>
        )}

        {message && (
          <p
            role={message.kind === "error" ? "alert" : "status"}
            style={{ color: message.kind === "error" ? "var(--color-danger)" : "var(--color-success)", marginBottom: 12, fontSize: 14 }}
          >
            {message.text}
          </p>
        )}
        {!loaded && !message && <p>불러오는 중…</p>}

        {loaded && (
          <>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>등급 수동 조정</h3>
            <p className="text-muted" style={{ marginBottom: 12, fontSize: 13 }}>
              수동으로 바꾼 등급은 고정됩니다. <strong>유지 기한까지(비우면 고정을 해제할 때까지) 매월 1일 정기 재산정이 이 회원을 건너뜁니다.</strong>
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              <Field label="바꿀 등급">
                <select className="input" value={gradeCode} onChange={(e) => setGradeCode(e.target.value)}>
                  <option value="">선택</option>
                  {loaded.policies.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name} (할인율 {p.discountRate}%){p.code === loaded.detail.grade.code ? " — 현재 등급 유지" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="유지 기한 (선택 — 비우면 고정을 해제할 때까지)">
                <Input type="date" value={lockedUntil} min={todayInKst()} onChange={(e) => setLockedUntil(e.target.value)} />
              </Field>
              <Field label={`조정 사유 (필수, ${MAX_REASON_LENGTH}자 이하)`}>
                <Input type="text" value={reason} maxLength={MAX_REASON_LENGTH} onChange={(e) => setReason(e.target.value)} />
              </Field>
            </div>

            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>등급 이력</h3>
            <ul style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
              {loaded.detail.history.map((h, i) => (
                <li key={`${h.assignedAt}-${i}`}>
                  {new Date(h.assignedAt).toLocaleString()} · <strong>{h.gradeName}</strong>{" "}
                  {isManualAdjustment(h.reason) && <Tag variant="warning">수동</Tag>} {h.reason ?? ""}
                </li>
              ))}
              {loaded.detail.history.length === 0 && <li>이력이 없습니다.</li>}
            </ul>
          </>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" disabled={busy} onClick={onClose}>
            닫기
          </button>
          {loaded && (
            <button className="btn btn-primary" disabled={busy} onClick={submit}>
              {busy ? "변경 중…" : "등급 변경"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
