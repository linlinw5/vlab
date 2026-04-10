import { Request, Response, NextFunction } from "express";

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

// 递归遍历对象和数组，把内部字段名从 snake_case 转成 camelCase
function transformKeys(data: unknown): unknown {
  // 数组需要逐项递归处理，保持数组结构不变
  if (Array.isArray(data)) return data.map(transformKeys);
  // 只处理普通对象；Date 等特殊对象、null 和基本类型都直接原样返回
  if (data !== null && typeof data === "object" && !(data instanceof Date)) {
    return Object.fromEntries(Object.entries(data as Record<string, unknown>).map(([k, v]) => [toCamelCase(k), transformKeys(v)]));
  }
  return data;
}

// 将接口返回的数据键名从 snake_case 统一转换为 camelCase，方便前端直接使用
export function camelcaseResponse(_req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);
  res.json = (data: unknown) => originalJson(transformKeys(data));
  next();
}
