import { redirect } from "next/navigation";
import { AdminCardEditor } from "@/components/admin-card-editor";
import { hasAdminSession } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/env";

export default async function AdminNewCardPage() {
  const isAdmin = await hasAdminSession();
  if (!isAdmin) {
    redirect("/admin");
  }

  return <AdminCardEditor card={null} usingSupabase={hasSupabaseConfig()} />;
}
