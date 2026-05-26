export class ProverkachekaClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string
  ) {}

  async getCheckByQrRaw(qrRaw: string): Promise<unknown> {
    const url = new URL(`${this.baseUrl.replace(/\/+$/, "")}/check/get`);
    console.log("Proverkacheka URL:", url.href);
console.log("Proverkacheka token length:", this.token.length);
    const formData = new FormData();

    formData.append("token", this.token);
    formData.append("qrraw", qrRaw);

    let response: Response;

    try {
      response = await fetch(url, {
        method: "POST",
        body: formData,
      });
    } catch (error) {
      throw new Error(`Failed to call Proverkacheka API: ${error instanceof Error ? error.message : String(error)}`);
    }

    const responseText = await response.text();
    const contentType = response.headers.get("content-type") ?? "unknown";
    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(responseText) as unknown;
    } catch (error) {
      const responsePreview = responseText.slice(0, 1000);

      throw new Error(
        `Proverkacheka API returned invalid JSON. HTTP status: ${response.status}. Content-Type: ${contentType}. Response preview: ${responsePreview}`
      );
    }

    if (!response.ok) {
      throw new Error(`Proverkacheka API request failed with HTTP ${response.status}: ${responseText}`);
    }

    return parsedJson;
  }
}
