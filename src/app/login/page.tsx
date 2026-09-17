"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LogIn, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/context/LanguageContext";

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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");

  // Check URL params for errors or register mode
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      if (errorParam === "auth_callback_failed") {
        setError(t("login.google_error") || "Giriş işlemi tamamlanamadı. Lütfen tekrar deneyin.");
      } else {
        setError(decodeURIComponent(errorParam));
      }
    }

    const mode = searchParams.get("mode") || searchParams.get("register");
    if (mode === "register" || mode === "true" || mode === "1") {
      setIsRegister(true);
    }
  }, [searchParams, t]);

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
    } catch (err: any) {
      setError(err.message || t("login.google_error") || "Google ile bağlanırken bir sorun oluştu.");
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
        const cleanPhone = phone.replace(/\D/g, "");
        if (cleanPhone.length < 10) {
          throw new Error(lang === "tr" ? "Lütfen geçerli bir telefon numarası girin (Örn: 05XX XXX XX XX)." : "Please enter a valid phone number.");
        }

        // 1. Sunucu tarafında kullanıcıyı ve profili oluştur
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, fullName, nickname, phone: cleanPhone }),
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-fill relative flex items-center justify-center px-4">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 via-white to-purple-100" />

      {/* Decorative circles */}
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-gradient-to-br from-indigo-300/30 to-purple-300/30 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-gradient-to-br from-purple-300/30 to-pink-300/30 blur-3xl" />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="relative mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl shadow-lg shadow-indigo-200 border border-gray-100">
            <img src="/logo-light.png" alt="Randera Logo" className="h-full w-full object-cover bg-white" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-gray-800">
            {isRegister ? (lang === "tr" ? "Kayıt Ol" : "Sign Up") : t("login.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("login.subtitle")}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/40 bg-white/70 p-6 shadow-xl shadow-black/5 backdrop-blur-2xl">
          {/* Google Auth Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white/90 px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-white hover:border-gray-300 hover:shadow-md active:scale-[0.99] disabled:opacity-50"
          >
            {googleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
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
              <div className="w-full border-t border-gray-200/80" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white/90 px-2 text-gray-500 rounded-full font-medium">
                {t("login.or_email") || (lang === "tr" ? "veya e-posta ile" : "or with email")}
              </span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-gray-600">
                  {lang === "tr" ? "Ad Soyad" : "Full Name"}
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ahmet Yılmaz"
                  className="mt-1 block w-full rounded-lg border border-white/40 bg-white/60 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 backdrop-blur-xl focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
              </div>
            )}

            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-gray-600">
                  {lang === "tr" ? "Kullanıcı Adı" : "Username"}
                </label>
                <input
                  type="text"
                  required
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="ahmet_yilmaz"
                  className="mt-1 block w-full rounded-lg border border-white/40 bg-white/60 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 backdrop-blur-xl focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
              </div>
            )}

            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-gray-600">
                  {lang === "tr" ? "Telefon Numarası" : "Phone Number"}{" "}
                  <span className="text-red-500 font-bold">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="05XX XXX XX XX"
                  className="mt-1 block w-full rounded-lg border border-white/40 bg-white/60 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 backdrop-blur-xl focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-600">
                {t("login.email")}
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@email.com"
                className="mt-1 block w-full rounded-lg border border-white/40 bg-white/60 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 backdrop-blur-xl focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-600">
                {t("login.password")}
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 block w-full rounded-lg border border-white/40 bg-white/60 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 backdrop-blur-xl focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 border border-red-200/50 backdrop-blur-xl">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-200 transition-all hover:from-indigo-600 hover:to-purple-700 hover:shadow-xl disabled:opacity-50"
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
            
            <div className="text-center mt-4 text-sm text-gray-500">
              {isRegister ? (
                <>
                  {lang === "tr" ? "Zaten hesabınız var mı?" : "Already have an account?"}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegister(false);
                      setError(null);
                    }}
                    className="text-indigo-600 font-semibold underline"
                  >
                    {lang === "tr" ? "Giriş Yap" : "Log In"}
                  </button>
                </>
              ) : (
                <>
                  {lang === "tr" ? "Hesabınız yok mu?" : "Don't have an account?"}{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegister(true);
                      setError(null);
                    }}
                    className="inline-flex min-h-6 items-center px-1 font-semibold text-indigo-600 underline"
                  >
                    {lang === "tr" ? "Kayıt Ol" : "Sign Up"}
                  </button>
                </>
              )}
            </div>
          </form>
        </div>

        {/* Legal Links */}
        <div className="mt-6 flex items-center justify-center gap-3 text-center text-xs text-gray-500">
          <Link href="/privacy" className="flex min-h-6 items-center px-1 hover:text-indigo-600 transition-colors underline underline-offset-2">
            {lang === "tr" ? "Gizlilik Politikası" : "Privacy Policy"}
          </Link>
          <span>•</span>
          <Link href="/terms" className="flex min-h-6 items-center px-1 hover:text-indigo-600 transition-colors underline underline-offset-2">
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
        <div className="page-fill flex items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-purple-100">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
