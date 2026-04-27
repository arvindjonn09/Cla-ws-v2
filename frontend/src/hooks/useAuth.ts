"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { User, AuthState } from "@/types";
import { accountApi, authApi } from "@/lib/api";
import { saveTokens, clearTokens, saveAccountMeta, saveAccountMemberships } from "@/lib/utils";

function parseJwt(token: string): Record<string, unknown> | null {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

async function getOnboardingComplete(accountId: string | null): Promise<boolean> {
  if (!accountId) return false;
  const profile = await accountApi.getProfile(accountId);
  return profile.onboarding_complete;
}

export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    accountId: null,
    accountType: null,
    role: null,
    isLoading: true,
  });

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }
    const payload = parseJwt(token);
    if (!payload || (payload.exp as number) * 1000 < Date.now()) {
      clearTokens();
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }
    const userRaw = localStorage.getItem("user");
    const user: User | null = userRaw ? JSON.parse(userRaw) : null;
    setState({
      user,
      accountId: payload.account_id as string | null,
      accountType: (payload.account_type as "personal" | "joint") ?? null,
      role: (payload.role as "member" | "viewer") ?? null,
      isLoading: false,
    });
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await authApi.login({ email, password });
      saveTokens(data.access_token, data.refresh_token);
      localStorage.setItem("user", JSON.stringify(data.user));

      const payload = parseJwt(data.access_token);
      const accountId = payload?.account_id as string | null;
      const accountType = (payload?.account_type as string) ?? "personal";
      const role = (payload?.role as string) ?? "member";

      const onboardingComplete = await getOnboardingComplete(accountId);

      if (accountId) {
        saveAccountMeta(accountId, accountType, role, onboardingComplete);
      }
      const memberships = await accountApi.listMine().catch(() => []);
      saveAccountMemberships(memberships);

      setState({
        user: data.user,
        accountId,
        accountType: accountType as "personal" | "joint",
        role: role as "member" | "viewer",
        isLoading: false,
      });

      if (onboardingComplete) {
        router.push("/dashboard");
      } else {
        router.push("/onboarding");
      }
    },
    [router]
  );

  const logout = useCallback(async () => {
    const refresh = localStorage.getItem("refresh_token");
    if (refresh) {
      try { await authApi.logout(refresh); } catch { /* ignore */ }
    }
    clearTokens();
    setState({ user: null, accountId: null, accountType: null, role: null, isLoading: false });
    router.push("/login");
  }, [router]);

  return { ...state, login, logout };
}
