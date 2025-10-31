/**
 * Maps route paths to their display titles
 */
export const routeTitles: Record<string, string> = {
  "/": "Home",
  "/apps": "Apps",
};

/**
 * Get the title for a given route path
 */
export function getRouteTitle(pathname: string): string {
  // Try exact match first
  if (routeTitles[pathname]) {
    return routeTitles[pathname];
  }

  // Fallback to pathname with capitalization
  return pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ") || "Home";
}

