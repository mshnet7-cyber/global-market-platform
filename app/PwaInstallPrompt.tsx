"use client";

import { useEffect, useState } from "react";

export default function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall as EventListener);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall as EventListener);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    const promptEvent = deferred as { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") setInstalled(true);
    setDeferred(null);
  }

  if (installed) {
    return <article className="stage3-card"><strong>التطبيق مثبت</strong><p>تم تثبيت Global Market كتطبيق على الجهاز.</p></article>;
  }

  if (!deferred) {
    return <article className="stage3-card"><div className="stage3-card-head"><h2>تثبيت التطبيق</h2><span className="stage3-status">PWA</span></div><p>زر التثبيت يظهر فقط عندما يوفّر المتصفح نافذة التثبيت الأصلية. لا يوجد تثبيت وهمي.</p></article>;
  }

  return <article className="stage3-card"><div className="stage3-card-head"><h2>تثبيت التطبيق</h2><span className="stage3-status live">READY</span></div><p>يمكن تثبيت Global Market على الجهاز كـPWA.</p><button type="button" className="stage3-btn stage3-btn-primary" onClick={() => void install()}>تثبيت التطبيق</button></article>;
}
