const variableName = process.argv[2];

if (!variableName) {
  console.error("Usage: node scripts/require-env.mjs VARIABLE_NAME");
  process.exit(2);
}

if (!process.env[variableName]) {
  console.error(`${variableName} is required.`);
  process.exit(1);
}
