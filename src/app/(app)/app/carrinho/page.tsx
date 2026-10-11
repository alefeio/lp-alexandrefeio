import { CartScreen } from "@/components/commerce/CartScreen";
import { Container } from "@/components/ui/Container";

export const metadata = { title: "Carrinho" };

export default function CartPage() {
  return (
    <Container className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Compras</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Carrinho</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">O preço e o crédito são calculados de novo no servidor. O que está salvo neste navegador é só a lista de produtos.</p>
      <CartScreen />
    </Container>
  );
}
