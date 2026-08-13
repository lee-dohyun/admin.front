"use client";

import { useEffect, useState } from "react";
import { Table, Tag } from "@posselect/ui";

type AdminOrder = {
  id: number;
  customerEmail: string | null;
  ordererName: string;
  ordererPhone: string;
  status: string;
  totalPrice: number;
  itemCount: number;
  createdAt: string;
};

const statusLabel: Record<string, string> = {
  CREATED: "결제 대기",
  PAID: "결제 완료",
  PREPARING: "배송 준비",
  SHIPPED: "배송중",
  DELIVERED: "배송완료",
  CANCELLED: "주문취소",
  REFUNDED: "환불완료",
};

const statusVariant: Record<string, "warning" | "success" | "accent" | "neutral" | "danger"> = {
  CREATED: "warning",
  PAID: "success",
  PREPARING: "accent",
  SHIPPED: "accent",
  DELIVERED: "success",
  CANCELLED: "danger",
  REFUNDED: "danger",
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [shipmentForm, setShipmentForm] = useState<Record<number, { carrier: string; trackingNumber: string }>>({});
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    fetch("/api/admin/orders")
      .then((res) => res.json())
      .then(setOrders)
      .catch(() => setOrders([]));
  };

  useEffect(load, []);

  const updateForm = (orderId: number, field: "carrier" | "trackingNumber", value: string) => {
    setShipmentForm((prev) => ({
      ...prev,
      [orderId]: { carrier: "", trackingNumber: "", ...prev[orderId], [field]: value },
    }));
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
        load();
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
        load();
      } else {
        setError(`배송완료 처리에 실패했습니다 (주문 #${orderId}).`);
      }
    } finally {
      setBusyOrderId(null);
    }
  };

  return (
    <main className="max-w-6xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">주문 관리</h1>
      {error && <p style={{ color: "var(--color-danger)", marginBottom: 16 }}>{error}</p>}
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
              <td>#{o.id}</td>
              <td>
                {o.ordererName} ({o.ordererPhone})
              </td>
              <td>{o.customerEmail ?? "게스트"}</td>
              <td>{o.itemCount}</td>
              <td>{o.totalPrice.toLocaleString()}원</td>
              <td>
                <Tag variant={statusVariant[o.status] ?? "neutral"}>
                  {statusLabel[o.status] ?? o.status}
                </Tag>
              </td>
              <td>{new Date(o.createdAt).toLocaleString()}</td>
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
        </tbody>
      </Table>
    </main>
  );
}
