import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HomeClient from "./HomeClient";
import { LanguageProvider } from "@/context/LanguageContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { tr, en } from "@/locales";

// DynamicLogoLink oturum sorgusunu Supabase üzerinden yapar; testte ağ gerekmesin.
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));

function renderLanding() {
  return render(
    <LanguageProvider>
      <ThemeProvider>
        <HomeClient />
      </ThemeProvider>
    </LanguageProvider>,
  );
}

describe("landing page", () => {
  it("başlık, özellikler ve kayıt çağrısını gösterir", () => {
    renderLanding();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "akıllı",
    );
    expect(
      screen.getByRole("heading", {
        name: "Randevudan ciroya, her şey tek panelde",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Randevu linkiniz ve QR kodu")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Sektörünüz ne olursa olsun aynı akıllı altyapı: takvim, hizmetler, müşteriler ve bildirimler.",
      ),
    ).toBeInTheDocument();

    // Birincil CTA'lar kayıt akışına gitmeli (giriş değil).
    const ctas = screen.getAllByRole("link", { name: /Ücretsiz Deneyin/ });
    expect(ctas.length).toBeGreaterThan(0);
    for (const cta of ctas) {
      expect(cta).toHaveAttribute("href", "/login?mode=register");
    }
  });

  it("tüm SSS sorularını ve müşteri keşif bağlantısını içerir", () => {
    renderLanding();

    const details = document.querySelectorAll("details");
    expect(details).toHaveLength(5);
    expect(screen.getByText("Deneme süresi var mı?")).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /İşletmeleri [Kk]eşfet/ }).length,
    ).toBeGreaterThan(0);
  });

  it("landing çeviri anahtarları iki dilde birebir eşleşir", () => {
    const landingKeys = (dict: Record<string, string>) =>
      Object.keys(dict)
        .filter((key) => key.startsWith("landing."))
        .sort();

    expect(landingKeys(tr)).toEqual(landingKeys(en));
    expect(landingKeys(tr).length).toBeGreaterThan(50);
  });
});
