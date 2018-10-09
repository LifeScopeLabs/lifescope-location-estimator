babel lib -d dist/api/lib --presets env,stage-2
babel index.js -d dist/api --presets env,stage-2
babel server.js -d dist/api --presets env,stage-2
cp .babelrc dist/api