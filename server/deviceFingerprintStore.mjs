var deviceFingerprints = [];

function addToStore(id) {
    console.log("Adding to Device Fingerprints: id = " + id);
    deviceFingerprints.push(id);
}

function removeFromStore(id) {
    const index = deviceFingerprints.indexOf(id);
    if (index !== -1) {
        console.log("Removing from Device Fingerprints: id = " + id);
        deviceFingerprints.splice(index, 1);
    }
}

function isDeviceFingerprinted(id) {
    return deviceFingerprints.includes(id);
}

function getDeviceFingerprints() {
    return deviceFingerprints;
}

export default {
    addToStore,
    removeFromStore,
    isDeviceFingerprinted,
    getDeviceFingerprints
};
