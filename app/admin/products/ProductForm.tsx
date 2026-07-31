"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Category = { id: number; name: string };

type ProductFormValues = {
  categoryId: number | "";
  name: string;
  description: string;
  price: string;
  stockQuantity: string;
  imageUrls: string;
};

const emptyValues: ProductFormValues = {
  categoryId: "",
  name: "",
  description: "",
  price: "",
  stockQuantity: "0",
  imageUrls: "",
};

export default function ProductForm({ productId }: { productId?: number }) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [values, setValues] = useState<ProductFormValues>(emptyValues);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/categories")
      .then((res) => res.json())
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!productId) return;
    fetch(`/api/admin/products/${productId}`)
      .then((res) => res.json())
      .then((p) => {
        setValues({
          categoryId: p.category.id,
          name: p.name,
          description: p.description ?? "",
          price: String(p.price),
          stockQuantity: String(p.stockQuantity),
          imageUrls: (p.images as { imageUrl: string }[]).map((i) => i.imageUrl).join("\n"),
        });
      });
  }, [productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const body = JSON.stringify({
        categoryId: Number(values.categoryId),
        name: values.name,
        description: values.description || null,
        price: Number(values.price),
        stockQuantity: Number(values.stockQuantity),
        imageUrls: values.imageUrls.split("\n").map((s) => s.trim()).filter(Boolean),
      });
      const res = await fetch(
        productId ? `/api/admin/products/${productId}` : "/api/admin/products",
        {
          method: productId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body,
        },
      );
      if (!res.ok) {
        setError("저장에 실패했습니다. 입력값을 확인해주세요.");
        return;
      }
      router.push("/admin/products");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-lg">
      <label className="flex flex-col gap-1">
        카테고리
        <select
          value={values.categoryId}
          onChange={(e) => setValues({ ...values, categoryId: Number(e.target.value) })}
          className="border rounded px-3 py-2"
          required
        >
          <option value="" disabled>
            선택하세요
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        이름
        <input
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
          className="border rounded px-3 py-2"
          required
        />
      </label>
      <label className="flex flex-col gap-1">
        설명
        <textarea
          value={values.description}
          onChange={(e) => setValues({ ...values, description: e.target.value })}
          className="border rounded px-3 py-2"
          rows={4}
        />
      </label>
      <label className="flex flex-col gap-1">
        가격
        <input
          type="number"
          min={0}
          value={values.price}
          onChange={(e) => setValues({ ...values, price: e.target.value })}
          className="border rounded px-3 py-2"
          required
        />
      </label>
      <label className="flex flex-col gap-1">
        재고
        <input
          type="number"
          min={0}
          value={values.stockQuantity}
          onChange={(e) => setValues({ ...values, stockQuantity: e.target.value })}
          className="border rounded px-3 py-2"
          required
        />
      </label>
      <label className="flex flex-col gap-1">
        이미지 URL (한 줄에 하나씩)
        <textarea
          value={values.imageUrls}
          onChange={(e) => setValues({ ...values, imageUrls: e.target.value })}
          className="border rounded px-3 py-2"
          rows={3}
        />
      </label>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
      >
        {saving ? "저장 중..." : "저장"}
      </button>
    </form>
  );
}
