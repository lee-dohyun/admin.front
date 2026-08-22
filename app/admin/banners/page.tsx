"use client";

import { useEffect, useState } from "react";
import { Field } from "@posselect/ui";

type Banner = {
  id: number;
  title: string;
  subtitle: string;
  imageUrl: string;
  link: string;
  bgColor: string;
  sortOrder: number;
  isActive: boolean;
};

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // Form state
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [link, setLink] = useState("");
  const [bgColor, setBgColor] = useState("");
  const [sortOrder, setSortOrder] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch("/api/admin/banners")
      .then((res) => res.json())
      .then((data) => setBanners(data))
      .catch(() => setBanners([]));
  };

  useEffect(load, []);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setSubtitle("");
    setImageUrl("");
    setLink("");
    setBgColor("");
    setSortOrder(0);
    setIsActive(true);
    setError("");
  };

  const handleEdit = (b: Banner) => {
    setEditingId(b.id);
    setTitle(b.title || "");
    setSubtitle(b.subtitle || "");
    setImageUrl(b.imageUrl || "");
    setLink(b.link || "");
    setBgColor(b.bgColor || "");
    setSortOrder(b.sortOrder || 0);
    setIsActive(b.isActive);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("정말 이 배너를 삭제하시겠습니까?")) return;
    
    try {
      const res = await fetch(`/api/admin/banners/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        load();
        if (editingId === id) resetForm();
      } else {
        alert("삭제에 실패했습니다.");
      }
    } catch (e) {
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  const saveBanner = async () => {
    if (!title.trim()) {
      setError("배너 타이틀을 입력하세요.");
      return;
    }
    
    setSaving(true);
    setError("");
    
    const payload = {
      title,
      subtitle,
      imageUrl,
      link,
      bgColor,
      sortOrder,
      isActive
    };

    try {
      const url = editingId ? `/api/admin/banners/${editingId}` : "/api/admin/banners";
      const method = editingId ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (res.ok) {
        resetForm();
        load();
      } else {
        setError("저장에 실패했습니다.");
      }
    } catch (e) {
      setError("요청 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">배너 관리</h1>

      <div className="card blueprint elev-sm mb-8" style={{ padding: 16 }}>
        <h3 className="mb-4">{editingId ? "배너 수정" : "새 배너 추가"}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Field label="타이틀 *">
            <input
              className="input"
              placeholder="예: 봄맞이 특별 할인"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="서브타이틀">
            <input
              className="input"
              placeholder="예: 전 품목 최대 50%"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
            />
          </Field>
          <Field label="이미지 URL">
            <input
              className="input"
              placeholder="https://..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </Field>
          <Field label="링크 URL">
            <input
              className="input"
              placeholder="/categories/1"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
          </Field>
          <Field label="배경색 (Hex)">
            <input
              className="input"
              placeholder="예: #ff7b54"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
            />
          </Field>
          <Field label="노출 순서">
            <input
              type="number"
              className="input"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
            />
          </Field>
          <Field label="활성 상태">
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4"
              />
              <span>활성화</span>
            </label>
          </Field>
        </div>
        
        {error && (
          <p className="text-sm mb-3" style={{ color: "var(--color-danger)" }}>
            {error}
          </p>
        )}
        
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={saveBanner} disabled={saving}>
            {saving ? "저장 중..." : (editingId ? "수정 완료" : "추가")}
          </button>
          {editingId && (
            <button className="btn" onClick={resetForm} disabled={saving}>
              취소
            </button>
          )}
        </div>
      </div>

      <div className="card blueprint p-0 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="p-4 font-medium text-sm text-gray-500">순서</th>
              <th className="p-4 font-medium text-sm text-gray-500">배너</th>
              <th className="p-4 font-medium text-sm text-gray-500">배경/링크</th>
              <th className="p-4 font-medium text-sm text-gray-500">상태</th>
              <th className="p-4 font-medium text-sm text-gray-500 w-24">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {banners.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">등록된 배너가 없습니다.</td>
              </tr>
            ) : (
              banners.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50/50">
                  <td className="p-4 align-middle">{b.sortOrder}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {b.imageUrl ? (
                        <img src={b.imageUrl} alt={b.title} className="w-16 h-10 object-cover rounded bg-gray-100" />
                      ) : (
                        <div 
                          className="w-16 h-10 rounded flex items-center justify-center text-xs text-white"
                          style={{ backgroundColor: b.bgColor || '#ccc' }}
                        >
                          No Img
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-sm">{b.title}</div>
                        {b.subtitle && <div className="text-xs text-gray-500 mt-1">{b.subtitle}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 align-middle text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: b.bgColor || 'transparent' }}></span>
                      <span className="text-gray-600">{b.bgColor || '-'}</span>
                    </div>
                    {b.link && <div className="text-gray-500 truncate max-w-[150px]" title={b.link}>{b.link}</div>}
                  </td>
                  <td className="p-4 align-middle">
                    <span className={`px-2 py-1 text-xs rounded-full ${b.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {b.isActive ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="p-4 align-middle">
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(b)} className="text-blue-600 hover:underline text-sm">수정</button>
                      <button onClick={() => handleDelete(b.id)} className="text-red-600 hover:underline text-sm">삭제</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
