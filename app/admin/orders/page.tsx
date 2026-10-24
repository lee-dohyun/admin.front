"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Table, Tag } from "@posselect/ui";
import { serverTime } from "@/lib/claims";
import {
  type AdminOrderPage,
  type OrderFilter,
  emptyFilter,
  filterError,
  orderQuery,
  orderStatusLabel,
  orderStatusVariant,
  parseOrderQuery,
  toOrderPage,
  won,
} from "@/lib/orders";

export default function AdminOrdersPage() {
  // useSearchParams 는 정적 렌더링에서 Suspense 경계가 있어야 빌드된다.
  return (
    <Suspense fallback={<main className="max-w-6xl mx-auto p-8">불러오는 중…</main>}>
      <AdminOrders />
    </Suspense>
  );
}

function AdminOrders() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // 검색 조건의 원본은 주소창이다 — 상세에서 뒤로 오거나 새로고침해도 같은 목록이 보인다.
  const query = orderQuery(parseOrderQuery(searchParams));
  const filter = parseOrderQuery(new URLSearchParams(query));
  // 입력 중인 값 — 「조회」를 눌러야 주소창으로 옮겨 간다(글자마다 조회하지 않는다).
  const [draft, setDraft] = useState<OrderFilter>(filter);
  const [result, setResult] = useState<{ query: string; page: AdminOrderPage } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [shipmentForm, setShipmentForm] = useState<Record<number, { carrier: string; trackingNumber: string }>>({});
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const loading = result?.query !== query;

  useEffect(() => {
    fetch(`/api/admin/orders?${query}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => setResult({ query, page: toOrderPage(data) }))
      .catch((e: Error) => {
        setResult({ query, page: toOrderPage([]) });
        setError(`주문 목록을 불러오지 못했습니다 (${e.message}).`);
      });
  }, [query, reloadKey]);

  const navigate = (f: OrderFilter) => {
    const next = orderQuery(f);
    router.replace(next ? `/admin/orders?${next}` : "/admin/orders");
  };
  const reload = () => setReloadKey((k) => k + 1);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const next = { ...draft, page: 0 };
    const message = filterError(next);
    setError(message ?? "");
    if (!message) navigate(next);
  };

  const reset = () => {
    setError("");
    setDraft(emptyFilter);
    navigate(emptyFilter);
  };

  const goPage = (page: number) => navigate({ ...filter, page });

  const updateForm = (orderId: number, field: "carrier" | "trackingNumber", value: string) => {
    setShipmentForm((prev) => {
      const current = prev[orderId] ?? { carrier: "", trackingNumber: "" };
      return { ...prev, [orderId]: { ...current, [field]: value } };
    });
  };

  const registerShipment = async (orderId: number) => {
    const form = shipmentForm[orderId];
    if (!form?.carrier || !form?.trackingNumber) {
      setError("택배사와 운송장번호를 입력하세요.");
      return;
    }
    setError("");
    setBusyOrderId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/shipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        reload();
      } else {
        setError(`배송 등록에 실패했습니다 (주문 #${orderId}).`);
      }
    } finally {
      setBusyOrderId(null);
    }
  };

  const markDelivered = async (orderId: number) => {
    setError("");
    setBusyOrderId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/shipment/deliver`, { method: "PUT" });
      if (res.ok) {
        reload();
      } else {
        setError(`배송완료 처리에 실패했습니다 (주문 #${orderId}).`);
      }
    } finally {
      setBusyOrderId(null);
    }
  };

  const page = result?.page ?? null;
  const orders = page?.content ?? [];
  const detailHref = (id: number) => {
    return query ? `/admin/orders/${id}?back=${encodeURIComponent(query)}` : `/admin/orders/${id}`;
  };

  return (
    <main className="max-w-6xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">주문 관리</h1>
      <p className="mb-4">
        <Link href="/admin/orders/claims" className="btn btn-secondary">
          취소·반품 신청 보기
        </Link>
      </p>

      <form onSubmit={search} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end", marginBottom: 16 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span>상태</span>
          <select
            className="input"
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value })}
          >
            <option value="">전체</option>
            {Object.entries(orderStatusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span>주문일 시작</span>
          <input type="date" className="input" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span>주문일 끝</span>
          <input type="date" className="input" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 220px" }}>
          <span>검색어</span>
          <input
            type="search"
            className="input"
            placeholder="주문번호·주문자 이름·연락처·이메일"
            value={draft.q}
            onChange={(e) => setDraft({ ...draft, q: e.target.value })}
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          조회
        </button>
        <button type="button" className="btn btn-secondary" onClick={reset} disabled={loading}>
          초기화
        </button>
      </form>

      {error && <p style={{ color: "var(--color-danger)", marginBottom: 16 }}>{error}</p>}
      {page && (
        <p style={{ marginBottom: 8 }}>
          {page.totalElements.toLocaleString("ko-KR")}건
        </p>
      )}
      <Table>
        <thead>
          <tr>
            <th>주문번호</th>
            <th>주문자</th>
            <th>계정</th>
            <th>상품수</th>
            <th>금액</th>
            <th>상태</th>
            <th>주문일시</th>
            <th>배송 처리</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>
                <Link href={detailHref(o.id)} style={{ textDecoration: "underline" }}>
                  #{o.id}
                </Link>
              </td>
              <td>
                {o.ordererName} ({o.ordererPhone})
              </td>
              <td>{o.customerEmail ?? "게스트"}</td>
              <td>{o.itemCount}</td>
              <td>{won(o.totalPrice)}</td>
              <td>
                <Tag variant={orderStatusVariant[o.status] ?? "neutral"}>{orderStatusLabel[o.status] ?? o.status}</Tag>
              </td>
              <td>{serverTime(o.createdAt).toLocaleString("ko-KR")}</td>
              <td>
                {o.status === "PAID" && (
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <input
                      type="text"
                      className="input"
                      placeholder="택배사"
                      style={{ width: 80 }}
                      value={shipmentForm[o.id]?.carrier ?? ""}
                      onChange={(e) => updateForm(o.id, "carrier", e.target.value)}
                    />
                    <input
                      type="text"
                      className="input"
                      placeholder="운송장번호"
                      style={{ width: 110 }}
                      value={shipmentForm[o.id]?.trackingNumber ?? ""}
                      onChange={(e) => updateForm(o.id, "trackingNumber", e.target.value)}
                    />
                    <button
                      className="btn btn-secondary"
                      disabled={busyOrderId === o.id}
                      onClick={() => registerShipment(o.id)}
                    >
                      배송 등록
                    </button>
                  </div>
                )}
                {o.status === "SHIPPED" && (
                  <button
                    className="btn btn-secondary"
                    disabled={busyOrderId === o.id}
                    onClick={() => markDelivered(o.id)}
                  >
                    배송완료 처리
                  </button>
                )}
              </td>
            </tr>
          ))}
          {page && !loading && orders.length === 0 && (
            <tr>
              <td colSpan={8} style={{ textAlign: "center" }}>
                조건에 맞는 주문이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      {page && page.totalPages > 1 && (
        <nav style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", marginTop: 16 }}>
          <button className="btn btn-secondary" disabled={loading || page.page <= 0} onClick={() => goPage(page.page - 1)}>
            이전
          </button>
          <span>
            {page.page + 1} / {page.totalPages}
          </span>
          <button
            className="btn btn-secondary"
            disabled={loading || page.page + 1 >= page.totalPages}
            onClick={() => goPage(page.page + 1)}
          >
            다음
          </button>
        </nav>
      )}
    </main>
  );
}
