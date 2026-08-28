"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function DynamicLogoLink({ children, className }: { children: React.ReactNode, className?: string }) {
  const [href, setHref] = useState("/");
  const supabase = createClient();

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setHref("/");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role === "owner") {
        setHref("/dashboard");
      } else if (profile?.role === "customer") {
        setHref("/my-appointments");
      }
    };
    fetchRole();
  }, []);

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
