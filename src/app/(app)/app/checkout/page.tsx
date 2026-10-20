import { CheckoutScreen } from "@/components/commerce/CheckoutScreen";
import { Container } from "@/components/ui/Container";
import { requireSession } from "@/lib/auth/session";
import { mercadoPagoPublicKey } from "@/lib/commerce/config";

export const metadata = {
  title: "Pagamento",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const session = await requireSession();
  return (
    <Container className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Compras</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Pagamento</h1>
      <CheckoutScreen publicKey={mercadoPagoPublicKey()} payerEmail={session.user.email} />
    </Container>
  );
}
