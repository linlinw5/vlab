import bcrypt from 'bcrypt';
import pool from '../client';
import { config } from '../../config';
import type { Paginated } from '../../lib/pagination';

export interface User {
  id: number;
  email: string;
  username: string;
  role_id: number;
  group_id: number | null;
  vpn_enable: boolean;
  vpn_password: string | null;
  created_at: Date;
  role_name?: string;
  group_name?: string;
}

export async function getUserById(id: number): Promise<User | null> {
  const { rows } = await pool.query(`
    SELECT u.id, u.email, u.username, u.role_id, u.group_id,
           u.vpn_enable, u.vpn_password, u.created_at,
           r.name AS role_name, g.name AS group_name
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN groups g ON u.group_id = g.id
    WHERE u.id = $1
  `, [id]);
  return rows[0] ?? null;
}

export async function getUserByEmail(email: string): Promise<(User & { password: string }) | null> {
  const { rows } = await pool.query(`
    SELECT u.id, u.email, u.username, u.password, u.role_id, u.group_id,
           u.vpn_enable, u.vpn_password, u.created_at,
           r.name AS role_name, g.name AS group_name
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN groups g ON u.group_id = g.id
    WHERE u.email = $1
  `, [email]);
  return rows[0] ?? null;
}

// Full list — for internal operations (clone, delete)
export async function getAllUsersByGroup(groupId: number): Promise<User[]> {
  const { rows } = await pool.query(`
    SELECT u.id, u.email, u.username, u.role_id, u.group_id,
           u.vpn_enable, u.vpn_password, u.created_at,
           r.name AS role_name, g.name AS group_name
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN groups g ON u.group_id = g.id
    WHERE u.group_id = $1
    ORDER BY u.id
  `, [groupId]);
  return rows;
}

// Paginated — for API list endpoints
export async function getPaginatedUsersByGroup(groupId: number, limit = 20, offset = 0): Promise<Paginated<User>> {
  const base = `
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN groups g ON u.group_id = g.id
    WHERE u.group_id = $1
  `;
  const [dataRes, countRes] = await Promise.all([
    pool.query(`SELECT u.id, u.email, u.username, u.role_id, u.group_id,
                       u.vpn_enable, u.vpn_password, u.created_at,
                       r.name AS role_name, g.name AS group_name
                ${base} ORDER BY u.id LIMIT $2 OFFSET $3`, [groupId, limit, offset]),
    pool.query(`SELECT COUNT(*) ${base}`, [groupId]),
  ]);
  return {
    data: dataRes.rows,
    total: parseInt(countRes.rows[0].count),
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
  };
}

export async function getAllUsersByRole(roleId: number): Promise<User[]> {
  const { rows } = await pool.query(`
    SELECT u.id, u.email, u.username, u.role_id, u.group_id,
           u.vpn_enable, u.vpn_password, u.created_at,
           r.name AS role_name, g.name AS group_name
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN groups g ON u.group_id = g.id
    WHERE u.role_id = $1
    ORDER BY u.id
  `, [roleId]);
  return rows;
}

export async function getAllUsersByUserIds(userIds: number[]): Promise<{ id: number; email: string }[]> {
  const { rows } = await pool.query(
    'SELECT id, email FROM users WHERE id = ANY($1)',
    [userIds]
  );
  return rows;
}

export async function createUser(
  username: string,
  password: string,
  email: string,
  roleId: number,
  groupId: number | null = null
): Promise<User> {
  const hashed = await bcrypt.hash(password, config.saltRounds);
  const { rows } = await pool.query(`
    INSERT INTO users (username, password, email, role_id, group_id)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, username, email, role_id, group_id
  `, [username, hashed, email, roleId, groupId]);
  return rows[0];
}

export async function updateUserInfo(id: number, username: string, roleId: number, groupId: number | null): Promise<void> {
  await pool.query(
    'UPDATE users SET username = $1, role_id = $2, group_id = $3 WHERE id = $4',
    [username, roleId, groupId, id]
  );
}

export async function deleteUsers(userIds: number[]): Promise<void> {
  await pool.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
}

export async function resetUserPasswords(userIds: number[], newPassword: string): Promise<void> {
  const hashed = await bcrypt.hash(newPassword, config.saltRounds);
  await pool.query('UPDATE users SET password = $1 WHERE id = ANY($2)', [hashed, userIds]);
}

export async function updateOwnPassword(userId: number, newPassword: string): Promise<void> {
  const hashed = await bcrypt.hash(newPassword, config.saltRounds);
  await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, userId]);
}

export async function enableVPN(userIds: number[], vpnPassword: string): Promise<void> {
  await pool.query(`
    UPDATE users SET vpn_password = $1, vpn_enable = TRUE WHERE id = ANY($2)
  `, [vpnPassword, userIds]);
}

export async function disableVPN(userIds: number[]): Promise<void> {
  await pool.query(`
    UPDATE users SET vpn_password = NULL, vpn_enable = FALSE WHERE id = ANY($1)
  `, [userIds]);
}
