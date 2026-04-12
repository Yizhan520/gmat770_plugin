"use client";

import dynamic from "next/dynamic";
import { useAdminSession } from "@/lib/use-admin-session";
import type { MistakeCard } from "@/lib/types";

const AdminCardActions = dynamic(
  () => import("@/components/admin-card-actions").then((module) => module.AdminCardActions),
  {
    ssr: false,
  },
);

interface DetailAdminPanelProps {
  card: MistakeCard;
}

export function DetailAdminPanel({ card }: DetailAdminPanelProps) {
  const { isAdmin, isLoading } = useAdminSession();

  if (isLoading || !isAdmin) {
    return null;
  }

  return <AdminCardActions card={card} />;
}
