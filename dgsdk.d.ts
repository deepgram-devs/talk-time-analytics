/// <reference types="node" />
declare type AudioMimeType = "audio/wave" | "audio/wav" | "audio/x-wav" | "audio/x-pn-wav	" | "audio/webm" | "video/webm" | "audio/ogg" | "video/ogg" | "application/ogg";
declare type DGSource = {
    kind: "url";
    url: string;
} | {
    kind: "buffer";
    buffer: Buffer;
    mimetype: AudioMimeType;
};
declare type DGApiResponse = {
    kind: "error";
    reason: string;
} | {
    kind: "success";
    metadata: DGApiMetadata;
    results: {
        channels: Array<DGChannel>;
    };
};
declare type DGApiMetadata = {
    request_id: string;
    transaction_key: string;
    sha256: string;
    created: string;
    duration: number;
    channels: number;
};
declare type DGChannel = {
    search: Array<{
        query: string;
        hits: string;
    }>;
    alternatives: Array<{
        transcript: string;
        confidence: number;
        words: Array<DGWord>;
    }>;
};
declare type DGWord = {
    word: string;
    start: number;
    end: number;
    confidence: number;
};
declare type DGOptions = {
    punctuate: boolean;
    diarize: boolean;
};
export declare function listen({ credentials, source, options, }: {
    credentials: {
        api_key: string;
        api_secret: string;
    };
    source: DGSource;
    options: Partial<DGOptions>;
}): Promise<DGApiResponse>;
export {};
