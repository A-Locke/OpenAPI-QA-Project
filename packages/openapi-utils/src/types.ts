/** Minimal OpenAPI 3.x document structure used across SpecGuard */
export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
    [key: string]: unknown;
  };
  servers?: Array<{ url: string; description?: string }>;
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface PathItem {
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  patch?: OperationObject;
  delete?: OperationObject;
  [key: string]: unknown;
}

export interface OperationObject {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: Record<string, ResponseObject>;
  [key: string]: unknown;
}

export interface ParameterObject {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required?: boolean;
  schema?: SchemaObject;
  description?: string;
  example?: unknown;
  [key: string]: unknown;
}

export interface RequestBodyObject {
  required?: boolean;
  content: Record<string, MediaTypeObject>;
  description?: string;
}

export interface MediaTypeObject {
  schema?: SchemaObject;
  examples?: Record<string, ExampleObject>;
  [key: string]: unknown;
}

export interface ExampleObject {
  summary?: string;
  value?: unknown;
  [key: string]: unknown;
}

export interface ResponseObject {
  description: string;
  content?: Record<string, MediaTypeObject>;
  [key: string]: unknown;
}

export interface SchemaObject {
  type?: string;
  format?: string;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  required?: string[];
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  default?: unknown;
  example?: unknown;
  description?: string;
  additionalProperties?: boolean | SchemaObject;
  $ref?: string;
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  allOf?: SchemaObject[];
  [key: string]: unknown;
}
