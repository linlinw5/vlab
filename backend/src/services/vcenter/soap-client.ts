import axios, { AxiosInstance } from "axios";
import https from "https";
import { config } from "../../config";
import { logDebug, logError } from "../../lib/logger";

const SESSION_TTL = 25 * 60 * 1000;

// Extract text content of the first matching tag (namespace-aware)
export function extractTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<(?:[^:>]+:)?${tag}[^>]*>([^<]*)<`, "s"));
  return m ? m[1].trim() : null;
}

// Extract MoRef value from a typed element: <tagName type="SomeType">moref-id</tagName>
export function extractMoRef(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<(?:[^:>]+:)?${tag}[^>]*type="[^"]*"[^>]*>([^<]+)<`, "s"));
  return m ? m[1].trim() : null;
}

// Extract text value of a named propSet: <name>propName</name><val ...>value</val>
export function extractPropVal(xml: string, propName: string): string | null {
  const m = xml.match(new RegExp(`<name>${propName}<\\/name>\\s*<val[^>]*>([^<]*)<\\/val>`, "s"));
  return m ? m[1].trim() : null;
}

// Extract MoRef value from a typed val element in a named propSet
export function extractPropMoRef(xml: string, propName: string): string | null {
  const m = xml.match(
    new RegExp(`<name>${propName}<\\/name>\\s*<val[^>]*type="[^"]*"[^>]*>([^<]+)<\\/val>`, "s"),
  );
  return m ? m[1].trim() : null;
}

class VCenterSoapClient {
  private sessionCookie: string | null = null;
  private sessionExpiry = 0;
  private readonly endpoint: string;
  private readonly http: AxiosInstance;

  // Discovered from RetrieveServiceContent — may differ across vCenter instances
  sessionManagerMoRef = "sessionManager";
  propertyCollectorMoRef = "propertyCollector";

  private loginPromise: Promise<void> | null = null;

  constructor() {
    this.endpoint = config.vcenter.baseURL.replace(/\/$/, "") + "/sdk";
    this.http = axios.create({
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      proxy: false,
      timeout: 30_000,
    });
  }

  private async fetchServiceContent(): Promise<void> {
    const xml = this.wrap(
      "RetrieveServiceContent",
      `<vim25:_this type="ServiceInstance">ServiceInstance</vim25:_this>`,
    );
    const res = await this.http.post<string>(this.endpoint, xml, {
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "vim/25" },
    });
    const raw = res.data;
    const sm = extractTag(raw, "sessionManager");
    const pc = extractTag(raw, "propertyCollector");
    if (sm) this.sessionManagerMoRef = sm;
    if (pc) this.propertyCollectorMoRef = pc;
    logDebug("vmware", "soap_service_content", { sessionManagerMoRef: this.sessionManagerMoRef, propertyCollectorMoRef: this.propertyCollectorMoRef });
  }

  private wrap(method: string, body: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:vim25="urn:vim25">
  <soapenv:Header/>
  <soapenv:Body>
    <vim25:${method}>
      ${body}
    </vim25:${method}>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  private soapFaultError(context: string, data: unknown): Error {
    const xml = typeof data === "string" ? data : "";
    const fault = extractTag(xml, "faultstring");
    logError("vmware", "soap_fault", { context, fault, raw: xml.slice(0, 500) });
    return new Error(fault ? `${context}: ${fault}` : `${context}: SOAP fault (no faultstring)`);
  }

  private async login(): Promise<void> {
    logDebug("vmware", "soap_login", { endpoint: this.endpoint });
    await this.fetchServiceContent();
    const xml = this.wrap(
      "Login",
      `<vim25:_this type="SessionManager">${this.sessionManagerMoRef}</vim25:_this>
       <vim25:userName>${config.vcenter.username}</vim25:userName>
       <vim25:password>${config.vcenter.password}</vim25:password>`,
    );

    try {
      const res = await this.http.post(this.endpoint, xml, {
        headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "vim/25" },
      });

      const cookies = res.headers["set-cookie"];
      const raw = Array.isArray(cookies) ? cookies.find((c) => c.includes("vmware_soap_session")) : cookies;
      if (!raw) throw new Error("SOAP login succeeded but no vmware_soap_session cookie in response");

      this.sessionCookie = raw.split(";")[0];
      this.sessionExpiry = Date.now() + SESSION_TTL;
      logDebug("vmware", "soap_login", { message: "SOAP session established" });
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 500) {
        throw this.soapFaultError("SOAP login", err.response.data);
      }
      logError("vmware", "soap_login", { message: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }

  private async ensureSession(): Promise<void> {
    if (this.sessionCookie && Date.now() <= this.sessionExpiry) return;
    if (!this.loginPromise) {
      this.loginPromise = this.login().finally(() => { this.loginPromise = null; });
    }
    await this.loginPromise;
  }

  async call(method: string, body: string, timeoutMs = 120_000): Promise<string> {
    await this.ensureSession();
    const xml = this.wrap(method, body);

    logDebug("vmware", "soap_call", { method });
    try {
      const res = await this.http.post<string>(this.endpoint, xml, {
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: "vim/25",
          Cookie: this.sessionCookie!,
        },
        timeout: timeoutMs,
      });
      return res.data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 500) {
        throw this.soapFaultError(method, err.response.data);
      }
      logError("vmware", "soap_call", { method, message: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  }
}

export const soapClient = new VCenterSoapClient();
