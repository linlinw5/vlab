import axios from "axios";
import "dotenv/config";

// 配置 ASA API 接口基础信息
const ASA_API_BASE_URL = process.env.ASA_API_BASE_URL || "http://localhost:5000/users";
const API_TOKEN = process.env.ASA_API_TOKEN;

if (!API_TOKEN) {
  console.warn("Missing ASA API token. Set ASA_API_TOKEN in .env.");
}

const axiosInstance = axios.create({
  baseURL: ASA_API_BASE_URL,
  headers: {
    Authorization: `Bearer ${API_TOKEN}`,
    "Content-Type": "application/json",
  },
});

// 1. 添加单个用户vpn
export async function addSingleUser(username, password) {
  try {
    const response = await axiosInstance.post("/single-add", {
      username,
      password,
    });
    return response.data;
  } catch (error) {
    console.error("Error adding single user:", error.response?.data || error.message);
    throw error;
  }
}

// 2. 批量添加用户vpn
export async function batchAddUsers(users) {
  // users 是 [{ username, password }, ...]
  try {
    const response = await axiosInstance.post("/batch-add", {
      users,
    });
    return response.data;
  } catch (error) {
    console.error("Error in batch adding users:", error.response?.data || error.message);
    throw error;
  }
}

// 3. 批量删除用户vpn
export async function batchDeleteUsers(usernames) {
  // usernames 是 ["user1", "user2"]
  try {
    const response = await axiosInstance.delete("/batch-delete", {
      data: { usernames }, // axios DELETE 请求体写在 data
    });
    return response.data;
  } catch (error) {
    console.error("Error in batch deleting users:", error.response?.data || error.message);
    throw error;
  }
}
