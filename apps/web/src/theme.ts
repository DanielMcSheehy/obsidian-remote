import { createTheme } from "@mantine/core";

export const spring = { type: "spring" as const, stiffness: 380, damping: 28 };
export const stagger = 0.02;

export const theme = createTheme({
  primaryColor: "violet",
  primaryShade: 6,
  colors: {
    violet: [
      "#f5f0ff",
      "#ede9fe",
      "#ddd6fe",
      "#c4b5fd",
      "#a78bfa",
      "#8b5cf6",
      "#7c3aed",
      "#6d28d9",
      "#5b21b6",
      "#4c1d95",
    ],
  },
  fontFamily: "Outfit, Inter, system-ui, sans-serif",
  headings: { fontFamily: "Outfit, Inter, system-ui, sans-serif", fontWeight: "600" },
  defaultRadius: "sm",
  components: {
    Tooltip: { defaultProps: { withArrow: true, openDelay: 280 } },
    Notification: { defaultProps: { radius: "md" } },
  },
});
