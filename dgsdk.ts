import { request } from "https";

type DGSource =
  | { kind: "url"; url: string }
  | { kind: "buffer"; buffer: Buffer; mimetype: string };

type DGApiResponse<
  Alt extends Alternatives,
  S extends SearchKind,
  W extends DGWordBase
> =
  | { status: "error"; reason: string }
  | {
      status: "success";
      metadata: DGApiMetadata;
      channels: Array<DGChannel<Alt, S, W>>;
    };

type DGApiMetadata = {
  request_id: string;
  transaction_key: string;
  sha256: string;
  created: string;
  duration: number;
  channels: number;
};

type DGHit = {
  confidence: number;
  start: number;
  end: number;
  snippet: string;
};

type DGChannel<
  Alt extends Alternatives,
  S extends SearchKind,
  W extends DGWordBase
> = (S extends "no-search"
  ? {}
  : {
      search: Array<{ query: string; hits: Array<DGHit> }>;
    }) &
  (Alt extends "one-alternative"
    ? { transcript: string; confidence: number; words: Array<W> }
    : {
        alternatives: Array<{
          transcript: string;
          confidence: number;
          words: Array<W>;
        }>;
      });
type DGWordBase = {
  word: string;
  start: number;
  end: number;
  confidence: number;
};

export type SearchKind = "no-search" | "with-search";
export type Keyword = string | { word: string; boost: number };
export type Diarization = "non-diarized" | "diarized";
export type Punctuation = "non-punctuated" | "punctuated";
export type Alternatives = "one-alternative" | "multiple-alternatives";

export type DGWord<
  Diarize extends Diarization,
  Punc extends Punctuation
> = DGWordBase &
  (Diarize extends "diarized"
    ? {
        speaker: number;
      }
    : {}) &
  (Punc extends "punctuated" ? { punctuated_word: string } : {});

interface _Options {
  punctuation: Punctuation;
  diarization: Diarization;
  alternativesCount: number;
  alternativesSet: boolean;
  profanityFilter: boolean;
  PCIReadaction: boolean;
  numbersReadaction: boolean;
  SSNReadaction: boolean;
  keywords: Array<Keyword>;
  searchedTerms: Array<string>;
  searchSet: boolean;
}

function buildAPIRoute(options: _Options): string {
  const queryParams: Array<string> = [];
  if (options.punctuation === "punctuated") {
    queryParams.push("punctuate=true");
  }
  if (options.diarization === "diarized") {
    queryParams.push("diarize=true");
  }
  if (options.alternativesCount > 1) {
    queryParams.push("alternatives=" + options.alternativesCount);
  }
  if (options.profanityFilter) {
    queryParams.push("profanity_filter=true");
  }
  if (options.numbersReadaction) {
    queryParams.push("redact=numbers");
  }
  if (options.SSNReadaction) {
    queryParams.push("redact=ssn");
  }
  if (options.PCIReadaction) {
    queryParams.push("redact=pci");
  }
  for (const keyword of options.keywords) {
    if (typeof keyword === "string") {
      queryParams.push("keywords=" + encodeURIComponent(keyword));
    } else {
      queryParams.push(
        "keywords=" + encodeURIComponent(keyword.word) + ":" + keyword.boost
      );
    }
  }
  for (const term of options.searchedTerms) {
    queryParams.push("search=" + encodeURIComponent(term));
  }

  return (
    "/v2/listen" + (queryParams.length === 0 ? "" : "?" + queryParams.join("&"))
  );
}

class DGOptions<
  Alt extends Alternatives,
  S extends SearchKind,
  Diarize extends Diarization,
  Punc extends Punctuation
> {
  private readonly options: _Options;

  constructor(options: _Options) {
    this.options = options;
  }

  /**
   * Assign a speaker number starting at 0 to each word in the transcript.
   * In the response, add a `speaker: number` field to the `DGWordBase` type.
   */
  diarize(): DGOptions<Alt, S, "diarized", Punc> {
    return new DGOptions({ ...this.options, diarization: "diarized" });
  }

  /**
   * Add punctuation and capitalization to the transcript.
   * In the response, add a `punctuated_word: string` field to the `DGWordBase` type.
   */
  punctuate(): DGOptions<Alt, S, Diarize, "punctuated"> {
    return new DGOptions({ ...this.options, punctuation: "punctuated" });
  }

  /**
   * Maximum number of transcript alternatives to return. Just like a human listener,
   * Deepgram can provide multiple possible interpretations of what it hears
   * (defaults to 1 if not set).
   *
   * In the response, turn:
   * ```
   * {
   *   metadata: {...},
   *   channels: [{ words: [...], search: [...], ... }],
   * }
   * ```
   * into:
   * ```
   * {
   *   metadata: {...},
   *   channels: [{
   *        search: [...],
   *        alternatives:[{ words: [...], ... }]
   *    }],
   * }
   * ```
   */
  setAlternativesNumber(
    count: number
  ): DGOptions<"multiple-alternatives", S, Diarize, Punc> {
    return new DGOptions({
      ...this.options,
      alternativesCount: Math.max(Math.round(count), 1),
      alternativesSet: true,
    });
  }
  /**
   * Remove profanity from the transcript.
   */
  filterProfanity(): DGOptions<Alt, S, Diarize, Punc> {
    return new DGOptions({ ...this.options, profanityFilter: true });
  }

  /**
   *  Redact sensitive credit card information, including credit card number, expiration date,
   *  and CVV, replacing redacted content with asterisks (*).
   *
   *  Can be associated with other `redact*` options.
   */
  readactPCI(): DGOptions<Alt, S, Diarize, Punc> {
    return new DGOptions({ ...this.options, PCIReadaction: true });
  }

  /**
   *  Aggressively redacts strings of numerals, replacing redacted content with asterisks (*).
   *
   *  Can be associated with other `redact*` options.
   */
  readactNumbers(): DGOptions<Alt, S, Diarize, Punc> {
    return new DGOptions({ ...this.options, numbersReadaction: true });
  }

  /**
   *  Redacts social security numbers, replacing redacted content with asterisks (*).
   *
   *  Can be associated with other `redact*` options.
   */
  readactSSN(): DGOptions<Alt, S, Diarize, Punc> {
    return new DGOptions({ ...this.options, SSNReadaction: true });
  }

  /**
   * Keywords to which the model should pay particular attention to boosting or
   * suppressing to  help it understand context. Just like a human listener,
   * Deepgram can better understand mumbled, distorted, or otherwise
   *  hard-to-decipher speech when it knows the context of the conversation.
   *
   * To learn more about the most effective way to use keywords and recognize
   * context in your transcript, see our Keyword Boosting guide:
   * https://developers.deepgram.com/guides/boosting-keywords
   */
  addKeywords(keywords: Array<Keyword>): DGOptions<Alt, S, Diarize, Punc> {
    return new DGOptions({
      ...this.options,
      keywords: [...this.options.keywords, ...keywords],
    });
  }
  /**
   * Terms or phrases to search for in the submitted audio. Deepgram searches
   * for acoustic patterns in audio rather than text patterns in transcripts
   * because we have noticed that acoustic pattern matching is more performant.
   *
   * In the response, turn:
   * ```
   * {
   *   metadata: {...},
   *   channels: [{ words: [...]}],
   * }
   * ```
   * into:
   * ```
   * {
   *   metadata: {...},
   *   channels: [{
   *        words: [...],
   *        search: [ {
   *            query: string,
   *            hits : [ { ... }]
   *        }]
   *     }],
   * }
   * ```
   */
  addSearchTerms(
    terms: Array<string>
  ): DGOptions<Alt, "with-search", Diarize, Punc> {
    return new DGOptions({
      ...this.options,
      searchedTerms: [...this.options.searchedTerms, ...terms],
      searchSet: true,
    });
  }

  buildAPIRoute(): string {
    return buildAPIRoute(this.options);
  }

  withCredentials(credentials: {
    api_key: string;
    api_secret: string;
  }): DGExectuor<Alt, S, Diarize, Punc> {
    return new DGExectuor(
      this.options,
      credentials.api_key,
      credentials.api_secret
    );
  }
}

class DGExectuor<
  Alt extends Alternatives,
  S extends SearchKind,
  Diarize extends Diarization,
  Punc extends Punctuation
> {
  private readonly options: _Options;
  private readonly api_key: string;
  private readonly api_secret: string;

  constructor(options: _Options, api_key: string, api_secret: string) {
    this.options = options;
    this.api_key = api_key;
    this.api_secret = api_secret;
  }

  transcribeUrl(
    url: string
  ): Promise<DGApiResponse<Alt, S, DGWord<Diarize, Punc>>> {
    return listen<Alt, S, Diarize, Punc>({
      api_key: this.api_key,
      api_secret: this.api_secret,
      options: this.options,
      source: { kind: "url", url },
    });
  }

  transcribeBuffer({
    buffer,
    mimetype,
  }: {
    buffer: Buffer;
    mimetype: string;
  }): Promise<DGApiResponse<Alt, S, DGWord<Diarize, Punc>>> {
    return listen<Alt, S, Diarize, Punc>({
      api_key: this.api_key,
      api_secret: this.api_secret,
      options: this.options,
      source: { kind: "buffer", buffer, mimetype },
    });
  }
}

export const DeepgramAPI: DGOptions<
  "one-alternative",
  "no-search",
  "non-diarized",
  "non-punctuated"
> = new DGOptions({
  punctuation: "non-punctuated",
  diarization: "non-diarized",
  alternativesCount: 1,
  alternativesSet: false,
  profanityFilter: false,
  PCIReadaction: false,
  numbersReadaction: false,
  SSNReadaction: false,
  keywords: [],
  searchedTerms: [],
  searchSet: false,
});

function listen<
  Alt extends Alternatives,
  S extends SearchKind,
  Diarize extends Diarization,
  Punc extends Punctuation
>({
  api_key,
  api_secret,
  source,
  options,
}: {
  api_key: string;
  api_secret: string;
  source: DGSource;
  options: _Options;
}): Promise<DGApiResponse<Alt, S, DGWord<Diarize, Punc>>> {
  const credentialsB64 = Buffer.from(api_key + ":" + api_secret).toString(
    "base64"
  );

  const requestOptions = {
    host: "brain.deepgram.com",
    /** You can add options as parameters in the URL, see the docs:
     * https://developers.deepgram.com/api-reference/speech-recognition-api#operation/transcribeStreamingAudio
     */
    path: buildAPIRoute(options),
    method: "POST",
    headers: {
      "Content-Type":
        source.kind === "url" ? "application/json" : source.mimetype,
      Authorization: "Basic " + credentialsB64,
    },
  };

  const payload =
    source.kind === "url" ? JSON.stringify({ url: source.url }) : source.buffer;

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
          resolve({ status: "error", reason: dgResContent });
        } else {
          console.log(dgResJson.results.channels[0]);
          resolve({
            status: "success",
            metadata: dgResJson.metadata as DGApiMetadata,
            channels: options.alternativesSet
              ? dgResJson.results.channels
              : dgResJson.results.channels.map((channel: any) =>
                  options.searchSet
                    ? { search: channel.search, ...channel.alternatives[0] }
                    : channel.alternatives[0]
                ),
          } as DGApiResponse<Alt, S, DGWord<Diarize, Punc>>);
        }
      });
      dgRes.on("error", (err) => {
        resolve({ status: "error", reason: JSON.stringify(err) });
      });
    });

    httpRequest.on("error", (err) => {
      resolve({ status: "error", reason: JSON.stringify(err) });
    });
    httpRequest.write(payload);
    httpRequest.end();
  });
}
