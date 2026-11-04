import type { MetadataRoute } from "next";
import { BRAND } from "@/config/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: "A free, open-source workspace for game design documents.",
    id: `/${BRAND.slug}`,
    start_url: "/",
    display: "standalone",
    background_color: "#0e0f13",
    theme_color: "#e8793a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
