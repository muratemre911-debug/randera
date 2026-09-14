"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck, Lock, Eye, FileText, Database, UserCheck, Mail, Globe } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export default function PrivacyPage() {
  const { lang, toggleLanguage } = useLanguage();

  const isTr = lang === "tr";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-gray-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <ArrowLeft size={18} />
            <span>{isTr ? "Ana Sayfaya Dön" : "Back to Home"}</span>
          </Link>

          <div className="flex items-center gap-4">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Globe size={14} />
              <span>{lang.toUpperCase()}</span>
            </button>

            <Link href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                <img src="/logo-light.png" alt="Randera" className="h-full w-full object-cover" />
              </div>
              <span className="font-bold text-base text-slate-900 dark:text-white">Randera</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-b from-indigo-50/50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950 py-12 border-b border-gray-100 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100/70 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 text-xs font-semibold mb-4">
            <ShieldCheck size={14} />
            <span>{isTr ? "Gizlilik ve Veri Güvenliği" : "Privacy & Data Security"}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {isTr ? "Gizlilik Politikası" : "Privacy Policy"}
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {isTr ? "Son Güncelleme: 14 Eylül 2026" : "Last Updated: September 14, 2026"}
          </p>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-200/70 dark:border-slate-800 p-6 sm:p-10 shadow-sm space-y-10">
          
          {/* Section 1 */}
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <FileText size={20} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {isTr ? "1. Genel Bakış ve Amaç" : "1. Overview & Scope"}
              </h2>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm sm:text-base pl-12">
              {isTr
                ? "Randera (\"Uygulama\", \"Platform\", \"biz\") olarak, kullanıcılarımızın kişisel verilerinin güvenliğine ve gizliliğine büyük önem veriyoruz. Bu Gizlilik Politikası, platformumuzu kullandığınızda veya Google gibi harici kimlik sağlayıcılar üzerinden giriş yaptığınızda kişisel verilerinizin nasıl toplandığını, işlendiğini, saklandığını ve korunduğunu açıklar."
                : "At Randera (\"Application\", \"Platform\", \"we\"), we place the highest priority on the security and privacy of our users' personal data. This Privacy Policy outlines how your personal data is collected, processed, stored, and protected when you use our platform or sign in through third-party identity providers such as Google."}
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Database size={20} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {isTr ? "2. Toplanan Kişisel Veriler" : "2. Information We Collect"}
              </h2>
            </div>
            <div className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm sm:text-base pl-12 space-y-3">
              <p>
                {isTr
                  ? "Platformumuzun düzgün çalışabilmesi ve randevu hizmetlerinin yürütülebilmesi için aşağıdaki verileri topluyoruz:"
                  : "To provide our booking and management services effectively, we collect the following types of information:"}
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong className="text-slate-800 dark:text-slate-200">
                    {isTr ? "Google ile Giriş Yap / Üye Ol:" : "Google Sign-In / Sign-Up:"}
                  </strong>{" "}
                  {isTr
                    ? "Google hesabınız üzerinden kimlik doğrulaması yapmayı seçtiğinizde; adınız, soyadınız, e-posta adresiniz ve profil fotoğrafınız (avatar) Google'dan alınır."
                    : "When you sign in using your Google account, we access your name, email address, and profile picture (avatar) provided by Google."}
                </li>
                <li>
                  <strong className="text-slate-800 dark:text-slate-200">
                    {isTr ? "Hesap ve İletişim Bilgileri:" : "Account & Contact Information:"}
                  </strong>{" "}
                  {isTr
                    ? "Kullanıcı adı (nickname), telefon numarası (randevu bildirimleri ve doğrulama için isteğe bağlı)."
                    : "Username, phone number (optional, used for appointment confirmations and notifications)."}
                </li>
                <li>
                  <strong className="text-slate-800 dark:text-slate-200">
                    {isTr ? "Randevu ve Hizmet Bilgileri:" : "Appointment & Service Details:"}
                  </strong>{" "}
                  {isTr
                    ? "Müşteri veya işletme olarak planladığınız randevuların tarih, saat, hizmet tipi, randevu notları ve durum bilgileri."
                    : "Scheduled dates, times, requested services, appointment notes, and booking statuses."}
                </li>
                <li>
                  <strong className="text-slate-800 dark:text-slate-200">
                    {isTr ? "Teknik Çerezler:" : "Essential Cookies:"}
                  </strong>{" "}
                  {isTr
                    ? "Oturumunuzu güvende tutmak ve kimlik doğrulama durumunuzu sürdürmek için kullanılan zorunlu güvenlik çerezleri."
                    : "Strictly necessary session cookies used solely to maintain secure authentication state."}
                </li>
              </ul>
            </div>
          </section>

          {/* Section 3 - Google User Data Policy */}
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Lock size={20} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {isTr ? "3. Google Kullanıcı Verileri ve Sınırlı Kullanım İlkesi" : "3. Google User Data & Limited Use Policy"}
              </h2>
            </div>
            <div className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm sm:text-base pl-12 space-y-3">
              <p>
                {isTr
                  ? "Randera'nın Google API'lerinden aldığı bilgilerin kullanımı ve başka herhangi bir uygulamaya aktarımı, Sınırlı Kullanım (Limited Use) gereksinimleri dahil olmak üzere Google API Hizmetleri Kullanıcı Verileri Politikası'na (Google API Services User Data Policy) tam olarak uygundur."
                  : "Randera's use and transfer of information received from Google APIs to any other app will adhere to the Google API Services User Data Policy, including the Limited Use requirements."}
              </p>
              <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-sm space-y-2">
                <p className="font-semibold text-indigo-900 dark:text-indigo-200">
                  {isTr ? "Google Veri Güvencemiz:" : "Our Google Data Commitments:"}
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-300">
                  <li>{isTr ? "Google verileriniz hiçbir zaman reklam veya pazarlama amacıyla kullanılmaz." : "Your Google data is never used for advertising or marketing purposes."}</li>
                  <li>{isTr ? "Google verileriniz üçüncü taraf veri aracılığı yapan şirketlere satılmaz veya devredilmez." : "Your Google data is never sold or shared with third-party data brokers."}</li>
                  <li>{isTr ? "Yalnızca Randera kullanıcı oturumunuzu açmak ve randevularınızı yönetmek için kullanılır." : "Data is used exclusively to facilitate your login session and manage your appointments."}</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Eye size={20} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {isTr ? "4. Verilerin Kullanım Amaçları" : "4. How We Use Your Data"}
              </h2>
            </div>
            <div className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm sm:text-base pl-12">
              <ul className="list-disc pl-5 space-y-2">
                <li>{isTr ? "Kullanıcı hesabınızı oluşturmak ve güvenli giriş sağlamak." : "Creating your user account and facilitating secure sign-in."}</li>
                <li>{isTr ? "Müşteri ve işletmeler arasında randevu planlamasını koordine etmek." : "Coordinating bookings between clients and service providers."}</li>
                <li>{isTr ? "Randevu onayları, hatırlatmalar ve iptal bildirimlerini göndermek." : "Sending booking confirmations, reminders, and status updates."}</li>
                <li>{isTr ? "Sistem güvenliğini ve kötüye kullanımı engellemek." : "Ensuring system integrity and preventing fraudulent activity."}</li>
              </ul>
            </div>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <UserCheck size={20} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {isTr ? "5. Kullanıcı Hakları ve Veri Silme (KVKK & GDPR)" : "5. Your Rights & Data Deletion"}
              </h2>
            </div>
            <div className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm sm:text-base pl-12 space-y-3">
              <p>
                {isTr
                  ? "Kişisel verileriniz üzerinde tam kontrole sahipsiniz. Yürürlükteki veri koruma mevzuatı (KVKK ve GDPR) uyarınca aşağıdaki haklara sahipsiniz:"
                  : "You maintain complete ownership and control of your personal data. Under applicable privacy laws (GDPR / KVKK), you have the right to:"}
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>{isTr ? "Profil sayfanızdan bilgilerinizi istediğiniz zaman görüntüleyebilir ve güncelleyebilirsiniz." : "View and update your personal details at any time from your profile page."}</li>
                <li>{isTr ? "Hesabınızın ve ilişkili tüm randevu/profil verilerinizin kalıcı olarak silinmesini talep edebilirsiniz." : "Request the permanent deletion of your account and all associated booking/profile data."}</li>
                <li>{isTr ? "Google Hesap Güvenliği panelinden (myaccount.google.com/permissions) Randera'ya verdiğiniz erişim iznini dilediğiniz zaman tek tıkla iptal edebilirsiniz." : "Revoke Randera's access permissions at any time directly via your Google Account settings (myaccount.google.com/permissions)."}</li>
              </ul>
            </div>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Mail size={20} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {isTr ? "6. İletişim" : "6. Contact Us"}
              </h2>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm sm:text-base pl-12">
              {isTr
                ? "Gizlilik politikamız, kişisel verileriniz veya veri silme talepleriniz ile ilgili her türlü soru için bize aşağıdaki e-posta adresinden ulaşabilirsiniz:"
                : "For any questions regarding our Privacy Policy, your personal data, or data deletion requests, please contact us at:"}
              <br />
              <a
                href="mailto:destek@randera.com"
                className="mt-2 inline-block font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                destek@randera.com
              </a>
            </p>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-8 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Randera. {isTr ? "Tüm hakları saklıdır." : "All rights reserved."}</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              {isTr ? "Gizlilik Politikası" : "Privacy Policy"}
            </Link>
            <Link href="/terms" className="hover:underline">
              {isTr ? "Kullanım Koşulları" : "Terms of Service"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
