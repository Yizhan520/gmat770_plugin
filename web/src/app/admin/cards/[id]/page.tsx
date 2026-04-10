import { notFound, redirect } from "next/navigation";
import { AdminCardEditor } from "@/components/admin-card-editor";
import { getAdminCardEditor } from "@/lib/cards";
import { hasAdminSession } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";

interface AdminCardEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminCardEditPage({ params }: AdminCardEditPageProps) {
  const isAdmin = await hasAdminSession();
  if (!isAdmin) {
    redirect("/admin");
  }

  const { id } = await params;
  const card = await getAdminCardEditor(id);
  if (!card) {
    notFound();
  }

  return <AdminCardEditor card={card} usingSupabase={hasSupabaseConfig()} />;
}
