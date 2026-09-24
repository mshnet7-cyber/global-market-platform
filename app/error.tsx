"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="error-page" dir="rtl" lang="ar">
      <section className="error-card" role="alert">
        <div className="eyebrow">GLOBAL MARKET · SYSTEM RECOVERY</div>
        <div className="error-code">500</div>
        <h1>حدث خطأ غير متوقع</h1>
        <p>تعذر إكمال هذه الصفحة. يمكنك إعادة المحاولة أو العودة إلى المنصة الرئيسية.</p>
        <div className="error-actions">
          <button className="btn btn-primary" type="button" onClick={() => reset()}>إعادة المحاولة</button>
          <Link className="btn" href="/">العودة للرئيسية</Link>
        </div>
      </section>
    </main>
  );
}
