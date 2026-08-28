"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { Calendar as CalendarIcon, Clock, Loader2, CheckCircle2, ChevronRight } from "lucide-react";
import { format, addDays, isSameDay } from "date-fns";
import { tr, enUS } from "date-fns/locale";

const defaultWorkingHours = {
  1: { isOpen: true, open: "09:00", close: "21:00" }, // Mon
  2: { isOpen: true, open: "09:00", close: "21:00" }, // Tue
  3: { isOpen: true, open: "09:00", close: "21:00" }, // Wed
  4: { isOpen: true, open: "09:00", close: "21:00" }, // Thu
  5: { isOpen: true, open: "09:00", close: "21:00" }, // Fri
  6: { isOpen: true, open: "09:00", close: "21:00" }, // Sat
  0: { isOpen: true, open: "09:00", close: "21:00" }, // Sun
};

export default function BookPage() {
  const { slug } = useParams();
  const supabase = createClient();
  const { lang } = useLanguage();
  const router = useRouter();

  const [tenant, setTenant] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [note, setNote] = useState("");

  const availableDates = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));

  useEffect(() => {
    fetchTenantData();
  }, [slug]);

  const fetchTenantData = async () => {
    setLoading(true);
    const { data: tenantData, error: tenantError } = await supabase
      .from("tenants")
      .select("*")
      .eq("slug", slug)
      .single();

    if (tenantError || !tenantData) {
      setError(lang === 'tr' ? "İşletme bulunamadı" : "Business not found");
      setLoading(false);
      return;
    }
    setTenant(tenantData);

    const { data: serviceData } = await supabase
      .from("services")
      .select("*")
      .eq("tenant_id", tenantData.id)
      .order("name");

    if (serviceData) {
      setServices(serviceData);
    }

    setLoading(false);
  };

  const getAvailableTimeSlots = (date: Date) => {
    const dayOfWeek = date.getDay();
    const hours = defaultWorkingHours[dayOfWeek as keyof typeof defaultWorkingHours];

    if (!hours.isOpen) return [];

    const slots = [];
    let currentHour = parseInt(hours.open.split(":")[0]);
    const closeHour = parseInt(hours.close.split(":")[0]);

    while (currentHour < closeHour) {
      slots.push(`${currentHour.toString().padStart(2, '0')}:00`);
      currentHour++;
    }
    return slots;
  };

  const handleBook = async () => {
    if (!selectedService || !selectedDate || !selectedTime) return;
    setBookingLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      alert(lang === 'tr' ? "Randevu almak için giriş yapmalısınız." : "You must log in to book an appointment.");
      router.push('/login');
      return;
    }

    const [hour, min] = selectedTime.split(":");
    const start = new Date(selectedDate);
    start.setHours(parseInt(hour), parseInt(min), 0, 0);

    const end = new Date(start);
    end.setMinutes(end.getMinutes() + selectedService.duration);

    const res = await fetch('/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: tenant.id,
        service_id: selectedService.id,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        note,
      }),
    });

    setBookingLoading(false);

    const data = await res.json();
    if (!res.ok || data.error) {
      alert(data.error || (lang === 'tr' ? 'Randevu oluşturulurken bir hata oluştu.' : 'An error occurred while booking.'));
    } else {
      setBookingSuccess(true);
    }
  };

  if (loading) {
    return <div className="w-full h-64 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600 h-8 w-8" /></div>;
  }

  if (error || !tenant) {
    return <div className="w-full h-64 flex items-center justify-center text-red-500 dark:text-red-400 font-medium">{error}</div>;
  }

  if (bookingSuccess) {
    return (
      <div className="w-full max-w-lg mx-auto flex flex-col items-center justify-center py-20 font-sans">
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-3xl p-10 rounded-[32px] shadow-sm border border-slate-200/60 dark:border-slate-800/60 w-full text-center">
          <CheckCircle2 className="mx-auto h-20 w-20 text-emerald-500 mb-6 drop-shadow-sm" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
            {lang === 'tr' ? 'Randevunuz Onaylandı!' : 'Appointment Confirmed!'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">
            <span className="text-slate-700 dark:text-slate-300 font-bold">{tenant.name}</span> {lang === 'tr' ? 'için randevunuz başarıyla oluşturuldu.' : 'appointment booked successfully.'}
          </p>
          <button
            onClick={() => router.push('/my-appointments')}
            className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-4 rounded-2xl shadow-md hover:-translate-y-0.5 transition-all"
          >
            {lang === 'tr' ? 'Randevularıma Git' : 'Go to My Appointments'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 pb-12 font-sans">
      {/* Business mini header */}
      <div className="flex items-center gap-4 px-2">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white dark:bg-slate-800 shadow-md">
          {tenant.profile_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.profile_image_url} alt={tenant.name} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xl font-bold text-indigo-600">
              {tenant.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">{tenant.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{lang === 'tr' ? 'Randevu Al' : 'Book Appointment'}</p>
        </div>
      </div>

      {/* Step 1: Services */}
      <div className={`transition-opacity duration-300 ${step !== 1 ? 'opacity-50' : 'opacity-100'}`}>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-3 px-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white text-sm shadow-md">1</span>
          {lang === 'tr' ? 'Hizmet Seçin' : 'Select Service'}
        </h2>

        {step === 1 ? (
          <div className="grid gap-4">
            {services.map(svc => (
              <button
                key={svc.id}
                onClick={() => { setSelectedService(svc); setStep(2); }}
                className="flex items-center justify-between p-6 bg-white/70 dark:bg-slate-900/60 backdrop-blur-3xl rounded-[28px] border border-white/50 dark:border-slate-800/60 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-indigo-300 dark:hover:border-indigo-700/50 transition-all text-left group"
              >
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-lg group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{svc.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
                    <Clock size={16} className="text-slate-400 shrink-0" /> {svc.duration} {lang === 'tr' ? 'dk' : 'min'}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 text-xl">₺{svc.price}</span>
                  <ChevronRight size={22} className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                </div>
              </button>
            ))}
            {services.length === 0 && (
              <div className="p-8 text-center bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl rounded-[28px] border border-white/50 dark:border-slate-800/60 text-slate-500 dark:text-slate-400 shadow-sm">
                {lang === 'tr' ? 'Bu işletmenin henüz hizmeti bulunmuyor.' : 'No services available.'}
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 bg-indigo-50/80 dark:bg-indigo-900/20 backdrop-blur-3xl rounded-[28px] border border-indigo-100 dark:border-indigo-800/30 flex justify-between items-center shadow-sm">
            <div>
              <p className="font-semibold text-indigo-900 dark:text-indigo-100 text-lg">{selectedService.name}</p>
              <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mt-0.5">₺{selectedService.price} • {selectedService.duration} dk</p>
            </div>
            <button onClick={() => setStep(1)} className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 underline underline-offset-4 transition-colors">
              {lang === 'tr' ? 'Değiştir' : 'Change'}
            </button>
          </div>
        )}
      </div>

      {/* Step 2: Date & Time */}
      {step >= 2 && (
        <div className={`transition-opacity duration-300 ${step !== 2 ? 'opacity-50' : 'opacity-100'}`}>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-3 px-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white text-sm shadow-md">2</span>
            {lang === 'tr' ? 'Tarih ve Saat' : 'Date & Time'}
          </h2>

          {step === 2 ? (
            <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-3xl p-6 md:p-8 rounded-[28px] shadow-sm border border-white/50 dark:border-slate-800/60">
              <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-wider">{lang === 'tr' ? 'Gün Seçin' : 'Select Day'}</h3>
              <div className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar snap-x">
                {availableDates.map((date, i) => {
                  const isSelected = selectedDate && isSameDay(date, selectedDate);
                  const locale = lang === 'tr' ? tr : enUS;
                  return (
                    <button
                      key={i}
                      onClick={() => { setSelectedDate(date); setSelectedTime(null); }}
                      className={`flex flex-col items-center min-w-[76px] p-3.5 rounded-[20px] border snap-start transition-all duration-300 ${
                        isSelected 
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/30 dark:shadow-indigo-900/50 scale-[1.02]' 
                          : 'bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-600/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 hover:-translate-y-0.5'
                      }`}
                    >
                      <span className={`text-xs font-semibold mb-1.5 uppercase tracking-wide ${isSelected ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-500'}`}>
                        {format(date, 'EEE', { locale })}
                      </span>
                      <span className="text-2xl font-bold leading-none">{format(date, 'd')}</span>
                      <span className={`text-xs mt-1.5 font-medium ${isSelected ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-500'}`}>
                        {format(date, 'MMM', { locale })}
                      </span>
                    </button>
                  )
                })}
              </div>

              {selectedDate && (
                <div className="mt-8 animate-in fade-in slide-in-from-top-4 duration-500">
                  <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-wider">{lang === 'tr' ? 'Saat Seçin' : 'Select Time'}</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {getAvailableTimeSlots(selectedDate).length > 0 ? getAvailableTimeSlots(selectedDate).map((time, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedTime(time)}
                        className={`py-3.5 rounded-[16px] text-sm font-bold border transition-all duration-300 ${
                          selectedTime === time 
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/30 dark:shadow-indigo-900/50 scale-[1.02]' 
                            : 'bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-600/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 hover:-translate-y-0.5'
                        }`}
                      >
                        {time}
                      </button>
                    )) : (
                      <div className="col-span-full text-center py-6 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 text-sm font-medium">
                        {lang === 'tr' ? 'Bu gün için uygun saat yok.' : 'No slots available for this day.'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedDate && selectedTime && (
                <div className="mt-8">
                  <label className="block text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2">
                    {lang === 'tr' ? 'Açıklama (opsiyonel)' : 'Note (optional)'}
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={lang === 'tr' ? 'Randevu hakkında eklemek istediğiniz bir not...' : 'Add a note about your appointment...'}
                    rows={3}
                    className="w-full rounded-[16px] border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  />
                </div>
              )}

              {selectedDate && selectedTime && (
                <button
                  onClick={handleBook}
                  disabled={bookingLoading}
                  className="w-full mt-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-4 rounded-2xl shadow-xl shadow-slate-900/10 hover:shadow-2xl hover:-translate-y-0.5 active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex justify-center items-center gap-2"
                >
                  {bookingLoading ? <Loader2 className="animate-spin" /> : <CalendarIcon size={20} />}
                  {lang === 'tr' ? 'Randevuyu Onayla' : 'Confirm Booking'}
                </button>
              )}
            </div>
          ) : null}
        </div>
      )}

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
