CREATE DATABASE IF NOT EXISTS call_center_dashboard
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE call_center_dashboard;

CREATE TABLE IF NOT EXISTS inbound_calls (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  did_no VARCHAR(100),
  group_name VARCHAR(255),
  called_no VARCHAR(50),
  call_time DATETIME,
  ring_duration TIME,
  ivr_duration TIME,
  queue_duration TIME,
  agent_duration TIME,
  hold_duration TIME,
  total_duration TIME,
  call_end VARCHAR(100),
  agent_id VARCHAR(50),
  call_type VARCHAR(50),
  acd VARCHAR(50),
  disposition VARCHAR(255),
  sub_disposition VARCHAR(255),
  shift VARCHAR(20),
  call_hour INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_call_time (call_time),
  INDEX idx_group_name (group_name),
  INDEX idx_agent_id (agent_id),
  INDEX idx_disposition (disposition),
  INDEX idx_sub_disposition (sub_disposition),
  INDEX idx_shift (shift),
  UNIQUE KEY uniq_call_time_called_agent (call_time, called_no, agent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
