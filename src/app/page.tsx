import { Metadata } from "next";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
  title: "Randera - Akıllı İşletme Yönetim Sistemi",
  description: "Randera ile işletmeniz için profesyonel randevu yönetimi. Berber, doktor, danışman ve tüm zaman tabanlı hizmetler için.",
  openGraph: {
    title: "Randera - Akıllı Randevu Sistemi",
    description: "İşletmeniz için profesyonel randevu yönetimi çözümü",
    type: "website",
    locale: "tr_TR",
    siteName: "Randera",
  },
};

export default function Home() {
  return <HomeClient />;
}