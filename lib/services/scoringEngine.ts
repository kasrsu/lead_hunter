import type { Lead, PriorityTier } from "@/lib/types";

export interface LeadMetrics {
  opportunityScore: number;
  reachabilityScore: number;
  completenessScore: number;
  engagementScore: number;
  priorityTier: PriorityTier;
  leadScore: number;
}

export function computeLeadMetrics(lead: Partial<Lead>): LeadMetrics {
  const name = lead.name || "";
  const rating = lead.rating ?? 0;
  const reviews = lead.reviews ?? 0;
  const phone = lead.phone || "";
  const email = (lead as any).contactEmail || (lead as any).email || "";
  const address = lead.address || "";
  const website = lead.website || "";
  const hasWebsite = lead.hasWebsite ?? Boolean(website);
  const instagram = lead.instagram || "";
  const facebook = lead.facebook || "";
  const priceRange = lead.priceRange || "";
  const category = lead.category || "";

  // 1. Completeness Score (0-100): Coverage ratio of standard schema fields
  const fields = [
    Boolean(name),
    Boolean(address),
    Boolean(phone),
    Boolean(email),
    rating > 0,
    reviews > 0,
    Boolean(category),
    Boolean(website),
    Boolean(instagram || facebook),
    Boolean(priceRange),
  ];
  const completenessScore = Math.round(
    (fields.filter(Boolean).length / fields.length) * 100
  );

  // 2. Reachability Score (0-100): Direct accessibility
  let reachability = 0;
  if (phone) reachability += 35;
  if (email) reachability += 35;
  if (address) reachability += 15;
  if (instagram || facebook) reachability += 15;
  const reachabilityScore = Math.min(100, reachability);

  // 3. Engagement Score (0-100): Customer traction & rating strength
  let engagement = 0;
  if (rating >= 4.8) engagement += 40;
  else if (rating >= 4.4) engagement += 30;
  else if (rating >= 4.0) engagement += 20;
  else if (rating > 0) engagement += 10;

  if (reviews >= 1000) engagement += 60;
  else if (reviews >= 300) engagement += 45;
  else if (reviews >= 50) engagement += 30;
  else if (reviews > 0) engagement += 15;

  const engagementScore = Math.min(100, engagement);

  // 4. Opportunity Score (0-100): Priority ranking for sales outreach
  // High rating + high reviews + MISSING website/digital channels = Highest opportunity!
  let opportunity = 30; // base score

  if (!hasWebsite) opportunity += 30; // Missing website is our primary value trigger
  if (!instagram && !facebook) opportunity += 15; // Digital gap

  if (rating >= 4.5) opportunity += 15;
  else if (rating >= 4.0) opportunity += 10;

  if (reviews >= 100) opportunity += 10;

  const isFineDining = category.toLowerCase().includes("fine dining");
  if (isFineDining || priceRange.includes("$$$") || priceRange.includes("Rs")) {
    opportunity += 10;
  }

  const opportunityScore = Math.min(100, Math.max(10, opportunity));

  // 5. Priority Tier Assignment
  let priorityTier: PriorityTier = "Cold";
  if (opportunityScore >= 75) {
    priorityTier = "Hot";
  } else if (opportunityScore >= 50) {
    priorityTier = "Warm";
  }

  return {
    opportunityScore,
    reachabilityScore,
    completenessScore,
    engagementScore,
    priorityTier,
    leadScore: opportunityScore,
  };
}
