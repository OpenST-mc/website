// Worker 运行时配置：一次性从 env 注入，避免各路由重复读取。
export function getConfig(env) {
  const botToken = env.BOT_TOKEN;
  return {
    botToken,
    chatId: env.CHAT_ID,
    clientId: env.CLIENT_ID,
    clientSecret: env.CLIENT_SECRET,
    ghRepo: env.GH_REPO || 'OpenST-mc/website',
    archiveRepo: env.ARCHIVE_REPO || 'OpenST-mc/archive',
    tgApiBase: `https://api.telegram.org/bot${botToken}`,
  };
}
