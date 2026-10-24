"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Table, Tag } from "@posselect/ui";
import { claimItemText, claimReasonLabel, claimTypeLabel, serverTime } from "@/lib/claims";
import {
  type OrderDetail,
  canRefund,
  orderStatusLabel,
  orderStatusVariant,
  orderTimeline,
  refundReasonError,
  remainingRefund,
  won,
} from "@/lib/orders";

const claimStatusLabel: Record<string, string> = {
  REQUESTED: "처리 대기",
  APPROVED: "교환 발송 대기",
  COMPLETED: "완료",
  REJECTED: "반려",
};

/** 주문 상세(gateway#329) — 상품·배송지·금액·배송·취소·반품·진행 기록을 한 화면에서 보고 전체 환불을 실행한다. */
export default function AdminOrderDetailPage() {
  // useSearchParams 는 정적 렌더링에서 Suspense 경계가 있어야 빌드된다.
  return (
    <Suspense fallback={<main className="max-w-5xl mx-auto p-8">불러오는 중…</main>}>
      <AdminOrderDetail />
    </Suspense>
  );
}

function AdminOrderDetail() {
  const { id } = useParams<{ id: string }>();
  // 목록의 검색 조건을 들고 왔으면 「목록으로」가 그 조건으로 돌아간다.
  const back = useSearchParams().get("back");
  const backHref = back ? `/admin/orders?${back}` : "/admin/orders";
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [reason, setReason] = useState("");
  const [refundError, setRefundError] = useState("");
  const [refunding, setRefunding] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/orders/${encodeURIComponent(id)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: OrderDetail) => {
        setOrder(data);
        setLoadError("");
      })
      .catch((e: Error) =>
        setLoadError(e.message === "404" ? "주문을 찾을 수 없습니다." : `주문을 불러오지 못했습니다 (${e.message}).`),
      );
  }, [id, reloadKey]);

  const refund = async () => {
    if (!order) return;
    const message = refundReasonError(reason);
    setRefundError(message ?? "");
    if (message) return;
    if (!window.confirm(`주문 #${order.id}을(를) 전체 환불할까요? ${won(remainingRefund(order))}이 환불되고 재고가 돌아옵니다. 되돌릴 수 없습니다.`)) {
      return;
    }
    setRefunding(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (res.status === 409) {
        setRefundError("이미 환불됐거나 환불할 수 없는 상태입니다. 화면을 새로 불러왔습니다.");
      } else if (!res.ok) {
        setRefundError(`환불에 실패했습니다 (${res.status}).`);
        return;
      } else {
        setReason("");
      }
      setReloadKey((k) => k + 1);
    } finally {
      setRefunding(false);
    }
  };

  if (loadError) {
    return (
      <main className="max-w-5xl mx-auto p-8">
        <p style={{ color: "var(--color-danger)" }}>{loadError}</p>
        <p className="mt-4">
          <Link href={backHref} className="btn btn-secondary">
            목록으로
          </Link>
        </p>
      </main>
    );
  }
  if (!order) {
    return <main className="max-w-5xl mx-auto p-8">불러오는 중…</main>;
  }

  const address = order.address1
    ? `${order.zipCode ? `(${order.zipCode}) ` : ""}${order.address1} ${order.address2 ?? ""}`.trim()
    : order.shippingAddress;

  return (
    <main className="max-w-5xl mx-auto p-8">
      <p className="mb-4">
        <Link href={backHref} className="btn btn-secondary">
          목록으로
        </Link>
      </p>
      <h1 className="text-2xl font-bold mb-2">
        주문 #{order.id}{" "}
        <Tag variant={orderStatusVariant[order.status] ?? "neutral"}>{orderStatusLabel[order.status] ?? order.status}</Tag>
      </h1>
      <p className="mb-6">주문일시 {serverTime(order.createdAt).toLocaleString("ko-KR")}</p>

      <section className="mb-8">
        <h2 className="text-lg font-bold mb-2">주문자·배송지</h2>
        <Table>
          <tbody>
            <tr>
              <th>주문자</th>
              <td>
                {order.ordererName} ({order.ordererPhone})
              </td>
            </tr>
            <tr>
              <th>받는 분</th>
              <td>
                {order.recipientName ?? order.ordererName} ({order.recipientPhone ?? order.ordererPhone})
              </td>
            </tr>
            <tr>
              <th>배송지</th>
              <td>{address}</td>
            </tr>
          </tbody>
        </Table>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-bold mb-2">상품</h2>
        <Table>
          <thead>
            <tr>
              <th>상품</th>
              <th>단가</th>
              <th>수량</th>
              <th>취소·반품 수량</th>
              <th>금액</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, i) => (
              <tr key={item.orderItemId ?? i}>
                <td>{item.productName}</td>
                <td>{won(item.price)}</td>
                <td>{item.quantity}</td>
                <td>{item.claimedQuantity ?? 0}</td>
                <td>{won(item.price * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="mt-2">
          상품 합계 {won(order.subtotalPrice)}
          {order.discountAmount > 0 && <> · 등급 할인 -{won(order.discountAmount)}</>} · 배송비 {won(order.shippingFee)} ·{" "}
          <strong>결제 금액 {won(order.totalPrice)}</strong>
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-bold mb-2">배송</h2>
        {order.shipment ? (
          <p>
            {order.shipment.carrier} {order.shipment.trackingNumber} ·{" "}
            {order.shipment.status === "DELIVERED" ? "배송완료" : "배송중"}
          </p>
        ) : (
          <p>운송장이 아직 등록되지 않았습니다. 운송장 등록은 주문 목록에서 합니다.</p>
        )}
      </section>

      {order.claims.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold mb-2">취소·반품·교환</h2>
          <Table>
            <thead>
              <tr>
                <th>신청</th>
                <th>유형</th>
                <th>상품</th>
                <th>사유</th>
                <th>상태</th>
                <th>환불</th>
              </tr>
            </thead>
            <tbody>
              {order.claims.map((c) => (
                <tr key={c.id}>
                  <td>#{c.id}</td>
                  <td>{claimTypeLabel[c.type] ?? c.type}</td>
                  <td>{c.items.map(claimItemText).join(", ")}</td>
                  <td>{claimReasonLabel[c.reasonType] ?? c.reasonType}</td>
                  <td>{claimStatusLabel[c.status] ?? c.status}</td>
                  <td>{c.refundAmount == null ? "-" : won(c.refundAmount)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-2">
            반품 승인·반려는 <Link href="/admin/orders/claims" style={{ textDecoration: "underline" }}>취소·반품 신청</Link> 화면에서 합니다.
          </p>
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-lg font-bold mb-2">환불</h2>
        {order.refund && (
          <p className="mb-2">
            전체 환불 {won(order.refund.amount)}
            {order.refund.refundedAt && <> · {serverTime(order.refund.refundedAt).toLocaleString("ko-KR")}</>}
            {order.refund.reason && <> · 사유: {order.refund.reason}</>}
          </p>
        )}
        {canRefund(order.status) ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 560 }}>
            <p>
              남은 결제 금액 {won(remainingRefund(order))}을(를) 전부 환불하고 재고를 되돌립니다. 상품별 부분 환불은 고객의
              취소·반품 신청으로만 합니다.
            </p>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span>환불 사유(고객에게 보내는 환불 안내 메일에 들어감)</span>
              <textarea
                className="input"
                rows={2}
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {refundError && <p style={{ color: "var(--color-danger)" }}>{refundError}</p>}
            <div>
              <button className="btn btn-primary" disabled={refunding} onClick={refund}>
                {refunding ? "환불 중…" : "전체 환불"}
              </button>
            </div>
          </div>
        ) : (
          !order.refund && <p>{order.status === "CREATED" ? "결제 전 주문은 환불할 수 없습니다." : "환불할 수 없는 상태입니다."}</p>
        )}
        {!canRefund(order.status) && refundError && <p style={{ color: "var(--color-danger)" }}>{refundError}</p>}
      </section>

      <section>
        <h2 className="text-lg font-bold mb-2">진행 기록</h2>
        <ul>
          {orderTimeline(order).map((e, i) => (
            <li key={i}>
              {e.at.toLocaleString("ko-KR")} — {e.label}
            </li>
          ))}
        </ul>
        <p className="mt-2" style={{ opacity: 0.7 }}>
          각 기록의 시각만 보입니다. 누가 처리했는지는 아직 남지 않습니다.
        </p>
      </section>
    </main>
  );
}
