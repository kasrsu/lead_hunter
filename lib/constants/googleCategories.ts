export interface GoogleCategoryOption {
  id: string; // Official place type ID for Google Places API (New)
  label: string; // Human readable name
  categoryGroup: string; // Grouping category
}

export interface GoogleCategoryGroup {
  groupName: string;
  options: GoogleCategoryOption[];
}

export const GOOGLE_CATEGORY_GROUPS: GoogleCategoryGroup[] = [
  {
    groupName: "Home & Trade Services",
    options: [
      { id: "roofing_contractor", label: "Roofing Contractors", categoryGroup: "Home & Trade Services" },
      { id: "plumber", label: "Plumbers", categoryGroup: "Home & Trade Services" },
      { id: "electrician", label: "Electricians", categoryGroup: "Home & Trade Services" },
      { id: "hvac_contractor", label: "HVAC / Heating & AC Contractors", categoryGroup: "Home & Trade Services" },
      { id: "painter", label: "Painters", categoryGroup: "Home & Trade Services" },
      { id: "general_contractor", label: "General Contractors", categoryGroup: "Home & Trade Services" },
      { id: "landscaper", label: "Landscapers & Lawn Care", categoryGroup: "Home & Trade Services" },
      { id: "pest_control_service", label: "Pest Control Services", categoryGroup: "Home & Trade Services" },
      { id: "locksmith", label: "Locksmiths", categoryGroup: "Home & Trade Services" },
    ],
  },
  {
    groupName: "Food & Hospitality",
    options: [
      { id: "restaurant", label: "Restaurants", categoryGroup: "Food & Hospitality" },
      { id: "cafe", label: "Cafes & Coffee Shops", categoryGroup: "Food & Hospitality" },
      { id: "bakery", label: "Bakeries", categoryGroup: "Food & Hospitality" },
      { id: "bar", label: "Bars & Pubs", categoryGroup: "Food & Hospitality" },
      { id: "catering_service", label: "Catering Services", categoryGroup: "Food & Hospitality" },
      { id: "hotel", label: "Hotels & Lodging", categoryGroup: "Food & Hospitality" },
    ],
  },
  {
    groupName: "Automotive & Transport",
    options: [
      { id: "car_repair", label: "Auto Repair & Mechanics", categoryGroup: "Automotive & Transport" },
      { id: "car_dealer", label: "Car Dealerships", categoryGroup: "Automotive & Transport" },
      { id: "auto_body_shop", label: "Auto Body Shops", categoryGroup: "Automotive & Transport" },
      { id: "car_wash", label: "Car Washes", categoryGroup: "Automotive & Transport" },
      { id: "towing_service", label: "Towing Services", categoryGroup: "Automotive & Transport" },
    ],
  },
  {
    groupName: "Health & Medical",
    options: [
      { id: "dentist", label: "Dentists", categoryGroup: "Health & Medical" },
      { id: "doctor", label: "Medical Clinics & Doctors", categoryGroup: "Health & Medical" },
      { id: "physiotherapist", label: "Physical Therapists", categoryGroup: "Health & Medical" },
      { id: "chiropractor", label: "Chiropractors", categoryGroup: "Health & Medical" },
      { id: "pharmacy", label: "Pharmacies", categoryGroup: "Health & Medical" },
      { id: "optometrist", label: "Optometrists & Eye Care", categoryGroup: "Health & Medical" },
      { id: "veterinary_care", label: "Veterinarians & Animal Hospitals", categoryGroup: "Health & Medical" },
    ],
  },
  {
    groupName: "Professional & B2B Services",
    options: [
      { id: "accounting", label: "Accountants & CPAs", categoryGroup: "Professional & B2B Services" },
      { id: "lawyer", label: "Lawyers & Legal Services", categoryGroup: "Professional & B2B Services" },
      { id: "real_estate_agency", label: "Real Estate Agencies", categoryGroup: "Professional & B2B Services" },
      { id: "insurance_agency", label: "Insurance Agencies", categoryGroup: "Professional & B2B Services" },
      { id: "marketing_agency", label: "Marketing & Advertising Agencies", categoryGroup: "Professional & B2B Services" },
      { id: "employment_agency", label: "Staffing & Employment Agencies", categoryGroup: "Professional & B2B Services" },
    ],
  },
  {
    groupName: "Beauty & Wellness",
    options: [
      { id: "beauty_salon", label: "Beauty Salons", categoryGroup: "Beauty & Wellness" },
      { id: "hair_care", label: "Hair Salons & Stylists", categoryGroup: "Beauty & Wellness" },
      { id: "barber_shop", label: "Barber Shops", categoryGroup: "Beauty & Wellness" },
      { id: "spa", label: "Spas & Wellness Centers", categoryGroup: "Beauty & Wellness" },
      { id: "nail_salon", label: "Nail Salons", categoryGroup: "Beauty & Wellness" },
    ],
  },
  {
    groupName: "Retail & Shopping",
    options: [
      { id: "clothing_store", label: "Clothing Stores", categoryGroup: "Retail & Shopping" },
      { id: "furniture_store", label: "Furniture Stores", categoryGroup: "Retail & Shopping" },
      { id: "hardware_store", label: "Hardware Stores", categoryGroup: "Retail & Shopping" },
      { id: "jewelry_store", label: "Jewelry Stores", categoryGroup: "Retail & Shopping" },
      { id: "electronics_store", label: "Electronics Stores", categoryGroup: "Retail & Shopping" },
      { id: "grocery_store", label: "Grocery Stores", categoryGroup: "Retail & Shopping" },
    ],
  },
  {
    groupName: "Fitness & Recreation",
    options: [
      { id: "gym", label: "Gyms & Fitness Centers", categoryGroup: "Fitness & Recreation" },
      { id: "sports_complex", label: "Sports Facilities", categoryGroup: "Fitness & Recreation" },
      { id: "dance_school", label: "Dance Studios", categoryGroup: "Fitness & Recreation" },
      { id: "martial_arts_school", label: "Martial Arts Academies", categoryGroup: "Fitness & Recreation" },
    ],
  },
];

export const ALL_GOOGLE_CATEGORIES: GoogleCategoryOption[] = GOOGLE_CATEGORY_GROUPS.flatMap(
  (group) => group.options
);
