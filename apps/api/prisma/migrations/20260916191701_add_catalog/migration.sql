/*
  Warnings:

  - You are about to drop the column `createAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `updateAt` on the `User` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "createAt",
DROP COLUMN "updateAt",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "company" (
    "company_id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "region" VARCHAR(100),
    "company_type" VARCHAR(50),
    "inn" VARCHAR(12),
    "website" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_pkey" PRIMARY KEY ("company_id")
);

-- CreateTable
CREATE TABLE "product" (
    "product_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "subtype" VARCHAR(100),
    "category" VARCHAR(100),
    "description" TEXT,
    "price" DECIMAL(15,2),
    "ugt" SMALLINT,
    "market_potential" SMALLINT,
    "status" VARCHAR(20) NOT NULL,
    "company_id" TEXT NOT NULL,
    "specs" JSONB NOT NULL DEFAULT '{}',
    "source_url" TEXT,
    "source_date" DATE,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "catalog_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "industry" (
    "industry_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "industry_pkey" PRIMARY KEY ("industry_id")
);

-- CreateTable
CREATE TABLE "scenario" (
    "scenario_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenario_pkey" PRIMARY KEY ("scenario_id")
);

-- CreateTable
CREATE TABLE "case" (
    "case_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "title" VARCHAR(300),
    "description" TEXT NOT NULL,
    "customer" VARCHAR(200),
    "region" VARCHAR(100),
    "result_metrics" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_pkey" PRIMARY KEY ("case_id")
);

-- CreateTable
CREATE TABLE "product_industry" (
    "product_id" TEXT NOT NULL,
    "industry_id" TEXT NOT NULL,

    CONSTRAINT "product_industry_pkey" PRIMARY KEY ("product_id","industry_id")
);

-- CreateTable
CREATE TABLE "product_scenario" (
    "product_id" TEXT NOT NULL,
    "scenario_id" TEXT NOT NULL,

    CONSTRAINT "product_scenario_pkey" PRIMARY KEY ("product_id","scenario_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_name_key" ON "company"("name");

-- CreateIndex
CREATE INDEX "product_company_id_idx" ON "product"("company_id");

-- CreateIndex
CREATE INDEX "product_type_idx" ON "product"("type");

-- CreateIndex
CREATE INDEX "product_status_idx" ON "product"("status");

-- CreateIndex
CREATE UNIQUE INDEX "industry_name_key" ON "industry"("name");

-- CreateIndex
CREATE UNIQUE INDEX "scenario_name_key" ON "scenario"("name");

-- CreateIndex
CREATE INDEX "case_product_id_idx" ON "case"("product_id");

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case" ADD CONSTRAINT "case_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("product_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_industry" ADD CONSTRAINT "product_industry_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("product_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_industry" ADD CONSTRAINT "product_industry_industry_id_fkey" FOREIGN KEY ("industry_id") REFERENCES "industry"("industry_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_scenario" ADD CONSTRAINT "product_scenario_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("product_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_scenario" ADD CONSTRAINT "product_scenario_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenario"("scenario_id") ON DELETE CASCADE ON UPDATE CASCADE;
