"use client";

import React, { useState } from "react";
import {
  Star,
  X,
  CheckCircle2,
  Loader2,
  Edit3,
  Calendar,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { tr, enUS } from "date-fns/locale";
import { useLanguage } from "@/context/LanguageContext";

export interface UserReviewItem {
  appointment_id: string;
  rating: number;
  comment: string;
  created_at: string;
  service_name?: string;
  start_time: string;
}

interface ManageReviewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessName: string;
  reviews: UserReviewItem[];
  onSuccess: () => void;
}

const RATING_LABELS: Record<number, { tr: string; en: string }> = {
  5: { tr: "Olağanüstü! 🌟", en: "Outstanding! 🌟" },
  4: { tr: "Çok İyi 👍", en: "Very Good 👍" },
  3: { tr: "İyi 🙂", en: "Good 🙂" },
  2: { tr: "İdare Eder 😐", en: "Fair 😐" },
  1: { tr: "Memnun Kalmadım 👎", en: "Poor 👎" },
};

export default function ManageReviewsModal({
  isOpen,
  onClose,
  businessName,
  reviews,
  onSuccess,
}: ManageReviewsModalProps) {
  const { lang } = useLanguage();
  const locale = lang === "tr" ? tr : enUS;

  const [editingReview, setEditingReview] = useState<UserReviewItem | null>(
    null,
  );
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  if (!isOpen) return null;

  const startEdit = (rev: UserReviewItem) => {
    setEditingReview(rev);
    setRating(rev.rating);
    setComment(rev.comment || "");
    setError("");
    setSuccessMessage("");
  };

  const cancelEdit = () => {
    setEditingReview(null);
    setError("");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReview) return;
    if (rating < 1) {
      setError(
        lang === "tr"
          ? "Lütfen en az 1 yıldız seçin."
          : "Please select at least 1 star.",
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: editingReview.appointment_id,
          rating,
          comment: comment.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(
          data.error ||
            (lang === "tr"
              ? "Değerlendirme güncellenemedi."
              : "Failed to update review."),
        );
      }

      setSuccessMessage(
        lang === "tr"
          ? "Değerlendirmeniz başarıyla güncellendi!"
          : "Review updated successfully!",
      );
      onSuccess();
      setTimeout(() => {
        setEditingReview(null);
        setSuccessMessage("");
      }, 1200);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : lang === "tr"
            ? "Bir hata oluştu."
            : "An error occurred.",
      );
    } finally {
      setLoading(false);
    }
  };

  const currentDisplayRating = hoverRating || rating;

  return (
    <div data-no-swipe className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={() => !loading && onClose()} />

      <div className="relative w-full max-w-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl rounded-[32px] border border-white/60 dark:border-slate-800 shadow-2xl p-6 sm:p-7 overflow-hidden z-10 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            {editingReview ? (
              <button
                type="button"
                onClick={cancelEdit}
                disabled={loading}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                title={lang === "tr" ? "Geri Dön" : "Back"}
              >
                <ArrowLeft size={18} />
              </button>
            ) : null}
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                {editingReview
                  ? lang === "tr"
                    ? "Yorumu Düzenle"
                    : "Edit Review"
                  : lang === "tr"
                    ? "Değerlendirmelerim"
                    : "My Reviews"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {businessName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
          {successMessage && (
            <div className="mb-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-xs font-bold animate-in fade-in">
              {error}
            </div>
          )}

          {/* EDIT FORM VIEW */}
          {editingReview ? (
            <form
              onSubmit={handleSaveEdit}
              className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-200"
            >
              {/* Selected Appointment Info */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {editingReview.service_name ||
                      (lang === "tr" ? "Hizmet" : "Service")}
                  </span>
                  <p className="text-slate-400 text-[11px] mt-0.5 flex items-center gap-1">
                    <Calendar size={12} />
                    {format(
                      parseISO(editingReview.start_time),
                      "d MMMM yyyy, HH:mm",
                      { locale },
                    )}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold">
                  {lang === "tr" ? "Tamamlandı" : "Completed"}
                </span>
              </div>

              {/* Star Rating Picker */}
              <div className="text-center space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {lang === "tr"
                    ? "Puanınızı Değiştirin"
                    : "Change Your Rating"}
                </label>
                <div className="flex items-center justify-center gap-1.5 py-1">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isFilled = star <= currentDisplayRating;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 text-slate-200 dark:text-slate-700 hover:scale-115 active:scale-95 transition-all cursor-pointer"
                      >
                        <Star
                          size={28}
                          className={`transition-colors ${
                            isFilled
                              ? "fill-amber-400 text-amber-400 drop-shadow-sm"
                              : "text-slate-200 dark:text-slate-700"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 h-5">
                  {RATING_LABELS[currentDisplayRating]?.[
                    lang === "tr" ? "tr" : "en"
                  ] || ""}
                </p>
              </div>

              {/* Comment Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {lang === "tr" ? "Yorumunuz" : "Your Comment"}
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {comment.length}/500
                  </span>
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, 500))}
                  rows={4}
                  placeholder={
                    lang === "tr"
                      ? "Deneyiminiz hakkında eklemek veya güncellemek istediğiniz detayları yazın..."
                      : "Write any details about your experience..."
                  }
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-3.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20 focus:border-[var(--brand)] transition-all resize-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={loading}
                  className="flex-1 py-3 px-4 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs sm:text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {lang === "tr" ? "Vazgeç" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 px-4 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-strong)] text-white font-extrabold text-xs sm:text-sm shadow-md shadow-[color:var(--brand-shadow)] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>
                        {lang === "tr" ? "Kaydediliyor..." : "Saving..."}
                      </span>
                    </>
                  ) : (
                    <span>
                      {lang === "tr" ? "Değişiklikleri Kaydet" : "Save Changes"}
                    </span>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* LIST VIEW OF USER PAST REVIEWS */
            <div className="space-y-3">
              {reviews.length === 0 ? (
                <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                  {lang === "tr"
                    ? "Henüz bu işletmeye yaptığınız bir değerlendirme bulunmuyor."
                    : "You have not written any reviews for this business yet."}
                </div>
              ) : (
                reviews.map((rev) => (
                  <div
                    key={rev.appointment_id}
                    className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-2.5 transition-all hover:border-slate-300 dark:hover:border-slate-600"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {rev.service_name ||
                              (lang === "tr" ? "Hizmet" : "Service")}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <ShieldCheck size={12} />
                            {lang === "tr" ? "Doğrulanmış" : "Verified"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {format(parseISO(rev.created_at), "d MMMM yyyy", {
                            locale,
                          })}
                        </p>
                      </div>

                      {/* Stars & Edit Button */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-0.5 text-amber-400">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              size={12}
                              className={
                                s <= rev.rating
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-slate-200 dark:text-slate-700"
                              }
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => startEdit(rev)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-[var(--brand-soft)] hover:bg-[var(--brand-soft-hover)] bg-[var(--brand-soft)] hover:bg-[var(--brand-soft-hover)] text-[var(--brand-text)] text-[var(--brand-text)] text-xs font-bold transition-colors cursor-pointer"
                        >
                          <Edit3 size={12} />
                          <span>{lang === "tr" ? "Düzenle" : "Edit"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Review text */}
                    {rev.comment ? (
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic bg-white/60 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        &ldquo;{rev.comment}&rdquo;
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        {lang === "tr"
                          ? "(Yorum metni yazılmamış, sadece puan verildi)"
                          : "(No text comment, rating only)"}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
