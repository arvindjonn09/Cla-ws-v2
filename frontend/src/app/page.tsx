"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      const onboarded = localStorage.getItem("onboarding_complete");
      router.replace(onboarded === "true" ? "/dashboard" : "/onboarding");
    } else {
      router.replace("/login");
    }
  }, [router]);
  return null;
}
