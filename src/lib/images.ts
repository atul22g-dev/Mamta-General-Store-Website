/** Build an Unsplash placeholder URL (temporary until real product photos). */
export const unsplash = (photoId: string, width = 900) =>
  `https://images.unsplash.com/${photoId}?q=80&w=${width}&auto=format&fit=crop`;

/** Build a Pexels placeholder URL (temporary until real product photos). */
export const pexels = (path: string, width = 900) =>
  `https://images.pexels.com/${path}?auto=compress&cs=tinysrgb&w=${width}`;
