ALTER TABLE `madrasas`
    ADD COLUMN `head_teacher_id` INTEGER NULL;

ALTER TABLE `madrasas`
    ADD COLUMN `hifz_graduates_count` INTEGER NULL;

ALTER TABLE `madrasas`
    ADD INDEX `madrasas_head_teacher_id_idx`(`head_teacher_id`);

ALTER TABLE `madrasas`
    ADD CONSTRAINT `madrasas_head_teacher_id_fkey`
    FOREIGN KEY (`head_teacher_id`) REFERENCES `teachers`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
