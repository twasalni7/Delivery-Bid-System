-- Normalize driver mobile numbers: prepend 0 for numbers starting with 5
UPDATE drivers
SET mobile = '0' || mobile
WHERE mobile LIKE '5%';
