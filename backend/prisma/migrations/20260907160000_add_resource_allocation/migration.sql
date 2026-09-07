-- Additive: resource-allocation simulation records. No existing table is altered.
CREATE TYPE "AllocationStatus" AS ENUM ('ALLOCATED', 'RELEASED');

CREATE TABLE "resource_allocations" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "status" "AllocationStatus" NOT NULL DEFAULT 'ALLOCATED',
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "resource_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "resource_allocations_weddingId_idx" ON "resource_allocations"("weddingId");
CREATE INDEX "resource_allocations_vendorId_idx" ON "resource_allocations"("vendorId");
CREATE INDEX "resource_allocations_bookingId_idx" ON "resource_allocations"("bookingId");
CREATE INDEX "resource_allocations_status_idx" ON "resource_allocations"("status");

-- A resource may hold at most one ALLOCATED record at a time. Released rows are
-- excluded, so a released resource becomes available again.
CREATE UNIQUE INDEX "resource_allocations_active_vendor_key"
    ON "resource_allocations"("vendorId") WHERE "status" = 'ALLOCATED';

ALTER TABLE "resource_allocations" ADD CONSTRAINT "resource_allocations_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "weddings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resource_allocations" ADD CONSTRAINT "resource_allocations_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "resource_allocations" ADD CONSTRAINT "resource_allocations_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
