'use strict';

module.exports = function (grunt) {
  grunt.initConfig({
    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      all: [
        'Gruntfile.js',
        'tasks/*.js',
        'test/*.js'
      ]
    },

    nodeunit: {
      tests: ['test/*_test.js']
    },

    'azureblob': {
      options: {
        containerName: 'test'
      },
      files: 'test/fixtures/file.js'
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-nodeunit');
  grunt.loadTasks(__dirname+'/tasks');

  // Default task.
  grunt.registerTask('default', ['jshint']);
  grunt.registerTask('test', ['azureblob', 'nodeunit']);
};
