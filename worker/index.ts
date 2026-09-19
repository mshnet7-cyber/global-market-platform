import handler from "vinext/server/fetch-handler";

const CRON_ROUTES: Record<string, string> = {
  "0 0 * * *": "/api/cron/webhooks",
  "5 0 * * *": "/api/cron/whatsapp",
};

function getCronSecret(env: Record<string, unknown>) {
  const secret = String(env.CRON_SECRET ?? env.GMP_CRON_SECRET ?? "").trim();
  return secret;
}

export default {
  fetch(request: Request, env: Record<string, unknown>, ctx: ExecutionContext) {
    return handler.fetch(request, env, ctx);
  },

  async scheduled(
    controller: ScheduledController,
    env: Record<string, unknown>,
    ctx: ExecutionContext,
  ) {
    const pathname = CRON_ROUTES[controller.cron];
    if (!pathname) {
      console.error(JSON.stringify({ event: "unknown_cron", cron: controller.cron }));
      return;
    }

    const secret = getCronSecret(env);
    if (!secret) {
      console.error(JSON.stringify({ event: "cron_secret_not_configured", cron: controller.cron }));
      return;
    }

    const request = new Request(`https://gmp-cron.internal${pathname}`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${secret}`,
        "x-gmp-cron-source": "cloudflare-workers",
      },
    });

    const response = await handler.fetch(request, env, ctx);
    if (!response.ok) {
      console.error(JSON.stringify({
        event: "cron_failed",
        cron: controller.cron,
        path: pathname,
        status: response.status,
      }));
    }
  },
};
