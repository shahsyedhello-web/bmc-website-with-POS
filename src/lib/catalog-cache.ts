import { CATEGORIES } from "./site-data";
import { slugify } from "./admin";

export type CachedProduct = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  short_description: string | null;
  price: number;
  sale_price: number | null;
  unit: string | null;
  category_id: string | null;
  category: string;
  thumbnail_url: string | null;
  is_featured: boolean;
  is_visible: boolean;
  is_archived: boolean;
  sort_order: number;
};

export type CachedCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_visible: boolean;
};

const PRODUCTS_KEY = "bmc_custom_products_cache";
const CATEGORIES_KEY = "bmc_custom_categories_cache";
const DELETED_PRODUCTS_KEY = "bmc_deleted_products_cache";

export const DUMMY_PRODUCT_SLUGS = new Set<string>();

export function getDeletedProductKeys(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DELETED_PRODUCTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addDeletedProductKey(key: string) {
  if (typeof window === "undefined" || !key) return;
  try {
    const keys = getDeletedProductKeys();
    if (!keys.includes(key)) {
      keys.push(key);
      localStorage.setItem(DELETED_PRODUCTS_KEY, JSON.stringify(keys));
    }
  } catch (e) {
    console.error("Failed adding deleted product key", e);
  }
}

export function removeDeletedProductKey(key: string) {
  if (typeof window === "undefined" || !key) return;
  try {
    const keys = getDeletedProductKeys();
    const filtered = keys.filter((k) => k !== key && !k.includes(key) && !key.includes(k));
    localStorage.setItem(DELETED_PRODUCTS_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error("Failed removing deleted product key", e);
  }
}

export function isProductDeleted(product: { id: string; slug: string }): boolean {
  const deletedKeys = getDeletedProductKeys();
  if (!deletedKeys.length) return false;
  const targetSlug = product.slug || product.id.replace(/^(static|prod)-/, "");
  return deletedKeys.some(
    (k) =>
      k === product.id ||
      k === product.slug ||
      k === targetSlug ||
      product.id === `static-${k}` ||
      product.id === `prod-${k}` ||
      product.slug === k.replace(/^(static|prod)-/, ""),
  );
}

export function getInitialDefaultProducts(): CachedProduct[] {
  return [];
}

export function getInitialDefaultCategories(): CachedCategory[] {
  return CATEGORIES.map((cat, idx) => ({
    id: `cat-${slugify(cat)}`,
    name: cat,
    slug: slugify(cat),
    description: null,
    sort_order: idx,
    is_visible: true,
  }));
}

export function getCachedProducts(): CachedProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PRODUCTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const cleanList = parsed.filter((p: CachedProduct) => {
      const slug = p.slug || p.id.replace(/^(static|prod)-/, "");
      if (DUMMY_PRODUCT_SLUGS.has(slug) || DUMMY_PRODUCT_SLUGS.has(p.id)) return false;
      return !isProductDeleted(p);
    });

    if (cleanList.length !== parsed.length) {
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(cleanList));
    }

    return cleanList;
  } catch {
    return [];
  }
}

export function saveCachedProducts(products: CachedProduct[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
    window.dispatchEvent(new Event("catalog_updated"));
  } catch (e) {
    console.error("Failed saving cached products", e);
  }
}

export function getCachedCategories(): CachedCategory[] {
  if (typeof window === "undefined") return getInitialDefaultCategories();
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    if (!raw) {
      const init = getInitialDefaultCategories();
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(init));
      return init;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    const init = getInitialDefaultCategories();
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(init));
    return init;
  } catch {
    return getInitialDefaultCategories();
  }
}

export function saveCachedCategories(categories: CachedCategory[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
    window.dispatchEvent(new Event("catalog_updated"));
  } catch (e) {
    console.error("Failed saving cached categories", e);
  }
}

export function notifyCatalogUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("catalog_updated"));
}
