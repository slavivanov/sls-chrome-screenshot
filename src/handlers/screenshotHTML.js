const crypto = require("crypto");
const AWS = require("aws-sdk");
const chromium = require("chrome-aws-lambda");

const handler = async (event, context) => {
  if (event.isBase64Encoded) {
    event.body = Buffer.from(event.body, "base64").toString();
  }

  let body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  const html = body.html;
  console.log(html);
  let browser = null;

  try {
    await chromium.font('https://rawcdn.githack.com/googlei18n/noto-emoji/master/fonts/NotoColorEmoji.ttf');
    await chromium.font('https://rawcdn.githack.com/googlefonts/noto-fonts/8194fd72cbc46bb88e8246b68e42b96cbef0c700/hinted/ttf/NotoSans/NotoSans-Regular.ttf');
    await chromium.font('https://rawcdn.githack.com/googlefonts/noto-fonts/8194fd72cbc46bb88e8246b68e42b96cbef0c700/hinted/ttf/NotoSans/NotoSans-Bold.ttf');
    browser = await chromium.puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true
    });
    // await fs.copy('./fonts/*.ttf', '/tmp/aws/.fonts/');

    let page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: "networkidle2"
    });
    await page.addStyleTag({
      content: `
    * {
      font-family: 'Noto Sans', sans-serif !important;
    }`
    }); // await page.waitForNavigation({
    //   waitUntil: 'networkidle2',
    // });

    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    await page.setViewport({
      width: viewport[0],
      height: bodyHeight,
      deviceScaleFactor: 0
    });
    const imageBuffer = await page.screenshot({
      type: "png",
      fullPage: true
    });
    const result = await saveToS3(imageBuffer, html);
    return result;
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify(error)
    };
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
};


module.exports = {
  handler
};