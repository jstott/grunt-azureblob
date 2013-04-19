'use strict';
var grunt = require('grunt');
var azure = require('azure');
var blobService = azure.createBlobService();

module.exports['azure-storage'] = {
  upload: function(test) {
    var file = grunt.file.read(__dirname+'/fixtures/file.js');

    blobService.getBlobToText('test', 'file.js', function(err, data, metadata) {
      test.expect(1);
      test.equal(file, data, 'should return the fixture file');
      test.done();
    });
  },
};
