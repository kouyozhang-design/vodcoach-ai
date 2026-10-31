import { notFound } from "next/navigation";
import { SharedResult } from "@/components/shared-result";
import { normalizeShareId } from "@/lib/share-snapshot";
import { readShareSnapshot } from "@/lib/share-store";

export const dynamic = "force-dynamic";

export default async function SharedAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shareId = normalizeShareId(id);
  if (!shareId) notFound();
  const snapshot = await readShareSnapshot(shareId);
  if (!snapshot) notFound();
  return <SharedResult snapshot={snapshot} />;
}
