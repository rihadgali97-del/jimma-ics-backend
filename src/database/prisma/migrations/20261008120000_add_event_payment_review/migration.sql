ALTER TABLE `council_events`
  ADD COLUMN `is_paid` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `fee_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN `payment_instructions` TEXT NULL;

ALTER TABLE `event_registrations`
  MODIFY `pass_number` VARCHAR(40) NULL,
  ADD COLUMN `payment_status` ENUM('FREE', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'FREE',
  ADD COLUMN `payment_receipt_filename` VARCHAR(255) NULL,
  ADD COLUMN `payment_receipt_mime_type` VARCHAR(100) NULL;
