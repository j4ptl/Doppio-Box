CREATE DATABASE IF NOT EXISTS doppio_box
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'doppio'@'localhost' IDENTIFIED BY 'doppio';
CREATE USER IF NOT EXISTS 'doppio'@'127.0.0.1' IDENTIFIED BY 'doppio';

GRANT ALL PRIVILEGES ON doppio_box.* TO 'doppio'@'localhost';
GRANT ALL PRIVILEGES ON doppio_box.* TO 'doppio'@'127.0.0.1';

FLUSH PRIVILEGES;
