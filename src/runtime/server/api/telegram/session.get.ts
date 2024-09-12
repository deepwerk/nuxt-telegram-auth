import { eventHandler, getCookie } from "h3";
// @ts-expect-error nitro aliases aren't registered
import { useRuntimeConfig } from "#internal/nitro";
import * as crypto from "node:crypto";

const handleUnauthorized = () => {
  return {
    loggedIn: false,
    status: 401,
    message: "Unauthorized",
  };
};

export default eventHandler(async (event) => {
  try {
    const session = getCookie(event, "tg_user");

    const runtimeConfig = useRuntimeConfig(event);

    if (!session) return handleUnauthorized();

    const decodedCookie = JSON.parse(atob(session));

    if (Date.now() / 1000 - decodedCookie.auth_date > 86400) return handleUnauthorized();

    const secret = Buffer.from(runtimeConfig.TELEGRAM_TOKEN, 'hex');

    /*
        This part creates a data-check-string in here as referred in documentation
        and then it checks on the server side if the hash is correct.
        Docs: https://core.telegram.org/widgets/login#checking-authorization
        */

    const dataCheckString = [];
    for (const key in decodedCookie) if (key != "hash") dataCheckString.push(key + "=" + decodedCookie[key]);

    const check_hash = crypto.createHmac("sha256", secret).update(dataCheckString.sort().join("\n")).digest("hex");

    return {
      loggedIn: check_hash == decodedCookie.hash,
      ...decodedCookie,
    };
  } catch (err) {
    console.error("Telegram Auth - ", err);
    return {
      loggedIn: false,
      status: 500,
      body: "Internal Server Error",
    };
  }
});
