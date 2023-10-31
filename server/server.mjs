import express from 'express';
import axios from 'axios';
import cors from 'cors';
import path from 'path';
import CryptoJS from 'crypto-js';
import challengeStore from './challengeStore.mjs'; // for keeping track of challenges completed
import deviceFingerprintStore from './deviceFingerprintStore.mjs'; // For keeping track of completed device fingerprints
import { config } from '../config.mjs';
import { AuthenticationModel } from './AuthenticationModel.mjs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

app.listen(config.port, () => {
    console.log(`Server is listening on port ${config.port}`);
});

/* PAGE AND RESOURCE SERVING */
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, '..', 'pages', 'index.html');
    res.sendFile(indexPath);
});

app.get('/favicon.ico', (req, res) => {
    const faviconPath = path.join(__dirname, '..', 'pages', 'favicon.ico');
    res.sendFile(faviconPath);
});

app.get('/loading.gif', (req, res) => {
    const loadingPath = path.join(__dirname, '..', 'pages', 'loading.gif');
    res.sendFile(loadingPath);
});

app.get('/TokenExDeviceFingerprinting.html', (req, res) => {
    const indexPath = path.join(__dirname, '..', 'pages', 'TokenExDeviceFingerprinting.html');
    res.sendFile(indexPath);
});

app.get('/ManualDeviceFingerprinting.html', (req, res) => {
    const indexPath = path.join(__dirname, '..', 'pages', 'ManualDeviceFingerprinting.html');
    res.sendFile(indexPath);
});

app.get('/scripts/script.mjs', (req, res) => {
    res.set('Content-Type', 'text/javascript');
    const scriptPath = path.join(__dirname, '..', 'scripts', 'script.mjs');
    res.sendFile(scriptPath);
});

app.get('/scripts/IframeConfiguration.mjs', (req, res) => {
    res.set('Content-Type', 'text/javascript');
    const scriptPath = path.join(__dirname, '..', 'scripts', 'IframeConfiguration.mjs');
    res.sendFile(scriptPath);
});

/* TokenEx Iframe Authentication Key Generation */
app.post('/generateHmac', (req, res) => {
    console.log("Generating hmac for " + JSON.stringify(req.body));

    const date = new Date();
    const formattedDate = date.toISOString().slice(0, 19).replace(/[-T:/]/g, '');
    const txSecretKey = config.txApiKey;
    const txID = config.txTokenExId;
    const txTokenScheme = "1";
    const txOrigin = req.body.origin;
    const message = `${txID}|${txOrigin}|${formattedDate}|${txTokenScheme}`;
    console.log("Message: " + message);

    const hash = CryptoJS.HmacSHA256(message, txSecretKey);
    const authkey = CryptoJS.enc.Base64.stringify(hash);

    console.log("Hmac: " + authkey);
    res.json({ hmac: authkey, tokenScheme: txTokenScheme, timestamp: formattedDate, tokenExId: txID });
});

/* Receives notification when device fingerprinting completes */
app.post('/deviceFingerprintNotification', (req, res) => {
    console.log("Device fingerprint notification received: " + JSON.stringify(req.body));

    const base64Data = req.body.threeDSMethodData;
    const decodedData = JSON.parse(atob(base64Data));

    console.log("Device fingerprinting notification: " + JSON.stringify(decodedData));

    // add it to the store of completed device notifications
    deviceFingerprintStore.addToStore(decodedData.threeDSServerTransID);

    res.status(204).send();
});

app.post('/deviceFingerprintResults', async (req, res) => {
    if (deviceFingerprintStore.isDeviceFingerprinted(req.body.threeDSServerTransID)) {
        return res.status(204).send();
    } else {
        res.status(404).json({ result: "Device fingerprinting not yet completed or device fingerprint failed." });
    }
});

/* Send SupportedVersions request */
app.post('/supportedVersions', async (req, res) => {
    const request = req.body;
    console.log("Supported Versions request received: " + JSON.stringify(request));

    const headers = {
        'tx-tokenex-id': config.txTokenExId,
        'tx-apikey': config.txApiKey,
        'Content-Type': 'application/json'
    };

    // Reach out and get the Supported 3DS Versions for the PAN
    try {
        const response = await axios.post(config.supportedVersionsEndpoint, request, { headers });
        console.log("Supported Versions API response: " + JSON.stringify(response.data));

        res.status(200).json(response.data);

    } catch (error) {
        console.error("Error fetching Supported Versions: " + error);
        res.status(502).json({ success: false, error: "Error fetching Supported Versions" });
    }
});

/* Sends the Authentication request */
app.post('/authenticate', async (req, res) => {
    try {
        const authenticationType = req.body.authenticationType;
        const supportedVersionsResponse = req.body.supportedVersionsResponse;
        const browserInfo = req.body.browserInfo;
        const cardholderDetails = req.body.cardholderDetails;
        const deviceFingerprintSuccess = req.body.deviceFingerprintSuccess;

        console.log("Received Authentication type: " + JSON.stringify(authenticationType));
        console.log("Received SupportedVersions response: " + JSON.stringify(supportedVersionsResponse));
        console.log("Received browser info: " + JSON.stringify(browserInfo));
        console.log("Received cardholder details: " + JSON.stringify(cardholderDetails));
        console.log("Received device fingerprint success: " + deviceFingerprintSuccess);
        console.log("Supported versions 3DS Transaction Id: " + supportedVersionsResponse.threeDSecureResponse[0].threeDSServerTransID);

        const authenticationModel = new AuthenticationModel(
            supportedVersionsResponse,
            browserInfo,
            cardholderDetails,
            deviceFingerprintSuccess,
            config.challengeNotificationUrl,
            req);

        console.log("Authentication model: " + JSON.stringify(authenticationModel));

        const headers = {
            'tx-tokenex-id': config.txTokenExId,
            'tx-apikey': config.txApiKey,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(config.authenticationEndpoint, authenticationModel, { headers });

        console.log("Authentication API response: " + JSON.stringify(response.data));

        res.set('Content-Type', 'application/json');
        res.status(200).json(response.data);

    } catch (error) {
        console.error("Error while attempting to authenticate the cardholder: " + error);
        res.status(502).json({ error });
    }
});


/* Receives notification of challenge completion */
app.post('/challengeNotification', (req, res) => {
    let challengeNotificationUrl = new URL(config.challengeNotificationUrl);

    // Set the necessary CORS headers
    res.header('Access-Control-Allow-Origin', challengeNotificationUrl.origin);
    res.header('Access-Control-Allow-Methods', 'POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');

    console.log("Challenge completion notification received: " + JSON.stringify(req.body));

    const base64Data = req.body.cres;
    const decodedData = JSON.parse(atob(base64Data));

    console.log("Challenge completion notification: " + JSON.stringify(decodedData));

    // Add the completion to the challenge store
    challengeStore.addToStore(decodedData.threeDSServerTransID);

    res.status(204).send();
});

/* returns the results of the challenge */
app.post('/challengeResults', async (req, res) => {
    const request = req.body;
    console.log("Challenge results request received: " + JSON.stringify(request));

    if (challengeStore.isChallengeCompleted(request.threeDSServerTransID)) {

        const headers = {
            'tx-tokenex-id': config.txTokenExId,
            'tx-apikey': config.txApiKey,
            'Content-Type': 'application/json'
        };

        // Reach out and get the challenge results
        try {
            const response = await axios.post(config.challengeResultsEndpoint, { ServerTransactionId: request.threeDSServerTransID }, { headers });
            var challengeResultsResponse = response.data;
            console.log("Challenge Results API response: " + JSON.stringify(challengeResultsResponse));

            res.status(200).json(challengeResultsResponse);

            challengeStore.removeFromStore(request.threeDSServerTransID);
        } catch (error) {
            console.error("Error fetching challenge results: " + error);
            res.status(502).json({ success: false, error: "Error fetching challenge results" });
        }
    } else {
        res.status(404).json({ result: "challenge not yet complete" });
    }
});

