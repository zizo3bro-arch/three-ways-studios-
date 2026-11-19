import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PageIntro } from '../components/layout/PageIntro';
import { CustomerAccountBody } from '../components/account/CustomerAccountBody';
import { useCustomerAuth } from '../context/CustomerAuthContext';

export function AccountPage() {
  const { customer } = useCustomerAuth();

  return (
    <>
      <PageIntro
        eyebrow="Customer account"
        title={customer ? customer.fullName || 'Member profile' : 'Your account'}
        description={
          <p>
            Manage your Three Ways Studios account, loyalty progress, purchase history, discount
            eligibility, and live order tracking. Guest checkout remains available at any time.
          </p>
        }
        actions={
          <Link to="/shop" className="tws-pill tws-pill--outline h-11">
            Continue shopping
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        }
      />

      <section className="pb-16 sm:pb-20">
        <div className="page-width max-w-[920px]">
          <CustomerAccountBody mode="page" active />
        </div>
      </section>
    </>
  );
}
