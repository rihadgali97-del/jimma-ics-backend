UPDATE `translations` AS t
INNER JOIN `woredas` AS w ON w.`id` = t.`entity_id`
SET
  t.`value` = CASE w.`code`
    WHEN 'jimma-town' THEN 'Kebele 01'
    WHEN 'agaro' THEN 'Kebele 02'
    WHEN 'kersa' THEN 'Kebele 03'
    WHEN 'limmu-kosa' THEN 'Kebele 04'
    WHEN 'mana' THEN 'Kebele 05'
    WHEN 'seka-chekorsa' THEN 'Kebele 06'
    WHEN 'gomma' THEN 'Kebele 07'
    WHEN 'dedo' THEN 'Kebele 08'
    WHEN 'omo-nada' THEN 'Kebele 09'
    WHEN 'tiro-afeta' THEN 'Kebele 10'
    WHEN 'sokoru' THEN 'Kebele 11'
    WHEN 'setema' THEN 'Kebele 12'
    WHEN 'gera' THEN 'Kebele 13'
    WHEN 'shebe-sombo' THEN 'Kebele 14'
    WHEN 'nono-benja' THEN 'Kebele 15'
    WHEN 'limmu-seka' THEN 'Kebele 16'
    WHEN 'kaffa-donsa' THEN 'Kebele 17'
    WHEN 'buno-bedele' THEN 'Kebele 18'
  END,
  t.`updated_at` = CURRENT_TIMESTAMP(3)
WHERE t.`entity_type` = 'woreda'
  AND t.`field` = 'name'
  AND w.`code` IN (
    'jimma-town', 'agaro', 'kersa', 'limmu-kosa', 'mana', 'seka-chekorsa',
    'gomma', 'dedo', 'omo-nada', 'tiro-afeta', 'sokoru', 'setema',
    'gera', 'shebe-sombo', 'nono-benja', 'limmu-seka', 'kaffa-donsa', 'buno-bedele'
  );

INSERT INTO `translations` (`entity_type`, `entity_id`, `field`, `locale`, `value`, `created_at`, `updated_at`)
SELECT
  'woreda',
  w.`id`,
  'name',
  'en',
  CASE w.`code`
    WHEN 'jimma-town' THEN 'Kebele 01'
    WHEN 'agaro' THEN 'Kebele 02'
    WHEN 'kersa' THEN 'Kebele 03'
    WHEN 'limmu-kosa' THEN 'Kebele 04'
    WHEN 'mana' THEN 'Kebele 05'
    WHEN 'seka-chekorsa' THEN 'Kebele 06'
    WHEN 'gomma' THEN 'Kebele 07'
    WHEN 'dedo' THEN 'Kebele 08'
    WHEN 'omo-nada' THEN 'Kebele 09'
    WHEN 'tiro-afeta' THEN 'Kebele 10'
    WHEN 'sokoru' THEN 'Kebele 11'
    WHEN 'setema' THEN 'Kebele 12'
    WHEN 'gera' THEN 'Kebele 13'
    WHEN 'shebe-sombo' THEN 'Kebele 14'
    WHEN 'nono-benja' THEN 'Kebele 15'
    WHEN 'limmu-seka' THEN 'Kebele 16'
    WHEN 'kaffa-donsa' THEN 'Kebele 17'
    WHEN 'buno-bedele' THEN 'Kebele 18'
  END,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
FROM `woredas` AS w
WHERE w.`code` IN (
  'jimma-town', 'agaro', 'kersa', 'limmu-kosa', 'mana', 'seka-chekorsa',
  'gomma', 'dedo', 'omo-nada', 'tiro-afeta', 'sokoru', 'setema',
  'gera', 'shebe-sombo', 'nono-benja', 'limmu-seka', 'kaffa-donsa', 'buno-bedele'
)
ON DUPLICATE KEY UPDATE
  `value` = VALUES(`value`),
  `updated_at` = CURRENT_TIMESTAMP(3);
