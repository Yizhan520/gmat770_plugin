"use client";

import { useEffect, useState } from "react";

interface AdminSessionState {
  isAdmin: boolean;
  isLoading: boolean;
}

export function useAdminSession(): AdminSessionState {
  const [state, setState] = useState<AdminSessionState>({
    isAdmin: false,
    isLoading: true,
  });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/admin/session", {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load admin session.");
        }

        const payload = (await response.json()) as { isAdmin?: boolean };
        if (!cancelled) {
          setState({
            isAdmin: Boolean(payload.isAdmin),
            isLoading: false,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            isAdmin: false,
            isLoading: false,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
