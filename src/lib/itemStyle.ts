// Colors and badge styles shared by the closet screens (moved unchanged from App.tsx).

export const COLOR_HEX: Record<string, string> = {
  Black: "#2B2927",
  White: "#F7F4EE",
  Navy: "#1e3a5f",
  Grey: "#9CA3AF",
  Charcoal: "#36454F",
  Beige: "#D4B896",
  Brown: "#8B6914",
  Red: "#B91C1C",
  Pink: "#F4A7B9",
  Orange: "#EA580C",
  Yellow: "#CA8A04",
  Green: "#15803D",
  Blue: "#2563EB",
  Purple: "#7C3AED",
  Cream: "#F5F1EB",
  Olive: "#6B7C3E",
  Burgundy: "#800020",
  Camel: "#C19A6B",
  Tan: "#D2B48C",
};

export function getBadgeStyle(badge: string) {
  if (badge.indexOf("Imported") === 0)
    return { background: "#F0F0F5", color: "#2D2D5A", border: "1px solid #C0C0D4" };
  if (badge === "Digitized via Tag")
    return { background: "#EDF5F0", color: "#1A3028", border: "1px solid #C0D4CC" };
  if (badge === "Camera Upload" || badge === "Background Cleaned")
    return { background: "#F5EEF0", color: "#5A2D4A", border: "1px solid #D4B8C4" };
  return { background: "#F0ECE4", color: "#5A4A3A", border: "1px solid #D4C8B8" };
}
