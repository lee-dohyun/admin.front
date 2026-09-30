"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Field, Input, Table, Tag } from "@posselect/ui";
import { SELLER_STATUS_LABEL, type SellerStatus } from "@/lib/sellers";

type SellerSummary = { id: number; name: string; status: SellerStatus; type: string; createdAt: string };

// 기본은 "심사 요청" — 담당자가 처리해야 할 것부터 보인다(#23 심사 큐).
const FILTERS: { value: string; label: string }[] = [
  { value: "SUBMITTED", label: "심사 요청" },
  { value: "IN_REVIEW", label: "심사 중" },
  { value: "ACTIVE", label: "운영 중" },
  { value: "SUSPENDED", label: "정지" },
  { value: "REJECTED", label: "반려" },
  { value: "DRAFT", label: "작성 중" },
  { value: "ALL", label: "전체" },
];

const EMPTY_NEW = { name: "", businessRegistrationNo: "", mailOrderSalesNo: "", representativeName: "", address: "", phone: "", email: "" };

/**
 * 판매자 관리(admin.front#23) — 입점 심사 큐 + 신규 판매자 등록.
 * 파트너 셀프 가입이 없어(partner realm 셀프 가입 off) 입점 신청은 담당자가 대신 등록한다:
 * 등록(작성 중) → 심사 요청 → 심사 시작 → 승인/반려 → 승인 뒤 상세에서 파트너 계정 발급.
 */
export default function SellersPage() {
  const [filter, setFilter] = useState("SUBMITTED");
  const [items, setItems] = useState<SellerSummary[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_NEW);
  const [createError, setCreateError] = useState("");

  // 필터를 바꾸면 목록을 비우고 오류를 지운다 — effect 안에서 동기 setState 로 하지 않고 바꾸는 곳(핸들러)에서
  // 한다(react-hooks/set-state-in-effect, gateway#286).
  const changeFilter = (value: string) => {
    setFilter(value);
    setItems(null);
    setError("");
  };

  useEffect(() => {
    let stale = false;
    fetch(`/api/admin/sellers?status=${filter}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const list = await res.json();
        if (!stale) setItems(list);
      })
      .catch(() => {
        if (!stale) setError("판매자 목록을 불러오지 못했습니다.");
      });
    return () => {
      stale = true;
    };
  }, [filter]);

  const create = async () => {
    setCreateError("");
    const missing = (["name", "businessRegistrationNo", "representativeName", "address", "phone", "email"] as const).filter(
      (k) => !form[k].trim(),
    );
    if (missing.length) return setCreateError("필수 항목(상호·사업자등록번호·대표자·주소·전화·이메일)을 모두 입력해 주세요.");
    const res = await fetch("/api/admin/sellers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, mailOrderSalesNo: form.mailOrderSalesNo.trim() || null }),
    });
    if (!res.ok) return setCreateError("등록에 실패했습니다. 입력값을 확인해 주세요.");
    const saved = await res.json();
    window.location.href = `/admin/sellers/${saved.id}`;
  };

  const input = (key: keyof typeof EMPTY_NEW, label: string, required = true) => (
    <Field label={label} required={required}>
      <Input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </Field>
  );

  return (
    <main className="max-w-5xl mx-auto p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">판매자 관리</h1>
        <Button type="button" variant="primary" onClick={() => setCreating((v) => !v)}>
          {creating ? "등록 닫기" : "신규 판매자 등록"}
        </Button>
      </div>

      {creating && (
        <div className="card blueprint elev-sm mb-6 flex flex-col gap-3" style={{ padding: 16 }}>
          <p className="text-sm text-muted">사업자등록증과 같은 정보로 입력하세요. 등록하면 &quot;작성 중&quot; 상태로 만들어집니다.</p>
          {input("name", "상호")}
          {input("businessRegistrationNo", "사업자등록번호")}
          {input("mailOrderSalesNo", "통신판매업 신고번호", false)}
          {input("representativeName", "대표자")}
          {input("address", "사업장 주소")}
          {input("phone", "전화번호")}
          {input("email", "이메일 (파트너 로그인 아이디가 됩니다)")}
          {createError && <p role="alert" style={{ color: "var(--color-danger)" }}>{createError}</p>}
          <div>
            <Button type="button" variant="primary" onClick={create}>
              등록
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTERS.map((f) => (
          <Button key={f.value} type="button" variant={filter === f.value ? "primary" : "secondary"} onClick={() => changeFilter(f.value)}>
            {f.label}
          </Button>
        ))}
      </div>

      {error && <p role="alert" style={{ color: "var(--color-danger)" }}>{error}</p>}
      {!error && items === null && <p>불러오는 중...</p>}
      {items?.length === 0 && <p>해당 상태의 판매자가 없습니다.</p>}
      {items && items.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <Table>
            <thead>
              <tr>
                <th>#</th>
                <th>상호</th>
                <th>상태</th>
                <th>유형</th>
                <th>등록일</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>
                    <Link href={`/admin/sellers/${s.id}`}>{s.name}</Link>
                  </td>
                  <td>
                    <Tag variant={SELLER_STATUS_LABEL[s.status]?.variant ?? "neutral"}>
                      {SELLER_STATUS_LABEL[s.status]?.label ?? s.status}
                    </Tag>
                  </td>
                  <td>{s.type === "FIRST_PARTY" ? "자사" : "공급사"}</td>
                  <td>{new Date(s.createdAt).toLocaleDateString("ko-KR")}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </main>
  );
}
