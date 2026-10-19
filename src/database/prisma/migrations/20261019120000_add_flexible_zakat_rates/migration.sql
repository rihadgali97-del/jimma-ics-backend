ALTER TABLE `nisab_rates`
    ADD COLUMN `crop_rates` JSON NULL,
    ADD COLUMN `sheep_goat_price_per_head_etb` DOUBLE NOT NULL DEFAULT 6500,
    ADD COLUMN `cattle_price_per_head_etb` DOUBLE NOT NULL DEFAULT 26000;

UPDATE `nisab_rates`
SET `crop_rates` = JSON_ARRAY(
    JSON_OBJECT('name', 'Jimma Arabica Coffee (Limmu / Agaro / Gomma)', 'nisabQuintals', 6.53, 'pricePerQuintalETB', 0),
    JSON_OBJECT('name', 'Teff (White / Magna)', 'nisabQuintals', 6.53, 'pricePerQuintalETB', 0),
    JSON_OBJECT('name', 'Maize / Corn', 'nisabQuintals', 6.53, 'pricePerQuintalETB', 0),
    JSON_OBJECT('name', 'Wheat & Barley', 'nisabQuintals', 6.53, 'pricePerQuintalETB', 0),
    JSON_OBJECT('name', 'Sorghum / Legumes', 'nisabQuintals', 6.53, 'pricePerQuintalETB', 0)
)
WHERE `crop_rates` IS NULL;
