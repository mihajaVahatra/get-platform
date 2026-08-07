-- CreateTable
CREATE TABLE "platform_cities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_brackets" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minFees" DOUBLE PRECISION NOT NULL,
    "maxFees" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_brackets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_cities_name_key" ON "platform_cities"("name");

-- CreateIndex
CREATE UNIQUE INDEX "fee_brackets_label_key" ON "fee_brackets"("label");
