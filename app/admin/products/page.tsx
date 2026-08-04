"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BlueprintCorners, Table } from "@posselect/ui";

type ProductSummary = {
  id: number;
  name: string;
  price: number;
  stockQuantity: number;
  thumbnailUrl: string | null;
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductSummary[]>([]);

  const load = () => {
    fetch("/api/admin/products")
      .then((res) => res.json())
      .then(setProducts)
      .catch(() => setProducts([]));
  };

  useEffect(load, []);

  const handleDelete = async (id: number) => {
    if (!confirm("이 상품을 삭제하시겠습니까?")) return;
    await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <main className="max-w-4xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">상품 관리</h1>
        <Link href="/admin/products/new" className="btn btn-primary blueprint">
          <BlueprintCorners />
          상품 추가
        </Link>
      </div>
      <Table>
        <thead>
          <tr>
            <th>이름</th>
            <th>가격</th>
            <th>재고</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.price.toLocaleString()}원</td>
              <td>{p.stockQuantity}</td>
              <td className="text-right">
                <Link href={`/admin/products/${p.id}/edit`} className="btn btn-ghost">
                  수정
                </Link>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="btn btn-ghost"
                  style={{ color: "var(--color-danger)" }}
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </main>
  );
}
