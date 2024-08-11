// Done, limits in API calls!
// Done, limit what I get in tracks specially &fields=items(track(!available_markets,album(!available_markets)))
// To do, there is a preview video, to use video_thumbnail
// Done, start caching stuff

const mode = "prod"

const scope = "user-read-private playlist-read-private user-read-email";

let urlObj = new URL(window.location.href);
// Set the redirectURI to the current page without parameters
let redirectURI = urlObj.origin + urlObj.pathname;

const params = new URLSearchParams(window.location.search);
const code = params.get("code");
const clientId = getClientID();
const clientSecret = getClientSecret();

if (mode != 'dry-run'){
    if (!clientId || !clientSecret) {
        alert('Add a clientId= and clientSecret= to the URL');
        // Finalize execution
        throw new Error("Stopping execution");  // Finalize execution
    }

    if (!code) {
        redirectToAuthCodeFlow(clientId);
    }
}

function getClientID() {
	const clientIdParam = params.get("clientId");
	if (clientIdParam) {
		localStorage.setItem("clientId", clientIdParam);
		return clientIdParam;
	}
	const clientIdlocalStorage = localStorage.getItem("clientId");
	if (clientIdlocalStorage) {
		return clientIdlocalStorage;
	}
}

function getClientSecret() {
	const clientSecretParam = params.get("clientSecret");
	if (clientSecretParam) {
		localStorage.setItem("clientSecret", clientSecretParam);
		return clientSecretParam;
	}
	const clientSecretlocalStorage = localStorage.getItem("clientSecret");
	if (clientSecretlocalStorage) {
		return clientSecretlocalStorage;
	}
}

export async function getSpotifyAccessToken() {
    if (mode=='dry-run'){
        return 'dummyToken';  // Finalize execution
    }
    
    const verifier = localStorage.getItem("verifier");

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", redirectURI);
    params.append("client_secret", clientSecret);

    try {
        const response = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params
        });
        if (response.ok) {
            const responseData = await response.json(); // Parse the response as JSON
            return responseData.access_token;
        } else {
            console.error('Error exchanging code: ' + response.status + " " + response.statusText);
        }

    } catch (error) {
        console.log('Error during the request: ' + error.message);
    }
}

export async function fetchSpotifyProfile(token) {
    if (mode=='dry-run'){
        return sampleProfile;  // Finalize execution
    }

    const endpoint = "https://api.spotify.com/v1/me";

    try {
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Error fetching profile: ${response.statusText}`);
        }

        const data = await response.json();
        return data; 
    } catch (error) {
        console.error('Error fetching Spotify profile:', error);
        return null;
    }
}

export async function fetchSpotifyPlaylists(token, userId) {
    if (mode=='dry-run'){
        return samplePlaylists;  // Finalize execution
    }

    const endpoint = `https://api.spotify.com/v1/users/${userId}/playlists?limit=50`;

    return fetchSpotifyList(token, userId + '-spotify-playlists', endpoint, 'playlists');
}

export async function fetchSpotifyPlaylistTracks(token, playlistId) {
  if (mode=='dry-run'){
      return sampleTracks;  // Finalize execution
  }
  const fields = 'fields=next,items(track(preview_url,name,id,album(name,images)),video_thumbnail)'
  var endpoint = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?${fields}&limit=50`;
  
  return fetchSpotifyList(token, playlistId, endpoint, 'tracks');
}

async function fetchSpotifyList(token, id, endpoint, object_type){
  // Retrieving cached data
  const cachedData = sessionStorage.getItem(id);
  if (cachedData) {
    return JSON.parse(cachedData);
  }

  var items = [];
  try {
        while (endpoint) {
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Error fetching ${object_type}: ${response.statusText}`);
            }

            const data = await response.json();
            if ('items' in data) {
                items = items.concat(data.items);
            } else {
                console.error(`Error fetching Spotify ${object_type}, data has no items`);
            }
            endpoint = data.next;  // send endpoint to the URL for the next batch, null when done
        }
        // Caching data
        sessionStorage.setItem(id, JSON.stringify(items));
        return items;
  } catch (error) {
      console.error('Error fetching Spotify ',object_type, error);
      return null;
  }  
}

export async function fetchTrackStream(trackId){
  //if (mode=='dry-run'){
  //    return sampleStream;  // Finalize execution
  //}

  const endpoint = `https://api.spotifydown.com/download/${trackId}`;
  try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Accept': 'application/json',
            'Accept-Language': getRandomFromList(ACCEPT_LANGUAGE_LIST),
            'Origin': 'https://spotifydown.com',
            'Referer': 'https://spotifydown.com/',
            'User-Agent': getRandomFromList(USER_AGENT_LIST),
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Ch-Ua': '"' + getRandomFromList(BROWSER_LIST) + '";v="' + 
              getRandomInt(80, 99).toString() + '", "Chromium";v="' + getRandomInt(80, 99).toString() + '", "Not?A_Brand";v="' + getRandomInt(20, 30).toString() + '"',
            'Sec-Ch-Ua-Mobile': '?' + getRandomInt(0, 1).toString(),
            'Sec-Ch-Ua-Platform': getRandomFromList(PLATFORM_LIST),         
        }
      });
      if (!response.ok) {
        throw new Error(`Error fetching Track Stream for ${trackId}: ${response.statusText}`);
      }
      const data = await response.json();
      if (data) {
          return data;
      } else {
          console.error(`Error fetching Spotify ${object_type}, data has no items`);
      }
  } catch (error) {
        console.error('Error fetching Track stream ',trackId, error);
    return null;   
  }

}

async function redirectToAuthCodeFlow(clientId) {
    const verifier = generateCodeVerifier(128);
    const challenge = await generateCodeChallenge(verifier);

    localStorage.setItem("verifier", verifier);

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("response_type", "code");
    params.append("redirect_uri", redirectURI);
    params.append("scope", scope);
    params.append("state",generateRandomString(16));

    document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function generateCodeVerifier(length) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  
    for (let i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
  
    return text;
}

function getRandomFromList (list) {
  return list[Math.floor((Math.random()*list.length))];
}

function getRandomInt(min, max) {
  const minCeiled = Math.ceil(min);
  const maxFloored = Math.floor(max);
  return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled); // The maximum is exclusive and the minimum is inclusive
}

// Constants

const ACCEPT_LANGUAGE_LIST = ["de",
  "de-CH",
  "en-US,en;q=0.5",
  "es-ES,es;q=0.9,en;q=0.8",
  "en-US,fr-CA",
  "fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7, *;q=0",
  "da, en-gb;q=0.8, en;q=0.7"]

const USER_AGENT_LIST = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36",
    "Mozilla/5.0 (iPhone; U; CPU iPhone OS 3_1_2 like Mac OS X; en-us) AppleWebKit/528.18 (KHTML, like Gecko) Version/4.0 Mobile/7D11 Safari/528.16",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:77.0) Gecko/20100101 Firefox/77.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.97 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:77.0) Gecko/20100101 Firefox/77.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.97 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:47.0) Gecko/20100101 Firefox/47.3",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X x.y; rv:42.0) Gecko/20100101 Firefox/43.4",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 11_3_1 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.0 Mobile/14E304 Safari/602.1",
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.65 Mobile Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:47.0) Gecko/20100101 Firefox/47.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X x.y; rv:42.0) Gecko/20100101 Firefox/42.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.106 Safari/537.36 OPR/38.0.2220.41",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 13_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Mobile/15E148 Safari/604.1"]

const BROWSER_LIST = ["Google Chrome", "Microsoft Edge", "Opera"]

const PLATFORM_LIST = ["Android", "Chrome OS", "Chromium OS", "iOS", "Linux", "macOS", "Windows"]

// Sample Data

const sampleProfile = {
    "display_name": "Philip J Fry",
    "external_urls": {
      "spotify": "https://open.spotify.com/user/philipjfry"
    },
    "href": "https://api.spotify.com/v1/users/philipjfry",
    "id": "philipjfry",
    "images": [{"url":"https://s2-ug.ap4r.com/image-aigc-article/seoPic/origin/d08189b4edaf89cbe2b04914fa12732df80b3032.jpg"}],
    "type": "user",
    "uri": "spotify:user:philipjfry",
    "followers": {
      "href": null,
      "total": 10
    },
    "country": "ES",
    "product": "free",
    "explicit_content": {
      "filter_enabled": false,
      "filter_locked": false
    },
    "email": "philipjfry@gmail.com"
  }

const samplePlaylists = [
  {
    "collaborative" : false,
    "description" : "A playlist for testing pourposes",
    "external_urls" : {
      "spotify" : "http://open.spotify.com/user/jmperezperez/playlist/3cEYpjA9oz9GiPac4AsH4n"
    },
    "followers" : {
      "href" : null,
      "total" : 6
    },
    "href" : "https://api.spotify.com/v1/users/jmperezperez/playlists/3cEYpjA9oz9GiPac4AsH4n",
    "id" : "3cEYpjA9oz9GiPac4AsH4n",
    "images" : [ {
      "height" : null,
      "url" : "https://u.scdn.co/images/pl/default/15e1e401aca06139b92bb116834a8324d03d4fd1",
      "width" : null
    } ],
    "name" : "Spotify Web API Testing playlist",
    "owner" : {
      "external_urls" : {
        "spotify" : "http://open.spotify.com/user/jmperezperez"
      },
      "href" : "https://api.spotify.com/v1/users/jmperezperez",
      "id" : "jmperezperez",
      "type" : "user",
      "uri" : "spotify:user:jmperezperez"
    },
    "public" : true,
    "snapshot_id" : "OO6GcckxJ416i8dVUSXH0xscQyX6CwEP14rp5JH+nM/Yd6YA9HTuT7F39uC6Y6MJ",
    "tracks" : {
      "href" : "https://api.spotify.com/v1/users/jmperezperez/playlists/3cEYpjA9oz9GiPac4AsH4n/tracks?offset=0&limit=100&market=ES",
      "items" : [ {
        "added_at" : "2015-01-15T12:39:22Z",
        "added_by" : {
          "external_urls" : {
            "spotify" : "http://open.spotify.com/user/jmperezperez"
          },
          "href" : "https://api.spotify.com/v1/users/jmperezperez",
          "id" : "jmperezperez",
          "type" : "user",
          "uri" : "spotify:user:jmperezperez"
        },
        "is_local" : false,
        "track" : {
          "album" : {
            "album_type" : "album",
            "external_urls" : {
              "spotify" : "https://open.spotify.com/album/2pANdqPvxInB0YvcDiw4ko"
            },
            "href" : "https://api.spotify.com/v1/albums/2pANdqPvxInB0YvcDiw4ko",
            "id" : "2pANdqPvxInB0YvcDiw4ko",
            "images" : [ {
              "height" : 640,
              "url" : "https://i.scdn.co/image/599c4ead3874e1e66368e8cf3721b9f79116b328",
              "width" : 640
            }, {
              "height" : 300,
              "url" : "https://i.scdn.co/image/6f31225bf642a58f29a80ca51769c8c588cccdee",
              "width" : 300
            }, {
              "height" : 64,
              "url" : "https://i.scdn.co/image/1a8532495d73b657d592196bfdd9cb980f61443f",
              "width" : 64
            } ],
            "name" : "Progressive Psy Trance Picks Vol.8",
            "type" : "album",
            "uri" : "spotify:album:2pANdqPvxInB0YvcDiw4ko"
          },
          "artists" : [ {
            "external_urls" : {
              "spotify" : "https://open.spotify.com/artist/6eSdhw46riw2OUHgMwR8B5"
            },
            "href" : "https://api.spotify.com/v1/artists/6eSdhw46riw2OUHgMwR8B5",
            "id" : "6eSdhw46riw2OUHgMwR8B5",
            "name" : "Odiseo",
            "type" : "artist",
            "uri" : "spotify:artist:6eSdhw46riw2OUHgMwR8B5"
          } ],
          "disc_number" : 1,
          "duration_ms" : 376000,
          "explicit" : false,
          "external_ids" : {
            "isrc" : "DEKC41200989"
          },
          "external_urls" : {
            "spotify" : "https://open.spotify.com/track/4rzfv0JLZfVhOhbSQ8o5jZ"
          },
          "href" : "https://api.spotify.com/v1/tracks/4rzfv0JLZfVhOhbSQ8o5jZ",
          "id" : "4rzfv0JLZfVhOhbSQ8o5jZ",
          "is_playable" : true,
          "name" : "Api",
          "popularity" : 6,
          "preview_url" : "https://p.scdn.co/mp3-preview/9a149a9366c5bcb3e8b947b00f26e74be7b8aca6",
          "track_number" : 10,
          "type" : "track",
          "uri" : "spotify:track:4rzfv0JLZfVhOhbSQ8o5jZ"
        }
      }, {
        "added_at" : "2015-01-15T12:40:03Z",
        "added_by" : {
          "external_urls" : {
            "spotify" : "http://open.spotify.com/user/jmperezperez"
          },
          "href" : "https://api.spotify.com/v1/users/jmperezperez",
          "id" : "jmperezperez",
          "type" : "user",
          "uri" : "spotify:user:jmperezperez"
        },
        "is_local" : false,
        "track" : {
          "album" : {
            "album_type" : "compilation",
            "external_urls" : {
              "spotify" : "https://open.spotify.com/album/6nlfkk5GoXRL1nktlATNsy"
            },
            "href" : "https://api.spotify.com/v1/albums/6nlfkk5GoXRL1nktlATNsy",
            "id" : "6nlfkk5GoXRL1nktlATNsy",
            "images" : [ {
              "height" : 640,
              "url" : "https://i.scdn.co/image/385bd8f5109c00d9b43842ba5b99e9e82f7156f8",
              "width" : 640
            }, {
              "height" : 300,
              "url" : "https://i.scdn.co/image/4a06e9a60a90529dea773326219ae6d4c7c422c2",
              "width" : 300
            }, {
              "height" : 64,
              "url" : "https://i.scdn.co/image/d076d09bea0978819ade083856f80d73e2438adc",
              "width" : 64
            } ],
            "name" : "Wellness & Dreaming Source 🎉🎉",
            "type" : "album",
            "uri" : "spotify:album:6nlfkk5GoXRL1nktlATNsy"
          },
          "artists" : [ {
            "external_urls" : {
              "spotify" : "https://open.spotify.com/artist/5VQE4WOzPu9h3HnGLuBoA6"
            },
            "href" : "https://api.spotify.com/v1/artists/5VQE4WOzPu9h3HnGLuBoA6",
            "id" : "5VQE4WOzPu9h3HnGLuBoA6",
            "name" : "Vlasta Marek",
            "type" : "artist",
            "uri" : "spotify:artist:5VQE4WOzPu9h3HnGLuBoA6"
          } ],
          "disc_number" : 1,
          "duration_ms" : 730066,
          "explicit" : false,
          "external_ids" : {
            "isrc" : "FR2X41475057"
          },
          "external_urls" : {
            "spotify" : "https://open.spotify.com/track/5o3jMYOSbaVz3tkgwhELSV"
          },
          "href" : "https://api.spotify.com/v1/tracks/5o3jMYOSbaVz3tkgwhELSV",
          "id" : "5o3jMYOSbaVz3tkgwhELSV",
          "is_playable" : true,
          "name" : "Is",
          "popularity" : 0,
          "preview_url" : "https://p.scdn.co/mp3-preview/eee08812f2d21e00a802e1f0c9b1950a8acc6cf3",
          "track_number" : 21,
          "type" : "track",
          "uri" : "spotify:track:5o3jMYOSbaVz3tkgwhELSV"
        }
      }, {
        "added_at" : "2015-01-15T12:22:30Z",
        "added_by" : {
          "external_urls" : {
            "spotify" : "http://open.spotify.com/user/jmperezperez"
          },
          "href" : "https://api.spotify.com/v1/users/jmperezperez",
          "id" : "jmperezperez",
          "type" : "user",
          "uri" : "spotify:user:jmperezperez"
        },
        "is_local" : false,
        "track" : {
          "album" : {
            "album_type" : "album",
            "external_urls" : {
              "spotify" : "https://open.spotify.com/album/4hnqM0JK4CM1phwfq1Ldyz"
            },
            "href" : "https://api.spotify.com/v1/albums/4hnqM0JK4CM1phwfq1Ldyz",
            "id" : "4hnqM0JK4CM1phwfq1Ldyz",
            "images" : [ {
              "height" : 640,
              "url" : "https://i.scdn.co/image/bb554141168b348d207c7a010cdafc7d2a4e88f8",
              "width" : 640
            }, {
              "height" : 300,
              "url" : "https://i.scdn.co/image/95010e3a7b14f31842dd13ff170a6b761848b67c",
              "width" : 300
            }, {
              "height" : 64,
              "url" : "https://i.scdn.co/image/4e9d34c73fd40bbb99c9095eb8ffa6ca1b4b3f08",
              "width" : 64
            } ],
            "name" : "This Is Happening",
            "type" : "album",
            "uri" : "spotify:album:4hnqM0JK4CM1phwfq1Ldyz"
          },
          "artists" : [ {
            "external_urls" : {
              "spotify" : "https://open.spotify.com/artist/066X20Nz7iquqkkCW6Jxy6"
            },
            "href" : "https://api.spotify.com/v1/artists/066X20Nz7iquqkkCW6Jxy6",
            "id" : "066X20Nz7iquqkkCW6Jxy6",
            "name" : "LCD Soundsystem",
            "type" : "artist",
            "uri" : "spotify:artist:066X20Nz7iquqkkCW6Jxy6"
          } ],
          "disc_number" : 1,
          "duration_ms" : 401440,
          "explicit" : false,
          "external_ids" : {
            "isrc" : "US4GE1000022"
          },
          "external_urls" : {
            "spotify" : "https://open.spotify.com/track/4Cy0NHJ8Gh0xMdwyM9RkQm"
          },
          "href" : "https://api.spotify.com/v1/tracks/4Cy0NHJ8Gh0xMdwyM9RkQm",
          "id" : "4Cy0NHJ8Gh0xMdwyM9RkQm",
          "is_playable" : true,
          "name" : "All I Want",
          "popularity" : 41,
          "preview_url" : "https://p.scdn.co/mp3-preview/86fceada0dbee180eb28162cd1365cb4e0dcf19a",
          "track_number" : 4,
          "type" : "track",
          "uri" : "spotify:track:4Cy0NHJ8Gh0xMdwyM9RkQm"
        }
      }, {
        "added_at" : "2015-01-15T12:40:35Z",
        "added_by" : {
          "external_urls" : {
            "spotify" : "http://open.spotify.com/user/jmperezperez"
          },
          "href" : "https://api.spotify.com/v1/users/jmperezperez",
          "id" : "jmperezperez",
          "type" : "user",
          "uri" : "spotify:user:jmperezperez"
        },
        "is_local" : false,
        "track" : {
          "album" : {
            "album_type" : "album",
            "external_urls" : {
              "spotify" : "https://open.spotify.com/album/2usKFntxa98WHMcyW6xJBz"
            },
            "href" : "https://api.spotify.com/v1/albums/2usKFntxa98WHMcyW6xJBz",
            "id" : "2usKFntxa98WHMcyW6xJBz",
            "images" : [ {
              "height" : 636,
              "url" : "https://i.scdn.co/image/8d044068c7140d1d39dc6951eff37ac6150b4e8b",
              "width" : 640
            }, {
              "height" : 298,
              "url" : "https://i.scdn.co/image/911ed9ef8d2e513b2cf90472394193b0ece315f7",
              "width" : 300
            }, {
              "height" : 64,
              "url" : "https://i.scdn.co/image/51e7b672cfc8f58c97f39704cb9687bdf2e89797",
              "width" : 64
            } ],
            "name" : "Glenn Horiuchi Trio / Gelenn Horiuchi Quartet: Mercy / Jump Start / Endpoints / Curl Out / Earthworks / Mind Probe / Null Set / Another Space (A)",
            "type" : "album",
            "uri" : "spotify:album:2usKFntxa98WHMcyW6xJBz"
          },
          "artists" : [ {
            "external_urls" : {
              "spotify" : "https://open.spotify.com/artist/272ArH9SUAlslQqsSgPJA2"
            },
            "href" : "https://api.spotify.com/v1/artists/272ArH9SUAlslQqsSgPJA2",
            "id" : "272ArH9SUAlslQqsSgPJA2",
            "name" : "Glenn Horiuchi Trio",
            "type" : "artist",
            "uri" : "spotify:artist:272ArH9SUAlslQqsSgPJA2"
          } ],
          "disc_number" : 1,
          "duration_ms" : 358760,
          "explicit" : false,
          "external_ids" : {
            "isrc" : "USB8U1025969"
          },
          "external_urls" : {
            "spotify" : "https://open.spotify.com/track/6hvFrZNocdt2FcKGCSY5NI"
          },
          "href" : "https://api.spotify.com/v1/tracks/6hvFrZNocdt2FcKGCSY5NI",
          "id" : "6hvFrZNocdt2FcKGCSY5NI",
          "is_playable" : true,
          "name" : "Endpoints",
          "popularity" : 0,
          "preview_url" : "https://p.scdn.co/mp3-preview/04f45b1295cf1baf372484fa1ede9f8e00444ee2",
          "track_number" : 2,
          "type" : "track",
          "uri" : "spotify:track:6hvFrZNocdt2FcKGCSY5NI"
        }
      }, {
        "added_at" : "2015-01-15T12:41:10Z",
        "added_by" : {
          "external_urls" : {
            "spotify" : "http://open.spotify.com/user/jmperezperez"
          },
          "href" : "https://api.spotify.com/v1/users/jmperezperez",
          "id" : "jmperezperez",
          "type" : "user",
          "uri" : "spotify:user:jmperezperez"
        },
        "is_local" : false,
        "track" : {
          "album" : {
            "album_type" : "album",
            "external_urls" : {
              "spotify" : "https://open.spotify.com/album/0ivM6kSawaug0j3tZVusG2"
            },
            "href" : "https://api.spotify.com/v1/albums/0ivM6kSawaug0j3tZVusG2",
            "id" : "0ivM6kSawaug0j3tZVusG2",
            "images" : [ {
              "height" : 634,
              "url" : "https://i.scdn.co/image/fa826e26b0d7683327317d9f4a4909f64cab281b",
              "width" : 640
            }, {
              "height" : 297,
              "url" : "https://i.scdn.co/image/5421e1bb2497eee2ba437db930eb831d0669a66b",
              "width" : 300
            }, {
              "height" : 63,
              "url" : "https://i.scdn.co/image/e3c51dadaa16361d247bb38b6f9e505f8d5ae6b1",
              "width" : 64
            } ],
            "name" : "All The Best",
            "type" : "album",
            "uri" : "spotify:album:0ivM6kSawaug0j3tZVusG2"
          },
          "artists" : [ {
            "external_urls" : {
              "spotify" : "https://open.spotify.com/artist/2KftmGt9sk1yLjsAoloC3M"
            },
            "href" : "https://api.spotify.com/v1/artists/2KftmGt9sk1yLjsAoloC3M",
            "id" : "2KftmGt9sk1yLjsAoloC3M",
            "name" : "Zucchero",
            "type" : "artist",
            "uri" : "spotify:artist:2KftmGt9sk1yLjsAoloC3M"
          } ],
          "disc_number" : 1,
          "duration_ms" : 176093,
          "explicit" : false,
          "external_ids" : {
            "isrc" : "ITUM70701043"
          },
          "external_urls" : {
            "spotify" : "https://open.spotify.com/track/2E2znCPaS8anQe21GLxcvJ"
          },
          "href" : "https://api.spotify.com/v1/tracks/2E2znCPaS8anQe21GLxcvJ",
          "id" : "2E2znCPaS8anQe21GLxcvJ",
          "is_playable" : true,
          "name" : "You Are So Beautiful",
          "popularity" : 24,
          "preview_url" : "https://p.scdn.co/mp3-preview/abaf2d95d7da2f7740690ea0b4b02fb817396a9d",
          "track_number" : 18,
          "type" : "track",
          "uri" : "spotify:track:2E2znCPaS8anQe21GLxcvJ"
        }
      } ],
      "limit" : 100,
      "next" : null,
      "offset" : 0,
      "previous" : null,
      "total" : 5
    },
    "type" : "playlist",
    "uri" : "spotify:user:jmperezperez:playlist:3cEYpjA9oz9GiPac4AsH4n"
  }
  ]

const sampleTracks = [
  {
    "added_at": "2020-01-01T02:08:19Z",
    "added_by": {
      "external_urls": {
        "spotify": "https://open.spotify.com/user/n2bgnd81744fsvs9rv0thwvt2"
      },
      "href": "https://api.spotify.com/v1/users/n2bgnd81744fsvs9rv0thwvt2",
      "id": "n2bgnd81744fsvs9rv0thwvt2",
      "type": "user",
      "uri": "spotify:user:n2bgnd81744fsvs9rv0thwvt2"
    },
    "is_local": false,
    "primary_color": null,
    "track": {
      "preview_url": "https://p.scdn.co/mp3-preview/30a104b51a8421c4189840e1225edf06ca28cb24?cid=8823b95d7ebe4baebde911437019bbb0",
	  "explicit": false,
      "type": "track",
      "episode": false,
      "track": true,
      "album": {
        "type": "album",
        "album_type": "album",
        "href": "https://api.spotify.com/v1/albums/4OGSmLOdkp7p2SqdAY1ocU",
        "id": "4OGSmLOdkp7p2SqdAY1ocU",
        "images": [
          {
            "height": 640,
            "url": "https://i.scdn.co/image/ab67616d0000b27338968dc90dc0ff8fc1d7b866",
            "width": 640
          },
          {
            "height": 300,
            "url": "https://i.scdn.co/image/ab67616d00001e0238968dc90dc0ff8fc1d7b866",
            "width": 300
          },
          {
            "height": 64,
            "url": "https://i.scdn.co/image/ab67616d0000485138968dc90dc0ff8fc1d7b866",
            "width": 64
          }
        ],
        "name": "Complicado (Edición Deluxe)",
        "release_date": "2018-09-14",
        "release_date_precision": "day",
        "uri": "spotify:album:4OGSmLOdkp7p2SqdAY1ocU",
        "artists": [
          {
            "external_urls": {
              "spotify": "https://open.spotify.com/artist/3IJtdFn9IKbFvNvZqOJA46"
            },
            "href": "https://api.spotify.com/v1/artists/3IJtdFn9IKbFvNvZqOJA46",
            "id": "3IJtdFn9IKbFvNvZqOJA46",
            "name": "Blas Cantó",
            "type": "artist",
            "uri": "spotify:artist:3IJtdFn9IKbFvNvZqOJA46"
          }
        ],
        "external_urls": {
          "spotify": "https://open.spotify.com/album/4OGSmLOdkp7p2SqdAY1ocU"
        },
        "total_tracks": 16
      },
      "artists": [
        {
          "external_urls": {
            "spotify": "https://open.spotify.com/artist/3IJtdFn9IKbFvNvZqOJA46"
          },
          "href": "https://api.spotify.com/v1/artists/3IJtdFn9IKbFvNvZqOJA46",
          "id": "3IJtdFn9IKbFvNvZqOJA46",
          "name": "Blas Cantó",
          "type": "artist",
          "uri": "spotify:artist:3IJtdFn9IKbFvNvZqOJA46"
        }
      ],
      "disc_number": 1,
      "track_number": 1,
      "duration_ms": 279240,
      "external_ids": {
        "isrc": "ES5151800673"
      },
      "external_urls": {
        "spotify": "https://open.spotify.com/track/38mCl4EuWhML4eaZPdNQ3a"
      },
      "href": "https://api.spotify.com/v1/tracks/38mCl4EuWhML4eaZPdNQ3a",
      "id": "38mCl4EuWhML4eaZPdNQ3a",
      "name": "Él no soy yo",
      "popularity": 45,
      "uri": "spotify:track:38mCl4EuWhML4eaZPdNQ3a",
      "is_local": false
    },
    "video_thumbnail": {
      "url": null
    }
  },
  {
    "added_at": "2020-01-01T02:08:23Z",
    "added_by": {
      "external_urls": {
        "spotify": "https://open.spotify.com/user/n2bgnd81744fsvs9rv0thwvt2"
      },
      "href": "https://api.spotify.com/v1/users/n2bgnd81744fsvs9rv0thwvt2",
      "id": "n2bgnd81744fsvs9rv0thwvt2",
      "type": "user",
      "uri": "spotify:user:n2bgnd81744fsvs9rv0thwvt2"
    },
    "is_local": false,
    "primary_color": null,
    "track": {
      "preview_url": null,
      "explicit": false,
      "type": "track",
      "episode": false,
      "track": true,
      "album": {
        "type": "album",
        "album_type": "album",
        "href": "https://api.spotify.com/v1/albums/5C0YLr4OoRGFDaqdMQmkeH",
        "id": "5C0YLr4OoRGFDaqdMQmkeH",
        "images": [
          {
            "height": 640,
            "url": "https://i.scdn.co/image/ab67616d0000b273ef0d4234e1a645740f77d59c",
            "width": 640
          },
          {
            "height": 300,
            "url": "https://i.scdn.co/image/ab67616d00001e02ef0d4234e1a645740f77d59c",
            "width": 300
          },
          {
            "height": 64,
            "url": "https://i.scdn.co/image/ab67616d00004851ef0d4234e1a645740f77d59c",
            "width": 64
          }
        ],
        "name": "VIDA",
        "release_date": "2019-02-01",
        "release_date_precision": "day",
        "uri": "spotify:album:5C0YLr4OoRGFDaqdMQmkeH",
        "artists": [
          {
            "external_urls": {
              "spotify": "https://open.spotify.com/artist/4V8Sr092TqfHkfAA5fXXqG"
            },
            "href": "https://api.spotify.com/v1/artists/4V8Sr092TqfHkfAA5fXXqG",
            "id": "4V8Sr092TqfHkfAA5fXXqG",
            "name": "Luis Fonsi",
            "type": "artist",
            "uri": "spotify:artist:4V8Sr092TqfHkfAA5fXXqG"
          }
        ],
        "external_urls": {
          "spotify": "https://open.spotify.com/album/5C0YLr4OoRGFDaqdMQmkeH"
        },
        "total_tracks": 15
      },
      "artists": [
        {
          "external_urls": {
            "spotify": "https://open.spotify.com/artist/4V8Sr092TqfHkfAA5fXXqG"
          },
          "href": "https://api.spotify.com/v1/artists/4V8Sr092TqfHkfAA5fXXqG",
          "id": "4V8Sr092TqfHkfAA5fXXqG",
          "name": "Luis Fonsi",
          "type": "artist",
          "uri": "spotify:artist:4V8Sr092TqfHkfAA5fXXqG"
        },
        {
          "external_urls": {
            "spotify": "https://open.spotify.com/artist/4VMYDCV2IEDYJArk749S6m"
          },
          "href": "https://api.spotify.com/v1/artists/4VMYDCV2IEDYJArk749S6m",
          "id": "4VMYDCV2IEDYJArk749S6m",
          "name": "Daddy Yankee",
          "type": "artist",
          "uri": "spotify:artist:4VMYDCV2IEDYJArk749S6m"
        }
      ],
      "disc_number": 1,
      "track_number": 9,
      "duration_ms": 229360,
      "external_ids": {
        "isrc": "USUM71607007"
      },
      "external_urls": {
        "spotify": "https://open.spotify.com/track/6habFhsOp2NvshLv26DqMb"
      },
      "href": "https://api.spotify.com/v1/tracks/6habFhsOp2NvshLv26DqMb",
      "id": "6habFhsOp2NvshLv26DqMb",
      "name": "Despacito",
      "popularity": 79,
      "uri": "spotify:track:6habFhsOp2NvshLv26DqMb",
      "is_local": false
    },
    "video_thumbnail": {
      "url": null
    }
  }
]

const sampleStream = {
  "success": true,
  "metadata": {
      "cache": true,
      "success": true,
      "id": "6habFhsOp2NvshLv26DqMb",
      "artists": "Luis Fonsi, Daddy Yankee",
      "title": "Despacito",
      "album": "VIDA",
      "cover": "https://i.scdn.co/image/ab67616d0000b273ef0d4234e1a645740f77d59c",
      "isrc": "USUM71607007",
      "releaseDate": "2019-02-01"
  },
  "link": "https://cdn1.meow.gs/api/stream?id=6Wz-sQEhmHxG4Y9TjT0TV&exp=1723369634205&sig=ZFd8NuDJayVW-XnZBd0uqOIQ_nitONemRjowHSQRyQk&sec=PnUBytnow2cmlOstH3CO0rhR1z9oCeqFrs4tdkJBRT0&iv=w38hdLnMrvaWMfGQ_9lo2g"
}