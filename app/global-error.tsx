"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:"24px",background:"#061017",color:"#eef2f2",fontFamily:"Arial,sans-serif"}}>
          <section style={{width:"min(620px,100%)",padding:"34px",border:"1px solid rgba(216,181,106,.28)",borderRadius:"20px",background:"#0f1d25",textAlign:"center"}}>
            <div style={{color:"#f3dca4",fontSize:"10px",fontWeight:800,letterSpacing:".16em"}}>GLOBAL MARKET</div>
            <div style={{fontSize:"64px",fontWeight:900,lineHeight:1,margin:"18px 0"}}>500</div>
            <h1 style={{margin:"0 0 10px",fontSize:"28px"}}>حدث خطأ في المنصة</h1>
            <p style={{margin:"0 auto 22px",maxWidth:"480px",color:"#8a999f",lineHeight:1.8}}>تعذر تحميل المنصة بشكل صحيح. أعد المحاولة للمتابعة.</p>
            <button type="button" onClick={() => reset()} style={{minHeight:"46px",padding:"10px 18px",borderRadius:"10px",border:"1px solid #e3c681",background:"#d8b56a",color:"#111a20",fontWeight:800,cursor:"pointer"}}>إعادة المحاولة</button>
          </section>
        </main>
      </body>
    </html>
  );
}
