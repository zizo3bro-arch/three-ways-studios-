import { useCart } from '../../context/CartContext';
import { Overlay } from '../ui/Overlay';
import { CartContents } from '../shop/CartContents';

export function CartDrawer() {
  const { isDrawerOpen, closeDrawer, lastAddedMessage } = useCart();
  return (
    <>
      <div className="sr-only" role="status">
        {lastAddedMessage}
      </div>
      <Overlay
        open={isDrawerOpen}
        onClose={closeDrawer}
        placement="right"
        label="Shopping bag"
        panelClassName="cart-drawer"
      >
        <CartContents drawer />
      </Overlay>
    </>
  );
}
