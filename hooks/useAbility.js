"use client";
import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { criarAbility } from "@/lib/permissoes";

export function useAbility() {
  const { data: session } = useSession();
  return useMemo(() => criarAbility(session?.regras), [session?.regras]);
}
