import log from "../utils/log";
import screenshotHTML from "../chrome/screenshotHTML";
const crypto = require("crypto");
const AWS = require("aws-sdk");

export default async function handler(event, context, callback) {
  const queryStringParameters = event.queryStringParameters || {};
  const { mobile = false } = queryStringParameters;
  if (event.isBase64Encoded) {
    event.body = Buffer.from(event.body, "base64").toString();
  }
  let body =
    typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  const html = body.html;
  console.log(html);
  let data;

  log("Processing screenshot capture for HTML");

  const startTime = Date.now();

  try {
    data = await screenshotHTML(html, mobile);
  } catch (error) {
    console.error("Error capturing HTML screenshot", error);
    throw error;
  }

  log(
    `Chromium took ${Date.now() -
      startTime}ms to load HTML and capture screenshot.`
  );

  // Save the image to S3
  const targetBucket = process.env.BUCKET_NAME;
  const targetHash = crypto
    .createHash("md5")
    .update(html)
    .digest("hex");
  const targetFilename = `${targetHash}/original.png`;
  console.log(targetFilename);

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
      (err, res) => {
        if (err) {
          console.warn(err);
          reject(err);
        } else {
          const result = {
            hash: targetHash,
            key: `${targetFilename}`,
            bucket: targetBucket,
            url: `${process.env.ENDPOINT}${targetFilename}`
          };
          console.log(result);
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
