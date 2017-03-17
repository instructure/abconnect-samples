const fs = require('fs')
const mime = require('mime')
const AWS = require('aws-sdk')
const S3_BUCKET = 'ab-widgets.academicbenchmarks'
const S3_ROOT = 'ABConnect/v4/'
const S3_ACL = 'public-read'

let s3 = new AWS.S3()

let remoteIgnoreList = ['dist']
let localIgnoreList = fs.readFileSync('.s3ignore').toString().split("\n").map(
  file => file.replace(/\/$/,'')
)

let localFiles = listLocalFiles('.')

listRemoteFiles(S3_ROOT).then(remoteFiles => {
  sync(localFiles, remoteFiles)
})

function sync(localFiles, remoteFiles) {
  let filesToDelete = []
  let filesToUpload = []

  remoteFiles.forEach(remoteFile => {
    let localFileIndex = localFiles.findIndex(localFile => localFile.name === remoteFile.name)

    if (localFileIndex === -1) {
      // File no longer exists locally or it is now being ignored, so delete
      filesToDelete.push(remoteFile.name)
      return
    }

    // Remove from array so that we don't process it again in the next step
    let localFile = localFiles.splice(localFileIndex,1)[0]

    if (localFile.lastModified > remoteFile.lastModified) {
      // File has been updated since last upload, so upload again
      filesToUpload.push(localFile.name)
    }
  })

  // All local files that remain are new, so upload
  localFiles.forEach(localFile => {
    filesToUpload.push(localFile.name)
  })

  if (process.argv[2] === 'test') {
    console.log('Will Delete: '+filesToDelete.length+' files')
    if (filesToDelete.length)
      console.log('  '+filesToDelete.join('\n  '))
    console.log('Will Upload: '+filesToUpload.length+' files')
    if (filesToUpload.length)
      console.log('  '+filesToUpload.join('\n  '))
    return
  }

  let hadError = false

  if (filesToDelete.length) {
    let request = s3.deleteObjects({
      Bucket: S3_BUCKET,
      Delete: {
        Objects: filesToDelete.map(fileName => ({Key: S3_ROOT+fileName}))
      }
    })

    request.send()
    request.promise()
      .then(data => {
        console.log('Successfully Deleted: \n  '+filesToDelete.join('\n  '))
      })
      .catch(err => {
        console.log('Delete error: '+err+'\n  '+filesToDelete.join('\n  '))
        hadError = true
      })
  }
  else {
    console.log('No old files to delete')
  }

  if (filesToUpload.length) {
    filesToUpload.forEach(fileName => {
      let request = s3.putObject({
        Bucket      : S3_BUCKET,
        Key         : S3_ROOT+fileName,
        ACL         : S3_ACL,
        Body        : fs.createReadStream(fileName),
        ContentType : mime.lookup(fileName),
        CacheControl: 'max-age=86400, public, must-revalidate, proxy-revalidate',
      })

      request.send()
      request.promise()
        .then(data => {
          console.log('Successfully Uploaded: '+fileName)
        })
        .catch(err => {
          console.log('Upload error: '+fileName+': '+err)
          hadError = true
        })
    })
  }
  else {
    console.log('No new files to upload')
  }

  // Make sure pipelines knows there was an error if we had one
  if (hadError) process.exit(1)
}

function listLocalFiles(dir,filelist) {
  let files = fs.readdirSync(dir)
  filelist = filelist || []

  files.forEach(file => {
    if (file.charAt(0) === '.') return

    let fullFileName = (dir+'/'+file).replace(/^\.\//,'')

    if (localIgnoreList.indexOf(fullFileName) > -1) return

    let stat = fs.statSync(fullFileName)

    if (stat.isDirectory())
      listLocalFiles(fullFileName, filelist)
    else
      filelist.push({
        name: fullFileName,
        lastModified: stat.mtime.getTime(),
      })
  })

  return filelist
}

function listRemoteFiles(dir,remoteFiles,continuationToken) {
  let params = {
    Bucket: S3_BUCKET,
    Prefix: dir,
    MaxKeys: 1000,
  }

  if (continuationToken)
    params.ContinuationToken = continuationToken

  // Avoiding use of request.promise() due to an intermittent bug
  let promise = new Promise((resolve,reject) => {
    s3.listObjectsV2(params, (err,data) => {
      if (err) reject(err)
      else     resolve(data)
    })
  })

  remoteFiles = remoteFiles || []

  return promise
    .then(data => {
      data.Contents.forEach(file => {
        if (file.Key === dir) return

        let relativeFileName = file.Key.replace(dir,'')
        let skip = remoteIgnoreList.find(fileName => {
          let regexp = new RegExp('^'+fileName)

          return regexp.test(relativeFileName)
        })

        if (skip) return

        remoteFiles.push({
          name: relativeFileName,
          lastModified: file.LastModified.getTime(),
        })
      })

      if (data.IsTruncated)
        return listRemoteFiles(dir,remoteFiles,data.NextContinuationToken)
      else
        return remoteFiles
    })
    .catch(err => {
      if (err instanceof Error)
        console.log('Error calling AWS.S3.listObjects: '+err.message+' ('+err.code+')')
      else
        console.log(err,err.stack)

      process.exit(1)
    })
}
