import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { fetchPublishedProducts } from '../lib/api';
import { formatEGP } from '../lib/format';
import type { Product } from '../types/database';

export function Navbar() {
  const { itemCount, openDrawer } = useCart();
  const { settings } = useSiteSettings();
  const location = useLocation();
  const navigate = useNavigate();

  const [scrolled, setScrolled] = useState(false);
  const [shopMenuOpen, setShopMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchProducts, setSearchProducts] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setShopMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!searchOpen || searchProducts.length > 0) return;
    setSearchLoading(true);
    fetchPublishedProducts().then(({ products }) => {
      setSearchProducts(products);
      setSearchLoading(false);
    });
  }, [searchOpen, searchProducts.length]);

  const handleLinkClick = (path: string) => {
    setMobileMenuOpen(false);
    if (path.startsWith('/#')) {
      const targetId = path.replace('/#', '');
      if (location.pathname !== '/') {
        navigate('/');
        setTimeout(() => {
          document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
        }, 160);
      } else {
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }
    navigate(path);
  };

  const filteredSearch = searchQuery.trim()
    ? searchProducts.filter((p) => {
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.collection_name.toLowerCase().includes(q)
        );
      })
    : searchProducts.slice(0, 4);

  return (
    <>
      <header
        className={`fixed top-0 right-0 left-0 z-40 transition-all duration-500 ${
          scrolled
            ? 'bg-[#070405]/85 border-b border-white/8 backdrop-blur-md'
            : 'bg-gradient-to-b from-[#060405]/85 via-[#060405]/40 to-transparent'
        }`}
      >
        <div className="mx-auto flex h-20 max-w-[1380px] items-center justify-between px-4 sm:px-8 lg:px-12">
          {/* Official Logo + Handwritten Brand Signature */}
          <Link
            to="/"
            className="group flex items-center gap-3 focus:outline-none"
            aria-label="THREE WAYS STUDIOS Home"
          >
            <img
              src="/assets/three-ways-studios-logo.png"
              alt="THREE WAYS STUDIOS Official Logo"
              className="h-12 w-auto object-contain transition-transform duration-300 group-hover:scale-[1.03] sm:h-14"
            />
            <span className="font-script hidden text-[26px] leading-none tracking-wide text-[#f2eded] sm:inline-block lg:text-[30px]">
              {settings.hero_script_text}
            </span>
            <span className="ml-2 hidden h-7 w-px bg-white/20 lg:inline-block" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary Navigation">
            <div
              className="relative"
              onMouseEnter={() => setShopMenuOpen(true)}
              onMouseLeave={() => setShopMenuOpen(false)}
            >
              <button
                type="button"
                onClick={() => handleLinkClick('/#products')}
                className="flex items-center gap-1.5 py-2 text-[11px] font-medium tracking-[0.2em] text-[#e6dfdf] uppercase transition-colors hover:text-white"
              >
                SHOP
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${
                    shopMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <AnimatePresence>
                {shopMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.18 }}
                    className="absolute top-full left-0 w-56 border border-white/12 bg-[#0c0708]/95 p-3 shadow-2xl backdrop-blur-md"
                  >
                    <p className="mb-2 border-b border-white/10 pb-2 text-[10px] tracking-[0.22em] text-[#9e9494] uppercase">
                      Women&apos;s Pants Only
                    </p>
                    {[
                      { label: 'All Pants', filter: 'all' },
                      { label: 'New Arrivals', filter: 'new' },
                      { label: 'Best Sellers', filter: 'best' },
                      { label: 'Trending', filter: 'trending' },
                    ].map((item) => (
                      <button
                        key={item.filter}
                        type="button"
                        onClick={() => {
                          setShopMenuOpen(false);
                          navigate(`/?filter=${item.filter}#products`);
                          setTimeout(() => {
                            document
                              .getElementById('products')
                              ?.scrollIntoView({ behavior: 'smooth' });
                          }, 120);
                        }}
                        className="block w-full px-2.5 py-2 text-left text-xs tracking-[0.14em] text-[#d6cece] uppercase transition-colors hover:bg-[#b30e16]/20 hover:text-white"
                      >
                        {item.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {settings.nav_links
              .filter((l) => l.label.toUpperCase() !== 'SHOP')
              .map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleLinkClick(item.path)}
                  className="py-2 text-[11px] font-medium tracking-[0.2em] text-[#e6dfdf] uppercase transition-colors hover:text-white"
                >
                  {item.label}
                </button>
              ))}
          </nav>

          {/* Right Action Icons */}
          <div className="flex items-center gap-4 sm:gap-5">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search products"
              className="p-1.5 text-[#e6dfdf] transition-colors hover:text-white"
            >
              <Search className="h-[19px] w-[19px] stroke-[1.5]" />
            </button>

            <Link
              to="/admin"
              aria-label="Admin Dashboard"
              title="Studio Admin"
              className="p-1.5 text-[#e6dfdf] transition-colors hover:text-white"
            >
              <User className="h-[19px] w-[19px] stroke-[1.5]" />
            </Link>

            <button
              type="button"
              onClick={openDrawer}
              aria-label={`Shopping bag with ${itemCount} items`}
              className="relative p-1.5 text-[#e6dfdf] transition-colors hover:text-white"
            >
              <ShoppingBag className="h-[19px] w-[19px] stroke-[1.5]" />
              <motion.span
                key={itemCount}
                initial={{ scale: 0.7 }}
                animate={{ scale: 1 }}
                className="absolute -top-0.5 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d4121b] px-1 text-[10px] font-semibold text-white"
              >
                {itemCount}
              </motion.span>
            </button>

            {/* Mobile Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="p-1.5 text-[#e6dfdf] transition-colors hover:text-white md:hidden"
            >
              <Menu className="h-5 w-5 stroke-[1.6]" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Fullscreen Navigation Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col bg-[#060405]/98 px-6 py-6 backdrop-blur-lg md:hidden"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div className="flex items-center gap-3">
                <img
                  src="/assets/three-ways-studios-logo.png"
                  alt="THREE WAYS STUDIOS"
                  className="h-11 w-auto"
                />
                <span className="font-script text-2xl text-white">{settings.hero_script_text}</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-full border border-white/15 p-2 text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-10 flex flex-col gap-5">
              {settings.nav_links.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleLinkClick(item.path)}
                  className="border-b border-white/8 pb-4 text-left text-lg font-light tracking-[0.24em] text-[#f2eded] uppercase"
                >
                  {item.label}
                </button>
              ))}
              <Link
                to="/cart"
                onClick={() => setMobileMenuOpen(false)}
                className="border-b border-white/8 pb-4 text-left text-lg font-light tracking-[0.24em] text-[#f2eded] uppercase"
              >
                BAG ({itemCount})
              </Link>
              <Link
                to="/contact"
                onClick={() => setMobileMenuOpen(false)}
                className="border-b border-white/8 pb-4 text-left text-lg font-light tracking-[0.24em] text-[#f2eded] uppercase"
              >
                CONTACT
              </Link>
              <Link
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="pt-2 text-left text-xs tracking-[0.22em] text-[#9e9494] uppercase"
              >
                STUDIO ADMIN
              </Link>
            </div>

            <div className="mt-auto border-t border-white/10 pt-6">
              <p className="text-[11px] tracking-[0.22em] text-[#9e9494] uppercase">
                THREE WAYS STUDIOS — WOMEN&apos;S PANTS ONLY
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Overlay */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 px-4 pt-24 backdrop-blur-md"
            onClick={() => setSearchOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl border border-white/15 bg-[#0c0708] p-6 shadow-2xl"
            >
              <div className="flex items-center gap-3 border-b border-white/15 pb-3">
                <Search className="h-4 w-4 text-[#9e9494]" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search women's pants by name, silhouette, or collection..."
                  className="w-full bg-transparent text-sm text-white placeholder-[#7d7373] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  aria-label="Close search"
                  className="text-[#9e9494] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5">
                {searchLoading ? (
                  <p className="py-6 text-center text-xs tracking-[0.2em] text-[#9e9494] uppercase">
                    Searching archive...
                  </p>
                ) : filteredSearch.length === 0 ? (
                  <p className="py-6 text-center text-xs tracking-[0.16em] text-[#9e9494]">
                    {searchProducts.length === 0
                      ? 'No published pants in catalog yet.'
                      : `No pieces found matching "${searchQuery}".`}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {filteredSearch.map((product) => (
                      <Link
                        key={product.id}
                        to={`/products/${product.slug}`}
                        onClick={() => setSearchOpen(false)}
                        className="flex items-center gap-3 border border-white/10 p-2.5 transition-colors hover:border-[#b30e16]/60 hover:bg-white/[0.03]"
                      >
                        <div className="tws-card-surface h-16 w-12 shrink-0 overflow-hidden">
                          {product.images?.[0]?.url && (
                            <img
                              src={product.images[0].url}
                              alt={product.name}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-white">{product.name}</p>
                          <p className="mt-1 text-xs text-[#d4121b]">{formatEGP(product.price)}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
