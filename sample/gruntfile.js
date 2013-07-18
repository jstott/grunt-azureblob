module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('web/mySampleProject.json'),
    env : {
      options : {
       //Shared Options Hash
      },
      configCDN : {
        AZURE_STORAGE_ACCOUNT : 'azure storage account name to use',
        AZURE_STORAGE_ACCESS_KEY : 'your-ssh-access-key-string would go here'
      }
    },
    'azureblob': {
      options: { // global options applied to each task 
        containerName: 'assets',
        containerDelete: false, //do not apply true here, container would be deleted at each task
        metadata: {cacheControl: 'public, max-age=31556926'}, // max-age 1 year for all entries
        gzip: true,
        copySimulation: true  // set true: only dry-run what copy would look like
      },
      css: {
          files: [{
            expand: true,
            cwd: 'web/Content/',
            dest: '<%= pkg.version %>/css/',
            src: ['**/*', '!themes/**/*']
          }]
      },
      js: {
        files: [{
          expand: true,
          cwd: 'web/scripts',
          dest: '<%= pkg.version %>/js/',
          src: ['*.js']
        }]
      }
    }
  });

  // Load the plugin that provides all the pirate magic
  grunt.loadNpmTasks('grunt-env'); // https://npmjs.org/package/grunt-env
  grunt.loadNpmTasks('grunt-azureblob');

  // Default task(s).
  grunt.registerTask('default', ['env:configCDN', 'azureblob']); 
  
  grunt.event.on('qunit.spawn', function (url) {
    grunt.log.ok("Running test: " + url);
  });
  grunt.event.on('qunit.moduleStart', function (name) {
    grunt.log.ok("Starting module: " + name);
  });
};