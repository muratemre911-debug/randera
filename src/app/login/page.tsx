"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, LogIn, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import {
  inspectTrMobile,
  trMobileErrorMessage,
  TR_MOBILE_PLACEHOLDER,
} from "@/lib/phone";
import SegmentedControl from "@/components/ui/SegmentedControl";

function GoogleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.98 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { t, lang } = useLanguage();

  // URL parametrelerinden ilk durum: OAuth hatası mesajı ve kayıt modu.
  // (Effect içinde setState yerine state başlatıcıda okunur — cascading
  // render üretmez.)
  const urlError = (() => {
    const errorParam = searchParams.get("error");
    if (!errorParam) return null;
    if (errorParam === "auth_callback_failed") {
      return t("login.google_error") || "Giriş işlemi tamamlanamadı. Lütfen tekrar deneyin.";
    }
    return decodeURIComponent(errorParam);
  })();
  const urlMode = searchParams.get("mode") || searchParams.get("register");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(urlError);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(
    urlMode === "register" || urlMode === "true" || urlMode === "1",
  );
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleGoogleLogin = async () => {
    setError(null);
    setGoogleLoading(true);

    try {
      const next = searchParams.get("next");
      const redirectTo = `${window.location.origin}/auth/callback${
        next ? `?next=${encodeURIComponent(next)}` : ""
      }`;

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (oauthError) {
        throw oauthError;
      }
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : t("login.google_error") || "Google ile bağlanırken bir sorun oluştu.",
      );
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const next = searchParams.get("next");

      if (isRegister) {
        // Numara biçim + uydurma desen kontrolü (bkz. src/lib/phone.ts)
        const phoneCheck = inspectTrMobile(phone);
        if (!phoneCheck.ok) {
          throw new Error(trMobileErrorMessage(phoneCheck.issue, lang));
        }

        // 1. Sunucu tarafında kullanıcıyı ve profili oluştur
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, fullName, nickname, phone: phoneCheck.phone }),
        });

        const resData = await res.json();
        if (!res.ok) {
          throw new Error(resData.error || "Kayıt olurken bir hata oluştu.");
        }

        // 2. Oturumu aç
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          throw new Error(signInError.message);
        }

        router.refresh();
        if (next && next.startsWith("/") && !next.startsWith("/login")) {
          router.push(next);
        } else {
          router.push("/discover");
        }
        return;
      }

      // Standart Giriş Yap Akışı
      const { error: signInError, data: authData } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw new Error(t("login.error"));
      }

      let userRole = "customer";
      if (authData?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", authData.user.id)
          .single();
        if (profile) userRole = profile.role;
      }

      router.refresh();
      if (next && next.startsWith("/") && !next.startsWith("/login")) {
        router.push(next);
      } else if (userRole === "customer") {
        router.push("/discover");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t("login.error"));
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "h-12 w-full rounded-xl border border-slate-200/80 bg-white/70 px-4 text-[15px] font-medium text-slate-900 placeholder:font-normal placeholder:text-slate-400 backdrop-blur-xl transition-all focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-slate-900/60 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:bg-slate-900";
  const labelClass =
    "mb-1.5 block text-[13px] font-semibold text-slate-600 dark:text-slate-300";

  return (
    <div className="page-fill relative flex items-center justify-center px-4 py-8">
      {/* Background gradient (açık + koyu) */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 via-white to-purple-100 dark:from-[#0B0D14] dark:via-[#0d1020] dark:to-[#14102a]" />

      {/* Decorative circles */}
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-gradient-to-br from-indigo-300/30 to-purple-300/30 blur-3xl dark:from-indigo-600/15 dark:to-purple-600/15" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-gradient-to-br from-purple-300/30 to-pink-300/30 blur-3xl dark:from-purple-600/15 dark:to-pink-600/10" />

      <div className="animate-rise-in relative w-full max-w-sm">
        {/* Logo */}
        <div className="mb-7 text-center">
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-[20px] border border-gray-100 shadow-lg shadow-indigo-200/60 dark:border-white/10 dark:shadow-indigo-950/40">
            <img
              src="/logo/logo-light-160.png"
              alt="Randera Logo"
              width={160}
              height={160}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover bg-white"
            />
          </div>
          <h1 className="mt-4 text-[26px] font-black tracking-tight text-slate-900 dark:text-white">
            {isRegister ? (lang === "tr" ? "Kayıt Ol" : "Sign Up") : t("login.title")}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t("login.subtitle")}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-[24px] border border-white/50 bg-white/75 p-5 shadow-xl shadow-black/5 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/70 dark:shadow-black/30 sm:p-6">
          {/* Giriş / Kayıt modu: iOS segmented control */}
          <SegmentedControl
            className="mb-5"
            value={isRegister ? "register" : "login"}
            onChange={(v) => {
              setIsRegister(v === "register");
              setError(null);
            }}
            options={[
              { value: "login", label: lang === "tr" ? "Giriş Yap" : "Sign In" },
              { value: "register", label: lang === "tr" ? "Kayıt Ol" : "Sign Up" },
            ]}
          />

          {/* Google Auth Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            className="flex h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-slate-200/80 bg-white/90 px-4 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-white hover:border-slate-300 active:scale-[0.98] disabled:opacity-50 dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {googleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600 dark:text-indigo-400" />
            ) : (
              <GoogleIcon className="h-5 w-5" />
            )}
            <span>
              {googleLoading
                ? (lang === "tr" ? "Bağlanıyor..." : "Connecting...")
                : isRegister
                ? (t("login.google_signup") || "Google ile Kayıt Ol")
                : (t("login.google_signin") || "Google ile Giriş Yap")}
            </span>
          </button>

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200/80 dark:border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="rounded-full bg-white/90 px-2.5 py-0.5 font-medium text-slate-400 dark:bg-slate-900 dark:text-slate-500">
                {t("login.or_email") || (lang === "tr" ? "veya e-posta ile" : "or with email")}
              </span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {isRegister && (
              <div className="animate-rise-in">
                <label htmlFor="fullName" className={labelClass}>
                  {lang === "tr" ? "Ad Soyad" : "Full Name"}
                </label>
                <input
                  id="fullName"
                  type="text"
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ahmet Yılmaz"
                  className={inputClass}
                />
              </div>
            )}

            {isRegister && (
              <div className="animate-rise-in">
                <label htmlFor="nickname" className={labelClass}>
                  {lang === "tr" ? "Kullanıcı Adı" : "Username"}
                </label>
                <input
                  id="nickname"
                  type="text"
                  required
                  autoComplete="username"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="ahmet_yilmaz"
                  className={inputClass}
                />
              </div>
            )}

            {isRegister && (
              <div className="animate-rise-in">
                <label htmlFor="phone" className={labelClass}>
                  {lang === "tr" ? "Telefon Numarası" : "Phone Number"}{" "}
                  <span className="font-bold text-rose-500">*</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={TR_MOBILE_PLACEHOLDER}
                  className={inputClass}
                />
                <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                  {lang === "tr"
                    ? "Aynı numara yalnızca bir hesapta kullanılabilir."
                    : "A number can only be used by one account."}
                </p>
              </div>
            )}

            <div>
              <label htmlFor="email" className={labelClass}>
                {t("login.email")}
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@email.com"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="password" className={labelClass}>
                {t("login.password")}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${inputClass} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={
                    showPassword
                      ? lang === "tr" ? "Şifreyi gizle" : "Hide password"
                      : lang === "tr" ? "Şifreyi göster" : "Show password"
                  }
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="animate-rise-in rounded-xl border border-rose-200/60 bg-rose-500/10 px-3.5 py-2.5 text-sm font-medium text-rose-600 dark:border-rose-500/25 dark:text-rose-400"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:from-indigo-600 hover:to-purple-700 active:scale-[0.98] disabled:opacity-50 dark:shadow-indigo-950/40"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn size={18} />
              )}
              {loading
                ? t("login.logging_in")
                : isRegister
                ? (lang === "tr" ? "Hesap Oluştur" : "Create Account")
                : t("login.signin")}
            </button>
          </form>
        </div>

        {/* Legal Links */}
        <div className="mt-6 flex items-center justify-center gap-3 text-center text-xs text-slate-400 dark:text-slate-500">
          <Link href="/privacy" className="flex min-h-6 items-center px-1 underline underline-offset-2 transition-colors hover:text-indigo-600 dark:hover:text-indigo-400">
            {lang === "tr" ? "Gizlilik Politikası" : "Privacy Policy"}
          </Link>
          <span>•</span>
          <Link href="/terms" className="flex min-h-6 items-center px-1 underline underline-offset-2 transition-colors hover:text-indigo-600 dark:hover:text-indigo-400">
            {lang === "tr" ? "Kullanım Koşulları" : "Terms of Service"}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="page-fill flex items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-purple-100 dark:from-[#0B0D14] dark:via-[#0d1020] dark:to-[#14102a]">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
