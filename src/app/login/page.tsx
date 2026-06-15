"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
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
            <img src="/logo-light.png" alt="Randera Logo" className="h-full w-full object-cover" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-gray-800">
            Randera
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            İşletmenizi yönetmek için giriş yapın
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/40 bg-white/70 p-6 shadow-xl shadow-black/5 backdrop-blur-2xl">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-600"
              >
                E-posta
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
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-600"
              >
                Şifre
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
              {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
