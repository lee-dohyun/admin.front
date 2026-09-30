"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Table, Tag } from "@posselect/ui";
import { STATUS_LABEL } from "@/lib/submissions";

type SubmissionSummary = {
  id: number;
  productId: number;
  productName: string;
  status: string;
  updatedAt: string;
};

// 기본은 "심사 대기" — 사람이 판단해야 하는 것만 먼저 보인다.
const FILTERS: { value: string; label: string }[] = [
  { value: "IN_REVIEW", label: "심사 대기" },
  { value: "NEEDS_FIX", label: "보완 요청" },
  { value: "LIVE", label: "승인" },
  { value: "ALL", label: "전체" },
];

export default function SubmissionQueuePage() {
  const [filter, setFilter] = useState("IN_REVIEW");
  const [items, setItems] = useState<SubmissionSummary[] | null>(null);
  const [error, setError] = useState("");

  // 필터를 바꾸면 목록을 비우고 오류를 지운다 — effect 안에서 동기 setState 로 하지 않고 바꾸는 곳(핸들러)에서
  // 한다(react-hooks/set-state-in-effect, gateway#286).
  const changeFilter = (value: string) => {
    setFilter(value);
    setItems(null);
    setError("");
  };

  useEffect(() => {
    let stale = false;
    fetch(`/api/admin/submissions?status=${filter}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const list = await res.json();
        if (!stale) setItems(list);
      })
      .catch(() => {
        if (!stale) setError("검수 목록을 불러오지 못했습니다.");
      });
    return () => {
      stale = true;
    };
  }, [filter]);

  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">상품 검수</h1>
      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            type="button"
            variant={filter === f.value ? "primary" : "secondary"}
            onClick={() => changeFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {error && <p role="alert" style={{ color: "var(--color-danger)" }}>{error}</p>}
      {!error && items === null && <p>불러오는 중...</p>}
      {items?.length === 0 && <p>해당 상태의 제출이 없습니다.</p>}
      {items && items.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <Table>
            <thead>
              <tr>
                <th>제출 #</th>
                <th>상품</th>
                <th>상태</th>
                <th>최근 변경</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>
                    <Link href={`/admin/submissions/${s.id}`}>{s.productName}</Link>
                  </td>
                  <td>
                    <Tag variant={STATUS_LABEL[s.status]?.variant ?? "neutral"}>
                      {STATUS_LABEL[s.status]?.label ?? s.status}
                    </Tag>
                  </td>
                  <td>{new Date(s.updatedAt).toLocaleString("ko-KR")}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </main>
  );
}
