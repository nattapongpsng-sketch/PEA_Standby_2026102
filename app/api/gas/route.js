export async function POST(request) {
  try {
    const gasApiUrl = process.env.GAS_API_URL;

    if (!gasApiUrl) {
      throw new Error("Missing GAS_API_URL environment variable");
    }

    const body = await request.text();
    const gasResponse = await fetch(gasApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body,
    });

    const responseBody = await gasResponse.text();

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
