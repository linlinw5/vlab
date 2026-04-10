import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import pool from "./client";
import { config } from "../config";
import { logInfo } from "../lib/logger";

export async function syncDefaultGroupTag(tagId: string): Promise<void> {
  await pool.query("UPDATE groups SET vmware_tag_id = $1 WHERE id = 1 AND vmware_tag_id IS DISTINCT FROM $1", [tagId]);
  logInfo("db", "default_group_tag_synced", { tagId });
}

export async function initDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    // Check if roles table already exists
    const { rows } = await client.query(`
      SELECT to_regclass('public.roles') AS tbl
    `);

    if (rows[0].tbl) {
      logInfo("db", "schema_exists_skip_init");
      return;
    }

    logInfo("db", "schema_creation_started");
    const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    await client.query(schema);
    logInfo("db", "schema_created");

    // Seed roles
    await client.query(`
      INSERT INTO roles (id, name, description) VALUES
        (1, 'Admin',    '系统管理员'),
        (2, 'Advanced', '高级用户'),
        (3, 'User',     '普通用户')
      ON CONFLICT DO NOTHING
    `);

    // Seed default group (vmware_tag_id filled later by vCenter init)
    await client.query(
      `
      INSERT INTO groups (name, description, vmware_tag_id) VALUES ($1, $2, NULL)
      ON CONFLICT DO NOTHING
    `,
      [config.vcenter.defaultGroupName, "System Default Group - DO NOT DELETE"],
    );

    // Seed default categories
    await client.query(`
      INSERT INTO categories (name) VALUES ('network'), ('linux'), ('developer')
      ON CONFLICT DO NOTHING
    `);

    // Seed default admin user, assigned to default group
    const hashed = await bcrypt.hash(config.admin.password, config.saltRounds);
    await client.query(
      `
      INSERT INTO users (email, password, username, role_id, group_id)
      VALUES ($1, $2, $3, 1, 1)
      ON CONFLICT (email) DO NOTHING
    `,
      [config.admin.email, hashed, config.admin.username],
    );

    logInfo("db", "seed_completed", { defaultAdminEmail: config.admin.email });
  } finally {
    client.release();
  }
}
