const dbName = 'mediaCacheDB';
const storeName = 'mediaStore';
  
// Function to open or create the IndexedDB database


async function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            const store = db.createObjectStore(storeName, {keyPath: 'track_id'});
            store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            reject('Error opening IndexedDB:', event.target.errorCode);
        };
    });
}

async function cacheMedia(db, track_id, blob) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const currentTime = new Date().toISOString();
        const request = store.put({ track_id, audioBlob: blob, lastAccessed: currentTime });
        
        request.onsuccess = () => resolve();
        request.onerror = event => reject(`Error caching audio: ${event.target.errorCode}`);
    });
}

async function getCachedMedia(db, track_id) {
    return new Promise((resolve, reject) => {
        if (typeof track_id !== 'string' || !track_id) {
            reject('Invalid Track Id: Id must be a non-empty string');
            return;
        }

        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.get(track_id);

        request.onsuccess = (event) => {
            const result = event.target.result;
            if (result && result.audioBlob) {
                // Update lastAccessed timestamp
                result.lastAccessed = new Date().toISOString();
                store.put(result);
                resolve(result.audioBlob);
            } else {
                resolve(null); // Key does not exist
            }
        };

        request.onerror = event => reject(`Error fetching cached audio: ${event.target.errorCode}`);
    });
}

async function loadVideo() {
    // read the url and track_id from document
    const trackId = document.getElementById("track-id").value;
    const inputURL = document.getElementById("input-url").value;
    console.log(`Loading track ${trackId}`);
    try {
        const db = await openDatabase();
        let audioBlob  = await getCachedMedia(db, trackId);

        if (!audioBlob ) {
            console.log('Audio not cached, fetching from network...');
            // Define the payload with the URL parameter
            const payload = {
                url: inputURL 
            };
            const response = await fetch('http://127.0.0.1:5000/get_audio', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            audioBlob  = await response.blob();
            cacheMedia(db, trackId, audioBlob);  // I don't make this call with await to do it asyncronously
            console.log('Fetched and cached media');
        } else {
            console.log('Loaded media from cache');
        }

        const audioURL  = URL.createObjectURL(audioBlob);
        
        const videoPlayer = document.getElementById('videoPlayer');
        videoPlayer.src = audioURL;
        videoPlayer.play();
    } catch (error) {
        console.error('Error loading video:', error);
    }
}

async function checkStorageUsage() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage; // bytes used by all storage
        const quota = estimate.quota; // total available quota

        // console.log(`Storage usage: ${bytesToMB(usage)} MB`);
        console.log(`Storage quota: ${bytesToMB(quota)} MB`);
        console.log(`Percentage used: ${(usage / quota * 100).toFixed(2)}%`);

        // Estimate the IndexedDB usage
        if (estimate.usageDetails && estimate.usageDetails.indexedDB) {
            const estimateIndexedDB = `Storage usage: ${bytesToMB(estimate.usageDetails.indexedDB)} MB`;
            console.log(estimateIndexedDB);
            return estimateIndexedDB;
        }
    } else {
        console.log('Storage estimation is not supported in this browser.');
        return 'Storage estimation is not supported in this browser.'
    }
}

function deleteOldRecords(db, noDays) {
// Function to delete records that haven't been accessed in the last 3 months
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const index = store.index('lastAccessed');
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getDate() - noDays);

        const range = IDBKeyRange.upperBound(cutoffDate.toISOString());
        const request = index.openCursor(range);

        request.onsuccess = event => {
            const cursor = event.target.result;
            if (cursor) {
                store.delete(cursor.primaryKey);
                console.log(`Deleted item ${cursor.primaryKey}`)
                cursor.continue();
            } else {
                resolve();
            }
        };

        request.onerror = event => reject(`Error deleting old records: ${event.target.errorCode}`);
    });
}

async function cleanupOldRecords() {
// Example usage to delete old records
    try {
        const db = await openDatabase();
        await deleteOldRecords(db, 90);
        console.log('Old records cleaned up successfully.');
    } catch (error) {
        console.error('Error during cleanup:', error);
    }
}

function clearObjectStore() {
// Clear all records from the database without deleting the entire database
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName);

        request.onsuccess = event => {
            const db = event.target.result;
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const clearRequest = store.clear();

            clearRequest.onsuccess = () => {
                console.log(`Object store ${storeName} cleared successfully`);
                resolve();
            };

            clearRequest.onerror = event => {
                console.error(`Failed to clear object store ${storeName}:`, event.target.errorCode);
                reject(event.target.errorCode);
            };
        };

        request.onerror = event => {
            console.error(`Failed to open database ${dbName}:`, event.target.errorCode);
            reject(event.target.errorCode);
        };
    });
}

function deleteDatabase() {
// Deletes the entire database
    return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(dbName);

        request.onsuccess = () => {
            console.log(`Database ${dbName} deleted successfully`);
            resolve();
        };

        request.onerror = event => {
            console.error(`Failed to delete database ${dbName}:`, event.target.errorCode);
            reject(event.target.errorCode);
        };

        request.onblocked = () => {
            console.warn(`Deletion of database ${dbName} is blocked`);
            reject('Deletion blocked');
        };
    });
}

function bytesToMB(bytesInt){
    return (bytesInt / 1024 / 1024).toFixed(0);
}

function greet() {
    return('Hello World!');
}