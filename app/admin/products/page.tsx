"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BlueprintCorners, Button, Table, Tag } from "@posselect/ui";
import CsvImportModal from "./CsvImportModal";
import { PRODUCT_STATUS_LABEL, type ProductStatus } from "@/lib/products";

type ProductSummary = {
  id: number;
  name: string;
  price: number;
  stockQuantity: number;
  thumbnailUrl: string | null;
  status: ProductStatus;
  sellerId: number;
  sellerName: string;
};

// 파트너가 임시저장한 상품(미공개)과 판매 중 상품을 구별해 보기 위한 필터(admin.front#50).
const FILTERS: { value: string; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "LIVE", label: "판매 중" },
  { value: "DRAFT", label: "미공개" },
  { value: "PAUSED", label: "판매 중지" },
  { value: "ARCHIVED", label: "보관" },
];

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [error, setError] = useState("");
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  // 삭제·CSV 등록 뒤 목록을 다시 읽는다: reloadKey 를 올리면 아래 effect 가 다시 돈다.
  const [reloadKey, setReloadKey] = useState(0);
  const load = () => {
    setError("");
    setReloadKey((k) => k + 1);
  };
  // 필터를 바꾸면 오류를 지운다 — effect 안에서 동기 setState 로 하지 않고 바꾸는 곳(핸들러)에서 한다
  // (react-hooks/set-state-in-effect, gateway#286).
  const changeFilter = (value: string) => {
    setFilter(value);
    setError("");
  };

  useEffect(() => {
    let stale = false;
    fetch(`/api/admin/products?status=${filter}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const list = await res.json();
        if (!stale) setProducts(list);
      })
      .catch(() => {
        if (stale) return;
        setProducts([]);
        setError("상품 목록을 불러오지 못했습니다.");
      });
    return () => {
      stale = true;
    };
  }, [filter, reloadKey]);

  const handleDelete = async (id: number) => {
    if (!confirm("이 상품을 삭제하시겠습니까?")) return;
    await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <main className="max-w-4xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">상품 관리</h1>
        <div className="flex gap-2">
          <button 
            className="btn btn-ghost border border-[var(--color-border)]"
            onClick={() => setIsCsvModalOpen(true)}
          >
            CSV 대량 등록
          </button>
          <Link href="/admin/products/new" className="btn btn-primary blueprint">
            <BlueprintCorners />
            상품 추가
          </Link>
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={filter === f.value ? "primary" : "secondary"}
            onClick={() => changeFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>
      {error && (
        <p className="text-sm mb-3" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      )}
      <Table>
        <thead>
          <tr>
            <th>상태</th>
            <th>이름</th>
            <th>판매자</th>
            <th>가격</th>
            <th>재고</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td>
                <Tag variant={PRODUCT_STATUS_LABEL[p.status]?.variant ?? "neutral"}>
                  {PRODUCT_STATUS_LABEL[p.status]?.label ?? p.status}
                </Tag>
              </td>
              <td>{p.name}</td>
              <td>{p.sellerName}</td>
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

      <CsvImportModal 
        isOpen={isCsvModalOpen} 
        onClose={() => setIsCsvModalOpen(false)} 
        onSuccess={() => load()} 
      />
    </main>
  );
}
