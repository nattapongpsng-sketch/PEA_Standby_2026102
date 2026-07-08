export async function POST(request) {
  try {
    const body = await request.text();
    const gasApiUrl = process.env.GAS_API_URL;

    if (!gasApiUrl) {
      throw new Error("Missing GAS_API_URL environment variable");
    }

    const gasResponse = await fetch(gasApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body,
    });

    const responseBody = await gasResponse.text();
    const contentType = gasResponse.headers.get("Content-Type") || "";
    const looksJson =
      contentType.toLowerCase().includes("application/json") ||
      responseBody.trim().startsWith("{") ||
      responseBody.trim().startsWith("[");

    if (!looksJson) {
      return Response.json(
        {
          ok: false,
          message:
            "GAS ตอบกลับไม่ใช่ JSON: อาจเป็นหน้า HTML/OK จาก webhook หรือ GAS_API_URL ชี้ไป deployment ที่ไม่ใช่ JSON API",
          error: "GAS returned a non-JSON response",
          upstreamStatus: gasResponse.status,
          upstreamPreview: responseBody.slice(0, 300),
        },
        { status: 502 },
      );
    }

    return new Response(responseBody, {
      status: gasResponse.status,
      headers: {
        "Content-Type":
          gasResponse.headers.get("Content-Type") ||
          "application/json; charset=utf-8",
      },
    });
  } catch (error) {
    return Response.json({
      ok: false,
      message: "API Proxy Error",
      error: error && error.message ? error.message : String(error),
    });
  }
}
