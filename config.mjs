export const config = {
    port: 9943,
    supportedVersionsEndpoint: 'https://test-api.tokenex.com/v2/ThreeDSecure/SupportedVersions',
    authenticationEndpoint: 'https://test-api.tokenex.com/v2/ThreeDSecure/Authentications',
    challengeResultsEndpoint: 'https://test-api.tokenex.com/v2/ThreeDSecure/ChallengeResults',
    challengeNotificationUrl: 'https://webhook.site/387fd328-9109-4331-bf50-7cca76978c19', // localhosting will need a redirect set up in a webhook.site or other hosted endpoint
    txTokenExId: '',
    txApiKey: '',
};
