function parseJson(v, fallback = []) {
  if (v == null) return fallback;
  try {
    const parsed = JSON.parse(v);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

const BADGES = () => [
  { key: 'new', label: 'New', active: 'new_arrival' },
  { key: 'best', label: 'Best Seller', active: 'best_seller' },
  { key: 'sale', label: 'Sale', active: 'on_sale' },
  { key: 'trending', label: 'Trending', active: 'trending' }
];

function shapeProduct(row) {
  if (!row) return null;
  const images = parseJson(row.images_json);
  const gallery = images.length ? images : [row.thumbnail].filter(Boolean);
  const salePrice = Number(row.sale_price || row.price || 0);
  const price = Number(row.price || 0);
  const discount = Number(row.discount_pct || 0);
  return {
    id: row.id,
    sku: row.sku,
    name: row.title,
    title: row.title,
    slug: row.slug,
    brand: row.brand_name ? { id: row.brand_id, name: row.brand_name, slug: row.brand_slug } : null,
    category: row.category_name ? { id: row.category_id, name: row.category_name, slug: row.category_slug } : null,
    mainCategory: row.main_category,
    productType: row.product_type,
    size: row.size,
    description: row.description || '',
    shortDescription: row.short_description || '',
    price,
    salePrice,
    originalPrice: price,
    discount,
    hasDiscount: discount > 0 && salePrice < price,
    currency: row.currency || 'BDT',
    stock: Number(row.stock || 0),
    inStock: Number(row.stock || 0) > 0,
    status: row.status,
    featured: !!row.featured,
    bestSeller: !!row.best_seller,
    newArrival: !!row.new_arrival,
    trending: !!row.trending,
    onSale: !!row.on_sale,
    images: gallery,
    thumbnail: row.thumbnail || gallery[0] || '',
    rating: Number(row.rating || 0),
    reviewCount: Number(row.review_count || 0),
    ingredients: parseJson(row.ingredients_json),
    benefits: parseJson(row.benefits_json),
    howToUse: row.how_to_use || '',
    skinTypes: parseJson(row.skin_types_json),
    concerns: parseJson(row.concerns_json),
    tags: parseJson(row.tags_json),
    variants: (row.variants ? row.variants : []).map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.size,
      price: Number(v.price),
      oldPrice: Number(v.old_price || v.price),
      stock: Number(v.stock),
      image: v.image || row.thumbnail
    })),
    views: Number(row.views || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

module.exports = { shapeProduct, parseJson, BADGES };