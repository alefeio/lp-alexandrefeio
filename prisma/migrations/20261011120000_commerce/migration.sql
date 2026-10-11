-- CreateEnum
CREATE TYPE "CommerceStatus" AS ENUM ('NOT_FOR_SALE', 'AVAILABLE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'CANCELLED', 'REFUNDED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('LESSON', 'MODULE', 'COURSE');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MERCADO_PAGO');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'IN_PROCESS', 'APPROVED', 'REJECTED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CHARGED_BACK');

-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('PIX', 'CREDIT_CARD');

-- CreateEnum
CREATE TYPE "EntitlementStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- AlterTable
ALTER TABLE "course" ADD COLUMN "commerceStatus" "CommerceStatus" NOT NULL DEFAULT 'NOT_FOR_SALE';

-- AlterTable
ALTER TABLE "module" ADD COLUMN "commerceStatus" "CommerceStatus" NOT NULL DEFAULT 'NOT_FOR_SALE';

-- AlterTable
ALTER TABLE "lesson" ADD COLUMN "commerceStatus" "CommerceStatus" NOT NULL DEFAULT 'NOT_FOR_SALE';

-- CreateTable
CREATE TABLE "order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "subtotalCents" INTEGER NOT NULL,
    "creditCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "checkoutKey" TEXT,
    "zeroValueUpgrade" BOOLEAN NOT NULL DEFAULT false,
    "confirmationEmailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productType" "ProductType" NOT NULL,
    "lessonId" TEXT,
    "moduleId" TEXT,
    "courseId" TEXT,
    "titleSnapshot" TEXT NOT NULL,
    "listPriceCents" INTEGER NOT NULL,
    "creditAppliedCents" INTEGER NOT NULL,
    "finalPriceCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_lesson" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,

    CONSTRAINT "order_item_lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerPaymentId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "refundedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "paymentMethodType" "PaymentMethodType",
    "installments" INTEGER,
    "providerStatus" TEXT,
    "providerStatusDetail" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "status" "EntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_checkoutKey_key" ON "order"("checkoutKey");

-- CreateIndex
CREATE INDEX "order_userId_createdAt_idx" ON "order"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "order_item_orderId_idx" ON "order_item"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "order_item_lesson_orderItemId_lessonId_key" ON "order_item_lesson"("orderItemId", "lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_providerPaymentId_key" ON "payment"("providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_idempotencyKey_key" ON "payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payment_orderId_idx" ON "payment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "entitlement_orderItemId_lessonId_key" ON "entitlement"("orderItemId", "lessonId");

-- CreateIndex
CREATE INDEX "entitlement_userId_lessonId_status_idx" ON "entitlement"("userId", "lessonId", "status");

-- Um item aponta para exatamente um produto.
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_one_product" CHECK (
    (CASE WHEN "lessonId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "moduleId" IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN "courseId" IS NOT NULL THEN 1 ELSE 0 END) = 1
);

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_lesson" ADD CONSTRAINT "order_item_lesson_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
