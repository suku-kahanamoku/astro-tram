import type { APIRoute } from "astro";
import { HttpError, errorResponse } from "../../CoreModule/server/errors";
import { readFields } from "../../CoreModule/server/request";

/** The session is server-only. php-core checks the administrator role and tenant for every request. */
export const pipelineHandler: APIRoute = async ({ request, locals, url }) => {
  try {
    const token = locals.sessionToken;
    if (!token) throw new HttpError(401, "unauthorized");
    if (url.search) throw new HttpError(422, "invalid_input");
    let data;
    if (request.method === "POST") {
      const body = await readFields(request);
      if (
        Object.keys(body).length !== 1 ||
        !["sync_build", "deploy"].includes(body.action as string)
      )
        throw new HttpError(422, "invalid_input");
      data = await locals.providers.pipeline.submit(
        body.action as "sync_build" | "deploy",
        token,
      );
    } else {
      data = await locals.providers.pipeline.status(token);
    }
    return Response.json(
      { success: true, data },
      {
        status: request.method === "POST" ? 202 : 200,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
};
