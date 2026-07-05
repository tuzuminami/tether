export interface JsonSchema {
  readonly $id?: string;
  readonly $schema?: string;
  readonly title?: string;
  readonly type?: "object" | "array" | "string" | "number" | "boolean" | "null";
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean | JsonSchema;
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly items?: JsonSchema;
  readonly minItems?: number;
  readonly minimum?: number;
  readonly enum?: readonly unknown[];
  readonly oneOf?: readonly JsonSchema[];
}

const stringId: JsonSchema = { type: "string" };
const finiteNumber: JsonSchema = { type: "number" };
const payload: JsonSchema = { type: "object", additionalProperties: true };

export const relationshipModelSchema = {
  $id: "https://tuzuminami.github.io/tether/schemas/relationship-model.schema.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "RelationshipModel",
  type: "object",
  additionalProperties: false,
  required: ["id", "version", "axes", "events", "transitionRules", "boundaryRules"],
  properties: {
    id: stringId,
    version: stringId,
    axes: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "min", "max", "initial"],
        properties: {
          id: stringId,
          min: finiteNumber,
          max: finiteNumber,
          initial: finiteNumber
        }
      }
    },
    events: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type"],
        properties: {
          type: stringId
        }
      }
    },
    transitionRules: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "eventType", "axis", "delta", "reasonCode"],
        properties: {
          id: stringId,
          eventType: stringId,
          axis: stringId,
          delta: finiteNumber,
          reasonCode: stringId
        }
      }
    },
    boundaryRules: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "eventType", "axis", "policyRef"],
        properties: {
          id: stringId,
          eventType: stringId,
          axis: stringId,
          blocksPositiveDelta: { type: "boolean" },
          policyRef: stringId
        }
      }
    },
    decayRules: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["axis", "perDay"],
        properties: {
          axis: stringId,
          perDay: { type: "number", minimum: 0 }
        }
      }
    }
  }
} as const satisfies JsonSchema;

export const createRelationshipSchema = {
  $id: "https://tuzuminami.github.io/tether/schemas/create-relationship.schema.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "CreateRelationshipRequest",
  type: "object",
  additionalProperties: false,
  required: ["modelId", "modelVersion", "subjectRef"],
  properties: {
    id: stringId,
    modelId: stringId,
    modelVersion: stringId,
    subjectRef: stringId
  }
} as const satisfies JsonSchema;

export const relationshipEventSchema = {
  $id: "https://tuzuminami.github.io/tether/schemas/relationship-event.schema.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "RelationshipEventRequest",
  type: "object",
  additionalProperties: false,
  required: ["type"],
  properties: {
    id: stringId,
    type: stringId,
    payload
  }
} as const satisfies JsonSchema;

export const simulateRelationshipEventSchema = {
  $id: "https://tuzuminami.github.io/tether/schemas/simulate-relationship-event.schema.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "SimulateRelationshipEventRequest",
  type: "object",
  additionalProperties: false,
  required: ["event"],
  properties: {
    event: relationshipEventSchema,
    baselineAt: stringId
  }
} as const satisfies JsonSchema;

export const decayPreviewSchema = {
  $id: "https://tuzuminami.github.io/tether/schemas/decay-preview.schema.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "DecayPreviewRequest",
  type: "object",
  additionalProperties: false,
  required: ["baselineAt"],
  properties: {
    baselineAt: stringId
  }
} as const satisfies JsonSchema;

export const responseEnvelopeSchema = {
  $id: "https://tuzuminami.github.io/tether/schemas/response-envelope.schema.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "ResponseEnvelope",
  type: "object",
  additionalProperties: false,
  required: ["data", "meta"],
  properties: {
    data: {},
    meta: {
      type: "object",
      additionalProperties: false,
      required: ["requestId", "correlationId", "apiVersion"],
      properties: {
        requestId: stringId,
        correlationId: stringId,
        apiVersion: stringId
      }
    }
  }
} as const satisfies JsonSchema;

export const errorEnvelopeSchema = {
  $id: "https://tuzuminami.github.io/tether/schemas/error-envelope.schema.json",
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "ErrorEnvelope",
  type: "object",
  additionalProperties: false,
  required: ["error"],
  properties: {
    error: {
      type: "object",
      additionalProperties: false,
      required: ["code", "message", "details", "correlationId"],
      properties: {
        code: stringId,
        message: stringId,
        details: { type: "array", items: stringId },
        correlationId: stringId
      }
    }
  }
} as const satisfies JsonSchema;

export const publicSchemas = {
  relationshipModel: relationshipModelSchema,
  createRelationship: createRelationshipSchema,
  relationshipEvent: relationshipEventSchema,
  simulateRelationshipEvent: simulateRelationshipEventSchema,
  decayPreview: decayPreviewSchema,
  responseEnvelope: responseEnvelopeSchema,
  errorEnvelope: errorEnvelopeSchema
} as const;
