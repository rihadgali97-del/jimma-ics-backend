ALTER TABLE `madrasas`
    ADD COLUMN `mosque_id` INTEGER NULL,
    ADD UNIQUE INDEX `madrasas_mosque_id_key`(`mosque_id`);

ALTER TABLE `madrasas`
    ADD CONSTRAINT `madrasas_mosque_id_fkey`
    FOREIGN KEY (`mosque_id`) REFERENCES `mosques`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
