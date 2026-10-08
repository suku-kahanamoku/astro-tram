import type { APIRoute } from "astro";
import { HttpError, errorResponse } from "../../CoreModule/server/errors";
import { readFields } from "../../CoreModule/server/request";

/** PHP verifies the administrator role for every request. */
export const onlinePlannersHandler: APIRoute = async ({
  request,
  locals,
  url,
}) => {
  try {
    const token = locals.sessionToken;
    if (!token) throw new HttpError(401, "unauthorized");
    if (url.search) throw new HttpError(422, "invalid_input");
    let data;
    if (request.method === "POST") {
      const body = await readFields(request);
      if (Object.keys(body).length !== 1 || typeof body.enabled !== "boolean")
        throw new HttpError(422, "invalid_input");
      data = await locals.providers.onlinePlanners.setOnlinePlanners(
        body.enabled,
        token,
      );
    } else {
      data = await locals.providers.onlinePlanners.onlinePlanners(token);
    }
    return Response.json(
      { success: true, data },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
};
