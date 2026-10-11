import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/sandbox";

/** /robots.txt — 운영자 화면과 내부 주소만 막고 나머지는 전부 엽니다. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/auth/"] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
