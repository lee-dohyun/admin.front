"use client";

import { useEffect, useState } from "react";
import { Field } from "@posselect/ui";

type Category = { id: number; name: string; parentId: number | null };

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<number | "">("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch("/api/admin/categories")
      .then((res) => res.json())
      .then(setCategories)
      .catch(() => setCategories([]));
  };

  useEffect(load, []);

  const topLevel = categories.filter((c) => c.parentId == null);
  const childrenOf = (id: number) => categories.filter((c) => c.parentId === id);

  const createCategory = async () => {
    if (!name.trim()) {
      setError("카테고리 이름을 입력하세요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId: parentId === "" ? null : parentId }),
      });
      if (res.ok) {
        setName("");
        setParentId("");
        load();
      } else {
        setError("카테고리 생성에 실패했습니다. 이름이 중복되었을 수 있습니다.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">카테고리 관리</h1>

      <ul className="flex flex-col gap-2 mb-8">
        {topLevel.map((top) => (
          <li key={top.id}>
            <div className="font-medium">{top.name}</div>
            {childrenOf(top.id).length > 0 && (
              <ul className="pl-6 flex flex-col gap-1 mt-1">
                {childrenOf(top.id).map((child) => (
                  <li key={child.id} className="text-muted">
                    └ {child.name}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
        {categories.length === 0 && <li className="text-muted">등록된 카테고리가 없습니다.</li>}
      </ul>

      <div className="card blueprint elev-sm" style={{ padding: 16 }}>
        <h3 className="mb-3">새 카테고리 추가</h3>
        <div className="flex flex-col gap-3 mb-4">
          <Field label="이름">
            <input
              className="input"
              placeholder="예: 아우터, 상의"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="상위 카테고리 (선택)">
            <select
              className="input"
              value={parentId}
              onChange={(e) => setParentId(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">없음 (최상위)</option>
              {topLevel.map((top) => (
                <option key={top.id} value={top.id}>
                  {top.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {error && (
          <p className="text-sm mb-3" style={{ color: "var(--color-danger)" }}>
            {error}
          </p>
        )}
        <button className="btn btn-primary" onClick={createCategory} disabled={saving}>
          {saving ? "추가 중..." : "추가"}
        </button>
      </div>
    </main>
  );
}
