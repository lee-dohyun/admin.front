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
};

const statusVariant: Record<string, "warning" | "success"> = {
  CREATED: "warning",
  PAID: "success",
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
            </tr>
          ))}
        </tbody>
      </Table>
    </main>
  );
}
