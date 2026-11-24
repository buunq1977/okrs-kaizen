// PWA: đăng ký service worker + nút "📲 Cài app" (hiện khi trình duyệt cho cài và app chưa cài).
// Chỉ chạy ở bản build (GitHub Pages), không chạy lúc dev.
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export function setupPwa(): void {
  if (!import.meta.env.PROD || window.top !== window) return
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}) })
  }
  const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  const hidden = () => { try { return localStorage.getItem('pwa-hide') === '1' } catch { return false } }
  let ev: InstallEvent | null = null
  let chip: HTMLDivElement | null = null
  const hide = () => { chip?.remove(); chip = null }
  const show = () => {
    if (standalone() || hidden() || chip) return
    chip = document.createElement('div')
    chip.className = 'pwa-chip'
    chip.innerHTML = '<button type="button" class="pwa-go" title="Cài thành app trên máy / điện thoại (mở toàn màn hình, có biểu tượng riêng)">📲 Cài app</button>'
      + '<button type="button" class="pwa-x" title="Ẩn nút này" aria-label="Ẩn">✕</button>'
    document.body.appendChild(chip)
    chip.querySelector<HTMLButtonElement>('.pwa-go')!.onclick = async () => {
      if (!ev) return
      await ev.prompt()
      const r = await ev.userChoice
      ev = null
      if (r.outcome === 'accepted') hide()
    }
    chip.querySelector<HTMLButtonElement>('.pwa-x')!.onclick = () => { try { localStorage.setItem('pwa-hide', '1') } catch { /* bỏ qua */ } hide() }
  }
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); ev = e as InstallEvent; show() })
  window.addEventListener('appinstalled', hide)
}
