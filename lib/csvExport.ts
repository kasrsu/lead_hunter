/**
 * Utilities for formatting JSON objects into clean CSV strings and triggering browser file downloads.
 */

function escapeCsvCell(value: any): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  // Escape quotes by doubling them and wrapping in quotes
  return `"${str.replace(/"/g, '""')}"`;
}

export function extractCityCountry(address?: string, cityInput?: string, countryInput?: string) {
  if (cityInput && countryInput) {
    return { city: cityInput, country: countryInput };
  }

  if (!address || typeof address !== "string") {
    return { city: cityInput || "", country: countryInput || "" };
  }

  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) {
    return { city: cityInput || "", country: countryInput || "" };
  }

  const lastPart = parts[parts.length - 1];
  const country = countryInput || lastPart;
  let city = cityInput || "";

  if (parts.length >= 2) {
    const secondLast = parts[parts.length - 2];
    const cleanCity = secondLast
      .replace(/\b[A-Z0-9]{2,8}\b/gi, "")
      .replace(/\b(TX|CA|NY|FL|AZ|CO|GA|ENG|ON|AB|WA|IL|MA|PA)\b/gi, "")
      .trim();
    city = cityInput || cleanCity || secondLast;
  } else if (parts.length === 1) {
    city = cityInput || parts[0];
  }

  return { city, country };
}

export function generateExportFilename(
  leads: any[],
  customLocation?: string,
  customNiche?: string
): string {
  const dateStr = new Date().toISOString().slice(0, 10);

  let city = "";
  let country = "";
  let niche = customNiche || "";

  if (customLocation) {
    const parts = customLocation.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      city = parts[0];
      country = parts[parts.length - 1];
    } else if (parts.length === 1) {
      city = parts[0];
    }
  }

  if ((!city || !country) && leads.length > 0) {
    const firstLead = leads[0];
    const extracted = extractCityCountry(
      firstLead.address || "",
      firstLead.city,
      firstLead.country
    );
    if (!city) city = extracted.city;
    if (!country) country = extracted.country;
    if (!niche && firstLead.category) niche = firstLead.category;
  }

  const sanitize = (str: string) =>
    str
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

  const cleanCity = sanitize(city || "Leads");
  const cleanCountry = sanitize(country || "");
  const cleanNiche = sanitize(niche || "");

  const parts = [cleanCity, cleanCountry, cleanNiche, dateStr].filter(Boolean);
  return `${parts.join("_")}.csv`;
}

export function exportToCsv(filename: string, headers: string[], rows: any[][]): void {
  const csvContent = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportLeadsToCsv(
  leads: any[],
  customFilename?: string,
  locationHint?: string,
  nicheHint?: string
): void {
  const headers = [
    "Business Name",
    "Category",
    "City",
    "Country",
    "Formatted Address",
    "Phone Number",
    "Email",
    "Website",
    "Has Website",
    "Rating",
    "Total Reviews",
    "Lead Audit & Opportunity Metrics",
    "Google Maps URL",
    "Place ID",
  ];

  const rows = leads.map((lead) => {
    const { city, country } = extractCityCountry(lead.address, lead.city, lead.country);
    return [
      lead.name || "",
      lead.category || "",
      city,
      country,
      lead.address || "",
      lead.phone || "",
      lead.email || lead.contactEmail || "",
      lead.website || "",
      lead.hasWebsite || lead.website ? "Yes" : "No",
      lead.rating !== undefined && lead.rating !== null && lead.rating !== "" ? lead.rating : "",
      lead.reviews !== undefined && lead.reviews !== null && lead.reviews !== "" ? lead.reviews : (lead.reviewCount ?? lead.reviews_count ?? ""),
      lead.generatedOpener || lead.pitchDraft || lead.emailBody || "",
      lead.mapsUrl || "",
      lead.placeId || lead.id || "",
    ];
  });

  const finalFilename = customFilename || generateExportFilename(leads, locationHint, nicheHint);

  exportToCsv(finalFilename, headers, rows);
}

export function exportSavedSearchesToCsv(searches: any[], filename = "saved_searches.csv"): void {
  const headers = [
    "Search Name",
    "Categories",
    "Location",
    "Min Rating",
    "Min Reviews",
    "Website Filter",
    "Date Created",
  ];

  const rows = searches.map((item) => [
    item.name || "",
    Array.isArray(item.categories) ? item.categories.join("; ") : item.categories || "",
    item.location || "",
    item.minRating ?? 0,
    item.minReviews ?? 0,
    item.hasWebsite || "all",
    item.createdAt || "",
  ]);

  exportToCsv(filename, headers, rows);
}

export function exportCostLogsToCsv(logs: any[], filename = "api_cost_audit_logs.csv"): void {
  const headers = [
    "Timestamp",
    "Session ID",
    "API Endpoint",
    "SKU Tier",
    "Request Count",
    "Estimated Cost (USD)",
    "Field Mask",
  ];

  const rows = logs.map((log) => [
    log.createdAt || "",
    log.sessionId || "",
    log.endpoint || "",
    log.skuType || "",
    log.requestsCount ?? 1,
    `$${(log.estimatedCostUsd ?? 0).toFixed(4)}`,
    log.fieldMask || "",
  ]);

  exportToCsv(filename, headers, rows);
}
