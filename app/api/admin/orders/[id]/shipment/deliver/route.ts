import { NextRequest, NextResponse } from "next/server";
import { ORDER_API_URL, adminHeaders } from "@/lib/backend";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = request.cookies.get("ADMIN_ACCESS_TOKEN")!.value;
  const res = await fetch(`${ORDER_API_URL}/api/orders/${id}/shipment/deliver`, {
    method: "PUT",
    headers: adminHeaders(token),
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
