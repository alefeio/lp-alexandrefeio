import { CheckoutScreen } from "@/components/commerce/CheckoutScreen";
import { Container } from "@/components/ui/Container";
import { requireSession } from "@/lib/auth/session";
import { mercadoPagoPublicKey } from "@/lib/commerce/config";

export const metadata = {
  title: "Pagamento",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; priceChanged?: string; previous?: string; current?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const resumeOrderId = typeof params.orderId === "string" && params.orderId.length >= 8 ? params.orderId : null;
  const previousCents = params.previous && /^\d+$/.test(params.previous) ? Number(params.previous) : null;
  const currentCents = params.current && /^\d+$/.test(params.current) ? Number(params.current) : null;
  const priceChange =
    params.priceChanged === "1" && previousCents != null && currentCents != null
      ? { previousCents, currentCents }
      : null;

  return (
    <Container className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-cta">Compras</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Pagamento</h1>
      <CheckoutScreen
        publicKey={mercadoPagoPublicKey()}
        payerEmail={session.user.email}
        resumeOrderId={resumeOrderId}
        priceChange={priceChange}
      />
    </Container>
  );
}
