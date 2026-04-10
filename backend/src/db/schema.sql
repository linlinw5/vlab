CREATE TABLE IF NOT EXISTS roles (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS groups (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(50) UNIQUE NOT NULL,
    description  VARCHAR(255),
    vmware_tag_id VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    email       VARCHAR(100) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    username    VARCHAR(50) NOT NULL,
    role_id     INTEGER REFERENCES roles(id),
    group_id    INTEGER REFERENCES groups(id),
    vpn_enable  BOOLEAN DEFAULT FALSE,
    vpn_password VARCHAR(255),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS labs (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    link        VARCHAR(255),
    category_id INTEGER REFERENCES categories(id),
    vm_ids      VARCHAR(100)[] DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS cloned_vms (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(255) NOT NULL,
    lab_id       INTEGER REFERENCES labs(id),
    user_id      INTEGER REFERENCES users(id),
    group_id     INTEGER REFERENCES groups(id),
    vm_id        VARCHAR(100) UNIQUE NOT NULL,
    source_vm_id VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS lab_groups (
    id       SERIAL PRIMARY KEY,
    lab_id   INTEGER REFERENCES labs(id),
    group_id INTEGER REFERENCES groups(id),
    UNIQUE (lab_id, group_id)
);

CREATE TABLE IF NOT EXISTS cron_tasks (
    id          VARCHAR(50) PRIMARY KEY,
    description VARCHAR(255),
    expression  VARCHAR(100),
    enabled     BOOLEAN DEFAULT TRUE
);
