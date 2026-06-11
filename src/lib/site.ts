export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.adewaleconference.org";

// Canonical list of public platform pages. Drives the sitemap now, and will
// drive the primary navigation once each page carries real content.
export const PLATFORM_PAGES = [
  { path: "/", label: "Home" },
  { path: "/about", label: "About" },
  { path: "/editions", label: "Editions" },
  { path: "/results", label: "Hall of Fame" },
  { path: "/resources", label: "Resources" },
  { path: "/news", label: "News" },
  { path: "/gallery", label: "Gallery" },
  { path: "/schools", label: "Schools" },
  { path: "/sponsors", label: "Sponsors" },
  { path: "/faq", label: "FAQ" },
  { path: "/contact", label: "Contact" },
] as const;

export type PlatformPage = (typeof PLATFORM_PAGES)[number];

// Curated primary navigation (a subset of pages — the long tail lives in the
// footer + sitemap). Edit here to change the top nav everywhere.
export const MAIN_NAV = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Editions", href: "/editions" },
  { label: "Hall of Fame", href: "/results" },
  { label: "Resources", href: "/resources" },
  { label: "News", href: "/news" },
] as const;

// Primary call-to-action. The registration experience lives on the home page
// (`#register`); `/#register` routes home and scrolls to it from any page.
export const NAV_CTA = { label: "Register", href: "/#register" } as const;

export type NavItem = { label: string; href: string };
