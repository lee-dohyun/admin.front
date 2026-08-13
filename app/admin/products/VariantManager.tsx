"use client";

import { useEffect, useState } from "react";
import { Table, Tag } from "@posselect/ui";

type OptionValue = { id: number; value: string };
type Option = { id: number; name: string; values: OptionValue[] };
type VariantOptionValue = { optionId: number; optionName: string; valueId: number; value: string };
type Variant = {
  id: number;
  sku: string | null;
  price: number;
  active: boolean;
  stockQuantity: number;
  optionValues: VariantOptionValue[];
};

export default function VariantManager({ productId }: { productId: number }) {
  const [options, setOptions] = useState<Option[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [newOptionName, setNewOptionName] = useState("");
  const [newValueInputs, setNewValueInputs] = useState<Record<number, string>>({});
  const [selectedValues, setSelectedValues] = useState<Record<number, number>>({});
  const [newVariantSku, setNewVariantSku] = useState("");
  const [newVariantPrice, setNewVariantPrice] = useState("");
  const [newVariantStock, setNewVariantStock] = useState("0");
  const [error, setError] = useState("");

  const load = () => {
    fetch(`/api/admin/products/${productId}`)
      .then((res) => res.json())
      .then((p) => {
        setOptions(p.options ?? []);
        setVariants(p.variants ?? []);
      });
  };

  useEffect(load, [productId]);

  const addOption = async () => {
    if (!newOptionName.trim()) return;
    const res = await fetch(`/api/admin/products/${productId}/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newOptionName }),
    });
    if (res.ok) {
      setNewOptionName("");
      setError("");
      load();
    } else {
      setError("옵션 추가에 실패했습니다.");
    }
  };

  const addValue = async (optionId: number) => {
    const value = newValueInputs[optionId];
    if (!value?.trim()) return;
    const res = await fetch(`/api/admin/products/${productId}/options/${optionId}/values`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (res.ok) {
      setNewValueInputs({ ...newValueInputs, [optionId]: "" });
      setError("");
      load();
    } else {
      setError("옵션값 추가에 실패했습니다.");
    }
  };

  const createVariant = async () => {
    if (!newVariantPrice) {
      setError("가격을 입력하세요.");
      return;
    }
    if (options.length > 0 && Object.keys(selectedValues).length !== options.length) {
      setError("모든 옵션의 값을 선택하세요.");
      return;
    }
    const res = await fetch(`/api/admin/products/${productId}/variants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku: newVariantSku || null,
        price: Number(newVariantPrice),
        stockQuantity: Number(newVariantStock),
        optionValueIds: Object.values(selectedValues),
      }),
    });
    if (res.ok) {
      setNewVariantSku("");
      setNewVariantPrice("");
      setNewVariantStock("0");
      setSelectedValues({});
      setError("");
      load();
    } else {
      setError("SKU 생성에 실패했습니다. 이미 존재하는 옵션 조합이거나 SKU 코드가 중복일 수 있습니다.");
    }
  };

  const updateVariant = async (
    variant: Variant,
    changes: Partial<{ sku: string | null; price: number; stockQuantity: number; active: boolean }>
  ) => {
    const res = await fetch(`/api/admin/products/${productId}/variants/${variant.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku: changes.sku ?? variant.sku,
        price: changes.price ?? variant.price,
        stockQuantity: changes.stockQuantity ?? variant.stockQuantity,
        active: changes.active ?? variant.active,
      }),
    });
    if (res.ok) {
      setError("");
      load();
    } else {
      setError("SKU 수정에 실패했습니다.");
    }
  };

  const deleteVariant = async (variantId: number) => {
    if (variants.length <= 1) {
      setError("상품에는 최소 1개의 SKU가 있어야 합니다.");
      return;
    }
    if (!confirm("이 SKU를 삭제하시겠습니까? 재고 이력도 함께 삭제됩니다.")) return;
    const res = await fetch(`/api/admin/products/${productId}/variants/${variantId}`, { method: "DELETE" });
    if (res.ok) {
      setError("");
      load();
    } else {
      setError("SKU 삭제에 실패했습니다.");
    }
  };

  return (
    <div className="mt-10 pt-6" style={{ borderTop: "1px solid var(--color-divider)" }}>
      <h2 className="text-xl font-bold mb-4">옵션 &amp; SKU 관리</h2>
      {error && (
        <p className="text-sm mb-3" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      )}

      <h3 className="font-semibold mb-2">옵션</h3>
      <div className="flex flex-col gap-3 mb-6">
        {options.map((option) => (
          <div key={option.id} className="card blueprint elev-sm" style={{ padding: 12 }}>
            <div className="font-medium mb-2">{option.name}</div>
            <div className="flex flex-wrap gap-2 mb-2">
              {option.values.map((v) => (
                <Tag key={v.id} variant="neutral">
                  {v.value}
                </Tag>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="새 값 (예: 블랙)"
                value={newValueInputs[option.id] ?? ""}
                onChange={(e) => setNewValueInputs({ ...newValueInputs, [option.id]: e.target.value })}
              />
              <button className="btn btn-secondary" onClick={() => addValue(option.id)}>
                값 추가
              </button>
            </div>
          </div>
        ))}
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="새 옵션 이름 (예: 색상, 사이즈)"
            value={newOptionName}
            onChange={(e) => setNewOptionName(e.target.value)}
          />
          <button className="btn btn-secondary" onClick={addOption}>
            옵션 추가
          </button>
        </div>
      </div>

      <h3 className="font-semibold mb-2">SKU (variant)</h3>
      <Table className="mb-4">
        <thead>
          <tr>
            <th>옵션 조합</th>
            <th>SKU</th>
            <th>가격</th>
            <th>재고</th>
            <th>활성</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {variants.map((v) => (
            <tr key={v.id}>
              <td>
                {v.optionValues.length > 0
                  ? v.optionValues.map((ov) => `${ov.optionName}:${ov.value}`).join(", ")
                  : "(옵션 없음)"}
              </td>
              <td>
                <input
                  className="input"
                  defaultValue={v.sku ?? ""}
                  onBlur={(e) => updateVariant(v, { sku: e.target.value || null })}
                />
              </td>
              <td>
                <input
                  className="input"
                  type="number"
                  defaultValue={v.price}
                  onBlur={(e) => updateVariant(v, { price: Number(e.target.value) })}
                />
              </td>
              <td>
                <input
                  className="input"
                  type="number"
                  defaultValue={v.stockQuantity}
                  onBlur={(e) => updateVariant(v, { stockQuantity: Number(e.target.value) })}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={v.active}
                  onChange={(e) => updateVariant(v, { active: e.target.checked })}
                />
              </td>
              <td>
                <button
                  className="btn btn-ghost"
                  style={{ color: "var(--color-danger)" }}
                  onClick={() => deleteVariant(v.id)}
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <div className="card blueprint elev-sm" style={{ padding: 12 }}>
        <div className="font-medium mb-2">새 SKU 추가</div>
        {options.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {options.map((option) => (
              <select
                key={option.id}
                className="input"
                value={selectedValues[option.id] ?? ""}
                onChange={(e) =>
                  setSelectedValues({ ...selectedValues, [option.id]: Number(e.target.value) })
                }
              >
                <option value="" disabled>
                  {option.name} 선택
                </option>
                {option.values.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.value}
                  </option>
                ))}
              </select>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="SKU (선택)"
            value={newVariantSku}
            onChange={(e) => setNewVariantSku(e.target.value)}
          />
          <input
            className="input"
            type="number"
            placeholder="가격"
            value={newVariantPrice}
            onChange={(e) => setNewVariantPrice(e.target.value)}
          />
          <input
            className="input"
            type="number"
            placeholder="재고"
            value={newVariantStock}
            onChange={(e) => setNewVariantStock(e.target.value)}
          />
          <button className="btn btn-primary" onClick={createVariant}>
            추가
          </button>
        </div>
      </div>
    </div>
  );
}
