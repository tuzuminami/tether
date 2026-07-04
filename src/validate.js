import { TetherError } from "./errors.js";

const COMPONENT_KINDS = new Set(["instruction", "style", "boundary", "context"]);
const SUPPORTED_CORE_API_VERSION = "tether.persona-compiler.v1";

export function parsePersonaContract(input) {
  if (!isRecord(input)) {
    throw validation(["contract must be an object"]);
  }

  const details = [];
  const id = readString(input, "id", details);
  const version = readString(input, "version", details);
  const displayName = readString(input, "displayName", details);
  const components = readComponents(input.components, details);
  const policyRefs = readStringArray(input.policyRefs, "policyRefs", details);
  const pluginRefs = input.pluginRefs === undefined ? undefined : readStringArray(input.pluginRefs, "pluginRefs", details);
  const metadata = input.metadata === undefined ? undefined : readJsonObject(input.metadata, "metadata", details);

  if (new Set(components.map((component) => component.id)).size !== components.length) {
    details.push("components must have unique ids");
  }

  if (policyRefs.length === 0) {
    details.push("policyRefs must contain at least one explicit reference");
  }

  if (details.length > 0) {
    throw validation(details);
  }

  return {
    id,
    version,
    displayName,
    components,
    policyRefs,
    ...(pluginRefs === undefined ? {} : { pluginRefs }),
    ...(metadata === undefined ? {} : { metadata })
  };
}

export function validatePluginRefs(contract, plugins = []) {
  const requiredRefs = contract.pluginRefs ?? [];
  const manifests = new Map(plugins.map((plugin) => [plugin.name, plugin]));
  const details = [];

  for (const ref of requiredRefs) {
    const plugin = manifests.get(ref);
    if (plugin === undefined) {
      details.push(`pluginRef ${ref} is not registered`);
      continue;
    }
    if (plugin.coreApiVersion !== SUPPORTED_CORE_API_VERSION) {
      details.push(`pluginRef ${ref} uses unsupported coreApiVersion`);
    }
    if (!plugin.capabilities.includes("persona.compile")) {
      details.push(`pluginRef ${ref} lacks persona.compile capability`);
    }
  }

  if (details.length > 0) {
    throw new TetherError("PLUGIN_INCOMPATIBLE", "Plugin validation failed.", details);
  }
}

function readComponents(value, details) {
  if (!Array.isArray(value)) {
    details.push("components must be an array");
    return [];
  }
  if (value.length === 0) {
    details.push("components must contain at least one item");
    return [];
  }

  return value.map((component, index) => {
    if (!isRecord(component)) {
      details.push(`components[${index}] must be an object`);
      return { id: "", kind: "instruction", content: "" };
    }

    const id = readString(component, "id", details, `components[${index}].id`);
    const kind = readString(component, "kind", details, `components[${index}].kind`);
    const content = readString(component, "content", details, `components[${index}].content`);

    if (!COMPONENT_KINDS.has(kind)) {
      details.push(`components[${index}].kind is not supported`);
    }

    return {
      id,
      kind: COMPONENT_KINDS.has(kind) ? kind : "instruction",
      content
    };
  });
}

function readString(record, key, details, path = key) {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    details.push(`${path} must be a non-empty string`);
    return "";
  }
  return value;
}

function readStringArray(value, path, details) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    details.push(`${path} must be an array of non-empty strings`);
    return [];
  }
  return value;
}

function readJsonObject(value, path, details) {
  if (!isRecord(value) || !isJsonValue(value)) {
    details.push(`${path} must be a JSON object`);
    return {};
  }
  return value;
}

function isJsonValue(value) {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return Number.isFinite(value) || typeof value !== "number";
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (isRecord(value)) {
    return Object.values(value).every(isJsonValue);
  }
  return false;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validation(details) {
  return new TetherError("VALIDATION_FAILED", "Persona Contract validation failed.", details);
}
