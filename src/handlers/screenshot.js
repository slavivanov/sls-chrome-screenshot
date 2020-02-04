import log from "../utils/log";
import screenshot from "../chrome/screenshot";
const crypto = require("crypto");
const AWS = require("aws-sdk");

export default async function handler(event, context, callback) {
  console.log(event);
  const queryStringParameters = (event && event.queryStringParameters) || {};
  let { url, mobile = false } = queryStringParameters;

  if (!url) {
    let body = event && event.body;
    ({ url, mobile = false } = body || {});
  }
  if (!url && event.url) {
    ({ url, mobile = false } = event || {});
  }
  if (!url) {
    throw new Error("Please provide url to screenshot.");
  }

  let data;

  log("Processing screenshot capture for", url);

  const startTime = Date.now();

  try {
    data = await screenshot(url, mobile);
  } catch (error) {
    console.error("Error capturing screenshot for", url, error);
    throw error;
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
  return new Promise((resolve, reject) => {
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
          reject(err);
        } else {
          resolve(null, {
            statusCode: 200,
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              hash: targetHash,
              key: `${targetFilename}`,
              bucket: targetBucket,
              url: `${process.env.ENDPOINT}${targetFilename}`
            })
          });
        }
      }
    );
  });
  // return callback(null, {
  //   statusCode: 200,
  //   body: data,
  //   isBase64Encoded: true,
  //   headers: {
  //     'Content-Type': 'image/png',
  //   },
  // })
}
