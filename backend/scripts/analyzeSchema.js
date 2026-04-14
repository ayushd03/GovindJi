#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const {
  createBackendSupabaseClient,
  getPreferredSupabaseKey,
  getSupabaseUrl,
} = require('../config/supabaseClient');

const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..');
const envPath = path.join(backendRoot, '.env');
const migrationsDir = path.join(backendRoot, 'migrations');
const schemaDir = path.join(backendRoot, 'schema');
const schemaSnapshotPath = path.join(schemaDir, 'public-schema.snapshot.json');
const reportDir = path.join(backendRoot, 'reports');
const jsonReportPath = path.join(reportDir, 'schema-analysis.json');
const markdownReportPath = path.join(reportDir, 'schema-analysis.md');

dotenv.config({ path: envPath });

const FILE_EXTENSIONS = new Set(['.js', '.jsx', '.sql']);
const SCAN_ROOTS = [
  path.join(backendRoot, 'config'),
  path.join(backendRoot, 'middleware'),
  path.join(backendRoot, 'routes'),
  path.join(backendRoot, 'services'),
  path.join(backendRoot, 'server.js'),
  path.join(repoRoot, 'frontend', 'src'),
];

const KNOWN_TABLE_LIKE_TOKENS = new Set([
  'admin_logs',
  'categories',
  'category_images',
  'delivery_settings',
  'employees',
  'expenses',
  'order_items',
  'orders',
  'parties',
  'party_payments',
  'party_transactions',
  'payment_transactions',
  'pickup_requests',
  'product_images',
  'product_variants',
  'products',
  'purchase_order_items',
  'purchase_orders',
  'reviews',
  'shipment_tracking_events',
  'shipments',
  'stock_movements',
  'transaction_attachments',
  'unified_transactions',
  'users',
  'wholesale_prices',
]);

const COLUMN_IGNORE_LIST = new Set([
  'created_at',
  'updated_at',
  'is_active',
  'id',
]);

const GLOBAL_TOKEN_IGNORE_LIST = new Set([
  'auth_token',
  'client_url',
  'frontend_url',
  'backend_url',
  'base_url',
  'product_id',
  'user_id',
  'party_id',
  'order_id',
  'category_id',
  'admin_id',
  'image_id',
  'item_id',
  'role_id',
  'variant_id',
  'payment_id',
  'shipment_id',
  'pickup_request_id',
  'purchase_order_id',
  'party_payment_id',
  'transaction_date',
  'sort_order',
  'display_order',
  'foreign_table',
  'discount_rate',
  'tax_info',
  'tax_amount',
  'tax_rate',
]);

function ensureDir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function normalizeIdentifier(value) {
  return String(value || '')
    .trim()
    .replace(/["`]/g, '')
    .split('.')
    .pop()
    .trim();
}

function walkFiles(targetPath, collected = []) {
  if (!fs.existsSync(targetPath)) {
    return collected;
  }

  const stats = fs.statSync(targetPath);

  if (stats.isFile()) {
    if (FILE_EXTENSIONS.has(path.extname(targetPath))) {
      collected.push(targetPath);
    }
    return collected;
  }

  if (!stats.isDirectory()) {
    return collected;
  }

  const basename = path.basename(targetPath);
  if (basename === 'node_modules' || basename === 'build' || basename === 'uploads' || basename === 'logs') {
    return collected;
  }

  for (const entry of fs.readdirSync(targetPath)) {
    walkFiles(path.join(targetPath, entry), collected);
  }

  return collected;
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => {
      const commentIndex = line.indexOf('--');
      return commentIndex >= 0 ? line.slice(0, commentIndex) : line;
    })
    .join('\n');
}

function splitTopLevelCommaList(input) {
  const parts = [];
  let current = '';
  let depth = 0;
  let quote = null;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const previous = input[index - 1];

    if (quote) {
      current += char;
      if (char === quote && previous !== '\\') {
        quote = null;
      }
      continue;
    }

    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      current += char;
      continue;
    }

    if (char === '(') {
      depth += 1;
      current += char;
      continue;
    }

    if (char === ')') {
      depth = Math.max(0, depth - 1);
      current += char;
      continue;
    }

    if (char === ',' && depth === 0) {
      if (current.trim()) {
        parts.push(current.trim());
      }
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

function getTypeFromDefinition(definition) {
  const normalized = definition
    .replace(/\s+/g, ' ')
    .trim();

  const stopMatch = normalized.match(
    /^(.*?)(?=\s+(?:NOT NULL|NULL|DEFAULT|REFERENCES|PRIMARY KEY|UNIQUE|CHECK|CONSTRAINT)\b|$)/i
  );

  return (stopMatch ? stopMatch[1] : normalized).trim();
}

function parseReferences(definition) {
  const match = definition.match(/REFERENCES\s+("?[\w.]+"?)\s*\(([^)]+)\)/i);
  if (!match) {
    return null;
  }

  return {
    table: normalizeIdentifier(match[1]),
    column: normalizeIdentifier(match[2]),
  };
}

function ensureTable(tables, tableName) {
  if (!tables[tableName]) {
    tables[tableName] = {
      name: tableName,
      columns: {},
      indexes: [],
      migrationFiles: new Set(),
    };
  }

  return tables[tableName];
}

function upsertColumn(tables, tableName, columnName, metadata) {
  const table = ensureTable(tables, tableName);
  table.migrationFiles.add(metadata.file);

  if (!table.columns[columnName]) {
    table.columns[columnName] = {
      name: columnName,
      type: metadata.type || null,
      references: metadata.references || null,
      definedIn: [],
      alteredIn: [],
      droppedIn: [],
    };
  }

  const column = table.columns[columnName];
  if (metadata.kind === 'create') {
    column.definedIn.push(metadata.file);
  } else if (metadata.kind === 'alter') {
    column.alteredIn.push(metadata.file);
  } else if (metadata.kind === 'drop') {
    column.droppedIn.push(metadata.file);
  }

  if (metadata.type) {
    column.type = metadata.type;
  }

  if (metadata.references) {
    column.references = metadata.references;
  }
}

function parseColumnSpec(spec) {
  const trimmed = spec.trim();
  if (!trimmed) {
    return null;
  }

  if (/^(CONSTRAINT|PRIMARY KEY|FOREIGN KEY|UNIQUE|CHECK)\b/i.test(trimmed)) {
    return null;
  }

  const match = trimmed.match(/^("?[\w]+"?)\s+([\s\S]+)$/);
  if (!match) {
    return null;
  }

  const columnName = normalizeIdentifier(match[1]);
  if (!/^[a-z_][a-z0-9_]*$/i.test(columnName)) {
    return null;
  }

  const definition = match[2].trim();

  return {
    columnName,
    type: getTypeFromDefinition(definition),
    references: parseReferences(definition),
  };
}

function parseCreateTables(sql, filePath, tables) {
  const createTableRegex = /CREATE TABLE IF NOT EXISTS\s+("?[\w.]+"?)\s*\(([\s\S]*?)\);/gi;
  let match;

  while ((match = createTableRegex.exec(sql)) !== null) {
    const tableName = normalizeIdentifier(match[1]);
    const body = match[2];
    const columnSpecs = splitTopLevelCommaList(body);

    for (const columnSpec of columnSpecs) {
      const parsed = parseColumnSpec(columnSpec);
      if (!parsed) {
        continue;
      }

      upsertColumn(tables, tableName, parsed.columnName, {
        file: path.relative(repoRoot, filePath),
        kind: 'create',
        type: parsed.type,
        references: parsed.references,
      });
    }
  }
}

function parseAlterTables(sql, filePath, tables) {
  const alterTableRegex = /ALTER TABLE\s+("?[\w.]+"?)\s+([\s\S]*?);/gi;
  let alterMatch;

  while ((alterMatch = alterTableRegex.exec(sql)) !== null) {
    const tableName = normalizeIdentifier(alterMatch[1]);
    const body = alterMatch[2];
    const relativeFile = path.relative(repoRoot, filePath);

    const addColumnRegex = /ADD COLUMN(?: IF NOT EXISTS)?\s+("?[\w]+"?)\s+([\s\S]*?)(?=(?:,\s*ADD COLUMN|\s+ADD CONSTRAINT|\s+DROP CONSTRAINT|\s+RENAME COLUMN|\s+ALTER COLUMN|$))/gi;
    let addMatch;
    while ((addMatch = addColumnRegex.exec(body)) !== null) {
      const parsed = parseColumnSpec(`${addMatch[1]} ${addMatch[2]}`);
      if (!parsed) {
        continue;
      }

      upsertColumn(tables, tableName, parsed.columnName, {
        file: relativeFile,
        kind: 'alter',
        type: parsed.type,
        references: parsed.references,
      });
    }

    const dropColumnRegex = /DROP COLUMN(?: IF EXISTS)?\s+("?[\w]+"?)/gi;
    let dropMatch;
    while ((dropMatch = dropColumnRegex.exec(body)) !== null) {
      const columnName = normalizeIdentifier(dropMatch[1]);
      upsertColumn(tables, tableName, columnName, {
        file: relativeFile,
        kind: 'drop',
        type: null,
        references: null,
      });
    }
  }
}

function extractCommentedDropCandidates(rawSql, filePath) {
  const candidates = [];
  const lines = rawSql.split('\n');
  const relativeFile = path.relative(repoRoot, filePath);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/--\s*ALTER TABLE\s+("?[\w.]+"?)\s+DROP COLUMN IF EXISTS\s+("?[\w]+"?)/i);
    if (!match) {
      continue;
    }

    candidates.push({
      table: normalizeIdentifier(match[1]),
      column: normalizeIdentifier(match[2]),
      file: relativeFile,
      line: index + 1,
    });
  }

  return candidates;
}

function buildMigrationSchema() {
  const migrationFiles = walkFiles(migrationsDir).sort();
  const tables = {};
  const commentedDropCandidates = [];

  for (const migrationFile of migrationFiles) {
    const rawSql = readFile(migrationFile);
    const sql = stripSqlComments(rawSql);

    parseCreateTables(sql, migrationFile, tables);
    parseAlterTables(sql, migrationFile, tables);
    commentedDropCandidates.push(...extractCommentedDropCandidates(rawSql, migrationFile));
  }

  const normalizedTables = {};
  for (const [tableName, table] of Object.entries(tables)) {
    normalizedTables[tableName] = {
      name: table.name,
      columns: table.columns,
      migrationFiles: Array.from(table.migrationFiles).sort(),
    };
  }

  return {
    source: 'repo-migrations',
    tables: normalizedTables,
    migrationFiles: migrationFiles.map((filePath) => path.relative(repoRoot, filePath)),
    commentedDropCandidates,
  };
}

function cloneSchemaColumn(column = {}) {
  return {
    ...column,
    definedIn: [...(column.definedIn || [])],
    alteredIn: [...(column.alteredIn || [])],
    droppedIn: [...(column.droppedIn || [])],
  };
}

function cloneSchemaTable(table = {}) {
  return {
    ...table,
    columns: Object.fromEntries(
      Object.entries(table.columns || {}).map(([columnName, column]) => [columnName, cloneSchemaColumn(column)])
    ),
    migrationFiles: [...(table.migrationFiles || [])],
    snapshotFiles: [...(table.snapshotFiles || [])],
  };
}

function mergeRepoTables(baseTables = {}, overlayTables = {}) {
  const merged = {};

  for (const [tableName, table] of Object.entries(baseTables)) {
    merged[tableName] = cloneSchemaTable(table);
  }

  for (const [tableName, table] of Object.entries(overlayTables)) {
    if (!merged[tableName]) {
      merged[tableName] = cloneSchemaTable(table);
      continue;
    }

    const baseTable = cloneSchemaTable(merged[tableName]);
    const overlayTable = cloneSchemaTable(table);

    merged[tableName] = {
      ...baseTable,
      ...overlayTable,
      columns: { ...(baseTable.columns || {}) },
      migrationFiles: Array.from(new Set([
        ...(baseTable.migrationFiles || []),
        ...(overlayTable.migrationFiles || []),
      ])).sort(),
      snapshotFiles: Array.from(new Set([
        ...(baseTable.snapshotFiles || []),
        ...(overlayTable.snapshotFiles || []),
      ])).sort(),
    };

    for (const [columnName, column] of Object.entries(overlayTable.columns || {})) {
      const baseColumn = baseTable.columns?.[columnName] || {};
      merged[tableName].columns[columnName] = {
        ...baseColumn,
        ...column,
        definedIn: Array.from(new Set([
          ...(baseColumn.definedIn || []),
          ...(column.definedIn || []),
        ])).sort(),
        alteredIn: Array.from(new Set([
          ...(baseColumn.alteredIn || []),
          ...(column.alteredIn || []),
        ])).sort(),
        droppedIn: Array.from(new Set([
          ...(baseColumn.droppedIn || []),
          ...(column.droppedIn || []),
        ])).sort(),
      };
    }
  }

  return merged;
}

function loadSchemaSnapshot() {
  if (!fs.existsSync(schemaSnapshotPath)) {
    return {
      source: 'none',
      generatedAt: null,
      notes: [],
      tables: {},
      snapshotFiles: [],
    };
  }

  const relativeFile = path.relative(repoRoot, schemaSnapshotPath);
  const rawSnapshot = JSON.parse(readFile(schemaSnapshotPath));
  const tables = Object.fromEntries(
    Object.entries(rawSnapshot.tables || {}).map(([tableName, table]) => [
      tableName,
      {
        name: table.name || tableName,
        columns: table.columns || {},
        migrationFiles: [],
        snapshotFiles: [relativeFile],
      },
    ])
  );

  return {
    source: rawSnapshot.source || 'repo-schema-snapshot',
    generatedAt: rawSnapshot.generatedAt || null,
    notes: Array.isArray(rawSnapshot.notes) ? rawSnapshot.notes : [],
    tables,
    snapshotFiles: [relativeFile],
  };
}

function buildRepoSchema(schemaSnapshot, migrationSchema) {
  return {
    source: schemaSnapshot.snapshotFiles.length > 0
      ? 'repo-snapshot+migrations'
      : migrationSchema.source,
    tables: mergeRepoTables(schemaSnapshot.tables, migrationSchema.tables),
    migrationFiles: migrationSchema.migrationFiles,
    snapshotFiles: schemaSnapshot.snapshotFiles,
    snapshotGeneratedAt: schemaSnapshot.generatedAt,
    snapshotNotes: schemaSnapshot.notes,
    commentedDropCandidates: migrationSchema.commentedDropCandidates,
  };
}

function buildCandidateTableNames(migrationSchema, codebase) {
  return Array.from(new Set([
    ...Object.keys(migrationSchema.tables),
    ...codebase.tablesReferenced,
    ...KNOWN_TABLE_LIKE_TOKENS,
  ])).sort();
}

function inferValueType(value) {
  if (value === null || value === undefined) {
    return 'unknown';
  }

  if (Array.isArray(value)) {
    return 'array';
  }

  if (value instanceof Date) {
    return 'timestamp';
  }

  switch (typeof value) {
    case 'string':
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return 'date';
      }
      if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
        return 'timestamp';
      }
      if (/^(true|false)$/i.test(value)) {
        return 'boolean-string';
      }
      if (/^-?\d+\.\d+$/.test(value)) {
        return 'numeric-string';
      }
      if (/^-?\d+$/.test(value)) {
        return 'integer-string';
      }
      return 'text';
    case 'number':
      return Number.isInteger(value) ? 'integer' : 'numeric';
    case 'boolean':
      return 'boolean';
    case 'object':
      return 'json';
    default:
      return typeof value;
  }
}

function mergeLiveTables(baseTables, additionalTables) {
  const merged = {};

  for (const [tableName, table] of Object.entries(baseTables || {})) {
    merged[tableName] = {
      ...table,
      columns: { ...(table.columns || {}) },
    };
  }

  for (const [tableName, table] of Object.entries(additionalTables || {})) {
    if (!merged[tableName]) {
      merged[tableName] = {
        ...table,
        columns: { ...(table.columns || {}) },
      };
      continue;
    }

    merged[tableName] = {
      ...merged[tableName],
      ...table,
      columns: {
        ...(merged[tableName].columns || {}),
        ...(table.columns || {}),
      },
    };
  }

  return merged;
}

function normalizeOpenApiPropertyType(property = {}) {
  if (property.type) {
    return property.format ? `${property.type}:${property.format}` : property.type;
  }

  if (property.enum) {
    return `enum(${property.enum.join(', ')})`;
  }

  if (property.anyOf || property.oneOf) {
    const variants = property.anyOf || property.oneOf;
    return variants
      .map((item) => normalizeOpenApiPropertyType(item))
      .filter(Boolean)
      .join(' | ') || 'unknown';
  }

  if (property.$ref) {
    return `ref:${property.$ref.split('/').pop()}`;
  }

  if (property.items) {
    return `array<${normalizeOpenApiPropertyType(property.items)}>`;
  }

  return 'unknown';
}

function resolveOpenApiSchema(schema, schemaMap) {
  if (!schema) {
    return null;
  }

  if (schema.$ref) {
    return schemaMap[schema.$ref.split('/').pop()] || null;
  }

  if (schema.type === 'array' && schema.items) {
    return resolveOpenApiSchema(schema.items, schemaMap);
  }

  if (schema.anyOf || schema.oneOf) {
    const variants = schema.anyOf || schema.oneOf;
    for (const variant of variants) {
      const resolved = resolveOpenApiSchema(variant, schemaMap);
      if (resolved) {
        return resolved;
      }
    }
  }

  return schema;
}

function buildTableFromOpenApiSchema(tableName, schema) {
  const properties = schema?.properties || {};
  const propertyNames = Object.keys(properties);

  if (propertyNames.length === 0) {
    return null;
  }

  return {
    name: tableName,
    columns: Object.fromEntries(propertyNames.map((columnName) => [
      columnName,
      {
        name: columnName,
        type: normalizeOpenApiPropertyType(properties[columnName]),
        references: null,
        observedVia: 'postgrest-openapi',
      },
    ])),
    observedVia: 'postgrest-openapi',
  };
}

function extractPathTableNames(openApiDocument) {
  return Object.keys(openApiDocument?.paths || {})
    .map((pathName) => pathName.match(/^\/([a-z][a-z0-9_]*)$/i)?.[1] || null)
    .filter(Boolean);
}

function extractTablesFromOpenApi(openApiDocument, candidateTables) {
  const schemaMap = {
    ...(openApiDocument?.definitions || {}),
    ...(openApiDocument?.components?.schemas || {}),
  };

  const tables = {};
  const pathTables = new Set(extractPathTableNames(openApiDocument));
  const namesToCheck = Array.from(new Set([
    ...candidateTables,
    ...Object.keys(schemaMap),
    ...pathTables,
  ]));

  for (const tableName of namesToCheck) {
    let resolvedSchema = resolveOpenApiSchema(schemaMap[tableName], schemaMap);

    if (!resolvedSchema && pathTables.has(tableName)) {
      const pathEntry = openApiDocument.paths?.[`/${tableName}`];
      const getResponseSchema = pathEntry?.get?.responses?.['200']?.schema
        || pathEntry?.get?.responses?.default?.schema
        || pathEntry?.get?.responses?.['200']?.content?.['application/json']?.schema
        || pathEntry?.get?.responses?.default?.content?.['application/json']?.schema;
      resolvedSchema = resolveOpenApiSchema(getResponseSchema, schemaMap);
    }

    const table = buildTableFromOpenApiSchema(tableName, resolvedSchema);
    if (table) {
      tables[tableName] = table;
    }
  }

  return tables;
}

async function fetchPostgrestOpenApi() {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getPreferredSupabaseKey();

  if (!supabaseUrl || !supabaseKey) {
    return {
      ok: false,
      reason: 'SUPABASE_URL or Supabase API key is not configured.',
      document: null,
    };
  }

  const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/rest/v1/`, {
    method: 'GET',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Accept: 'application/openapi+json, application/json',
    },
  });

  if (!response.ok) {
    const responseText = await response.text();
    return {
      ok: false,
      reason: `PostgREST OpenAPI request failed with ${response.status}: ${responseText.slice(0, 200)}`,
      document: null,
    };
  }

  return {
    ok: true,
    reason: null,
    document: await response.json(),
  };
}

async function probeTablesViaSupabase(migrationSchema, codebase) {
  let supabase;

  try {
    supabase = createBackendSupabaseClient();
  } catch (error) {
    return {
      ok: false,
      reason: error.message,
      tables: {},
      summary: {
        candidates: 0,
        accessible: 0,
        inaccessible: 0,
        sampled: 0,
        emptyAccessible: 0,
      },
      tableErrors: {},
    };
  }

  const candidateTables = buildCandidateTableNames(migrationSchema, codebase);
  const tables = {};
  const tableErrors = {};
  let accessibleCount = 0;
  let sampledCount = 0;
  let emptyAccessibleCount = 0;

  for (const tableName of candidateTables) {
    const headResult = await supabase
      .from(tableName)
      .select('*', { head: true, count: 'exact' });

    if (headResult.error) {
      tableErrors[tableName] = {
        code: headResult.error.code || null,
        message: headResult.error.message,
      };
      continue;
    }

    accessibleCount += 1;

    const sampleResult = await supabase
      .from(tableName)
      .select('*')
      .limit(1);

    if (sampleResult.error) {
      tableErrors[tableName] = {
        code: sampleResult.error.code || null,
        message: sampleResult.error.message,
      };
      continue;
    }

    const sampleRow = Array.isArray(sampleResult.data) ? sampleResult.data[0] : null;
    if (!sampleRow) {
      emptyAccessibleCount += 1;
      tables[tableName] = {
        name: tableName,
        columns: {},
        observedVia: 'supabase-head-only',
        rowCount: typeof headResult.count === 'number' ? headResult.count : null,
      };
      continue;
    }

    sampledCount += 1;
    tables[tableName] = {
      name: tableName,
      columns: Object.fromEntries(Object.keys(sampleRow).map((columnName) => [
        columnName,
        {
          name: columnName,
          type: inferValueType(sampleRow[columnName]),
          references: null,
          observedVia: 'supabase-sample-row',
        },
      ])),
      observedVia: 'supabase-sample-row',
      rowCount: typeof headResult.count === 'number' ? headResult.count : null,
    };
  }

  return {
    ok: true,
    reason: null,
    tables,
    summary: {
      candidates: candidateTables.length,
      accessible: accessibleCount,
      inaccessible: candidateTables.length - accessibleCount,
      sampled: sampledCount,
      emptyAccessible: emptyAccessibleCount,
    },
    tableErrors,
  };
}

async function tryLoadLiveSchemaViaDirectDb() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;
  const hasPgVars = Boolean(process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE);

  if (!databaseUrl && !hasPgVars) {
    return {
      mode: 'skipped',
      reason: 'No DATABASE_URL or PG* variables found in backend/.env.',
      tables: {},
      connection: 'direct-postgres',
      useAsPrimarySource: false,
    };
  }

  let pgModule;
  try {
    pgModule = require('pg');
  } catch (error) {
    return {
      mode: 'skipped',
      reason: 'Direct DB credentials are present, but the "pg" package is not installed.',
      tables: {},
      connection: 'direct-postgres',
      useAsPrimarySource: false,
    };
  }

  const { Client } = pgModule;
  const client = new Client(
    databaseUrl
      ? { connectionString: databaseUrl }
      : {
          host: process.env.PGHOST,
          port: process.env.PGPORT || 5432,
          user: process.env.PGUSER,
          password: process.env.PGPASSWORD,
          database: process.env.PGDATABASE,
          ssl: { rejectUnauthorized: false },
        }
  );

  try {
    await client.connect();

    const columnsResult = await client.query(`
      SELECT
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);

    const constraintsResult = await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        tc.constraint_type,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema = ccu.table_schema
      WHERE tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name
    `);

    const tables = {};
    for (const row of columnsResult.rows) {
      if (!tables[row.table_name]) {
        tables[row.table_name] = {
          name: row.table_name,
          columns: {},
        };
      }

      tables[row.table_name].columns[row.column_name] = {
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === 'YES',
        default: row.column_default,
        references: null,
      };
    }

    for (const row of constraintsResult.rows) {
      if (!row.column_name || !tables[row.table_name] || !tables[row.table_name].columns[row.column_name]) {
        continue;
      }

      if (row.constraint_type === 'FOREIGN KEY' && row.foreign_table_name && row.foreign_column_name) {
        tables[row.table_name].columns[row.column_name].references = {
          table: row.foreign_table_name,
          column: row.foreign_column_name,
        };
      }
    }

    return {
      mode: 'loaded',
      reason: null,
      tables,
      connection: 'direct-postgres',
      useAsPrimarySource: true,
    };
  } catch (error) {
    return {
      mode: 'failed',
      reason: error.message,
      tables: {},
      connection: 'direct-postgres',
      useAsPrimarySource: false,
    };
  } finally {
    try {
      await client.end();
    } catch (error) {
      // Ignore close errors.
    }
  }
}

async function tryLoadLiveSchema(migrationSchema, codebase) {
  const liveSchemaFromSupabase = {
    mode: 'skipped',
    reason: null,
    tables: {},
    connection: 'supabase-js',
    useAsPrimarySource: false,
    summary: {
      candidates: 0,
      accessible: 0,
      inaccessible: 0,
      sampled: 0,
      emptyAccessible: 0,
      openApiTables: 0,
    },
    tableErrors: {},
  };

  try {
    const openApiResult = await fetchPostgrestOpenApi();
    const probeResult = await probeTablesViaSupabase(migrationSchema, codebase);

    const openApiTables = openApiResult.ok
      ? extractTablesFromOpenApi(openApiResult.document, buildCandidateTableNames(migrationSchema, codebase))
      : {};
    const mergedTables = mergeLiveTables(openApiTables, probeResult.tables);
    const schemaCoverageIsStrong = (
      Object.keys(openApiTables).length > 0 ||
      (probeResult.ok
        && probeResult.summary.candidates > 0
        && probeResult.summary.accessible === probeResult.summary.candidates)
    );

    if (openApiResult.ok || probeResult.ok) {
      return {
        mode: Object.keys(mergedTables).length > 0 ? 'loaded' : 'partial',
        reason: [
          'Live inspection used the same Supabase URL/API-key connection path as the backend application.',
          openApiResult.ok
            ? `PostgREST OpenAPI exposed ${Object.keys(openApiTables).length} table schema(s).`
            : `PostgREST OpenAPI unavailable: ${openApiResult.reason}`,
          probeResult.ok
            ? `Table probes accessible: ${probeResult.summary.accessible}/${probeResult.summary.candidates}; sampled rows: ${probeResult.summary.sampled}.`
            : `Table probes failed: ${probeResult.reason}`,
        ].join(' '),
        tables: mergedTables,
        connection: 'supabase-js',
        useAsPrimarySource: schemaCoverageIsStrong,
        summary: {
          ...(probeResult.summary || liveSchemaFromSupabase.summary),
          openApiTables: Object.keys(openApiTables).length,
        },
        tableErrors: probeResult.tableErrors || {},
      };
    }

    liveSchemaFromSupabase.reason = [
      openApiResult.reason,
      probeResult.reason,
    ].filter(Boolean).join(' ');
  } catch (error) {
    liveSchemaFromSupabase.mode = 'failed';
    liveSchemaFromSupabase.reason = error.message;
  }

  const directDbResult = await tryLoadLiveSchemaViaDirectDb();
  if (directDbResult.mode === 'loaded') {
    return directDbResult;
  }

  return {
    ...liveSchemaFromSupabase,
    mode: directDbResult.mode === 'loaded' ? directDbResult.mode : (liveSchemaFromSupabase.mode === 'failed' ? 'failed' : 'skipped'),
    reason: [liveSchemaFromSupabase.reason, directDbResult.reason].filter(Boolean).join(' ').trim() || null,
  };
}

function extractSnakeCaseTokens(content) {
  const tokens = new Map();
  const patterns = [
    /\.([a-z][a-z0-9_]*_[a-z0-9_]+)\b/g,
    /\b([a-z][a-z0-9_]*_[a-z0-9_]+)\s*:/g,
    /['"`]([a-z][a-z0-9_]*_[a-z0-9_]+)['"`]/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const token = match[1];
      if (!tokens.has(token)) {
        tokens.set(token, 0);
      }
      tokens.set(token, tokens.get(token) + 1);
    }
  }

  return tokens;
}

function extractSupabaseReferences(content) {
  const tables = new Set();
  const columns = new Map();
  const rpcs = new Set();

  const fromRegex = /\.from\((['"`])([a-z][a-z0-9_]*)\1\)/g;
  let fromMatch;
  while ((fromMatch = fromRegex.exec(content)) !== null) {
    tables.add(fromMatch[2]);
  }

  const rpcRegex = /\.rpc\((['"`])([a-z][a-z0-9_]*)\1/g;
  let rpcMatch;
  while ((rpcMatch = rpcRegex.exec(content)) !== null) {
    rpcs.add(rpcMatch[2]);
  }

  const selectRegex = /\.select\((['"`])([\s\S]*?)\1/g;
  let selectMatch;
  while ((selectMatch = selectRegex.exec(content)) !== null) {
    const selectText = selectMatch[2];
    const columnRegex = /\b([a-z][a-z0-9_]+)\b/g;
    let columnMatch;
    while ((columnMatch = columnRegex.exec(selectText)) !== null) {
      const column = columnMatch[1];
      if (!columns.has(column)) {
        columns.set(column, 0);
      }
      columns.set(column, columns.get(column) + 1);
    }
  }

  const singleColumnRegex = /\.(?:eq|neq|gt|gte|lt|lte|like|ilike|order)\((['"`])([a-z][a-z0-9_]*)\1/g;
  let singleMatch;
  while ((singleMatch = singleColumnRegex.exec(content)) !== null) {
    const column = singleMatch[2];
    if (!columns.has(column)) {
      columns.set(column, 0);
    }
    columns.set(column, columns.get(column) + 1);
  }

  return { tables, columns, rpcs };
}

function scanCodebase() {
  const files = SCAN_ROOTS
    .flatMap((scanRoot) => walkFiles(scanRoot))
    .filter((filePath) => !filePath.includes(`${path.sep}node_modules${path.sep}`))
    .sort();

  const tablesReferenced = new Set();
  const columnsReferenced = new Map();
  const genericTokens = new Map();
  const rpcsReferenced = new Set();
  const filesPerToken = {};

  for (const filePath of files) {
    const relativeFile = path.relative(repoRoot, filePath);
    const content = readFile(filePath);
    const supabaseRefs = extractSupabaseReferences(content);
    const snakeCaseTokens = extractSnakeCaseTokens(content);

    for (const table of supabaseRefs.tables) {
      tablesReferenced.add(table);
      if (!filesPerToken[table]) {
        filesPerToken[table] = new Set();
      }
      filesPerToken[table].add(relativeFile);
    }

    for (const [column, count] of supabaseRefs.columns.entries()) {
      if (!columnsReferenced.has(column)) {
        columnsReferenced.set(column, 0);
      }
      columnsReferenced.set(column, columnsReferenced.get(column) + count);
      if (!filesPerToken[column]) {
        filesPerToken[column] = new Set();
      }
      filesPerToken[column].add(relativeFile);
    }

    for (const [token, count] of snakeCaseTokens.entries()) {
      if (!genericTokens.has(token)) {
        genericTokens.set(token, 0);
      }
      genericTokens.set(token, genericTokens.get(token) + count);
      if (!filesPerToken[token]) {
        filesPerToken[token] = new Set();
      }
      filesPerToken[token].add(relativeFile);
    }

    for (const rpc of supabaseRefs.rpcs) {
      rpcsReferenced.add(rpc);
      if (!filesPerToken[rpc]) {
        filesPerToken[rpc] = new Set();
      }
      filesPerToken[rpc].add(relativeFile);
    }
  }

  const fileIndex = {};
  for (const [token, fileSet] of Object.entries(filesPerToken)) {
    fileIndex[token] = Array.from(fileSet).sort();
  }

  return {
    filesScanned: files.map((filePath) => path.relative(repoRoot, filePath)),
    tablesReferenced: Array.from(tablesReferenced).sort(),
    columnsReferenced: Object.fromEntries(Array.from(columnsReferenced.entries()).sort((left, right) => left[0].localeCompare(right[0]))),
    genericTokens: Object.fromEntries(Array.from(genericTokens.entries()).sort((left, right) => left[0].localeCompare(right[0]))),
    rpcsReferenced: Array.from(rpcsReferenced).sort(),
    fileIndex,
  };
}

function getSchemaColumnIndex(schemaTables) {
  const tableToColumns = {};
  const globalColumns = new Set();

  for (const [tableName, table] of Object.entries(schemaTables)) {
    tableToColumns[tableName] = Object.keys(table.columns).sort();
    for (const columnName of Object.keys(table.columns)) {
      globalColumns.add(columnName);
    }
  }

  return {
    tableToColumns,
    globalColumns,
  };
}

function toCountMapEntries(inputObject) {
  return Object.entries(inputObject || {}).map(([name, count]) => ({ name, count }));
}

function detectHeuristics() {
  const findings = [];
  const serverPath = path.join(backendRoot, 'server.js');
  const serverContent = readFile(serverPath);
  const addProductModalPath = path.join(repoRoot, 'frontend', 'src', 'pages', 'admin', 'components', 'AddProductModal.jsx');
  const addProductModalContent = readFile(addProductModalPath);
  const productManagementPath = path.join(repoRoot, 'frontend', 'src', 'pages', 'admin', 'ProductManagement.jsx');
  const productManagementContent = readFile(productManagementPath);
  const rolesPath = path.join(repoRoot, 'frontend', 'src', 'enums', 'roles.js');
  const rolesContent = readFile(rolesPath);
  const itemManagerPath = path.join(repoRoot, 'frontend', 'src', 'pages', 'admin', 'components', 'ItemManager.jsx');
  const itemManagerContent = readFile(itemManagerPath);

  if (
    serverContent.includes(".from('product_variants')") &&
    serverContent.includes(".delete()") &&
    serverContent.includes(".eq('product_id', id)") &&
    !serverContent.includes('buildVariantMutationPlan') &&
    addProductModalContent.includes('variant_id') &&
    serverContent.includes(".from('wholesale_prices')") &&
    serverContent.includes('variant_id: wp.variant_id || null')
  ) {
    findings.push({
      id: 'variant_wholesale_tier_remap',
      severity: 'high',
      title: 'Variant-scoped wholesale tiers can be deleted during variant save',
      details: 'The current product variant save flow deletes all variants for a product and reinserts them. Because wholesale tiers now support variant_id, any tiers linked to old variant IDs can be cascaded away or become stale unless they are remapped after variant recreation.',
      files: [
        path.relative(repoRoot, serverPath),
        path.relative(repoRoot, addProductModalPath),
      ],
    });
  }

  if (
    addProductModalContent.includes("value=\"amount\"") &&
    serverContent.includes("discount_type: 'percentage'")
  ) {
    findings.push({
      id: 'discount_type_ui_backend_mismatch',
      severity: 'high',
      title: 'Product discount UI still offers fixed amount, but backend normalizes to percentage',
      details: 'Admins can still select an amount-based discount in the product modal, but the current backend product save flow writes discount_type as percentage. That can silently reinterpret a fixed amount as a percentage.',
      files: [
        path.relative(repoRoot, addProductModalPath),
        path.relative(repoRoot, serverPath),
      ],
    });
  }

  if (productManagementContent.includes('VIEW_PRODUCTS') && !rolesContent.includes("CUSTOMERS: {")) {
    findings.push({
      id: 'customers_tab_removed_from_navigation',
      severity: 'medium',
      title: 'Customer route still exists, but the admin navigation entry was removed',
      details: 'The customer management route still exists in the app, but the shared ADMIN_TABS configuration no longer exposes the Customers tab. If this was unintended, the feature became URL-only.',
      files: [
        path.relative(repoRoot, productManagementPath),
        path.relative(repoRoot, rolesPath),
        path.relative(repoRoot, path.join(repoRoot, 'frontend', 'src', 'App.jsx')),
      ],
    });
  }

  if (
    itemManagerContent.includes('selling_price') &&
    !itemManagerContent.includes('product?.price ?? product?.selling_price')
  ) {
    findings.push({
      id: 'legacy_product_price_field_in_item_manager',
      severity: 'medium',
      title: 'ItemManager still expects product.selling_price',
      details: 'The product APIs and current pricing code use price, not selling_price. Any admin flow that passes products directly into ItemManager can render zero or blank unit prices unless the server or caller maps price to selling_price.',
      files: [
        path.relative(repoRoot, itemManagerPath),
        path.relative(repoRoot, path.join(backendRoot, 'routes', 'expenseRoutes.js')),
      ],
    });
  }

  return findings;
}

function analyzeSchema(repoSchema, migrationSchema, liveSchema, codebase) {
  const schemaSourceTables = liveSchema.useAsPrimarySource
    ? liveSchema.tables
    : repoSchema.tables;

  const { tableToColumns, globalColumns } = getSchemaColumnIndex(schemaSourceTables);
  const codeColumns = new Map(toCountMapEntries(codebase.columnsReferenced).map(({ name, count }) => [name, count]));
  const genericTokens = new Map(toCountMapEntries(codebase.genericTokens).map(({ name, count }) => [name, count]));

  const tablesMissingFromRepoSnapshot = codebase.tablesReferenced
    .filter((table) => !repoSchema.tables[table] && !KNOWN_TABLE_LIKE_TOKENS.has(table))
    .sort();

  const tablesReferencedButNotDefinedInRepoSchema = codebase.tablesReferenced
    .filter((table) => !repoSchema.tables[table] && KNOWN_TABLE_LIKE_TOKENS.has(table))
    .sort();

  const tablesReferencedButNotDefinedInMigrations = codebase.tablesReferenced
    .filter((table) => !migrationSchema.tables[table] && KNOWN_TABLE_LIKE_TOKENS.has(table))
    .sort();

  const repoSnapshotColumnsWithoutUsage = [];
  for (const [tableName, columns] of Object.entries(tableToColumns)) {
    for (const columnName of columns) {
      if (COLUMN_IGNORE_LIST.has(columnName)) {
        continue;
      }

      const codeCount = codeColumns.get(columnName) || genericTokens.get(columnName) || 0;
      if (codeCount === 0) {
        repoSnapshotColumnsWithoutUsage.push({
          table: tableName,
          column: columnName,
          type: schemaSourceTables[tableName].columns[columnName].type || null,
        });
      }
    }
  }

  const codeColumnsMissingFromKnownSchema = Array.from(genericTokens.entries())
    .filter(([token]) => token.includes('_'))
    .filter(([token]) => !KNOWN_TABLE_LIKE_TOKENS.has(token))
    .filter(([token]) => !globalColumns.has(token))
    .filter(([token]) => !GLOBAL_TOKEN_IGNORE_LIST.has(token))
    .map(([token, count]) => ({
      column: token,
      count,
      files: codebase.fileIndex[token] || [],
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.column.localeCompare(right.column);
    });

  const legacyDropCandidates = migrationSchema.commentedDropCandidates
    .map((item) => ({
      ...item,
      referencedInCode: Boolean(codebase.fileIndex[item.column]?.length),
      files: codebase.fileIndex[item.column] || [],
    }))
    .sort((left, right) => left.table.localeCompare(right.table) || left.column.localeCompare(right.column));

  return {
    schemaMode: liveSchema.mode === 'loaded' ? 'live+repo-migrations' : 'repo-migrations-only',
    tablesReferencedButNotDefinedInRepoSchema,
    tablesReferencedButNotDefinedInMigrations,
    tablesMissingFromRepoSnapshot,
    repoSnapshotColumnsWithoutUsage,
    codeColumnsMissingFromKnownSchema,
    legacyDropCandidates,
    heuristics: detectHeuristics(),
  };
}

function buildEnvSummary(liveSchema) {
  return {
    envFile: path.relative(repoRoot, envPath),
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
    hasSupabaseAnonKey: Boolean(process.env.SUPABASE_ANON_KEY),
    hasSupabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL),
    hasPgVariables: Boolean(process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE),
    liveSchemaConnection: liveSchema.connection || 'none',
    liveSchemaMode: liveSchema.mode,
    liveSchemaReason: liveSchema.reason,
  };
}

function formatList(items, formatter = (item) => item) {
  if (!items || items.length === 0) {
    return ['None'];
  }

  return items.map((item) => formatter(item));
}

function renderMarkdownReport(report) {
  const lines = [];

  lines.push('# Schema Analysis Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push('## Environment');
  lines.push('');
  lines.push(`- Env file: \`${report.env.envFile}\``);
  lines.push(`- Live schema mode: \`${report.env.liveSchemaMode}\``);
  if (report.env.liveSchemaReason) {
    lines.push(`- Live schema note: ${report.env.liveSchemaReason}`);
  }
  lines.push(`- Supabase URL present: ${report.env.hasSupabaseUrl}`);
  lines.push(`- Supabase anon key present: ${report.env.hasSupabaseAnonKey}`);
  lines.push(`- Supabase service role key present: ${report.env.hasSupabaseServiceRoleKey}`);
  lines.push(`- Direct database URL present: ${report.env.hasDatabaseUrl}`);
  lines.push(`- PG* variables present: ${report.env.hasPgVariables}`);
  lines.push(`- Live schema connection path: \`${report.env.liveSchemaConnection}\``);
  lines.push('');

  lines.push('## Coverage');
  lines.push('');
  lines.push(`- Schema snapshot files parsed: ${report.schemaSnapshot.snapshotFiles.length}`);
  lines.push(`- Migration files parsed: ${report.migrationSchema.migrationFiles.length}`);
  lines.push(`- Repo schema tables detected: ${Object.keys(report.repoSchema.tables).length}`);
  lines.push(`- Code files scanned: ${report.codebase.filesScanned.length}`);
  lines.push(`- Supabase tables referenced in code: ${report.codebase.tablesReferenced.length}`);
  lines.push(`- RPC functions referenced in code: ${report.codebase.rpcsReferenced.length}`);
  if (report.liveSchema?.summary) {
    lines.push(`- Live table candidates probed: ${report.liveSchema.summary.candidates}`);
    lines.push(`- Live accessible tables: ${report.liveSchema.summary.accessible}`);
    lines.push(`- Live sampled tables: ${report.liveSchema.summary.sampled}`);
    lines.push(`- Live empty but accessible tables: ${report.liveSchema.summary.emptyAccessible}`);
    lines.push(`- Live OpenAPI tables: ${report.liveSchema.summary.openApiTables || 0}`);
  }
  lines.push('');

  lines.push('## High-Signal Findings');
  lines.push('');
  for (const item of formatList(report.analysis.heuristics, (heuristic) => (
    `- [${heuristic.severity.toUpperCase()}] ${heuristic.title}: ${heuristic.details} (${heuristic.files.map((file) => `\`${file}\``).join(', ')})`
  ))) {
    lines.push(item);
  }
  lines.push('');

  lines.push('## Repo Schema Gaps');
  lines.push('');
  lines.push('### Tables Referenced In Code But Not Defined In Repo Schema');
  lines.push('');
  for (const item of formatList(report.analysis.tablesReferencedButNotDefinedInRepoSchema, (table) => `- \`${table}\``)) {
    lines.push(item);
  }
  lines.push('');

  lines.push('### Tables Still Missing From Repo Migrations');
  lines.push('');
  for (const item of formatList(report.analysis.tablesReferencedButNotDefinedInMigrations, (table) => `- \`${table}\``)) {
    lines.push(item);
  }
  lines.push('');

  lines.push('### Code Columns Missing From Known Schema Snapshot');
  lines.push('');
  for (const item of formatList(report.analysis.codeColumnsMissingFromKnownSchema.slice(0, 30), (column) => (
    `- \`${column.column}\` (${column.count} references): ${column.files.slice(0, 4).map((file) => `\`${file}\``).join(', ')}`
  ))) {
    lines.push(item);
  }
  if (report.analysis.codeColumnsMissingFromKnownSchema.length > 30) {
    lines.push(`- ... ${report.analysis.codeColumnsMissingFromKnownSchema.length - 30} more`);
  }
  lines.push('');

  lines.push('## Cleanup Candidates');
  lines.push('');
  lines.push('### Commented Drop Candidates Already Present In Migrations');
  lines.push('');
  for (const item of formatList(report.analysis.legacyDropCandidates, (candidate) => (
    `- \`${candidate.table}.${candidate.column}\` from \`${candidate.file}:${candidate.line}\``
      + (candidate.referencedInCode ? ` is still referenced in code (${candidate.files.slice(0, 3).map((file) => `\`${file}\``).join(', ')})` : ' is not referenced in scanned code')
  ))) {
    lines.push(item);
  }
  lines.push('');

  lines.push('### Columns In The Known Schema Snapshot With No Direct Code Usage');
  lines.push('');
  for (const item of formatList(report.analysis.repoSnapshotColumnsWithoutUsage.slice(0, 40), (column) => (
    `- \`${column.table}.${column.column}\`${column.type ? ` (${column.type})` : ''}`
  ))) {
    lines.push(item);
  }
  if (report.analysis.repoSnapshotColumnsWithoutUsage.length > 40) {
    lines.push(`- ... ${report.analysis.repoSnapshotColumnsWithoutUsage.length - 40} more`);
  }
  lines.push('');

  lines.push('## Suggested Next Steps');
  lines.push('');
  lines.push('- Keep using the shared Supabase client path for app-level validation; add a direct Postgres connection string only if you need authoritative full-schema introspection.');
  lines.push('- Resolve high-severity code/data consistency issues before dropping or renaming any columns.');
  lines.push('- Version the missing base schema tables in migrations or a schema snapshot so schema drift can be audited accurately.');
  lines.push('- Re-run this analyzer after every cleanup migration and before removing any legacy columns.');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

async function main() {
  ensureDir(reportDir);

  const schemaSnapshot = loadSchemaSnapshot();
  const migrationSchema = buildMigrationSchema();
  const repoSchema = buildRepoSchema(schemaSnapshot, migrationSchema);
  const codebase = scanCodebase();
  const liveSchema = await tryLoadLiveSchema(migrationSchema, codebase);
  const analysis = analyzeSchema(repoSchema, migrationSchema, liveSchema, codebase);

  const report = {
    generatedAt: new Date().toISOString(),
    env: buildEnvSummary(liveSchema),
    schemaSnapshot,
    repoSchema,
    migrationSchema,
    liveSchema,
    codebase,
    analysis,
  };

  fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(markdownReportPath, renderMarkdownReport(report));

  console.log(`Schema analysis written to ${path.relative(repoRoot, jsonReportPath)}`);
  console.log(`Markdown report written to ${path.relative(repoRoot, markdownReportPath)}`);

  if (liveSchema.mode !== 'loaded') {
    console.log(`Live schema inspection skipped: ${liveSchema.reason}`);
  }
}

main().catch((error) => {
  console.error('Schema analysis failed:', error);
  process.exitCode = 1;
});
