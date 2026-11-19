import { useUI } from '../../context/UIContext';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import { Overlay } from '../ui/Overlay';
import { CustomerAccountBody } from '../account/CustomerAccountBody';

export function AccountPanel() {
  const { overlay, closeOverlay } = useUI();
  const { customer } = useCustomerAuth();
  const open = overlay === 'account';

  return (
    <Overlay
      open={open}
      onClose={closeOverlay}
      label="Account"
      placement="right"
      panelClassName="max-w-[540px]"
    >
      <div className="-mx-5 flex h-full flex-col overflow-y-auto px-5 pb-7 sm:-mx-7 sm:px-7">
        <div className="border-b border-ink/16 pb-4">
          <p className="tws-eyebrow text-crimson">Your account</p>
          <h2
            className="mt-2 font-display uppercase leading-[0.92] tracking-[0.01em] text-ink"
            style={{ fontSize: 'clamp(1.9rem, 5.5vw, 2.45rem)' }}
          >
            {customer ? customer.fullName || 'Member profile' : 'Customer account'}
          </h2>
        </div>

        <CustomerAccountBody mode="panel" active={open} onNavigate={closeOverlay} />
      </div>
    </Overlay>
  );
}
