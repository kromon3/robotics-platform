-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "object_type" VARCHAR(30) NOT NULL DEFAULT 'warehouse',
    "params" JSONB NOT NULL,
    "econ" JSONB,
    "norms" JSONB,
    "product_id" TEXT,
    "robots_count" INTEGER,
    "capex" DECIMAL(15,2),
    "opex_per_year" DECIMAL(15,2),
    "annual_effect" DECIMAL(15,2),
    "payback_years" DECIMAL(6,2),
    "roi_percent" INTEGER,
    "tco" DECIMAL(15,2),
    "catalog_version" INTEGER NOT NULL DEFAULT 4,
    "model_version" VARCHAR(50) NOT NULL DEFAULT 'v2',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_user_id_idx" ON "project"("user_id");

-- CreateIndex
CREATE INDEX "project_product_id_idx" ON "project"("product_id");

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("product_id") ON DELETE SET NULL ON UPDATE CASCADE;
