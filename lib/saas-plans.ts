export type MerchantPlanCode = "starter" | "pro" | "business";

export type MerchantPlan = {
  code: MerchantPlanCode;
  name: string;
  monthly: number;
  halfYear: number;
  yearly: number;
  extraBranchDiscount: string;
  eyebrow: string;
  description: string;
  features: string[];
};

export const MERCHANT_PLANS: readonly MerchantPlan[] = [
  { code:"starter", name:"الشاشة", monthly:5, halfYear:25, yearly:50, extraBranchDiscount:"2.5%", eyebrow:"الشاشة", description:"للواجهة الاحترافية وعرض أسعار السوق داخل المحل.", features:["شاشة المحل الأساسية","أسعار الذهب والفضة","محتوى وعروض المحل","قوالب الشاشة","تحديث تلقائي"] },
  { code:"pro", name:"الأعمال", monthly:25, halfYear:125, yearly:240, extraBranchDiscount:"5%", eyebrow:"التشغيل", description:"لتشغيل المبيعات والمشتريات والمصاريف من مساحة واحدة.", features:["المبيعات وPOS","المشتريات والموردون","المصاريف والصندوق","العملاء والأصناف","الفواتير والتقارير الأساسية"] },
  { code:"business", name:"الكاملة", monthly:46, halfYear:247, yearly:450, extraBranchDiscount:"8%", eyebrow:"مساحة التشغيل الكاملة", description:"للتشغيل المتكامل مع المخزون والامتثال والأتمتة المتقدمة.", features:["كل مزايا الأعمال","AI/OCR","شراء الذهب من الأفراد","الإصلاحات وتتبع القطعة","المخزون والجرد والفروع","المحاسبة والضرائب المتقدمة","الموافقات وسجل التدقيق"] }
] as const;

export const ADDITIONAL_SCREEN_PRICING = { monthly:4, halfYear:21, yearly:44 } as const;

export function getMerchantPlan(code: string | null | undefined): MerchantPlan | null {
  return MERCHANT_PLANS.find((plan) => plan.code === code) ?? null;
}

export function isMerchantPlanCode(value: string | null | undefined): value is MerchantPlanCode {
  return !!value && MERCHANT_PLANS.some((plan) => plan.code === value);
}
