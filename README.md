# grunt-azureblob

Grunt task for copying html assets to azure blob/cdn storage.

Azure SDK uses by default the environment variables AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCESS_KEY.
Custom connection arguments can be set in service.

## Options and default values
```javascript
{
  serviceOptions: [], // custom arguments to azure.createBlobService
  containerName: null, // container name, required
  containerDelete: false, // deletes container if it exists
  containerOptions: {publicAccessLevel: "blob"}, // container options
  fileNamePrefix: '', // prefix to use for blob name e.g. '0.0.1'
  metadata: {}, // file metadata properties
  gzip: false // gzip files
};
```

## Gruntfile example
```javascript
grunt.initConfig({
  'azureblob': {
    options: {
      // default values to use at each target level
      containerName: null, // default container name, required at target level
      containerDelete: false, // deletes container if it exists
      fileNamePrefix: '',
      metadata: {}, // file metadata properties,
      gzip: false // gzip files
    },
    assets: options: {
      containerName: 'assets',
      fileNamePrefix: '',
      gzip: true
    },
    source: 'assets/**/*'
  }
});
```
