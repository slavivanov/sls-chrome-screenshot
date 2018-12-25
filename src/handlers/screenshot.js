import log from "../utils/log";
import screenshot from "../chrome/screenshot";
const crypto = require("crypto");
const AWS = require("aws-sdk");

export default async function handler(event, context, callback) {
  const queryStringParameters = event.queryStringParameters || {};
  const {
    url = "https://github.com/adieuadieu/serverless-chrome",
    mobile = false
  } = queryStringParameters;

  let data;

  log("Processing screenshot capture for", url);

  const startTime = Date.now();

  try {
    data = await screenshot(url, mobile);
  } catch (error) {
    console.error("Error capturing screenshot for", url, error);
    return callback(error);
  }

  log(
    `Chromium took ${Date.now() -
      startTime}ms to load URL and capture screenshot.`
  );

  // Save the image to S3
  const targetBucket = process.env.BUCKET_NAME;
  const targetHash = crypto
    .createHash("md5")
    .update(url)
    .digest("hex");
  const targetFilename = `${targetHash}/original.png`;

  const buf = new Buffer(
    data.replace(/^data:image\/\w+;base64,/, ""),
    "base64"
  );

  const s3 = new AWS.S3();
  s3.putObject(
    {
      ACL: "public-read",
      Key: targetFilename,
      Body: buf,
      Bucket: targetBucket,
      ContentType: "image/png",
      ContentEncoding: "base64"
    },
    err => {
      if (err) {
        console.warn(err);
        callback(err);
      } else {
        // console.info(stderr);
        // console.info(stdout);
        callback(null, {
          statusCode: 200,
          body: `${process.env.ENDPOINT}${targetFilename}`
          // hash: targetHash,
          // key: `${targetFilename}`,
          // bucket: targetBucket,
          // url: `${process.env.ENDPOINT}${targetFilename}`
        });
      }
      return;
    }
  );

  // return callback(null, {
  //   statusCode: 200,
  //   body: data,
  //   isBase64Encoded: true,
  //   headers: {
  //     'Content-Type': 'image/png',
  //   },
  // })
}
