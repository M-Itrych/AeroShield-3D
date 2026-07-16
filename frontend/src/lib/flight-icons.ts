const LIME = "#39ff14";
const ORANGE = "#ff5f1f";

function svg(color: string, alpha: number): string {
  return (
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12">` +
        `<path d="M6 1 L10 11 L6 8 L2 11 Z" fill="${color}" fill-opacity="${alpha}"/>` +
        `</svg>`,
    )
  );
}

export const FLIGHT_ICON_LIME = svg(LIME, 0.9);
export const FLIGHT_ICON_ORANGE = svg(ORANGE, 0.95);
export const FLIGHT_ICON_LIME_DIM = svg(LIME, 0.5);
export const FLIGHT_ICON_ORANGE_DIM = svg(ORANGE, 0.6);
