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
  listPrice: string;
  ratingAvg: string;
  reviewCount: string;
  shippingBadge: string;
  freeShipping: boolean;
  brand: string;
};

const emptyValues: ProductFormValues = {
  categoryId: "",
  name: "",
  description: "",
  price: "",
  stockQuantity: "0",
  imageUrls: "",
  listPrice: "",
  ratingAvg: "",
  reviewCount: "",
  shippingBadge: "",
  freeShipping: false,
  brand: "",
};

export default function ProductForm({ productId }: { productId?: number }) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [values, setValues] = useState<ProductFormValues>(emptyValues);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  // SKU가 2개 이상이면 price/stockQuantity는 활성 variant 중 최저가/합계일 뿐 어느 SKU의
  // 값도 아니다. 백엔드(product.api#47)도 이 경우 요청을 무시하므로, 여기서도 입력을 잠가
  // "저장했는데 안 바뀐다"는 혼란을 막는다 - 실제 수정은 아래 SKU 관리에서.
  const [multiSku, setMultiSku] = useState(false);

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
          listPrice: p.listPrice != null ? String(p.listPrice) : "",
          ratingAvg: p.ratingAvg != null ? String(p.ratingAvg) : "",
          reviewCount: p.reviewCount != null ? String(p.reviewCount) : "",
          shippingBadge: p.shippingBadge ?? "",
          freeShipping: Boolean(p.freeShipping),
          brand: p.brand ?? "",
        });
        const activeVariantCount = (p.variants as { active: boolean }[]).filter((v) => v.active).length;
        setMultiSku(activeVariantCount > 1);
      });
  }, [productId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const newUrls: string[] = [];
      const failures: string[] = [];
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
          // 서버가 형식·크기 거부 사유를 준다(415/413) — 조용히 건너뛰지 않고 알린다.
          const data = await res.json().catch(() => ({}));
          failures.push(`${files[i].name}: ${data.error ?? "업로드 실패"}`);
        }
      }
      if (failures.length > 0) {
        alert(`일부 이미지를 올리지 못했습니다.\n${failures.join("\n")}`);
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
        listPrice: values.listPrice ? Number(values.listPrice) : null,
        ratingAvg: values.ratingAvg ? Number(values.ratingAvg) : null,
        reviewCount: values.reviewCount ? Number(values.reviewCount) : null,
        shippingBadge: values.shippingBadge || null,
        freeShipping: values.freeShipping,
        brand: values.brand || null,
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
          disabled={multiSku}
          required
        />
      </Field>
      <Field label="재고">
        <Input
          type="number"
          min={0}
          value={values.stockQuantity}
          onChange={(e) => setValues({ ...values, stockQuantity: e.target.value })}
          disabled={multiSku}
          required
        />
      </Field>
      {multiSku && (
        <p className="text-sm text-muted">
          SKU가 여러 개인 상품은 가격/재고를 여기서 수정할 수 없습니다. 아래 &quot;옵션 &amp; SKU
          관리&quot;에서 SKU별로 수정하세요.
        </p>
      )}
      <Field label="브랜드">
        <Input
          value={values.brand}
          onChange={(e) => setValues({ ...values, brand: e.target.value })}
        />
      </Field>
      <Field label="정가 (할인 전 가격 - 판매가보다 낮으면 할인율이 음수로 보입니다)">
        <Input
          type="number"
          min={0}
          value={values.listPrice}
          onChange={(e) => setValues({ ...values, listPrice: e.target.value })}
        />
      </Field>
      {/*
        평점·리뷰 수 입력칸은 없앴다(admin.front#48) — 관리자가 직접 적는 평점은 실서비스에서 허위 표시가 된다.
        값 자체는 불러온 그대로 저장 요청에 되돌려 보낸다: product.api 수정 API 는 null 을 "비우라"로
        처리하므로, 안 보내면 수정 한 번에 기존 평점이 지워진다. 리뷰 기능이 생기면 집계값으로 바뀔 자리다.
      */}
      <Field label="배송 배지">
        <select
          value={values.shippingBadge}
          onChange={(e) => setValues({ ...values, shippingBadge: e.target.value })}
          className="input"
        >
          <option value="">없음</option>
          {/* 자체 배지명(product.api#92, 2026-09-30 결정). 표시용이며 배송 약속과 연결돼 있지 않다. */}
          <option value="최적 배송">최적 배송</option>
        </select>
      </Field>
      {/* 무료배송 표시는 판매 정책의 「배송비」에서 정한다(admin.front#56) — 체크박스를 따로 두면 정책과 어긋났다.
          값은 불러온 그대로 되돌려 보내고(정책이 없는 상품의 기존 값 보존), 정책이 있으면 서버가 정책에서 파생한다. */}
      <p className="text-sm">
        무료배송: {values.freeShipping ? "예" : "아니오"} — 아래 「판매 정책」의 「배송비」에서 정합니다.
      </p>
      <Field label="이미지 URL (한 줄에 하나씩)">
        <div className="flex flex-col gap-2">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
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
