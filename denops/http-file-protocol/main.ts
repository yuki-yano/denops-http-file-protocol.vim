import type { Denops } from "https://deno.land/x/denops_std@v3.8.1/mod.ts";
import { execute } from "https://deno.land/x/denops_std@v3.8.1/helper/mod.ts";
import { Server } from "https://deno.land/std@0.154.0/http/server.ts";
import { unnullish } from "https://deno.land/x/unnullish@v0.2.0/mod.ts";
import * as queryString from "https://deno.land/x/querystring@v1.0.2/mod.js";

const PORT = unnullish(
  Deno.env.get("DENOPS_HTTP_FILE_PROTOCOL_PORT"),
  (v) => parseInt(v, 10),
) ?? 11111;

export const main = async (denops: Denops): Promise<void> => {
  const handler = async (request: Request): Promise<Response> => {
    const { pathname, search } = new URL(request.url);
    const { command } = queryString.parse(search);
    const filePath = pathname.replace(/^\/file\//, "");

    const isReadable = await denops.call(
      "filereadable",
      filePath.replace(/:.+$/, ""),
    );
    if (isReadable) {
      await denops.cmd(`${command ?? "edit"} file://${filePath}`);
      return new Response("OK", {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    } else {
      return new Response("Not Found", {
        status: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }
  };

  await execute(
    denops,
    `
    command! -nargs=? HttpFileProtocolServerStart call denops#request("${denops.name}", "start", [<f-args>])
    command! HttpFileProtocolServerStop call denops#request("${denops.name}", "stop", [])
    `,
  );

  let server: Server | undefined;

  denops.dispatcher = {
    // deno-lint-ignore require-await
    start: async (p: unknown): Promise<void> => {
      const port = unnullish(p, (v) => parseInt(v as string, 10)) ?? PORT;

      server = new Server({ handler, port });
      server.listenAndServe();
      console.log(`Server started on port ${port}`);
    },

    // deno-lint-ignore require-await
    stop: async (): Promise<void> => {
      if (server) {
        server.close();
        server = undefined;
        console.log("Server stopped");
      }
    },
  };

  return await Promise.resolve();
};
