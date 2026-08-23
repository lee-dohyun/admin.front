"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Textarea } from "@posselect/ui";

type Category = { id: number; name: string; parentId: number | null };

// 부모 카테고리 다음에 그 자식들이 바로 오도록 정렬 - 셀렉트 박스에서 들여쓰기로 계층을 표현하기 위함
function orderByHierarchy(categories: Category[]): Category[] {
  const topLevel = categories.filter((c) => c.parentId == null);
  return topLevel.flatMap((top) => [
    top,
    ...categories.filter((c) => c.parentId === top.id),
  ]);
}

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
  const [uploading, setUploading] = useState(false);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append("file", files[i]);

        const res = await fetch("/api/admin/upload", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          newUrls.push(data.imageUrl);
        } else {
          console.error("Upload failed for file", files[i].name);
        }
      }
      if (newUrls.length > 0) {
        setValues((prev) => ({
          ...prev,
          imageUrls: prev.imageUrls ? `${prev.imageUrls}\n${newUrls.join("\n")}` : newUrls.join("\n"),
        }));
      }
    } catch (err) {
      console.error(err);
      alert("이미지 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = "";
    }
  };

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
      <Field label="카테고리">
        <select
          value={values.categoryId}
          onChange={(e) => setValues({ ...values, categoryId: Number(e.target.value) })}
          className="input"
          required
        >
          <option value="" disabled>
            선택하세요
          </option>
          {orderByHierarchy(categories).map((c) => (
            <option key={c.id} value={c.id}>
              {c.parentId ? `　└ ${c.name}` : c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="이름">
        <Input
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
          required
        />
      </Field>
      <Field label="설명">
        <Textarea
          value={values.description}
          onChange={(e) => setValues({ ...values, description: e.target.value })}
          rows={4}
        />
      </Field>
      <Field label="가격">
        <Input
          type="number"
          min={0}
          value={values.price}
          onChange={(e) => setValues({ ...values, price: e.target.value })}
          required
        />
      </Field>
      <Field label="재고">
        <Input
          type="number"
          min={0}
          value={values.stockQuantity}
          onChange={(e) => setValues({ ...values, stockQuantity: e.target.value })}
          required
        />
      </Field>
      <Field label="이미지 URL (한 줄에 하나씩)">
        <div className="flex flex-col gap-2">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            disabled={uploading}
            className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[var(--color-primary)] file:text-white hover:file:opacity-90"
          />
          {uploading && <span className="text-sm text-gray-500">이미지 업로드 중...</span>}
          <Textarea
            value={values.imageUrls}
            onChange={(e) => setValues({ ...values, imageUrls: e.target.value })}
            rows={3}
          />
        </div>
      </Field>
      {error && (
        <p className="text-sm" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" block disabled={saving}>
        {saving ? "저장 중..." : "저장"}
      </Button>
    </form>
  );
}
