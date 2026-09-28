import { NextRequest, NextResponse } from "next/server";
import { PRODUCT_API_URL, adminHeaders, adminToken } from "@/lib/backend";
import { isValidId } from "@/lib/submissions";

/**
 * 심사 화면 한 장에 필요한 것을 한 번에 모은다: 제출(이슈 포함) + 상품 + 고시 값 + 카테고리 요구사항.
 * 상품·고시는 staff 토큰으로 불러야 DRAFT 가 보인다(product.api#74).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidId(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const headers = adminHeaders(adminToken(request));
  const get = (path: string) => fetch(`${PRODUCT_API_URL}${path}`, { cache: "no-store", headers });

  const subRes = await get(`/api/submissions/${id}`);
  if (!subRes.ok) {
    return new NextResponse(await subRes.text(), { status: subRes.status });
  }
  const submission = await subRes.json();

  const [productRes, attrRes] = await Promise.all([
    get(`/api/products/${submission.productId}`),
    get(`/api/products/${submission.productId}/attributes`),
  ]);
  const product = productRes.ok ? await productRes.json() : null;
  const attributes = attrRes.ok ? await attrRes.json() : [];

  let requirement = null;
  if (product?.category?.id) {
    const reqRes = await get(`/api/categories/${product.category.id}/requirement`);
    requirement = reqRes.ok ? await reqRes.json() : null;
  }

  return NextResponse.json({ submission, product, attributes, requirement });
}
