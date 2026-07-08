const DEFAULT_GAS_API_URL =
  "https://script.google.com/macros/s/AKfycbxKP0UYQf-_QhxSrbiDrkJrFr-meUrQohjaUZu_oN2zN8J3aArAcM5KASoCwd3jS8aS/exec";

function getGasApiUrls() {
  return [
    process.env.GAS_API_URL,
    process.env.GAS_API_URL_FALLBACK,
    process.env.NEXT_PUBLIC_GAS_API_URL,
    DEFAULT_GAS_API_URL,
  ]
    .map((url) => String(url || "").trim())
    .filter(Boolean)
    .filter((url, index, arr) => arr.indexOf(url) === index);
}

export async function POST(request) {
  try {
    const body = await request.text();
    const gasApiUrls = getGasApiUrls();

    if (!gasApiUrls.length) {
      throw new Error("Missing GAS_API_URL environment variable");
    }

    const attempts = [];

    for (const gasApiUrl of gasApiUrls) {
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

      if (looksJson) {
        return new Response(responseBody, {
          status: gasResponse.status,
          headers: {
            "Content-Type":
              gasResponse.headers.get("Content-Type") ||
              "application/json; charset=utf-8",
          },
        });
      }

      attempts.push({
        status: gasResponse.status,
        contentType,
        preview: responseBody.slice(0, 300),
      });
    }

    return Response.json(
      {
        ok: false,
        message:
          "GAS ตอบกลับไม่ใช่ JSON: อาจเป็นหน้า HTML/OK จาก webhook หรือ GAS_API_URL ชี้ไป deployment ที่ไม่ใช่ JSON API",
        error: "GAS returned a non-JSON response",
        upstreamAttempts: attempts,
      },
      { status: 502 },
    );
  } catch (error) {
    return Response.json({
      ok: false,
      message: "API Proxy Error",
      error: error && error.message ? error.message : String(error),
    });
  }
}
