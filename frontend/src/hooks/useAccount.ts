"use client";
import { useState, useEffect } from "react";
import { accountApi, debtApi } from "@/lib/api";
import type { Account, UserProfile, FreedomDateResponse } from "@/types";
import { getPersonalAccountId } from "@/lib/utils";

export function useAccount() {
  const [account, setAccount] = useState<Account | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = getPersonalAccountId();
    if (!id) { setLoading(false); return; }
    Promise.all([accountApi.getAccount(id), accountApi.getProfile(id)])
      .then(([acc, prof]) => { setAccount(acc); setProfile(prof); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { account, profile, loading, error };
}

export function useFreedomDate() {
  const [data, setData] = useState<FreedomDateResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = getPersonalAccountId();
    if (!id) { setLoading(false); return; }
    debtApi.freedomDate(id)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}
