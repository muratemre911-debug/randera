"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useLanguage } from "@/context/LanguageContext";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t, lang } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        // 1. Sunucu tarafında kullanıcıyı ve profili oluştur
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, fullName, nickname }),
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
        router.push("/my-appointments");
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

      let userRole = 'customer';
      if (authData?.user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', authData.user.id).single();
        if (profile) userRole = profile.role;
      }

      router.refresh();
      if (userRole === 'customer') {
        router.push("/my-appointments");
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
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
            {isRegister ? (lang === 'tr' ? 'Kayıt Ol' : 'Sign Up') : t("login.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("login.subtitle")}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/40 bg-white/70 p-6 shadow-xl shadow-black/5 backdrop-blur-2xl">
          <form onSubmit={handleLogin} className="space-y-4">
            
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-gray-600">
                  {lang === 'tr' ? 'Ad Soyad' : 'Full Name'}
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
                  {lang === 'tr' ? 'Kullanıcı Adı' : 'Username'}
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
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500 backdrop-blur-xl">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-200 transition-all hover:from-indigo-600 hover:to-purple-700 hover:shadow-xl disabled:opacity-50"
            >
              <LogIn size={18} />
              {loading ? t("login.logging_in") : (isRegister ? (lang === 'tr' ? 'Hesap Oluştur' : 'Create Account') : t("login.signin"))}
            </button>
            
            <div className="text-center mt-4 text-sm text-gray-500">
              {isRegister ? (
                <>{lang === 'tr' ? 'Zaten hesabınız var mı?' : 'Already have an account?'} <button type="button" onClick={() => setIsRegister(false)} className="text-indigo-600 font-semibold underline">{lang === 'tr' ? 'Giriş Yap' : 'Log In'}</button></>
              ) : (
                <>{lang === 'tr' ? 'Hesabınız yok mu?' : 'Don\'t have an account?'} <button type="button" onClick={() => setIsRegister(true)} className="text-indigo-600 font-semibold underline">{lang === 'tr' ? 'Kayıt Ol' : 'Sign Up'}</button></>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
