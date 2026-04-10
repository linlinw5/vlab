import axios, { AxiosInstance } from "axios";
import https from "https";
import { config } from "../../config";
import { logDebug, logError } from "../../lib/logger";

interface RequestOptions {
  timeout?: number;
}

class VCenterClient {
  private token: string | null = null;
  private tokenExpiry = 0;
  private readonly http: AxiosInstance;

  constructor(private readonly timeoutMs = 15_000) {
    this.http = axios.create({
      baseURL: config.vcenter.baseURL,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: this.timeoutMs,
      proxy: false,
    });
  }

  private async getToken(): Promise<string> {
    if (!this.token || Date.now() > this.tokenExpiry) {
      logDebug("vmware", "vcenter_auth", { message: "Refreshing session token" });
      try {
        const res = await this.http.post<string>(
          "/api/session",
          {},
          {
            auth: { username: config.vcenter.username, password: config.vcenter.password },
            timeout: 5_000,
          },
        );
        this.token = res.data;
        this.tokenExpiry = Date.now() + 300_000; // 5 min
        logDebug("vmware", "vcenter_auth", { message: "Session token refreshed" });
      } catch (err) {
        logError("vmware", "vcenter_auth", { message: err instanceof Error ? err.message : String(err) });
        throw err;
      }
    }
    return this.token!;
  }

  async request<T>(method: string, url: string, data?: unknown, options: RequestOptions = {}): Promise<T> {
    logDebug("vmware", "vcenter_request", { message: "Sending request", method, url });
    try {
      const token = await this.getToken();
      const res = await this.http.request<T>({
        method,
        url,
        headers: { "vmware-api-session-id": token },
        data,
        timeout: options.timeout ?? this.timeoutMs,
      });
      return res.data;
    } catch (err) {
      logError("vmware", "vcenter_request", {
        method,
        url,
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  get<T>(url: string) {
    return this.request<T>("GET", url);
  }
  post<T>(url: string, data?: unknown) {
    return this.request<T>("POST", url, data);
  }
  fireAndForget(method: string, url: string, data?: unknown): void {
    void this.request(method, url, data, { timeout: 0 }).catch(() => {});
  }
  put<T>(url: string, data?: unknown) {
    return this.request<T>("PUT", url, data);
  }
  patch<T>(url: string, data?: unknown) {
    return this.request<T>("PATCH", url, data);
  }
  delete<T>(url: string) {
    return this.request<T>("DELETE", url);
  }
}

export default VCenterClient;
