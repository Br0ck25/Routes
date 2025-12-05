import { put } from "wrangler";

await put({
  namespace: "ASSETS",
  key: "index.html",
  path: "./index.html",
});
