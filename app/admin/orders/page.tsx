"use client";

import { useEffect, useState } from "react";

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
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);

  useEffect(() => {
    fetch("/api/admin/orders")
      .then((res) => res.json())
      .then(setOrders)
      .catch(() => setOrders([]));
  }, []);

  return (
    <main className="max-w-5xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">주문 관리</h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">주문번호</th>
            <th className="py-2">주문자</th>
            <th className="py-2">계정</th>
            <th className="py-2">상품수</th>
            <th className="py-2">금액</th>
            <th className="py-2">상태</th>
            <th className="py-2">주문일시</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b">
              <td className="py-2">#{o.id}</td>
              <td className="py-2">
                {o.ordererName} ({o.ordererPhone})
              </td>
              <td className="py-2">{o.customerEmail ?? "게스트"}</td>
              <td className="py-2">{o.itemCount}</td>
              <td className="py-2">{o.totalPrice.toLocaleString()}원</td>
              <td className="py-2">{statusLabel[o.status] ?? o.status}</td>
              <td className="py-2">{new Date(o.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
