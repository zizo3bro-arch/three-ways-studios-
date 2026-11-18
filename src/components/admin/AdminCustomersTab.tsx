import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, History, Search, UserCheck, X } from 'lucide-react';
import { formatEGP } from '../../lib/format';
import type { Customer, Order } from '../../types/database';

interface AdminCustomersTabProps {
  customers: Customer[];
  orders: Order[];
  legacyMode?: boolean;
  onRefresh?: () => Promise<void> | void;
}

type CustomerFilter = 'all' | 'registered' | 'with-orders';

function cleanName(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getRegistrationIso(customer: Customer): string | null {
  const candidate = customer.registered_at || customer.created_at;
  if (!candidate) return null;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function formatRegDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatRegDateTime(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  return `${date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })} · ${date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function shortId(id: string): string {
  return id.length > 12 ? id.slice(0, 8) : id;
}

function formatLocation(customer: Customer): string | null {
  const parts = [customer.city?.trim(), customer.governorate?.trim()].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export function AdminCustomersTab({
  customers,
  orders,
  legacyMode = false,
}: AdminCustomersTabProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CustomerFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const selectedCustomer = useMemo(
    () => (selectedId ? customers.find((item) => item.id === selectedId) ?? null : null),
    [customers, selectedId]
  );

  useEffect(() => {
    if (!selectedCustomer) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedCustomer]);

  const ordersByCustomer = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const customer of customers) {
      const emailKey = customer.email.trim().toLowerCase();
      const seen = new Set<string>();
      const matched: Order[] = [];
      for (const order of orders) {
        const sameId = order.customer_id === customer.id;
        const sameEmail = Boolean(emailKey) && order.customer_email.trim().toLowerCase() === emailKey;
        if ((sameId || sameEmail) && !seen.has(order.id)) {
          seen.add(order.id);
          matched.push(order);
        }
      }
      map.set(customer.id, matched);
    }
    return map;
  }, [customers, orders]);

  const getOrders = (customer: Customer) => ordersByCustomer.get(customer.id) ?? [];

  const registeredCount = useMemo(
    () => customers.filter((customer) => Boolean(customer.is_registered || customer.auth_user_id)).length,
    [customers]
  );

  const buyersCount = useMemo(
    () => customers.filter((customer) => (ordersByCustomer.get(customer.id)?.length ?? 0) > 0).length,
    [customers, ordersByCustomer]
  );

  const filteredCustomers = useMemo(() => {
    const terms = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    return customers.filter((customer) => {
      const isRegistered = Boolean(customer.is_registered || customer.auth_user_id);
      const customerOrders = ordersByCustomer.get(customer.id) ?? [];

      if (filter === 'registered' && !isRegistered) return false;
      if (filter === 'with-orders' && customerOrders.length === 0) return false;
      if (!terms.length) return true;

      const haystack = [
        cleanName(customer.full_name) || 'no name provided',
        customer.email,
        customer.id,
        customer.auth_user_id ?? '',
        customer.phone ?? '',
        customer.city ?? '',
        customer.governorate ?? '',
        formatRegDate(getRegistrationIso(customer)),
      ]
        .join(' ')
        .toLowerCase();

      return terms.every((term) => haystack.includes(term));
    });
  }, [customers, filter, ordersByCustomer, query]);

  const copyCustomerId = async (id: string) => {
    try {
      await navigator.clipboard?.writeText(id);
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current));
      }, 1800);
    } catch {
      // Clipboard may be restricted in non-secure contexts; full ID stays visible in details.
    }
  };

  const filterOptions: Array<{ id: CustomerFilter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: customers.length },
    { id: 'registered', label: 'Registered', count: registeredCount },
    { id: 'with-orders', label: 'With orders', count: buyersCount },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-[0.18em] text-ink uppercase">
            Customers ({customers.length})
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-faint">
            Registered storefront accounts and verified COD order buyers from Supabase.
          </p>
        </div>
      </div>

      {legacyMode ? (
        <div
          role="status"
          className="border-l-2 border-crimson bg-crimson/[0.06] px-4 py-3 text-[12.5px] leading-relaxed text-ink"
        >
          Showing customer records from <code>public.customers</code>. Apply{' '}
          <code>supabase/migrations/008_registered_customers.sql</code> in Supabase to also sync accounts
          that registered before placing an order.
        </div>
      ) : null}

      {/* Search & filter controls */}
      <div className="flex flex-col gap-3 border border-ink/14 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="relative flex min-w-0 flex-1 items-center">
          <Search
            className="pointer-events-none absolute left-3 h-4 w-4 text-ink-faint"
            aria-hidden="true"
          />
          <label htmlFor="admin-customer-search" className="sr-only">
            Search customers
          </label>
          <input
            id="admin-customer-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, email, customer ID or phone…"
            className="h-10 w-full min-w-0 border border-ink/18 bg-transparent pr-9 pl-9 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-crimson"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear customer search"
              className="absolute right-2 flex h-7 w-7 items-center justify-center text-ink-faint hover:text-crimson"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Filter customers"
        >
          {filterOptions.map((option) => {
            const active = filter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(option.id)}
                className={[
                  'inline-flex h-9 items-center gap-1.5 border px-3 text-[10.5px] font-semibold uppercase tracking-[0.13em] transition-colors',
                  active
                    ? 'border-crimson bg-crimson text-paper'
                    : 'border-ink/18 text-ink-soft hover:border-ink',
                ].join(' ')}
              >
                <span>{option.label}</span>
                <span className="tabular-nums opacity-80">({option.count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {query.trim() || filter !== 'all' ? (
        <p className="text-xs text-ink-faint" aria-live="polite">
          Showing {filteredCustomers.length} of {customers.length}{' '}
          {customers.length === 1 ? 'customer' : 'customers'}
        </p>
      ) : null}

      {customers.length === 0 ? (
        <div className="border border-ink/14 bg-transparent p-10 text-center text-[13px] text-ink-faint">
          No registered customers or buyers recorded yet.
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="space-y-3 border border-ink/14 bg-transparent p-10 text-center text-[13px] text-ink-faint">
          <p>No customers match your current search or filter.</p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setFilter('all');
            }}
            className="inline-flex h-9 items-center border border-ink/25 px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink hover:border-crimson hover:text-crimson"
          >
            Reset search
          </button>
        </div>
      ) : (
        <>
          {/* Mobile & tablet cards — readable, tap-friendly, zero horizontal overflow */}
          <ul className="space-y-3 lg:hidden" aria-label="Customer list">
            {filteredCustomers.map((customer) => {
              const name = cleanName(customer.full_name);
              const regIso = getRegistrationIso(customer);
              const isRegistered = Boolean(customer.is_registered || customer.auth_user_id);
              const custOrders = getOrders(customer);
              const spend = custOrders
                .filter((order) => order.status !== 'cancelled')
                .reduce((sum, order) => sum + Number(order.total_amount), 0);
              const location = formatLocation(customer);

              return (
                <li
                  key={customer.id}
                  data-testid="admin-customer-card"
                  className="space-y-3 border border-ink/14 p-4"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold leading-snug text-ink">
                        {name || (
                          <span className="font-normal italic text-ink-faint">No name provided</span>
                        )}
                      </p>
                      <p className="mt-0.5 break-all text-[12.5px] text-ink-soft">{customer.email}</p>
                    </div>
                    <span
                      className={[
                        'shrink-0 border px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em]',
                        isRegistered
                          ? 'border-crimson/40 bg-crimson/[0.06] text-crimson-deep'
                          : 'border-ink/18 text-ink-faint',
                      ].join(' ')}
                    >
                      {isRegistered ? 'Registered' : 'COD buyer'}
                    </span>
                  </div>

                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-ink/10 pt-3 text-[12px]">
                    <div className="min-w-0">
                      <dt className="text-[9.5px] font-semibold uppercase tracking-[0.15em] text-ink-faint">
                        Registered
                      </dt>
                      <dd className="mt-0.5 text-ink">
                        {regIso ? <time dateTime={regIso}>{formatRegDate(regIso)}</time> : '—'}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[9.5px] font-semibold uppercase tracking-[0.15em] text-ink-faint">
                        Customer ID
                      </dt>
                      <dd className="mt-0.5 flex items-center gap-1.5 font-mono text-[11.5px] text-ink-soft">
                        <span className="truncate">{shortId(customer.id)}</span>
                        <button
                          type="button"
                          onClick={() => void copyCustomerId(customer.id)}
                          aria-label={`Copy ID for ${name || customer.email}`}
                          className="shrink-0 p-0.5 text-ink-faint hover:text-crimson"
                        >
                          {copiedId === customer.id ? (
                            <Check className="h-3.5 w-3.5 text-crimson" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[9.5px] font-semibold uppercase tracking-[0.15em] text-ink-faint">
                        Orders
                      </dt>
                      <dd className="mt-0.5 text-ink tabular-nums">
                        {custOrders.length}
                        {spend > 0 ? ` · ${formatEGP(spend)}` : ''}
                      </dd>
                    </div>
                    {location ? (
                      <div className="min-w-0">
                        <dt className="text-[9.5px] font-semibold uppercase tracking-[0.15em] text-ink-faint">
                          Location
                        </dt>
                        <dd className="mt-0.5 truncate text-ink-soft">{location}</dd>
                      </div>
                    ) : null}
                  </dl>

                  <button
                    type="button"
                    onClick={() => setSelectedId(customer.id)}
                    className="inline-flex h-9 w-full items-center justify-center gap-1.5 border border-ink/22 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink transition-colors hover:border-ink"
                  >
                    <History className="h-3.5 w-3.5" />
                    Details &amp; history
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Desktop table */}
          <div className="hidden overflow-x-auto border border-ink/14 bg-transparent lg:block">
            <table className="w-full min-w-[780px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink/14 text-[10.5px] tracking-[0.16em] text-ink-faint uppercase">
                  <th className="p-4 font-semibold">Full Name</th>
                  <th className="p-4 font-semibold">Email</th>
                  <th className="p-4 font-semibold">Registered</th>
                  <th className="p-4 font-semibold">Customer ID</th>
                  <th className="p-4 font-semibold">Orders / Spent</th>
                  <th className="p-4 text-right font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/10">
                {filteredCustomers.map((customer) => {
                  const name = cleanName(customer.full_name);
                  const regIso = getRegistrationIso(customer);
                  const isRegistered = Boolean(customer.is_registered || customer.auth_user_id);
                  const custOrders = getOrders(customer);
                  const spend = custOrders
                    .filter((order) => order.status !== 'cancelled')
                    .reduce((sum, order) => sum + Number(order.total_amount), 0);
                  const location = formatLocation(customer);

                  return (
                    <tr
                      key={customer.id}
                      data-testid="admin-customer-row"
                      className="hover:bg-ink/[0.025]"
                    >
                      <td className="p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-ink">
                            {name || (
                              <span className="font-normal italic text-ink-faint">No name provided</span>
                            )}
                          </span>
                          {isRegistered ? (
                            <span className="inline-flex items-center gap-1 border border-crimson/35 bg-crimson/[0.06] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.12em] text-crimson-deep">
                              <UserCheck className="h-3 w-3" />
                              Account
                            </span>
                          ) : null}
                        </div>
                        {location ? (
                          <p className="mt-0.5 text-[11.5px] text-ink-faint">{location}</p>
                        ) : null}
                      </td>
                      <td className="p-4 text-ink-soft">
                        <span className="break-all">{customer.email}</span>
                        {customer.phone ? (
                          <span className="mt-0.5 block text-[11.5px] text-ink-faint">
                            {customer.phone}
                          </span>
                        ) : null}
                      </td>
                      <td className="p-4 whitespace-nowrap text-ink-soft">
                        {regIso ? <time dateTime={regIso}>{formatRegDate(regIso)}</time> : '—'}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 font-mono text-[12px] text-ink-soft">
                          <span title={customer.id}>{shortId(customer.id)}</span>
                          <button
                            type="button"
                            onClick={() => void copyCustomerId(customer.id)}
                            aria-label={`Copy customer ID for ${name || customer.email}`}
                            className="p-1 text-ink-faint transition-colors hover:text-crimson"
                          >
                            {copiedId === customer.id ? (
                              <Check className="h-3.5 w-3.5 text-crimson" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="p-4 whitespace-nowrap tabular-nums">
                        <span className="font-medium text-ink">
                          {custOrders.length} {custOrders.length === 1 ? 'order' : 'orders'}
                        </span>
                        {custOrders.length > 0 ? (
                          <span className="mt-0.5 block text-[11.5px] text-ink-faint">
                            {formatEGP(spend)}
                          </span>
                        ) : null}
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedId(customer.id)}
                          className="inline-flex items-center gap-1.5 border border-ink/22 px-3 py-1.5 text-[11.5px] font-medium text-ink transition-colors hover:border-ink"
                        >
                          <History className="h-3.5 w-3.5" />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selectedCustomer ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Customer details"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedId(null);
          }}
        >
          <div className="max-h-[88vh] w-full max-w-xl overflow-y-auto border border-ink/18 paper-surface p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4 border-b border-ink/12 pb-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-crimson">
                  {selectedCustomer.is_registered || selectedCustomer.auth_user_id
                    ? 'Registered customer'
                    : 'COD checkout customer'}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-ink">
                  {cleanName(selectedCustomer.full_name) || 'No name provided'}
                </h3>
                <p className="mt-0.5 break-all text-[13px] text-ink-soft">{selectedCustomer.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Close customer details"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/18 text-ink-soft hover:text-crimson"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <dl className="mt-4 grid gap-3 border-b border-ink/12 pb-4 text-[12.5px] sm:grid-cols-2">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                  Registration date
                </dt>
                <dd className="mt-1 text-ink">
                  {formatRegDateTime(getRegistrationIso(selectedCustomer))}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                  Customer ID
                </dt>
                <dd className="mt-1 flex items-center gap-2 font-mono text-[11.5px] text-ink-soft">
                  <span className="break-all">{selectedCustomer.id}</span>
                  <button
                    type="button"
                    onClick={() => void copyCustomerId(selectedCustomer.id)}
                    aria-label="Copy full customer ID"
                    className="shrink-0 border border-ink/18 px-2 py-1 text-[10px] font-sans font-semibold uppercase tracking-[0.1em] text-ink hover:border-crimson hover:text-crimson"
                  >
                    {copiedId === selectedCustomer.id ? 'Copied' : 'Copy'}
                  </button>
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                  Phone
                </dt>
                <dd className="mt-1 text-ink-soft">
                  {selectedCustomer.phone?.trim() || 'Not added yet'}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                  Delivery address
                </dt>
                <dd className="mt-1 text-ink-soft">
                  {[
                    selectedCustomer.address?.trim(),
                    selectedCustomer.city?.trim(),
                    selectedCustomer.governorate?.trim(),
                  ]
                    .filter(Boolean)
                    .join(', ') || 'Recorded on first COD order'}
                </dd>
              </div>
            </dl>

            <div className="mt-4 space-y-3">
              <p className="text-[10.5px] font-semibold tracking-[0.18em] text-ink-faint uppercase">
                Order History ({getOrders(selectedCustomer).length})
              </p>
              {getOrders(selectedCustomer).length === 0 ? (
                <p className="border border-ink/10 bg-ink/[0.02] p-4 text-[12.5px] text-ink-faint">
                  No COD orders placed yet.
                </p>
              ) : (
                getOrders(selectedCustomer).map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-3 border border-ink/12 bg-ink/[0.02] p-3.5 text-[12.5px]"
                  >
                    <div className="min-w-0">
                      <p className="font-mono font-semibold text-ink">{order.order_reference}</p>
                      <p className="text-[11.5px] text-ink-faint">
                        {formatRegDate(order.created_at)} · {order.status.toUpperCase()}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold text-ink tabular-nums">
                      {formatEGP(order.total_amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
