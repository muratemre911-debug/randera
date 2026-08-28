"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { format, parseISO, isAfter } from "date-fns";
import { tr, enUS } from "date-fns/locale";
import { useLanguage } from "@/context/LanguageContext";
import { LogOut, Calendar, Clock, MapPin, Loader2, Building2, Zap, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function MyAppointmentsPage() {
  const supabase = createClient();
  const { t, lang } = useLanguage();
  const router = useRouter();
  
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
      
    setUserProfile(profile);

    const { data: appts, error } = await supabase
      .from("appointments")
      .select(`
        *,
        services (name, duration, price),
        tenants (name, address, phone)
      `)
      .eq("customer_id", user.id)
      .order("start_time", { ascending: false });

    if (appts && !error) {
      setAppointments(appts);
    }
    
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="animate-spin text-indigo-600 h-8 w-8" />
      </div>
    );
  }

  const now = new Date();
  const upcoming = appointments.filter(a => isAfter(parseISO(a.start_time), now) && a.status !== 'cancelled').sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  const past = appointments.filter(a => !isAfter(parseISO(a.start_time), now) || a.status === 'cancelled');

  const locale = lang === "tr" ? tr : enUS;

  const AppointmentCard = ({ appt, isPast }: { appt: any, isPast: boolean }) => (
    <div className={`p-5 rounded-2xl border ${isPast ? 'bg-white/50 border-gray-100 dark:bg-slate-900/50 dark:border-slate-800' : 'bg-white border-indigo-100 shadow-lg shadow-indigo-900/5 dark:bg-slate-900 dark:border-indigo-500/20'} transition-all`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className={`font-bold text-lg ${isPast ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
            {appt.services?.name || 'Hizmet'}
          </h3>
          {appt.services?.price != null && (
            <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
              ₺{appt.services.price}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
            <Building2 size={14} />
            {appt.tenants?.name || 'İşletme'}
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
          appt.status === 'cancelled' 
            ? 'bg-red-50 text-red-600 dark:bg-red-500/10' 
            : isPast 
              ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' 
              : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400'
        }`}>
          {appt.status === 'cancelled' ? (lang === 'tr' ? 'İptal Edildi' : 'Cancelled') : (isPast ? (lang === 'tr' ? 'Tamamlandı' : 'Completed') : (lang === 'tr' ? 'Onaylandı' : 'Confirmed'))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <Calendar size={16} className="text-gray-400" />
          {format(parseISO(appt.start_time), "d MMM yyyy", { locale })}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <Clock size={16} className="text-gray-400" />
          {format(parseISO(appt.start_time), "HH:mm")}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 col-span-2">
          <MapPin size={16} className="text-gray-400" />
          {appt.tenants?.address || (lang === 'tr' ? 'Adres belirtilmemiş' : 'No address provided')}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      

      <div className="max-w-4xl mx-auto px-4 py-8">
        
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-8">
          {lang === 'tr' ? 'Randevularım' : 'My Appointments'}
        </h1>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="mb-10">
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
              {lang === 'tr' ? 'Yaklaşan Randevular' : 'Upcoming Appointments'}
            </h2>
            
            {upcoming.length > 0 ? (
              <div className="grid gap-4">
                {upcoming.map(appt => <AppointmentCard key={appt.id} appt={appt} isPast={false} />)}
              </div>
            ) : (
              <div className="text-center py-10 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-gray-300 dark:border-slate-700">
                <Calendar className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  {lang === 'tr' ? 'Yaklaşan randevunuz bulunmuyor.' : 'No upcoming appointments.'}
                </p>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gray-400"></div>
              {lang === 'tr' ? 'Geçmiş Randevular' : 'Past Appointments'}
            </h2>
            
            {past.length > 0 ? (
              <div className="grid gap-4">
                {past.map(appt => <AppointmentCard key={appt.id} appt={appt} isPast={true} />)}
              </div>
            ) : (
              <div className="text-center py-10 bg-transparent">
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  {lang === 'tr' ? 'Geçmiş randevunuz bulunmuyor.' : 'No past appointments.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
