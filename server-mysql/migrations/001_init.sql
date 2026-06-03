-- Reactor Linearity Testing System — initial schema
-- Run via `npm run migrate` (auto-applied on server boot too).

CREATE TABLE IF NOT EXISTS test_objects (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  serial_number   VARCHAR(120)    NOT NULL,
  rated_voltage   DOUBLE          NOT NULL DEFAULT 0,
  rated_current   DOUBLE          NOT NULL DEFAULT 0,
  project_name    VARCHAR(255)    NOT NULL DEFAULT '',
  customer_name   VARCHAR(255)    NOT NULL DEFAULT '',
  work_order      VARCHAR(120)    NOT NULL DEFAULT '',
  raw_result      LONGTEXT        NULL,
  analysis_result LONGTEXT        NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modified_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_serial (serial_number),
  KEY idx_work_order (work_order),
  KEY idx_customer (customer_name),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
