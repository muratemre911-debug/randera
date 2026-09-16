"use client";

import React, { useState, useEffect } from "react";
import { Star, X, CheckCircle2, Loader2, Sparkles } from "lucide-react";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  businessName: string;
  serviceName?: string;
  initialRating?: number;
  initialComment?: string;
  onSuccess: (review: { rating: number; comment: string }) => void;
}

const RATING_LABELS: Record<number, { tr: string; en: string }> = {
  5: { tr: "Olağanüstü! 🌟", en: "Outstanding! 🌟" },
  4: { tr: "Çok İyi 👍", en: "Very Good 👍" },
  3: { tr: "İyi 🙂", en: "Good 🙂" },
  2: { tr: "İdare Eder 😐", en: "Fair 😐" },
  1: { tr: "Memnun Kalmadım 👎", en: "Poor 👎" },
};

export default function ReviewModal({
  isOpen,
  onClose,
  appointmentId,
  businessName,
  serviceName,
  initialRating = 5,
  initialComment = "",
  onSuccess,
}: ReviewModalProps) {
  const [rating, setRating] = useState(initialRating);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState(initialComment);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- modal her açılışta başlangıç değerlerine sıfırlanır */
    if (isOpen) {
      setRating(initialRating || 5);
      setComment(initialComment || "");
      setError("");
      setSubmitted(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, initialRating, initialComment]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) {
      setError("Lütfen en az 1 yıldız seçin.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: appointmentId,
          rating,
          comment: comment.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Değerlendirme kaydedilemedi.");
      }

      setSubmitted(true);
      onSuccess({ rating, comment: comment.trim() });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const currentDisplayRating = hoverRating || rating;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={() => !loading && onClose()} />

      <div className="relative w-full max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl rounded-[32px] border border-white/60 dark:border-slate-800 shadow-2xl p-6 sm:p-7 overflow-hidden z-10 animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <X size={16} />
        </button>

        {submitted ? (
          <div className="py-10 text-center flex flex-col items-center gap-3 animate-in zoom-in-90 duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              Teşekkürler!
            </h3>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-xs">
              Değerlendirmeniz başarıyla kaydedildi ve işletme sayfasında
              yayınlandı.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Header */}
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--brand-soft)] bg-[var(--brand-soft)] text-[var(--brand-text)] text-[var(--brand-text)] text-xs font-bold mb-2">
                <Sparkles size={13} />
                <span>Deneyiminizi Paylaşın</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {businessName}
              </h3>
              {serviceName && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Hizmet:{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {serviceName}
                  </span>
                </p>
              )}
            </div>

            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-200 dark:border-rose-900/50">
                {error}
              </div>
            )}

            {/* Interactive Stars */}
            <div className="flex flex-col items-center py-2 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isFilled = star <= currentDisplayRating;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1 sm:p-1.5 transition-transform hover:scale-125 active:scale-95 focus:outline-none cursor-pointer"
                    >
                      <Star
                        size={32}
                        className={`transition-colors duration-150 ${
                          isFilled
                            ? "fill-amber-400 text-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.4)]"
                            : "text-slate-300 dark:text-slate-600"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-2">
                {RATING_LABELS[currentDisplayRating]?.tr || "Puanınızı seçin"}
              </span>
            </div>

            {/* Comment Area */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Yorumunuz (İsteğe Bağlı)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Personelin ilgisi, temizlik, randevu zamanlaması nasıldı? Deneyiminizi birkaç cümleyle anlatın..."
                rows={4}
                className="w-full p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 text-xs sm:text-sm font-medium text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--brand)] transition-all resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-3 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-xs sm:text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={loading || rating < 1}
                className="flex-1 py-3 px-4 rounded-2xl bg-[var(--brand)] hover:bg-[var(--brand-strong)] text-white font-extrabold text-xs sm:text-sm shadow-md shadow-[color:var(--brand-shadow)] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Gönderiliyor...</span>
                  </>
                ) : (
                  <span>Değerlendirmeyi Gönder</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
