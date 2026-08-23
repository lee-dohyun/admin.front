"use client";

import { useState } from "react";
import Papa from "papaparse";
import { Button } from "@posselect/ui";

type CsvImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

type CsvRow = {
  categoryId?: string;
  name?: string;
  description?: string;
  price?: string;
  stockQuantity?: string;
  imageUrls?: string;
};

export default function CsvImportModal({ isOpen, onClose, onSuccess }: CsvImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ total: 0, current: 0 });
  const [errors, setErrors] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = () => {
    if (!file) return;

    setIsProcessing(true);
    setErrors([]);

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;
        setProgress({ total: rows.length, current: 0 });
        
        let successCount = 0;
        const newErrors: string[] = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          try {
            // Validate required fields
            if (!row.categoryId || !row.name || !row.price || !row.stockQuantity) {
              throw new Error("필수 필드(categoryId, name, price, stockQuantity) 누락");
            }

            const body = JSON.stringify({
              categoryId: Number(row.categoryId),
              name: row.name,
              description: row.description || null,
              price: Number(row.price),
              stockQuantity: Number(row.stockQuantity),
              imageUrls: row.imageUrls ? row.imageUrls.split(",").map(url => url.trim()).filter(Boolean) : [],
            });

            const res = await fetch("/api/admin/products", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body,
            });

            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.message || "서버 에러");
            }

            successCount++;
          } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            newErrors.push(`[${i + 1}행] ${row.name || "이름없음"} - ${errorMessage}`);
          }
          
          setProgress((prev) => ({ ...prev, current: i + 1 }));
        }

        setIsProcessing(false);
        setErrors(newErrors);
        
        if (successCount > 0) {
          alert(`${successCount}개의 상품이 성공적으로 등록되었습니다.`);
          if (newErrors.length === 0) {
            onSuccess();
            onClose();
          } else {
            onSuccess(); // 일부 성공 시에도 목록 새로고침
          }
        } else {
          alert("상품 등록에 실패했습니다. 에러 내역을 확인해주세요.");
        }
      },
      error: (error) => {
        setErrors([`CSV 파싱 에러: ${error.message}`]);
        setIsProcessing(false);
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--color-bg)] p-6 rounded-lg shadow-xl w-full max-w-lg border border-[var(--color-border)]">
        <h2 className="text-xl font-bold mb-4 text-[var(--color-text)]">CSV 대량 등록</h2>
        
        <div className="mb-4 text-sm text-[var(--color-text-muted)]">
          <p>CSV 파일 첫 줄에는 다음 헤더가 포함되어야 합니다:</p>
          <code className="block mt-2 p-2 bg-[var(--color-bg-alt)] rounded">
            categoryId, name, description, price, stockQuantity, imageUrls
          </code>
          <p className="mt-2">* imageUrls는 콤마(,)로 구분된 여러 URL을 입력할 수 있습니다.</p>
        </div>

        <div className="mb-4">
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileChange}
            disabled={isProcessing}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[var(--color-primary)] file:text-white hover:file:opacity-90"
          />
        </div>

        {isProcessing && (
          <div className="mb-4">
            <div className="text-sm mb-1 text-[var(--color-text)]">
              진행 상태: {progress.current} / {progress.total}
            </div>
            <div className="w-full bg-[var(--color-bg-alt)] rounded-full h-2.5">
              <div 
                className="bg-[var(--color-primary)] h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        )}

        {errors.length > 0 && (
          <div className="mb-4 max-h-32 overflow-y-auto p-2 bg-red-50 text-red-600 text-sm rounded border border-red-200">
            <ul className="list-disc pl-4">
              {errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onClose} disabled={isProcessing}>취소</Button>
          <Button variant="primary" onClick={handleImport} disabled={!file || isProcessing}>
            {isProcessing ? "처리 중..." : "등록 시작"}
          </Button>
        </div>
      </div>
    </div>
  );
}
