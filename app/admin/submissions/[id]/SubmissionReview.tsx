"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, Field, Table, Tag, Textarea } from "@posselect/ui";
import { REVIEW_NOTE_MAX, STATUS_LABEL, canDecide } from "@/lib/submissions";

type Issue = { id: number; code: string; field: string | null; message: string; severity: "BLOCKING" | "WARNING" };
type Detail = {
  submission: {
    id: number;
    productId: number;
    productName: string;
    sellerName: string | null;
    status: string;
    submittedBy: string | null;
    reviewedBy: string | null;
    reviewNote: string | null;
    createdAt: string;
    updatedAt: string;
    issues: Issue[];
  };
  product: {
    id: number;
    name: string;
    description: string | null;
    price: number;
    listPrice: number | null;
    stockQuantity: number;
    brand: string | null;
    freeShipping: boolean;
    status: string;
    sellerName: string | null;
    category: { id: number; name: string } | null;
    images: { id: number; imageUrl: string; sortOrder: number }[];
  } | null;
  attributes: { code: string; value: string | null }[];
  requirement: {
    requiredAttributes: { code: string; label: string; required: boolean }[];
    requiredDocuments: string[];
    restricted: boolean;
  } | null;
};

const won = (n: number | null | undefined) => (n == null ? "-" : `${Number(n).toLocaleString("ko-KR")}원`);

async function errorText(res: Response): Promise<string> {
  const text = await res.text();
  try {
    return JSON.parse(text).error ?? text;
  } catch {
    return text || `요청 실패 (${res.status})`;
  }
}

export default function SubmissionReview({ id }: { id: number }) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"" | "approve" | "request-fix">("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/submissions/${id}`, { cache: "no-store" });
    if (!res.ok) {
      setError(res.status === 404 ? "제출을 찾을 수 없습니다." : "불러오지 못했습니다.");
      return;
    }
    setData(await res.json());
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (decision: "approve" | "request-fix") => {
    if (decision === "approve" && !window.confirm("승인하면 이 상품이 즉시 쇼핑몰에 노출됩니다. 승인할까요?")) return;
    if (decision === "request-fix" && !note.trim()) {
      setMessage({ kind: "error", text: "보완 요청 사유를 입력해 주세요. 파트너는 이 문장을 보고 수정합니다." });
      return;
    }
    setBusy(decision);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/submissions/${id}/${decision}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNote: note }),
      });
      if (!res.ok) throw new Error(await errorText(res));
      setNote("");
      setMessage({ kind: "ok", text: decision === "approve" ? "승인했습니다. 상품이 판매 중으로 바뀌었습니다." : "보완 요청을 보냈습니다." });
      await load();
    } catch (e) {
      setMessage({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy("");
    }
  };

  if (error) return <main className="max-w-4xl mx-auto p-6"><p role="alert">{error}</p></main>;
  if (!data) return <main className="max-w-4xl mx-auto p-6">불러오는 중...</main>;

  const { submission: s, product: p, attributes, requirement } = data;
  const values = new Map(attributes.map((a) => [a.code, a.value ?? ""]));
  const blocking = s.issues.filter((i) => i.severity === "BLOCKING");
  const warnings = s.issues.filter((i) => i.severity === "WARNING");
  const decidable = canDecide(s.status);

  return (
    <main className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
      <div>
        <Link href="/admin/submissions" className="text-sm">← 검수 목록</Link>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <h1 className="text-2xl font-bold">제출 #{s.id} · {s.productName}</h1>
          <Tag variant={STATUS_LABEL[s.status]?.variant ?? "neutral"}>{STATUS_LABEL[s.status]?.label ?? s.status}</Tag>
        </div>
        <p className="text-sm mt-1" style={{ color: "var(--color-neutral-600)" }}>
          판매자 {s.sellerName ?? "-"} · 제출 {s.submittedBy ?? "-"} · {new Date(s.updatedAt).toLocaleString("ko-KR")}
          {s.reviewedBy && ` · 심사 ${s.reviewedBy}`}
        </p>
        {s.reviewNote && (
          <p className="mt-2 p-3 text-sm" style={{ background: "var(--color-neutral-100)" }}>심사 메모: {s.reviewNote}</p>
        )}
      </div>

      {/* 자동 검사 결과 — WARNING 도 보여 준다: 통과는 됐지만 사람이 봐야 하는 것 */}
      <section>
        <h2 className="font-bold mb-2">자동 검사 결과</h2>
        {s.issues.length === 0 && <p className="text-sm">지적 사항 없음</p>}
        {[...blocking, ...warnings].map((i) => (
          <p key={i.id} className="text-sm" style={{ color: i.severity === "BLOCKING" ? "var(--color-danger)" : "var(--color-warning)" }}>
            {i.severity === "BLOCKING" ? "차단" : "경고"} · {i.field ?? "공통"} · {i.message}
          </p>
        ))}
      </section>

      {p && (
        <section>
          <h2 className="font-bold mb-2">상품 정보</h2>
          <div className="flex gap-2 flex-wrap mb-3">
            {[...p.images].sort((a, b) => a.sortOrder - b.sortOrder).map((img) => (
              // eslint-disable-next-line @next/next/no-img-element -- CDN 이미지 미리보기
              <img key={img.id} src={img.imageUrl} alt="" width={120} height={120} style={{ objectFit: "cover" }} />
            ))}
            {p.images.length === 0 && <p className="text-sm" style={{ color: "var(--color-danger)" }}>이미지 없음</p>}
          </div>
          <Table>
            <tbody>
              <tr><th>카테고리</th><td>{p.category?.name ?? "-"}</td></tr>
              <tr><th>상품명</th><td>{p.name}</td></tr>
              <tr><th>브랜드</th><td>{p.brand ?? "-"}</td></tr>
              <tr><th>판매가 / 정가</th><td>{won(p.price)} / {won(p.listPrice)}</td></tr>
              <tr><th>재고</th><td>{p.stockQuantity}</td></tr>
              <tr><th>무료배송</th><td>{p.freeShipping ? "예" : "아니오"}</td></tr>
              <tr><th>상품 상태</th><td>{p.status}</td></tr>
            </tbody>
          </Table>
          {p.description && <p className="mt-3 text-sm" style={{ whiteSpace: "pre-wrap" }}>{p.description}</p>}
        </section>
      )}

      <section>
        <h2 className="font-bold mb-2">상품정보제공고시</h2>
        {requirement?.restricted && (
          <p className="text-sm mb-2">
            판매 권한이 필요한 카테고리입니다 (필요 서류: {requirement.requiredDocuments.join(", ") || "-"}).
          </p>
        )}
        {requirement && requirement.requiredAttributes.length > 0 ? (
          <Table>
            <tbody>
              {requirement.requiredAttributes.map((a) => {
                const v = values.get(a.code) ?? "";
                return (
                  <tr key={a.code}>
                    <th>{a.label}{a.required && " *"}</th>
                    <td style={{ color: a.required && !v.trim() ? "var(--color-danger)" : undefined }}>
                      {v.trim() || "(비어 있음)"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <p className="text-sm">이 카테고리는 고시 입력 항목이 없습니다.</p>
        )}
      </section>

      {decidable ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-bold">심사</h2>
          <Field label="사유 / 메모" helpText={`보완 요청은 사유 필수 — 파트너 화면에 그대로 표시됩니다. ${REVIEW_NOTE_MAX}자 이하.`}>
            <Textarea rows={3} maxLength={REVIEW_NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Button type="button" variant="primary" disabled={busy !== "" || blocking.length > 0} onClick={() => decide("approve")}>
              {busy === "approve" ? "승인 중..." : "승인"}
            </Button>
            <Button type="button" variant="secondary" disabled={busy !== ""} onClick={() => decide("request-fix")}>
              {busy === "request-fix" ? "요청 중..." : "보완 요청"}
            </Button>
          </div>
          {blocking.length > 0 && (
            <p className="text-sm" style={{ color: "var(--color-danger)" }}>차단 항목이 남아 있어 승인할 수 없습니다.</p>
          )}
        </section>
      ) : (
        <p className="text-sm">이 제출은 지금 심사할 수 있는 상태가 아닙니다 (심사 대기일 때만 승인·보완 요청 가능).</p>
      )}

      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} style={{ color: message.kind === "error" ? "var(--color-danger)" : "var(--color-success)" }}>
          {message.text}
        </p>
      )}
    </main>
  );
}
