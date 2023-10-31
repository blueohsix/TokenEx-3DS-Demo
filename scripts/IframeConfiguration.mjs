// https://docs.tokenex.com/docs/building-the-configuration-object
class IframeConfiguration {
    constructor(pageOrigin, configData, backendServer, performFingerprinting) {
        this.origin = pageOrigin;
        this.timestamp = configData.timestamp;
        this.tokenExID = configData.tokenExId;
        this.tokenScheme = configData.tokenScheme;
        this.authenticationKey = configData.hmac;
        this.pci = true;
        this.cvv = true;
        this.placeholder = "2303 7799 9900 0275";
        this.enablePrettyFormat = true;
        this.cvvContainerID = "cvv-div";
        this.cvvPlaceholder = "123";
        this.use3DS = performFingerprinting; 
        this.threeDSMethodNotificationUrl = backendServer + '/deviceFingerprintNotification'; // does not need to be populated if use3DS is false
        this.styles = {
            base: `
              font-family: Arial, sans-serif;
              padding: 0 8px;
              border: 1px solid rgba(0, 0, 0, 0.2);
              margin: 0;
              width: 100%;
              font-size: 13px;
              line-height: 30px;
              height: 32px;
              box-sizing: border-box;
              -moz-box-sizing: border-box;
            `,
            focus: `
              box-shadow: 0 0 6px 0 rgba(0, 132, 255, 0.5);
              border: 1px solid rgba(0, 132, 255, 0.5);
              outline: 0;
            `,
            error: `
              box-shadow: 0 0 6px 0 rgba(224, 57, 57, 0.5);
              border: 1px solid rgba(224, 57, 57, 0.5);
            `,
            cvv: {
                base: `
                font-family: Arial, sans-serif;
                padding: 0 8px;
                border: 1px solid rgba(0, 0, 0, 0.2);
                margin: 0;
                width: 100%;
                font-size: 13px;
                line-height: 30px;
                height: 32px;
                box-sizing: border-box;
                -moz-box-sizing: border-box;
              `,
                focus: `
                box-shadow: 0 0 6px 0 rgba(0, 132, 255, 0.5);
                border: 1px solid rgba(0, 132, 255, 0.5);
                outline: 0;
              `,
                error: `
                box-shadow: 0 0 6px 0 rgba(224, 57, 57, 0.5);
                border: 1px solid rgba(224, 57, 57, 0.5);
              `,
            }
        };
    }
}

export { IframeConfiguration }; 