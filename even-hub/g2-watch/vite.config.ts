import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

export default defineConfig({
  server: { host: true, port: 5173 },
  plugins: [
    {
      name: "serve-app-json",
      configureServer(server) {
        server.middlewares.use("/app.json", (req, res, next) => {
          if (req.method !== "GET") return next();
          res.setHeader("content-type", "application/json");
          res.end(readFileSync(new URL("./app.json", import.meta.url)));
        });
      },
    },
  ],
});
