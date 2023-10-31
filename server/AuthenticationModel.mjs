class AuthenticationModel {
    constructor(supportedVersionsResponse, browserInfo, cardholderDetails, deviceFingerprintSuccess, challengeNotificationUrl, req) {
        this.ServerTransactionId = supportedVersionsResponse.threeDSecureResponse[0].threeDSServerTransID;
        this.MethodCompletionIndicator = deviceFingerprintSuccess ? 1 : 2;
        this.MessageVersion = supportedVersionsResponse.recommended3dsVersion[supportedVersionsResponse.threeDSecureResponse[0].dsIdentifier]; // Mastercard branded cards are the only test cards available within the TokenEx 3DS Testing environment
        this.BrowserInfo = {
            AcceptHeaders: req.headers['accept'],
            IpAddress: req.headers['x-forwarded-for'] || req.remoteAddress,
            UserAgent: req.headers['user-agent'],
            JavascriptEnabled: true,
            Language: browserInfo.browserLanguage,
            TimeZone: browserInfo.timeZoneOffset,
            ScreenHeight: browserInfo.screenHeight,
            ScreenWidth: browserInfo.screenWidth,
            ColorDepth: browserInfo.colorDepth
        };
        this.AcquirerBin = "444444"; // BIN number of the merchant's acquiring instution
        this.CardholderDetails = {
            Name: cardholderDetails.fullName,
            EmailAddress: cardholderDetails.email 
        };
        this.CardDetails = {
            Number: supportedVersionsResponse.token, // Represents the PAN
            CardExpiryDate: cardholderDetails.cardExpiration, // YYMM 
            AccountType: 2 // Credit, 3 = Debit, 1 = N/A
        };
        this.ChallengeWindowSize = 5; // full-size
        this.DeviceChannel = 2; // BRW, 3 = 3RI
        this.DirectoryServerIdentifier = supportedVersionsResponse.threeDSecureResponse[0].dsIdentifier;
        this.GenerateChallengeRequest = true; // if a challenge is required by the ACS for the authentication, this specifies the ACS should return the resources to set up that challenge for the client
        this.MerchantDetails = { // Add merchant specific details
            AcquirerMerchantId: "External_Test_Merchant",
            CategoryCode: "0001",
            CountryCode: "840",
            Name: "Merchant Name"
        };
        this.MessageCategory = req.body.authenticationType; //  Payment. 2 = Non Payment
        this.NotificationUrl = challengeNotificationUrl; // due to external server validations, this cannot be localhost
        this.AuthenticationIndicator = 1; // type of authentication being performed. 1 = Payment transaction
        this.PurchaseDetails = {
            Amount: 1000, // amount of purchase in lowest units of currency. 1000 cents = $10.00
            Currency: "840", // USD
            Exponent: 2, // $10.00 - the decimal place is two places from the end
            Date: this.getCurrentFormattedDate()
        };
        this.TransactionType = 1;
    }

    getCurrentFormattedDate() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Adding 1 because months are 0-based
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return `${year}${month}${day}${hours}${minutes}${seconds}`;
    }
}

export { AuthenticationModel }; 