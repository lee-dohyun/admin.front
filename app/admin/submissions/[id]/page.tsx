import { notFound } from "next/navigation";
import SubmissionReview from "./SubmissionReview";
import { isValidId } from "@/lib/submissions";

export default async function SubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidId(id)) notFound();
  return <SubmissionReview id={Number(id)} />;
}
