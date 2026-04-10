from netmiko import ConnectHandler

# 不允许操作的用户名
BLACKLISTED_USERS = {"admin", "administrator", "Admin", "Administrator"}

def get_asa_connection(host, username, password):
    device = {
        "device_type": "cisco_asa",
        "ip": host,
        "username": username,
        "password": password,
        "secret": password,
    }
    conn = ConnectHandler(**device)
    conn.enable()
    return conn

def add_user(conn, username, password):
    if username.lower() in BLACKLISTED_USERS:
        return False
    conn.send_config_set([f"username {username} password {password}"])
    return True

def delete_user(conn, username):
    if username.lower() in BLACKLISTED_USERS:
        return False
    conn.send_config_set([f"no username {username}"])
    return True

def add_users(conn, users):
    commands = []
    for user in users:
        username = user["username"]
        password = user["password"]
        if username.lower() in BLACKLISTED_USERS:
            continue
        commands.append(f"username {username} password {password}")
    if commands:
        conn.send_config_set(commands)

def delete_users(conn, usernames):
    commands = []
    for username in usernames:
        if username.lower() in BLACKLISTED_USERS:
            continue
        commands.append(f"no username {username}")
    if commands:
        conn.send_config_set(commands)
