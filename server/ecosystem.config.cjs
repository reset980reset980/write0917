module.exports = {
  apps: [
    {
      name: 'write0917-api',
      cwd: __dirname,
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '200M',
      env: { NODE_ENV: 'production' },
      time: true,
    },
  ],
};
