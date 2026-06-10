import {
  hasAdminPermission,
  type AdminPermission,
} from "@/lib/admin-permissions";

export type AdminNavigationItem = {
  href: string;
  label: string;
  description: string;
  permission?: AdminPermission;
};

export type AdminNavigationSection = {
  id: string;
  label: string;
  description: string;
  items: AdminNavigationItem[];
};

const adminNavigationSections: AdminNavigationSection[] = [
  {
    id: "workspace",
    label: "Workspace",
    description: "Core dashboard access",
    items: [
      {
        href: "/admin",
        label: "Dashboard",
        description: "Marketplace overview and operational shortcuts.",
        permission: "ADMIN_DASHBOARD",
      },
    ],
  },
  {
    id: "catalog",
    label: "Catalog",
    description: "Marketplace structure and listing controls",
    items: [
      {
        href: "/admin/categories",
        label: "Category Management",
        description: "Manage the full category tree.",
        permission: "CATEGORIES_READ",
      },
      {
        href: "/admin/categories/main",
        label: "Main Categories",
        description: "Review top-level marketplace sections.",
        permission: "CATEGORIES_READ",
      },
      {
        href: "/admin/categories/subcategories",
        label: "Subcategories",
        description: "Inspect deeper category branches.",
        permission: "CATEGORIES_READ",
      },
      {
        href: "/admin/listings",
        label: "Listings",
        description: "Browse and inspect admin listing records.",
        permission: "LISTINGS_READ",
      },
      {
        href: "/admin/priority-rules",
        label: "Priority Rules",
        description: "Control ranking and listing priority logic.",
        permission: "LISTINGS_PRIORITY",
      },
    ],
  },
  {
    id: "sellers",
    label: "Sellers",
    description: "Seller onboarding, trust, and review workflows",
    items: [
      {
        href: "/admin/sellers",
        label: "Seller Dashboard",
        description: "Open the seller operations overview.",
        permission: "USERS_READ",
      },
      {
        href: "/admin/sellers/approvals",
        label: "Approvals",
        description: "Review pending seller submissions.",
        permission: "USERS_READ",
      },
      {
        href: "/admin/sellers/verified",
        label: "Verified Queue",
        description: "Track verified seller status and review state.",
        permission: "USERS_READ",
      },
      {
        href: "/admin/sellers/badges",
        label: "Badge Manager",
        description: "Assign and manage seller badges.",
        permission: "USERS_READ",
      },
      {
        href: "/admin/sellers/privileges",
        label: "Privilege Tiers",
        description: "Control seller privileges and quotas.",
        permission: "USERS_READ",
      },
      {
        href: "/admin/sellers/form",
        label: "Seller Form",
        description: "Update the seller onboarding form.",
        permission: "USERS_WRITE",
      },
      {
        href: "/admin/users",
        label: "Users",
        description: "Manage roles, seller tiers, and verification.",
        permission: "USERS_READ",
      },
      {
        href: "/admin/reviews",
        label: "Reviews",
        description: "Moderate and inspect seller reviews.",
        permission: "REVIEWS_READ",
      },
    ],
  },
  {
    id: "growth",
    label: "Promotions",
    description: "Boosting, payments, and wallet operations",
    items: [
      {
        href: "/admin/boost-packages",
        label: "Boost Packages",
        description: "Configure boost pricing and packages.",
        permission: "BOOSTS_WRITE",
      },
      {
        href: "/admin/boosts",
        label: "Active Boosts",
        description: "Monitor boosted listings and expiry windows.",
        permission: "BOOSTS_READ",
      },
      {
        href: "/admin/transactions",
        label: "Transactions",
        description: "Inspect payment and ledger activity.",
        permission: "TRANSACTIONS_READ",
      },
      {
        href: "/admin/wallet",
        label: "Wallet Operations",
        description: "Review balances and manual wallet changes.",
        permission: "WALLETS_WRITE",
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    description: "Monitoring, revenue, and safety reporting",
    items: [
      {
        href: "/admin/reports",
        label: "Operations Overview",
        description: "Read the main monitoring dashboard.",
        permission: "REPORTS_READ",
      },
      {
        href: "/admin/reports/active-listings",
        label: "Active Listings",
        description: "Measure live inventory and listing health.",
        permission: "REPORTS_READ",
      },
      {
        href: "/admin/reports/paid-listings",
        label: "Paid Listings",
        description: "Track listing-fee performance and status.",
        permission: "REPORTS_READ",
      },
      {
        href: "/admin/reports/category-income",
        label: "Category Income",
        description: "Compare revenue by category.",
        permission: "REPORTS_READ",
      },
      {
        href: "/admin/reports/boost-revenue",
        label: "Boost Revenue",
        description: "Review boost sales and revenue trends.",
        permission: "REPORTS_READ",
      },
      {
        href: "/admin/reports/wallet-payments",
        label: "Wallet Payments",
        description: "Audit wallet top-ups and usage.",
        permission: "REPORTS_READ",
      },
      {
        href: "/admin/reports/sellers",
        label: "Seller Totals",
        description: "Review seller growth and performance.",
        permission: "REPORTS_READ",
      },
      {
        href: "/admin/reports/top-sellers",
        label: "Top Sellers",
        description: "Inspect leading seller performance.",
        permission: "REPORTS_READ",
      },
      {
        href: "/admin/reports/seller-approvals",
        label: "Seller Approvals",
        description: "Track approval demand and backlog.",
        permission: "REPORTS_READ",
      },
      {
        href: "/admin/listing-reports",
        label: "Report Queue",
        description: "Review listing reports awaiting action.",
        permission: "REPORTS_READ",
      },
      {
        href: "/admin/audit-logs",
        label: "Audit Logs",
        description: "Inspect admin activity and write attempts.",
        permission: "AUDIT_LOGS_READ",
      },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    description: "Support and internal awareness",
    items: [
      {
        href: "/messages",
        label: "Support Inbox",
        description: "Open conversations from buyers and sellers.",
        permission: "SUPPORT_READ",
      },
      {
        href: "/notifications",
        label: "Notifications",
        description: "Check system alerts and updates.",
      },
    ],
  },
  {
    id: "account",
    label: "Account",
    description: "Personal admin access",
    items: [
      {
        href: "/profile",
        label: "Profile",
        description: "Manage your own account details.",
      },
    ],
  },
];

export function getAdminNavigationSections(role: string | null | undefined) {
  return adminNavigationSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.permission || hasAdminPermission(role, item.permission),
      ),
    }))
    .filter((section) => section.items.length > 0);
}
