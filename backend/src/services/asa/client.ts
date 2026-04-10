import { Client, ConnectConfig } from "ssh2";
import { config } from "../../config";
import { logDebug, logError } from "../../lib/logger";

const BLACKLISTED = new Set(["admin", "administrator"]);

class ASAClient {
  private readonly connectConfig: ConnectConfig = {
    host: config.asa.host,
    port: config.asa.port,
    username: config.asa.username,
    password: config.asa.password,
    // Cisco ASA uses legacy SSH algorithms
    algorithms: {
      kex: ["diffie-hellman-group14-sha1", "diffie-hellman-group-exchange-sha1", "diffie-hellman-group1-sha1"],
      cipher: ["aes128-cbc", "3des-cbc", "aes256-cbc", "aes128-ctr", "aes256-ctr"],
      serverHostKey: ["ssh-rsa", "ssh-dss"],
      hmac: ["hmac-sha2-256", "hmac-sha1", "hmac-sha1-96"],
    },
  };

  private async runCommands(commands: string[]): Promise<void> {
    logDebug("asa", "asa_run_commands", { message: "Request received", commandCount: commands.length });
    return new Promise((resolve, reject) => {
      const conn = new Client();
      const timer = setTimeout(() => {
        logError("asa", "asa_run_commands", { message: "ASA SSH timeout", commandCount: commands.length });
        conn.end();
        reject(new Error("ASA SSH timeout"));
      }, 30_000);

      conn.on("ready", () => {
        logDebug("asa", "asa_run_commands", { message: "SSH ready, opening shell" });
        conn.shell({ term: "vt100" }, (err, stream) => {
          if (err) {
            clearTimeout(timer);
            logError("asa", "asa_run_commands", {
              message: err.message,
            });
            conn.end();
            return reject(err);
          }

          let buf = "";
          let step = 0;

          stream.on("data", (chunk: Buffer) => {
            buf += chunk.toString();

            // State machine: navigate ASA CLI to config mode
            if (step === 0 && buf.includes(">")) {
              buf = "";
              step = 1;
              stream.write("enable\n");
            } else if (step === 1 && /[Pp]assword/.test(buf)) {
              buf = "";
              step = 2;
              stream.write(`${config.asa.password}\n`);
            } else if (step === 2 && /# *$/.test(buf.trim()) && !buf.includes("(config")) {
              buf = "";
              step = 3;
              stream.write("configure terminal\n");
            } else if (step === 3 && buf.includes("(config")) {
              buf = "";
              step = 4;
              logDebug("asa", "asa_run_commands", { message: "Sending commands", commandCount: commands.length });
              for (const cmd of commands) {
                stream.write(`${cmd}\n`);
              }
              stream.write("end\n");
              stream.write("exit\n");
            }
          });

          stream.on("close", () => {
            clearTimeout(timer);
            if (step >= 4) {
              logDebug("asa", "asa_run_commands", { message: "Done", commandCount: commands.length });
              resolve();
            } else {
              logError("asa", "asa_run_commands", { message: "ASA SSH stream closed before completing", step });
              reject(new Error("ASA SSH stream closed before completing"));
            }
            conn.end();
          });
        });
      });

      conn.on("error", (err) => {
        clearTimeout(timer);
        logError("asa", "asa_run_commands", { message: err.message });
        reject(err);
      });
      logDebug("asa", "asa_run_commands", { message: "Connecting to ASA" });
      conn.connect(this.connectConfig);
    });
  }

  async addUser(username: string, password: string): Promise<boolean> {
    if (BLACKLISTED.has(username.toLowerCase())) return false;
    await this.runCommands([`username ${username} password ${password}`]);
    return true;
  }

  async deleteUser(username: string): Promise<boolean> {
    if (BLACKLISTED.has(username.toLowerCase())) return false;
    await this.runCommands([`no username ${username}`]);
    return true;
  }

  async batchAddUsers(users: Array<{ username: string; password: string }>): Promise<void> {
    const cmds = users
      .filter((u) => !BLACKLISTED.has(u.username.toLowerCase()))
      .map((u) => `username ${u.username} password ${u.password}`);
    if (cmds.length > 0) await this.runCommands(cmds);
  }

  async batchDeleteUsers(usernames: string[]): Promise<void> {
    const cmds = usernames.filter((u) => !BLACKLISTED.has(u.toLowerCase())).map((u) => `no username ${u}`);
    if (cmds.length > 0) await this.runCommands(cmds);
  }
}

export const asaClient = new ASAClient();
