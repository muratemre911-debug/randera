/* Tema ön-yüklemesi.
 *
 * Neden ayrı bir dosya: HTML içine gömülü (inline) script yerine senkron bir
 * harici script kullanılıyor. `<head>` içinde senkron yüklendiği için tarayıcı
 * ilk boyamadan ÖNCE çalıştırır; kayıtlı tema uygulanmadan sayfa görünmez.
 * Böylece koyu tema kullanan biri her açılışta beyaz bir parlama görmez.
 * Dosya service worker tarafından önceden önbelleğe alınır (`public/sw.js`),
 * bu yüzden tekrar açılışlarda ek bir ağ maliyeti yoktur.
 *
 * Statik ve kullanıcı girdisi içermez: yalnızca localStorage'daki 'theme'
 * anahtarını okur.
 */
(function () {
  try {
    var saved = localStorage.getItem("theme");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var dark = saved === "dark" || (!saved && prefersDark);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch (error) {
    /* localStorage kapalı: sistem tercihi de okunamıyorsa aydınlık kalır */
  }
})();
