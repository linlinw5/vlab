// pm2 ecosystem config
// Usage: pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'vlab-backend',
      script: './dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      env_file: '.env',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
