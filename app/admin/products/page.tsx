"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
        <Link href="/admin/products/new" className="px-4 py-2 bg-black text-white rounded">
          상품 추가
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">이름</th>
            <th className="py-2">가격</th>
            <th className="py-2">재고</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-b">
              <td className="py-2">{p.name}</td>
              <td className="py-2">{p.price.toLocaleString()}원</td>
              <td className="py-2">{p.stockQuantity}</td>
              <td className="py-2 text-right">
                <Link href={`/admin/products/${p.id}/edit`} className="underline mr-3">
                  수정
                </Link>
                <button onClick={() => handleDelete(p.id)} className="text-red-600 underline">
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
