/**
 * Created by eddieli on 24.04.18.
 */
'use strict';

const aws = require('aws-sdk');
const gm = require('gm').subClass({imageMagick: true});

function run(event, callback) {
  const body = JSON.parse(event.body);
  const base64String = body.file;
  const resizeConfig = body.resizeConfig;
  const uploadConfig = body.uploadConfig;
  const file = base64String.split(',')[1];
  const buffer = Buffer.from(file, 'base64');

  if (resizeConfig != null) {
    return resize(buffer, resizeConfig)
      .then(output => {
        return upload(output, uploadConfig);
      })
      .then(fileUrl => {
        done(200, {fileUrl: fileUrl}, callback);
      })
      .catch(error => {
        done(500, {error: 'Resize error: ' + error}, callback);
      });
  } else {
    return upload(buffer, uploadConfig)
      .then(fileUrl => {
        done(200, {fileUrl: fileUrl}, callback);
      })
      .catch(error => {
        done(500, {error: 'Upload error: ' + error}, callback);
      });
  }
}

function resize(image, config) {
  return new Promise((resolve, reject) => {
    gm(image).resize(config.maxWidth, config.maxHeight).toBuffer(config.format, (err, outBuffer) => {
      if (err) {
        return reject(err);
      } else {
        resolve(outBuffer);
      }
    });
  });
}

function upload(file, config) {
  aws.config.update({region: config.region});
  const s3 = new aws.S3(config);
  const acl = config.acl ? config.acl : 'public-read';
  const bucketName = config.bucketName;
  const keyName = config.keyName;
  const contentType = config.contentType;
  const cacheControl = 'public, max-age=' + config.awsImageMaxAge;
  const expires = new Date(Date.now() + config.awsImageExpires);
  const params = {
    ACL: acl,
    Bucket: bucketName,
    Key: keyName,
    Body: file,
    ContentType: contentType,
    CacheControl: cacheControl,
    Expires: expires
  };

  return new Promise((resolve, reject) => {
    s3.putObject(params, function (err, data) {
      if (err) {
        console.log(err);
        return reject(err);
      } else {
        const fileUrl = s3.endpoint.href + bucketName + "/" + keyName;
        console.log("Successfully uploaded data to: " + fileUrl);
        resolve(fileUrl);
      }
    });
  });
}

function done(statusCode, body, callback) {
  callback(null, {
    statusCode: statusCode,
    body: JSON.stringify(body),
    isBase64Encoded: false,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

exports.handler = (event, context, callback) => {
  run(event, callback);
}