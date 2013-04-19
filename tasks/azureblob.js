'use strict';

module.exports = function(grunt) {
  var azure = require('azure'),
      Q = require('q'),
      util = require('util'),
      path = require('path'),
      zlib = require('zlib'),
      mime = require('mime'),
      fs = require('fs'),
      tmp = require('tmp');


  grunt.registerMultiTask('azureblob', 'Copy html assets to azure blob/cdn storage', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
        serviceOptions: [], // custom arguments to azure.createBlobService
        containerName: null, // container name, required
        containerDelete: false, // deletes container if it exists
        containerOptions: {publicAccessLevel: "blob"}, // container options
        metadata: {cacheControl: 'public, max-age=31556926'}, // file metadata properties
        copySimulation: false,
        folderPrefix: '', // prefix to use for blob name e.g. '0.0.1'
        maskBaseDir: '',
        gzip: false // gzip files
      }), 
      blobService = azure.createBlobService(),
      done = this.async(),
      self = this;

    grunt.verbose.writeflags(options,'options');
    //tmp.setGracefulCleanup(); //cleanup the temporary files even when an uncaught exception occurs.

    // execute task
    Q.when(deleteContainer)
      .then(createContainer)
      .then(processFiles)
      .then(function(count) {
        grunt.log.write(util.format('blobStorage copy completed (%s) files...',count)).ok();
          done(true); // mark async done completed
        }, function(error) {
         // handle any error from deleteContainer, createContainer or processFiles
         grunt.log.error(util.format('Error processing %s', self.nameArgs));
         grunt.fail.fatal(error);
        })
      .done();

    // Iterate each of the defined files and copy to Blob Storage
    // returns a q promise
    function processFiles() {
      var deferred = Q.defer(),
        files = self.filesSrc.filter(function(element, index, array) { // filesSrc can include dir's, not just files
          return fileExists(element);
        });

        grunt.log.writeln(util.format('\tprocess (%s) files',files.length));

        // Iterate over all specified file groups.
        grunt.util.async.forEachSeries(files, copy, function(err){
          if (err) {
            deferred.reject(err);
          }
          grunt.verbose.write('\tprocessFiles completed...').ok();
          deferred.resolve(files.length);
        });

      return deferred.promise;
    }   

    // If optioned, deletes Blob container
    // returns q promise
    function deleteContainer() {
      var deferred = Q.defer();
      if (options.containerDelete) { 
        blobService.deleteContainer(options.containerName, function(err){
          if (err) {
            deferred.reject(err);
          }
          grunt.log.ok();
          deferred.resolve();
        });
      } else {
        deferred.resolve();
      }

      return deferred.promise;
    }

    // Creates Blob container based on options.containerName, if it doesn't already exist
    // returns q promise
    function createContainer() {
      var deferred = Q.defer();
      grunt.log.write(util.format('Create blob containter [%s] ...', options.containerName));
      blobService.createContainerIfNotExists(options.containerName, options.containerOptions, function(error){
          if (error) {
            if (error.code === 'ContainerBeingDeleted') {
              grunt.log.writeln(util.format('Blob Container [%s] being deleted, retrying in 10 seconds', options.containerName));
              return setTimeout(function() {
                createContainer();
              }, 10000);
            } else {
              deferred.reject(error);
            }
        }
        grunt.log.ok();
        deferred.resolve();
      });

      return deferred.promise;
    } 

    // Iterator called from grunt.util.async.forEachSeries - for each source file in task
    function copy(source, callback) {

      var destination = source.replace(options.maskBaseDir,options.folderPrefix),
          meta = options.metadata,
          src = source,
          gzip = options.gzip,
          fileExt = path.extname(source);

      // only create gzip copies for css and js files 
      if (fileExt != '.js' && fileExt != '.css') {
          gzip = false;
      }

      // configure proper azure metadata for file
      meta.contentType = meta.contentType || mime.lookup(source);
      meta.contentTypeHeader = meta.contentTypeHeader || mime.lookup(source);
      meta.ContentEncoding = meta.ContentEncoding || gzip ? 'gzip': null;
      grunt.log.write(util.format('\tCopy %s => %s/%s ', source, options.containerName, destination));
      
      if(options.copySimulation){
        grunt.log.ok('sim');
        callback();
        return;
      }
        
      if (gzip){
        Q.when(compressFileToBlobStorage(options.containerName, destination, source, meta))
        .then(function(){
            grunt.log.ok();
            callback();
        }).done();
      } else {
        Q.when(copyFileToBlobStorage(options.containerName, destination, source, meta))
        .then(function(){
            grunt.log.ok();
            callback();
        }).done();
      }
    }

    function compressFileToBlobStorage(containerName, destFileName, sourceFile, metadata) {
      return gzipFile(sourceFile)
              .then(function(tmpFile) {
                return copyFileToBlobStorage(containerName, destFileName, tmpFile, metadata)
                  .then(function() {
                    fs.unlinkSync(tmpFile);
                    return true;
                  })
            });
    }
    function copyFileToBlobStorage(containerName, destFileName, sourceFile, metadata) {
      var deferred = Q.defer();
      blobService.createBlockBlobFromFile(containerName, destFileName, sourceFile, metadata, function(err) {
        if (err) {
          grunt.log.error(err);
          deferred.reject(err);
        }
        deferred.resolve();
      });
      return deferred.promise;
    }

    function gzipFile(source, compress){
      var deferred = Q.defer(),
        gzip = zlib.createGzip(),
        fileExt = path.extname(source),
        src = path.normalize(source),
        inp,
        out;
          
      gzip.on('error', function(err) {
        grunt.log.error(err);
        grunt.fail.warn('Gziping failed.');
      });

      tmp.tmpName({ template: 'tmp-XXXXXX' + fileExt }, function(err, tempFile) {
        if (err) def.reject(err);

        inp = fs.createReadStream(src);
        inp.on('close', function() {
          //grunt.log.writeln(util.format('inp stream:close = %s', s));
          deferred.resolve(tempFile);
        });
        
        out = fs.createWriteStream(tempFile);
        out.on('close', function() {
          //grunt.log.writeln(util.format('out stream:close = %s', tempFile));
          //deferred.resolve(tempFile);
        });
        inp.pipe(gzip).pipe(out);
        //inp.pipe(out);
      });
      return deferred.promise;
    }

    function fileExists (dest) {
      if (path.extname(dest).length > 0) {
          return fs.existsSync(dest);
      }
      else {
        return false;
      }
    }
    
  });
};
