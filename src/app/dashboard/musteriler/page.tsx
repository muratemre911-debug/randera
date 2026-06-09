"use client";

import { useEffect, useState } from "react";
import { Search, CalendarDays, Phone, Mail, ChevronRight, User } from "lucide-react";
import { createClient } from "@/utils/supabase/client";



interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  created_at: string;
  appointment_count?: number;
}

export default function MusterilerPage() {
  const supabase = createClient();
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchCustomers = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, phone, created_at")
      .eq("tenant_id", user.id)
      .eq("role", "customer")
      .order("full_name");

    if (profiles) {
      const customerIds = profiles.map((p) => p.id);
      const { data: counts } = await supabase
        .from("appointments")
        .select("customer_id")
        .in("customer_id", customerIds)
        .neq("status", "cancelled");

      const countMap = new Map<string, number>();
      if (counts) {
        counts.forEach((a) => {
          countMap.set(a.customer_id, (countMap.get(a.customer_id) || 0) + 1);
        });
      }

      setCustomers(
        profiles.map((p) => ({
          ...p,
          appointment_count: countMap.get(p.id) || 0,
        })),
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filtered = customers.filter((c) =>
    c.full_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto space-y-6">
      {/* Search Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Kişiler
          </h1>
          <p className="mt-1 text-sm font-medium text-gray-500 dark:text-slate-400">
            {customers.length} müşteri kayıtlı
          </p>
        </div>
        
        <div className="relative w-full">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ara..."
            className="w-full rounded-2xl border-0 bg-white/60 py-3.5 pl-11 pr-4 text-base text-gray-900 placeholder-gray-400 shadow-[0_4px_20px_rgb(0,0,0,0.03)] backdrop-blur-3xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder-slate-500 transition-all"
          />
        </div>
      </div>

      {/* iOS Contacts Style List */}
      <div className="overflow-hidden rounded-[32px] bg-white/70 backdrop-blur-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-slate-900/60 dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-white/50 dark:border-slate-700/50">
        <div className="flex flex-col">
          {loading ? (
            <div className="p-8 text-center text-sm font-medium text-gray-500 dark:text-slate-400">
              Yükleniyor...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800 mb-4">
                <User className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {search ? "Sonuç bulunamadı" : "Kişi yok"}
              </p>
            </div>
          ) : (
            filtered.map((customer, index) => (
              <div key={customer.id} className="group relative">
                {/* Inset Divider (starts after the avatar) */}
                {index !== 0 && (
                  <div className="absolute top-0 right-0 left-[76px] h-[1px] bg-gray-200/50 dark:bg-slate-700/50" />
                )}
                
                <div className="flex items-center justify-between p-4 pl-5 hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-gray-200 text-lg font-semibold text-gray-700 shadow-inner dark:from-slate-700 dark:to-slate-800 dark:text-slate-300">
                      {customer.full_name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    
                    <div>
                      <h3 className="text-[17px] font-semibold text-gray-900 dark:text-white tracking-tight">
                        {customer.full_name}
                      </h3>
                      {customer.phone && (
                        <p className="text-sm font-medium text-gray-500 dark:text-slate-400">
                          {customer.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Badge for appointments */}
                    {customer.appointment_count ? (
                      <div className="hidden sm:flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                        <CalendarDays size={12} />
                        {customer.appointment_count}
                      </div>
                    ) : null}
                    <ChevronRight size={20} className="text-gray-300 dark:text-slate-600 group-hover:text-gray-400 transition-colors" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
