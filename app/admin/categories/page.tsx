"use client";

import { useEffect, useState } from "react";
import { Field } from "@posselect/ui";

type Category = { id: number; name: string; parentId: number | null; sortOrder: number };

/**
 * 카테고리 관리 화면 (product.api#61 / admin.front#40).
 *
 * 목록 순서는 백엔드가 (sortOrder, id) 로 정렬해 준 배열 순서를 그대로 쓴다 — 화면에서 다시
 * 정렬하지 않는다. 프론트가 자체 기준으로 재정렬하면 관리자가 여기서 맞춰 놓은 순서와
 * 실제 노출(헤더 카테고리 메뉴, 메인 페이지 섹션) 순서가 갈라진다.
 */
export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<number | "">("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // 인라인 수정 중인 항목. null 이면 아무것도 수정 중이 아니다.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editParentId, setEditParentId] = useState<number | "">("");

  const load = () => {
    fetch("/api/admin/categories")
      .then((res) => res.json())
      .then(setCategories)
      .catch(() => setCategories([]));
  };

  useEffect(load, []);

  const topLevel = categories.filter((c) => c.parentId == null);
  const childrenOf = (id: number) => categories.filter((c) => c.parentId === id);

  /**
   * 백엔드가 거부 사유를 평문 본문에 담아 준다(409/400). 그대로 보여준다 —
   * "실패했습니다" 로 뭉뚱그리면 관리자가 다음에 뭘 해야 할지 알 수 없다.
   */
  const readError = async (res: Response, fallback: string) => {
    const text = await res.text();
    return text.trim() || fallback;
  };

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
        setError(await readError(res, "카테고리 생성에 실패했습니다."));
      }
    } finally {
      setSaving(false);
    }
  };

  /** PUT 은 전체 교체다 — 바꾸지 않는 필드도 현재값을 그대로 실어 보낸다. */
  const putCategory = async (
    target: Category,
    changes: Partial<Pick<Category, "name" | "parentId" | "sortOrder">>
  ): Promise<boolean> => {
    const res = await fetch(`/api/admin/categories/${target.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: changes.name ?? target.name,
        parentId: changes.parentId !== undefined ? changes.parentId : target.parentId,
        sortOrder: changes.sortOrder ?? target.sortOrder,
      }),
    });
    if (!res.ok) {
      setError(await readError(res, "수정에 실패했습니다."));
      return false;
    }
    return true;
  };

  const startEdit = (category: Category) => {
    setError("");
    setEditingId(category.id);
    setEditName(category.name);
    setEditParentId(category.parentId ?? "");
  };

  const saveEdit = async (category: Category) => {
    if (!editName.trim()) {
      setError("카테고리 이름을 입력하세요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const ok = await putCategory(category, {
        name: editName,
        parentId: editParentId === "" ? null : editParentId,
      });
      if (ok) {
        setEditingId(null);
        load();
      }
    } finally {
      setSaving(false);
    }
  };

  /**
   * 위/아래 이동 = 같은 부모를 가진 이웃과 sortOrder 를 맞바꾼다.
   *
   * 드래그앤드롭 대신 버튼인 이유: 2뎁스에 형제가 몇 개뿐이라 버튼으로 충분하고,
   * 드래그는 터치/키보드 접근성을 따로 만들어야 한다.
   *
   * sortOrder 에는 유니크 제약이 없으므로 임시값을 거칠 필요 없이 바로 교환해도 된다.
   * 두 번의 PUT 중 뒤엣것이 실패하면 순서가 어긋난 채로 남는데, 그 경우 사유를 띄우고
   * 목록을 다시 읽어 실제 상태를 보여준다.
   */
  const move = async (category: Category, direction: -1 | 1) => {
    const siblings = category.parentId == null ? topLevel : childrenOf(category.parentId);
    const index = siblings.findIndex((c) => c.id === category.id);
    const neighbor = siblings[index + direction];
    if (!neighbor) return;

    setSaving(true);
    setError("");
    try {
      const ok = await putCategory(category, { sortOrder: neighbor.sortOrder });
      if (ok) {
        await putCategory(neighbor, { sortOrder: category.sortOrder });
      }
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (category: Category) => {
    if (!confirm(`"${category.name}" 카테고리를 삭제하시겠습니까?`)) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/categories/${category.id}`, { method: "DELETE" });
      if (!res.ok) {
        // 하위 카테고리나 상품이 달려 있으면 백엔드가 409 와 함께 개수를 알려준다.
        setError(await readError(res, "삭제에 실패했습니다."));
      }
      load();
    } finally {
      setSaving(false);
    }
  };

  const renderRow = (category: Category, siblings: Category[], depth: number) => {
    const index = siblings.findIndex((c) => c.id === category.id);
    const isEditing = editingId === category.id;

    if (isEditing) {
      return (
        <div className="flex flex-col gap-2 py-2" style={{ paddingLeft: depth * 24 }}>
          <input
            className="input"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            aria-label="카테고리 이름"
          />
          <select
            className="input"
            value={editParentId}
            onChange={(e) => setEditParentId(e.target.value === "" ? "" : Number(e.target.value))}
            aria-label="상위 카테고리"
          >
            <option value="">없음 (최상위)</option>
            {topLevel
              // 자기 자신을 상위로 고르는 선택지는 아예 없앤다. 백엔드도 400 으로 막지만,
              // 고를 수 없게 하는 편이 낫다.
              .filter((top) => top.id !== category.id)
              .map((top) => (
                <option key={top.id} value={top.id}>
                  {top.name}
                </option>
              ))}
          </select>
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={() => saveEdit(category)} disabled={saving}>
              저장
            </button>
            <button className="btn btn-ghost" onClick={() => setEditingId(null)} disabled={saving}>
              취소
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        className="flex items-center justify-between gap-2 py-2"
        style={{ paddingLeft: depth * 24 }}
      >
        <span className={depth > 0 ? "text-muted" : "font-medium"}>
          {depth > 0 && "└ "}
          {category.name}
        </span>
        <div className="flex gap-1">
          <button
            className="btn btn-ghost"
            onClick={() => move(category, -1)}
            disabled={saving || index === 0}
            aria-label={`${category.name} 위로`}
          >
            ↑
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => move(category, 1)}
            disabled={saving || index === siblings.length - 1}
            aria-label={`${category.name} 아래로`}
          >
            ↓
          </button>
          <button className="btn btn-ghost" onClick={() => startEdit(category)} disabled={saving}>
            수정
          </button>
          <button
            className="btn btn-ghost"
            style={{ color: "var(--color-danger)" }}
            onClick={() => remove(category)}
            disabled={saving}
          >
            삭제
          </button>
        </div>
      </div>
    );
  };

  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">카테고리 관리</h1>

      {error && (
        <p className="text-sm mb-4" style={{ color: "var(--color-danger)" }} role="alert">
          {error}
        </p>
      )}

      <ul className="flex flex-col mb-8">
        {topLevel.map((top) => (
          <li key={top.id} style={{ borderBottom: "1px solid var(--color-divider)" }}>
            {renderRow(top, topLevel, 0)}
            {childrenOf(top.id).map((child) => (
              <div key={child.id}>{renderRow(child, childrenOf(top.id), 1)}</div>
            ))}
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
        <button className="btn btn-primary" onClick={createCategory} disabled={saving}>
          {saving ? "처리 중..." : "추가"}
        </button>
      </div>
    </main>
  );
}
