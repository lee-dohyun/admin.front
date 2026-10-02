"use client";

import { useEffect, useState } from "react";
import { Button, Field, Input, Table, Tag } from "@posselect/ui";
import {
  type GradePolicy,
  type GradePolicyForm,
  formatAmount,
  gradeErrorFromResponse,
  toPolicyBody,
  toPolicyForm,
  validatePolicyForm,
} from "@/lib/member-grades";

const EMPTY_FORM: GradePolicyForm = { code: "", name: "", discountRate: "", minSpendAmount: "", sortOrder: "" };

// setState 를 부르지 않는 순수 조회 — effect 에서 부르는 함수 안에 setState 가 있으면
// react-hooks/set-state-in-effect 에 걸린다(gateway#286). 결과 반영은 호출부에서 한다.
async function fetchPolicies(): Promise<{ items: GradePolicy[] } | { error: string }> {
  const res = await fetch("/api/admin/member-grades", { cache: "no-store" });
  if (!res.ok) return { error: await gradeErrorFromResponse(res, "등급 목록을 불러오지 못했습니다.") };
  return res.json();
}

/**
 * 등급 정책 관리(gateway#80) — 등급별 기준액·할인율 조회/추가/수정/삭제.
 *
 * 적용 시점이 항목마다 다르다는 점을 화면에 적어 둔다: 할인율은 저장 즉시 다음 주문부터,
 * 기준액은 다음 정기 재산정(매월 1일) 때 회원 등급에 반영된다(auth.api AdminMemberGradeService).
 */
export default function AdminMemberGradesPage() {
  const [policies, setPolicies] = useState<GradePolicy[] | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // 수정 중인 등급 코드. "" 이면 새 등급 추가 폼, null 이면 폼이 닫혀 있다.
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<GradePolicyForm>(EMPTY_FORM);

  const apply = (result: Awaited<ReturnType<typeof fetchPolicies>>) => {
    if ("error" in result) return setMessage({ kind: "error", text: result.error });
    setPolicies(result.items);
  };

  useEffect(() => {
    let stale = false;
    fetchPolicies().then((result) => {
      if (!stale) apply(result);
    });
    return () => {
      stale = true;
    };
  }, []);

  const creating = editing === "";
  const editingPolicy = policies?.find((p) => p.code === editing);

  const openCreate = () => {
    setMessage(null);
    setForm(EMPTY_FORM);
    setEditing("");
  };
  const openEdit = (policy: GradePolicy) => {
    setMessage(null);
    setForm(toPolicyForm(policy));
    setEditing(policy.code);
  };

  const save = async () => {
    setMessage(null);
    const problem = validatePolicyForm(form, { creating, isDefault: editingPolicy?.isDefault ?? false });
    if (problem) return setMessage({ kind: "error", text: problem });
    setBusy(true);
    try {
      const code = form.code.trim();
      const res = creating
        ? await fetch("/api/admin/member-grades", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, ...toPolicyBody(form) }),
          })
        : await fetch(`/api/admin/member-grades/${encodeURIComponent(code)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(toPolicyBody(form)),
          });
      if (!res.ok) {
        return setMessage({ kind: "error", text: await gradeErrorFromResponse(res, "저장하지 못했습니다. 입력값을 확인해 주세요.") });
      }
      setEditing(null);
      setMessage({ kind: "ok", text: creating ? `${code} 등급을 추가했습니다.` : `${code} 등급을 저장했습니다.` });
      apply(await fetchPolicies());
    } finally {
      setBusy(false);
    }
  };

  const remove = async (policy: GradePolicy) => {
    setMessage(null);
    if (!confirm(`${policy.name}(${policy.code}) 등급을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/member-grades/${encodeURIComponent(policy.code)}`, { method: "DELETE" });
      if (!res.ok) {
        return setMessage({ kind: "error", text: await gradeErrorFromResponse(res, "삭제하지 못했습니다.") });
      }
      if (editing === policy.code) setEditing(null);
      setMessage({ kind: "ok", text: `${policy.code} 등급을 삭제했습니다.` });
      apply(await fetchPolicies());
    } finally {
      setBusy(false);
    }
  };

  const set = (key: keyof GradePolicyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <main className="max-w-5xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-2">등급 관리</h1>
      <p className="text-muted" style={{ marginBottom: 24, fontSize: 14 }}>
        회원 등급은 매월 1일 정기 재산정에서 최근 6개월 구매확정액과 아래 기준액을 비교해 정해집니다.
        <strong> 할인율은 저장하면 그 등급 회원의 다음 주문부터 바로 적용되고, 기준액은 다음 정기 재산정 때 회원 등급에 반영됩니다.</strong>
      </p>

      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          style={{ color: message.kind === "error" ? "var(--color-danger)" : "var(--color-success)", marginBottom: 16 }}
        >
          {message.text}
        </p>
      )}

      {!policies && !message && <p>불러오는 중…</p>}

      {policies && (
        <>
          <Table>
            <thead>
              <tr>
                <th>순서</th>
                <th>코드</th>
                <th>이름</th>
                <th>할인율</th>
                <th>기준액(최근 6개월 구매확정액)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.code}>
                  <td>{p.sortOrder}</td>
                  <td>
                    {p.code} {p.isDefault && <Tag variant="neutral">기본 등급</Tag>}
                  </td>
                  <td>{p.name}</td>
                  <td>{p.discountRate}%</td>
                  <td>{p.minSpendAmount === null ? "정기 재산정 제외" : `${formatAmount(p.minSpendAmount)} 이상`}</td>
                  <td style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-secondary" disabled={busy} onClick={() => openEdit(p)}>
                      수정
                    </button>
                    {!p.isDefault && (
                      <button className="btn btn-secondary" disabled={busy} onClick={() => remove(p)}>
                        삭제
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          {editing === null && (
            <div style={{ marginTop: 16 }}>
              <Button onClick={openCreate}>등급 추가</Button>
            </div>
          )}
        </>
      )}

      {editing !== null && (
        <section style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12, maxWidth: 480 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{creating ? "등급 추가" : `${editing} 등급 수정`}</h2>
          {creating && (
            <Field label="등급 코드 (만든 뒤에는 바꿀 수 없습니다)">
              <Input type="text" value={form.code} onChange={set("code")} placeholder="예: VVIP" />
            </Field>
          )}
          <Field label="이름">
            <Input type="text" value={form.name} onChange={set("name")} />
          </Field>
          <Field label="할인율(%)">
            <Input type="text" inputMode="decimal" value={form.discountRate} onChange={set("discountRate")} />
          </Field>
          <Field label="기준액(원) — 비우면 정기 재산정에서 제외되고 수동 조정으로만 부여됩니다">
            <Input
              type="text"
              inputMode="numeric"
              value={form.minSpendAmount}
              onChange={set("minSpendAmount")}
              disabled={editingPolicy?.isDefault}
            />
          </Field>
          <Field label="정렬 순서">
            <Input type="text" inputMode="numeric" value={form.sortOrder} onChange={set("sortOrder")} />
          </Field>
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={save} disabled={busy}>
              {busy ? "저장 중…" : "저장"}
            </Button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => setEditing(null)}>
              취소
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
