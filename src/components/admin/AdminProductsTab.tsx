import { useState } from 'react';
import {
  Check,
  Edit3,
  Eye,
  EyeOff,
  ImagePlus,
  Plus,
  Ruler,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { formatEGP, slugify } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import type { Product, ProductImage, ProductVariant, SizeChartRow } from '../../types/database';

interface AdminProductsTabProps {
  products: Product[];
  onRefresh: () => Promise<void>;
}

interface VariantDraft {
  id?: string;
  sku: string;
  color_name: string;
  color_hex: string;
  size_name: string;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
}

interface SizeChartDraft {
  id?: string;
  size_name: string;
  size_order: number;
  weight_min_kg: number;
  weight_max_kg: number;
  height_min_cm: number;
  height_max_cm: number;
  waist_cm: string;
  hip_cm: string;
  inseam_cm: string;
  length_cm: string;
  thigh_cm: string;
}

interface ImageDraft {
  id?: string;
  url: string;
  alt_text: string;
  color_name: string;
  display_order: number;
  is_primary: boolean;
}

export function AdminProductsTab({ products, onRefresh }: AdminProductsTabProps) {
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [fabricInfo, setFabricInfo] = useState('');
  const [fitInfo, setFitInfo] = useState('');
  const [careInstructions, setCareInstructions] = useState('');
  const [price, setPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [collectionName, setCollectionName] = useState('2026 Collection');
  const [isNewArrival, setIsNewArrival] = useState(true);
  const [isBestSeller, setIsBestSeller] = useState(false);
  const [isTrending, setIsTrending] = useState(false);
  const [isFeatured, setIsFeatured] = useState(true);
  const [isPublished, setIsPublished] = useState(true);

  const [images, setImages] = useState<ImageDraft[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [sizeCharts, setSizeCharts] = useState<SizeChartDraft[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openNewModal = () => {
    setEditingProduct(null);
    setName('');
    setSlug('');
    setDescription('');
    setFabricInfo('');
    setFitInfo('');
    setCareInstructions('');
    setPrice('');
    setOriginalPrice('');
    setCollectionName('2026 Collection');
    setIsNewArrival(true);
    setIsBestSeller(false);
    setIsTrending(false);
    setIsFeatured(true);
    setIsPublished(true);
    setImages([]);
    setVariants([
      {
        sku: '',
        color_name: 'Obsidian Black',
        color_hex: '#111111',
        size_name: 'S',
        stock_quantity: 10,
        low_stock_threshold: 3,
        is_active: true,
      },
      {
        sku: '',
        color_name: 'Obsidian Black',
        color_hex: '#111111',
        size_name: 'M',
        stock_quantity: 10,
        low_stock_threshold: 3,
        is_active: true,
      },
      {
        sku: '',
        color_name: 'Obsidian Black',
        color_hex: '#111111',
        size_name: 'L',
        stock_quantity: 10,
        low_stock_threshold: 3,
        is_active: true,
      },
    ]);
    setSizeCharts([
      {
        size_name: 'S',
        size_order: 1,
        weight_min_kg: 46,
        weight_max_kg: 56,
        height_min_cm: 155,
        height_max_cm: 168,
        waist_cm: '66-70',
        hip_cm: '90-95',
        inseam_cm: '76',
        length_cm: '104',
        thigh_cm: '56',
      },
      {
        size_name: 'M',
        size_order: 2,
        weight_min_kg: 56,
        weight_max_kg: 66,
        height_min_cm: 160,
        height_max_cm: 174,
        waist_cm: '71-76',
        hip_cm: '96-102',
        inseam_cm: '78',
        length_cm: '106',
        thigh_cm: '59',
      },
      {
        size_name: 'L',
        size_order: 3,
        weight_min_kg: 66,
        weight_max_kg: 78,
        height_min_cm: 164,
        height_max_cm: 180,
        waist_cm: '77-84',
        hip_cm: '103-110',
        inseam_cm: '80',
        length_cm: '108',
        thigh_cm: '62',
      },
    ]);
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setSlug(p.slug);
    setDescription(p.description);
    setFabricInfo(p.fabric_info);
    setFitInfo(p.fit_info);
    setCareInstructions(p.care_instructions);
    setPrice(String(p.price));
    setOriginalPrice(p.original_price ? String(p.original_price) : '');
    setCollectionName(p.collection_name);
    setIsNewArrival(p.is_new_arrival);
    setIsBestSeller(p.is_best_seller);
    setIsTrending(p.is_trending);
    setIsFeatured(p.is_featured);
    setIsPublished(p.is_published);

    setImages(
      (p.images ?? []).map((img: ProductImage) => ({
        id: img.id,
        url: img.url,
        alt_text: img.alt_text,
        color_name: img.color_name ?? '',
        display_order: img.display_order,
        is_primary: img.is_primary,
      }))
    );

    setVariants(
      (p.variants ?? []).map((v: ProductVariant) => ({
        id: v.id,
        sku: v.sku ?? '',
        color_name: v.color_name,
        color_hex: v.color_hex,
        size_name: v.size_name,
        stock_quantity: v.stock_quantity,
        low_stock_threshold: v.low_stock_threshold,
        is_active: v.is_active,
      }))
    );

    setSizeCharts(
      (p.size_charts ?? []).map((sc: SizeChartRow) => ({
        id: sc.id,
        size_name: sc.size_name,
        size_order: sc.size_order,
        weight_min_kg: Number(sc.weight_min_kg),
        weight_max_kg: Number(sc.weight_max_kg),
        height_min_cm: Number(sc.height_min_cm),
        height_max_cm: Number(sc.height_max_cm),
        waist_cm: sc.waist_cm,
        hip_cm: sc.hip_cm,
        inseam_cm: sc.inseam_cm,
        length_cm: sc.length_cm,
        thigh_cm: sc.thigh_cm,
      }))
    );
    setError(null);
    setIsModalOpen(true);
  };

  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !supabase) return;

    setUploadingImage(true);
    setError(null);

    try {
      const uploaded: ImageDraft[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop() || 'jpg';
        const filePath = `pants/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('product-images')
          .upload(filePath, file, { upsert: false });

        if (uploadErr) {
          throw new Error(uploadErr.message);
        }

        const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(filePath);
        uploaded.push({
          url: urlData.publicUrl,
          alt_text: name || 'THREE WAYS STUDIOS women pants',
          color_name: '',
          display_order: images.length + uploaded.length,
          is_primary: images.length === 0 && uploaded.length === 0,
        });
      }
      setImages((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Image upload failed: ${err.message}`
          : 'Image upload failed. Verify Supabase Storage bucket "product-images".'
      );
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleAddExternalImageUrl = () => {
    if (!imageUrlInput.trim()) return;
    setImages((prev) => [
      ...prev,
      {
        url: imageUrlInput.trim(),
        alt_text: name || 'THREE WAYS STUDIOS women pants',
        color_name: '',
        display_order: prev.length,
        is_primary: prev.length === 0,
      },
    ]);
    setImageUrlInput('');
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setError(null);

    const parsedPrice = Number(price);
    const parsedOrig = originalPrice.trim() ? Number(originalPrice) : null;
    if (!name.trim() || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError('Product name and valid EGP price are required.');
      return;
    }

    const finalSlug = slugify(slug.trim() || name.trim());
    if (!finalSlug) {
      setError('A valid product URL slug is required.');
      return;
    }

    setSaving(true);
    try {
      let productId = editingProduct?.id;

      const productPayload = {
        name: name.trim(),
        slug: finalSlug,
        description: description.trim(),
        fabric_info: fabricInfo.trim(),
        fit_info: fitInfo.trim(),
        care_instructions: careInstructions.trim(),
        price: parsedPrice,
        original_price: parsedOrig,
        category: "Women's Pants",
        collection_name: collectionName.trim() || '2026 Collection',
        is_new_arrival: isNewArrival,
        is_best_seller: isBestSeller,
        is_trending: isTrending,
        is_featured: isFeatured,
        is_published: isPublished,
      };

      if (productId) {
        const { error: updErr } = await supabase
          .from('products')
          .update(productPayload)
          .eq('id', productId);
        if (updErr) throw new Error(updErr.message);
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from('products')
          .insert(productPayload)
          .select('id')
          .single();
        if (insErr || !inserted) throw new Error(insErr?.message ?? 'Insert failed');
        productId = inserted.id;
      }

      // Sync Images
      await supabase.from('product_images').delete().eq('product_id', productId);
      if (images.length > 0) {
        const hasPrimary = images.some((i) => i.is_primary);
        const { error: imgErr } = await supabase.from('product_images').insert(
          images.map((img, idx) => ({
            product_id: productId,
            url: img.url,
            alt_text: img.alt_text || name.trim(),
            color_name: img.color_name.trim() || null,
            display_order: idx,
            is_primary: hasPrimary ? img.is_primary : idx === 0,
          }))
        );
        if (imgErr) throw new Error(imgErr.message);
      }

      // Sync Variants (upsert existing by id, delete removed, insert new)
      const existingIds = (editingProduct?.variants ?? []).map((v) => v.id);
      const keptIds = variants.map((v) => v.id).filter(Boolean) as string[];
      const removedIds = existingIds.filter((id) => !keptIds.includes(id));

      if (removedIds.length > 0) {
        await supabase.from('product_variants').delete().in('id', removedIds);
      }

      for (const v of variants) {
        const payload = {
          product_id: productId,
          sku: v.sku.trim() || null,
          color_name: v.color_name.trim() || 'Black',
          color_hex: v.color_hex || '#111111',
          size_name: v.size_name.trim() || 'M',
          stock_quantity: Math.max(0, Number(v.stock_quantity) || 0),
          low_stock_threshold: Math.max(0, Number(v.low_stock_threshold) || 3),
          is_active: v.is_active,
        };
        if (v.id) {
          const { error: vErr } = await supabase
            .from('product_variants')
            .update(payload)
            .eq('id', v.id);
          if (vErr) throw new Error(vErr.message);
        } else {
          const { error: vErr } = await supabase.from('product_variants').insert(payload);
          if (vErr) throw new Error(vErr.message);
        }
      }

      // Sync Product-Specific Size Chart
      await supabase.from('size_charts').delete().eq('product_id', productId);
      if (sizeCharts.length > 0) {
        const { error: scErr } = await supabase.from('size_charts').insert(
          sizeCharts.map((sc, idx) => ({
            product_id: productId,
            size_name: sc.size_name.trim(),
            size_order: idx + 1,
            weight_min_kg: Number(sc.weight_min_kg) || 45,
            weight_max_kg: Number(sc.weight_max_kg) || 55,
            height_min_cm: Number(sc.height_min_cm) || 155,
            height_max_cm: Number(sc.height_max_cm) || 168,
            waist_cm: sc.waist_cm,
            hip_cm: sc.hip_cm,
            inseam_cm: sc.inseam_cm,
            length_cm: sc.length_cm,
            thigh_cm: sc.thigh_cm,
          }))
        );
        if (scErr) throw new Error(scErr.message);
      }

      await onRefresh();
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!supabase) return;
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    await supabase.from('products').delete().eq('id', product.id);
    await onRefresh();
  };

  const handleTogglePublished = async (product: Product) => {
    if (!supabase) return;
    await supabase
      .from('products')
      .update({ is_published: !product.is_published })
      .eq('id', product.id);
    await onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium tracking-[0.2em] text-white uppercase">
            Women&apos;s Pants Catalog ({products.length})
          </h2>
          <p className="mt-1 text-xs text-[#9e9494]">
            Manage styles, EGP pricing, Supabase Storage photography, variants, and Smart Size
            Finder charts.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewModal}
          className="inline-flex items-center gap-2 rounded-full bg-[#b30e16] px-5 py-2.5 text-xs font-medium tracking-[0.18em] text-white uppercase hover:bg-[#d4121b]"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Women&apos;s Pants
        </button>
      </div>

      {/* Product List */}
      {products.length === 0 ? (
        <div className="border border-white/12 bg-white/[0.015] p-12 text-center">
          <p className="text-sm text-white">No products in database yet.</p>
          <p className="mt-2 text-xs text-[#9e9494]">
            Click &ldquo;Add Women&apos;s Pants&rdquo; above to create your first garment.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-white/12 bg-white/[0.025]">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/12 text-[10px] tracking-[0.18em] text-[#9e9494] uppercase">
                <th className="p-4 font-medium">Product</th>
                <th className="p-4 font-medium">Price</th>
                <th className="p-4 font-medium">Stock</th>
                <th className="p-4 font-medium">Tags</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {products.map((p) => {
                const totalStock = (p.variants ?? []).reduce((s, v) => s + v.stock_quantity, 0);
                return (
                  <tr key={p.id} className="hover:bg-white/[0.02]">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-11 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-[#150d0f]">
                          {p.images?.[0]?.url && (
                            <img
                              src={p.images[0].url}
                              alt={p.name}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-white">{p.name}</p>
                          <p className="text-[11px] text-[#847878]">/{p.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-medium text-white">{formatEGP(p.price)}</span>
                      {p.original_price && (
                        <span className="ml-2 text-[#786d6d] line-through">
                          {formatEGP(p.original_price)}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-[#cfc6c6]">
                      {totalStock} units ({(p.variants ?? []).length} variants)
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {p.is_new_arrival && (
                          <span className="border border-white/15 px-1.5 py-0.5 text-[10px] text-[#e6dfdf]">
                            New
                          </span>
                        )}
                        {p.is_best_seller && (
                          <span className="border border-white/15 px-1.5 py-0.5 text-[10px] text-[#e6dfdf]">
                            Best
                          </span>
                        )}
                        {p.is_trending && (
                          <span className="border border-white/15 px-1.5 py-0.5 text-[10px] text-[#e6dfdf]">
                            Trending
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => handleTogglePublished(p)}
                        className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[10px] tracking-[0.14em] uppercase ${
                          p.is_published
                            ? 'border-[#7bd389]/40 bg-[#7bd389]/10 text-[#9ae6a6]'
                            : 'border-white/20 text-[#9e9494]'
                        }`}
                      >
                        {p.is_published ? (
                          <>
                            <Eye className="h-3 w-3" /> Published
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-3 w-3" /> Draft
                          </>
                        )}
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(p)}
                          className="border border-white/20 px-3 py-1.5 text-[11px] text-white hover:border-white"
                        >
                          <Edit3 className="inline h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(p)}
                          aria-label={`Delete ${p.name}`}
                          className="border border-white/15 p-1.5 text-[#9e9494] hover:border-[#ff6b6b] hover:text-[#ff6b6b]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Product Editor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/85 p-4 pt-10 pb-16 backdrop-blur-sm">
          <div className="w-full max-w-4xl border border-white/15 bg-[#0a0607] p-6 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between border-b border-white/12 pb-4">
              <h3 className="text-sm font-medium tracking-[0.2em] text-white uppercase">
                {editingProduct ? `Edit: ${editingProduct.name}` : 'New Women’s Pants Style'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full border border-white/15 p-1.5 text-[#cfc6c6] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="mt-6 space-y-8">
              {/* Basic Info */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] tracking-[0.16em] text-[#9e9494] uppercase">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!editingProduct) setSlug(slugify(e.target.value));
                    }}
                    placeholder="e.g. Obsidian Wide-Leg Cargo Pant"
                    className="w-full border border-white/15 bg-black/50 px-3 py-2 text-xs text-white focus:border-[#b30e16] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] tracking-[0.16em] text-[#9e9494] uppercase">
                    URL Slug *
                  </label>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(slugify(e.target.value))}
                    className="w-full border border-white/15 bg-black/50 px-3 py-2 text-xs text-white focus:border-[#b30e16] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] tracking-[0.16em] text-[#9e9494] uppercase">
                    Current Price (EGP) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="850"
                    className="w-full border border-white/15 bg-black/50 px-3 py-2 text-xs text-white focus:border-[#b30e16] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] tracking-[0.16em] text-[#9e9494] uppercase">
                    Original Price Before Discount (Optional EGP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value)}
                    placeholder="950"
                    className="w-full border border-white/15 bg-black/50 px-3 py-2 text-xs text-white focus:border-[#b30e16] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] tracking-[0.16em] text-[#9e9494] uppercase">
                    Collection Name
                  </label>
                  <input
                    type="text"
                    value={collectionName}
                    onChange={(e) => setCollectionName(e.target.value)}
                    className="w-full border border-white/15 bg-black/50 px-3 py-2 text-xs text-white focus:border-[#b30e16] focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-4 pt-4 text-xs text-[#e6dfdf]">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={isPublished}
                      onChange={(e) => setIsPublished(e.target.checked)}
                    />
                    Published
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={isNewArrival}
                      onChange={(e) => setIsNewArrival(e.target.checked)}
                    />
                    New Arrival
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={isBestSeller}
                      onChange={(e) => setIsBestSeller(e.target.checked)}
                    />
                    Best Seller
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={isTrending}
                      onChange={(e) => setIsTrending(e.target.checked)}
                    />
                    Trending
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={isFeatured}
                      onChange={(e) => setIsFeatured(e.target.checked)}
                    />
                    Featured
                  </label>
                </div>
              </div>

              {/* Descriptions */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[10px] tracking-[0.16em] text-[#9e9494] uppercase">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full border border-white/15 bg-black/50 px-3 py-2 text-xs text-white focus:border-[#b30e16] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] tracking-[0.16em] text-[#9e9494] uppercase">
                    Fabric &amp; Material
                  </label>
                  <input
                    type="text"
                    value={fabricInfo}
                    onChange={(e) => setFabricInfo(e.target.value)}
                    placeholder="e.g. 100% Heavyweight Cotton Twill (380 GSM)"
                    className="w-full border border-white/15 bg-black/50 px-3 py-2 text-xs text-white focus:border-[#b30e16] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] tracking-[0.16em] text-[#9e9494] uppercase">
                    Fit &amp; Cut
                  </label>
                  <input
                    type="text"
                    value={fitInfo}
                    onChange={(e) => setFitInfo(e.target.value)}
                    placeholder="e.g. High-rise, relaxed wide-leg silhouette"
                    className="w-full border border-white/15 bg-black/50 px-3 py-2 text-xs text-white focus:border-[#b30e16] focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[10px] tracking-[0.16em] text-[#9e9494] uppercase">
                    Care Instructions
                  </label>
                  <input
                    type="text"
                    value={careInstructions}
                    onChange={(e) => setCareInstructions(e.target.value)}
                    placeholder="e.g. Cold gentle wash inside out. Do not tumble dry."
                    className="w-full border border-white/15 bg-black/50 px-3 py-2 text-xs text-white focus:border-[#b30e16] focus:outline-none"
                  />
                </div>
              </div>

              {/* Images Upload & Management */}
              <div className="border-t border-white/10 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="text-xs font-medium tracking-[0.18em] text-white uppercase">
                    Product Images (Supabase Storage)
                  </h4>
                  <label className="inline-flex cursor-pointer items-center gap-2 border border-white/25 px-3 py-1.5 text-[11px] text-white hover:border-white">
                    <ImagePlus className="h-3.5 w-3.5" />
                    {uploadingImage ? 'Uploading...' : 'Upload Files'}
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      onChange={handleUploadFiles}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    type="url"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="Or paste image URL..."
                    className="flex-1 border border-white/15 bg-black/50 px-3 py-2 text-xs text-white focus:border-[#b30e16] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddExternalImageUrl}
                    className="border border-white/20 px-4 py-2 text-xs text-white hover:border-white"
                  >
                    Add URL
                  </button>
                </div>

                {images.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {images.map((img, idx) => (
                      <div key={idx} className="border border-white/15 bg-white/[0.015] p-2">
                        <div className="aspect-[3/4] overflow-hidden bg-black">
                          <img src={img.url} alt="" className="h-full w-full object-cover" />
                        </div>
                        <input
                          type="text"
                          value={img.color_name}
                          onChange={(e) =>
                            setImages((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, color_name: e.target.value } : item
                              )
                            )
                          }
                          placeholder="Color tag (optional)"
                          className="mt-2 w-full border border-white/10 bg-black/60 px-2 py-1 text-[10px] text-white"
                        />
                        <div className="mt-2 flex items-center justify-between text-[10px]">
                          <button
                            type="button"
                            onClick={() =>
                              setImages((prev) =>
                                prev.map((item, i) => ({ ...item, is_primary: i === idx }))
                              )
                            }
                            className={`inline-flex items-center gap-1 ${
                              img.is_primary ? 'text-[#e87a80]' : 'text-[#9e9494]'
                            }`}
                          >
                            <Check className="h-3 w-3" />
                            {img.is_primary ? 'Primary' : 'Set Primary'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setImages((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="text-[#9e9494] hover:text-[#ff6b6b]"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Color & Size Variants */}
              <div className="border-t border-white/10 pt-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium tracking-[0.18em] text-white uppercase">
                    Variants &amp; Stock
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setVariants((prev) => [
                        ...prev,
                        {
                          sku: '',
                          color_name: prev[0]?.color_name || 'Obsidian Black',
                          color_hex: prev[0]?.color_hex || '#111111',
                          size_name: 'XL',
                          stock_quantity: 5,
                          low_stock_threshold: 3,
                          is_active: true,
                        },
                      ])
                    }
                    className="inline-flex items-center gap-1.5 border border-white/20 px-3 py-1 text-[11px] text-white hover:border-white"
                  >
                    <Plus className="h-3 w-3" /> Add Variant
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {variants.map((v, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-2 items-center gap-2 border border-white/10 bg-white/[0.02] p-2.5 sm:grid-cols-7"
                    >
                      <input
                        type="text"
                        value={v.color_name}
                        onChange={(e) =>
                          setVariants((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, color_name: e.target.value } : row
                            )
                          )
                        }
                        placeholder="Color"
                        className="border border-white/15 bg-black/50 px-2 py-1.5 text-xs text-white"
                      />
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={v.color_hex}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, color_hex: e.target.value } : row
                              )
                            )
                          }
                          className="h-7 w-9 cursor-pointer bg-transparent"
                        />
                        <input
                          type="text"
                          value={v.size_name}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, size_name: e.target.value } : row
                              )
                            )
                          }
                          placeholder="Size"
                          className="w-full border border-white/15 bg-black/50 px-2 py-1.5 text-xs text-white"
                        />
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={v.stock_quantity}
                        onChange={(e) =>
                          setVariants((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, stock_quantity: Number(e.target.value) } : row
                            )
                          )
                        }
                        placeholder="Stock"
                        className="border border-white/15 bg-black/50 px-2 py-1.5 text-xs text-white"
                      />
                      <input
                        type="number"
                        min="0"
                        value={v.low_stock_threshold}
                        onChange={(e) =>
                          setVariants((prev) =>
                            prev.map((row, i) =>
                              i === idx
                                ? { ...row, low_stock_threshold: Number(e.target.value) }
                                : row
                            )
                          )
                        }
                        placeholder="Alert @"
                        className="border border-white/15 bg-black/50 px-2 py-1.5 text-xs text-white"
                      />
                      <input
                        type="text"
                        value={v.sku}
                        onChange={(e) =>
                          setVariants((prev) =>
                            prev.map((row, i) => (i === idx ? { ...row, sku: e.target.value } : row))
                          )
                        }
                        placeholder="SKU (optional)"
                        className="border border-white/15 bg-black/50 px-2 py-1.5 text-xs text-white"
                      />
                      <label className="flex items-center gap-1.5 text-[11px] text-[#cfc6c6]">
                        <input
                          type="checkbox"
                          checked={v.is_active}
                          onChange={(e) =>
                            setVariants((prev) =>
                              prev.map((row, i) =>
                                i === idx ? { ...row, is_active: e.target.checked } : row
                              )
                            )
                          }
                        />
                        Active
                      </label>
                      <button
                        type="button"
                        onClick={() => setVariants((prev) => prev.filter((_, i) => i !== idx))}
                        className="justify-self-end text-xs text-[#9e9494] hover:text-[#ff6b6b]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Product-Specific Smart Size Finder Chart */}
              <div className="border-t border-white/10 pt-5">
                <div className="flex items-center justify-between">
                  <h4 className="flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-white uppercase">
                    <Ruler className="h-3.5 w-3.5 text-[#d4121b]" />
                    Product Size Chart (Drives Smart Size Finder)
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setSizeCharts((prev) => [
                        ...prev,
                        {
                          size_name: 'XL',
                          size_order: prev.length + 1,
                          weight_min_kg: 76,
                          weight_max_kg: 88,
                          height_min_cm: 165,
                          height_max_cm: 182,
                          waist_cm: '85-92',
                          hip_cm: '111-118',
                          inseam_cm: '81',
                          length_cm: '109',
                          thigh_cm: '65',
                        },
                      ])
                    }
                    className="inline-flex items-center gap-1.5 border border-white/20 px-3 py-1 text-[11px] text-white hover:border-white"
                  >
                    <Plus className="h-3 w-3" /> Add Size Row
                  </button>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-[11px]">
                    <thead>
                      <tr className="text-[10px] text-[#9e9494] uppercase">
                        <th className="py-1 pr-2">Size</th>
                        <th className="py-1 pr-2">Wt Min (kg)</th>
                        <th className="py-1 pr-2">Wt Max (kg)</th>
                        <th className="py-1 pr-2">Ht Min (cm)</th>
                        <th className="py-1 pr-2">Ht Max (cm)</th>
                        <th className="py-1 pr-2">Waist</th>
                        <th className="py-1 pr-2">Hip</th>
                        <th className="py-1 pr-2">Inseam</th>
                        <th className="py-1 pr-2">Length</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody className="space-y-1">
                      {sizeCharts.map((sc, idx) => (
                        <tr key={idx}>
                          <td className="py-1 pr-1.5">
                            <input
                              type="text"
                              value={sc.size_name}
                              onChange={(e) =>
                                setSizeCharts((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, size_name: e.target.value } : r
                                  )
                                )
                              }
                              className="w-14 border border-white/15 bg-black/50 px-2 py-1 text-white"
                            />
                          </td>
                          <td className="py-1 pr-1.5">
                            <input
                              type="number"
                              value={sc.weight_min_kg}
                              onChange={(e) =>
                                setSizeCharts((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, weight_min_kg: Number(e.target.value) } : r
                                  )
                                )
                              }
                              className="w-16 border border-white/15 bg-black/50 px-2 py-1 text-white"
                            />
                          </td>
                          <td className="py-1 pr-1.5">
                            <input
                              type="number"
                              value={sc.weight_max_kg}
                              onChange={(e) =>
                                setSizeCharts((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, weight_max_kg: Number(e.target.value) } : r
                                  )
                                )
                              }
                              className="w-16 border border-white/15 bg-black/50 px-2 py-1 text-white"
                            />
                          </td>
                          <td className="py-1 pr-1.5">
                            <input
                              type="number"
                              value={sc.height_min_cm}
                              onChange={(e) =>
                                setSizeCharts((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, height_min_cm: Number(e.target.value) } : r
                                  )
                                )
                              }
                              className="w-16 border border-white/15 bg-black/50 px-2 py-1 text-white"
                            />
                          </td>
                          <td className="py-1 pr-1.5">
                            <input
                              type="number"
                              value={sc.height_max_cm}
                              onChange={(e) =>
                                setSizeCharts((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, height_max_cm: Number(e.target.value) } : r
                                  )
                                )
                              }
                              className="w-16 border border-white/15 bg-black/50 px-2 py-1 text-white"
                            />
                          </td>
                          <td className="py-1 pr-1.5">
                            <input
                              type="text"
                              value={sc.waist_cm}
                              onChange={(e) =>
                                setSizeCharts((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, waist_cm: e.target.value } : r
                                  )
                                )
                              }
                              className="w-18 border border-white/15 bg-black/50 px-2 py-1 text-white"
                            />
                          </td>
                          <td className="py-1 pr-1.5">
                            <input
                              type="text"
                              value={sc.hip_cm}
                              onChange={(e) =>
                                setSizeCharts((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, hip_cm: e.target.value } : r
                                  )
                                )
                              }
                              className="w-18 border border-white/15 bg-black/50 px-2 py-1 text-white"
                            />
                          </td>
                          <td className="py-1 pr-1.5">
                            <input
                              type="text"
                              value={sc.inseam_cm}
                              onChange={(e) =>
                                setSizeCharts((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, inseam_cm: e.target.value } : r
                                  )
                                )
                              }
                              className="w-16 border border-white/15 bg-black/50 px-2 py-1 text-white"
                            />
                          </td>
                          <td className="py-1 pr-1.5">
                            <input
                              type="text"
                              value={sc.length_cm}
                              onChange={(e) =>
                                setSizeCharts((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, length_cm: e.target.value } : r
                                  )
                                )
                              }
                              className="w-16 border border-white/15 bg-black/50 px-2 py-1 text-white"
                            />
                          </td>
                          <td className="py-1">
                            <button
                              type="button"
                              onClick={() =>
                                setSizeCharts((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="text-[#9e9494] hover:text-[#ff6b6b]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {error && (
                <p className="border border-[#ff6b6b]/40 bg-[#2a090c] p-3 text-xs text-[#ffb3b3]">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 border-t border-white/12 pt-5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full border border-white/20 px-6 py-2.5 text-xs uppercase hover:border-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full bg-[#b30e16] px-7 py-2.5 text-xs font-medium tracking-[0.18em] text-white uppercase hover:bg-[#d4121b] disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
