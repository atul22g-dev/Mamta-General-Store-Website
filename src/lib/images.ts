/** Build an Unsplash placeholder URL (temporary until real product photos). */
export const unsplash = (photoId: string, width = 900) =>
  `https://images.unsplash.com/${photoId}?q=80&w=${width}&auto=format&fit=crop`;
