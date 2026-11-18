import type { Product } from '../types/database';

export function imagesOf(product?: Product | null) {
  const seen = new Set<string>();
  return [...(product?.images ?? [])]
    .sort((a, b) => a.display_order - b.display_order)
    .filter((image) => {
      if (!image.url || seen.has(image.url)) return false;
      seen.add(image.url);
      return true;
    });
}
export function primaryImage(product?: Product | null, color?: string) {
  const all = imagesOf(product);
  const matching = color ? all.filter((i) => i.color_name === color) : [];
  const images = matching.length ? matching : all;
  return images.find((i) => i.is_primary) ?? images[0];
}
export interface GalleryFrame {
  url: string;
  alt: string;
}
export function galleryImagesFor(product: Product): GalleryFrame[] {
  return imagesOf(product).map((image, i) => ({
    url: image.url,
    alt: image.alt_text || `${product.name}, view ${i + 1}`,
  }));
}
export const colorOptionsFor = (product: Product) => [
  ...new Set(product.variants?.filter((v) => v.is_active).map((v) => v.color_name)),
];
export function resolveVariant(product: Product, size: string, color?: string) {
  return product.variants?.find(
    (v) => v.is_active && v.size_name === size && (!color || v.color_name === color)
  );
}
const sizes = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
export function sizeOptionsFor(product: Product, color: string) {
  const index = (s: string) => (sizes.includes(s) ? sizes.indexOf(s) : sizes.length);
  return (product.variants ?? [])
    .filter((v) => v.is_active && v.color_name === color)
    .sort(
      (a, b) =>
        index(a.size_name) - index(b.size_name) ||
        a.size_name.localeCompare(b.size_name, 'en', { numeric: true })
    );
}
export function firstAvailableSize(product: Product, color: string) {
  const available = sizeOptionsFor(product, color).filter((v) => v.stock_quantity > 0);
  return (available.find((v) => v.size_name === 'L') ?? available[0])?.size_name ?? '';
}
export const firstAvailableColor = (product: Product) =>
  product.variants?.find((v) => v.is_active && v.stock_quantity > 0)?.color_name ??
  colorOptionsFor(product)[0] ??
  '';
export const colourNameFor = (product?: Product | null) =>
  product?.variants?.find((v) => v.is_active)?.color_name ?? '';
