import { CheckoutScreen } from "@/components/commerce/CheckoutScreen";
import { Container } from "@/components/ui/Container";
import { requireSession } from "@/lib/auth/session";
import { mercadoPagoPublicKey } from "@/lib/commerce/config";
import { getRepurchasePriceNoticeForUser } from "@/lib/commerce/orders";

export const metadata = {
  title: "Pagamento",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; fromOrderId?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const resumeOrderId = typeof params.orderId === "string" && params.orderId.length >= 8 ? params.orderId : null;
  const fromOrderId = typeof params.fromOrderId === "string" && params.fromOrderId.length >= 8 ? params.fromOrderId : null;
  const priceChange =
    resumeOrderId != null
      ? await getRepurchasePriceNoticeForUser(session.user.id, resumeOrderId, fromOrderId)
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
