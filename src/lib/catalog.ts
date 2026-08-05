import { queryOptions } from "@tanstack/react-query";
import { getCatalog } from "./catalog.functions";
import { SITE, CATEGORIES, type StockStatus } from "./site-data";
import {
  getCachedProducts,
  getCachedCategories,
  isProductDeleted,
  DUMMY_PRODUCT_SLUGS,
  type CachedProduct,
} from "./catalog-cache";

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  price: number;
  originalPrice: number | null;
  unit: string;
  image: string | null;
  images: string[];
  brand: string;
  tags: string[];
  stockStatus: StockStatus;
  stockCount: number;
  sku: string;
  rating: number;
  reviewCount: number;
  specifications: Record<string, string>;
  frequentlyBoughtTogether: string[];
  isNew?: boolean;
  isBestSeller?: boolean;
  featured: boolean;
  sortOrder: number;
};

export type Product = CatalogProduct;

export type Catalog = {
  products: CatalogProduct[];
  categories: string[];
};

export const catalogQueryOptions = queryOptions({
  queryKey: ["catalog"],
  queryFn: async (): Promise<Catalog> => {
    // 1. Fetch from remote Supabase catalog
    try {
      const data = await getCatalog();
      if (data && Array.isArray(data.products)) {
        const cachedProducts = getCachedProducts();
        const cachedBySlug = new Map(cachedProducts.map((c) => [c.slug, c]));
        const cachedById = new Map(cachedProducts.map((c) => [c.id, c]));
        const archivedSlugs = new Set(
          cachedProducts.filter((c) => c.is_archived).map((c) => c.slug),
        );
        const archivedIds = new Set(cachedProducts.filter((c) => c.is_archived).map((c) => c.id));
        const mappedProducts: CatalogProduct[] = data.products
          .filter(
            (p) =>
              !archivedSlugs.has(p.slug) &&
              !archivedIds.has(p.id) &&
              !isProductDeleted(p) &&
              !DUMMY_PRODUCT_SLUGS.has(p.slug) &&
              !DUMMY_PRODUCT_SLUGS.has(p.id),
          )
          .map((p, idx) => {
            const mainImage = p.image || null;
            const images = mainImage ? [mainImage] : [];
            const local = cachedBySlug.get(p.slug) || cachedById.get(p.id);
            const stockVal = local
              ? Number(
                  (local as Record<string, unknown>).stock_quantity ??
                    (local as Record<string, unknown>).stock ??
                    50,
                )
              : 50;

            return {
              id: p.id || `prod-${p.slug}`,
              slug: p.slug,
              name: p.name,
              category: p.category || "General",
              description: p.description || "",
              price: p.price || 0,
              originalPrice: p.originalPrice || null,
              unit: p.unit || "per unit",
              image: mainImage,
              images,
              brand: "BMC Pure Dairy",
              tags: [p.category ? p.category.toLowerCase() : "dairy"],
              stockStatus: stockVal > 0 ? "in_stock" : "out_of_stock",
              stockCount: stockVal,
              sku: `BMC-SKU-${idx + 1}`,
              rating: 4.8,
              reviewCount: 24,
              specifications: {},
              frequentlyBoughtTogether: [],
              isNew: false,
              isBestSeller: false,
              featured: p.featured ?? true,
              sortOrder: p.sortOrder ?? idx,
            };
          });
        const categories = data.categories.length
          ? data.categories
          : Array.from(new Set(mappedProducts.map((p) => p.category)));
        return { products: mappedProducts, categories };
      }
    } catch (error) {
      console.warn("[catalog] remote query failed", error);
    }

    // 2. Read from Local Cached Products & Categories (if offline / admin local storage)
    const cachedProducts = getCachedProducts();
    const cachedCats = getCachedCategories();

    // Filter to only visible and non-archived products for public website view
    const visibleCached = cachedProducts.filter((p) => p.is_visible && !p.is_archived);

    const mappedCached: CatalogProduct[] = visibleCached.map((p, idx) => {
      const mainImage = p.thumbnail_url || null;
      const images = mainImage ? [mainImage] : [];
      const stockVal = Number(
        (p as Record<string, unknown>).stock_quantity ?? (p as Record<string, unknown>).stock ?? 50,
      );

      return {
        id: p.id || `prod-${p.slug}`,
        slug: p.slug,
        name: p.name,
        category: p.category || "General",
        description: p.description || p.short_description || "",
        price: Number(p.price) || 0,
        originalPrice: p.sale_price ? Number(p.price) : null,
        unit: p.unit || "per unit",
        image: mainImage,
        images,
        brand: "BMC Pure Dairy",
        tags: [p.category ? p.category.toLowerCase() : "dairy"],
        stockStatus: stockVal > 0 ? "in_stock" : "out_of_stock",
        stockCount: stockVal,
        sku: `BMC-SKU-${idx + 1}`,
        rating: 4.8,
        reviewCount: 24,
        specifications: {},
        frequentlyBoughtTogether: [],
        isNew: false,
        isBestSeller: false,
        featured: p.is_featured ?? true,
        sortOrder: p.sort_order ?? idx,
      };
    });

    const categoriesList = cachedCats.filter((c) => c.is_visible).map((c) => c.name);

    return {
      categories: categoriesList.length ? categoriesList : Array.from(CATEGORIES),
      products: mappedCached,
    };
  },
  staleTime: 2_000,
  gcTime: 5 * 60_000,
});

export function formatPrice(price: number) {
  return price > 0 ? `Rs. ${price.toLocaleString("en-PK")}` : "Rs. 0 (Rate + Tax)";
}

export function whatsappOrderLink(productName: string, quantity = 1, whatsappNum?: string) {
  const clean = whatsappNum ? whatsappNum.replace(/[^0-9]/g, "") : SITE.whatsapp;
  const message = `Assalam-o-Alaikum Bismillah Milk Corner,\n\nI want to order:\n• ${productName} (Qty: ${quantity})\n\nPlease share current price and delivery confirmation. Thank you!`;
  return `https://wa.me/${clean || SITE.whatsapp}?text=${encodeURIComponent(message)}`;
}

export function whatsappCartOrderLink(
  items: { product: CatalogProduct; quantity: number }[],
  total: number,
  whatsappNum?: string,
) {
  const clean = whatsappNum ? whatsappNum.replace(/[^0-9]/g, "") : SITE.whatsapp;
  const itemsText = items
    .map(
      (item, i) =>
        `${i + 1}. ${item.product.name} — Qty: ${item.quantity} (${formatPrice(item.product.price * item.quantity)})`,
    )
    .join("\n");

  const message = `Assalam-o-Alaikum Bismillah Milk Corner,\n\nI would like to place an order from my website cart:\n\n${itemsText}\n\n*Estimated Total: ${formatPrice(total)}*\n\nPlease confirm availability and delivery slot.`;
  return `https://wa.me/${clean || SITE.whatsapp}?text=${encodeURIComponent(message)}`;
}
