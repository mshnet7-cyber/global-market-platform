import { createSupabaseAdminClient } from "./supabase/admin";

export type PublicAd = {
  id: string;
  title: string;
  body: string | null;
  imagePath: string | null;
  targetUrl: string | null;
  whatsapp: string | null;
  placement: string;
  advertiserName: string;
};

export async function getPublicAds(options: { country?: string; city?: string; placement?: string; limit?: number } = {}): Promise<PublicAd[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];

  const now = new Date().toISOString();
  let query = admin
    .from("gmp_ad_campaigns")
    .select("id,title,body,image_path,target_url,whatsapp,placement,advertiser_name,country_code,city,starts_at,ends_at")
    .eq("status", "approved")
    .eq("placement", options.placement ?? "banner")
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 4);

  if (options.country) query = query.or(`country_code.is.null,country_code.eq.${options.country.toUpperCase()}`);
  if (options.city) query = query.or(`city.is.null,city.ilike.${options.city}`);

  const { data } = await query;
  return (data ?? []).map((ad) => ({
    id: ad.id,
    title: ad.title,
    body: ad.body,
    imagePath: ad.image_path,
    targetUrl: ad.target_url,
    whatsapp: ad.whatsapp,
    placement: ad.placement,
    advertiserName: ad.advertiser_name,
  }));
}
