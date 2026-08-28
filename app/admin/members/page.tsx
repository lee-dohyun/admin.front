"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Input, Table, Tag } from "@posselect/ui";

type Member = {
  keycloakUserId: string;
  email: string | null;
  name: string | null;
  emailVerified: boolean;
  enabled: boolean;
  /** false 면 로컬 members 에 연동되지 않은 계정 — 회원가입이 중간에 실패한 흔적이다. */
  linkedToLocal: boolean;
  gradeName: string | null;
  joinedAt: string | null;
  keycloakCreatedAt: string | null;
};

type MemberListResponse = {
  items: Member[];
  total: number;
  page: number;
  size: number;
};

const PAGE_SIZE = 20;

function deleteErrorMessage(status: number): string {
  if (status === 403) {
    return "권한이 없습니다. MEMBER_MANAGER 또는 SYSTEM_ADMIN 역할이 필요합니다.";
  }
  if (status === 404) {
    return "이미 삭제된 계정입니다.";
  }
  return "삭제에 실패했습니다.";
}

/** 로컬 가입일이 있으면 그것을, 없으면(로컬 미연동 계정) Keycloak 생성 시각을 보여준다. */
function formatJoinedAt(member: Member): string {
  const raw = member.joinedAt ?? member.keycloakCreatedAt;
  return raw ? new Date(raw).toLocaleDateString() : "-";
}

export default function AdminMembersPage() {
  const [data, setData] = useState<MemberListResponse | null>(null);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // 삭제 확인 상태: 대상 회원 + 관리자가 입력한 확인 문자열
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [confirmInput, setConfirmInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
    if (search) {
      query.set("search", search);
    }
    fetch(`/api/admin/members?${query}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(res.status === 403 ? "권한이 없습니다." : "회원 목록을 불러오지 못했습니다.");
        }
        return res.json();
      })
      .then(setData)
      .catch((e: Error) => {
        setError(e.message);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(load, [load]);

  const submitSearch = () => {
    setPage(0);
    setSearch(searchInput.trim());
  };

  const openDeleteDialog = (member: Member) => {
    setDeleteTarget(member);
    setConfirmInput("");
    setNotice("");
    setError("");
  };

  // 이메일 재입력을 요구한다. 파기는 되돌릴 수 없고 목록에서 행 하나를 잘못 누르기 쉽다.
  const confirmPhrase = deleteTarget?.email ?? deleteTarget?.keycloakUserId ?? "";
  const canDelete = confirmInput.trim() === confirmPhrase && !deleting;

  const executeDelete = async () => {
    if (!deleteTarget || !canDelete) {
      return;
    }
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/members/${encodeURIComponent(deleteTarget.keycloakUserId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError(deleteErrorMessage(res.status));
        return;
      }
      const result = await res.json();
      setNotice(
        `${deleteTarget.email ?? deleteTarget.keycloakUserId} 파기 완료 — ` +
          `배송지 ${result.deletedAddresses}건, 등급이력 ${result.deletedGradeHistories}건, ` +
          `전화번호 인증 ${result.deletedPhoneVerifications}건 삭제` +
          (result.keycloakDeleted ? ", Keycloak 계정 삭제" : ", Keycloak 계정은 이미 없었음")
      );
      setDeleteTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
    <main className="max-w-6xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-2">회원 관리</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24, fontSize: 14 }}>
        삭제하면 회원의 개인정보(배송지·연락처·인증 이력)와 Keycloak 계정이 파기됩니다.
        <strong> 주문 이력은 법정 보존기간 때문에 남습니다.</strong>
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Input
          type="text"
          placeholder="이메일 또는 이름 검색"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitSearch();
          }}
          style={{ maxWidth: 320 }}
        />
        <Button onClick={submitSearch}>검색</Button>
      </div>

      {error && <p style={{ color: "var(--color-danger)", marginBottom: 16 }}>{error}</p>}
      {notice && <p style={{ color: "var(--color-success)", marginBottom: 16 }}>{notice}</p>}

      {loading && <p>불러오는 중…</p>}

      {!loading && data && (
        <>
          <Table>
            <thead>
              <tr>
                <th>이메일</th>
                <th>이름</th>
                <th>상태</th>
                <th>등급</th>
                <th>가입일</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((m) => (
                <tr key={m.keycloakUserId}>
                  <td>{m.email ?? "-"}</td>
                  <td>{m.name ?? "-"}</td>
                  <td style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {!m.enabled && <Tag variant="danger">비활성</Tag>}
                    {m.emailVerified ? (
                      <Tag variant="success">인증됨</Tag>
                    ) : (
                      <Tag variant="warning">미인증</Tag>
                    )}
                    {!m.linkedToLocal && <Tag variant="neutral">로컬 미연동</Tag>}
                  </td>
                  <td>{m.gradeName ?? "-"}</td>
                  <td>{formatJoinedAt(m)}</td>
                  <td>
                    <button className="btn btn-secondary" onClick={() => openDeleteDialog(m)}>
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 24 }}>
                    회원이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>

          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16 }}>
            <button
              className="btn btn-secondary"
              disabled={page <= 0}
              onClick={() => setPage((p) => p - 1)}
            >
              이전
            </button>
            <span style={{ fontSize: 14 }}>
              {page + 1} / {totalPages} (총 {data.total}명)
            </span>
            <button
              className="btn btn-secondary"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              다음
            </button>
          </div>
        </>
      )}

      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--color-surface)",
              color: "var(--color-text)",
              borderRadius: 8,
              padding: 24,
              maxWidth: 480,
              width: "100%",
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>회원 파기 확인</h2>
            <p style={{ marginBottom: 12, fontSize: 14 }}>
              <strong>{deleteTarget.email ?? deleteTarget.keycloakUserId}</strong> 회원의 개인정보를
              파기하고 Keycloak 계정을 삭제합니다. <strong>되돌릴 수 없습니다.</strong>
            </p>
            <p style={{ marginBottom: 12, fontSize: 13, color: "var(--color-text-muted)" }}>
              주문 이력은 전자상거래법상 보존 대상이라 삭제되지 않습니다.
            </p>
            <p style={{ marginBottom: 8, fontSize: 13 }}>
              확인을 위해 <code>{confirmPhrase}</code> 를 그대로 입력하세요.
            </p>
            <Input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={confirmPhrase}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button
                className="btn btn-secondary"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                취소
              </button>
              <button className="btn btn-primary" disabled={!canDelete} onClick={executeDelete}>
                {deleting ? "파기 중…" : "파기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
