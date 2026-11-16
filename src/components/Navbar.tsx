import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { fetchPublishedProducts } from '../lib/api';
import { formatPrice } from '../lib/format';
import type { Product } from '../types/database';

export function Navbar() {
  const { itemCount, openDrawer } = useCart();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (searchOpen && allProducts.length === 0) {
      fetchPublishedProducts().then(({ products }) => setAllProducts(products));
    }
  }, [searchOpen, allProducts.length]);

  const filteredProducts = searchQuery.trim()
    ? allProducts.filter((p) => {
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.collection_name.toLowerCase().includes(q)
        );
      })
    : allProducts.slice(0, 4);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/collections?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
    }
  };

  return (
    <>
      <header
        className={`sticky top-0 z-40 w-full transition-colors duration-300 ${
          scrolled
            ? 'border-b border-white/10 bg-[#060405]/95 backdrop-blur-md'
            : 'border-b border-white/5 bg-[#060405]/80 backdrop-blur-sm'
        }`}
      >
        <div className="relative mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* LEFT SIDE: HOME + Desktop Navigation */}
          <div className="flex items-center gap-5 lg:gap-7">
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-[#f2eded] transition hover:border-[#b30e16] hover:text-white lg:hidden"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <Link
              to="/"
              className="text-xs font-semibold tracking-[0.22em] text-[#f2eded] uppercase transition hover:text-[#d4121b]"
            >
              HOME
            </Link>

            <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary navigation">
              <Link
                to="/collections"
                className="text-xs font-medium tracking-[0.2em] text-[#b8adad] uppercase transition hover:text-white"
              >
                Shop
              </Link>
              <Link
                to="/collections?category=Men"
                className="text-xs font-medium tracking-[0.2em] text-[#b8adad] uppercase transition hover:text-white"
              >
                Men
              </Link>
              <Link
                to="/collections?category=Women"
                className="text-xs font-medium tracking-[0.2em] text-[#b8adad] uppercase transition hover:text-white"
              >
                Women
              </Link>
            </nav>
          </div>

          {/* CENTER: Mathematically Centered Original THREE WAYS STUDIOS Logo */}
          <Link
            to="/"
            aria-label="THREE WAYS STUDIOS Home"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
          >
            <img
              src="/assets/three-ways-studios-logo.png"
              alt="THREE WAYS STUDIOS"
              className="h-14 w-auto object-contain sm:h-16"
            />
          </Link>

          {/* RIGHT SIDE: Account, Shopping Bag, Search */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/account"
              aria-label={user ? 'Customer Account' : 'Sign In / Account'}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-[#f2eded] transition hover:border-[#b30e16] hover:text-white active:scale-95"
            >
              <User className="h-[18px] w-[18px]" />
            </Link>

            <button
              type="button"
              onClick={openDrawer}
              aria-label="Shopping Bag"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-[#f2eded] transition hover:border-[#b30e16] hover:text-white active:scale-95"
            >
              <ShoppingBag className="h-[18px] w-[18px]" />
              {itemCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#b30e16] px-1 text-[10px] font-bold text-white">
                  {itemCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSearchOpen((prev) => !prev)}
              aria-label="Search Products"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-[#f2eded] transition hover:border-[#b30e16] hover:text-white active:scale-95"
            >
              {searchOpen ? <X className="h-[18px] w-[18px]" /> : <Search className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileOpen && (
          <div className="border-t border-white/10 bg-[#090607] px-5 py-6 lg:hidden">
            <nav className="flex flex-col gap-4" aria-label="Mobile navigation">
              <Link
                to="/"
                className="text-sm font-semibold tracking-[0.22em] text-white uppercase"
              >
                Home
              </Link>
              <Link
                to="/collections"
                className="text-sm font-medium tracking-[0.2em] text-[#c7bcbc] uppercase hover:text-white"
              >
                Shop All
              </Link>
              <Link
                to="/collections?category=Men"
                className="text-sm font-medium tracking-[0.2em] text-[#c7bcbc] uppercase hover:text-white"
              >
                Men&apos;s Collection
              </Link>
              <Link
                to="/collections?category=Women"
                className="text-sm font-medium tracking-[0.2em] text-[#c7bcbc] uppercase hover:text-white"
              >
                Women&apos;s Collection
              </Link>
              <Link
                to="/collections?filter=new"
                className="text-sm font-medium tracking-[0.2em] text-[#c7bcbc] uppercase hover:text-white"
              >
                New Arrivals
              </Link>
              <Link
                to="/about"
                className="text-sm font-medium tracking-[0.2em] text-[#c7bcbc] uppercase hover:text-white"
              >
                About Studio
              </Link>
              <Link
                to="/account"
                className="text-sm font-medium tracking-[0.2em] text-[#c7bcbc] uppercase hover:text-white"
              >
                Account
              </Link>
            </nav>
          </div>
        )}

        {/* Search Overlay */}
        {searchOpen && (
          <div className="border-t border-white/10 bg-[#090607]/98 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl">
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9e9494]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search wide-flare pants, cargo, denim, men, women..."
                    autoFocus
                    className="w-full rounded-full border border-white/15 bg-[#120c0d] py-3 pl-11 pr-4 text-sm text-white placeholder-[#7d7272] focus:border-[#b30e16] focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-full bg-[#b30e16] px-6 py-3 text-xs font-semibold tracking-[0.2em] text-white uppercase transition hover:bg-[#d4121b]"
                >
                  Search
                </button>
              </form>

              {filteredProducts.length > 0 && (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {filteredProducts.map((product) => {
                    const img = product.images?.[0]?.url || '/images/prod-obsidian-flare.jpg';
                    return (
                      <Link
                        key={product.id}
                        to={`/products/${product.slug}`}
                        className="group flex flex-col overflow-hidden rounded-lg border border-white/10 bg-[#100a0b] transition hover:border-[#b30e16]/60"
                      >
                        <div className="aspect-[3/4] overflow-hidden bg-[#150d0f]">
                          <img
                            src={img}
                            alt={product.name}
                            loading="lazy"
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          />
                        </div>
                        <div className="p-2.5">
                          <p className="truncate text-xs font-medium text-white">{product.name}</p>
                          <p className="mt-0.5 text-[11px] text-[#d4121b]">{formatPrice(product.price)}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
