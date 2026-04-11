import { onRequest as __api_auth_ts_onRequest } from "C:\\Users\\Yajinni\\Documents\\Coding Projects\\Dark Intentions\\dark-intentions-wcl-analyzer\\functions\\api\\auth.ts"
import { onRequest as __api_callback_ts_onRequest } from "C:\\Users\\Yajinni\\Documents\\Coding Projects\\Dark Intentions\\dark-intentions-wcl-analyzer\\functions\\api\\callback.ts"

export const routes = [
    {
      routePath: "/api/auth",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_auth_ts_onRequest],
    },
  {
      routePath: "/api/callback",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_callback_ts_onRequest],
    },
  ]