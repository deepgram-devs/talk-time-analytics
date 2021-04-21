import { request } from "https";

type DGSource =
  | { kind: "url"; url: string }
  | { kind: "buffer"; buffer: Buffer; mimetype: string };

type DGApiResponse =
  | { kind: "error"; reason: string }
  | {
      kind: "success";
      metadata: DGApiMetadata;
      results: { channels: Array<DGChannel> };
    };

type DGApiMetadata = {
  request_id: string;
  transaction_key: string;
  sha256: string;
  created: string;
  duration: number;
  channels: number;
};

type DGChannel = {
  search: Array<{ query: string; hits: string }>;
  alternatives: Array<{
    transcript: string;
    confidence: number;
    words: Array<DGWord>;
  }>;
};
type DGWord = {
  word: string;
  start: number;
  end: number;
  confidence: number;
};

type DGOptions = { punctuate: boolean; diarize: boolean };

const defaultOptions: DGOptions = {
  punctuate: false,
  diarize: false,
};

function buildDeepgramAPIRoute(options: DGOptions): string {
  const queryParams: Array<string> = [];
  if (options.punctuate) {
    queryParams.push("punctuate=true");
  }
  if (options.diarize) {
    queryParams.push("diarize=true");
  }
  return (
    "/v2/listen" + (queryParams.length === 0 ? "" : "?" + queryParams.join("&"))
  );
}

export function listen({
  credentials,
  source,
  options,
}: {
  credentials: { api_key: string; api_secret: string };
  source: DGSource;
  options: Partial<DGOptions>;
}): Promise<DGApiResponse> {
  const credentialsB64 = Buffer.from(
    credentials.api_key + ":" + credentials.api_secret
  ).toString("base64");

  const allOptions: DGOptions = { ...defaultOptions, ...options };

  const requestOptions = {
    host: "brain.deepgram.com",
    /** You can add options as parameters in the URL, see the docs:
     * https://developers.deepgram.com/api-reference/speech-recognition-api#operation/transcribeStreamingAudio
     */
    path: buildDeepgramAPIRoute(allOptions),
    method: "POST",
    headers: {
      "Content-Type":
        source.kind === "url" ? "application/json" : source.mimetype,
      Authorization: "Basic " + credentialsB64,
    },
  };

  const payload = source.kind === "url" ? source.url : source.buffer;

  return new Promise((resolve, _) => {
    const httpRequest = request(requestOptions, (dgRes) => {
      // we accumulate data in `dgResContent` as it
      // comes from Deepgram API
      let dgResContent = "";
      dgRes.on("data", (chunk) => {
        dgResContent += chunk;
      });

      dgRes.on("end", () => {
        // When we have the complete answer from Deepgram API,
        // we can resolve the promise
        const dgResJson = JSON.parse(dgResContent);
        if (dgResJson.error) {
          resolve({ kind: "error", reason: dgResContent });
        } else {
          resolve({ kind: "success", ...dgResJson } as DGApiResponse);
        }
      });
      dgRes.on("error", (err) => {
        resolve({ kind: "error", reason: JSON.stringify(err) });
      });
    });

    httpRequest.on("error", (err) => {
      resolve({ kind: "error", reason: JSON.stringify(err) });
    });
    httpRequest.write(payload);
    httpRequest.end();
  });
}
