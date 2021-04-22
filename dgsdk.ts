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

type DGChannel<
  Alt extends Alternatives,
  S extends SearchKind,
  W extends DGWordBase
> = (S extends "no-search"
  ? {}
  : {
      search: Array<{ query: string; hits: string }>;
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

type _Options = {
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
};

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

  diarize(): DGOptions<Alt, S, "diarized", Punc> {
    return new DGOptions({ ...this.options, diarization: "diarized" });
  }

  punctuate(): DGOptions<Alt, S, Diarize, "punctuated"> {
    return new DGOptions({ ...this.options, punctuation: "punctuated" });
  }

  setAlternativesNumber(
    count: number
  ): DGOptions<"multiple-alternatives", S, Diarize, Punc> {
    return new DGOptions({
      ...this.options,
      alternativesCount: Math.max(Math.round(count), 1),
      alternativesSet: true,
    });
  }

  filterProfanity(): DGOptions<Alt, S, Diarize, Punc> {
    return new DGOptions({ ...this.options, profanityFilter: true });
  }

  readactPCI(): DGOptions<Alt, S, Diarize, Punc> {
    return new DGOptions({ ...this.options, PCIReadaction: true });
  }

  readactNumbers(): DGOptions<Alt, S, Diarize, Punc> {
    return new DGOptions({ ...this.options, numbersReadaction: true });
  }

  readactSSN(): DGOptions<Alt, S, Diarize, Punc> {
    return new DGOptions({ ...this.options, SSNReadaction: true });
  }

  isMultiAlternatives(): boolean {
    return this.options.alternativesSet;
  }

  addKeywords(keywords: Array<Keyword>): DGOptions<Alt, S, Diarize, Punc> {
    return new DGOptions({
      ...this.options,
      keywords: [...this.options.keywords, ...keywords],
    });
  }

  addSearchTerms(
    terms: Array<string>
  ): DGOptions<Alt, "with-search", Diarize, Punc> {
    return new DGOptions({
      ...this.options,
      searchedTerms: [...this.options.searchedTerms, ...terms],
      searchSet: true,
    });
  }

  isSearch() {
    return this.options.searchSet;
  }

  buildAPIRoute(): string {
    const queryParams: Array<string> = [];
    if (this.options.punctuation === "punctuated") {
      queryParams.push("punctuate=true");
    }
    if (this.options.diarization === "diarized") {
      queryParams.push("diarize=true");
    }
    if (this.options.alternativesCount > 1) {
      queryParams.push("alternatives=" + this.options.alternativesCount);
    }
    if (this.options.profanityFilter) {
      queryParams.push("profanity_filter=true");
    }
    if (this.options.numbersReadaction) {
      queryParams.push("redact=numbers");
    }
    if (this.options.SSNReadaction) {
      queryParams.push("redact=ssn");
    }
    if (this.options.PCIReadaction) {
      queryParams.push("redact=pci");
    }
    for (const keyword of this.options.keywords) {
      if (typeof keyword === "string") {
        queryParams.push("keywords=" + encodeURIComponent(keyword));
      } else {
        queryParams.push(
          "keywords=" + encodeURIComponent(keyword.word) + ":" + keyword.boost
        );
      }
    }
    for (const term of this.options.searchedTerms) {
      queryParams.push("keywords=" + encodeURIComponent(term));
    }

    return (
      "/v2/listen" +
      (queryParams.length === 0 ? "" : "?" + queryParams.join("&"))
    );
  }

  withCredentials(credentials: {
    api_key: string;
    api_secret: string;
  }): DGExectuor<Alt, S, Diarize, Punc> {
    return new DGExectuor(this, credentials.api_key, credentials.api_secret);
  }
}

class DGExectuor<
  Alt extends Alternatives,
  S extends SearchKind,
  Diarize extends Diarization,
  Punc extends Punctuation
> {
  private readonly options: DGOptions<Alt, S, Diarize, Punc>;
  private readonly api_key: string;
  private readonly api_secret: string;

  constructor(
    options: DGOptions<Alt, S, Diarize, Punc>,
    api_key: string,
    api_secret: string
  ) {
    this.options = options;
    this.api_key = api_key;
    this.api_secret = api_secret;
  }

  transcribeUrl(
    url: string
  ): Promise<DGApiResponse<Alt, S, DGWord<Diarize, Punc>>> {
    return listen({
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
    return listen({
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
  options: DGOptions<Alt, S, Diarize, Punc>;
}): Promise<DGApiResponse<Alt, S, DGWord<Diarize, Punc>>> {
  const credentialsB64 = Buffer.from(api_key + ":" + api_secret).toString(
    "base64"
  );

  const requestOptions = {
    host: "brain.deepgram.com",
    /** You can add options as parameters in the URL, see the docs:
     * https://developers.deepgram.com/api-reference/speech-recognition-api#operation/transcribeStreamingAudio
     */
    path: options.buildAPIRoute(),
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
          resolve({
            status: "success",
            metadata: dgResJson.metadata as DGApiMetadata,
            channels: options.isMultiAlternatives()
              ? dgResJson.results.channels
              : dgResJson.results.channels.map((channel: any) =>
                  options.isSearch()
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
