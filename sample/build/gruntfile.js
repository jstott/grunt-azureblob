module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('../web/mySampleProject.json'),
    env : {
      options : {
       //Shared Options Hash
      },
      configCDN : {
        AZURE_STORAGE_ACCOUNT :'dev7',//'azure storage account name to use',
        AZURE_STORAGE_ACCESS_KEY : 'hwLOdMA5upHRsWMQbcpuShksdAAgXxufCdmZRNer5bVZyJryXjyy+sx1YiZUf1djgdObHy9olJUcnq4iu4WTMg==',//'your-ssh-access-key-string would go here'
      }
    },
    'azureblob': {
      options: {
        containerName: 'assets',
        containerDelete: false,
        metadata: {cacheControl: 'public, max-age=31556926'}, // max-age 1 year for all entries
        gzip: false,
        copySimulation: true,  // set true: only dry-run what copy would look like
        destPrefix: '<%= pkg.version %>/'
      },
      css :{
        options: {
          maskBaseDir: '../web/content/'  // strip off this prefix from files
        },
        src: ['../web/content/**/*'] // copy all files from Content (exclude theams dir)
      },
      js :{
        options: {
          containerDelete: false,
          maskBaseDir: '../web/scripts/'
        },
        src: ['../web/scripts/*.js']
      }
    }
  });

  // Load the plugin that provides all the pirate magic
  grunt.loadNpmTasks('grunt-env'); // https://npmjs.org/package/grunt-env
  grunt.loadNpmTasks('grunt-azureblob');
  // Default task(s).
  grunt.registerTask('blob', ['env:configCDN', 'azureblob']); 
  
  grunt.event.on('qunit.spawn', function (url) {
    grunt.log.ok("Running test: " + url);
  });
  grunt.event.on('qunit.moduleStart', function (name) {
    grunt.log.ok("Starting module: " + name);
  });
};