const fs = require('fs')
const mime = require('mime')
const AWS = require('aws-sdk')
const crypto = require('crypto')

const CLOUDFRONT_DISTRIBUTION_ID = 'E274ZI3E859MMN'
const CLOUDFRONT_NAMESPACE = 'DEMOS'
const S3_BUCKET = 'ab-widgets.academicbenchmarks'
const S3_ROOT = '/ABConnect/v4/'
const S3_ACL = 'public-read'
const S3_CACHECONTROL = 's-maxage=3600, max-age=3600, public, must-revalidate, proxy-revalidate'

let s3 = new AWS.S3()

/*
** The first argument passed to the script may be:
**   sync: (default) sync according the normal ignore rules
**   test: Compare local with remote and show differences.
**   force: Upload all files even if they don't appear to differ.
*/
let action = process.argv[2] || 'sync';

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
  let changedFiles = []

  remoteFiles.forEach(remoteFile => {
    let localFileIndex = localFiles.findIndex(localFile => localFile.name === remoteFile.name)

    if (localFileIndex === -1) {
      // File no longer exists locally or it is now being ignored, so delete
      filesToDelete.push(remoteFile.name)
      changedFiles.push(remoteFile.name)
      return
    }

    // Remove from array so that we don't process it again in the next step
    let localFile = localFiles.splice(localFileIndex,1)[0]
    let localData = fs.readFileSync(localFile.name, {encoding: null})
    localFile.eTag = crypto.createHash('md5').update(localData).digest('hex')

    if (action === 'force' || localFile.eTag !== remoteFile.eTag) {
      // File has been updated since last upload, so upload again
      filesToUpload.push(localFile.name)
      changedFiles.push(localFile.name)
    }
  })

  // All local files that remain are new (not changed), so upload
  localFiles.forEach(localFile => {
    filesToUpload.push(localFile.name)
  })

  if (action === 'test') {
    console.log('Will Delete: '+filesToDelete.length+' files')
    if (filesToDelete.length)
      console.log('  '+filesToDelete.join('\n  '))
    console.log('Will Upload: '+filesToUpload.length+' files')
    if (filesToUpload.length)
      console.log('  '+filesToUpload.join('\n  '))
    return
  }

  let requestPromises = []

  if (filesToDelete.length) {
    let promise = s3.deleteObjects({
      Bucket: S3_BUCKET,
      Delete: {
        Objects: filesToDelete.map(fileName => ({Key: S3_ROOT+fileName}))
      }
    })
      .promise()
        .then(data => {
          console.log('Successfully Deleted: \n  '+filesToDelete.join('\n  '))
        })
        .catch(err => {
          throw new Error('Delete error: '+err+'\n  '+filesToDelete.join('\n  '))
        })

    requestPromises.push(promise)
  }
  else {
    console.log('No old files to delete')
  }

  if (filesToUpload.length) {
    filesToUpload.forEach(fileName => {
      let promise = s3.putObject({
        Bucket      : S3_BUCKET,
        Key         : S3_ROOT+fileName,
        ACL         : S3_ACL,
        Body        : fs.createReadStream(fileName),
        ContentType : mime.lookup(fileName),
        CacheControl: S3_CACHECONTROL
      })
        .promise()
          .then(data => {
            console.log('Successfully Uploaded: '+fileName)
          })
          .catch(err => {
            throw new Error('Upload error: '+fileName+': '+err)
          })

      requestPromises.push(promise)
    })
  }
  else {
    console.log('No new files to upload')
  }

  // Invalidate the CloudFront cache when there are changed files
  if (!changedFiles.length) return

  // Wait for all changes to be made before continuing
  Promise.all(requestPromises)
    .then(() => {
      // To keep things free/cheap, reduce the changed files to a single path.
      let path = findCommonPath(changedFiles)

      return invalidate([path])
    })
    .catch(err => {
      console.log(err)

      // This tells pipelines that we failed
      process.exit(1)
    })
}

/*
** If there is only one path, return it.
** Otherwise, return the common prefix with a wildcard appended.
*/
function findCommonPath(paths) {
  if (paths.length === 1) return paths[0]

  paths.sort()

  let firstPath = paths[0]
  let lastPath = paths[paths.length-1]
  let length = 0
  let maxLength = firstPath.length

  while (length < maxLength && firstPath.charAt(length) === lastPath.charAt(length))
    length++

  return firstPath.substring(0,length)+'*'
}

function invalidate(paths) {
  let cloudfront = new AWS.CloudFront()

  // YYYYMMDDhhmmss.sss
  let date = new Date()
  let dateSerial = ''
  dateSerial += date.getUTCFullYear()
  dateSerial += ('0'+(date.getUTCMonth()+1)).substr(-2)
  dateSerial += ('0'+date.getUTCDate()).substr(-2)
  dateSerial += ('0'+date.getUTCHours()).substr(-2)
  dateSerial += ('0'+date.getUTCMinutes()).substr(-2)
  dateSerial += ('0'+date.getUTCSeconds()).substr(-2)
  dateSerial += '.'+('00'+date.getUTCMilliseconds()).substr(-3)

  paths = paths.map(path => {
    // The path is relative to the distribution and must begin with '/'.
    path = S3_ROOT+path

    // URL encode non-ASCII or unsafe characters as defined in RFC 1783.
    // TODO: if you get error:
    //   InvalidArgument: Your request contains one or more invalid invalidation paths.

    return path
  })

  return cloudfront.createInvalidation({
    DistributionId: CLOUDFRONT_DISTRIBUTION_ID,
    InvalidationBatch: {
      CallerReference: CLOUDFRONT_NAMESPACE+'-'+dateSerial,
      Paths: {
        Quantity: paths.length,
        Items: paths,
      }
    }
  })
    .promise()
      .then(data => {
        console.log('Successfully created invalidation: '+data.Location)
      })
      .catch(err => {
        throw new Error('Failed to create invalidation: '+err)
      })
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

  remoteFiles = remoteFiles || []

  return s3.listObjectsV2(params).promise()
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
          eTag: file.ETag.slice(1,-1),
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
