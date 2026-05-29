CREATE DATABASE IF NOT EXISTS wordmemory DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wordmemory;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    status TINYINT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE modules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    file_name VARCHAR(200),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE words (
    id INT AUTO_INCREMENT PRIMARY KEY,
    module_id INT NOT NULL,
    word VARCHAR(200) NOT NULL,
    definitions TEXT NOT NULL COMMENT 'JSON array',
    INDEX idx_module (module_id),
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE user_modules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    module_id INT NOT NULL,
    imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_module (user_id, module_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE user_words (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    word_id INT NOT NULL,
    status TINYINT DEFAULT 0 COMMENT '0=not learned, 1=learned',
    learn_count INT DEFAULT 0,
    correct_count INT DEFAULT 0,
    last_seen_at DATETIME,
    UNIQUE KEY uk_user_word (user_id, word_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE user_errors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    word_id INT NOT NULL,
    error_count INT DEFAULT 1,
    last_error_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_cleared TINYINT DEFAULT 0,
    UNIQUE KEY uk_user_error (user_id, word_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Default admin account (password: admin123, bcrypt hashed)
INSERT INTO users (username, email, password, role) VALUES
('admin', 'admin@wordmemory.local', '$2y$10$GswzmnJiFBBicZ7hI7VDyu6SKWv9rp8fYEK09wD6f6PSXawvawkcK', 'admin');
