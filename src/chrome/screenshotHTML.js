const Cdp = require("chrome-remote-interface");
const log = require("../utils/log");
const sleep = require("../utils/sleep");

let viewport = [
  Number(process.env.EMAIL_VIEWPORT_WIDTH) || 600,
  Number(process.env.EMAIL_VIEWPORT_HEIGHT) || 800
];
const LOAD_TIMEOUT = Number(process.env.HTML_LOAD_TIMEOUT) || 1000 * 5;

const screenshotHTML = async (html, mobile = false) => {
  const [tab] = await Cdp.List();
  const client = await Cdp({ host: "127.0.0.1", target: tab });
  const { Network, Page, DOM, Emulation } = client;
  try {
    await Network.enable();
    await Page.enable();
    await DOM.enable();
    // Load blank page initially
    const { frameId } = await Page.navigate({ url: "about:blank" });
    // Wait for blank page loading
    await Page.loadEventFired();

    // Notify when new html is loaded
    let loaded = false;
    Page.loadEventFired(() => {
      loaded = true;
    });
    // Set the content to the html
    await Page.setDocumentContent({
      frameId,
      html
    });

    // Wait for page to load or for timeout
    const loading = async (startTime = Date.now()) => {
      if (!loaded && Date.now() - startTime < LOAD_TIMEOUT) {
        await sleep(100);
        await loading(startTime);
      }
    };
    await loading();

    // Calculate new height
    const {
      root: { nodeId: documentNodeId }
    } = await DOM.getDocument();
    const { nodeId: bodyNodeId } = await DOM.querySelector({
      selector: "body",
      nodeId: documentNodeId
    });
    const {
      model: { height }
    } = await DOM.getBoxModel({ nodeId: bodyNodeId });

    // Set the viewport size
    await Emulation.setVisibleSize({ width: viewport[0], height: height });
    await Emulation.setDeviceMetricsOverride({
      width: viewport[0],
      height: height,
      screenWidth: viewport[0],
      screenHeight: height,
      deviceScaleFactor: 0,
      fitWindow: false,
      mobile: !!mobile
    });
    await Emulation.setPageScaleFactor({ pageScaleFactor: 0 });

    // Capture the screenshot
    const screenshot = await Page.captureScreenshot({
      format: "png",
      fromSurface: true
    });

    return screenshot.data;
  } catch (err) {
    console.error(err);
  } finally {
    client.close();
  }
};

module.exports = screenshotHTML;

// const fs = require("fs");
// // const html = fs.readFileSync("src/chrome/test.html").toString();
// const html = "<html><body><h1>Hi!</h1></body></html>";

// screenshotHTML(html, true).then(data => {
//   const buffer = new Buffer(data, "base64");

//   fs.writeFile("desktop.png", buffer, "base64", function(err) {
//     if (err) {
//       console.error(err);
//     } else {
//       log("Screenshot saved");
//     }
//   });
// });
