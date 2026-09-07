-- Additive: track when a booking last changed status. Existing rows keep their
-- current data and are backfilled with CURRENT_TIMESTAMP.
ALTER TABLE "bookings" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
