export type AttributeField = {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "toggle";
  options?: string[];
  required?: boolean;
  placeholder?: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  accent: string;
  icon: string;
  countLabel: string;
  schema: AttributeField[];
  children?: Category[];
};

export type Seller = {
  id: string;
  name: string;
  role: "private" | "business" | "moderator" | "admin";
  avatar: string;
  verified: boolean;
  memberSince: string;
  responseRate: string;
  location: string;
  totalListings: number;
  joinedLabel: string;
  bio: string;
};

export type Listing = {
  id: string;
  slug: string;
  title: string;
  categorySlug: string;
  subcategory: string;
  priceLabel: string;
  priceValue: number;
  location: string;
  condition: string;
  status: "Active" | "Draft" | "Sold" | "Expired";
  postedLabel: string;
  description: string;
  featureBullets: string[];
  sellerId: string;
  imageUrl?: string;
  imageUrls?: string[];
  imagePalette: string[];
  attributes: Record<string, string | number | boolean>;
  viewCount: string;
  chatCount: number;
  saved: boolean;
};

export type Conversation = {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  unreadCount: number;
  updatedAt: string;
  messages: {
    id: string;
    senderId: string;
    body: string;
    sentAt: string;
  }[];
};

export type ModerationItem = {
  id: string;
  listingId: string;
  reason: string;
  reportedBy: string;
  status: "Open" | "Approved" | "Rejected";
  submittedAt: string;
};

export const categories: Category[] = [
  {
    id: "cat-motors",
    name: "Motors",
    slug: "motors",
    description: "Cars, bikes, spare parts, and dealer inventory.",
    accent: "linear-gradient(135deg, #ffe7db 0%, #ffd0be 100%)",
    icon: "M",
    countLabel: "12k live ads",
    schema: [
      { key: "make", label: "Make", type: "select", options: ["Toyota", "Honda", "BMW", "Nissan"], required: true },
      { key: "model", label: "Model", type: "text", required: true, placeholder: "Camry" },
      { key: "year", label: "Year", type: "number", required: true, placeholder: "2022" },
      { key: "mileage", label: "Mileage (km)", type: "number", placeholder: "45000" },
      { key: "transmission", label: "Transmission", type: "select", options: ["Automatic", "Manual"] },
    ],
    children: [
      {
        id: "sub-sedan",
        name: "Sedans",
        slug: "sedans",
        description: "Comfortable city and family cars.",
        accent: "",
        icon: "S",
        countLabel: "3.1k",
        schema: [],
      },
      {
        id: "sub-suv",
        name: "SUVs",
        slug: "suvs",
        description: "Large family and off-road vehicles.",
        accent: "",
        icon: "S",
        countLabel: "2.4k",
        schema: [],
      },
    ],
  },
  {
    id: "cat-property",
    name: "Property",
    slug: "property",
    description: "Apartments, villas, offices, and land.",
    accent: "linear-gradient(135deg, #e8f8f2 0%, #c8ece0 100%)",
    icon: "P",
    countLabel: "4.8k listings",
    schema: [
      { key: "propertyType", label: "Property type", type: "select", options: ["Apartment", "Villa", "Office", "Land"], required: true },
      { key: "bedrooms", label: "Bedrooms", type: "number", placeholder: "2" },
      { key: "bathrooms", label: "Bathrooms", type: "number", placeholder: "2" },
      { key: "area", label: "Area (sqft)", type: "number", placeholder: "1200" },
      { key: "furnished", label: "Furnished", type: "toggle" },
    ],
  },
  {
    id: "cat-electronics",
    name: "Electronics",
    slug: "electronics",
    description: "Phones, laptops, consoles, and accessories.",
    accent: "linear-gradient(135deg, #eef6ff 0%, #d8eafe 100%)",
    icon: "E",
    countLabel: "8.1k listings",
    schema: [
      { key: "brand", label: "Brand", type: "text", required: true, placeholder: "Apple" },
      { key: "storage", label: "Storage", type: "text", placeholder: "256GB" },
      { key: "condition", label: "Condition", type: "select", options: ["New", "Like new", "Used"] },
      { key: "warranty", label: "Warranty available", type: "toggle" },
    ],
  },
  {
    id: "cat-jobs",
    name: "Jobs",
    slug: "jobs",
    description: "Hiring, freelance gigs, and business opportunities.",
    accent: "linear-gradient(135deg, #fff4df 0%, #ffe3ab 100%)",
    icon: "J",
    countLabel: "1.2k openings",
    schema: [
      { key: "jobType", label: "Job type", type: "select", options: ["Full-time", "Part-time", "Contract"] },
      { key: "experience", label: "Experience level", type: "select", options: ["Entry", "Mid", "Senior"] },
      { key: "salary", label: "Monthly salary", type: "number", placeholder: "3500" },
    ],
  },
  {
    id: "cat-services",
    name: "Services",
    slug: "services",
    description: "Repair, maintenance, beauty, and local help.",
    accent: "linear-gradient(135deg, #f1f1ff 0%, #ddd6ff 100%)",
    icon: "S",
    countLabel: "950 providers",
    schema: [
      { key: "serviceType", label: "Service type", type: "text", required: true, placeholder: "AC repair" },
      { key: "onsite", label: "On-site service", type: "toggle" },
      { key: "availability", label: "Availability", type: "select", options: ["Today", "Weekdays", "Weekends"] },
    ],
  },
];

export const sellers: Seller[] = [
  {
    id: "seller-samira",
    name: "Samira Hassan",
    role: "business",
    avatar: "SH",
    verified: true,
    memberSince: "2019",
    responseRate: "98%",
    location: "Dubai Marina",
    totalListings: 18,
    joinedLabel: "Member since 2019",
    bio: "Verified marketplace seller focused on clean motors and premium rentals.",
  },
  {
    id: "seller-faisal",
    name: "Faisal Tech Hub",
    role: "business",
    avatar: "FT",
    verified: true,
    memberSince: "2021",
    responseRate: "95%",
    location: "Sharjah",
    totalListings: 34,
    joinedLabel: "Member since 2021",
    bio: "Trusted electronics and accessories store with same-day reply SLA.",
  },
  {
    id: "seller-amira",
    name: "Amira Realty",
    role: "business",
    avatar: "AR",
    verified: true,
    memberSince: "2018",
    responseRate: "97%",
    location: "Jumeirah Village Circle",
    totalListings: 26,
    joinedLabel: "Member since 2018",
    bio: "Property specialist for family rentals and ready-to-move apartments.",
  },
  {
    id: "buyer-current",
    name: "You",
    role: "private",
    avatar: "YU",
    verified: true,
    memberSince: "2024",
    responseRate: "100%",
    location: "Dubai",
    totalListings: 4,
    joinedLabel: "Member since 2024",
    bio: "Current marketplace account used for saved items, listings, and chats.",
  },
];

export const listings: Listing[] = [
  {
    id: "listing-camry-2022",
    slug: "toyota-camry-se-2022",
    title: "2022 Toyota Camry SE",
    categorySlug: "motors",
    subcategory: "Sedans",
    priceLabel: "AED 67,500",
    priceValue: 67500,
    location: "Dubai Marina",
    condition: "Used",
    status: "Active",
    postedLabel: "2 hours ago",
    description:
      "Single-owner Camry in excellent condition with full service history, lane assist, and Apple CarPlay. Clean interior and recently serviced.",
    featureBullets: ["45,000 km", "Automatic", "Full service history", "Verified seller"],
    sellerId: "seller-samira",
    imagePalette: ["#cb5f34", "#f0b994", "#6f584a"],
    attributes: {
      make: "Toyota",
      model: "Camry",
      year: 2022,
      mileage: 45000,
      transmission: "Automatic",
    },
    viewCount: "1.2k views",
    chatCount: 14,
    saved: true,
  },
  {
    id: "listing-marina-rental",
    slug: "marina-two-bedroom-rental",
    title: "2BR Marina apartment with balcony",
    categorySlug: "property",
    subcategory: "Apartments",
    priceLabel: "AED 8,500 / month",
    priceValue: 8500,
    location: "Dubai Marina",
    condition: "Ready to move",
    status: "Active",
    postedLabel: "Today",
    description:
      "Bright two-bedroom apartment with balcony, pool access, covered parking, and a short walk to the tram. Ideal for small families.",
    featureBullets: ["1,240 sqft", "2 bedrooms", "2 bathrooms", "Virtual tour ready"],
    sellerId: "seller-amira",
    imagePalette: ["#23725e", "#9fd8c0", "#f2e0c7"],
    attributes: {
      propertyType: "Apartment",
      bedrooms: 2,
      bathrooms: 2,
      area: 1240,
      furnished: true,
    },
    viewCount: "920 views",
    chatCount: 9,
    saved: true,
  },
  {
    id: "listing-iphone-15",
    slug: "iphone-15-pro-max-256",
    title: "iPhone 15 Pro Max 256GB",
    categorySlug: "electronics",
    subcategory: "Phones",
    priceLabel: "AED 3,650",
    priceValue: 3650,
    location: "Sharjah",
    condition: "Like new",
    status: "Active",
    postedLabel: "1 day ago",
    description:
      "Used gently for three months, battery health at 100%, original box included. Meetup available in Sharjah City Centre.",
    featureBullets: ["256GB", "Natural Titanium", "Original box", "Same-day meetup"],
    sellerId: "seller-faisal",
    imagePalette: ["#375785", "#acc9ea", "#dee8f4"],
    attributes: {
      brand: "Apple",
      storage: "256GB",
      condition: "Like new",
      warranty: false,
    },
    viewCount: "780 views",
    chatCount: 6,
    saved: false,
  },
  {
    id: "listing-ac-service",
    slug: "same-day-ac-repair",
    title: "Same-day AC repair and cleaning",
    categorySlug: "services",
    subcategory: "Home maintenance",
    priceLabel: "From AED 120",
    priceValue: 120,
    location: "Dubai",
    condition: "Available today",
    status: "Active",
    postedLabel: "3 hours ago",
    description:
      "Fast-response AC service for apartments and villas. Coil cleaning, gas top-up, and maintenance report included.",
    featureBullets: ["On-site", "Today available", "Invoice included", "Verified business"],
    sellerId: "seller-samira",
    imagePalette: ["#6d53c1", "#d5ccff", "#eef0ff"],
    attributes: {
      serviceType: "AC repair",
      onsite: true,
      availability: "Today",
    },
    viewCount: "310 views",
    chatCount: 3,
    saved: false,
  },
  {
    id: "listing-marketing-role",
    slug: "marketing-manager-hiring",
    title: "Marketing Manager for local commerce brand",
    categorySlug: "jobs",
    subcategory: "Marketing",
    priceLabel: "AED 9,000 / month",
    priceValue: 9000,
    location: "Business Bay",
    condition: "Hiring",
    status: "Active",
    postedLabel: "4 days ago",
    description:
      "Growth-minded marketing manager needed for campaign planning, marketplace partnerships, and analytics reporting.",
    featureBullets: ["Full-time", "Hybrid", "Mid-senior level", "Immediate start"],
    sellerId: "seller-samira",
    imagePalette: ["#f1b65d", "#ffebbf", "#6f604a"],
    attributes: {
      jobType: "Full-time",
      experience: "Mid",
      salary: 9000,
    },
    viewCount: "540 views",
    chatCount: 2,
    saved: true,
  },
  {
    id: "listing-draft-console",
    slug: "playstation-5-draft",
    title: "PlayStation 5 Disc Edition",
    categorySlug: "electronics",
    subcategory: "Gaming",
    priceLabel: "AED 1,650",
    priceValue: 1650,
    location: "Dubai Silicon Oasis",
    condition: "Used",
    status: "Draft",
    postedLabel: "Draft updated 1 hour ago",
    description:
      "Draft listing for a PS5 console with one controller and FIFA included.",
    featureBullets: ["Draft", "1 controller", "FIFA included", "Pickup only"],
    sellerId: "buyer-current",
    imagePalette: ["#1c3f68", "#b9dbff", "#f6fbff"],
    attributes: {
      brand: "Sony",
      storage: "825GB",
      condition: "Used",
      warranty: false,
    },
    viewCount: "Not published",
    chatCount: 0,
    saved: false,
  },
];

export const savedSearches = [
  { id: "save-1", label: "2BR apartment in Marina under AED 9k" },
  { id: "save-2", label: "Toyota Camry 2020+ under AED 75k" },
  { id: "save-3", label: "iPhone 15 Pro Max in Sharjah" },
];

export const conversations: Conversation[] = [
  {
    id: "conv-1",
    listingId: "listing-marina-rental",
    buyerId: "buyer-current",
    sellerId: "seller-amira",
    unreadCount: 2,
    updatedAt: "2m ago",
    messages: [
      { id: "msg-1", senderId: "buyer-current", body: "Hi, is this apartment still available this week?", sentAt: "10:22" },
      { id: "msg-2", senderId: "seller-amira", body: "Yes, it is. I can share a viewing slot tomorrow afternoon.", sentAt: "10:24" },
      { id: "msg-3", senderId: "seller-amira", body: "Would 4 PM work for you?", sentAt: "10:25" },
    ],
  },
  {
    id: "conv-2",
    listingId: "listing-camry-2022",
    buyerId: "buyer-current",
    sellerId: "seller-samira",
    unreadCount: 0,
    updatedAt: "27m ago",
    messages: [
      { id: "msg-4", senderId: "buyer-current", body: "Can you share the VIN and service history photos?", sentAt: "09:18" },
      { id: "msg-5", senderId: "seller-samira", body: "Absolutely. Uploading them now along with the last two service invoices.", sentAt: "09:21" },
    ],
  },
  {
    id: "conv-3",
    listingId: "listing-iphone-15",
    buyerId: "buyer-current",
    sellerId: "seller-faisal",
    unreadCount: 0,
    updatedAt: "Yesterday",
    messages: [
      { id: "msg-6", senderId: "buyer-current", body: "Can we meet after work today?", sentAt: "Yesterday 18:40" },
      { id: "msg-7", senderId: "seller-faisal", body: "Yes, I am available after 7 PM near City Centre.", sentAt: "Yesterday 18:48" },
    ],
  },
];

export const moderationQueue: ModerationItem[] = [
  {
    id: "mod-1",
    listingId: "listing-camry-2022",
    reason: "Possible duplicate vehicle post",
    reportedBy: "User report",
    status: "Open",
    submittedAt: "Today, 09:12",
  },
  {
    id: "mod-2",
    listingId: "listing-iphone-15",
    reason: "Price mismatch with description",
    reportedBy: "Moderator rule",
    status: "Open",
    submittedAt: "Today, 08:40",
  },
  {
    id: "mod-3",
    listingId: "listing-ac-service",
    reason: "Need business verification follow-up",
    reportedBy: "Operations",
    status: "Approved",
    submittedAt: "Yesterday, 16:10",
  },
];

export const phaseOneHighlights = [
  "Email and phone-based onboarding with OTP verification",
  "Category-driven listing wizard with draft auto-save",
  "Search, sort, and listing detail flows for active inventory",
  "Saved items, my listings, and seller profile basics",
  "Inbox and real-time chat workspace mock",
  "Admin moderation queue aligned to MVP hardening work",
];

export const quickStats = [
  { label: "Live listings", value: "4,800+" },
  { label: "Open conversations", value: "38" },
  { label: "Saved searches", value: String(savedSearches.length) },
  { label: "Moderation queue", value: "17 open" },
];

export const currentUser = sellers.find((seller) => seller.id === "buyer-current")!;

export function getListingById(listingId: string) {
  return listings.find((listing) => listing.id === listingId);
}

export function getSellerById(sellerId: string) {
  return sellers.find((seller) => seller.id === sellerId);
}

export function getCategoryBySlug(categorySlug: string) {
  return categories.find((category) => category.slug === categorySlug);
}

export function getRelatedListings(listing: Listing) {
  return listings
    .filter(
      (item) => item.id !== listing.id && item.categorySlug === listing.categorySlug
    )
    .slice(0, 3);
}

export function getListingsForCurrentUser() {
  return listings.filter((listing) => listing.sellerId === currentUser.id);
}

export function getSavedListings() {
  return listings.filter((listing) => listing.saved);
}
