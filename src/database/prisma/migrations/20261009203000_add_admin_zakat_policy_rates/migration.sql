ALTER TABLE `nisab_rates`
    ADD COLUMN `zakat_rate_hijri_percent` DOUBLE NOT NULL DEFAULT 2.5,
    ADD COLUMN `zakat_rate_gregorian_percent` DOUBLE NOT NULL DEFAULT 2.577,
    ADD COLUMN `ushr_rain_percent` DOUBLE NOT NULL DEFAULT 10,
    ADD COLUMN `ushr_irrigated_percent` DOUBLE NOT NULL DEFAULT 5,
    ADD COLUMN `ushr_mixed_percent` DOUBLE NOT NULL DEFAULT 7.5;
