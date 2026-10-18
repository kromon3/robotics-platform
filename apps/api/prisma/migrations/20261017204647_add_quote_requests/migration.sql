-- CreateEnum
CREATE TYPE "quote_request_status" AS ENUM ('NEW', 'SENT', 'ANSWERED', 'CLOSED');

-- CreateTable
CREATE TABLE "quote_request" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "status" "quote_request_status" NOT NULL DEFAULT 'NEW',
    "contact_name" VARCHAR(150) NOT NULL,
    "company" VARCHAR(200) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(30),
    "inn" VARCHAR(12),
    "comment" TEXT,
    "delivery_region" VARCHAR(150) NOT NULL,
    "timeframe" VARCHAR(20) NOT NULL,
    "consent_given" BOOLEAN NOT NULL,
    "consent_at" TIMESTAMP(3) NOT NULL,
    "consent_version" VARCHAR(30) NOT NULL,
    "source" VARCHAR(20),
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_request_supplier" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "company_id" TEXT,
    "company_name" VARCHAR(150) NOT NULL,
    "status" "quote_request_status" NOT NULL DEFAULT 'NEW',
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_request_supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_request_item" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "product_id" TEXT,
    "product_name" VARCHAR(200) NOT NULL,
    "unit_price" DECIMAL(15,2),
    "catalog_version" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_request_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quote_request_number_key" ON "quote_request"("number");

-- CreateIndex
CREATE INDEX "quote_request_status_idx" ON "quote_request"("status");

-- CreateIndex
CREATE INDEX "quote_request_user_id_idx" ON "quote_request"("user_id");

-- CreateIndex
CREATE INDEX "quote_request_created_at_idx" ON "quote_request"("created_at");

-- CreateIndex
CREATE INDEX "quote_request_supplier_company_id_idx" ON "quote_request_supplier"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "quote_request_supplier_request_id_company_id_key" ON "quote_request_supplier"("request_id", "company_id");

-- CreateIndex
CREATE INDEX "quote_request_item_supplier_id_idx" ON "quote_request_item"("supplier_id");

-- CreateIndex
CREATE INDEX "quote_request_item_product_id_idx" ON "quote_request_item"("product_id");

-- AddForeignKey
ALTER TABLE "quote_request" ADD CONSTRAINT "quote_request_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_request_supplier" ADD CONSTRAINT "quote_request_supplier_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "quote_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_request_supplier" ADD CONSTRAINT "quote_request_supplier_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("company_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_request_item" ADD CONSTRAINT "quote_request_item_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "quote_request_supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_request_item" ADD CONSTRAINT "quote_request_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("product_id") ON DELETE SET NULL ON UPDATE CASCADE;
