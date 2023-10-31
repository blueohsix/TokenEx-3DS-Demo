import { IframeConfiguration } from './IframeConfiguration.mjs';


const backendServer = 'http://localhost:9943';
const pageOrigin = window.location.origin;
var tokenizeResponse;
var supportedVersionsResponse;
var iframeConfig;
var tokenExIframe;
var tokenExIframePerformingDeviceFingerprinting;
var deviceFingerprintPollingInterval;
var challengeResultPollingInterval;

document.addEventListener('DOMContentLoaded', () => {
	fetchConfigurationDetails();

	/* https://docs.tokenex.com/docs/3-d-secure-device-fingerprinting
	If the deviceFingerprintDiv is present, then manual device fingerprinting is happening. 
	If it's null, manual device fingerprinting is happening. */
	let deviceFingeprintDiv = document.getElementById("deviceFingerprintDiv");
	tokenExIframePerformingDeviceFingerprinting = deviceFingeprintDiv === null;
});

function fetchConfigurationDetails() {
	const originBody = { origin: pageOrigin };
	const serverUrl = backendServer + '/generateHmac';
	const headers = {
		'Content-Type': 'application/json',
	};

	fetch(serverUrl, {
		method: 'POST',
		headers: headers,
		body: JSON.stringify(originBody),
	})
		.then(response => {
			if (response.ok) {
				return response.json();
			} else {
				console.error('Failed to send page origin.');
			}
		})
		.then(data => {
			if (data) {
				console.log("received HMAC response: " + JSON.stringify(data))

				// data needed for the iframe configuration that is returned from the server
				const configData = {
					timestamp: data.timestamp,
					tokenExId: data.tokenExId,
					tokenScheme: data.tokenScheme,
					hmac: data.hmac,
				};

				iframeConfig = new IframeConfiguration(pageOrigin, configData, backendServer, tokenExIframePerformingDeviceFingerprinting);
				console.log(JSON.stringify(iframeConfig));

				loadIframe(iframeConfig);
			} else {
				console.error('No HMAC found in the response.');
			}
		})
		.catch(error => {
			console.error('Error:', error);
		});
}

function loadIframe(iframeConfig) {
	tokenExIframe = new TokenEx.Iframe("card-number-div", iframeConfig);

	tokenExIframe.load();

	setupEventListeners();
}

function setupEventListeners() {
	tokenExIframe.on("load", function () {
		console.log("CC iFrame Loaded");
	});

	tokenExIframe.on("focus", function () {
		console.log("iFrame Focus");
	});
	tokenExIframe.on("blur", function () {
		console.log("CC iFrame blur");
		tokenExIframe.validate();
	});
	tokenExIframe.on("validate", function (data) {
		console.log("CC iFrame validate:" + JSON.stringify(data));
	});
	tokenExIframe.on("cardTypeChange", function (data) {
		console.log("CC iFrame cardTypeChange:" + JSON.stringify(data));
	});
	tokenExIframe.on("tokenize", async function (data) {
		let json = JSON.stringify(data);
		console.log("CC iFrame Tokenize:" + json);
		tokenizeResponse = JSON.parse(json);
		showLoadingOverlay();
		if (!tokenExIframePerformingDeviceFingerprinting) {
			console.log("Manual device fingerprinting flow is active. Checking card 3DS enrollment...");
			start3DS();
		} else {
			console.log("TokenEx device fingerprinting flow is active. Awaiting device fingerprint notification...");
		}

	});
	tokenExIframe.on("error", function (data) {
		console.log("CC iFrame error:" + JSON.stringify(data));
	});
	tokenExIframe.on("cvvFocus", function () {
		console.log("CVV iFrame focus");
	});
	tokenExIframe.on("cvvBlur", function () {
		console.log("CVV iFrame blur");
		tokenExIframe.validate();
	});
	tokenExIframe.on("notice", function (data) {
		console.log("notice: " + JSON.stringify(data))
		if (data.type === "3DS Device Fingerprinting") { // when the 3DS device fingerprinting notice is raised, attempt an authentication
			startAuthentication(tokenizeResponse, data.success);
		}
	})

	document.getElementById('tokenizeAndAuthenticate').addEventListener("click", function (event) {
		event.preventDefault();
		tokenExIframe.tokenize();
	});
}

async function start3DS() {
	let cardIsEnrolled = await check3dsEnrollment(tokenizeResponse.token);
	console.log('card is enrolled in 3DS:', cardIsEnrolled);

	if (cardIsEnrolled) {
		console.log("global supportedVersionsResponse: ", JSON.stringify(supportedVersionsResponse));
		if ('threeDSMethodURL' in supportedVersionsResponse.threeDSecureResponse[0]) {
			performFingerprinting(supportedVersionsResponse.threeDSecureResponse[0].threeDSMethodURL);
			deviceFingerprintPollingInterval = setInterval(pollForCompletedFingerprint, 5000);
		} else {
			console.log("ACS does not support device fingerprinting. Attempting authentication...");
			startAuthentication(supportedVersionsResponse, false);
		}
	}
}

async function pollForCompletedFingerprint() {
	let transId = tokenExIframePerformingDeviceFingerprinting
		? tokenizeResponse.threeDSecureResponse[0].threeDSServerTransID
		: supportedVersionsResponse.threeDSecureResponse[0].threeDSServerTransID;

	console.log("Polling for device fingerprint completion...");
	const headers = {
		'Content-Type': 'application/json',
	};
	try {
		const response = await fetch(backendServer + '/deviceFingerprintResults', {
			method: 'POST',
			headers: headers,
			body: JSON.stringify({ threeDSServerTransID: transId }),
		});

		console.log("Received response to device fingerprint notification poll: " + response.status);

		if (response.ok) {
			clearInterval(deviceFingerprintPollingInterval);
			startAuthentication(supportedVersionsResponse, true);
		} else {
			console.log("No device fingerprint yet...");
		}
	} catch (error) {
		console.error('Error:', error);
	}
}

function performFingerprinting(threeDSMethodURL) {
	console.log("Performing manual device fingerprinting...");

	let deviceFingerprintDiv = document.getElementById("deviceFingerprintDiv");
	let deviceFingerprintIframe = document.createElement("iframe");
	deviceFingerprintIframe.setAttribute("name", "iframe_deviceFingerprint");
	deviceFingerprintIframe.setAttribute("id", "iframe_deviceFingerprint");
	deviceFingerprintIframe.setAttribute("style", "display:none");

	var payload = {
		"threeDSMethodNotificationURL": iframeConfig.threeDSMethodNotificationUrl, // endpoint to recieve notification
		"threeDSServerTransID": supportedVersionsResponse.threeDSecureResponse[0].threeDSServerTransID
	};

	// base64 encode the above payload.
	var encodedPayload = btoa(JSON.stringify(payload));

	// create the form, targeting the hidden iframe
	var form = document.createElement("form");
	form.setAttribute("target", "iframe_deviceFingerprint");
	form.setAttribute("id", "deviceFingerprintForm");
	form.setAttribute("style", "display:none");
	form.method = "POST";
	form.action = threeDSMethodURL;

	// create an input for the encodedPayload and append it to form
	var encodedPayloadInput = document.createElement("input");
	encodedPayloadInput.name = "threeDSMethodData";
	encodedPayloadInput.value = encodedPayload;
	form.appendChild(encodedPayloadInput);

	// append the form to the iframe
	deviceFingerprintIframe.appendChild(form);
	// append the iframe to the div
	deviceFingerprintDiv.appendChild(deviceFingerprintIframe);
	// submit the form, triggering device fingerprint script (process_browser_attributes) execution
	form.submit();
	// At this point, the ACS server has associated the client browser attributes
	// with the 3DSServerTransactionId and the ACS will take those attributes into
	// account when deciding whether or not to challenge Authentications request(s).
}

async function check3dsEnrollment(token) {
	try {
		const response = await fetch(backendServer + '/supportedVersions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ data: token }),
		});
		const responseData = await response.json();
		console.log("Client side response from supported versions: " + JSON.stringify(responseData));
		supportedVersionsResponse = responseData;
		// 200 is enrolled. 400 or others, the card is not enrolled or something else happend
		var cardIsEnrolled = supportedVersionsResponse.thirdPartyStatusCode === "200";
		return cardIsEnrolled;
	} catch (error) {
		console.error("Error while attempting check card 3ds enrollment: " + error);
		return false;
	}
}

async function startAuthentication(supportedVersionsResponse, fingerprintSuccess) {
	let paymentAuthenticationRadio = document.getElementById("paymentAuth");
	let nonPaymentAuthenticationRadio = document.getElementById("nonPaymentAuth");
	let authenticationType;

	if (paymentAuthenticationRadio.checked) {
		authenticationType = paymentAuthenticationRadio.value;
	} else if (nonPaymentAuthenticationRadio.checked) {
		authenticationType = nonPaymentAuthenticationRadio.value;
	}

	let browserDetails = captureBrowserDetails();
	let cardholderDetails = captureCardholderInfo();
	const requestData = {
		authenticationType: authenticationType,
		supportedVersionsResponse: supportedVersionsResponse,
		browserInfo: browserDetails,
		cardholderDetails: cardholderDetails,
		deviceFingerprintSuccess: fingerprintSuccess,
	};

	try {
		const response = await fetch(backendServer + '/authenticate', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(requestData),
		});

		const responseData = await response.json(); // Await to get the JSON data
		handleAuthenticationResponse(responseData);
	} catch (error) {
		console.error("Error while attempting to authenticate the cardholder: " + error);
	}
}

function captureBrowserDetails() {
	let browserInfo = {
		browserLanguage: navigator.language,
		colorDepth: screen.colorDepth,
		screenHeight: screen.height,
		screenWidth: screen.width,
		timeZoneOffset: new Date().getTimezoneOffset()
	}
	return browserInfo;
}

function captureCardholderInfo() {
	let cardholderDetails = {
		fullName: document.getElementById("fullName").value,
		cardExpiration: document.getElementById("expDate").value,
		email: document.getElementById("email").value
	}

	return cardholderDetails;
}

function handleAuthenticationResponse(authenticationResponse) {
	hideLoadingOverlay();
	console.log("authentication response: " + JSON.stringify(authenticationResponse));
	if (authenticationResponse.threeDSecureResponse.transStatus === 'C') {
		displayChallengeModal(authenticationResponse);
	} else {
		displayAuthenticationResultsModal(authenticationResponse);
	}
}

function displayChallengeModal(authenticationResponse) {
	hideLoadingOverlay();
	let challengeIframe = document.createElement("iframe");
	challengeIframe.setAttribute("name", "challengeIframe");
	challengeIframe.setAttribute("id", "challengeIframe");
	challengeIframe.setAttribute("class", "w3-modal-content w3-display-middle");
	challengeIframe.setAttribute("height", "70%");
	challengeIframe.setAttribute("width", "100%");

	// Create a form to submit to the acsURL
	let form = document.createElement("form");
	form.method = "POST";
	form.action = authenticationResponse.threeDSecureResponse.acsURL;

	// Set the form's target to match the iframe's name
	form.target = "challengeIframe";
	form.setAttribute("id", "challengeRequestForm");

	// Create an input field for the creq parameter
	let creqInput = document.createElement("input");
	creqInput.type = "hidden";
	creqInput.name = "creq";
	creqInput.value = authenticationResponse.threeDSecureResponse.encodedCReq;
	form.appendChild(creqInput);

	challengeIframe.appendChild(form);

	let modal = document.getElementById("challengeDiv")
	modal.appendChild(challengeIframe);
	modal.style.display = 'block';

	form.submit();
	challengeIframe.removeChild(form);

	challengeResultPollingInterval = setInterval(pollForChallengeResults, 1000);
}

async function pollForChallengeResults() {
	let transId = tokenExIframePerformingDeviceFingerprinting
		? tokenizeResponse.threeDSecureResponse[0].threeDSServerTransID
		: supportedVersionsResponse.threeDSecureResponse[0].threeDSServerTransID;

	console.log("Polling for challenge results...");
	const headers = {
		'Content-Type': 'application/json',
	};
	try {
		const response = await fetch(backendServer + '/challengeResults', {
			method: 'POST',
			headers: headers,
			body: JSON.stringify({ threeDSServerTransID: transId }),
		});

		console.log("Received response to challenge results poll: " + response.status);

		if (response.ok) {
			const responseData = await response.json(); // Await to get the JSON data
			console.log("Client side received challenge results: " + JSON.stringify(responseData));
			document.getElementById('challengeDiv').style.display = 'none';
			displayAuthenticationResultsModal(responseData);
			clearInterval(challengeResultPollingInterval);
		} else {
			console.log("No challenge result yet...");
		}
	} catch (error) {
		console.error('Error:', error);
	}
}

function displayAuthenticationResultsModal(contentToDisplay) {
	let modalContent = document.createElement('div');
	modalContent.setAttribute("class", "w3-modal-content w3-display-middle");
	let content = document.createElement('div');
	content.setAttribute('class', 'w3-container');
	content.innerHTML =
		`<h3>Cardholder Authentication Results</h3>
	  <p>TransStatus: ${contentToDisplay.threeDSecureResponse.transStatus}</p>
	  <p>ECI: ${contentToDisplay.threeDSecureResponse.eci}</p>
	  <p>AuthenticationValue: ${contentToDisplay.threeDSecureResponse.authenticationValue}</p>
	  <p>ACS TransID: ${contentToDisplay.threeDSecureResponse.acsTransID}</p>
	  <p>3DS Server TransID: ${contentToDisplay.threeDSecureResponse.threeDSServerTransID}</p>
	  <p>Error Code: ${contentToDisplay.threeDSecureResponse.errorCode}</p>
	  <p>Error Detail: ${contentToDisplay.threeDSecureResponse.errorDetail}</p>`;

	// Create a button container for centering
	let buttonContainer = document.createElement('div');
	buttonContainer.setAttribute('style', 'text-align: center;');

	// Create a button element for reloading the page
	let reloadButton = document.createElement('button');
	reloadButton.setAttribute('class', "w3-button w3-blue-grey");
	reloadButton.textContent = 'Reload for New Test Card';

	// Add an event listener to the button to reload the page when clicked
	reloadButton.addEventListener('click', () => {
		location.reload();
	});

	// Append the button to the button container
	buttonContainer.appendChild(reloadButton);

	// Append the content and button container to the modalContent
	modalContent.appendChild(content);
	modalContent.appendChild(buttonContainer);

	// Add modalContent to your modal element
	let modal = document.getElementById("resultsDiv");
	modal.appendChild(modalContent);
	modal.style.display = 'block';
}

function showLoadingOverlay() {
	const overlay = document.getElementById('overlay');
	if (overlay) {
		overlay.style.display = 'block';
	}
}

function hideLoadingOverlay() {
	const overlay = document.getElementById('overlay');
	if (overlay) {
		overlay.style.display = 'none';
	}
}