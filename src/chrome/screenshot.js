import Cdp from 'chrome-remote-interface'
import log from '../utils/log'
import sleep from '../utils/sleep'

export default async function captureScreenshotOfUrl (url, mobile = false) {
  const LOAD_TIMEOUT = process.env.PAGE_LOAD_TIMEOUT || 1000 * 60

  let result
  let loaded = false

  const loading = async (startTime = Date.now()) => {
    if (!loaded && Date.now() - startTime < LOAD_TIMEOUT) {
      await sleep(100)
      await loading(startTime)
    }
  }

  const [tab] = await Cdp.List()
  const client = await Cdp({ host: '127.0.0.1', target: tab })

  const {
    Network, Page, Runtime, Emulation,
  } = client

  Network.requestWillBeSent((params) => {
    log('Chrome is sending request for:', params.request.url)
  })

  var requestCounterMinWaitMs = 1000; // Wait for at least 1 second
  var requestCounterMaxWaitMs = LOAD_TIMEOUT;

  var numSent = 0;
  var numReceived = 0;
  var startTime = new Date().getTime();

  function minWaitTimeExceeded() {
    return new Date().getTime() - startTime > requestCounterMinWaitMs;
  }

  function maxWaitTimeExceeded() {
    return new Date().getTime() - startTime > requestCounterMaxWaitMs;
  }

  Page.loadEventFired(() => {
    var ajaxDoneInterval = setInterval(function() {
      if (numSent == numReceived && minWaitTimeExceeded()) {
        clearInterval(ajaxDoneInterval);
      } else if (maxWaitTimeExceeded()) {
        console.log('Timed out. Waited ' + (new Date().getTime() - startTime) + ' ms. Had been still waiting for ' + (numSent - numReceived) + ' ajax requests');
        clearInterval(ajaxDoneInterval);
      } else {
        if (numSent == numReceived) {
          console.log('No pending ajax requests, but still waiting for minWaitTime of ' + requestCounterMinWaitMs + '. Current wait: ' + (new Date().getTime() - startTime));
        } else {
          console.log('Still waiting for ' + (numSent - numReceived) + ' ajax requests');
        }
      }
    }, 300);
  }
)

  try {
    await Promise.all([Network.enable(), Page.enable()])

    if (mobile) {
      await Network.setUserAgentOverride({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 10_0_1 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Version/10.0 Mobile/14A403 Safari/602.1',
      })
    }

    await Emulation.setDeviceMetricsOverride({
      mobile: !!mobile,
      deviceScaleFactor: 0,
      scale: 1, // mobile ? 2 : 1,
      width: mobile ? 375 : 1280,
      height: 0,
    })

    await Page.navigate({ url })
    await Page.loadEventFired()
    await loading()

    const {
      result: {
        value: { height },
      },
    } = await Runtime.evaluate({
      expression: `(
        () => ({ height: document.body.scrollHeight })
      )();
      `,
      returnByValue: true,
    })

    await Emulation.setDeviceMetricsOverride({
      mobile: !!mobile,
      deviceScaleFactor: 0,
      scale: 1, // mobile ? 2 : 1,
      width: mobile ? 375 : 1280,
      height,
    })

    const screenshot = await Page.captureScreenshot({ format: 'png' })

    result = screenshot.data
  } catch (error) {
    console.error(error)
  }

  await client.close()

  return result
}
