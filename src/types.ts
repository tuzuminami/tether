export type PersonaVersionStatus = "draft" | "published" | "deprecated";

export interface PersonaContract {
  readonly id: string;
  readonly version: string;
  readonly displayName: string;
  readonly components: readonly PersonaComponent[];
  readonly policyRefs: readonly string[];
  readonly pluginRefs?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface PersonaComponent {
  readonly id: string;
  readonly kind: "instruction" | "style" | "boundary" | "context";
  readonly content: string;
}

export interface PersonaVersion {
  readonly contract: PersonaContract;
  readonly status: PersonaVersionStatus;
}

export interface PluginManifest {
  readonly name: string;
  readonly version: string;
  readonly coreApiVersion: string;
  readonly capabilities: readonly string[];
}

export interface CompileOptions {
  readonly compilerVersion: string;
  readonly generatedAt: string;
  readonly plugins?: readonly PluginManifest[];
}

export interface CompiledBundle {
  readonly bundleVersion: "tether.compiled-bundle.v1";
  readonly compilerVersion: string;
  readonly source: {
    readonly contractId: string;
    readonly contractVersion: string;
    readonly sourceHash: string;
  };
  readonly contentHash: string;
  readonly generatedAt: string;
  readonly payload: {
    readonly displayName: string;
    readonly components: readonly PersonaComponent[];
    readonly policyRefs: readonly string[];
    readonly pluginRefs: readonly string[];
  };
  readonly provenance: {
    readonly componentIds: readonly string[];
    readonly pluginNames: readonly string[];
  };
}

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
