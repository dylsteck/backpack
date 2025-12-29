/**
 * Maps route paths to their display titles
 */
export const routeTitles: Record<string, string> = {
  "/": "Home",
  "/apps": "Apps",
};

/**
 * Get the title for a given route path
 * @param pathname - The current route pathname
 * @param appName - Optional app name for app detail pages
 */
export function getRouteTitle(pathname: string, appName?: string): string {
  // Try exact match first
  if (routeTitles[pathname]) {
    return routeTitles[pathname];
  }

  // Handle app detail pages: /apps/$appId -> "Apps → AppName"
  const appDetailMatch = pathname.match(/^\/apps\/(.+)$/);
  if (appDetailMatch) {
    if (appName) {
      return `Apps → ${appName}`;
    }
    // Fallback: capitalize first letter of app ID
    const appId = appDetailMatch[1];
    const fallbackName = appId.charAt(0).toUpperCase() + appId.slice(1);
    return `Apps → ${fallbackName}`;
  }

  // Fallback to pathname with capitalization
  return pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ") || "Home";
}

