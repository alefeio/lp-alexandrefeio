import { CartScreen } from "@/components/commerce/CartScreen";
import { Container } from "@/components/ui/Container";

export const metadata = {
  title: "Finalizar compra",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return (
    <Container className="max-w-5xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Compras</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Finalizar compra</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
        Confira o produto e o valor final antes de seguir para o pagamento.
      </p>
      <CartScreen />
    </Container>
  );
}
